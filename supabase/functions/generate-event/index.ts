import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import {
  buildPromptMessages,
  ContractValidationError,
  MAX_BODY_BYTES,
  normalizeProviderUsage,
  OPENAI_EVENT_RESPONSE_FORMAT,
  parseAllowedOrigins,
  parseGlobalDailyLimit,
  parseGenerateEventRequest,
  parseProviderEvent,
  parseRateLimitResult,
} from "./contract.ts";

const DEFAULT_MODEL = "gpt-4.1-nano";
const REQUEST_TIMEOUT_MS = 15_000;
const BODY_READ_TIMEOUT_MS = 2_000;
const OPENAI_TIMEOUT_MS = 8_000;
const DATABASE_TIMEOUT_MS = 2_500;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
  { timeoutDuration: 3_000, cooldownDuration: 30_000, cacheMaxAge: 3_600_000 },
);

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new HttpError(503, "SERVICE_UNAVAILABLE", "The generation service is not configured.");
  return value;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "retry-after, x-request-id, x-ratelimit-remaining-burst, x-ratelimit-remaining-day, x-ratelimit-remaining-project-day",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status: number, requestId: string, origin?: string, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(origin ? corsHeaders(origin) : {}),
      ...extraHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": requestId,
    },
  });
}

function abortReason(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError");
}

async function readJsonBody(request: Request, signal: AbortSignal) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_BODY_BYTES) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds 16 KiB.");
  }
  if (!request.body) throw new HttpError(400, "INVALID_REQUEST", "Request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancelReader = () => {
    reader.cancel(abortReason(signal)).catch(() => {});
  };
  signal.addEventListener("abort", cancelReader, { once: true });

  try {
    while (true) {
      if (signal.aborted) throw abortReason(signal);
      const { value, done } = await reader.read();
      if (signal.aborted) throw abortReason(signal);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds 16 KiB.");
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancelReader);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, "INVALID_REQUEST", "Request body must contain valid UTF-8 JSON.");
  }
}

function bearerToken(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new HttpError(401, "UNAUTHENTICATED", "A valid Firebase ID token is required.");
  return match[1];
}

async function verifyFirebaseIdToken(token: string, projectId: string) {
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      requiredClaims: ["sub", "iat", "exp", "auth_time"],
      clockTolerance: 5,
    });
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) throw new Error("invalid subject");
    if (typeof payload.iat !== "number" || payload.iat > now + 5) throw new Error("invalid issued-at");
    if (typeof payload.auth_time !== "number" || !Number.isInteger(payload.auth_time) || payload.auth_time > now + 5) {
      throw new Error("invalid auth time");
    }
    return payload.sub;
  } catch {
    throw new HttpError(401, "UNAUTHENTICATED", "A valid Firebase ID token is required.");
  }
}

async function userKey(uid: string, secret: string) {
  if (secret.length < 32) throw new HttpError(503, "SERVICE_UNAVAILABLE", "The generation service is not configured.");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(uid));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(key: string, projectDailyLimit: number, requestSignal: AbortSignal) {
  const timeoutSignal = AbortSignal.timeout(DATABASE_TIMEOUT_MS);
  const response = await fetch(`${requiredEnv("SUPABASE_URL")}/rest/v1/rpc/consume_generate_event_quota`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${requiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      "apikey": requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user_key: key, p_project_daily_limit: projectDailyLimit }),
    signal: AbortSignal.any([requestSignal, timeoutSignal]),
  });
  if (!response.ok) throw new HttpError(503, "SERVICE_UNAVAILABLE", "The generation service is temporarily unavailable.");
  const payload = await response.json();
  const value = Array.isArray(payload) ? payload[0] : payload;
  try {
    return parseRateLimitResult(value);
  } catch (error) {
    if (!(error instanceof ContractValidationError)) throw error;
    throw new HttpError(503, "SERVICE_UNAVAILABLE", "The generation service is temporarily unavailable.");
  }
}

