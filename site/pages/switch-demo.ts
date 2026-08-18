// site/pages/switch-demo.ts — the ui-switch interaction demo (the ratified pattern `demo`; pairs with
// switch-doc.html, the API page). Mounts the REAL FACE switch in a believable notification-preferences panel:
// a master "Email notifications" switch gates three per-topic switches (they go `disabled` while the master is
// off — the model-driven path), one row is permanently disabled (a policy-locked security alert), and a live
// change event log proves the event contract (change + input, same tick, after `checked` flipped). The control
// owns the toggle mechanics (UIIndicatorElement); this page only stages, gates, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-switch — demo',
  intro:
    'The FACE switch, live, in a notification-preferences panel. Flip a switch and the event log records ' +
    'change and input on the same tick, after checked has flipped. Turning the master switch off disables the ' +
    'per-topic rows underneath it (a programmatic write — silent, no event), and one row is locked by policy. ' +
    'The API table is on the ui-switch API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the shared change event log ────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function record(source: string, kind: string, sw: HTMLElement): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  ${kind}  →  checked=${String(sw.hasAttribute('checked'))}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
function watch(sw: HTMLElement, source: string): HTMLElement {
  sw.addEventListener('change', () => record(source, 'change', sw))
  sw.addEventListener('input', () => record(source, 'input', sw))
  return sw
}

// ── one preference row: label + description on the left, the switch on the right ───────────────────────────
function prefRow(sw: HTMLElement, title: string, description: string): HTMLElement {
  return el(
    'div',
    { style: 'display:flex; align-items:center; justify-content:space-between; gap:var(--md-sys-space-lg);' },
    [
      el('div', { style: 'display:flex; flex-direction:column; gap:2px;' }, [
        el('span', {}, [text(title)]),
        el('span', { style: 'font-size:0.85em; opacity:0.75;' }, [text(description)]),
      ]),
      sw,
    ],
  )
}

// ── the panel: a master switch gating three topic switches + one policy-locked row ─────────────────────────
const master = watch(el('ui-switch', { name: 'email', checked: '' }, [text('Email')]), 'email')
const mentions = watch(el('ui-switch', { name: 'mentions', checked: '' }, [text('Mentions')]), 'mentions')
const digest = watch(el('ui-switch', { name: 'digest' }, [text('Digest')]), 'digest')
const marketing = watch(el('ui-switch', { name: 'marketing' }, [text('Product news')]), 'marketing')
const security = watch(el('ui-switch', { name: 'security', checked: '', disabled: '' }, [text('Security')]), 'security')

const topics = [mentions, digest, marketing]
/** The master gates its topics: off ⇒ every topic row is disabled (a programmatic write, no event fires). */
function gateTopics(): void {
  const on = master.hasAttribute('checked')
  for (const t of topics) t.toggleAttribute('disabled', !on)
}
master.addEventListener('change', gateTopics)
gateTopics()

const panelStyle = 'display:flex; flex-direction:column; gap:var(--md-sys-space-md); max-inline-size:36rem;'
const panel = el('div', { style: panelStyle }, [
  prefRow(master, 'Email notifications', 'The master switch — turning it off disables every topic below.'),
  el('div', { style: `${panelStyle} padding-inline-start:var(--md-sys-space-lg);` }, [
    prefRow(mentions, 'Mentions & replies', 'When someone @-mentions you or replies to your thread.'),
    prefRow(digest, 'Weekly digest', 'A Monday-morning summary of what you missed.'),
    prefRow(marketing, 'Product news', 'Release notes and feature announcements.'),
  ]),
  prefRow(security, 'Security alerts', 'Locked on by workspace policy — always delivered.'),
])

const panelNote = el('p', {}, [
  text('The topic rows are gated by a programmatic '),
  el('code', {}, [text('disabled')]),
  text(' write, which fires NO event — only a user gesture (click / Space) emits change + input. The Security row is '),
  el('code', {}, [text('disabled checked')]),
  text(': it paints the ON track but is pointer- and keyboard-inert.'),
])

// ── size + state specimens ─────────────────────────────────────────────────────────────────────────────────
const specimenRow = (...figures: HTMLElement[]): HTMLElement =>
  el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--md-sys-space-lg); align-items:flex-end;' }, figures)

const sizes = specimenRow(
  captioned('size="sm"', el('ui-switch', { size: 'sm', checked: '' }, [text('Small')])),
  captioned('size="md" (default)', el('ui-switch', { checked: '' }, [text('Medium')])),
  captioned('size="lg"', el('ui-switch', { size: 'lg', checked: '' }, [text('Large')])),
)
const states = specimenRow(
  captioned('off', el('ui-switch', {}, [text('Off')])),
  captioned('checked', el('ui-switch', { checked: '' }, [text('On')])),
  captioned('disabled', el('ui-switch', { disabled: '' }, [text('Disabled off')])),
  captioned('disabled checked', el('ui-switch', { disabled: '', checked: '' }, [text('Disabled on')])),
  captioned('bare (no label)', el('ui-switch', { 'aria-label': 'Bare switch', checked: '' })),
)

content.append(
  exampleSection('Notification preferences', panel, panelNote),
  exampleSection('Sizes', sizes),
  exampleSection('States', states),
  exampleSection('change / input event log', log),
)
