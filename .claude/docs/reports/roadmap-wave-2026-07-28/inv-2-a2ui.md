# A2UI Inventory — `@agent-ui/a2ui`

## 1 · SHIPPED (load-bearing today)
- Zero-dep renderer/validator/default catalog (49 component types in `catalog/default/catalog.json`, incl. `FormPopover` — cataloged already) + structural resend reconciliation (ADR-0128).
- Producer toolkit `./agent` (ADR-0137/0138): `produce()` round loop, `system-prompt.ts`, `mini-skills.ts`, `agent-transport.ts`+`session.ts` seam, provider dispatch (`providers/`), recorded transport for demos.
- Live-turn lifecycle progress channel on the transport meta-line (ADR-0146) + produce-halt surfacing + in-persona self-correct feedback.
- GenUI wire (ADR canon B0–B2, roadmap.md §2): canonical `genui-line.ts` reader/writer at `@agent-ui/a2ui/agent`, `produce()` peeling genui lines pre-heal/validate, `GENUI_*` failure codes on the turn trace, 3 pattern-source packs + degradation-safe prompt block (SPEC-R9).
- Dev live-agent proxy ported to a Cloudflare Worker (ADR-0152, `tools/agent/worker/`).
- A2A bridge (`src/bridge/bridge.test.ts`, `feed-fixture.test.ts`) — A2UI-over-A2A.
- Corpus store (`src/corpus/`, `corpus/exemplar/v1_0/` — currently **1 exemplar file**, thin).

## 2 · IN-FLIGHT
- **ADR-0161** (`proposed`, dated 2026-07-28) — catalog's `value` mark widens `{prop,event}` → one-or-more `ValueSlot[]`, fixing Calendar range + SliderMulti write-back (both currently commit two values but the schema permits only one two-way slot). Repairs land in `catalog.ts`/`types.ts`/`input.ts`/`factories.ts`+`catalog.json`. Triggered by **GH #314** (Hotel Concierge booking loses date-range selection — model claims dates missing while calendar shows a range).
- **GH #307** (open, major) — quiz/game personas: live turns fail with round-bound IDGRAPH exhaustion; not yet root-caused. Leading hypothesis: same-surface RESUME path (TKT-0079/ADR-0129) sends a partial tree without re-delivering `root`, and `sessionSurfaceSeeds` (TKT-0081) may not cover the action-click resume path.
- **GH #321** — docs-grammar's dangling-link gate is code-span-blind (not a2ui-owned code, but bit an a2ui-adjacent doc, GH #316's decomp); small, unassigned side-effect.
- **ADR-0162** (`proposed`, 2026-07-28, GH #316) — GenUI "dogfood mode": opt-in per-turn mode loading the fleet's own docs-page CSS/component bundle into the sandboxed frame + dogfood-teaching prompt modules; off = byte-identical today. Touches `agent/{genui-surface-config.ts,system-prompt.ts}` + a new `dogfood-inventory.ts`. Not yet built.

## 3 · CANDIDATE INCREMENTS (grounded)
1. **Ship ADR-0161** — unblocks two flagship personas (Hotel range booking, SliderMulti Wave-B) once ratified.
2. **Root-cause #307's IDGRAPH exhaustion** — verify `sessionSurfaceSeeds` actually covers the resume path before assuming the fix; same method as #286/#288/#305 (live-reproduce via real produce() loop).
3. **Corpus growth** — `corpus/exemplar/v1_0/` holds exactly one file; the store scaffolding (validator, retrieval) exists but has almost nothing to retrieve against — a real growth pass is overdue.
4. **Ship ADR-0162 (dogfood mode)** once ratified — the build touches both the components-side sandbox bootstrap and the a2ui-side prompt/config, so it's a cross-package slice, not a pure a2ui change.
5. **Round-budget policy** — #307 exposes that the round-bound-exhaustion failure mode has no taught recovery once the budget is spent; worth asking whether the budget or the feedback loop is the actual gap once #307 is root-caused.
6. **Catalog coverage of newer controls** — `command-modal`, `status-stream`, `toast`, `textarea`, `theme-provider` (all landed 2026-07-09→14 in components) are **not** in `catalog.json`'s 49 types; `form-popover` already is. Worth a deliberate per-control decide-or-defer pass rather than silent gaps.
7. **Prompt-equivalence gate maintenance** — `agent/prompts/` is byte-pinned (`prompt-equivalence.baseline.json`); any dogfood-mode prompt module addition (ADR-0162) needs the deliberate recapture flow (a2ui-prompt-author skill), not an ad hoc edit.

## 4 · EDGES — as CONSUMER
- Needs the component framework to catalog (or explicitly defer) `status-stream`, `toast`, `command-modal`, `textarea`, `theme-provider` — these shipped mid-July and sit outside the 49-type catalog with no recorded decision either way (candidate #6 above).
- Depends on `ui-sandbox-frame` (components, GenUI containment host) for the whole GenUI wire; ADR-0162 will add a components-side asset bundle it must consume without violating the zero-dep default-barrel rule (the dogfood asset module is explicitly scoped as a new subpath, not the default barrel — ADR-0040/0049 cited).
- Consumes shell/agent-admin surfaces (`ui-agent-admin`) as its live host for the produce loop and Surface Options toggle — any shell-side regression (e.g. the recently-fixed unbounded turn loop, roadmap.md §2) directly affects a2ui's live-turn behavior.

## 5 · EDGES — as PROVIDER
- `ui-agent-admin` depends on a2ui for: the live produce loop, the progress channel (ADR-0146), the GenUI parallel mount path, and Surface Options' catalog/GenUI toggle — all real dependencies exercised in the shipped admin surface.
- SaaS/persona patterns (Hotel Concierge, quiz/trivia, games roster) depend on catalog write-back fidelity (ADR-0161's whole reason to exist) and IDGRAPH-safe resume semantics (#307) — both currently have open gaps a persona author can trip on.
- GenUI dogfood mode (ADR-0162) is itself a new provider surface once built: a2ui's prompt-injection mechanics become the vehicle for teaching a model to use the fleet's real components inside GenUI.
