/**
 * @fileoverview After a tutor turn's reply has streamed, judges whether
 * the current step is complete via a second, fast, non-streamed,
 * structured-output call — stepCompleted is never inferred from the
 * streamed text itself (CLAUDE.md's Hard Rules). This module only
 * throws on failure; defaulting to "not completed" on failure is the
 * caller's job (routes/tutorTurn.js), since that default depends on
 * what's safe to assume at the call site, not on this module.
 */
import { z } from 'zod';
import { DEFAULT_MODEL } from './geminiClient.js';

/** @const {!Object} JSON schema Gemini is constrained to on this call. */
const VERDICT_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['stepCompleted'],
  properties: { stepCompleted: { type: 'boolean' } },
};

const verdictSchema = z.object({ stepCompleted: z.boolean() });

/**
 * @param {{
 *   ai: !Object,
 *   step: {objective: string},
 *   history: !Array<{role: string, text: string}>,
 *   studentMessage: (string|undefined),
 *   tutorReply: string,
 * }} input
 * @return {!Promise<boolean>} Whether the student's own words demonstrate
 *     understanding of this step's objective.
 * @throws {Error} If the provider call fails or returns invalid output.
 */
export async function judgeStepCompletion({ ai, step, history, studentMessage, tutorReply }) {
  const exchange = [...history];
  if (studentMessage) exchange.push({ role: 'student', text: studentMessage });
  exchange.push({ role: 'tutor', text: tutorReply });
  const transcript = exchange
    .map((m) => `${m.role === 'tutor' ? 'TUTOR' : 'STUDENT'}: ${m.text}`)
    .join('\n');

  const prompt = `Judge whether the student has demonstrated genuine understanding of this step's objective, based only on evidence in the conversation below — not on the student simply asserting they understand ("I get it", "ok next") without showing it through their own explanation or correct reasoning.

STEP OBJECTIVE: ${step.objective}

CONVERSATION:
${transcript}

Return stepCompleted: true only if the student's own words show they grasped the objective. Otherwise false.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: VERDICT_RESPONSE_SCHEMA,
      abortSignal: AbortSignal.timeout(15000),
    },
  });
  return verdictSchema.parse(JSON.parse(response.text)).stepCompleted;
}
