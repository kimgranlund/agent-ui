# Inventory — Agents & Agent Admin

## 1. SHIPPED (load-bearing today)

- `ui-agent-admin` (`packages/agent-ui/app/src/controls/agent-admin/agent-admin.{ts,css,md}`) — a
  two-pane `ui-split` composition (chat canvas | Settings ⇄ Context:System ⇄ Context:Dialog tabs),
  chrome riding the chat-shell/super-shell grammar (ADR-0154), tab strips on `ui-tabs` `fill`
  (ADR-0144). No new primitive beyond the generic entry-list (`entries.ts`, ADR-0132).
- One shared `SettingsStore` (localStorage-backed), five slices: Agent config, provider-grouped
  Model grid, prompt sections, Surface Options, five capability kinds (Skills/Workflows/Resources/
  Tools/Pattern-sources) — all live-apply (fresh store read per turn, no push channel).
- Surface Options (vision rev.6): three modality toggles — Markdown (default on), A2UI + catalog
  picker (default on), GenUI (default OFF, opt-in per agent, genui-surface SPEC-R10/R11).
- Two turn arms: `agentTurn` (single-shot prose, ADR-0136) and `agentSurfaceTurn` (streamed A2UI/
  GenUI wire lines into inline `ui-surface-host`s, ADR-0138) — both DEV-only injections via
  `dev-proxy-plugin.ts` (ADR-0073); the packaged/static build ships a deterministic stub only, no
  fetch/env code (ADR-0131 cl.4/7).
- The "playable-game loop": a surface action click (`onClientMessage`) drives the next turn
  automatically — this is what backs the quiz/game personas.
- Integrations/tools (GH #49): enabled `tool`-kind entry labels forwarded raw on every request; the
  dev proxy intersects against its own integration registry (`packages/agent-ui/a2ui/tools/agent/
  dev-proxy-plugin.ts`) — component never knows the registry.
- Persona roster: 14 presets (`site/pages/agent-admin-presets.ts`) spanning games/hospitality/
  travel (Croupier, Quant, Hotel Concierge, Maître d', Travel Agent, Curator, Stylist, Quizmaster,
  Mentalist, Negotiator, Lexicographer, Admiral, Alchemist, Dungeon Master).
- Entry-library packs (GH #47/#48, `site/pages/agent-admin-libraries.ts`): skills pack derives LIVE
  from the shipped mini-skill registry (`a2ui/src/agent/prompts/mini-skills/*.md`, zero hand-copy);
  a GenUI pattern-source pack derives from `prompts/genui-packs/*.md`.
- `agent-admin-app.html` — full-viewport standalone surface, now a listed/discoverable site page
  (Kim's 2026-07-25 overturn of the earlier opt-out), shell-less by design.
- The long-standing page-freeze bug (unbounded synchronous client-turn loop) is root-caused and
  fixed — bounded and deferred.

## 2. IN-FLIGHT (open issues / ADRs touching this system)

- **ADR-0162** (proposed, 2026-07-28, GH #316) — GenUI agent-ui dogfood mode: an opt-in per-turn
  mode wiring the SAME docs-page asset cascade into the sandboxed GenUI frame + dogfooding prompt
  modules. Directly touches `agent-admin.ts`'s Surface Options toggle. Not yet ratified.
- **GH #316** — the feature ADR-0162 answers; still proposed, no build yet.
- **GH #314** (bug) — Hotel Concierge persona: agent claims "dates still missing" while the
  calendar shows a selected range — selection state not reaching the model. Live-turn/tool-call
  wiring defect surfaced through an agent-admin persona.
- **GH #307** (bug) — quiz/game personas: live turns fail with round-bound exhaustion on IDGRAPH
  (all rounds) — a game-loop turn-budget defect.
- ADR-0161 (catalog multi-slot two-way value marks) is A2UI-catalog-scoped, not agent-admin-owned,
  but any catalog contract change flows into what a GenUI/A2UI surface turn can render here.

## 3. CANDIDATE INCREMENTS

1. Ship ADR-0162's dogfood mode end-to-end (frame asset cascade + prompt modules + the Surface
   Options toggle) — it's proposed with a full build plan already named in the ADR's Repairs row.
2. Root-cause GH #314 (selection state not reaching the model) — likely the same class of bug as
   the A2UI two-way-binding gaps ADR-0161 targets; worth checking before treating it as agent-admin
   local.
3. Fix GH #307's round-bound exhaustion — the game-loop turn budget needs a real ceiling/backoff
   for long multi-round personas (IDGRAPH), not just the freeze-loop bound already shipped.
4. A second A2UI catalog option — `surface-catalog`'s picker has exactly one entry today "by
   construction"; the create/pick-from-library affordance is named in agent-admin.md as landing
   "with a second catalog or the GenUI pack library" — currently a stub.
5. A real (non-stub) `agentTurn`/`agentSurfaceTurn` path for the packaged/production build, not
   just the DEV-only `vite dev` proxy — every live capability today is dev-session-only by
   construction (ADR-0131 cl.4/7).
6. Multi-catalog threading for `catalogId` — the request field exists (`AdminSurfaceTurnRequest.
   catalogId`) but is dead weight until a second catalog exists (ties to #4).
7. A persisted/shareable persona export — 14 presets live only as page-local TS data
   (`agent-admin-presets.ts`); no save/export/import path for an admin-authored persona.

## 4. EDGES — as CONSUMER

- **A2UI**: needs a second real catalog (today one id, picker exists but inert) and ADR-0161's
  multi-slot two-way value marks to close GH #314's selection-not-reaching-model class of bug.
- **GenUI**: needs ADR-0162 ratified + built — the dogfood mode is the only way a GenUI surface
  here can render real fleet components instead of bare model-authored HTML.
- **Component framework**: no gaps found beyond what's already flagged upstream (ui-tabs fill,
  ui-disclosure summary-slot activation guard) — both already consumed and working.
- **Shells**: none open — chat-shell/super-shell composition (ADR-0154) already covers this
  surface's chrome needs.
- **Greenfield SaaS patterns**: no persona-template/preset-library SaaS pattern exists to borrow
  from for candidate #7 (persisted persona export/import) — would need to be invented here first.

## 5. EDGES — as PROVIDER

- The generic entry-list primitive (`entries.ts`/`entry-list.ts`, ADR-0132) is the one exportable
  mechanism other admin-shaped surfaces would want — six instantiations proven, "a future kind is a
  seed-data change, not a code change."
- The live-apply store pattern (one `SettingsStore`, N slices, fresh-read-not-push) is a reusable
  shape for any other config+preview composition.
- The playable-game loop (`onClientMessage` auto-driving the next turn) is the reference
  implementation any other agentic-surface consumer would copy for interactive GenUI/A2UI turns.
- The DEV-only live-call injection seam (`agentTurn`/`agentSurfaceTurn` + `dev-proxy-plugin.ts`
  trust boundary) is the template other "editable-config with a working preview" components should
  follow to keep a zero-external-dependency static build.
