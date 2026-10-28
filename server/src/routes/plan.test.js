/**
 * @fileoverview Unit tests for POST /api/plan. The Gemini client is
 * mocked throughout (see src/test/mockGeminiClient.js) - these tests
 * check our route/validation/retry logic, not the model's behavior.
 * Also verifies that both multer's own errors and our FileValidationError
 * actually reach the client as the 400 JSON shape they're supposed to
 * (not an unhandled 500) — the exact gap flagged before this was built.
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { createMockGeminiClient } from '../test/mockGeminiClient.js';

vi.mock('../ai/geminiClient.js', () => ({
  createGeminiClient: vi.fn(),
  DEFAULT_MODEL: 'gemini-flash-lite-latest',
}));

const { createGeminiClient } = await import('../ai/geminiClient.js');

const FILE_TEXT = 'Gravity is the force that pulls objects toward the Earth. It was described by Newton.';

const VALID_PLAN = {
  title: 'Intro to Gravity',
  subject: 'physics',
  targetAudience: '7th grade',
  language: 'en',
  steps: [
    {
      id: 'step_1',
      title: 'What is gravity?',
      objective: 'Understand the basic force',
      sourceExcerpt: 'Gravity is the force that pulls objects toward the Earth.',
    },
  ],
};

/**
 * @param {string} text
 * @return {import('supertest').Test} A supertest request with a valid
 *     apiKey + teacherPrompt + attached .txt file, ready to `.expect(...)`.
 */
function postPlanWithFile(text = FILE_TEXT) {
  return request(createApp())
    .post('/api/plan')
    .field('apiKey', 'test-key')
    .field('teacherPrompt', 'Teach this to 7th graders')
    .attach('file', Buffer.from(text, 'utf-8'), { filename: 'lesson.txt', contentType: 'text/plain' });
}

describe('POST /api/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 400 when apiKey is missing', async () => {
    const res = await request(createApp())
      .post('/api/plan')
      .field('teacherPrompt', 'Teach this')
      .attach('file', Buffer.from(FILE_TEXT), { filename: 'lesson.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/apiKey/i);
  });

  it('falls back to the GEMINI_API_KEY env var when the request omits apiKey (local dev only)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'env-key');
    createGeminiClient.mockReturnValue(createMockGeminiClient({ text: JSON.stringify(VALID_PLAN) }));

    const res = await request(createApp())
      .post('/api/plan')
      .field('teacherPrompt', 'Teach this to 7th graders')
      .attach('file', Buffer.from(FILE_TEXT, 'utf-8'), { filename: 'lesson.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(createGeminiClient).toHaveBeenCalledWith('env-key');
  });

  it('returns 400 when teacherPrompt is missing', async () => {
    const res = await request(createApp())
      .post('/api/plan')
      .field('apiKey', 'test-key')
      .attach('file', Buffer.from(FILE_TEXT), { filename: 'lesson.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/teacherPrompt/i);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(createApp())
      .post('/api/plan')
      .field('apiKey', 'test-key')
      .field('teacherPrompt', 'Teach this');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('returns 400 as JSON for an unsupported file type', async () => {
    const res = await request(createApp())
      .post('/api/plan')
      .field('apiKey', 'test-key')
      .field('teacherPrompt', 'Teach this')
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'lesson.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported file type/i);
  });

  it('returns 400 as JSON for a file over the character limit', async () => {
    const res = await postPlanWithFile('a'.repeat(20001));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/i);
  });

  it('returns 400 as JSON (not an unhandled 500) for a file over the raw byte cap', async () => {
    const res = await postPlanWithFile('a'.repeat(600 * 1024));
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('returns a validated, grounded lesson plan on success', async () => {
    createGeminiClient.mockReturnValue(
      createMockGeminiClient({ text: JSON.stringify(VALID_PLAN) })
    );
    const res = await postPlanWithFile();
    expect(res.status).toBe(200);
    expect(res.body.lessonPlan).toMatchObject({ subject: 'physics', targetAudience: '7th grade' });
    expect(res.body.lessonPlan.steps).toHaveLength(1);
  });

  it('retries once and succeeds if the first attempt is invalid JSON', async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_PLAN) });
    createGeminiClient.mockReturnValue({ models: { generateContent } });

    const res = await postPlanWithFile();
    expect(res.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('returns 502 when the sourceExcerpt is not grounded in the file, even after retry', async () => {
    const ungroundedPlan = {
      ...VALID_PLAN,
      steps: [{ ...VALID_PLAN.steps[0], sourceExcerpt: 'this text does not appear in the file' }],
    };
    createGeminiClient.mockReturnValue(
      createMockGeminiClient({ text: JSON.stringify(ungroundedPlan) })
    );
    const res = await postPlanWithFile();
    expect(res.status).toBe(502);
  });

  it('returns 502 when the AI provider call fails', async () => {
    createGeminiClient.mockReturnValue(
      createMockGeminiClient({ error: new Error('upstream exploded') })
    );
    const res = await postPlanWithFile();
    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
  });
});
