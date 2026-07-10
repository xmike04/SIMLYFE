# SIMLYFE

SIMLYFE is a mobile-first, browser-based life simulation game built with React 19 and Vite. Players create a character, age one year at a time, and navigate careers, relationships, education, assets, cities, pets, health, gambling, and AI-generated life events.

- Live demo: https://simlyfe.vercel.app
- Technical case study: [docs/case-study.md](docs/case-study.md)
- Architecture and agent guide: [CLAUDE.md](CLAUDE.md)

## Why It Exists

SIMLYFE is a portfolio project with a playable product surface. The core pitch is a darker, faster life sim where stats and systems actually push back: low athleticism affects physical choices, karma changes crime outcomes, wealth tiers create lifestyle pressure, and dynamic events are generated from current state instead of static flavor text.

## Stack

| Layer | Technology |
|---|---|
| App | React 19, Vite 8, plain JSX |
| Styling | Pure CSS with CSS variables |
| State | Custom `useGameState()` hook |
| Persistence | Optional Firebase anonymous auth + Firestore |
| AI events | Supabase Edge Function proxy to OpenAI `gpt-4.1-nano` |
| Tests | Vitest, Testing Library, Playwright |
| Hosting | Vercel |

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app opens at `http://localhost:5173`. It is designed mobile-first and is best reviewed first around `390px` wide.

## Environment

Production LLM events should use the Supabase proxy:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE=
```

Set `OPENAI_API_KEY` as a Supabase Edge Function secret, not a Vercel client variable. `VITE_SUPABASE_ANON_KEY` is supported only as a legacy fallback; new Supabase projects should use `VITE_SUPABASE_PUBLISHABLE`. `VITE_OPENAI_API_KEY` is a local-only fallback and must not be set in production builds. Firebase cloud saves are optional; all `VITE_FIREBASE_*` variables must be present before saves activate. Debug tools are hidden unless `VITE_ENABLE_DEV_TOOLS=true`.

## Scripts

```bash
npm run dev            # Start Vite
npm run lint           # ESLint
npm test               # Vitest unit/config suite
npm run test:e2e       # Playwright first-run smoke flow
npm run build          # Production build
npm run preview        # Preview built app
```

## Testing Coverage

The test suite covers engine mechanics, market behavior, static catalog shape, LLM proxy/dev-fallback behavior, and app render smoke tests. The Playwright flow verifies the first-run browser path from splash screen through character creation, aging, event choice, and core sheet navigation.

## Production Notes

The Vercel project is `xmike04s-projects/simlyfe`. Local Vercel metadata lives in `.vercel/` and is ignored. Before production deployment, run:

```bash
vercel pull --yes --environment=production
npm run lint
npm test
npm run build
npm run test:e2e
```

Then deploy a preview, verify it in browser, and promote/deploy production only after the preview passes.
