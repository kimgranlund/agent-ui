# ADR-0123 — `ui-color-picker` — the color-INPUT control: an OKLCH-internal / hex-canonical value model, a new 2-axis pad interaction class, and the standalone-first vehicle

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-10
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-10 |
> | **Proposed by** | planner (design seat — the `ui-color-picker` design intake, [TKT-0011](../tickets/tkt-0011-ui-color-picker.md)) |
> | **Ratified by** | Kim, 2026-07-11 — hand-flipped in-tree (07:01 PT) + confirmed at the ratification prompt |
> | **Repairs** | NEW [`../spec/color-picker.spec.md`](../spec/color-picker.spec.md) + NEW [`../lld/color-picker.lld.md`](../lld/color-picker.lld.md) + NEW [`../decompositions/color-picker-ship.decomp.json`](../decompositions/color-picker-ship.decomp.json) (authored in this same change — the owning docs whose contract this ADR pins) |
> | **Supersedes / Superseded by** | (none) — **it is the edit-class other side of [ADR-0118](./0118-token-surfaces-v1-scope.md)** (`ui-swatch`/`ramp`/`ladder` DISPLAY color, this INPUTS it; 0118 Context names "a color picker owes channel models, gamut UI, precision input" as exactly the out-of-scope edit family — this ADR opens that scope). Relates [ADR-0044](./0044-contenteditable-password-masking.md)/[ADR-0047](./0047-numeric-codec-expansion.md) (the value-codec parse/format dialect the color codec joins) · [ADR-0048](./0048-date-time-picker-architecture.md) (the `type=date` → lazily-imported overlay-`ui-calendar` composition precedent the `type=color` leg copies verbatim) · [ADR-0042](./0042-face-widget-value-control-bases.md) (`UIRangeElement`/`ui-slider`, the channel-slider machinery this composes) · [ADR-0038](./0038-control-sizing-size-scale-row-lookup.md) (the geometry lookup the composed rows obey) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (the catalog-or-allowlist gate) · [ADR-0057](./0057-intent-non-color-signifier-rule.md) (non-color signifier — load-bearing for a control whose subject IS color) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (every default survives the CSS-less consumer) |

## Context

Kim's ask (TKT-0011): a `ui-color-picker`, learning from `https://ui-kit.exe.xyz/site/components/color-picker`
(the docs page returned an empty SPA shell on fetch — recorded, as the toolbar/timeline intakes hit the same
wall) and the `adia/gen-ui-kit` `color-picker` family (read in full: `class.js` interaction model, `.css`
geometry, `.test.js`, `.a2ui.json`). The dedup is clean — no `ui-*` control edits color, and none of
`ui-text-field`'s twelve `type`s is `color`.

**The fence is named and load-bearing.** ADR-0118 admitted a Display-class token-surface family and drew its
v1 fence in exactly these words: *"the moment a surface edits rather than shows, it changes class and explodes
scope (a color picker owes channel models, gamut UI, precision input)."* This ADR is the sanctioned crossing
of that fence — a new **edit-class** control. The boundary stays crisp: `ui-color-picker` may **compose**
`ui-swatch` (now shipped) for its preview; it never re-owns value rendering. `ui-swatch` shows one color;
`ui-color-picker` produces one — complementary jobs on the same value grammar.

Two fleet laws bound the solution and one prior-art fact settles a ticket open question:

1. **The zero-dependency pillar + internals-only ARIA + no-native-form-elements** rule out a literal port of
   the prior art (which uses `<input type=range>` channels and would pull a color library if it needed one).
   A picker, unlike a swatch, **cannot** hand its math to the browser: there is no platform API that converts a
   pointer position on a perceptual field to a color, or gamut-maps an out-of-sRGB OKLCH triple back into the
   monitor's gamut. **The math is unavoidable for an input control** (this is precisely why ADR-0118 fenced it
   out of the display family) — the design question is not *whether* to carry color math but *which* math and
   *what `value` serializes*.
2. **The prior art has NO alpha channel** (verified — `adia/color-picker.class.js` carries only `#L/#C/#H`, an
   OKLCH area + hue track, no alpha). The ticket's open "alpha in v1?" question resolves against prior art: **no.**

