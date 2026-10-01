# SIMLYFE

SIMLYFE is a mobile-first browser life simulator. Create a character, age one year at a time, and navigate education, careers, relationships, assets, cities, pets, health, gambling, and AI-generated life events.

**[Play SIMLYFE](https://simlyfe.vercel.app)** · [Documentation](./docs/README.md) · [Technical case study](./docs/case-study.md)

The project combines a React interface with explicit gameplay calculations and generated narrative. Firebase supplies guest/account identity and cloud saves. An authenticated Supabase Edge Function owns the OpenAI call, prompt, and quotas; the browser receives no OpenAI credential.

## Start locally

Use Node.js 22.12 or newer on the Node 22 line, then:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill in the public Firebase web-app configuration and Supabase URL/publishable key in `.env.local`. The default Vite address is `http://localhost:5173`. See [development setup](./docs/development.md) for the exact variables and backend requirements.

Android development: `npm run android:build` packages the same game as an APK.
See the [Android runbook](./docs/android.md) for SDK/Firebase setup, installation,
native verification and release gates.

## Stack and structure

| Area | Choice |
|---|---|
| Frontend | React 19, Vite 8, JavaScript/JSX |
| UI | Pure CSS, responsive sheets, mobile-first layout |
| Game engine | One `useGameState` owner with pure domain and annual-simulation modules |
| Identity and saves | Firebase Auth: anonymous, Google, email/password; Firestore |
| Generated events | Authenticated Supabase Edge Function and OpenAI |
| Verification | ESLint, Vitest, Testing Library, Playwright |
| Hosting | Vercel |

## Verify changes

```bash
npm run lint
npm test
npm run build
npm run check:docs
CI=1 npm run test:e2e
```

Install Playwright Chromium once if needed with `npx playwright install chromium`. Unit and browser tests use controlled service responses; live authentication, AI generation, and save/reload require separate [deployment verification](./docs/operations.md#verify-a-deployment).

## Documentation by task

| Task | Read |
|---|---|
| Understand runtime and save boundaries | [Architecture](./docs/architecture.md) |
| Understand implemented game rules | [Game mechanics](./docs/game-mechanics.md) |
| Extend the code safely | [Agent guide](./docs/agent-guide.md) |
| Configure local development or run tests | [Development](./docs/development.md) |
| Connect cloud services or deploy | [Operations](./docs/operations.md) |
| Review refactor scope and evidence | [Refactor plan](./docs/refactor-plan.md) |
| Understand the portfolio story | [Case study](./docs/case-study.md) |

The three canonical contributor entry points remain architecture, game mechanics, and agent guide. [AGENTS.md](./AGENTS.md) and [CLAUDE.md](./CLAUDE.md) point to them. Setup commands, operational procedures, and validation results have dedicated owners to limit documentation drift.
