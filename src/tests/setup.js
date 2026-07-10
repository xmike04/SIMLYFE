import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Silence firebase console warnings in tests
vi.mock('../config/firebase', () => ({
  db: null,
  auth: null,
}));

// Silence LLM calls in tests by default
vi.mock('../engine/llmService', () => ({
  generateDynamicEvent: vi.fn().mockResolvedValue(null),
}));
