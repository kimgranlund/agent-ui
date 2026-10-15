---
id: T-0192
title: "Support ANTHROPIC_WORKSPACE_ID: dev proxy, Worker, chat:probe and CI send anthropic-workspace-id so org-level keys work"
type: feature         # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim's new Anthropic key is org-level: the API answers 400 "This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header" unless the request carries `anthropic-workspace-id`. Kim chose to support a workspace id rather than a scoped key (2026-10-14). With `ANTHROPIC_WORKSPACE_ID` set, every server-side Anthropic call we make sends the header.

## Intent
- Do:
  1. Provider (`packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` and wherever request headers are built): accept an optional workspace id and send `anthropic-workspace-id` when present. Hosts read `ANTHROPIC_WORKSPACE_ID` server-side only: the dev proxy (`packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`, Vite `loadEnv`), the Cloudflare Worker (its env binding; document the `wrangler secret` or var name), and anything else that calls the API with the key (eval tools, recorders: grep for `x-api-key`).
  2. Never log or trace the id or the key; the trace log may record a boolean `workspaceHeader: true`.
  3. CI: `.github/workflows/claude-code-review.yml` sets `ANTHROPIC_CUSTOM_HEADERS: "anthropic-workspace-id: ${{ secrets.ANTHROPIC_WORKSPACE_ID }}"` (Claude Code reads that env var) on the review step, only when the secret exists; keep `show_full_output: true` until a review passes, then remove it in a follow-up commit.
  4. Docs: CLAUDE.md Commands or the dev-proxy README line on keys; `.env` example if one exists.
- Done when: `npm run check` exit 0; a unit test that the request carries the header when configured and omits it when not; the live-agent and tools/agent tests exit 0; `npm run e2e:admin` exit 0; a live `npm run chat:probe -- --agent concierge --model claude-haiku-5-5 --say hello` passes with the org-level key plus `ANTHROPIC_WORKSPACE_ID` in `.env` (conductor runs it).

## Context
- Workspace id (not a secret, Kim gave it): `wrkspc_01TrDcaCZc2exjpSANR3bEAC`. Verified 2026-10-14: the org-level key returns 200 with the header, 400 without. Trust boundary: keys server-side only (ADR-0073). Commit off origin/main, never push.

## Constraints
- Never print keys. No em dashes.

## Closed

2026-10-14: merged as PR #1983
