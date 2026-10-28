---
id: T-0500
title: "chat:probe fails a turn whose page renderer rejects the payload (VALIDATION_FAILED), not just the server check"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
`npm run chat:probe` (live or replayed) fails a turn when the page's A2UI renderer rejects the payload and fires a client turn with `inputError: VALIDATION_FAILED`, instead of counting that turn ok because the server-side check passed.

## Intent
- Do: add a named probe check (beside no-halt, no-A2UI-JSON-as-prose, no-surface-loss) that reds a turn whose page fires a VALIDATION_FAILED client turn; keep the existing `{"page":"VALIDATION_FAILED"}` page-step rows working; prove it with a failing-first test and keep `selftest` green.
- Non-goals: changing the renderer, the validator or the producer; any paid run.
- Done when: a replay whose page rejects the payload exits nonzero with the new check named; the existing replays under `scripts/e2e-admin/probe/replays/` still pass; `npm run check` and the probe tests (`npx vitest run scripts/e2e-admin/probe` plus `node scripts/chat-probe.mjs selftest`) exit 0.

## Context
Found during T-0498 (round 16 cluster M): before that fix the browser renderer rejected a batch that moved a child under a new parent, yet the probe counted the turn ok; only `tree.test.ts` carried the renderer red. Probe code: `scripts/e2e-admin/probe/` (`run.ts`, `signals.ts`, `trace.ts`, `selftest.ts`; `selftest.ts:195-200` already models page-fired VALIDATION_FAILED rows). Commands reference: `.claude/docs/references/commands.md`.

## Acceptance criteria
verifier: L3
- (red) `node --experimental-strip-types --input-type=module -e "import { runChecks } from './scripts/e2e-admin/probe/model.ts'; const r = runChecks([{ index: 0, step: { say: 'hi' }, lines: [], roundsSource: 'none', proseText: '' }, { index: 1, step: { page: 'VALIDATION_FAILED' }, lines: [], roundsSource: 'none', proseText: '' }], { expectComponents: [] }); process.exit(r.some((c) => c.check === 'no-renderer-rejection' && c.status === 'fail' && c.turn === 0) ? 0 : 1)"` exits 0: a turn followed by a page-fired VALIDATION_FAILED row fails the named check `no-renderer-rejection` on the rejected turn.
- `node scripts/chat-probe.mjs selftest` exits 0: it asserts the fixture `scripts/e2e-admin/probe/fixtures/seeded-page-rejection.json` replays offline red on exactly `no-renderer-rejection`, and that the existing page-row case still judges the page row like a turn.
- `npx vitest run scripts/e2e-admin/probe` exits 0: the probe tests and the existing replays under `replays/` stay green (the probe `*.test.mjs` files import vitest, so node --test cannot run them).
- `npm run check` exits 0.

## Constraints
Keyless only, no paid runs. The selftest rides `check:scripts` and must stay green. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Plan review
- conductor: the Done when probe-test command was a plan defect (every probe *.test.mjs imports vitest, so `node --test` fails on base too); corrected to `npx vitest run scripts/e2e-admin/probe`, which the solo ran green.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 993df87857a2
- Changed: chat:probe gains the no-renderer-rejection check, so a page-fired VALIDATION_FAILED turn fails the probe
- Commits: none
- Check: 1 (red) runChecks with a turn followed by a page-fired VALIDATION_FAILED row fails `no-renderer-rej...: pass
- Check: 2 `node scripts/chat-probe.mjs selftest` exits 0: pass
- Check: 3 `npx vitest run scripts/e2e-admin/probe` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: scripts/e2e-admin/probe/model.ts: the check emits skip for every... -> notes.md
