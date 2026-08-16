// site/pages/swiper-doc.ts — the ui-swiper API doc page (ADR-0124, swiper-family.lld.md). DERIVED from
// swiper.md via the shared doc-page.ts renderer (the attribute table is the surfaceProps spread +
// orientation/slides-in-view/align/loop/duration/easing/pagination/paddles + the bindable active). One
// representative LIVE specimen: a small image-style gallery with author-placed pagination + paddles. See the
// ui-swiper demo for the full loop + responsive + chrome-composition story.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadSwiperDoc } from '../lib/frontmatter.ts'
import { composeDocPage, renderChangelogTable } from '../lib/doc-page.ts'
import { el, exampleSection, demoBox } from '../lib/specimens.ts'
import { codeBlock } from '../lib/code-block.ts'

const { descriptor, body } = loadSwiperDoc()

const { content } = mountPage({
  title: 'ui-swiper — API',
  intro: 'A CSS-native scroll-snap carousel — the fleet\'s first scroll-snap surface. Generated ' +
    'from swiper.md (descriptor-derived tables). See the ui-swiper demo for the infinite loop, responsive ' +
    'slides-in-view, and the full chrome-composition story.',
})

const gallery = el('ui-swiper', { pagination: '', paddles: '' }, [
  el('ui-swiper-item', {}, [demoBox('Slide 1')]),
  el('ui-swiper-item', {}, [demoBox('Slide 2')]),
  el('ui-swiper-item', {}, [demoBox('Slide 3')]),
])

// ── zero-JS consumer proof (#953, ADR-0102's CSS-less-consumer law — nothing about this rendering
// correctly depends on page-author CSS OR page-author JS) ──────────────────────────────────────────────────
// The literal markup below is the WHOLE consumer contract: three attributes (`pagination`/`paddles` on the
// host, nothing on the items) and zero <script>. No `goTo`/`next`/`prev` call, no event listener, no
// imperative API of any kind is attached to this specimen — gesture drag/trackpad/touch snap (native
// scroll-snap, ADR-0124 F1), keyboard (arrow/Home/End on the track), and the pagination-dot/paddle click
// affordances are entirely component-owned. The only script a consumer ever needs is the ONE import that
// defines the five custom elements — the same "install the library" step every ui-* control already
// requires, not per-instance wiring for THIS widget's behaviour.
const zeroJsMarkup = `<ui-swiper pagination paddles>
  <ui-swiper-item>…</ui-swiper-item>
  <ui-swiper-item>…</ui-swiper-item>
  <ui-swiper-item>…</ui-swiper-item>
</ui-swiper>`

const zeroJsGallery = el('ui-swiper', { pagination: '', paddles: '' }, [
  el('ui-swiper-item', {}, [demoBox('A')]),
  el('ui-swiper-item', {}, [demoBox('B')]),
  el('ui-swiper-item', {}, [demoBox('C')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', gallery))
content.append(
  exampleSection('Zero-JS consumer proof', codeBlock(zeroJsMarkup, 'html'), zeroJsGallery),
)

// Provenance (TKT-0054): the decision record this page's intro previously cited inline now lives here only —
// HAND-AUTHORED, not derivable from any canonical index (no ADR/TKT index cross-links to the pages it built).
const changelog = renderChangelogTable([
  { date: '2026-07-10', type: 'Decision', id: 'ADR-0124', summary: 'Shipped ui-swiper: the fleet\'s first CSS-native scroll-snap carousel family, with a clone-teleport infinite loop.' },
])
if (changelog) content.append(changelog)
