/**
 * @fileoverview Resolves which Gemini API key a request should use: the
 * one the client sent, or — for local development only — the
 * GEMINI_API_KEY env var loaded from server/.env. The same code path
 * runs everywhere; it's the environment that differs — the deployed
 * Render server never has this env var set, so the fallback is simply a
 * no-op there, exactly as CLAUDE.md's API key hard rule requires.
 */

/**
 * @param {string|undefined} requestApiKey The `apiKey` field from the
 *     request body, if the client sent one.
 * @return {string|undefined} The key to use — the request's own key
 *     takes precedence — or undefined if neither source has one.
 */
export function resolveApiKey(requestApiKey) {
  return requestApiKey || process.env.GEMINI_API_KEY || undefined;
}
