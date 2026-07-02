// site/pages/field-demo.ts — the ui-field composition demo (the ratified container `demo`). Mounts the REAL
// wrapper doing its one job: a ui-field around a required ui-text-field, so the descriptor's event-driven error
// leg is visible — focus the field, blur it while empty, and the [data-part=error] node appears (the associated
// control's validationMessage, gated on its OWN user-invalid timing, never sooner); type a value and it clears.
// A second field shows the label + description parts with no error path. All labelling/error behaviour is the
// field's own (field.ts) — this page only composes the wrapper + a control and supplies a display width.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (section spacing + prose)
import { applyDemoWidth, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-field — demo',
  intro:
    'The field wrapping a real form control. Focus the required field below and click away (blur) while empty — ' +
    'the error part appears (the text-field’s own validationMessage, revealed on its user-invalid timing, never ' +
    'sooner); type a value and it clears. The second field shows the label + description parts. The API table is ' +
    'on the ui-field API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── [1] required field — the event-driven error leg (F4: text-field is the wave-1 wire that drives it) ────────
const required = el('ui-field', { label: 'Full name', description: 'As it appears on your ID' }, [
  el('ui-text-field', { name: 'name', required: '' }),
])
applyDemoWidth(required, '24rem')

const requiredNote = el('p', {}, [
  text('Required. Focus it, then click away while empty — the '),
  el('code', {}, [text('[data-part=error]')]),
  text(' node shows the control’s validationMessage. Type any value to clear it.'),
])

// ── [2] label + description parts — a non-required field, no error path ──────────────────────────────────────
const described = el('ui-field', { label: 'Display name', description: 'Shown on your public profile' }, [
  el('ui-text-field', { name: 'display', placeholder: 'e.g. ada' }),
])
applyDemoWidth(described, '24rem')

content.append(
  exampleSection('Required field — blur to reveal the error', requiredNote, required),
  exampleSection('Label + description parts', described),
)
