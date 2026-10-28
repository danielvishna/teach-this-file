# Decisions

<!-- TODO: fill in as the project develops — see .claude/skills/write-decisions/SKILL.md -->

## Main choices made, and why

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

## What was decided not to do, and why

- **File types beyond `.txt` for v1** (PDF, scanned pages, images-in-file) — out of scope unless
  time remains at the end; the brief's "build for the unexpected" files still need a clear
  rejection error for unsupported types, not silent failure.
- **Code-side text chunking and a per-subject/per-age prompt-snippet library** — considered
  (option B in the design doc above) and deliberately not the default: more dev time for a
  4-hour build, for a predictability benefit we don't yet know we need. Kept as the documented
  fallback.

## Known weaknesses

<!-- TODO -->

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
