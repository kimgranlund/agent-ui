# Decomposition — GenUI agent-ui dogfood mode ship (GH #316 / ADR-0162)

> Status: proposed · v0.1 · 2026-07-28 · Layer: decomposition (dispatchable build sequence + test
> plan). Plan-grade: every leaf carries a checkable acceptance predicate. Maps 1:1 onto
> [`genui-dogfood.lld.md`](../lld/genui-dogfood.lld.md)'s LLD-C1…C5.
> **Gate on S1+: ADR-0162 ratified by Kim** (the SPEC v0.5 amendment lands with S0 while the ADR
> is still `proposed` — ratification runs through `adr_ratify.py` against the COMMITTED file, so
> S0 must land first). The commit slice (S0) lands the docs verbatim from the scratchpad drafts;
> S1+ are build slices.

## Slice sequence (each = one dispatchable unit; FOREGROUND gates, judged by exit codes)

### S0 — docs commit (single-writer; no build)

Copy verbatim into the tree: `0162-genui-agent-ui-dogfood-mode.md` → `.claude/docs/adr/` · apply
`genui-surface.spec.v0.5-amendment.md`'s two edits to `.claude/docs/spec/genui-surface.spec.md` ·
`genui-dogfood.lld.md` → `.claude/docs/lld/` · this file → `.claude/docs/decompositions/` · the
ADR README index row (below). **Accept:** `npm test site/lib/adr.test.ts` + the docs-grammar gate
green; the README row present; ADR status stays `proposed` (never agent-flipped).

README row draft (the ADR link is written repo-relative FROM THIS FILE so the S3 dangling-link gate
resolves it — `docs-grammar.test.ts`'s regex is code-span-blind; the row as committed in the ADR
README carries the README-relative `./0162-genui-agent-ui-dogfood-mode.md` instead):

