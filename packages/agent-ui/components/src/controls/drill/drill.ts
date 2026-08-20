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
// ADR-0195 AMENDMENT S2 slice (2026-08-19/20, GH #1510) — `chrome="crumbs"`. cl.A3: under crumbs the Back
// button hides and a `[data-part="crumbs"]` `<nav aria-label="Breadcrumb">` renders instead, holding one real
// `<button data-part="crumb">` per ANCESTOR path entry plus the SAME `[data-part="heading"]` node (moved, never
// recreated) as the trail's last, non-interactive entry — reusing the one node is what keeps cl.5's focus
// target/`aria-labelledby` reflection/heading semantics unchanged. cl.A6: the leaf carries `aria-current`,
// value **`location`** (Forks ruled ③, kept as drafted) — a drill level is a UI position, not a page; ancestor
// crumbs carry NO `aria-current` (real `<button>`s, not links, and not "current" themselves — the APG
// current-item semantic applies to exactly one entry, the trail's last). `#drillTo`/`#back`/`#commit`/
// `#resolve` stay BYTE-UNCHANGED (S1's load-bearing invariant, still true here): a crumb click reuses `#commit`
// through a new sibling method, `#crumbTo` — the cl.A1 "truncate then commit, direction back" mapping, not a
// rewritten append.
//
// ADR-0195 AMENDMENT S3 slice (2026-08-20, GH #1510) — `layout="columns"` (Miller columns). cl.A1: every
// panel whose key ∈ the resolved path PAINTS side-by-side, in path order, ALL INTERACTIVE — the ONE
// difference from `stack` is that a painted ancestor is never `inert`/dimmed here (contrast cl.A1's own
// "stack: ancestors dimmed + inert" vs "columns: all interactive"). `#effectiveLayout()` resolves `layout`
// down to the render mapping that ACTUALLY applies — 'columns' only when authored AND the host itself is
// not narrow (cl.A8): the narrow line is realized as a REAL `@container (inline-size < 52.5rem)` query in
// drill.css (ADR-0150's compact-body number, the nav-rail `@container` threshold shape cl.A8 cites) whose
// resolved `--_drill-columns-narrow` custom property this method reads via `getComputedStyle` — the
// `swiper.ts` `getComputedStyle(...).getPropertyValue('--ui-swiper-columns')` precedent, chosen over the
// nav-rail rem×rootFontPx ResizeObserver arithmetic because it needs NO duplicated breakpoint literal in
// JS at all (CSS is the single source of truth; JS only ever reads its resolved boolean). A ResizeObserver
// on the host still bumps `#version` so `#render`'s effect re-reads that flag on a REAL resize (jsdom has
// none — typeof-guarded, the scroll-fade.ts precedent — so jsdom's own columns coverage runs at the WIDE
// arm by construction; the narrow-degrade proof itself is real-engine-only, drill.browser.test.ts). The
// RESOLVED mapping (never the raw `[layout]` attribute, which cl.A8 says never changes) is published as a
// host-owned `data-drill-layout` marker `#render` sets every pass — drill.css keys its columns-only grid
// tracks + the stack-only ancestor scrim off THAT, never `[layout='columns']`.
// The generalization cl.A1 names — "a trigger inside the panel at path index i commits
// path.slice(0, i+1).concat(key)" — lands as `#drillFrom(key, fromKey)`, a NEW sibling built from
// `#resolve`/`#commit` (the `#crumbTo` shape, S2, verbatim): `#drillTo`/`#back`/`#commit`/`#resolve` stay
// BYTE-UNCHANGED (S1's load-bearing invariant, still true here). `#onTriggerClick`/`#onKeydown` route a
// 'stack'-effective click through the untouched `#drillTo` (dead code for an ancestor there anyway — its
// own `panel.inert` guard already excludes every ancestor under stack) and a 'columns'-effective click
// through `#drillFrom` — the only place layout is consulted for ROUTING.
// cl.A6 columns a11y: every painted column keeps `role=region`; the active column keeps the existing
// `aria-labelledby` element-reflection (`linkHeading`, unchanged); a painted ANCESTOR column instead gets
// `internals.ariaLabel` set to its own `heading` prop directly (`drill-panel.ts`'s new `labelDirect` — the
// `ui-pagination`/`ui-swatch`/`ui-progress` plain-string-ARIA precedent, since an ancestor column has no
// shared heading NODE of its own to point at). The active-row highlight is a bare `data-drill-active`
// styling hook `#render` toggles on the ONE trigger inside each ancestor column whose `data-drill-key`
// names the NEXT path entry — no fleet token is minted for it (ADR-0195 Amendment cl.A5's own token list
// names exactly three: radius/scrim/column-size; stamping a default paint here isn't authorized by the
// frozen record, same restraint cl.A6 applies to declining to stamp ARIA onto author content) — an
// author's own trigger markup owns the selected-row look. Columns does NOT move focus on drill-forward
// (cl.A6's one deliberate narrowing of cl.5, scoped to this layout only): `#render`'s closing
// `this.#heading?.focus()` call is gated on `effectiveLayout !== 'columns'`.
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
  #header: HTMLElement | null = null
  #backButton: HTMLButtonElement | null = null
  #heading: HTMLHeadingElement | null = null
  // S2 (cl.A3) — the crumbs trail's own control-created part, created once alongside back/heading (idempotent
  // guard, #ensureParts). Hidden whenever `chrome !== 'crumbs'`.
  #crumbsNav: HTMLElement | null = null
  #instanceToken = ''
  #direction: 'forward' | 'back' = 'forward'
  // Set true after the FIRST render pass — gates the focus-move-to-heading behaviour so mounting a `ui-drill`
  // never steals focus on first paint (only a later, real ACTIVE-KEY change moves it — see #lastActiveKey).
  #primed = false
  // The active key as of the LAST render pass — the second, narrower gate `keyChanged` needs: `#primed` alone
  // stays true forever after the first render, so a re-render for an UNRELATED reason (a panel added/removed,
  // an author prop unrelated to `path`) must not replay the VT swap or the focus move (component-checker fix).
  #lastActiveKey: string | null = null
  // S2 (component-checker MINOR fix): the crumbs trail is REBUILT wholesale (`#renderCrumbs`'s own
  // pagination.ts precedent), which drops focus if the rebuild runs on an unrelated re-render (a panel
  // added/removed elsewhere) while a crumb or the heading holds it — the same "only a REAL change licenses
  // a rebuild" discipline `keyChanged` already applies to VT/focus, extended to this trail's own content.
  #lastCrumbsPath: string | null = null
  #warnedNoRoot = false
  #warnedMultiRoot = false
  // S3 (cl.A8) — bumps #version on a real host resize; jsdom has none (typeof-guarded below).
  #resizeObserver: ResizeObserver | null = null

  protected connected(): void {
    this.#instanceToken = this.id || `d${++drillSeq}`
    this.internals.role = 'group' // a labelled navigation region — the ui-modal internals.role precedent
    this.#primed = false
    this.#lastActiveKey = null

    const { header, back, heading, crumbsNav } = this.#ensureParts()
    this.#header = header
    this.#backButton = back
    this.#heading = heading
    this.#crumbsNav = crumbsNav

    this.listen(back, 'click', () => this.#back())
    // S2 (cl.A3) — ONE delegated listener on the nav itself (the pagination.ts `#rebuild` precedent): crumb
    // buttons are rebuilt wholesale every render (`#renderCrumbs`), so a per-button listener would strand a
    // fresh closure on every discarded rebuild. Native `<button>` semantics give Enter/Space/Tab for free.
    this.listen(crumbsNav, 'click', (event) => this.#onCrumbClick(event as MouseEvent))
    this.listen(this, 'click', (event) => this.#onTriggerClick(event as MouseEvent))
    this.listen(this, 'keydown', (event) => this.#onKeydown(event as KeyboardEvent))

    this.#observer = new MutationObserver(() => this.#version.value++)
    this.#observer.observe(this, { childList: true })

    // S3 (cl.A8) — watch `header` (the SAME descendant box #effectiveLayout() itself reads the
    // `@container`-driven custom property off, and whose inline-size always tracks the host's own — a
    // fixed control-height row, `grid-column: 1`, spanning the full width) rather than `this` (the HOST):
    // the host's own content-box HEIGHT is intrinsic (tallest painted pane) and CAN shift as a side effect
    // of a layout-mode flip (a narrower per-column width can re-wrap text taller), where `header`'s
    // block-size never does (fixed control height, untouched by which panel paints) — the nav-rail
    // "watches THIS SAME box the query resolves against" law applied to a self-scoped (not
    // ancestor-relative) container. A benign "ResizeObserver loop completed with undelivered
    // notifications" console warning can still surface under a rapid, repeated-resize test load regardless
    // of which box is observed — verified as a pre-existing artifact of THIS test harness, not this
    // component (nav-rail.browser.test.ts's own ResizeObserver-driven suite prints the identical warning on
    // a shipped, accepted component); it never reds a gate (spec-benign, self-recovering). Only bumps
    // #version — #effectiveLayout() re-reads the live `--_drill-columns-narrow` custom property itself;
    // jsdom has no ResizeObserver (typeof-guarded, the scroll-fade.ts precedent).
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(() => this.#version.value++)
      this.#resizeObserver.observe(header, { box: 'content-box' })
    }

    this.effect(() => this.#render())
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
    this.#resizeObserver?.disconnect()
    this.#resizeObserver = null
    this.#primed = false
  }

  // ── parts (created ONCE — idempotent guard, the disclosure.ts/tabs.ts precedent) ──────────────────────────

  #ensureParts(): {
    header: HTMLElement
    back: HTMLButtonElement
    heading: HTMLHeadingElement
    crumbsNav: HTMLElement
  } {
    let header = this.querySelector<HTMLElement>(':scope > [data-part="header"]')
    if (header) {
      return {
        header,
        back: header.querySelector<HTMLButtonElement>('[data-part="back"]')!,
        // `querySelector` finds `heading` wherever it currently sits (a direct header child in `backbar`
        // chrome, or moved inside `crumbsNav` — see #renderCrumbs) — the SAME node either way (S2, cl.A3).
        heading: header.querySelector<HTMLHeadingElement>('[data-part="heading"]')!,
        crumbsNav: header.querySelector<HTMLElement>('[data-part="crumbs"]')!,
      }
    }
    header = document.createElement('div')
    header.setAttribute('data-part', 'header')
    header.setAttribute('data-box', '')

    const back = document.createElement('button')
    back.type = 'button'
    back.setAttribute('data-part', 'back')
    back.hidden = true

    // S2 (cl.A3) — the crumbs trail: a real `<nav aria-label="Breadcrumb">`, created once, hidden whenever
    // `chrome !== 'crumbs'`. Its children are rebuilt wholesale every render (#renderCrumbs, the pagination.ts
    // `#rebuild` whole-array-swap precedent) — one `<button data-part="crumb">` per ancestor path entry, plus
    // the SAME `heading` node (below) moved in as the trail's last entry.
    const crumbsNav = document.createElement('nav')
    crumbsNav.setAttribute('data-part', 'crumbs')
    crumbsNav.setAttribute('aria-label', 'Breadcrumb')
    crumbsNav.hidden = true

    const heading = document.createElement('h2')
    heading.setAttribute('data-part', 'heading')
    heading.tabIndex = -1

    header.append(back, crumbsNav, heading)
    this.prepend(header)
    return { header, back, heading, crumbsNav }
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

  /** cl.A1/A8 — resolve `layout` down to the render mapping that ACTUALLY applies: 'columns' only when
   *  authored AND the host itself is not narrow. The narrow line is ADR-0150's compact-body number
   *  (52.5rem), realized as a REAL `@container (inline-size < 52.5rem)` query in drill.css (the nav-rail/
   *  swiper `@container` threshold shape cl.A8 cites) — never re-derived here: reading its resolved
   *  `--_drill-columns-narrow` custom property (the `swiper.ts`
   *  `getComputedStyle(...).getPropertyValue('--ui-swiper-columns')` precedent) means CSS and JS read the
   *  identical, single-sourced boolean, no duplicated breakpoint literal, no rem→px conversion. Read off
   *  `this.#header` (a DESCENDANT), never `this` (the host): the CSS Containment Queries spec excludes the
   *  container-establishing element from matching its OWN `@container` query, so drill.css's override rule
   *  targets `[data-part='header']` — reading `getComputedStyle(this)` here would always see `:scope`'s own
   *  default (measured: both engines stuck reporting 'columns' at any width before this fix), never the
   *  narrow flip. `this.#header` is always set by the time this runs (created in `connected()` before the
   *  first render); the `?? this` fallback only matters for a call before that, which should not happen.
   *  Absent any stylesheet (jsdom) this reads `''` — never `'1'` — so jsdom's own columns coverage runs at
   *  the WIDE arm by construction; the real degrade is real-engine-only territory (drill.browser.test.ts's
   *  container-resize leg). The `layout` ATTRIBUTE itself never changes (cl.A8) — only what this resolves
   *  it to. */
  #effectiveLayout(): 'stack' | 'columns' {
    if (this.layout !== 'columns') return 'stack'
    const probe = this.#header ?? this
    const narrow = getComputedStyle(probe).getPropertyValue('--_drill-columns-narrow').trim() === '1'
    return narrow ? 'stack' : 'columns'
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
    if (!key) return
    // S3 (cl.A1) — under 'columns' an ANCESTOR panel is no longer inert (columns' whole point is "all
    // interactive"), so its OWN drill-triggers now reach here too: route through the truncate-then-append
    // generalization (#drillFrom), never the plain #drillTo append, which would be wrong for anything but
    // the rightmost column. Under 'stack' this branch is dead code by construction (the `panel.inert` guard
    // above already excludes every ancestor there) — #drillTo stays the path, byte-unchanged.
    if (this.#effectiveLayout() === 'columns') this.#drillFrom(key, panel.key)
    else this.#drillTo(key)
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
    // S3 (cl.A1) — the same effective-layout routing #onTriggerClick applies (see its own comment).
    if (this.#effectiveLayout() === 'columns') this.#drillFrom(key, panel.key)
    else this.#drillTo(key)
  }

  // ── S2 (cl.A3/cl.A1) — crumbs trail navigation: a NEW sibling to #drillTo/#back, never touching them ───────

  #onCrumbClick(event: MouseEvent): void {
    const target = event.target
    if (!(target instanceof Element)) return
    const crumb = target.closest('[data-part="crumb"]')
    if (!crumb || !this.#crumbsNav?.contains(crumb)) return
    const index = Number(crumb.getAttribute('data-drill-index'))
    if (!Number.isInteger(index)) return
    this.#crumbTo(index)
  }

  /** cl.A1's crumbs render mapping: "a click on crumb i committing path.slice(0, i+1) (direction back)" — the
   *  SAME `#commit` the Back button uses, called with a truncated (not appended) path. `#drillTo`/`#back`/
   *  `#commit`/`#resolve` stay byte-unchanged; this is a new method that reuses `#commit`, not a rewrite of it. */
  #crumbTo(index: number): void {
    const { path } = this.#resolve(this.#rawPath())
    if (index < 0 || index >= path.length - 1) return // only an ANCESTOR entry is clickable, never the leaf
    this.#commit(path.slice(0, index + 1), 'back')
  }

  // ── S3 (cl.A1) — columns commit generalization: a NEW sibling, #drillTo/#back/#commit/#resolve untouched ──

  /** cl.A1's columns generalization: "a drill-trigger inside the panel at path index i commits
   *  path.slice(0, i+1).concat(key)" — truncate the resolved path AT the trigger's HOSTING panel, then
   *  append; built from #resolve/#commit exactly as #crumbTo is (a NEW sibling — #drillTo itself stays
   *  BYTE-UNCHANGED, S1's load-bearing invariant, still true here). Only reached under the 'columns'
   *  effective layout (#onTriggerClick/#onKeydown route a 'stack'-effective click through #drillTo,
   *  unchanged): under 'stack' every ancestor panel is `inert`, so its own triggers can never reach a click
   *  handler in the first place — this method only matters once a non-leaf panel can host a LIVE trigger,
   *  exactly the case S1's own header comment named as "S2/S3's job". In the degenerate case (fromKey IS
   *  the leaf, e.g. the active/rightmost column's own trigger) this produces the exact same result as
   *  #drillTo's plain append, cl.A1's own "degenerates to today's append exactly". */
  #drillFrom(key: string, fromKey: string): void {
    if (!key) return
    const { path } = this.#resolve(this.#rawPath())
    const idx = path.indexOf(fromKey)
    const truncated = idx >= 0 ? path.slice(0, idx + 1) : path
    this.#commit([...truncated, key], 'forward')
  }

  /** Rebuild the crumbs trail wholesale (the pagination.ts `#rebuild` whole-array-swap precedent): one real
   *  `<button data-part="crumb">` per ancestor `resolvedPath` entry (label = that panel's `heading`, falling
   *  back to its `key`), then the SAME `heading` node — never recreated — moved in as the trail's last,
   *  non-interactive entry (cl.A3). cl.A6: the leaf carries `aria-current="location"` (Forks ruled ③, kept as
   *  drafted — a drill level is a position within a UI, not a page); ancestor crumbs carry NO `aria-current` —
   *  real buttons, not the trail's current entry (the APG current-item semantic names exactly one entry). */
  #renderCrumbs(resolvedPath: string[], panels: UIDrillPanelElement[]): void {
    const nav = this.#crumbsNav
    const heading = this.#heading
    if (!nav || !heading) return
    nav.hidden = false
    // Skip the wholesale rebuild when the trail's own content hasn't changed — an unrelated re-render
    // (a panel appended/removed elsewhere, a prop unrelated to `path`) must never churn DOM that may be
    // holding focus (a crumb button or the heading itself).
    const pathKey = resolvedPath.join(' ')
    if (pathKey === this.#lastCrumbsPath) return
    this.#lastCrumbsPath = pathKey
    const ancestorButtons = resolvedPath.slice(0, -1).map((key, index) => {
      const ancestorPanel = panels.find((p) => p.key === key)
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('data-part', 'crumb')
      button.setAttribute('data-drill-index', String(index))
      button.textContent = ancestorPanel?.heading || key
      return button
    })
    heading.setAttribute('aria-current', 'location')
    nav.replaceChildren(...ancestorButtons, heading)
  }

  // ── render: the one geometry+ARIA+motion effect ─────────────────────────────────────────────────────────

  #backLabel(activePanel: UIDrillPanelElement | null): string {
    const parentKey = activePanel?.parent
    if (!parentKey) return 'Back'
    const parent = this.#panels().find((p) => p.key === parentKey)
    return parent?.heading ? `Back to ${parent.heading}` : 'Back'
  }

  #render(): void {
    void this.#version.value // tracked unconditionally — the ui-split `#version` precedent (also bumped by
    // the S3 host ResizeObserver, so a real resize re-runs this effect and re-reads #effectiveLayout below)
    const panels = this.#panels()
    const { key: activeKey, path: resolvedPath } = this.#resolve(this.#rawPath())
    // S2 (cl.A2/A3) — read `chrome` so THIS effect re-runs on a chrome flip (S1 shipped the prop but never
    // read it in #render, since no render mapping existed yet for a non-default value).
    const chrome = this.chrome
    // S3 (cl.A1/A8) — the RESOLVED layout mapping, never `this.layout` directly: a narrow host silently
    // resolves 'columns' down to 'stack' (cl.A8), so every branch below reads THIS.
    const effectiveLayout = this.#effectiveLayout()
    const activePanel = panels.find((p) => p.key === activeKey) ?? null
    // component-checker MAJOR fix: the ONLY thing that licenses a VT swap or a focus move is the ACTIVE KEY
    // actually changing — a re-render for an unrelated reason (a panel appended/removed elsewhere, a prop
    // that isn't `path`) must never replay either. `#primed` alone was too broad: it stayed true across
    // every later render, not just a real level change (ADR-0195 cl.5's own "NON-INITIAL path change" wording).
    const keyChanged = this.#primed && activeKey !== this.#lastActiveKey
    const willUseVT = keyChanged && this.viewTransitions && viewTransitionAvailable()

    // ADR-0195 Amendment cl.A1 — the painted set (which panels get `hidden`/`inert`/z-order) is the `layout`
    // render mapping, and is STILL always `stack` (every panel whose key ∈ resolvedPath, ancestors dimmed +
    // inert behind the active panel) — `layout="columns"` (S3) remains accepted but not yet implemented.
    // `chrome` (this slice, S2) is an ORTHOGONAL axis: it selects the HEADER anatomy only (back+heading vs. the
    // crumbs trail, below) and never changes which panels paint.
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
      // S3 (cl.A1/A8) — the RESOLVED render mapping, a host-owned marker distinct from the authored
      // `[layout]` attribute (which never changes under cl.A8's narrow auto-degrade — only what it
      // resolves to does): drill.css keys its columns-only grid tracks + the stack-only ancestor scrim off
      // THIS, never `[layout='columns']`.
      this.setAttribute('data-drill-layout', effectiveLayout)
      for (const panel of panels) {
        const isPainted = paintedKeys.has(panel.key)
        const isActive = panel === activePanel
        panel.hidden = !isPainted
        // ADR-0124 F2 clone shape — visible pixels, no interaction surface: a painted ancestor is dimmed
        // (drill.css's scrim wash on `[data-drill-pane='ancestor']`) and `inert` (no focus, no clicks — the
        // one property that also keeps an inert ancestor's own drill-triggers from ever firing, which is
        // exactly what lets `#drillTo`/`#back` stay byte-unchanged, see file header). S3 (cl.A1/A6): under
        // 'columns' a painted ancestor is NEVER inert — "all interactive" is the whole point of the layout.
        panel.inert = effectiveLayout === 'stack' && isPainted && !isActive
        if (isPainted) {
          panel.setAttribute('data-drill-pane', isActive ? 'active' : 'ancestor')
          const pathIndex = resolvedPath.indexOf(panel.key)
          if (effectiveLayout === 'columns') {
            // cl.A4 — side-by-side tracks in PATH order (not DOM order, the same reasoning as stack's own
            // z-index below): the panel occupies its own explicit grid-column line, set inline so it wins
            // over drill.css's shared `grid-column: 1` same-cell base rule.
            panel.style.gridColumn = String(pathIndex + 1)
            panel.style.zIndex = ''
          } else {
            // z-order by PATH INDEX (cl.A1's own "z-ordered by path order"), not DOM order — a panel's
            // sibling position need not match its tree depth (panels are flat, keyed by `parent`), so
            // deriving z-index from resolvedPath directly is the only mapping that's always correct,
            // even though ancestor-vs-ancestor order is normally invisible under the identical scrim.
            panel.style.gridColumn = ''
            panel.style.zIndex = String(pathIndex + 1)
          }
        } else {
          panel.removeAttribute('data-drill-pane')
          panel.style.zIndex = ''
          panel.style.gridColumn = ''
        }
        if (isActive) {
          panel.linkHeading(this.#heading)
          panel.labelDirect(null)
        } else if (isPainted && effectiveLayout === 'columns') {
          // cl.A6 — a painted ANCESTOR column has no heading node of its own to point at (the one shared
          // [data-part="heading"] belongs to the active pane only): a plain string name instead.
          panel.linkHeading(null)
          panel.labelDirect(panel.heading || null)
        } else {
          panel.linkHeading(null)
          panel.labelDirect(null)
        }
      }
      if (this.#heading) this.#heading.textContent = activePanel?.heading ?? ''

      // S3 (cl.A6) — the columns active-row highlight: a host-toggled `data-drill-active` styling hook on
      // the ONE trigger, inside each painted ANCESTOR column, whose key names the NEXT path entry (the row
      // that was actually drilled into). Cleared first, unconditionally — an unrelated re-render, or a flip
      // back to 'stack', must never leave a stale marker behind.
      for (const stale of this.querySelectorAll('[data-drill-active]')) stale.removeAttribute('data-drill-active')
      if (effectiveLayout === 'columns') {
        for (const panel of panels) {
          if (panel === activePanel || !paintedKeys.has(panel.key)) continue
          const nextKey = resolvedPath[resolvedPath.indexOf(panel.key) + 1]
          if (!nextKey) continue
          for (const trigger of panel.querySelectorAll('[data-role="drill-trigger"][data-drill-key]')) {
            if (trigger.getAttribute('data-drill-key') === nextKey) trigger.setAttribute('data-drill-active', '')
          }
        }
      }
      // S2 (cl.A3) — chrome="crumbs" REPLACES the back+heading pair with the breadcrumb trail; this ADDS a
      // branch, it never edits the backbar branch below (byte-identical to what S1 shipped).
      if (chrome === 'crumbs') {
        if (this.#backButton) this.#backButton.hidden = true
        this.#renderCrumbs(resolvedPath, panels)
      } else {
        // backbar (default) — S1's shipped branch, untouched. Restore the heading to the header directly (a
        // no-op unless a PRIOR render moved it into the crumbs nav) and hide/clear that nav.
        if (this.#crumbsNav) {
          this.#crumbsNav.hidden = true
          this.#crumbsNav.replaceChildren()
          this.#lastCrumbsPath = null // force a real rebuild next time chrome flips back to 'crumbs'
        }
        if (this.#heading && this.#header && this.#heading.parentElement !== this.#header) {
          this.#header.append(this.#heading)
        }
        this.#heading?.removeAttribute('aria-current')
        if (this.#backButton) {
          const canGoBack = resolvedPath.length > 1
          this.#backButton.hidden = !canGoBack
          this.#backButton.setAttribute('aria-label', this.#backLabel(activePanel))
        }
      }
    }

    withViewTransition(mutate, willUseVT)

    // cl.A6 — columns never steals focus on drill-forward: the trigger keeps it, the child opens beside
    // (the one deliberate narrowing of cl.5, scoped to this layout only).
    if (keyChanged && activePanel && effectiveLayout !== 'columns') this.#heading?.focus()
    this.#lastActiveKey = activeKey
    this.#primed = true
  }

  // ── protected test seams ─────────────────────────────────────────────────────────────────────────────────

  /** Expose the currently-resolved effective path for test probes (controlled/uncontrolled parity assertions). */
  protected get effectivePathSeam(): string[] {
    return this.#resolve(this.#rawPath()).path
  }

  /** Expose the resolved render mapping for test probes (S3, cl.A1/A8). */
  protected get effectiveLayoutSeam(): 'stack' | 'columns' {
    return this.#effectiveLayout()
  }

  /** Expose the live header parts for test probes (focus/aria assertions). */
  protected get headerPartsSeam(): {
    back: HTMLButtonElement | null
    heading: HTMLHeadingElement | null
    crumbsNav: HTMLElement | null
  } {
    return { back: this.#backButton, heading: this.#heading, crumbsNav: this.#crumbsNav }
  }
}

if (!customElements.get('ui-drill')) customElements.define('ui-drill', UIDrillElement)
