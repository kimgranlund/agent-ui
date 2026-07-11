// master-detail.ts — UIMasterDetailElement, the app-tier master-detail composition (app-surfaces-m4.lld.md
// LLD-C10, SPEC-R7; ADR-0120 cl.3a — a SHIPPED composition, not a new interactive primitive). A docked
// list | detail arrangement over the shipped `ui-split` (LLD-C1), drilling into a single view below a
// narrow container-width threshold (the M1 `ui-app-shell` `@container` precedent, LLD-C4).
//
// Composition (SPEC-R7 "0 bespoke split/resize code"): the author docks content with two
// `ui-master-detail-pane` children (`pane="list"` / `pane="detail"`, master-detail-pane.ts — the
// `ui-app-shell-region` generic-region model). At connect, this element RELOCATES each whole pane element
// (never its individual grandchildren) into a freshly created `ui-split-pane`, wraps both in a freshly
// created `ui-split`, and appends that ONE composed child — the split's own resize/keyboard/ARIA/CSS DoD
// is inherited wholesale; nothing here re-implements it. Static composition at M1 (children present at
// connect only — the `ui-app-shell` isolation precedent for the identical limitation). Composition runs
// IDEMPOTENTLY — once ever, never again on a later reconnect (`#compose`'s own doc comment): `connected()`
// fires on every connect, including a relocation-induced disconnect/reconnect of the WHOLE subtree (e.g. an
// ancestor `ui-app-shell` opting into `isolated`, ADR-0082) that never actually changes this element's own
// children — recomposing there would find the panes already moved into the first split and append a
// second, empty one beside it (a MEASURED defect, fixed).
//
// Selection is a plain reflected `selected` prop (an item key) the CONSUMER writes (e.g. from a click
// handler inside its own list content, or a router binding, ADR-0115's "3 lines of consumer wiring") — this
// element owns no item-picking UI of its own. A reactive effect over `selected` derives the narrow-drill-in
// view (`detail` when a selection is present, else `list`) and — on every run AFTER the first (the
// app-shell.ts isolated/toggle-warn precedent: the first run is registration, not a chosen item) — emits
// the allow-listed `select`/`change` pair. The view is exposed as a reflected `data-view` HOST ATTRIBUTE
// (never a `static props` member — it is derived state, not author-settable API) that the CSS narrow branch
// reads to show one pane at a time plus a control-rendered "back" affordance; the back click flips the view
// back to `list` WITHOUT touching `selected` (going back only changes what is SHOWN, not what is selected).
//
// `controls → @agent-ui/components` only (incl. `ui-split`/`ui-split-pane`'s self-defining side-effect
// imports) — NEVER `@agent-ui/router` (SPEC-R13, ADR-0115); the app `layering.test.ts` trip-wire guards it.

