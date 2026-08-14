// entry-form.ts — the ONE entry FORM, built twice (GH #917 / the issue's Phase 0 ruling §4): the per-entry
// EDIT form and the new-entry ADD form are the same field-building code in two modes, never two hand-rolled
// forms that drift. `entry-list.ts` owns the section shell, the rows and the `ui-drawer` these regions are
// dropped into; this module owns nothing but the fields inside it and the writes they commit through.
//
// Why a module of its own rather than more `entry-list.ts`: the two modes differ in exactly three places
// (the header title, the tier pill's presence, and what the footer's ONE primary does), and everything else —
// the name field, the description field, the content editor, their labels, their commit timing — is one rule
// with one home. `entries.ts`'s own kind-list doc-comments warn about the inverse case (two rules that merely
// coincide, folded into one expression); this is the case they contrast with.
//
// The two modes, and WHY they differ (Phase 0 D1/D3):
//   • `edit` — the entry already exists, so every field commits ON ITS OWN `change`, through the same
//     per-entry writers the row used inline before (`onRename`/`onDescriptionChange`/`onContentChange`/
//     `onAvailabilityChange`) — the fleet's per-field-on-change law. The footer primary is therefore **Done**
//     (a dismiss, not a commit — the Manage-agents `drawerDone` precedent, agent-admin-app.ts), never a batch
//     Save that would mint a second truth plus buffering machinery for nothing.
//   • `add` — the entry does not exist until `validateNewEntry` mints it, so the form is inherently BUFFERED:
//     the footer primary IS the commit (**Add**, through `handlers.onAdd`). Success closes + resets; a
//     rejection keeps every typed field and shows the message inline next to the offending field (the
//     `submitAdd` MAJOR-fix law carried over verbatim from `entry-list.ts`). Add mode deliberately carries NO
//     tier pill (D3): `NewEntryInput` has no availability member and SPEC-R1 pins a new entry as in-context BY
//     ABSENCE, while `onAdd` returns a bare boolean (ADR-0164 cl.3) and the minted id may be suffix-deduped —
//     so the form cannot reliably follow an add with an availability write. A new entry is born in-context;
//     its tier is set from the row's Edit drawer, one gesture later.
//
// DELETE is the last block of the EDIT form's content, a separated danger row — never in the footer, where it
// could sit adjacent to the primary. For a `builtin` entry it is not built AT ALL (structural absence, the
// entry-list.ts:`!entry.builtin` + agent-admin.ts writer-filter pair, ADR-0132 Fork 4: toggle off, never
// delete), and a "Built-in" tag beside the title STATES the rule rather than leaving the absence to read as a
// missing feature (the roster drawer's "Shipped" tag precedent, agent-admin-app.ts).

import type { UIButtonElement } from '@agent-ui/components/controls/button'
import type { UICodeEditorElement } from '@agent-ui/code/editor'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import type { UIFieldElement } from '@agent-ui/components/controls/field'
import type { UIToggleElement } from '@agent-ui/components/controls/toggle'
import { ENTRY_AVAILABILITY, entryAvailability } from './entry-data.ts'
import type { Entry, EntryAvailability, NewEntryInput } from './entry-data.ts'

/** The writers this form commits through — the SUPERSET-free subset of `EntryListHandlers`, declared HERE so
 *  the dependency runs one way only (`entry-list.ts` → this module, never back). `EntryListHandlers` extends
 *  it and adds the row's own `onToggle`, so each member below has exactly ONE declaration and one doc. */
