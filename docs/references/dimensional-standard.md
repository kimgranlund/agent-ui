# Dimensional standard — bringing every component up to corpus §0/§2

> **Status: SUPERSEDED (historical), 2026-06-30.** This 2026-06-14 note established the dimensional
> **producer→consumer wiring** (consume `--ui-{cmp}-height`/`-font` not ad-hoc sizing; block-size not
> block-padding; load the token sheet first) — that wiring rationale **still holds**. But three of its
> *specifics* are superseded; do not read them as current (each flagged inline below):
> 1. the **fallback ramp literals** (`28·32·36` heights / `12·13·14` fonts) → the landed control ramp is
>    **`24·28·36` / `13·14·16`** ([`geometry-sizing-spec.md`](./geometry-sizing-spec.md) §1: SM 24/13 · MD 28/14 · LG 36/16);
> 2. the **inline-pad formula** (`2px + height × 0.375 × density`) → the **v4 slot model** (`h/2` slotless
>    value edge / `½(h − icon)` slotted; **density on the gap, not the pad**), geometry-sizing-spec.md §1.5 / [`geometry.md`](./geometry.md);
> 3. the **scale-as-discrete-TIER** framing (`ui-{sm,md,lg}` / `content-{sm,md,lg}`) → the **numeric
>    `--ui-scale` multiplier on `*`** (ADR-0007); the per-component `size` prop (sm/md/lg) is unchanged.
>
> **Current authorities:** sizing law + ramp = [`geometry-sizing-spec.md`](./geometry-sizing-spec.md) v4 (resolved law: [`geometry.md`](./geometry.md)) · scale model = ADR-0007 · type scale = `--ui-type-*` (ADR-0025). Retained for wiring history only.

**Goal.** Wire the scale/size/density dimensional system *through* every `ui-*` element so
heights, font-sizes, and inline-padding actually respond to `scale` / `size` / `density`.
The diagnosis (2026-06-14): A2 built + proved the dimensional tokens **in isolation**
(`runtime-tokens.css` + the `DIM-R*` fixture probes), but the components consume their own
ad-hoc sizing (`font: inherit`, em / `--space-*` block-padding, hardcoded heights) and never
reference `--ui-height-*`/`--ui-font-*`; and `runtime-tokens.css` is never loaded by the
demos/barrels. The system is currently decorative. This standard connects producer→consumer.

## The rules (corpus §0 + §2, the authority)
- **Block size, not block-padding** (§0). Vertical size = `block-size: var(--ui-{cmp}-height)`
  (single-line) / `min-block-size` (growable). `padding-block` is **never** the sizing lever —
  `0` (cap `0.125rem`, collision only). `box-sizing: border-box`.
- **`scale × size → {height, font-size, indicator}`** (§2.1-2.2). `scale` (tier: `ui-{sm,md,lg}` /
  `content-{sm,md,lg}`, default `ui-md` at `:root`) publishes the table rows
  `--ui-{height,font,ind}-{sm,md,lg}`. `size` (component: sm/md/lg, **default md**) picks the row.
  *(SUPERSEDED — note 3: `scale` is no longer a discrete tier; it is the **numeric `--ui-scale` multiplier on `*`**, ADR-0007. `size` is unchanged.)*
- **Inline-padding is *derived* from height** (§2.4): `2px + height × 0.375 × density`.
  *(SUPERSEDED — note 2: replaced by the v4 slot model — `h/2` slotless / `½(h − icon)` slotted, density on the gap. See geometry-sizing-spec.md §1.5 / geometry.md.)*
- **Density** (§2.4): `comfortable` 1 (default) · `compact` 0.75 · `spacious` 1.25 — multiplies
  inline spacing (inline-padding/margins/gaps) **only**, never height/font.
- **Pure-CSS cascade** (§0): `scale`/`size`/`density` are CSS attribute selectors, no JS / no
  `observedAttributes` — whole-subtree, descendants override locally.

## Size classes (§2.4) — classify each component, apply its variant

| Class | Components | Sizing lever |
|---|---|---|
| **Control** (full height) | `button` · `text-field` · `number-field` · `select` · `combobox` · `field` | `--ui-{cmp}-height = var(--ui-height-{size})` + font + height-derived inline-pad |
| **Indicator** (smaller box) | `checkbox` · `radio`(radio-group) · `switch` · `slider` · `tag` | the box = `var(--ui-ind-{size})` |
| **Pattern** (container + control-height rows) | `tabs` · `segmented-control` · `toolbar` · `accordion` · `menu` · `dialog` | interactive rows take the control height; the shell uses the space scale |
| **Container/layout** (space scale only) | `spacer` · `stack` · `grid` (+ `container`) | gaps/margins/padding = `--space-*` × density; no control height |
| **Display** (font where text-bearing) | `divider` · `icon` · `spinner` · `progress` · `alert` · `badge` · `tooltip` | `font-size: var(--ui-font-{size})` where text; intrinsic structural sizing |

