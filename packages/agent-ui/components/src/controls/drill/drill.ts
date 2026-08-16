// drill.ts — UIDrillElement, the N-level drill-down panel container (ADR-0195, GH #954). BEHAVIOUR + props +
// the control-owned header PART + path resolution + drill-forward delegation + focus management + view-
// transition wiring + self-define ONLY; geometry/colour live in drill.css, the public contract in drill.md.
//
// A `pattern`-tier `UIContainerElement` (control-height header row atop a space-scale content viewport — the
// `ui-tabs`/toolbar class, geometry.md's existing Pattern row, NOT a new one). Author `ui-drill-panel` children
// stay SIBLINGS of the host-owned header part (the tabs precedent — NOT moved, unlike ui-modal's child-move).
// Exactly one panel is visible at a time (`hidden` on the rest, the ui-tab-panel precedent).
//
// Path resolution (drill.intake.md §4 / ADR-0195 cl.2): `path` is the FULL chain from the root panel's `key`
// through the current leaf, INCLUSIVE of the root — NEVER empty. `#drillTo` APPENDS; it never recomputes a
// chain from a panel's `parent` (that attribute is consulted only for the Back button's label). An unresolvable
// key, or a broken controlled `path`, falls back by walking from the end of `path` for the first entry that
// names a real panel, else the root key.
//
// Controlled/uncontrolled duality (ADR-0102 prop-as-source-of-truth, the `ui-split.sizes` precedent verbatim):
// `path` undefined ⇒ UNCONTROLLED — an internal signal drives the render AND self-mutates on every commit.
// `path` defined ⇒ CONTROLLED — the host renders `path` and only EMITS the proposed value on `change`, never
// self-mutating; the consumer/agent owns the write-back.
//
// Motion (ADR-0195 cl.6): the CSS-transform base and the View Transitions layer are MUTUALLY EXCLUSIVE per
// swap, keyed on `willUseVT = this.viewTransitions && viewTransitionAvailable()` computed FRESH each commit —
// never on the raw opt-in attribute alone (an opted-in instance on an unsupported/reduced-motion engine still
// gets the CSS base). `data-vt-active` marks a swap the VT layer will run; `drill.css` excludes its CSS
// transition rules on that marker. `data-direction` carries the swap's forward/back sign for the CSS base's
// translateX. Every panel shares ONE `view-transition-name` per instance (the GH#958 pairing law's own worked
// example: only one panel is ever painted) when `viewTransitions` is opted in.
//
// `controls → dom + ./drill-panel.ts` — the allowed import direction (a sanctioned sibling-control import, the
// `avatar → icon` / `command-modal → combo-box` precedent — same layer, controls → controls).

import { signal } from '../../reactive/index.ts'
import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import {
  withViewTransition,
  viewTransitionAvailable,
  viewTransitionName,
  setViewTransitionName,
} from '../../dom/view-transition.ts'
import { UIDrillPanelElement } from './drill-panel.ts'

export type { UIDrillPanelElement } from './drill-panel.ts'

let drillSeq = 0

const drillProps = {
  ...UIContainerElement.surfaceProps,
  // The position state — string[] | undefined (prop.json, attribute:false: too structured for an HTML
  // attribute, the ui-split `sizes` precedent). undefined ⇒ UNCONTROLLED (internal signal drives + self-
  // mutates); defined ⇒ CONTROLLED (renders the prop, emits proposed values, never self-mutates).
  path: { ...prop.json<string[] | undefined>(undefined), attribute: false as const },
  // The ADR-0183 opt-in — the `ui-super-shell` naming precedent (`viewTransitions` / `attribute:
  // 'view-transitions'`). Byte-identical to the CSS-transform base when absent (progressive enhancement, never
  // a default any control applies on its own).
  viewTransitions: { ...prop.boolean(false), reflect: true, attribute: 'view-transitions' as const },
} satisfies PropsSchema

export interface UIDrillElement extends ReactiveProps<typeof drillProps> {}
export class UIDrillElement extends UIContainerElement {
  static props = drillProps

  // UNCONTROLLED position — a kernel signal (tracked inside `this.effect`), the ui-split `#ratios` precedent.
  readonly #internalPath = signal<string[]>([])
  // A structural-change poke `#render`'s effect reads UNCONDITIONALLY (the ui-split `#version` precedent) —
  // bumped by the childList observer so a panel add/remove re-resolves the active panel even when neither
  // `path` nor the uncontrolled signal itself changed.
  readonly #version = signal(0)

