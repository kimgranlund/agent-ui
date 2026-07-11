// site/pages/swiper-label-doc.ts — the ui-swiper-label API doc page (ADR-0124, swiper-family.lld.md LLD-C11).
// DERIVED from swiper-label.md via the shared doc-page.ts renderer. See swiper-doc.ts for the family
// overview — this display-only anchor has no interaction demo of its own (tier=display ⇒ {doc} only).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css'
import { loadSwiperLabelDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, demoBox } from '../lib/specimens.ts'

const { descriptor, body } = loadSwiperLabelDoc()

const { content } = mountPage({
  title: 'ui-swiper-label — API',
  intro: 'An author-placed anchor whose light-DOM text becomes the owning ui-swiper\'s accessible name. ' +
    'Generated from swiper-label.md.',
})

const swiper = el('ui-swiper', {}, [
  el('ui-swiper-label', {}, [document.createTextNode('Featured products')]),
  el('ui-swiper-item', {}, [demoBox('One')]),
  el('ui-swiper-item', {}, [demoBox('Two')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', swiper))
