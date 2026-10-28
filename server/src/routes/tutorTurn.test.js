/**
 * @fileoverview Unit tests for POST /api/tutor-turn. The Gemini client
 * is mocked throughout — these tests check our route/prompt/verdict
 * orchestration logic, not the model's behavior.
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { tutorTurnRouter } from './tutorTurn.js';

vi.mock('../ai/geminiClient.js', () => ({
  createGeminiClient: vi.fn(),
  DEFAULT_MODEL: 'gemini-flash-lite-latest',
}));

const { createGeminiClient } = await import('../ai/geminiClient.js');

/** @return {!AsyncGenerator<{text: string}>} A fake streamed response. */
async function* chunkStream(chunks) {
  for (const text of chunks) yield { text };
}

/**
 * @param {{chunks?: !Array<string>, streamError?: Error, verdict?: boolean, verdictError?: Error}} [options]
 * @return {!Object} A fake client with both generateContentStream (the
 *     reply) and generateContent (the verdict) stubbed.
 */
function createMockAi({
  chunks = ['Hello', ' there'],
  streamError,
  partialThenError,
  verdict = true,
  verdictError,
} = {}) {
  let generateContentStream;
  if (streamError) {
    generateContentStream = vi.fn().mockRejectedValue(streamError);
  } else if (partialThenError) {
    generateContentStream = vi.fn().mockResolvedValue(
      (async function* () {
        for (const text of partialThenError.chunks) yield { text };
        throw partialThenError.error;
      })()
    );
  } else {
    generateContentStream = vi.fn().mockResolvedValue(chunkStream(chunks));
  }
  const generateContent = verdictError
    ? vi.fn().mockRejectedValue(verdictError)
    : vi.fn().mockResolvedValue({ text: JSON.stringify({ stepCompleted: verdict }) });
  return { models: { generateContentStream, generateContent } };
}

const VALID_BODY = {
  apiKey: 'test-key',
  teacherPrompt: 'Teach this to 7th graders',
  subject: 'physics',
  targetAudience: '7th grade',
  language: 'en',
  step: { title: 'What is gravity?', objective: 'Understand the basic force', sourceExcerpt: 'Gravity pulls.' },
  history: [],
};

/**
 * @param {!import('supertest').Response} res
 * @return {!Array<!Object>} Parsed JSONL lines.
 */
