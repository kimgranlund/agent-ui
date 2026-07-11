// site/pages/swiper-paddles-doc.ts — the ui-swiper-paddles API doc page (ADR-0124, swiper-family.lld.md
// LLD-C10). DERIVED from swiper-paddles.md via the shared doc-page.ts renderer. See the ui-swiper-paddles
// demo for the loop vs. non-loop disable behaviour live, and swiper-doc.ts for the family overview.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css'
import { loadSwiperPaddlesDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, demoBox } from '../lib/specimens.ts'

const { descriptor, body } = loadSwiperPaddlesDoc()

const { content } = mountPage({
  title: 'ui-swiper-paddles — API',
  intro: 'An author-placed prev/next anchor the owning ui-swiper fills with two composed ui-buttons. ' +
    'Generated from swiper-paddles.md. See the ui-swiper-paddles demo for the loop vs. non-loop disable ' +
    'behaviour live.',
})

const swiper = el('ui-swiper', {}, [
  el('ui-swiper-item', {}, [demoBox('One')]),
  el('ui-swiper-item', {}, [demoBox('Two')]),
  el('ui-swiper-item', {}, [demoBox('Three')]),
  el('ui-swiper-paddles', {}, []),
])

composeDocPage(content, descriptor, body, exampleSection('Example', swiper))
