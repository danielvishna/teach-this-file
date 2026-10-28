/**
 * @fileoverview Error state after a failed planning request. Purely
 * presentational — the retry action is just RESET, dispatched by the
 * caller.
 */

/**
 * @param {{error: {message: string, retryable: boolean}, onRetry: function(): void}} props
 */
export function ErrorScreen({ error, onRetry }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-4 text-center sm:p-6">
      <p className="text-lg font-medium text-red-600">Something went wrong</p>
      <p className="text-sm text-gray-600">{error?.message}</p>
      {error?.retryable && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded bg-indigo-600 px-3 py-2 text-white"
        >
          Try again
        </button>
      )}
    </div>
  );
}
