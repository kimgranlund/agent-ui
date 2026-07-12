# LLD — `ui-command-modal`

> Refines: [`../spec/command-modal.spec.md`](../spec/command-modal.spec.md) (SPEC-R1…R14) under
> [ADR-0125](../adr/0125-ui-command-modal-composition-and-catalog-exclusion.md) (proposed; every fork as
> recommended). Build plan:
> [`../decompositions/command-modal-ship.decomp.json`](../decompositions/command-modal-ship.decomp.json)
> (coverage-clean `--strict`, plan mode). · proposed · 2026-07-10 · designer (agent-ui-component-design)
>
> **Composes on:** `UIElement` (the coordinator base — the `ui-theme-provider`/`ui-form-provider` precedent,
> no surface of its own) + a **nested `ui-modal`** (the whole surface + dismissal contract, ADR-0017/0019/0020;
> a sanctioned sibling-control import, `avatar.ts:25`) + the `scroll-fade` trait over the list viewport + the
> `ui-combo-box` active-descendant filter **pattern, re-derived** (ADR-0085; combo-box's methods are private, so
> the ~60 lines are re-implemented, not imported) + the ADR-0017 child-move for the author item children.
> **No new package, no new trait, no new base class, no new event, no new geometry row.**
>
> **Freeze discipline.** §3's interface is the fan-out contract. A builder who cannot satisfy it STOPS and
> escalates — the fix is a coordinated LLD repair, never a local deviation. The two verified footguns are called
> out inline (the nested-modal child-move ORDER, and the connect-time vs reactive accessible-name split).

> *REV (build review, 2026-07-11): the shipped close/toggle handlers add `event.stopPropagation()` beyond this frozen body — CORRECT and necessary (`emit()` bubbles and the nested modal is a light-DOM descendant; without it a consumer's `close` listener double-fires on platform dismissal). The close guard on `this.open` vs unconditional toggle asymmetry is deliberate. Do not revert.*

> **REV 2026-07-11 (ADR-0127, ratified):** LLD-C1's props schema gains `filter: 'substring'|'regex'` (default
> `'substring'`); LLD-C5's `#filter()` (§3 snippet below predates this and shows the substring-only body) gains a
> mode branch — `filter==='regex'` builds `new RegExp(raw, 'i')` ONCE per keystroke, compiled from the RAW
> (un-lowercased) query text over the SAME haystack (item label + `data-keywords`) — the `'i'` flag alone
> delivers case-insensitivity; lowercasing the pattern text first would corrupt case-sensitive metacharacters
> (`\D`/`\S`/`\W`/`\B`). A `SyntaxError` from an invalid pattern is caught and that keystroke falls back to the
> substring test, never throwing (SPEC-R5 AC5). `filter='substring'` (absent/default) is byte-identical to the
> pre-ADR-0127 body. See `command-modal.ts`'s live `#filter()` for the current source.


## 1 · Intent

Ship a Pattern-class coordinator that (a) nests a `ui-modal` for its modal surface, (b) renders a `role=combobox`
search field over a `role=listbox` list built from the consumer's author-declared `[role=option]`/`[role=group]`
children (ADR-0017 child-move), (c) filters the list on type and moves an active-descendant highlight with the
arrow keys **without moving DOM focus off the search field**, and (d) emits `select` + closes on choose. It owns
no form value, no command registry, no router, and no recents state. The behavioral surface is one `connected()`
wiring (the nested modal + the search/list parts + the filter/active-descendant + selection + the opt-in hotkey)
+ one `{name}.css`. The rest is descriptor, the catalog EXCLUSION entry, tests, and two site pages.

