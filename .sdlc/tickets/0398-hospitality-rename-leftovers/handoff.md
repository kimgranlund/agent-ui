---
id: T-0398
title: "Finish the T-0197 concierge-to-hospitality rename: probe routing expectations, spec and rubric references, seed-history row"
type: chore           # feature | bug | chore | spike | idea
status: claimed        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
No record still names the retired `concierge` domain or catalog where T-0197 renamed it to `hospitality`.

## Intent
- Do:
  1. `scripts/e2e-admin/probe/scenarios/routing.ts:39` and `round3.ts` to `round5.ts`: concierge routing expectations say `domains: ['concierge']` while a hospitality turn's trace now labels `agent: 'hospitality'`; update them to what the trace emits (read the trace labeling code to confirm).
  2. `.claude/docs/spec/a2ui-catalog-architecture.spec.md:68` ("a BookingForm for `agent-ui--concierge`"), `persona-catalog-composition.spec.md:163,459`, `.claude/docs/rubrics/a2ui-skill-pattern.md:38` and any other doc reference to the old domain or catalog id: repair to `hospitality` / `agent-ui--hospitality` where they describe current state (leave dated history lines as history).
  3. `site/agent-content/seed-history.ts:29`: add the concierge row for `a2uiLocalPatterns: 'concierge'` (seeded v5 to v19) so a pre-overlay store is not flagged as a user edit after the v20 move to `a2uiDomains`, with a test.
- Non-goals: the `hotel-booking-form` library skill text (model-read; a separate debate ticket); ADRs (frozen).
- Done when: `git grep -n "agent-ui--concierge\|domains: \['concierge'\]"` finds only dated history; the probe scenario selftest or typecheck, the seed-history tests, `npm run check` and the whole jsdom suite once exit 0.

## Acceptance criteria
- `! git grep -n "agent-ui--concierge\|domains: \['concierge'\]" -- ':!.sdlc' ':!packages/agent-ui/a2ui/src/agent/prompt-budget.ts' ':!.claude/docs/spec/persona-catalog-composition.spec.md'` exits 0 (the excluded hits are dated history: run records, dated budget measurements, Kim's quoted OF1b ruling, now annotated).
- `env -u NODE_OPTIONS npx vitest run scripts/e2e-admin/probe site/agent-content site/pages/agent-admin-presets.test.ts` exits 0 (probe expectations label `hospitality`, the round 3 to 10 archives stay byte-identical and match their generators through `asArchivedConciergeDomain`, the concierge v5 to v19 `a2uiLocalPatterns` row migrates an untouched value and flags any other).
- `env -u NODE_OPTIONS node --experimental-strip-types scripts/e2e-admin/probe/selftest.ts` exits 0.
- `env -u NODE_OPTIONS node scripts/generate-agent-content.mjs --check` exits 0.
- `npm run check` exits 0.

## Context
- Raised by the T-0197 verifier (2026-10-21), recorded in `.sdlc/notes/notes.md` under T-0197.
- Decided by the conductor under Kim's 2026-10-21 overnight goal.

## Constraints
- ADRs are frozen; no em dashes; never hand-edit generated files.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21
