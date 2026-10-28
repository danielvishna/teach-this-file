/**
 * @fileoverview Lesson/app state reducer — the single source of truth for
 * where the user is in the lesson, the lesson plan, and the chat
 * transcript. Kept separate from both the UI (components only dispatch
 * actions and read state) and the AI-calling code (routes/hooks build
 * the request, then dispatch an action with the result) per CLAUDE.md's
 * Architecture rule.
 *
 * State shape:
 * ```
 * {
 *   phase: 'setup' | 'planning' | 'lesson' | 'done' | 'error',
 *   teacherPrompt: string,
 *   fileName: string,
 *   lessonPlan: {
 *     title: string,
 *     language: string,          // teaching language, decided by the AI
 *     steps: Array<{
 *       id: string,
 *       title: string,
 *       objective: string,
 *       sourceExcerpt: string,   // verified exact substring of the file
 *       status: 'pending' | 'active' | 'completed',
 *     }>,
 *   } | null,
 *   currentStepIndex: number,
 *   messages: Array<{
 *     id: string,
 *     role: 'tutor' | 'student',
 *     text: string,
 *     streaming: boolean,
 *     stepId: string,
 *   }>,
 *   error: { message: string, retryable: boolean } | null,
 * }
 * ```
 *
 * Two decisions worth noting here (see CLAUDE.md's Architecture section):
 * - The full uploaded file text is never stored in this state. Only each
 *   step's own `sourceExcerpt` survives planning — kept deliberately
 *   small so later tutor-turn requests don't resend the whole file.
 * - The Gemini API key never lives here. It stays in local `useState` in
 *   the settings component and is passed explicitly to each fetch call,
 *   so it can never end up inspected via this shared state.
 *
 * Action types:
 * - `SET_TEACHER_PROMPT` `{ prompt }`
 * - `SET_FILE` `{ fileName }`
 * - `PLANNING_STARTED` — no payload; phase -> 'planning'.
 * - `PLANNING_SUCCEEDED` `{ lessonPlan }` — lessonPlan as above, minus
 *   step `status` (this reducer seeds the first step 'active', the rest
 *   'pending'). Phase -> 'lesson', currentStepIndex -> 0.
 * - `PLANNING_FAILED` `{ message, retryable }` — phase -> 'error'.
 * - `STUDENT_MESSAGE_SENT` `{ text }` — appends a student message tagged
 *   with the current step's id.
 * - `TUTOR_STREAM_STARTED` — appends an empty, `streaming: true` tutor
 *   message tagged with the current step's id.
 * - `TUTOR_STREAM_CHUNK` `{ textChunk }` — appends text to the last
 *   message (must be the streaming tutor placeholder).
 * - `TUTOR_STREAM_STOPPED` — marks the last message `streaming: false`
 *   (the user clicked Stop; text stays as-is, nothing else changes).
 * - `TUTOR_TURN_COMPLETE` `{ stepCompleted }` — marks the last message
 *   `streaming: false`. If `stepCompleted` is true, marks the current
 *   step 'completed' and advances `currentStepIndex`, or sets
 *   phase -> 'done' if that was the last step.
 * - `TUTOR_TURN_FAILED` `{ message, retryable }` — removes the empty
 *   streaming placeholder (nothing useful was produced) and sets `error`.
 * - `RESET` — no payload; returns to `initialState`.
 */

/** @const {!Object} The reducer's starting state. */
export const initialState = {
  phase: 'setup',
  teacherPrompt: '',
  fileName: '',
  lessonPlan: null,
  currentStepIndex: 0,
  messages: [],
  error: null,
};

/**
 * @param {string} prefix
 * @return {string} A short id unique enough for a single session's chat
 *     transcript (not a global/persisted identifier).
 */
function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {!Array<{status: string}>} steps
 * @return {!Array<{status: string}>} steps with the first marked 'active'
 *     and the rest 'pending' — used right after planning succeeds.
 */
function seedStepStatuses(steps) {
  return steps.map((step, index) => ({
    ...step,
    status: index === 0 ? 'active' : 'pending',
  }));
}

