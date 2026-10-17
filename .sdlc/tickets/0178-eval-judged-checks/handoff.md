---
id: T-0178
title: "Agent eval framework 3: judged checks with a pinned judge model, rubrics per persona, seeded known-bad transcripts"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0342]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Judged checks on committed round transcripts (re-scoped 2026-10-17).

## Intent
**C. Judged checks on round transcripts** (L2, P3, depends A; replaces T-0178's body)
- Goal: criteria no deterministic check can reach (persona voice, answered the question, asked before acting where no BOOKING_* check fires) become scored, calibrated signals.
- Do:
  1. Rubric documents per persona for croupier, concierge and lexicographer. Quizmaster only after B.
  2. An `eval:judge` CLI on the `corpus-genui/legs/judge.ts` pattern: rubric read verbatim, provider injected, the key read only in the CLI's keyed arm as `eval-agent-behavior.ts` does, never in devtools. Pinned model and temperature.
  3. It writes `runs/<name>/judge.json` with per-criterion scores and quoted evidence, and `signals.ts` reads it.
  4. Calibration sets are cited committed round runs, known-good passes and known-bad fails, not authored transcripts.
  5. Repair SPEC CL-R8.
- Done when:
  - `npm run check` exits 0.
  - A keyless stub-provider test asserts the `judge.json` shape and the threshold verdict.
  - `npm run eval:judge -- selftest` (live) scores every bad case under its threshold and every good case over, and reports a cost under $5.

## Context
Re-scope record .sdlc/runtime/tasks/0176-eval-scenarios-store/architect-L1.md.

## Constraints
Keys only in the CLI's keyed arm, never devtools.
