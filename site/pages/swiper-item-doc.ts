// site/pages/swiper-item-doc.ts — the ui-swiper-item API doc page (ADR-0124, swiper-family.lld.md LLD-C4).
// DERIVED from swiper-item.md via the shared doc-page.ts renderer. tier=layout — folds into the Layout
// primitives nav/landing bundle (no group of its own); see swiper-doc.ts for the family overview.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css'
import { loadSwiperItemDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, demoBox } from '../lib/specimens.ts'

const { descriptor, body } = loadSwiperItemDoc()

const { content } = mountPage({
  title: 'ui-swiper-item — API',
  intro: 'The slide of the ui-swiper family — an author-written wrapper around arbitrary content, sized ' +
    'entirely by the owning track. Generated from swiper-item.md. See the ui-swiper API page for the family ' +
    'overview.',
})

const swiper = el('ui-swiper', {}, [
  el('ui-swiper-item', { value: 'one' }, [demoBox('Slide one')]),
  el('ui-swiper-item', { value: 'two' }, [demoBox('Slide two')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', swiper))
