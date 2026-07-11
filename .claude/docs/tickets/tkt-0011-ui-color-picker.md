---
doc-type: ticket
id: tkt-0011
status: open
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0011 — `ui-color-picker`: the color-input control

## Summary
Kim's ask (2026-07-10): a `ui-color-picker` — learn from
`https://ui-kit.exe.xyz/site/components/color-picker` and
`/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/components/color-picker/`
(exists, verified — full component incl. `color-picker.test.js`). Dedup: **greenfield as a
control, with a NAMED fence to honor** — ADR-0118 (token-surfaces, the concurrent
design-system intake) deliberately excluded exactly this scope from its display family:
*"a color picker owes channel models, gamut UI, precision input"* (0118 Context). This
ticket IS that fence's other side: ui-swatch/ramp/ladder DISPLAY color values; the picker
INPUTS them — complementary jobs, and the intake must keep the boundary crisp (a picker may
well COMPOSE a swatch; it never re-owns value rendering). No text-field `type` covers color
(the 12-type enum has none).

## Research inputs (for the design intake, recorded verbatim)
- The exe.xyz color-picker docs page (fetch at intake).
- The adia family: `color-picker.class.js` (interaction model), `.css` (the pad/channel
  geometry), `.test.js` (proven behaviors), `.a2ui.json` (its old catalog shape); promote to
  this fleet's laws, never port.

## Acceptance
- A design intake via `agent-ui-component-design` resolves the forks before any build:
  - **The value model** — what `value` speaks (hex/rgb/hsl/oklch) and the CANONICAL form,
    as a color **value-codec** in the ADR-0044/0047 codec dialect (parse/format/validity).
    This fleet's tokens are OKLCH-native — argue whether the canonical form follows
    (OKLCH-canonical, hex-interoperable?) or stays sRGB-hex for the web's lingua franca;
    gamut handling fenced explicitly either way.
  - **The vehicle(s)** — standalone `ui-color-picker` (a value-bearing `UIFormElement`
    composite) AND/OR a `text-field type=color` leg that lazily composes it into the Wave-4
    overlay — **the ADR-0048 calendar precedent is exact** (type=date → overlay calendar);
    argue both-now vs standalone-first-with-a-trigger.
  - **The 2D interaction** — the saturation/lightness pad is a genuinely new interaction
    class (the `value-drag` trait covers 1D sliders; a 2D pad + hue/alpha channel sliders is
    the novelty leg firing): keyboard stepping in TWO axes, the ARIA model for a 2D slider
    (the hardest a11y in the ask — design it first, not last), pointer capture, and the
    channel sliders likely REUSING `ui-slider`'s machinery where honest.
  - **Anatomy** — pad · channel sliders · value readout/input · optional preset swatches
    slot (position slots × roles); whether the readout is an embedded `ui-text-field`.
  - **Geometry** — pad/channel/swatch quantities under the `[scale]` lookup dialect
    (ADR-0038); size-class assignment (likely Pattern; the novelty leg may propose rows).
  - **Catalog posture** under ADR-0087 — an agent asking a user to pick a color is
    plausible Gen-UI (forms, theming asks); argue it, don't default it.
  - Events ⊂ allowlist (`input` while dragging · `change` on commit — the slider precedent);
    eyedropper (the `EyeDropper` API — Chromium-only; propose as a progressive-enhancement
    fork or non-goal); forced-colors/contrast behavior of the pad itself.
- The shipped control meets the full per-control bar (descriptor, jsdom + cross-engine
  browser probes incl. whole-shape + REAL pointer-drag geometry + the 2-axis keyboard
  proof, independent review, barrels/exports/size, doc + demo pages).

## Links
- The two research inputs above.
- ADR-0118 (`.claude/docs/adr/0118-token-surfaces-v1-scope.md`) — the fence this ticket is
  the other side of; its ui-swatch is the display counterpart (compose, never re-own).
- ADR-0044/0047 (the value-codec dialect) · ADR-0048 (the type=date → overlay-calendar
  composition precedent) · ADR-0038 (geometry lookup) · ADR-0087 (catalog posture).
- `packages/agent-ui/components/src/traits/value-drag.ts` — the 1D precedent the 2D pad
  extends or siblings.
- `.claude/skills/agent-ui-component-design/` — the intake procedure.