export interface EntryFormHandlers {
  /** Commit a per-entry CONTENT change (the markdown body). Not optional — every kind that mounts a form
   *  carries one, and a content editor is only built when `options.contentField` says the kind has a body. */
  onContentChange(id: string, content: string): void
  /** Delete one entry by id. The form only ever calls this from the EDIT mode's danger row, which is built
   *  only for a non-`builtin` entry; the caller's own writer keeps the defense-in-depth filter regardless. */
  onDelete(id: string): void
  /** Returns `true` on a successful add, `false` on a fail-closed rejection (component-reviewer MAJOR
   *  fix: the caller needs this to decide whether to reset/hide the form — resetting on a REJECTED
   *  submit silently discarded the typed description/content the user still needs to see and fix.
   *
   *  GH #783/LLD-C5 — an OPTIONAL second argument carries the ADDING PACK's own `rejectOnCollision`
   *  flag through to the caller's one `validateNewEntry` call (the library-menu select handler supplies
   *  it; the hand-author form omits it entirely — byte-identical to before). The return stays the BARE
   *  boolean ADR-0164 cl.3 pins: nothing in this arc is async, and the add form branches on the raw
   *  return, so a `Promise` would be always-truthy — resetting the form on a rejection, the exact defect
   *  the boolean return exists to prevent. Every existing single-argument implementation stays valid by
   *  TS structural typing (§6.1's non-decision). */
  onAdd(input: NewEntryInput, context?: { rejectOnCollision?: boolean }): boolean
  /** GH #850 / capability-availability-tagging.spec.md SPEC-R2 — the per-entry AVAILABILITY write, called
   *  with the mode the entry is being flipped TO. OPTIONAL, the additive-optional law `EntryListOptions`
   *  follows: absent ⇒ the tier pill refuses its own flip (`toggle` is cancelable, toggle.md's
   *  refused-toggle mechanism), so an opted-in section with no writer wired can never paint a mode the
   *  store does not hold. Persistence is the CALLER's (neither this module nor `entry-list.ts` owns store
   *  access), exactly as `onToggle` already works.
   *
   *  GH #848 reconciliation — this handler's missing-writer posture (render, then REFUSE the flip)
   *  deliberately differs from `onRename`'s (render NOTHING), and the difference is the affordance's own
   *  nature, not an inconsistency: a mode pill carries STATE the form must show whether or not anything can
   *  change it (`pressed` IS the answer to "is this entry invocable?"), so it renders and refuses; a rename
   *  FIELD with no writer could only ever be a typing target that silently discards. */
  onAvailabilityChange?(id: string, availability: EntryAvailability): void
  /** GH #848 — commit a per-entry DISPLAY-NAME change (`entry-data.ts`'s `renameEntry` is the law; the
   *  caller owns the store write, this module owns the affordance). OPTIONAL, the `onAdd`-second-argument
   *  law: every existing implementation stays valid by TS structural typing, and a section whose handlers
   *  omit it renders the name READ-ONLY — a field with nothing to commit through is a typing target that can
   *  only fail. `label` arrives RAW (the field's own text): trimming and the empty-label refusal are
   *  `renameEntry`'s, so the law has exactly one home. The entry's `id` is never affected. */
  onRename?(id: string, label: string): void
  /** GH #917 (Phase 0 D2) — commit a per-entry DESCRIPTION change (`entry-data.ts`'s `describeEntry` is the
   *  law). Before the Edit drawer, description was settable at ADD time only and had no edit affordance at
   *  all; the drawer makes it a form field, so it needs a writer. OPTIONAL on the same additive law as
   *  `onRename` above — absent ⇒ the description renders read-only, and every pre-#917 caller stays valid by
   *  TS structural typing. An EMPTY description is legal (unlike an empty label), so there is no refusal
   *  case here: clearing the field clears the entry's description. */
  onDescriptionChange?(id: string, description: string): void
}

/** Which fields this kind's form carries — the SAME `EntryListOptions` flags that gate the row's own
 *  affordances, so no kind gains a field in the drawer that it lacked inline (Phase 0 §2). */
export interface EntryFormOptions {
  /** ADR-0170 cl.8 — does this kind's entry have an editable BODY? `false` (a kind whose entries key an
   *  external registry) ⇒ no content editor is built, in either mode. */
  contentField: boolean
  /** GH #850/SPEC-R2 — does this kind have AVAILABILITY semantics? Gates the EDIT form's tier pill (add mode
   *  never carries one — D3 above). */
  availabilityToggle: boolean
  /** GH #848 — are this kind's labels free human display text? `false` ⇒ the EDIT form's name field is
   *  read-only (a `prompt-section` label IS the composed prompt's own `## {label}` heading; a `catalog` label
   *  mirrors the registry entry its id keys). Add mode always types a name — that is what mints the id. */
  rename: boolean
}

/** `add` buffers until the footer's Add commits (`title` is the section's own add label — "Add skill");
 *  `edit` commits per field against the entry it carries (its label IS the form title). */
export type EntryFormMode = { mode: 'add'; title: string } | { mode: 'edit'; entry: Entry }

