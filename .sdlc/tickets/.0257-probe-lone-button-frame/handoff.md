---
id: T-0257
title: "chat:probe browser selftest fails lone-button-frame on recorded-haiku-hello"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
`npm run chat:probe -- selftest --browser` exits 0: the `recorded-haiku-hello` replay no longer trips the `lone-button-frame` render-lint check, because either the rendered surface is fixed or the check's rule was wrong for this case.

## Repro
1. `npm run chat:probe -- selftest --browser` (keyless, needs Chromium).

## Actual
Exit 1 on `recorded-haiku-hello`: render-lint `lone-button-frame`. Seen by the T-0256 solo and verifier on 2026-10-15; the solo reports the same failure on the unmodified tree.

## Context
`lone-button-frame` is one of the dogfood render-lint rules chat:probe runs (T-0174, T-0168). Decide first whether the replay's surface really frames a lone button (a renderer or catalog issue) or the rule misfires on it (a lint issue). Guess, unverified: the hello surface is a Card holding a single Button.

## Constraints
The failing check lands before or with the fix. No allowlist line unless the finding is a deliberate design, with its reason.

## Done when
- `npm run chat:probe -- selftest --browser` exits 0.
- `npm run check` exits 0.

## Conductor note for the verifier
The fix hand-edits a recorded live fixture (`recorded-haiku-hello.json`) so the selftest goes green. Judge whether that keeps the fixture honest: the selftest is a keyless green-path check of the probe pipeline, but if Haiku really produces the framed-choice pattern, the edited fixture hides it. Acceptable only if the source field says it was hand-edited and the real failure stays covered somewhere (a negative fixture, or a ticket). Say which in your verdict.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged in #2024: browser selftest green; Haiku hello replay fixed; real output tracked in T-0258) · verifier: none · base: none
- Changed: see commits
- Commits: none