## Scope / Open
- **Open:** alpha channel in v1 (prior art likely has it — verify at intake); preset/recent
  swatches (slot vs prop vs non-goal); the OKLCH-vs-sRGB canonical question above (the one
  fork that touches the design system's identity — Kim likely wants a say); whether the
  token-surfaces family's `ui-swatch` (in design, other session) ships first and gets
  composed, or the picker renders its own preview until it exists (sequencing dependency).
- **Non-goal:** porting either prior art's full API; palette GENERATION (palette-design is
  a skill/tooling concern, not this control); re-owning ADR-0118's display surfaces.
- **Sequencing:** design intake first; no build from this ticket directly. Queue: fourth
  behind TKT-0008/0009/0010, Kim's call on order.

## Findings

- **2026-07-10 — Design intake complete (docs only, no code).** Ran `agent-ui-component-design`. Records
  authored: **ADR-0123** (`../adr/0123-ui-color-picker-value-model-and-2d-input.md`, status `proposed`, README
  row added) · **SPEC** (`../spec/color-picker.spec.md`, SPEC-R1…R12) · **LLD** (`../lld/color-picker.lld.md`,
  LLD-C1…C9 + a frozen-interface-vs-real-code proof table) · **decomp**
  (`../decompositions/color-picker-ship.decomp.json`, `coverage_check.py --strict` clean, exit 0). No PRD
  (single-control intake — the ADR-0117/theme-provider deviation, recorded in the SPEC header).
- **Classification:** base class `UIFormElement` (a composite — no `_base/` family fits); size-class
  **`pattern`** (no new geometry row — the pad is a sized surface, channels are Indicator `ui-slider`s, the
  readout is a Control `ui-text-field`); catalog posture **emittable** (`ColorPicker`, argued via ADR-0087).
- **Research:** the exe.xyz docs page returned an empty SPA shell on fetch (recorded, as the toolbar/timeline
  intakes hit) — the design leans on the adia `color-picker` family, read in full and **promoted, not ported**.
- **Open questions RESOLVED at intake:** (a) **alpha** — the adia prior art has NO alpha channel (verified in
  `color-picker.class.js`, only `#L/#C/#H`); v1 recommends **no alpha** (F6). (b) **`ui-swatch` sequencing** —
  `ui-swatch` is already SHIPPED (`controls/swatch/`), so the preview composes it now (no bespoke preview). (c)
  **presets** — a `[slot=presets]`, not a prop (palette generation stays a non-goal).
- **Fork recommendations for Kim** (all `proposed`, none self-ratified): **F1 (the one that touches design-system
  identity — flagged for Kim's ruling):** OKLCH-internal model, `value` serialized per `format` (default
  **sRGB hex**, `oklch` opt-in), gamut-mapped to sRGB before hex — serves web interop AND the fleet's
  OKLCH-native tokens; sub-fork = canvas pad. **F2 (the 2D-pad a11y):** a new `area-drag` trait; the composed
  per-channel `ui-slider`s are the accessible spine (a keyboard/SR user never needs the pad); the pad is a
  `role=slider`+`aria-roledescription="2D slider"` accelerator with cross-announcing `aria-valuetext` — there is
  **no blessed WAI-ARIA 2D-slider role** (verified vs the APG + react-aria/Adobe-Spectrum ColorArea, which
  synthesize one from two hidden inputs). **F3:** standalone-first + a `type=color` lazy-overlay leg (ADR-0048
  seam). **F4:** editable `ui-text-field` readout + composed `ui-swatch` preview + presets slot. **F5:** catalog
  emittable (M2 follow-on wave, `FEED_EXCLUDED`). **F6:** no alpha v1. **F7:** feature-detected EyeDropper
  (progressive enhancement).
- **Doc-review:** three fresh-context `doc-reviewer` passes (ADR/SPEC/LLD), pre-armed on the blockquote house
  style + the frozen-interface check; findings applied; the design is frozen. The build dispatches only on Kim's
  F1 ruling + the review PASS.
