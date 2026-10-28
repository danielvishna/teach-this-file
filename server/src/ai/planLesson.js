/**
 * @fileoverview Calls Gemini to build a structured lesson plan from a
 * file + teacher prompt. Retries once on invalid/unparseable/ungrounded
 * output, then fails visibly (CLAUDE.md's Hard Rules: never guess or
 * crash on bad AI output).
 */
import { createGeminiClient, DEFAULT_MODEL } from './geminiClient.js';
import { buildPlanningPrompt } from './planningPrompt.js';
import { validateLessonPlan } from '../validation/lessonPlanSchema.js';

/** @const {number} One real attempt plus one retry, per CLAUDE.md. */
const MAX_ATTEMPTS = 2;

/** @const {!Object} JSON schema Gemini is constrained to on this call. */
const LESSON_PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['title', 'subject', 'targetAudience', 'language', 'steps'],
  properties: {
    title: { type: 'string' },
    subject: { type: 'string' },
    targetAudience: { type: 'string' },
    language: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'objective', 'sourceExcerpt'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          objective: { type: 'string' },
          sourceExcerpt: { type: 'string' },
        },
      },
    },
  },
};

/**
 * @param {{apiKey: string, fileText: string, teacherPrompt: string}} input
 * @return {!Promise<!Object>} The validated, grounded lesson plan.
 * @throws {Error} If the model's output is invalid or ungrounded even
 *     after one retry, or the provider call itself fails.
 */
export async function planLesson({ apiKey, fileText, teacherPrompt }) {
  const ai = createGeminiClient(apiKey);
  const prompt = buildPlanningPrompt({ fileText, teacherPrompt });

  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: LESSON_PLAN_RESPONSE_SCHEMA,
          abortSignal: AbortSignal.timeout(30000),
        },
      });
      const rawPlan = JSON.parse(response.text);
      return validateLessonPlan(rawPlan, fileText);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Lesson planning failed after retry: ${lastError.message}`);
}
