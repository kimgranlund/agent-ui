// site/pages/card-grid-drawer.ts — GH #965: the card-grid + edit-via-drawer COMPOSITION RECIPE (SaaS UX
// brief §6, "Content layout — card-arranged entity views with an edge-docked drawer edit flow"). Extracted
// from the agent-admin entry-list/entry-form shape (GH #917/#947/#949/#950, PR #948) and realized entirely
// over EXISTING fleet controls — ui-grid + ui-card + ui-drawer + ui-text-field/ui-field + ui-segmented-control
// + ui-switch + ui-button — bound to a plain signals store. No new interactive control.
//
// The three things this recipe names, verbatim from the ticket's acceptance criteria:
//
//  1. SIGNAL OWNERSHIP of open + editing entity — `drawerOpen` (is the drawer shown at all) and `editingId`
//     (which record — `null` means "Add member", the SAME drawer in a second mode, entry-form.ts's GH #917
//     precedent) are two SEPARATE signals, never folded into one "open, editing X" union: a reader that only
//     cares WHETHER something is open never has to also know which record, and `editingId` stays meaningful
//     independent of `drawerOpen`'s own timing — it also drives the currently-edited card's own highlight
//     (the `data-editing` toggle effect below, deliberately SEPARATE from `renderGrid`, which depends on
//     `members` only — a re-stamp on `editingId` would detach the very Edit button the drawer is about to
//     record as its focus-restore opener), the ADR-0019 two-way-binding shape (`drawer.open` REFLECTS `drawerOpen`, and the
//     platform's own `close` event writes back into it — the SAME seam the catalog's `value:{prop:'open',
//     event:'toggle'}` renderer binding rides). `mode` (add vs. edit) is a plain PARAMETER to `openDrawer`,
//     not baked into persistent state — entry-list.ts's own `EntryFormMode` discriminated union, one level up.
//
//  2. DIRTY-STATE / DISCARD-CONFIRM convention — pre-decided RECIPE-LEVEL, not a fleet ADR (ops plan §3.3):
//     `ui-drawer` ships no dirty-tracking of its own (a structural container, ADR-0188), so a page that
//     buffers edits owns the guard itself. The shape: a plain snapshot object captured at open, a `dirty`
//     signal recomputed on every field `input`, and `drawer.persistent` REFLECTS `dirty` — while dirty,
//     Escape and a backdrop click are inert (drawer.md's own `persistent` contract), so the only way out is
//     the footer's own Cancel, which swaps to a one-shot "Discard changes?" confirm exactly when there is
//     something to lose. The SAME mechanism covers both modes uniformly — an Add's blank snapshot reads dirty
//     the moment a field is typed, so there is no second "unsaved new record" special case.
//
//  3. WRITE-BACK wiring — Save is the ONLY commit path (buffered, matching entry-form's `add` mode, GH #917
//     D1); nothing touches the `members` store until it fires. A field's own `input`/`change` never writes
//     through here (unlike entry-form's per-field-on-change EDIT mode) — the dirty-guard's whole point is a
//     state worth confirming before it lands, which a live-apply field would never let accumulate.
//
// Deliberately NOT reached for: `ui-modal` — composition-patterns' existing record-CRUD row already covers a
// modal-hosted open/validate/save loop (`site/pages/workbench.ts`, ADR-0120/ADR-0158's ruling); this recipe is
// the DRAWER-hosted sibling the SaaS UX brief asks for, edge-docked like agent-admin's own entry drawers
// rather than centred.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './card-grid-drawer.css'
import { signal, effect, untracked, whenFlushed } from '@agent-ui/components'
import type {
  UIBadgeElement,
  UIButtonElement,
  UICardElement,
  UIDrawerElement,
  UIFieldElement,
  UISegmentedControlElement,
  UISwitchElement,
  UITextFieldElement,
} from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'Card grid + drawer edit',
  intro:
    'Card-arranged entity views with an edge-docked drawer edit flow — the agent-admin entry-list shape ' +
    '(GH #917/#947, PR #948), extracted to a plain card grid: ui-grid + ui-card + ui-drawer, a buffered ' +
    'record form, and a page-owned dirty-state/discard-confirm convention (recipe-level, not a fleet ADR).',
})

content.append(
  pageLead(
    'Each card’s Edit opens the SAME drawer "Add member" does, in edit or add mode. The drawer buffers ' +
      'every field until Save commits it to the store — Escape and a backdrop click are blocked while the ' +
      'form is dirty (ui-drawer’s own `persistent` prop), so the only way out of unsaved changes is the ' +
      'footer’s own Cancel, which asks once before discarding.',
  ),
)

// ── the plain signals store ─────────────────────────────────────────────────────────────────────────────────

type MemberRole = 'member' | 'admin' | 'owner'

