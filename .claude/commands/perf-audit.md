# /perf-audit — React Performance Audit

Find unnecessary re-renders, expensive inline objects, and bundle weight issues in the SIMLYFE frontend.

## Steps

1. Read `src/engine/gameState.js`. Check the return statement:
   - Are any objects or arrays created inline in the return (e.g., `return { computed: someArr.filter(...) }`)? These create new references on every render.
   - Are any functions defined inside the hook but not wrapped in `useCallback`? List the ones called from child components as props.
   - Are there expensive `.filter()`, `.map()`, or `.reduce()` operations on large arrays that run on every render without `useMemo`?

2. Read `src/components/MainGame.jsx`. Check for:
   - Large inline `style` objects defined directly in JSX (e.g., `style={{ background: 'red', padding: 20 }}`). These re-create on every render.
   - Inline arrow functions passed as event handlers that could cause child re-renders.
   - Any `useEffect` with missing or overly broad dependency arrays.
   - Components that could be memoized with `React.memo` but aren't.

3. Read each sheet in `src/components/sheets/`. Flag the same issues per sheet.

4. Check `vite.config.js` for:
   - Whether code splitting is configured (dynamic imports or `manualChunks`).
   - Whether the build output is analyzed anywhere (bundle size visibility).

5. Check `package.json` for any dependencies that are unusually large or that have lighter alternatives:
   - Is `@google/generative-ai` in the bundle even though it's not used? Flag it.
   - Is `firebase-admin` in `dependencies` (client-side) instead of `devDependencies` or removed?

6. Output a performance report:
   - **Re-render risks**: list file:line for each inline object/function that causes unnecessary re-renders
   - **useMemo/useCallback candidates**: list functions and computations worth memoizing
   - **Bundle concerns**: list unused or heavy packages
   - **Priority**: rank all issues High / Medium / Low

## When to use
Run when the game feels sluggish during rapid aging (clicking Age+ quickly), when mobile performance degrades, or after adding a large new feature. Also run before any production deploy.

## Tips & tricks
- The most impactful fix in React is almost always eliminating inline object literals from render — they're invisible but cause constant child re-renders.
- `useGameState` returning 50+ values means every consumer of the hook re-renders on any state change. This is the largest architectural perf risk — keep it in mind even if you can't fix it now.
- Inline `style` objects in `MainGame.jsx` are expected and intentional for dynamic values — only flag ones with entirely static values that could be CSS classes instead.
- Use the browser DevTools Performance tab to record a 10-age-up session and look for long tasks before assuming which code is the bottleneck.
- `@google/generative-ai` being in the bundle unused is a free win — removing it from `package.json` saves bundle weight immediately.
