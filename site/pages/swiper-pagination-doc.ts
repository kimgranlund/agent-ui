// site/pages/swiper-pagination-doc.ts — the ui-swiper-pagination API doc page (ADR-0124, swiper-family.lld.md
// LLD-C9). DERIVED from swiper-pagination.md via the shared doc-page.ts renderer. See the ui-swiper-pagination
// demo for both `type` variants live, and swiper-doc.ts for the family overview.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css'
import { loadSwiperPaginationDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, demoBox } from '../lib/specimens.ts'

const { descriptor, body } = loadSwiperPaginationDoc()

const { content } = mountPage({
  title: 'ui-swiper-pagination — API',
  intro: 'An author-placed dots/fraction anchor the owning ui-swiper fills and wires. Generated from ' +
    'swiper-pagination.md. See the ui-swiper-pagination demo for both type variants live.',
})

const swiper = el('ui-swiper', {}, [
  el('ui-swiper-item', {}, [demoBox('One')]),
  el('ui-swiper-item', {}, [demoBox('Two')]),
  el('ui-swiper-item', {}, [demoBox('Three')]),
  el('ui-swiper-pagination', {}, []),
])

composeDocPage(content, descriptor, body, exampleSection('Example', swiper))
