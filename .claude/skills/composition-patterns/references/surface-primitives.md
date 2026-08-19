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
| A full-width section header bar — kicker title + trailing actions (the Figma "Section Header", RICH and MINIMAL densities) | compose, never mint (GH #1434's design verdict — display-only chrome, no value/state/event, fails ADR-0220's TYPE arm): `ui-row[align='center'][justify='between']` as the bar; leading cluster = optional `ui-icon` (decorative → `aria-hidden`) + `ui-text[variant='kicker'][as='h2…h6']` (the kicker role carries uppercase + tracking ITSELF, text.css — never restyle it; `as` makes it a REAL heading); trailing cluster = `ui-toolbar[label='…']` holding `ui-badge` · `ui-button[size='sm']` · a `ui-text[variant='kicker'][as='a'][href]` text link · a `ui-menu` overflow. MINIMAL density = drop the icon and trailing items, keep title + overflow. Inside a card, `ui-card-header[format='structured']` already IS this treatment — don't rebuild it there | GH #1434 (verdict) + ADR-0078 cl.2b / GH #370 · #1291 (the kicker law) + ADR-0220 (the TYPE-arm bar) · `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (`#makeRegionKicker`) + `controls/card/card-header.ts` (`format='structured'`) — worked markup in §Section header below |
| Scheme-divergence expectations | some color roles are deliberately scheme-INVARIANT (`--md-sys-color-primary` identical both branches) — check the role's two `light-dark()` branches before expecting a dark/light difference | `@agent-ui/shared` tokens.css · `site/lib/theme-provider-build.browser.test.ts` (its probe comments name the invariant) |

## Section header — the worked recipe (GH #1434)

The Figma "Section Header" (Claude Code Gateway 112-1488) is a composition, not a control.
RICH density:

```html
<section aria-labelledby="topic-hd">
  <ui-row align="center" justify="between" gap="sm">
    <ui-row align="center" gap="sm">
      <ui-icon name="folder" aria-hidden="true"></ui-icon>
      <ui-text id="topic-hd" variant="kicker" as="h2">Topic</ui-text>
    </ui-row>
    <ui-toolbar label="Topic actions" gap="sm">
      <ui-badge intent="neutral">3 new</ui-badge>
      <ui-button size="sm" variant="solid">Action</ui-button>
      <ui-text variant="kicker" as="a" href="/topic">View all</ui-text>
      <ui-menu><!-- trigger + items — the ui-menu contract --></ui-menu>
    </ui-toolbar>
  </ui-row>
</section>
```

MINIMAL density is the same bar minus the icon and trailing cluster: title + `ui-menu`
overflow only. Load-bearing points, each already law elsewhere (cited, not restated):

- **The title is `variant='kicker'`, never a styled `h4`** — the exact GH #1291 defect
  class; the kicker role itself carries uppercase + tracking (`text.css`), so the consumer
  writes normal-case text and adds NO font CSS.
- **`as` carries the document semantics** (a real stamped heading, ADR-0078 cl.4) — pick the
  level from the page outline, not the visual size.
- **The trailing cluster is a `ui-toolbar`** — role=toolbar + roving focus over the actions
  for free; the bar itself stays a plain `ui-row` (a heading is not a toolbar item).
- **Full-width fill is free** — `ui-row` is a block-level fill container (ADR-0223); no
  width CSS.
- **Inside a card, use `ui-card-header[format='structured']`** (ADR-0186) instead of this
  recipe — the mono-kicker title + divider treatment is already shipped there.

## The one law under all of it

**The CSS-less consumer** (ADR-0102): every shipped control must be fully functional and
presentable with zero consumer CSS. If a composed surface looks broken, route the bug down
ADR-0102's three lanes — component-owned defect · catalog-reachable prop gap · taught idiom
(the page held it wrong) — before writing page CSS over it (the ADR states the lanes as
contract-authoring rules; the diagnostic use is this map's recast). Visual proof: the
ADR-0110 screenshot harness (Chromium committed baselines, opt-in `*.visual` suites) plus
computed-style probes as WebKit's sanctioned leg.
