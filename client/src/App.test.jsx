/**
 * @fileoverview Unit tests for the deploy smoke-test screen. fetch is
 * mocked throughout - no real network/AI call, consistent with the
 * project's rule that unit tests never hit the real AI provider.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

describe('App (deploy smoke test screen)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables the run button until an API key is entered', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /run smoke test/i })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/gemini api key/i), {
      target: { value: 'test-key' },
    });
    expect(screen.getByRole('button', { name: /run smoke test/i })).toBeEnabled();
  });

  it('shows the reply text on a successful run', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'Smoke test OK' }),
    });
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/gemini api key/i), {
      target: { value: 'test-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run smoke test/i }));

    await waitFor(() => expect(screen.getByText('Smoke test OK')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/smoke-test'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('shows the server error message on failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: 'upstream exploded' }),
    });
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/gemini api key/i), {
      target: { value: 'test-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run smoke test/i }));

    await waitFor(() => expect(screen.getByText('upstream exploded')).toBeInTheDocument());
  });
});