- **2026-07-10 — Doc-review log (three fresh-context `doc-reviewer` passes; all findings applied).**
  - **ADR** — PASS (fix-then-ship). Applied: chroma-not-saturation vocabulary (coupled to the F1 ruling);
    re-anchored the codec-dialect citation to ADR-0047 (0044 is the wave, 0047 the dialect); resolved the
    oklch-mode preview WYSIWYG tension (preview tracks the serialized `value`); noted F1 is the explicit-ruling
    exception; corrected the ADR-0112 cl.6 example to `Toast`/`ToastRegion` (ThemeProvider is 0117).
  - **SPEC** — REVISE → applied. **MAJOR**: EyeDropper (F7) was claimed-recommended but uncontracted →
    **added SPEC-R13** (feature-detected, both-branch ACs) + trace row. Also: SPEC-R2 restated as the
    unambiguous five-attribute fence; added the unset-but-displayed default-color contract (§2 + SPEC-R9 AC4);
    trace SPEC-R6 corrected to `n10` only; softened the SPEC-R11 literal import path to LLD-owned.
  - **LLD** — REVISE → applied. **TWO frozen-interface MAJORs the check exists to catch:** (1) `this.syncValue()`
    is INVENTED (zero matches in-tree) — the form value syncs via the base effect `internals.setFormValue(
    formValue())` at `dom/form.ts:174`; removed from §3 + §5. (2) `OverlayHandle` methods are `open/close/toggle/
    cleanup`, NOT `show/hide` — corrected §5 + §10. Also: readout validity reads a control-owned `#readoutError`
    (the standalone doesn't instantiate the `valueCodec` controller); added a §12 Risks section
    (WebKit-tab-near-`[popover]` instrument-bridge, canvas DPR cost, gamut 8-iteration bound); aria-label
    chroma-not-saturation.
  - Gates re-verified after revisions: `coverage_check.py --strict` clean (exit 0, 34 nodes); `site/lib/adr.test.ts`
    33/33 green.
- **2026-07-11 — M1 + M1b BUILD complete (ADR-0123 ratified, Kim's F1 = OKLCH-internal).** Shipped: the standalone
  `ui-color-picker` (pad + area-drag trait + hue/chroma/lightness `ui-slider` channels + editable
  `ui-text-field` readout + composed `ui-swatch` preview + EyeDropper progressive enhancement + presets
  slot), `color.ts` (OKLCH↔sRGB + gamut-map + `colorCodecOptions`, promoted from adia, zero-dep/pure), the
  new `traits/area-drag.ts` (the 2-axis sibling of value-drag), and the `ui-text-field type=color` leg
  (13th type, lazy overlay, the ADR-0048 seam). Descriptor, jsdom (64 tests: color.test.ts 20 + area-drag
  6 + color-picker.test.ts 38 incl. the contract trip-wire) + cross-engine browser (10 tests × 2 engines,
  whole-shape + real 2-axis pointer-drag + real keyboard + forced-colors + EyeDropper both branches) +
  text-field's own new type=color coverage (9 jsdom + 5×2 browser). M1 seeded `EXCLUSION_ALLOWLIST`
  (`'ColorPicker'`, a2ui/catalog/default/index.test.ts) — M2 (catalog row + exemplar + §5.2 +
  `FEED_EXCLUDED`) is a follow-on wave, not yet built. Site pages (color-picker-doc/-demo), nav, llms.txt
  landed. Family barrel budget re-based 38→44 KB (measured 42587 B gz; ADR-0123's own Consequences named
  this re-base as expected for "the largest single control yet"); color-picker's own per-control marginal
  is negative (shared bytes already counted via text-field's static swatch/codec pull — the split/swiper
  gzip-dictionary artifact). Two real bugs found and fixed during the build (recorded for the pattern,
  not just the fix): (1) the pad's drag-baseline for "a drag that returns to its start fires no change"
  must be captured AFTER the drag's own first jump (inside `onValue`), not before (on `pointerdown`) — the
  UIRangeElement `#committed`-on-`focus` precedent captures the POST-jump value, since native
  mousedown-driven focus fires after `pointerdown`'s own dispatch; capturing before it compares against a
  stale pre-touch baseline. (2) a synchronous, untracked-less read of `this.value` inside the swatch-
  button's one-time creation code (called from within the type-effect's own scope) silently added `value`
  as a dependency of the WHOLE type-effect, rebuilding the codec (and wiping its `hasError`) on every
  keystroke — fixed with `untracked(() => this.value)`, the value-codec.ts `canonical` seed precedent.
  Judgment calls flagged for review: no dedicated EyeDropper icon exists in `@agent-ui/icons`'s small
  curated set — used a plain text-labeled button rather than inventing a new icon asset; the picker's
  `change` does NOT auto-close the `type=color` overlay (unlike the calendar leg) — one channel/gesture
  commit is not "the user is done," closing is left to the overlay's own light-dismiss; the pad's
  `applyFieldLabelling` merge (field label + the fixed axis description) is a string-concat synthesis, not
  explicitly specified by the LLD. Gates green repo-wide (`npm run check`; jsdom 5492/5494 — the two
  pre-existing, explicitly-allowed red fixtures unchanged; browser suite scoped to the touched files, both
  engines; `npm run size` exit 0). No commits made — the coordinator routes the independent review.
