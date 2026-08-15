# Single-surface primitives: containers, overlays, scroll, theming, scale

The recurring per-surface consumption patterns — box-model padding, chip rows, overlay
open/close, page-CSS discipline, scroll ownership, theming subtrees, scale/density, and
scheme-divergence — plus the CSS-less-consumer law that governs all of them. Read this file
when a single page or panel needs wiring or when a composed surface looks visually broken.

| Assembly problem | The fleet's answer | Owner · exemplar |
|---|---|---|
| Spacing inside cards/modals/panels | the `[data-box]` container box-model owns region padding and content gaps — CONSUME it; adding your own padding inside a boxed region double-pads | ADR-0046 · `packages/agent-ui/components/src/controls/_surface/container-box.css` |
| A label ↔ value chip row inside a card body (a structured-container detail line) | `ui-row[justify='between']` + `ui-text[variant='label']` + `ui-badge[intent='neutral']` (a plain value chip) — zero new mechanism, stack N rows inside `ui-card-content` for its existing 8px adjacent-sibling rhythm. Pairs with `ui-card-header[format='structured']` (the mono-kicker title + divider) for the full Figma dialog-bubble look, but the row recipe composes on its own too | ADR-0186 (the intake's §4b) · `packages/agent-ui/components/src/controls/card/card.md` + `site/pages/card-demo.ts` (the "Structured header" example) |
| Opening/closing an overlay from page code | the overlay-bearing control's **prop is the source of truth** — flip the prop (`open = !open`), never poke a platform handle (`.showPopover()`/`handle.toggle()`) under the control | ADR-0101 (the model-driven open/close loop) + ADR-0045 (platform-owned dismissal) · `packages/agent-ui/components/src/controls/select/`, `…/controls/menu/` |
| Page styling around controls | a control must work with ZERO consumer CSS (ADR-0102) — so a page never NEEDS to restyle `ui-*` internals; element-level overrides remain a page freedom (ADR-0102 keeps them), but the docs-site discipline is never to use it (states/appearance belong to the control's own CSS), and a visual defect routes down the lanes BEFORE any page CSS lands | ADR-0102 · the docs site's own pages (any `site/pages/*.css`) |
| "Where does the page scroll?" | ONE owned scroll region per surface — the site shell's is `.app-page` (`site/pages/_page.css`; the document never overflows); scroll-into-view code must target the real scroller, deferred past layout settle | TKT-0004's findings · `site/pages/a2a-artifact-feed.ts` (`revealScroll`) |
| Theming a subtree (dark panel in a light app) | wrap in `ui-theme-provider` — `scheme` re-roots `color-scheme`; UNSET means inherit-ambient; remember `color` does NOT re-root with it (the ink re-root lesson: re-declare text color where a scheme boundary starts) | ADR-0117 · `packages/agent-ui/components/src/controls/theme-provider/` + `site/lib/component-gallery.css` (the ink re-root rule) |
| Sizing a region's controls together | the `[scale]` tier attribute (ui-sm…content-lg) and `[density]` (compact/comfortable/spacious) cascade over subtrees — set them on containers, not per-control | ADR-0032/0038 (the law is [[component-standards]]'s territory) · `site/pages/sizing.ts` |
| Scheme-divergence expectations | some color roles are deliberately scheme-INVARIANT (`--md-sys-color-primary` identical both branches) — check the role's two `light-dark()` branches before expecting a dark/light difference | `@agent-ui/shared` tokens.css · `site/lib/theme-provider-build.browser.test.ts` (its probe comments name the invariant) |

## The one law under all of it

**The CSS-less consumer** (ADR-0102): every shipped control must be fully functional and
presentable with zero consumer CSS. If a composed surface looks broken, route the bug down
ADR-0102's three lanes — component-owned defect · catalog-reachable prop gap · taught idiom
(the page held it wrong) — before writing page CSS over it (the ADR states the lanes as
contract-authoring rules; the diagnostic use is this map's recast). Visual proof: the
ADR-0110 screenshot harness (Chromium committed baselines, opt-in `*.visual` suites) plus
computed-style probes as WebKit's sanctioned leg.
