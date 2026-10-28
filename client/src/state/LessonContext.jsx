/**
 * @fileoverview React Context wiring for lessonReducer.js — the only
 * place components should reach the lesson state from. Keeps UI
 * components free of `useReducer` wiring (CLAUDE.md's Architecture
 * rule: UI dispatches actions and reads state, nothing more).
 */
import { createContext, useContext, useReducer } from 'react';
import { initialState, lessonReducer } from './lessonReducer.js';

const LessonContext = createContext(null);

/**
 * @param {{children: import('react').ReactNode}} props
 */
export function LessonProvider({ children }) {
  const [state, dispatch] = useReducer(lessonReducer, initialState);
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