interface Member {
  readonly id: string
  name: string
  role: MemberRole
  active: boolean
}

const ROLE_LABEL: Record<MemberRole, string> = { member: 'Member', admin: 'Admin', owner: 'Owner' }
const ROLES: readonly MemberRole[] = ['member', 'admin', 'owner']

let nextId = 1
function makeId(): string {
  const id = `member-${nextId}`
  nextId += 1
  return id
}

const members = signal<readonly Member[]>([
  { id: makeId(), name: 'Priya Shah', role: 'owner', active: true },
  { id: makeId(), name: 'Marco Diaz', role: 'admin', active: true },
  { id: makeId(), name: 'Ren Okafor', role: 'member', active: true },
  { id: makeId(), name: 'Sam Lindqvist', role: 'member', active: false },
])

// The three module-level signals this whole recipe hangs off — see the file banner's points 1/2.
// `editingId` is `null` in ADD mode (no entity exists yet) and the string id in EDIT mode.
const drawerOpen = signal(false)
const editingId = signal<string | null>(null)
const dirty = signal(false)

// ── the grid + cards ─────────────────────────────────────────────────────────────────────────────────────────

const addButton = document.createElement('ui-button') as UIButtonElement
addButton.setAttribute('variant', 'soft')
addButton.textContent = 'Add member'
addButton.addEventListener('click', () => openDrawer(null))

const grid = document.createElement('ui-grid')
grid.setAttribute('gap', 'md')
grid.setAttribute('min', '16rem')
grid.setAttribute('data-part', 'member-grid')

content.append(addButton, grid)

// `renderGrid` depends on `members` ONLY. It must NOT track `editingId`: `openDrawer` writes `editingId` before
// `drawerOpen`, and both effects flush in the same microtask — a grid re-stamp on `editingId` would detach the
// clicked Edit button (focus falls to `<body>`) BEFORE `ui-drawer`'s own `#openDialog` records
// `document.activeElement` as the opener to restore on close (drawer.ts, ADR-0017 cl.4). So the highlight is
// applied here with an UNTRACKED read (a fresh stamp mid-edit still paints the right card) and otherwise lives
// in the small `data-editing` toggle effect below, which only touches EXISTING cards.
function renderGrid(): void {
  const activeId = untracked(() => editingId.value)
  grid.replaceChildren()
  for (const member of members.value) {
    const card = document.createElement('ui-card') as UICardElement
    card.setAttribute('data-part', 'member-card')
    card.setAttribute('data-member-id', member.id) // the identity seam `focusCardEdit` + the toggle effect key on
    card.toggleAttribute('data-editing', member.id === activeId)

    const header = document.createElement('ui-card-header')
    header.setAttribute('format', 'structured')
    header.append(member.name)
    const roleBadge = document.createElement('ui-badge') as UIBadgeElement
    roleBadge.setAttribute('slot', 'trailing')
    roleBadge.intent = member.role === 'owner' ? 'success' : 'neutral'
    roleBadge.label = ROLE_LABEL[member.role]
    header.append(roleBadge)

    const body = document.createElement('ui-card-content')
    const status = document.createElement('p')
    status.setAttribute('data-part', 'member-status')
    status.textContent = member.active ? 'Active' : 'Inactive'
    body.append(status)

    const footer = document.createElement('ui-card-footer')
    const editBtn = document.createElement('ui-button') as UIButtonElement
    editBtn.setAttribute('variant', 'soft')
    editBtn.setAttribute('slot', 'trailing')
    editBtn.setAttribute('aria-label', `Edit ${member.name}`)
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => openDrawer(member.id))
    footer.append(editBtn)

    card.append(header, body, footer)
    grid.append(card)
  }
}

/** The card being edited paints its own highlight — toggled on the EXISTING cards, never a re-stamp. */
function syncEditingHighlight(): void {
  const activeId = editingId.value
  for (const card of grid.querySelectorAll<HTMLElement>('[data-part="member-card"]')) {
    card.toggleAttribute('data-editing', card.dataset['memberId'] === activeId)
  }
}

// Focus-restore by IDENTITY, for the two exits that re-stamp the grid (Save/Remove write `members` ⇒
// `renderGrid` replaces every card, so the Edit button `ui-drawer` recorded as its opener is detached by the
// time its `close` handler runs — `#restoreFocus` requires `opener.isConnected`, so it correctly no-ops).
// Called AFTER the flush that actually closes the dialog: focusing while the modal is still up would be inert
// (everything outside the top layer is). Save ⇒ the same card's fresh Edit button; Remove (card gone) or Add
// mode (no card yet) ⇒ the "Add member" button, the nearest stable affordance. Cancel/Discard never re-stamp,
// so the drawer's own restore lands on this same element a task later — idempotent, one code path for all
// four exits.
function focusCardEdit(id: string | null): void {
  const editBtn =
    id === null ? null : grid.querySelector<HTMLElement>(`[data-part="member-card"][data-member-id="${id}"] ui-button`)
  ;(editBtn ?? addButton).focus()
}

