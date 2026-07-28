# ADR-0162 — GenUI agent-ui dogfood mode (GH #316): an opt-in per-turn mode that loads the fleet's docs-page asset set (CSS + the self-defining component bundle, delivered INLINE under the unchanged CSP) into the sandboxed frame, and injects descriptor-derived dogfooding prompt modules into the LLM payload — off = byte-identical to today on both surfaces

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-28 |
> | **Proposed by** | design intake seat ([GH #316](https://github.com/kimgranlund/agent-ui/issues/316) — Kim's 2026-07-28 ruling: dogfooding is "a mode that can be enabled", dictating BOTH ends of the pipeline: a docs-like iframe asset setup AND dogfooding knowledge skills in the LLM payload; off = today's behavior byte-identical) |
> | **Ratified by** | — |
> | **Repairs** | `.claude/docs/spec/genui-surface.spec.md` (the v0.5 §11 amendment this record ratifies: SPEC-R12 frame assets · SPEC-R13 dogfood prompt modules · the SPEC-R10 dogfood clause) · on build: `packages/agent-ui/components/src/controls/sandbox-frame/{sandbox-frame.ts,bootstrap.ts,sandbox-frame.md}` + a new `dogfood/` sibling (the committed generated asset module + its freshness gate) · `packages/agent-ui/a2ui/src/agent/{genui-surface-config.ts,system-prompt.ts}` + `prompts/genui-dogfood-teaching.md` + a new `dogfood-inventory.ts` · `tools/agent/chat-validation.ts` · `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (the Surface Options toggle) · `site/pages/gen-ui-live.ts` |
> | **Supersedes / Superseded by** | Extends [ADR-0091](./0091-a2ui-gen-ui-mini-skill-registry.md) (the mini-skill/prompt-module injection shape this mode's prompt leg follows) and [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the prompt-file + byte-pinning mechanics) and [ADR-0004](./0004-component-descriptor-md-frontmatter.md) (the ONE descriptor parser the derived inventory reads). Amends (via the SPEC §11 amendment) the genui-surface SPEC's SPEC-R5 srcdoc build ordering and SPEC-R10 prompt block. Relates [ADR-0071](./0071-a2ui-derived-drift-gated-system-prompt.md) (derive-then-drift-gate, the discipline the inventory half adopts instead of byte-pinning) · [ADR-0040](./0040-foundation-barrel-budget-7kb.md)/[ADR-0049](./0049-family-barrel-budget-22kb.md) (why the asset module is a subpath, never the default barrel) |

## Context

GenUI today (genui-surface SPEC v0.4, shipped B1+B2) renders model-authored HTML inside
`ui-sandbox-frame`'s bare atomic srcdoc: the frame gets a CSP meta, the `--md-sys-*` token bridge,
and the bootstrap — nothing else. The model is taught (`prompts/genui-teaching.md`) to author
self-contained plain HTML/CSS/JS. The fleet's own components never appear in a GenUI surface, and
nothing teaches the model they exist.

Kim's GH #316 ruling makes agent-ui dogfooding an **opt-in mode** with two coupled halves:

1. **Frame half** — mode-on, the GenUI iframe loads the same asset set a docs page loads
   (`site/pages/_page.ts`'s load-bearing cascade: foundation tokens CSS → per-component CSS → the
   self-defining `ui-*` controls → the Phosphor icon pack), so model-authored fleet markup renders as
   real, upgraded fleet components.
2. **Prompt half** — mode-on, the LLM payload gains dogfooding knowledge modules teaching the model
   to prefer `ui-*` components, tokens, and fleet idioms.

Mode-off must be byte-identical to today on BOTH surfaces (the fleet's standing opt-in law — the
`mode`/`miniSkills`/`genui`/`exclusive` zero-regression precedent chain).

The load-bearing mechanical findings this record decides FROM:

- **The real CSP already permits everything the docs-like setup needs.** `csp.ts` composes
  `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` (SPEC-R4's ruled v1 floor — the whole
  document is model-authored; inline script IS the payload). An inline `<style>` carrying the fleet
  CSS and an inline `<script>` carrying the component bundle ride that policy AS-IS. What the CSP
  does NOT permit — and what any non-inline delivery would force open — is URL-based loading:
  a `<link rel=stylesheet>`, a CSS `@import`, an external `<script src>`, or a `blob:`/served-asset
  scheme would each require widening `style-src`/`script-src`, and SPEC-R3/R4's closed-table law
  makes any widening a SPEC amendment + a Kim ruling.
- **CSS alone does not reproduce a docs page.** The fleet is light-DOM with JS-built internal
  anatomy: controls render their `[data-part]` structure at upgrade (button label wrapper, field
  editor cell, select caret), and interactive controls (menu, select, tabs, slider, disclosure) ARE
  their behavior. A bare `<ui-button>` styled by component CSS is an unknown inline element with a
  border — not the docs-page rendering Kim named as the spec.
- **The bundle adds zero capability across the boundary.** The component bundle executing inside
  the sandbox is just more script in a context DESIGNED to run untrusted script: same opaque origin,
  same denied storage, same closed network, same closed bridge. Containment (D6/SPEC-R3/R4) is
  indifferent to whether the frame's script came from the model or from the host's asset pair.
- **Fleet-in-sandbox compatibility holds by existing law.** The fleet uses no native form elements
  (CLAUDE.md — so `allow-forms` staying OUT is moot), no `alert`/`confirm`/`prompt`, ARIA via
  `ElementInternals`; the icon pack is build-time vendored (ADR-0066 — no network fetch). One
  verification item rides the build: the built CSS/JS must reference no external `url(...)` beyond
  `data:` (a standing grep gate, not an assumption).
- **The prompt stack already has both pinning disciplines this needs.** Hand-authored prose is
  byte-pinned (`prompt-equivalence.baseline.json`, ADR-0135 cl.15 — edit ⇒ deliberate re-capture);
  DERIVED content is drift-gated instead (`catalogInventory` + `prompt-drift.test.ts`, ADR-0071 —
  derived-at-compose-time, asserted equal to its source, never frozen as bytes). Pinning a derived
  fleet inventory into the byte baseline would make every fleet descriptor edit a world re-capture;
  ADR-0071's discipline avoids exactly that.
- **The flag has a ready home.** `GenuiSurfaceConfig` (SPEC-R10) already carries per-turn GenUI
  facts (`enabled`/`sourceBody`/`exclusive`), rides `ProduceOptions.genuiSurface`, is validated
  per-field at the trust boundary (`validateGenuiSurface`), and surfaces in agent-admin's Surface
  Options GenUI row + `gen-ui-live`'s options strip. The `exclusive` field (SPEC v0.4 §10) is the
  exact additive precedent.
- **Feasibility of a built bundle artifact** — GH #283's install smoke: the published packages
  bundle cleanly under esbuild/webpack (browser-only by construction, which the sandbox satisfies);
  `site/lib/build-css.ts` already shells a REAL `vite build` and joins the emitted CSS for tests
  (the LLD-C11 committed-fixture + freshness-gate precedent).

## Decision

1. **Dogfood is a per-turn boolean on the existing config: `GenuiSurfaceConfig.dogfood?: boolean`**
   — additive, validated with the same per-field-degrade posture as `exclusive` (a non-boolean drops
   the field, never the whole `genui` object); absent/`false` is byte-identical to today on every
   surface it touches. It rides `ProduceOptions.genuiSurface` through both HTTP transports
   unchanged. **The wire does NOT carry it**: the `{"genui":{surfaceId, html}}` envelope (SPEC-R1)
   stays closed — the consumer that enabled the mode also owns the frame it mounts, so it passes the
   frame assets itself. (Honest consequence, recorded: a transcript recorded mode-on and replayed by
   a consumer that doesn't inject assets renders unstyled fleet markup — degraded fidelity, never a
   protocol break.)

2. **Frame half: CSS + the component bundle (the full docs-like setup), delivered INLINE, CSP and
   sandbox posture UNCHANGED.** A committed, GENERATED asset pair — the flattened foundation +
   component CSS text, and a single-file, self-contained IIFE bundle of the `ui-*` component barrel
   + the Phosphor pack (the `_page.ts` cascade's [1][2][3][3b], minus site/app chrome) — exported
   from a new opt-in subpath of `@agent-ui/components` (never the default barrels: ADR-0040/0049's
   budgets stay untouched). `ui-sandbox-frame` gains a property-only `assets` prop
   (`{ css?: string; js?: string }`); `buildSrcdoc` injects them between the host-owned prelude and
   the model bytes — head order: CSP meta → token `<style>` → asset `<style>` → bootstrap
   `<script>` → asset `<script>` → the model document's own head children. The SPEC-R2 512 KiB cap
   is measured on the wire's `html` string and is NOT consumed by host-side asset injection.
   CSS-only (rejected): unfaithful to "just like our docs pages" for the light-DOM/JS-anatomy
   reasons above. Blob/served-asset delivery (rejected): forces `script-src`/`style-src` widening —
   a safety-story change with no benefit inline delivery doesn't already have.

3. **Version pinning is BY CONSTRUCTION plus a freshness gate.** The asset pair is generated from
   the installed source tree by a checked-in script (real `vite build`, the `build-css.ts`
   mechanics); a standing gate rebuilds and compares (the theme-provider LLD-C11 committed-fixture
   precedent) so a fleet edit that changes the built output reds until the asset is regenerated —
   a drifting copy is structurally impossible to ship green.

4. **Prompt half: one dogfood block, two pinning disciplines.** Mode-on, `genuiBlock` (SPEC-R10)
   composes ONE additional dogfood segment after the base wire/sandbox teaching and before a picked
   source's body: (a) a hand-authored `prompts/genui-dogfood-teaching.md` — the frame now contains
   the agent-ui runtime; author `ui-*` markup + `--md-sys-*`/`--ui-*` tokens first, plain HTML only
   for what the fleet lacks — byte-pinned by a NEW field in the equivalence baseline (the
   `genuiPacks` shape); (b) a DERIVED fleet inventory (`dogfoodInventory()`) built at compose time
   from the fleet's `{name}.md` descriptors via the ONE ADR-0004 parser (Node-side, ADR-0135
   `process.cwd()` mechanics) — tag, one-line role, key attributes/enums — drift-gated against the
   descriptors (the ADR-0071/`prompt-drift` discipline), NEVER byte-captured, so a fleet edit
   updates the composed prompt automatically without re-capturing the world.

5. **The two halves are set-equal by gate.** The tags the asset bundle self-defines and the tags the
   derived inventory teaches are asserted SET-EQUAL by a standing test (the `{{FEED_SURFACE_TYPES}}`
   derive-from-one-source spirit): the prompt can never teach a component the frame doesn't define,
   and vice versa.

6. **Budgets, stated and gated.** The dogfood teaching body ≤ 8 000 chars (the SPEC-R9 pack-tier
   budget); the derived inventory ≤ 16 000 chars (~4 000 tokens — measured headroom over today's
   ~56-component fleet at ~2 lines each), enforced by a standing test; both evidence-revisable per
   the SPEC's §8 discipline. Mode-off composes ZERO bytes — the existing equivalence baseline's four
   composed prompts stay byte-identical, proven by the existing gate without re-capture.

7. **Surfacing:** agent-admin's Surface Options GenUI row gains a dogfood toggle beside the
   pattern-source picker (store discipline + live-apply, SPEC-R11's laws); `gen-ui-live` gains the
   same toggle in its options strip. Persona config is NOT the home — dogfood is a surface
   capability fact, not a voice fact (the ADR-0138 boundary).

## Consequences

- The GenUI safety story survives verbatim: no sandbox token changes, no CSP directive changes, no
  bridge vocabulary changes. The one new trust statement — host-vetted fleet code runs inside the
  untrusted-code boundary — is a no-op by construction and is recorded, not assumed.
- Per-surface srcdoc weight grows by the asset pair (est. a few hundred KiB uncompressed per mounted
  mode-on surface; measured at build, recorded in the asset module's header). Bounded and
  session-local; the SPEC-R2 wire cap is unaffected.
- The committed generated asset module is a large binary-ish text file in git, regenerated on fleet
  changes that alter built output — the freshness gate makes staleness loud. This is the accepted
  cost of CSP-neutral inline delivery.
- `router`, `code` (CodeMirror), and app-level chrome (`super-shell`, `nav-rail`) stay OUT of the
  in-frame set by construction: catalog-invisibility (ADR-0115/0119) extends naturally — the
  dogfood set is the components fleet, not the app shell; CodeMirror's lazy network load could not
  ride the closed CSP anyway.
- B3's judged eval gaining a fleet-idiom dimension stays deferred with B3 (named in GH #316, not
  scheduled here).
