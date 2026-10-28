/**
 * @fileoverview Unit tests for App.jsx's phase routing. Detailed screen
 * behavior is covered by each screen's own test file (SetupScreen.test.jsx,
 * ChatScreen.test.jsx, etc.) — this checks App renders the right screen
 * for a given phase, and that it's actually App (not just ChatScreen in
 * isolation) that gets the real apiKey to the chat screen.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLessonPlan } from './api/planApi.js';
import { streamTutorTurn } from './api/tutorTurnApi.js';
import App from './App.jsx';

vi.mock('./api/planApi.js', () => ({ fetchLessonPlan: vi.fn() }));
vi.mock('./api/tutorTurnApi.js', () => ({ streamTutorTurn: vi.fn() }));

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders the setup screen for the initial phase', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /teach this file/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/gemini api key/i)).toBeInTheDocument();
  });

  it('routes to the chat screen once planning succeeds, passing the real apiKey through', async () => {
    fetchLessonPlan.mockResolvedValue({
      title: 'Gravity',
      subject: 'physics',
      targetAudience: '7th grade',
      language: 'en',
      steps: [
        { id: 's1', title: 'What is gravity?', objective: 'Define it', sourceExcerpt: 'Gravity pulls.' },
      ],
    });
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(false));

    render(<App />);

    fireEvent.change(screen.getByLabelText(/gemini api key/i), { target: { value: 'the-real-api-key' } });
    const file = new File(['Gravity pulls things down.'], 'lesson.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/teacher prompt/i), { target: { value: 'Teach this' } });
    fireEvent.click(screen.getByRole('button', { name: /build lesson/i }));

    // Routed from SetupScreen to ChatScreen (not stuck on Setup or Planning).
    await waitFor(() => expect(screen.getByText('Gravity')).toBeInTheDocument());
    expect(screen.getByText(/step 1 of 1/i)).toBeInTheDocument();

    // The apiKey that reached ChatScreen is App's real local state, not a
    // stale/empty default — confirms the prop actually threads through.
    await waitFor(() => expect(streamTutorTurn).toHaveBeenCalled());
    expect(streamTutorTurn.mock.calls[0][0].apiKey).toBe('the-real-api-key');
  });
});
