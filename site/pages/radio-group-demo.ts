// site/pages/radio-group-demo.ts — the ui-radio-group interaction demo (the ratified container `demo`). Mounts
// the REAL group and proves its interaction honestly: a live event log shows the group's selection round-tripping
// on a USER gesture (click or Arrow roving), and the instructions cover the roving keyboard. The container owns
// all exclusivity/roving/selection + the group form value (radio-group.ts) — this page only stages it and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-radio-group — demo',
  intro: 'The radio-group, live. Click a radio or focus the group and use Arrow keys; the event log proves the ' +
    'single selection round-trips. Exactly one radio is selected at a time. The API table is on the ui-radio-group API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the live group (real container — three radios, the second selected by default) ──────────────────────────
// ADR-0103: ui-radio-group now owns its own interior layout (flex column by default, a wrapping row under
// `orientation="horizontal"`, gap off the --md-sys-space ladder) — the inline `style` below is this page's OWN
// choice of a slightly larger gap (`--md-sys-space-md`, not the component's `--md-sys-space-sm` default) for this
// worked plan-picker shape; it is an override, not a fix for an otherwise-unstyled group. `orientation` still
// must be declared explicitly (radio-group.ts resolves it once at connect; it does not infer it from CSS).
const group = el(
  'ui-radio-group',
  {
    name: 'plan',
    orientation: 'horizontal',
    style: 'display:flex; flex-wrap:wrap; align-items:center; gap:var(--md-sys-space-md);',
  },
  [
    el('ui-radio', { value: 'free' }, [text('Free')]),
    el('ui-radio', { value: 'pro' }, [text('Pro')]),
    el('ui-radio', { value: 'team' }, [text('Team')]),
  ],
)
// `value` is a property-only accessor on ui-radio-group (not an observed/reflected attribute), so the
// el() helper's attrs object — which only ever calls setAttribute — cannot seed it; assign the property
// directly to select "Pro" by default. A programmatic write like this does not emit `change`.
;(group as unknown as { value: string | null }).value = 'pro'

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
// The container emits ONLY `change` on a committed selection (radio-group.ts's #commit) — no `select` event
// exists on this control. `value` is a property-only accessor (not a reflected attribute), so the log reads
// the property, not `getAttribute`.
group.addEventListener('change', () => record('change', (group as unknown as { value: string | null }).value))

const instructions = el('p', {}, [
  text('Exactly one option is selected. This group is `orientation="horizontal"`, so Arrow Left/Right move the ' +
    'selection and focus together; Home/End jump to the first/last. The group value is the selected radio’s value.'),
])

content.append(group, instructions, log)