## 2 · Components

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | class + tag + self-define (tier pattern) AND the props schema (`open`/`label`/`placeholder`/`hotkey`/`filter` — REV 2026-07-11, ADR-0127) | `controls/command-modal/command-modal.ts` | SPEC-R1, R2 |
| LLD-C2 | `#ensureParts()` — create the nested `ui-modal` + the search/list/status parts, child-move the author `[role=option]`/`[role=group]` children into the list, assign stable option ids (idempotent) | `controls/command-modal/command-modal.ts` | SPEC-R3, R4 |
| LLD-C3 | the nested-`ui-modal` surface seam — drive `open`→modal, sync the modal's `close`/`toggle` back, forward the accessible name, NO own dialog/backdrop/Escape | `controls/command-modal/command-modal.ts` | SPEC-R3, R9 |
| LLD-C4 | the search field — `role=combobox` contenteditable, aria wiring (`aria-controls`/`aria-expanded`/`aria-autocomplete`), reactive `aria-label`, focus-on-open | `controls/command-modal/command-modal.ts` | SPEC-R4 |
| LLD-C5 | filter — `hidden`-based substring/keyword match (default), OR a regex test over the same haystack when `filter="regex"` (REV 2026-07-11, ADR-0127) — an invalid pattern is caught and that keystroke falls back to substring, never throwing; group-heading hide, active reset | `controls/command-modal/command-modal.ts` | SPEC-R5 |
| LLD-C6 | active-descendant navigation — `#getVisibleOptions`/`#setActive`/`#moveActive` (aria-activedescendant + `[data-active]`, focus stays in the search field) | `controls/command-modal/command-modal.ts` | SPEC-R5 |
| LLD-C7 | selection — click/Enter commit → `emit('select', {value,label,group})` + `open=false`; NO router import, NO command bus | `controls/command-modal/command-modal.ts` | SPEC-R6 |
| LLD-C8 | result-count live region — `[data-part=status]` `aria-live=polite`, updated on filter | `controls/command-modal/command-modal.ts` | SPEC-R7 |
| LLD-C9 | empty state — author `[slot=empty]` override else a default `role=presentation` "No results" row | `controls/command-modal/command-modal.ts` | SPEC-R8 |
| LLD-C10 | the opt-in `hotkey` — an effect that binds ONE document `keydown` only while `hotkey` is non-empty (teardown-returning effect, per-instance, no singleton) | `controls/command-modal/command-modal.ts` | SPEC-R10 |
| LLD-C11 | `command-modal.css` — search/list/item/group/active geometry, the bounded scroll viewport, the container surface via the nested modal, the `--ui-command-modal-*` token chain, forced-colors | `controls/command-modal/command-modal.css` | SPEC-R11 |
| LLD-C12 | `command-modal.md` descriptor (tier: pattern, extends UIElement, events, parts, content model, keyboard map) | `controls/command-modal/command-modal.md` | SPEC-R12 |
| LLD-C13 | descriptor↔props trip-wire test | `controls/command-modal/command-modal-descriptor.test.ts` | SPEC-R12 |
| LLD-C14 | jsdom behavior suite (props reflect/fail-open, parts/ARIA, filter, selection detail, no-router negative control, hotkey add/remove) | `controls/command-modal/command-modal.test.ts` | SPEC-R2, R4, R5, R6, R10 |
| LLD-C15 | cross-engine browser suite — real typeahead-filter + keyboard flow (focus stays in the search field), whole-shape opened dialog, Escape-via-modal single path | `controls/command-modal/command-modal.browser.test.ts` | SPEC-R3, R5, R6, R9, R11, R14 |
| LLD-C16 | `CommandModal` permanent `EXCLUSION_ALLOWLIST` entry — **a2ui build slice** | `packages/agent-ui/a2ui/src/catalog/default/index.test.ts` | SPEC-R13 |
| LLD-C17 | site pages — API doc + a demo (opened palette, grouped commands, empty state, keyboard callout) + representative gallery specimen | `site/pages/command-modal-doc.ts`, `site/pages/command-modal-demo.ts`, `site/lib/component-preview.ts` | SPEC-R14 |
| LLD-C18 | barrel/exports/size integration | `packages/agent-ui/components/{package.json,src/controls/index.ts}`, `barrels.test.ts` | ADR-0080 |

## 3 · Interfaces (frozen)

