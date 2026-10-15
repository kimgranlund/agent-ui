---
id: T-0151
title: "Capture every live agent turn's trace (errors, warnings, retries, raw output) to a local file the conductor can read"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L3
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "are you able to capture the errors and warnings in the agent trace so we can work through issues?" Today the Agent activity trace (Request sent, Generated, Reasoned, Called tool, Validated "Model output did not parse, retried", surface ops, Raw output, token counts) lives only in the browser, and the real upstream error is only console.error'd in the dev-server terminal (dev-proxy-plugin.ts ~364 and ~510, generic text over the wire by design, chat-validation.ts:36). Make every live turn readable from disk so an agent can triage it.

## Scope (one brief paragraph, per the Inner loop rule)
Dev only, keys never written: in the dev proxy (/__a2ui/agent, dev-proxy-plugin.ts) append one JSON line per turn to a git-ignored local log, `.agent-traces/YYYY-MM-DD.jsonl` at the repo root (add it to .gitignore and to the vitest and watcher excludes), holding: timestamp, route (chat or produce), persona or agent name, provider and model, effort, the user message, every trace step the UI shows (with its status, the validation failure details and codes behind "did not parse", each retry and its cause), the raw model output per round, the surface operations and component count, token usage, duration, and on failure the full upstream error (status and body, with any key-like string redacted). Reuse the existing devtools event model where it fits (recordTurn and DevtoolsEvent in @agent-ui/devtools, ADR-0200) without moving a key or produce() into devtools (the ADR-0073 trust boundary stays). Gate it behind an env flag that defaults ON in dev and is absent in production builds and the Worker. Add a small `npm run traces` script that prints the last N turns as a short table (time, agent, model, outcome, retries, first error or warning) with `--full <n>` for one turn's detail. Also show the real failure reason in the chat for the dev build only (for example "upstream 401: invalid x-api-key") instead of only the generic text, keeping the generic text in production. Tests: a unit test for the line shape and redaction, and one test that a failed turn writes its upstream error. Local gate: npm run check plus the touched folders' tests; commit locally, do not push, no em dashes, report in one short message with an example line from a real turn if a key is present in .env (one cheap haiku turn at most).

## Closed

2026-10-14: merged as #1967
