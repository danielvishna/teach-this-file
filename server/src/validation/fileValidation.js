/**
 * @fileoverview Validates uploaded text and PDF files for lesson planning.
 * Text is decoded for exact-quote grounding; PDF bytes stay intact so Gemini
 * can inspect scanned text, images, diagrams, tables, and equations natively.
 * Kept independent of Express routing and AI calls per CLAUDE.md.
 */

/** @const {number} Max characters for v1's text files (see DECISIONS.md). */
export const MAX_TEXT_LENGTH = 20000;

/** @const {number} Maximum raw upload size; primarily bounds PDF cost. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const GENERIC_MIME_TYPE = 'application/octet-stream';
const TEXT_MIME_TYPES = new Set(['text/plain', GENERIC_MIME_TYPE]);
const PDF_MIME_TYPES = new Set(['application/pdf', GENERIC_MIME_TYPE]);

/** Thrown for any file the caller should see as a 400, not a 500. */
export class FileValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Prepares a bounded source descriptor without discarding PDF visuals.
 * @param {{mimetype: string, originalname: string, buffer: !Buffer}} file A
 *     multer in-memory file object.
 * @return {{kind: 'text', text: string, mimeType: string}|{kind: 'pdf',
 *     buffer: !Buffer, mimeType: string}} Content ready for lesson planning.
 * @throws {FileValidationError} If the file is missing, empty, too large,
 *     mislabeled, or not a supported `.txt`/`.pdf` file.
 */
export function validateAndPrepareSource(file) {
  if (!file) {
    throw new FileValidationError('No file was uploaded.');
  }

  if (!file.buffer?.length) {
    throw new FileValidationError('File is empty.');
  }
  if (file.buffer.length > MAX_UPLOAD_BYTES) {
    throw new FileValidationError(
      `File is too large (${file.buffer.length} bytes). The limit is ${MAX_UPLOAD_BYTES} bytes.`
    );
  }

  const fileName = file.originalname || '';
  if (/\.txt$/i.test(fileName) && TEXT_MIME_TYPES.has(file.mimetype)) {
    const text = file.buffer.toString('utf-8');

    if (text.trim().length === 0) {
      throw new FileValidationError('File is empty.');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new FileValidationError(
        `File is too long (${text.length} characters). The limit is ${MAX_TEXT_LENGTH} characters.`
      );
    }
    return { kind: 'text', text, mimeType: 'text/plain' };
  }

  if (/\.pdf$/i.test(fileName) && PDF_MIME_TYPES.has(file.mimetype)) {
    if (!file.buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
      throw new FileValidationError('The uploaded .pdf file does not contain a valid PDF header.');
    }
    return { kind: 'pdf', buffer: file.buffer, mimeType: 'application/pdf' };
  }

  throw new FileValidationError(
    `Unsupported file type "${file.mimetype || 'unknown'}". Upload a .txt or .pdf file.`
  );
}
