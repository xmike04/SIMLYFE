// Route LLM calls through the Supabase Edge Function proxy when configured.
// This keeps OPENAI_API_KEY server-side instead of bundled in client JS.
// Fallback: if only VITE_OPENAI_API_KEY is set (dev mode), call OpenAI directly.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const directApiKey = import.meta.env.VITE_OPENAI_API_KEY;

const useProxy = !!(supabaseUrl && supabaseKey);
const isNonProd = !import.meta.env.PROD;
const canUseDirectKey = !!(directApiKey && isNonProd);

// Bank effects can be larger; cap them to match events.json validation limits.
const MAX_BANK_EFFECT = 100000;
// Stat effects mirror the 0-100 stat range used throughout the game.
const MAX_STAT_EFFECT = 100;

// "flags" effects carry string markers (e.g., "promoted", "broke") consumed by game state.
const VALID_EFFECT_KEYS = new Set([
  'health', 'happiness', 'smarts', 'looks', 'bank',
  'athleticism', 'karma', 'acting', 'voice', 'modeling', 'grades', 'flags'
]);

function validateEventPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload must be an object';
  }

  if (typeof payload.description !== 'string' || !payload.description.trim()) {
    return 'Description must be a non-empty string';
  }

  if (!Array.isArray(payload.choices) || payload.choices.length === 0) {
    return 'Choices must be a non-empty array';
  }

  for (const choice of payload.choices) {
    if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
      return 'Choice must be an object';
    }
    if (typeof choice.text !== 'string' || !choice.text.trim()) {
      return 'Choice text must be a non-empty string';
    }
    if (!choice.effects || typeof choice.effects !== 'object' || Array.isArray(choice.effects)) {
      return 'Choice effects must be an object';
    }

    for (const [key, value] of Object.entries(choice.effects)) {
      if (!VALID_EFFECT_KEYS.has(key)) {
        return `Unknown effect key "${key}"`;
      }

      if (key === 'flags') {
        const flagsError = validateFlags(value);
        if (flagsError) {
          return flagsError;
        }
        continue;
      }

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return `Effect "${key}" must be a finite number`;
      }

      const limit = key === 'bank' ? MAX_BANK_EFFECT : MAX_STAT_EFFECT;
      if (Math.abs(value) > limit) {
        return `Effect "${key}" exceeds safe range`;
      }
    }
  }

  return null;
}

function validateFlags(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return 'Flags must be a non-empty array of strings';
  }
  if (value.some(flag => typeof flag !== 'string' || flag.trim().length === 0)) {
    return 'Flags must be a non-empty array of strings';
  }
  return null;
}

