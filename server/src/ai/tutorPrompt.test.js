/**
 * @fileoverview Unit tests for buildTutorPrompt. Checks the text the
 * prompt builder produces, not any AI call — no Gemini client involved.
 */
import { describe, expect, it } from 'vitest';
import { buildTutorPrompt } from './tutorPrompt.js';

const BASE_ARGS = {
  teacherPrompt: 'Teach this to 7th graders',
  subject: 'science',
  targetAudience: '7th grade',
  language: 'en',
  step: { title: 'Condensation', objective: 'Define it', sourceExcerpt: 'Vapor cools into clouds.' },
  history: [],
};

const MATH_BASE_INPUT = {
  teacherPrompt: 'Teach in Hebrew.',
  subject: 'physics',
  targetAudience: '7th grade',
  language: 'Hebrew',
  step: {
    title: 'Kinetic energy',
    objective: 'Explain velocity squared',
    sourceExcerpt: 'Blue cart: m=2 kg, v=3 m/s, E=9 J.',
  },
  history: [],
  studentMessage: 'Use the blue cart example.',
  stepNumber: 1,
};

describe('buildTutorPrompt', () => {
  it('opens the lesson\'s first step with a fresh hook, no previous-step framing', () => {
    const prompt = buildTutorPrompt({ ...BASE_ARGS, stepNumber: 1 });

    expect(prompt).toMatch(/just starting/i);
    expect(prompt).not.toMatch(/already finished|just finished|do not greet/i);
  });

  it('opens a later step as a continuation, instructing against re-greeting', () => {
    const prompt = buildTutorPrompt({ ...BASE_ARGS, stepNumber: 2, previousStepTitle: 'Evaporation' });

    expect(prompt).toContain('Evaporation');
    expect(prompt).toMatch(/do not greet the student again|starting over/i);
    expect(prompt).not.toMatch(/just starting/i);
  });

  it('uses the respond-to-student task when studentMessage is present, regardless of stepNumber', () => {
    const prompt = buildTutorPrompt({
      ...BASE_ARGS,
      stepNumber: 2,
      previousStepTitle: 'Evaporation',
      studentMessage: 'Because it gets cold.',
    });

    expect(prompt).toContain("STUDENT'S LATEST MESSAGE:\nBecause it gets cold.");
    expect(prompt).not.toMatch(/do not greet the student again/i);
  });

  it('requires requested source evidence and forbids invented missing values', () => {
    const prompt = buildTutorPrompt(MATH_BASE_INPUT);

    expect(prompt).toContain('named example, table row, equation, or diagram detail');
    expect(prompt).toContain('not available in the current step rather than inventing values');
    expect(prompt).toContain('Blue cart: m=2 kg, v=3 m/s, E=9 J.');
  });

  it('requires Markdown dollar delimiters for mathematics and no raw HTML', () => {
    const prompt = buildTutorPrompt(MATH_BASE_INPUT);

    expect(prompt).toContain('use $...$ for inline math and $$...$$ for display math');
    expect(prompt).toContain('Do not use raw HTML');
    expect(prompt).toContain('Do not embed a complete equation inside an RTL sentence');
  });
});
