// entry-list.ts — the generic ordered-entry-list UI (ADR-0132 `n1b`/`n1c`): renders one kind's entries in
// order with a per-entry toggle + content editor, plus a shared custom-entry authoring form. Reused
// verbatim by every instantiation (prompt sections + skill/workflow/resource/tool/pattern-source, and
// since ADR-0170 the `catalog` library) — no kind gets its own bespoke list/toggle/author code
// (ADR-0132 cl.1). The per-kind knobs are `EntryListOptions`' `customAdd`/`contentField` (ADR-0170 cl.8,
// both default-true) and the three default-FALSE opt-ins — `rejectOnCollision` (GH #564),
// `availabilityToggle` (GH #850, the per-entry in-context/user-invocable mode control + its at-a-glance row
// marker) and `rename` (GH #848, the per-row display-name edit) — every existing call site omits the opt-in
// ones and renders byte-identically.
//
// The per-entry content editor is `<ui-code-editor language="markdown">` (ADR-0139) — the fleet's
// editable-first markdown source editor (CodeMirror 6, lazy-loaded on the opt-in @agent-ui/code/editor
// subpath). It replaces the plain `<ui-textarea>` these blocks used before: the content is markdown by
// construction (`composeSystemPrompt` renders `## {label}` / `### {label}` blocks), so authors now edit it
// with syntax highlighting. `.value` get/set, `rows`, and the commit-on-`change` (never `input`, blur-with-
// change) timing are byte-identical to the ui-textarea it replaces (ADR-0139 cl.4/cl.6 make this a drop-in
// tag+type swap); `selectToEnd()` carries over as the same mid-edit caret-restoration seam (ADR-0134).
//
// DOM ownership: `mountEntryList` builds the section shell (list host + add-form host — headless since GH #225) ONCE
// and returns a `render(entries)` that rebuilds the list body from scratch on every call — acceptable
// because `render` is only invoked on a genuine entries-array change (add/delete/toggle, or an external
// store notification), never per-keystroke; a content edit commits on ui-code-editor's own `change` (blur),
// not on `input`, matching the fleet's per-field-on-change law (settings.ts's own SPEC-R12 timing).

import type { UIButtonElement } from '@agent-ui/components/controls/button'
import type { UIIconElement } from '@agent-ui/components/controls/icon'
import type { UICodeEditorElement } from '@agent-ui/code/editor'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import type { UIFieldElement } from '@agent-ui/components/controls/field'
import type { UIToggleElement } from '@agent-ui/components/controls/toggle'
import { ENTRY_AVAILABILITY, entryAvailability, slugify } from './entry-data.ts'
import type { Entry, EntryAvailability, EntryLibraryPack, NewEntryInput } from './entry-data.ts'

export interface EntryListHandlers {
  onToggle(id: string, enabled: boolean): void
  onContentChange(id: string, content: string): void
  onDelete(id: string): void
  /** Returns `true` on a successful add, `false` on a fail-closed rejection (component-reviewer MAJOR
   *  fix: the caller needs this to decide whether to reset/hide the form — resetting on a REJECTED
   *  submit silently discarded the typed description/content the user still needs to see and fix.
   *
   *  GH #783/LLD-C5 — an OPTIONAL second argument carries the ADDING PACK's own `rejectOnCollision`
   *  flag through to the caller's one `validateNewEntry` call (the library-menu select handler supplies
   *  it; the hand-author form omits it entirely — byte-identical to before). The return stays the BARE
   *  boolean ADR-0164 cl.3 pins: nothing in this arc is async, and `submitAdd` branches on the raw
   *  return, so a `Promise` would be always-truthy — resetting the form on a rejection, the exact defect
   *  the boolean return exists to prevent. Every existing single-argument implementation stays valid by
   *  TS structural typing (§6.1's non-decision). */
  onAdd(input: NewEntryInput, context?: { rejectOnCollision?: boolean }): boolean
  /** GH #850 / capability-availability-tagging.spec.md SPEC-R2 — the per-entry AVAILABILITY write, called
   *  with the mode the row is being flipped TO. OPTIONAL, the same additive-optional law `EntryListOptions`
   *  follows: absent ⇒ the row's mode control refuses its own flip (`toggle` is cancelable, toggle.md's
   *  refused-toggle mechanism), so an opted-in section with no writer wired can never paint a mode the
   *  store does not hold. Persistence is the CALLER's (this module owns no store access), exactly as
   *  `onToggle` already works.
   *
   *  GH #848 reconciliation — this handler's missing-writer posture (render, then REFUSE the flip)
   *  deliberately differs from `onRename`'s (render NOTHING), and the difference is the affordance's own
   *  nature, not an inconsistency: a mode pill carries STATE the row must show whether or not anything can
   *  change it (`pressed` + the row marker ARE the answer to "is this entry invocable?"), so it renders and
   *  refuses; a rename TRIGGER carries no state at all, so with no writer it could only ever be a button
   *  that fails. Both remain OPT-IN through `EntryListOptions`, and neither can write without its handler. */
  onAvailabilityChange?(id: string, availability: EntryAvailability): void
  /** GH #848 — commit a per-entry DISPLAY-NAME change (`entry-data.ts`'s `renameEntry` is the law; the
   *  caller owns the store write, this module owns the affordance). OPTIONAL, the `onAdd`-second-argument
   *  law: every existing implementation stays valid by TS structural typing, and a section whose handlers
   *  omit it renders no rename affordance at all — byte-identical to before this member existed, even if
   *  `options.rename` is set (a trigger with nothing to commit through is a button that can only fail; see
   *  `onAvailabilityChange` above for why the mode pill's missing-writer posture is the other way round).
   *  `label` arrives RAW (the field's own text): trimming and the empty-label refusal are `renameEntry`'s,
   *  so the law has exactly one home. The entry's `id` is never affected. */
  onRename?(id: string, label: string): void
}

