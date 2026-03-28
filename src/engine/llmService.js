// Route LLM calls through the Supabase Edge Function proxy when configured.
// This keeps OPENAI_API_KEY server-side instead of bundled in client JS.
// Fallback: if only VITE_OPENAI_API_KEY is set (dev mode), call OpenAI directly.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const directApiKey = import.meta.env.VITE_OPENAI_API_KEY;

const useProxy = !!(supabaseUrl && supabaseKey);
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'test';
const canUseDirectKey = !!(directApiKey && isDev);

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
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return 'Flags must be an object';
        }
        continue;
      }

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return `Effect "${key}" must be a finite number`;
      }

      const limit = key === 'bank' ? 100000 : 100;
      if (Math.abs(value) > limit) {
        return `Effect "${key}" exceeds safe range`;
      }
    }
  }

  return null;
}

export async function generateDynamicEvent(state, actionContext) {
  if (!useProxy && !canUseDirectKey) {
    if (directApiKey && !isDev) {
      console.warn("Direct OpenAI key usage is disabled outside dev/test. Configure the Supabase proxy to enable LLM events.");
    } else {
      console.warn("No LLM credentials configured — skipping dynamic event generation.");
    }
    return null;
  }

  try {
    const historyLog = state.history.slice(-5).map(h => `Age ${h.age}: ${h.text}`).join('\n');

    let promptText = `You are the core Event Engine for a dark, hyper-realistic text-based life simulator.
Based on the character's exact demographics, age, recent history, and crucially their STATS, generate a single highly creative, age-appropriate, logically consistent annual life event.

CRITICAL CONSTRAINT: The event description MUST be extremely concise, strictly under 50 words! Keep it punchy like a text message since players rapidly tap through years.

CRITICAL STAT ENFORCEMENT:
You act as a ruthless Dungeon Master. You MUST explicitly evaluate the user's stats before determining the outcome of their action.
- Athleticism ranges from 0-100. If they attempt Pro Sports, rigorous training, or physical combat with low Athleticism, THEY MUST FAIL horribly.
- Karma ranges from 0 (Pure Evil/Criminal) to 100 (Saint/Innocent). If they attempt to join the Mafia, deal drugs, or commit crimes with high Karma, the criminals won't trust them and THEY MUST FAIL (e.g. getting beaten up, robbed, or shot). If they have low Karma, they succeed in the criminal underworld.
- If they fail a specialized career action due to poor stats, generate severe negative effects (e.g., {"health": -30, "bank": -500}) and explicitly narrate their specific inadequacy in the description.
- If they successfully practice a skill (like taking lessons or working out), output choices that explicitly increase the relevant stat (e.g., {"athleticism": 5}).

CRITICAL: You MUST return strictly and exclusively raw JSON without any markdown formatting wrappers.
The JSON object MUST have this exact schema:
{
  "description": "The concise event description (under 50 words)",
  "choices": [
    { "text": "Choice 1 text (short)", "effects": { "health": -10, "bank": 50, "athleticism": 2, "karma": -5 } },
    { "text": "Choice 2 text (short)", "effects": { "happiness": 20 } }
  ]
}

Current State:
Name: ${state.character.name} (${state.character.gender})
Location: ${state.character.country}
Age: ${state.age}
Stats: Health ${state.stats.health || 0}%, Happiness ${state.stats.happiness || 0}%, Smarts ${state.stats.smarts || 0}%, Looks ${state.stats.looks || 0}%, Athleticism ${state.stats.athleticism || 0}%, Karma ${state.stats.karma || 0}%
Hidden Skills: Acting ${state.stats.acting || 0}%, Voice ${state.stats.voice || 0}%, Modeling ${state.stats.modeling || 0}%
Net Worth: $${state.bank}
Job: ${state.career ? state.career.title : 'Unemployed'}

Recent History logs (last 5):
${historyLog}`;

    if (actionContext) {
      promptText += `\n\nCRITICAL CONTEXT: The user just explicitly performed this action in the app: "${actionContext}". Generate the event DIRECTLY centered around the immediate consequences or outcome of this action!`;
    }

    const messages = [{ role: "user", content: promptText }];

    let response;
    if (useProxy) {
      // Secure path: proxy through Supabase Edge Function
      response = await fetch(`${supabaseUrl}/functions/v1/generate-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ messages, max_tokens: 400, temperature: 0.8 }),
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
          model: "gpt-4o-mini",
          messages,
          temperature: 0.8,
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
    console.error("LLM Error Logs:", error);
    return {
      description: `LLM ERROR: ${error.message}`,
      choices: [{ text: "Understood", effects: {} }]
    };
  }
}
