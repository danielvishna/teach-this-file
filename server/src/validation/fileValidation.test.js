/**
 * @fileoverview Unit tests for fileValidation.js. Pure logic, no multer,
 * no AI, no mocking needed.
 */
import { describe, expect, it } from 'vitest';
import { FileValidationError, MAX_TEXT_LENGTH, validateAndExtractText } from './fileValidation.js';

/**
 * @param {string} text
 * @param {{mimetype?: string, originalname?: string}} [overrides]
 * @return {!Object} A fake multer in-memory file object.
 */
function makeFile(text, overrides = {}) {
  return {
    mimetype: 'text/plain',
    originalname: 'lesson.txt',
    buffer: Buffer.from(text, 'utf-8'),
    ...overrides,
  };
}

describe('validateAndExtractText', () => {
  it('returns the decoded text for a valid .txt file', () => {
    expect(validateAndExtractText(makeFile('Gravity pulls things down.'))).toBe(
      'Gravity pulls things down.'
    );
  });

  it('throws when no file is given', () => {
    expect(() => validateAndExtractText(undefined)).toThrow(FileValidationError);
  });

  it('throws for an unsupported mimetype without a .txt extension', () => {
    expect(() =>
      validateAndExtractText(
        makeFile('%PDF-1.4...', { mimetype: 'application/pdf', originalname: 'lesson.pdf' })
      )
    ).toThrow(/Unsupported file type/);
  });

  it('accepts a .txt extension even with a generic mimetype', () => {
    const file = makeFile('Hello', { mimetype: 'application/octet-stream' });
    expect(validateAndExtractText(file)).toBe('Hello');
  });

  it('throws for an empty file', () => {
    expect(() => validateAndExtractText(makeFile('   \n  '))).toThrow(/empty/);
  });

  it('accepts a file exactly at the character limit', () => {
    const text = 'a'.repeat(MAX_TEXT_LENGTH);
    expect(validateAndExtractText(makeFile(text))).toHaveLength(MAX_TEXT_LENGTH);
  });

  it('throws for a file over the character limit', () => {
    const text = 'a'.repeat(MAX_TEXT_LENGTH + 1);
    expect(() => validateAndExtractText(makeFile(text))).toThrow(/too long/);
  });

  it('correctly decodes multi-byte UTF-8 (Hebrew) text', () => {
    const hebrew = 'כוח המשיכה הוא כוח הגורם לגופים למשוך זה את זה.';
    expect(validateAndExtractText(makeFile(hebrew))).toBe(hebrew);
  });
});
