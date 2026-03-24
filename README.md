# SIMLYFE

SIMLYFE is a text-based, complex life simulation browser game built with React 19 and Vite.
Players age up year-by-year, navigating relationships, real estate, volatile stock and crypto markets, progressive tax brackets, and dynamically generated life events powered by LLMs (e.g. GPT-4o-mini).

## Setup & Running Locally

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Setup Environment Variables (Optional but Recommended):**
   Create a `.env.local` file in the root directory (it's in `.gitignore`) and add your OpenAI API Key for dynamic events.
   ```
   VITE_OPENAI_API_KEY=your_key_here
   ```
   *Note: Without a key, the game falls back to a library of pre-written static events (`events.json`).*
3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   This will start a local server, usually at `http://localhost:5173`. Open this URL in your browser to play the game! The UI uses responsive design and operates best when mimicking a mobile resolution (max width 480px).

## Testing the Game Engine

We have an extensive suite of integration tests covering the game's core stateless mechanics (wealth tiers, capital gains tax, crypto volatility, bond maturity, and relationship decay rules).

Run the test suite using `vitest`:

- **Run all tests once:**
  ```bash
  npm test
  ```
- **Run tests in watch mode (for active development):**
  ```bash
  npm run test:watch
  ```
- **Coverage report:**
  ```bash
  npm run test:coverage
  ```

### What's Being Tested?
Our testing strategy ensures that UI bugs don't bleed into the logic layer:
* `engine.mechanics.test.js`: Contains 350+ edge cases and core mechanic validations without rendering React.
* `llmService.test.js`: Validates the structure and consistency of our JSON event catalogs and parsing functions.
* `config.data.test.js`: Ensures no missing properties across our catalogs (Activities, Assets, Store catalogs, specific item limits, etc.).

## Production Build

To test if the application bundles and minifies without any syntax or dependency errors:

```bash
npm run build
npm run preview
```
