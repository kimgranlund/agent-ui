# ADR-0006 — Button anatomy: optional leading icon slot, and the law-true `[density]` acceptance

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — unblocks s7/s13)* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — reconciling a law-vs-acceptance collision execution-lead surfaced building s6 (the dimensional token ramp, 11ca123) |
> | **Ratified by** | orchestration-lead — 2026-06-27 |
> | **Repairs** | `docs/goals.md` §G5 (the geometry/smoke acceptance + the button anatomy). *(No edit: `references/geometry.md` is the law and is already correct; `@agent-ui/shared` dimensions.css (s6) is already law-correct — this ADR aligns the consumer to the token it shipped.)* |
> | **Supersedes / Superseded by** | *(none)* |

## Context

`references/geometry.md` is the law: **density multiplies the rhythm (the gap) only; the frame (height,
inline-pad) is density-invariant.** s6 implemented it exactly — `--ui-scale` multiplies the frame + font
(`--ui-height/font-{size}`), and `--ui-density` multiplies **only** `--ui-gap-{size}` (`= font/2 × density`).
The committed test even asserts that no `[density]` rule touches `--ui-scale`/height/font. So **`--ui-gap`
is the single density-bearing quantity in the system.**

`goals.md` §G5 (the gold DoD), meanwhile, specified a **slotless** button (`inline-pad = h/2`) **and**
asserted its rendered px **changes under `[density]`**. These cannot both hold: a slotless bare-label button
has no gap, consumes no `--ui-gap`, and is therefore correctly density-invariant — its px **cannot** change
under `[density]` (the `h/2` pad is pure frame; the font terms in `½(h−font) + ½font` cancel to `½h`). The
`[density]` smoke would be vacuous-or-false on a strictly slotless button. This is a law-vs-acceptance
collision, not a reference ambiguity — the law is right; the acceptance over-claimed.

## Decision

The gold `ui-button` carries an **optional leading icon slot**, placed by a presence-driven `:has()` grid
(pure CSS, no JS, no `observedAttributes`):

- **bare label** (`<ui-button>Label</ui-button>`) → grid `1fr`, **slotless** inline-pad `= h/2`, **no gap**
  → correctly **density-invariant**.
- **icon + label** → grid `auto 1fr`, **slot** edge-pad `= ½(h−icon)`, with `column-gap: var(--ui-gap-{size})`
  between icon and label → **density-bearing** (the gap rides `--ui-density`).

We repair `goals.md` §G5's geometry/smoke acceptance to be **law-true** (and *stronger*, not relaxed):

- `[size]` sm→md→lg **and** `[scale]` compact→spacious **change** the px (frame height + font, via
  `--ui-scale`) — on **both** variants.
- `[density]` compact→spacious **changes the icon↔label gap** (`--ui-gap`) on the **icon+label** variant,
  **and does NOT change the bare-label frame** (height + the `h/2` pads). Anti-vacuous **both ways**: assert
  the gap *changed* and the frame *held*.

## Consequences

- **The reference control is now law-complete.** It exercises the slot model, the presence-driven `:has()`
  grid, the gap rhythm, and density — so every later control copies a *complete* worked example, not a
  degenerate slotless subset. (A bare-label-only button would never demonstrate the slot/gap/density
  mechanics the law is built around.)
- **The `[density]` smoke is sharper, not weaker** — a *change* assertion (the gap) **plus** an *invariance*
  assertion (the frame). That is a stronger, law-true test than the original "px changes under `[density]`"
  on a button that physically cannot.
- **s7 (button.css)** carries the presence-driven grid + the icon slot square + `column-gap: var(--ui-gap)`;
  **s5/s13** test **both** a bare and an icon instance. The icon is a **user-provided light-DOM child**
  detected by the `:has()` grid — the exact leading-child selector is an s7 implementation detail, not fixed
  here. s6 (committed) is untouched — it is already law-correct; this aligns the *consumer* to the token.
- **Fleet-wide convention (recorded so it is not re-derived):** every later control's geometry smoke proves
  `[density]` on a **gap-bearing** layout and asserts **frame-invariance** where slotless. The component
  rubric's REALIZE/geometry dimension grades against this.
- **Negative — the gold button is no longer the simplest possible control.** The optional slot + the
  two-variant smoke add surface. Mitigated: the slot is *optional* (the bare-label path stays trivial), and
  the added surface **is** the law the reference must teach.

## Alternatives considered

- **Keep the button strictly slotless and relax the `[density]` assertion** (drop it / assert invariance
  only) — rejected: the reference control should *exercise* the full law, and dropping the change-assertion
  leaves the density token-path unproven by any control at G5 (weaker coverage). The gold bar said "defer
  nothing."
- **Keep slotless and make the frame density-bearing** (`inline-pad × --ui-density`) — rejected: directly
  violates the law (density never touches the frame — it un-centers the glyph and breaks the square); s6's
  committed test forbids it.
- **Make the icon slot required** (every button has an icon) — rejected: over-constrains; bare-label is the
  common case. An *optional* slot via the presence-driven `:has()` grid covers both **and** demonstrates the
  grid switch itself.
- **Prove `[density]` on a later control** (e.g. `ui-text-field`'s affordance gap) — rejected: G5 is the
  geometry-law proving vertical; the reference control should prove the density path itself, not punt it to G6.