async function generateEvent(
  request: ReturnType<typeof parseGenerateEventRequest>,
  model: string,
  requestSignal: AbortSignal,
) {
  const timeoutSignal = AbortSignal.timeout(OPENAI_TIMEOUT_MS);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${requiredEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: buildPromptMessages(request),
      response_format: OPENAI_EVENT_RESPONSE_FORMAT,
      max_completion_tokens: request.narrativeMode ? 400 : 200,
      temperature: 0.8,
    }),
    signal: AbortSignal.any([requestSignal, timeoutSignal]),
  });
  if (!response.ok) throw new HttpError(502, "UPSTREAM_ERROR", "The narrative provider could not complete the request.");

  let payload: Record<string, unknown>;
  try {
    payload = await response.json();
  } catch {
    throw new HttpError(502, "INVALID_PROVIDER_RESPONSE", "The narrative provider returned an invalid response.");
  }
  const choices = payload.choices;
  if (!Array.isArray(choices) || !choices.length || !choices[0] || typeof choices[0] !== "object") {
    throw new HttpError(502, "INVALID_PROVIDER_RESPONSE", "The narrative provider returned an invalid response.");
  }
  const first = choices[0] as Record<string, unknown>;
  if (first.finish_reason === "length") {
    throw new HttpError(502, "INVALID_PROVIDER_RESPONSE", "The narrative provider response was incomplete.");
  }
  const message = first.message;
  if (!message || typeof message !== "object" || (message as Record<string, unknown>).refusal) {
    throw new HttpError(502, "PROVIDER_REFUSAL", "The narrative provider declined the request.");
  }
  const content = (message as Record<string, unknown>).content;
  if (typeof content !== "string") {
    throw new HttpError(502, "INVALID_PROVIDER_RESPONSE", "The narrative provider returned an invalid response.");
  }
  try {
    return {
      event: parseProviderEvent(JSON.parse(content)),
      usage: payload.usage as Record<string, unknown> | undefined,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "INVALID_PROVIDER_RESPONSE", "The narrative provider returned an invalid response.");
  }
}

serve(async (request: Request) => {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  let origin: string | undefined;
  try {
    const configuredOrigins = parseAllowedOrigins(requiredEnv("ALLOWED_ORIGINS"));
    const requestOrigin = request.headers.get("origin");
    if (!requestOrigin || !configuredOrigins.has(requestOrigin)) {
      throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed.");
    }
    origin = requestOrigin;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Only POST is supported.");

    const operationSignal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]);

    const uid = await verifyFirebaseIdToken(bearerToken(request), requiredEnv("FIREBASE_PROJECT_ID"));
    const rateKey = await userKey(uid, requiredEnv("RATE_LIMIT_HMAC_SECRET"));

    let parsedRequest;
    try {
      const bodySignal = AbortSignal.any([
        operationSignal,
        AbortSignal.timeout(BODY_READ_TIMEOUT_MS),
      ]);
      parsedRequest = parseGenerateEventRequest(await readJsonBody(request, bodySignal));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof ContractValidationError) {
        throw new HttpError(400, "INVALID_REQUEST", "Request body does not match the generate-event contract.");
      }
      throw error;
    }

    const projectDailyLimit = parseGlobalDailyLimit(Deno.env.get("GENERATE_EVENT_GLOBAL_DAILY_LIMIT"));
    const rateLimit = await consumeRateLimit(rateKey, projectDailyLimit, operationSignal);
    const rateHeaders = {
      "X-RateLimit-Remaining-Burst": String(Math.max(0, rateLimit.remaining_burst)),
      "X-RateLimit-Remaining-Day": String(Math.max(0, rateLimit.remaining_day)),
      "X-RateLimit-Remaining-Project-Day": String(Math.max(0, rateLimit.remaining_project_day)),
    };
    if (!rateLimit.allowed) {
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "Generation limit reached. Try again later.",
        Math.max(1, rateLimit.retry_after_seconds),
        rateHeaders,
      );
    }

    const model = Deno.env.get("OPENAI_MODEL")?.trim() || DEFAULT_MODEL;
    const result = await generateEvent(parsedRequest, model, operationSignal);
    const normalizedUsage = normalizeProviderUsage(result.usage);

    return jsonResponse({
      event: result.event,
      meta: {
        requestId,
        model,
        latencyMs: Math.round(performance.now() - startedAt),
        ...(normalizedUsage ? { usage: normalizedUsage } : {}),
      },
    }, 200, requestId, origin, rateHeaders);
  } catch (error) {
    const httpError = error instanceof HttpError
      ? error
      : error instanceof DOMException && error.name === "TimeoutError"
      ? new HttpError(504, "UPSTREAM_TIMEOUT", "The generation service timed out.")
      : error instanceof DOMException && error.name === "AbortError"
      ? new HttpError(499, "REQUEST_ABORTED", "The request was cancelled.")
      : error instanceof ContractValidationError
      ? new HttpError(503, "SERVICE_UNAVAILABLE", "The generation service is not configured.")
      : new HttpError(500, "INTERNAL_ERROR", "The generation service failed unexpectedly.");

    console.error(JSON.stringify({ requestId, code: httpError.code, status: httpError.status }));
    return jsonResponse(
      { error: { code: httpError.code, message: httpError.message } },
      httpError.status,
      requestId,
      origin,
      {
        ...httpError.headers,
        ...(httpError.retryAfter ? { "Retry-After": String(httpError.retryAfter) } : {}),
      },
    );
  }
});
