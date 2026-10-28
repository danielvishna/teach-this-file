/**
 * @fileoverview Unit tests for LessonContext.jsx: the outside-provider
 * guard, and the sessionStorage persistence/rehydration behavior
 * (including the 'planning' and streaming-message repair cases a plain
 * JSON round-trip can't resume from).
 */
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonProvider, useLesson } from './LessonContext.jsx';

const STORAGE_KEY = 'teach-this-file:lesson-state';

describe('useLesson', () => {
  it('throws when called outside a LessonProvider', () => {
    expect(() => renderHook(() => useLesson())).toThrow(/within a LessonProvider/);
  });
});

describe('LessonProvider persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes state to sessionStorage as it changes', () => {
    const { result } = renderHook(() => useLesson(), { wrapper: LessonProvider });

    act(() => {
      result.current.dispatch({ type: 'SET_TEACHER_PROMPT', prompt: 'Teach this' });
    });

    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    expect(saved.teacherPrompt).toBe('Teach this');
  });

  it('restores state saved by an earlier mount (simulating a reload)', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        phase: 'lesson',
        teacherPrompt: 'Teach this',
        fileName: 'lesson.txt',
        lessonPlan: { title: 'Gravity', subject: 'physics', targetAudience: '7th', language: 'en', steps: [] },
        currentStepIndex: 0,
        messages: [{ id: 'm1', role: 'tutor', text: 'Hi', streaming: false, stepId: null }],
        error: null,
      })
    );

    const { result } = renderHook(() => useLesson(), { wrapper: LessonProvider });

    expect(result.current.state.phase).toBe('lesson');
    expect(result.current.state.lessonPlan.title).toBe('Gravity');
    expect(result.current.state.messages).toHaveLength(1);
  });

  it('falls back to initialState on corrupt sessionStorage content', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not valid json');

    const { result } = renderHook(() => useLesson(), { wrapper: LessonProvider });

    expect(result.current.state.phase).toBe('setup');
  });

  it('discards a persisted "planning" phase (its in-flight request is gone after a reload)', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ phase: 'planning', teacherPrompt: '', fileName: '', lessonPlan: null, currentStepIndex: 0, messages: [], error: null })
    );

    const { result } = renderHook(() => useLesson(), { wrapper: LessonProvider });

    expect(result.current.state.phase).toBe('setup');
  });

  it('marks a persisted streaming message with partial text as stopped, not dropped', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        phase: 'lesson',
        teacherPrompt: 'Teach this',
        fileName: 'lesson.txt',
        lessonPlan: { title: 'Gravity', subject: 'physics', targetAudience: '7th', language: 'en', steps: [] },
        currentStepIndex: 0,
        messages: [{ id: 'm1', role: 'tutor', text: 'Mid-rep', streaming: true, stepId: null }],
        error: null,
      })
    );

    const { result } = renderHook(() => useLesson(), { wrapper: LessonProvider });

    expect(result.current.state.messages).toHaveLength(1);
    expect(result.current.state.messages[0]).toMatchObject({ text: 'Mid-rep', streaming: false });
  });

  it('drops a persisted streaming placeholder that never got any text (saved right as the turn started)', () => {
    // Reproduces a reload that lands between TUTOR_STREAM_STARTED and the
    // first chunk: leaving an empty placeholder in `messages` would make
    // ChatScreen.jsx's step-opening effect think the step was already
    // opened (its guard is `currentStepMessages.length > 0`) and never
    // retry it — a permanently blank, unrecoverable tutor turn.
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        phase: 'lesson',
        teacherPrompt: 'Teach this',
        fileName: 'lesson.txt',
        lessonPlan: { title: 'Gravity', subject: 'physics', targetAudience: '7th', language: 'en', steps: [] },
        currentStepIndex: 0,
        messages: [{ id: 'm1', role: 'tutor', text: '', streaming: true, stepId: null }],
        error: null,
      })
    );

    const { result } = renderHook(() => useLesson(), { wrapper: LessonProvider });

    expect(result.current.state.messages).toHaveLength(0);
  });
});
