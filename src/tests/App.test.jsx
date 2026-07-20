import React from 'react';
import { render } from '@testing-library/react';
import { describe, it } from 'vitest';
import App from '../App';

describe('App crashing test', () => {
  it('renders without crashing', () => {
    try {
      render(<App />);
    } catch (e) {
      console.error("APP CRASH EXACT ERROR:", e);
      throw e;
    }
  });
});
