# Best practices — authoring a ui-* component

> The non-obvious do/don't beyond the ordered procedure — the judgement layer. Depth is canonical
> (cited in `foundations.md`); this is what a competent author would still get wrong. 2026-06-26.

## Do

- Pick the **narrowest base class** that fits: `UIElement` for reactive display, `UIFormElement` only for
  value-bearing controls, `UIContainer` for layout, `UIComponent` only when it actually orchestrates
  children (roving/selection). Reaching higher than needed is bloat.
- Model closed sets as `prop.enum([...])` (literal unions) — never `enum` (banned), never a free `string`.
- Keep the host **light DOM**; set ARIA **only** through `internals`; emit only
  `change · input · select · open · close · toggle`.
- **Disabled is `:disabled`, not just an attribute.** Inertness (no activation, non-focusable,
  `aria-disabled`, no form participation) keys off `:disabled` / `formDisabledCallback`; a
  `disabled` / `[mode=disabled]` attribute MUST reflect into the `disabled` property so `:disabled` is
  canonical and forced-colors `GrayText` applies. A styled-but-clickable disabled is the classic a11y trap.
- Write the **CSS trio**: tokens in `:where(ui-{name})` from `--md-sys-color-` roles; styles in `@scope (ui-{name})`
  consuming **only** `--ui-{name}-*`; a barrel `@import`ing both.
- Wire geometry **off the ramp** (`block-size`, `padding-block: 0`, the slot/slotless inline-pad,
  affordance `= font`) — per `docs/references/geometry.md`.
- **Intent never travels by color alone** (WCAG SC 1.4.1; ADR-0057). The intent anchors are L-matched,
  so intent is hue-only at the token level and collapses under CVD (danger↔success is indistinguishable
  under deuteranopia). Wherever an intent role (`--md-sys-color-danger/-warning/-success/-info` — or any color role
  carrying validity/status/kind/selection) styles a state or variant, a **visible non-color signifier
  co-carries the meaning**: text naming the state (text-field's validity message, ADR-0014 cl.4), a
  glyph/shape (checkbox's tick; calendar's ring-vs-fill), position (switch's thumb), or a pattern (a
  dashed border). The ARIA state is required alongside but is never the visible cue.
- Make `{name}.api.json` mirror `static props` exactly (the contract↔props trip-wire enforces it).

## Don't

- **Boolean explosion** — six booleans that are really one `enum`.
- A **self-owned outer margin** — a component owns its inside, not its surroundings (composition breaks).
- **Raw primitive token refs** (`--md-sys-color-{family}-{stop}`) in component CSS — read **roles** only.
- **Block-padding as the sizing lever** — `block-size` is the lever; `padding-block` is `0`.
- **A color-only state diff** — if two states/variants of a surface differ only in color values, the
  surface fails CVD and fails review (ADR-0057); a color-only status dot / hue-only badge is unshippable.
- **Re-specify** the props API or restate the geometry/token law — point to the canonical docs. Copying
  them is the drift the rubric's coherence dimension penalizes.

## Worked patterns

- **Typed props + declare-merge:**
  ```ts
  const props = { variant: prop.enum(['solid','soft','ghost'], 'solid') } satisfies PropsSchema
  export interface UIButtonElement extends ReactiveProps<typeof props> {} // typed accessors, no decorators
  export class UIButtonElement extends UIFormElement { static props = props }
  ```
- **CSS trio skeleton:**
  `{name}-tokens.css` → `:where(ui-{name}) { --ui-{name}-bg: var(--md-sys-color-primary); --ui-{name}-height: var(--ui-height-md); }`
  · `{name}-styles.css` → `@scope (ui-{name}) { :scope { block-size: var(--ui-{name}-height); padding-block: 0; background: var(--ui-{name}-bg); } }`
  · `{name}.css` → `@import './{name}-tokens.css'; @import './{name}-styles.css';`
- **Descriptor:** `{name}.api.json` records tag · tier · extends · attributes (from `static props`) ·
  properties · events · slots · parts · customStates · face · aria · keyboard · geometry · forcedColors.