## The recipe

### Control-class — `{cmp}-tokens.css` (in `:where(ui-{cmp})`)
> *SUPERSEDED — note 1 (literals) + note 2 (formula): the `32/28/36`px height + `13/12/14`px font fallbacks
> below are the OLD ramp — the landed control ramp is **`24·28·36` heights / `13·14·16` fonts** (SM·MD·LG,
> geometry-sizing-spec.md §1); and the `2px + height·0.375·density` pad is the OLD formula (now the v4 slot
> model). The recipe SHAPE (consume `--ui-{cmp}-height`/`-font`, block-size not block-padding) is still valid.*
```css
:where(ui-button) {
  --ui-button-height:     var(--ui-height-md, 32px);
  --ui-button-font:       var(--ui-font-md, 13px);
  --ui-button-pad-inline: calc(2px + var(--ui-button-height) * 0.375 * var(--ui-density, 1));
  --ui-button-pad-block:  0;                 /* block-size is the lever, not block-padding */
  /* …the existing color/radius/state tokens, unchanged… */
}
ui-button[size="sm"] { --ui-button-height: var(--ui-height-sm, 28px); --ui-button-font: var(--ui-font-sm, 12px); }
ui-button[size="lg"] { --ui-button-height: var(--ui-height-lg, 36px); --ui-button-font: var(--ui-font-lg, 14px); }
```
### Control-class — `{cmp}-styles.css` (`@scope (ui-{cmp}) :scope`)
```css
box-sizing: border-box;
block-size: var(--ui-button-height);
font-size:  var(--ui-button-font);
line-height: var(--ui-control-line-height);       /* single-line: = 1, the centering-law companion (ADR-0036); NOT for Display/ui-text */
padding-inline: var(--ui-button-pad-inline);
padding-block:  var(--ui-button-pad-block, 0);   /* delete any block-padding-as-sizing */
```
### Indicator-class
Same shape, but the box rides the indicator table: `--ui-{cmp}-size: var(--ui-ind-{size})`
+ `[size]` overrides; `block-size`/`inline-size: var(--ui-{cmp}-size)`. (Slider track height, tag
height, the checkbox/radio/switch box.)
### Container/layout & Display
No control height. Gaps/margins/padding ride `--space-*` (× `--ui-density` for gaps);
text-bearing display components take `font-size: var(--ui-font-{size})`. Keep intrinsic structure.

**The fallback literal in every `var(…, <fallback>)` stays** (the dimensional tokens resolve when
`runtime-tokens.css` is loaded; the literal is the degraded-mode floor — TOK12 last-resort law).

## Global wiring (one-time)
`runtime-tokens.css` (the `[scale]`/`[density]` tables) **must be loaded** or every `var(--ui-height-*)`
falls to its literal. Ship `src/tokens/tokens.css` — a root barrel `@import`ing
`raw-color-tokens.css`, `semantic-color-tokens.css`, `runtime-tokens.css` — and **link it first** in
`index.html` / `components.html` / `sheet.html` (before the component barrels). Default `scale=ui-md`
at `:root` already ships. (The smoke fixtures that already adopt the token sheets per-leg keep working.)

## Probes — the real-px proof (closes the isolation gap)
The existing `DIM-R*` probes test the *tokens in a fixture*; this standard requires proving the
*rendered component* responds. Per component add:
- **jsdom**: `[size="sm|md|lg"]` selects the right `--ui-{cmp}-height`/`-font` chain (source-structural
  over the `.css`, or computed where jsdom resolves it).
- **Chromium smoke** (the load-bearing leg): adopt `tokens.css?inline`, mount the component, assert the
  **rendered `getBoundingClientRect().height`** (+ `getComputedStyle` `fontSize`/`paddingInline`) **CHANGES**
  across `size=sm→md→lg` AND under an ancestor `[scale="ui-lg"]` AND `[density="compact"]` — and matches
  the §2.2 table px for the control class (e.g. button ui-md/md = 32px tall, 13px font, ~14px inline-pad).
  Anti-vacuous: assert the value *changed*, not just present.

## Acceptance — "up to standard"
1. block-size from `--ui-{cmp}-height` (control) / `--ui-{cmp}-size` (indicator), **never block-padding**.
2. font-size from `--ui-{cmp}-font`; inline-padding from the height formula.
3. the rendered px **responds** to `size` / ancestor `scale` / `density` (probed in Chromium).
4. the §0 "block-size not block-padding" invariant holds (no block-padding sizing; container-display
   exempt where they have no control height).
5. probe-locked behaviour **unchanged** (this is a styling change; UB/UT/… walls stay green).
6. `.css` budget held (trim headers if a size block tips it); green at rest.

## Rollout
`button` is the **reference** (proven end-to-end first, incl. the global wiring). The other 28
fan out in parallel — one team (implement → adversarial-verify) per component — then serial
integration (smoke legs + budget) + a final green sweep.
