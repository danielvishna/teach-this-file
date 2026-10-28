/**
 * @fileoverview Owns the Gemini streaming call for a tutor turn's reply.
 * Kept separate from Express (routes/tutorTurn.js) per CLAUDE.md's
 * Architecture rule — the route's job is HTTP wiring (headers,
 * res.write, disconnect detection), not the Gemini SDK call itself.
 */
import { DEFAULT_MODEL } from './geminiClient.js';

/**
 * Streams a tutor reply, invoking `onChunk` for each non-empty text
 * chunk as it arrives. Does not catch errors — if the model stream
 * fails partway through, this rejects after having already called
 * `onChunk` for whatever arrived first; the caller (routes/tutorTurn.js)
 * decides what that means for the HTTP response (CLAUDE.md's three
 * streaming-error cases).
 * @param {{ai: !Object, prompt: string, signal: !AbortSignal, onChunk: function(string): void}} input
 * @return {!Promise<void>} Resolves once the stream ends normally.
 * @throws {Error} If the provider call itself fails, or the stream
 *     throws partway through.
 */
export async function streamTutorReply({ ai, prompt, signal, onChunk }) {
  const stream = await ai.models.generateContentStream({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: { abortSignal: signal },
  });
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) onChunk(text);
  }
}
