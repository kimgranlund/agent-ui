// site/pages/forms.ts — the end-to-end forms guide: ui-form-provider + ui-field + controls + validation, walked
// as ONE working example. Every mechanism narrated below (registration, labelling, validation display, submit
// gating, reset) refers to the SAME live form — try it once, then read what just happened. The real behaviour
// this page narrates is proven by the package's own browser end-to-end test
// (packages/agent-ui/components/src/controls/form-provider/form-e2e.browser.test.ts) and the field.md /
// form-provider.md descriptors — cited by ID rather than re-verified here (this page composes a real subtree
// and reads its real public surface, the form-provider-demo.ts precedent, never a mocked form).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import './forms.css'
import type { UIFormProviderElement } from '@agent-ui/components/components'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import { heading } from '../lib/doc-page.ts'

const { content } = mountPage({
  title: 'Forms',
  intro:
    'A form-provider coordinating three field-wrapped controls — one working example, narrated concern by ' +
    'concern below. Try it: leave Name empty and blur it, submit while invalid, fix it and submit again, then reset.',
})

content.append(
  pageLead(
    'Three pieces compose a form: ui-form-provider (coordination — discovery, aggregate value, submit-gating), ' +
      'ui-field (a per-control wrapper — label, description, the error part), and the controls themselves (any ' +
      'UIFormElement — text-field, checkbox, switch, select, …). None of them talk to each other by import; ' +
      'they find each other at connect time through a shared light-DOM protocol.',
  ),
)

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the one live form every section below narrates ──────────────────────────────────────────────────────────
const provider = el('ui-form-provider', {}, [
  el('ui-field', { label: 'Name', description: 'Required' }, [el('ui-text-field', { name: 'name', required: '' })]),
  el('ui-field', { label: 'Email' }, [el('ui-text-field', { name: 'email', type: 'email' })]),
  el('ui-checkbox', { name: 'subscribe' }, [text('Subscribe to the newsletter')]),
  el('ui-switch', { name: 'notify' }, [text('Enable notifications')]),
]) as UIFormProviderElement
// ui-form-provider is deliberately layout-neutral (form-provider.css) — the page supplies the vertical rhythm.
provider.style.cssText = 'display:flex; flex-direction:column; gap:var(--md-sys-space-md); max-inline-size:26rem;'

const valuesOut = code('{}')
const validOut = code('true')
const readout = el('p', { class: 'forms-readout' }, [text('values() = '), valuesOut, text(' · valid() = '), validOut])
const refresh = (): void => {
  valuesOut.textContent = JSON.stringify(provider.values())
  validOut.textContent = String(provider.valid())
}

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

provider.addEventListener('input', refresh)
provider.addEventListener('change', (event) => {
  if (event.target === provider) {
    const detail = (event as CustomEvent<{ values: Readonly<Record<string, unknown>> }>).detail
    logEvent(`provider change (submit) · values=${JSON.stringify(detail.values)}`)
  } else {
    refresh()
  }
})

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
const actions = el('div', { class: 'forms-actions' }, [submitBtn, resetBtn])

content.append(exampleSection('Live form', provider, actions, readout), exampleSection('Event log', log))

// Registration is silent by design (no event fires just because a control connected) — so this page proves it
// happened by reading provider.controls right after append, one real fact rather than a claim.
setTimeout(() => {
  const names = provider.controls.map((c) => c.name || '(unnamed)')
  logEvent(`registered at connect: ${names.join(', ')}`)
}, 0)

refresh()

// ── 1 · registration ─────────────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '1 · registration'))
content.append(
  el('p', {}, [
    text('Every UIFormElement descendant announces itself the moment it connects (the ADR-0050 connect-time '),
    text('registration event) and the nearest ui-form-provider ancestor keeps a reactive registry of who '),
    text('answered. No manual wiring — nesting a control under the provider is the whole registration. The log '),
    text('entry above, timestamped right after this page appended the subtree, reads it back from '),
    code('provider.controls'),
    text(' — a live fact, not a description.'),
  ]),
)

// ── 2 · labelling ─────────────────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '2 · labelling'))
content.append(
  el('p', {}, [
    text('ui-field wraps ONE control and supplies its '),
    code('label'),
    text(' and '),
    code('description'),
    text(
      ' as real DOM — not a bare <label for>. The ADR-0051 labelling seam applies them to the wrapped control’s ' +
        'ElementInternals (so the accessible name is correct even though the control itself never received a ' +
        'label attribute), plus an option-A bridge for controls that predate the seam. Name and Email above are ' +
        'both ui-field-wrapped; the checkbox and switch label themselves directly (their own slotted text is the ' +
        'accessible name — no wrapper needed for a control that already carries its own label).',
    ),
  ]),
)

// ── 3 · validation display ───────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '3 · validation display'))
content.append(
  el('p', {}, [
    text('Focus Name, then click away while it’s empty. The '),
    code('[data-part=error]'),
    text(
      ' node appears inside the field — the wrapped control’s own validationMessage, revealed on ITS OWN ' +
        'formUserInvalid timing, never sooner (an untouched required field shows no error just because a page ' +
        'loaded). Type any character and it clears immediately. This is reactive, event-driven rendering — no ' +
        'polling, no timers.',
    ),
  ]),
)

// ── 4 · submit gating ────────────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '4 · submit gating'))
content.append(
  el('p', {}, [
    text('Click Submit while Name is still empty: '),
    code('provider.submit()'),
    text(
      ' returns false, calls reportValidity() on the FIRST invalid member (focusing it), and fires no change ' +
        'event at all — a form-provider only ever announces a VALID aggregate. Fill in Name and submit again: ' +
        'submit() returns true and the provider fires its OWN change, disambiguated from a member’s bubbled ' +
        'change by ',
    ),
    code('event.target === provider'),
    text(' (a member’s own change bubbles through with a null detail; the provider’s carries the full aggregate).'),
  ]),
)

// ── 5 · reset ─────────────────────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '5 · reset'))
content.append(
  el('p', {}, [
    text('Reset calls '),
    code('provider.reset()'),
    text(
      ': every member’s value returns to its declared default AND its interaction-tracking flag resets together ' +
        'with the value — so a field that was showing an error does not "flash" the error back on the now-empty ' +
        'control. Reset is a clean slate, not merely a value clear.',
    ),
  ]),
)

content.append(
  el('p', { class: 'forms-sources' }, [
    text(
      'Full API surface: the ui-field and ui-form-provider API pages. The behaviour above is proven end-to-end ' +
        'by the package’s own Chromium + WebKit browser test, form-e2e.browser.test.ts.',
    ),
  ]),
)
