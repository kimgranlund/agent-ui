// site/pages/color-picker-doc.ts — the ui-color-picker API doc page (ADR-0123, color-picker.lld.md). DERIVED
// from `color-picker.md` via the shared doc-page.ts renderer (composeDocPage): the attribute/properties/
// events/parts tables are read straight from the descriptor the contract trip-wire validates, so they cannot
// drift. Two LIVE specimens sit between the tables and the prose — the default hex-format control and an
// oklch-format one; the full interaction demo (pad drag, format switching, presets, the type=color leg) is
// on the color-picker demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadColorPickerDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadColorPickerDoc()

const { content } = mountPage({
  title: 'ui-color-picker — API',
  intro: 'A standalone color-input control: a 2-axis chroma×lightness pad, three composed ui-slider channels ' +
    '(hue always; chroma + lightness mirrored — the accessible spine), and an editable readout with a composed ' +
    'ui-swatch preview. Internal model is always OKLCH; `value` serializes per `format` (hex default, oklch ' +
    'opt-in). Generated from color-picker.md (descriptor-derived tables). See the color-picker demo for the ' +
    'live pad drag + format switching + presets + the ui-text-field type=color leg.',
})

// ── live specimens (real <ui-color-picker>s, placed between the tables and the prose) ─────────────────
const specimen = el('ui-color-picker', { name: 'specimen-color', value: '#3b82f6' })
const oklchSpecimen = el('ui-color-picker', { name: 'oklch-color', value: 'oklch(0.7 0.15 150)', format: 'oklch' })

const specimens = document.createElement('div')
specimens.append(
  exampleSection('Live specimen (format=hex, default)', specimen),
  exampleSection('format=oklch — the internal model authored directly', oklchSpecimen),
)

composeDocPage(content, descriptor, body, specimens)
