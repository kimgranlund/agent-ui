// entry-list.ts — the generic ordered-entry-list UI (ADR-0132 `n1b`/`n1c`): renders one kind's entries in
// order with a per-entry toggle + content editor, plus a shared custom-entry authoring form. Reused
// verbatim by all FIVE instantiations (prompt sections + skill/workflow/resource/tool) — no kind gets
// its own bespoke list/toggle/author code (ADR-0132 cl.1).
//
// The per-entry content editor is `<ui-code-editor language="markdown">` (ADR-0139) — the fleet's
// editable-first markdown source editor (CodeMirror 6, lazy-loaded on the opt-in @agent-ui/code/editor
// subpath). It replaces the plain `<ui-textarea>` these blocks used before: the content is markdown by
// construction (`composeSystemPrompt` renders `## {label}` / `### {label}` blocks), so authors now edit it
// with syntax highlighting. `.value` get/set, `rows`, and the commit-on-`change` (never `input`, blur-with-
// change) timing are byte-identical to the ui-textarea it replaces (ADR-0139 cl.4/cl.6 make this a drop-in
// tag+type swap); `selectToEnd()` carries over as the same mid-edit caret-restoration seam (ADR-0134).
//
// DOM ownership: `mountEntryList` builds the section shell (heading + list host + add-form host) ONCE
// and returns a `render(entries)` that rebuilds the list body from scratch on every call — acceptable
// because `render` is only invoked on a genuine entries-array change (add/delete/toggle, or an external
// store notification), never per-keystroke; a content edit commits on ui-code-editor's own `change` (blur),
// not on `input`, matching the fleet's per-field-on-change law (settings.ts's own SPEC-R12 timing).

import type { UIButtonElement } from '@agent-ui/components/controls/button'
import type { UIIconElement } from '@agent-ui/components/controls/icon'
import type { UICodeEditorElement } from '@agent-ui/code/editor'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import type { UIFieldElement } from '@agent-ui/components/controls/field'
import type { Entry, EntryLibraryPack, NewEntryInput } from './entries.ts'

export interface EntryListHandlers {
  onToggle(id: string, enabled: boolean): void
  onContentChange(id: string, content: string): void
  onDelete(id: string): void
  /** Returns `true` on a successful add, `false` on a fail-closed rejection (component-reviewer MAJOR
   *  fix: the caller needs this to decide whether to reset/hide the form — resetting on a REJECTED
   *  submit silently discarded the typed description/content the user still needs to see and fix. */
  onAdd(input: NewEntryInput): boolean
}

export interface EntryListSection {
  /** The section's own host element — append this into the pane. */
  host: HTMLElement
  /** Rebuild the list body from `entries` (already filtered to this section's own kind by the caller). */
  render(entries: readonly Entry[]): void
}

/** Build one kind's section shell (heading + list + collapsible add-form), once. `kindLabel` is the
 *  plural display name ("Skills", "Workflows", ...); `addLabel` is the add-toggle's own label text
 *  ("Add skill") — a bare word, no leading "+" — the toggle supplies its own leading `plus` icon
 *  adornment (TKT-0048), so the literal `+` character no longer belongs in the string. `handlers` are
 *  called on the corresponding user action — this module owns no store access of its own (the caller
 *  wires persistence, matching `agent-admin.ts`'s existing seam). */
export interface EntryListOptions {
  /** GH #47/#48 — packs offered by the add-from-library menu. Absent/empty ⇒ the affordance does not
   *  render at all (byte-identical section shell to before the option existed). */
  libraries?: readonly EntryLibraryPack[]
}

