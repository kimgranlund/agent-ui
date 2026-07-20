// app-shell.ts — UIAppShellElement + UIAppShellRegionElement, the M1 app-shell primitive (SPEC-R2/R3/R4/R5/R6;
// LLD-C3/C5, agent-app-shell.lld.md §4/§6; ADR-0083/0084). BEHAVIOUR + props + the region↔landmark-role map +
// the isolation connect-flow + self-define ONLY; the LIGHT-mode region-placement grid (incl. the `collapse`
// narrow rule) lives in app-shell.css (LLD-C4), the ISOLATED-mode `:host` mirror in app-shell-isolation.css
// (LLD-C5 F1b).
//
// `ui-app-shell` is the grid CONTAINER — a plain `UIElement` (structural, NOT form-associated). Its only prop
// is `isolated` (SPEC-R6/ADR-0082), a reflected boolean, default false (light-DOM, byte-identical to a shell
// with no isolation code path — SPEC-R6 AC1). When `true`, `connectedCallback` (overridden below, LLD-C5 F3)
// attaches a shadow root BEFORE delegating to the base, injects the fleet stylesheets + the F1b `:host` grid
// mirror INSIDE the boundary, and relocates the authored light-DOM regions into the shadow tree — the shape
// ADR-0082 ratifies over the reserved class-level `static shadow` seam (which cannot express a per-instance
// opt-in) and over `adoptedStyleSheets(barrelText)` (constructable sheets silently ignore `@import`).
//
// `ui-app-shell-region` is the GENERIC region element (the ratified generic-region fork, LLD §4/§7.1 — Kim,
// 2026-07-05): one reflected literal-union prop `region` (banner · navigation · main · complementary ·
// contentinfo, default `main`). It sets its ARIA landmark role THROUGH ITS OWN internals (never a host
// attribute) — REACTIVELY (an effect, not a one-shot assignment), so a runtime `region` reassignment re-
// derives the role live (the tabs.ts precedent for a role/state that tracks a reactive prop, vs. the
// constant-role list.ts/tab.ts shape). `region` reflects so the `[region=…]` attribute selectors (app-shell.css
// in light mode, app-shell-isolation.css's `:host` mirror when isolated) place it in the presence-driven grid
// — docking is composition (SPEC-R4 collapses into SPEC-R3): a child "names its target region" via this
// element's own prop, no attribute-on-arbitrary-child mechanism needed.
//
// Two more reflected props refine the region, both additive/back-compatible (ADR-0083/0084, ratified
// 2026-07-06 off the M1 a2ui-live dogfood):
//   - `landmark` (ADR-0083) OVERRIDES the ARIA role independently of `region` — the column and the landmark
//     were fused before this, so an author could not pick the layout column without also accepting its
//     landmark (a2ui-live's chat composer needed `region="navigation"`'s LEFT COLUMN with a `complementary`
//     landmark, not `navigation`'s). `internals.role = this.landmark || REGION_ROLE[this.region]`.
//   - `collapse` (ADR-0084) governs narrow-reflow behaviour PER region: `hide` (default, today's
//     `display:none`), `stack` (stays visible, spans the full column) — so a region carrying essential,
//     interactive content (the same composer) does not vanish narrow — or `toggle` (a user-driven
//     collapse/restore affordance, realized M4 Phase 2 / LLD-C11, `COLLAPSE_VALUES` below).
//
// Content model — both elements are host-as-{grid,block} over their light-DOM children: neither `render()`s a
// wrapper, so `render()` stays the inherited no-op and the agent's composed children are never clobbered.
//
// `controls → dom` is the allowed import direction fleet-wide; here it crosses a PACKAGE boundary too — only
// the public `@agent-ui/components` barrel/subpaths are imported (SPEC-R2 AC1 — no deep `packages/**/src`
// import), the apex-of-the-DAG law LLD-C2's layering.test.ts enforces.

