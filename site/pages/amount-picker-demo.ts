// site/pages/amount-picker-demo.ts: the ui-amount-picker demo (T-0196; pairs with amount-picker-doc.ts, the
// descriptor-derived API page). Mounts the real control over the approved mockup data, each picker on an A2UI
// canvas register (widget, scale md, the 24px control row): a Shopkeeper quantity with chips, a Negotiator offer
// with the slider, a bare Concierge guest count with no commit, a unit distance, and a bet at its bound. One log
// proves the contract: `input` per live change, `change` once per settled change, `action` once per commit with
// the number in context, and nothing from the page's own programmatic write.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-amount-picker: demo',
  intro:
    'The bounded number picker, live: press minus or plus, pick a chip, drag the slider, or focus the readout ' +
    'and use the arrow keys, then commit. The API table is on the ui-amount-picker API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

type PickerHost = HTMLElement & { value: number }

// ── the event log, shared by every picker and tagged by which one fired ──────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const record = (source: string, kind: string, detail: string): void => {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  ${kind}  ${detail}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

/** One picker on its own A2UI canvas register, wired to the log. */
const canvasPicker = (source: string, attrs: Record<string, string>): { canvas: HTMLElement; picker: PickerHost } => {
  const picker = el('ui-amount-picker', attrs) as PickerHost
  for (const kind of ['input', 'change'] as const) picker.addEventListener(kind, () => record(source, kind, `value=${picker.value}`))
  picker.addEventListener('action', (event) => record(source, 'action', JSON.stringify((event as CustomEvent).detail)))
  const canvas = el('div', {
    'data-tier': 'widget',
    'data-scale': 'md',
    style: 'max-inline-size:24rem; padding:var(--md-sys-widget-margin); border-radius:var(--md-sys-widget-radius); background:var(--md-sys-color-neutral-surface-bright);',
  }, [picker])
  return { canvas, picker }
}

// ── [1] Shopkeeper: a cart quantity with chips ────────────────────────────────────────────────────────────
const quantity = canvasPicker('quantity', {
  label: 'Quantity', min: '1', max: '20', value: '4', presets: '[1,2,4,8]', 'action-name': 'add_to_cart', 'action-label': 'Add to cart',
})
const quantityNote = el('p', {}, [
  text('A chip reads selected only while the value equals it, so a minus press after picking 4 clears the check.'),
])

// ── [2] Negotiator: a currency offer with the slider ──────────────────────────────────────────────────────
const offer = canvasPicker('offer', {
  label: 'Your offer', min: '200', max: '600', step: '10', value: '420', currency: 'USD', slider: '', 'action-name': 'send_offer', 'action-label': 'Send offer',
})
const reset = uiButton('Reset to 300 (programmatic)', 'soft')
reset.style.alignSelf = 'flex-start' // only the trigger hugs; the canvas fills like its siblings (the T-0142 demo idiom)
reset.addEventListener('click', () => {
  offer.picker.value = 300
})
const offerBlock = el('div', { style: 'display:flex; flex-direction:column; gap:var(--md-sys-widget-margin);' }, [offer.canvas, reset])
const offerNote = el('p', {}, [
  code('currency="USD"'), text(' formats the readout as a currency amount; the value and the action context stay numbers. ' +
    'The reset button writes '), code('value'), text(' from the page, and the log stays quiet.'),
])

// ── [3] Concierge: a bare guest count, committed by a sibling Button ──────────────────────────────────────
const guests = canvasPicker('guests', { label: 'Guests', min: '1', max: '8', value: '2' })
const guestsNote = el('p', {}, [
  text('No '), code('action-name'), text(': no commit button renders, so a sibling Button can commit the bound value.'),
])

// ── [4] A unit distance with chips and the slider, and a bet at its bound ─────────────────────────────────
const distance = canvasPicker('distance', {
  label: 'Distance', min: '1', max: '42', value: '12', unit: 'kilometer', presets: '[5,10,21,42]', slider: '', 'action-name': 'set_distance', 'action-label': 'Set distance',
})
const bet = canvasPicker('bet', {
  label: 'Bet', min: '5', max: '250', step: '5', value: '250', currency: 'USD', presets: '[25,50,100,250]', slider: '', 'action-name': 'place_bet', 'action-label': 'Place bet',
})
const boundNote = el('p', {}, [
  text('At max the plus button is disabled and drops its fill for an outline, so the bound never rests on color alone.'),
])

content.append(
  exampleSection('Shopkeeper: quantity with chips', quantity.canvas, quantityNote),
  exampleSection('Negotiator: a currency offer with the slider', offerBlock, offerNote),
  exampleSection('Concierge: guests, no commit', guests.canvas, guestsNote),
  exampleSection('A unit value and a bet at its bound', el('div', { style: 'display:grid; gap:var(--md-sys-widget-margin);' }, [distance.canvas, bet.canvas]), boundNote),
  exampleSection('Event log', log),
)
