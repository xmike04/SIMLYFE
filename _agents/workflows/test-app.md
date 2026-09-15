---
description: Test and verify the React application
---

# Testing Workflow

This workflow ensures code changes have not introduced syntax, linting, bundle, or logic errors in the SIMLYFE Vite React application.

1. Ensure all dependencies are correctly installed.
// turbo
npm install

2. Run ESLint to detect stylistic errors and syntax bugs across the project.
// turbo
npm run lint

3. Run the full unit test suite (domain mechanics, annual/cloud integration, LLM service, config data, market, smoke).
// turbo
npm test

4. Build the application for production to verify successful compilation and hook dependency arrays.
// turbo
npm run build

5. Check local documentation links, package commands, and architecture paths.
// turbo
npm run check:docs

6. For browser-flow changes, run the Playwright suite (see docs/development.md for browser installation).
// turbo
CI=1 npm run test:e2e
