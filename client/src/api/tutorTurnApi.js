/**
 * @fileoverview Client-side wrapper for POST /api/tutor-turn. Reads the
 * JSONL response stream and invokes callbacks per line. Owns the fetch/
 * stream-reading, kept separate from UI components per CLAUDE.md's
 * Architecture rule.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * @param {{
 *   apiKey: string,
 *   teacherPrompt: string,
 *   subject: string,
 *   targetAudience: string,
 *   language: string,
 *   step: {title: string, objective: string, sourceExcerpt: string},
 *   history: !Array<{role: string, text: string}>,
 *   studentMessage: (string|undefined),
 *   stepNumber: number,
 *   previousStepTitle: (string|undefined),
 *   signal: !AbortSignal,
 *   onChunk: function(string): void,
 *   onVerdict: function(boolean): void,
 * }} input
 * @return {!Promise<void>} Resolves once the stream ends normally.
 * @throws {Error} With a user-facing message if the request fails before
 *     any output (mirrors the server's 400/502 JSON error shape), or an
 *     `AbortError` if `signal` was aborted (the caller's Stop button).
 */
export async function streamTutorTurn({
  apiKey,
  teacherPrompt,
  subject,
  targetAudience,
  language,
  step,
  history,
  studentMessage,
  stepNumber,
  previousStepTitle,
  signal,
  onChunk,
  onVerdict,
}) {
  const res = await fetch(`${API_BASE_URL}/api/tutor-turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      teacherPrompt,
      subject,
      targetAudience,
      language,
      step,
      history,
      studentMessage,
      stepNumber,
      previousStepTitle,
    }),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line) continue;
      const parsed = JSON.parse(line);
      if (parsed.type === 'chunk') onChunk(parsed.text);
      else if (parsed.type === 'verdict') onVerdict(parsed.stepCompleted);
    }
  }
}
