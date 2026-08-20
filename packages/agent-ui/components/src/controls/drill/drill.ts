// drill.ts — UIDrillElement, the N-level drill-down panel container (ADR-0195, GH #954). BEHAVIOUR + props +
// the control-owned header PART + path resolution + drill-forward delegation + focus management + view-
// transition wiring + self-define ONLY; geometry/colour live in drill.css, the public contract in drill.md.
//
// A `pattern`-tier `UIContainerElement` (control-height header row atop a space-scale content viewport — the
// `ui-tabs`/toolbar class, geometry.md's existing Pattern row, NOT a new one). Author `ui-drill-panel` children
// stay SIBLINGS of the host-owned header part (the tabs precedent — NOT moved, unlike ui-modal's child-move).
// Every panel whose key ∈ the resolved path paints (stack default, ADR-0195 Amendment cl.A1 below); every
// off-path panel carries `hidden` (the pre-amendment `ui-tab-panel` precedent, now scoped to off-path only).
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
// translateX.
//
// ADR-0195 AMENDMENT (2026-08-19, GH #1510) — S1 slice: contained + stack becomes the DEFAULT presentation.
// One resolved `path` (cl.2, unchanged), a new render mapping (cl.A1): panels whose key ∈ path all PAINT
// (z-ordered active-over-ancestors), ancestors dimmed + `inert` (visible pixels, no interaction surface —
// the swiper clone shape, ADR-0124 F2), off-path panels `hidden`. `#drillTo`/`#back`/`#commit`/`#resolve` stay
// BYTE-UNCHANGED (S1's load-bearing invariant) — inert ancestors can never host a live drill-trigger, so the
// plain append-only path stays correct without the intake's `#drillTo(key, fromPanel)` truncate generalization
// (that generalization is S2/S3's job, once a non-leaf panel can host a trigger — crumbs/columns).
// `layout`/`chrome` (cl.A2) are two new reflected closed-enum props shipped NOW (so a later slice never
// reshapes them) — this slice implements ONLY their defaults (`layout: 'stack'`, `chrome: 'backbar'`); a
// non-default value is accepted (no throw) but renders identically to the default until S2 (`chrome=crumbs`)
// / S3 (`layout=columns`) land.
// VT pairing-law correction (cl.A7): with ancestors now painted alongside the active panel, sharing ONE
// `view-transition-name` across every panel (the pre-amendment scheme) would put more than one named element
// in a single snapshot — illegal. The name now sits on the RESOLVED-ACTIVE panel ONLY, cleared elsewhere.
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
  // ADR-0195 Amendment cl.A2 — two new reflected closed enums, orthogonal axes (a crumbs trail is legal in
  // both layouts). Shipped now so a later slice never reshapes the prop; S1 implements ONLY the defaults
  // ('stack'/'backbar') — a non-default value is accepted but renders identically to the default until
  // S2 ('crumbs') / S3 ('columns') land.
  layout: { ...prop.enum(['stack', 'columns'] as const, 'stack'), reflect: true },
  chrome: { ...prop.enum(['backbar', 'crumbs'] as const, 'backbar'), reflect: true },
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
    // ADR-0195 Amendment cl.A1/A6: a painted ANCESTOR is `inert` (real browsers already block the pointer
    // event from ever reaching here) — the explicit `panel.inert` check is the same guarantee honored inside
    // jsdom's synthetic dispatch too, so only the resolved-ACTIVE panel's own triggers ever fire.
    if (!(panel instanceof UIDrillPanelElement) || panel.hidden || panel.inert) return
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
    if (!(panel instanceof UIDrillPanelElement) || panel.hidden || panel.inert) return
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

    // ADR-0195 Amendment cl.A1 — the stack (default) painted set is every panel whose key ∈ resolvedPath, not
    // just the active leaf (ancestors paint too, dimmed + inert, behind the active panel — drill.css's
    // `data-drill-pane` z-order). `layout`/`chrome` non-default values (S2/S3) are accepted but not yet
    // implemented — this pass always renders the stack/backbar mapping.
    const paintedKeys = new Set(resolvedPath)

    // cl.A7 — the shared `view-transition-name` moves to the RESOLVED-ACTIVE panel ONLY (set per render,
    // cleared elsewhere): with ancestors now painted too, naming every panel (the pre-amendment scheme) would
    // put more than one named element in a single snapshot, which the pairing law forbids.
    for (const panel of panels) {
      if (panel === activePanel) {
        setViewTransitionName(panel, viewTransitionName('drill', this.#instanceToken), this.viewTransitions)
      } else if (this.viewTransitions) {
        panel.style.viewTransitionName = ''
      }
    }

    const mutate = (): void => {
      this.toggleAttribute('data-vt-active', willUseVT)
      this.setAttribute('data-direction', this.#direction)
      for (const panel of panels) {
        const isPainted = paintedKeys.has(panel.key)
        const isActive = panel === activePanel
        panel.hidden = !isPainted
        // ADR-0124 F2 clone shape — visible pixels, no interaction surface: a painted ancestor is dimmed
        // (drill.css's scrim wash on `[data-drill-pane='ancestor']`) and `inert` (no focus, no clicks — the
        // one property that also keeps an inert ancestor's own drill-triggers from ever firing, which is
        // exactly what lets `#drillTo`/`#back` stay byte-unchanged, see file header).
        panel.inert = isPainted && !isActive
        if (isPainted) {
          panel.setAttribute('data-drill-pane', isActive ? 'active' : 'ancestor')
          // z-order by PATH INDEX (cl.A1's own "z-ordered by path order"), not DOM order — a panel's
          // sibling position need not match its tree depth (panels are flat, keyed by `parent`), so
          // deriving z-index from resolvedPath directly is the only mapping that's always correct,
          // even though ancestor-vs-ancestor order is normally invisible under the identical scrim.
          panel.style.zIndex = String(resolvedPath.indexOf(panel.key) + 1)
        } else {
          panel.removeAttribute('data-drill-pane')
          panel.style.zIndex = ''
        }
        panel.linkHeading(isActive ? this.#heading : null)
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
