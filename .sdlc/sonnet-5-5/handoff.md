---
id: T-0180
title: "Model update: claude-sonnet-5 becomes claude-sonnet-5-5 everywhere live, with a stored-setting migration"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "update sonnet-5 -> sonnet-5-5". Every live use of `claude-sonnet-5` (and its "Sonnet 5" label) moves to `claude-sonnet-5-5` ("Sonnet 5.5"); saved settings that name the old id migrate silently.

## Intent
- Do:
  1. Live config and code: the dev proxy and Worker provider table (`providers.json` or equivalent), `SUPPORTED_MODELS` and `sanitizeModel` / `sanitizeAuthoringModel` in `agent-admin-schema.ts` (and the Builder's Sonnet authoring default), `packages/agent-ui/a2ui/src/agent/produce.ts` defaults, `tools/agent-consumer-example`, the a2a arena runner, `.github/workflows/claude-code-review.yml` if it names the model, chat:probe and e2e-admin defaults, model labels in the UI ("Sonnet 5.5").
  2. Migration: a stored `claude-sonnet-5` (agent config, authoring model, any persisted model pick) resolves to `claude-sonnet-5-5`, through the existing sanitize path, with a test.
  3. Tests that assert the supported list or defaults update; tests that use the id only as an arbitrary string may switch for consistency.
  4. Docs that state the current default (CLAUDE.md, goals.md, live-agent references) update.
  5. Leave history alone: captured fixtures and corpus records and verdicts named for the model that produced them (`sonnet-blackjack-turn1.jsonl`, `capture-meta.json`, corpus-genui verdict files), frozen ADRs and frozen tickets.
  6. Confirm the id against the provider: one live call through the dev proxy with `claude-sonnet-5-5` (cheap, one short turn via `npm run chat:probe -- --model claude-sonnet-5-5 --say hello`); if the API rejects the id, stop and report rather than guess.
- Done when: `npm run check` exit 0; `packages/agent-ui/a2ui/src/live-agent`, `packages/agent-ui/app/src/controls/agent-admin`, `site/pages/agent-admin*` tests exit 0; `npm run e2e:admin` exit 0; the live probe on `claude-sonnet-5-5` passes; `git grep -n "claude-sonnet-5\b" -- ':!**/__fixtures__/**' ':!**/corpus-genui/**' ':!.claude/docs/adr/**' ':!.claude/docs/tickets/**'` lists only the migration alias and its test.

## Context
- Commit on `chore/sonnet-5-5` off origin/main, never push. Keys only through the dev proxy (ADR-0073); never print key values. Heavy tests via `gate_lock.py run`, foreground.

## Constraints
- No em dashes. Generated files only through their scripts.

## Closed

2026-10-14: merged (queue)
