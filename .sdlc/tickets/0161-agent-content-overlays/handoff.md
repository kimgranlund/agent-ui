---
id: T-0161
title: "Agent content overlays: user edits as diffs over seeds, 3-way merge on seed update, one write path per kind"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0160]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
branch: feat/0161-agent-content-overlays
worktree: ../agent-ui.worktrees/wave-w161
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A user's edits to a seeded agent survive seed updates: edits are stored as a diff keyed by `id@baseVersion`, every surface reads seed plus overlay, and a seed bump merges instead of wiping.

## Intent
- Do:
  - Overlay record per agent and per entry: field-level ops against the T-0160 schema, with base version and digest, persisted through `StorageAdapter` (localStorage, IndexedDB for large text as today).
  - One `resolve(seed, overlay)` used by every reader (admin, Test Chat, Builder).
  - Seed update: 3-way merge per field (base, new seed, user). Non-conflicting fields merge silently; a conflict keeps the user value and flags the field "seed changed" with both values.
  - Migrate existing persisted state once: diff current stored values against the seed at their stored `seedVersion` to build the overlay, then drop the full copy. Retire the wipe in `personaStore` / `resetPersona` on bump.
  - Reset per field and per agent; "modified" state per field for T-0162.
  - Teams: one write path (the Teams pane and the Builder's `handleTeamDeclared` both go through the `teamsResource` mutations); give `teamsResource` a live leg.
  - Imports and duplicates stay full records (source `imported` / `duplicate`), overlays apply to seeds only.
- Non-goals: form UI (T-0162), compiler (T-0163), cloud sync.
- Done when: `npm run check` exit 0; tests for merge (no conflict, conflict, field deleted upstream), one-time migration from today's stored shape, reset, and a seed bump that keeps a user edit; teams single-path test; `site/pages/agent-admin-*.test.ts`, `packages/agent-ui/app/src/controls/agent-admin`, `packages/agent-ui/data` tests exit 0; `npm run e2e:admin` exit 0.

## Context
- Today: an edit overrides the seed in place; `seedVersion` bump runs `resetPersona` and wipes all user edits (Quizmaster and Croupier comments in presets.ts). Teams have two write paths (`agent-team-pane.ts` direct `saveAgentTeam`, Builder via `saveTeamMutation`).

## Constraints
- ADR-0227 state grammar (one signal-backed owner, explicit injection, `StorageAdapter`). Zero dependencies. No em dashes.
