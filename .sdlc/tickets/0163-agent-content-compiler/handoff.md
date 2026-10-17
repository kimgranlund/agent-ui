---
id: T-0163
title: "One agent compiler for Test Chat, proxy, Worker and CLI, with a resolution trace and bundle digest in every turn trace"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0160, T-0161]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every place that runs an agent builds its prompt the same way, and every turn says exactly which content versions it ran with.

## Intent
- Do:
  - `compile(agentManifest, overlay) -> { bundle, digest, resolution[] }`: one pure function (resolution entries: id, kind, version, digest, source seed/pack/user/builder) used by Test Chat, the dev proxy, the Cloudflare Worker and the CLI (`agent-content.mjs compile`). Retire any parallel assembly paths.
  - Turn traces (`.agent-traces`, T-0151) and the admin debug zip record the bundle digest and resolution; `npm run traces` prints them. Also pass devtools captures into `buildDebugBundle` (today the slot is never filled).
  - Test Chat context view shows the resolution (which skill version, from where).
  - e2e:admin fixtures and agent-behavior eval legs can pin `agent@digest` and report a mismatch instead of silently drifting.
- Non-goals: memory, evals redesign, publishing.
- Done when: `npm run check` exit 0; a test that Test Chat, proxy and CLI produce the same digest for the same agent and overlay; trace line carries digest (unit test on the trace writer); debug zip contains captures; `packages/agent-ui/a2ui/src/live-agent`, `site/lib/admin-live-runner*`, `site/pages/agent-admin-*`, `packages/agent-ui/a2ui/tools/agent` tests exit 0; `npm run e2e:admin` exit 0.

- Also: `--affected` in `scripts/e2e-admin/probe/scenarios/plan.ts` once `compile()` digests exist (SPEC CL-R10), moved from T-0179 by the 2026-10-17 eval re-scope.

## Context
- Trust boundary: keys and `produce()` never enter devtools; the proxy sits at `/__a2ui/agent` (ADR-0073). Prompt equivalence baseline changes only through the `a2ui-prompt-authoring` flow.

## Constraints
- Zero dependencies; the compiler is environment-neutral (browser, Node, Worker). No em dashes.