// ── the ONE drawer, built once, filled fresh on every open — ui-drawer MOVES its children into the dialog
// PART at connect, exactly once (entry-list.ts's own `openForm` precedent), so only the three regions'
// CHILDREN are ever replaced after this initial mount ────────────────────────────────────────────────────────

const drawer = document.createElement('ui-drawer') as UIDrawerElement
drawer.setAttribute('edge', 'end')
drawer.setAttribute('aria-labelledby', 'member-drawer-heading')
const drawerHeader = document.createElement('header')
const drawerContent = document.createElement('div')
drawerContent.setAttribute('data-region', 'content')
const drawerFooter = document.createElement('footer')
drawer.append(drawerHeader, drawerContent, drawerFooter)
content.append(drawer)

// The two-way `open` binding (ADR-0019's own shape, done by hand here instead of through the a2ui renderer):
// `drawer.open` REFLECTS `drawerOpen.value` one way; the platform's own `close` event (Escape while NOT
// dirty, or a backdrop click — never our own programmatic `drawerOpen.value = false` writes, drawer.md's own
// contract) writes it back the other way, so the two can never disagree regardless of which side dismissed.
effect(() => {
  drawer.open = drawerOpen.value
})
effect(() => {
  drawer.persistent = dirty.value
})
drawer.addEventListener('close', () => {
  drawerOpen.value = false
  editingId.value = null
  dirty.value = false
})

interface MemberDraft {
  name: string
  role: MemberRole
  active: boolean
}

function snapshotFor(id: string | null): MemberDraft {
  const entity = id !== null ? members.value.find((m) => m.id === id) : undefined
  return entity
    ? { name: entity.name, role: entity.role, active: entity.active }
    : { name: '', role: 'member', active: true }
}

function draftsDiffer(a: MemberDraft, b: MemberDraft): boolean {
  return a.name !== b.name || a.role !== b.role || a.active !== b.active
}

