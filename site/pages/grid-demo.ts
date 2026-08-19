// site/pages/grid-demo.ts — the ui-grid interaction demo (the ratified layout `demo`; pairs with grid-doc.html,
// the API page). Mounts the REAL auto-fit / minmax track grid as a photo grid (captioned tiles, one featured
// tile spanning two tracks through the child's own CSS — children are the author's) and a KPI tile grid, and
// lets the reader flip its live props — gap / min / elevation — with real ui-button knobs; the knob log records
// every attribute write (grid.md `events: []` — a layout primitive's whole contract is attribute-in → layout-out).
// The reader can also drag the resizable frame to watch the column COUNT reflow off the grid's own width — no
// breakpoint prop exists by design (ADR-0016 cl.3). grid.css owns the mechanics; grid.ts threads `min` into
// the role-pure --ui-grid-min token.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log · .demo-box · .reflow-frame)
import { captioned, demoBox, el, exampleSection } from '../lib/specimens.ts'
import { enumKnob, knobLog } from '../lib/layout-demo-knobs.ts'

const { content } = mountPage({
  title: 'ui-grid — demo',
  intro: 'The auto-fit track grid, live. A photo grid (one tile spanning two tracks) and a KPI tile grid are ' +
    'laid out by real ui-grid instances; the knobs flip gap / min / elevation and the log records every ' +
    'attribute write; drag the frame to watch the column count reflow off the grid\'s own width. The API ' +
    'table is on the ui-grid API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── scenario 1: a photo grid — captioned tiles; the FIRST tile spans two tracks via its own grid-column ─────
// The tile "photo" is page-own content (a hue-shifted swatch — no remote asset), not a ui-* control restyled.
interface Photo { readonly title: string; readonly meta: string; readonly hue: number; readonly featured?: boolean }
const photos: readonly Photo[] = [
  { title: 'Harbour at dusk', meta: 'Aug 2 · 24 MP', hue: 210, featured: true },
  { title: 'Studio desk', meta: 'Aug 4 · 12 MP', hue: 30 },
  { title: 'Cycle path', meta: 'Aug 6 · 24 MP', hue: 120 },
  { title: 'Rain on glass', meta: 'Aug 8 · 12 MP', hue: 260 },
  { title: 'Bakery counter', meta: 'Aug 10 · 24 MP', hue: 40 },
  { title: 'Ferry deck', meta: 'Aug 12 · 24 MP', hue: 190 },
  { title: 'Night market', meta: 'Aug 14 · 12 MP', hue: 330 },
]
const tile = (p: Photo): HTMLElement =>
  el('ui-card', { elevation: '1', ...(p.featured ? { style: 'grid-column: span 2' } : {}) }, [
    el('div', {
      'aria-hidden': 'true',
      style: `block-size: 7rem; border-radius: inherit; background: hsl(${p.hue} 45% 55%)`,
    }),
    el('ui-card-content', {}, [
      el('ui-column', { gap: 'none' }, [
        el('ui-text', { variant: 'label' }, [text(p.title)]),
        el('ui-text', { variant: 'body', size: 'sm' }, [text(p.meta)]),
      ]),
    ]),
  ])
const photoGrid = el('ui-grid', { gap: 'md', min: '10rem' }, photos.map(tile))
const photoFrame = el('div', { class: 'reflow-frame' }, [photoGrid])

const spanNote = el('p', {}, [
  text('ui-grid has no span prop — the children are the author\'s. The featured tile sets '),
  code('grid-column: span 2'), text(' itself; the grid still packs as many '), code('minmax(min, 1fr)'),
  text(' tracks as its own width allows. Drag the frame edge: the '), strong('column count'),
  text(' changes with the grid\'s width, never a viewport breakpoint (ADR-0016 cl.3).'),
])

// ── scenario 2: a KPI tile grid — a dashboard header row of stats, the roomier `min` case ─────────────────
const kpi = (label: string, value: string, delta: string): HTMLElement =>
  el('ui-card', { elevation: '1' }, [
    el('ui-card-content', {}, [
      el('ui-column', { gap: 'xs' }, [
        el('ui-text', { variant: 'overline' }, [text(label)]),
        el('ui-text', { variant: 'headline' }, [text(value)]),
        el('ui-text', { variant: 'body', size: 'sm' }, [text(delta)]),
      ]),
    ]),
  ])
const kpiGrid = el('ui-grid', { gap: 'md', min: '12rem' }, [
  kpi('Active users', '12,480', '+4.2% vs last week'),
  kpi('Sessions', '38,912', '+1.1% vs last week'),
  kpi('Error rate', '0.32%', '−0.05 pt vs last week'),
  kpi('p95 latency', '412 ms', '−18 ms vs last week'),
])

// The knobs drive BOTH grids so one flip shows the same prop on two compositions.
const targets = [photoGrid, kpiGrid]
const log = knobLog()
const knobs = el('ui-column', { gap: 'sm' }, [
  enumKnob(targets, 'gap', ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'], log),
  enumKnob(targets, 'min', ['6rem', '8rem', '10rem', '12rem', '16rem', '20rem'], log),
  enumKnob(targets, 'elevation', ['0', '1', '2', '3', '-1'], log),
])

// ── the `min` specimens — the same six cells at three track floors, side by side ─────────────────────────────
const minGrid = el('div', { class: 'demo-grid' }, ['6rem', '10rem', '16rem'].map((min) =>
  captioned(`min="${min}"`, el('ui-grid', { gap: 'sm', min }, [1, 2, 3, 4, 5, 6].map((n) => demoBox(`Cell ${n}`)))),
))

content.append(
  exampleSection('Photo grid', photoFrame, spanNote),
  exampleSection('KPI tiles', kpiGrid),
  exampleSection('Knobs', el('p', {}, [text('Each knob writes the attribute on both grids above; the active value is solid.')]), knobs),
  exampleSection('Knob log', log.list),
  exampleSection('min — the track floor', minGrid),
)
