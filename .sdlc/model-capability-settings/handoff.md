---
id: T-0185
title: "Agent settings driven by a per-model capability table (effort, thinking, display, max tokens, cache TTL, server tools); drop dead temperature"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0172]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14 chose a capability-driven settings panel: each agent shows only the model settings its model accepts, and every shown setting reaches the API. Temperature is never sent today and the 5.5 models accept only 1.0, so the preset temperatures (0.2 to 0.9) are a dead control.

## Intent
- Do:
  1. A per-model capability table (extend `packages/agent-ui/a2ui/tools/agent/providers.json` or its schema): per model id, supported effort levels and default, thinking modes (adaptive, disabled, between_tools) with the effort levels each allows, thinking display options and default, max output tokens, sampling params accepted (temperature, top_p, top_k), forced tool_choice allowed, prompt cache TTLs, server tools available. Fill it for Haiku 5.5, Sonnet 5.5, Opus 5.5 from the Claude docs (effort, thinking, structured outputs, prompt caching pages); cite the URLs in a comment.
  2. Request building reads the table: send effort, thinking `{type, display}`, max_tokens, cache_control TTL, and only the sampling params the model accepts; reject or drop an unsupported combination before the call (e.g. thinking disabled with effort xhigh on Haiku 5.5).
  3. Settings pane: generate the model section from the table (pairs with T-0162's schema-generated forms if it has landed; otherwise a focused section in `agent-admin-schema.ts`): effort, thinking mode, show reasoning (display), max tokens, cache TTL, and server tool toggles (web search with max uses and domain lists, web fetch). Remove the temperature control and the preset temperature fields; a stored temperature is ignored (migration test).
  3b. Composer split (Kim 2026-10-14): the chat composer carries per-turn overrides only:
      - **Model.**
      - **Effort.** Its menu gains a "Thinking off" option, shown only where the model allows disabled thinking at that effort (Haiku 5.5).
      - **Show reasoning.** A toggle in the effort menu that sets display to summarized or omitted.
      - **Web search and web fetch.** Toggles in the Capabilities menu, shown only when the agent enables the server tool.
      Everything else lives only in agent settings: max tokens, cache TTL, between_tools, context editing, region, service tier, and the server tool details (domain lists, max uses, location). The composer starts from the agent's defaults. When effort changes mid-conversation, send the per-message `output_config` with the `mid-conversation-output-config-2026-07-01` beta header so the cache survives (the 5.5 models). Composer screenshot viewed.
  4. Preset configs carry only settings the table allows; a test asserts every preset's settings validate against its model's row.
- Done when: `npm run check` exit 0; a request-body test per model proves only accepted params are sent; the preset validation test passes; agent-admin and live-agent tests exit 0; `npm run e2e:admin` exit 0; one live probe per model (Haiku, Sonnet, Opus 5.5) passes with reasoning shown; screenshot of the new model settings section viewed; docs updated (agent-admin.md, the agent-content spec if T-0182 landed).

## Context
- API facts gathered 2026-10-14 (claude-code-guide, from platform.claude.com docs): on the 5.5 models temperature must be 1.0 and top_p / top_k are rejected; adaptive thinking is always on for Sonnet and Opus 5.5; display defaults to omitted on 5.x; forced tool_choice 400s on Sonnet and Opus 5.5; strict tools give schema-valid JSON. Commit off origin/main, never push.

## Constraints
- Zero dependencies. Keys server-side only. No em dashes.

## Live runs (added 2026-10-14)
- No key access in this lane: report the exact live probe commands; the conductor runs them.
- Note: since T-0192, an org-level key needs ANTHROPIC_WORKSPACE_ID; keep that header path working.

## Acceptance criteria
verifier: L3
- `npm run check` exits 0.
- Request body per model, only accepted params sent, thinking off at xhigh on Haiku 5.5 dropped: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/model-capabilities.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-request-body.test.ts` exits 0.
- Preset validation, temperature gone from presets and the Agent schema page: `npx vitest run --project site site/pages/agent-admin-app.test.ts site/pages/agent-admin-presets.test.ts site/pages/agent-admin-persona-file.test.ts site/pages/agent-schema.test.ts site/lib/team-agent-card.test.ts` exits 0.
- Model section generated from the table (Thinking offers "Off" on Haiku 5.5 only, "Show reasoning" on every 5.5 model), stored temperature ignored: `npx vitest run --project packages packages/agent-ui/app/src/controls/agent-admin` exits 0.
- `npm run e2e:admin` exits 0.
- Live probes per model (Haiku, Sonnet, Opus 5.5) with reasoning shown, the composer split (3b: "Thinking off" in the effort menu, the show-reasoning toggle, web search and fetch toggles, the mid-conversation `output_config` beta) and the Model section screenshot are open and owned by the conductor.
