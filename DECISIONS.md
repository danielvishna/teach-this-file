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

## What was decided not to do, and why

<!-- TODO -->

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
