---
name: layout-composition
description: >-
  Compose ONE screen/page layout from agent-ui's layout primitives — structure a page with
  row/column/grid/card/tabs/modal/disclosure, own its scroll region, set the scale/density
  axes, and prove the whole rendered shape. Use for "lay out this dashboard", "structure
  this settings page", "fix this page's broken scroll / collapsed regions", "make this
  screen denser". NOT for the feature fragments placed INTO the layout (ui-composition), the
  app-wide shell/routing/theming spine (app-composition), or generic layout THEORY —
  regions, hierarchy, the two-axis method (screens:break-down-layout is the method spine; this
  skill is its agent-ui realization).
user-invocable: true
disable-model-invocation: false
---

# Compose layout — one screen from the layout primitives

Structures a screen with the fleet's container/layout tier and proves the **whole rendered
shape** — the known failure class is a layout that passes every per-part probe and still
collapses to a sliver. Method questions (what regions, what hierarchy) belong to
`screens:break-down-layout`; this skill is the agent-ui realization. Worked exemplars:
`site/pages/layout-overview.ts` (the primitives, live) and the docs site's own page shell
(`site/pages/_page.ts` + `_page.css`).

## Procedure

1. **Decompose the screen first** (screens:break-down-layout where a real design question exists;
   inline for a conventional page): regions, hierarchy, what scrolls, what's sticky.
2. **Structure with the container/layout tier** — `ui-row`/`ui-column`/`ui-grid` for
   arrangement, `ui-card`/`ui-tabs`/`ui-disclosure`/`ui-modal` for surfaces (`ui-modal` as
   a SCREEN-level surface belongs here; a confirm dialog inside a feature's flow is
   [[ui-composition]]'s); enumerate what's available via [[component-catalog]] (the
   `tier:` field partitions the fleet). The box-alignment dialect is `start`/`end`
   (ADR-0039); grids are gap-only. A structure NO primitive fits is a gap report →
   [[component-design]], never a bespoke primitive on a shared surface.
3. **Consume the box-model, don't fight it** — [[composition-patterns]]'s
   container-box-model row owns this law (ADR-0046); the one-line shape: surfaces own their
   padding, page CSS adds structure BETWEEN them.
4. **Own exactly one scroll region** — [[composition-patterns]]'s scroll-ownership
   row owns this law (TKT-0004's settle-deferral lesson included); the one-line shape: decide
   the ONE overflowing element, target scroll-to code at it, sticky rides the box-model.
5. **Set the axes on containers** — `[scale]` and `[density]` cascade; set them at region
   roots so a whole area sizes together (`site/pages/sizing.ts` shows the tiers live).
   Theming a region = a `ui-theme-provider` boundary (mind the ink re-root — the patterns
   map's theming row). The fleet's ONE viewport-responsive token is ADR-0150's compact-body
   breakpoint — body column −1px below 52.5rem/840px (the fleet's default 414×896 test
   viewport sits BELOW that line; a layout proof at desktop width alone misses the register
   most probes actually run in).
6. **Give widths a floor** — content in flex/grid cells collapses to min-content without a
   definite basis; realistic containers in tests, `min-inline-size` floors where the design
   needs them (the entry-control frame law is precedent, not license to hardcode).
7. **Prove the WHOLE shape** — a `.browser.test.ts` asserting the screen's gestalt in a
   realistic viewport: the regions' bounding boxes are real (not 0×0/sliver), the scroll
   region actually overflows and scrolls, `[scale]`/`[density]` changes move real pixels.
   Per-part assertions alone are the documented trap
   ([[component-testing]]'s whole-shape law).

## Failure branch — a red whole-shape probe on a loaded host

A gestalt probe red under machine contention is a claim about the HOST, not the layout: reap
orphaned test-browser processes and re-run the shard in isolation before touching the layout
(the flaky-gates discipline — a different failing set per run is contention; the same probe
red in isolation is the real defect, route it).

## Review (generator ≠ critic)

`screens:layout-checker` grades the composed screen (the two-axis rubric). Hand off before
shipping; fix the layout, not the check.

## Definition of done

- [ ] Regions structured from the container/layout tier; box-model consumed, not fought.
- [ ] Exactly one owned scroll region; sticky via the box-model.
- [ ] Axes set at region roots; theme boundaries via `ui-theme-provider`.
- [ ] Whole-shape browser proof green (gestalt + scroll + axis response).
- [ ] `screens:layout-checker` pass done.
