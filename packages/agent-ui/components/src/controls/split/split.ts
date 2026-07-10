// split.ts — UISplitElement, the multi-pane (N-slot) resizable split container (app-surfaces-m4.lld.md
// LLD-C1/C4, SPEC-R1..R5; ADR-0120 cl.2 — the wave's hardest contract). A components-tier Container/layout
// primitive (sibling to `ui-row`/`ui-column`/`ui-grid`, `tier: layout`, NO control height): lays its
// `ui-split-pane` children out along one axis, control-managing exactly N−1 draggable + keyboard-resizable
// ARIA `separator` elements between adjacent pairs (the slider-thumb precedent — the author authors panes,
// never separators). `formAssociated: false` — a layout container contributes nothing to a form.
//
// Sizing model (SPEC-R2): controlled (`sizes` present) — the control RENDERS `sizes` and EMITS the
// proposed ratios on user resize but never self-mutates it (prop-as-source-of-truth, ADR-0102); uncontrolled
// (`sizes` undefined) — an internal `#ratios` signal drives the render directly, seeded from each pane's
// `initial` prop at connect and re-derived on every pane-count change (SPEC-R2 AC5, the dynamic-panes contract
// — a MutationObserver on `childList`, the `toast-region.ts` precedent). Mid-drag pane-count mutation
// ABORTS the in-flight drag FIRST (SPEC-R2 M2) via the pane-resize handle's distinct `abortDrag()`.
//
// Geometry: a `display: flex` row/column (axis picks the CSS identity via `[axis=vertical]`, split.css);
// each pane's proportional share rides a JS-written `--_pane-flex` custom property (the slider-multi
// `--value-pct-lo/-hi` geometry-seam precedent — this file NEVER writes a real layout style property
// directly, only namespaced custom properties CSS consumes). Two-neighbor redistribution + bounds-in-ratio-
// space math is entirely `constrain.ts` (DOM-free, pure); this file's job is measuring the live container/
// pane extents (`getBoundingClientRect`/`getComputedStyle`) and feeding ratio-space bounds into it.
//
// `controls → dom + traits + controls/split/split-pane.ts` — inward-only (no deep `packages/**/src`).

import { signal } from '../../reactive/index.ts'
import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { paneResize, type PaneResizeHandle } from '../../traits/pane-resize.ts'
import { UISplitPaneElement } from './split-pane.ts'
import { redistribute, seedRatios, rederiveRatios, reconcileRatios, type Bounds, type SizeSeed } from './constrain.ts'

const splitProps = {
  axis: { ...prop.enum(['horizontal', 'vertical'] as const, 'horizontal'), reflect: true },
  // `sizes` is a PROPERTY, not an attribute — too structured (a JS number[]) to reflect. `attribute: false`
  // means it is never observed/coerced from markup; `prop.json` supplies a codec ONLY so the descriptor
  // trip-wire's structural `kindOf` probe can classify it ('json' — the same array/structured-value
  // classification bar-chart's `data`/sparkline's `values` codecs already establish). undefined ⇒
  // UNCONTROLLED (internal ratios drive the render); present ⇒ CONTROLLED (SPEC-R2 §2).
  sizes: { ...prop.json<number[] | undefined>(undefined), attribute: false as const },
} satisfies PropsSchema

let paneIdSeq = 0

export interface UISplitElement extends ReactiveProps<typeof splitProps> {}
export class UISplitElement extends UIContainerElement {
  static props = splitProps

  // Uncontrolled internal ratio vector — a kernel signal so reading it inside `this.effect` tracks it.
  readonly #ratios = signal<number[]>([])
  // A structural-change poke the render/ARIA effect reads UNCONDITIONALLY (component-reviewer MEDIUM fix):
  // in UNCONTROLLED mode, #syncPanes's `#ratios` write already re-triggers the effect on its own (a fresh
  // array reference), but in CONTROLLED mode #syncPanes touches NO signal at all when the pane COUNT
  // changes (sizes itself is unchanged) — new separators would render bare (no aria-valuenow/-controls) and
  // the new pane would get no --_pane-flex until `sizes` next changed for an unrelated reason. Bumping this
  // on every real #syncPanes pass (both branches) forces the effect to re-run regardless of which mode is
  // active — the SPEC-R2 × SPEC-R4 intersection dynamic panes must hold in BOTH sizing modes.
  readonly #version = signal(0)

