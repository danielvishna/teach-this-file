/**
 * @fileoverview Unit tests for resolveApiKey.js.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiKey } from './resolveApiKey.js';

describe('resolveApiKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers the request apiKey when both are present', () => {
    vi.stubEnv('GEMINI_API_KEY', 'env-key');
    expect(resolveApiKey('request-key')).toBe('request-key');
  });

  it('falls back to GEMINI_API_KEY when the request omits one', () => {
    vi.stubEnv('GEMINI_API_KEY', 'env-key');
    expect(resolveApiKey(undefined)).toBe('env-key');
  });

  it('returns undefined when neither source has a key', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(resolveApiKey(undefined)).toBeUndefined();
  });
});
