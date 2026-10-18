---
id: T-0355
title: "Per-version seed field digests so a migration tells an untouched old seed value from a user edit"
type: feature        # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
When a browser holds persona edits saved under an older seed version, the migration replaces an untouched old seed value with the new seed and keeps only real user edits (flagged seedChanged).

## Intent
- Do: the agent content generator (`scripts/generate-agent-content.mjs`) emits, per persona, the field digests of every past seed version (from git history of the seed files or a committed history table); the overlay migration (`agent-overlay.ts` diffOverlay baseUnknown branch, `site/pages/agent-admin-presets.ts` migration) compares a stored value's digest with the stored version's seed digest: equal means untouched, so take the new seed; different means a user edit, kept and flagged.
- Non-goals: UI changes (T-0162 shipped Take seed).
- Done when: a test where a Quizmaster v1 store holds the v1 default `claude-haiku-4-5` migrates to the v2 model with no flag, while a v1 store with a user-chosen model keeps it flagged; the registry stays drift-gated; `npm run check` plus the agent-admin and agent-content tests exit 0.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
Kim's ruling 2026-10-17 (seed digests per version), after T-0161 shipped spec ACS-R7 (old values kept and flagged). The Quizmaster v2 comment in the seed shows Kim's intent to move users to the new default. The T-0161 solo listed this idea as undone.

## Constraints
Never wipe a real user edit. Registry and manifests stay generated (never hand-edit).
