---
doc-type: ticket
id: tkt-0075
status: done
date: 2026-07-16
owner:
kind: bug
---
# TKT-0075 — the Anthropic provider 400s on effort≥medium for Claude 5-family models, and swallows the error as an empty reply

## Summary
Found while browser-verifying TKT-0074's presets: any chat turn at the composer's DEFAULT effort
(Medium) on `claude-sonnet-5` or `claude-fable-5` renders an empty agent bubble on the live path.
Two stacked defects in `packages/agent-ui/a2ui/tools/agent/providers/anthropic.ts`:

1. **Stale thinking parameter.** `buildRequestBody` maps effort ≥ medium to
   `thinking: {type: "enabled", budget_tokens: N}` — the pre-4.6 extended-thinking shape. The
   Messages API REJECTS it with a 400 on the current model families (Fable 5 / Sonnet 5 /
   Opus 4.8/4.7); only Haiku 4.5 still accepts it. Current models take
   `thinking: {type: "adaptive"}` + `output_config: {effort}`.
2. **Silent-empty on non-200.** `stream()` never checks `res.ok` — a 400's JSON error body parses
   as zero SSE frames, so the proxy returns `{"text": ""}` and the conversation finalizes an EMPTY
   bubble with no error surfaced anywhere (the fail() path never runs).

## Repro (measured, dev proxy + live key, 2026-07-16)
`POST /__a2ui/agent/chat` with the same body at effort low vs medium:
- haiku-4-5 low → text ✓ · medium → text ✓ (budget_tokens accepted on pre-4.6)
- sonnet-5 low → text ✓ · **medium → `{"text":""}`**
- fable-5 low → text ✓ · **medium → `{"text":""}`**

## Acceptance
- `buildRequestBody` maps effort per the CURRENT API: pre-4.6 models (haiku) keep the
  budget_tokens shape; current families get `thinking: {type: "adaptive"}` +
  `output_config: {effort}` (adaptive is legal on Fable 5 — "omit or adaptive").
- `stream()` throws on `!res.ok` with the upstream error body — a 4xx/5xx becomes a VISIBLE
  failed turn (the conversation's ⚠ fail path), never an empty success.
- The pure-seam tests updated/extended (the buildRequestBody fixture precedent); the model×effort
  matrix re-probed green through the dev proxy.

## Links
- [TKT-0074](tkt-0074-agent-admin-a2ui-showcase-presets.md) — the wave that surfaced it.
- ADR-0136 (effort dial) · the claude-api reference's thinking/effort table (the API truth).

## Findings

### 2026-07-16 — both defects fixed, live-verified — CLOSED

**The mapping (anthropic.ts `buildRequestBody`):** now two arms, mutually exclusive by API design —
Haiku (`/haiku/` — the one served pre-4.6 family) keeps the legacy
`thinking: {type:'enabled', budget_tokens}` shape (and gets NO `output_config`, which errors there);
every current family (Fable 5 / Sonnet 5 / Opus 4.8) gets `thinking: {type:'adaptive'}` +
`output_config: {effort}` with the same tiered `max_tokens` as the legacy arm. `low`/unset stays the
untouched pre-Effort request shape on every model (deliberately NOT `{type:'disabled'}`, which
Fable 5 rejects).

**The silent-empty (anthropic.ts `stream()`):** a `!res.ok` guard now throws with the upstream
status + body — a 4xx/5xx becomes a VISIBLE failed turn through the conversation's ⚠ fail path
instead of parsing an error JSON as zero SSE frames and returning `{"text": ""}`.

**Verified:** the pure-seam tests re-shaped to pin both arms (current family = adaptive+effort,
never budget_tokens; haiku = budget, never output_config) — 181/181; the dev-proxy matrix re-probed
live: sonnet-5/medium and fable-5/medium (the two silent-empty cells) now return real text; the
browser end-to-end on the Stylist preset (fable-5, the composer's default Medium) renders a full
persona-shaped reply. `npm run check` green.

**Why it shipped unseen:** the effort dial (ADR-0136 wave) was built against the pre-4.6 thinking
API and only manually live-tested; low/unset was the only tier exercised. The res.ok gap then
converted the 400 into an empty-but-successful turn — the exact silently-swallowed-failure class
the runner's own acceptance bans one layer up.

