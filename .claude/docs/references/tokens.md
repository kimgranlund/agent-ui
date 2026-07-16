# Color tokens — the role system

> Canonical naming + role standard for agent-ui color. **Derived** from the value source
> `@agent-ui/shared/src/tokens/tokens.css` (OKLCH primitives + semantic roles) — the values live there
> and are not duplicated here; this doc describes the *system*. Distilled 2026-06-26 · adopted into
> `@agent-ui/shared` 2026-06-26.

## Naming (canonical)

- **Roles** — `--md-sys-color-{family}-{role}` (hyphen). The canonical public token surface components read.
- **Primitives** — the flat OKLCH stops (e.g. `--md-sys-color-neutral-550`). Internal; components do not read
  primitives directly, only roles.
- **Component chains** — a component declares `--ui-{cmp}-{slot}` in `:where(ui-{cmp})` pointing at a
  family role (e.g. `--ui-button-bg: var(--md-sys-color-primary)`); the component's styles read only `--ui-{cmp}-*`.

> **Reconciliation — DONE (2026-06-26):** `tokens.css` was adopted into
> `@agent-ui/shared/src/tokens/tokens.css` and its primitives renamed `--c_{family}-{stop}` →
> `--md-sys-color-{family}-{stop}`, so the whole surface is now hyphenated `--md-sys-color-`. It is exported as
> `@agent-ui/shared/tokens.css` — the foundation layer of the CSS load stack (linked first).

## Families (8)

`neutral · primary · secondary · tertiary · info · success · warning · danger`. Each ships flat
mode-independent **primitives** (a ~25-stop OKLCH ladder + alpha steps) and a set of semantic **roles**
resolved via `light-dark()` — so one role works in both schemes.

## The role vocabulary (uniform per family)

Every family exposes the same roles, so a component swaps families by changing one token:

- **anchor** — `--md-sys-color-{f}` · `-dim` · `-bright` · `-low` · `-high`
- **on-color** — `-on-{f}` · `-on-{f}-variant` · `-on-surface` · `-on-surface-variant`
- **outline** — `-outline` · `-outline-variant`
- **track** *(neutral only)* — `--md-sys-color-neutral-track` · `--md-sys-color-neutral-track-hover` — the **solid** unselected-track
  fill for a state-bearing widget (switch off-track, slider rail), held to **SC 1.4.11 3:1 vs every surface
  plane in both schemes**. NOT `-outline-variant` (a translucent *decorative* outline that composites to only
  ~1.5–1.7:1 — an SC 1.4.11 fail for an interactive control part). Disabled tracks are 1.4.11-exempt and keep
  their muted roles. ADR-0059.
- **container** — `-container` · `-container-low` · `-container-high`
- **scrim** — `-scrim-weakest … -scrim-strongest` (+ `-scrim`)
- **inverse** — `-inverse-surface` · `-inverse-on-surface`
- **surface ladder** — `-background` · `-surface` · the dim ladder (`-surface-dimmest…-dim`) · the bright
  ladder (`-surface-bright…-brightest`) · the low/high ladder (`-surface-lowest…-highest`)

**Interaction-state fill roles (per-family, added on demand — `primary` only today).** Beyond the uniform
roles above, the solid-filled channel adds dedicated state steps as a control needs them (not on all 8
families):

- `-hover` · `-active` — the idle→hover→active solid steps (ADR-0008), each distinct from idle and from each
  other in **both** `light-dark()` branches (they replaced the `-dim`/`-high` pairing that collapsed in light).
- `-selected` — the persistent **chosen** fill, **guaranteed WCAG-AA (≥4.5:1) against `-on-{f}` TEXT in BOTH
  schemes** (`light-dark(600, 600)` since the 2026-07-10 ramp rework — the older light `550` fell to 3.85:1
  against the new ramp; 600 is the lightest AA-clearing stop, reviewer-recomputed). Use it wherever selected TEXT sits on an accent fill; the accent anchor
  pair (`--md-sys-color-{f}` + `-on-{f}`) is report-only and drops below 4.5:1 in dark — fine for a *glyph* (3:1 bar), not
  for a *numeral/label*. First consumer: the `ui-calendar` selected day (ADR-0048). The four intent families
  (`danger/warning/success/info`) have **no `-selected` step yet**: white-on-intent-FILL TEXT is a measured but
  currently *unreachable* AA gap (the anchor dark leg is 3.13–3.41:1, below 4.5 — but no filled intent control
  exists). The siblings are **reserved**; the pre-computed remedy is `light-dark({f}-600, {f}-600)` on the
  2026-07-10 ramp (the older `550` light leg no longer clears — RE-VERIFY per family against the live
  ramp when minting) at the first filled intent control (ADR-0058).

