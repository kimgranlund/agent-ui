// site/pages/form-popover-demo.ts — the ui-form-popover interaction demo (the ratified pattern `demo`). Mounts
// the REAL control and proves its behaviour honestly: the trigger's visible `label` is a plain prop the control
// never computes itself (F1) — this page keeps it current by listening for `change` bubbling from the panel's
// own real check group, exactly the consumer/agent idiom SPEC-R9 describes. The close/toggle event log shows
// EVERY real open-state transition (ADR-0101: platform light-dismiss, a trigger-click close, and a programmatic
// `open` write alike). A native-Tab note demonstrates the anti-ui-menu contract (SPEC-R5): typing into the
// embedded text field is never stolen as type-ahead. The control owns the overlay + panel mechanics
// (form-popover.ts); this page only stages it, keeps the summary current, and logs the host events.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-form-popover — demo',
  intro: 'The packaged popover + form-spine recipe, live. Check some options — the trigger label updates to a ' +
    'summary the page computes and writes back (F1: the control never counts its own children). The event log ' +
    'proves every real open-state transition fires close + toggle (ADR-0101), platform light-dismiss and a ' +
    'trigger click alike. Tab into the search field and type — native order, no roving, no type-ahead steal ' +
    '(SPEC-R5). The API table is on the ui-form-popover API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the shared close/toggle event log ────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(name: string, openState: boolean): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${name.padEnd(8)}open=${String(openState)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── the live form-popover — ALL author children move into the control-created panel at connect; there is no
// author trigger (unlike ui-popover, the trigger is control-created from the `label` prop). Panel content: a
// 6-item check group (the summary-state source), a radio group, and a text field (the native-Tab proof).
const checkbox = (value: string, label: string): HTMLElement => {
  const c = document.createElement('ui-checkbox')
  c.setAttribute('name', 'opt')
  c.setAttribute('value', value)
  c.textContent = label
  return c
}
const OPTIONS = ['a', 'b', 'c', 'd', 'e', 'f'].map((v, i) => [v, `Option ${String.fromCharCode(65 + i)}`] as const)
const checkboxes = OPTIONS.map(([v, l]) => checkbox(v, l))
const checkGroup = el('fieldset', { role: 'group', 'aria-label': 'Options' }, [
  el('legend', {}, [text('Options')]),
  ...checkboxes,
])

// A plain native radio group (the form-popover.md example markup's own idiom) — NOT `ui-radio-group`: its
// rovingFocus trait's connection wiring does not survive the #ensureParts() child-move-then-reconnect cycle
// (a real cross-control interaction gap; a fleet fix is out of this docs-only slice's scope, tracked
// separately, GH #294 follow-up).
const radio = (value: string, label: string): HTMLElement => {
  const wrapper = el('label', {})
  const input = el('input', { type: 'radio', name: 'sort', value })
  wrapper.append(input, text(` ${label}`))
  return wrapper
}
const radioGroup = el('fieldset', { role: 'radiogroup', 'aria-label': 'Sort by' }, [
  el('legend', {}, [text('Sort by')]),
  radio('newest', 'Newest'),
  radio('oldest', 'Oldest'),
  radio('relevant', 'Most relevant'),
])

const search = el('ui-text-field', { label: 'Search' })

const formPopover = el(
  'ui-form-popover',
  { label: 'Options · 0 selected', placement: 'bottom-start' },
  [checkGroup, radioGroup, search],
)

// The summary-state idiom (SPEC-R9): a `change` bubbling from any child checkbox recomputes the count and
// writes it into `label` — the control itself never inspects its own children (F1).
function refreshSummary(): void {
  const checked = checkboxes.filter((c) => (c as unknown as { checked: boolean }).checked).length
  formPopover.setAttribute('label', `Options · ${String(checked)} selected`)
}
formPopover.addEventListener('change', refreshSummary)

// close/toggle fire on every real close/open — a platform light-dismiss (Escape / outside-click) or the
// trigger click alike (ADR-0101).
formPopover.addEventListener('close', () => logEvent('close', (formPopover as unknown as { open: boolean }).open))
formPopover.addEventListener('toggle', () => logEvent('toggle', (formPopover as unknown as { open: boolean }).open))

const note = el('p', {}, [
  text('Tab order inside the open panel is '), strong('native'), text(' — no roving focus, no type-ahead. ' +
    'Click into '), code('Search'), text(' and type a letter that also names an option (e.g. "O") — it lands ' +
    'in the field, never stealing focus to an option (the anti-'), code('ui-menu'), text(' contract, SPEC-R5). ' +
    'The panel ships no close button — Escape, outside-click, or a re-click of the trigger dismiss it (SPEC-R10).'),
])

content.append(
  exampleSection('Live form-popover (Escape / outside-click to dismiss)', formPopover),
  exampleSection('Native keyboard', note),
  exampleSection('close / toggle event log', log),
)
