// site/pages/slider-demo.ts — the ui-slider interaction demo (the ratified pattern `demo`; pairs with the
// slider-doc.html API page). Mounts the REAL single-thumb Range control as a playback volume + a screen
// brightness control and proves the contract honestly: `input` fires on every live value change (drag step,
// Arrow/Page/Home/End), `change` fires on blur once the value has moved since focus (the commit-on-blur
// contract, slider.md) — the live readout beside each control mirrors the value, the event log proves the
// timing. The control owns drag/keyboard/clamp/snap (slider.ts + value-drag.ts); this page stages and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-slider — demo',
  intro:
    'The single-thumb range, live: a playback volume and a screen brightness control. Drag the thumb, click the ' +
    'rail, or focus it and use Arrow/Page/Home/End — input fires on every live change, change fires on blur ' +
    'once the value moved. The API table is on the ui-slider API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

type SliderHost = HTMLElement & { value: number }

// ── the event log — shared by both controls, tagged by which one fired ───────────────────────────────────
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

// ── volume — 0..100, step 5, with a page-authored readout that mirrors the value on `input` ──────────────
const volume = el('ui-slider', {
  id: 'volume', name: 'volume', label: 'Playback volume', min: '0', max: '100', step: '5', value: '40',
}) as SliderHost
applyDemoWidth(volume, '20rem')
const volumeReadout = el('output', { for: 'volume', 'aria-live': 'polite' }, [text('40 %')])
const describeVolume = (v: number): string => (v === 0 ? 'Muted' : v < 34 ? 'Quiet' : v < 67 ? 'Normal' : 'Loud')
const volumeState = el('span', { class: 'demo-caption' }, [text(describeVolume(40))])
volume.addEventListener('input', () => {
  volumeReadout.textContent = `${volume.value} %`
  volumeState.textContent = describeVolume(volume.value)
  record('volume', 'input', volume.value)
})
volume.addEventListener('change', () => record('volume', 'change', volume.value))

const mute = uiButton('Mute (set value=0)', 'soft')
mute.addEventListener('click', () => {
  volume.value = 0
  volumeReadout.textContent = '0 %'
  volumeState.textContent = describeVolume(0)
})
const volumeRow = el('div', { style: 'display:flex; gap:1rem; align-items:center; flex-wrap:wrap;' }, [
  volume, volumeReadout, volumeState, mute,
])
const volumeNote = el('p', {}, [
  text('Step 5 — every drag or Arrow key snaps to a multiple of five. The Mute button writes '), code('value'),
  text(' programmatically: the readout is updated by the page, and the log stays quiet — a model write never ' +
    'emits '), code('input'), text(' or '), code('change'), text(' (binding hygiene).'),
])

// ── brightness — 10..100 (a floor keeps the screen visible), layout="inline", readout hidden in favour of ours ─
const brightness = el('ui-slider', {
  name: 'brightness', label: 'Brightness', min: '10', max: '100', step: '1', value: '75', layout: 'inline',
}) as SliderHost
applyDemoWidth(brightness, '24rem')
brightness.addEventListener('input', () => record('brightness', 'input', brightness.value))
brightness.addEventListener('change', () => record('brightness', 'change', brightness.value))
const brightnessNote = el('p', {}, [
  code('layout="inline"'), text(' puts label · rail · value on one row; '), code('min="10"'),
  text(' clamps Home and PageDown at the floor, so the screen never goes fully dark.'),
])

// ── sizes — every parsed [size] tier off the compact-realm ramp ──────────────────────────────────────────
const sized = (size: string): HTMLElement => {
  const s = el('ui-slider', { name: `size-${size}`, size, label: 'Level', value: '60', 'readout-hidden': '' })
  applyDemoWidth(s, '12rem')
  return s
}
const sizeRow = el('div', { style: 'display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap;' }, [
  captioned('size="sm"', sized('sm')),
  captioned('size="md"', sized('md')),
  captioned('size="lg"', sized('lg')),
])

// ── states — disabled + a bare rail (no label, no readout) ─────────────────────────────────────────────
const disabled = el('ui-slider', { name: 'locked', label: 'Bass (managed by profile)', value: '30', disabled: '' })
applyDemoWidth(disabled, '16rem')
const bare = el('ui-slider', { name: 'bare', 'aria-label': 'Opacity', value: '50', 'readout-hidden': '' })
applyDemoWidth(bare, '16rem')
const stateRow = el('div', { style: 'display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap;' }, [
  captioned('disabled', disabled),
  captioned('aria-label + readout-hidden', bare),
])

const keyboard = el('p', {}, [
  text('Focus the thumb and use '), code('ArrowLeft/Right'), text(' or '), code('ArrowUp/Down'),
  text(' (one step), '), code('PageUp/PageDown'), text(' (a larger jump), '), code('Home/End'),
  text(' (min/max). Each keystroke emits '), code('input'), text('; tabbing away after a net move emits one '),
  code('change'), text('.'),
])

content.append(
  exampleSection('Playback volume', volumeRow, volumeNote),
  exampleSection('Screen brightness (inline layout)', brightness, brightnessNote),
  exampleSection('input / change event log', log, keyboard),
  exampleSection('Sizes', sizeRow),
  exampleSection('States', stateRow),
)
