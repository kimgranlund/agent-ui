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

## Source

The OKLCH values are canonical in `@agent-ui/shared/src/tokens/tokens.css` (8 families × {primitives +
roles}), exported as `@agent-ui/shared/tokens.css`. This doc is the derived description of the role
system and the naming standard; it carries no values.
