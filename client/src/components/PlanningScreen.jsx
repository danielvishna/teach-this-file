/**
 * @fileoverview Loading state while /api/plan is in flight. Purely
 * presentational.
 */
export function PlanningScreen() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-medium">Building your lesson plan…</p>
      <p className="text-sm text-gray-500">
        Reading the file and planning the steps. This can take a few seconds.
      </p>
    </div>
  );
}
