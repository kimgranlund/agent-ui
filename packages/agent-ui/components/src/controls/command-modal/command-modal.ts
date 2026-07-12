// command-modal.ts — UICommandModalElement, the CMD-K command palette (ADR-0125; command-modal.lld.md LLD-C1..C10;
// command-modal.spec.md SPEC-R1..R10). A Pattern-class UIElement COORDINATOR — it nests a `ui-modal` for the whole
// modal surface + dismissal contract (ADR-0017/0019/0020), and inside that modal renders a control-created
// role=combobox search field over a control-created role=listbox list built from the consumer's author-declared
// [role=option]/[role=group] children (ADR-0017 child-move), re-deriving `ui-combo-box`'s active-descendant
// filter pattern (ADR-0085; the ~60 lines are re-implemented — combo-box's own methods are private). Choosing a
// command emits `select` + closes. It owns no form value, no command registry, no router, and no recents state.
//
// Composes on: UIElement (the coordinator base — the ui-theme-provider/ui-form-provider precedent, no surface of
// its own) + a nested ui-modal (a sanctioned sibling-control import, avatar.ts:25 precedent) + the scroll-fade
// trait over the list viewport. No new package, no new trait, no new base class, no new event, no new geometry row.
//
// Layer: controls → dom + traits (inward-only ✓).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIModalElement } from '../modal/modal.ts' // sanctioned sibling-control import — self-defines ui-modal (avatar.ts:25 precedent)
import { scrollFade } from '../../traits/scroll-fade.ts'

let _nextId = 0

interface CommandSelectDetail { value: string; label: string; group: string }

const props = {
  // `open` — whether the palette is shown. Reflected + bindable two-way (drives the nested modal's `open`; synced
  // back on the modal's platform dismissal). The ui-modal `open` shape.
  open: { ...prop.boolean(false), reflect: true },
  // `label` — the accessible name for BOTH the search field (reactive → aria-label) and the dialog (connect-time
  // → forwarded onto the nested ui-modal). NOT reflected (an a11y hint, not a styling hook).
  label: prop.string(''),
  // `placeholder` — the search field placeholder (shown via [data-empty]::before, the combo-box CSS read-back).
  placeholder: prop.string(''),
  // `hotkey` — the F2 opt-in convenience. '' = NO document listener. A non-empty chord (e.g. 'mod+k') binds ONE
  // per-instance document keydown that toggles THIS instance's open. NOT a global singleton (ADR-0082).
  hotkey: prop.string(''),
  // `filter` — ADR-0127: the match-test mode. 'substring' (default) is the original, byte-identical hay.includes(q)
  // test; 'regex' runs a case-insensitive RegExp test over the SAME haystack, falling back to the substring test
  // for that keystroke only when the pattern is invalid (never throws — SPEC-R5 AC5). NOT reflected (a behavior
  // switch, not a styling hook).
  filter: prop.enum(['substring', 'regex'] as const, 'substring'),
} satisfies PropsSchema

export interface UICommandModalElement extends ReactiveProps<typeof props> {}
export class UICommandModalElement extends UIElement {
  static props = props

  #modal: UIModalElement | null = null
  #search: HTMLElement | null = null
  #list: HTMLElement | null = null
  #status: HTMLElement | null = null
  #emptyRow: HTMLElement | null = null
  #activeIdx = -1

