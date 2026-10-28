import { GoogleGenAI } from '@google/genai';

/**
 * Model alias (not a pinned dated version): Google keeps this pointed at
 * whatever its current small/cheap "flash-lite" model is, which avoids the
 * two failure modes seen in practice testing — pinning to a model that gets
 * deprecated, and the newest flagship model being overloaded (503) because
 * everyone on the free tier hits it first.
 */
export const DEFAULT_MODEL = 'gemini-flash-lite-latest';

/**
 * The API key arrives per-request from the client and is never stored or
 * logged server-side (hard rule from the assignment brief).
 * @param {string} apiKey
 * @return {GoogleGenAI}
 */
export function createGeminiClient(apiKey) {
  if (!apiKey) throw new Error('Missing API key');
  return new GoogleGenAI({ apiKey });
}
