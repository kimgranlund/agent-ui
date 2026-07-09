// site/pages/disclosure-demo.ts — the ui-disclosure interaction demo (the ratified pattern `demo`). Mounts the
// REAL native-<details>-backed control and proves its behaviour honestly: a CLICK toggle (native summary
// activation, Enter/Space/click) and a MODEL-DRIVEN toggle (an external button flips the bindable `open` prop,
// as an agent's two-way bind would) — the toggle event log proves both paths settle `open` and fire exactly
// one `toggle`, never more, per the always-announce/no-echo contract (ADR-0101). The control owns the toggle
// mechanics (disclosure.ts + the native <details>); this page only stages + logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-disclosure — demo',
  intro:
    'The native-<details>-backed fold, live. Click (or Enter/Space) the summary to toggle it — the CLICK ' +
    'path. The button below flips the bindable open prop programmatically — the MODEL-DRIVEN path, the same ' +
    "shape an agent's two-way bind would drive. Both settle open and fire exactly one toggle. The API table " +
    'is on the ui-disclosure API page.',
})

// ── the shared toggle event log ──────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  toggle  →  open=${String(disclosure.hasAttribute('open'))}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

const disclosure = el('ui-disclosure', { summary: 'Release notes' }, [
  el('p', { style: 'margin:0;' }, [document.createTextNode('v1.4.0 — the report/content/feed families ship.')]),
])
disclosure.addEventListener('toggle', () => logEvent())

const modelToggle = uiButton('Toggle open (model-driven)', 'soft')
modelToggle.addEventListener('click', () => {
  if (disclosure.hasAttribute('open')) disclosure.removeAttribute('open')
  else disclosure.setAttribute('open', '')
})

const note = el('p', {}, [
  document.createTextNode('Re-asserting the CURRENT value (e.g. setting '),
  el('code', {}, [document.createTextNode('open')]),
  document.createTextNode(' to what it already is) is a no-op — native '),
  el('code', {}, [document.createTextNode('<details>')]),
  document.createTextNode(' never re-fires '),
  el('code', {}, [document.createTextNode('toggle')]),
  document.createTextNode(' on a same-value write, the loop-breaker the two-way bind relies on.'),
])

content.append(
  exampleSection('Click to toggle', disclosure),
  exampleSection('Model-driven toggle', modelToggle, note),
  exampleSection('toggle event log', log),
)
