/**
 * @fileoverview Client-side copy of the v1 file-type rule, for instant
 * UX feedback before upload. The server (server/src/validation/
 * fileValidation.js) is the real gatekeeper and re-checks this
 * independently — this module exists only so there's one definition of
 * "what's accepted" on the client side, instead of the check being
 * hand-written inline wherever a file input lives.
 */

/** @const {RegExp} Matches a supported filename, case-insensitive. */
const SUPPORTED_EXTENSION = /\.(txt|pdf)$/i;

/**
 * @param {string} fileName
 * @return {boolean} Whether the file's name looks like a supported type.
 */
export function isAllowedFileName(fileName) {
  return SUPPORTED_EXTENSION.test(fileName || '');
}
