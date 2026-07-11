// site/pages/swiper-doc.ts — the ui-swiper API doc page (ADR-0124, swiper-family.lld.md). DERIVED from
// swiper.md via the shared doc-page.ts renderer (the attribute table is the surfaceProps spread +
// orientation/slides-in-view/align/loop/duration/easing/pagination/paddles + the bindable active). One
// representative LIVE specimen: a small image-style gallery with author-placed pagination + paddles. See the
// ui-swiper demo for the full loop + responsive + chrome-composition story.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadSwiperDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, demoBox } from '../lib/specimens.ts'

const { descriptor, body } = loadSwiperDoc()

const { content } = mountPage({
  title: 'ui-swiper — API',
  intro: 'A CSS-native scroll-snap carousel (ADR-0124) — the fleet\'s first scroll-snap surface. Generated ' +
    'from swiper.md (descriptor-derived tables). See the ui-swiper demo for the infinite loop, responsive ' +
    'slides-in-view, and the full chrome-composition story.',
})

const gallery = el('ui-swiper', { pagination: '', paddles: '' }, [
  el('ui-swiper-item', {}, [demoBox('Slide 1')]),
  el('ui-swiper-item', {}, [demoBox('Slide 2')]),
  el('ui-swiper-item', {}, [demoBox('Slide 3')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', gallery))
