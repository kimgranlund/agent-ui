// site/pages/drill-demo.ts — the ui-drill interaction demo (the ratified pattern `demo`, ADR-0195). Mounts a
// REAL 3-level drill (root → settings → appearance) proving the N-level API honestly: drill-forward via a
// declarative data-role="drill-trigger", Back (click + Escape), a bindable `path` in CONTROLLED mode (the
// consumer writes the proposed value back on every `change`), and focus moving to the incoming panel's
// heading — with a live change-event log. The API table is on the ui-drill API page.
import { mountPage } from './_page.ts'
import './containers.css'
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-drill — demo',
  intro: 'The N-level drill-down panel container, live. Drill into Settings → Appearance, use Back or Escape ' +
    'to return, and watch the change-event log — this instance runs CONTROLLED (the page owns `path`, writing ' +
    'back every proposed value the control emits, exactly as an agent two-way bind would).',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the shared change-event log ─────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(path: string[]): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  change  [${path.join(' → ')}]`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── a 3-level tree, run CONTROLLED (the page writes `path` back on every `change`) ────────────────────────────

const drill = el('ui-drill', { 'aria-label': 'Settings (controlled demo)' }, [
  el('ui-drill-panel', { key: 'root', heading: 'Settings' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'appearance' }, [text('Appearance')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'notifications' }, [text('Notifications')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'appearance', parent: 'root', heading: 'Appearance' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'font-size' }, [text('Font size')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'notifications', parent: 'root', heading: 'Notifications' }, [
    el('p', { style: 'margin:0' }, [text('Email, push, and in-app notification-channel toggles would live here.')]),
  ]),
  el('ui-drill-panel', { key: 'font-size', parent: 'appearance', heading: 'Font size' }, [
    el('p', { style: 'margin:0' }, [text('A 3rd level — the same path-array API, zero new mechanism (ADR-0195\'s N-level-from-day-one requirement).')]),
  ]),
]) as HTMLElement & { path: string[] | undefined }

// CONTROLLED mode: seed `path`, then write back every proposed value the control emits on `change`.
drill.path = ['root']
drill.addEventListener('change', (event) => {
  const next = (event as CustomEvent<string[]>).detail
  drill.path = next
  logEvent(next)
})

const controlledNote = el('p', {}, [
  text('This instance sets '),
  el('code', {}, [text('path')]),
  text(' explicitly (CONTROLLED, ADR-0102 prop-as-source-of-truth — the ui-split.sizes precedent): the ' +
    'control only EMITS the proposed path on `change`, and this page writes it back. Leave `path` unset for ' +
    'the UNCONTROLLED default, which self-manages position with zero wiring.'),
])

const focusNote = el('p', {}, [
  text('Drill forward or press Back and watch focus land on the level heading (a real '),
  el('code', {}, [text('<h2 tabindex="-1">')]),
  text(') — never on the initial mount, only on a real path change.'),
])

content.append(
  exampleSection('3-level drill (controlled)', drill),
  exampleSection('Controlled path', controlledNote),
  exampleSection('Focus management', focusNote),
  exampleSection('change event log', log),
)
