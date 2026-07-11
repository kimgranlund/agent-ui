// site/pages/swiper-pagination-demo.ts — the ui-swiper-pagination interaction demo (the ratified pattern
// demo). Both `type` variants (dots + fraction), author-placed inside a live ui-swiper. The anchor's own
// renderInto/click-wiring is exercised by clicking a dot to jump slides.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css'
import { el, exampleSection, demoBox } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-swiper-pagination — demo',
  intro: 'ui-swiper-pagination, live — click a dot to jump to that slide. The API table is on the ' +
    'ui-swiper-pagination API page.',
})

const dots = el('ui-swiper', {}, [
  el('ui-swiper-item', {}, [demoBox('Red')]),
  el('ui-swiper-item', {}, [demoBox('Green')]),
  el('ui-swiper-item', {}, [demoBox('Blue')]),
  el('ui-swiper-pagination', {}, []),
])

const fraction = el('ui-swiper', {}, [
  el('ui-swiper-item', {}, [demoBox('Red')]),
  el('ui-swiper-item', {}, [demoBox('Green')]),
  el('ui-swiper-item', {}, [demoBox('Blue')]),
  el('ui-swiper-pagination', { type: 'fraction' }, []),
])

content.append(
  exampleSection('type=dots (default)', dots),
  exampleSection('type=fraction', fraction),
)
