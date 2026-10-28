/**
 * @fileoverview Unit tests for fileRules.js.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_TEXT_LENGTH,
  MAX_UPLOAD_BYTES,
  isAllowedFileName,
  validateFile,
  validateFileSize,
  validatePdfHeader,
  validateTextLength,
} from './fileRules.js';

describe('isAllowedFileName', () => {
  it('accepts .txt and .pdf, case-insensitively', () => {
    expect(isAllowedFileName('lesson.txt')).toBe(true);
    expect(isAllowedFileName('LESSON.TXT')).toBe(true);
    expect(isAllowedFileName('lesson.pdf')).toBe(true);
    expect(isAllowedFileName('LESSON.PDF')).toBe(true);
  });

  it('rejects other extensions', () => {
    expect(isAllowedFileName('lesson.pptx')).toBe(false);
  });

  it('rejects an empty or missing name', () => {
    expect(isAllowedFileName('')).toBe(false);
    expect(isAllowedFileName(undefined)).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('rejects an empty file', () => {
    const file = new File([], 'lesson.txt', { type: 'text/plain' });
    expect(validateFileSize(file)).toMatch(/empty/i);
  });

  it('rejects a file over the byte cap', () => {
    const file = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'lesson.pdf', { type: 'application/pdf' });
    expect(validateFileSize(file)).toMatch(/too large/i);
  });

  it('accepts a file within the byte cap', () => {
    const file = new File(['hello'], 'lesson.txt', { type: 'text/plain' });
    expect(validateFileSize(file)).toBeNull();
  });
});

describe('validateTextLength', () => {
  it('rejects a .txt file over the character limit', async () => {
    const file = new File(['a'.repeat(MAX_TEXT_LENGTH + 1)], 'lesson.txt', { type: 'text/plain' });
    await expect(validateTextLength(file)).resolves.toMatch(/too long/i);
  });

  it('accepts a .txt file within the character limit', async () => {
    const file = new File(['short lesson text'], 'lesson.txt', { type: 'text/plain' });
    await expect(validateTextLength(file)).resolves.toBeNull();
  });

  it('rejects a blank .txt file', async () => {
    const file = new File(['   \n  '], 'lesson.txt', { type: 'text/plain' });
    await expect(validateTextLength(file)).resolves.toMatch(/empty/i);
  });
});

describe('validatePdfHeader', () => {
  it('accepts a file starting with the PDF magic bytes', async () => {
    const file = new File(['%PDF-1.4\n...'], 'lesson.pdf', { type: 'application/pdf' });
    await expect(validatePdfHeader(file)).resolves.toBeNull();
  });

  it('rejects a .pdf file without a real PDF header', async () => {
    const file = new File(['not actually a pdf'], 'lesson.pdf', { type: 'application/pdf' });
    await expect(validatePdfHeader(file)).resolves.toMatch(/valid pdf header/i);
  });
});

describe('validateFile', () => {
  it('rejects an unsupported extension before checking size or content', async () => {
    const file = new File(['slides'], 'lesson.pptx', { type: 'application/vnd.ms-powerpoint' });
    await expect(validateFile(file)).resolves.toMatch(/only \.txt and \.pdf/i);
  });

  it('rejects an oversized .txt file by content length, not just bytes', async () => {
    const file = new File(['a'.repeat(MAX_TEXT_LENGTH + 1)], 'lesson.txt', { type: 'text/plain' });
    await expect(validateFile(file)).resolves.toMatch(/too long/i);
  });

  it('rejects a mislabeled .pdf file', async () => {
    const file = new File(['just some text'], 'lesson.pdf', { type: 'application/pdf' });
    await expect(validateFile(file)).resolves.toMatch(/valid pdf header/i);
  });

  it('accepts a valid .pdf file', async () => {
    const file = new File(['%PDF-1.4\n...'], 'lesson.pdf', { type: 'application/pdf' });
    await expect(validateFile(file)).resolves.toBeNull();
  });
});
