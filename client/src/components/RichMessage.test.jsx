/** @fileoverview Rendering and injection-safety tests for RichMessage. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RichMessage from './RichMessage.jsx';
import { normalizeMathDelimiters } from './mathMarkdown.js';

describe('RichMessage', () => {
  it('renders model-style inline LaTeX with KaTeX', () => {
    const { container } = render(<RichMessage text={'Energy is \\(E_k = \\frac{1}{2}mv^2\\).'} />);

    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(container.querySelector('.katex-html')).toBeInTheDocument();
  });

  it('renders display math and ordinary Markdown', () => {
    const { container } = render(<RichMessage text={'**Result**\n\n\\[v(t)=v_0+at\\]'} />);

    expect(screen.getByText('Result').tagName).toBe('STRONG');
    expect(container.querySelector('.katex-display')).toBeInTheDocument();
  });

  it('does not interpret raw HTML from an untrusted message', () => {
    const { container } = render(<RichMessage text={'<img src=x onerror="alert(1)">'} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)">');
  });
});

describe('normalizeMathDelimiters', () => {
  it('leaves dollar-delimited math available to remark-math', () => {
    expect(normalizeMathDelimiters('$v^2$')).toBe('$v^2$');
  });
});
