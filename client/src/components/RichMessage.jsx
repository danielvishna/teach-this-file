/**
 * @fileoverview Safely renders tutor/student message text as Markdown with
 * KaTeX mathematics. Raw HTML remains disabled by ReactMarkdown so streamed
 * model output cannot inject executable markup into the lesson UI.
 */
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { normalizeMathDelimiters } from './mathMarkdown.js';

/**
 * Renders untrusted chat text without enabling raw HTML.
 * @param {{text: string}} props Component properties.
 * @param {string} props.text Markdown and optional LaTeX message content.
 * @return {!React.ReactElement} Safe formatted message content.
 */
export default function RichMessage({ text }) {
  return (
    <div className="rich-message">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {normalizeMathDelimiters(text)}
      </ReactMarkdown>
    </div>
  );
}
