/**
 * @fileoverview Unit tests for lessonPlanSchema.js. Pure logic, no
 * mocking needed. Covers both failure branches of validateLessonPlan:
 * schema shape and grounding — previously only the grounding branch was
 * exercised, indirectly, via routes/plan.test.js.
 */
import { describe, expect, it } from 'vitest';
import { LessonPlanValidationError, validateLessonPlan } from './lessonPlanSchema.js';

const FILE_TEXT = 'Gravity is the force that pulls objects toward the Earth.';

const VALID_PLAN = {
  title: 'Intro to Gravity',
  subject: 'physics',
  targetAudience: '7th grade',
  language: 'en',
  steps: [
    {
      id: 'step_1',
      title: 'What is gravity?',
      objective: 'Understand the basic force',
      sourceExcerpt: 'Gravity is the force that pulls objects toward the Earth.',
    },
  ],
};

describe('validateLessonPlan', () => {
  it('returns the plan unchanged when it is valid and grounded', () => {
    expect(validateLessonPlan(VALID_PLAN, { kind: 'text', text: FILE_TEXT })).toEqual(VALID_PLAN);
  });

  it('throws when a required top-level field is missing', () => {
    const { subject: _subject, ...missingSubject } = VALID_PLAN;
    expect(() => validateLessonPlan(missingSubject, { kind: 'text', text: FILE_TEXT })).toThrow(
      LessonPlanValidationError
    );
    expect(() => validateLessonPlan(missingSubject, { kind: 'text', text: FILE_TEXT })).toThrow(
      /schema validation/i
    );
  });

  it('throws when steps is an empty array', () => {
    expect(() => validateLessonPlan({ ...VALID_PLAN, steps: [] }, { kind: 'text', text: FILE_TEXT })).toThrow(
      LessonPlanValidationError
    );
  });

  it('throws when a step is missing a required field', () => {
    const planWithBadStep = { ...VALID_PLAN, steps: [{ id: 's1', title: 'x' }] };
    expect(() => validateLessonPlan(planWithBadStep, { kind: 'text', text: FILE_TEXT })).toThrow(
      LessonPlanValidationError
    );
  });

  it('throws when a sourceExcerpt is not grounded in the file', () => {
    const ungrounded = {
      ...VALID_PLAN,
      steps: [{ ...VALID_PLAN.steps[0], sourceExcerpt: 'this text is not in the file' }],
    };
    expect(() => validateLessonPlan(ungrounded, { kind: 'text', text: FILE_TEXT })).toThrow(
      /not an exact match/i
    );
  });

  it('requires a page locator for every PDF-backed step', () => {
    expect(() => validateLessonPlan(VALID_PLAN, { kind: 'pdf' })).toThrow(/PDF page/);
    const pdfPlan = {
      ...VALID_PLAN,
      steps: [{ ...VALID_PLAN.steps[0], sourcePage: 2 }],
    };
    expect(validateLessonPlan(pdfPlan, { kind: 'pdf' })).toEqual(pdfPlan);
  });
});
