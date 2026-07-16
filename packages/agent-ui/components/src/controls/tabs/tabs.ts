// tabs.ts — UITabsElement, the tabs compound's coordinator (goals.md §G9 / decomp g9-containers s8 / ADR-0015
// surface · ADR-0019 the bindable `selected` two-way). BEHAVIOUR + props + the tablist part + roving/keyboard +
// the tab↔panel wiring + self-define ONLY; geometry/colour live in tabs.css, the contract in tabs.md.
//
// The container (the FIRST non-form family — extends UIContainerElement for the surface axes + the reused
// protected `internals`; NOT form-associated). It owns a control-created `[data-part=tablist]` strip
// (`role=tablist` on the PART div — allowed, like the text-field editor part; the HOST carries no role) into
// which it REPARENTS its `ui-tab` children (the panels stay as siblings of the strip — a tablist must wrap only
// the tabs). It then drives the whole widget from ONE place (a sibling cannot set another element's protected
// internals): each tab↔panel pair is wired once (`aria-controls`/`aria-labelledby` via internals element-
// reflection), and a single scope-owned effect re-applies selection — `aria-selected` + the roving tabindex
// (exactly the selected tab is tabindex=0) + `:state(selected)` on the tabs, and the `hidden` attribute on the
// panels (only the selected panel shows; the rest stay in the DOM). ArrowLeft/Right + Home/End move selection
// AND focus together (selection-follows-focus), committing through the same path as a click. The keyboard
// navigation is handled by the shared `rovingFocus` trait (listbox-roving LLD-C1).
//
// `selected` is a plain reflected string the renderer two-way-binds via LLD-C8 (ADR-0019): the agent SETS it
// (programmatic → the effect applies it, NO event echoed), a user gesture COMMITS it (the ONE `select` event
// emitted, the renderer reads the new tab back). The control stays renderer-agnostic — it knows nothing of A2UI.
// `controls → dom` is the allowed import direction; importing this module registers all three tags (it imports
// tab.ts/tab-panel.ts), so the s12 barrel needs only `export * from './tabs/tabs.ts'`.

import { UIContainerElement } from '../../dom/container.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { UITabElement } from './tab.ts'
import { UITabPanelElement } from './tab-panel.ts'

// A per-instance id seed so each tabs' tab/panel pair gets unique IDREFs (the reverse aria-labelledby anchor).
let tabsSeq = 0

const props = {
  // The surface axes (ADR-0015) — elevation/brightness, spread from the base (no prototype merge; the ADR-0013
  // formProps precedent). ui-tabs sets its OWN default --ui-container-bg in tabs.css (the base default is
  // transparent), so a bare tabs still has a surface.
  ...UIContainerElement.surfaceProps,
  // `selected` — the active tab's identity (its `value`, or its DOM index as a string; '' ⇒ the first tab).
  // OBSERVED + REFLECTED so the attribute mirrors the live selection, and BINDABLE: the renderer two-way-binds it
  // via LLD-C8 (value:{prop:'selected',event:'select'}, ADR-0019). Typed `string` — the value crosses the
  // attribute boundary as a string regardless (a numeric index is its string form); the descriptor records it so.
  selected: { ...prop.string(), reflect: true },
} satisfies PropsSchema

export interface UITabsElement extends ReactiveProps<typeof props> {}
export class UITabsElement extends UIContainerElement {
  static props = props

  // The control-created tablist strip + the captured tab/panel lists (light-DOM, persist across reconnect).
  #tablist: HTMLElement | null = null
  #tabs: UITabElement[] = []
  #panels: UITabPanelElement[] = []
  #baseId = ''
  // The resolved active index — the single source of truth for the keyboard delta; kept in sync by the effect
  // and eagerly on commit (so a rapid second keypress before the effect flush still steps from the right place).
  #activeIndex = -1

  protected connected(): void {
    if (!this.#baseId) this.#baseId = `ui-tabs-${++tabsSeq}`

    const strip = this.#ensureTablist()
    // Reparent the tab children INTO the strip (idempotent — a tab already inside is skipped, so reconnect is a
    // no-op). Recognised by instanceof so a probe subclass nests; the panels are left as strip siblings.
    for (const child of [...this.children]) {
      if (child instanceof UITabElement && child.parentNode !== strip) strip.append(child)
    }
    this.#tabs = [...strip.children].filter((c): c is UITabElement => c instanceof UITabElement)
    this.#panels = [...this.children].filter((c): c is UITabPanelElement => c instanceof UITabPanelElement)

    // Wire each tab↔panel pair ONCE (ids + the aria-controls/labelledby element-reflection). Pairs by DOM order.
    this.#tabs.forEach((tab, i) => {
      const panel = this.#panels[i]
      if (!panel) return
      const tabId = `${this.#baseId}-tab-${i}`
      const panelId = `${this.#baseId}-panel-${i}`
      tab.link(panel, tabId)
      panel.link(tab, panelId)
    })

