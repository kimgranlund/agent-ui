# ADR-0015 — Container surface model (elevation × brightness) + the `--ui-space` / `--ui-radius-base` tokens

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, turning the ratified G9 container-family session into the token contract |
> | **Ratified by** | Kim, 2026-07-12 — the repo-alignment Phase-0 checkpoint (all five June foundation ADRs ratified together; shipped law since late June) |
> | **Repairs** | `goals §G9` (NEW — the surface/space DoD) · `references/tokens.md` (NEW surface-axis section) · `references/geometry.md` (the *Container/layout* size-class — the `--ui-space` ladder + `--ui-radius-base`) · **NEW** `@agent-ui/shared` `dimensions.css` (`--ui-space-*`, `--ui-radius-base`) + `tokens.css` (the both-axes composition) |
> | **Supersedes / Superseded by** | Relates: **ADR-0007** (the universal-selector ramp — `--ui-space` joins the `*` ramp, density-responsive) · **ADR-0008/0009** (the role-ladder / no-`color-mix` discipline this surface model obeys) · the `ui-text-field` radius follow-up (#71, the shared `--ui-radius-base`) |

## Context

The ratified G9 session (2026-06-28) lands A2UI's layout primitives as a `ui-*` container family. A container's
two new visual jobs — **what plane it sits on** and **how spaciously it lays out** — have no token contract yet:
`@agent-ui/shared` ships the control ramp (`--ui-height/font/gap-*`, the `[scale]`/`[density]` multipliers,
ADR-0007) and the colour roles, but no **surface** axis and no **layout-spacing** ladder. `references/geometry.md`
already reserves the `Container/layout` size-class ("gaps/margins/padding off `--space-*` × density; no control
height") and names `--space-*` as *spacing between components, not control geometry* — but the ladder is unbuilt.

Two facts of the existing token layer decide the surface design and forbid a from-scratch palette:

- **`tokens.css` already ships two neutral surface ladders** (confirmed): the **scheme-inverting** elevation ladder
  `--md-sys-color-neutral-surface-{lowest…low / high…highest}` (light `050→200`, dark `950→800` — so "up" reads darker in
  light, lighter in dark) and the **scheme-consistent** brightness ladder `--md-sys-color-neutral-surface-{dimmest…dim /
  bright…brightest}`. The ratified session reuses these as the two axes — **no new surface roles**.
- **The discipline is zero component colour opinion / no `color-mix`** (ADR-0008, `tokens.md`): a container must
  read one role-pure seam, and every state/axis must repoint a `--md-sys-color-{family}-{role}` token, never synthesize a
  shade.

The single open detail the session flagged: the two axes both want to drive the background, so **how they compose
when both are set** is unresolved — and the exact ladder values, any shadow ramp, and AA verification are
tokens-specialist work, not a planning call.

## Decision

We add a **two-axis container surface model** + the **`--ui-space`** spacing ladder + a shared **`--ui-radius-base`**
token. Five clauses, each a buildable acceptance (decomp slices `s1` tokens / `s2` base):

1. **The two axes (semantics + solo mapping — reuse, no new roles).** A container carries two signed,
   reflected, literal-union props, both `n ∈ -3|-2|-1|0|1|2|3`, default `0`:
   - **`elevation`** → the scheme-**inverting** plane: `-3..3` map onto `--md-sys-color-neutral-surface-{lowest, lower, low,
     ⟨base⟩, high, higher, highest}`; `elevation=0` → `--md-sys-color-neutral-surface` (the neutral base).
   - **`brightness`** → the scheme-**consistent** tonal shift: `-3..3` map onto `--md-sys-color-neutral-surface-{dimmest,
     dimmer, dim, ⟨base⟩, bright, brighter, brightest}`; `brightness=0` → `--md-sys-color-neutral-surface`.

   `0` in either axis is the neutral base, so **an unset container is unchanged**. Typed as literal unions (not
   `number`), matching `size: 'sm'|'md'|'lg'` — a `@ts-expect-error` proves a bare number is rejected.
2. **One role-pure consumption seam.** The container reads exactly `background: var(--ui-container-bg)`; the
   `[elevation=n]` / `[brightness=m]` selectors repoint `--ui-container-bg` (and, for the composition below,
   `--ui-container-tint`) in the token/CSS layer. The component holds **zero** colour opinion and reads no
   `--md-sys-color-*` role or primitive directly — forced-colors is free (the roles carry the WHCM mapping, `tokens.md`).
3. **The composition rule (the proposed mechanism — both axes set).** The surface is **two stacked paint layers**,
   resolved entirely in the token/CSS layer:
   - **Base plane (elevation)** — `background-color: var(--ui-container-bg)`, the solid surface role of clause 1.
   - **Tonal layer (brightness)** — a flat fill stacked above the base (`background-image:
     linear-gradient(var(--ui-container-tint), var(--ui-container-tint))`); `brightness=0` → `transparent`
     (no-op).

   When both are set the tonal layer composites (alpha-over) onto the elevated plane → **one well-defined,
   commutative result** (`[elevation=2][brightness=-1]` = the −1 wash over the +2 plane), preserving each axis's
   solo mapping (clause 1) instead of one silently overwriting the other. **The component contract is the single
   `--ui-container-bg`/`--ui-container-tint` seam + the two reflected axes + `0`=neutral — fixed regardless of
   realization.** Routed to **tokens-specialist** (decomp `s1`): the brightness tonal layer's exact values (the
   existing `-dimmest…-brightest` ladder is *solid*, not translucent, so the wash needs a deliberately-designed
   per-scheme alpha role or a reused scrim role); whether `elevation` also engages a `--ui-container-shadow` ramp;
   and the AA verification of `--md-sys-color-neutral-on-surface` across the combined **7×7** extremes
   (`elevation=3,brightness=-3` and `elevation=-3,brightness=3`) in **both** schemes.
4. **`--ui-space` — the density-responsive layout-spacing ladder.** A new ramp in `@agent-ui/shared`
   `dimensions.css`, declared on the `*` subtree ramp (ADR-0007) so a subtree `[density]` re-multiplies it:
   `--ui-space-{...}: calc(<base px> * var(--ui-density))`. It is the gap/padding/margin **between** laid-out
   children (Row/Column/List/Grid gap, Card padding) — distinct from control geometry (the `h/2` law,
   `geometry.md`); density rides it (rhythm family), `[scale]` does not. The exact step vocabulary/base px is
   tokens-specialist's (`s1`).
5. **`--ui-radius-base` — one shared radius token.** A constant in `dimensions.css` (`:root`, not the `*` ramp —
   it is not subtree-derived) that a root container's corner radius reads, and that the `ui-text-field` radius
   follow-up (#71) also adopts — one fleet radius serving both controls and containers. It seeds the one-level
   nested-radius chain (ADR-0018).

## Consequences

- **Realized by** decomp `s1` (tokens-specialist — the `@agent-ui/shared` token files + the composition realization
  + the AA surface) and `s2` (the `UIContainerElement` base — the two reflected props, the `surfaceProps` spread,
  the `--ui-container-bg`/`-tint` consumption seam, the shared `container.css` axis mapping). Every fan-out
  container element inherits the axes via the base; none re-declares them (DRY, no drift).
- **`--ui-space` ≠ control geometry.** Keeping the two ledgers separate (layout spacing vs. the `h/2` centring law)
  is deliberate — `geometry.md` already forbids interchanging them. A container has **no** control height; it never
  reads `--ui-height-*`.
- **The composition is a *proposal* with a fixed seam.** If tokens-specialist's realization needs a different
  mechanism (a composed token, or a precedence), the component contract (clause 2/3 seam) does not move — only the
  token the seam resolves to. This is the explicit hand-off boundary; planning does not pre-empt the AA work.
- **Stale → re-verify:** `tokens.md` gains a surface-axis section; `geometry.md`'s `Container/layout` row gains the
  `--ui-space`/`--ui-radius-base` referents; nothing shipped reads these tokens, so the add is purely additive.
  `#71` (text-field pill radius) is unblocked by `--ui-radius-base`.

## Alternatives considered

- **Precedence (one axis wins when both set)** — rejected: it silently discards an axis the agent explicitly set,
  and the A2UI catalog binds both `elevation` and `brightness` independently, so a both-set payload is normal, not
  an edge. The layered model loses neither axis.
- **A 49-cell composed surface ladder** (`--md-sys-color-neutral-surface-e{n}-b{m}`) — not chosen by planning, but **left open
  to tokens-specialist** as a realization of clause 3: it keeps the single seam but adds 49 roles × 2 schemes ×
  the AA surface. The layered-paint mechanism reaches the same single seam with the *existing* roles plus (at most)
  one brightness wash role — lighter — so it is the recommended realization; the composed ladder is the fallback if
  the wash cannot hit AA.
- **A component `color-mix` to blend the two axes** — rejected outright: a mix ratio is a component colour opinion;
  ADR-0008/`tokens.md` bar it. Composition stays in the token/CSS layer.
- **A fresh elevation/brightness palette** (the draft's `--md-sys-color-surface-elevation-*` sketch) — rejected: `tokens.css`
  already ships two purpose-built neutral surface ladders (one inverting, one consistent) that map 1:1 onto the two
  axes. Reuse; do not duplicate.
- **`--ui-space` on `:root` (not the `*` ramp)** — rejected: a subtree `[density]` must re-multiply layout spacing
  the same way it re-multiplies the gap (ADR-0007's exact lesson — a `:root` constant freezes density at 1 for
  subtrees). Layout spacing is density-responsive, so it joins the `*` ramp.

## Amendment — `ui-text-field` adopts `--ui-radius-base` (2026-06-28, the foreseen #71 radius branch resolves)

Clause 5 booked, when it added the shared `--ui-radius-base`, that it is the radius "the `ui-text-field` radius
follow-up (**#71**) also adopts — one fleet radius serving both controls and containers." Task #71 resolved
**yes**: `ui-text-field` replaces its pill frame radius (`calc(--ui-text-field-height / 2)`, the `h/2` stadium it
shipped with at G6 because no fleet radius token yet existed) with the **fixed `--ui-radius-base` rounded-rect**.
The decision of clause 5 does not change — `--ui-radius-base` is the one fleet radius; this is the anticipated
second consumer arriving. (The task's other branch — "engage tokens-specialist to add a `--ui-radius-base` token"
— is now **moot**: the token already shipped at `s1`, value `12px`.)

The principle the adoption articulates — recorded normatively in `geometry.md` ("Corner radius"):

- **Action / keyboard controls** (the button family) keep the **pill `= h/2`** (frame-∝-height, the press
  affordance). Unchanged.
- **Entry / surface controls** (`ui-text-field`, the field family) take the **fixed `--ui-radius-base`** — the
  **same** referent the container family (card/modal) uses, because a field is an entry *surface* kin to a
  container, not an action affordance. A fixed corner (the `:root` constant of clause 5, **not** `[scale]`-derived)
  reads as a typing surface and visually unifies fields with the surfaces they sit on. The browser clamps
  `border-radius` to `≤ h/2` automatically, so a very dense/short field degrades gracefully to the pill — never
  overflows.

This is the **field-radius pattern** the next entry control reuses (a future number-field / select-field /
textarea takes `--ui-radius-base`, not `h/2`). It is token-/CSS-layer only — no new token, no JS, no behaviour
change. `references/geometry.md` records the law; ADR-0014 (the `ui-text-field` control) is the consumer whose
frame radius changes.

### Build brief — for execution-lead (no re-decision)

No new shared token (`--ui-radius-base` exists, `12px`, `dimensions.css`); **no `tokens-specialist`**; **no test
churn** (verified — the text-field geometry probes pin the inline-**padding** `h/2` / `½(h−icon)`, which is
**unchanged**; nothing asserts `border-radius`). Two files, role-purity preserved:

1. **`controls/text-field/text-field.css`** —
   - In the **`:where(ui-text-field)` TOKEN block** (where the fleet dimension tokens are already consumed, e.g.
     `--ui-text-field-height: var(--ui-height-md)`), add the component alias next to the `bg`/`ink`/`border`
     tokens (it is size-**invariant**, so it goes in the base block **once**, not in the per-size `[scale]` blocks):
     `--ui-text-field-radius: var(--ui-radius-base);`
   - In the **`@scope (ui-text-field)` `:scope` rule** (currently `border-radius: calc(var(--ui-text-field-height)
     / 2)`), consume the **component token** (role-purity — `@scope` reads only `--ui-text-field-*`):
     `border-radius: var(--ui-text-field-radius);`
   - Reword the frame comment (the "frame-family pill (= h/2)" note) to: a fixed `--ui-radius-base` rounded-rect —
     the container fleet referent, overridable per-field via `--ui-text-field-radius` (ADR-0015 cl.5 / this
     amendment). Gate: `npm run check && npm test` (+ the existing css-hygiene/geometry probes stay green —
     padding is untouched; the `:where()` read of `--ui-radius-base` parallels the existing `--ui-height-*` read).
2. **`controls/text-field/text-field.md`** — in the `geometry:` frontmatter block, add a `radius:` line:
   `radius: var(--ui-radius-base) (fixed rounded-rect — the container-fleet referent, NOT the h/2 pill; entry-control class, geometry.md "Corner radius" / ADR-0015 cl.5 #71 amendment)`. No pill claim exists elsewhere in the
   descriptor to unwind (the `inlinePad` line is padding, not radius — leave it).
