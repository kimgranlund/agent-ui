# ADR-0008 — Control interaction-state styling standard (per-variant hover/active via role ladders)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — orchestration-lead; ghost-wash + tokens.md role ladders confirmed, verified at the wave-2 cross-engine smoke; dedicated --c-{f}-hover/-active roles only if a ladder step collapses)* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, closing the booked G4 interactive-state deferral the wave-2 states showcase surfaced |
> | **Ratified by** | orchestration-lead — 2026-06-27 |
> | **Repairs** | `goals §G5` (the booked G4 interactive-state deferral — `:hover`/`:active` now delivered) · `references/tokens.md` (the channel pattern gains a per-state section) · **NEW** `references/interaction-states.md` (the durable home of the standard) · `controls/button/button.css` (the first consumer) |
> | **Supersedes / Superseded by** | Relates: **ADR-0009** (focus-ring — the fourth interaction state) · **ADR-0006** (button anatomy, unchanged) · **ADR-0007** (ramp tokens — the geometry layer this does not touch) |

## Context

The G5 `ui-button` shipped with **no** interactive-state styling: `button.css` carries only `cursor: pointer`
plus the disabled colour repoint. Hover, pressed, and (ADR-0009) keyboard-focus are visually dead — the
wave-2 states showcase (`site/pages/states.ts`) had to label its hover/active sections "the rings are
browser defaults" because the control authors none. This was a booked G4 deferral (s16 G5 verdict), and it
fails the REALIZE half of `docs/rubrics/component.md` (C7 behaviour, C8 styling).

The token system already has the answer half-written. `references/tokens.md` §"Applying roles to a control"
fixes two hard constraints that any state styling **must** obey:

- **No `color-mix`.** A mix ratio is a component-authored colour *opinion*; the rule is that components hold
  *zero* colour opinions — all colour lives in the token layer as `--c-{family}-{role}` roles. So a hover/active
  shade cannot be synthesized in the control; it must be a **different role step**.
- **`@scope` consumes only `--ui-{cmp}-*`.** The styles block reads the component's own chain, never a role or
  primitive directly (C8 [gate]).

`tokens.md` already vetted the **role ladders** that supply state separation without a mix: the accent ladder
(`--c-{f}` · `-dim` · `-high`) for the filled channel and the container ladder (`-container-low` · `-container`
· `-container-high`) for the tonal channel. What it did **not** resolve is the per-variant binding for the
shipped `solid`/`soft`/`ghost` surface (its worked example uses a forward-looking `mode`/`family` vocabulary),
nor the `ghost` variant (transparent at idle, so it has no fill to step).

## Decision

We establish a **per-variant interaction-state styling standard**, first realized in `button.css`, captured in
the new `references/interaction-states.md`, and cross-linked from `tokens.md`. A control declares **per-state
background tokens** in its `:where()` token block from **role-ladder steps** (never a `color-mix`), and its
`@scope` styles consume them on the matching state pseudo-classes:

**[1] token block** (`:where(ui-button…)`, specificity `(0,0,0)`) — each variant repoints `--ui-button-bg`
idle and adds `--ui-button-bg-hover` / `--ui-button-bg-active` from a ladder step:

| variant | idle (`--ui-button-bg`) | `-hover` | `-active` | ink |
|---|---|---|---|---|
| **solid** (filled) | `--c-primary` | `--c-primary-dim` | `--c-primary-high` | `--c-primary-on-primary` |
| **soft** (tonal) | `--c-primary-container-low` | `--c-primary-container` | `--c-primary-container-high` | `--c-primary-on-surface` |
| **ghost** (text) | `transparent` | `--c-primary-container-low` | `--c-primary-container` | `--c-primary` |

**[2] styles block** (`@scope (ui-button)`) — consume the per-state tokens on the pseudo-classes, reading
only `--ui-button-*`:

```css
:scope:hover  { background: var(--ui-button-bg-hover); }
:scope:active { background: var(--ui-button-bg-active); }
```

**Disabled holds at idle.** `:scope:is([disabled])` already sets `pointer-events: none`, so `:hover`/`:active`
never match a disabled host — the hold is automatic. The disabled token row repoints `--ui-button-bg` (and, for
symmetry, `-bg-hover`/`-bg-active`) to the muted neutral so no path lifts. Keyboard focus cannot land on a
disabled host (ADR-0010 removes it from the tab order), so no focus lift either.

**Forced-colors is free** — every value resolves through a `--c-{f}-{role}` role, so the token layer's WHCM
mapping covers each state cell with zero per-control rules (the existing `forced-colors` block keeps ink +
border; ADR-0009 keeps the ring).

