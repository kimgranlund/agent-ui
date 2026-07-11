// site/pages/swiper-paddles-demo.ts — the ui-swiper-paddles interaction demo (the ratified pattern demo).
// Two specimens: non-loop (the paddles disable at each end) and loop (they never disable — there is no
// terminal slide).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css'
import { el, exampleSection, demoBox } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-swiper-paddles — demo',
  intro: 'ui-swiper-paddles, live. The API table is on the ui-swiper-paddles API page.',
})

const nonLoop = el('ui-swiper', {}, [
  el('ui-swiper-item', {}, [demoBox('One')]),
  el('ui-swiper-item', {}, [demoBox('Two')]),
  el('ui-swiper-item', {}, [demoBox('Three')]),
  el('ui-swiper-paddles', {}, []),
])

const loop = el('ui-swiper', { loop: '' }, [
  el('ui-swiper-item', {}, [demoBox('One')]),
  el('ui-swiper-item', {}, [demoBox('Two')]),
  el('ui-swiper-item', {}, [demoBox('Three')]),
  el('ui-swiper-paddles', {}, []),
])

content.append(
  exampleSection('Non-loop — the paddles disable at each end', nonLoop),
  exampleSection('Loop — the paddles never disable (no terminal slide)', loop),
)