The genuinely new thing is the **interaction class**: the fleet's `value-drag` trait (LLD-C4 of the range
family) is 1-D — it maps `clientX` to one `[min,max]` value (verified: `ratioFromX` reads only `clientX`; there
is no Y axis). A 2-D chroma/lightness pad (the OKLCH axes — "saturation" only under an HSV ruling, F1 alt (a))
is a new mechanism, and the hardest part of the ask is its
accessibility: **there is no blessed WAI-ARIA "2D slider" role** (verified against the APG and the
react-aria/Adobe-Spectrum ColorArea prior art — they synthesize one from two hidden range inputs +
`aria-roledescription="2D Slider"` + cross-announcing `aria-valuetext`). The a11y model is therefore a real
fork with argued alternatives, designed first here, not bolted on last.

## Decision

**We will admit `ui-color-picker` into the fleet — a Pattern-class `UIFormElement` composite that edits one
color value through a 2-axis pad + channel sliders + an editable numeric readout, on an OKLCH-internal model
whose `value` serializes to a `format`-selected syntax (default sRGB-hex, opt-in `oklch`), gamut-mapped into
sRGB. It composes `ui-swatch` for preview and `ui-slider` for its channels; it introduces one new trait
(`area-drag`, the 2-axis sibling of `value-drag`) and one new value codec (`colorCodecOptions`). A
`ui-text-field type=color` leg lazily composes it into the Wave-4 overlay, byte-for-byte on the ADR-0048
`type=date`→`ui-calendar` seam. It enters the default catalog.** One decision — the control's contract and its
value grammar — realized in eight clauses; SPEC/LLD own the mechanisms at build.

1. **Base class, tag, size-class** *(F-classification)*: `ui-color-picker`, class `UIColorPickerElement`
   extending **`UIFormElement`** (a value-bearing form control; NOT a raw base — no `_base/` family fits: it is
   neither one Indicator, one Range, nor one Listbox, but a composite of them), folder
   `controls/color-picker/`, self-defining on import. Size-class **`pattern`** (`geometry.md`: "container +
   control-height rows" — the pad is a sized surface, the channel rows are Indicator-class `ui-slider`s, the
   readout is a Control-height `ui-text-field`; the picker shell uses the space scale). **No new geometry ROW
   is invented** — the pad's block-size is a bespoke density-invariant `--ui-color-picker-pad-*` token (the
   `ui-swatch` box / `ui-calendar` cell precedent), and every interactive descendant sizes through *its own*
   class under the ADR-0038 `(scale × size)` lookup. The novelty is the interaction (clause 4), not the metric.

2. **The value model — OKLCH internal, `format`-selected canonical, sRGB-gamut-mapped** *(F1 — THE fork)*: the
   control's internal working model is **OKLCH** (`#L`/`#C`/`#H`), because the perceptual axes make an honest
   pad and OKLCH is the fleet's token-native space (tokens.css is OKLCH; the ultimate-tokens generator emits
   OKLCH). The **`value` prop serializes to the `format` prop's syntax** — `format: enum(['hex','oklch'],
   'hex')`, default **sRGB hex** (`#rrggbb`) for the web's lingua franca, form-submission convention, and
   `<input type=color>` parity; `format="oklch"` emits `oklch(L C H)` for the fleet-native / token-authoring
   use. This is the value-codec dialect's own canonical-vs-display split (the `valueCodec` seam introduced in the
   ADR-0044 wave, generalized to the parse/format/`errorMessage` codec dialect by ADR-0047) applied to color: a
   new `colorCodecOptions(format)` factory owns `parse`(any accepted syntax → internal OKLCH)/`format`(internal
   → the `format` syntax)/`errorMessage`, reused as pure functions by the standalone control AND wired through
   the `valueCodec` trait for the `type=color` text-field readout. **Gamut fence, explicit:** before any hex
   serialization the OKLCH triple is gamut-mapped into sRGB by binary-search chroma reduction (the adia
   proven mechanism, promoted not ported — pure functions, zero-dep); `format="oklch"` MAY emit values at the
   authored chroma (a swatch of it resolves through the browser). No P3/wide-gamut output in v1. **The preview
   swatch tracks the serialized `value` itself** (not a separately-mapped color), so the preview always matches
   `value` by construction — in `oklch` mode it shows the authored color the browser resolves, in `hex` mode the
   gamut-mapped hex; no WYSIWYG split (LLD-C2).

