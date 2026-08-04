# Baseline — representative unassisted answers (no skill loaded), 2026-08-04

Three Phase-2 prompts, answered from model knowledge + generic repo context only. These are the
"before" evidence: each misses at least one ADR-0168 law the skill binds.

## P1 — "Add a new tool for the agent — where does it go?"

Unassisted answer pattern: proposes adding an entry to a tools array/list next to the existing
weather/currency integrations, keyed by a single `name` string reused as the admin label; puts
validation inside the new executor ("check your inputs at the top of execute"); no mention of
`registerIntegration`, boot-fail-fast collision checks, or the id ≠ tool.name ≠ label split.
Misses assertions 1, 2, 4.

## P2 — "The hotel API needs an API key — how do integration keys work?"

Unassisted answer pattern: suggests reading `process.env.HOTEL_API_KEY` inside the executor, or
adding the key to a config file; does not know the `auth:'serverKey'`/`envKey` manifest facts,
the `ExecuteContext.apiKey` hand-off, dual-host resolution (dev `loadEnv` vs Worker env binding),
or the exclude-when-unprovisioned rule. Misses assertion 3.

## P3 — "The model sent malformed input to the currency tool and the turn threw"

Unassisted answer pattern: recommends adding a try/catch or ad-hoc guards inside the currency
executor — per-integration re-invented validation, exactly the pre-0168 state the ADR retired;
does not route the fix to the ONE shared `validateToolInput` seam before dispatch, nor name the
structured `is_error` tool_result degrade contract. Misses assertion 2.
