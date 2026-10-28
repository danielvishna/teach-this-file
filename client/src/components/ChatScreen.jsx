/**
 * @fileoverview The lesson chat: streams tutor replies, lets the
 * student reply and Stop a reply, shows "step N of M" progress, and
 * shows the source passage behind the current step. Presentational +
 * dispatches reducer actions; the fetch/stream-reading lives in
 * api/tutorTurnApi.js (CLAUDE.md's Architecture rule).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { streamTutorTurn } from '../api/tutorTurnApi.js';
import { useLesson } from '../state/LessonContext.jsx';

/** @const {RegExp} Hebrew/Arabic Unicode ranges — rough but sufficient for picking a text direction. */
const RTL_PATTERN = /[֐-׿؀-ۿ]/;

/**
 * @param {string} text
 * @return {'rtl'|'ltr'} Per-message direction (CLAUDE.md: dir follows
 *     the message's own content language, not the app as a whole).
 */
function detectDir(text) {
  return RTL_PATTERN.test(text) ? 'rtl' : 'ltr';
}

/**
 * @param {{apiKey: string}} props `apiKey` is passed down from App.jsx's
 *     local state, never the shared reducer (CLAUDE.md's Architecture rule).
 */
export function ChatScreen({ apiKey }) {
  const { state, dispatch } = useLesson();
  const { lessonPlan, currentStepIndex, messages, phase, teacherPrompt } = state;
  const currentStep = lessonPlan.steps[currentStepIndex];
  // The full transcript is shown to the student (a chat shouldn't lose
  // earlier steps as the lesson progresses); only the *current* step's
  // messages go to the AI as conversation context, per CLAUDE.md's
  // decision to keep each tutor-turn prompt scoped to one step.
  const currentStepMessages = messages.filter((m) => m.stepId === currentStep?.id);
  const isStreaming = messages.at(-1)?.streaming ?? false;

  const [studentInput, setStudentInput] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [turnError, setTurnError] = useState('');
  const abortRef = useRef(null);
  const openedSteps = useRef(new Set());
  const inputRef = useRef(null);

  /** @param {(string|undefined)} studentMessage */
  async function runTurn(studentMessage) {
    setTurnError('');
    const historyForApi = currentStepMessages.map((m) => ({ role: m.role, text: m.text }));
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'TUTOR_STREAM_STARTED' });
    try {
      await streamTutorTurn({
        apiKey,
        teacherPrompt,
        subject: lessonPlan.subject,
        targetAudience: lessonPlan.targetAudience,
        language: lessonPlan.language,
        step: {
          title: currentStep.title,
          objective: currentStep.objective,
          sourceExcerpt: currentStep.sourceExcerpt,
        },
        history: historyForApi,
        studentMessage,
        signal: controller.signal,
        onChunk: (text) => dispatch({ type: 'TUTOR_STREAM_CHUNK', textChunk: text }),
        onVerdict: (stepCompleted) => dispatch({ type: 'TUTOR_TURN_COMPLETE', stepCompleted }),
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        dispatch({ type: 'TUTOR_STREAM_STOPPED' });
      } else {
        dispatch({ type: 'TUTOR_TURN_FAILED', message: err.message, retryable: true });
        setTurnError(err.message);
      }
    } finally {
      abortRef.current = null;
    }
  }

  // Open each step exactly once: the first time it becomes current and has no messages yet.
  useEffect(() => {
    if (!currentStep || currentStepMessages.length > 0 || openedSteps.current.has(currentStep.id)) return;
    openedSteps.current.add(currentStep.id);
    runTurn(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id]);

  /** @param {!Event} event */
  function handleSend(event) {
    event.preventDefault();
    const text = studentInput.trim();
    if (!text || isStreaming) return;
    dispatch({ type: 'STUDENT_MESSAGE_SENT', text });
    setStudentInput('');
    runTurn(text);
  }

  // Enter sends (matching the single-line input this textarea replaces);
  // Shift+Enter still inserts a newline, the standard chat-input split.
  /** @param {!KeyboardEvent} event */
  function handleInputKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend(event);
    }
  }

  // Grows the textarea with its content (capped by the CSS max-height,
  // which switches to internal scrolling) so a long message stays fully
  // visible while typing instead of scrolling sideways out of view.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [studentInput]);

  function handleStop() {
    abortRef.current?.abort();
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-xl font-semibold">{lessonPlan.title}</h1>
        <p className="text-gray-600">Lesson complete — nice work!</p>
      </div>
    );
  }

  const stepNumber = currentStepIndex + 1;
  const totalSteps = lessonPlan.steps.length;

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col p-4">
      <header className="mb-3 border-b border-gray-200 pb-3">
        <h1 className="text-lg font-semibold">{lessonPlan.title}</h1>
        <p className="text-sm text-gray-500">
          Step {stepNumber} of {totalSteps}: {currentStep.title}
        </p>
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="mt-1 text-xs text-indigo-600 underline"
        >
          {showSource ? 'Hide source' : 'See source'}
        </button>
        {showSource && (
          <p dir={detectDir(currentStep.sourceExcerpt)} className="mt-1 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
            {currentStep.sourceExcerpt}
          </p>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'student' ? 'text-right' : 'text-left'}>
            <div
              dir={detectDir(m.text)}
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'student' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {m.text || (m.streaming ? '…' : '')}
            </div>
          </div>
        ))}
      </div>

      {turnError && <p className="mt-2 text-sm text-red-600">{turnError}</p>}

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={studentInput}
          onChange={(e) => setStudentInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type your answer…"
          disabled={isStreaming}
          rows={1}
          className="max-h-32 flex-1 resize-none overflow-y-auto rounded border border-gray-300 px-3 py-2 text-sm leading-snug disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            className="rounded bg-red-600 px-3 py-2 text-sm text-white"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!studentInput.trim()}
            className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
