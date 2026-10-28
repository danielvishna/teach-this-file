/**
 * @fileoverview Unit tests for fileValidation.js. Pure logic, no multer,
 * no AI, no mocking needed.
 */
import { describe, expect, it } from 'vitest';
import {
  FileValidationError,
  MAX_TEXT_LENGTH,
  MAX_UPLOAD_BYTES,
  validateAndPrepareSource,
} from './fileValidation.js';

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

describe('validateAndPrepareSource', () => {
  it('returns decoded text for a valid .txt file', () => {
    expect(validateAndPrepareSource(makeFile('Gravity pulls things down.'))).toEqual({
      kind: 'text',
      text: 'Gravity pulls things down.',
      mimeType: 'text/plain',
    });
  });

  it('throws when no file is given', () => {
    expect(() => validateAndPrepareSource(undefined)).toThrow(FileValidationError);
  });

  it('returns intact bytes for a valid PDF', () => {
    const file = makeFile('%PDF-1.4\nvisual content', {
      mimetype: 'application/pdf',
      originalname: 'lesson.pdf',
    });
    const source = validateAndPrepareSource(file);
    expect(source).toMatchObject({ kind: 'pdf', mimeType: 'application/pdf' });
    expect(source.buffer).toBe(file.buffer);
  });

  it('rejects a .pdf without a PDF header', () => {
    expect(() =>
      validateAndPrepareSource(
        makeFile('not a pdf', { mimetype: 'application/pdf', originalname: 'lesson.pdf' })
      )
    ).toThrow(/valid PDF header/);
  });

  it('throws for an unsupported extension and mimetype', () => {
    expect(() =>
      validateAndPrepareSource(
        makeFile('slides', { mimetype: 'application/vnd.ms-powerpoint', originalname: 'lesson.ppt' })
      )
    ).toThrow(/Unsupported file type/);
  });

  it('accepts a .txt extension even with a generic mimetype', () => {
    const file = makeFile('Hello', { mimetype: 'application/octet-stream' });
    expect(validateAndPrepareSource(file).text).toBe('Hello');
  });

  it('throws for an empty file', () => {
    expect(() => validateAndPrepareSource(makeFile('   \n  '))).toThrow(/empty/);
  });

  it('accepts a file exactly at the character limit', () => {
    const text = 'a'.repeat(MAX_TEXT_LENGTH);
    expect(validateAndPrepareSource(makeFile(text)).text).toHaveLength(MAX_TEXT_LENGTH);
  });

  it('throws for a file over the character limit', () => {
    const text = 'a'.repeat(MAX_TEXT_LENGTH + 1);
    expect(() => validateAndPrepareSource(makeFile(text))).toThrow(/too long/);
  });

  it('throws for a raw file over the upload byte limit', () => {
    const file = makeFile('a', {
      buffer: Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1),
      mimetype: 'application/pdf',
      originalname: 'lesson.pdf',
    });
    expect(() => validateAndPrepareSource(file)).toThrow(/too large/);
  });

  it('correctly decodes multi-byte UTF-8 (Hebrew) text', () => {
    const hebrew = 'כוח המשיכה הוא כוח הגורם לגופים למשוך זה את זה.';
    expect(validateAndPrepareSource(makeFile(hebrew)).text).toBe(hebrew);
  });
});
