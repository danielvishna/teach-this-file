/**
 * @fileoverview Top-level screen router: switches on the lesson state's
 * `phase` (see lessonReducer.js) to decide what to render. Holds the
 * Gemini API key as local state here — outside the shared reducer, per
 * CLAUDE.md's Architecture rule — and passes it down to whatever screen
 * needs it for a fetch call.
 */
import { useState } from 'react';
import { ErrorScreen } from './components/ErrorScreen.jsx';
import { PlanningScreen } from './components/PlanningScreen.jsx';
import { SetupScreen } from './components/SetupScreen.jsx';
import { LessonProvider, useLesson } from './state/LessonContext.jsx';

function AppContent() {
  const [apiKey, setApiKey] = useState('');
  const { state, dispatch } = useLesson();

  if (state.phase === 'setup') {
    return <SetupScreen apiKey={apiKey} onApiKeyChange={setApiKey} />;
  }

  if (state.phase === 'planning') {
    return <PlanningScreen />;
  }

  if (state.phase === 'error') {
    return <ErrorScreen error={state.error} onRetry={() => dispatch({ type: 'RESET' })} />;
  }

  // phase is 'lesson' or 'done' — the chat screen lands in a later step.
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">{state.lessonPlan?.title}</h1>
      <p className="text-sm text-gray-500">
        {state.lessonPlan?.steps.length} steps planned. Chat screen coming next.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <LessonProvider>
      <AppContent />
    </LessonProvider>
  );
}