```ts
// controls/command-modal/command-modal.ts — LLD-C1..C10.
// Verified against shipped source: emit<D>(type,detail?)  element.ts:172 · listen(target,type,handler,opts?)
// element.ts:160 · effect(fn: () => void | (() => void)) element.ts:148 (teardown-returning body — the render
// effect + the watch directive rely on it) · prop.string/boolean props.ts:104 · UIModalElement + `open` prop +
// `close`/`toggle` on platform dismiss modal.ts:45/68-77 · scrollFade(host, {viewport}) scroll-fade.ts:106 ·
// the active-descendant filter methods re-derived from combo-box.ts:405/420/444/463 (private — re-implemented).
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
    this.listen(modal, 'close', () => {
      if (this.open) { this.open = false; this.emit('close'); this.emit('toggle') }
    })

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

  // LLD-C2 — create the nested modal + parts ONCE, child-move author items in. ORDER IS LOAD-BEARING (see §3 note).
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
    // ONCE at its ensureDialog; a reactive label updates the SEARCH field name, not the dialog's — §3 note).
    const modal = document.createElement('ui-modal') as UIModalElement
    if (this.label) modal.setAttribute('aria-label', this.label)
    // ORDER: put the parts inside the modal BEFORE appending the modal to the host, so when ui-modal connects it
    // moves search/status/list into its <dialog> together (identity preserved; our refs stay valid). §3 note.
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
    opt.scrollIntoView({ block: 'nearest' })
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
  // (SPEC §2 Item label). Iterates childNodes: skips decorative element children, keeps text + real label spans.
  #labelText(opt: HTMLElement): string {
    let s = ''
    for (const node of opt.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (el.tagName === 'UI-ICON' || el.matches('[data-role=shortcut],[data-role=icon],[aria-hidden=true]')) continue
        s += el.textContent ?? ''
      } else if (node.nodeType === Node.TEXT_NODE) {
        s += node.textContent ?? ''
      }
    }
    return s.trim()
  }

  // LLD-C5 — substring/keyword filter; hide empty group headings; reset active; update status + empty-state.
  #filter(text: string): void {
    const q = text.trim().toLowerCase()
    for (const opt of this.#options()) {
      const hay = (this.#labelText(opt) + ' ' + (opt.getAttribute('data-keywords') ?? '')).toLowerCase()
      opt.hidden = q !== '' && !hay.includes(q)   // item label + data-keywords ONLY (shortcut excluded — SPEC-R5 AC1)
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
```

**Interface notes (the load-bearing constraints a builder must not silently change):**

- **The nested-modal child-move ORDER is load-bearing (verified against `modal.ts:136-161`).** `ui-modal`'s
  `#ensureDialog()` moves *its own children* into its internal `<dialog>` at *its* connect. So the palette MUST
  append `search`/`status`/`list` **into the `ui-modal` element while it is still detached**, then append the
  `ui-modal` to the host — so when the modal connects it relocates the parts into the dialog together, keeping
  our element references valid (node identity survives `appendChild`). Appending the modal first and the parts
  after would leave them outside the dialog. This is why `#ensureParts` builds the whole subtree before
  `this.append(modal)`.
- **Accessible-name split (verified against `modal.ts:143-153`).** `ui-modal` forwards `aria-label`→its dialog
  part **once**, at `#ensureDialog`, then strips it from the host — it does NOT re-forward on later changes. So a
  reactive `label` updates the SEARCH FIELD's `aria-label` (the combobox name AT users hear when focused — the
  important one) via the effect; the DIALOG's name is resolved from the INITIAL `label` at part creation. This
  is a deliberate, documented limitation, not a bug: SPEC-R3 AC3 (label→modal) is satisfied at connect, SPEC-R4
  AC3 (search aria-label reactive) is satisfied live. A builder must NOT try to make the dialog name reactive by
  reaching into modal internals — if a live dialog name is ever required, that is an escalation (a `ui-modal`
  labelling-seam amendment), not a local patch.
- **`effect` bodies may return a teardown (verified `element.ts:148`, type `() => void | (() => void)`).** The
  hotkey effect (LLD-C10) relies on it: the returned `() => controller.abort()` runs before each re-run and on
  disconnect (scope-owned), giving "no listener while `hotkey===''`; exactly one while set; removed on change/
  disconnect" (SPEC-R10). The mechanism is confirmed at the reactive kernel — a body-returned cleanup runs before
  each re-run and on dispose (`reactive/graph.ts`, and consumed by the `watch` directive). (Note: the element's
  ONE render effect does NOT itself return a teardown — the guarantee lives in the kernel, not that call site.)
