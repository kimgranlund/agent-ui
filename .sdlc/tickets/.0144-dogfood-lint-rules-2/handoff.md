---
id: T-0144
title: "Dogfood lint: promote the measurable review findings to rules, with a colour-contrast helper"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L3
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The five dogfood fix lanes (T-0138 to T-0142) proposed about 20 measurable rules they had no budget to add; the colour ones need a contrast helper the lint does not have. Kim 2026-10-13: rules first, then the dogfood review re-runs on the fixed main.

## Scope (one brief paragraph, per the Inner loop rule)
Read the rule lists in .sdlc/notes/notes.md (the lines starting 'Dogfood lint rules proposed by T-0138', 'T-0139', 'T-0142', and the T-0140 and T-0141 notes) and add each rule the render or compose lint can measure, each with a planted negative control and a clean twin per .claude/docs/references/dogfood-lint.md; skip any already present. Build a small colour-compositing helper (resolve each layer's computed colour and alpha down to an opaque pair, then the WCAG contrast ratio) with unit tests, and use it for the contrast rules: disabled ink below enabled, disabled edge at least 1.3:1, avatar disc at least 1.3:1, badge over an image opaque with at least 4.5:1. Leave out the field-border 3:1 rule; T-0143 adds the role and I will add that rule after it merges. Extend the render sweep to the persona catalog widgets (BookingForm, CardTable, QuestionCard, ContrastPair, BookingConfirmation) if the cost stays under about 30 seconds more. Files: scripts/dogfood-rules.json, scripts/dogfood-compose.mjs, site/pages/dogfood-render.browser.test.ts and its helpers, the two allowlists, .claude/docs/references/dogfood-lint.md. Any current violator a new rule finds is either fixed when it is a one-line fix inside a demo file, or allowlisted with a reason; report the count. Root n 5 / 6 / 7. Local gate, each in the foreground through gate_lock.py: npm run check, census, probe --strict, the touched folders' unit and browser tests, the render lint (site/pages/dogfood-render.browser.test.ts), then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each; delete any dogfood allowlist line your change clears. Before and after screenshots of each visible change at 400 and 1000, light and dark, in the ticket folder, viewed, not committed. One-line progress message to the conductor after each major step; never wait on a background monitor. Commit locally, do not push, no per-ticket verifier, no em dashes.

Note: the rule lists are in the main checkout's notes file, /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/notes/notes.md (read it there; your worktree's copy may be older), plus the full findings in /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/tickets/.0137-dogfood-design-review/part-{a,b,c}/ui-designer-L1.md.

## Acceptance criteria
- `npm run check` exits 0 (tsc, site and tools typecheck, check:scripts with the census and the compose gate).
- `node scripts/foundations-census.mjs --gate` exits 0.
- `node scripts/foundations-probe.mjs --strict` exits 0.
- `npx vitest run --project site` exits 0 (includes site/lib/dogfood-contrast.test.ts).
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0: every render rule has a plant that reports and a clean twin that passes, every rule measured an element in the full sweep, no unlisted finding, no stale allowlist entry.
- `npm run test:browser:site` exits 0.

## Closed

2026-10-13: merged as #1959
