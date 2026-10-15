---
id: T-0033
title: "Re-record the Croupier Haiku fixtures on claude-haiku-5-5 (2 turns, about 0.01 USD)"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
The Croupier recordings under `packages/agent-ui/a2ui/src/catalog/personas/croupier/__fixtures__/` (`haiku-blackjack-turn1.jsonl`, `haiku-blackjack-turn2-stand.jsonl`, `capture-meta.json`) were recorded on claude-haiku-4-5. Kim approved on 2026-10-07 re-recording them on claude-haiku-5-5: 2 turns, about 0.01 USD.

## Intent
- Do: copy the recorder scripts from /private/tmp/claude-501/recorders/ (record-croupier-turn.ts and record-croupier-turn2.ts) into scripts/ untracked, read the key ONLY through the repo helper those scripts already use (never print, log or commit it), record exactly the two turns once, update capture-meta.json (model id, date), refresh `recorded-replay.test.ts` expectations if the recorded findings differ and report what changed, keep the scripts untracked. No other paid call, no retries beyond one rerun on a transport error.
- Non-goals: persona behavior changes, other fixtures, committing the scripts or any key.
- Done when: `npm run check` and full `npm test` exit 0; capture-meta.json names claude-haiku-5-5; no em dashes.

## Context
Follow-up of T-0030 (#1851, Haiku 5.5). Provider code: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` (tool loop near lines 656-668, request body near 254-310) and `anthropic-request-body.test.ts`. Never hand-edit generated files. Judge gates by exit code. Check claims against the Haiku 5.5 migration guide (platform.claude.com/docs/en/models/haiku-5-5/migration-guide) rather than assuming.

## Constraints
Imports point inward only. Keys never enter devtools. No paid call unless the Do names it. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The new behavior is pinned by a keyless test that is red before and green after.
2. Gates in Done when are green; no em dashes; stale records repaired.

## Closed

2026-10-08: Merged in #1855