    // Click commit listener — delegated to the tablist strip (rides the connection AbortSignal).
    // Keydown is handled by the rovingFocus trait below.
    this.listen(strip, 'click', this.#onClick)

    // The selection effect — re-applies on every `selected` change (and re-arms on reconnect). Runs once now
    // (synchronously) so the initial roving tabindex + panel visibility are correct before first paint.
    this.effect(() => {
      const index = this.#resolveIndex() // reads this.selected (tracked) + this.#tabs
      this.#tabs.forEach((tab, i) => tab.setSelected(i === index))
      this.#panels.forEach((panel, i) => {
        panel.hidden = i !== index // standard `hidden` (NOT ARIA) — only the selected panel shows; the rest stay in DOM
      })
      this.#activeIndex = index
    })

    // Roving keyboard focus — the shared trait (listbox-roving LLD-C1) replaces the former inline #onKeydown.
    // The effect above runs synchronously and sets #activeIndex before we get here, so initialIndex reads
    // the correct position even after reconnect with a non-first tab selected. syncIndex reconciles on each
    // keydown after a click or programmatic selection change that bypassed the trait's onMove.
    rovingFocus(this, {
      container: strip,
      items: () => this.#tabs as HTMLElement[],
      orientation: 'horizontal',
      loop: true,
      typeAhead: false,
      initialIndex: () => this.#activeIndex,
      syncIndex: () => this.#activeIndex,
      onMove: (index) => this.#commit(index, false), // trait already moved focus; commit without re-focusing
    })

    // Motion gate (interaction-states standard) — arm `ready` ONE FRAME past first paint so the synchronous
    // initial selection SNAPS and only later changes animate (tabs.css gates the transition behind
    // :state(ready)). states optional-chained — jsdom has no CustomStateSet (the real motion is the browser smoke).
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  /** Create the `[data-part=tablist]` strip ONCE (idempotent across reconnect — it is a persistent light-DOM
   *  child) and keep it as the first child. `role=tablist` rides the PART div (text-field editor-part precedent),
   *  so the HOST stays free of a role attribute. */
  #ensureTablist(): HTMLElement {
    let strip = this.#tablist
    if (!strip) {
      strip = document.createElement('div')
      strip.setAttribute('data-part', 'tablist')
      strip.setAttribute('role', 'tablist')
      this.#tablist = strip
    }
    if (strip.parentNode !== this) this.insertBefore(strip, this.firstChild)
    return strip
  }

  /** Resolve `selected` → a tab index: '' ⇒ the first tab; a `value` match wins; else a numeric index in range;
   *  else fall back to the first tab. Reads `this.selected` so the selection effect tracks it. */
  #resolveIndex(): number {
    const tabs = this.#tabs
    if (tabs.length === 0) return -1
    const sel = this.selected
    if (sel === '') return 0
    const byValue = tabs.findIndex((t) => t.key !== '' && t.key === sel)
    if (byValue !== -1) return byValue
    if (/^\d+$/.test(sel)) {
      const n = Number(sel)
      if (n >= 0 && n < tabs.length) return n
    }
    return 0
  }

  // ── click commit — delegated: find the clicked tab among ours (instanceof-safe across subclasses) ──
  #onClick = (event: Event): void => {
    const target = event.target as Node
    const index = this.#tabs.findIndex((t) => t === target || t.contains(target))
    if (index === -1) return
    this.#commit(index, true)
  }

  /**
   * Commit a user-driven selection: write `selected` (→ the effect re-applies aria/roving/panels), move focus to
   * the tab (roving), and emit `select` ONLY when the selection actually changed — so a programmatic `selected`
   * set by the agent (the renderer's two-way write) never echoes an event back (binding hygiene). The commit
   * value is the tab's `value` when it has one, else its index as a string (the addressable identity).
   */
  #commit(index: number, moveFocus: boolean): void {
    const tab = this.#tabs[index]
    if (!tab) return
    const changed = index !== this.#activeIndex
    const identity = tab.key !== '' ? tab.key : String(index)
    this.#activeIndex = index // eager — keep the keyboard delta correct before the effect flush
    this.selected = identity // → reflects + wakes the selection effect
    if (moveFocus) tab.focus()
    if (changed) {
      // `select` is the ONE commit event (the event-vocab's selection event). The s11 catalog binds
      // value:{prop:'selected',event:'select'} and the renderer's LLD-C8 controller listens to exactly it to
      // write `selected` back into the A2UI data model — NOT `change` (which is value-commit-flavored).
      this.emit('select', { value: identity, index })
    }
  }
}

if (!customElements.get('ui-tabs')) customElements.define('ui-tabs', UITabsElement)
