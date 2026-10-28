/**
 * @fileoverview Setup screen: teacher uploads a .txt or .pdf file, writes a
 * prompt, and enters a Gemini API key. Presentational + dispatches
 * reducer actions only — the actual request lives in api/planApi.js
 * (CLAUDE.md's Architecture rule: no AI/validation logic inline here).
 */
import { useState } from 'react';
import { fetchLessonPlan } from '../api/planApi.js';
import { useLesson } from '../state/LessonContext.jsx';
import { isAllowedFileName } from '../validation/fileRules.js';

/**
 * @param {{apiKey: string, onApiKeyChange: function(string): void}} props
 *     `apiKey` is lifted to App.jsx (not the shared reducer — CLAUDE.md's
 *     Architecture rule: the key never enters app state that could be
 *     logged or inspected).
 */
export function SetupScreen({ apiKey, onApiKeyChange }) {
  const { dispatch } = useLesson();
  const [file, setFile] = useState(null);
  const [teacherPrompt, setTeacherPrompt] = useState('');
  const [fileError, setFileError] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const canSubmit = Boolean(apiKey && file && teacherPrompt.trim());

  /**
   * Applies the same client-side file rule to picker and drag-and-drop input.
   * @param {?File} selected Browser file selected by either interaction.
   * @return {void}
   */
  function selectFile(selected) {
    if (selected && !isAllowedFileName(selected.name)) {
      setFileError('Only .txt and .pdf files are supported right now.');
      setFile(null);
      return;
    }
    setFileError('');
    setFile(selected);
  }

  /** @param {!Event} event */
  function handleFileChange(event) {
    selectFile(event.target.files[0] ?? null);
  }

  /** @param {!React.DragEvent} event */
  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingFile(true);
  }

  /** @param {!React.DragEvent} event */
  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingFile(false);
  }

  /** @param {!React.DragEvent} event */
  function handleFileDrop(event) {
    event.preventDefault();
    setIsDraggingFile(false);
    selectFile(event.dataTransfer.files[0] ?? null);
  }

  /** @param {!Event} event */
  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    dispatch({ type: 'SET_FILE', fileName: file.name });
    dispatch({ type: 'SET_TEACHER_PROMPT', prompt: teacherPrompt });
    dispatch({ type: 'PLANNING_STARTED' });

    try {
      const lessonPlan = await fetchLessonPlan({ apiKey, file, teacherPrompt });
      dispatch({ type: 'PLANNING_SUCCEEDED', lessonPlan });
    } catch (err) {
      dispatch({ type: 'PLANNING_FAILED', message: err.message, retryable: true });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 overflow-x-hidden p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Teach this file</h1>
      <p className="text-sm text-gray-500">
        Upload a text or PDF file and tell the AI how to teach it.
      </p>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Gemini API key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="Paste your key — never stored"
          className="min-h-11 rounded border border-gray-300 px-3 py-2 text-base font-normal"
        />
      </label>

      <label
        className="flex flex-col gap-1 text-sm font-medium"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
        data-testid="file-drop-zone"
      >
        File (.txt or .pdf)
        <span
          className={`flex min-h-20 items-center justify-center gap-3 rounded border-2 border-dashed px-3 py-4 transition-colors ${
            isDraggingFile ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
          }`}
        >
          <span className="shrink-0 rounded bg-indigo-50 px-3 py-1 font-normal text-indigo-700">
            Choose file
          </span>
          <span className="truncate font-normal text-gray-600">
            {file ? file.name : 'or drag and drop a file here'}
          </span>
        </span>
        <input
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          onChange={handleFileChange}
          className="sr-only"
        />
      </label>
      {fileError && (
        <p role="alert" className="text-sm text-red-600">
          {fileError}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Teacher prompt
        <textarea
          value={teacherPrompt}
          onChange={(e) => setTeacherPrompt(e.target.value)}
          rows={4}
          placeholder='e.g. "Teach this to 7th graders, in French, Socratic style, under 15 minutes."'
          className="rounded border border-gray-300 px-3 py-2 text-base font-normal"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-11 rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
      >
        Build lesson
      </button>
    </form>
  );
}
