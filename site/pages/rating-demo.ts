// site/pages/rating-demo.ts — the ui-rating interaction demo (the ratified pattern `demo`; pairs with the
// rating-doc.html API page; ADR-0216, GH #1395). Mounts the REAL star-value control in BOTH its shipped
// modes on one type (ADR-0216 cl.1): a readonly aggregate score (fraction-accurate — 4.3 paints a 4.3-star
// fill) and an interactive "rate this" input (bound value, keyboard/pointer commit). Proves the contract
// honestly: `input` fires on every live change (pointer pick/drag, keyboard step), `change` fires on blur
// once the value has moved since focus (the commit-on-blur contract, rating.md) — the live readout beside
// each control mirrors the value, the event log proves the timing. The control owns the clamp/snap/mark
// (rating.ts + rating.css); this page stages and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { applyDemoWidth, captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-rating — demo',
  intro:
    'The star-value control, live: a readonly aggregate score, an interactive "rate this" input, and a ' +
    'halves-enabled variant. Click a star or focus the row and use Arrow/Page/Home/End — input fires on ' +
    'every live change, change fires on blur once the value moved. The API table is on the ui-rating API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

type RatingHost = HTMLElement & { value: number }

// ── the event log — shared by every interactive control, tagged by which one fired ────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const record = (source: string, kind: string, value: number): void => {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  ${kind}  value=${value}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── display idiom (ADR-0216 cl.1/cl.5) — readonly + a bound aggregate score, fraction-accurate ────────────
const average = el('ui-rating', {
  name: 'average', label: 'Average rating', max: '5', value: '4.3', readonly: '',
}) as RatingHost
const averageReadout = el('output', { 'aria-live': 'polite' }, [text('4.3 / 5')])
const averageRow = el('div', { style: 'display:flex; gap:1rem; align-items:center; flex-wrap:wrap;' }, [
  average, averageReadout,
])
const averageNote = el('p', {}, [
  text('A bound '), code('value="4.3"'), text(' paints a 4.3-star fill exactly — display never rounds to '),
  code('step'), text(' (ADR-0216 cl.2). '), code('readonly'), text(' inerts both the keyboard and pointer ' +
    'write paths (not only an announced aria-readonly); the star row is still focusable.'),
])

// ── input idiom — the same type, readonly=false, an integer star scale ────────────────────────────────────
const rate = el('ui-rating', { id: 'rate', name: 'rate', label: 'Rate this', max: '5', value: '0' }) as RatingHost
const rateReadout = el('output', { for: 'rate', 'aria-live': 'polite' }, [text('0 / 5')])
rate.addEventListener('input', () => {
  rateReadout.textContent = `${rate.value} / 5`
  record('rate', 'input', rate.value)
})
rate.addEventListener('change', () => record('rate', 'change', rate.value))
const rateRow = el('div', { style: 'display:flex; gap:1rem; align-items:center; flex-wrap:wrap;' }, [
  rate, rateReadout,
])

// ── halves — step=0.5 opts into half-star input; the WRITE path snaps, display stays fraction-accurate ────
const halves = el('ui-rating', {
  id: 'halves', name: 'halves', label: 'Rate this (halves)', max: '5', step: '0.5', value: '2',
}) as RatingHost
const halvesReadout = el('output', { for: 'halves', 'aria-live': 'polite' }, [text('2 / 5')])
halves.addEventListener('input', () => {
  halvesReadout.textContent = `${halves.value} / 5`
  record('halves', 'input', halves.value)
})
halves.addEventListener('change', () => record('halves', 'change', halves.value))
const halvesRow = el('div', { style: 'display:flex; gap:1rem; align-items:center; flex-wrap:wrap;' }, [
  halves, halvesReadout,
])
const halvesNote = el('p', {}, [
  text('Click near a half-star boundary or use the arrow keys — each write snaps to the nearest 0.5 ' +
    'multiple (ADR-0216 cl.2: the WRITE path quantizes; a bound display value never does).'),
])

// ── sizes — every parsed [size] tier off the compact-realm ramp ──────────────────────────────────────────
const sized = (size: string): HTMLElement => {
  const s = el('ui-rating', { name: `size-${size}`, size, max: '5', value: '3', 'aria-label': `size ${size}` })
  applyDemoWidth(s, '8rem')
  return s
}
const sizeRow = el('div', { style: 'display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap;' }, [
  captioned('size="sm"', sized('sm')),
  captioned('size="md"', sized('md')),
  captioned('size="lg"', sized('lg')),
])

// ── states — disabled + a bare row (no label) ───────────────────────────────────────────────────────────
const disabled = el('ui-rating', { name: 'locked', label: 'Reliability (locked)', max: '5', value: '2', disabled: '' })
const bare = el('ui-rating', { name: 'bare', 'aria-label': 'Quality', max: '5', value: '3' })
const stateRow = el('div', { style: 'display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap;' }, [
  captioned('disabled', disabled),
  captioned('aria-label only (no visible label)', bare),
])

const keyboard = el('p', {}, [
  text('Focus a star row and use '), code('ArrowLeft/Right'), text(' or '), code('ArrowUp/Down'),
  text(' (one step), '), code('PageUp/PageDown'), text(' (a larger jump), '), code('Home/End'),
  text(' (min/max). Each keystroke emits '), code('input'), text('; tabbing away after a net move emits one '),
  code('change'), text('. Both are inert on the readonly average row above.'),
])

content.append(
  exampleSection('Average rating (readonly, fraction-accurate)', averageRow, averageNote),
  exampleSection('Rate this', rateRow),
  exampleSection('Rate this (halves)', halvesRow, halvesNote),
  exampleSection('input / change event log', log, keyboard),
  exampleSection('Sizes', sizeRow),
  exampleSection('States', stateRow),
)