- **`emit<D>(type, detail?)` (verified `element.ts:172`).** `this.emit<CommandSelectDetail>('select', {...})` is
  the shipped signature. Events emitted: `select` (choose), `close`+`toggle` (platform dismissal relay) — all ⊂
  the `change·input·select·open·close·toggle` allowlist. NO `dismiss` (adia's off-allowlist name).
- **Roles ride the PARTS, never the host.** `role=combobox` on the search part, `role=listbox` on the list part
  (both control-created, FACE pattern). The palette host carries no `role`/`aria-*` attribute; the dialog's ARIA
  is the nested modal's. `UIElement` exposes `internals`, but the palette does not need host internals (SPEC-R4
  AC1 / SPEC-R12).
- **NO Escape branch, NO router import, NO recents/results state** — the negative controls (SPEC-R6 AC2, R9 AC1,
  §4 non-goals) are grep-checkable on the built module.

```css
/* controls/command-modal/command-modal.css — LLD-C11 (abbreviated; full sheet at build time). */
:where(ui-command-modal) {
  --ui-command-modal-search-block-size: var(--ui-height-md);  /* search field borrows the entry-control register */
  --ui-command-modal-list-max-block: 50vh;                    /* bounded scroll viewport (scroll-fade wired) */
  --ui-command-modal-item-pad-inline: var(--ui-space-sm);
  --ui-command-modal-item-gap: var(--ui-space-xs);
  --ui-command-modal-active-bg: var(--md-sys-color-surface-container-highest); /* the [data-active] highlight role */
  display: contents;   /* the palette host paints nothing; the nested ui-modal owns the surface */
}
:where(ui-command-modal) [data-part='search'][role='combobox'] {
  min-block-size: var(--ui-command-modal-search-block-size);
  /* [data-empty]::before { content: attr(data-placeholder) } — the combo-box placeholder read-back */
}
:where(ui-command-modal) [data-part='list'][role='listbox'] {
  max-block-size: var(--ui-command-modal-list-max-block);
  overflow-y: auto;
}
:where(ui-command-modal) [role='option'][data-active] { background: var(--ui-command-modal-active-bg); }
:where(ui-command-modal) [role='option'][aria-disabled='true'] { opacity: .5; pointer-events: none; }
:where(ui-command-modal) [data-part='status'] { /* visually hidden, present to AT */
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
/* @media (forced-colors: active) — the active-option highlight becomes Highlight/HighlightText (not a faint bg
   that vanishes under WHCM); the aria-activedescendant + [data-active] pairing is the non-color signifier
   (SPEC-R11 AC3), so no color-only intent exists. The combo-box [data-active] forced-colors precedent. */
```