/**
 * @param {!Object} state Current lesson state (see the shape documented
 *     above).
 * @param {!Object} action `{ type, ...payload }`.
 * @return {!Object} Next state.
 */
export function lessonReducer(state, action) {
  switch (action.type) {
    case 'SET_TEACHER_PROMPT':
      return { ...state, teacherPrompt: action.prompt };

    case 'SET_FILE':
      return { ...state, fileName: action.fileName };

    case 'PLANNING_STARTED':
      return { ...state, phase: 'planning', error: null };

    case 'PLANNING_SUCCEEDED':
      return {
        ...state,
        phase: 'lesson',
        lessonPlan: {
          ...action.lessonPlan,
          steps: seedStepStatuses(action.lessonPlan.steps),
        },
        currentStepIndex: 0,
      };

    case 'PLANNING_FAILED':
      return {
        ...state,
        phase: 'error',
        error: { message: action.message, retryable: action.retryable },
      };

    case 'STUDENT_MESSAGE_SENT':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: makeId('msg'),
            role: 'student',
            text: action.text,
            streaming: false,
            stepId: currentStep(state)?.id ?? null,
          },
        ],
      };

    case 'TUTOR_STREAM_STARTED':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: makeId('msg'),
            role: 'tutor',
            text: '',
            streaming: true,
            stepId: currentStep(state)?.id ?? null,
          },
        ],
      };

    case 'TUTOR_STREAM_CHUNK':
      return {
        ...state,
        messages: appendToLastMessage(state.messages, action.textChunk),
      };

    case 'TUTOR_STREAM_STOPPED':
      return { ...state, messages: setLastMessageStreaming(state.messages, false) };

    case 'TUTOR_TURN_COMPLETE': {
      const messages = setLastMessageStreaming(state.messages, false);
      if (!action.stepCompleted || !state.lessonPlan) {
        return { ...state, messages };
      }
      return advanceStep({ ...state, messages });
    }

    case 'TUTOR_TURN_FAILED':
      return {
        ...state,
        messages: dropIfEmptyStreamingPlaceholder(state.messages),
        error: { message: action.message, retryable: action.retryable },
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

/**
 * @param {!Object} state
 * @return {?Object} The step currently being taught, or null before a
 *     lesson plan exists.
 */
function currentStep(state) {
  return state.lessonPlan?.steps[state.currentStepIndex] ?? null;
}

/**
 * @param {!Array<!Object>} messages
 * @param {string} textChunk
 * @return {!Array<!Object>} messages with textChunk appended to the last
 *     message's text.
 */
function appendToLastMessage(messages, textChunk) {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  return [...messages.slice(0, -1), { ...last, text: last.text + textChunk }];
}

/**
 * @param {!Array<!Object>} messages
 * @param {boolean} streaming
 * @return {!Array<!Object>} messages with the last message's `streaming`
 *     flag set.
 */
function setLastMessageStreaming(messages, streaming) {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  return [...messages.slice(0, -1), { ...last, streaming }];
}

/**
 * @param {!Array<!Object>} messages
 * @return {!Array<!Object>} messages with the last message removed if it
 *     is an empty tutor placeholder (a stream that failed before any
 *     text arrived) — otherwise unchanged.
 */
function dropIfEmptyStreamingPlaceholder(messages) {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  return last.role === 'tutor' && last.text === '' ? messages.slice(0, -1) : messages;
}

/**
 * @param {!Object} state
 * @return {!Object} state with the current step marked 'completed' and
 *     either the next step marked 'active', or phase -> 'done' if that
 *     was the last step.
 */
function advanceStep(state) {
  const steps = state.lessonPlan.steps.map((step, index) =>
    index === state.currentStepIndex ? { ...step, status: 'completed' } : step
  );
  const nextIndex = state.currentStepIndex + 1;
  const isLastStep = nextIndex >= steps.length;

  return {
    ...state,
    lessonPlan: {
      ...state.lessonPlan,
      steps: isLastStep
        ? steps
        : steps.map((step, index) => (index === nextIndex ? { ...step, status: 'active' } : step)),
    },
    currentStepIndex: isLastStep ? state.currentStepIndex : nextIndex,
    phase: isLastStep ? 'done' : state.phase,
  };
}