## Consumption invariants

- Components reference **roles** (or their own `--ui-{cmp}-*` chain pointing at roles), never raw
  primitives. The token-hygiene trip-wire enforces it: no raw primitive refs in component CSS; every
  `--ui-{cmp}-*` declared in `:where()`.
- **Dimensional `:root` constants route through the own chain too** (TKT-0066 item 5, Kim-ruled
  2026-07-15): a `@scope` styles block never reads `--ui-font-*` / `--ui-space-*` / `--ui-radius-base`
  directly — it mints a role-named `--ui-{cmp}-*` token in the `:where()` block
  (`--ui-toast-radius: var(--ui-radius-base)`) and consumes that, same as color roles. The sanctioned
  direct-read list stays exactly the fleet constants: focus-ring (`--ui-focus-ring-*`,
  `--md-sys-color-focus-ring`), motion (`--ui-motion-*`, `--ui-ease-*`), and
  `--ui-control-line-height`. A family LEAF routes through the family tunnel (swiper-pagination's
  constants are declared on `:where(ui-swiper)`, ADR-0124's family-root rule).
- `color-scheme: light dark` on `:root`; roles resolve per-scheme via `light-dark()` — components do not
  branch on scheme.
- **Forced-colors** lives in the token layer: roles carry the WHCM mapping (anchors → `Highlight`,
  on-color → `HighlightText`, neutral inks → `CanvasText`), so components hold zero color opinions and
  survive forced-colors for free.
- **Contrast**: surface-text roles are WCAG-AA gated; accent on-color pairs are report-only.

## Applying roles to a control — the channel pattern

A control's color is **three channels**, not a `family × mode × state` matrix. In `:where(ui-{cmp})`
declare, and have `@scope` styles read, only:

```css
--ui-{cmp}-bg      /* fill    */
--ui-{cmp}-ink     /* label   */
--ui-{cmp}-border  /* outline */
```

Every resolved value is a `var(--md-sys-color-{family}-{role})` — **no `color-mix`**: a mix ratio is a
component-authored *color opinion*, and the rule is that components hold zero color opinions; all color
stays in the token layer. CSS also can't interpolate a role *name* from an attribute, so the mapping is
two layers.

**1. family → pointer rows (once per family).** Each `[family]` selector binds that family's roles to
family-agnostic intermediates; all the mode/state logic below reads only the intermediates:

```css
ui-button[family=primary] {
  --_fill-idle: var(--md-sys-color-primary);  --_fill-hover: var(--md-sys-color-primary-dim);  --_fill-sel: var(--md-sys-color-primary-high);
  --_on-fill:   var(--md-sys-color-primary-on-primary);
  --_tonal-idle: var(--md-sys-color-primary-container-low); --_tonal-hover: var(--md-sys-color-primary-container); --_tonal-sel: var(--md-sys-color-primary-container-high);
  --_on-tonal:  var(--md-sys-color-primary-on-surface);
}
/* …one row per supported family, identical shape, swapping the family token */
```

**2. mode × state → shared, family-agnostic logic** over the intermediates (`disabled` is an override,
so the authored matrix is 2 modes × 3 states):

| | idle | hover | selected |
|---|---|---|---|
| **filled** bg | `--md-sys-color-{f}` | `--md-sys-color-{f}-dim` | `--md-sys-color-{f}-high` |
| **filled** ink | `--md-sys-color-{f}-on-{f}` | ″ | ″ |
| **tonal** bg | `--md-sys-color-{f}-container-low` | `--md-sys-color-{f}-container` | `--md-sys-color-{f}-container-high` |
| **tonal** ink | `--md-sys-color-{f}-on-surface` | ″ | ″ |

```css
:where(ui-button) { --ui-button-bg: var(--_fill-idle); --ui-button-ink: var(--_on-fill); --ui-button-border: transparent; }
ui-button:hover                           { --ui-button-bg: var(--_fill-hover); }
ui-button:state(--selected)               { --ui-button-bg: var(--_fill-sel); }
ui-button[mode=default]                   { --ui-button-bg: var(--_tonal-idle); --ui-button-ink: var(--_on-tonal); }
ui-button[mode=default]:hover             { --ui-button-bg: var(--_tonal-hover); }
ui-button[mode=default]:state(--selected) { --ui-button-bg: var(--_tonal-sel); }
```

`-border` = `transparent` (or `var(--md-sys-color-{f}-outline-variant)` when the tonal mode is the *outlined* variant).

**disabled** overrides family with muted neutral roles on **both** triggers — the author attribute
`[mode=disabled]` and the platform state `:disabled` — and holds the state overlay at idle (no
hover/selected lift):

```css
:where(ui-button[mode=disabled]), :where(ui-button:disabled) {
  --ui-button-bg: var(--md-sys-color-neutral-surface-high); --ui-button-ink: var(--md-sys-color-neutral-on-surface-variant); --ui-button-border: transparent;
}
:scope:is([mode=disabled], :disabled):hover,
:scope:is([mode=disabled], :disabled):state(--selected) { background: var(--ui-button-bg); }
```

(The *behavior* — `:disabled` is canonical, `mode=disabled` reflects into the `disabled` property, and
inertness + forced-colors `GrayText` key off `:disabled` not the attribute — is a FACE rule; see
`component-author`.)

**forced-colors is free** — every value resolves through a `--md-sys-color-{f}-{role}` role, so the token layer's
WHCM mapping (anchors → `Highlight`, on-color → `HighlightText`, inks → `CanvasText`, disabled →
`GrayText`) covers every cell with zero per-control rules.

**Net:** N family pointer-rows + one family-agnostic mode×state block (3 fill steps + 3 tonal steps + 2
constant inks) + 1 disabled override — all `var()` over semantic roles, **no `color-mix`**, never a
72-cell grid. First worked example: `ui-button` (G5).

> **Two decisions to record (resolve once, fleet-wide):**
> 1. **Family vocabulary.** The proposed control vocabulary `neutral · primary · secondary · tertiary ·
>    system · positive · warning · critical` maps to the token families with three renames:
>    **system↔info · positive↔success · critical↔danger**. Resolve: **(a)** *alias at the component
>    boundary* — the `family` attr maps `system→info` etc.; tokens keep `info/success/danger`
>    *(recommended, low-risk)*; or **(b)** *rename the token families*. Default = alias.
> 2. **State separation — RESOLVED by the 2026-07-10 sheet.** Dedicated per-state roles are now
>    FIRST-CLASS for all 8 families: `--md-sys-color-{f}-hover` / `-active` / `-disabled`, the
>    `on-{f}-{state}` inks, `container-{state}`, `outline-{state}`, `-placeholder` — the full ladder is
>    structurally gated by `tokens.test.ts`. The old framing (state roles as a fallback when ladder
>    steps sit too close) is inverted: consume the state roles directly; in-component synthesis is the
>    thing to migrate away from.

## The 2026-07-10 sheet shape (generator-emitted + the hand-authored tail)

The generated sheet carries ~25-step primitive ramps per family (050–950 incl. 075/125-style
intermediates) and a `-500-NNN` alpha series, plus the full per-family state-role ladders above.
**The last `:root` block is HAND-AUTHORED** (loudly flagged in-file): the generator drops 15 roles the
fleet consumes — the six `neutral-tint-*` washes + their six alpha primitives, `neutral-track(-hover)`,
and `{f}-selected` — while its own `forced-colors` block still references them. Any regeneration
re-drops them: re-apply the block (the generator wishlist is recorded in the 2026-07-10 CHANGELOG
entry) or teach the generator to emit them.

## Source

The OKLCH values are canonical in `@agent-ui/shared/src/tokens/tokens.css` (8 families × {primitives +
roles}), exported as `@agent-ui/shared/tokens.css`. This doc is the derived description of the role
system and the naming standard; it carries no values.
