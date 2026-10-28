/**
 * @fileoverview Unit tests for tutorTurnApi.js. fetch is mocked — no
 * real network/AI call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamTutorTurn } from './tutorTurnApi.js';

/**
 * @param {!Array<string>} textChunks Raw text pieces to hand back from
 *     successive `reader.read()` calls — lets a test simulate a JSONL
 *     line arriving split across two network chunks.
 * @return {!Object} A fake fetch Response `.body`.
 */
function createFakeBody(textChunks) {
  let i = 0;
  const encoder = new TextEncoder();
  return {
    getReader() {
      return {
        async read() {
          if (i >= textChunks.length) return { done: true, value: undefined };
          const value = encoder.encode(textChunks[i]);
          i++;
          return { done: false, value };
        },
      };
    },
  };
}

const BASE_ARGS = {
  apiKey: 'test-key',
  teacherPrompt: 'Teach this',
  subject: 'physics',
  targetAudience: '7th grade',
  language: 'en',
  step: { title: 'What is gravity?', objective: 'Define it', sourceExcerpt: 'Gravity pulls.' },
  history: [],
  stepNumber: 1,
};

describe('streamTutorTurn', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('invokes onChunk and onVerdict for each JSONL line', async () => {
    const lines = [
      '{"type":"chunk","text":"Hello"}\n',
      '{"type":"chunk","text":" there"}\n',
      '{"type":"verdict","stepCompleted":true}\n',
    ];
    fetch.mockResolvedValueOnce({ ok: true, body: createFakeBody(lines) });

    const onChunk = vi.fn();
    const onVerdict = vi.fn();
    await streamTutorTurn({ ...BASE_ARGS, signal: new AbortController().signal, onChunk, onVerdict });

    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onChunk).toHaveBeenNthCalledWith(2, ' there');
    expect(onVerdict).toHaveBeenCalledWith(true);
  });

  it('correctly parses a JSONL line split across two network chunks', async () => {
    const splitLine = ['{"type":"chunk",', '"text":"Hello"}\n{"type":"verdict","stepCompleted":false}\n'];
    fetch.mockResolvedValueOnce({ ok: true, body: createFakeBody(splitLine) });

    const onChunk = vi.fn();
    const onVerdict = vi.fn();
    await streamTutorTurn({ ...BASE_ARGS, signal: new AbortController().signal, onChunk, onVerdict });

    expect(onChunk).toHaveBeenCalledWith('Hello');
    expect(onVerdict).toHaveBeenCalledWith(false);
  });

  it('sends stepNumber and previousStepTitle in the request body', async () => {
    fetch.mockResolvedValueOnce({ ok: true, body: createFakeBody(['{"type":"verdict","stepCompleted":false}\n']) });

    await streamTutorTurn({
      ...BASE_ARGS,
      stepNumber: 2,
      previousStepTitle: 'Evaporation',
      signal: new AbortController().signal,
      onChunk: vi.fn(),
      onVerdict: vi.fn(),
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.stepNumber).toBe(2);
    expect(body.previousStepTitle).toBe('Evaporation');
  });

  it('throws the server error message when the response is not ok', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'upstream exploded' }) });

    await expect(
      streamTutorTurn({ ...BASE_ARGS, signal: new AbortController().signal, onChunk: vi.fn(), onVerdict: vi.fn() })
    ).rejects.toThrow('upstream exploded');
  });
});
