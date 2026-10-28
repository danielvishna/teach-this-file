/**
 * @fileoverview POST /api/plan — builds a lesson plan from an uploaded
 * .txt file and a teacher prompt. multipart/form-data: file field
 * "file", text fields "apiKey" and "teacherPrompt".
 */
import { Router } from 'express';
import { planLesson } from '../ai/planLesson.js';
import { resolveApiKey } from '../ai/resolveApiKey.js';
import { uploadSingleFile } from '../middleware/upload.js';
import { FileValidationError, validateAndExtractText } from '../validation/fileValidation.js';

export const planRouter = Router();

planRouter.post('/', uploadSingleFile('file'), async (req, res) => {
  const startedAt = Date.now();
  const apiKey = resolveApiKey(req.body.apiKey);
  const { teacherPrompt } = req.body;

  if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });
  if (!teacherPrompt) return res.status(400).json({ error: 'teacherPrompt is required' });

  let fileText;
  try {
    fileText = validateAndExtractText(req.file);
  } catch (err) {
    if (err instanceof FileValidationError) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }

  try {
    const lessonPlan = await planLesson({ apiKey, fileText, teacherPrompt });
    console.log(`POST /api/plan 200 ${Date.now() - startedAt}ms steps=${lessonPlan.steps.length}`);
    res.json({ lessonPlan });
  } catch (err) {
    console.error(`POST /api/plan 502 ${Date.now() - startedAt}ms ${err.name}: ${err.message}`);
    res.status(502).json({ error: 'Failed to build a lesson plan. Please try again.' });
  }
});
