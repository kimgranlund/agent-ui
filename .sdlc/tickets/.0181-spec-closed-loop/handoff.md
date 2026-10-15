---
id: T-0181
title: "SPEC: agent closed-loop testing (one scenario contract, check registry, trace to replay, signal row, replay vs live, cap, judge, baselines) + glossary"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The closed-loop testing system has a contract before T-0176..T-0179 build on it: new `.claude/docs/spec/agent-closed-loop.spec.md` (SPEC v0.1, status proposed; Kim flips status).

## Intent
- Do:
  1. Read first: `scripts/e2e-admin/README.md` (chat:probe checks), `packages/agent-ui/a2ui/tools/testkit/README.md`, `lld/genui-b3-judged-eval.lld.md` (its `floorMet` floor metric), `spec/response-type-selection.spec.md` (eval:agent-behavior AC pins), `spec/a2ui-live-agent.spec.md` eval note, `spec/devtools-harness.spec.md`, tickets T-0174 (done) and T-0176..T-0179, `.claude/skills/doc-standards/` for SPEC grammar, `docs/AGENTS.md`.
  2. Cover: one scenario contract that the four existing formats (testkit scenario, probe fixture, agent-eval fixture, e2e-admin fixture) map onto, and the T-0176 format; the check registry with code names (model-pick, no-halt, no-json-as-prose, no-surface-loss, expect-component, render-lint, reasoning) and severity; trace-to-replay rules; the `.agent-evals/runs.jsonl` row schema; `expectedFail: T-NNNN`; replay vs live and the CI rule (replay may gate, live never in CI); the $5 live cap (Kim 2026-10-14) and the key boundary (ADR-0073: keys and produce() never enter devtools); judged checks with a pinned judge and calibration sets; baselines and pass-rate floors reusing `floorMet`; digest-affected selection (depends on T-0163). Mark T-0176..T-0179 requirements as planned, shipped ones as shipped with code refs.
  3. Upsert `.claude/docs/references/agent-model.md` glossary: probe fixture, eval scenario, signal row, check; disambiguate from kit scenario and admin flow.
  4. Decisions cite tickets, never new ADR clauses (ADRs frozen, T-0164).
- Done when: doc_lint exit 0 on the new and touched docs; `npm run check` exit 0; if a sitemap or index is generated from SPECs, regenerate and its test exits 0.

## Context
- Spec audit 2026-10-14 (area 3 has no SPEC). Commit off origin/main, never push. Docs-only gate: doc_lint plus check.

## Constraints
- No em dashes. Status flips are Kim's.

## Acceptance criteria
- `python3 ~/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py .claude/docs/spec/agent-closed-loop.spec.md` exits 0.
- `python3 ~/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py .claude/docs/references/agent-model.md` exits 0.
- `npm run check` exits 0.
- `npx vitest run --project site site/lib/docs-grammar.test.ts` exits 0.
- `grep -c "CL-R10" .claude/docs/spec/agent-closed-loop.spec.md` exits 0 (the SPEC covers the ten areas, CL-R1 to CL-R10).
- `grep -n "probe fixture\|eval scenario\|signal row\|\*\*check\*\*" .claude/docs/references/agent-model.md` exits 0 (the four glossary entries).

## Closed

2026-10-14: merged as PR #1977
