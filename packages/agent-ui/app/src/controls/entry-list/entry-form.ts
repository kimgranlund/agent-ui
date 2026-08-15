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
import type { UISegmentedControlElement } from '@agent-ui/components/controls/segmented-control'
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
   *  follows: absent ⇒ an opted-in section with no writer wired can never paint a mode the store does not
   *  hold.
   *
   *  GH #947 — the DRAWER's tier control is a `ui-segmented-control` (this module), not the row's `ui-toggle`
   *  pill (`entry-list.ts`, unchanged): a segmented control's `change` fires only AFTER the group's own
   *  commit (radio-group.ts's non-cancelable `#commit`), so there is no pre-commit event left to refuse the
   *  way `ui-toggle`'s cancelable `toggle` lets the row's pill refuse. The end state is the same — no
   *  writer ⇒ the control can never paint a mode the store does not hold — enforced here by DISABLING the
   *  control outright rather than refusing an event; the row's own pill keeps its cancelable-refusal
   *  mechanism unchanged (GH #848's missing-writer posture: render, then refuse, is that control's own). */
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

/** GH #947 — ONE dynamic hint line describing only the CURRENTLY SELECTED state, keyed by
 *  `EntryAvailability` (replacing the old `ui-toggle` pill's single static sentence that named BOTH states
 *  at once — "On: … Off: …" reads fine for a binary pill; a segmented control already shows both options
 *  as its own two labels, so the helper's job narrows to explaining the one that's picked). */
const TIER_HINT: Record<EntryAvailability, string> = {
  [ENTRY_AVAILABILITY.context]: 'In context — the model sees this entry every turn.',
  [ENTRY_AVAILABILITY.invocable]: 'Invocable — inert until invoked from the conversation.',
}

/** The "Built-in" tag's own sentence — the roster drawer's "Shipped" tag shape (agent-admin-app.ts:497),
 *  applied to ADR-0132 Fork 4's rule: configuration is open, deletion is not. */
const BUILTIN_HINT = 'A built-in entry — it can be edited and toggled, but never deleted.'

/** One labelled field cell: `ui-field` (the visible label/description wrapper) around ONE control, the
 *  TKT-0073 precedent this module inherits from the add form it replaces.
 *
 *  GH #947 — `optional` replaces the old `description` string param (which rendered `ui-field`'s own
 *  built-in `[data-part='description']` line — a FREE-FLOATING helper below the control, never beside the
 *  label it was about). No field in this form needs a real description any more, only the one word
 *  "optional" — so this now sets a marker attribute instead and lets `entry-list.css` paint it as a muted
 *  CSS-generated suffix on the label part itself (`ui-field`'s own required-marker shape, field.md's
 *  `[data-part='label']::after`, one rule over — optional beside required, never a fleet-wide default off
 *  requiredness's absence: most fields elsewhere ARE optional too, so this stays this form's own opt-in). */
function fieldCell(label: string, control: HTMLElement, opts?: { optional?: boolean }): UIFieldElement {
  const wrap = document.createElement('ui-field') as UIFieldElement
  wrap.label = label
  if (opts?.optional) wrap.toggleAttribute('data-optional', true)
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

/** GH #947 point 7 — the content editor's own field cell, WITH a live character count. `input` (not
 *  `change`) drives the count: a count that only updated on commit would sit stale for the entire time the
 *  author is typing, which is exactly when a context-budget signal is most useful (ADR-0190's index-line
 *  law names the same "how much am I spending" concern one level up). The count is a plain, non-live
 *  region — `aria-live="off"` — a running announcement on every keystroke would spam assistive tech far
 *  worse than the visible count helps sighted authors; the value is still in the accessible tree for an
 *  on-demand read. Auto-grow-with-a-max-height (the ticket's other content-editor ask) is `entry-list.css`'s
 *  own `max-block-size` cap on `entry-content`/`entry-add-content` — `ui-code-editor`'s `rows` is already a
 *  growable MINIMUM, never a fixed height (ADR-0134), so the editor already grows with typed content; the
 *  cap is the one piece that did not already exist. */
function contentEditorField(part: string, ariaLabel: string, value: string): { field: UIFieldElement; editor: UICodeEditorElement; syncCount(): void } {
  const editor = contentEditor(part, ariaLabel, value)
  const count = document.createElement('p')
  count.setAttribute('data-part', 'entry-content-count')
  count.setAttribute('aria-live', 'off')
  const syncCount = (): void => {
    count.textContent = `${editor.value.length} character${editor.value.length === 1 ? '' : 's'}`
  }
  syncCount()
  editor.addEventListener('input', syncCount)
  const field = fieldCell('Content', editor)
  field.append(count)
  // `syncCount` is also exposed for a PROGRAMMATIC `.value` write (the add form's post-submit reset below) —
  // a scripted value assignment never fires `input` (native <textarea> parity), so the count would
  // otherwise read stale until the next keystroke.
  return { field, editor, syncCount }
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
    // outside `ui-text-field`'s bordered box. A real note element rather than `ui-field`'s control-owned
    // `[data-part='error']` part, because that part is rendered by a scope-owned reactive effect over the
    // ASSOCIATED CONTROL's validity, gated on `userInvalid()` (field.ts's `#renderValidity`) — an author
    // cannot write a `validateNewEntry` verdict into it. Placing the note INSIDE the same `ui-field`
    // (permitted static content, field.md's slots note) lands the message in the same column position it
    // would have had: directly under the name field it is about.
    //
    // `entry-form-error`, NOT `entry-add-error`: a drawered section ALSO carries a standing section-level
    // `entry-add-error` (entry-list.ts — where a library-menu rejection lands, with no form on screen), and
    // two live nodes under one part name would make every query positional. Two nodes, two names.
    const labelField = document.createElement('ui-text-field') as UITextFieldElement
    labelField.required = true
    labelField.setAttribute('data-part', 'entry-add-label')
    const errorNote = document.createElement('p')
    errorNote.setAttribute('data-part', 'entry-form-error')
    errorNote.hidden = true
    const labelCell = fieldCell('Name', labelField)
    labelCell.append(errorNote)

    const descriptionField = document.createElement('ui-text-field') as UITextFieldElement
    descriptionField.setAttribute('data-part', 'entry-add-description')
    const descriptionCell = fieldCell('Description', descriptionField, { optional: true })

    content.append(labelCell, descriptionCell)

    const bodyForm = options.contentField ? contentEditorField('entry-add-content', 'Content', '') : null
    if (bodyForm) content.append(bodyForm.field)

    /** The buffered commit — `entry-list.ts`'s own `submitAdd` law, carried over unchanged: reset + close
     *  ONLY on success, so a rejection keeps every typed field on screen beside the message
     *  (`showAddError` writes it into `errorNote` above) instead of silently discarding it. */
    const submitAdd = (): void => {
      const input: NewEntryInput = { label: labelField.value, description: descriptionField.value, content: bodyForm?.editor.value ?? '' }
      if (!handlers.onAdd(input)) return
      labelField.value = ''
      descriptionField.value = ''
      if (bodyForm) {
        bodyForm.editor.value = ''
        bodyForm.syncCount()
      }
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
  // GH #947 point 4 — the header goes STATIC and kind-derived ("Edit skill"), never a live mirror of the
  // entry's own name: the Name field below is the single name source now. `kind` is already this exact
  // singular lowercase noun ('skill'/'workflow'/'resource'/'tool' — `ENTRY_KINDS`, entries.ts) and the
  // section's own `addLabel` follows the identical "{Verb} {kind}" shape ("Add skill"), so no second
  // per-kind display-name table is needed here. Named deviation: the dialog's OWN accessible name
  // (`aria-labelledby` → this heading) no longer names WHICH entry is open — flagged in the ticket's
  // Findings for the owner, since a screen-reader user now learns the entry by the Name field's value
  // alone, one field down from the dialog's name.
  title.textContent = `Edit ${kind}`

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
      // GH #947 point 4 — the header is now STATIC ("Edit skill"), so a rename no longer touches it; the
      // Name field the author is looking at IS the confirmation (unlike before this point, when the title
      // mirrored the entry's own label — the drawer holds no store subscription, so that mirror was this
      // form's own responsibility, never the store's).
      handlers.onRename?.(entry.id, typed)
    })
  }

  // ── description ─────────────────────────────────────────────────────────────────────────────────────────
  const descriptionField = document.createElement('ui-text-field') as UITextFieldElement
  descriptionField.setAttribute('data-part', 'entry-form-description')
  descriptionField.value = entry.description
  descriptionField.readonly = handlers.onDescriptionChange === undefined
  content.append(fieldCell('Description', descriptionField, { optional: true }))
  descriptionField.addEventListener('change', () => handlers.onDescriptionChange?.(entry.id, descriptionField.value))

  // ── tier ────────────────────────────────────────────────────────────────────────────────────────────────
  // GH #947 point 1 — a two-segment `ui-segmented-control` ("In context | Invocable"), reusing the fleet's
  // existing single-select segmented control (ADR-0095) rather than minting a new one, replacing the
  // ambiguous `ui-toggle` pressed pill (GH #850). Same writer (`onAvailabilityChange`); see that handler's
  // own doc for why the missing-writer posture is now a DISABLED control rather than a refused event.
  if (options.availabilityToggle) {
    const tier = document.createElement('div')
    tier.setAttribute('data-part', 'entry-form-tier')
    const mode = document.createElement('ui-segmented-control') as UISegmentedControlElement
    mode.setAttribute('data-part', 'entry-availability')
    mode.setAttribute('aria-label', `${entry.label} availability`)
    mode.disabled = handlers.onAvailabilityChange === undefined
    const contextSegment = document.createElement('ui-segment')
    contextSegment.setAttribute('value', ENTRY_AVAILABILITY.context)
    contextSegment.textContent = 'In context'
    const invocableSegment = document.createElement('ui-segment')
    invocableSegment.setAttribute('value', ENTRY_AVAILABILITY.invocable)
    invocableSegment.textContent = 'Invocable'
    mode.append(contextSegment, invocableSegment)
    mode.value = entryAvailability(entry)
    const hint = document.createElement('p')
    hint.setAttribute('data-part', 'entry-form-hint')
    hint.textContent = TIER_HINT[entryAvailability(entry)]
    // `change` fires only AFTER the group's own (non-cancelable) commit — radio-group.ts's `#commit` — so
    // `mode.value` here already reads the NEW selection; unlike the old pill (whose `toggle` fired BEFORE
    // `pressed` committed), there is no pre-commit value to derive the "flipping TO" mode from.
    //
    // `event.target !== mode` guards against a real, ORDER-DEPENDENT double-fire: a click first flips the
    // clicked `ui-segment`'s OWN `change` (bubbling, target = the segment), which the group's base-class
    // delegated listener (installed inside ITS `connected()`) re-synthesizes into the group's OWN `change`
    // (`this.emit('change')`, target = the group). Both reach a listener on `mode`; this one is added at
    // BUILD time, before `mode` connects, so it can run BEFORE the group's internal listener has a chance
    // to `stopImmediatePropagation()` the raw segment event — this listener would otherwise fire once on
    // the PRE-commit segment event (reading the STALE value) and again on the real, POST-commit group
    // event. Filtering to `target === mode` keeps only the group's own re-synthesized commit, regardless
    // of listener registration order (found via a real double-write in this ticket's own test).
    mode.addEventListener('change', (event) => {
      if (event.target !== mode) return
      const next = (mode.value ?? ENTRY_AVAILABILITY.context) as EntryAvailability
      hint.textContent = TIER_HINT[next]
      handlers.onAvailabilityChange?.(entry.id, next)
    })
    tier.append(mode, hint)
    content.append(fieldCell('Availability', tier))
  }

  // ── content ─────────────────────────────────────────────────────────────────────────────────────────────
  if (options.contentField) {
    const bodyForm = contentEditorField('entry-content', `${entry.label} content`, entry.content)
    bodyForm.editor.addEventListener('change', () => handlers.onContentChange(entry.id, bodyForm.editor.value))
    content.append(bodyForm.field)
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
