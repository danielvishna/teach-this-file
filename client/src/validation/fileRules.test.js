/**
 * @fileoverview Unit tests for fileRules.js.
 */
import { describe, expect, it } from 'vitest';
import { isAllowedFileName } from './fileRules.js';

describe('isAllowedFileName', () => {
  it('accepts .txt, case-insensitively', () => {
    expect(isAllowedFileName('lesson.txt')).toBe(true);
    expect(isAllowedFileName('LESSON.TXT')).toBe(true);
  });

  it('rejects other extensions', () => {
    expect(isAllowedFileName('lesson.pdf')).toBe(false);
  });

  it('rejects an empty or missing name', () => {
    expect(isAllowedFileName('')).toBe(false);
    expect(isAllowedFileName(undefined)).toBe(false);
  });
});