function parseLines(res) {
  return res.text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('POST /api/tutor-turn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 400 when apiKey is missing', async () => {
    const { apiKey: _apiKey, ...body } = VALID_BODY;
    const res = await request(createApp()).post('/api/tutor-turn').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/apiKey/i);
  });

  it('returns 400 for an invalid request body', async () => {
    const { step: _step, ...body } = VALID_BODY;
    const res = await request(createApp()).post('/api/tutor-turn').send(body);
    expect(res.status).toBe(400);
  });

  it('streams chunk lines then a verdict line on success', async () => {
    const mockAi = createMockAi({ chunks: ['Hello', ' there'], verdict: true });
    createGeminiClient.mockReturnValue(mockAi);
    const res = await request(createApp())
      .post('/api/tutor-turn')
      .send({ ...VALID_BODY, studentMessage: 'Because mass attracts mass.' });

    expect(res.status).toBe(200);
    const lines = parseLines(res);
    expect(lines).toEqual([
      { type: 'chunk', text: 'Hello' },
      { type: 'chunk', text: ' there' },
      { type: 'verdict', stepCompleted: true },
    ]);
  });

  it('skips the verdict call and hardcodes stepCompleted:false when opening a step (no studentMessage)', async () => {
    const mockAi = createMockAi({ chunks: ['Hi there!'], verdict: true });
    createGeminiClient.mockReturnValue(mockAi);
    const res = await request(createApp()).post('/api/tutor-turn').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(mockAi.models.generateContent).not.toHaveBeenCalled();
    const lines = parseLines(res);
    expect(lines.at(-1)).toEqual({ type: 'verdict', stepCompleted: false });
  });

  it('passes the full exchange to the verdict call', async () => {
    const mockAi = createMockAi({ chunks: ['Good job!'], verdict: true });
    createGeminiClient.mockReturnValue(mockAi);
    await request(createApp())
      .post('/api/tutor-turn')
      .send({ ...VALID_BODY, studentMessage: 'Because mass attracts mass.' });

    expect(mockAi.models.generateContent).toHaveBeenCalledTimes(1);
    const verdictPrompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    expect(verdictPrompt).toContain('Because mass attracts mass.');
    expect(verdictPrompt).toContain('Good job!');
  });

  it('defaults stepCompleted to false when the verdict call fails', async () => {
    createGeminiClient.mockReturnValue(
      createMockAi({ chunks: ['Hello'], verdictError: new Error('verdict upstream exploded') })
    );
    const res = await request(createApp())
      .post('/api/tutor-turn')
      .send({ ...VALID_BODY, studentMessage: 'My answer' });

    expect(res.status).toBe(200);
    const lines = parseLines(res);
    expect(lines.at(-1)).toEqual({ type: 'verdict', stepCompleted: false });
  });

  it('returns 502 JSON when the stream fails before any output', async () => {
    createGeminiClient.mockReturnValue(createMockAi({ streamError: new Error('upstream exploded') }));
    const res = await request(createApp()).post('/api/tutor-turn').send(VALID_BODY);

    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
  });

  it('still writes a verdict and returns 200 when the stream fails after partial output', async () => {
    createGeminiClient.mockReturnValue(
      createMockAi({
        partialThenError: { chunks: ['Partial'], error: new Error('mid-stream failure') },
        verdict: true,
      })
    );
    const res = await request(createApp())
      .post('/api/tutor-turn')
      .send({ ...VALID_BODY, studentMessage: 'My answer' });

    expect(res.status).toBe(200);
    const lines = parseLines(res);
    expect(lines[0]).toEqual({ type: 'chunk', text: 'Partial' });
    expect(lines.at(-1)).toEqual({ type: 'verdict', stepCompleted: true });
  });

  it('ends the response with no verdict line and skips the verdict call when the client disconnects mid-stream', async () => {
    const mockAi = createMockAi({ chunks: ['One', 'Two'] });
    createGeminiClient.mockReturnValue(mockAi);

    const handler = tutorTurnRouter.stack[0].route.stack[0].handle;
    const closeListeners = [];
    const written = [];
    let ended = false;
    const fakeRes = {
      headersSent: false,
      setHeader: () => {},
      status() {
        return this;
      },
      json() {
        ended = true;
        return this;
      },
      write(chunk) {
        written.push(chunk);
        this.headersSent = true;
        // Simulate the client (Stop/navigation) disconnecting right after the first chunk.
        if (written.length === 1) closeListeners.forEach((cb) => cb());
      },
      end() {
        ended = true;
      },
      on(event, cb) {
        if (event === 'close') closeListeners.push(cb);
      },
    };

    // studentMessage is set so a missing verdict call is attributable to the
    // abort path specifically, not to the separate "opening a step skips the
    // verdict call" rule covered by its own test above.
    await handler({ body: { ...VALID_BODY, studentMessage: 'My answer' } }, fakeRes);

    expect(ended).toBe(true);
    const lines = written.map((line) => JSON.parse(line));
    expect(lines.every((line) => line.type === 'chunk')).toBe(true);
    expect(mockAi.models.generateContent).not.toHaveBeenCalled();
  });

  it('falls back to the GEMINI_API_KEY env var when the request omits apiKey', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'env-key');
    createGeminiClient.mockReturnValue(createMockAi());
    const { apiKey: _apiKey, ...body } = VALID_BODY;
    const res = await request(createApp()).post('/api/tutor-turn').send(body);

    expect(res.status).toBe(200);
    expect(createGeminiClient).toHaveBeenCalledWith('env-key');
  });
});
