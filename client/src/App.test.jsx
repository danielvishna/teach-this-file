/**
 * @fileoverview Unit test for App.jsx's phase routing. Detailed screen
 * behavior is covered by each screen's own test file (SetupScreen.test.jsx,
 * etc.) — this just checks App renders the right one for the initial phase.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

describe('App', () => {
  it('renders the setup screen for the initial phase', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /teach this file/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/gemini api key/i)).toBeInTheDocument();
  });
});
