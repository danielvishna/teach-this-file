/**
 * @fileoverview Shared mock for the Gemini client (ai/geminiClient.js),
 * used by every server unit test that exercises AI-calling code. Unit
 * tests never call the real Gemini API (slow, flaky, costs money, and
 * tests the model's judgment rather than our code) - that's what the
 * ai-behavior-tester subagent and DECISIONS.md's test scenarios are for.
 */
import { vi } from 'vitest';

/**
 * Builds a fake client shaped like the `@google/genai` SDK client that
 * `createGeminiClient` returns, with `models.generateContent` stubbed.
 * @param {{text?: string, error?: Error}} [options] Either a canned reply
 *     text, or an error for generateContent to reject with.
 * @return {{models: {generateContent: import('vitest').Mock}}}
 */
export function createMockGeminiClient({ text = 'mock reply', error } = {}) {
  const generateContent = error
    ? vi.fn().mockRejectedValue(error)
    : vi.fn().mockResolvedValue({ text });
  return { models: { generateContent } };
}