/** The three drawer REGIONS this form fills, returned as elements the caller drops into its own already-
 *  connected `<header>` / `[data-region='content']` / `<footer>` shells (`ui-drawer` MOVES its children into
 *  the dialog part at connect, ONCE — so the shells are built before connect and only their CHILDREN are ever
 *  replaced; agent-admin-app.ts's `rosterList` precedent). */
export interface EntryFormRegions {
  header: HTMLElement
  content: HTMLElement
  footer: HTMLElement
}

/** The one hint the tier pill used to carry as a row `title` — visible prose in the drawer, where there is
 *  room for it. Byte-identical wording to the pill's shipped tooltip (GH #850). */
const TIER_HINT = 'On: user-invocable — inert until invoked from the conversation. Off: in context — the model sees it every turn.'

/** The "Built-in" tag's own sentence — the roster drawer's "Shipped" tag shape (agent-admin-app.ts:497),
 *  applied to ADR-0132 Fork 4's rule: configuration is open, deletion is not. */
const BUILTIN_HINT = 'A built-in entry — it can be edited and toggled, but never deleted.'

/** One labelled field cell: `ui-field` (the visible label/description wrapper) around ONE control, the
 *  TKT-0073 precedent this module inherits from the add form it replaces. */
function fieldCell(label: string, control: HTMLElement, description?: string): UIFieldElement {
  const wrap = document.createElement('ui-field') as UIFieldElement
  wrap.label = label
  if (description !== undefined) wrap.description = description
  wrap.append(control)
  return wrap
}

/** The per-entry markdown body editor — `<ui-code-editor language="markdown">` (ADR-0139), the exact control
 *  the row carried inline before this drawer existed, with the same `.value` get/set and the same
 *  commit-on-`change` (never `input`) timing. `rows` is the drawer's own, larger figure: the content region
 *  gives it the remaining height (entry-list.css), so the body is edited at reading size rather than in a
 *  4-row row-slot. */
function contentEditor(part: string, ariaLabel: string, value: string): UICodeEditorElement {
  const editor = document.createElement('ui-code-editor') as UICodeEditorElement
  editor.language = 'markdown'
  editor.rows = 8
  editor.setAttribute('data-part', part)
  editor.setAttribute('aria-label', ariaLabel)
  editor.value = value
  return editor
}

/** A plain `<ui-button variant="soft">` with a wordmark label — TKT-0048's law (a real button, never a
 *  bespoke `<button>`; the word alone, never a glued glyph). */
function formButton(part: string, text: string): UIButtonElement {
  const button = document.createElement('ui-button') as UIButtonElement
  button.setAttribute('variant', 'soft')
  button.setAttribute('data-part', part)
  button.textContent = text
  return button
}

/**
 * Build ONE entry form — the shared field-building code both drawer modes run through (GH #917).
 *
 * `close` is called when the form is DONE with the surface it lives on: the footer's Done (edit), a
 * SUCCESSFUL Add (add — a rejection deliberately keeps the drawer open with every field intact), and the
 * danger row's Remove (edit — the entry it was editing no longer exists). The form never touches the drawer
 * itself; the caller owns that, the same way it owns the store.
 */