// `signal` rides the SAME barrel's kernel re-export (dom → reactive transitively) — one import, not two.
import { UIElement, prop, signal, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
// Side-effect only: registers `ui-split` / `ui-split-pane` (LLD-C1) before this element's `connected()`
// ever calls `document.createElement` on either tag.
import '@agent-ui/components/controls/split'
import '@agent-ui/components/controls/split-pane'
import { UIMasterDetailPaneElement } from './master-detail-pane.ts'

const masterDetailProps = {
  // The current selection (an item key) — a plain reflected prop the CONSUMER writes; this element never
  // sets it itself (no bespoke item-picking UI, SPEC-R7). '' ⇒ no selection (the narrow view defaults to
  // `list`).
  selected: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

type View = 'list' | 'detail'

export interface UIMasterDetailElement extends ReactiveProps<typeof masterDetailProps> {}
export class UIMasterDetailElement extends UIElement {
  static props = masterDetailProps

  // The narrow-drill-in view — derived from `selected` (below), overridable by the back affordance WITHOUT
  // touching `selected` itself. A kernel signal (not a `static props` member): it is presentation state, not
  // part of the public attributes-as-API contract (mirrors ui-split's own `#ratios`/`#dragBaseline`).
  readonly #view = signal<View>('list')

  // The composed anatomy (LLD-C10) — created ONCE (idempotent, `#compose`'s own field guard below) and
  // PERSISTS across a reconnect; `#split` doubles as that guard. NOT reset in `disconnected()` — the same
  // "parts created once, never torn down short of the instance itself going away" shape `#ensureToggleParts`
  // (app-shell.ts) and disclosure.ts's own parts use.
  #split: HTMLElement | null = null
  #backBtn: HTMLButtonElement | null = null

  protected connected(): void {
    // Compose ONCE (component-reviewer MAJOR fix): `connected()` runs on EVERY connect, including a
    // RECONNECT with no DOM change of ITS OWN — e.g. a master-detail docked inside an `ui-app-shell` region
    // that later opts into `isolated` (ADR-0082's `shadow.append(...this.children)`) relocates the WHOLE
    // subtree, firing disconnectedCallback then connectedCallback on every custom element inside it,
    // master-detail included (the SAME relocation class the `collapse="toggle"` fix, app-shell.ts, already
    // hardened against). Composing unconditionally on a reconnect would find `#panes()` empty (the panes
    // already live inside the FIRST composed split, no longer direct children of `this`) and append a
    // SECOND, empty `ui-split` beside the real one — reproduced by the reviewer via a re-parent. `#split`
    // being already-set is what makes this a no-op the second time.
    this.#compose()

    // Re-wire the back button's click listener on EVERY connect (the SAME reconnect concern, one level
    // down): `this.listen` scopes to the CURRENT connection's AbortSignal, so a listener bound only inside
    // `#compose`'s one-time branch would die with the FIRST connection and never rebind post-relocation,
    // leaving an inert button — the exact bug class `#ensureToggleParts`'s own `wired` flag (app-shell.ts)
    // fixes for the toggle affordance. The button DOM node persists (via `#backBtn`); only the listener
    // needs re-arming.
    if (this.#backBtn) {
      this.listen(this.#backBtn, 'click', () => {
        this.#view.value = 'list'
      })
    }

    // selection → view + the select/change announcement pair. First run is registration (deep-link/initial
    // markup), never an "item chosen" — no event (the app-shell.ts toggle-warn / isolated-connect precedent).
    let firstRun = true
    this.effect(() => {
      const key = this.selected
      this.#view.value = key ? 'detail' : 'list'
      if (firstRun) {
        firstRun = false
        return
      }
      this.emit<string>('select', key)
      this.emit<string>('change', key)
    })

    // view → the `data-view` CSS hook (a plain host attribute, JS-owned — never author-settable `static
    // props`, the ui-split `data-axis-vertical`/`data-separator` precedent for a control-rendered marker).
    this.effect(() => {
      this.setAttribute('data-view', this.#view.value)
    })
  }

  // ── composition (idempotent — see the `#compose` doc comment for WHY it must be) ───────────────────────

  #panes(): UIMasterDetailPaneElement[] {
    return [...this.children].filter((el): el is UIMasterDetailPaneElement => el instanceof UIMasterDetailPaneElement)
  }

  /**
   * Relocate the authored `list`/`detail` pane children (whole elements, never re-parenting their own
   * grandchildren) into two fresh `ui-split-pane` wrappers inside one fresh `ui-split`, then append that
   * ONE composed child. A pane position with no authored child yields an EMPTY `ui-split-pane` (never a
   * throw — `ui-split` itself tolerates panes with no content; SPEC-R2's 0/1-pane degenerate-case tolerance
   * covers the "author provided neither" edge for free, since an empty split still renders two empty panes
   * + one separator here, never zero panes).
   *
   * IDEMPOTENT (component-reviewer MAJOR fix): `#split` already being set means this ran before — a no-op.
   * Composition is connect-TIME, not per-connect; see the `connected()` doc comment above for the reconnect
   * scenario this guards against. Wiring the back button's listener is NOT this method's job (see
   * `connected()`) — only DOM STRUCTURE is created here, once.
   */
  #compose(): void {
    if (this.#split) return
    const panes = this.#panes()
    const listPane = panes.find((p) => p.pane === 'list') ?? null
    const detailPane = panes.find((p) => p.pane === 'detail') ?? null

    const split = document.createElement('ui-split')
    const listWrap = document.createElement('ui-split-pane')
    listWrap.setAttribute('data-role', 'list')
    const detailWrap = document.createElement('ui-split-pane')
    detailWrap.setAttribute('data-role', 'detail')

    const back = this.#createBack() // ahead of the relocated detail content, so it reads first narrow
    detailWrap.append(back)
    if (listPane) listWrap.append(listPane) // re-parents the WHOLE authored element out of `this`
    if (detailPane) detailWrap.append(detailPane)

    split.append(listWrap, detailWrap)
    this.append(split) // `this`'s own children (the two panes) already moved out above — this is the only one left

    this.#split = split
    this.#backBtn = back
  }

  /** Build the control-rendered "back to list" affordance (SPEC-R7 AC1) — visible only narrow + drilled
   *  into `detail` (master-detail.css). No listener wired here (see `connected()` — that must re-arm on
   *  every connect, not just at creation time). */
  #createBack(): HTMLButtonElement {
    const back = document.createElement('button')
    back.type = 'button'
    back.setAttribute('data-part', 'back')
    back.textContent = '← Back'
    return back
  }
}

if (!customElements.get('ui-master-detail')) customElements.define('ui-master-detail', UIMasterDetailElement)
