# SIMLYFE

SIMLYFE is a mobile-first, browser-based life simulation game built with React 19 and Vite. Players create a character and age them one year at a time, navigating careers, relationships, finances, and AI-generated life events from birth to death. The UI uses a dark glassmorphism aesthetic.

Cloud saves are powered by Firebase. AI events are proxied through a Supabase Edge Function backed by OpenAI GPT-4o-mini.

## Setup & Running Locally

1. **Install dependencies:**

   ```
   npm install
   ```

2. **Configure environment variables:**

   Create a `.env.local` file in the root directory (already in `.gitignore`) with your credentials:

   ```
   # LLM proxy — keeps OpenAI key server-side (recommended for production)
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Dev fallback — direct OpenAI call (key exposed in bundle, local dev only)
   VITE_OPENAI_API_KEY=your_openai_key

   # Firebase cloud saves (all six required to enable)
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

   When `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set, LLM calls route through the Supabase Edge Function and the OpenAI key stays server-side. If only `VITE_OPENAI_API_KEY` is set, the game calls OpenAI directly (dev only). If no LLM keys are set, events will return an error — there is no silent static fallback.

3. **Start the development server:**

   ```
   npm run dev
   ```

   Opens at `http://localhost:5173`. The UI is mobile-first — best viewed at ~390px width.

## Testing

The test suite covers the game engine, LLM service, and all static data catalogs using Vitest.

```
npm test              # Run all tests once
npm run test:watch    # Watch mode for active development
npm run test:coverage # Coverage report → coverage/
```

### Test files

| File | What it covers |
|---|---|
| `engine.mechanics.test.js` | Core stat/career/economy logic as pure functions (350+ assertions) |
| `llmService.test.js` | LLM proxy path, dev-fallback path, malformed JSON handling, JSON schema validation |
| `config.data.test.js` | Shape and completeness of activities, assets, stores, and career catalogs |
| `market.test.js` | Investment market mechanics: crypto, bonds, funds, economy phase modifiers |
| `App.test.jsx` | Smoke test — verifies the app renders without crashing |

## Production Build

```
npm run build
npm run preview
```

## Project Docs

Full architecture, game mechanics, and contribution conventions are in [`CLAUDE.md`](./CLAUDE.md).