  protected connected(): void {
    const { modal, search, list } = this.#ensureParts()

    // LLD-C3 — the nested-modal surface seam. open → modal.open + aria-expanded; the modal owns showModal/backdrop/
    // Escape/focus-restore (NO own dialog machinery here — SPEC-R3 AC1).
    this.effect(() => {
      const isOpen = this.open
      modal.open = isOpen
      search.setAttribute('aria-expanded', String(isOpen))
      if (isOpen) requestAnimationFrame(() => search.focus()) // focus the search field on open (SPEC-R4 AC2)
    })
    // modal → model: a platform dismissal (Escape/backdrop) — the modal emits `close`+`toggle`; sync open back and
    // re-emit at the palette level (the two-way `open` pattern one level up, ADR-0019). `open` is the discriminator:
    // if it is still true, the platform closed it; guard the re-emit so a palette-driven close does not double-fire.
    // stopPropagation is load-bearing here: `emit()` (element.ts:172) dispatches a BUBBLING CustomEvent, and the
    // nested modal is a light-DOM DESCENDANT of the palette host — its bubbled `close` would otherwise ALSO reach
    // any `close` listener on the palette itself, on top of this handler's own re-emit (a genuine double-fire; the
    // fleet's first stateful nested-control relay, so no earlier precedent needed this guard).
    this.listen(modal, 'close', (event) => {
      if (this.open) { event.stopPropagation(); this.open = false; this.emit('close'); this.emit('toggle') }
    })
    // The modal emits `close` THEN `toggle` as a pair (ADR-0019) — the `toggle` half needs the SAME containment
    // (it always rides alongside `close`, never alone), so it is stopped unconditionally rather than re-guarded.
    this.listen(modal, 'toggle', (event) => { event.stopPropagation() })

    // LLD-C4 — search field: reactive aria-label (falls back to a default name when label=''), placeholder.
    this.effect(() => {
      search.setAttribute('aria-label', this.label || 'Search commands')
      search.setAttribute('data-placeholder', this.placeholder)
    })
    this.listen(search, 'input', () => { this.#filter(search.textContent ?? '') })
    this.listen(search, 'keydown', (event) => this.#onKeydown(event as KeyboardEvent, search))

    // LLD-C7 — option click commits (listen on the list; disabled/hidden guarded).
    this.listen(list, 'click', (event) => {
      const opt = (event.target as HTMLElement).closest<HTMLElement>('[role=option]')
      if (!opt || opt.hidden || opt.getAttribute('aria-disabled') === 'true' || opt.hasAttribute('disabled')) return
      this.#commit(opt)
    })

    // LLD-C8/C11 — the list is a bounded scroll viewport; wire the edge fade (combo-box/modal precedent).
    scrollFade(this, { viewport: list })

    // LLD-C10 — the opt-in hotkey: a TEARDOWN-RETURNING effect installs ONE document keydown ONLY while hotkey is
    // non-empty; the returned cleanup aborts it on hotkey change AND on disconnect (scope-owned). '' ⇒ no listener
    // is ever added (SPEC-R10 AC1) — NOT an always-on gated listener.
    this.effect(() => {
      const chord = this.hotkey
      if (chord === '') return
      const controller = new AbortController()
      document.addEventListener('keydown', (e) => {
        if (this.#matchesChord(e as KeyboardEvent, chord)) { e.preventDefault(); this.open = !this.open }
      }, { signal: controller.signal })
      return () => controller.abort()
    })

    this.#filter('') // initial: all options visible, status seeded, empty-state resolved
  }

  // LLD-C2 — create the nested modal + parts ONCE, child-move author items in. ORDER IS LOAD-BEARING (see the LLD
  // §3 note: `ui-modal`'s #ensureDialog() moves its OWN children into its <dialog> at ITS connect, so the parts
  // must go INTO the ui-modal element while it is still detached, and only THEN get appended to the host).
  #ensureParts(): { modal: UIModalElement; search: HTMLElement; list: HTMLElement } {
    if (this.#modal && this.#search && this.#list) return { modal: this.#modal, search: this.#search, list: this.#list }
    const seq = ++_nextId

    const search = document.createElement('div')
    search.setAttribute('data-part', 'search')
    search.setAttribute('contenteditable', 'plaintext-only')
    search.setAttribute('role', 'combobox')
    search.setAttribute('aria-autocomplete', 'list')
    search.setAttribute('aria-expanded', 'false')
    for (const a of ['autocorrect', 'autocapitalize', 'autocomplete']) search.setAttribute(a, 'off')
    search.setAttribute('spellcheck', 'false')
    search.toggleAttribute('data-empty', true)
    this.#search = search

    const list = document.createElement('div')
    list.setAttribute('data-part', 'list')
    list.setAttribute('data-box', '') // adopt the shared container box-model (ADR-0046)
    list.setAttribute('role', 'listbox')
    list.setAttribute('tabindex', '-1')
    list.id = `ui-cmd-list-${seq}`
    search.setAttribute('aria-controls', list.id)
    this.#list = list

    // Child-move author [role=option]/[role=group] (and the [slot=empty]) into the list (ADR-0017). Stable ids
    // for aria-activedescendant, assigned once.
    let node = this.firstChild
    while (node) { const next = node.nextSibling; list.appendChild(node); node = next }
    let optSeq = 0
    for (const opt of list.querySelectorAll<HTMLElement>('[role=option]')) if (!opt.id) opt.id = `ui-cmd${seq}-opt-${++optSeq}`

    const status = document.createElement('div')
    status.setAttribute('data-part', 'status')
    status.setAttribute('aria-live', 'polite')
    status.setAttribute('role', 'status') // visually hidden in CSS
    this.#status = status

    const emptyRow = document.createElement('div') // default empty-state (LLD-C9) — an authored [slot=empty] wins
    emptyRow.setAttribute('data-part', 'empty')
    emptyRow.setAttribute('role', 'presentation')
    emptyRow.textContent = 'No results'
    emptyRow.hidden = true
    list.append(emptyRow)
    this.#emptyRow = emptyRow

    // The nested ui-modal — accessible name forwarded from the INITIAL label (the modal forwards aria-label→dialog
    // ONCE at its ensureDialog; a reactive label updates the SEARCH field name, not the dialog's — LLD §3 note).
    const modal = document.createElement('ui-modal') as UIModalElement
    if (this.label) modal.setAttribute('aria-label', this.label)
    // TKT-0017 — the FIXED FRAME: pin the nested modal's frame dials to this control's own tokens so the
    // palette holds a set width and a top anchor (the search field never moves as filtering resizes the
    // list). Inline custom properties on the element we OWN — the slider --value-pct JS-seam exemption
    // (family-coherence B); the var() references resolve through inheritance from :where(ui-command-modal).
    modal.style.setProperty('--ui-modal-inline-size', 'var(--ui-command-modal-inline-size)')
    modal.style.setProperty('--ui-modal-margin-block-start', 'var(--ui-command-modal-block-anchor)')
    // ORDER: put the parts inside the modal BEFORE appending the modal to the host, so when ui-modal connects it
    // moves search/status/list into its <dialog> together (identity preserved; our refs stay valid). LLD §3 note.
    modal.append(search, status, list)
    this.#modal = modal
    this.append(modal)
    return { modal, search, list }
  }

  // LLD-C6 — the visible+enabled option set; active-descendant move (focus NEVER leaves the search field).
  #options(): HTMLElement[] { return this.#list ? [...this.#list.querySelectorAll<HTMLElement>('[role=option]')] : [] }
  #getVisibleOptions(): HTMLElement[] {
    return this.#options().filter((o) => !o.hidden && o.getAttribute('aria-disabled') !== 'true' && !o.hasAttribute('disabled'))
  }
  #setActive(idx: number): void {
    const opts = this.#getVisibleOptions()
    for (const o of opts) o.removeAttribute('data-active')
    if (idx < 0 || idx >= opts.length) { this.#activeIdx = -1; this.#search?.removeAttribute('aria-activedescendant'); return }
    this.#activeIdx = idx
    const opt = opts[idx]!
    opt.setAttribute('data-active', '')
    if (!opt.id) opt.id = `ui-cmd-opt-${++_nextId}` // lazy stable id for options added after connect (combo-box.ts:436 guard)
    // scrollIntoView is absent in jsdom (the status-stream.ts precedent) — a real browser always has it.
    if (typeof opt.scrollIntoView === 'function') opt.scrollIntoView({ block: 'nearest' })
    this.#search?.setAttribute('aria-activedescendant', opt.id)
  }
  #moveActive(delta: 1 | -1): void {
    const opts = this.#getVisibleOptions()
    if (opts.length === 0) return
    const next = this.#activeIdx < 0 ? (delta === 1 ? 0 : opts.length - 1) : (this.#activeIdx + delta + opts.length) % opts.length
    this.#setActive(next)
  }

  // The option's PRIMARY label text — excludes decorative descendants ([data-role=shortcut]/[data-role=icon]/
  // aria-hidden and <ui-icon>) so a `⌘H` shortcut is neither in select.detail.label nor matchable by the filter
  // (SPEC §2 Item label). TKT-0019 — [data-role=description] joins the exclusion for the SAME reason (`select`
  // detail.label and the `^ui-` anchored labelText must stay the title, never the second line); unlike the
  // shortcut this is a labelText-ONLY exclusion — the description carries no aria-hidden and stays fully in
  // the accessibility tree (a visible line SHOULD be announced; only its ROLE in this control's own label/
  // filter text is excluded). Filterability is unaffected — the site's own data-keywords already folds the
  // description text into the (separate) filter haystack. Iterates childNodes: skips decorative element
  // children, keeps text + real label spans.
  #labelText(opt: HTMLElement): string {
    let s = ''
    for (const node of opt.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (el.tagName === 'UI-ICON' || el.matches('[data-role=shortcut],[data-role=icon],[data-role=description],[aria-hidden=true]')) continue
        s += el.textContent ?? ''
      } else if (node.nodeType === Node.TEXT_NODE) {
        s += node.textContent ?? ''
      }
    }
    return s.trim()
  }