export async function generateDynamicEvent(state, actionContext) {
  if (!useProxy && !canUseDirectKey) {
    if (directApiKey && !isNonProd) {
      console.warn("Direct OpenAI key usage is disabled in production to prevent API key exposure in bundles. Configure the Supabase proxy to enable LLM events.");
    } else {
      console.warn("No LLM credentials configured — skipping dynamic event generation.");
    }
    return {
      description: directApiKey && !isNonProd
        ? "LLM ERROR: Direct OpenAI keys are disabled in production. Configure the Supabase proxy."
        : "LLM ERROR: No LLM credentials configured. Add Supabase proxy environment variables.",
      choices: [{ text: "Understood", effects: {} }],
    };
  }

  const {
    narrativeMode = false,
    relationships = [],
    pets = [],
    city,
    education,
    economyPhase,
  } = state;

  try {
    const historyLog = state.history.slice(-5).map(h => `Age ${h.age}: ${h.text}`).join('\n');

    const educationLine = (() => {
      if (!education) return 'No formal education';
      const parts = [];
      if (education.highSchool) parts.push('High School');
      if (education.associate) parts.push("Associate's");
      if (education.bachelor) parts.push("Bachelor's");
      if (education.master) parts.push("Master's");
      if (education.phd) parts.push('PhD');
      return parts.length ? parts.join(', ') : 'No formal education';
    })();

    const locationLine = city ?? state.character.country;

    const relationshipsLine = relationships.length
      ? relationships.slice(0, 5).map(r => `${r.type} ${r.name} (age ${r.age}, bond: ${r.relation ?? 0}/100)`).join('; ')
      : 'none';

    const alivePets = pets.filter(p => p.isAlive);

    const wordCountInstruction = narrativeMode
      ? 'HARD LIMIT: description = exactly 2 sentences max, 35 words max. Second-person present tense. Vivid and visceral.'
      : 'HARD LIMIT: description = exactly 1-2 sentences, 35 words max. No exceptions.';

    let promptText = `You are the Event Engine for a dark life simulator. Generate ONE punchy life event.

DESCRIPTION RULE: ${wordCountInstruction} Write like a viral push notification — specific, shocking, or funny. Hook them in the first 5 words. No filler.

STAT RULES (enforce ruthlessly):
- Low Athleticism → fails physical actions badly ({"health": -20, "bank": -200})
- High Karma (80+) → fails crime attempts, gets beaten/robbed
- Low Karma (20-) → succeeds in criminal underworld
- Match outcomes to stats. Failure = harsh consequences narrated bluntly.

OUTPUT: Raw JSON only, no markdown.
{
  "description": "...",
  "choices": [
    { "text": "short label", "effects": { "health": -10, "bank": 50 } },
    { "text": "short label", "effects": { "happiness": 20 } }
  ]
}

Current State:
Name: ${state.character.name} (${state.character.gender})
Location: ${locationLine}
Age: ${state.age}
Stats: Health ${state.stats.health || 0}%, Happiness ${state.stats.happiness || 0}%, Smarts ${state.stats.smarts || 0}%, Looks ${state.stats.looks || 0}%, Athleticism ${state.stats.athleticism || 0}%, Karma ${state.stats.karma || 0}%
Hidden Skills: Acting ${state.stats.acting || 0}%, Voice ${state.stats.voice || 0}%, Modeling ${state.stats.modeling || 0}%
Net Worth: $${state.bank}
Job: ${state.career ? state.career.title : 'Unemployed'}
Education: ${educationLine}
Economy: ${economyPhase ?? 'normal'} phase
Key Relationships: ${relationshipsLine}${alivePets.length ? `\nPets: ${alivePets.map(p => p.name).join(', ')}` : ''}

Recent History logs (last 5):
${historyLog}`;

    if (actionContext) {
      promptText += `\n\nCRITICAL CONTEXT: The user just explicitly performed this action in the app: "${actionContext}". Generate the event DIRECTLY centered around the immediate consequences or outcome of this action!`;
    }

    const messages = [{ role: "user", content: promptText }];
    const maxTokens = narrativeMode ? 400 : 200;

    let response;
    if (useProxy) {
      // Secure path: proxy through Supabase Edge Function
      response = await fetch(`${supabaseUrl}/functions/v1/generate-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({ messages, max_tokens: maxTokens, temperature: 0.9 }),
      });
    } else {
      // Dev fallback: direct OpenAI call (key visible in bundle — dev only)
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${directApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-nano",
          messages,
          max_tokens: maxTokens,
          temperature: 0.9,
          response_format: { type: "json_object" },
        }),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${JSON.stringify(data.error || data)}`);
    }

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Unexpected API response structure");
    }
    let textResult = data.choices[0].message.content.trim();
    if (textResult.startsWith('```')) {
      textResult = textResult.replace(/^```json\n?/i, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(textResult);
    const validationError = validateEventPayload(parsed);
    if (validationError) {
      throw new Error(`Invalid LLM event payload: ${validationError}`);
    }
    return parsed;

  } catch (error) {
    console.error("LLM Error:", error);
    return {
      description: `LLM ERROR: ${error.message}`,
      choices: [{ text: "Understood", effects: {} }],
    };
  }
}
