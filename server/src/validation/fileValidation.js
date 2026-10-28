/**
 * @fileoverview Validates and extracts text from an uploaded file for the
 * lesson-planning flow. v1 supports `.txt` only (see CLAUDE.md); other
 * types are rejected with a clear error rather than silently mishandled
 * or crashing. Kept independent of Express routing and of the AI-calling
 * code per CLAUDE.md's Architecture rule.
 */

/** @const {number} Max characters for v1's text files (see DECISIONS.md). */
export const MAX_TEXT_LENGTH = 20000;

/** @const {!Set<string>} Accepted MIME types for v1 (`.txt` only). */
const ALLOWED_MIME_TYPES = new Set(['text/plain']);

/** Thrown for any file the caller should see as a 400, not a 500. */
export class FileValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * @param {{mimetype: string, originalname: string, buffer: !Buffer}} file
 *     A multer in-memory file object.
 * @return {string} The file's decoded, validated text content.
 * @throws {FileValidationError} If no file was given, the file type is
 *     unsupported, the decoded text is empty, or it exceeds
 *     MAX_TEXT_LENGTH.
 */
export function validateAndExtractText(file) {
  if (!file) {
    throw new FileValidationError('No file was uploaded.');
  }

  const isTxtExtension = /\.txt$/i.test(file.originalname || '');
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !isTxtExtension) {
    throw new FileValidationError(
      `Unsupported file type "${file.mimetype || 'unknown'}". Only .txt files are supported right now.`
    );
  }

  const text = file.buffer.toString('utf-8');

  if (text.trim().length === 0) {
    throw new FileValidationError('File is empty.');
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new FileValidationError(
      `File is too long (${text.length} characters). The limit is ${MAX_TEXT_LENGTH} characters.`
    );
  }

  return text;
}
