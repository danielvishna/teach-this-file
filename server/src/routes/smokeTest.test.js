/**
 * @fileoverview Unit tests for the smoke-test route. The Gemini client is
 * mocked throughout (see src/test/mockGeminiClient.js) - these tests
 * check our route logic, not the model's behavior.
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

describe('POST /api/smoke-test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 400 when apiKey is missing and no env fallback is set', async () => {
    const app = createApp();
    const res = await request(app).post('/api/smoke-test').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/apiKey/i);
    expect(createGeminiClient).not.toHaveBeenCalled();
  });

  it('falls back to the GEMINI_API_KEY env var when the request omits apiKey (local dev only)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'env-key');
    createGeminiClient.mockReturnValue(createMockGeminiClient({ text: 'Smoke test OK' }));
    const app = createApp();
    const res = await request(app).post('/api/smoke-test').send({});
    expect(res.status).toBe(200);
    expect(createGeminiClient).toHaveBeenCalledWith('env-key');
  });

  it('returns the model reply on success', async () => {
    createGeminiClient.mockReturnValue(createMockGeminiClient({ text: 'Smoke test OK' }));
    const app = createApp();
    const res = await request(app).post('/api/smoke-test').send({ apiKey: 'test-key' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Smoke test OK');
    expect(createGeminiClient).toHaveBeenCalledWith('test-key');
  });

  it('returns 502 when the AI provider call fails', async () => {
    createGeminiClient.mockReturnValue(
      createMockGeminiClient({ error: new Error('upstream exploded') })
    );
    const app = createApp();
    const res = await request(app).post('/api/smoke-test').send({ apiKey: 'test-key' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('upstream exploded');
  });
});
