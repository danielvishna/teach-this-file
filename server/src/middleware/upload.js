/**
 * @fileoverview Shared multer configuration for file uploads. In-memory
 * storage — the file is read once, validated by validation/
 * fileValidation.js, and discarded, so there's no need to persist it to
 * disk. The byte cap here is a cheap, early rejection; the real
 * character-count limit for v1's .txt files is enforced in
 * fileValidation.js, which is the authority on content, not size alone.
 */
import multer from 'multer';

/**
 * @const {number} Byte cap for the raw upload, generously above
 *     fileValidation.js's MAX_TEXT_LENGTH characters (UTF-8 bytes per
 *     character can exceed 1) so a valid file is never rejected on byte
 *     count before the character-count check gets a chance to run.
 */
const MAX_UPLOAD_BYTES = 500 * 1024;

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

/**
 * Express middleware that runs multer for a single file field and turns
 * any multer error (e.g. the byte cap above) into a client-facing 400
 * JSON response, instead of letting it propagate as an unhandled 500 —
 * multer's own errors don't go through a route's try/catch since they
 * happen in multer's own middleware, before the route handler runs.
 * @param {string} fieldName
 * @return {!Function} Express middleware `(req, res, next)`.
 */
export function uploadSingleFile(fieldName) {
  const middleware = multerInstance.single(fieldName);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: `Upload failed: ${err.message}` });
      }
      next();
    });
  };
}