  #observer: MutationObserver | null = null
  #backButton: HTMLButtonElement | null = null
  #heading: HTMLHeadingElement | null = null
  #instanceToken = ''
  #direction: 'forward' | 'back' = 'forward'
  // Set true after the FIRST render pass — gates the focus-move-to-heading behaviour so mounting a `ui-drill`
  // never steals focus on first paint (only a later, real ACTIVE-KEY change moves it — see #lastActiveKey).
  #primed = false
  // The active key as of the LAST render pass — the second, narrower gate `keyChanged` needs: `#primed` alone
  // stays true forever after the first render, so a re-render for an UNRELATED reason (a panel added/removed,
  // an author prop unrelated to `path`) must not replay the VT swap or the focus move (component-checker fix).
  #lastActiveKey: string | null = null
  #warnedNoRoot = false
  #warnedMultiRoot = false

  protected connected(): void {
    this.#instanceToken = this.id || `d${++drillSeq}`
    this.internals.role = 'group' // a labelled navigation region — the ui-modal internals.role precedent
    this.#primed = false
    this.#lastActiveKey = null

    const { back, heading } = this.#ensureParts()
    this.#backButton = back
    this.#heading = heading

    this.listen(back, 'click', () => this.#back())
    this.listen(this, 'click', (event) => this.#onTriggerClick(event as MouseEvent))
    this.listen(this, 'keydown', (event) => this.#onKeydown(event as KeyboardEvent))

    this.#observer = new MutationObserver(() => this.#version.value++)
    this.#observer.observe(this, { childList: true })

    this.effect(() => this.#render())
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
    this.#primed = false
  }

  // ── parts (created ONCE — idempotent guard, the disclosure.ts/tabs.ts precedent) ──────────────────────────

  #ensureParts(): { header: HTMLElement; back: HTMLButtonElement; heading: HTMLHeadingElement } {
    let header = this.querySelector<HTMLElement>(':scope > [data-part="header"]')
    if (header) {
      return {
        header,
        back: header.querySelector<HTMLButtonElement>('[data-part="back"]')!,
        heading: header.querySelector<HTMLHeadingElement>('[data-part="heading"]')!,
      }
    }
    header = document.createElement('div')
    header.setAttribute('data-part', 'header')
    header.setAttribute('data-box', '')

    const back = document.createElement('button')
    back.type = 'button'
    back.setAttribute('data-part', 'back')
    back.hidden = true

    const heading = document.createElement('h2')
    heading.setAttribute('data-part', 'heading')
    heading.tabIndex = -1

    header.append(back, heading)
    this.prepend(header)
    return { header, back, heading }
  }

  // ── panel discovery + resolution (drill.intake.md §4) ───────────────────────────────────────────────────

  #panels(): UIDrillPanelElement[] {
    return [...this.children].filter((el): el is UIDrillPanelElement => el instanceof UIDrillPanelElement)
  }

  #rootKey(): string {
    const roots = this.#panels().filter((p) => p.parent === '')
    if (roots.length === 0) {
      if (!this.#warnedNoRoot) {
        console.warn('ui-drill: no <ui-drill-panel> with parent="" (root) found — nothing can render')
        this.#warnedNoRoot = true
      }
      return ''
    }
    if (roots.length > 1 && !this.#warnedMultiRoot) {
      console.warn(`ui-drill: ${roots.length} root panels found (parent="") — expected exactly one; using the first`)
      this.#warnedMultiRoot = true
    }
    return roots[0]!.key
  }

  /** Resolve the ACTIVE panel key + the effective (possibly repaired) path from a raw path — never empty,
   *  never a hard throw on an unresolvable key (drill.intake.md's `ui-tabs` overflow-fallback precedent). */
  #resolve(rawPath: string[]): { key: string; path: string[] } {
    const panels = this.#panels()
    const byKey = new Set(panels.map((p) => p.key))
    if (rawPath.length > 0) {
      for (let i = rawPath.length - 1; i >= 0; i--) {
        const key = rawPath[i]!
        if (byKey.has(key)) return { key, path: rawPath.slice(0, i + 1) }
      }
    }
    const rootKey = this.#rootKey()
    return { key: rootKey, path: rootKey ? [rootKey] : [] }
  }