export interface EntryListSection {
  /** The section's own host element — append this into the pane. */
  host: HTMLElement
  /** Rebuild the list body from `entries` (already filtered to this section's own kind by the caller). */
  render(entries: readonly Entry[]): void
  /** GH #143 — replace the add-from-library menu with one built from `libraries` (in place, keeping the
   *  rest of the already-mounted section shell untouched). Empty/absent removes the affordance entirely,
   *  matching the initial "byte-identical when no packs" law. The one part of a section NOT captured by
   *  the `mountEntryList` build-once contract — a caller (`agent-admin.ts`) may call this again whenever
   *  the packs on offer change (e.g. a persona/preset switch re-scoping which packs apply). */
  updateLibraries(libraries: readonly EntryLibraryPack[]): void
  /** GH #419 — show a NON-BLOCKING per-entry notice (`entryId → message`), stamped onto each named
   *  entry's own card and removed from every entry the map omits. Purely presentational: this module
   *  never computes a notice, and nothing about the entries themselves changes. The last map handed in
   *  is remembered and re-applied after any `render`, so a list rebuild (a sibling toggle, an external
   *  store write) cannot silently drop a live notice. */
  showNotices(notices: ReadonlyMap<string, string>): void
}

/** Build one kind's section shell (list + collapsible add-form), once — HEADLESS since GH #225: the
 *  section's label AND its optional master switch both live on the caller's fold heading row now
 *  (agent-admin.ts's `settingsItem` + the switch's `slot="summary"` marking, GH #226/ADR-0158 — the
 *  ui-disclosure summary), so the old
 *  `entry-section-heading` h3 / `entry-section-header` row (vision rev.5) retired with them. `addLabel`
 *  is the add-toggle's own label text ("Add skill") — a bare word, no leading "+" — the toggle supplies
 *  its own leading `plus` icon adornment (TKT-0048), so the literal `+` character no longer belongs in
 *  the string. `handlers` are called on the corresponding user action — this module owns no store
 *  access of its own (the caller wires persistence, matching `agent-admin.ts`'s existing seam). */
export interface EntryListOptions {
  /** GH #47/#48 — packs offered by the add-from-library menu. Absent/empty ⇒ the affordance does not
   *  render at all (byte-identical section shell to before the option existed). */
  libraries?: readonly EntryLibraryPack[]
  /** ADR-0170 cl.8 — render the custom-entry AUTHORING affordances (the add-toggle button + its form).
   *  Default `true`: absent ⇒ byte-identical to before this option existed. `false` suppresses BOTH; the
   *  library menu is unaffected (it commits through `handlers.onAdd` directly, never through the form).
   *  Suppressed for a kind whose entries key an EXTERNAL registry — there is nothing meaningful to
   *  author, and a form that looks like "create one" would mint an id the registry does not know. This
   *  is the named seam a future create-a-catalog affordance re-opens. */
  customAdd?: boolean
  /** ADR-0170 cl.8 — render the per-entry CONTENT editor on each row. Default `true`: absent ⇒
   *  byte-identical. `false` renders rows as label + description + switch; the mid-edit preservation path
   *  below is then inert by construction (there is no content field to preserve). */
  contentField?: boolean
  /** GH #564 — `true` for a kind whose entry id is a FOREIGN KEY into an external registry (the catalog
   *  kind), matching the SAME flag the caller hands `validateNewEntry` (entry-data.ts's own
   *  `ValidateNewEntryOptions`). Default `false`/absent ⇒ byte-identical: the add-from-library picker never
   *  disables a row. `true` ALSO disables (never hides — the user can see WHY) any pack row whose id
   *  already sits in the current list — a collision there is a genuine duplicate the caller's `onAdd`
   *  rejects outright, so the row is unreachable from the picker too, not just refused on commit. */
  rejectOnCollision?: boolean
  /** GH #850 / capability-availability-tagging.spec.md SPEC-R2 — render the per-entry AVAILABILITY control
   *  (in-context vs user-invocable) on each row, plus the row's at-a-glance `data-availability` marker.
   *  OPT-IN, like `rejectOnCollision`: absent/false ⇒ byte-identical render for every existing caller
   *  (`prompt-section`, `pattern-source` and `catalog` sections never show it — availability semantics are
   *  defined for the four capability kinds alone, SPEC-R1). The writer is `EntryListHandlers`'
   *  `onAvailabilityChange`; a `builtin` entry's mode is as editable as its `enabled` toggle (ADR-0132
   *  Fork 4 protects deletion, not configuration). */
  availabilityToggle?: boolean
  /** GH #848 — render the per-entry RENAME affordance on each row (a display-name edit; the entry's `id` is
   *  never rewritten). OPT-IN, the same `rejectOnCollision`/`availabilityToggle` law rather than the
   *  `customAdd`/`contentField` one: absent/`false` ⇒ byte-identical rows for every existing caller, so the
   *  kinds whose names are NOT free human text keep them (agent-admin flags only its four capability kinds —
   *  a `prompt-section` label is the composed prompt's own `## {label}` heading, and a `catalog` label
   *  mirrors the registry entry the row keys). Also requires `handlers.onRename` (see that handler's doc for
   *  why a missing writer hides this affordance while it only REFUSES the mode pill's flip). Independent of
   *  `builtin` — ADR-0132 Fork 4 protects DELETION, not configuration (the `enabled` toggle and the mode
   *  pill a builtin row already carry are the precedent). */
  rename?: boolean
}

