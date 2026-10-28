/**
 * @fileoverview The lesson chat: streams tutor replies, lets the
 * student reply and Stop a reply, shows "step N of M" progress, and
 * shows the source passage behind the current step. Presentational +
 * dispatches reducer actions; the fetch/stream-reading lives in
 * api/tutorTurnApi.js (CLAUDE.md's Architecture rule).
 */
import { Fragment, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { streamTutorTurn } from '../api/tutorTurnApi.js';
import { useLesson } from '../state/LessonContext.jsx';

const RichMessage = lazy(() => import('./RichMessage.jsx'));
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
        stepNumber: currentStepIndex + 1,
        previousStepTitle: lessonPlan.steps[currentStepIndex - 1]?.title,
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

  /** Ends the current lesson after confirmation and cancels any active stream. */
  function handleCancelLesson() {
    if (!window.confirm('Cancel this lesson and return to the start screen?')) return;
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold">{lessonPlan.title}</h1>
        <p className="text-gray-600">Lesson complete — nice work!</p>
        <button
          type="button"
          onClick={() => dispatch({ type: 'RESET' })}
          className="min-h-11 rounded bg-indigo-600 px-4 py-2 text-white"
        >
          Back to start
        </button>
      </div>
    );
  }

  const stepNumber = currentStepIndex + 1;
  const totalSteps = lessonPlan.steps.length;
  const stepIndexById = new Map(lessonPlan.steps.map((s, i) => [s.id, i]));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden px-3 pt-3 sm:px-4 sm:pt-4">
      <header className="mb-3 border-b border-gray-200 pb-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 break-words text-lg font-semibold">{lessonPlan.title}</h1>
          <button
            type="button"
            onClick={handleCancelLesson}
            className="min-h-11 shrink-0 rounded px-2 text-sm text-gray-600 underline decoration-gray-300 underline-offset-2"
          >
            Cancel lesson
          </button>
        </div>
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
          <p
            dir={detectDir(currentStep.sourceExcerpt)}
            className="mt-1 max-h-40 overflow-auto break-words rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600"
          >
            {currentStep.sourcePage ? `Page ${currentStep.sourcePage}: ` : ''}
            {currentStep.sourceExcerpt}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto pb-3">
        {messages.map((m, i) => {
          // A new step's opening message stacks right after the previous
          // step's last reply with no visual break, which — found via live
          // testing — reads as a confusing reset (same bubble style, often
          // a similar "imagine a scenario" opening tone) instead of what it
          // actually is: the lesson correctly advancing. This marks that
          // boundary explicitly whenever a message's step differs from the
          // one before it.
          const prevStepId = messages[i - 1]?.stepId;
          const stepIndex = stepIndexById.get(m.stepId);
          const showStepDivider = i > 0 && m.stepId !== prevStepId && stepIndex !== undefined;

          return (
            <Fragment key={m.id}>
              {showStepDivider && (
                <div className="flex items-center gap-2 py-1 text-xs font-medium text-gray-400" role="separator">
                  <span className="h-px flex-1 bg-gray-200" />
                  Step {stepIndex + 1}: {lessonPlan.steps[stepIndex].title}
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              )}
              <div className={m.role === 'student' ? 'text-right' : 'text-left'}>
                <div
                  dir={detectDir(m.text)}
                  className={`inline-block max-w-[92%] overflow-hidden break-words rounded-lg px-3 py-2 text-sm sm:max-w-[85%] ${
                    m.role === 'student' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {m.text ? (
                    <Suspense fallback={<span>{m.text}</span>}>
                      <RichMessage text={m.text} />
                    </Suspense>
                  ) : m.streaming ? (
                    '…'
                  ) : (
                    ''
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {turnError && <p className="mt-2 text-sm text-red-600">{turnError}</p>}

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 -mx-3 mt-3 flex items-end gap-2 border-t border-gray-100 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:-mx-4 sm:px-4"
      >
        <textarea
          ref={inputRef}
          value={studentInput}
          onChange={(e) => setStudentInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type your answer…"
          disabled={isStreaming}
          rows={1}
          className="min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded border border-gray-300 px-3 py-2 text-base leading-snug disabled:opacity-50 sm:text-sm"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            className="min-h-11 shrink-0 rounded bg-red-600 px-3 py-2 text-sm text-white"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!studentInput.trim()}
            className="min-h-11 shrink-0 rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
