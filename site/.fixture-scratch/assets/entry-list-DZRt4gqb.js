import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{t as n}from"./code-block-DEt2Scp8.js";import{t as r}from"./composer-options-7Qsye3Yp.js";import{a as i,g as a,h as o,m as s,n as c}from"./doc-page-H_CmxYv1.js";import{E as l,M as u,P as d,i as f,k as p,n as m,r as h}from"./persona-patch-BzhT6X6G.js";import{a as g,i as _}from"./specimens-BSFejhGR.js";import"./editor-CIX5EHhw.js";import{n as v,t as y}from"./entry-list-BJAgO1Pk.js";var b=`// entry-list.ts — the generic ordered-entry-list UI (ADR-0132 \`n1b\`/\`n1c\`): renders one kind's entries in
// order with a per-entry toggle + content editor, plus a shared custom-entry authoring form. Reused
// verbatim by every instantiation (prompt sections + skill/workflow/resource/tool/pattern-source, and
// since ADR-0170 the \`catalog\` library) — no kind gets its own bespoke list/toggle/author code
// (ADR-0132 cl.1). The per-kind knobs are \`EntryListOptions\`' \`customAdd\`/\`contentField\` (ADR-0170 cl.8,
// both default-true) and the three default-FALSE opt-ins — \`rejectOnCollision\` (GH #564),
// \`availabilityToggle\` (GH #850, the per-entry in-context/user-invocable mode control + its at-a-glance row
// marker) and \`rename\` (GH #848, the per-row display-name edit) — every existing call site omits the opt-in
// ones and renders byte-identically.
//
// The per-entry content editor is \`<ui-code-editor language="markdown">\` (ADR-0139) — the fleet's
// editable-first markdown source editor (CodeMirror 6, lazy-loaded on the opt-in @agent-ui/code/editor
// subpath). It replaces the plain \`<ui-textarea>\` these blocks used before: the content is markdown by
// construction (\`composeSystemPrompt\` renders \`## {label}\` / \`### {label}\` blocks), so authors now edit it
// with syntax highlighting. \`.value\` get/set, \`rows\`, and the commit-on-\`change\` (never \`input\`, blur-with-
// change) timing are byte-identical to the ui-textarea it replaces (ADR-0139 cl.4/cl.6 make this a drop-in
// tag+type swap); \`selectToEnd()\` carries over as the same mid-edit caret-restoration seam (ADR-0134).
//
// GH #917 — a kind may instead route its per-entry CRUD through a \`ui-drawer\` (\`entryDrawer\`, opt-in): the
// row collapses to \`[switch | label | badges | Edit]\` and the Invocable pill / Rename trigger / Remove button
// / content editor all move into ONE shared form (\`entry-form.ts\`), which the same drawer also renders in ADD
// mode — so the add-toggle opens a drawer instead of revealing the permanently-mounted dashed form, and that
// form is not built at all. The WRITES are untouched — the form commits through the same handlers this module
// already owned — so preset protection, the rename refusal, availability semantics and the fail-closed add
// keep their existing homes; only the surface moves. A section that does not opt in renders byte-identically
// to before, dashed form included.
//
// DOM ownership: \`mountEntryList\` builds the section shell (list host + add-form host — headless since GH #225) ONCE
// and returns a \`render(entries)\` that rebuilds the list body from scratch on every call — acceptable
// because \`render\` is only invoked on a genuine entries-array change (add/delete/toggle, or an external
// store notification), never per-keystroke; a content edit commits on ui-code-editor's own \`change\` (blur),
// not on \`input\`, matching the fleet's per-field-on-change law (settings.ts's own SPEC-R12 timing).

import type { UIButtonElement } from '@agent-ui/components/controls/button'
import type { UIDisclosureElement } from '@agent-ui/components/controls/disclosure'
import type { UIIconElement } from '@agent-ui/components/controls/icon'
import type { UICodeEditorElement } from '@agent-ui/code/editor'
import type { UIDrawerElement } from '@agent-ui/components/controls/drawer'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import type { UIFieldElement } from '@agent-ui/components/controls/field'
import type { UIToggleElement } from '@agent-ui/components/controls/toggle'
import { ENTRY_AVAILABILITY, entryAvailability, slugify } from './entry-data.ts'
import type { Entry, EntryLibraryPack, NewEntryInput } from './entry-data.ts'
import { buildEntryForm, type EntryFormHandlers, type EntryFormMode } from './entry-form.ts'

/** The row's OWN writer plus every writer the drawer form commits through (\`EntryFormHandlers\` — one
 *  declaration and one doc per member lives there, so the two surfaces can never drift onto different
 *  contracts for the same write). \`onToggle\` stays here because the enabled switch never leaves the row:
 *  it is STATE, not CRUD (GH #917's Phase 0 ruling §2). */
export interface EntryListHandlers extends EntryFormHandlers {
  onToggle(id: string, enabled: boolean): void
}

export interface EntryListSection {
  /** The section's own host element — append this into the pane. */
  host: HTMLElement
  /** Rebuild the list body from \`entries\` (already filtered to this section's own kind by the caller). */
  render(entries: readonly Entry[]): void
  /** GH #143 — replace the add-from-library menu with one built from \`libraries\` (in place, keeping the
   *  rest of the already-mounted section shell untouched). Empty/absent removes the affordance entirely,
   *  matching the initial "byte-identical when no packs" law. The one part of a section NOT captured by
   *  the \`mountEntryList\` build-once contract — a caller (\`agent-admin.ts\`) may call this again whenever
   *  the packs on offer change (e.g. a persona/preset switch re-scoping which packs apply). */
  updateLibraries(libraries: readonly EntryLibraryPack[]): void
  /** GH #419 — show a NON-BLOCKING per-entry notice (\`entryId → message\`), stamped onto each named
   *  entry's own card and removed from every entry the map omits. Purely presentational: this module
   *  never computes a notice, and nothing about the entries themselves changes. The last map handed in
   *  is remembered and re-applied after any \`render\`, so a list rebuild (a sibling toggle, an external
   *  store write) cannot silently drop a live notice. */
  showNotices(notices: ReadonlyMap<string, string>): void
}

/** Build one kind's section shell (list + collapsible add-form), once — HEADLESS since GH #225: the
 *  section's label AND its optional master switch both live on the caller's fold heading row now
 *  (agent-admin.ts's \`settingsItem\` + the switch's \`slot="summary"\` marking, GH #226/ADR-0158 — the
 *  ui-disclosure summary), so the old
 *  \`entry-section-heading\` h3 / \`entry-section-header\` row (vision rev.5) retired with them. \`addLabel\`
 *  is the add-toggle's own label text ("Add skill") — a bare word, no leading "+" — the toggle supplies
 *  its own leading \`plus\` icon adornment (TKT-0048), so the literal \`+\` character no longer belongs in
 *  the string. \`handlers\` are called on the corresponding user action — this module owns no store
 *  access of its own (the caller wires persistence, matching \`agent-admin.ts\`'s existing seam). */
export interface EntryListOptions {
  /** GH #47/#48 — packs offered by the add-from-library menu. Absent/empty ⇒ the affordance does not
   *  render at all (byte-identical section shell to before the option existed). */
  libraries?: readonly EntryLibraryPack[]
  /** ADR-0170 cl.8 — render the custom-entry AUTHORING affordances (the add-toggle button + its form).
   *  Default \`true\`: absent ⇒ byte-identical to before this option existed. \`false\` suppresses BOTH; the
   *  library menu is unaffected (it commits through \`handlers.onAdd\` directly, never through the form).
   *  Suppressed for a kind whose entries key an EXTERNAL registry — there is nothing meaningful to
   *  author, and a form that looks like "create one" would mint an id the registry does not know. This
   *  is the named seam a future create-a-catalog affordance re-opens. */
  customAdd?: boolean
  /** ADR-0170 cl.8 — render the per-entry CONTENT editor on each row. Default \`true\`: absent ⇒
   *  byte-identical. \`false\` renders rows as label + description + switch; the mid-edit preservation path
   *  below is then inert by construction (there is no content field to preserve). */
  contentField?: boolean
  /** GH #564 — \`true\` for a kind whose entry id is a FOREIGN KEY into an external registry (the catalog
   *  kind), matching the SAME flag the caller hands \`validateNewEntry\` (entry-data.ts's own
   *  \`ValidateNewEntryOptions\`). Default \`false\`/absent ⇒ byte-identical: the add-from-library picker never
   *  disables a row. \`true\` ALSO disables (never hides — the user can see WHY) any pack row whose id
   *  already sits in the current list — a collision there is a genuine duplicate the caller's \`onAdd\`
   *  rejects outright, so the row is unreachable from the picker too, not just refused on commit. */
  rejectOnCollision?: boolean
  /** GH #850 / capability-availability-tagging.spec.md SPEC-R2 — render the per-entry AVAILABILITY control
   *  (in-context vs user-invocable) on each row, plus the row's at-a-glance \`data-availability\` marker.
   *  OPT-IN, like \`rejectOnCollision\`: absent/false ⇒ byte-identical render for every existing caller
   *  (\`prompt-section\`, \`pattern-source\` and \`catalog\` sections never show it — availability semantics are
   *  defined for the four capability kinds alone, SPEC-R1). The writer is \`EntryListHandlers\`'
   *  \`onAvailabilityChange\`; a \`builtin\` entry's mode is as editable as its \`enabled\` toggle (ADR-0132
   *  Fork 4 protects deletion, not configuration). */
  availabilityToggle?: boolean
  /** GH #848 — render the per-entry RENAME affordance on each row (a display-name edit; the entry's \`id\` is
   *  never rewritten). OPT-IN, the same \`rejectOnCollision\`/\`availabilityToggle\` law rather than the
   *  \`customAdd\`/\`contentField\` one: absent/\`false\` ⇒ byte-identical rows for every existing caller, so the
   *  kinds whose names are NOT free human text keep them (agent-admin flags only its four capability kinds —
   *  a \`prompt-section\` label is the composed prompt's own \`## {label}\` heading, and a \`catalog\` label
   *  mirrors the registry entry the row keys). Also requires \`handlers.onRename\` (see that handler's doc for
   *  why a missing writer hides this affordance while it only REFUSES the mode pill's flip). Independent of
   *  \`builtin\` — ADR-0132 Fork 4 protects DELETION, not configuration (the \`enabled\` toggle and the mode
   *  pill a builtin row already carry are the precedent). */
  rename?: boolean
  /** GH #917 — route this kind's per-entry CRUD through a \`ui-drawer\` (ADR-0188) instead of inline row
   *  affordances. OPT-IN, the \`rejectOnCollision\`/\`availabilityToggle\`/\`rename\` law: absent/\`false\` ⇒
   *  byte-identical rows, add-toggle and dashed add-form for every existing caller.
   *
   *  \`true\` collapses the row to \`[switch | label | badges | Edit]\` — the Invocable pill, the Rename trigger,
   *  the Remove button and the per-entry content editor all move INTO the drawer's form (\`entry-form.ts\`),
   *  and the permanent dashed add-form is replaced by the same drawer in add mode. Nothing about the
   *  underlying writes changes: the drawer commits through the SAME handlers the row did, so preset
   *  protection (delete absent for \`builtin\`), the rename refusal, the availability semantics and the
   *  fail-closed add all keep their existing homes and behaviour — only the surface they live on moves.
   *
   *  The gate is the CALLER's (agent-admin's \`hasDrawerCrud\`, its own kind list): a kind whose rows carry
   *  just a switch and a Remove has no four-affordance cluster to relieve, and a drawer holding one button
   *  would add a click for nothing. */
  entryDrawer?: boolean
}

/** Stable per-section id seed for the drawer's \`aria-labelledby\` target (the \`ui-field-label-N\`/text-field
 *  message-node precedent) — a section may be mounted many times on one page, and the labelling reference
 *  must resolve to THIS section's own drawer heading. */
let drawerSeq = 0

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
  // second gate is this affordance's own (see \`onRename\`'s doc) — \`withAvailability\` needs no handler gate
  // because its control has state to show regardless, and refuses its flip instead.
  const withRename = options?.rename === true && handlers.onRename !== undefined
  // GH #917 — opt-in, the same law: absent ⇒ inline rows + the dashed add-form, exactly as before.
  const withDrawer = options?.entryDrawer === true
  // GH #949 — the drawer's EDIT header noun ("Edit {kindLabel}"), derived from this section's own \`addLabel\`
  // rather than the raw \`kind\` slug: \`kind\` is a machine value (\`entry-form.ts\`'s \`data-kind\`), and for the
  // original four capability kinds it happened to double as the human noun too ('skill', 'tool', …), but
  // \`prompt-section\`/\`pattern-source\` broke that coincidence (their \`addLabel\`s are "Add section"/"Add
  // pattern source" — the hyphenated raw slug is not a sentence). One strip of the "Add " prefix keeps a
  // single per-kind source of truth (\`addLabel\`, already authored per section) rather than a second table.
  const kindLabel = addLabel.replace(/^Add\\s+/i, '')

  const section = document.createElement('div')
  section.setAttribute('data-part', 'entry-section')
  section.setAttribute('data-kind', kind)

  const list = document.createElement('div')
  list.setAttribute('data-part', 'entry-list')
  section.append(list)

  // TKT-0048: a real \`<ui-button>\` instead of a bespoke \`<button>\` with one flat text node — the old
  // shape glued a literal "+" character straight onto the label with no controlled spacing. \`ui-button\`'s
  // \`slot="leading"\` adornment cell (button.css, ADR-0006/ADR-0012) gets the real, token-driven gap; the
  // toast.ts close-button is the precedent for this exact \`<ui-button><ui-icon slot="leading"
  // data-role="icon">…</ui-button>\` shape.
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
  // validated \`onAdd\` path as the hand-authoring form below (a library add IS a custom add with the
  // typing done — slug-dedup and ordering come for free, and a rejection surfaces via the same
  // \`showAddError\` note). Renders ONLY when packs were handed in; the section shell is byte-identical
  // otherwise. Rows carry \`data-value="packId:index"\` (the menu's commit payload) and the entry's
  // description as their tooltip.
  //
  // GH #143 — extracted to a factory (\`buildLibraryMenu\`) so \`updateLibraries\` can rebuild JUST this menu
  // in place (swap it for a fresh one built from a new pack list) without touching the rest of the
  // already-mounted section shell — the seam that lets a caller re-scope which packs a section offers
  // (e.g. per agent preset/persona) after the section is built.
  function buildLibraryMenu(libs: readonly EntryLibraryPack[]): HTMLElement {
    const libraryMenu = document.createElement('ui-menu')
    libraryMenu.setAttribute('data-part', 'entry-library-menu')
    const libraryTrigger = document.createElement('ui-button') as UIButtonElement
    libraryTrigger.setAttribute('variant', 'soft')
    // NO bespoke data-part on the trigger — ui-menu's #ensureParts unconditionally stamps its first
    // child \`data-part="trigger"\` (menu.ts), so any value set here is clobbered at connect (PR #58
    // review finding). Scope queries through the MENU's own marker instead:
    // \`[data-part='entry-library-menu'] [data-part='trigger']\`.
    const libraryIcon = document.createElement('ui-icon') as UIIconElement
    libraryIcon.setAttribute('slot', 'leading')
    libraryIcon.setAttribute('data-role', 'icon')
    libraryIcon.setAttribute('glyph', 'plus')
    libraryTrigger.append(libraryIcon, 'From library')
    libraryMenu.append(libraryTrigger)

    for (const pack of libs) {
      for (const [index, entry] of pack.entries.entries()) {
        const row = document.createElement('div')
        row.dataset.value = \`\${pack.id}:\${index}\`
        // GH #564 — a \`rejectOnCollision\` kind (the catalog's foreign-key id) can never actually commit a
        // pack entry whose id already sits in the list; predict the id the SAME way \`validateNewEntry\`
        // would (\`slugify\` is the fallback when the pack omits an explicit \`id\`) and DISABLE the row —
        // never hide it (ui-menu's own \`aria-disabled\` precedent, the conversation-composer.ts "coming
        // soon" idiom) — so the author sees WHY a click would do nothing instead of a click that just does
        // nothing.
        // GH #783/LLD-C5 — the disable honors the kind-level flag OR this PACK's own \`rejectOnCollision\`,
        // so a foreign-key pack offered under an ordinary kind (the S4 services pack) disables its
        // already-added rows just as the catalog KIND does.
        const wouldBeId = entry.id?.trim() ? entry.id.trim() : slugify(entry.label)
        const alreadyPresent = (rejectOnCollision || pack.rejectOnCollision === true) && currentEntries.some((e) => e.id === wouldBeId)
        row.textContent = alreadyPresent ? \`\${entry.label} — \${pack.label} (already added)\` : \`\${entry.label} — \${pack.label}\`
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
      // Mirror submitAdd's contract (PR #58 review finding): \`onAdd\` returning false is a fail-closed
      // rejection the CALLER surfaces via \`showAddError\` (which un-hides the add-form's error note) —
      // there is nothing to reset here, but the return must not be silently discarded: a rejected
      // library entry (e.g. a pack shipping an empty label) shows the same visible note the
      // hand-authored path shows, proven by the rejection test.
      //
      // GH #783/LLD-C5 — forward the ADDING PACK's own \`rejectOnCollision\` as \`onAdd\`'s optional context,
      // so the caller's ONE \`validateNewEntry\` call rejects a foreign-key duplicate even for a pack under
      // an ordinary kind. An unflagged pack forwards \`undefined\` — byte-identical to the pre-#783 call.
      void handlers.onAdd(entry, pack?.rejectOnCollision === true ? { rejectOnCollision: true } : undefined)
    })

    return libraryMenu
  }

  let libraryMenu: HTMLElement | null = null
  let currentLibraries: readonly EntryLibraryPack[] = options?.libraries ?? []
  // GH #564 — the picker's own live view of "what's already in the list", kept fresh by \`render\` below so
  // \`buildLibraryMenu\`'s per-row disabled check (a \`rejectOnCollision\` kind only) never goes stale after
  // an add/delete.
  let currentEntries: readonly Entry[] = []

  /** GH #143/#564 — rebuild the library menu from \`currentLibraries\`, in place: the ONE mechanism both
   *  \`updateLibraries\` (a caller-driven pack-list change) and \`render\` (GH #564 — an entries change, for a
   *  \`rejectOnCollision\` kind's disabled-row refresh) drive, and the initial build below. The inline
   *  add-form (mounted after wherever a library menu lands) is the stable insertion anchor — a library menu,
   *  when present, always sits immediately before it, so re-inserting there preserves the section's visual
   *  order (heading → list → add-toggle → [library menu] → add-form) on every call, first build included.
   *  ADR-0170 cl.8: with \`customAdd: false\` that anchor is not mounted at all and the menu is the LAST
   *  child, so a plain append reproduces the same order. GH #917: a DRAWERED section has no inline form
   *  either — its standing error note takes the anchor's place, at the same position in the order. */
  function refreshLibraryMenu(): void {
    libraryMenu?.remove()
    libraryMenu = currentLibraries.length > 0 ? buildLibraryMenu(currentLibraries) : null
    if (!libraryMenu) return
    const anchor = inlineAdd?.form ?? sectionError
    if (anchor !== null && anchor.parentNode === section) section.insertBefore(libraryMenu, anchor)
    else section.append(libraryMenu)
  }

  /** The INLINE dashed add-form — a non-drawered section's authoring surface, unchanged since TKT-0060/0073.
   *  A drawered section (GH #917) builds NONE of it: its add affordance is the same \`ui-drawer\` the row's
   *  Edit opens, in add mode, so these nodes would be five permanently detached elements and a second,
   *  divergent copy of the submit law. */
  function buildInlineAddForm(): { form: HTMLElement; label: UITextFieldElement; open(): void } {
    // TKT-0060: a plain container, not a native \`<form>\` — a \`<ui-button>\` submit control cannot become a
    // form's default button (not form-associated the way a native \`<button>\` is), so the HTML implicit-
    // submission algorithm was never actually available to this form once entry-add-submit converted; wiring
    // submission manually below (click + an explicit Enter handler on the label field) replaces it exactly,
    // without the native-form/native-input dependency TKT-0048 deferred converting this anatomy over.
    const form = document.createElement('div')
    form.setAttribute('data-part', 'entry-add-form')
    form.hidden = true

    // TKT-0073: wrapped in \`<ui-field>\` (the forms.ts/form-provider-demo.ts precedent) so the required
    // field's validation message renders in the field's OWN error part — outside \`ui-text-field\`'s
    // bordered box — instead of \`ui-text-field\`'s internal pre-\`ui-field\` fallback message, which shares
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

    // TKT-0048/TKT-0060: a real \`<ui-button>\`, same shape as \`addToggle\`/\`deleteBtn\` above.
    const submitBtn = document.createElement('ui-button') as UIButtonElement
    submitBtn.setAttribute('variant', 'soft')
    submitBtn.setAttribute('data-part', 'entry-add-submit')
    submitBtn.textContent = 'Add'

    const errorNote = document.createElement('p')
    errorNote.setAttribute('data-part', 'entry-add-error')
    errorNote.hidden = true

    function submitAdd(): void {
      const input: NewEntryInput = { label: labelField.value, description: descriptionField.value, content: contentField.value }
      const succeeded = handlers.onAdd(input)
      // Reset/hide ONLY on success (component-reviewer MAJOR fix) — a rejection keeps every typed field
      // AND the form open, so the author sees their own input alongside \`showAddError\`'s message instead
      // of having it silently discarded. \`showAddError\` (below) is the ONLY thing that un-hides the form
      // on a rejection now — this function no longer fights it by re-hiding on every submit.
      if (succeeded) {
        labelField.value = ''
        descriptionField.value = ''
        contentField.value = ''
        form.hidden = true
      }
    }

    submitBtn.addEventListener('click', submitAdd)
    // Native single-line \`<input>\` Enter-to-submit parity for the one required field — deliberately NOT
    // wired on \`descriptionField\`/\`contentField\` (optional field / multi-line field, matching what the old
    // native form's implicit submission would not have keyed off). \`isComposing\` guards an IME candidate-
    // confirming Enter the same way \`ui-text-field\`'s own internal Enter handler already does.
    labelField.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return
      submitAdd()
    })

    form.append(labelFieldWrap, descriptionFieldWrap, contentField, submitBtn, errorNote)
    return {
      form,
      label: labelField,
      open(): void {
        form.hidden = !form.hidden
        if (!form.hidden) labelField.focus()
      },
    }
  }

  const inlineAdd = withCustomAdd && !withDrawer ? buildInlineAddForm() : null
  if (inlineAdd) section.append(inlineAdd.form)

  // GH #917 — a DRAWERED section's standing error note. The drawer's own add form carries the message beside
  // the field it is about (\`entry-form.ts\`), but a rejection can also arrive with NO form on screen: the
  // library menu commits straight through \`handlers.onAdd\`, and a pack's own \`rejectOnCollision\` duplicate
  // (GH #783/LLD-C5) is refused there. Before the drawer, that message landed in the inline form (which
  // \`showAddError\` un-hid); with no inline form to un-hide it would be a silent no-op — the fail-closed
  // add would look like nothing happening. So the section keeps one note of its own, hidden until used.
  const sectionError = withDrawer ? document.createElement('p') : null
  if (sectionError) {
    sectionError.setAttribute('data-part', 'entry-add-error')
    sectionError.hidden = true
    section.append(sectionError)
  }

  refreshLibraryMenu() // the initial build — see \`refreshLibraryMenu\`'s own doc comment below

  // ── GH #917 — the section's ONE drawer, and the two things that open it ─────────────────────────────────
  // Built HERE, while the section is still detached, because \`ui-drawer\` MOVES its children into the
  // \`<dialog>\` part at connect, ONCE (drawer.ts's \`#ensureDialog\`): the three region shells must exist by
  // then, and from that point only their CHILDREN are ever replaced — appending to the HOST after connect
  // would land the node beside the dialog, outside the top-layer surface (agent-admin-app.ts's \`rosterList\`
  // precedent, the same rule stated there).
  //
  // The accessible name rides \`aria-labelledby\` pointing at the stable HEADER shell (whose contents the form
  // rewrites per open), not \`aria-label\`: the drawer forwards an author name onto the dialog part exactly
  // once at connect, so a per-open name cannot be an attribute on the host — but a stable reference to a
  // heading whose TEXT changes is the labelling pattern drawer.md itself names ("a labelling heading child
  // is the common pattern").
  const drawer = withDrawer ? (document.createElement('ui-drawer') as UIDrawerElement) : null
  const drawerHeader = document.createElement('header')
  const drawerContent = document.createElement('div')
  const drawerFooter = document.createElement('footer')
  if (drawer) {
    drawerSeq += 1
    const headingId = \`entry-drawer-heading-\${drawerSeq}\`
    drawer.setAttribute('edge', 'end') // the options-side case — the Manage-agents composition verbatim
    drawer.setAttribute('data-part', 'entry-drawer')
    drawer.setAttribute('aria-labelledby', headingId)
    drawerHeader.id = headingId
    drawerHeader.setAttribute('data-part', 'entry-drawer-header')
    // GH #918's region model, composed as plain structural light-DOM children (no new slot grammar): the
    // header/footer are the drawer's STICKY [data-box] regions and the content between them is the ONE
    // scrollport, so the title and the primary stay pinned while a long content editor scrolls.
    drawerContent.setAttribute('data-region', 'content')
    drawerContent.setAttribute('data-part', 'entry-drawer-content')
    drawerFooter.setAttribute('data-part', 'entry-drawer-footer')
    drawer.append(drawerHeader, drawerContent, drawerFooter)
    section.append(drawer)
  }

  function closeDrawer(): void {
    if (drawer) drawer.open = false
  }

  // GH #950 — the ADD drawer's own per-kind draft buffer: \`entry-form.ts\`'s \`openForm\` rebuilds the form
  // from scratch on every open (the #917 drawer move's own regression — the permanent inline form it
  // replaced never got torn down at all), so an Esc/scrim dismiss followed by a reopen would otherwise hand
  // the author a blank form. One closure-scoped variable per \`mountEntryList\` call ⇒ one buffer per SECTION
  // (per kind) by construction — a Skill section's draft and a Workflow section's draft can never collide,
  // since each kind gets its own \`mountEntryList\` invocation and therefore its own \`addDraft\`. Cleared on a
  // successful Add (\`entry-form.ts\`'s own \`onDraftChange\` call after \`onAdd\` returns true); a rejection
  // leaves it exactly as typed, matching the fields it stayed in sync with.
  let addDraft: NewEntryInput | null = null

  /** Rebuild the three regions from \`buildEntryForm\` and show the drawer. Built ON OPEN and never on a store
   *  notification — this drawer holds no subscription of its own, so an external re-render (a sibling toggle,
   *  a store write) behind it can no longer eat an uncommitted content edit the way a full \`render()\` rebuild
   *  could when the editor lived on the row. Every commit the form makes is an id-keyed write that no-ops
   *  fail-closed if the entry vanished externally. */
  function openForm(form: EntryFormMode): void {
    if (!drawer) return
    const regions = buildEntryForm(
      kind,
      kindLabel,
      form,
      handlers,
      { contentField: withContentField, availabilityToggle: withAvailability, rename: withRename },
      closeDrawer,
    )
    drawerHeader.replaceChildren(regions.header)
    drawerContent.replaceChildren(regions.content)
    drawerFooter.replaceChildren(regions.footer)
    drawer.open = true
  }

  // GH #917 — ONE affordance, two surfaces: a drawered section's "Add …" opens the SAME drawer the row's
  // Edit does, in add mode; every other section keeps the reveal/hide of its inline dashed form.
  addToggle.addEventListener('click', () => {
    if (withDrawer) {
      if (sectionError) sectionError.hidden = true // a fresh attempt starts with no stale rejection on screen
      // GH #950 — hand the buffered draft (if any) back in, and re-arm the buffer for this open's own
      // keystrokes. \`addDraft\` is \`null\` on a fresh section that has never buffered a keystroke; after a
      // successful Add it holds the EMPTY triple (\`entry-form.ts\`'s own explicit clear), not \`null\` — either
      // way \`draft?.label ?? ''\` etc. (\`entry-form.ts\`) seeds the same '' defaults the form always had.
      openForm({ mode: 'add', title: addLabel, draft: addDraft ?? undefined, onDraftChange: (next) => { addDraft = next } })
      return
    }
    inlineAdd?.open()
  })

  /** Fail-closed validation feedback (ADR-0132 cl.4), routed to the surface that can actually SHOW it — the
   *  exported \`showAddError\` calls this through a private registry, so its own signature and doc are
   *  unchanged. Three cases, in priority order:
   *    1. a drawered section with its ADD form open — the note beside the Name field the message is about;
   *    2. a drawered section with nothing open (a LIBRARY-menu rejection) — the section's standing note;
   *    3. every other section — the dashed form's note, un-hiding the form, byte-identically to before. */
  function showError(message: string): void {
    const openNote = drawer?.open === true ? (drawerContent.querySelector('[data-part="entry-form-error"]') as HTMLElement | null) : null
    const note = openNote ?? sectionError ?? (inlineAdd?.form.querySelector('[data-part="entry-add-error"]') as HTMLElement | null)
    if (note === null || note === undefined) return
    note.textContent = message
    note.hidden = false
    if (note !== openNote && note !== sectionError && inlineAdd) inlineAdd.form.hidden = false
  }

  function render(entries: readonly Entry[]): void {
    // GH #564 — refresh the picker's live "already in the list" view BEFORE anything below reads it (a
    // \`rejectOnCollision\` kind's disabled-row refresh, at the end of this function).
    currentEntries = entries
    // Component-reviewer MAJOR fix: a SIBLING entry's action (toggle/delete/add on a DIFFERENT entry in
    // this same list) re-renders the whole list via the store's subscribe notification — a full
    // \`replaceChildren()\` would otherwise silently discard whatever uncommitted (not-yet-\`change\`d) text
    // sits in a content field the author is actively mid-edit in. Capture that field's identity + LIVE
    // value BEFORE the rebuild, restore it (value + focus) onto the new row for the SAME entry id after.
    const active = document.activeElement
    // \`list.contains(active)\` scopes this to THIS section's own list — without it, two different
    // sections whose entries happen to share an id (e.g. a Skill and a Workflow both slugified to
    // "deploy") could cross-contaminate: a focused field in one section's row would get its value
    // and focus stolen into the OTHER section's same-id row on that section's own re-render.
    const activeRow = active?.closest('[data-part="entry"]') as HTMLElement | null
    const activeId = activeRow !== null && list.contains(active) ? (activeRow.getAttribute('data-entry-id') ?? undefined) : undefined
    // \`ui-code-editor\`'s focused DOM node is an INTERNAL surface — the plain \`[data-part="editor"]\` part or,
    // once CodeMirror enhances, its \`.cm-content\` inside \`[data-part="cm"]\` — never the host the
    // \`entry-content\` data-part lives on; \`.closest()\` walks up from any of them to the host either way.
    const activeField = active?.closest('[data-part="entry-content"]') as UICodeEditorElement | null
    const preservedValue = activeId !== undefined && activeField !== null ? activeField.value : undefined
    // GH #1062 — the DRAWERED row's inline Content field gets the SAME mid-edit rescue: a
    // \`ui-code-editor\` (GH #1102 — it replaced the plain ui-textarea) inside the row's
    // collapsed-by-default Content fold (built below), whose focused internal surface \`.closest()\`
    // walks up to the host exactly like the code-editor case above.
    const activeInline = active?.closest('[data-part="entry-inline-content"]') as UICodeEditorElement | null
    const preservedInlineValue = activeId !== undefined && activeInline !== null ? activeInline.value : undefined
    // GH #1062 — a fold the author opened must survive an external rebuild (a sibling toggle, a store
    // write): capture every row's fold state by entry id before \`replaceChildren\` throws the rows away.
    const openFolds = new Set<string>()
    for (const openRow of list.querySelectorAll<HTMLElement>('[data-part="entry"]')) {
      const fold = openRow.querySelector('[data-part="entry-content-fold"]') as UIDisclosureElement | null
      if (fold?.open === true) openFolds.add(openRow.getAttribute('data-entry-id') ?? '')
    }

    list.replaceChildren()
    const sorted = [...entries].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    for (const entry of sorted) {
      const row = document.createElement('div')
      row.setAttribute('data-part', 'entry')
      row.setAttribute('data-entry-id', entry.id)
      row.toggleAttribute('data-builtin', entry.builtin)
      // GH #850/SPEC-R2 — the AT-A-GLANCE row marker: the resolved mode (read-time default, so a
      // field-less entry stamps \`context\`) on the row itself, which entry-list.css paints as a visibly
      // distinct card edge for \`invocable\`. Stamped ONLY for an opted-in section, so every existing
      // caller's row attribute set is byte-identical (AC1).
      if (withAvailability) row.setAttribute('data-availability', entryAvailability(entry))

      const header = document.createElement('div')
      header.setAttribute('data-part', 'entry-header')

      // GH #138 (row-pattern standardization, Kim's option-A ruling): switch leads, label next, a
      // flexible spacer, then trailing action content (the Remove button) pinned to the right edge.
      const toggle = document.createElement('ui-switch') as HTMLElement & { checked: boolean }
      toggle.setAttribute('data-part', 'entry-toggle')
      toggle.setAttribute('aria-label', \`\${entry.label} enabled\`)
      toggle.checked = entry.enabled
      toggle.addEventListener('change', () => handlers.onToggle(entry.id, toggle.checked))

      const entryLabel = document.createElement('span')
      entryLabel.setAttribute('data-part', 'entry-label')
      entryLabel.textContent = entry.label
      // GH #865 — entry-list.css's own truncation floor (\`min-inline-size\` + single-line ellipsis) can
      // shorten this at a narrow pane width; \`title\` mirrors the FULL name unconditionally (the
      // \`ui-text[truncate]\`/ADR-0106 idiom, done here by hand since this is a plain \`<span>\`, not a
      // \`ui-text\`), so the untruncated name is always a hover away regardless of how much the row shrinks.
      entryLabel.title = entry.label

      const entrySpacer = document.createElement('span')
      entrySpacer.setAttribute('data-part', 'entry-spacer')

      header.append(toggle, entryLabel, entrySpacer)

      // GH #917 — the DRAWERED row: \`[switch | label | spacer | badges | Edit]\`. The four affordances the
      // three blocks below build inline (Invocable · Rename · Remove, plus the content editor further down)
      // are ONE "Edit" button here; everything they did still happens, in the drawer's form. The enabled
      // switch stays — it is STATE, not CRUD, and duplicating it into the drawer would mint a second place
      // to answer the same question.
      //
      // The BADGE replaces the mode pill's second job: the pill was both a control and the row's at-a-glance
      // "is this invocable?" read, and only the control moves. A word, not colour alone (ADR-0057), beside
      // the \`data-availability\` card edge the row already carries.
      if (withDrawer) {
        if (withAvailability && entryAvailability(entry) === ENTRY_AVAILABILITY.invocable) {
          const badge = document.createElement('span')
          badge.setAttribute('data-part', 'entry-badge')
          badge.textContent = 'Invocable'
          badge.title = 'User-invocable — inert until invoked from the conversation.'
          header.append(badge)
        }
        const editBtn = document.createElement('ui-button') as UIButtonElement
        editBtn.setAttribute('variant', 'soft')
        editBtn.setAttribute('data-part', 'entry-edit')
        // The row's own \`\${entry.label} …\` ARIA shape (the enabled switch above): a list of rows whose
        // buttons all read "Edit" names none of them.
        editBtn.setAttribute('aria-label', \`Edit \${entry.label}\`)
        editBtn.textContent = 'Edit'
        editBtn.addEventListener('click', () => openForm({ mode: 'edit', entry }))
        header.append(editBtn)
      }

      // The INLINE trailing action cluster's ORDER (a section that did NOT opt into \`entryDrawer\` — GH #917
      // above is the other shape), ruled once here so the next affordance knows where to land
      // (GH #848 reconciling with GH #850, which landed the mode pill first): STATE reads before ACTIONS,
      // and the destructive action stays last — \`[switch | label | spacer | Invocable | Rename | Remove]\`.
      // The leading \`enabled\` switch and the \`Invocable\` pill are the row's two state controls (they answer
      // "is this on?" / "how is it reachable?"); \`Rename\` and \`Remove\` are its two buttons, kept adjacent so
      // the cluster reads as one pair rather than a button, a chip, and another button. DOM order IS tab
      // order here (no tabindex anywhere in this row), so a keyboard user reaches configuration before
      // deletion.
      // GH #850/SPEC-R2 — the per-entry MODE control: a \`ui-toggle\` pressed pill in the row's trailing
      // action cluster (ADR-0179 S7-a's own primitive — the fleet's pressed-button toggle, aria-pressed via
      // internals). \`pressed\` IS the mode: on ⇒ user-invocable, off ⇒ in-context (ambient). The visible
      // label stays the STABLE word "Invocable" — the state rides \`aria-pressed\`, never a swapped name (a
      // label that changes with state is the toggle-button AX anti-pattern); the per-row \`aria-label\` is
      // the same \`\${entry.label} …\` shape the enabled switch above already carries.
      if (withAvailability && !withDrawer) {
        const invocable = entryAvailability(entry) === ENTRY_AVAILABILITY.invocable
        const mode = document.createElement('ui-toggle') as UIToggleElement
        mode.setAttribute('data-part', 'entry-availability')
        mode.setAttribute('aria-label', \`\${entry.label} user-invocable\`)
        mode.title = 'On: user-invocable — inert until invoked from the conversation. Off: in context — the model sees it every turn.'
        mode.pressed = invocable
        mode.append('Invocable')
        // toggle.md's refused-toggle contract: \`toggle\` fires BEFORE \`pressed\` commits and is cancelable.
        // No writer wired ⇒ refuse the flip outright, so the pill can never paint a mode no store holds.
        // With a writer, the caller's store write re-renders this list (the cl.5 live-apply idiom), which
        // rebuilds this row from the fresh value — toggle.ts's own post-listener \`pressed\` flip lands on
        // the by-then-detached element, so the two can never disagree (the \`#panePills\` double-flip lesson,
        // avoided here by never writing \`pressed\` from inside the listener).
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

      // GH #848 — the per-entry RENAME affordance (display name only; \`entry.id\` is never rewritten, so
      // every foreign-key id — a registry id, an ADR-0185 namespaced service ref — keeps resolving).
      // Anatomy: the "Rename" trigger swaps the label span for an inline \`ui-text-field\` IN PLACE, and the
      // field swaps back on commit or cancel. All of that state is the ROW's own (one closure local below,
      // born and buried with this row) — deliberately NOT section-level bookkeeping: a \`render\` rebuild
      // throws the row away, so an open rename cannot outlive its entry or leak onto a re-rendered sibling
      // (the cross-contamination the content field's own \`list.contains(active)\` guard exists to prevent).
      // The trade this accepts: an EXTERNAL re-render mid-rename (a sibling toggle, a store write) drops an
      // uncommitted rename. That is the deliberate asymmetry with the content editor's mid-edit
      // preservation dance — a content field holds long-form authored prose worth rescuing; a rename holds
      // a few characters, and the label it replaces is still on screen a keystroke later.
      if (withRename && !withDrawer) {
        let renameField: UITextFieldElement | null = null

        /** Swap the field back out for the label span — the ONE close path (commit and cancel share it).
         *
         *  RE-ENTRANT BY CONSTRUCTION, and that is load-bearing (a real-engine failure, chromium + webkit
         *  both): detaching the field removes the focused editor inside it, and the engine fires that
         *  editor's \`blur\`/\`focusout\` SYNCHRONOUSLY, from inside this very \`replaceWith\` call — so the
         *  focusout listener below re-enters here mid-swap and threw \`NotFoundError: the node to be removed
         *  is no longer a child of this node\`. Clearing the state BEFORE mutating the DOM makes the nested
         *  call a no-op; the \`parentNode\` check keeps it safe even if something else detached the field
         *  first (an external \`render\` rebuild while a rename was open). */
        const closeRename = (): void => {
          const field = renameField
          if (field === null) return
          renameField = null
          if (field.parentNode !== null) field.replaceWith(entryLabel)
        }

        const renameBtn = document.createElement('ui-button') as UIButtonElement
        renameBtn.setAttribute('variant', 'soft')
        // TKT-0048's law, the \`deleteBtn\` shape verbatim: a real \`<ui-button>\` whose label is a plain word
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
          // ui-text-field's \`label\` prop IS its labelling seam (→ the editor's aria-label, text-field.ts's
          // own ADR-0051 note) — the \`\${entry.label} enabled\` switch idiom above, one row over.
          field.label = \`\${entry.label} name\`
          field.value = entry.label
          renameField = field
          entryLabel.replaceWith(field)
          // Focus only lands once the field's own render effect has built its editor part (\`focus()\`
          // forwards to it) — the SAME already-connected/already-flushed discipline the content field's
          // \`selectToEnd()\` restoration below documents.
          void field.updateComplete.then(() => field.focus())

          /** Commit whatever the field holds. The OPEN-state guard is what makes Escape a real cancel:
           *  closing the field un-focuses its editor, whose \`blur\` then emits ui-text-field's own
           *  change-on-blur-with-change — arriving here AFTER the cancel already cleared the state, so a
           *  dismissed rename can never write (measured: without this guard, Escape committed the very text
           *  the user was backing out of). The same guard makes a commit-then-blur pair idempotent. */
          const commitRename = (): void => {
            if (renameField !== field) return
            const typed = field.value
            closeRename()
            // The empty case is a DISPLAY decision, not a second copy of the validation law: the label span
            // is back with the STORED name, which is exactly the visible refusal (\`renameEntry\` still owns
            // the trim and the empty-label no-op). A real rename shows immediately and the caller's
            // re-render then confirms it from the store — the \`onToggle\` posture (the switch moves, the
            // re-render is the truth).
            if (typed.trim().length === 0) return
            entryLabel.textContent = typed.trim()
            entryLabel.title = typed.trim() // GH #865 — the title mirror follows every rename, never stale
            handlers.onRename?.(entry.id, typed)
          }

          // \`change\`, never \`input\`: ui-text-field commits on Enter or blur-with-change (text-field.ts's
          // own baseline-gated pair) — the fleet's per-field-on-change law this whole section follows.
          field.addEventListener('change', commitRename)
          field.addEventListener('keydown', (event) => {
            if ((event as KeyboardEvent).key !== 'Escape') return
            // Local cancel: swallow it so an ancestor (a ui-disclosure fold, a menu) never also acts on the
            // same Escape — the rename is what the user is dismissing.
            event.stopPropagation()
            closeRename()
          })
          // A blur that changed NOTHING fires no \`change\` at all — close anyway, so the row never keeps a
          // stale open field. A blur that DID change the text already committed through \`change\` (dispatched
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

      if (!entry.builtin && !withDrawer) {
        // TKT-0048: a real \`<ui-button>\` — its label is a plain word ("Remove"), never a glued glyph, so
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
      // above is inert by construction — \`activeField\` can never match a field that does not exist).
      // GH #917 — a DRAWERED section is the second inert case: the body is edited in the drawer's form, so
      // the row carries no editor and there is again nothing for the preservation dance to preserve. That
      // asymmetry is the point of the move — a form built ON OPEN cannot be eaten by an external re-render.
      const contentField = withContentField && !withDrawer ? (document.createElement('ui-code-editor') as UICodeEditorElement) : null
      if (contentField) {
        contentField.language = 'markdown' // ADR-0139 — markdown-highlighted source editing (CM lazy-loaded)
        contentField.rows = 4 // TKT-0049: the saved, potentially longer per-entry content — bigger than the add-form's draft field
        contentField.setAttribute('data-part', 'entry-content')
        contentField.setAttribute('aria-label', \`\${entry.label} content\`)
        // Restore an in-progress, uncommitted edit for THIS entry (captured above) rather than the
        // possibly-stale \`entry.content\` from the store — the whole point of the preservation above.
        contentField.value = entry.id === activeId && preservedValue !== undefined ? preservedValue : entry.content
        contentField.addEventListener('change', () => handlers.onContentChange(entry.id, contentField.value))
        row.append(contentField)
      }

      // GH #1062 — the DRAWERED row's INLINE Content surface: the drawer move (GH #917 above) took the
      // per-row editor with it, leaving cards that show only name + description; this puts the body back
      // on the card without reopening the eaten-mid-edit hazard the move fixed for the drawer form —
      // the field commits on \`change\` (blur), and an uncommitted edit is rescued across an external
      // rebuild by the same capture/restore dance the non-drawered editor above has always run.
      //
      // Shape: a \`ui-disclosure\` fold, COLLAPSED by default (long Content must not dominate the pane —
      // the pane's own \`settingsItem\` fold convention, one level down), holding the SAME
      // \`<ui-code-editor language="markdown">\` the drawer form (\`entry-form.ts\`) and the non-drawered row
      // editor above already mount (GH #1102, Kim's ruling — the original "stays dependency-light"
      // rationale for a plain \`ui-textarea\` here was falsified: ADR-0139's lazy-load cost is already paid
      // package-wide, the tag registers CodeMirror-free and the CM runtime arrives per mount via editor.ts's
      // own dynamic import; this module still imports only the TYPE). Writes ride \`handlers.onContentChange\`
      // — the SAME writer the drawer form commits through (\`entry-form.ts\` line-for-line), so persistence,
      // preset protection and the store seam all keep their one home.
      //
      // Built for BUILTIN rows too, deliberately: \`builtin: true\` protects DELETION only (ADR-0132
      // Fork 4 + ADR-0178 Amendment — host-seeded content is hand-editable everywhere already; the
      // drawer's own form mounts its content editor for builtins, and this matches that gating exactly).
      if (withContentField && withDrawer) {
        const fold = document.createElement('ui-disclosure') as UIDisclosureElement
        fold.setAttribute('data-part', 'entry-content-fold')
        fold.summary = 'Content'
        fold.open = openFolds.has(entry.id) // survive an external rebuild; a fresh row starts collapsed
        const inline = document.createElement('ui-code-editor') as UICodeEditorElement
        inline.language = 'markdown' // ADR-0139 — markdown-highlighted source editing (CM lazy-loaded)
        inline.setAttribute('data-part', 'entry-inline-content')
        inline.setAttribute('aria-label', \`\${entry.label} content\`) // the non-drawered row editor's own labelling shape
        inline.rows = 4 // TKT-0049's saved-content size, matching the non-drawered row editor above
        inline.value = entry.id === activeId && preservedInlineValue !== undefined ? preservedInlineValue : entry.content
        // \`change\`, never \`input\` (ui-code-editor's blur-with-change commit, ADR-0139 cl.6) — the fleet's
        // per-field-on-change law, byte-identical timing to the row editor this restores.
        inline.addEventListener('change', () => handlers.onContentChange(entry.id, inline.value))
        fold.append(inline)
        row.append(fold)
        if (entry.id === activeId && preservedInlineValue !== undefined) {
          // The same already-flushed discipline as the code-editor restore below: the \`.value =\` write
          // lands via the render effect, so the caret collapse must wait for the flush.
          void inline.updateComplete.then(() => inline.selectToEnd())
        }
      }
      list.append(row)

      // Focusing only works once \`contentField\` is actually connected to the document — calling
      // \`.focus()\` before \`list.append(row)\` is a silent no-op in real browsers (the element isn't
      // part of the rendered tree yet), which is what let this ship broken past the jsdom leg.
      // \`selectToEnd()\` (ADR-0134's migration seam) focuses the editor part AND collapses the caret to the
      // end in one call — the ui-textarea-friendly equivalent of the native
      // \`.focus()\` + \`.setSelectionRange(len, len)\` pair a contenteditable host does not expose.
      // component-reviewer MINOR fix: the \`.value =\` write above lands its model→surface sync
      // asynchronously (the render effect), so calling \`selectToEnd()\` synchronously here would
      // collapse the range against a not-yet-populated editor (\`selectNodeContents\` on an empty node
      // caret-collapses to 0, not the end) — focus alone still lands (verified in the cross-engine
      // suite), but the caret position wouldn't. Await the flush first.
      if (contentField && entry.id === activeId && preservedValue !== undefined) {
        void contentField.updateComplete.then(() => contentField.selectToEnd())
      }
    }
    applyNotices() // GH #419 — a rebuild must not drop a live notice (the map outlives any one render)
    // GH #564 — a \`rejectOnCollision\` kind's add/delete just changed what's "already in the list"; rebuild
    // the picker so a newly-collided row disables (or a deleted one re-enables), never a stale menu. Gated
    // on the flag so every other kind's render stays exactly as before (no picker rebuild at all).
    // GH #783/LLD-C5 — the gate also fires when ANY offered PACK carries its own \`rejectOnCollision\`, so a
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
      // \`role="status"\` (not \`alert\`): a hint about text the author is looking at, announced politely —
      // never an interruption, matching the non-blocking law this notice ships under.
      note.setAttribute('role', 'status')
      note.textContent = message
      // Directly under the header, ABOVE the content it is about — the author reads the warning before
      // the text it names (the \`entry-description\` position, which the notice sits beside).
      row.querySelector('[data-part="entry-header"]')?.after(note)
    }
  }

  function showNotices(next: ReadonlyMap<string, string>): void {
    notices = next
    applyNotices()
  }

  /** GH #143 — swap the library menu for one built from \`libraries\`, in place — see \`refreshLibraryMenu\`'s
   *  own doc comment above for the mechanics; this just points it at a new pack list. */
  function updateLibraries(libraries: readonly EntryLibraryPack[]): void {
    currentLibraries = libraries
    refreshLibraryMenu()
  }

  const built: EntryListSection = { host: section, render, updateLibraries, showNotices }
  errorSinks.set(built, showError)
  return built
}

/** GH #917 — each mounted section's own error ROUTER (\`showError\`), keyed by the section object
 *  \`mountEntryList\` returned. A private registry rather than a member on \`EntryListSection\`: the routing is
 *  this module's internal business (which of a section's up-to-two error surfaces is live right now), and
 *  \`showAddError\` below stays the ONE exported way a caller surfaces a rejection — its signature, doc and
 *  fail-soft posture unchanged. A \`WeakMap\` so a discarded section is collectable. */
const errorSinks = new WeakMap<EntryListSection, (message: string) => void>()

/** Show \`message\` in the add form's own error note (fail-closed validation feedback, ADR-0132 cl.4) —
 *  exported so \`agent-admin.ts\` can surface \`validateNewEntry\`'s rejection without this module owning
 *  the validation call itself (the caller decides WHEN to validate; this module only renders the result).
 *  WHERE it lands is the section's own routing (GH #917 — beside the Name field in an open add drawer, the
 *  section's standing note otherwise, the dashed form's note for a non-drawered section).
 *  ADR-0170 cl.8: a section built with \`customAdd: false\` mounts no form to show it in — a rejected
 *  LIBRARY add there is a silent no-op rather than a thrown null-deref (the add path itself already
 *  fail-closes; this is the display half having nowhere to land). A section object this module did not
 *  build (a hand-rolled test stub) falls back to the DOM query this function has always used. */
export function showAddError(section: EntryListSection, message: string): void {
  const sink = errorSinks.get(section)
  if (sink !== undefined) {
    sink(message)
    return
  }
  const note = section.host.querySelector('[data-part="entry-add-error"]') as HTMLElement | null
  const form = section.host.querySelector('[data-part="entry-add-form"]') as HTMLElement | null
  if (note === null || form === null) return
  note.textContent = message
  note.hidden = false
  form.hidden = false
}
`,x=`// entry-data.ts — the generic ordered-entry-list DATA CORE (ADR-0164 cl.2, split out of agent-admin's
// \`entries.ts\`, itself ADR-0132 \`n1\`): a named, ordered, toggleable entry within a typed list,
// parameterized by a bare \`kind: string\`. Types + pure data/logic only (the settings/schema.ts
// precedent) — \`entry-list.ts\` owns the rendering, a consumer (agent-admin.ts today) owns the domain
// layer (kind constants, seeded defaults, system-prompt projection) and the composition.
//
// The split line is mechanical (ADR-0164 cl.2): anything naming a kind constant, a seeded default, or
// the system-prompt projection is domain and stays with the consumer; anything parameterized by bare
// \`kind: string\` is core and lives here. Custom-entry depth is DELIBERATELY generic (ADR-0132 Fork 3):
// label + description + free-text content, uniform across every kind — a kind-specific schema (e.g. a
// Tool's parameter list) is an explicitly deferred, separately-scoped future extension, not built here.

/** GH #850 / capability-availability-tagging.spec.md SPEC-R1 — the two AVAILABILITY modes: HOW an
 *  ENABLED entry is reachable. \`context\` = ambient (the model sees it every turn — the only behaviour
 *  before this field existed); \`invocable\` = inert until the user invokes it from the composer. A literal
 *  union off an \`as const\` object, never an \`enum\` (the tsconfig's \`erasableSyntaxOnly\`). */
export const ENTRY_AVAILABILITY = { context: 'context', invocable: 'invocable' } as const
export type EntryAvailability = (typeof ENTRY_AVAILABILITY)[keyof typeof ENTRY_AVAILABILITY]

export interface Entry {
  id: string
  kind: string
  label: string
  description: string
  content: string
  /** Ascending sort order within its kind — ties broken by \`id\` (stable, deterministic). */
  order: number
  /** Toggle state — a disabled entry is skipped by a domain consumer's own composition (e.g.
   *  \`composeSystemPrompt\`), but is NEVER removed from the list (ADR-0132 Fork 4). */
  enabled: boolean
  /** A built-in entry can be toggled but never deleted (ADR-0132 Fork 4) — enforced by the UI
   *  (\`entry-list.ts\` renders no delete affordance for \`builtin: true\`), not by this module. */
  builtin: boolean
  /** SPEC-R1 (GH #850) — HOW this entry is reachable, ORTHOGONAL to \`enabled\` (which stays "is this entry
   *  active at all"): no read site may collapse the two. ABSENT reads as \`'context'\` at every read site
   *  (\`entryAvailability\` below) — a READ-TIME default, never a migration write, so every stored config,
   *  export/import payload, and library pack authored before this field is unchanged byte-for-byte (the
   *  \`readCatalogEntries\` read-time-guarantee precedent). Semantics are defined for the FOUR capability
   *  kinds only (skill/workflow/resource/tool — \`entries.ts\`'s \`AVAILABILITY_KINDS\`); on any other kind
   *  the member is inert: readable, meaningless, and never branched on. */
  availability?: EntryAvailability
}

/** SPEC-R1's read-time default, in ONE place: anything that is not exactly \`'invocable'\` — the member
 *  absent (every entry written before the field existed), or a hand-edited persona file's garbage value —
 *  reads as \`'context'\`, i.e. exactly today's ambient behaviour. Fail-soft by construction: no read site
 *  ever sees \`undefined\`, and no store is ever written to make that true. */
export function entryAvailability(entry: { availability?: string }): EntryAvailability {
  return entry.availability === ENTRY_AVAILABILITY.invocable ? ENTRY_AVAILABILITY.invocable : ENTRY_AVAILABILITY.context
}

/** SPEC-R3's ONE conjunct, shared by every AMBIENT projection (the live system prompt, the \`integrations\`
 *  wire, the config snapshot's label lists): an entry contributes ambient bytes iff it is \`enabled\` AND
 *  in-context. \`enabled\` keeps its own meaning untouched — availability is a THIRD conjunct, never a
 *  replacement — so a store in which no entry is \`invocable\` projects byte-identically to before the
 *  field existed (the gated-equivalence law, SPEC-R3 AC3). */
export function isAmbient(entry: Entry): boolean {
  return entry.enabled && entryAvailability(entry) === ENTRY_AVAILABILITY.context
}

/** The store key one kind's entry list lives under — \`entries:\${kind}\`, one array value per kind (the
 *  \`SettingsStore\` \`get\`/\`set\` contract already handles arbitrary JSON-serializable \`unknown\` values). */
export function entriesStoreKey(kind: string): string {
  return \`entries:\${kind}\`
}

/** Read one kind's entry list from a store, defensively: a bring-your-own store, a corrupt/foreign
 *  localStorage value, or a store that never seeded this key all degrade to an empty list, never throw. */
export function readEntries(store: { get(key: string): unknown } | undefined, kind: string): Entry[] {
  const raw = store?.get(entriesStoreKey(kind))
  return Array.isArray(raw) ? (raw as Entry[]) : []
}

/** A slug id from a label — lowercase, non-alphanumeric runs collapsed to one hyphen, trimmed. Falls
 *  back to \`entry\` if the label is entirely non-alphanumeric (e.g. all emoji/punctuation) — never an
 *  empty id. Exported (GH #564) so \`entry-list.ts\`'s add-from-library picker can predict a pack entry's
 *  resulting id — the SAME resolution \`validateNewEntry\` uses below — to know whether it would collide. */
export function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'entry'
}

export interface NewEntryInput {
  label: string
  description: string
  content: string
  /** ADR-0168 cl.2 / LLD-C7 — an OPTIONAL stable id that wins over the \`slugify(label)\` default. A pack
   *  whose entries key an EXTERNAL vocabulary (the Integrations pack: its entries ARE the dev proxy's
   *  registry ids) supplies it, so the id survives a label edit and the display label is free to be human
   *  text — the three-facts law (id ≠ tool.name ≠ label) reaching the admin store. Every hand-authored
   *  entry and every pack that omits it keeps slugify-from-label EXACTLY as before; collision dedup (the
   *  suffix counter below) applies to an explicit id the same as a slugged one. */
  id?: string
}

// ── Entry libraries (GH #47/#48) — packs of ready-to-add entries ────────────────────────────────────────
// A library pack is pure DATA (the ADR-0132 cl.1 law: a capability surface grows by data, never by new
// list/toggle/author code): a named collection of \`NewEntryInput\`s for ONE kind, offered by the entry
// list's add-from-library affordance and committed through the SAME \`validateNewEntry\` path as a
// hand-authored entry (slug-dedup, order, enabled, deletable — a library add IS a custom add with the
// typing done). Packs live with their consumer (page-local, the presets precedent); the component only
// renders whatever packs it is handed.
export interface EntryLibraryPack {
  /** Stable kebab id — unique within the kind's pack list. */
  id: string
  /** Display name ("A2UI composition idioms", "Hospitality"). */
  label: string
  /** One-line pack description (menu row tooltip). */
  description: string
  /** Ready-to-add entry inputs, in menu order. */
  entries: readonly NewEntryInput[]
  /** GH #783/LLD-C5 (SPEC-R6 AC1) — GH #564's foreign-key law at PACK grain: this pack's entries key an
   *  external registry, so a colliding id is a duplicate to REJECT, never a name clash to suffix. Absent ⇒
   *  the shipped suffix behavior for every existing pack (byte-identical). A \`rejectOnCollision\` PACK
   *  offered under an ordinary (non-catalog) kind gets the same reject-on-commit + picker-disable the
   *  catalog KIND flag gets, without the kind itself becoming registry-keyed — the vehicle a live-derived
   *  services pack (GH #783 S4) rides. Generic vocabulary — no service-registry semantics reach this
   *  module: this package stays opaque to whatever external registry a flagged pack keys (SPEC-R6/N1). */
  rejectOnCollision?: boolean
}

export type ValidateNewEntryResult = { ok: true; entry: Entry } | { ok: false; error: string }

/** GH #564 — \`validateNewEntry\`'s own additive options bag (the SAME law \`EntryListOptions\` follows,
 *  entry-list.ts): new members are optional with a default that is byte-identical for every existing
 *  caller. */
export interface ValidateNewEntryOptions {
  /** \`true\` for a kind whose entry id is a FOREIGN KEY into an external registry (the catalog kind,
   *  ADR-0170 cl.8) — a colliding id there is a genuine DUPLICATE (re-adding the SAME registered catalog
   *  mints a second identical-looking card), not a name clash a suffix can resolve; mangling the id "would
   *  be the very coupling this widening exists to break" (see the comment below). \`false\`/absent — every
   *  hand-authored kind (e.g. two "Rules" prose entries legitimately coexisting) — keeps the suffix
   *  counter exactly as before. */
  rejectOnCollision?: boolean
}

/** Fail-closed validation for a new custom entry (ADR-0132 cl.4): a required, non-empty \`label\`, and an
 *  id that doesn't collide with an existing entry of the SAME kind. GH #564 — the collision itself now
 *  branches on \`options.rejectOnCollision\` (default \`false\`): a suffix counter resolves it (a friendlier
 *  failure mode than forcing the author to rename) UNLESS the caller flags this kind's id as a foreign
 *  key, in which case the add is rejected outright instead of minting an unregistered \`\${base}-2\` row.
 *  The id is \`input.id\` when the caller supplies one (LLD-C7: a pack keying an external vocabulary), else
 *  \`slugify(label)\` exactly as before. Never mutates \`existing\`.
 *
 *  SPEC-R1 (GH #850) — the returned entry deliberately carries NO \`availability\` member: a new entry (hand-
 *  authored and pack alike) is in-context by ABSENCE, read-side, never by a written value, so this shape is
 *  byte-identical to the one every pre-#850 caller already gets. \`NewEntryInput\` gains nothing. */
export function validateNewEntry(
  existing: readonly Entry[],
  kind: string,
  input: NewEntryInput,
  options?: ValidateNewEntryOptions,
): ValidateNewEntryResult {
  const label = input.label.trim()
  if (label.length === 0) return { ok: false, error: 'A name is required.' }

  // An explicit id is trimmed but NEVER slugged — it is a foreign key (a registry id), so mangling it
  // would be the very coupling this widening exists to break. An empty/blank one falls back to the slug.
  const base = input.id?.trim() ? input.id.trim() : slugify(label)
  const usedIds = new Set(existing.map((e) => e.id))
  let id = base
  if (usedIds.has(id)) {
    // GH #564 — a foreign-key id's collision IS the duplicate; reject rather than mint a second, dedup-
    // suffixed row that would still render the SAME pack label as a phantom copy.
    if (options?.rejectOnCollision) return { ok: false, error: 'Already in the list.' }
    let suffix = 2
    while (usedIds.has(id)) {
      id = \`\${base}-\${suffix}\`
      suffix += 1
    }
  }

  const maxOrder = existing.reduce((max, e) => Math.max(max, e.order), -1)
  return {
    ok: true,
    entry: {
      id,
      kind,
      label,
      description: input.description.trim(),
      content: input.content,
      order: maxOrder + 1,
      enabled: true,
      builtin: false,
    },
  }
}

/** GH #848 — rename ONE entry by id: a DISPLAY-NAME write and nothing else. \`label\` is trimmed; every
 *  other member — \`id\` above all — rides through untouched, so every FOREIGN-KEY id a pack supplied through
 *  \`NewEntryInput.id\` (a registry id, an ADR-0185 namespaced service ref, whatever external vocabulary the
 *  pack keys — this module stays opaque to all of them, SPEC-R6/N1) survives a rename, and everything that
 *  resolves by id (\`#enabledToolIds\` on the \`integrations\` wire, the host-side registry intersection, the
 *  catalog selection key) keeps working. The stored entry IS the display truth — no second "display
 *  name" field, so every existing surface that renders \`entry.label\` (the live prompt's \`### {label}\`
 *  blocks, the config snapshot's per-kind label lists, each row's own ARIA text) follows a rename with
 *  ZERO repoint sites.
 *
 *  Two fail-closed no-ops, both returning the list unchanged: an empty/whitespace-only label (the
 *  \`validateNewEntry\` "A name is required." law applied to the rename path — the caller's re-render then
 *  snaps the row back to the stored name, the \`#selectCatalog\` VISIBLE-no-op precedent) and an \`id\` no
 *  entry carries. Never mutates \`entries\` (a fresh array either way, so a caller can persist the result
 *  unconditionally).
 *
 *  Duplicate labels are ALLOWED, never rejected: \`validateNewEntry\` already lets two entries share a label
 *  and separates them by id (its own suffix-dedup case — "two same-name prose entries legitimately
 *  coexist"), so a rename that lands on a sibling's name is exactly as legal as adding one. Ids stay
 *  unique, so nothing downstream can confuse the two.
 *
 *  ORTHOGONAL to \`availability\` (GH #850/SPEC-R1) by construction: the spread copies whatever mode the entry
 *  carries — a renamed user-invocable entry stays user-invocable, and a rename never writes the field on an
 *  entry that omits it, so the read-time default (\`entryAvailability\`) and SPEC-R3's gated equivalence hold
 *  across a rename. The two per-entry writes touch disjoint members; neither is a read-modify-write that
 *  could drop the other's. */
export function renameEntry(entries: readonly Entry[], id: string, label: string): Entry[] {
  const next = label.trim()
  if (next.length === 0) return [...entries]
  return entries.map((entry) => (entry.id === id ? { ...entry, label: next } : entry))
}

/** GH #917 (the Phase 0 ruling's D2) — re-describe ONE entry by id: a DESCRIPTION write and nothing else, the
 *  \`renameEntry\` shape one member over. Description was settable at ADD time only until the per-entry Edit
 *  drawer made it a form field (\`entry-form.ts\`), so this is that field's law, in the same home as every other
 *  entry write: trimmed (matching \`validateNewEntry\`'s own \`description.trim()\` at mint time, so an added and
 *  an edited description are stored identically), never mutating \`entries\`, and a fail-closed no-op for an
 *  \`id\` no entry carries.
 *
 *  The ONE deliberate asymmetry with \`renameEntry\`: an EMPTY description is legal and is committed. A label is
 *  the entry's display identity (blank is a refusal, snapped back visibly); a description is optional
 *  annotation — \`validateNewEntry\` already mints entries with \`description: ''\`, and clearing one must
 *  therefore be as writable as setting it, or the field would be a one-way door.
 *
 *  ORTHOGONAL to \`label\`/\`availability\`/\`enabled\` by construction — the spread copies every other member
 *  untouched, so no two per-entry writes are a read-modify-write that could drop the other's field. */
export function describeEntry(entries: readonly Entry[], id: string, description: string): Entry[] {
  const next = description.trim()
  return entries.map((entry) => (entry.id === id ? { ...entry, description: next } : entry))
}
`,S=`// composer-options.ts — the composer's opt-in picker/context-chip vocabulary (ui-conversation). Types +
// pure data only — conversation.ts owns the rendering, a consumer (e.g. ui-agent-admin) owns supplying
// its own option lists + selected value. Generic on purpose: \`models\` is inherently host-specific (each
// consumer names its own model list), so ui-conversation never hardcodes one; \`effort\` is a fleet-wide
// concept every live-model consumer can share, so its option list is built in here as the one default.

/** One picker's selectable entry — reused for the Models/Effort/Provider/Mode pickers alike. */
export interface PickerOption {
  id: string
  label: string
  /** GH #257 — a non-committable option, rendered but never selectable (\`aria-disabled\`, ui-menu's own
   *  click/keydown delegation already skips it, menu.ts). The "coming soon" provider precedent
   *  (provider-switcher.ts's \`implemented:false\` roadmap entries) — optional, unused by Models/Effort today. */
  disabled?: boolean
}

/** GH #257 — one selectable provider: its OWN model list (narrows the composer's Models picker while this
 *  provider is selected) and the model a provider switch resets to when the CURRENT model doesn't belong
 *  to the new provider's list (mirrors \`provider-switcher.ts\`'s own \`defaultModel\` reset exactly). A model
 *  belongs to exactly one provider — this is why \`providers\`/\`provider\` narrows the SAME \`models\`/\`model\`
 *  picker rather than standing up an independent fourth axis. */
export interface ProviderOption extends PickerOption {
  models: readonly PickerOption[]
  defaultModel: string
}

/** A dismissable context indicator shown above the composer field (e.g. "something was selected
 *  elsewhere and is attached to this turn's context"). \`id\` is opaque to ui-conversation — round-tripped
 *  to the consumer's own \`onContextDismiss\` callback so it knows WHICH item to drop from its own state. */
export interface ContextItem {
  id: string
  label: string
}

/** GH #849 (capability-availability-tagging.spec.md SPEC-R6) — ONE selectable entry of a composer
 *  reference roster: the \`mentionables\` (\`@\`) or \`invocables\` (\`/\`) list a consumer injects. GENERIC by
 *  construction (the SPEC's layering clause): \`kind\` is an OPAQUE string this element only groups and
 *  displays — the composer never learns \`Entry\`, a store, or any kind's semantics; \`ui-agent-admin\` owns
 *  that projection exactly as it already owns \`PickerOption\`'s. \`description\` is optional secondary text
 *  shown under the label in the typeahead. */
export interface ReferenceOption {
  id: string
  label: string
  kind: string
  description?: string
  /** GH #891 (SPEC-R9) — OPTIONAL: a \`ui-icon\` glyph name identifying this entry's KIND on the committed
   *  chip (and, GH #891 ask 3, on a capabilities row). OPAQUE to the composer, exactly as \`kind\` is: this
   *  element renders the glyph it is handed and never maps a kind to one — the CONSUMER owns that table
   *  (\`ui-agent-admin\`'s \`KIND_GLYPHS\`), the SPEC's §5 layering clause. Absent ⇒ a label-only chip (the
   *  generic-consumer default), never a placeholder box. */
  icon?: string
}

/** GH #849 (SPEC-R6) — the STRUCTURED reference a committed mention/invocation attaches to a turn, and
 *  the ONLY load-bearing representation of one (the SPEC's "never bare text" clause): the composer hands
 *  these to \`onSubmit\`'s second argument, and the consumer resolves by \`id\` (GH #402's id-not-label law —
 *  \`label\` rides for display + the turn log only). \`kind\` is the same opaque string its \`ReferenceOption\`
 *  carried, round-tripped verbatim. */
export interface TurnReference {
  id: string
  label: string
  kind: string
  /** GH #891 (SPEC-R9 AC2) — the \`ReferenceOption.icon\` this reference was committed from, round-tripped
   *  VERBATIM exactly as \`kind\` is (absent when the roster entry carried none). It rides so a consumer can
   *  render the same kind mark on the SENT turn (SPEC-R10's bubble tags) without re-deriving the mapping
   *  it already owns; resolution is still by \`id\` alone (GH #402), and nothing here is load-bearing on the
   *  wire (SPEC-R4's resolution never reads it). */
  icon?: string
}

/** GH #891 (capability-availability-tagging.spec.md SPEC-R11) — ONE row of the composer's capabilities
 *  panel: the BROWSE/STEER surface beside the \`@\`/\`/\` typeahead's keyboard-first quick path. GENERIC by the
 *  same construction as \`ReferenceOption\` (the SPEC's §5 layering clause): \`kind\` and \`icon\` are OPAQUE
 *  strings this element groups/renders and never interprets, and \`included\` is CONSUMER-OWNED state — the
 *  composer renders it, reports a flip through \`onCapabilityToggle\`, and mutates nothing (props down,
 *  callbacks up, the \`onModelChange\` law verbatim).
 *
 *  What \`included\` MEANS — a per-turn inclusion vs a persisted roster write — is deliberately NOT decided
 *  here: it is the consumer-side fork of ADR-0190 (SPEC-R12), and this contract is identical under either
 *  arm because the composer never writes a store under either. */
export interface CapabilityRow {
  id: string
  label: string
  kind: string
  description?: string
  /** A \`ui-icon\` glyph name, same opaque-string law as \`ReferenceOption.icon\` (SPEC-R9). */
  icon?: string
  /** Whether this capability is currently steered ON. Reflected onto the row's \`ui-switch\`; never written
   *  by this element — a flip fires \`onCapabilityToggle(id, included)\` and the CONSUMER hands a new
   *  \`capabilities\` array down. */
  included: boolean
}

/** The reasoning-effort levels a live model call can be dialed to — the same low/medium/high/xhigh
 *  vocabulary this repo's own agent-authoring tooling already uses for a seat's reasoning tier, reused
 *  here rather than inventing a parallel scale. */
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh'

export const EFFORT_LEVELS: readonly PickerOption[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'X-High' },
]
`,C=`// persona-patch.ts — the CANONICAL persona-state key set and the three-filter apply gate a declared
// \`personaPatch\` (SPEC-R29) passes through before a single byte reaches a draft persona's store
// (ADR-0178 cl.2, LLD \`agent-authoring-flow.lld.md\` §3).
//
// WHY THIS MODULE EXISTS, and why the key set lives HERE rather than in the site's persona-file: the set
// describes COMPONENT state (exactly what \`composeLiveSystemPrompt\` reads at turn time); the persona FILE
// format is one consumer of it, and the apply gate is another. Two hand-maintained enumerations of the same
// truth is the silent-divergence class GH #406 closed for the file half — hoisting it to the one package
// both consumers already import (site → app is the DAG's normal direction) keeps that closed as the second
// consumer lands. \`site/pages/agent-admin-persona-file.ts\` re-exports the set, so every existing importer
// keeps its symbol.
//
// THE ADMISSION LAW (the fork the LLD rules, restated because it is the clause most at risk of drift): the
// shipped sanitizers COERCE — \`sanitizeModel\` answers DEFAULT_MODEL_ID for garbage, \`sanitizeCatalog\`
// answers the default id. That read-time law is right for READS and catastrophic for an APPLY gate: coercing
// a model's garbage into a plausible default would write a wrong-but-valid-looking value into the user's
// draft and call it the model's intent. So admission is a FIXPOINT test over those same sanitizers — a value
// is admitted iff its own sanitizer returns it UNCHANGED — which reuses each sanitizer's judgment without
// inventing a second validation vocabulary, and makes every rejection a DROP (recorded on the turn log,
// ADR-0178 cl.2's degrade posture) rather than a coercion or an error surface.
//
// NO DELETION SEMANTICS exist here, by construction: entries APPEND or (ADR-0178's Amendment, ratified
// 2026-08-13, GH #696) UPDATE a host-seeded builtin prompt section IN PLACE — never remove, never empty, so
// SPEC-R29's no-deletion law still has no code path to misuse — and values merge per-key whole-value
// last-writer-wins, where the store write IS that semantics.
//
// THE UPDATE CARVE-OUT, and why it is exactly this narrow: cl.2's append-only entries law was derived to
// protect a USER's own authored entries. Applied uniformly it also froze the three HOST-seeded placeholder
// sections (\`DEFAULT_PROMPT_SECTIONS\` — Foundation/Personality/Critical Items), so an authored agent's real
// identity could only land as a FOURTH section below three unchanged generic placeholders, and
// \`composeSystemPrompt\` shipped "You are a helpful assistant." ahead of the persona forever. Content nobody
// authored was the one thing the flow could never fix. \`builtin: true\` means NON-DELETABLE only (ADR-0132
// Fork 4 — \`entry-list.ts\` withholds the Remove affordance), never immutable: the content editor already
// mounts for every prompt-section row, so a builtin's content is hand-editable today. The amendment
// therefore admits a SECOND verb beside APPEND, for that class alone (\`updateTargetIndex\` below is the whole
// fence), and pairs it with the concurrency mitigation \`name\`/\`model\`/\`temperature\` already rely on:
// \`draftStateBlock\` carries the builtin sections' CURRENT content, so last-writer-wins over a hand-editable
// field is something the model can actually read before it writes.

import {
  A2UI_CATALOG_KEY,
  A2UI_LOCAL_PATTERNS_KEY,
  AGENT_ENABLED_KEY,
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  MODELS_INCLUDED_KEY,
  SURFACE_A2UI_KEY,
  SURFACE_AUTHORING_KEY,
  SURFACE_GENUI_DOGFOOD_KEY,
  SURFACE_GENUI_KEY,
  SURFACE_MARKDOWN_KEY,
  SURFACE_PLANNER_KEY,
  kindEnabledKey,
  sanitizeBankroll,
  sanitizeCatalog,
  sanitizeLocalPatterns,
  sanitizeModel,
  type SupportedModel,
} from './agent-admin-schema.ts'
import { sanitizeNumber } from '@agent-ui/shared'
import type { SettingsSchema } from '../settings/schema.ts'
import { ENTRY_KINDS } from './entries.ts'
import { entriesStoreKey, readEntries, validateNewEntry, type Entry, type NewEntryInput } from '../entry-list/entry-data.ts'

/** The six-plus entry-list store keys — one per \`ENTRY_KINDS\` member, derived, never hand-listed. */
export const PERSONA_ENTRY_LIST_KEYS: readonly string[] = Object.values(ENTRY_KINDS).map((kind) => entriesStoreKey(kind))

/** The ONE entry list the update verb reaches (ADR-0178's amendment: \`kind === 'prompt-section'\`), derived
 *  from the kind rather than spelled as a literal so a kind rename cannot silently widen or void the fence. */
const PROMPT_SECTION_KEY: string = entriesStoreKey(ENTRY_KINDS.promptSection)

/** Every persona-scoped store key, in a stable order (a Set: \`kindEnabledKey('tool')\` IS the pre-existing
 *  \`toolsEnabled\` config key — one key, two readers). Order is the JSON key order of an exported persona
 *  file, so two exports of the same state are byte-identical strings.
 *
 *  GH #640 (Kim's ruling) — \`SURFACE_PLANNER_KEY\` joins the set here. Its omission was pre-persona-file
 *  drift, not a decision: it is a persona-scoped Surface Option exactly like the four keys around it, so a
 *  planner-enabled persona used to re-import with the capability silently reverted to the inverse default. */
export const PERSONA_STATE_KEYS: readonly string[] = [
  ...new Set([
    // the agent config (the settings pane's own fields + the Model grid's selection/inclusion record)
    'name',
    'model',
    'temperature',
    MODELS_INCLUDED_KEY,
    // the master switches — the Agent card's own, plus one per capability kind
    AGENT_ENABLED_KEY,
    ...Object.values(ENTRY_KINDS).map((kind) => kindEnabledKey(kind)),
    // Surface Options (the output-modality contract)
    SURFACE_MARKDOWN_KEY,
    SURFACE_A2UI_KEY,
    SURFACE_GENUI_KEY,
    SURFACE_GENUI_DOGFOOD_KEY,
    // ADR-0174 cl.1 / SPEC-R21 — the planner-stage opt-in (GH #640's ruled fix, above).
    SURFACE_PLANNER_KEY,
    // ADR-0178 cl.3 / SPEC-R30 — the persona-authoring modality gate. Persona-scoped like every other
    // Surface Option, so an exported Builder-shaped persona re-imports with its authoring capability
    // intact instead of silently reverting to the inverse default (OFF).
    SURFACE_AUTHORING_KEY,
    A2UI_CATALOG_KEY,
    // M-D SPEC-R5 — the persona's local-pattern-set SELECTION (never its definitions, which are
    // package-shipped code, SPEC-R1): symmetrical in storage shape to A2UI_CATALOG_KEY above.
    A2UI_LOCAL_PATTERNS_KEY,
    // GH #525 — the persistent-bankroll capability opt-in + its own persisted figure.
    BANKROLL_CAPABLE_KEY,
    BANKROLL_KEY,
    // the entry lists
    ...PERSONA_ENTRY_LIST_KEYS,
  ]),
]

/** The VALUE half of the canonical set — every persona key that is not an entry list. A patch's \`values\`
 *  member may name these and nothing else (§3 filter 1). */
export const PERSONA_VALUE_KEYS: readonly string[] = PERSONA_STATE_KEYS.filter((key) => !PERSONA_ENTRY_LIST_KEYS.includes(key))

/** The minimum a store must offer to be exported — \`SettingsStore\`'s \`get\`, nothing else. */
export interface PersonaStateReader {
  get(key: string): unknown
}

/** The read/write surface \`applyPersonaPatch\` needs — \`SettingsStore\`'s \`get\`/\`set\`, nothing else. */
export interface PersonaStateStore extends PersonaStateReader {
  set(key: string, value: unknown): void
}

/** The persona-scoped state a store currently answers, restricted to \`PERSONA_STATE_KEYS\` and to keys the
 *  store actually holds (an unset key is OMITTED, never written as \`undefined\` — the component's own
 *  fail-closed reads supply every default, and an omitted key must stay omitted for a round trip to be
 *  deep-equal). */
export function readPersonaState(store: PersonaStateReader | undefined): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  for (const key of PERSONA_STATE_KEYS) {
    const value = store?.get(key)
    if (value !== undefined) state[key] = value
  }
  return state
}

/** The draft-state block a guided-authoring turn appends to the interviewer's composed persona (LLD §2's
 *  draft-state-feedback row): the SAME canonical projection the persona file exports, serialized fresh per
 *  turn so the interviewer sees what is established versus missing — INCLUDING the user's concurrent hand
 *  edits, which is the whole reason SPEC-R29's merge law is incremental.
 *
 *  Entry lists collapse to their labels: the interviewer needs to know WHICH sections/skills exist, never
 *  their bodies, and a full draft's prompt-section content would dominate the turn's context.
 *
 *  ONE bounded exception (ADR-0178's ratified amendment, GH #696 — part of the ruling, not an implementation
 *  detail): the BUILTIN prompt sections carry their current \`content\` too. Those are the only entries a patch
 *  may overwrite, they are hand-editable by the user in the same breath, and last-writer-wins over a field
 *  the model cannot see is how "the user's hand edit wins — read the state and carry on" stops being
 *  enforceable. Bounded to exactly those bodies: every other member, including the model's OWN appended
 *  sections, stays a bare label (the size rationale above is untouched for everything else). */
export function draftStateBlock(store: PersonaStateReader | undefined): string {
  const state = readPersonaState(store)
  const summary: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    summary[key] = PERSONA_ENTRY_LIST_KEYS.includes(key) && Array.isArray(value)
      ? value.map((item) => {
          if (typeof item !== 'object' || item === null) return String(item)
          const entry = item as Entry
          if (key === PROMPT_SECTION_KEY && entry.builtin === true) {
            return { id: entry.id, label: entry.label ?? '', content: entry.content ?? '' }
          }
          return entry.label ?? ''
        })
      : value
  }
  return \`## The draft agent's current configuration\\n\\nThis is the draft as it stands RIGHT NOW, re-read at the start of every turn (the user may also be hand-editing it between turns). Keys absent here are unset. Steer the interview toward what is still missing, and never re-ask for something already established.\\n\\n\${JSON.stringify(summary, null, 2)}\`
}

// ── filter 2: the per-key admission table (fixpoint checks over the shipped fail-closed readers) ─────────

/** The inputs a per-key admission predicate may consult — the SAME reads the component's own turn-time
 *  reads use, passed in rather than imported so the gate stays a pure function of its arguments. */
export interface PatchDeps {
  models: readonly SupportedModel[]
  schema: SettingsSchema
}

type Admit = (value: unknown, deps: PatchDeps) => boolean

/** Every switch-shaped key admits a LITERAL boolean only — never a truthy string/number. A stored
 *  non-boolean must not be able to turn a capability on by accident (each key's own fail-closed reader
 *  already refuses one; admitting it here would write a value those readers then ignore). */
const admitBoolean: Admit = (value) => typeof value === 'boolean'

/**
 * A MAP, not an object literal — and that is a correctness requirement, not a style preference.
 *
 * The keys looked up here come off the WIRE, so a model (or anything upstream of it) can name any string
 * at all. A plain-object lookup walks the PROTOTYPE CHAIN, and \`Object.entries\` over a \`JSON.parse\`d body
 * yields \`__proto__\`/\`toString\`/\`constructor\` as ordinary OWN keys — measured, before this was a Map:
 *
 *   • \`__proto__\` → \`ADMISSION['__proto__']\` is \`Object.prototype\`, not a function ⇒ TypeError
 *   • \`hasOwnProperty\`/\`valueOf\` → the inherited method is CALLED with a \`this\` of \`undefined\` ⇒ TypeError
 *   • \`toString\`/\`constructor\` → the inherited member returns something TRUTHY ⇒ the key is ADMITTED and
 *     WRITTEN, straight past filter 1's enumerated-key law
 *
 * The throws were the worse half: they escape \`applyPersonaPatch\` into the component's turn \`catch\`, which
 * fails the whole turn — violating §3's drop-the-ITEM-never-the-turn law and SPEC-R30's degrade posture,
 * from one malformed key. A \`Map\` has no prototype chain to walk, so both failure modes are gone by
 * construction rather than by a guard someone must remember at each lookup (the \`KIND_FOR_ENTRY_KEY\`
 * precedent, applied to the table that actually faces untrusted input).
 */
const ADMISSION: ReadonlyMap<string, Admit> = new Map<string, Admit>(Object.entries({
  // \`name\` is free text — the settings field's own \`required\` validation is a UI-level affordance, and an
  // empty name degrades to 'Untitled agent' at read time exactly as a hand-cleared field does.
  name: (value) => typeof value === 'string',
  model: (value, deps) => sanitizeModel(value, deps.models) === value,
  temperature: (value, deps) => typeof value === 'number' && sanitizeNumber(deps.schema, 'temperature', value, Number.NaN) === value,
  // The Model grid's inclusion record — a plain object of booleans, the ONE shape \`isModelIncluded\` reads.
  [MODELS_INCLUDED_KEY]: (value) =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => typeof v === 'boolean'),
  [AGENT_ENABLED_KEY]: admitBoolean,
  ...Object.fromEntries(Object.values(ENTRY_KINDS).map((kind) => [kindEnabledKey(kind), admitBoolean])),
  [SURFACE_MARKDOWN_KEY]: admitBoolean,
  [SURFACE_A2UI_KEY]: admitBoolean,
  [SURFACE_GENUI_KEY]: admitBoolean,
  [SURFACE_GENUI_DOGFOOD_KEY]: admitBoolean,
  [SURFACE_PLANNER_KEY]: admitBoolean,
  [SURFACE_AUTHORING_KEY]: admitBoolean,
  [BANKROLL_CAPABLE_KEY]: admitBoolean,
  [A2UI_CATALOG_KEY]: (value) => sanitizeCatalog(value) === value,
  [A2UI_LOCAL_PATTERNS_KEY]: (value) => sanitizeLocalPatterns(value) === value,
  [BANKROLL_KEY]: (value) => sanitizeBankroll(value) === value,
}))

/**
 * One human-readable VALUE SHAPE per patchable key — what a model must send for that key to be admitted.
 *
 * It lives here, beside the admission table, for one reason: SPEC-R29 makes the producer persona-key-
 * AGNOSTIC, so the key vocabulary can only reach a model from the host side, and a hand-listed vocabulary
 * would drift from the gate the moment a key changed — teaching a model to send something that then
 * silently drops. Declared as a sibling of \`ADMISSION\` and pinned key-for-key against
 * \`PERSONA_VALUE_KEYS\` by this module's own suite, so the two cannot diverge.
 */
export const PATCHABLE_VALUE_SHAPES: Readonly<Record<string, string>> = {
  name: 'a string — the agent’s display name',
  model: \`a model id, one of: \${'{roster}'}\`, // filled at compose time from the live roster
  temperature: 'a number from 0 to 1',
  [MODELS_INCLUDED_KEY]: 'an object of modelId → boolean (which models the picker offers)',
  [AGENT_ENABLED_KEY]: 'true or false — whether the agent is active at all',
  ...Object.fromEntries(
    Object.values(ENTRY_KINDS).map((kind) => [kindEnabledKey(kind), \`true or false — the \${kind} section’s master switch\`]),
  ),
  [SURFACE_MARKDOWN_KEY]: 'true or false — render replies as rich text',
  [SURFACE_A2UI_KEY]: 'true or false — structured generative UI',
  [SURFACE_GENUI_KEY]: 'true or false — sandboxed free-form generative UI',
  [SURFACE_GENUI_DOGFOOD_KEY]: 'true or false — use agent-ui components inside the GenUI frame',
  [SURFACE_PLANNER_KEY]: 'true or false — the sequential plan → execute → synthesize loop',
  [SURFACE_AUTHORING_KEY]: 'true or false — let this agent propose edits to a draft agent’s configuration',
  [BANKROLL_CAPABLE_KEY]: 'true or false — the agent keeps a persistent score at /bankroll',
  [A2UI_CATALOG_KEY]: 'a registered catalog id (leave it alone unless the user asks)',
  [A2UI_LOCAL_PATTERNS_KEY]: 'a shipped persona-pattern-set id (leave it alone unless the user asks)',
  [BANKROLL_KEY]: 'a non-negative number — the starting/current figure',
}

// ── filter 3: entries, through the pane's OWN add path ───────────────────────────────────────────────────

/** \`entries:skill\` → \`skill\`. The reverse of \`entriesStoreKey\`, over the enumerated kinds only (an
 *  unrecognized key never reaches here — filter 1 dropped it). */
const KIND_FOR_ENTRY_KEY: ReadonlyMap<string, string> = new Map(
  Object.values(ENTRY_KINDS).map((kind) => [entriesStoreKey(kind), kind]),
)

/** One proposed entry member → the \`NewEntryInput\` the pane's add form would have produced, or \`undefined\`
 *  when the member is not entry-shaped at all. \`label\` is the ONE required field (it is what
 *  \`validateNewEntry\` slugs an id from); \`description\`/\`content\` default to empty strings and \`id\` is
 *  admitted only as a string, matching the add form's own field types. */
function entryInputFrom(member: unknown): NewEntryInput | undefined {
  if (typeof member !== 'object' || member === null || Array.isArray(member)) return undefined
  const raw = member as Record<string, unknown>
  if (typeof raw.label !== 'string') return undefined
  return {
    label: raw.label,
    description: typeof raw.description === 'string' ? raw.description : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
  }
}

/** The fields an admitted UPDATE replaces on an existing builtin prompt section. Deliberately two, and
 *  deliberately not more (ADR-0178's amendment pins the scope): \`label\` · \`order\` · \`enabled\` · \`builtin\` ·
 *  \`kind\` · \`id\` are NEVER patchable — labels are the settings panes' stable anchors (GH #695 navigates by
 *  them), \`order\` is what keeps Foundation leading the composition, and a user's toggle state is the user's. */
interface EntryUpdateInput {
  content: string
  description?: string
}

/**
 * Is this member an UPDATE, and of which existing entry? Answers the index into \`existing\`, or \`-1\` for
 * "not an update" — in which case the caller takes TODAY's append path, byte-unchanged.
 *
 * THE WHOLE FENCE, in one predicate (ADR-0178's amendment): the list's kind must be \`prompt-section\`, the
 * member must carry a string \`id\`, and that id must name an entry ALREADY in this list that is
 * \`builtin: true\`. Every miss falls through to the append path rather than erroring: an id matching a
 * USER-authored (non-builtin) entry, an id matching nothing, a member with no id at all, and any member of
 * any other kind are all appends exactly as before — so a user's own entries stay append-protected, and a
 * persona whose imported store lacks the builtins degrades to an append with that id.
 *
 * The \`id\` is trimmed before matching, for parity with \`validateNewEntry\`'s own \`input.id?.trim()\`: the two
 * paths must agree about what a given wire id names, or the same member could update on one path and mint a
 * second row on the other.
 */
function updateTargetIndex(existing: readonly Entry[], key: string, member: unknown): number {
  if (key !== PROMPT_SECTION_KEY) return -1
  if (typeof member !== 'object' || member === null || Array.isArray(member)) return -1
  const id = (member as Record<string, unknown>)['id']
  if (typeof id !== 'string') return -1
  const trimmed = id.trim()
  if (trimmed === '') return -1
  return existing.findIndex((entry) => entry.id === trimmed && entry.builtin === true)
}

/** One proposed UPDATE member → the fields it replaces, or \`undefined\` when the update is malformed and the
 *  member must DROP. \`content\` is REQUIRED and must be non-empty after trim — an emptying update is a
 *  de-facto deletion of a section the user cannot delete either, so it drops and the no-deletion law stands
 *  whole. \`description\` is optional, and a present-but-non-string one drops the WHOLE member (the arm
 *  validates as a whole, SPEC-R29's own posture for a half-formed shape). Content is stored verbatim and the
 *  description trimmed — the exact asymmetry \`validateNewEntry\` already applies on the add path. */
function updateInputFrom(member: unknown): EntryUpdateInput | undefined {
  const raw = member as Record<string, unknown>
  const content = raw['content']
  if (typeof content !== 'string' || content.trim() === '') return undefined
  const description = raw['description']
  if (description !== undefined && typeof description !== 'string') return undefined
  return { content, ...(typeof description === 'string' ? { description: description.trim() } : {}) }
}

/** What one applied patch actually did — rides the turn log (never an error surface), so a dropped key is
 *  observable to whoever is debugging the interview without interrupting it (ADR-0178 cl.2). */
export interface PatchReport {
  /** Value keys written, in patch order. */
  applied: string[]
  /** Entry-list store key → how many entries were appended. */
  added: Record<string, number>
  /** Entry-list store key → the ids of the builtin entries UPDATED in place (ADR-0178's amendment). IDS, not
   *  a count, because an update-only patch is this flow's primary write class — the Foundation rewrite —
   *  which leaves \`applied\` AND \`added\` empty, so every consumer keyed on those two alone would silently miss
   *  exactly the change the reaction exists to surface (GH #695's trigger; cross-noted there 2026-08-11). The
   *  ids also give that consumer the section anchor to navigate to. */
  updated: Record<string, string[]>
  /** Every key or entry that was refused, named for the log (\`entries:skill[1]\` for a member). */
  dropped: string[]
}

/**
 * Apply one declared patch to \`store\` through ADR-0178 cl.2's three filters, in order, fail-closed at every
 * step — a drop removes the ITEM, never the patch, never the turn.
 *
 *   1. Enumerated-key filter — \`values\` keys must be ∈ \`PERSONA_VALUE_KEYS\`, \`entries\` keys ∈
 *      \`PERSONA_ENTRY_LIST_KEYS\`. A \`values\` key naming an entry list (or the reverse) is wrong INTENT, not
 *      a near-miss, and drops with everything else unknown.
 *   2. Per-key admission — the fixpoint table above. Admitted ⇒ \`store.set(key, value)\`, whole-value,
 *      last-writer-wins (SPEC-R29's pinned merge law; the store write IS that semantics).
 *   3. \`validateNewEntry\` — each proposed entry through the IDENTICAL call the pane's own add path makes,
 *      including \`{ rejectOnCollision: kind === ENTRY_KINDS.catalog }\` (GH #564: a catalog id IS a foreign
 *      key, so a collision is a duplicate, not something to dedup-suffix). Admitted entries APPEND, one
 *      \`store.set\` per kind — one write, one pane re-render. A member the \`updateTargetIndex\` fence claims
 *      (an existing BUILTIN prompt section named by \`id\`) instead UPDATES that entry's \`content\`
 *      (+\`description\`) in place, accumulating into the SAME single write — ADR-0132 cl.4's
 *      single-validated-ADD-path law is untouched, because an update is not an add: no id minting, no slug,
 *      no order assignment, and it never becomes a route around \`validateNewEntry\` for anything that IS one.
 *
 * CALLER'S DUTY: this function is gate-blind. Whether a patch may be consumed at all — the authoring-context
 * store-identity fence AND the fresh \`SURFACE_AUTHORING_KEY\` read, conjunctive (Kim's §15 option-(b) ruling)
 * — is the component's decision, made before it calls here.
 */
export function applyPersonaPatch(
  store: PersonaStateStore,
  patch: { values?: Record<string, unknown>; entries?: Record<string, unknown[]> },
  deps: PatchDeps,
): PatchReport {
  const report: PatchReport = { applied: [], added: {}, updated: {}, dropped: [] }

  for (const [key, value] of Object.entries(patch.values ?? {})) {
    const admit = ADMISSION.get(key)
    // Filter 1 and filter 2 collapse into one lookup: a key outside PERSONA_VALUE_KEYS has no admission
    // row (the table is built FROM the canonical set), so an unknown key and an entry-list key named in
    // \`values\` both fall out here.
    if (admit === undefined || !admit(value, deps)) {
      report.dropped.push(key)
      continue
    }
    store.set(key, value)
    report.applied.push(key)
  }

  for (const [key, members] of Object.entries(patch.entries ?? {})) {
    const kind = KIND_FOR_ENTRY_KEY.get(key)
    if (kind === undefined || !Array.isArray(members)) {
      report.dropped.push(key)
      continue
    }
    // \`next\` accumulates ACROSS this kind's members — updates in place, appends pushed — so a patch
    // proposing two entries with the same label gets the same id-collision treatment two sequential
    // add-form submissions would, and a mixed update+append patch still lands as ONE \`store.set\` (one
    // write, one pane re-render). Updates never change an \`id\`, so the running array is the same
    // collision universe \`[...current, ...admitted]\` was.
    const current: Entry[] = readEntries(store, kind)
    const next: Entry[] = [...current]
    const updatedIds: string[] = []
    let appended = 0
    for (const [index, member] of members.entries()) {
      // UPDATE is tested FIRST, but only ever claims a member the fence recognizes — everything else falls
      // through to the byte-unchanged append path below.
      const target = updateTargetIndex(next, key, member)
      if (target !== -1) {
        const update = updateInputFrom(member)
        if (update === undefined) {
          report.dropped.push(\`\${key}[\${index}]\`)
          continue
        }
        const existing = next[target]!
        // Replaced fields ONLY: everything else is copied verbatim off the existing entry, so a member that
        // also carries a \`label\`/\`order\`/\`enabled\` (a model echoing what it read in the draft state) changes
        // none of them rather than being refused for mentioning them.
        next[target] = { ...existing, content: update.content, ...(update.description === undefined ? {} : { description: update.description }) }
        // Repeatable across turns AND within one patch: last writer wins, reported once per id.
        if (!updatedIds.includes(existing.id)) updatedIds.push(existing.id)
        continue
      }
      const input = entryInputFrom(member)
      if (input === undefined) {
        report.dropped.push(\`\${key}[\${index}]\`)
        continue
      }
      const result = validateNewEntry(next, kind, input, { rejectOnCollision: kind === ENTRY_KINDS.catalog })
      if (!result.ok) {
        report.dropped.push(\`\${key}[\${index}]\`)
        continue
      }
      next.push(result.entry)
      appended += 1
    }
    if (appended === 0 && updatedIds.length === 0) continue
    store.set(key, next)
    // Each sub-record stays ABSENT when its own verb did nothing, so an append-only patch's report is
    // byte-identical to the one it produced before updates existed, and an update-only patch never claims a
    // zero-count append that a consumer keyed on \`Object.keys(added)\` would read as a change.
    if (appended > 0) report.added[key] = appended
    if (updatedIds.length > 0) report.updated[key] = updatedIds
  }

  return report
}
`;function w(e,t,n){let r=`export interface ${t}`,i=e.indexOf(r);if(i===-1)throw Error(`entry-list.ts (page): interface "${t}" not found in ${n} — renamed or removed?`);let a=i,o=e.indexOf(`{`,i),s=0,c=o;for(;c<e.length;c++)if(e[c]===`{`)s++;else if(e[c]===`}`&&(s--,s===0)){c++;break}return e.slice(a,c)}function T(e,t,n){let r=`export function ${t}(`,i=e.indexOf(r);if(i===-1)throw Error(`entry-list.ts (page): function "${t}" not found in ${n} — renamed or removed?`);let a=e.indexOf(`{`,i);return e.slice(i,a).trim()}function E(...e){let t=document.createElement(`p`);for(let n of e)t.append(typeof n==`string`?document.createTextNode(n):n);return t}function D(e){let t=document.createElement(`code`);return t.textContent=e,t}var{content:O}=e({title:`entry-list — the ordered-entry-list primitive`,intro:`@agent-ui/app’s HEADLESS entry-rendering mechanism (ADR-0132) — mountEntryList()/entry-data.ts, reused verbatim by every capability kind agent-admin renders (skills, workflows, resources, tools, prompt sections, pattern sources, the catalog library) plus the card-grid-drawer recipe’s edit-via-drawer shape. No customElements.define, no tag of its own — controls-coverage.test.ts’s own EXEMPT row says exactly that — so it carries no {name}.md descriptor and this page is its guide instead.`});O.append(t(`Call mountEntryList(kind, addLabel, handlers, options) once per kind; render(entries) rebuilds the list body on every entries-array change. This module owns no store of its own — every write routes through the handlers you supply, exactly as the live demo below does.`)),O.append(i(2,`1 · Live demo`)),O.append(E(`A real `,D(`mountEntryList`),` section, wired to a plain in-memory `,D(`Entry[]`),` array through the SAME `,D(`validateNewEntry`),`/`,D(`renameEntry`),` calls a real consumer (agent-admin.ts) makes. Three opt-ins are on: the add-from-library menu (a two-entry pack), rename (GH #848), and the per-entry availability control (GH #850). Reload the page to reset — nothing here persists.`));var k=[{id:`welcome`,kind:`demo`,label:`Welcome note`,description:`A built-in entry — toggle it, but Remove never renders.`,content:`Hello! Toggle me, or add your own below.`,order:0,enabled:!0,builtin:!0},{id:`second-entry`,kind:`demo`,label:`A custom entry`,description:`A non-builtin entry — Remove renders for this one.`,content:`Try Rename, or the Invocable pill.`,order:1,enabled:!0,builtin:!1}],A=y(`demo`,`Add entry`,{onToggle:(e,t)=>{k=k.map(n=>n.id===e?{...n,enabled:t}:n),A.render(k)},onContentChange:(e,t)=>{k=k.map(n=>n.id===e?{...n,content:t}:n)},onDelete:e=>{k=k.filter(t=>t.id!==e||t.builtin),A.render(k)},onAdd:e=>{let t=d(k,`demo`,e);return t.ok?(k=[...k,t.entry],A.render(k),!0):(v(A,t.error),!1)},onRename:(e,t)=>{k=u(k,e,t),A.render(k)},onAvailabilityChange:(e,t)=>{k=k.map(n=>n.id===e?{...n,availability:t}:n),A.render(k)}},{libraries:[{id:`starter-pack`,label:`Starter pack`,description:`Two ready-to-add entries`,entries:[{label:`Style guide`,description:`House writing style.`,content:`# Style guide

Write short sentences.`},{label:`Escalation policy`,description:`When to hand off to a human.`,content:`# Escalation

Hand off on repeated failure.`}]}],rename:!0,availabilityToggle:!0});A.render(k);var j=document.createElement(`div`);j.className=`el-frame`,j.append(A.host),O.append(g(`mountEntryList('demo', 'Add entry', handlers, { libraries, rename: true, availabilityToggle: true })`,j)),O.append(_(`p`,{class:`el-note`},[document.createTextNode(`Read-time default (entryAvailability): an entry with no availability member is "${p({})}" — the same fallback whether the field is absent (every entry minted before GH #850) or the string "${l.invocable}".`)])),O.append(i(2,`2 · EntryListOptions — the per-kind knobs`)),O.append(E(`Every opt-in defaults to byte-identical rendering when omitted (ADR-0132 cl.1: no kind gets bespoke list/toggle/author code). Sliced verbatim from entry-list.ts — a field rename here throws at page-load.`)),O.append(n(w(b,`EntryListOptions`,`entry-list.ts`),`ts`)),O.append(i(3,`EntryListHandlers — the write seam`)),O.append(E(`One callback per write. Extends `,D(`EntryFormHandlers`),` (entry-form.ts:44 — onAdd/onDelete/onContentChange/onRename/onAvailabilityChange, one declaration shared with the drawer form so the two surfaces can never drift onto different write contracts); `,D(`onToggle`),` stays entry-list.ts’s own — the enabled switch never leaves the row (GH #917’s Phase 0 ruling: STATE, not CRUD). `,D(`onAdd`),` returns a boolean (fail-closed — ADR-0132 cl.4): `,D(`false`),` keeps the form open with the typed input, and the caller surfaces the reason through `,D(`showAddError`),`.`)),O.append(n(w(b,`EntryListHandlers`,`entry-list.ts`),`ts`)),O.append(i(2,`3 · entry-data.ts — the data core`)),O.append(E(`Pure types + logic (ADR-0164 cl.2) — entry-list.ts owns rendering, a consumer owns the domain layer (kind constants, seeded defaults, system-prompt projection). Custom-entry depth is deliberately generic (ADR-0132 Fork 3): label + description + free-text content, uniform across every kind.`)),O.append(n(w(x,`Entry`,`entry-data.ts`),`ts`)),O.append(n(w(x,`NewEntryInput`,`entry-data.ts`),`ts`)),O.append(n(w(x,`EntryLibraryPack`,`entry-data.ts`),`ts`)),O.append(E(D(`validateNewEntry`),` is the ONE validated add path (ADR-0132 cl.4) every custom entry AND every library-pack add commits through:`)),O.append(n(T(x,`validateNewEntry`,`entry-data.ts`),`ts`)),O.append(i(3,`Consumers`)),O.append(E(`Five ADR-0132 capability kinds plus `,D(`pattern-source`),`/`,D(`catalog`),` — all instantiated `,`inside `,D(`ui-agent-admin`),` (`,_(`a`,{href:`./agent-admin.html`},[document.createTextNode(`agent-admin.html`)]),`). `,`The card-grid + drawer recipe (`,_(`a`,{href:`./card-grid-drawer.html`},[document.createTextNode(`card-grid-drawer.html`)]),`) `,`extracts the SAME entry-list/entry-form shape for a generic record-CRUD composition outside agent-admin.`)),O.append(i(2,`4 · @agent-ui/app/composer-options — the composer’s picker vocabulary`)),O.append(E(`Types + pure data only, consumed by `,D(`ui-conversation`),`’s composer (`,_(`a`,{href:`./conversation-doc.html`},[document.createTextNode(`conversation-doc.html`)]),`) `,`and rendered by `,D(`ui-agent-admin`),`’s Models/Effort/Provider pickers and the GH #849/#891 `,`mention/invocable + capabilities-panel vocabulary. Generic by construction: `,D(`kind`),`/`,D(`icon`),` are opaque strings the composer only groups and displays — the consumer owns every kind→meaning mapping.`)),O.append(n(w(S,`PickerOption`,`composer-options.ts`),`ts`)),O.append(n(w(S,`ReferenceOption`,`composer-options.ts`),`ts`)),O.append(n(w(S,`CapabilityRow`,`composer-options.ts`),`ts`)),O.append(E(`The one default option list shipped in-package — read live off the real export, not retyped:`));{let e=document.createElement(`table`);e.append(s(`id`,`label`));let t=document.createElement(`tbody`);for(let e of r)t.append(o(c(e.id),a(e.label)));e.append(t),O.append(e)}O.append(i(2,`5 · @agent-ui/app/agent-admin-persona-patch — the guided-authoring apply gate`)),O.append(E(`ADR-0178 cl.2’s three-filter fail-closed gate a declared `,D(`personaPatch`),` passes through before a single byte reaches a draft persona’s store — the mechanism behind agent-admin’s guided-authoring turn (`,_(`a`,{href:`./agent-admin.html`},[document.createTextNode(`agent-admin.html`)]),`), and the same canonical key set the persona-file export/import round trip (`,_(`a`,{href:`./persona-library-pattern.html`},[document.createTextNode(`persona-library-pattern.html`)]),`) now re-exports rather than re-enumerates (GH #406’s silent-divergence fix). Read live off the real module, not hand-counted: ${h.length} total persona-state keys — ${f.length} plain VALUE keys and ${m.length} ENTRY-LIST keys (one per ENTRY_KINDS member).`)),O.append(n(w(C,`PatchReport`,`persona-patch.ts`),`ts`)),O.append(E(`Three filters, in order: (1) an enumerated-key allowlist — `,D(`values`),` keys must be ∈ the VALUE set, `,D(`entries`),` keys ∈ the ENTRY-LIST set; (2) a per-key fixpoint `,D(`ADMISSION`),` table (a value is admitted iff its OWN sanitizer returns it unchanged — never a coercion, always a drop); (3) every proposed entry through the IDENTICAL `,D(`validateNewEntry`),` call the pane’s own add path makes, plus ADR-0178’s amendment (GH #696): a member naming an existing BUILTIN prompt section by id UPDATES its content in place instead of appending a duplicate.`)),O.append(n(T(C,`applyPersonaPatch`,`persona-patch.ts`),`ts`));