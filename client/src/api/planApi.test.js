/**
 * @fileoverview Unit tests for the planApi.js client wrapper. fetch is
 * mocked — no real network/AI call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLessonPlan } from './planApi.js';

describe('fetchLessonPlan', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a FormData request with apiKey, teacherPrompt and file', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lessonPlan: { title: 'Gravity', steps: [] } }),
    });
    const file = new File(['Gravity pulls things down.'], 'lesson.txt', { type: 'text/plain' });

    const lessonPlan = await fetchLessonPlan({ apiKey: 'key-1', file, teacherPrompt: 'Teach this' });

    expect(lessonPlan).toEqual({ title: 'Gravity', steps: [] });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/plan');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('apiKey')).toBe('key-1');
    expect(options.body.get('teacherPrompt')).toBe('Teach this');
    expect(options.body.get('file')).toBe(file);
  });

  it('throws the server error message on failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'File is too long' }),
    });
    const file = new File(['x'], 'lesson.txt', { type: 'text/plain' });

    await expect(fetchLessonPlan({ apiKey: 'key-1', file, teacherPrompt: 'Teach this' })).rejects.toThrow(
      'File is too long'
    );
  });
});
