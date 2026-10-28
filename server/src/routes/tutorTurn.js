/**
 * @fileoverview POST /api/tutor-turn — one HTTP request per tutor turn.
 * Streams the tutor's reply as newline-delimited JSON lines, then (once
 * the stream finishes) runs a second, fast structured-output call to
 * decide stepCompleted and writes it as the final line before closing
 * the connection. See CLAUDE.md's "API routes & wire format" section
 * for the exact wire format and why it's one request, not two.
 *
 * Error handling follows the three streaming cases from the practice
 * project's lessons (see CLAUDE.md): a failure before any text streamed
 * is a normal JSON error response; a failure after streaming started can
 * only end the connection (best-effort verdict, then close); a genuine
 * client disconnect (Stop) just ends the response, no verdict call.
 */
import { Router } from 'express';
import { createGeminiClient } from '../ai/geminiClient.js';
import { resolveApiKey } from '../ai/resolveApiKey.js';
import { streamTutorReply } from '../ai/tutorReply.js';
import { buildTutorPrompt } from '../ai/tutorPrompt.js';
import { judgeStepCompletion } from '../ai/tutorVerdict.js';
import { tutorTurnRequestSchema } from '../validation/tutorTurnRequestSchema.js';

export const tutorTurnRouter = Router();

tutorTurnRouter.post('/', async (req, res) => {
  const startedAt = Date.now();
  const apiKey = resolveApiKey(req.body.apiKey);
  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey is required' });
  }

  const parsed = tutorTurnRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: `Invalid request: ${parsed.error.message}` });
  }
  const { teacherPrompt, subject, targetAudience, language, step, history, studentMessage } =
    parsed.data;

  const ai = createGeminiClient(apiKey);
  const prompt = buildTutorPrompt({
    teacherPrompt,
    subject,
    targetAudience,
    language,
    step,
    history,
    studentMessage,
  });

  const abortController = new AbortController();
  const combinedSignal = AbortSignal.any([abortController.signal, AbortSignal.timeout(60000)]);
  res.on('close', () => abortController.abort());

  let anyChunkWritten = false;
  let streamedText = '';
  let failedBeforeAnyOutput = false;

  try {
    await streamTutorReply({
      ai,
      prompt,
      signal: combinedSignal,
      onChunk: (text) => {
        if (!anyChunkWritten) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        anyChunkWritten = true;
        streamedText += text;
        res.write(`${JSON.stringify({ type: 'chunk', text })}\n`);
      },
    });
  } catch (err) {
    if (!anyChunkWritten) {
      failedBeforeAnyOutput = true;
    } else {
      console.error(`POST /api/tutor-turn stream error after partial output: ${err.message}`);
    }
  }

  if (failedBeforeAnyOutput) {
    console.error(`POST /api/tutor-turn 502 ${Date.now() - startedAt}ms stream failed before any output`);
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Failed to generate a reply. Please try again.' });
    }
    return res.end();
  }

  if (abortController.signal.aborted) {
    // Client disconnected (Stop or navigation) — nothing left to send to.
    return res.end();
  }

  let stepCompleted = false;
  try {
    stepCompleted = await judgeStepCompletion({ ai, step, history, studentMessage, tutorReply: streamedText });
  } catch (err) {
    console.error(`POST /api/tutor-turn verdict failed, defaulting stepCompleted=false: ${err.message}`);
  }

  res.write(`${JSON.stringify({ type: 'verdict', stepCompleted })}\n`);
  console.log(`POST /api/tutor-turn 200 ${Date.now() - startedAt}ms stepCompleted=${stepCompleted}`);
  res.end();
});