```yaml
# controls/command-modal/command-modal.md frontmatter — LLD-C12 (abbreviated; full fence at build time).
tag: ui-command-modal
tier: pattern                 # composed control with internal parts (the ui-combo-box precedent); no §1 height row
extends: UIElement            # coordinator (the theme/form-provider precedent); paints no surface of its own
attributes:                   # mirrors static props 1:1
  - { name: open,        type: boolean, default: false, reflect: true }
  - { name: label,       type: string,  default: '',    reflect: false }
  - { name: placeholder, type: string,  default: '',    reflect: false }
  - { name: hotkey,      type: string,  default: '',    reflect: false }
properties: []
events:                       # all ⊂ the change·input·select·open·close·toggle allowlist (NO `dismiss`)
  - { name: select, detail: '{ value: string, label: string, group: string }', when: 'a command is chosen (click / Enter on the active option); the palette then closes' }
  - { name: close,  when: 'a platform dismissal (Escape/backdrop) of the nested modal, relayed' }
  - { name: toggle, when: 'paired with close on platform dismissal (the two-way open signal, ADR-0019)' }
parts:
  - { name: search, role: combobox, note: 'control-created contenteditable search field; role via the part, not the host' }
  - { name: list,   role: listbox,  note: 'control-created; author [role=option]/[role=group] children moved in (ADR-0017)' }
  - { name: status, note: 'visually-hidden aria-live=polite result-count region' }
  - { name: empty,  role: presentation, note: 'default No-results row; an author [slot=empty] overrides it' }
slots:
  - { name: empty, note: 'author empty-state affordance shown when the filter matches nothing' }
contentModel: '[role=option][value] children (optional leading icon element + label text + optional [data-role=shortcut] display + optional data-keywords), optionally grouped under [role=group] with a [data-role=group-label] heading'
face: { formAssociated: false }
composes: [ ui-modal ]        # nested for the surface + dismissal (ADR-0017/0019/0020); a sanctioned sibling import
aria:
  pattern: 'combobox-in-dialog — search field role=combobox (aria-controls/aria-expanded/aria-autocomplete/aria-activedescendant), list role=listbox, options role=option, groups role=group[aria-labelledby]; roles ride the PARTS, never the host; the dialog ARIA is the nested modal'
keyboard:
  - { keys: '<printable>', action: 'filter the list (substring/keyword, case-insensitive); reset the active option' }
  - { keys: ArrowDown, action: 'move the active option (aria-activedescendant) to the next visible enabled option, wrapping; focus STAYS in the search field' }
  - { keys: ArrowUp,   action: 'move the active option to the previous visible enabled option, wrapping; focus stays in the search field' }
  - { keys: Home,      action: 'active → first visible option' }
  - { keys: End,       action: 'active → last visible option' }
  - { keys: Enter,     action: 'emit select {value,label,group} for the active option, then close' }
  - { keys: Escape,    action: 'DISMISS — owned by the nested ui-modal (single close path, ADR-0045); the palette binds no Escape handler' }
geometry:
  sizeClass: pattern
  searchBlockSize: var(--ui-command-modal-search-block-size)   # entry-control register
  listMaxBlock: var(--ui-command-modal-list-max-block)         # bounded scroll viewport
  gap: var(--ui-command-modal-item-gap)
catalog: excluded             # PERMANENT EXCLUSION_ALLOWLIST (F8 / ADR-0112 cl.6) — app-owner launcher chrome
```

## 4 · The catalog exclusion (LLD-C16 — an a2ui build slice)

`CommandModal` is permanently NON-emittable (SPEC-R13 / ADR-0125 F8). The moment `command-modal.md` ships,
ADR-0087's fleet-derived gate (`descriptor-glob → PascalCase`) admits `CommandModal` into `FLEET_TYPES` and
demands a catalog row *or* an allowlist entry. This LLD directs a **permanent `EXCLUSION_ALLOWLIST` entry** in
`a2ui/src/catalog/default/index.test.ts` (the `Map` seeded with `Toast`/`ToastRegion`/`ThemeProvider`), keyed
`'CommandModal'` with the ADR-0112 cl.6 reason string ("app-owner launcher chrome, never agent-emittable"). The
standing residue-guard already asserts every allowlist entry is genuinely absent from every catalog/factory key,
so this stays honest by construction. **Sequencing:** dispatched to the `a2ui-builder` seat once the descriptor
(LLD-C12) ships — the type derives from it. No catalog row, no corpus seed, no factory code.

## 5 · Site surfaces (LLD-C17)

- **`command-modal-doc.ts`** — the standard descriptor-derived API page (the `combo-box-doc.ts`/`tabs-doc.ts`
  precedent): the attributes table, the events table, the content model, the keyboard map, a minimal live
  specimen (a toggle button that opens a small palette).
- **`command-modal-demo.ts`** — new CONTENT: an **opened** palette over a realistic app backdrop (a mock
  editor/shell), with at least two `[role=group]` sections (Navigation, Actions), multiple real command items
  (leading `ui-icon` + label + a `[data-role=shortcut]` display), the author `[slot=empty]` affordance, and a
  keyboard-flow callout (type-to-filter → arrow to move the highlight → Enter to select+close → Escape to
  dismiss). Show BOTH hotkey modes: a consumer-wired open button AND a `hotkey="mod+k"` instance.