The standard is **single-family (primary) and per-variant** for this pass. When the `family` attribute lands
(`tokens.md`'s open fleet decision — *out of scope here*), the per-variant×state rows refactor to `tokens.md`'s
family→intermediates form (`--_fill-*` / `--_tonal-*`); the `--ui-{cmp}-bg[-hover|-active]` consumption seam is
unchanged by that refactor.

## Consequences

- **`ui-button` becomes REALIZE-real.** C7/C8 clear ≥4: every variant reacts on `:hover` and `:active`,
  token-driven, no `color-mix`, `@scope` reads only `--ui-button-*`. The wave-2 smoke (ADR-0009 + the
  decomposition's `smoke` node) re-scores C9 anti-vacuously in both engines.
- **The next control inherits the pattern, not the rows.** `references/interaction-states.md` is the durable
  standard; `ui-text-field`/`ui-checkbox`/… declare their own `--ui-{cmp}-bg[-hover|-active]` from the same
  ladders and consume them identically. Zero dialect drift (C5).
- **A new constraint on every control's token block:** state shades come from role steps, never a mix. If a
  ladder step is too close to read as a state change (see Open question), the *token layer* — not the control —
  grows dedicated `--c-{f}-hover`/`-active` roles. The control's consumption seam does not change.
- **`ghost` gains a hover/active wash** (a low container tint on a text variant). This is a new design choice
  beyond `tokens.md`'s filled/tonal table — flagged for ratification.
- **No geometry impact.** State styling repoints `background` only; the geometry law (`geometry.md`) and the
  ramp (ADR-0007) are untouched.

## Resolved on ratification (2026-06-27 — orchestration-lead)

CONFIRMED: reuse `tokens.md`'s vetted role ladders (solid `--c-primary`→`-dim`→`-high`; soft
`-container-low`→`-container`→`-container-high`; ghost `transparent`→`-container-low`→`-container`), and the
**ghost wash is approved**. The ladder separation is **verified at the wave-2 cross-engine smoke** (Risk 1);
**only** if a step collapses do we add token-layer dedicated `--c-{f}-hover`/`-active` roles (a separate
`tok-states` slice + an amendment to this ADR) — **never** a component `color-mix`.

## Alternatives considered

- **`color-mix()` / opacity overlays for hover/active** — rejected: a mix ratio is a component-authored colour
  opinion, banned by `tokens.md` (colour lives in the token layer). It would also break forced-colors (a mixed
  colour does not carry the WHCM role mapping).
- **Repoint the single `--ui-button-bg` directly under state selectors** (no `-hover`/`-active` tokens, à la
  `tokens.md`'s worked sketch) — viable, but the explicit per-state tokens make the standard self-documenting
  (`@scope` reads `--ui-button-bg-hover`, naming the state) and keep all the ladder choices in one token block;
  the chosen form generalizes more legibly to the next control.
- **Defer to the `family` intermediates pattern now** (`--_fill-*`/`--_tonal-*`) — rejected: that couples this
  pass to `tokens.md`'s unresolved family-vocabulary decision (alias-vs-rename), which is explicitly out of
  scope. The per-variant rows refactor into intermediates later with no seam change.
- **A `[state]` attribute the control sets in JS** — rejected: violates the pure-CSS, no-`observedAttributes`
  styling discipline; `:hover`/`:active` are platform pseudo-classes that need no JS.

## Amendment — dedicated primary hover/active roles (2026-06-27, the foreseen ladder-collapse remedy)

The wave-2 cross-engine smoke confirmed the resolved-on-ratification note's anticipated risk: the SOLID variant's
hover (`--c-primary-dim`) and active (`--c-primary-high`) **both resolve to `--c-primary-650` in the light branch
of `light-dark()`**, so a pressed solid button was visually indistinguishable from a hovered one in light scheme
(dark was a genuine three-step ladder). Per this ADR's resolved decision — "only if a step collapses do we add
token-layer dedicated `--c-{f}-hover/-active` roles, never a component `color-mix`" — the remedy was applied
(`tok-states` slice; host-ratified values):

- **Two new fleet roles** in `tokens.css`: `--c-primary-hover: light-dark(--c-primary-700, --c-primary-600)` and
  `--c-primary-active: light-dark(--c-primary-750, --c-primary-350)` — a real three-step ladder in BOTH schemes
  (light 550→700→750, dark 450→600→350). *(Hover steps host-adjusted 2026-06-27: light 650→700, dark 400→600.)*
- The button's SOLID variant repoints `--ui-button-bg-hover`/`-bg-active` to these roles; soft/ghost stay on the
  (already-distinct) container ladder, the disabled hold is unchanged.
- The smoke's RISK-1 tripwire flipped from `hover==active` to `hover != active` — green in Chromium AND WebKit;
  the resolved solid ladder is three distinct oklch steps per scheme.

This is the **family-role pattern** the next solid-filled control reuses: a family that ships a solid fill gets
its own `--c-{family}-hover/-active` roles when (and only when) its generic `-dim/-high` ladder collapses in a
scheme. The old `--c-primary-dim`/`-high` roles are unchanged (no other consumer). Token-layer only — no
component change. `references/interaction-states.md` documents the pattern.
