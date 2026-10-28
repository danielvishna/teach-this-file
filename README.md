# Teach This File

A teacher uploads a file and writes a prompt; the app opens a chat in which an AI teaches the
file's content to a student, following the teacher's prompt.

- **Live app**: https://teach-this-file.vercel.app
- **Live server**: https://teach-this-file.onrender.com (free tier — spins down after
  inactivity, first request after idle can take 30–60s)
- **AI provider**: Google Gemini (`gemini-flash-lite-latest`)

## Run locally

Requires Node.js 20+.

```bash
# server
cd server
cp .env.example .env   # optional: set GEMINI_API_KEY as a local fallback
npm install
npm run dev             # http://localhost:3001

# client (separate terminal)
cd client
npm install
npm run dev              # http://localhost:5173
```

The client proxies `/api/*` requests to the server during development (see
`client/vite.config.js`).

## Using the app

1. Open the app and paste a Gemini API key in the settings field (never stored server-side —
   sent with each request).
2. Upload a file and write a teacher prompt (audience, language, tone, time limit, etc.).
3. The AI builds a lesson plan from the file and opens a chat that teaches it step by step,
   following your prompt.

## Project structure

- `client/` — React + Vite + Tailwind front end.
- `server/` — Node.js + Express back end; AI logic, file ingestion and validation live in
  their own modules (see `CLAUDE.md`).

See [DECISIONS.md](DECISIONS.md) for the reasoning behind the main choices, known weaknesses,
and the AI-behavior test scenarios used to verify this works.
