/**
 * @fileoverview Client-side wrapper for POST /api/plan. Kept separate
 * from UI components per CLAUDE.md's Architecture rule — components
 * dispatch reducer actions, this module owns the fetch/FormData shape.
 */

/**
 * Base URL for the Express server. In dev, Vite's proxy handles relative
 * `/api/*` requests; in production this points at the deployed server.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * @param {{apiKey: string, file: !File, teacherPrompt: string}} input
 * @return {!Promise<!Object>} The validated lesson plan returned by the
 *     server (see `lessonReducer.js`'s state shape, minus step `status`).
 * @throws {Error} With a user-facing message if the request fails.
 */
export async function fetchLessonPlan({ apiKey, file, teacherPrompt }) {
  const formData = new FormData();
  formData.append('apiKey', apiKey);
  formData.append('teacherPrompt', teacherPrompt);
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/plan`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data.lessonPlan;
}
