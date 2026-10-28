/**
 * @fileoverview React Context wiring for lessonReducer.js — the only
 * place components should reach the lesson state from. Keeps UI
 * components free of `useReducer` wiring (CLAUDE.md's Architecture
 * rule: UI dispatches actions and reads state, nothing more).
 *
 * Also persists lesson state (plan, progress, transcript) to
 * `sessionStorage`, so a reload of the tab — an accidental refresh, a
 * dev-server HMR reconnect, a mobile browser suspending a background
 * tab — doesn't silently wipe a student's progress back to the start
 * (found via live testing; see DECISIONS.md). Deliberately
 * `sessionStorage`, not `localStorage`: it should survive a reload of
 * *this* tab, not resurrect an old lesson the next time the app is
 * opened fresh. The Gemini API key is never part of this state (it
 * lives in App.jsx's local `useState`, per CLAUDE.md's Hard Rules), so
 * it's never written here either.
 *
 * Rehydration isn't a straight JSON round-trip — see
 * sanitizeRehydratedState()'s doc comment for why.
 */
import { createContext, useContext, useEffect, useReducer } from 'react';
import { initialState, lessonReducer } from './lessonReducer.js';

const LessonContext = createContext(null);

/** @const {string} sessionStorage key for the persisted lesson state. */
const STORAGE_KEY = 'teach-this-file:lesson-state';

/**
 * A reload drops any in-flight request, so a straight JSON round-trip
 * of the last-saved state isn't always safe to resume from:
 * - A 'planning' phase with no plan yet has no AbortController left to
 *   finish it, so it can't be resumed at all — back to `initialState`.
 * - A message still marked `streaming: true` has nothing left writing
 *   to it. If it already has text, it's marked stopped (matching what
 *   the Stop button itself does — the partial reply stays, inert). If
 *   it's still empty (saved right as `TUTOR_STREAM_STARTED` fired,
 *   before the first chunk), it's dropped instead, the same way
 *   `TUTOR_TURN_FAILED` drops an empty placeholder in
 *   `lessonReducer.js`'s `dropIfEmptyStreamingPlaceholder` — left in
 *   place, it would permanently block ChatScreen's step-opening effect
 *   from ever re-firing for that step (its guard is
 *   `currentStepMessages.length > 0`), stranding the student on a
 *   lesson step with no tutor message and no way to resume it.
 * @param {!Object} state Freshly parsed, persisted state.
 * @return {!Object} State safe to resume the UI from.
 */
function sanitizeRehydratedState(state) {
  if (state.phase === 'planning') return initialState;
  return {
    ...state,
    messages: state.messages
      .filter((m) => !(m.streaming && m.text === ''))
      .map((m) => (m.streaming ? { ...m, streaming: false } : m)),
  };
}

/**
 * @return {!Object} The persisted lesson state from earlier in this
 *     tab's session, or `initialState` if there is none, or it can't be
 *     read (private browsing, corrupt JSON, storage disabled).
 */
function loadPersistedState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeRehydratedState(JSON.parse(raw)) : initialState;
  } catch {
    return initialState;
  }
}

/**
 * @param {{children: import('react').ReactNode}} props
 */
export function LessonProvider({ children }) {
  const [state, dispatch] = useReducer(lessonReducer, undefined, loadPersistedState);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or disabled (e.g. private browsing) — the lesson
      // still works, it just won't survive a reload. Not worth failing
      // visibly over, per CLAUDE.md this is a convenience, not a Hard Rule.
    }
  }, [state]);

  return (
    <LessonContext.Provider value={{ state, dispatch }}>{children}</LessonContext.Provider>
  );
}

/**
 * @return {{state: !Object, dispatch: Function}} The current lesson
 *     state and its dispatch function.
 * @throws {Error} If called outside a LessonProvider.
 */
export function useLesson() {
  const context = useContext(LessonContext);
  if (!context) throw new Error('useLesson must be used within a LessonProvider');
  return context;
}
