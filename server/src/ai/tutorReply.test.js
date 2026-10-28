/**
 * @fileoverview Unit tests for tutorReply.js.
 */
import { describe, expect, it, vi } from 'vitest';
import { streamTutorReply } from './tutorReply.js';

/** @return {!AsyncGenerator<{text: string}>} */
async function* chunkStream(chunks) {
  for (const text of chunks) yield { text };
}

describe('streamTutorReply', () => {
  it('calls onChunk for each non-empty text chunk, in order', async () => {
    const ai = { models: { generateContentStream: vi.fn().mockResolvedValue(chunkStream(['Hello', '', ' there'])) } };
    const onChunk = vi.fn();

    await streamTutorReply({ ai, prompt: 'x', signal: new AbortController().signal, onChunk });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onChunk).toHaveBeenNthCalledWith(2, ' there');
  });

  it('propagates an error from the provider call itself', async () => {
    const ai = { models: { generateContentStream: vi.fn().mockRejectedValue(new Error('upstream exploded')) } };

    await expect(
      streamTutorReply({ ai, prompt: 'x', signal: new AbortController().signal, onChunk: vi.fn() })
    ).rejects.toThrow('upstream exploded');
  });

  it('calls onChunk for chunks already yielded before the stream throws mid-iteration', async () => {
    async function* badStream() {
      yield { text: 'partial' };
      throw new Error('mid-stream failure');
    }
    const ai = { models: { generateContentStream: vi.fn().mockResolvedValue(badStream()) } };
    const onChunk = vi.fn();

    await expect(
      streamTutorReply({ ai, prompt: 'x', signal: new AbortController().signal, onChunk })
    ).rejects.toThrow('mid-stream failure');
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('partial');
  });
});