import { UIElement, prop, signal, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
// The fleet stylesheets, injected INTO the isolated shadow root (LLD-C5 F1/F3) — resolved to their BUILT
// ASSET URLs via Vite's `?url` suffix (a bare `@import url('@agent-ui/components/...')` written into a
// dynamically-created `<style>` node would NOT resolve: the browser's own CSS `url()` fetch has no notion of
// a bare npm specifier — only a bundler's static `import` graph does. `?url` is what turns the specifier into
// a real, fetchable URL string at runtime, in both dev and a production build). FOUNDATION is injected too
// (not just component-styles) so the universal `*` dimension ramp + the `--md-sys-color-*` roles re-match
// shadow-tree elements (F1's correction — a document `*` rule cannot reach across the boundary).
import foundationStylesHref from '@agent-ui/components/foundation-styles.css?url'
import componentStylesHref from '@agent-ui/components/component-styles.css?url'
// The F1b `:host` grid-variant mirror (LLD-C5 §6) — a real, sectioned `.css` file (app-shell.css's own
// discipline: CSS is CSS, never a template literal), pulled in as RAW TEXT (never linked from the document,
// never part of any barrel) purely so this module can inject it into a shadow root at runtime.
import ISOLATION_GRID_CSS from './app-shell-isolation.css?raw'

// ── ui-app-shell ──────────────────────────────────────────────────────────────────────────────────────────

const shellProps = {
  // Opt-in style isolation (SPEC-R6/ADR-0082) — reflected, default false (light-DOM, byte-identical to a
  // shell built without the isolation code path at all, SPEC-R6 AC1). Connect-time only: a shadow root
  // cannot be detached once attached, so a post-connect toggle logs a dev warning (below) and takes effect
  // only on the NEXT connect.
  isolated: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

// The four NON-main region names (SPEC-R3) — the connect-time "has a main region?" check below mirrors
// app-shell.css's OWN exclusionary catch-all (main = "not one of these four"), NOT an inclusion match on the
// literal string 'main' or a bare `:not([region])` — the SAME reason app-shell.css's own comment gives: a
// coerced-but-unreflected `region` attribute keeps its literal, possibly-typo'd value forever, so only the
// exclusionary form catches an unrecognized value as main the same way the CSS grid-placement rule does.
const NON_MAIN_REGIONS = new Set(['banner', 'navigation', 'complementary', 'contentinfo'])

export interface UIAppShellElement extends ReactiveProps<typeof shellProps> {}
export class UIAppShellElement extends UIElement {
  static props = shellProps

  /**
   * The isolated-connect flow (LLD-C5 F3). The base `UIElement` resolves `renderRoot` from
   * `shadowRoot ?? this` (element.ts), so the shadow must exist BEFORE `super.connectedCallback()` installs
   * the render effect — this override runs the whole isolation setup first, then delegates. A documented,
   * localized divergence from the base's CONSTRUCTOR-time shadow attach (`static shadow`) — ADR-0082 §Consequences.
   */
  connectedCallback(): void {
    if (this.isolated && !this.shadowRoot) {
      // `!this.shadowRoot` makes a RE-connect safe: `attachShadow` throws on a second call, and a shadow root
      // cannot be detached once attached, so a reconnect with `isolated` still true is simply a no-op here —
      // the shadow (and whatever now lives inside it) persists across disconnect/reconnect untouched.
      const shadow = this.attachShadow({ mode: 'open' })

      // 1. Inject the fleet stylesheets INSIDE the boundary, as <link> nodes (the LLD's "equivalent <link>
      //    nodes" alternative to a <style>@import…</style> node — simpler, and avoids the browser having to
      //    parse an @import out of a dynamically-set textContent). FOUNDATION first, matching the document
      //    <link> load order every consumer already uses (component-styles.css's own barrel header), so the
      //    `*` ramp + colour roles are declared before component-styles' `:where()` token blocks read them.
      const foundation = document.createElement('link')
      foundation.rel = 'stylesheet'
      foundation.href = foundationStylesHref
      const components = document.createElement('link')
      components.rel = 'stylesheet'
      components.href = componentStylesHref

      // 2. Inject the F1b `:host` grid-variant mirror (app-shell-isolation.css) — the shell's OWN region
      //    grid, re-expressed for `:host` (a document `@scope (ui-app-shell)` sheet cannot reach relocated
      //    in-shadow regions; see that file's own banner for the full explanation).
      const grid = document.createElement('style')
      grid.textContent = ISOLATION_GRID_CSS

      shadow.append(foundation, components, grid)

      // 3. Relocate the authored light-DOM regions INTO the shadow tree (never `<slot>`-projected) — this is
      //    what makes leg (c)/AC3 hold: a host `ui-button {…}` rule cannot reach shadow-tree elements, but it
      //    CAN still reach slotted/light content. `...this.children` spreads the LIVE collection into a fixed
      //    argument list up front, so each subsequent move (append() re-parents one node at a time) cannot
      //    perturb the list still being iterated. M1 scope is STATIC composition (LLD-C5 "later-added
      //    children"): only children present at THIS moment relocate; a region appended after connect stays
      //    in light DOM (documented M1 limitation, an M2 MutationObserver/slot-strategy concern).
      shadow.append(...this.children)
    }
    super.connectedCallback()
  }

  protected connected(): void {
    // Developer diagnostic, not a thrown error (LLD-C3 failure/edge handling): SPEC-R3 makes `main`
    // mandatory as a CONTENT contract, not an auto-created empty band — a shell composed with no `main`
    // region is almost certainly a mistake, so flag it once at connect. One-shot — a region added to the DOM
    // after connect is not re-checked; there is no MutationObserver in this slice's scope.
    //
    // `root` is `this.shadowRoot ?? this` (the base's own `renderRoot` pattern): in isolated mode the regions
    // were just relocated INTO the shadow (connectedCallback above, which runs before this), so a plain
    // `this.querySelector` would search the now-EMPTY light DOM and false-positive-warn every time.
    //
    // MEASURED (both engines): a `:scope > x` combinator query does NOT match relocated direct children when
    // the query root is a `ShadowRoot` — a `root.querySelector(':scope > …')` call there false-positive-warned
    // on EVERY isolated shell, main region or not. Iterating `root.children` directly sidesteps `:scope`
    // entirely and works identically whether `root` is `this` (an Element) or `this.shadowRoot` (a
    // ShadowRoot) — both expose `.children`. The predicate mirrors the SAME exclusionary "is main" logic
    // `NON_MAIN_REGIONS` names above (not `[region="main"]` alone, not `:not([region])` alone): a garbage
    // `region="typo"` value or a never-touched default (no attribute at all) both count as main here, exactly
    // as app-shell.css's own catch-all grid-placement rule treats them.
    const root = this.shadowRoot ?? this
    const hasMain = [...root.children].some(
      (child) => child.tagName === 'UI-APP-SHELL-REGION' && !NON_MAIN_REGIONS.has(child.getAttribute('region') ?? ''),
    )
    if (!hasMain) {
      console.warn(
        '<ui-app-shell>: no <ui-app-shell-region region="main"> child found — SPEC-R3 requires a main region; the shell will render with no primary content area.',
      )
    }

    // `isolated` is connect-time only (ADR-0082 §Consequences): a shadow root cannot be detached once
    // attached, so a change AFTER this connect cannot retroactively take effect. The effect's FIRST run (this
    // synchronous registration) simply reflects the decision already acted on above — nothing to warn about;
    // every SUBSEQUENT run is a genuine post-connect change (the kernel's Object.is cutoff means a re-run
    // only ever fires on a real value change), which is exactly the case that needs the dev nudge.
    let firstRun = true
    this.effect(() => {
      this.isolated // track it
      if (firstRun) {
        firstRun = false
        return
      }
      console.warn(
        '<ui-app-shell>: `isolated` changed after connect — this has no effect until the shell re-connects (a shadow root cannot be detached once attached).',
      )
    })
  }
}

if (!customElements.get('ui-app-shell')) customElements.define('ui-app-shell', UIAppShellElement)

// ── ui-app-shell-region ───────────────────────────────────────────────────────────────────────────────────

// The region set (SPEC-R3) — ORDER-SIGNIFICANT: `main` LEADS the array so an out-of-set attribute value
// snaps back to it. props.ts' `enumType.from` falls back to `values[0]` on a non-member — NOT the declared
// `default` — the SAME order-dependent-fallback contract `UIContainerElement.surfaceProps` documents
// (container.ts's `SURFACE_STEPS`, `'0'` leads for the identical reason). SPEC-R4 AC2 requires an unknown
// region to resolve to `main`, so `main` must occupy index 0 here AND in app-shell-region.md's `values:`
// list (the contract↔props trip-wire probes this exact fallback via a non-member coercion, order-significant).
const REGION_VALUES = ['main', 'banner', 'navigation', 'complementary', 'contentinfo'] as const

// region → its ARIA landmark role (SPEC-R3 AC2) — 1:1, the region name IS the landmark name for all five.
const REGION_ROLE = {
  main: 'main',
  banner: 'banner',
  navigation: 'navigation',
  complementary: 'complementary',
  contentinfo: 'contentinfo',
} as const

// The `landmark` override set (ADR-0083) — ORDER-SIGNIFICANT, the SAME values[0]-fallback contract REGION_VALUES
// documents above: `''` LEADS so an out-of-set `landmark` (or the never-touched default) snaps back to it, and
// `'' || REGION_ROLE[region]` (below) falls through to the region's own default landmark. `''` is also the
// declared `default`, so there is no fallback SURPRISE here (unlike `region`, where `main` leads but is not
// index-0-by-coincidence — it's the same mechanism, just with the default and the fallback target already equal).
const LANDMARK_VALUES = ['', 'banner', 'navigation', 'main', 'complementary', 'contentinfo', 'region', 'form', 'search'] as const

// The `collapse` narrow-reflow set (ADR-0084/SPEC-R8) — `hide` leads (= the declared default = today's
// back-compat behaviour). `toggle` is now a REAL member (app-surfaces-m4.lld.md LLD-C11, M4 Phase 2): a
// user-collapsible region behind a control-rendered affordance (below) — narrow, the region stays visible +
// full-width like `stack` UNLESS the user has collapsed it via the affordance, in which case only the
// affordance itself remains reachable. `hide`/`stack` stay pure-CSS (this element drives no behaviour for
// either, app-shell.css/app-shell-isolation.css's own comment); `toggle` is the first `collapse` value with
// real .ts behaviour.
const COLLAPSE_VALUES = ['hide', 'stack', 'toggle'] as const

const regionProps = {
  region: { ...prop.enum(REGION_VALUES, 'main'), reflect: true },
  // ADR-0083: an OPTIONAL ARIA-landmark override, decoupled from `region`'s grid-column duty. Absent (the
  // default `''`) ⇒ the role falls through to `REGION_ROLE[region]` (back-compat, see the role effect below).
  landmark: { ...prop.enum(LANDMARK_VALUES, ''), reflect: true },
  // ADR-0084/SPEC-R8: per-region narrow-reflow behaviour. `hide` (default) is today's `display:none`,
  // unchanged; `stack` keeps the region visible + full-width in the narrow single column — BOTH pure-CSS
  // (app-shell.css's `@container` branch reads this reflected attribute directly, no .ts behaviour). `toggle`
  // is the exception: it gains a real, control-rendered user-collapsible affordance (below).
  collapse: { ...prop.enum(COLLAPSE_VALUES, 'hide'), reflect: true },
} satisfies PropsSchema

export interface UIAppShellRegionElement extends ReactiveProps<typeof regionProps> {}
export class UIAppShellRegionElement extends UIElement {
  static props = regionProps

  // The `collapse="toggle"` anatomy (SPEC-R8, LLD-C11) — a control-rendered `<button data-part=
  // "collapse-toggle">` + a `<div data-part="content">` wrapping the host's original light-DOM children,
  // created LAZILY and ONCE the first time `collapse` is ever `'toggle'` (the disclosure.ts "control-owned
  // part, created once, idempotent" precedent) — a region that never uses `toggle` gets NEITHER part, so
  // `hide`/`stack`-only usage is byte-identical to before this slice (the wide-layout-unchanged invariant's
  // .ts half; the CSS half is app-shell.css/app-shell-isolation.css's job). Once created, the parts persist
  // even if `collapse` later changes away from `toggle` (no unwrap-on-demand — the disclosure precedent
  // again: parts are created once, never torn down short of disconnect).
  #toggleBtn: HTMLButtonElement | null = null
  #contentWrap: HTMLElement | null = null
  // Whether the user has collapsed a `collapse="toggle"` region — a kernel signal (not `static props`: this
  // is presentation state a user ACTION drives, not an author-settable attribute; `internals.states` mirrors
  // it for CSS as a genuine custom state, SPEC-R8's "carries a collapsed custom-state").
  readonly #collapsed = signal(false)

  protected connected(): void {
    // ARIA landmark role (SPEC-R3 AC2, overridable per ADR-0083) — set THROUGH internals, never a host role
    // attribute. `this.landmark || REGION_ROLE[this.region]` — the `||` (NOT `??`) is load-bearing: the unset
    // value is the empty string `''` (falsy), and `'' ?? x` returns `''` unchanged (nullish-coalescing misses
    // `''`), which would leave the role blank instead of falling through to the region's default; `||` falls
    // through correctly. An out-of-set `landmark` coerces to `''` (the same enum-fallback precedent `region`
    // uses), so it likewise falls through — never throws, never sets a garbage role. Used outside a shell (no
    // ui-app-shell parent), the element still sets this role and simply renders as a plain block (no grid
    // parent → no grid-area effect) — the graceful-degradation edge LLD §4 documents.
    this.effect(() => {
      this.internals.role = this.landmark || REGION_ROLE[this.region]
    })

    // `collapse="toggle"` anatomy + collapsed-state sync (SPEC-R8, LLD-C11). A region that never sets
    // `collapse="toggle"` never runs the part-creation branch at all — this effect's FIRST read of
    // `this.collapse` for such a region is `!== 'toggle'`, an early return, no DOM touched.
    //
    // `wired` is a closure-local flag, fresh on EVERY `connected()` call (including a reconnect) — deliberately
    // NOT a `#`-field. It is what makes the click listener survive a disconnect/reconnect the PARTS themselves
    // survive (the disclosure.ts precedent: "the toggle LISTENER is wired ... once in connected() ... covers
    // the initial connect AND every reconnect, since parts persist across disconnect/reconnect but a fresh
    // AbortController is minted each connect"). MEASURED (isolation cross-engine, app-shell-isolation.browser.
    // test.ts): relocating an authored region into a shadow root (`shadow.append(...this.children)`,
    // app-shell.ts's OWN isolated connectedCallback) fires a genuine disconnect+reconnect on the moved node
    // (a plain `append()`/`appendChild()` of an already-connected custom element is remove-then-insert, not a
    // same-connection move — the `repeat` moveBefore precedent this repo already tracks elsewhere) — a listener
    // bound only inside `#ensureToggleParts`'s ONE-TIME part-creation branch would die with that first,
    // pre-relocation connection and never rebind, leaving an inert button post-relocation. Binding through
    // `wired` here instead re-listens on the CURRENT connection every time, while `#ensureToggleParts`'s own
    // field-based guard still creates the DOM nodes only once.
    let wired = false
    this.effect(() => {
      if (this.collapse !== 'toggle') return
      const { toggleBtn } = this.#ensureToggleParts()
      if (!wired) {
        wired = true
        this.listen(toggleBtn, 'click', () => {
          this.#collapsed.value = !this.#collapsed.value
          this.emit<boolean>('toggle', this.#collapsed.value)
        })
      }
      const collapsed = this.#collapsed.value
      toggleBtn.textContent = collapsed ? 'Show' : 'Hide'
      toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      if (collapsed) this.internals.states?.add('collapsed')
      else this.internals.states?.delete('collapsed')
    })
  }

  protected override disconnected(): void {
    this.internals.states?.delete('collapsed')
  }

  /** Idempotent part creation (disclosure.ts precedent) — moves the host's CURRENT light-DOM children into
   *  the content wrapper the FIRST time this runs; a part created on a later call is a no-op (parts persist,
   *  never torn down short of disconnect). Wires NO listener of its own — see the `wired` flag in `connected()`
   *  above for why that must be re-armed per-connection instead. */
  #ensureToggleParts(): { toggleBtn: HTMLButtonElement; contentWrap: HTMLElement } {
    if (this.#toggleBtn && this.#contentWrap) return { toggleBtn: this.#toggleBtn, contentWrap: this.#contentWrap }
    const contentWrap = document.createElement('div')
    contentWrap.setAttribute('data-part', 'content')
    contentWrap.append(...this.children) // adopt whatever the author composed, in order
    const toggleBtn = document.createElement('button')
    toggleBtn.type = 'button'
    toggleBtn.setAttribute('data-part', 'collapse-toggle')
    toggleBtn.setAttribute('aria-label', 'Toggle panel')
    this.append(toggleBtn, contentWrap)
    this.#toggleBtn = toggleBtn
    this.#contentWrap = contentWrap
    return { toggleBtn, contentWrap }
  }
}

if (!customElements.get('ui-app-shell-region')) customElements.define('ui-app-shell-region', UIAppShellRegionElement)
