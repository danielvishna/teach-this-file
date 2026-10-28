/**
 * @fileoverview Unit tests for lessonReducer.js — pure state-transition
 * logic, no AI calls, no mocking needed.
 */
import { describe, expect, it } from 'vitest';
import { initialState, lessonReducer } from './lessonReducer.js';

const twoStepPlan = {
  title: 'Gravity',
  language: 'en',
  steps: [
    { id: 'step_1', title: 'What is gravity?', objective: 'Define it', sourceExcerpt: 'Gravity pulls things down.' },
    { id: 'step_2', title: 'Gravity on Earth', objective: 'Explain falling', sourceExcerpt: 'Objects fall at 9.8 m/s^2.' },
  ],
};

describe('lessonReducer', () => {
  it('starts in the setup phase', () => {
    expect(initialState.phase).toBe('setup');
    expect(initialState.lessonPlan).toBeNull();
  });

  it('PLANNING_SUCCEEDED seeds step statuses and never stores file text', () => {
    const state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    expect(state.phase).toBe('lesson');
    expect(state.currentStepIndex).toBe(0);
    expect(state.lessonPlan.steps[0].status).toBe('active');
    expect(state.lessonPlan.steps[1].status).toBe('pending');
    expect(state).not.toHaveProperty('fileText');
  });

  it('PLANNING_FAILED sets an error and the error phase', () => {
    const state = lessonReducer(initialState, {
      type: 'PLANNING_FAILED',
      message: 'upstream exploded',
      retryable: true,
    });
    expect(state.phase).toBe('error');
    expect(state.error).toEqual({ message: 'upstream exploded', retryable: true });
  });

  it('streams tutor text chunk by chunk into the last message', () => {
    let state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_STARTED' });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_CHUNK', textChunk: 'Hello' });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_CHUNK', textChunk: ' there' });

    const last = state.messages.at(-1);
    expect(last.text).toBe('Hello there');
    expect(last.streaming).toBe(true);
    expect(last.stepId).toBe('step_1');
  });

  it('TUTOR_STREAM_STOPPED stops streaming without losing partial text', () => {
    let state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_STARTED' });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_CHUNK', textChunk: 'partial' });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_STOPPED' });

    const last = state.messages.at(-1);
    expect(last.text).toBe('partial');
    expect(last.streaming).toBe(false);
  });

  it('TUTOR_TURN_COMPLETE with stepCompleted:false keeps the same step active', () => {
    let state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_STARTED' });
    state = lessonReducer(state, { type: 'TUTOR_TURN_COMPLETE', stepCompleted: false });

    expect(state.currentStepIndex).toBe(0);
    expect(state.lessonPlan.steps[0].status).toBe('active');
    expect(state.messages.at(-1).streaming).toBe(false);
  });

  it('TUTOR_TURN_COMPLETE with stepCompleted:true advances to the next step', () => {
    let state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_STARTED' });
    state = lessonReducer(state, { type: 'TUTOR_TURN_COMPLETE', stepCompleted: true });

    expect(state.currentStepIndex).toBe(1);
    expect(state.lessonPlan.steps[0].status).toBe('completed');
    expect(state.lessonPlan.steps[1].status).toBe('active');
    expect(state.phase).toBe('lesson');
  });

  it('completing the last step sets phase to done', () => {
    let state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    state = lessonReducer(state, { type: 'TUTOR_TURN_COMPLETE', stepCompleted: true });
    state = lessonReducer(state, { type: 'TUTOR_TURN_COMPLETE', stepCompleted: true });

    expect(state.phase).toBe('done');
    expect(state.currentStepIndex).toBe(1);
    expect(state.lessonPlan.steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('TUTOR_TURN_FAILED drops an empty streaming placeholder and sets an error', () => {
    let state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    state = lessonReducer(state, { type: 'TUTOR_STREAM_STARTED' });
    state = lessonReducer(state, { type: 'TUTOR_TURN_FAILED', message: 'network error', retryable: true });

    expect(state.messages).toHaveLength(0);
    expect(state.error).toEqual({ message: 'network error', retryable: true });
  });

  it('student messages are tagged with the current step id', () => {
    let state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    state = lessonReducer(state, { type: 'STUDENT_MESSAGE_SENT', text: 'I think it falls because of air' });

    expect(state.messages[0]).toMatchObject({
      role: 'student',
      text: 'I think it falls because of air',
      stepId: 'step_1',
    });
  });

  it('RESET returns to initialState', () => {
    let state = lessonReducer(initialState, { type: 'PLANNING_SUCCEEDED', lessonPlan: twoStepPlan });
    state = lessonReducer(state, { type: 'RESET' });
    expect(state).toEqual(initialState);
  });
});