export function mountEntryList(kind: string, kindLabel: string, addLabel: string, handlers: EntryListHandlers, options?: EntryListOptions): EntryListSection {
  const section = document.createElement('div')
  section.setAttribute('data-part', 'entry-section')
  section.setAttribute('data-kind', kind)

  const heading = document.createElement('h3')
  heading.setAttribute('data-part', 'entry-section-heading')
  heading.textContent = kindLabel
  section.append(heading)

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
  section.append(addToggle)

  // GH #47/#48 — the add-from-library affordance: a ui-menu of pack entries, committed through the SAME
  // validated `onAdd` path as the hand-authoring form below (a library add IS a custom add with the
  // typing done — slug-dedup and ordering come for free, and a rejection surfaces via the same
  // `showAddError` note). Renders ONLY when packs were handed in; the section shell is byte-identical
  // otherwise. Rows carry `data-value="packId:index"` (the menu's commit payload) and the entry's
  // description as their tooltip.
  const libraries = options?.libraries ?? []
  if (libraries.length > 0) {
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

    for (const pack of libraries) {
      for (const [index, entry] of pack.entries.entries()) {
        const row = document.createElement('div')
        row.dataset.value = `${pack.id}:${index}`
        row.textContent = `${entry.label} — ${pack.label}`
        row.title = entry.description
        libraryMenu.append(row)
      }
    }

    libraryMenu.addEventListener('select', (event) => {
      const { value } = (event as CustomEvent<{ value: string; index: number }>).detail
      const splitAt = value.lastIndexOf(':')
      const pack = libraries.find((p) => p.id === value.slice(0, splitAt))
      const entry = pack?.entries[Number(value.slice(splitAt + 1))]
      if (!entry) return
      // Mirror submitAdd's contract (PR #58 review finding): `onAdd` returning false is a fail-closed
      // rejection the CALLER surfaces via `showAddError` (which un-hides the add-form's error note) —
      // there is nothing to reset here, but the return must not be silently discarded: a rejected
      // library entry (e.g. a pack shipping an empty label) shows the same visible note the
      // hand-authored path shows, proven by the rejection test.
      void handlers.onAdd(entry)
    })

    section.append(libraryMenu)
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
  section.append(addForm)

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

      const header = document.createElement('div')
      header.setAttribute('data-part', 'entry-header')

      const entryLabel = document.createElement('span')
      entryLabel.setAttribute('data-part', 'entry-label')
      entryLabel.textContent = entry.label

      const toggle = document.createElement('ui-switch') as HTMLElement & { checked: boolean }
      toggle.setAttribute('data-part', 'entry-toggle')
      toggle.setAttribute('aria-label', `${entry.label} enabled`)
      toggle.checked = entry.enabled
      toggle.addEventListener('change', () => handlers.onToggle(entry.id, toggle.checked))

      header.append(entryLabel, toggle)

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

      const contentField = document.createElement('ui-code-editor') as UICodeEditorElement
      contentField.language = 'markdown' // ADR-0139 — markdown-highlighted source editing (CM lazy-loaded)
      contentField.rows = 4 // TKT-0049: the saved, potentially longer per-entry content — bigger than the add-form's draft field
      contentField.setAttribute('data-part', 'entry-content')
      contentField.setAttribute('aria-label', `${entry.label} content`)
      // Restore an in-progress, uncommitted edit for THIS entry (captured above) rather than the
      // possibly-stale `entry.content` from the store — the whole point of the preservation above.
      contentField.value = entry.id === activeId && preservedValue !== undefined ? preservedValue : entry.content
      contentField.addEventListener('change', () => handlers.onContentChange(entry.id, contentField.value))
      row.append(contentField)
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
      if (entry.id === activeId && preservedValue !== undefined) {
        void contentField.updateComplete.then(() => contentField.selectToEnd())
      }
    }
  }

  return { host: section, render }
}

/** Show `message` in the add-form's own error note (fail-closed validation feedback, ADR-0132 cl.4) —
 *  exported so `agent-admin.ts` can surface `validateNewEntry`'s rejection without this module owning
 *  the validation call itself (the caller decides WHEN to validate; this module only renders the result). */
export function showAddError(section: EntryListSection, message: string): void {
  const note = section.host.querySelector('[data-part="entry-add-error"]') as HTMLElement
  const form = section.host.querySelector('[data-part="entry-add-form"]') as HTMLElement
  note.textContent = message
  note.hidden = false
  form.hidden = false
}
