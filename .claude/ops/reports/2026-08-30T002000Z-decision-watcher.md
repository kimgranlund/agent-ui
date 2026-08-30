# decision-watcher sweep — 2026-08-30T00:20:00Z (agent-ui-marshal, session agent-ui-93)

Unattended fallback-fan-out firing (harness/scripts + harness/workflows not vendored, no
concurrency guard ran per claude-plugins #995). Report follows the claude-plugins #996 shape.

## Forward mode

`classify`: 226 ADRs, 0 new, 0 newly-superseded, 3 amended (adr-0067, adr-0069, adr-0227). No
FORMULA MISMATCH.

- **adr-0067** (Amendment, GH #1703): cl.1/cl.2's named roster realized under different identifiers,
  a fresh instance of adr-log-mechanics.md's 4th shape; no references/*.md cites it yet. Harvest, extend. Queued.
- **adr-0069** (Amendment, GH #1704): cl.5's BrowserDirectTransport claim recorded dropped; same 4th
  shape; not yet cited. Harvest, extend. Queued.
- **adr-0227**: same-file rename note (Persona → Agent, GH #1699), ephemeral project record, not a
  knowledge-pack fact. Not a candidate.

Checkpoint advanced: only the 3 amended hashes changed. adr-queue: adr-0129 (Kim's decided
make-pack plan) untouched; 3 pending total.

## Revalidation mode

Cursor 70, n=5: 220 claims in corpus (220 ADR, 0 IDR, 0 RDD). Sampled adr-0072..adr-0076.

| id | kind | verdict | reason |
|---|---|---|---|
| adr-0072 | adr-decision | falsified | Clauses 1-4 live (session.ts, frameClientMessage, stateless proxy). Clause 5's cross-turn max-turns cap and named state machine do not exist in source; only per-generation caps (ADR-0070 maxRounds, GH #49 tool-loop cap). |
| adr-0073 | adr-decision | confirmed | AgentProvider seam, providers.json registry (anthropic implemented, openai/gemini stubbed), switcher, proxy allowlist+degrade match verbatim. |
| adr-0074 | adr-decision | confirmed | Zero `--c-*` survivors in packages/site/.claude source. |
| adr-0075 | adr-decision | confirmed | ui-column `stretch` prop + 4-member align enum live in column.ts/column.css. |
| adr-0076 | adr-decision | confirmed | widget.ts enumOf/applies gate matches on both applyProp paths. |

Queued adr-0072 falsified, owner unassigned. Cleared adr-0067/adr-0069 rows (resolved via #1703/#1704).
Cursor 70 → 75.

Next commands (never run by this seat): adr-0067/0069 harvest → extend adr-log-mechanics.md's
worked-instances list; adr-0072 → file-task, append-only Amendment restating the shipped guard set.
