# ADR-0018 — CSS one-level nested radius (`--ui-card-child-radius`), the JS controller rejected

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, ratified G9 container-family session |
> | **Ratified by** | orchestration-lead (on gate) |
> | **Repairs** | `goals §G9` (NEW — the `ui-card` nested-radius DoD) · `references/geometry.md` (the card radius rule) · **NEW** `controls/card/*` |
> | **Supersedes / Superseded by** | Relates: **ADR-0015** (`--ui-radius-base` seeds the chain root) |

## Context

The ratified G9 session ships `ui-card` (+ `ui-card-header`/`-content`/`-footer`). Concentric rounded rectangles
look correct only when the inner radius shrinks with nesting — the **concentric-corner law**, `r_child = max(0,
r_parent − padding_parent)`. Same-radius nesting bows the inner corner away from the outer at the diagonal.

The design exploration (the parked draft) proposed a **JS `nestedRadius(host)` controller** to handle **arbitrary**
nesting depth: on connect + a `ResizeObserver` + a mutation observer, find the nearest ancestor card, read its
**resolved** `border-radius` + `padding` via `getComputedStyle`, and set the element's own radius. The ratified
session **rejected** that controller and chose **CSS-only, exactly one level**.

The reason pure CSS cannot do arbitrary depth on its own is real and worth recording: the natural idea — an
inherited custom property each card self-decrements (`--r: calc(var(--r) − var(--pad))`) — is a **self-referential
custom property**, i.e. a CSS cycle, so it computes as invalid (`guaranteed-invalid`). CSS has no
arbitrary-ancestor depth counter, so a single inherited token cannot step per level. **CSS-only therefore handles
exactly one level**; depth ≥ 2 would need the rejected depth signal (the JS controller). The session's judgement:
one level is the overwhelmingly common case (a card with a nested inset card), and it is not worth a per-card
`ResizeObserver` + `getComputedStyle` + mutation-observer controller and its reconnect/teardown lifecycle hazard to
buy automatic depth ≥ 2.

## Decision

We implement nested radius in **pure CSS, one level deep**. Three clauses (decomp `s7`, the card family):

1. **Root radius from `--ui-radius-base`.** A `ui-card` with no ancestor card rounds to
   `border-radius: var(--ui-card-radius, var(--ui-radius-base))` (the shared token, ADR-0015). An author may
   override with an explicit `border-radius` (or `--ui-card-radius`) — that becomes the chain root.
2. **A parent publishes one child radius.** A `ui-card` declares, for its children to read, a single
   `--ui-card-child-radius: max(0px, var(--ui-card-radius) − var(--ui-card-padding))` (the concentric-corner law,
   the parent's padding folded in; the ~1px border term ignored). A nested `ui-card` reads it for its **own** radius:
   `--ui-card-radius: var(--ui-card-child-radius, var(--ui-radius-base))`. A region (`ui-card-content` etc.) that
   paints a fill clips to the card's **inner** radius `= --ui-card-radius − --ui-card-padding`.
3. **One level only; manual past it; explicit reseeds.** The published `--ui-card-child-radius` is **not**
   re-decremented down the tree (that would need the cycle/depth-counter CSS cannot express). At depth ≥ 2 a card
   either inherits the level-1 child radius (acceptable — the visible error is small and only at deep nesting) or an
   author sets an explicit `border-radius`, which **reseeds** the chain from there. The geometry probe asserts the
   level-0→level-1 decrement (`child == max(0, parent − padding)`); deeper levels are documented as manual.

## Consequences

- **Realized by** decomp `s7` (`controls/card/`). The card-family CSS owns the publish/read of
  `--ui-card-child-radius`; no JS, no observer, no lifecycle to leak.
- **Zero runtime cost, zero lifecycle hazard.** No `ResizeObserver`, no `getComputedStyle` read on every card, no
  mutation observer, no reconnect re-arm — the radius is declarative CSS. This is the decisive win over the
  controller: containers are numerous, and a per-card observer triad is real cost for a deep-nesting case that is
  rare.
- **The known limitation is explicit.** Depth ≥ 2 is not automatically concentric. This is documented in
  `card.md` + `geometry.md`; the escape hatch (an explicit `border-radius` reseed) is one line of author CSS. If a
  real product later needs automatic deep concentricity, that is a **new** ADR re-opening the JS controller — not a
  silent addition.
- **Stale → re-verify:** `geometry.md` gains the one-level radius rule; `--ui-radius-base` (ADR-0015) is the chain
  root. Nothing shipped depends on it (net-new).

## Alternatives considered

- **The JS `nestedRadius(host)` controller (arbitrary depth)** — **rejected**: it buys automatic depth ≥ 2 at the
  cost of a `ResizeObserver` + `getComputedStyle` (a forced sync layout read) + a style/attribute mutation observer
  **per card**, plus the connect/disconnect/reconnect lifecycle every trait must get right to stay leak-free. The
  benefit (concentric corners below the first nested card) is marginal and rare; the cost is paid by every card on
  the page. The reconnect re-arm and the `getComputedStyle`-on-every-mutation read are exactly the kind of hidden
  cost the zero-dependency, signals-first architecture avoids. Kept on the shelf behind a future ADR if a product
  need appears.
- **A single inherited self-decrementing custom property** (`--r: calc(var(--r) − var(--pad))`) — rejected because
  it **cannot work**: a custom property referencing itself is a CSS cycle → `guaranteed-invalid`. Recorded so no one
  re-attempts it.
- **Two-name ping-pong** (alternating `--r-a`/`--r-b` by nesting parity) — rejected: it only steps correctly if
  nesting depth parity is known, and CSS has no ancestor-depth counter to drive the alternation. It degenerates at
  the first off-parity nest.
- **Same radius at every level (ignore concentricity)** — rejected: the inner corner visibly bows away from the
  outer at the diagonal; the one-level decrement fixes the common case for free, so there is no reason to ship the
  wrong look.
