---
id: T-0591
title: "A messages string with one surplus closer is healed and named"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Round 21 cluster J closes: a `messages` string with one surplus closing brace is closed in place when the result parses, and the parse note names a surplus closer instead of a missing bracket.

## Intent
- Do: the response-type.ts change the row below proposes. Keyless tests that fail on base with false-positive guards, and `--from-trace` replays of the failing runs (copy the r21 traces to a temp `.agent-traces/` and remove them after). Any new or changed model-read text (repair asks, finding messages, parse notes) is named in the report for a Fable review. Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0; `node scripts/measure-size.mjs` stays within budget (report the a2ui/agent size).

## Context
Round 21 report (`.sdlc/evals/rounds/2026-10-29-r21-pattern/report.md`, PR 2394; until it merges, read it at `../agent-ui.worktrees/T-0589-wave-w0589/.sdlc/evals/rounds/2026-10-29-r21-pattern/`). Kim approved these fixes 2026-10-29.

| J. A `messages` string with one surplus `}` is resent byte for byte; the pinpoint does not name the surplus closer | 2: `smoke-stylist-palette-haiku-2` (:129), `reach-shopkeeper-cart-amount-haiku-2` (:139) | (c) model, with a (d) producer gap | :129 sends the same 2,398-character string in all three rounds; it breaks at character 565 on `]}}}},{"version"` (one `}` too many after the `updateDataModel`), and `messagesParseNote` only quotes the text there. :139 r2 and r3 send the same string; it has one `}` too many before `]` after the ConfirmReceipt's `backAction`, and the note wrongly says a `]` is missing. In both, dropping that one `}` parses (3 and 2 messages); `stringifiedMessages` returns undefined for both | (d) producer: extend T-0469's `closedInPlace` to drop one surplus closer at JSON.parse's break when the result parses as an array of messages, and have `messagesParseNote` name a surplus `}` instead of a missing `]` | `packages/agent-ui/a2ui/src/agent/response-type.ts` | `response-type.test.ts` cases with the :129 and :139 strings (both parse to their message counts, and a two-defect string still does not), plus a replay fixture of :129 that ships the palette | J1 |

## Constraints
No em dashes. No paid runs. Never rewrite a round archive. Never change grammar.md. Regenerate generated files with their scripts.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The new unit case and both replays pass, and fail with `response-type.ts` at base (checked by putting `git show HEAD:packages/agent-ui/a2ui/src/agent/response-type.ts` in place and restoring): `npx vitest run packages/agent-ui/a2ui/src/agent/response-type.test.ts scripts/e2e-admin/probe/replays/stylist-haiku-palette-string-surplus.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-cart-string-surplus.test.mjs`
- Two-defect, truncated and non-message strings stay undefined (cases in the same `response-type.test.ts` T-0591 test); the T-0469 missing-`]` case keeps its unclosed-array note.
- The a2ui suites and every probe replay pass: `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe`
- The standing gate passes: `npm run check`
- The a2ui/agent bundle stays within budget: `node scripts/measure-size.mjs`

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: be8f9dae80e4
- Changed: A messages string with one surplus closer is healed and named, closing round 21 cluster J
- Commits: none
- Check: 1 The new unit case and both replays pass, and fail with `response-type.ts` at base: pass
- Check: 2 Two-defect, truncated and non-message strings stay undefined; the T-0469 missing-`]` case keeps i...: pass
- Check: 3 The a2ui suites and every probe replay pass: pass
- Check: 4 The standing gate passes: pass
- Check: 5 The a2ui/agent bundle stays within budget: pass
- Follow-up: fix-now: .claude/docs/spec/response-type-selection.spec.md:20 still ends its... -> notes.md
- Follow-up: decide: .sdlc/tickets/0591-surplus-closer-parse-heal/handoff.md:30 note... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/agent sits at 88060 of 88832 B gz after... -> notes.md
- Follow-up: note: scripts/e2e-admin/probe/replays/stylist-haiku-palette-string-surplu... -> notes.md
