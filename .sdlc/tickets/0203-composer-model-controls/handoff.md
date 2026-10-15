---
id: T-0203
title: "Composer model controls: thinking off and show reasoning in the effort menu, web search and fetch toggles, server tools in requests, mid-conversation effort header"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0185]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The parts of T-0185 split out when its core shipped: Kim's composer split (2026-10-14) and the request-side features the capability table lists but nothing sends yet.

## Intent
- Do:
  1. **Composer effort menu:**
     - "Thinking off", shown only where the model's capability row allows disabled thinking at that effort (Haiku 5.5);
     - a "Show reasoning" toggle that sets display to summarized or omitted.
     The composer starts from the agent's defaults.
  2. **Capabilities menu:** web search and web fetch toggles, shown only when the agent enables that server tool in settings.
  3. **Server tools in the request:** send the web search and web fetch tool definitions (max uses, allowed or blocked domains, user location) from the agent settings and the composer toggles, gated by the capability table. Document the cost note (web search is billed per search).
  4. **Mid-conversation effort:** when effort changes mid-conversation on the 5.5 models, send the per-message `output_config` with the `mid-conversation-output-config-2026-07-01` beta header so the prompt cache survives.
  5. **Evidence:** a screenshot of the composer menus and of the settings Model section, viewed.
- Done when:
  - `npm run check` exits 0;
  - the request-body tests cover each server tool and the beta header;
  - the agent-admin and live-agent tests exit 0;
  - `npm run e2e:admin` exits 0;
  - a live probe with web search on (conductor runs it) shows a cited answer.

## Context
- Builds on the T-0185 capability table (`packages/agent-ui/a2ui/src/agent/model-capabilities.ts`). API facts were checked on 2026-10-14 (web search `web_search_20260318`, web fetch `web_fetch_20260318`). Commit off origin/main, never push. Keys stay server-side.

## Constraints
- No em dashes.
