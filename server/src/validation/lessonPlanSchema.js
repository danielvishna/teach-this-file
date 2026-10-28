/**
 * @fileoverview Zod schema and grounding check for the AI-generated
 * lesson plan. Schema validation alone isn't enough — a model can emit a
 * perfectly-shaped `sourceExcerpt` that it invented rather than quoted,
 * so isGrounded() verifies it's an exact substring of the source file
 * before the plan is trusted (CLAUDE.md: anything state-relevant must be
 * schema-validated, never trusted from free-form AI output alone).
 */
import { z } from 'zod';

const stepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  sourceExcerpt: z.string().min(1),
});

/** @const {!z.ZodType} Shape of a validated lesson plan (pre-grounding). */
export const lessonPlanSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  targetAudience: z.string().min(1),
  language: z.string().min(1),
  steps: z.array(stepSchema).min(1),
});

/** Thrown when the model's output fails schema validation or grounding. */
export class LessonPlanValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LessonPlanValidationError';
  }
}

/**
 * @param {unknown} rawPlan Parsed JSON from the model.
 * @param {string} fileText The original file text each step's
 *     `sourceExcerpt` must be an exact substring of.
 * @return {!Object} The validated, grounded lesson plan.
 * @throws {LessonPlanValidationError} If the shape is wrong, or any
 *     step's `sourceExcerpt` isn't a real substring of `fileText`.
 */
export function validateLessonPlan(rawPlan, fileText) {
  const result = lessonPlanSchema.safeParse(rawPlan);
  if (!result.success) {
    throw new LessonPlanValidationError(`Lesson plan failed schema validation: ${result.error.message}`);
  }

  const plan = result.data;
  const ungroundedStep = plan.steps.find((step) => !fileText.includes(step.sourceExcerpt));
  if (ungroundedStep) {
    throw new LessonPlanValidationError(
      `Step "${ungroundedStep.title}"'s sourceExcerpt is not an exact match in the source file.`
    );
  }

  return plan;
}
