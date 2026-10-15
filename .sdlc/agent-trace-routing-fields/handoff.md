---
id: T-0239
title: "Agent traces record per-turn routing (sections, mini-skills, referenced content) and context-fog-of-war can read them"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Each producer trace line records how context was routed for the turn, and the context-fog-of-war skill hydrates these traces into its atlas, so routing failures are inspectable without hand analysis.

## Scope
1. Trace fields (agent-ui): add to the trace block the selected mini-skill ids, the system prompt section names with char counts (stable vs volatile, the cache breakpoint), the referenced resources, skills and playbooks with load mode (full or index-only), and the persona catalog and domain. Redacted as today; no key or user secret. Overlaps T-0163's resolution trace: build the fields here, T-0163 reuses them.
2. Adapter, in this repo as `scripts/agent-traces-to-fog.py` (stdlib Python 3.9+; do NOT edit Kim's skill at ~/.claude/skills/context-fog-of-war, whose author maintains it): it maps one .agent-traces JSONL into the v2 session.json (each turn an event; sections, exemplars, mini-skills and referenced content as sources with exposure 'included'; retries and failure codes as findings evidence), following that skill's references/hydration.md and session.schema.json (read them, do not change them). Validate the output with that skill's `fog.py validate`; publishing with `library.py publish` is the conductor's.

## Evidence
Round 2 analysis (2026-10-15): the traces hold exemplarIds and promptChars only, so mini-skill routing and index-only loading (T-0231) could not be seen; the fog-of-war adapter is Codex-only and could not read them.

## Done when
- A trace test asserts the new fields for a croupier turn and a concierge turn.
- The adapter hydrates one round 2 trace file; fog.py validate exits 0; the published report shows per-turn sources.
- npm run check plus touched tests exit 0.

## Acceptance criteria
- The croupier and concierge routing tests pass: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/agent-trace.test.ts packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts packages/agent-ui/a2ui/src/live-agent/a2ui-surface-toggle.test.ts`
- The adapter selftest passes: `python3 scripts/agent-traces-to-fog.py selftest`
- The round 2 trace hydrates: `python3 scripts/agent-traces-to-fog.py /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/live-round-2/traces/2026-10-15.jsonl --out /tmp/t0239-fog/session.json` (the main checkout's round 2 copy; after T-0241 merges the same file is `.sdlc/evals/rounds/2026-10-15-r2-presets/traces/2026-10-15.jsonl`, and either path is accepted)
- The skill validates it: `python3 /Users/kimgranlund/.claude/skills/context-fog-of-war/scripts/fog.py validate /tmp/t0239-fog/session.json`
- The skill renders it: `python3 /Users/kimgranlund/.claude/skills/context-fog-of-war/scripts/fog.py render --data /tmp/t0239-fog/session.json --out /tmp/t0239-fog/report.html`
- The standing gate: `npm run check`
