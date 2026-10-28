---
name: write-decisions
description: Draft or update DECISIONS.md for this assignment — main choices and why, what was skipped and why, known weaknesses, a 4-more-hours plan, and ~5 concrete AI-behavior test scenarios with expected vs. observed results. Use near the end of the project, or any time DECISIONS.md needs updating after a notable choice.
---

# Writing DECISIONS.md

This project is judged partly on "decisions": clear tradeoffs, appropriate scope, and honest
documentation. `DECISIONS.md` already has a skeleton with 5 headings — fill it in, don't
restructure it.

## How to fill each section

1. **Main technical choices and why.** Walk the actual repo/git history (`git log --oneline`,
   the diff of the AI-calling module, the reducer) rather than relying on memory. For each
   notable choice (AI provider, state management, file-ingestion approach, streaming protocol,
   structured output validation, hosting split), state the choice and the concrete reason — a
   constraint, a tradeoff, or something you tested, not a generic justification.

2. **Features intentionally left out, and why.** Compare what's built against the brief's "must
   have" list. Call out anything deliberately cut for time, and why it was the right cut.

3. **Known weaknesses or unfinished edge cases.** Be concrete and specific — "PDFs over N pages
   aren't chunked, so very long files may exceed the context" beats "performance could be
   better". Ask the user if unsure what's actually unfinished rather than guessing.

4. **What you'd improve with four more hours.** A short, realistic list — not a wishlist.
   Prioritize what the judging criteria (approach to education, architecture, UX) would most
   reward.

5. **Test scenarios (~5).** Cover: the tutor teaching step-by-step instead of summarizing, a
   wrong-answer response being handled well, adherence to the teacher's prompt constraints, an
   embedded-instruction/prompt-injection attempt in the uploaded file, and an unexpected-content
   case (RTL text, scanned/garbled file, or very long document). For each, either run it against
   the live app yourself (bash/curl, or ask the user to run it and report back) or ask the user
   what they observed — never write "it looked fine" or invent a result you didn't verify.

## Process

Ask the user clarifying questions where the "why" behind a choice isn't obvious from the code —
this section is explicitly judged on being honest, not on sounding complete. Update the file in
place with Edit, keep the existing table format for test scenarios, and don't remove the TODO
markers for sections you don't have enough information to fill in yet.
