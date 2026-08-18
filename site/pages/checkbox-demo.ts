// site/pages/checkbox-demo.ts — the ui-checkbox interaction demo (the ratified pattern `demo`; pairs with
// checkbox-doc.html, the API page). Mounts the REAL FACE checkbox in a believable settings scenario — a
// workspace-permissions list whose parent "All permissions" row is a tri-state checkbox: it goes INDETERMINATE
// (ariaChecked="mixed", the dash glyph) while only some children are checked, CHECKED when all are, and
// unchecked when none are; toggling the parent sets every enabled child. A live change event log proves the
// event contract (input + change, same tick, after the value has flipped). The control owns the toggle +
// tri-state mechanics (checkbox.ts / UIIndicatorElement); this page only stages, wires the parent, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-checkbox — demo',
  intro:
    'The FACE checkbox, live, in a workspace-permissions list. Toggle a child and watch the parent go ' +
    'indeterminate (the dash glyph, aria-checked="mixed"); toggle the parent to set every child. The event ' +
    'log proves each gesture fires input then change on the same tick, after checked has flipped. The API ' +
    'table is on the ui-checkbox API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the shared change event log ────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function record(source: string, kind: string, box: HTMLElement): void {
  seq += 1
  const line = document.createElement('li')
  const state = (box as HTMLElement & { indeterminate?: boolean }).indeterminate
    ? 'mixed'
    : String(box.hasAttribute('checked'))
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  ${kind}  →  checked=${state}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
function watch(box: HTMLElement, source: string): HTMLElement {
  box.addEventListener('input', () => record(source, 'input', box))
  box.addEventListener('change', () => record(source, 'change', box))
  return box
}

// ── the permissions list: a tri-state parent over five children (one locked/disabled) ──────────────────────
type Permission = { readonly value: string; readonly label: string; readonly checked?: true; readonly disabled?: true }
const PERMISSIONS: readonly Permission[] = [
  { value: 'read', label: 'Read documents', checked: true, disabled: true },
  { value: 'comment', label: 'Comment on documents', checked: true },
  { value: 'edit', label: 'Edit documents' },
  { value: 'share', label: 'Share outside the workspace' },
  { value: 'billing', label: 'Manage billing' },
]

const parent = watch(el('ui-checkbox', { name: 'all', value: 'all' }, [text('All permissions')]), 'parent')
const children = PERMISSIONS.map((p) => {
  const attrs: Record<string, string> = { name: 'perm', value: p.value }
  if (p.checked) attrs.checked = ''
  if (p.disabled) attrs.disabled = ''
  return watch(el('ui-checkbox', attrs, [text(p.label)]), p.value)
})

/** Derive the parent's tri-state from the children (checked ⇒ all; mixed ⇒ some; unchecked ⇒ none). */
function syncParent(): void {
  const on = children.filter((c) => c.hasAttribute('checked')).length
  const all = on === children.length
  const some = on > 0 && !all
  ;(parent as HTMLElement & { indeterminate: boolean }).indeterminate = some
  parent.toggleAttribute('checked', all)
}
/** A parent toggle sets every ENABLED child to the parent's new state (a disabled child keeps its value). */
function fanOut(): void {
  const on = parent.hasAttribute('checked')
  for (const c of children) if (!c.hasAttribute('disabled')) c.toggleAttribute('checked', on)
  syncParent()
}
for (const c of children) c.addEventListener('change', syncParent)
parent.addEventListener('change', fanOut)
syncParent()

const listStyle = 'display:flex; flex-direction:column; gap:var(--md-sys-space-sm); margin:0;'
const permissionList = el('div', { style: listStyle }, [
  parent,
  el(
    'div',
    { style: `${listStyle} padding-inline-start:var(--md-sys-space-lg);` },
    children,
  ),
])

const listNote = el('p', {}, [
  text('“Read documents” is '),
  el('code', {}, [text('disabled')]),
  text(' — a locked baseline permission — so it stays checked when the parent is cleared. The parent’s '),
  el('code', {}, [text('indeterminate')]),
  text(' state is PROPERTY-ONLY (never reflected, never submitted); the next click on the parent clears it and toggles '),
  el('code', {}, [text('checked')]),
  text(', exactly like a native checkbox.'),
])

// ── a required consent checkbox: required + unchecked ⇒ valueMissing ───────────────────────────────────────
const consent = watch(
  el('ui-checkbox', { name: 'terms', value: 'accepted', required: '' }, [text('I accept the data-processing terms')]),
  'terms',
)
const validity = el('p', {}, [text('')])
function showValidity(): void {
  const c = consent as HTMLElement & { validity?: ValidityState; validationMessage?: string }
  const missing = c.validity?.valueMissing === true
  validity.textContent = missing
    ? `validity.valueMissing = true — "${c.validationMessage ?? ''}"`
    : 'validity.valid = true — the form may submit.'
}
consent.addEventListener('change', showValidity)
queueMicrotask(showValidity)

// ── size + state specimens ─────────────────────────────────────────────────────────────────────────────────
const specimenRow = (...figures: HTMLElement[]): HTMLElement =>
  el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--md-sys-space-lg); align-items:flex-end;' }, figures)

const sizes = specimenRow(
  captioned('size="sm"', el('ui-checkbox', { size: 'sm', checked: '' }, [text('Small')])),
  captioned('size="md" (default)', el('ui-checkbox', { checked: '' }, [text('Medium')])),
  captioned('size="lg"', el('ui-checkbox', { size: 'lg', checked: '' }, [text('Large')])),
)
const mixed = el('ui-checkbox', {}, [text('Indeterminate')])
;(mixed as HTMLElement & { indeterminate: boolean }).indeterminate = true
const states = specimenRow(
  captioned('unchecked', el('ui-checkbox', {}, [text('Unchecked')])),
  captioned('checked', el('ui-checkbox', { checked: '' }, [text('Checked')])),
  captioned('indeterminate (property)', mixed),
  captioned('disabled', el('ui-checkbox', { disabled: '' }, [text('Disabled')])),
  captioned('disabled checked', el('ui-checkbox', { disabled: '', checked: '' }, [text('Disabled, checked')])),
)

content.append(
  exampleSection('Workspace permissions (tri-state parent)', permissionList, listNote),
  exampleSection('Required consent', consent, validity),
  exampleSection('Sizes', sizes),
  exampleSection('States', states),
  exampleSection('input / change event log', log),
)