  #observer: MutationObserver | null = null
  #resizeHandle: PaneResizeHandle | null = null
  #separatorEls: HTMLElement[] = []
  #lastPaneCount: number | null = null // null = never synced (connect-time seed path)
  #warnedSizesMismatch = false
  readonly #collapseMemory = new Map<number, number>()

  protected connected(): void {
    this.#lastPaneCount = null
    this.#warnedSizesMismatch = false
    this.#collapseMemory.clear()

    this.#observer = new MutationObserver(() => this.#syncPanes())
    this.#observer.observe(this, { childList: true })
    this.#syncPanes() // seed from any children already present (declarative markup)

    this.#resizeHandle = paneResize(this, {
      separators: () => this.#separatorEls,
      axis: () => this.axis,
      rtl: () => getComputedStyle(this).direction === 'rtl',
      onResize: (sepIndex, deltaRatio, commit) => this.#applyPointerDelta(sepIndex, deltaRatio, commit),
    })

    this.listen(this, 'keydown', (event) => this.#handleKeydown(event as KeyboardEvent))

    // The one geometry+ARIA effect: re-runs on `axis`/`sizes` changes, on any pane's own `min`/`max` (read
    // per-pane inside the loop below, tracking each one individually), AND on `#version` (bumped by every
    // real #syncPanes pass regardless of sizing mode — the single render pass.
    this.effect(() => this.#render())
  }

  protected override disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
    this.#resizeHandle?.release()
    this.#resizeHandle = null
    for (const sep of this.#separatorEls) sep.remove()
    this.#separatorEls = []
  }

  // ── pane discovery + separator lifecycle (SPEC-R1, SPEC-R2 AC5) ────────────────────────────────────

  #panes(): UISplitPaneElement[] {
    return [...this.children].filter((el): el is UISplitPaneElement => el instanceof UISplitPaneElement)
  }

  /**
   * Re-derive the separator set (N−1) + (uncontrolled) ratio vector from the CURRENT pane list. Guarded
   * against re-entrant noise from the separator DOM mutations THIS function itself performs (the
   * MutationObserver watches `childList` on the host, so inserting/removing separators — non-pane children
   * — re-triggers the same callback; since `#panes()` filters to `UISplitPaneElement` only, a separator-
   * only mutation reports an UNCHANGED pane count and the guard below no-ops it, terminating the recursion).
   */
  #syncPanes(): void {
    const panes = this.#panes()
    const n = panes.length
    const isFirst = this.#lastPaneCount === null
    const countChanged = !isFirst && this.#lastPaneCount !== n
    if (!isFirst && !countChanged) return // separator-only noise — nothing to re-derive

    for (const pane of panes) {
      if (!pane.id) pane.id = `ui-split-pane-${++paneIdSeq}`
    }

    // Mid-drag mutation (SPEC-R2 M2): abort BEFORE re-deriving — the captured separator index is stale.
    if (countChanged) this.#resizeHandle?.abortDrag()

    for (const sep of this.#separatorEls) sep.remove()
    this.#separatorEls = []
    for (let i = 0; i < n - 1; i++) {
      const sep = document.createElement('div')
      sep.setAttribute('data-separator', '')
      sep.setAttribute('role', 'separator')
      sep.setAttribute('tabindex', '0')
      panes[i].after(sep)
      this.#separatorEls.push(sep)
    }

    if (this.sizes === undefined) {
      const seeds: SizeSeed[] = panes.map((p) => p.initial)
      this.#ratios.value = isFirst ? seedRatios(seeds) : rederiveRatios(this.#ratios.value, seeds)
    }
    // Unconditional poke (component-reviewer MEDIUM fix): the uncontrolled branch above already re-triggers
    // the render/ARIA effect via the `#ratios` write, but CONTROLLED mode touches no signal on a pane-count
    // change — bump this every real sync (both branches) so fresh separators always get their ARIA + the
    // new pane always gets its --_pane-flex, regardless of sizing mode.
    this.#version.value++

    this.#lastPaneCount = n
  }

  // ── ratio resolution (controlled vs uncontrolled, SPEC-R2 AC3/AC4) ─────────────────────────────────

  #effectiveRatios(panes: UISplitPaneElement[]): number[] {
    const sizes = this.sizes
    if (sizes !== undefined) {
      if (sizes.length !== panes.length) {
        if (!this.#warnedSizesMismatch) {
          console.warn(`ui-split: "sizes" has ${sizes.length} entries but ${panes.length} pane(s) are present — reconciling`)
          this.#warnedSizesMismatch = true
        }
      } else {
        this.#warnedSizesMismatch = false
      }
      return reconcileRatios(sizes, panes.length)
    }
    return this.#ratios.value
  }

  /** Physical [min,max] bounds in RATIO space, resolved from each pane's live CSS min/max (`getComputedStyle`
   *  — the used-value px resolution; degrades gracefully to `[0,1]` when unresolvable, e.g. jsdom's no-layout
   *  environment or a zero-extent container, per constrain.ts's own contradictory-bounds tolerance). */
  #boundsFor(panes: UISplitPaneElement[]): Bounds[] {
    const rect = this.getBoundingClientRect()
    const isH = this.axis === 'horizontal'
    const extent = isH ? rect.width : rect.height
    return panes.map((pane) => {
      if (extent <= 0) return [0, 1]
      const cs = getComputedStyle(pane)
      const minRaw = isH ? cs.minWidth : cs.minHeight
      const maxRaw = isH ? cs.maxWidth : cs.maxHeight
      const minPx = Number.parseFloat(minRaw) || 0
      const maxPx = maxRaw === 'none' || maxRaw === '' ? Infinity : Number.parseFloat(maxRaw)
      const minR = Math.min(1, minPx / extent)
      const maxR = Number.isFinite(maxPx) ? Math.min(1, maxPx / extent) : 1
      return [minR, Math.max(minR, maxR)]
    })
  }

  // ── resize application (shared by pointer + keyboard paths) ────────────────────────────────────────

  #resolveDelta(sepIndex: number, deltaRatio: number): number[] {
    const panes = this.#panes()
    return redistribute(this.#effectiveRatios(panes), sepIndex, deltaRatio, this.#boundsFor(panes))
  }

  #commitRatios(next: number[]): void {
    if (this.sizes === undefined) this.#ratios.value = next
  }

  /** The pane-resize trait's onResize callback (pointer path) — `input` per live move, `change` on commit
   *  (SPEC-R3 AC1). Controlled mode never self-mutates `sizes`; the proposed ratios ride the event detail
   *  (SPEC-R2 AC3 — the consumer reads `event.detail` and writes `sizes` back to move the rendered layout). */
  #applyPointerDelta(sepIndex: number, deltaRatio: number, commit: boolean): void {
    const next = this.#resolveDelta(sepIndex, deltaRatio)
    this.#commitRatios(next)
    this.emit<number[]>(commit ? 'change' : 'input', next)
  }

  /** The keyboard path — a discrete key press is both the live update AND the commit in one atomic action,
   *  so it emits BOTH `input` and `change` (the native `<input type=range>` per-keystep parity). */
  #applyKeyDelta(sepIndex: number, deltaRatio: number): void {
    const next = this.#resolveDelta(sepIndex, deltaRatio)
    this.#commitRatios(next)
    this.emit<number[]>('input', next)
    this.emit<number[]>('change', next)
  }

  // ── keyboard (SPEC-R4) ──────────────────────────────────────────────────────────────────────────────

  #keyStepRatio(): number {
    const raw = getComputedStyle(this).getPropertyValue('--ui-split-key-step').trim()
    if (raw.endsWith('%')) {
      const n = Number.parseFloat(raw)
      if (Number.isFinite(n)) return n / 100
    }
    return 0.05 // the fallback default (5%) — also what --ui-split-key-step declares
  }

  #handleKeydown(event: KeyboardEvent): void {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.hasAttribute('data-separator')) return
    const index = this.#separatorEls.indexOf(target)
    if (index === -1) return

    if (event.key === 'Enter') {
      const pane = this.#panes()[index]
      if (pane?.collapsible) {
        event.preventDefault()
        this.#toggleCollapse(index)
      }
      return
    }

    const axis = this.axis
    const rtl = getComputedStyle(this).direction === 'rtl'
    const isH = axis === 'horizontal'
    const growKey = isH ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown'
    const shrinkKey = isH ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp'

    // `--ui-split-key-step` is a percentage of the two-neighbor PAIR (SPEC-R4), matching aria-valuenow's
    // own normalization (split.md/split.css) — a screen-reader user hears aria-valuenow move by roughly the
    // step's percentage on every press, regardless of how large the pair is relative to the whole track.
    // `redistribute()` expects a whole-container-ratio delta, so the pair-relative step is scaled by the
    // pair's own combined extent before being passed in.
    const panes = this.#panes()
    const ratios = this.#effectiveRatios(panes)
    const pairExtent = (ratios[index] ?? 0) + (ratios[index + 1] ?? 0)
    const step = this.#keyStepRatio() * pairExtent

    let delta: number | null = null
    switch (event.key) {
      case growKey: delta = step; break
      case shrinkKey: delta = -step; break
      case 'Home': delta = -1; break // drive the leading pane to its minimum — redistribute clamps it
      case 'End': delta = 1; break // drive the leading pane to its maximum — redistribute clamps it
      default: return
    }
    event.preventDefault()
    this.#applyKeyDelta(index, delta)
  }

  #toggleCollapse(index: number): void {
    const panes = this.#panes()
    const current = this.#effectiveRatios(panes)
    const bounds = this.#boundsFor(panes)
    const [minI] = bounds[index] ?? [0, 1]
    const isCollapsed = current[index] <= minI + 1e-6
    if (isCollapsed) {
      const restore = this.#collapseMemory.get(index) ?? 1 / panes.length
      this.#collapseMemory.delete(index)
      this.#applyKeyDelta(index, restore - current[index])
    } else {
      this.#collapseMemory.set(index, current[index])
      this.#applyKeyDelta(index, minI - current[index])
    }
  }

  // ── render: geometry seam + ARIA (SPEC-R1/R4) ───────────────────────────────────────────────────────

  #render(): void {
    void this.#version.value // tracked unconditionally — see #version's own doc for why (the CONTROLLED-mode dynamic-panes fix)
    const axis = this.axis
    const isH = axis === 'horizontal'
    const panes = this.#panes()

    for (const pane of panes) {
      pane.toggleAttribute('data-axis-vertical', !isH)
      const min = pane.min // tracked — a per-pane min/max change re-runs this whole effect
      const max = pane.max
      pane.style.setProperty('--_pane-min', min || '')
      pane.style.setProperty('--_pane-max', max || '')
    }

    const ratios = this.#effectiveRatios(panes)
    panes.forEach((pane, i) => {
      pane.style.setProperty('--_pane-flex', String(Math.max(0, ratios[i] ?? 0)))
    })

    this.#updateAria(panes, ratios)
  }

  #updateAria(panes: UISplitPaneElement[], ratios: number[]): void {
    const axis = this.axis
    const bounds = this.#boundsFor(panes)
    this.#separatorEls.forEach((sep, i) => {
      const j = i + 1
      sep.setAttribute('aria-orientation', axis)
      sep.setAttribute('aria-controls', panes[i]?.id ?? '')
      if (!sep.hasAttribute('aria-label')) sep.setAttribute('aria-label', 'Resize panel')

      const ri = ratios[i] ?? 0
      const rj = ratios[j] ?? 0
      const pairExtent = ri + rj
      const [minI] = bounds[i] ?? [0, 1]
      const [minJ] = bounds[j] ?? [0, 1]
      const hiI = Math.max(minI, pairExtent - minJ)

      const now = pairExtent > 0 ? Math.round((ri / pairExtent) * 100) : 0
      const lo = pairExtent > 0 ? Math.round((minI / pairExtent) * 100) : 0
      const hi = pairExtent > 0 ? Math.round((hiI / pairExtent) * 100) : 100
      sep.setAttribute('aria-valuenow', String(now))
      sep.setAttribute('aria-valuemin', String(lo))
      sep.setAttribute('aria-valuemax', String(hi))
    })
  }

  // ── protected test seams ────────────────────────────────────────────────────────────────────────────

  /** Expose the live separator elements for test probes (structural ARIA/keyboard-target assertions). */
  protected get separatorElsSeam(): HTMLElement[] {
    return this.#separatorEls
  }

  /** Expose the CURRENT effective ratio vector (controlled `sizes`, reconciled, or the internal uncontrolled
   *  vector) for test probes — the sum-invariance / clamp / dynamic-pane assertions read this directly. */
  protected get ratiosSeam(): number[] {
    return this.#effectiveRatios(this.#panes())
  }
}

if (!customElements.get('ui-split')) customElements.define('ui-split', UISplitElement)
