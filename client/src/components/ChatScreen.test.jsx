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

    // Call 0 opens step 1 (verdict true completes it); call 1 is the
    // auto-triggered opening of step 2. It must tell the server which step
    // this is and what the student just finished, so the prompt can bridge
    // into it instead of re-greeting (tutorPrompt.js's buildOpeningTask).
    expect(streamTutorTurn).toHaveBeenCalledTimes(2);
    expect(streamTutorTurn.mock.calls[1][0].studentMessage).toBeUndefined();
    expect(streamTutorTurn.mock.calls[1][0].stepNumber).toBe(2);
    expect(streamTutorTurn.mock.calls[1][0].previousStepTitle).toBe('What is gravity?');
  });

  it('opens the very first step with stepNumber 1 and no previousStepTitle', async () => {
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(false));
    renderChatScreen();

    await waitFor(() => expect(streamTutorTurn).toHaveBeenCalledTimes(1));
    expect(streamTutorTurn.mock.calls[0][0].stepNumber).toBe(1);
    expect(streamTutorTurn.mock.calls[0][0].previousStepTitle).toBeUndefined();
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

  it('shows a step-transition divider where a new step begins, not between messages within a step', async () => {
    const verdicts = [true, false];
    let i = 0;
    streamTutorTurn.mockImplementation(async ({ onChunk, onVerdict }) => {
      onChunk(verdicts[i] ? 'Step 1 reply' : 'Step 2 opening');
      onVerdict(verdicts[i++]);
    });
    renderChatScreen();

    await waitFor(() => expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument());

    // Exactly one divider: between step 1's last message and step 2's
    // opening — not before step 1's own opening message (there is nothing
    // to transition from yet).
    const dividers = screen.getAllByRole('separator');
    expect(dividers).toHaveLength(1);
    expect(dividers[0]).toHaveTextContent('Step 2: Gravity on Earth');
  });

  it('sends on Enter, and leaves Shift+Enter alone for the browser to insert a newline', async () => {
    streamTutorTurn.mockImplementation(async ({ onVerdict }) => onVerdict(false));
    renderChatScreen();
    await waitFor(() => expect(streamTutorTurn).toHaveBeenCalledTimes(1));

    const input = screen.getByPlaceholderText(/type your answer/i);
    fireEvent.change(input, { target: { value: 'Line one' } });

    // fireEvent's return value is the event's own (not canceled), i.e.
    // whether preventDefault() was called — jsdom doesn't perform the
    // browser's native "insert \n" action on keydown, so this is the only
    // way to verify the handler actually leaves Shift+Enter alone instead
    // of asserting a newline landed in the textarea's value.
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(notPrevented).toBe(true);
    expect(streamTutorTurn).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(streamTutorTurn).toHaveBeenCalledTimes(2));
    expect(streamTutorTurn.mock.calls[1][0].studentMessage).toBe('Line one');
  });

  it('resumes mid-step from sessionStorage without re-opening an already-answered step', async () => {
    sessionStorage.setItem(
      'teach-this-file:lesson-state',
      JSON.stringify({
        phase: 'lesson',
        teacherPrompt: 'Teach this',
        fileName: 'lesson.txt',
        lessonPlan: LESSON_PLAN,
        currentStepIndex: 0,
        messages: [
          { id: 'm1', role: 'tutor', text: 'Hello!', streaming: false, stepId: 'step_1' },
          { id: 'm2', role: 'student', text: 'Mass attracts mass', streaming: false, stepId: 'step_1' },
        ],
        error: null,
      })
    );

    // No Harness/PLANNING_SUCCEEDED dispatch here — LessonProvider must
    // pick this up on its own via sessionStorage, the actual scenario the
    // persistence feature exists for (resuming after a reload).
    render(
      <LessonProvider>
        <ChatScreen apiKey="test-key" />
      </LessonProvider>
    );

    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('Mass attracts mass')).toBeInTheDocument();
    // The step already has messages, so the step-opening effect must not
    // re-fire and re-ask the AI to open a step the student already answered.
    expect(streamTutorTurn).not.toHaveBeenCalled();
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

    // Regression: the done screen had no way back — clicking through
    // resets the lesson so the teacher can start over with a new file.
    fireEvent.click(screen.getByRole('button', { name: /teach another file/i }));
    expect(screen.queryByText(/lesson complete/i)).not.toBeInTheDocument();
  });
});
