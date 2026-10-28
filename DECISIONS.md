# Decisions

<!-- TODO: fill in as the project develops — see .claude/skills/write-decisions/SKILL.md -->

## Main choices made, and why

- **`zod` for schema validation** (`server/src/validation/lessonPlanSchema.js`): the lesson
  plan's shape plus the grounding check (every step's `sourceExcerpt` is a real substring of the
  file) both run through it. Lightweight, a near-standard choice for this kind of runtime
  validation, avoids hand-rolling the shape checks ourselves.
- **Vitest for unit tests (client + server), with the AI provider always mocked.** Chosen over
  Jest for native ESM/Vite integration (no transform config needed) and one consistent test
  runner across both packages. Unit tests never call the real Gemini API — that's slow, flaky,
  costs money, and tests the model's judgment rather than our code's logic. Real AI-behavior
  verification is a separate, explicit activity (see the test scenarios below and
  `.claude/agents/ai-behavior-tester.md`), not something a unit-test suite should also try to do.
- **OpenAPI spec as a plain JS object (`server/src/openapi.js`) + `swagger-ui-express`**, not a
  `.yaml` file with a parser dependency, and not generated from Zod schemas. It lives next to the
  routes it documents, which makes it easy to notice when it drifts — at the cost of nothing
  enforcing that it stays accurate except doing so in the same commit as a route change.
- **GitHub Actions CI** (lint + unit tests, both packages, every push) — catches a broken build
  or a regressed test before it's noticed manually, cheap to set up for a two-package repo.
- **One AI call for the lesson plan, one adaptive master prompt for teaching style** (not
  code-side chunking, not a per-subject/per-age prompt-snippet library) — deliberately leans on
  the model to do more of the work the code would otherwise have to do by hand, which matters in
  a 4-hour build. Full reasoning and the rejected alternative (option B, a snippet library) are
  in [this design doc](https://claude.ai/artifact/6im8fsyH3kFhkgPR8W1Skd); option B stays the
  documented fallback if testing shows the single prompt getting tone/level wrong.
- **`stepCompleted` comes from a second, fast structured-output call after the streamed reply
  finishes**, not parsed out of the streamed text itself (e.g. a trailing delimiter) and not a
  Gemini tool-use call. Simplest to implement and reason about, at the cost of one extra
  non-streaming call's latency per turn — acceptable under "let AI do more, fix it if it becomes
  a real problem" rather than over-engineering a single-call solution up front.
- **The lesson plan also carries `subject` and `targetAudience`**, inferred by the same planning
  call, not just the step list — both feed the master prompt's tone/level and are worth keeping
  as explicit state (not re-derived per turn).
- **One `fetch`/one HTTP request for a tutor turn, server-side JSONL stream** ending in a
  trailing `{"type":"verdict",...}` line, rather than a second client-initiated request after
  the streamed reply finishes. Keeps the client to one stream-reader loop and makes Stop trivial
  (cancel the one request, nothing to coordinate across two).
- **`multer` from the start**, even though v1 only accepts `.txt` — avoids re-architecting the
  upload path when binary file types (images, PDF) are added later.
- **20,000-character limit on v1 text files** — generous for real school material (a long
  article/short chapter) while keeping the single planning call fast and cheap; not a context-
  window constraint (gemini-flash-lite's window is far larger).
- **The turn that opens a step (no student reply yet) skips the verdict call entirely** and
  hardcodes `stepCompleted: false`, instead of calling the model and trusting it to judge "no
  evidence yet" as false. A step logically cannot be complete before the student has said
  anything, so this is a structural guarantee rather than relying on the model to get an edge
  case right every time — found via manual UI testing, where a step would occasionally complete
  itself on the turn that merely opened it. Also saves a Gemini call on every step-opening turn.
- **A step-opening tutor-turn request carries `stepNumber` and (for step 2+) `previousStepTitle`**,
  so the prompt can tell the lesson's first step apart from a later one. Without it, every step
  opened with the same "Hello! Welcome!" framing — fine for step 1, but step 2+ read as the lesson
  restarting rather than continuing, since the student had no reason to expect a fresh greeting
  mid-conversation (found via live testing — investigated at length, including cross-referencing
  server logs across several real sessions, before concluding it was a prompt-framing gap and not
  a duplicate request or a client state bug). Chosen over resending the full prior-step history on
  an opening turn (more tokens, slower, and unnecessary — a one-line "you just finished X" fact is
  enough for a natural transition, the actual content of step X isn't needed to open step X+1).

## What was decided not to do, and why

- **File types beyond `.txt` for v1** — out of scope unless time remains at the end; the brief's
  "build for the unexpected" files still need a clear rejection error for unsupported types, not
  silent failure. Priority order if time remains: images, PDF, presentations (PPT/PPTX).
- **Code-side text chunking and a per-subject/per-age prompt-snippet library** — considered
  (option B in the design doc above) and deliberately not the default: more dev time for a
  4-hour build, for a predictability benefit we don't yet know we need. Kept as the documented
  fallback.

## Known weaknesses

- **Oversized-file feedback is server-only, not instant.** The `.txt`-only check gives immediate
  inline feedback on file select; the 20,000-character limit is only checked after a full upload
  round-trip to the server (confirmed via `ui-functional-tester`). A client-side character count
  before upload would close this gap — deferred, not urgent enough to do now.

## What I'd do with 4 more hours

<!-- TODO -->

## How I know it works: test scenarios

<!-- TODO: ~5 scenarios, each with what was sent, what came back, and whether it matched the
expected behavior. See .claude/agents/ai-behavior-tester.md for the scenario list to run. -->

| # | Scenario | Expected | Observed |
|---|----------|----------|----------|
| 1 |          |          |          |
| 2 |          |          |          |
| 3 |          |          |          |
| 4 |          |          |          |
| 5 |          |          |          |
