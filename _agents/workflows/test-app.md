---
description: Test and verify the React application
---

# Testing Workflow

This workflow ensures code changes have not introduced syntax, linting, or bundle compilation errors in the Vite React application.

1. Ensure all dependencies are correctly installed.
// turbo
npm install

2. Run ESLint to detect stylistic errors and syntax bugs across the project.
// turbo
npm run lint

3. Build the application for production to verify successful compilation and hook dependency arrays.
// turbo
npm run build