export function buildEntryForm(
  kind: string,
  form: EntryFormMode,
  handlers: EntryFormHandlers,
  options: EntryFormOptions,
  close: () => void,
): EntryFormRegions {
  const header = document.createElement('div')
  header.setAttribute('data-part', 'entry-form-heading')

  const title = document.createElement('h2')
  title.setAttribute('data-part', 'entry-form-title')
  header.append(title)

  const content = document.createElement('div')
  // The ADD form keeps the `entry-add-form` part name it has carried since ADR-0132 (`showAddError`'s own
  // anchor, entry-list.css's card chrome, agent-admin.md's documented anatomy): the FORM did not change
  // identity, only the surface it renders on.
  content.setAttribute('data-part', form.mode === 'add' ? 'entry-add-form' : 'entry-edit-form')
  // `kind` is read by nothing else in this module — the form is generic by construction (ADR-0132 cl.1: no
  // kind gets its own bespoke authoring code). It rides the content region as a data attribute so a
  // consumer's CSS/test can scope a form to one kind without this module growing a per-kind branch.
  content.setAttribute('data-kind', kind)

  const footer = document.createElement('div')
  footer.setAttribute('data-part', 'entry-form-actions')

  if (form.mode === 'add') {
    title.textContent = form.title

    // TKT-0073's shape verbatim: the required field's message renders in the field's OWN column flow,
    // outside `ui-text-field`'s bordered box. `entry-add-error` is a real note element rather than
    // `ui-field`'s control-owned `[data-part='error']` part, because that part is rendered by a scope-owned
    // reactive effect over the ASSOCIATED CONTROL's validity, gated on `userInvalid()` (field.ts's
    // `#renderValidity`) — an author cannot write a `validateNewEntry` verdict into it. Placing the note
    // INSIDE the same `ui-field` (permitted static content, field.md's slots note) lands the message in the
    // same column position it would have had: directly under the name field it is about.
    const labelField = document.createElement('ui-text-field') as UITextFieldElement
    labelField.required = true
    labelField.setAttribute('data-part', 'entry-add-label')
    const errorNote = document.createElement('p')
    errorNote.setAttribute('data-part', 'entry-add-error')
    errorNote.hidden = true
    const labelCell = fieldCell('Name', labelField)
    labelCell.append(errorNote)

    const descriptionField = document.createElement('ui-text-field') as UITextFieldElement
    descriptionField.setAttribute('data-part', 'entry-add-description')
    const descriptionCell = fieldCell('Description', descriptionField, 'Optional')

    content.append(labelCell, descriptionCell)

    const bodyField = options.contentField ? contentEditor('entry-add-content', 'Content', '') : null
    if (bodyField) content.append(fieldCell('Content', bodyField))

    /** The buffered commit — `entry-list.ts`'s own `submitAdd` law, carried over unchanged: reset + close
     *  ONLY on success, so a rejection keeps every typed field on screen beside the message
     *  (`showAddError` writes it into `errorNote` above) instead of silently discarding it. */
    const submitAdd = (): void => {
      const input: NewEntryInput = { label: labelField.value, description: descriptionField.value, content: bodyField?.value ?? '' }
      if (!handlers.onAdd(input)) return
      labelField.value = ''
      descriptionField.value = ''
      if (bodyField) bodyField.value = ''
      close()
    }

    const submitBtn = formButton('entry-add-submit', 'Add')
    submitBtn.addEventListener('click', submitAdd)
    footer.append(submitBtn)

    // Native single-line `<input>` Enter-to-submit parity for the one required field — deliberately NOT
    // wired on the description/content fields (optional field / multi-line field). `isComposing` guards an
    // IME candidate-confirming Enter the same way `ui-text-field`'s own internal Enter handler does.
    labelField.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return
      submitAdd()
    })

    return { header, content, footer }
  }

  const { entry } = form
  title.textContent = entry.label

  // Structural protection, STATED: a builtin entry's form builds no delete affordance at all (below), and
  // this tag says why — the absence reads as a rule, not as a missing feature.
  if (entry.builtin) {
    const tag = document.createElement('span')
    tag.setAttribute('data-part', 'entry-form-tag')
    tag.textContent = 'Built-in'
    tag.title = BUILTIN_HINT
    header.append(tag)
  }

  // ── name ────────────────────────────────────────────────────────────────────────────────────────────────
  // Editability is the KIND-level rename gate, doubly gated the way the row's inline trigger was: the OPTION
  // says this kind's names are free human text, the HANDLER is what a commit rides. Either missing ⇒ the
  // field renders read-only rather than absent, because the NAME is what identifies the form's subject.
  const renamable = options.rename && handlers.onRename !== undefined
  const nameField = document.createElement('ui-text-field') as UITextFieldElement
  nameField.setAttribute('data-part', 'entry-form-name')
  nameField.value = entry.label
  nameField.readonly = !renamable
  content.append(fieldCell('Name', nameField))
  if (renamable) {
    // `change`, never `input`: ui-text-field commits on Enter or blur-with-change — the fleet's
    // per-field-on-change law this whole form follows. The empty case is a DISPLAY decision, not a second
    // copy of the validation law: `renameEntry` owns the trim and the empty-label no-op, so the field snaps
    // back to the stored name — the visible refusal the row's inline rename already shipped.
    let committed = entry.label
    nameField.addEventListener('change', () => {
      const typed = nameField.value
      if (typed.trim().length === 0) {
        nameField.value = committed
        return
      }
      committed = typed.trim()
      // The drawer holds no store subscription (it is rebuilt on open, never on a notification), so the
      // title it opened with would otherwise keep the pre-rename name while the row behind it updates.
      title.textContent = committed
      handlers.onRename?.(entry.id, typed)
    })
  }

  // ── description ─────────────────────────────────────────────────────────────────────────────────────────
  const descriptionField = document.createElement('ui-text-field') as UITextFieldElement
  descriptionField.setAttribute('data-part', 'entry-form-description')
  descriptionField.value = entry.description
  descriptionField.readonly = handlers.onDescriptionChange === undefined
  content.append(fieldCell('Description', descriptionField, 'Optional'))
  descriptionField.addEventListener('change', () => handlers.onDescriptionChange?.(entry.id, descriptionField.value))

  // ── tier ────────────────────────────────────────────────────────────────────────────────────────────────
  // GH #850/SPEC-R2's control, moved not re-invented: the `ui-toggle` pressed pill whose visible label stays
  // the STABLE word "Invocable" (state rides `aria-pressed`, never a swapped name — the toggle-button AX
  // anti-pattern), writing through the same `onAvailabilityChange`.
  if (options.availabilityToggle) {
    const tier = document.createElement('div')
    tier.setAttribute('data-part', 'entry-form-tier')
    const mode = document.createElement('ui-toggle') as UIToggleElement
    mode.setAttribute('data-part', 'entry-availability')
    mode.setAttribute('aria-label', `${entry.label} user-invocable`)
    mode.pressed = entryAvailability(entry) === ENTRY_AVAILABILITY.invocable
    mode.append('Invocable')
    const hint = document.createElement('p')
    hint.setAttribute('data-part', 'entry-form-hint')
    hint.textContent = TIER_HINT
    // toggle.md's refused-toggle contract: `toggle` fires BEFORE `pressed` commits and is cancelable. No
    // writer wired ⇒ refuse the flip outright, so the pill can never paint a mode no store holds.
    //
    // The mode written is derived from the pill's LIVE `pressed` (still the pre-commit value here), never
    // from the captured `entry`: unlike the row this replaces — thrown away and rebuilt by the caller's
    // re-render after every write — this pill outlives its own commits, so a captured value would go stale
    // on the second flip. toggle.ts's own post-listener flip then lands on the still-attached pill, which is
    // exactly the paint we want (the row's marker follows from the store re-render behind the drawer).
    mode.addEventListener('toggle', (event) => {
      const write = handlers.onAvailabilityChange
      if (write === undefined) {
        event.preventDefault()
        return
      }
      write(entry.id, mode.pressed ? ENTRY_AVAILABILITY.context : ENTRY_AVAILABILITY.invocable)
    })
    tier.append(mode, hint)
    content.append(fieldCell('Availability', tier))
  }

  // ── content ─────────────────────────────────────────────────────────────────────────────────────────────
  if (options.contentField) {
    const bodyField = contentEditor('entry-content', `${entry.label} content`, entry.content)
    bodyField.addEventListener('change', () => handlers.onContentChange(entry.id, bodyField.value))
    content.append(fieldCell('Content', bodyField))
  }

  // ── delete ──────────────────────────────────────────────────────────────────────────────────────────────
  // LAST block of the scrolling content, never the footer: the footer holds only the primary, so the two can
  // never sit adjacent. Absent entirely for a builtin entry (the `!entry.builtin` gate this replaces,
  // entry-list.ts's own — the caller's `onDelete` keeps its defense-in-depth filter either way).
  if (!entry.builtin) {
    const danger = document.createElement('div')
    danger.setAttribute('data-part', 'entry-form-danger')
    const note = document.createElement('p')
    note.setAttribute('data-part', 'entry-form-hint')
    note.textContent = `Remove “${entry.label}” from this agent. Toggling it off keeps it in the list.`
    const deleteBtn = formButton('entry-delete', 'Remove')
    deleteBtn.setAttribute('aria-label', `Remove ${entry.label}`)
    deleteBtn.addEventListener('click', () => {
      handlers.onDelete(entry.id)
      close() // the subject of this form no longer exists — the surface editing it must not outlive it
    })
    danger.append(note, deleteBtn)
    content.append(danger)
  }

  const doneBtn = formButton('entry-form-done', 'Done')
  doneBtn.addEventListener('click', close)
  footer.append(doneBtn)

  return { header, content, footer }
}
