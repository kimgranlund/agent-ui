# GenUI inventory — 2026-07-28

## 1. SHIPPED (B0-B2, roadmap.md §2)

- **Identity ruled**: free-form HTML/CSS/JS in a sandboxed `<iframe>`, "contained not forbidden"
  (PRD v0.4 §4 D1). PRD + SPEC both `proposed`, every fork ruled (nothing blocks build).
- **Containment host**: `ui-sandbox-frame` (`@agent-ui/components`) — SPEC-R3 sandbox
  (`allow-scripts` only, opaque origin) · SPEC-R4 CSP (4 MCP-Apps-shaped categories, default-deny) ·
  SPEC-R5 srcdoc lifecycle + fail-closed never-paint · SPEC-R6 token bridge (`--md-sys-*` +
  `color-scheme` injected at build, live flips via `host-context-changed`) · SPEC-R7/R8 closed
  6-member bridge, `action` outward (fleet's 7th event, ADR-0153). Catalog-invisible by
  construction (PRD-G4).
- **Wire**: in-house `{"genui":{surfaceId,html}}` line, disjoint from `A2uiServerMessage`/
  `a2uiMeta`, atomic (never chunked) — canonical reader/writer at `@agent-ui/a2ui/agent`
  (`genui-line`); `produce()` peels genui lines pre-heal/validate, `GENUI_*` failure codes on the
  turn trace (SPEC-R1/R2).
- **Producer/packs**: 3 curated pattern-source packs + degradation-safe prompt block (SPEC-R9,
  byte-pinned prose / ADR-0135 mechanics, corrected v0.3); picker is source-level via the existing
  `EntryLibraryPack` mechanism, live-apply (SPEC-R11, PRD-D3/D4).
  Zero pack bytes in the `.` root barrel (ADR-0137 purity).
- **agent-admin**: Surface Options GenUI row live (was disabled-pending-PRD) — fail-closed
  off-by-default toggle + pattern-source picker, mounted on a parallel path beside the A2UI
  client inside the real turn loop.
- **`exclusive` field** (v0.4 amendment, SPEC-R10): per-turn "no A2UI catalog at all" signal —
  fixed a real blank-render defect on `gen-ui-live` (a genuine agent note silently dropped by
  SPEC-R1's whole-line rejection). Byte-identical when absent/false.
- **`gen-ui-live`** stays deliberately **recorded-only** (not a live-model demo surface).

## 2. IN-FLIGHT

- **ADR-0162 (GH #316, `proposed`, not yet ratified) — dogfood mode.** Opt-in per-turn
  `GenuiSurfaceConfig.dogfood?: boolean`. Two coupled halves, wire untouched:
  - Frame: docs-page asset pair (flattened CSS + self-defining `ui-*` IIFE bundle + Phosphor)
    injected **inline** into srcdoc via a new `assets` prop — CSP/sandbox posture unchanged
    (`'unsafe-inline'` already the ruled floor); new `dogfood/` subpath, generated + freshness-gated
    (theme-provider LLD-C11 fixture precedent), never the default barrel.
  - Prompt: hand-authored teaching (byte-pinned) + descriptor-derived fleet inventory
    (ADR-0071 drift-gated, never byte-captured) composed into SPEC-R10's genui block.
  - Bundle tags ≡ inventory tags asserted set-equal by standing gate.
  - Decomp slices S0-S5 (`genui-dogfood.decomp.md`): S0 docs commit → S1 asset pair → S2 frame
    injection + browser probes → S3 prompt segment → S4 admin/gen-ui-live surfacing → S5
    cross-half gate + full sweep. **Gated on Kim ratifying ADR-0162** before S1+ build.
- **B3 — judged pack-idiom eval** (PRD §8 m3, roadmap §4 "Later"): deferred, named-manual run
  only (SPEC-N3 — never a standing/deterministic gate). Revisit trigger: "when producer output
  quality needs a measured floor."

## 3. CANDIDATE INCREMENTS

1. **Ship ADR-0162's S1-S5 build** (one slice as decomposed) — the dogfood mode is the single
   largest named next increment; ratification is the only blocker.
2. **B3 judged eval + docs page** (PRD-G6) — closes the "shipped end to end" claim's one open
   contract item; needs a corpus-rubric shard matching the A2UI corpus discipline.
3. **PRD-G7 (`could`) — shareable/exportable pattern sources** across workspaces: named in the
   PRD, never scheduled.
4. **W3C Generative UI CG — watch item** (PRD §5.1): not chartered as of the 2026-07-23 survey;
   revisit trigger is its own, with a stated freshness caveat (re-check before citing again).
5. **AG-UI exact event shapes** — PRD flags a secondary-source uncertainty
   (`ag-ui-protocol/ag-ui` `events.ts` was never pulled directly); a real gap if GenUI's
   "one stream, disjoint kinds" claim is ever challenged.
6. **`gen-ui-live` stays recorded-only** — a live-turn demo surface for GenUI (mirroring what
   agent-admin now has) is a real gap for anyone wanting to *see* GenUI work outside agent-admin.
7. **Naming-collision cleanup** (PRD §9, flagged not yet acted on): `GenUiMode`/`gen-ui-mode.ts`
   (ADR-0090, prompt-disposition axis) vs. the GenUI *surface* — same "genui" spelling, different
   concepts; PRD asks the SPEC to disambiguate or rename, unresolved.
8. **CSP reporting directives unavailable** in meta CSP (SPEC-R4) — drop counters (SPEC-R7) are
   the only observability; a real, small gap if adversarial-payload telemetry ever matters beyond
   test-time counters.

## 4. EDGES — as CONSUMER

- **components**: `ui-sandbox-frame` is the whole containment contract — any change to its
  `assets`/sandbox/CSP posture is a GenUI-defining event, not a side change. Dogfood's new
  `dogfood/` subpath is GenUI-owned but lives in `@agent-ui/components` (cross-package edge).
  Depends on ADR-0004's ONE descriptor parser for the dogfood inventory derivation.
- **a2ui**: the wire (`genui-line`) and `produce()`'s peel-before-heal ordering are a direct
  dependency on the live-agent producer stack (ADR-0137); SPEC-R5's validate-then-stream law had
  to be honestly narrowed (structural-only at wire time) because `validateA2ui` parity doesn't
  extend to opaque HTML — a real, load-bearing exception in a sibling SPEC, not a footnote.
- **shells**: none directly — GenUI mounts inside agent-admin's chat surface, riding whatever
  chrome is already there; `router`/`code`/app-shell-family stay out by construction
  (catalog-invisible, ADR-0115/0119) and dogfood's ADR explicitly keeps them out of the in-frame
  asset set too.
- **agent-admin**: the only real production consumer today — Surface Options store discipline,
  live-apply law, and the bounded client-turn-loop (the page-freeze root-cause fix) are all
  edges GenUI depends on rather than owns.

## 5. EDGES — as PROVIDER

- **agent-admin / SaaS patterns wanting from GenUI**: the closed 6-member bridge (`action`
  outward) is the only sanctioned channel for a GenUI surface to talk back to a host turn loop —
  any pattern wanting richer interactivity (multi-step tool calls, streaming partial UI) is
  explicitly a non-goal in v1 (PRD §3 — no generic `tools/call`-equivalent).
- **Pattern-source packs** are the reusable unit other admin/SaaS surfaces could adopt via
  `EntryLibraryPack` — same mechanism already used for skills/workflows/resources/tools packs
  in agent-admin, so a new consumer surface gets the picker "for free" if it reuses that pack type.
- **Token bridge** (SPEC-R6) is the template for any other sandboxed-content-in-app pattern that
  needs live theme sync without a full re-render — dogfood's frame-asset injection reuses this
  exact bridge rather than inventing a second one.
