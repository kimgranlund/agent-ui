# Color tokens — the role system

> Canonical naming + role standard for agent-ui color. **Derived** from the value source
> `@agent-ui/shared/src/tokens/tokens.css` (OKLCH primitives + semantic roles) — the values live there
> and are not duplicated here; this doc describes the *system*. Distilled 2026-06-26 · adopted into
> `@agent-ui/shared` 2026-06-26.

## Naming (canonical)

- **Roles** — `--c-{family}-{role}` (hyphen). The canonical public token surface components read.
- **Primitives** — the flat OKLCH stops (e.g. `--c-neutral-550`). Internal; components do not read
  primitives directly, only roles.
- **Component chains** — a component declares `--ui-{cmp}-{slot}` in `:where(ui-{cmp})` pointing at a
  family role (e.g. `--ui-button-bg: var(--c-primary)`); the component's styles read only `--ui-{cmp}-*`.

> **Reconciliation — DONE (2026-06-26):** `tokens.css` was adopted into
> `@agent-ui/shared/src/tokens/tokens.css` and its primitives renamed `--c_{family}-{stop}` →
> `--c-{family}-{stop}`, so the whole surface is now hyphenated `--c-`. It is exported as
> `@agent-ui/shared/tokens.css` — the foundation layer of the CSS load stack (linked first).

## Families (8)

`neutral · primary · secondary · tertiary · info · success · warning · danger`. Each ships flat
mode-independent **primitives** (a ~25-stop OKLCH ladder + alpha steps) and a set of semantic **roles**
resolved via `light-dark()` — so one role works in both schemes.

## The role vocabulary (uniform per family)

Every family exposes the same roles, so a component swaps families by changing one token:

- **anchor** — `--c-{f}` · `-dim` · `-bright` · `-low` · `-high`
- **on-color** — `-on-{f}` · `-on-{f}-variant` · `-on-surface` · `-on-surface-variant`
- **outline** — `-outline` · `-outline-variant`
- **container** — `-container` · `-container-low` · `-container-high`
- **scrim** — `-scrim-weakest … -scrim-strongest` (+ `-scrim`)
- **inverse** — `-inverse-surface` · `-inverse-on-surface`
- **surface ladder** — `-background` · `-surface` · the dim ladder (`-surface-dimmest…-dim`) · the bright
  ladder (`-surface-bright…-brightest`) · the low/high ladder (`-surface-lowest…-highest`)

## Consumption invariants

- Components reference **roles** (or their own `--ui-{cmp}-*` chain pointing at roles), never raw
  primitives. The token-hygiene trip-wire enforces it: no raw primitive refs in component CSS; every
  `--ui-{cmp}-*` declared in `:where()`.
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

Every resolved value is a `var(--c-{family}-{role})` — **no `color-mix`**: a mix ratio is a
component-authored *color opinion*, and the rule is that components hold zero color opinions; all color
stays in the token layer. CSS also can't interpolate a role *name* from an attribute, so the mapping is
two layers.

**1. family → pointer rows (once per family).** Each `[family]` selector binds that family's roles to
family-agnostic intermediates; all the mode/state logic below reads only the intermediates:

```css
ui-button[family=primary] {
  --_fill-idle: var(--c-primary);  --_fill-hover: var(--c-primary-dim);  --_fill-sel: var(--c-primary-high);
  --_on-fill:   var(--c-primary-on-primary);
  --_tonal-idle: var(--c-primary-container-low); --_tonal-hover: var(--c-primary-container); --_tonal-sel: var(--c-primary-container-high);
  --_on-tonal:  var(--c-primary-on-surface);
}
/* …one row per supported family, identical shape, swapping the family token */
```

**2. mode × state → shared, family-agnostic logic** over the intermediates (`disabled` is an override,
so the authored matrix is 2 modes × 3 states):

| | idle | hover | selected |
|---|---|---|---|
| **filled** bg | `--c-{f}` | `--c-{f}-dim` | `--c-{f}-high` |
| **filled** ink | `--c-{f}-on-{f}` | ″ | ″ |
| **tonal** bg | `--c-{f}-container-low` | `--c-{f}-container` | `--c-{f}-container-high` |
| **tonal** ink | `--c-{f}-on-surface` | ″ | ″ |

```css
:where(ui-button) { --ui-button-bg: var(--_fill-idle); --ui-button-ink: var(--_on-fill); --ui-button-border: transparent; }
ui-button:hover                           { --ui-button-bg: var(--_fill-hover); }
ui-button:state(--selected)               { --ui-button-bg: var(--_fill-sel); }
ui-button[mode=default]                   { --ui-button-bg: var(--_tonal-idle); --ui-button-ink: var(--_on-tonal); }
ui-button[mode=default]:hover             { --ui-button-bg: var(--_tonal-hover); }
ui-button[mode=default]:state(--selected) { --ui-button-bg: var(--_tonal-sel); }
```

`-border` = `transparent` (or `var(--c-{f}-outline-variant)` when the tonal mode is the *outlined* variant).

**disabled** overrides family with muted neutral roles and goes inert (no hover/selected):

```css
ui-button[mode=disabled] { --ui-button-bg: var(--c-neutral-surface-high); --ui-button-ink: var(--c-neutral-on-surface-variant); --ui-button-border: transparent; }
```

**forced-colors is free** — every value resolves through a `--c-{f}-{role}` role, so the token layer's
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
> 2. **State separation — the no-`color-mix` consequence.** hover/selected now lean on the **accent
>    ladder** (`--c-{f}` / `-dim` / `-high`) and **container ladder** (`-container-low` / `-container` /
>    `-container-high`) giving enough visual separation idle → hover → selected. **Verify in the real
>    palette**; if a step is too close, the token layer needs dedicated per-state roles (`--c-{f}-hover` /
>    `-selected`) + a `--c-*-disabled` pair — states can no longer be synthesized in the component.

## Source

The OKLCH values are canonical in `@agent-ui/shared/src/tokens/tokens.css` (8 families × {primitives +
roles}), exported as `@agent-ui/shared/tokens.css`. This doc is the derived description of the role
system and the naming standard; it carries no values.
