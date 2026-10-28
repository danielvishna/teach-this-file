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
import { validateFile } from '../validation/fileRules.js';
import { SetupScreen } from './SetupScreen.jsx';

vi.mock('../api/planApi.js', () => ({ fetchLessonPlan: vi.fn() }));
// Wraps the real validateFile by default (every existing test keeps exercising
// real validation logic) so only the two tests below that need to control
// timing precisely (the "Checking file…" window, a race between two
// selections) have to override it.
vi.mock('../validation/fileRules.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, validateFile: vi.fn(actual.validateFile) };
});

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

  it('accepts a PDF file', async () => {
    renderSetupScreen();
    const file = new File(['%PDF-1.4\n...'], 'lesson.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });

    expect(await screen.findByText('lesson.pdf')).toBeInTheDocument();
    expect(screen.queryByText(/only \.txt and \.pdf files/i)).not.toBeInTheDocument();
  });

  it('accepts a PDF dropped onto the file area', async () => {
    renderSetupScreen();
    const file = new File(['%PDF-1.4\n...'], 'dropped-lesson.pdf', { type: 'application/pdf' });

    fireEvent.drop(screen.getByTestId('file-drop-zone'), {
      dataTransfer: { files: [file] },
    });

    expect(await screen.findByText('dropped-lesson.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows drag feedback and rejects an unsupported dropped file', async () => {
    renderSetupScreen();
    const dropZone = screen.getByTestId('file-drop-zone');
    const file = new File(['slides'], 'lesson.pptx', { type: 'application/vnd.ms-powerpoint' });

    fireEvent.dragOver(dropZone, { dataTransfer: { dropEffect: 'none' } });
    expect(dropZone.firstElementChild).toHaveClass('border-indigo-500');

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/only \.txt and \.pdf files/i);
    expect(screen.getByRole('button', { name: /build lesson/i })).toBeDisabled();
  });

  it('rejects an unsupported file with a clear message and keeps submit disabled', async () => {
    renderSetupScreen();
    const file = new File(['slides'], 'lesson.pptx', { type: 'application/vnd.ms-powerpoint' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });

    expect(await screen.findByText(/only \.txt and \.pdf files/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /build lesson/i })).toBeDisabled();
  });

  it('rejects a .txt file over the character limit before it ever reaches the server', async () => {
    renderSetupScreen();
    const file = new File(['a'.repeat(20001)], 'huge-lesson.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });

    expect(await screen.findByText(/too long/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /build lesson/i })).toBeDisabled();
    expect(fetchLessonPlan).not.toHaveBeenCalled();
  });

  it('shows a "Checking file…" state and keeps submit disabled while validation is pending', async () => {
    let resolveValidation;
    validateFile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveValidation = resolve;
        })
    );
    renderSetupScreen();

    fireEvent.change(screen.getByLabelText(/teacher prompt/i), { target: { value: 'Teach this' } });
    const file = new File(['Gravity pulls things down.'], 'lesson.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });

    // Key + prompt are already valid, so submit staying disabled here can
    // only be the pending file check — not the other canSubmit conditions.
    expect(await screen.findByText(/checking file…/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /build lesson/i })).toBeDisabled();

    resolveValidation(null);
    expect(await screen.findByText('lesson.txt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /build lesson/i })).toBeEnabled();
  });

  it('keeps only the most recently selected file\'s result when a slower, earlier check resolves later', async () => {
    let resolveFirst;
    validateFile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    renderSetupScreen();

    const slowFile = new File(['first pick'], 'slow.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [slowFile] } });
    await screen.findByText(/checking file…/i);

    const fastFile = new File(['second pick'], 'fast.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [fastFile] } });
    expect(await screen.findByText('fast.txt')).toBeInTheDocument();

    // The slow, superseded check finally resolving must not overwrite the
    // already-accepted second file with the first one's stale result.
    resolveFirst(null);
    await Promise.resolve();
    expect(screen.getByText('fast.txt')).toBeInTheDocument();
    expect(screen.queryByText('slow.txt')).not.toBeInTheDocument();
  });

  it('rejects a .pdf file without a real PDF header', async () => {
    renderSetupScreen();
    const file = new File(['just some text, not a pdf'], 'fake.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });

    expect(await screen.findByText(/valid pdf header/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /build lesson/i })).toBeDisabled();
    expect(fetchLessonPlan).not.toHaveBeenCalled();
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
    await screen.findByText('lesson.txt');
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
    await screen.findByText('lesson.txt');
    fireEvent.change(screen.getByLabelText(/teacher prompt/i), { target: { value: 'Teach this' } });
    fireEvent.click(screen.getByRole('button', { name: /build lesson/i }));

    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('error'));
  });
});
