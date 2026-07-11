// site/pages/swiper-demo.ts — the ui-swiper interaction demo (the ratified pattern demo; ADR-0124,
// swiper-family.lld.md §13 n24). Two live specimens: an infinite-loop image gallery with author-placed
// pagination + paddles + label (loop="" — the seamless clone-teleport wrap), and a responsive card deck
// (slides-in-view="" — the @container-driven column count) with a select-event log proving the bindable
// active/select commit contract. The control owns all scroll/loop/ARIA mechanics; this page only stages
// representative content.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, demoBox } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-swiper — demo',
  intro:
    'ui-swiper, live — the infinite clone-teleport loop, a responsive card deck, and the bindable active/' +
    'select commit. Drag/scroll the track, use the paddles, click a pagination dot, or focus the track and ' +
    'press the arrow keys. The API table is on the ui-swiper API page.',
})

// ── loop gallery — author-placed label + pagination + paddles, loop="" ─────────────────────────────────────
const loopGallery = el('ui-swiper', { loop: '', orientation: 'horizontal' }, [
  el('ui-swiper-label', {}, [document.createTextNode('Featured destinations')]),
  el('ui-swiper-item', {}, [demoBox('Reykjavík')]),
  el('ui-swiper-item', {}, [demoBox('Lisbon')]),
  el('ui-swiper-item', {}, [demoBox('Kyoto')]),
  el('ui-swiper-item', {}, [demoBox('Marrakesh')]),
  el('ui-swiper-pagination', {}, []),
  el('ui-swiper-paddles', {}, []),
])

// ── responsive card deck — slides-in-view='' (@container-driven columns), the select event log ────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logSelect(detail: unknown): void {
  seq += 1
  const line = document.createElement('li')
  const d = detail as { value: string; index: number }
  line.textContent = `#${String(seq).padStart(2, '0')}  select  →  value=${d.value}  index=${d.index}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

const deck = el('ui-swiper', { 'slides-in-view': '', pagination: '', paddles: '' }, [
  el('ui-swiper-item', { value: 'a' }, [demoBox('Card A')]),
  el('ui-swiper-item', { value: 'b' }, [demoBox('Card B')]),
  el('ui-swiper-item', { value: 'c' }, [demoBox('Card C')]),
  el('ui-swiper-item', { value: 'd' }, [demoBox('Card D')]),
  el('ui-swiper-item', { value: 'e' }, [demoBox('Card E')]),
])
deck.addEventListener('select', (e) => logSelect((e as CustomEvent).detail))

const note = el('p', {}, [
  document.createTextNode(
    'The loop gallery never bottoms out in either direction — the clone-teleport wrap is pixel-seamless. ' +
      'The card deck resizes its visible column count with the viewport (slides-in-view=""); dragging it (or ' +
      'clicking a dot/paddle) settles a new active slide and fires exactly one select — a programmatic write ' +
      'to active never echoes.',
  ),
])

content.append(
  exampleSection('Infinite loop — author-placed label + pagination + paddles', loopGallery),
  exampleSection('Responsive card deck — the bindable active/select commit', deck, note),
  exampleSection('select event log', log),
)
