---
name: agent-ui-composition-patterns
description: >-
  Route to the CONSUMER-side assembly patterns for agent-ui surfaces: form rhythm on the
  field/form-provider spine, container box-model consumption, driving overlays from a page,
  scroll-region ownership, theming subtrees, scale/density axes, and the CSS-less-consumer
  law. Use when assembling a page/feature and asking "how do I wire a form", "why is my
  container double-padded", "how do I open this menu programmatically", "why doesn't my
  page scroll", "how do I theme one section dark". One routing sentence + the owning
  ADR/exemplar per pattern (cite, never copy). NOT for the producer-side mechanisms inside
  controls (agent-ui-component-patterns) or which control to pick (agent-ui-catalog).
user-invocable: false
disable-model-invocation: false
---

# Composition patterns — the consumer assembly map

How a page correctly *consumes* the fleet. Each row: the assembly problem → the fleet's
answer → the owner (rationale) and the worked exemplar (live code). The mechanism stays in
the owner; deviating from a row on a shared surface is a fork, not a local choice.

| Assembly problem | The fleet's answer | Owner · exemplar |
|---|---|---|
| A labelled, validated form | `ui-form-provider` (the registry) + `ui-field` wrapping each control (the labelling seam; error rendering is reactive and field-owned) — never hand-rolled `<label for>` plumbing | ADR-0050/0051 · `site/pages/forms.ts` (one live form the whole guide narrates) |
| Spacing inside cards/modals/panels | the `[data-box]` container box-model owns region padding and content gaps — CONSUME it; adding your own padding inside a boxed region double-pads | ADR-0046 · `packages/agent-ui/components/src/controls/_surface/container-box.css` |
| Opening/closing an overlay from page code | the overlay-bearing control's **prop is the source of truth** — flip the prop (`open = !open`), never poke a platform handle (`.showPopover()`/`handle.toggle()`) under the control | ADR-0101 (the model-driven open/close loop) + ADR-0045 (platform-owned dismissal) · `packages/agent-ui/components/src/controls/select/`, `…/controls/menu/` |
| Page styling around controls | a control must work with ZERO consumer CSS (ADR-0102) — so a page never NEEDS to restyle `ui-*` internals; element-level overrides remain a page freedom (ADR-0102 keeps them), but the docs-site discipline is never to use it (states/appearance belong to the control's own CSS), and a visual defect routes down the lanes BEFORE any page CSS lands | ADR-0102 · the docs site's own pages (any `site/pages/*.css`) |
| "Where does the page scroll?" | ONE owned scroll region per surface — the site shell's is `.app-page` (`site/pages/_page.css`; the document never overflows); scroll-into-view code must target the real scroller, deferred past layout settle | TKT-0004's findings · `site/pages/a2a-artifact-feed.ts` (`revealScroll`) |
| Theming a subtree (dark panel in a light app) | wrap in `ui-theme-provider` — `scheme` re-roots `color-scheme`; UNSET means inherit-ambient; remember `color` does NOT re-root with it (the ink re-root lesson: re-declare text color where a scheme boundary starts) | ADR-0117 · `packages/agent-ui/components/src/controls/theme-provider/` + `site/lib/component-gallery.css` (the ink re-root rule) |
| Sizing a region's controls together | the `[scale]` tier attribute (ui-sm…content-lg) and `[density]` (compact/comfortable/spacious) cascade over subtrees — set them on containers, not per-control | ADR-0032/0038 (the law is [[agent-ui-component-standards]]'s territory) · `site/pages/sizing.ts` |
| Scheme-divergence expectations | some color roles are deliberately scheme-INVARIANT (`--md-sys-color-primary` identical both branches) — check the role's two `light-dark()` branches before expecting a dark/light difference | `@agent-ui/shared` tokens.css · `site/lib/theme-provider-build.browser.test.ts` (its probe comments name the invariant) |
| Navigation between views | memory-first routing: `createRouter`/`connectUrl` (headless core) + `ui-router-outlet`/`ui-router-link` on their own subpaths — URL reflection is opt-in; a2ui surfaces never see the router (catalog-invisible by construction) | ADR-0115 · `packages/agent-ui/router/` |
| Regions of an application shell | `ui-app-shell` + `ui-app-shell-region` — per-instance isolation, no global singletons | ADR-0082..0084 · `packages/agent-ui/app/` |

## The one law under all of it

**The CSS-less consumer** (ADR-0102): every shipped control must be fully functional and
presentable with zero consumer CSS. If a composed surface looks broken, route the bug down
ADR-0102's three lanes — component-owned defect · catalog-reachable prop gap · taught idiom
(the page held it wrong) — before writing page CSS over it (the ADR states the lanes as
contract-authoring rules; the diagnostic use is this map's recast). Visual proof: the
ADR-0110 screenshot harness (Chromium committed baselines, opt-in `*.visual` suites) plus
computed-style probes as WebKit's sanctioned leg.

## Cross-links

Which control → [[agent-ui-catalog]] · the compose procedures → [[agent-ui-compose-ui]] /
[[agent-ui-compose-layout]] / [[agent-ui-compose-app]] · producer-side internals →
[[agent-ui-component-patterns]] · the sizing/states/token LAW →
[[agent-ui-component-standards]].