- **`component-preview.ts`** — a representative specimen (the `example-builder` concern): a populated, grouped
  command list (Navigation/Edit/Account with icons + shortcuts), NOT a one-child stub — the whole-shape/
  representative-specimen law. Knob config surfaces `label`/`placeholder`/`hotkey`/`open` as the appropriate knob
  types (input/toggle), one knob per prop.

## 6 · Failure/edge summary (cross-cutting)

- **Nested-modal connect ORDER** — the §3 note: parts go inside the modal before the modal goes into the host.
  A builder who appends the modal first (parts land outside the dialog, Tab escapes) escalates — but the frozen
  `#ensureParts` gets it right by construction.
- **Reactive `label` and the dialog name** — the §3 note: the dialog name is connect-time; the search field name
  is reactive. Not a bug; a live dialog name is an escalation (a `ui-modal` seam amendment), not a local patch.
- **Escape with an active filter** — closes via the modal's single path; NO clear-first stage (SPEC-R9). Binding
  a palette-level Escape would race the modal's platform dismissal (the combo-box `combo-box.ts:232` lesson).
- **Empty palette / all-hidden filter** — `#getVisibleOptions()` returns `[]`, the empty-state row (or author
  `[slot=empty]`) shows, the status announces "No results", Arrow/Enter no-op. A valid degenerate state.
- **`hotkey` change at runtime** — the teardown-returning effect aborts the old listener and installs the new
  (or none, if cleared); no residue, no duplicate (SPEC-R10 AC2). Verified by a jsdom add/remove spy (LLD-C14).
- **Multi-instance same `hotkey`** — both instances toggle themselves (documented author's concern, F2); the
  palette does not arbitrate — arbitrating is the singleton ADR-0082 forbids.
- **Zero residue** — the modal-close listener, the search input/keydown listeners, the two effects, and the
  conditional hotkey listener all ride `connected()`'s connection `AbortSignal`/scope; no timer, observer, or
  unconditional global listener exists. Verified by a disconnect/reconnect probe (LLD-C14).

## 7 · Gates (the definition of done)

`npm run check`(+site) · `npm test` (`command-modal.test.ts` + `command-modal-descriptor.test.ts` +
`family-coherence.test.ts` + the a2ui `index.test.ts` residue-guard once LLD-C16 lands + `site-coverage.test.ts`)
· `npm run test:browser command-modal` (Chromium + WebKit — the real typeahead-filter + keyboard-flow leg with
focus STAYING in the search field, the whole-shape opened-dialog leg, and the Escape-via-modal single-path leg)
· `npm run size` measured by hand (ADR-0040 §3; the command-modal leave-one-out marginal — note the nested
`ui-modal` is already in the family total, so the marginal is the palette's own delta) · independent
`component-reviewer` GO before commit. **jsdom-green ≠ done** — the active-descendant focus-stays-in-input proof
and the opened-dialog whole-shape are browser-only (the combo-box/date-time precedent: a browser leg catches
what jsdom's locators and non-layout engine cannot; jsdom is also blind to the `<dialog>` top-layer).

## 8 · Open (named, not blocking)

- **The `hotkey` chord grammar** — v1 parses `mod+<key>` (the CMD-K case); a richer grammar (shift/alt combos,
  multiple bindings) is additive and needs no contract change. The CONTRACT is per-instance + preventDefault +
  toggle, not an exhaustive parser.
- **Recents / frequency** (F6) — fenced v2; would add a `recents`/`max-recents` contract + persistence the
  palette deliberately does not own in v1. Consumer-fed via an authored "Recent" group meanwhile.
- **Async/provider results + in-label match highlighting** (F7) — fenced v2; a `results`/async seam + safe
  text-decoration inside labels. v1 is author-declared children + substring/keyword filter.
- **A `ui-command-group` sub-tag** (F3) — fenced additive v2; v1 groups with `[role=group]` children.
- **A live dialog accessible name** — needs a `ui-modal` labelling-seam amendment (the §3 note); the named
  escalation only, not a v1 requirement.
