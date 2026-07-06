// site/pages/gallery.ts — the <component-gallery> page (LLD-C5, ADR-0079). Follows the page convention
// exactly: `_page.ts` FIRST (the load-bearing foundation CSS cascade + self-defining ui-* controls,
// ADR-0003), then the gallery's own side-effect import, then append it into the page content.
import { mountPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '../lib/component-gallery.ts' // self-defining <component-gallery> (+ <theme-provider>, <component-preview>)

const { content } = mountPage({
  title: 'Component gallery',
  intro:
    'Every shipped ui-* control, live and filterable, themed through one <theme-provider> (scheme · scale · ' +
    'density). Derived from the same descriptors the per-component doc pages read — a new control appears ' +
    'here automatically.',
})

content.append(document.createElement('component-gallery'))
