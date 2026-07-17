---
doc-type: ticket
id: tkt-0074
status: done
date: 2026-07-16
owner:
kind: feature
size: small
---
# TKT-0074 — six A2UI-showcase agent presets + a persona picker on the standalone agent-admin app page

## Summary
The standalone surface (`agent-admin-app.html`) gains a preset strip: six pre-designed agent personas,
each a **persona-scoped store** (its own `persistKey`, seeded initials — editable and persistent per
persona, the option-2 design ruled in-conversation 2026-07-16) selected from a slim top bar. Each
persona steers a DIFFERENT A2UI catalog family + interaction mechanism through its rewritten prompt
sections and its capability entries, whose labels intent-match the shipped mini-skill registry
(ADR-0091: `card-game-sheet` · `dashboard-kpi-grid` · `form-rhythm` · `login-form`), so
`selectMiniSkills` fires differently per persona on the live path:

| preset | model · temp · tools | A2UI showcase axis |
|---|---|---|
| The Croupier | Fable 5 · 0.6 · on | actions + `updateDataModel` in place on ONE `surfaceId` (card game) |
| The Quant | Opus 4.8 · 0.1 · on | report family: Stat/BarChart/Sparkline/Table/Progress |
| The Concierge | Sonnet 5 · 0.4 · on | two-way input binding + checks + submit gate (forms/Calendar) |
| The Curator | Sonnet 5 · 0.8 · off | feed family + Swiper/Tabs/Avatar/Attachment, ChildList depth |
| The Stylist | Fable 5 · 0.5 · off | token surfaces: Swatch/Ramp/Ladder (ADR-0118, fleet-unique) |
| The Quizmaster | Haiku 4.5 · 0.9 · off | Modal open/close lifecycle + progressive multi-turn state |

Config axes double as test coverage: all four `SUPPORTED_MODELS`, temperatures 0.1–0.9, tools both
states, capability lists in varied fill/enabled states.

## Acceptance
- `site/pages/agent-admin-presets.ts` (page-local data + apply mechanics, NOT a package export):
  the six personas as seed data — config values + the five `entriesStoreKey(...)` lists (prompt
  sections rewriting the Foundation builtin per persona + one custom "Surface style" section;
  capability entries labeled to intent-match real mini-skills).
- Persona-scoped stores: `createMemoryStore({ initial: seed, persistKey: 'agent-admin-app.<id>' })`,
  cached per id; switching swaps `admin.store` — edits persist per persona and survive switching
  away/back. A store-swap PROBE verifies `ui-agent-admin` re-reads cleanly on assignment (the
  `#unsubscribes` seam) — measured, not assumed.
- The picker strip: page-chrome (page-local CSS, no component change), current persona visibly
  selected, plus a "Reset persona" action (clear its persist keys, reseed).
- The stub path works out of the box (config/prompt/capabilities plumbing proves live-apply); the
  full A2UI showcase engages on the DEV live path — noted in-page, the existing console-status
  precedent.
- Gates: `npm run check` + full jsdom green; llms/sitemap allowlists already cover the page (no new
  page is added); theme-provider fixture regenerated if CSS changes.

## Links
- [TKT-0052](tkt-0052-agent-admin-live-model-overlay.md) / ADR-0131/0132/0136 — the surface + live overlay.
- `packages/agent-ui/a2ui/tools/agent/prompts/mini-skills/` — the registry the skill labels target (ADR-0091).
- ADR-0129 — the same-`surfaceId` routing the Croupier showcases.

## Scope/Open
- Page-level only (option 2 of the ruled design): NO `ui-agent-admin` prop/contract change — a
  component-level `presets` prop is the explicit non-goal until this proves the interaction.
- The stub reply does not emit A2UI payloads; making the stub itself surface-capable is out of scope.

## Findings

### 2026-07-16 — shipped: six personas, persona-scoped stores, picker strip — browser-verified live — CLOSED

**Landed:** `site/pages/agent-admin-presets.ts` (the six personas as seed data + `presetSeed`/
`presetStore`/`resetPreset` — page-local, per the scope line) · the picker strip + reset in
`agent-admin-app.ts`/`.css` (shipped ui-buttons, active = solid; last persona remembered) · one
ADDITIVE package export (`entriesStoreKey`/`initialEntryValues` joined the `@agent-ui/app` root
barrel — the page must reuse the store-key format, never duplicate it).

**The store-swap probe (acceptance) — measured:** `admin.store = presetStore(other)` re-renders the
settings pane AND the prompt sections from the new store (the reactive store effect at
agent-admin.ts:162 re-pushes into `#settingsEl`, rewires sections, re-syncs the conversation) —
pinned in `agent-admin-app.test.ts` on real rendered DOM. Plus the data-integrity gates: ids/orders,
config ranges, the axes-coverage check (all four models · tools both ways · temp 0.1–0.9), and the
mini-skill labels resolved against the SHIPPED registry directory (fs truth — a renamed mini-skill
reddens the test).

**Browser-verified:** all six personas render; switching repaints every pane live (Croupier→Stylist
screenshot-diffed: name/model/temp/tools/skills/resources all swap); the Stylist's live turn
(Fable 5, effort Medium) returns a persona-shaped reply — ramp structures with 50–900 steps + a
one-paragraph contrast rationale, exactly its Surface-style section.

**The wave's real catch:** the FIRST live turn returned an empty bubble — not a preset bug but two
stacked pre-existing provider defects (stale `budget_tokens` thinking param → 400 on the Claude 5
family at effort ≥ medium; no `res.ok` check → the 400 swallowed as `{"text":""}`), filed + fixed as
[TKT-0075](tkt-0075-anthropic-provider-effort-400-silent-empty.md). The presets' config axes
(model × effort defaults) are exactly what surfaced it — the test matrix earned its keep on day one.

**Gates:** `npm run check` green · new suites 7/7 (6 integrity + the swap probe) · live-agent
181/181 · the llms/sitemap coverage gates already carried the page's allowlist rows.

