/**
 * @fileoverview Unit tests for ErrorScreen.jsx — purely presentational.
 * Covers the retryable/non-retryable conditional that was previously
 * untested anywhere.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorScreen } from './ErrorScreen.jsx';

describe('ErrorScreen', () => {
  it('shows the error message', () => {
    render(<ErrorScreen error={{ message: 'File is too long', retryable: true }} onRetry={() => {}} />);
    expect(screen.getByText('File is too long')).toBeInTheDocument();
  });

  it('shows a retry button and calls onRetry when retryable', () => {
    const onRetry = vi.fn();
    render(<ErrorScreen error={{ message: 'oops', retryable: true }} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the retry button when not retryable', () => {
    render(<ErrorScreen error={{ message: 'oops', retryable: false }} onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});