export function mountEntryList(kind: string, addLabel: string, handlers: EntryListHandlers, options?: EntryListOptions): EntryListSection {
  // ADR-0170 cl.8 — both default TRUE: an options bag that omits them renders exactly as before.
  const withCustomAdd = options?.customAdd !== false
  const withContentField = options?.contentField !== false
  // GH #564 — opt-in, unlike the two above: an options bag that omits it renders exactly as before for
  // every kind except the one that flags it.
  const rejectOnCollision = options?.rejectOnCollision === true
  // GH #850/SPEC-R2 — opt-in the same way: absent ⇒ no mode control, no row marker, byte-identical render.
  const withAvailability = options?.availabilityToggle === true
  // GH #848 — opt-in too, and doubly gated: the OPTION says this kind's names are free human text, the
  // HANDLER is what a commit rides. Either one missing ⇒ no rename affordance (byte-identical rows). The
  // second gate is this affordance's own (see `onRename`'s doc) — `withAvailability` needs no handler gate
  // because its control has state to show regardless, and refuses its flip instead.
  const withRename = options?.rename === true && handlers.onRename !== undefined

  const section = document.createElement('div')
  section.setAttribute('data-part', 'entry-section')
  section.setAttribute('data-kind', kind)

  const list = document.createElement('div')
  list.setAttribute('data-part', 'entry-list')
  section.append(list)

  // TKT-0048: a real `<ui-button>` instead of a bespoke `<button>` with one flat text node — the old
  // shape glued a literal "+" character straight onto the label with no controlled spacing. `ui-button`'s
  // `slot="leading"` adornment cell (button.css, ADR-0006/ADR-0012) gets the real, token-driven gap; the
  // toast.ts close-button is the precedent for this exact `<ui-button><ui-icon slot="leading"
  // data-role="icon">…</ui-button>` shape.
  const addToggle = document.createElement('ui-button') as UIButtonElement
  addToggle.setAttribute('variant', 'soft')
  addToggle.setAttribute('data-part', 'entry-add-toggle')
  const addIcon = document.createElement('ui-icon') as UIIconElement
  addIcon.setAttribute('slot', 'leading')
  addIcon.setAttribute('data-role', 'icon')
  addIcon.setAttribute('glyph', 'plus')
  addToggle.append(addIcon, addLabel)
  if (withCustomAdd) section.append(addToggle) // ADR-0170 cl.8 — suppressed ⇒ no authoring affordance mounts

  // GH #47/#48 — the add-from-library affordance: a ui-menu of pack entries, committed through the SAME
  // validated `onAdd` path as the hand-authoring form below (a library add IS a custom add with the
  // typing done — slug-dedup and ordering come for free, and a rejection surfaces via the same
  // `showAddError` note). Renders ONLY when packs were handed in; the section shell is byte-identical
  // otherwise. Rows carry `data-value="packId:index"` (the menu's commit payload) and the entry's
  // description as their tooltip.
  //
  // GH #143 — extracted to a factory (`buildLibraryMenu`) so `updateLibraries` can rebuild JUST this menu
  // in place (swap it for a fresh one built from a new pack list) without touching the rest of the
  // already-mounted section shell — the seam that lets a caller re-scope which packs a section offers
  // (e.g. per agent preset/persona) after the section is built.
  function buildLibraryMenu(libs: readonly EntryLibraryPack[]): HTMLElement {
    const libraryMenu = document.createElement('ui-menu')
    libraryMenu.setAttribute('data-part', 'entry-library-menu')
    const libraryTrigger = document.createElement('ui-button') as UIButtonElement
    libraryTrigger.setAttribute('variant', 'soft')
    // NO bespoke data-part on the trigger — ui-menu's #ensureParts unconditionally stamps its first
    // child `data-part="trigger"` (menu.ts), so any value set here is clobbered at connect (PR #58
    // review finding). Scope queries through the MENU's own marker instead:
    // `[data-part='entry-library-menu'] [data-part='trigger']`.
    const libraryIcon = document.createElement('ui-icon') as UIIconElement
    libraryIcon.setAttribute('slot', 'leading')
    libraryIcon.setAttribute('data-role', 'icon')
    libraryIcon.setAttribute('glyph', 'plus')
    libraryTrigger.append(libraryIcon, 'From library')
    libraryMenu.append(libraryTrigger)

    for (const pack of libs) {
      for (const [index, entry] of pack.entries.entries()) {
        const row = document.createElement('div')
        row.dataset.value = `${pack.id}:${index}`
        // GH #564 — a `rejectOnCollision` kind (the catalog's foreign-key id) can never actually commit a
        // pack entry whose id already sits in the list; predict the id the SAME way `validateNewEntry`
        // would (`slugify` is the fallback when the pack omits an explicit `id`) and DISABLE the row —
        // never hide it (ui-menu's own `aria-disabled` precedent, the conversation-composer.ts "coming
        // soon" idiom) — so the author sees WHY a click would do nothing instead of a click that just does
        // nothing.
        // GH #783/LLD-C5 — the disable honors the kind-level flag OR this PACK's own `rejectOnCollision`,
        // so a foreign-key pack offered under an ordinary kind (the S4 services pack) disables its
        // already-added rows just as the catalog KIND does.
        const wouldBeId = entry.id?.trim() ? entry.id.trim() : slugify(entry.label)
        const alreadyPresent = (rejectOnCollision || pack.rejectOnCollision === true) && currentEntries.some((e) => e.id === wouldBeId)
        row.textContent = alreadyPresent ? `${entry.label} — ${pack.label} (already added)` : `${entry.label} — ${pack.label}`
        row.title = entry.description
        if (alreadyPresent) row.setAttribute('aria-disabled', 'true')
        libraryMenu.append(row)
      }
    }

    libraryMenu.addEventListener('select', (event) => {
      const { value } = (event as CustomEvent<{ value: string; index: number }>).detail
      const splitAt = value.lastIndexOf(':')
      const pack = libs.find((p) => p.id === value.slice(0, splitAt))
      const entry = pack?.entries[Number(value.slice(splitAt + 1))]
      if (!entry) return
      // Mirror submitAdd's contract (PR #58 review finding): `onAdd` returning false is a fail-closed
      // rejection the CALLER surfaces via `showAddError` (which un-hides the add-form's error note) —
      // there is nothing to reset here, but the return must not be silently discarded: a rejected
      // library entry (e.g. a pack shipping an empty label) shows the same visible note the
      // hand-authored path shows, proven by the rejection test.
      //
      // GH #783/LLD-C5 — forward the ADDING PACK's own `rejectOnCollision` as `onAdd`'s optional context,
      // so the caller's ONE `validateNewEntry` call rejects a foreign-key duplicate even for a pack under
      // an ordinary kind. An unflagged pack forwards `undefined` — byte-identical to the pre-#783 call.
      void handlers.onAdd(entry, pack?.rejectOnCollision === true ? { rejectOnCollision: true } : undefined)
    })

    return libraryMenu
  }

  let libraryMenu: HTMLElement | null = null
  let currentLibraries: readonly EntryLibraryPack[] = options?.libraries ?? []
  // GH #564 — the picker's own live view of "what's already in the list", kept fresh by `render` below so
  // `buildLibraryMenu`'s per-row disabled check (a `rejectOnCollision` kind only) never goes stale after
  // an add/delete.
  let currentEntries: readonly Entry[] = []

  /** GH #143/#564 — rebuild the library menu from `currentLibraries`, in place: the ONE mechanism both
   *  `updateLibraries` (a caller-driven pack-list change) and `render` (GH #564 — an entries change, for a
   *  `rejectOnCollision` kind's disabled-row refresh) drive, and the initial build below. `addForm`
   *  (mounted after wherever a library menu lands) is the stable insertion anchor — a library menu, when
   *  present, always sits immediately before it, so re-inserting there preserves the section's visual
   *  order (heading → list → add-toggle → [library menu] → add-form) on every call, first build included.
   *  ADR-0170 cl.8: with `customAdd: false` that anchor is not mounted at all and the menu is the LAST
   *  child, so a plain append reproduces the same order. */
  function refreshLibraryMenu(): void {
    libraryMenu?.remove()
    libraryMenu = currentLibraries.length > 0 ? buildLibraryMenu(currentLibraries) : null
    if (!libraryMenu) return
    if (addForm.parentNode === section) section.insertBefore(libraryMenu, addForm)
    else section.append(libraryMenu)
  }

  // TKT-0060: a plain container, not a native `<form>` — a `<ui-button>` submit control cannot become a
  // form's default button (not form-associated the way a native `<button>` is), so the HTML implicit-
  // submission algorithm was never actually available to this form once entry-add-submit converted; wiring
  // submission manually below (click + an explicit Enter handler on the label field) replaces it exactly,
  // without the native-form/native-input dependency TKT-0048 deferred converting this anatomy over.
  const addForm = document.createElement('div')
  addForm.setAttribute('data-part', 'entry-add-form')
  addForm.hidden = true

  // TKT-0073: wrapped in `<ui-field>` (the forms.ts/form-provider-demo.ts precedent) so the required
  // field's validation message renders in the field's OWN error part — outside `ui-text-field`'s
  // bordered box — instead of `ui-text-field`'s internal pre-`ui-field` fallback message, which shares
  // that box with the placeholder and visibly collided with it.
  const labelField = document.createElement('ui-text-field') as UITextFieldElement
  labelField.required = true
  labelField.setAttribute('data-part', 'entry-add-label')
  const labelFieldWrap = document.createElement('ui-field') as UIFieldElement
  labelFieldWrap.label = 'Name'
  labelFieldWrap.append(labelField)

  const descriptionField = document.createElement('ui-text-field') as UITextFieldElement
  descriptionField.setAttribute('data-part', 'entry-add-description')
  const descriptionFieldWrap = document.createElement('ui-field') as UIFieldElement
  descriptionFieldWrap.label = 'Description'
  descriptionFieldWrap.description = 'Optional'
  descriptionFieldWrap.append(descriptionField)

  const contentField = document.createElement('ui-code-editor') as UICodeEditorElement
  contentField.language = 'markdown' // ADR-0139 — markdown-highlighted source editing (CM lazy-loaded)
  contentField.placeholder = 'Content'
  contentField.rows = 2 // TKT-0049: a compose/draft field — the smaller of the two content sizes
  contentField.setAttribute('data-part', 'entry-add-content')

  // TKT-0048/TKT-0060: a real `<ui-button>`, same shape as `addToggle`/`deleteBtn` above.
  const submitBtn = document.createElement('ui-button') as UIButtonElement
  submitBtn.setAttribute('variant', 'soft')
  submitBtn.setAttribute('data-part', 'entry-add-submit')
  submitBtn.textContent = 'Add'

  const errorNote = document.createElement('p')
  errorNote.setAttribute('data-part', 'entry-add-error')
  errorNote.hidden = true

  addForm.append(labelFieldWrap, descriptionFieldWrap, contentField, submitBtn, errorNote)
  if (withCustomAdd) section.append(addForm)

  refreshLibraryMenu() // the initial build — see `refreshLibraryMenu`'s own doc comment below

  addToggle.addEventListener('click', () => {
    addForm.hidden = !addForm.hidden
    if (!addForm.hidden) labelField.focus()
  })

  function submitAdd(): void {
    const input: NewEntryInput = { label: labelField.value, description: descriptionField.value, content: contentField.value }
    const succeeded = handlers.onAdd(input)
    // Reset/hide ONLY on success (component-reviewer MAJOR fix) — a rejection keeps every typed field
    // AND the form open, so the author sees their own input alongside `showAddError`'s message instead
    // of having it silently discarded. `showAddError` (below) is the ONLY thing that un-hides the form
    // on a rejection now — this function no longer fights it by re-hiding on every submit.
    if (succeeded) {
      labelField.value = ''
      descriptionField.value = ''
      contentField.value = ''
      addForm.hidden = true
    }
  }

  submitBtn.addEventListener('click', submitAdd)
  // Native single-line `<input>` Enter-to-submit parity for the one required field — deliberately NOT
  // wired on `descriptionField`/`contentField` (optional field / multi-line field, matching what the old
  // native form's implicit submission would not have keyed off). `isComposing` guards an IME candidate-
  // confirming Enter the same way `ui-text-field`'s own internal Enter handler already does.
  labelField.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return
    submitAdd()
  })

  function render(entries: readonly Entry[]): void {
    // GH #564 — refresh the picker's live "already in the list" view BEFORE anything below reads it (a
    // `rejectOnCollision` kind's disabled-row refresh, at the end of this function).
    currentEntries = entries
    // Component-reviewer MAJOR fix: a SIBLING entry's action (toggle/delete/add on a DIFFERENT entry in
    // this same list) re-renders the whole list via the store's subscribe notification — a full
    // `replaceChildren()` would otherwise silently discard whatever uncommitted (not-yet-`change`d) text
    // sits in a content field the author is actively mid-edit in. Capture that field's identity + LIVE
    // value BEFORE the rebuild, restore it (value + focus) onto the new row for the SAME entry id after.
    const active = document.activeElement
    // `list.contains(active)` scopes this to THIS section's own list — without it, two different
    // sections whose entries happen to share an id (e.g. a Skill and a Workflow both slugified to
    // "deploy") could cross-contaminate: a focused field in one section's row would get its value
    // and focus stolen into the OTHER section's same-id row on that section's own re-render.
    const activeRow = active?.closest('[data-part="entry"]') as HTMLElement | null
    const activeId = activeRow !== null && list.contains(active) ? (activeRow.getAttribute('data-entry-id') ?? undefined) : undefined
    // `ui-code-editor`'s focused DOM node is an INTERNAL surface — the plain `[data-part="editor"]` part or,
    // once CodeMirror enhances, its `.cm-content` inside `[data-part="cm"]` — never the host the
    // `entry-content` data-part lives on; `.closest()` walks up from any of them to the host either way.
    const activeField = active?.closest('[data-part="entry-content"]') as UICodeEditorElement | null
    const preservedValue = activeId !== undefined && activeField !== null ? activeField.value : undefined

    list.replaceChildren()
    const sorted = [...entries].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    for (const entry of sorted) {
      const row = document.createElement('div')
      row.setAttribute('data-part', 'entry')
      row.setAttribute('data-entry-id', entry.id)
      row.toggleAttribute('data-builtin', entry.builtin)
      // GH #850/SPEC-R2 — the AT-A-GLANCE row marker: the resolved mode (read-time default, so a
      // field-less entry stamps `context`) on the row itself, which entry-list.css paints as a visibly
      // distinct card edge for `invocable`. Stamped ONLY for an opted-in section, so every existing
      // caller's row attribute set is byte-identical (AC1).
      if (withAvailability) row.setAttribute('data-availability', entryAvailability(entry))

      const header = document.createElement('div')
      header.setAttribute('data-part', 'entry-header')

      // GH #138 (row-pattern standardization, Kim's option-A ruling): switch leads, label next, a
      // flexible spacer, then trailing action content (the Remove button) pinned to the right edge.
      const toggle = document.createElement('ui-switch') as HTMLElement & { checked: boolean }
      toggle.setAttribute('data-part', 'entry-toggle')
      toggle.setAttribute('aria-label', `${entry.label} enabled`)
      toggle.checked = entry.enabled
      toggle.addEventListener('change', () => handlers.onToggle(entry.id, toggle.checked))

      const entryLabel = document.createElement('span')
      entryLabel.setAttribute('data-part', 'entry-label')
      entryLabel.textContent = entry.label

      const entrySpacer = document.createElement('span')
      entrySpacer.setAttribute('data-part', 'entry-spacer')

      header.append(toggle, entryLabel, entrySpacer)

      // The trailing action cluster's ORDER, ruled once here so the next affordance knows where to land
      // (GH #848 reconciling with GH #850, which landed the mode pill first): STATE reads before ACTIONS,
      // and the destructive action stays last — `[switch | label | spacer | Invocable | Rename | Remove]`.
      // The leading `enabled` switch and the `Invocable` pill are the row's two state controls (they answer
      // "is this on?" / "how is it reachable?"); `Rename` and `Remove` are its two buttons, kept adjacent so
      // the cluster reads as one pair rather than a button, a chip, and another button. DOM order IS tab
      // order here (no tabindex anywhere in this row), so a keyboard user reaches configuration before
      // deletion.
      // GH #850/SPEC-R2 — the per-entry MODE control: a `ui-toggle` pressed pill in the row's trailing
      // action cluster (ADR-0179 S7-a's own primitive — the fleet's pressed-button toggle, aria-pressed via
      // internals). `pressed` IS the mode: on ⇒ user-invocable, off ⇒ in-context (ambient). The visible
      // label stays the STABLE word "Invocable" — the state rides `aria-pressed`, never a swapped name (a
      // label that changes with state is the toggle-button AX anti-pattern); the per-row `aria-label` is
      // the same `${entry.label} …` shape the enabled switch above already carries.
      if (withAvailability) {
        const invocable = entryAvailability(entry) === ENTRY_AVAILABILITY.invocable
        const mode = document.createElement('ui-toggle') as UIToggleElement
        mode.setAttribute('data-part', 'entry-availability')
        mode.setAttribute('aria-label', `${entry.label} user-invocable`)
        mode.title = 'On: user-invocable — inert until invoked from the conversation. Off: in context — the model sees it every turn.'
        mode.pressed = invocable
        mode.append('Invocable')
        // toggle.md's refused-toggle contract: `toggle` fires BEFORE `pressed` commits and is cancelable.
        // No writer wired ⇒ refuse the flip outright, so the pill can never paint a mode no store holds.
        // With a writer, the caller's store write re-renders this list (the cl.5 live-apply idiom), which
        // rebuilds this row from the fresh value — toggle.ts's own post-listener `pressed` flip lands on
        // the by-then-detached element, so the two can never disagree (the `#panePills` double-flip lesson,
        // avoided here by never writing `pressed` from inside the listener).
        mode.addEventListener('toggle', (event) => {
          const write = handlers.onAvailabilityChange
          if (write === undefined) {
            event.preventDefault()
            return
          }
          write(entry.id, invocable ? ENTRY_AVAILABILITY.context : ENTRY_AVAILABILITY.invocable)
        })
        header.append(mode)
      }

      // GH #848 — the per-entry RENAME affordance (display name only; `entry.id` is never rewritten, so
      // every foreign-key id — a registry id, an ADR-0185 namespaced service ref — keeps resolving).
      // Anatomy: the "Rename" trigger swaps the label span for an inline `ui-text-field` IN PLACE, and the
      // field swaps back on commit or cancel. All of that state is the ROW's own (one closure local below,
      // born and buried with this row) — deliberately NOT section-level bookkeeping: a `render` rebuild
      // throws the row away, so an open rename cannot outlive its entry or leak onto a re-rendered sibling
      // (the cross-contamination the content field's own `list.contains(active)` guard exists to prevent).
      // The trade this accepts: an EXTERNAL re-render mid-rename (a sibling toggle, a store write) drops an
      // uncommitted rename. That is the deliberate asymmetry with the content editor's mid-edit
      // preservation dance — a content field holds long-form authored prose worth rescuing; a rename holds
      // a few characters, and the label it replaces is still on screen a keystroke later.
      if (withRename) {
        let renameField: UITextFieldElement | null = null

        /** Swap the field back out for the label span — the ONE close path (commit and cancel share it).
         *
         *  RE-ENTRANT BY CONSTRUCTION, and that is load-bearing (a real-engine failure, chromium + webkit
         *  both): detaching the field removes the focused editor inside it, and the engine fires that
         *  editor's `blur`/`focusout` SYNCHRONOUSLY, from inside this very `replaceWith` call — so the
         *  focusout listener below re-enters here mid-swap and threw `NotFoundError: the node to be removed
         *  is no longer a child of this node`. Clearing the state BEFORE mutating the DOM makes the nested
         *  call a no-op; the `parentNode` check keeps it safe even if something else detached the field
         *  first (an external `render` rebuild while a rename was open). */
        const closeRename = (): void => {
          const field = renameField
          if (field === null) return
          renameField = null
          if (field.parentNode !== null) field.replaceWith(entryLabel)
        }

        const renameBtn = document.createElement('ui-button') as UIButtonElement
        renameBtn.setAttribute('variant', 'soft')
        // TKT-0048's law, the `deleteBtn` shape verbatim: a real `<ui-button>` whose label is a plain word
        // ("Rename"), no glued glyph — so no leading-adornment icon, and the shared state-styling contract
        // (hover/active/focus-ring) comes for free.
        renameBtn.setAttribute('data-part', 'entry-rename')
        renameBtn.textContent = 'Rename'
        renameBtn.addEventListener('click', () => {
          if (renameField !== null) {
            renameField.focus() // already open (a second click on the trigger) — refocus, never a second field
            return
          }
          const field = document.createElement('ui-text-field') as UITextFieldElement
          field.setAttribute('data-part', 'entry-rename-field')
          // ui-text-field's `label` prop IS its labelling seam (→ the editor's aria-label, text-field.ts's
          // own ADR-0051 note) — the `${entry.label} enabled` switch idiom above, one row over.
          field.label = `${entry.label} name`
          field.value = entry.label
          renameField = field
          entryLabel.replaceWith(field)
          // Focus only lands once the field's own render effect has built its editor part (`focus()`
          // forwards to it) — the SAME already-connected/already-flushed discipline the content field's
          // `selectToEnd()` restoration below documents.
          void field.updateComplete.then(() => field.focus())

          /** Commit whatever the field holds. The OPEN-state guard is what makes Escape a real cancel:
           *  closing the field un-focuses its editor, whose `blur` then emits ui-text-field's own
           *  change-on-blur-with-change — arriving here AFTER the cancel already cleared the state, so a
           *  dismissed rename can never write (measured: without this guard, Escape committed the very text
           *  the user was backing out of). The same guard makes a commit-then-blur pair idempotent. */
          const commitRename = (): void => {
            if (renameField !== field) return
            const typed = field.value
            closeRename()
            // The empty case is a DISPLAY decision, not a second copy of the validation law: the label span
            // is back with the STORED name, which is exactly the visible refusal (`renameEntry` still owns
            // the trim and the empty-label no-op). A real rename shows immediately and the caller's
            // re-render then confirms it from the store — the `onToggle` posture (the switch moves, the
            // re-render is the truth).
            if (typed.trim().length === 0) return
            entryLabel.textContent = typed.trim()
            handlers.onRename?.(entry.id, typed)
          }

          // `change`, never `input`: ui-text-field commits on Enter or blur-with-change (text-field.ts's
          // own baseline-gated pair) — the fleet's per-field-on-change law this whole section follows.
          field.addEventListener('change', commitRename)
          field.addEventListener('keydown', (event) => {
            if ((event as KeyboardEvent).key !== 'Escape') return
            // Local cancel: swallow it so an ancestor (a ui-disclosure fold, a menu) never also acts on the
            // same Escape — the rename is what the user is dismissing.
            event.stopPropagation()
            closeRename()
          })
          // A blur that changed NOTHING fires no `change` at all — close anyway, so the row never keeps a
          // stale open field. A blur that DID change the text already committed through `change` (dispatched
          // ahead of focusout) and cleared the state, which the guard sees; focus moving WITHIN the field is
          // not a close.
          field.addEventListener('focusout', (event) => {
            if (renameField !== field) return
            if (field.contains((event as FocusEvent).relatedTarget as Node | null)) return
            closeRename()
          })
        })
        header.append(renameBtn)
      }

      if (!entry.builtin) {
        // TKT-0048: a real `<ui-button>` — its label is a plain word ("Remove"), never a glued glyph, so
        // no leading-adornment icon is needed here; the fix this control gets is the shared state-styling
        // contract (hover/active/focus-ring) the bespoke native button opted out of entirely.
        const deleteBtn = document.createElement('ui-button') as UIButtonElement
        deleteBtn.setAttribute('variant', 'soft')
        deleteBtn.setAttribute('data-part', 'entry-delete')
        deleteBtn.textContent = 'Remove'
        deleteBtn.addEventListener('click', () => handlers.onDelete(entry.id))
        header.append(deleteBtn)
      }

      row.append(header)

      if (entry.description.length > 0) {
        const desc = document.createElement('p')
        desc.setAttribute('data-part', 'entry-description')
        desc.textContent = entry.description
        row.append(desc)
      }

      // ADR-0170 cl.8 — a kind whose entries key an EXTERNAL registry renders label + description +
      // switch only: there is no per-entry body to edit, so no editor mounts (and the preservation dance
      // above is inert by construction — `activeField` can never match a field that does not exist).
      const contentField = withContentField ? (document.createElement('ui-code-editor') as UICodeEditorElement) : null
      if (contentField) {
        contentField.language = 'markdown' // ADR-0139 — markdown-highlighted source editing (CM lazy-loaded)
        contentField.rows = 4 // TKT-0049: the saved, potentially longer per-entry content — bigger than the add-form's draft field
        contentField.setAttribute('data-part', 'entry-content')
        contentField.setAttribute('aria-label', `${entry.label} content`)
        // Restore an in-progress, uncommitted edit for THIS entry (captured above) rather than the
        // possibly-stale `entry.content` from the store — the whole point of the preservation above.
        contentField.value = entry.id === activeId && preservedValue !== undefined ? preservedValue : entry.content
        contentField.addEventListener('change', () => handlers.onContentChange(entry.id, contentField.value))
        row.append(contentField)
      }
      list.append(row)

      // Focusing only works once `contentField` is actually connected to the document — calling
      // `.focus()` before `list.append(row)` is a silent no-op in real browsers (the element isn't
      // part of the rendered tree yet), which is what let this ship broken past the jsdom leg.
      // `selectToEnd()` (ADR-0134's migration seam) focuses the editor part AND collapses the caret to the
      // end in one call — the ui-textarea-friendly equivalent of the native
      // `.focus()` + `.setSelectionRange(len, len)` pair a contenteditable host does not expose.
      // component-reviewer MINOR fix: the `.value =` write above lands its model→surface sync
      // asynchronously (the render effect), so calling `selectToEnd()` synchronously here would
      // collapse the range against a not-yet-populated editor (`selectNodeContents` on an empty node
      // caret-collapses to 0, not the end) — focus alone still lands (verified in the cross-engine
      // suite), but the caret position wouldn't. Await the flush first.
      if (contentField && entry.id === activeId && preservedValue !== undefined) {
        void contentField.updateComplete.then(() => contentField.selectToEnd())
      }
    }
    applyNotices() // GH #419 — a rebuild must not drop a live notice (the map outlives any one render)
    // GH #564 — a `rejectOnCollision` kind's add/delete just changed what's "already in the list"; rebuild
    // the picker so a newly-collided row disables (or a deleted one re-enables), never a stale menu. Gated
    // on the flag so every other kind's render stays exactly as before (no picker rebuild at all).
    // GH #783/LLD-C5 — the gate also fires when ANY offered PACK carries its own `rejectOnCollision`, so a
    // foreign-key pack under an ordinary kind (the S4 services pack, whose kind flag is false) keeps its
    // disabled rows live across an add/delete too — the same signal the catalog kind gets. A section with
    // neither flag never rebuilds its picker on render: byte-identical to before.
    if (rejectOnCollision || currentLibraries.some((p) => p.rejectOnCollision === true)) refreshLibraryMenu()
  }

  // GH #419 — the non-blocking per-entry notice. Kept OUT of the row-building loop above so it can also
  // land (and clear) without a rebuild: a Surface Options toggle changes no entry, so re-rendering the
  // whole list to show a hint would throw away every uncommitted mid-edit content field for nothing.
  let notices: ReadonlyMap<string, string> = new Map()

  function applyNotices(): void {
    for (const row of list.querySelectorAll<HTMLElement>('[data-part="entry"]')) {
      const message = notices.get(row.getAttribute('data-entry-id') ?? '')
      const existing = row.querySelector('[data-part="entry-notice"]')
      if (message === undefined) {
        existing?.remove()
        continue
      }
      if (existing !== null) {
        existing.textContent = message
        continue
      }
      const note = document.createElement('p')
      note.setAttribute('data-part', 'entry-notice')
      // `role="status"` (not `alert`): a hint about text the author is looking at, announced politely —
      // never an interruption, matching the non-blocking law this notice ships under.
      note.setAttribute('role', 'status')
      note.textContent = message
      // Directly under the header, ABOVE the content it is about — the author reads the warning before
      // the text it names (the `entry-description` position, which the notice sits beside).
      row.querySelector('[data-part="entry-header"]')?.after(note)
    }
  }

  function showNotices(next: ReadonlyMap<string, string>): void {
    notices = next
    applyNotices()
  }

  /** GH #143 — swap the library menu for one built from `libraries`, in place — see `refreshLibraryMenu`'s
   *  own doc comment above for the mechanics; this just points it at a new pack list. */
  function updateLibraries(libraries: readonly EntryLibraryPack[]): void {
    currentLibraries = libraries
    refreshLibraryMenu()
  }

  return { host: section, render, updateLibraries, showNotices }
}

/** Show `message` in the add-form's own error note (fail-closed validation feedback, ADR-0132 cl.4) —
 *  exported so `agent-admin.ts` can surface `validateNewEntry`'s rejection without this module owning
 *  the validation call itself (the caller decides WHEN to validate; this module only renders the result).
 *  ADR-0170 cl.8: a section built with `customAdd: false` mounts no form to show it in — a rejected
 *  LIBRARY add there is a silent no-op rather than a thrown null-deref (the add path itself already
 *  fail-closes; this is the display half having nowhere to land). */
export function showAddError(section: EntryListSection, message: string): void {
  const note = section.host.querySelector('[data-part="entry-add-error"]') as HTMLElement | null
  const form = section.host.querySelector('[data-part="entry-add-form"]') as HTMLElement | null
  if (note === null || form === null) return
  note.textContent = message
  note.hidden = false
  form.hidden = false
}
