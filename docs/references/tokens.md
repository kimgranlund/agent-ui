# Color tokens — the role system

> Canonical naming + role standard for agent-ui color. **Derived** from the value source
> [`tokens.css`](./tokens.css) (OKLCH primitives + semantic roles) — the values live there and are not
> duplicated here; this doc describes the *system*. Distilled 2026-06-26.

## Naming (canonical)

- **Roles** — `--c-{family}-{role}` (hyphen). The canonical public token surface components read.
- **Primitives** — the flat OKLCH stops (e.g. `--c-neutral-550`). Internal; components do not read
  primitives directly, only roles.
- **Component chains** — a component declares `--ui-{cmp}-{slot}` in `:where(ui-{cmp})` pointing at a
  family role (e.g. `--ui-button-bg: var(--c-primary)`); the component's styles read only `--ui-{cmp}-*`.

> **Reconciliation (pending, G5):** `tokens.css` currently ships *primitives* as `--c_{family}-{stop}`
> (UNDERSCORE) while *roles* already use `--c-{family}-{role}` (hyphen). When `tokens.css` is adopted
> into `@agent-ui/shared`, rename the primitives `--c_` → `--c-` so the whole surface is hyphenated.
> Until then: `--c-{family}-{role}` (roles) is canonical; primitives are internal and will be renamed.

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

## Source

The OKLCH values are canonical in [`tokens.css`](./tokens.css) (8 families × {primitives + roles}). This
doc is the derived description of the role system and the naming standard; it carries no values.
