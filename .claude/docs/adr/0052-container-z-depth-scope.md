# ADR-0052 — A container is its own z-depth scope (`isolation: isolate` on `[data-box]`)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Proposed by** | the host session (a worker fork, on Kim's directive, 2026-07-02) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-01, on the green s14 wave gate; the directive itself was Kim's |
> | **Date** | 2026-07-02 |
> | **Repairs** | `controls/_surface/container-box.css` (the `[data-box]` rule + header doc) · `controls/_surface/container-box.test.ts` (the declaration probe + the small-and-local z guard) · **NEW** `controls/_surface/container-box.browser.test.ts` (the rendered sibling-overlap proof, both engines, with a negative control) · **extends ADR-0046** (the box-model layer gains the paint-scope leg) |
> | **Supersedes / Superseded by** | None. **Extends ADR-0046** (the `[data-box]` container box-model — spacing/regions; this adds the z-depth scope to the same opt-in). **Relates ADR-0043/0045** (overlays ride the native top layer, immune to stacking contexts — why containers can isolate aggressively without a z ladder for popups). |

## Context

The fleet's container chrome uses `z-index` — the `[data-box]` sticky header/footer brackets
(`container-box.css`), the select panel's internals, the calendar's sticky weekday header. Without an owned
stacking context, those indexes join the **page's** stacking order: in any overlap layout (negative margins,
dragged cards, toasts over a list) one container's `z-index: 1` chrome can paint over a *sibling* container's
content, and the only consumer remedy is a global z ladder — the `z-index: 9999` arms race the fleet has so
far avoided only by luck of layout. The accidental stacking-context routes (`transform`, `filter`,
`opacity<1`, `contain: paint`) all carry side effects (containing-block creation breaks `position: fixed`
descendants; paint containment clips). The fleet needs the scope without the side effects, on an opt-in it
already has.

## Decision

**`[data-box]` is its own z-depth scope: `isolation: isolate` joins the `:where([data-box])` rule** in
`_surface/container-box.css` — the same opt-in that owns the box model, so one attribute now grants the full
containment story: layout BFC (`flow-root`) **+ paint scope** (`isolation`).

1. `isolation: isolate` is the one purpose-built stacking-context property: it creates the scope and does
   **nothing else** — no containing block, no paint/clip effects, universal support.
2. Every descendant `z-index` (the sticky brackets' `z-index: 1`, select/calendar panel chrome) resolves
   **inside** the box. Between sibling containers, plain DOM order paints — a huge z-index inside one box is
   inert outside it, so **no global z ladder can exist**.
3. Internal chrome z-indexes stay **small and local** (the probe rejects any fleet z-index ≥ 20 in this
   sheet) — a large value is a tell that someone is re-fighting the war isolation ended.
4. Overlays are deliberately out of scope: popover/dialog surfaces ride the native **top layer**
   (ADR-0043/0045), which paints above all stacking contexts by spec — containers may isolate aggressively
   and popups are unaffected.

## Consequences

- **The fleet's sticky-region z-indexes become provably local** — the ADR-0046 pattern's one z-order
  dependency (header over scrolled content) keeps working inside the scope, proven by the browser probe.
- **A descendant `mix-blend-mode` can no longer blend with the backdrop *outside* its box** — the one real
  side effect of `isolation`. The fleet uses no blend modes today (grep-verified); if a blending surface
  ever ships, its container must document the opt-out (drop `[data-box]` or override `isolation`).
- **Layout primitives stay un-isolated** — `ui-row`/`-column`/`-list`/`-grid` are transparent structure, not
  surfaces; isolating them would surprise consumers whose positioned children legitimately stack against
  page content. The scope rides the *surface* opt-in, not the layout family.
- **Stale → re-verify:** `container-box.css` + its two probes · the card/modal/select/menu/combo-box panels
  (all `[data-box]` carriers — behavior verified via the existing suites staying green) · the calendar's
  sticky header (its panel carries `[data-box]`).

## Acceptance

- Static: `isolation: isolate` computes on the `:where([data-box])` rule; no z-index ≥ 20 anywhere in the
  sheet (`container-box.test.ts`).
- Rendered, Chromium AND WebKit (`container-box.browser.test.ts`): a `z-index: 9999` inside one `[data-box]`
  cannot paint over a later sibling box; the **negative control** (same markup, no `[data-box]`) proves the
  9999 *does* win without isolation — the probe bites; the sticky header still wins over its own box's
  scrolled content (the local `z-index: 1` works inside the scope).
- The full standing gates stay green (`check` + jsdom suite; the existing container/panel suites are the
  no-regression proof).

## Alternatives considered

- **A documented global z ladder (`--ui-z-*` tokens)** — rejected: a ladder manages the war instead of
  ending it; every new layer renegotiates the whole ladder, and consumer content still fights fleet chrome.
- **`contain: paint` / `contain: layout`** — rejected: creates the stacking context *plus* clipping /
  containing-block effects that break overflow chrome and `position: fixed` descendants.
- **`position: relative; z-index: 0` on the host** — rejected: works, but conscripts `position` (colliding
  with any element's own positioning needs) and reads as an accident; `isolation` states the intent.
- **Isolating every container including the layout family** — rejected: row/column/list/grid are transparent
  structure; scoping them would break consumers' legitimate cross-container stacking. The surface opt-in
  (`[data-box]`) is the boundary that has chrome to scope.
