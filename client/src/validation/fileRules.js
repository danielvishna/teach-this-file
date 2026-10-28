/**
 * @fileoverview Client-side copy of the v1 file-type and size rules, for
 * instant UX feedback before upload — so a file that's already known to
 * be rejected (wrong type, empty, too large, a .txt over the character
 * limit, a .pdf without a real PDF header) never makes a round trip to
 * the server at all. The server (server/src/validation/fileValidation.js)
 * is still the real gatekeeper and re-checks every one of these
 * independently (a client can be modified or skipped) — this module
 * exists only so the two share one definition of "what's accepted" in
 * spirit, not so the client can be trusted instead of the server.
 */

/** @const {RegExp} Matches a supported filename, case-insensitive. */
const SUPPORTED_EXTENSION = /\.(txt|pdf)$/i;

/**
 * @const {number} Max characters for a `.txt` file — mirrors
 *     server/src/validation/fileValidation.js's MAX_TEXT_LENGTH.
 */
export const MAX_TEXT_LENGTH = 20000;

/**
 * @const {number} Max raw upload bytes for either file type — mirrors
 *     server/src/validation/fileValidation.js's MAX_UPLOAD_BYTES.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** @const {string} The byte sequence every real PDF file starts with. */
const PDF_HEADER = '%PDF-';

/**
 * @param {string} fileName
 * @return {boolean} Whether the file's name looks like a supported type.
 */
export function isAllowedFileName(fileName) {
  return SUPPORTED_EXTENSION.test(fileName || '');
}

/**
 * @param {number} bytes
 * @return {string} A short human-readable size, e.g. "8.0 MB".
 */
function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Synchronous size check, cheap enough to run before any async read.
 * @param {!File} file
 * @return {?string} A user-facing error message, or `null` if the file's
 *     raw size is within bounds (its *content* may still fail a later,
 *     type-specific check).
 */
export function validateFileSize(file) {
  if (file.size === 0) {
    return 'File is empty.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${formatBytes(file.size)}). The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

/**
 * Reads and counts a `.txt` file's characters — the real limit is on
 * character count, not bytes (a UTF-8 character can be several bytes),
 * so `validateFileSize` alone can't catch every oversized text file.
 * @param {!File} file A `.txt` file that already passed `validateFileSize`.
 * @return {!Promise<?string>} A user-facing error message, or `null`.
 */
export async function validateTextLength(file) {
  const text = await file.text();
  if (text.trim().length === 0) {
    return 'File is empty.';
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return `File is too long (${text.length} characters). The limit is ${MAX_TEXT_LENGTH} characters.`;
  }
  return null;
}

/**
 * Checks a `.pdf` file actually starts with a PDF header, the same way
 * the server does — catches a mislabeled or corrupt file before upload.
 * @param {!File} file A `.pdf` file that already passed `validateFileSize`.
 * @return {!Promise<?string>} A user-facing error message, or `null`.
 */
export async function validatePdfHeader(file) {
  const head = await file.slice(0, 1024).text();
  if (!head.includes(PDF_HEADER)) {
    return 'The uploaded .pdf file does not contain a valid PDF header.';
  }
  return null;
}

/**
 * Runs every client-side check relevant to `file`, stopping at the first
 * failure (cheapest checks first: name, then size, then content).
 * @param {!File} file
 * @return {!Promise<?string>} The first applicable error message, or
 *     `null` if the file passes every check this module knows about.
 */
export async function validateFile(file) {
  if (!isAllowedFileName(file.name)) {
    return 'Only .txt and .pdf files are supported right now.';
  }
  const sizeError = validateFileSize(file);
  if (sizeError) return sizeError;

  if (/\.txt$/i.test(file.name)) return validateTextLength(file);
  if (/\.pdf$/i.test(file.name)) return validatePdfHeader(file);
  return null;
}
