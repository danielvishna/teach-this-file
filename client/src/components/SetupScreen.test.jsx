/**
 * @fileoverview Unit tests for SetupScreen.jsx. api/planApi.js is
 * mocked — no real network/AI call. Rendered inside a real
 * LessonProvider so the test also exercises the actual reducer wiring,
 * not a mocked dispatch.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLessonPlan } from '../api/planApi.js';
import { LessonProvider, useLesson } from '../state/LessonContext.jsx';
import { SetupScreen } from './SetupScreen.jsx';

vi.mock('../api/planApi.js', () => ({ fetchLessonPlan: vi.fn() }));

function PhaseProbe() {
  const { state } = useLesson();
  return <div data-testid="phase">{state.phase}</div>;
}

function renderSetupScreen(apiKey = 'test-key') {
  return render(
    <LessonProvider>
      <SetupScreen apiKey={apiKey} onApiKeyChange={() => {}} />
      <PhaseProbe />
    </LessonProvider>
  );
}

describe('SetupScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disables submit until a key, file and prompt are all present', () => {
    renderSetupScreen('');
    expect(screen.getByRole('button', { name: /build lesson/i })).toBeDisabled();
  });

  it('rejects a non-.txt file with a clear message and keeps submit disabled', () => {
    renderSetupScreen();
    const file = new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });

    expect(screen.getByText(/only \.txt files/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /build lesson/i })).toBeDisabled();
  });

  it('on submit, calls fetchLessonPlan and moves the reducer to lesson phase on success', async () => {
    fetchLessonPlan.mockResolvedValueOnce({
      title: 'Gravity',
      subject: 'physics',
      targetAudience: '7th grade',
      language: 'en',
      steps: [{ id: 's1', title: 'What is gravity?', objective: 'Define it', sourceExcerpt: 'Gravity pulls.' }],
    });
    renderSetupScreen();

    const file = new File(['Gravity pulls things down.'], 'lesson.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/teacher prompt/i), {
      target: { value: 'Teach this to 7th graders' },
    });
    fireEvent.click(screen.getByRole('button', { name: /build lesson/i }));

    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('lesson'));
    expect(fetchLessonPlan).toHaveBeenCalledWith({
      apiKey: 'test-key',
      file,
      teacherPrompt: 'Teach this to 7th graders',
    });
  });

  it('on a failed request, moves the reducer to the error phase', async () => {
    fetchLessonPlan.mockRejectedValueOnce(new Error('upstream exploded'));
    renderSetupScreen();

    const file = new File(['Gravity pulls things down.'], 'lesson.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/teacher prompt/i), { target: { value: 'Teach this' } });
    fireEvent.click(screen.getByRole('button', { name: /build lesson/i }));

    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('error'));
  });
});
