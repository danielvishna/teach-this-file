/**
 * @fileoverview Unit tests for ChatScreen.jsx. api/tutorTurnApi.js is
 * mocked — no real network/AI call. Rendered inside a real
 * LessonProvider, pre-seeded with a lesson plan, so the test also
 * exercises the actual reducer wiring.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamTutorTurn } from '../api/tutorTurnApi.js';
import { LessonProvider, useLesson } from '../state/LessonContext.jsx';
import { ChatScreen } from './ChatScreen.jsx';

vi.mock('../api/tutorTurnApi.js', () => ({ streamTutorTurn: vi.fn() }));

const LESSON_PLAN = {
  title: 'Gravity',
  subject: 'physics',
  targetAudience: '7th grade',
  language: 'en',
  steps: [
    {
      id: 'step_1',
      title: 'What is gravity?',
      objective: 'Define it',
      sourceExcerpt: 'Gravity pulls things down.',
      sourcePage: 1,
    },
    { id: 'step_2', title: 'Gravity on Earth', objective: 'Explain falling', sourceExcerpt: 'Objects fall at 9.8 m/s^2.' },
  ],
};

function Harness() {
  const { state, dispatch } = useLesson();
  useEffect(() => {
    dispatch({ type: 'PLANNING_SUCCEEDED', lessonPlan: LESSON_PLAN });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!state.lessonPlan) return null;
  return <ChatScreen apiKey="test-key" />;
}

function renderChatScreen() {
  return render(
    <LessonProvider>
      <Harness />
    </LessonProvider>
  );
}

describe('ChatScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the first step automatically on mount (no studentMessage)', async () => {
    streamTutorTurn.mockImplementation(async ({ onChunk, onVerdict }) => {
      onChunk('Hello!');
      onVerdict(false);
    });

    renderChatScreen();

    await waitFor(() => expect(streamTutorTurn).toHaveBeenCalledTimes(1));
    const call = streamTutorTurn.mock.calls[0][0];
    expect(call.studentMessage).toBeUndefined();
    expect(call.step.title).toBe('What is gravity?');
    await waitFor(() => expect(screen.getByText('Hello!')).toBeInTheDocument());
  });

  it('shows progress and the lesson title', async () => {
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(false));
    renderChatScreen();

    expect(await screen.findByText('Gravity')).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
  });

  it('shows the PDF page with the current step source evidence', async () => {
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(false));
    renderChatScreen();

    fireEvent.click(await screen.findByRole('button', { name: /see source/i }));
    expect(screen.getByText(/page 1: gravity pulls things down/i)).toBeInTheDocument();
  });

  it('sends a student message and renders it', async () => {
    streamTutorTurn.mockImplementationOnce(async ({ onChunk, onVerdict }) => {
      onChunk('Opening message');
      onVerdict(false);
    });
    renderChatScreen();
    await waitFor(() => expect(streamTutorTurn).toHaveBeenCalledTimes(1));

    streamTutorTurn.mockImplementationOnce(async ({ onChunk, onVerdict }) => {
      onChunk('Good answer!');
      onVerdict(true);
    });
    // A step-1 "complete" verdict auto-opens step 2 next; keep that one from
    // also auto-completing and racing straight through to "done".
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(false));

    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), {
      target: { value: 'Because mass attracts mass' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/type your answer/i).closest('form'));

    expect(await screen.findByText('Because mass attracts mass')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Good answer!')).toBeInTheDocument());
    // A 3rd call happens because the correct answer completes step 1 and
    // auto-opens step 2 (mocked to stay open, per the mock set up above).
    expect(streamTutorTurn).toHaveBeenCalledTimes(3);
    expect(streamTutorTurn.mock.calls[1][0].studentMessage).toBe('Because mass attracts mass');
  });

  it('advances to step 2 when the verdict says the step is complete', async () => {
    // true -> completes step 1 and advances; false -> stays on step 2 (so the
    // test can observe it) instead of racing straight through to "done".
    const verdicts = [true, false];
    let i = 0;
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(verdicts[i++]));
    renderChatScreen();

    await waitFor(() => expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument());
  });

  it('clicking Stop aborts the AbortSignal passed to streamTutorTurn', async () => {
    streamTutorTurn.mockImplementation(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          // Reject exactly when the real fetch/stream-reading code would:
          // when the signal it was given aborts.
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    renderChatScreen();

    const stopButton = await screen.findByRole('button', { name: /stop/i });
    const { signal } = streamTutorTurn.mock.calls[0][0];
    expect(signal.aborted).toBe(false);

    await act(async () => {
      fireEvent.click(stopButton);
    });

    expect(signal.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument());
  });

  it('keeps step 1 messages visible in the transcript after advancing to step 2', async () => {
    const verdicts = [true, false];
    let i = 0;
    streamTutorTurn.mockImplementation(async ({ onChunk, onVerdict }) => {
      onChunk(verdicts[i] ? 'Step 1 reply' : 'Step 2 opening');
      onVerdict(verdicts[i++]);
    });
    renderChatScreen();

    await waitFor(() => expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument());

    // Regression check: the transcript used to be filtered to only the
    // *current* step's messages, so step 1's conversation vanished once the
    // lesson advanced. It must stay visible, like a real chat history.
    expect(screen.getByText('Step 1 reply')).toBeInTheDocument();
    expect(screen.getByText('Step 2 opening')).toBeInTheDocument();
  });

  it('sends on Enter and inserts a newline on Shift+Enter instead', async () => {
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(false));
    renderChatScreen();
    await waitFor(() => expect(streamTutorTurn).toHaveBeenCalledTimes(1));

    const input = screen.getByPlaceholderText(/type your answer/i);

    fireEvent.change(input, { target: { value: 'Line one' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    // Shift+Enter must not submit — still waiting on the same one call.
    expect(streamTutorTurn).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('Line one');

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(streamTutorTurn).toHaveBeenCalledTimes(2));
    expect(streamTutorTurn.mock.calls[1][0].studentMessage).toBe('Line one');
  });

  it('shows the lesson-complete message in the done phase', async () => {
    // true (complete step 1) -> false (stay on step 2's opening) -> true (student reply completes it).
    const verdicts = [true, false, true];
    let i = 0;
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(verdicts[i++]));
    renderChatScreen();
    await waitFor(() => expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/type your answer/i);
    fireEvent.change(input, { target: { value: 'Final answer' } });
    fireEvent.submit(input.closest('form'));

    expect(await screen.findByText(/lesson complete/i)).toBeInTheDocument();
  });
});
