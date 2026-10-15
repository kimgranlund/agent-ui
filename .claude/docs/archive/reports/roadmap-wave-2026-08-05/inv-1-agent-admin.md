# Inventory — Agents & Agent Admin (2026-08-05 refresh)

> Re-verified against the tree/tracker as of today. Precedent: `reports/roadmap-wave-2026-07-28/inv-1-agent-admin.md`.
> Since that pass, M-B ("Personas that don't lie") and M-C ("GenUI speaks fleet") both shipped **DONE**,
> M-A ("SaaS Data Workbench") shipped **DONE** (2026-08-05, spawning the entry-list extraction this
> surface now depends on), and ADR-0168/0169/0170 all ratified and built. This file supersedes the
> 07-28 findings; nothing from that file is repeated without re-checking it here.

## 1. SHIPPED (load-bearing today)

- `ui-agent-admin` (`packages/agent-ui/app/src/controls/agent-admin/agent-admin.{ts,css,md}`, 1582
  lines of `.ts`) — unchanged composition shape from 07-28: a two-pane `ui-split` (chat canvas |
  Settings ⇄ Context:System ⇄ Context:Dialog tabs), chat-shell/super-shell chrome (ADR-0154),
  `ui-tabs` `fill` strips (ADR-0144).
- **Entry-list machinery extracted out of agent-admin (MA-2, PR #459, ADR-0164).** The generic half
  of `entries.ts` moved to its own package home,
  `packages/agent-ui/app/src/controls/entry-list/` (`entry-list.ts` verbatim move,
  `entry-data.ts` the split-out generic core, `entry-data.test.ts`, `entry-list.css`,
  `entry-list.browser.test.ts` — a standalone browser smoke with **zero agent-admin involvement**).
  `agent-admin/entries.ts` keeps its name but now only carries the agent-admin-specific half; all 27
  original test cases survived the split. Three new `app` package subpaths ship it:
  `./entry-list`, `./entry-list.css`, `./entry-data`. A real regression surfaced and was fixed in the
  same PR: `@scope` custom properties don't inherit upward from a descendant scope, so the five
  shared `--ui-agent-admin-*` tokens had to revert to direct `--md-sys-*` expressions + an `@import`
  bridge (the `component-styles.css` precedent) — independently review-confirmed. This is the
  mechanism the 07-28 file's "generic entry-list primitive... the one exportable mechanism other
  admin-shaped surfaces would want" candidate turned into: it is no longer speculative, it shipped as
  its own consumable package surface, and M-A's SaaS Data Workbench page is its first outside
  consumer (`saas-data-workbench.spec.md`).
- **Tool/integration enablement rebuilt end to end (ADR-0168, accepted 2026-08-04, GH #402 resolved,
  PR #407→#411 ratify, S1–S7 built through PR #433).** Replaces the 07-28-era "raw label forwarded,
  hand-matched three times" mechanism with a real manifest registry:
  `packages/agent-ui/a2ui/tools/agent/integrations/{registry.ts, validate-input.ts, tool-dispatch.ts,
  currency.ts, weather.ts, wikipedia-search.ts, fetch-json.ts, index.ts}` (self-registering
  manifests, `registerIntegration`/`listIntegrations`, dispatch-time JSON-Schema-subset input
  validation, `auth:'none'|'serverKey'` with server-resolved keys in both the dev proxy and the
  production Worker). `id ≠ tool.name ≠ label` are now three separate fields (cl.2) — agent-admin's
  entry list shows `label`, forwards `id`; `agent-admin.ts:1309`'s own comment now states the
  contract plainly ("generic here: it knows nothing of registries or integration ids, it just
  forwards the stable key"). **GH #402 (tools silently inert on the prose-chat arm) is closed**: both
  `/chat` and the surface-turn route now share one tool-dispatch builder
  (`admin-live-runner.ts` forwards `integrations` on both arms), so a Tools-section toggle now works
  identically whether Surface Options has A2UI/GenUI on or off. The enablement knob is projected
  config (`liveAgentConfigSchema` gains an `integrations` section derived FROM the registry, one
  `boolean` field per manifest — the ADR-0135 Fork-1 "never a hardcoded second list" law applied
  again, cl.6).
- **The second A2UI catalog is real and pickable (ADR-0169, ratified; M-B box 4, PR #430).** Not a
  stub any more: `A2UI_CATALOG_OPTIONS` (`agent-admin-schema.ts:223`) now carries two entries —
  `agent-ui` (default) and `a2ui-basic` (upstream A2UI v0.9.1 Basic Catalog, mapped onto existing
  fleet controls) — and `catalogId` threads end-to-end through the live-runner POST body. ADR-0170
  (also ratified, LLD-C1–C6 built through PR #439/#449-range) turned catalog selection into the
  entry-list family's **eighth** instantiation: a `kind: "catalog"` section is the family's first
  SINGLE-select kind (derived from the persisted `a2uiCatalog` key, not per-entry `enabled` flags),
  with no master switch of its own — gated by the A2UI Surface Option toggle instead — and no
  authoring form (rows come only from the "Registered catalogs" library pack, which projects LIVE
  off `A2UI_CATALOG_OPTIONS`, closing the "second catalog or GenUI pack library" stub the 07-28 file
  flagged as candidate #4).
- **Persona export/import round-trips byte-equal (M-B box 3, PR #410).** The 07-28 file's candidate
  #7 ("a persisted/shareable persona export... no save/export/import path") is shipped — the
  persona-library pattern page is the reusable-beyond-agent-admin doc for it.
- **GH #314 (Hotel Concierge selection-not-reaching-model) and GH #307 (quiz/game round-bound
  exhaustion) are both closed** — ADR-0161's `value` mark widened to `ValueSlot | readonly
  ValueSlot[]` (range-picker binding) plus a ruled round-budget/recovery policy fixed the live-run
  classes the 07-28 file flagged as open bugs.
- **GenUI dogfood mode is live in agent-admin (ADR-0162, M-C, DONE 2026-07-29).** The Surface Options
  GenUI row composes real upgraded `ui-*` fleet components inside the sandboxed frame instead of bare
  model HTML — the 07-28 file's in-flight ADR-0162 candidate is now shipped and mounted in
  agent-admin's real turn loop, parallel to the A2UI client path.
- **Persona-prompt/Surface-Options coherence bugs fixed (GH #412, #418, both closed, both size:big).**
  Hardcoded persona "Surface style" prompt text no longer contradicts the live A2UI/GenUI toggle
  state; the A2UI toggle now actually changes prompt composition (`buildSystemPrompt` takes the
  modality state) instead of silently teaching A2UI regardless of the switch. A non-blocking
  `entry-notice` (GH #419) now warns on an enabled prompt section whose text names a modality that's
  switched off.
- Persona roster and library packs (skills/GenUI pattern-source derivation) — unchanged in shape
  from 07-28, still 14 shipped presets plus the new Catalogs library pack (`agent-admin-presets.ts`).
- `agent-admin-app.html` — unchanged, still the listed/discoverable full-viewport standalone surface.

## 2. IN-FLIGHT (open issues / ADRs touching this system)

- **GH #421** (OPEN, enhancement, size:big) — per-persona A2UI catalogs: `catalog = shared
  primitives + shared system + local patterns`. Today every persona composes over the SAME effective
  catalog (`agent-ui` or `a2ui-basic`, picked whole); this issue proposes a persona carry its own
  local pattern layer on top of the shared base, so e.g. the Maître d' and the Croupier compose
  different domain idioms instead of sharing one flat catalog. Explicitly linked to the now-closed
  #413 (the `catalogId` plumbing this would ride on) and to the closed #412/#418 Surface-Options
  arc. Design-intake-shaped: where a "local pattern" lives (a catalog fragment shipped with the
  preset? an admin-authored entry kind, GenUI-pattern-source-style? a package-level per-persona
  catalog module?) is explicitly left open in the issue body — this is a fresh fork, not a build-
  ready ticket.
- **GH #438** (OPEN, enhancement, size:big) — MCP client integration for the tool-enablement layer,
  explicitly deferred by ADR-0168's own Non-goals ("it changes the shell's dependency posture and is
  not prejudged here"). A named future arc, no design intake yet.
- **GH #468** (OPEN, enhancement, size:small) — `@agent-ui/app` size diet: the package's marginal cap
  was just re-based to a 79 KB (80896 B gz) **checkpoint, not a ratchet** (Kim's #454 ruling,
  2026-08-05) after the entry-list extraction + MA-1/MA-2/MA-3/MA-4 landed at 80337 B gz measured on
  main. `ui-agent-admin` lives in this package and is named as a diet candidate directly: "lazy-split
  rarely-hit agent-admin arms (the dogfood pair's own precedent)." This is a real, live budget
  pressure on the surface this file inventories, not background noise.
- Everything else the 07-28 file listed as in-flight (ADR-0162 build, GH #314, GH #307) is now
  closed/shipped — see §1. No open bug currently blocks a live persona run.

## 3. CANDIDATE INCREMENTS

1. **Design-intake GH #421** (per-persona catalog composition) before building it — the issue itself
   flags three open architectural questions (where a local pattern lives; relationship to the
   two-catalog `catalogId` model; whether "system patterns" is an existing layer or needs carving
   out). This is the one visible feature-shaped opportunity actually sitting on agent-admin's own
   backlog today.
2. **Lazy-split agent-admin's rarely-hit arms** to relieve GH #468's size pressure, following the
   already-proven `dogfood-lazy.*` precedent (`dogfood-lazy.browser.test.ts`,
   `dogfood-lazy.bundle.test.ts`, `dogfood-lazy-failure.test.ts`, `dogfood-lazy-timeout.test.ts` —
   the GenUI dogfood pair already ships this pattern for exactly one feature; Tools/Catalogs/Context
   panes are candidates for the same treatment).
3. **Scope GH #438** (MCP client integration) once a design intake exists — currently just a named
   future arc with no LLD/ADR, deliberately deferred by ADR-0168 cl. Non-goals.
4. **A real (non-stub) `agentTurn`/`agentSurfaceTurn` path for the packaged/production build** — this
   07-28 candidate is still open. Every live capability (including the now-real tool-manifest
   dispatch) remains DEV-only via `dev-proxy-plugin.ts`; ADR-0152's production Worker exists for the
   A2UI produce route but agent-admin's own docs-site mount still gates all live calls behind
   `import.meta.env.DEV`.
5. **Entry-list package now has one external consumer (M-A's SaaS Data Workbench) — watch for a
   second-consumer generalization gap.** The extraction (ADR-0164) was scoped to make the mechanism
   reusable; a near-term useful check is whether the workbench's actual usage patterns expose any
   agent-admin-specific assumption that didn't get cleanly split out (nothing currently reported, but
   this is the kind of drift that a fresh consumer surfaces late).

## 4. EDGES — as CONSUMER

- **A2UI**: the ADR-0161/0169/0170 gaps flagged in 07-28 are closed (two real catalogs, `catalogId`
  threaded, range-binding fixed). The one live edge is GH #421's proposed catalog-composition layer,
  which does not exist yet — agent-admin would be its first and defining consumer.
- **GenUI**: ADR-0162 is built and live in agent-admin's real turn loop (parallel path beside the
  A2UI client) — the 07-28 dependency is closed. No new GenUI-side gap surfaced against agent-admin
  in this pass.
- **`@agent-ui/app` package (own package now)**: agent-admin is the single largest consumer of the
  package's shared size budget and is directly named in GH #468 as a diet target — this is a live,
  numeric constraint (80337 B gz measured against an 80896 B gz cap) rather than an abstract one.
- **Entry-list (`@agent-ui/app/entry-list`)**: agent-admin is now a CONSUMER of a primitive it used
  to own outright — any future entry-list contract change (e.g. widening `EntryListOptions` for a
  new kind) is now a cross-surface decision with M-A's workbench page as the other stakeholder.
- **Tool/integration registry (`@agent-ui/a2ui/tools/agent/integrations`)**: agent-admin now reads a
  registry-projected config section instead of a hand-maintained array — a future integration
  (keyed, per ADR-0168's Non-goals "the real hotel/PMS integration is its own later work item") will
  show up in agent-admin's Tools section automatically, no agent-admin code change required, per
  cl.6's "never a hardcoded second list" law.
- **Component framework / Shells**: no new gaps found this pass; both remain closed per the 07-28
  file's own findings.

## 5. EDGES — as PROVIDER

- The entry-list primitive graduated from "the one exportable mechanism a future admin surface would
  want" (07-28's framing) to an actually-exported, actually-consumed package surface
  (`@agent-ui/app/entry-list`, `/entry-list.css`, `/entry-data`) with its own standalone browser
  smoke test asserting zero agent-admin coupling. M-A's SaaS Data Workbench is the proof case.
  Anything agent-admin does next to its own entry-list usage (kind additions, `EntryListOptions`
  widening) is now a shared-contract change, not a local one.
- The manifest-registry tool-enablement pattern (ADR-0168: `{id, version, label, description, tool,
  auth, envKey?, execute}`, self-registering, fail-fast at boot on duplicate id/tool.name,
  dispatch-time schema validation, server-resolved keys via `ExecuteContext`) is now the reference
  shape for "add a capability the model can call" anywhere in the fleet, not just agent-admin's Tools
  section — the 07-28 file's playable-game-loop and live-apply-store patterns remain valid provider
  edges unchanged.
- The persona export/import round-trip (M-B box 3) and the Catalogs single-select kind (ADR-0170) are
  both new, generalizable shapes other admin-configured surfaces could copy: byte-equal
  export/import for an authored config bundle, and "one primitive, single-select variant, gated by
  an external toggle rather than its own master switch" as an entry-list fork pattern.
