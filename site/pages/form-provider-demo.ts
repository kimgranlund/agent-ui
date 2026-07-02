// site/pages/form-provider-demo.ts — the ui-form-provider interaction demo (the ratified container `demo`). The
// mini end-to-end: a provider coordinating a fielded text-field + a checkbox + a switch, a Submit ui-button wired
// to provider.submit(), and a live readout of provider.values() / provider.valid() that refreshes as members
// change (their input/change bubble up to the provider). It also demonstrates the change disambiguation the
// descriptor pins: a MEMBER's change bubbles THROUGH with detail null; the provider's OWN change (fired by a
// valid submit()) carries the aggregate and has event.target === the provider. All discovery/aggregation is the
// provider's own (form-provider.ts + traits/form-registry.ts) — this page only stages the subtree + reads its
// public surface.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import type { UIFormProviderElement } from '@agent-ui/components/components' // the barrel re-exports the class (s12)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-form-provider — demo',
  intro:
    'A provider coordinating three controls — a fielded text-field, a checkbox, and a switch. The readout tracks ' +
    'provider.values() and provider.valid() live as you edit; Submit calls provider.submit() (blocked, with the ' +
    'first invalid member reported, while the required Name is empty — else it fires the provider’s own change ' +
    'aggregate). Reset calls provider.reset(). The API table is on the ui-form-provider API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the coordinated subtree (the provider owns discovery/aggregation; this only stages it) ────────────────────
const provider = el('ui-form-provider', {}, [
  el('ui-field', { label: 'Name', description: 'Required' }, [el('ui-text-field', { name: 'name', required: '' })]),
  el('ui-field', { label: 'Email' }, [el('ui-text-field', { name: 'email', type: 'email' })]),
  el('ui-checkbox', { name: 'subscribe' }, [text('Subscribe to the newsletter')]),
  el('ui-switch', { name: 'notify' }, [text('Enable notifications')]),
]) as UIFormProviderElement
provider.style.maxInlineSize = '26rem'

// ── the live readout — provider.values() + provider.valid(), refreshed on any member input/change ────────────
const valuesOut = code('{}')
const validOut = code('true')
const readout = el('p', { class: 'readout' }, [text('values() = '), valuesOut, text(' · valid() = '), validOut])
const refresh = (): void => {
  valuesOut.textContent = JSON.stringify(provider.values())
  validOut.textContent = String(provider.valid())
}

// ── the submit-commit event log (the provider's OWN change, disambiguated by event.target) ───────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const logEvent = (line: string): void => {
  seq += 1
  const li = document.createElement('li')
  li.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
  log.prepend(li)
}

// input/change bubble from every member up to the provider — refresh the readout on each. The provider's OWN
// change (from a valid submit()) also lands here: disambiguate by event.target (the descriptor's pinned rule — a
// member's change bubbles through with detail null; the provider's carries the aggregate and targets the provider).
provider.addEventListener('input', refresh)
provider.addEventListener('change', (event) => {
  if (event.target === provider) {
    const detail = (event as CustomEvent<{ values: Readonly<Record<string, unknown>> }>).detail
    logEvent(`provider change (submit) · values=${JSON.stringify(detail.values)}`)
  } else {
    refresh() // a member's change bubbled through (detail null) — just re-read the aggregate
  }
})

// ── the actions — Submit → provider.submit(); Reset → provider.reset() ───────────────────────────────────────
const submitBtn = uiButton('Submit', 'solid')
submitBtn.addEventListener('click', () => {
  if (!provider.submit()) logEvent('provider.submit() → false · first invalid member reported (fill in Name)')
})
const resetBtn = uiButton('Reset', 'ghost')
resetBtn.addEventListener('click', () => {
  provider.reset()
  refresh()
  logEvent('provider.reset()')
})
const actions = el('div', {}, [submitBtn, resetBtn])
actions.style.cssText = 'display:flex; gap:0.75rem; margin-top:1rem;'

content.append(
  exampleSection('Coordinated form', provider, actions, readout),
  exampleSection('Submit event log', log),
)

refresh() // initial readout — post-append, the provider has connected and registered its members