3. **The vehicle(s) — standalone first, `type=color` as the lazy-overlay follow-on** *(F3)*: two vehicles, one
   contract, sequenced. **(a)** the standalone `ui-color-picker` is the real control — the pad, channels,
   model, and codec live here; it is the buildable unit and ships first. **(b)** a `ui-text-field type=color`
   leg (the fleet's 13th type) that on the trailing swatch-affordance's first activation lazily
   `import('../color-picker/color-picker.ts')` and mounts a `<ui-color-picker>` into a Wave-4 overlay popup —
   **the ADR-0048 decision-3 seam verbatim** (both the module dynamic-`import()` AND the popup element deferred
   to the same first-open moment; tree-shake holds because the static import-graph crawl does not match
   `import()`; the field's readout shows the hex + a `ui-swatch`). The text-field leg is a thin follow-on
   slice, not a second design.

4. **The 2-axis pad — a new interaction class, a11y designed as the spine not the accelerator** *(F2 — the
   novelty leg)*: the pad is a new mechanism with three parts.
   - **A new `area-drag` trait** — the 2-axis sibling of `value-drag`, same lifecycle discipline (host.listen
     pointerdown → setPointerCapture → per-drag AbortController aborted on any drag-end → rect re-read each
     move), mapping `(clientX, clientY)` on the pad rect to `(ratioX, ratioY)` and calling
     `onValue(x, y)`. `value-drag` is reused UNCHANGED by the composed `ui-slider` channels; `area-drag` is the
     honest new primitive the pad needs. It is a sibling, not an edit to `value-drag`.
   - **The accessible spine is the channel sliders, NOT the pad.** Because no blessed 2D-slider role exists, the
     control does not *depend* on the pad for accessibility: each channel (hue, and the pad's two axes) is a
     composed **`ui-slider`** — an already-audited `role=slider` with full arrow-key stepping, `aria-valuetext`,
     and form semantics from `UIRangeElement`. **A screen-reader or keyboard-only user can set every channel
     without ever touching the pad.** The pad is a *pointer/keyboard accelerator over two of those channels*.
   - **The pad's own a11y** (the accelerator layer): the `[data-part=pad]` is a single focusable
     `tabindex=0` element carrying `role="slider"` + `aria-roledescription="2D slider"` (the react-aria/Spectrum
     insight, adapted to the fleet's role-on-an-interactive-PART pattern — the `ui-calendar` `role=grid`-on-a-
     part precedent, since the host is the form element and the role rides the part, not `internals`), an
     `aria-label` naming both axes, and an `aria-valuetext` that **cross-announces both channel values** (e.g.
     "Chroma 0.12, Lightness 0.62" — the Spectrum cross-announce, so the one opaque thumb still orients a SR
     user). Two-axis keyboard: ←/→ step the X channel, ↑/↓ step the Y channel, Shift = coarse, Home/End → X
     min/max, PageUp/Down → Y min/max; a bespoke handler `preventDefault`s every nav key (the `ui-calendar`
     grid-keyboard precedent). Non-color signifier (ADR-0057) is intrinsic: every channel prints a numeric
     value, so the control never signifies by hue alone.

5. **Anatomy — pad · channel sliders · editable readout · preset slot** *(F4)*: light-DOM parts, created once
   (idempotent across disconnect/reconnect, the `ui-calendar` shell precedent):
   `[data-part=pad]` (the 2-axis area + thumb) · `[data-part=channels]` (the composed `ui-slider`s — hue
   always; the two pad axes mirrored as sliders for the a11y spine) · `[data-part=readout]` — an **embedded
   editable `ui-text-field`** whose `value` two-way-binds the picker's serialized value (this is the "precision
   input" ADR-0118 named as owed; typing `#3b82f6` or `oklch(...)` commits through `colorCodecOptions`) paired
   with a composed **`ui-swatch`** preview (compose the display sibling — the fence, honored) · an optional
   `[slot=presets]` for author-supplied preset/recent swatches (a SLOT, not a prop — palette GENERATION stays a
   non-goal; the author drops `ui-swatch`es or a `ui-ramp` in). Events ⊂ the allowlist: **`input`** (live,
   every drag-move / channel-step / pad key-step) · **`change`** (on commit — pointerup, channel blur, readout
   commit) — the `ui-slider` `input`-while-dragging / `change`-on-blur precedent exactly. No new event name.

6. **Catalog posture — EMITTABLE** *(F5 — argued, not defaulted)*: `ColorPicker` enters the default catalog
   with the ADR-0019 two-way seam `value:{prop:'value', event:'change'}`. ADR-0087's directive is "keep
   EVERYTHING in the catalog" for robust App usage, and **an agent asking a user to pick a color is plausible
   Gen-UI** (a theming ask, a "pick your team color" form field, a design-tool surface) — it is content, not
   page/app-owner chrome, so it fails the ADR-0112 cl.6 exclusion test (it is not a `Toast`/`ToastRegion`
   liveness shell — nor page-owner chrome like ADR-0117's `ThemeProvider`). The `type=color` leg needs no new row (`TextField` is already catalogued; `type` is an attribute).
   Following the ADR-0118/0107 wave discipline, the catalog row + a validator-clean exemplar + §5.2 usage
   guidance land in a **follow-on M2 wave** (M1 seeds the `EXCLUSION_ALLOWLIST`, M2 drains it to zero residue),
   keeping each wave one-context-sized. **Feed disposition** (the ADR-0097 total-partition gate): `ColorPicker`
   is an INPUT, not report/reference content — it joins `FEED_EXCLUDED` (no ask affordance admits an editor to
   the artifact feed). Bookkeeping entry owed at M2.

7. **Alpha is a NON-GOAL for v1; EyeDropper is progressive enhancement** *(F6, F7)*: **alpha** — no alpha
   channel (prior art has none; it keeps hex 6-digit, avoids RGBA + the checkerboard-transparency UI, and dodges
   the "what does gamut-mapping mean with transparency" question). An `#rrggbbaa` / `oklch(... / a)` format is a
   foreseen extension behind a future `format` value, fenced here. **EyeDropper** — a feature-detected
   (`'EyeDropper' in window`) affordance in `[data-part=channels]`/readout that appears ONLY where the Chromium
   `EyeDropper` API exists, opens the OS picker, and commits the sampled color; absent elsewhere with no
   polyfill and no layout hole. Progressive enhancement, never a hard dependency, never a non-Chromium
   breakage.

8. **Forced-colors honesty + the CSS-less consumer** *(clause, not a fork)*: a gradient pad **cannot** paint
   under `forced-colors: active` — like `ui-swatch`'s box, the color surface degrades (an explicit
   `@media (forced-colors: active)` block: the pad becomes a `Canvas` field with a `CanvasText`-bordered thumb,
   never a fake system color) and **the channel sliders + numeric readout become the authoritative input path**
   — they are real controls that survive WHCM, and the printed channel values are the accessible+WHCM data (the
   ADR-0118 "the printed value IS the content there" doctrine). A bare `<ui-color-picker>` in an unstyled
   container paints a visible, non-collapsed, operable control with zero consumer CSS (ADR-0102 Lane A): the pad
   gets a bespoke `--ui-color-picker-pad-block-size` default (the whole-shape law — a picker that collapses to
   a line is the `ui-slider` DOT bug's cousin). An explicit forced-colors probe asserts the channels + readout
   stay operable.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection — **except F1, which the build waits on an explicit ruling for, since it sets the value grammar every other clause encodes**)

- **F1 — the value model + canonical form (THE identity fork).** *Recommend: OKLCH-internal working model;
  `value` serialized per a `format` prop defaulting to **sRGB hex**, `oklch` opt-in; OKLCH gamut-mapped into
  sRGB before hex* (clause 2). This serves BOTH constituencies — hex for web interop / forms / `<input
  type=color>` parity, `oklch` for the token-native authoring Kim's ultimate-tokens app does — the way ADR-0118
  F2's value-first-with-var-lane served both. Live alternatives, each rejected with its cost: **(a)
  sRGB/HSV-internal, hex-only canonical** (cheapest math, pure-CSS pad, no gamut mapping — but abandons the
  fleet's OKLCH identity, gives a perceptually-nonuniform pad, and can't author the very tokens this fleet is
  built from); **(b) OKLCH-canonical, hex merely interoperable** (fleet-purest — but makes every form
  submission and every non-fleet consumer parse `oklch()`, and `<input type=color>` interop breaks); **(c) a
  color-math dependency** (rejected outright — the zero-dep pillar; the adia binary-search gamut map is ~40
  lines of pure functions, promoted). **This is the one fork that touches the design system's identity — Kim
  will want to rule it.** A sub-fork rides it: **pad rendering** — an OKLCH pad needs a **canvas** ImageData
  paint (per-pixel OKLCH→sRGB + gamut map; no CSS gradient is gamut-accurate), DPR-capped like adia; an HSV pad
  could be pure-CSS gradients. Recommend canvas, coupled to the OKLCH recommendation; the LLD owns the
  DPR/redraw mechanics and the test-plan consequence (canvas paint is browser-only truth — jsdom asserts
  model/ARIA/keyboard, the browser asserts thumb position + emitted value, never the canvas pixels).

- **F2 — the 2D interaction + its a11y model (the novelty leg).** *Recommend: a new `area-drag` trait +
  per-channel `ui-slider`s as the accessible spine + the pad as a `role=slider` /
  `aria-roledescription="2D slider"` accelerator with cross-announcing `aria-valuetext`* (clause 4). The honest
  alternative — **the adia single-`role=slider` pad with a composed-string `aria-valuetext` and no independent
  channel sliders** — is simpler DOM (one tab stop) but makes the pad the ONLY fine-adjust path and gives a SR
  user one opaque value with no per-axis control; rejected because it fails the "every channel independently
  reachable" bar. A second alternative — **two visually-hidden native `<input type=range>` per the literal
  react-aria pattern** — is rejected on the fleet's no-native-form-elements law; our composed `ui-slider`s are
  the fleet-honest realization of the same two-slider insight.

- **F3 — the vehicle(s).** *Recommend: standalone `ui-color-picker` FIRST, then a `type=color` text-field leg
  lazily composing it into the overlay (ADR-0048 seam)* (clause 3). Alternative — **both in one wave** — is
  rejected only on sequencing (the standalone is the dependency; the leg is a thin slice once it exists), not on
  design; **standalone-only, no `type=color`** is rejected because the compact "a swatch that opens a picker"
  affordance is the common form-field shape and the calendar precedent makes the leg nearly free.

- **F4 — anatomy / the readout.** *Recommend: embedded editable `ui-text-field` readout + composed `ui-swatch`
  preview + a `[slot=presets]`* (clause 5). Alternative — **a read-only value + copy button** (the adia shape)
  — is rejected because ADR-0118 explicitly named "precision input" as what a picker owes; an editable readout
  IS that precision path. Presets-as-prop is rejected (drags palette data + generation into the control — the
  non-goal); a slot keeps the author in control.

- **F5 — catalog posture.** *Recommend: EMITTABLE — `ColorPicker` catalog row + `value:{prop,event}` seam, in
  a follow-on M2 wave; `FEED_EXCLUDED`* (clause 6). Alternative — **permanent exclusion** — is rejected: a
  color ask is plausible agent content (unlike ThemeProvider chrome), so ADR-0087's "keep everything in"
  directive applies; the ADR-0112 cl.6 exclusion test does not catch an input control.

- **F6 — alpha in v1.** *Recommend: NON-GOAL (no alpha channel)* (clause 7). Prior art has none; alpha explodes
  into RGBA output formats + transparency UI + gamut-with-alpha semantics. A future `format` value is the
  fenced extension. Alternative — **ship alpha now** — is rejected on scope for v1.

- **F7 — EyeDropper.** *Recommend: progressive enhancement — feature-detected, Chromium-only, no polyfill*
  (clause 7). Alternative — **non-goal entirely** — is a defensible cheaper call (leave it out); recommended IN
  because the affordance is ~15 lines behind a feature-detect and degrades cleanly, but it is the fork most
  comfortably dropped if Kim wants a tighter v1.

## Consequences

- **The fleet gains its first edit-class color control** — the ADR-0118 fence is now a two-sided boundary
  (`ui-swatch` shows, `ui-color-picker` edits); a future intake that wants "a swatch you can click to edit"
  composes `Row > [Swatch, Button→ColorPicker]` or uses `type=color`, it does not grow a mode onto `ui-swatch`.
- **The fleet carries color math for the first time** — `colorCodecOptions` + the OKLCH↔sRGB + gamut-map pure
  functions live in `controls/color-picker/` (the codec) and are zero-dep, promoted from adia, tested as pure
  functions. This is sanctioned *because* the control edits (ADR-0118's own reasoning); it does NOT reopen
  color math for the display family.
- **A new `area-drag` trait joins `traits/`** — the 2-axis pointer primitive; `value-drag` is untouched. Any
  future 2-axis control (a 2D position pad, an xy-plot input) reuses it.
- **The catalog + eval surface grow by one emittable type at M2** — corpus, shards, and derived prompt
  re-validate; models must be taught when a picker beats a text field (a color ask vs a freeform string).
- **The family size budget re-bases** — a composite control (pad + canvas paint + codec + math) is the largest
  single control yet; measured at the build wave (`npm run size`, the ADR-0040 manual discipline), not guessed.
- **The v1 fences will be pushed** — "add alpha", "add an eyedropper on Firefox", "generate a palette from this
  color", "P3 output" are the predictable next asks; clause 7 + the non-goals are the fence (new intakes or
  app-layer composition, never riders).
- **Stale → re-verify at the build wave:** the catalog `catalog.json`/`factories.ts` + allowlist · catalog SPEC
  §5.2 rows + FEED_EXCLUDED · corpus shelf + derived prompt · `measure-size.mjs` line items · the `ui-text-field`
  type enum + its `type=color` overlay slice.

## Acceptance

This is an **intake** ADR — realized in stages:

- **Intake (this change):** the SPEC + LLD + decomposition exist and are coverage-clean; this record passes the
  ADR gates and is indexed; the seven forks carry firm recommendations awaiting Kim; independent doc-review is
  dispatched on the record set. **No code changes.**
- **Build waves (separately dispatched, only on the PASS + Kim's F1 ruling):** **M1** — the standalone
  `ui-color-picker` (base + pad + `area-drag` trait + composed channels + editable readout + `colorCodecOptions`
  + OKLCH/gamut math) with its descriptor, jsdom probes (model/codec/keyboard/ARIA/form seams), cross-engine
  browser probes (whole-shape + REAL pointer-drag geometry on pad AND channels + the 2-axis keyboard proof +
  forced-colors), barrels/exports/size, `{doc,demo}` pages; the `EXCLUSION_ALLOWLIST` seed. **M1b** — the
  `ui-text-field type=color` lazy-overlay leg (the ADR-0048 seam). **M2** — the `ColorPicker` catalog row +
  exemplar + §5.2 guidance + `FEED_EXCLUDED` entry, allowlist drained to zero residue.

## Alternatives considered

- **A variant/prop of an existing control.** Rejected at dedup — no control edits color; `ui-swatch` is
  display-class and re-owning value-editing onto it is the exact ADR-0118 fence violation. A `type=color`
  text-field alone (no standalone) can't host a pad.
- **Port the adia component.** Rejected per the "promote to fleet law, never port" directive: the adia control
  uses `<input type=range>` channels (fleet forbids native form elements), a single-`role=slider` pad (weaker
  a11y — F2), and carries app-specific generation-constraint props (`maxChroma`/`hueDriftMax`/`constraint-clamp`
  — ultimate-tokens concerns, not fleet law). Its OKLCH↔sRGB + binary-search gamut math and its `format`
  hex|oklch shape ARE promoted; its API is not.
- **A color-math dependency (culori/colorjs).** Rejected — the zero-dependency pillar; the needed math is a
  handful of pure functions.
- **HSV/HSL-internal, pure-CSS gradient pad, hex-only.** Rejected as the DEFAULT (it is F1 alternative (a)):
  cheaper and library-free, but perceptually nonuniform and unable to author the fleet's own OKLCH tokens —
  offered to Kim as the live alternative, not the recommendation.
- **A `@agent-ui/color` package.** Rejected for v1 — one control, no vendored mass; the math is small enough to
  live in the control folder (the ADR-0118 cl.7 / ADR-0107 cl.7 test).