function openDrawer(id: string | null): void {
  const snapshot = snapshotFor(id)
  const draft: MemberDraft = { ...snapshot }

  const heading = document.createElement('h2')
  heading.id = 'member-drawer-heading'
  heading.textContent = id === null ? 'Add member' : `Edit ${snapshot.name}`
  drawerHeader.replaceChildren(heading)

  const nameField = document.createElement('ui-text-field') as UITextFieldElement
  nameField.required = true
  nameField.value = draft.name
  const nameCell = document.createElement('ui-field') as UIFieldElement
  nameCell.label = 'Name'
  nameCell.append(nameField)

  const roleControl = document.createElement('ui-segmented-control') as UISegmentedControlElement
  roleControl.setAttribute('aria-label', 'Role')
  for (const role of ROLES) {
    const segment = document.createElement('ui-segment')
    segment.setAttribute('value', role)
    segment.textContent = ROLE_LABEL[role]
    roleControl.append(segment)
  }
  roleControl.value = draft.role
  const roleCell = document.createElement('ui-field') as UIFieldElement
  roleCell.label = 'Role'
  roleCell.append(roleControl)

  const activeSwitch = document.createElement('ui-switch') as UISwitchElement
  activeSwitch.checked = draft.active
  const activeCell = document.createElement('ui-field') as UIFieldElement
  activeCell.label = 'Active'
  activeCell.append(activeSwitch)

  function syncDirty(): void {
    dirty.value = draftsDiffer(draft, snapshot)
  }

  const syncName = (): void => {
    draft.name = nameField.value
    syncDirty()
  }
  nameField.addEventListener('input', syncName)
  // ALSO on `compositionend` — the GH #950 gap, entry-form.ts's precedent verbatim: `ui-text-field`'s own inner
  // `input` listener returns early mid-composition WITHOUT re-emitting the host `input` (text-field.ts), so an
  // IME candidate committed via `compositionend` alone would leave `draft.name` (and so `dirty`) at the STALE
  // pre-composition value — a Save could commit the wrong name, or a dismiss land with `persistent` still
  // false. `compositionend` bubbles from the editor part to the host AFTER the control's own handler has
  // caught `.value` up, so this always reads the composed text.
  nameField.addEventListener('compositionend', syncName)
  // `change` fires only AFTER the segmented group's own (non-cancelable) commit, and only once, targeted at
  // the GROUP — the same `event.target !== roleControl` guard entry-form.ts's tier control uses (that file's
  // own comment explains the order-dependent double-fire this filters out).
  roleControl.addEventListener('change', (event) => {
    if (event.target !== roleControl) return
    draft.role = (roleControl.value ?? 'member') as MemberRole
    syncDirty()
  })
  activeSwitch.addEventListener('change', () => {
    draft.active = activeSwitch.checked
    syncDirty()
  })

  const formBody = document.createElement('div')
  formBody.setAttribute('data-part', 'member-drawer-form')
  formBody.append(nameCell, roleCell, activeCell)

  // Danger row — Remove only makes sense for an EXISTING record (structural absence in add mode, the
  // entry-form.ts `!entry.builtin` precedent one level over: nothing to delete yet, not a disabled button).
  if (id !== null) {
    const danger = document.createElement('div')
    danger.setAttribute('data-part', 'member-drawer-danger')
    const note = document.createElement('p')
    note.textContent = `Remove “${snapshot.name}” from the roster. This cannot be undone.`
    const removeBtn = document.createElement('ui-button') as UIButtonElement
    removeBtn.setAttribute('variant', 'soft')
    removeBtn.setAttribute('aria-label', `Remove ${snapshot.name}`)
    removeBtn.textContent = 'Remove member'
    removeBtn.addEventListener('click', () => {
      members.value = members.value.filter((m) => m.id !== id)
      reallyClose()
    })
    danger.append(note, removeBtn)
    formBody.append(danger)
  }

  drawerContent.replaceChildren(formBody)

  // ── the footer: Save / Cancel, or the one-shot "Discard changes?" confirm swapped in over them ────────────
  const saveBtn = document.createElement('ui-button') as UIButtonElement
  saveBtn.setAttribute('variant', 'soft')
  saveBtn.textContent = 'Save'
  saveBtn.addEventListener('click', () => {
    const typed = draft.name.trim()
    if (typed.length === 0) {
      // Fail-closed — the same required-name law entry-form.ts's add mode keeps — but never SILENTLY:
      // `reportValidity()` fires `invalid` at the control, which flips its user-invalid tracker so the wrapping
      // `ui-field` shows the required-empty message (ADR-0014 cl.2c) and the platform focuses the anchor. A
      // whitespace-only value passes `required` (reportValidity returns true, nothing shown), so focus the
      // field ourselves in that residue case — the user still sees WHERE Save stopped.
      if (nameField.reportValidity()) nameField.focus()
      return
    }
    if (id === null) {
      members.value = [...members.value, { id: makeId(), name: typed, role: draft.role, active: draft.active }]
    } else {
      members.value = members.value.map((m) => (m.id === id ? { ...m, name: typed, role: draft.role, active: draft.active } : m))
    }
    reallyClose()
  })

  const cancelBtn = document.createElement('ui-button') as UIButtonElement
  cancelBtn.setAttribute('variant', 'soft')
  cancelBtn.textContent = 'Cancel'
  cancelBtn.addEventListener('click', attemptClose)

  const normalActions = document.createElement('div')
  normalActions.setAttribute('data-part', 'member-drawer-actions')
  normalActions.append(saveBtn, cancelBtn)

  const confirmActions = document.createElement('div')
  confirmActions.setAttribute('data-part', 'member-drawer-confirm')
  const confirmNote = document.createElement('span')
  confirmNote.setAttribute('role', 'status')
  confirmNote.textContent = 'Discard unsaved changes?'
  const discardBtn = document.createElement('ui-button') as UIButtonElement
  discardBtn.setAttribute('variant', 'soft')
  discardBtn.textContent = 'Discard'
  discardBtn.addEventListener('click', reallyClose)
  const keepEditingBtn = document.createElement('ui-button') as UIButtonElement
  keepEditingBtn.setAttribute('variant', 'soft')
  keepEditingBtn.textContent = 'Keep editing'
  keepEditingBtn.addEventListener('click', () => {
    confirmActions.hidden = true
    normalActions.hidden = false
  })
  confirmActions.append(confirmNote, discardBtn, keepEditingBtn)
  confirmActions.hidden = true

  drawerFooter.replaceChildren(normalActions, confirmActions)

  function attemptClose(): void {
    if (!dirty.value) {
      reallyClose()
      return
    }
    normalActions.hidden = true
    confirmActions.hidden = false
  }

  function reallyClose(): void {
    drawerOpen.value = false
    editingId.value = null
    dirty.value = false
    // After THIS batch flushes the dialog is really closed (the `open` effect ran `dialog.close()`), so the
    // grid is focusable again — see `focusCardEdit` for why the drawer's own restore cannot cover Save/Remove.
    void whenFlushed().then(() => focusCardEdit(id))
  }

  editingId.value = id
  dirty.value = false
  drawerOpen.value = true
}

effect(renderGrid)
effect(syncEditingHighlight)
