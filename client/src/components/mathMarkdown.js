/**
 * @fileoverview Normalizes common model-produced LaTeX delimiters before
 * remark-math parses them. Kept separate from the React component so Fast
 * Refresh sees a component-only module.
 */

/**
 * Converts common model-produced LaTeX delimiters into remark-math syntax.
 * @param {string} text Untrusted message text returned by the model or student.
 * @return {string} Markdown whose inline/block mathematics can be parsed.
 */
export function normalizeMathDelimiters(text) {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `\n$$\n${math.trim()}\n$$\n`)
    .replace(/\\\((.*?)\\\)/g, (_match, math) => `$${math}$`);
}