  // LLD-C5 — substring/keyword filter (or ADR-0127 regex, mode-gated); hide empty group headings; reset active;
  // update status + empty-state.
  #filter(text: string): void {
    const raw = text.trim()
    const q = raw.toLowerCase()
    // ADR-0127 — build the regex ONCE per keystroke, not per option, from the RAW (un-lowercased) text: the 'i'
    // flag alone delivers case-insensitivity (SPEC-R5 AC4) — lowercasing the PATTERN text first would corrupt
    // case-sensitive regex metacharacters (\D/\S/\W/\B → \d/\s/\w/\b), a materially different match, not merely
    // a case change. An invalid pattern throws a SyntaxError at `new RegExp`, caught here and never retried
    // per-option, then EVERY option falls back to the substring test for this keystroke (SPEC-R5 AC5 — degrade
    // gracefully, never throw, never surface an error to the user).
    let re: RegExp | null = null
    if (this.filter === 'regex' && raw !== '') {
      try { re = new RegExp(raw, 'i') } catch { re = null } // invalid pattern ⇒ fall back to substring below
    }
    for (const opt of this.#options()) {
      const hay = (this.#labelText(opt) + ' ' + (opt.getAttribute('data-keywords') ?? '')).toLowerCase()
      const matches = q === '' || (re ? re.test(hay) : hay.includes(q)) // item label + data-keywords ONLY (shortcut excluded — SPEC-R5 AC1)
      opt.hidden = !matches
    }
    for (const group of this.#list?.querySelectorAll<HTMLElement>('[role=group]') ?? []) {
      group.hidden = ![...group.querySelectorAll<HTMLElement>('[role=option]')].some((o) => !o.hidden)
    }
    this.#setActive(-1)
    const n = this.#getVisibleOptions().length
    if (this.#status) this.#status.textContent = n === 0 ? 'No results' : `${n} result${n === 1 ? '' : 's'}`
    // Empty-state (LLD-C9): an author [slot=empty]/[data-role=empty] child was child-moved into the list at
    // connect, so the CONTROL must toggle its visibility — it is a bare attribute in light DOM, nothing hides it
    // implicitly. The author element wins over the default row; both gate on the visible count (SPEC-R8).
    const authorEmpty = this.#list?.querySelector<HTMLElement>('[slot=empty],[data-role=empty]') ?? null
    if (authorEmpty) authorEmpty.hidden = n > 0
    if (this.#emptyRow) this.#emptyRow.hidden = n > 0 || authorEmpty !== null
    this.#search?.toggleAttribute('data-empty', text === '')
  }

  #onKeydown(e: KeyboardEvent, _search: HTMLElement): void {
    // NO Escape branch — the nested modal owns dismissal (SPEC-R9). Only Arrow/Home/End/Enter here.
    if (e.key === 'ArrowDown') { e.preventDefault(); this.#moveActive(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.#moveActive(-1) }
    else if (e.key === 'Home') { e.preventDefault(); this.#setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); this.#setActive(this.#getVisibleOptions().length - 1) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = this.#getVisibleOptions()[this.#activeIdx]
      if (opt) this.#commit(opt)
    }
  }

  // LLD-C7 — emit select {value,label,group} then close. NO router import, NO command bus.
  #commit(opt: HTMLElement): void {
    const label = this.#labelText(opt)                      // primary label (shortcut/icon excluded — SPEC-R6)
    const value = opt.getAttribute('value') ?? label
    const group = opt.closest<HTMLElement>('[role=group]')?.querySelector('[data-role=group-label]')?.textContent?.trim() ?? ''
    this.emit<CommandSelectDetail>('select', { value, label, group })
    this.open = false // closes the nested modal; the modal's `close` fires with open already false ⇒ no re-emit
  }

  #matchesChord(e: KeyboardEvent, chord: string): boolean {
    // Minimal chord parse: 'mod+k' → (metaKey||ctrlKey) && key==='k'. Extend per the builder's needs; the CONTRACT
    // is per-instance + preventDefault + toggle (SPEC-R10), not an exhaustive chord grammar.
    const parts = chord.toLowerCase().split('+')
    const key = parts.at(-1)!
    const needMod = parts.includes('mod')
    return (!needMod || e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key
  }
}

if (!customElements.get('ui-command-modal')) customElements.define('ui-command-modal', UICommandModalElement)
