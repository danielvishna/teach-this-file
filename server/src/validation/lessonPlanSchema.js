/**
 * @fileoverview Zod schema and grounding check for the AI-generated
 * lesson plan. Schema validation alone isn't enough — a model can emit a
 * perfectly-shaped source evidence that it invented. Text excerpts are
 * checked as exact substrings. Native PDFs instead require a positive page
 * locator because their evidence may be visual or OCR-derived.
 */
import { z } from 'zod';

const stepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  sourceExcerpt: z.string().min(1),
  sourcePage: z.number().int().positive().optional(),
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
 * @param {{kind: 'text', text: string}|{kind: 'pdf'}} source Validated source.
 * @return {!Object} The validated, grounded lesson plan.
 * @throws {LessonPlanValidationError} If the shape is wrong, or any
 *     text excerpt is ungrounded, or PDF evidence has no page locator.
 */
export function validateLessonPlan(rawPlan, source) {
  const result = lessonPlanSchema.safeParse(rawPlan);
  if (!result.success) {
    throw new LessonPlanValidationError(`Lesson plan failed schema validation: ${result.error.message}`);
  }

  const plan = result.data;
  if (source.kind === 'text') {
    const ungroundedStep = plan.steps.find((step) => !source.text.includes(step.sourceExcerpt));
    if (ungroundedStep) {
      throw new LessonPlanValidationError(
        `Step "${ungroundedStep.title}"'s sourceExcerpt is not an exact match in the source file.`
      );
    }
  } else {
    const unlocatedStep = plan.steps.find((step) => !step.sourcePage);
    if (unlocatedStep) {
      throw new LessonPlanValidationError(
        `Step "${unlocatedStep.title}" must identify the PDF page containing its source evidence.`
      );
    }
  }

  return plan;
}
