// site/pages/segmented-control-demo.ts — the ui-segmented-control interaction demo (the ratified pattern
// `demo`). Mounts the REAL control and proves its interaction honestly: a live event log shows the shared
// moving indicator's selection round-tripping on a USER gesture (click or Arrow roving), and the
// instructions cover the roving keyboard. The control owns all exclusivity/roving/selection + the group
// form value + the moving-indicator state seam (segmented-control.ts) — this page only stages it and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-segmented-control — demo',
  intro: 'The segmented control, live. Click a segment or focus the control and use Arrow keys; the shared ' +
    'highlight slides to the new selection and the event log proves the value round-trips. Exactly one ' +
    'segment is selected at a time. The API table is on the ui-segmented-control API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the live control (real pattern — three segments, the second selected by default via `checked`) ────────
// `orientation` is left unset — a bare ui-segmented-control's own CLASS-derived default is horizontal
// (ADR-0095 clause 1), unlike ui-radio-group (which defaults vertical); no page-authored style needed at
// all — the joined-button track IS the control's own layout (segmented-control.css), not the page author's.
const control = el('ui-segmented-control', { name: 'plan' }, [
  el('ui-segment', { value: 'free' }, [text('Free')]),
  el('ui-segment', { value: 'pro', checked: '' }, [text('Pro')]),
  el('ui-segment', { value: 'team' }, [text('Team')]),
])

// ── the event log — the selection commit (USER gesture only; a programmatic `value` write is silent) ────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const record = (kind: string, value: unknown): void => {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${kind}  value=${JSON.stringify(value)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
// The control emits `select` on a committed selection; as a form control its value also surfaces via `change`.
// Log whichever the control fires so the demo is honest about the real event surface.
control.addEventListener('select', (event) => record('select', (event as CustomEvent<{ value: unknown }>).detail?.value))
control.addEventListener('change', () => record('change', (control as unknown as { value: string | null }).value))

const instructions = el('p', {}, [
  text('Exactly one option is selected. This control defaults to `orientation="horizontal"` (unlike ' +
    'ui-radio-group\'s vertical default), so Arrow Left/Right move the selection and focus together; ' +
    'Home/End jump to the first/last. The control value is the selected segment\'s value.'),
])

content.append(control, instructions, log)