`| [0162](../adr/0162-genui-agent-ui-dogfood-mode.md) | **GH #316 GenUI agent-ui DOGFOOD mode (Kim's 2026-07-28 ruling): an opt-in per-turn \`GenuiSurfaceConfig.dogfood\` flag — mode-on loads the fleet's docs-like asset pair (flattened CSS + self-defining component IIFE bundle, INLINE under the UNCHANGED sandbox/CSP posture — 'unsafe-inline' is already the ruled floor; blob/served delivery rejected) into the GenUI frame via a new \`ui-sandbox-frame\` \`assets\` prop + a \`@agent-ui/components\` opt-in subpath (generated, committed, freshness-gated — the theme-provider fixture precedent), and composes a dogfood prompt segment (hand-authored teaching, byte-pinned + descriptor-DERIVED fleet inventory, drift-gated per ADR-0071 — never byte-captured) into SPEC-R10's genui block; bundle tags ≡ inventory tags by standing gate; wire untouched; off = byte-identical everywhere** | proposed | genui-surface.spec v0.5 §11 (SPEC-R12/R13) · `sandbox-frame/*` + `dogfood/` · `a2ui/src/agent/{genui-surface-config.ts,system-prompt.ts,dogfood-inventory.ts}` + `prompts/genui-dogfood-teaching.md` · `chat-validation.ts` · agent-admin Surface Options · gen-ui-live · Extends ADR-0091/0135/0004 · Relates ADR-0071/0040/0049 · GH #316 |`

### S1 — LLD-C1: the asset pair (seat: component-builder or builder; worktree + own `npm install`)

1. `scripts/build-dogfood-assets.mjs` — real Vite/Rolldown IIFE build of the four cascade imports;
   emits `dogfood/dogfood-assets.ts` (`DOGFOOD_CSS`/`DOGFOOD_JS`/`DOGFOOD_TAGS` + measured-size
   header). **Accept:** running it twice yields byte-identical output (determinism); sizes recorded.
2. `package.json` `./dogfood-frame` subpath + barrel-purity trip-wire. **Accept:** default-barrel
   trace reaches zero dogfood bytes (the ADR-0137 gate pattern), `npm run check` exit 0.
3. `dogfood-assets-freshness.test.ts` — rebuild-and-compare + the `url(`/`@import` purity grep.
   **Accept:** green on fresh, RED on a planted one-byte asset edit (negative control run once,
   reverted), `npm test` exit 0.

### S2 — LLD-C2: frame injection (seat: component-builder; after S1)

4. `SandboxFrameAssets` + property-only `assets` prop (safe codec, `attribute:false`);
   `buildSrcdoc` five-node ordered insertion. **Accept (jsdom):** head order = CSP meta → token
   style → asset style → bootstrap → asset script → model head children; absent-assets srcdoc
   BYTE-IDENTICAL to pre-change (regression pin).
5. Descriptor row + naming/descriptor gates. **Accept:** descriptor trip-wires green.
6. Browser probes (components shard): SPEC-R12 AC1 upgrade probe (ui-button upgrades, `[data-part]`
   anatomy present, token-derived computed style) + AC2 containment re-proof (existing probes pass
   identically against a dogfood frame; `sandbox` attr literally `allow-scripts`). **Accept:**
   `npm run test:browser` exit 0, run FOREGROUND.

### S3 — LLD-C3: the prompt segment (seat: builder/a2ui-builder; parallel-safe with S2 after S1)

7. `dogfood?: boolean` on `GenuiSurfaceConfig` (+ doc comment). **Accept:** `npm run check` exit 0.
8. `dogfood-inventory.ts` — descriptor-derived, `process.cwd()` paths, budget-capped. **Accept:**
   deterministic unit test; inventory ≤ 16 000 chars; a planted phantom tag fails the drift leg.
9. `prompts/genui-dogfood-teaching.md` (≤ 8 000 chars) + `genuiBlock` dogfood leg (order: base →
   exclusive → dogfood → source). **Accept:** `genui-surface-prompt.test.ts` SPEC-R10 AC3 cases —
   on/off byte-identity, exclusive interplay — green with no baseline recapture of the four
   existing compositions.
10. Baseline field `genuiDogfoodTeaching` + equivalence-gate extension (sanctioned scratch-spec
    recapture flow); `prompt-drift.test.ts` inventory leg. **Accept:** `npm test` exit 0; a
    one-char teaching edit reds equivalence (negative control, reverted).

### S4 — LLD-C4: plumbing + surfaces (seat: builder; after S2+S3)

11. `validateGenuiSurface` `dogfood` per-field degrade (+ tests, the `exclusive` cases cloned).
12. agent-admin Surface Options toggle ("Use agent-ui components") + store persistence + live-apply
    + frame-mount asset pass-through. **Accept:** existing Surface Options store/live-apply test
    patterns extended; default-off renders the row byte-identically.
13. `gen-ui-live.ts` toggle + `host.assets` + request `dogfood`. **Accept:** page tests green;
    recorded-transcript default path unchanged.

### S5 — LLD-C5: cross-half gates + full sweep (seat: whoever holds S4)

14. Three-way set-equality test (`DOGFOOD_TAGS` ≡ inventory tags ≡ descriptor-bearing barrel
    controls; planted-extra negative control each direction).
15. Full gates: `npm run check && npm test` exit 0 + `npm run test:browser` all six shards exit 0,
    FOREGROUND. A2UI conformance suite zero regressions (PRD §8 m4's standing bar).

### Proof-of-mode (manual, named — not a standing gate)

One live turn on `gen-ui-live` with dogfood ON yielding markup that exercises `ui-*` components +
tokens where a dogfood-OFF turn on the same prompt yields plain HTML — the GH #316 acceptance
demonstration. (The judged fleet-idiom eval dimension stays deferred with B3.)

## Test plan roll-up

| Class | Where | Gate |
|---|---|---|
| Determinism/freshness/purity of the asset pair | `dogfood/dogfood-assets-freshness.test.ts` | `npm test` |
| srcdoc ordering + absent-assets byte-identity | `bootstrap.test.ts` | `npm test` |
| Upgrade + token paint in-frame · containment re-proof | `sandbox-frame.browser.test.ts` | `npm run test:browser` |
| Prompt on/off byte-identity + exclusive interplay | `genui-surface-prompt.test.ts` | `npm test` |
| Teaching byte-pin · inventory drift + budgets | `prompt-equivalence.test.ts` / `prompt-drift.test.ts` | `npm test` |
| Set-equality (bundle ≡ prompt) | new gate beside `gates.test.ts` | `npm test` |
| Trust-boundary degrade | `validate-genui-surface.test.ts` | `npm test` |
| Admin toggle store/live-apply | `agent-admin.test.ts` | `npm test` |
