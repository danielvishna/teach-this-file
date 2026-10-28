/** @fileoverview Contract tests for the adaptive tutor prompt. */
import { describe, expect, it } from 'vitest';
import { buildTutorPrompt } from './tutorPrompt.js';

const BASE_INPUT = {
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
};

describe('buildTutorPrompt', () => {
  it('requires requested source evidence and forbids invented missing values', () => {
    const prompt = buildTutorPrompt(BASE_INPUT);

    expect(prompt).toContain('named example, table row, equation, or diagram detail');
    expect(prompt).toContain('not available in the current step rather than inventing values');
    expect(prompt).toContain('Blue cart: m=2 kg, v=3 m/s, E=9 J.');
  });

  it('requires Markdown dollar delimiters for mathematics and no raw HTML', () => {
    const prompt = buildTutorPrompt(BASE_INPUT);

    expect(prompt).toContain('use $...$ for inline math and $$...$$ for display math');
    expect(prompt).toContain('Do not use raw HTML');
    expect(prompt).toContain('Do not embed a complete equation inside an RTL sentence');
  });
});
