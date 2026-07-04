# ADR-0046 — The container box-model: margin inset, the sticky-region pattern, and the header/content/footer padding system

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-01
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-01 |
> | **Proposed by** | orchestration-lead — on Kim's directive that "all containers should have an inset/gap system expressed as children's margins", plus a header/content/footer pattern (sticky headers, dividers) and a fixed region padding (inline 12 · block 4 · gap 8, nested content stepping in one inset per level). Design forks confirmed with Kim (rollout scope; flow-root + margin-collapse). |
> | **Ratified by** | orchestration-lead — on the green `check` + `test` (jsdom) + `test:browser` (both engines) + `size`, and screenshot review of the card + modal + select panels. |
> | **Repairs** | **NEW** `controls/_surface/container-box.css` (+ its structure probe) · `component-styles.css` (`@import`, after `container.css`) · the overlay panels `controls/{select,menu,combo-box}/*.{ts,css}` (`[data-box]` + inset margins; select group-headers sticky) · `controls/card/card.{css}` + its geometry/browser tests (rolled onto the model; nested-radius re-based) · `controls/modal/modal.{ts,css}` + tests. |
> | **Supersedes / Superseded by** | None. **Extended by ADR-0056** (the region-less card humane default — a CSS fallback leg on the "card holds no padding" law: a Card with NO region children gets region-equivalent padding; the law stands for region-bearing composition). **Relates** ADR-0015 (container surface — the PAINT layer this SPACING layer sits beside), ADR-0016 (layout), ADR-0018 (concentric nested-radius — re-based here off the content inline padding), ADR-0041 (widget geometry). |

## Context

Containers each carried bespoke spacing (card: `:has()` grid + `--ui-space-md` padding; modal: `--ui-space-lg`
shell; overlay panels: ad-hoc option padding). Kim asked for **one** inset/gap system across every container,
expressed as children's margins (so a child can opt out), plus a header/content/footer pattern with **sticky**
headers, dividers, and a fixed region padding.

## Decision

A second shared surface layer, `_surface/container-box.css` — SPACING, beside `container.css`'s PAINT. A
surface opts in with **`[data-box]`**.

1. **Margin inset (the box).** `[data-box]` is a `flow-root` BFC with no inner padding; direct children get a
   uniform **`--ui-box-inset` (0.25rem / 4px)** margin. In a BFC adjacent block margins **collapse** to one
   inset (4px between siblings) and the edge inset is preserved — not doubled. A child overrides to `margin: 0`
   for **full-bleed**; **`[padded]`** = `margin: 0` + inset padding. All rules are `:where()` (specificity 0),
   opt-in, forced-colors-safe.

2. **The sticky-region pattern.** `header`/`footer` (or `[data-region=header|footer]`) are full-bleed +
   `position: sticky` with `background: inherit` (the box surface, so scrolled content never shows through) —
   trivially overridable. `hr` is a full-bleed divider. `content`/`main` is the scroll region between them.

3. **The region padding system (fixed).** The region wrappers carry their own internal padding: **inline 12px
   · block 4px · gap 8px** (`--ui-box-pad-inline` / `-pad-block` / `-gap`, rem-based → density-INVARIANT). A
   **nested content steps its inline padding IN one inset per level (12 → 8 → 4, floored)** so a
   content-inside-content stays concentric with its parent's ink (parent 12 = child inset-margin 4 + child pad
   8). This is expressed as **explicit descendant levels**, NOT a self-referencing custom property.

### Two load-bearing implementation gotchas (both verified in-browser)

- **A self-referencing custom property is a CSS cycle.** `--x: calc(var(--x) - 4px)` is guaranteed-invalid;
  the step-down measured 0px that way. The fix is explicit `content content { … }` descendant levels. (The same
  trap ADR-0018 already records for the nested-radius chain.)
- **Content gap must not use flex.** A flex-column content shrinks a tall child and breaks `[scrollable]`
  block-scroll. Content stays `display: block`; the 8px child rhythm comes from an **adjacent-sibling margin**
  (`> * + * { margin-block-start }`) — gap-without-flex, scroll-safe.

### Rollout (foundation + panels first, then the region containers — Kim's scope)

- **Overlay panels** (`select`/`menu`/`combo-box`): panel `[data-box]`, shell padding → 0, option rows inset by
  the box margin. `ui-select` group headers are now **sticky** (pinned, taking the panel surface) with dividers
  between groups.
- **`ui-card`:** no card padding/gap; header/content/footer are full-bleed with the region padding; content
  children get the 8px adjacent-sibling rhythm. The concentric nested-radius chain (ADR-0018) **re-bases off
  the CONTENT inline padding** (a nested card lives in content); full-bleed region fills round to the **outer**
  radius. Region padding is now density-INVARIANT (was `--ui-space`-driven).
- **`ui-modal`:** the `<dialog>` is a `[data-box]` with zero shell padding; author header/content/footer
  regions get the system; loose content falls back to the 4px box inset.

## Consequences

- One spacing vocabulary across the whole container family; a control opts in with `[data-box]` and marks its
  regions. `@scope` hygiene holds by aliasing the shared `--ui-box-*` tokens through per-control `--ui-{name}-*`.
- **Behaviour change:** card/modal region padding is fixed (rem), so **density no longer scales container
  padding** (it still scales the `--ui-space`-based adornment gaps). This was Kim's explicit fixed-px spec.
- Browser tests that import a control sheet directly must also import `container-box.css` to exercise the region
  padding (it lives in the shared layer, not the control sheet) — as the modal smoke now does.

## Alternatives

*(Recorded 2026-07-04 from the shipped Decision + `container-box.css` — the real options weighed at design time.)*

- **Flexbox `gap` for the region-child rhythm** — rejected: a region's content wrapper is `display: block` so
  `overflow: auto` scrolls a block flow; the 8px rhythm is a scroll-safe adjacent-sibling margin, not `gap`.
- **A self-referencing custom property for the nested inline-padding step (12→8→4)** — rejected: CSS treats a
  property that reads itself as a cycle (invalid); explicit per-level descendant selectors realize the step.
- **`--ui-space`-driven, density-scaled region padding** — rejected: Kim's explicit fixed-px (rem) spec makes
  region padding density-INVARIANT (Consequences); density still scales adornment gaps.
- **Per-control bespoke padding instead of one shared `--ui-box-*` vocabulary** — rejected: one spacing
  vocabulary across the whole container family, opted into via `[data-box]` (the Amendment below is the one
  deliberate, scoped opt-*out*).

## Amendment — 2026-07-04 (`ui-card` region padding: a scoped 6px override)

Per Kim's directive (intent-extracted: "ui-card should have 6px padding by default" + "block-padding for
card-header/content/footer 4px → 6px"), **`ui-card` overrides the shared region-padding default of inline
12px / block 4px with a uniform 6px inline + 6px block** — card-only. The shared model above is UNCHANGED for
every other `[data-box]` surface (modal / select / menu / combo-box / calendar panels keep 12/4). The override
is realized in `card.css` by repointing `--ui-box-pad-inline` / `--ui-box-pad-block` to `0.375rem` on
`:where(ui-card)` and consuming them through a card-private `--ui-card-region-pad-*` intermediary (so a nested
container surface inside a card re-asserts its own 12/4 and cannot inherit the card's 6px). This is a deliberate
divergence from "one spacing vocabulary across the whole container family" (Consequences above), scoped and
documented in `card.css` / `card.md`; the shared vocabulary remains the default that a control opts *out* of.
Independent component-review: GO (cascade robustness confirmed by two mechanisms). Gates green
(check · jsdom 2408 · browser 588).
