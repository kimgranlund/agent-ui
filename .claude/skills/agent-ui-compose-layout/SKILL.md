---
name: agent-ui-compose-layout
description: >-
  Compose ONE screen/page layout from agent-ui's layout primitives — structure a page with
  row/column/grid/card/tabs/modal/disclosure, own its scroll region, set the scale/density
  axes, and prove the whole rendered shape. Use for "lay out this dashboard", "structure
  this settings page", "fix this page's broken scroll / collapsed regions", "make this
  screen denser". NOT for the feature fragments placed INTO the layout (agent-ui-compose-ui), the
  app-wide shell/routing/theming spine (agent-ui-compose-app), or generic layout THEORY —
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
   [[agent-ui-compose-ui]]'s); enumerate what's available via [[agent-ui-catalog]] (the
   `tier:` field partitions the fleet). The box-alignment dialect is `start`/`end`
   (ADR-0039); grids are gap-only. A structure NO primitive fits is a gap report →
   [[agent-ui-component-design]], never a bespoke primitive on a shared surface.
3. **Consume the box-model, don't fight it** — `[data-box]` surfaces own their region
   padding and content gaps (ADR-0046); page CSS adds structure BETWEEN surfaces, never
   padding inside them ([[agent-ui-composition-patterns]]).
4. **Own exactly one scroll region** — decide which element scrolls (the site shell's is
   `.app-page`; the document never overflows) and give it the overflow; scroll-to code
   targets that element, deferred past layout settle (the TKT-0004 lesson). Sticky
   headers/footers ride the box-model's sticky regions, not position hacks.
5. **Set the axes on containers** — `[scale]` and `[density]` cascade; set them at region
   roots so a whole area sizes together (`site/pages/sizing.ts` shows the tiers live).
   Theming a region = a `ui-theme-provider` boundary (mind the ink re-root — the patterns
   map's theming row).
6. **Give widths a floor** — content in flex/grid cells collapses to min-content without a
   definite basis; realistic containers in tests, `min-inline-size` floors where the design
   needs them (the entry-control frame law is precedent, not license to hardcode).
7. **Prove the WHOLE shape** — a `.browser.test.ts` asserting the screen's gestalt in a
   realistic viewport: the regions' bounding boxes are real (not 0×0/sliver), the scroll
   region actually overflows and scrolls, `[scale]`/`[density]` changes move real pixels.
   Per-part assertions alone are the documented trap
   ([[agent-ui-component-testing]]'s whole-shape law).

## Review (generator ≠ critic)

`ui:layout-reviewer` grades the composed screen (the two-axis rubric). Hand off before
shipping; fix the layout, not the check.

## Definition of done

- [ ] Regions structured from the container/layout tier; box-model consumed, not fought.
- [ ] Exactly one owned scroll region; sticky via the box-model.
- [ ] Axes set at region roots; theme boundaries via `ui-theme-provider`.
- [ ] Whole-shape browser proof green (gestalt + scroll + axis response).
- [ ] `ui:layout-reviewer` pass done.
