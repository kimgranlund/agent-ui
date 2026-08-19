// site/pages/swiper-item-demo.ts — the ui-swiper-item interaction demo (the layout-tier slide of the ui-swiper
// family, ADR-0124 / swiper-family.lld.md LLD-C4; pairs with swiper-item-doc.ts, the API page). A slide has ONE
// prop — `key`, the stable identity the owning swiper's bindable `active` resolves against — so this page proves
// that identity where it matters: (1) a KEYED product tour where `active` is set by key (buttons write it
// programmatically — no select echo) beside an UNKEYED deck addressed by real index, both with a live active /
// activeIndex readout; (2) slides APPENDED at runtime — the owning swiper captures them, re-labels every real
// slide "n of N" via `labelAs`, and grows its pagination; (3) the `slides` getter under loop — real items only,
// the clone band excluded. The select log proves the user-gesture commit. The owning ui-swiper owns all
// scroll/loop/ARIA mechanics (swiper.ts); this page only stages content, writes `active`, appends slides, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + .demo-box + section spacing)
import { el, exampleSection, uiButton, demoBox } from '../lib/specimens.ts'
import type { UISwiperElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-swiper-item — demo',
  intro:
    'The slide of the ui-swiper family, live inside its owning track. A keyed tour is addressed by key, an ' +
    'unkeyed deck by index — the readouts show active and activeIndex resolve either way. Append a slide and ' +
    'the swiper captures it, re-labels every real slide "n of N", and grows its dots. The API table is on the ' +
    'ui-swiper-item API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// ── the shared select log — the ONE commit event, user gestures only ─────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logLine(name: string, verb: string, detail: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${name.padEnd(7)}${verb.padEnd(8)}${detail}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
function watchSelect(swiper: UISwiperElement, name: string): void {
  swiper.addEventListener('select', (e) => {
    const d = (e as CustomEvent<{ value: string; index: number }>).detail
    logLine(name, 'select', `value=${JSON.stringify(d.value)}  index=${d.index}`)
  })
}

// readout — a live "active=… · activeIndex=… · slides=…" line for one swiper (page content, refreshed on demand).
function readout(swiper: UISwiperElement, role: string): { node: HTMLElement; refresh: () => void } {
  const node = el('span', { 'data-role': role, style: 'font-family: var(--md-sys-typeface-mono); font-size:0.85rem;' })
  const refresh = (): void => {
    node.textContent = `active=${JSON.stringify(swiper.active)} · activeIndex=${swiper.activeIndex} · slides=${swiper.slides.length}`
  }
  refresh()
  // `active` reflects, so an attribute observer keeps the readout honest for user gestures AND programmatic writes.
  new MutationObserver(refresh).observe(swiper, { attributes: true, attributeFilter: ['active'], childList: true })
  return { node, refresh }
}

// slide — a tour step's page content (NOT a ui-* control): a title + a line of copy.
function slide(title: string, copy: string): HTMLElement {
  return el('div', { style: 'padding:1rem 1.25rem; min-block-size:6rem; display:flex; flex-direction:column; gap:0.35rem; justify-content:center;' }, [
    el('strong', { style: 'font-size:1rem;' }, [text(title)]),
    el('span', { style: 'font-size:0.85rem; color: var(--md-sys-color-neutral-on-surface-variant); line-height:1.4;' }, [text(copy)]),
  ])
}

// ── (1) keyed tour vs unkeyed deck ────────────────────────────────────────────────────────────────────────────
const TOUR = [
  { key: 'welcome', title: 'Welcome to Ledger', copy: 'A three-step tour of the workspace.' },
  { key: 'import', title: 'Import your accounts', copy: 'Connect a bank or drop in a CSV — statements reconcile automatically.' },
  { key: 'rules', title: 'Set categorisation rules', copy: 'Teach Ledger once; every matching transaction files itself.' },
  { key: 'reports', title: 'Read the reports', copy: 'Cash flow, runway and burn — updated the moment a transaction lands.' },
]
// No preset `active` in markup: the initial snap and the load-time scroll settle race on a freshly-painted
// track (the settle can commit slide 0 back), so the tour starts at its default first slide and the buttons
// below drive `active` programmatically — the write path this section demonstrates.
const tour = el('ui-swiper', { pagination: '', paddles: '', 'data-role': 'keyed-swiper' }, [
  el('ui-swiper-label', {}, [text('Getting started')]),
  ...TOUR.map((s) => el('ui-swiper-item', { key: s.key }, [slide(s.title, s.copy)])),
]) as UISwiperElement
watchSelect(tour, 'keyed')
const tourReadout = readout(tour, 'keyed-readout')

const keyButtons = el('div', { style: 'display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-block-end:0.75rem;' }, [
  ...TOUR.map((s) => {
    const b = uiButton(`active="${s.key}"`, 'soft')
    b.addEventListener('click', () => {
      tour.active = s.key // programmatic write — moves the track, NO select echo (binding hygiene)
      logLine('keyed', 'write', `active=${JSON.stringify(s.key)} (programmatic — no select)`)
    })
    return b
  }),
  tourReadout.node,
])

const unkeyed = el('ui-swiper', { pagination: '', paddles: '', 'data-role': 'unkeyed-swiper' }, [
  el('ui-swiper-label', {}, [text('Recent screenshots')]),
  el('ui-swiper-item', {}, [demoBox('shot-0001.png')]),
  el('ui-swiper-item', {}, [demoBox('shot-0002.png')]),
  el('ui-swiper-item', {}, [demoBox('shot-0003.png')]),
  el('ui-swiper-item', {}, [demoBox('shot-0004.png')]),
]) as UISwiperElement
watchSelect(unkeyed, 'index')
const unkeyedReadout = readout(unkeyed, 'unkeyed-readout')
const indexButtons = el('div', { style: 'display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-block-end:0.75rem;' }, [
  ...[0, 1, 2, 3].map((i) => {
    const b = uiButton(`active="${i}"`, 'soft')
    b.addEventListener('click', () => {
      unkeyed.active = String(i)
      logLine('index', 'write', `active="${i}" (programmatic — no select)`)
    })
    return b
  }),
  unkeyedReadout.node,
])

const identityNote = el('p', {}, [
  code('key'), text(' is the slide\'s stable identity: the owning swiper resolves '), code('active'),
  text(' against a real item\'s key FIRST; only when no key matches does a numeric string address a real index; anything else falls back to the ' +
    'first slide. A user gesture (drag, dot, paddle, arrow key) commits by emitting '), code('select'),
  text(' with '), code('{ value, index }'), text(' — where '), code('value'), text(' is the slide\'s key when it has one, else its index; a programmatic '),
  code('active'), text(' write moves the track silently.'),
])

// ── (2) append at runtime — captured, re-labelled "n of N", the dots grow ────────────────────────────────────
const CATALOG = [
  ['Ash side table', 'Solid ash, oiled finish.'],
  ['Linen throw', 'Stonewashed, 130 × 170 cm.'],
  ['Stoneware mug', 'Hand-glazed, 350 ml.'],
  ['Walnut tray', 'Oiled walnut, 40 cm.'],
  ['Cork coasters', 'Set of six.'],
] as const
const shelf = el('ui-swiper', { pagination: '', paddles: '', 'data-role': 'growing-swiper' }, [
  el('ui-swiper-label', {}, [text('New this week')]),
  el('ui-swiper-item', { key: 'p1' }, [slide(CATALOG[0][0], CATALOG[0][1])]),
  el('ui-swiper-item', { key: 'p2' }, [slide(CATALOG[1][0], CATALOG[1][1])]),
]) as UISwiperElement
watchSelect(shelf, 'shelf')
const shelfReadout = readout(shelf, 'growing-readout')
let appended = 2

const appendBtn = uiButton('Append a slide', 'soft')
appendBtn.addEventListener('click', () => {
  if (appended >= CATALOG.length) return
  const [title, copy] = CATALOG[appended]
  appended += 1
  const key = `p${appended}`
  shelf.append(el('ui-swiper-item', { key }, [slide(title, copy)])) // appended to the HOST — the swiper captures it into its track
  logLine('shelf', 'append', `key=${JSON.stringify(key)}  →  slides=${appended} (labels re-derive "n of ${appended}")`)
  queueMicrotask(shelfReadout.refresh) // capture runs in the swiper's own microtask — read the settled truth after it
})
const jumpBtn = uiButton('Jump to the newest', 'soft')
jumpBtn.addEventListener('click', () => {
  const last = shelf.slides.at(-1)
  if (!last) return
  shelf.active = last.key
  logLine('shelf', 'write', `active=${JSON.stringify(last.key)}`)
})
const shelfControls = el('div', { style: 'display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-block-end:0.75rem;' }, [
  appendBtn, jumpBtn, shelfReadout.node,
])
const appendNote = el('p', {}, [
  text('Slides MAY be added after connect: append a '), code('ui-swiper-item'), text(' to the swiper itself and its childList observer captures it into the track, ' +
    'rebuilds any clone band, re-labels EVERY real slide ('), code('role="group"'), text(', '), code('aria-roledescription="slide"'), text(', '),
  code('aria-label="n of N"'), text(' — pushed in through the public '), code('labelAs'), text(', all via ElementInternals, never a host attribute) and re-drives ' +
    'the pagination dots. '), strong('Only the owning swiper calls '), code('labelAs'), text(' — a sibling cannot reach another element\'s protected internals.'),
])

// ── (3) real vs clone — the `slides` getter under loop ───────────────────────────────────────────────────────
const loop = el('ui-swiper', { loop: '', paddles: '', 'data-role': 'loop-swiper' }, [
  el('ui-swiper-label', {}, [text('Team')]),
  el('ui-swiper-item', { key: 'ana' }, [demoBox('Ana — design')]),
  el('ui-swiper-item', { key: 'ben' }, [demoBox('Ben — platform')]),
  el('ui-swiper-item', { key: 'chi' }, [demoBox('Chi — research')]),
]) as UISwiperElement
watchSelect(loop, 'loop')
const cloneReadout = el('span', { 'data-role': 'clone-readout', style: 'font-family: var(--md-sys-typeface-mono); font-size:0.85rem;' })
function refreshClones(): void {
  const track = loop.querySelector('[data-part="track"]')
  const all = track ? track.querySelectorAll('ui-swiper-item').length : 0
  cloneReadout.textContent = `slides (real) = ${loop.slides.length} · track children (real + clones) = ${all}`
}
requestAnimationFrame(refreshClones)
const countBtn = uiButton('Re-count', 'soft')
countBtn.addEventListener('click', refreshClones)
const loopControls = el('div', { style: 'display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-block-end:0.75rem;' }, [countBtn, cloneReadout])
const loopNote = el('p', {}, [
  text('Under '), code('loop'), text(' the swiper clones a band of slides at each end for the seamless wrap. Clones are marked '),
  code('aria-hidden'), text(' + '), code('inert'), text(', are never labelled via '), code('labelAs'), text(', and are EXCLUDED from the '),
  code('slides'), text(' getter — so authoring code that walks '), code('swiper.slides'), text(' sees exactly the items it wrote, and '),
  code('activeIndex'), text(' is always a real index.'),
])

content.append(
  exampleSection('Keyed tour — active resolves by key', keyButtons, tour, identityNote),
  exampleSection('Unkeyed deck — active resolves by index', indexButtons, unkeyed),
  exampleSection('Append at runtime — captured + re-labelled', shelfControls, shelf, appendNote),
  exampleSection('Real vs clone — the slides getter under loop', loopControls, loop, loopNote),
  exampleSection('select log', log),
)