  #rawPath(): string[] {
    return this.path ?? this.#internalPath.value
  }

  // ── commits (drill-forward + back) ──────────────────────────────────────────────────────────────────────

  #drillTo(key: string): void {
    if (!key) return
    const { path } = this.#resolve(this.#rawPath())
    this.#commit([...path, key], 'forward')
  }

  #back(): void {
    const { path } = this.#resolve(this.#rawPath())
    if (path.length <= 1) return
    this.#commit(path.slice(0, -1), 'back')
  }

  #commit(next: string[], direction: 'forward' | 'back'): void {
    this.#direction = direction
    if (this.path === undefined) this.#internalPath.value = next
    this.emit<string[]>('change', next)
  }

  // ── author-content interaction (data-role="drill-trigger", Back, Escape) ───────────────────────────────

  #onTriggerClick(event: MouseEvent): void {
    const target = event.target
    if (!(target instanceof Element)) return
    const trigger = target.closest('[data-role="drill-trigger"]')
    if (!trigger || !this.contains(trigger)) return
    const panel = trigger.closest('ui-drill-panel')
    if (!(panel instanceof UIDrillPanelElement) || panel.hidden) return
    const key = trigger.getAttribute('data-drill-key')
    if (key) this.#drillTo(key)
  }

  #onKeydown(event: KeyboardEvent): void {
    // component-checker MAJOR fix: a focused native `<button>`'s own `pressActivation` already
    // preventDefault()s BOTH Enter and Space before dispatching a synthetic click — this listener still
    // sees the (still-bubbling) keydown, and without this guard would fire a SECOND #drillTo for the same
    // press (measured: two `change` events, one Back stalling on the wrong level). A defaultPrevented
    // keydown means some other handler already owns this key press.
    if (event.defaultPrevented) return
    if (event.key === 'Escape') {
      // component-checker MEDIUM fix: stopPropagation so an ANCESTOR ui-modal/ui-drawer never ALSO reads
      // this same Escape as its own dismiss — Back owns this key inside the drill, full stop.
      event.stopPropagation()
      this.#back()
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (!(target instanceof Element)) return
    // Native activatable elements handle their own Enter/Space (a real <button>/<a href>) — this delegated
    // path only covers a non-native drill-trigger (e.g. a plain [tabindex] row).
    if (target.matches('button, a[href], input, select, textarea')) return
    const trigger = target.closest('[data-role="drill-trigger"]')
    if (!trigger || !this.contains(trigger)) return
    const panel = trigger.closest('ui-drill-panel')
    if (!(panel instanceof UIDrillPanelElement) || panel.hidden) return
    const key = trigger.getAttribute('data-drill-key')
    if (!key) return
    event.preventDefault()
    this.#drillTo(key)
  }

  // ── render: the one geometry+ARIA+motion effect ─────────────────────────────────────────────────────────

  #backLabel(activePanel: UIDrillPanelElement | null): string {
    const parentKey = activePanel?.parent
    if (!parentKey) return 'Back'
    const parent = this.#panels().find((p) => p.key === parentKey)
    return parent?.heading ? `Back to ${parent.heading}` : 'Back'
  }

  #render(): void {
    void this.#version.value // tracked unconditionally — the ui-split `#version` precedent
    const panels = this.#panels()
    const { key: activeKey, path: resolvedPath } = this.#resolve(this.#rawPath())
    const activePanel = panels.find((p) => p.key === activeKey) ?? null
    // component-checker MAJOR fix: the ONLY thing that licenses a VT swap or a focus move is the ACTIVE KEY
    // actually changing — a re-render for an unrelated reason (a panel appended/removed elsewhere, a prop
    // that isn't `path`) must never replay either. `#primed` alone was too broad: it stayed true across
    // every later render, not just a real level change (ADR-0195 cl.5's own "NON-INITIAL path change" wording).
    const keyChanged = this.#primed && activeKey !== this.#lastActiveKey
    const willUseVT = keyChanged && this.viewTransitions && viewTransitionAvailable()

    for (const panel of panels) {
      setViewTransitionName(panel, viewTransitionName('drill', this.#instanceToken), this.viewTransitions)
    }

    const mutate = (): void => {
      this.toggleAttribute('data-vt-active', willUseVT)
      this.setAttribute('data-direction', this.#direction)
      for (const panel of panels) {
        panel.hidden = panel !== activePanel
        panel.linkHeading(panel === activePanel ? this.#heading : null)
      }
      if (this.#heading) this.#heading.textContent = activePanel?.heading ?? ''
      if (this.#backButton) {
        const canGoBack = resolvedPath.length > 1
        this.#backButton.hidden = !canGoBack
        this.#backButton.setAttribute('aria-label', this.#backLabel(activePanel))
      }
    }

    withViewTransition(mutate, willUseVT)

    if (keyChanged && activePanel) this.#heading?.focus()
    this.#lastActiveKey = activeKey
    this.#primed = true
  }

  // ── protected test seams ─────────────────────────────────────────────────────────────────────────────────

  /** Expose the currently-resolved effective path for test probes (controlled/uncontrolled parity assertions). */
  protected get effectivePathSeam(): string[] {
    return this.#resolve(this.#rawPath()).path
  }

  /** Expose the live header parts for test probes (focus/aria assertions). */
  protected get headerPartsSeam(): { back: HTMLButtonElement | null; heading: HTMLHeadingElement | null } {
    return { back: this.#backButton, heading: this.#heading }
  }
}

if (!customElements.get('ui-drill')) customElements.define('ui-drill', UIDrillElement)
