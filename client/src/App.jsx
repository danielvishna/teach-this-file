import { useState } from 'react'

/**
 * Temporary smoke-test screen: paste an API key, hit one hardcoded request
 * to the server, show the result. Verifies client/server/AI-provider wiring
 * end to end before any real feature is built, per the practice-run lessons.
 */
function App() {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState('')

  async function runSmokeTest() {
    setStatus('loading')
    setResult('')
    try {
      const res = await fetch('/api/smoke-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data.reply)
      setStatus('success')
    } catch (err) {
      setResult(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Deploy smoke test</h1>
      <p className="text-sm text-gray-500">
        Paste a Gemini API key and run one hardcoded request to confirm the
        client, server and AI provider are wired together correctly.
      </p>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Gemini API key"
        className="rounded border border-gray-300 px-3 py-2"
      />
      <button
        type="button"
        onClick={runSmokeTest}
        disabled={!apiKey || status === 'loading'}
        className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {status === 'loading' ? 'Running…' : 'Run smoke test'}
      </button>
      {result && (
        <pre
          className={`whitespace-pre-wrap rounded border p-3 text-sm ${
            status === 'error'
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          {result}
        </pre>
      )}
    </div>
  )
}

export default App
