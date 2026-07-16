// swiper.ts — UISwiperElement, the ui-swiper coordinator (swiper-family.lld.md LLD-C1/C2/C3/C5/C6/C7 ·
// swiper-family.spec.md SPEC-R1…R8/R10/R11/R14/R15 · ADR-0124). BEHAVIOUR + props + the owned scroll track +
// the clone-teleport infinite loop + keyboard + the bindable `active`/`select` commit + chrome drive + self-
// define ONLY; geometry/tokens live in swiper.css (the family's single sheet), the public contract in
// swiper.md. Importing this module registers all FIVE family tags (it imports the four leaf modules).
//
// The container (`extends UIContainerElement` for the surface axes + the reused protected `internals` — the
// `ui-tabs` base; NOT form-associated). It owns TWO control-created parts (idempotent across reconnect, the
// `ui-tabs` tablist precedent): the scrolling `[data-part=track]` (a single owned scroll region, SPEC-R3) and
// a visually-hidden polite `[data-part=live]` region. It REPARENTS its `ui-swiper-item` children into the
// track (the chrome anchors — `ui-swiper-pagination`/`-paddles`/`-label` — stay as track SIBLINGS, driven in
// place); it drives the whole widget from ONE place (a sibling cannot set another element's protected
// internals): the region's own `role='region'`/`ariaRoleDescription='carousel'`/accessible-name, each real
// item's `role=group`/`aria-roledescription='slide'`/position label (via `labelAs`), the clone-teleport loop,
// the bindable `active` + the one `select` commit event (the `ui-tabs` `selected`/`select` pattern, ADR-0019),
// and the chrome anchors' render/wiring.
//
// `controls → dom` is the allowed import direction; importing this module registers all five family tags (it
// imports the four leaf modules), so the barrel needs only `export * from './swiper/swiper.ts'`.

import { UIContainerElement } from '../../dom/container.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UISwiperItemElement } from './swiper-item.ts'
import { UISwiperPaginationElement } from './swiper-pagination.ts'
import { UISwiperPaddlesElement } from './swiper-paddles.ts'
import { UISwiperLabelElement } from './swiper-label.ts'
import type { UIButtonElement } from '../button/button.ts'

// A per-instance id seed so each swiper's label/track get unique IDREFs (the `ui-tabs` `tabsSeq` precedent).
let swiperSeq = 0

const ORIENTATIONS = ['horizontal', 'vertical'] as const
const ALIGNMENTS = ['start', 'center', 'end'] as const

const props = {
  ...UIContainerElement.surfaceProps, // elevation/brightness (ADR-0015)
  orientation: { ...prop.enum(ORIENTATIONS, 'horizontal'), reflect: true },
  'slides-in-view': { ...prop.string(), reflect: true }, // '' ⇒ responsive-auto; a numeric string pins columns
  align: { ...prop.enum(ALIGNMENTS, 'start'), reflect: true },
  loop: { ...prop.boolean(), reflect: true },
  duration: { ...prop.string(), reflect: true }, // '' ⇒ token default; CSS <time>, programmatic advances only
  easing: { ...prop.string(), reflect: true }, // '' ⇒ token default; CSS easing, programmatic advances only
  pagination: { ...prop.boolean(), reflect: true }, // stamp default dots anchor if none present
  paddles: { ...prop.boolean(), reflect: true }, // stamp default paddles anchor if none present
  active: { ...prop.string(), reflect: true }, // bindable active-slide identity (ADR-0019; commit = LLD-C7)
} satisfies PropsSchema

// The ARIA element-reflection helper — a MODULE-PRIVATE 3-line peer copy (tab.ts:24 / tab-panel.ts:19 /
// form.ts:120 are the other three folder copies; this is the family's 4th, not a shared export).
function reflectAriaElements(internals: ElementInternals, name: 'ariaLabelledByElements', elements: Element[]): void {
  if (name in internals) (internals as unknown as Record<string, Element[]>)[name] = elements
}

// ── easing (F1's JS scroll-animation engine — CSS scroll-behavior:smooth ignores custom properties) ────────
// A minimal, real cubic-bezier evaluator for the standard keyword set + `cubic-bezier(x1,y1,x2,y2)` — the
// vast majority of authored eases. An unrecognised curve (e.g. `steps()`) falls back to ease-in-out — a
// documented, graceful degradation, not a silent wrong answer.
const EASING_PRESETS: Record<string, readonly [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

function parseCubicBezier(spec: string): readonly [number, number, number, number] {
  const preset = EASING_PRESETS[spec.trim()]
  if (preset) return preset
  const m = /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/.exec(spec)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  return EASING_PRESETS['ease-in-out']
}

function bezierEase(points: readonly [number, number, number, number]): (t: number) => number {
  const [x1, y1, x2, y2] = points
  const bx = (t: number): number => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
  const by = (t: number): number => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3
  return (x: number): number => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (bx(mid) < x) lo = mid
      else hi = mid
    }
    return by((lo + hi) / 2)
  }
}

function parseCssTime(raw: string, fallbackMs: number): number {
  const s = raw.trim()
  const ms = /^(-?[\d.]+)ms$/.exec(s)
  if (ms) return Number(ms[1])
  const sec = /^(-?[\d.]+)s$/.exec(s)
  if (sec) return Number(sec[1]) * 1000
  return fallbackMs
}

type LoopBand = 'leading' | 'trailing'

export interface UISwiperElement extends ReactiveProps<typeof props> {}
export class UISwiperElement extends UIContainerElement {
  static props = props

  // Control-created parts (persist across reconnect — the ui-tabs precedent).
  #track: HTMLElement | null = null
  #live: HTMLElement | null = null
  #baseId = ''

  // Real-slide + clone bookkeeping.
  #slides: UISwiperItemElement[] = []
  #leadingClones: UISwiperItemElement[] = []
  #trailingClones: UISwiperItemElement[] = []
  #lastCloneBand = 0

  // Selection / commit state.
  #activeIndex = -1
  #activeApplied = false

  // Loop re-entrancy + settle detection.
  #teleporting = false
  #scrollSettleTimer: number | null = null
  #animFrame: number | null = null

  // Observers.
  #mutationObserver: MutationObserver | null = null
  #resizeObserver: ResizeObserver | null = null
  #mutationScheduled = false

  /** REAL items only (clones excluded), DOM order. */
  get slides(): UISwiperItemElement[] {
    return this.#slides
  }

  /** The resolved real index — always freshly derived from `this.active` (the `#resolveIndex` result). */
  get activeIndex(): number {
    return this.#resolveIndex()
  }

  /** Advance one slide (wraps into the trailing clone of slide 0 in loop mode — never a visible rewind). */
  next(): void {
    const target = this.#advanceTarget(1)
    if (target) this.#animateTo(target)
  }

  /** Retreat one slide (wraps into the leading clone of the last slide in loop mode). */
  prev(): void {
    const target = this.#advanceTarget(-1)
    if (target) this.#animateTo(target)
  }

  /** Scroll a REAL index into the align position (a rAF scroll animation over duration/easing; instant under
   *  reduced-motion or while the loop teleport is in flight). */
  goTo(index: number): void {
    const target = this.#slides[index]
    if (target) this.#animateTo(target)
  }

  protected connected(): void {
    if (!this.#baseId) this.#baseId = `ui-swiper-${++swiperSeq}`

    this.#ensureParts()
    this.#captureSlides()

    // The region's own ARIA (SPEC-R15) — static facts, set once via internals, never a host attribute.
    this.internals.role = 'region'
    this.internals.ariaRoleDescription = 'carousel'
    this.#applyRegionLabel()

    this.#rebuildLoop() // clones, if loop
    this.#lastCloneBand = this.loop ? this.#cloneBandSize() : 0
    this.#labelSlides()
    this.#driveChrome()

    this.listen(this.#track!, 'scroll', this.#onScroll, { passive: true })
    this.listen(this, 'keydown', this.#onKeydown)

    // duration/easing → inline custom-property overrides the JS scroll animation reads (LLD §7 Consequences).
    this.effect(() => {
      if (this.duration !== '') this.style.setProperty('--ui-swiper-duration', this.duration)
      else this.style.removeProperty('--ui-swiper-duration')
    })
    this.effect(() => {
      if (this.easing !== '') this.style.setProperty('--ui-swiper-easing', this.easing)
      else this.style.removeProperty('--ui-swiper-easing')
    })

    // The active effect + the chrome re-drive — ONE scope-owned effect: applying `active` (LLD-C7) and
    // re-driving pagination/paddles/label (LLD-C9/C10/C11) share the same reactive dependencies
    // (active/pagination/paddles/orientation/loop), so one effect keeps them in lock-step, exactly the
    // way `ui-tabs`'s single selection effect covers roving + panel visibility together.
    this.effect(() => {
      this.#applyActive()
      this.#driveChrome()
    })

    // Motion gate (interaction-states standard) — arm `ready` one frame past first paint (the `ui-tabs`
    // precedent): the synchronous initial position/selection snaps; only later changes animate.
    requestAnimationFrame(() => this.internals.states?.add('ready'))

    // Rebuild clones + re-label + re-drive chrome when the author adds/removes slides.
    this.#mutationObserver = new MutationObserver(() => this.#scheduleMutationSync())
    this.#mutationObserver.observe(this, { childList: true })

    // Recompute columns → rebuild the clone band when a `@container` breakpoint crosses under
    // `slides-in-view=''` (responsive columns) — a real-browser-only mechanism; a no-op guard keeps this
    // jsdom-safe (ResizeObserver is absent there).
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(() => this.#onResize())
      this.#resizeObserver.observe(this)
    }
  }

  protected disconnected(): void {
    this.#mutationObserver?.disconnect()
    this.#mutationObserver = null
    this.#resizeObserver?.disconnect()
    this.#resizeObserver = null
    if (this.#animFrame !== null) {
      cancelAnimationFrame(this.#animFrame)
      this.#animFrame = null
    }
    if (this.#scrollSettleTimer !== null) {
      clearTimeout(this.#scrollSettleTimer)
      this.#scrollSettleTimer = null
    }
  }

  // ── parts + slide capture ──────────────────────────────────────────────────────────────────────────────

  #ensureParts(): void {
    let track = this.#track
    if (!track) {
      track = document.createElement('div')
      track.setAttribute('data-part', 'track')
      track.setAttribute('role', 'group') // rides the PART div (the ui-tabs tablist-strip precedent)
      track.tabIndex = 0
      this.#track = track
    }
    if (track.parentNode !== this) this.insertBefore(track, this.firstChild)

    let live = this.#live
    if (!live) {
      live = document.createElement('div')
      live.setAttribute('data-part', 'live')
      live.setAttribute('aria-live', 'polite')
      this.#live = live
    }
    if (live.parentNode !== this) this.appendChild(live)
  }

  /** Reparent `ui-swiper-item` children into the track (idempotent); chrome anchors stay host siblings. */
  #captureSlides(): void {
    const track = this.#track!
    for (const child of [...this.children]) {
      if (child instanceof UISwiperItemElement && child.parentNode !== track) track.appendChild(child)
    }
    this.#slides = [...track.children].filter(
      (c): c is UISwiperItemElement => c instanceof UISwiperItemElement && c.dataset.swiperClone === undefined,
    )
  }

  #scheduleMutationSync(): void {
    if (this.#mutationScheduled) return
    this.#mutationScheduled = true
    queueMicrotask(() => {
      this.#mutationScheduled = false
      if (!this.isConnected) return
      this.#captureSlides()
      this.#rebuildLoop()
      this.#lastCloneBand = this.loop ? this.#cloneBandSize() : 0
      this.#labelSlides()
      this.#driveChrome()
    })
  }

  // ── region + slide labelling ────────────────────────────────────────────────────────────────────────────

  #applyRegionLabel(): void {
    const label = this.querySelector(':scope > ui-swiper-label')
    if (label instanceof UISwiperLabelElement) {
      if (!label.id) label.id = `${this.#baseId}-label`
      reflectAriaElements(this.internals, 'ariaLabelledByElements', [label])
      this.internals.ariaLabel = null
      this.#track?.setAttribute('aria-label', (label.textContent ?? '').trim() || 'Carousel')
    } else {
      this.internals.ariaLabel = 'Carousel'
      this.#track?.setAttribute('aria-label', 'Carousel')
    }
  }

  #labelSlides(): void {
    const count = this.#slides.length
    this.#slides.forEach((slide, i) => slide.labelAs(`${i + 1} of ${count}`))
  }

  #announce(index: number): void {
    if (this.#live) this.#live.textContent = `Slide ${index + 1} of ${this.#slides.length}`
  }

  // ── bindable active + the select commit (LLD-C7, SPEC-R7/R14) ─────────────────────────────────────────────

  /** `''` ⇒ 0; a real item whose `value` equals `active` wins; else a numeric in-range index; else 0
   *  (the `ui-tabs` `#resolveIndex` precedent, SPEC-R14). */
  #resolveIndex(): number {
    const slides = this.#slides
    if (slides.length === 0) return 0
    const sel = this.active
    if (sel === '') return 0
    const byValue = slides.findIndex((s) => s.key !== '' && s.key === sel)
    if (byValue !== -1) return byValue
    if (/^\d+$/.test(sel)) {
      const n = Number(sel)
      if (n >= 0 && n < slides.length) return n
    }
    return 0
  }

  /** Reads `this.active` (tracked); resolves the real index and `goTo`s it if the track is not already
   *  there. The FIRST run snaps instantly (no animation) — the `ui-tabs` first-paint-snaps precedent. */
  #applyActive(): void {
    const index = this.#resolveIndex()
    const first = !this.#activeApplied
    this.#activeApplied = true
    if (index === this.#activeIndex && !first) return
    this.#activeIndex = index
    this.#announce(index)
    if (!this.#slides[index]) return
    if (first) {
      const target = this.#slides[index]
      if (target) this.#setScrollPos(this.#alignedOffset(target), 'auto')
    } else {
      this.goTo(index) // the PUBLIC seam (LLD §4) — also what a spy observes
    }
  }

  /** Commit a user-driven selection (scroll settle / paddle / dot / key): compare against the PRE-settle
   *  `#activeIndex` (so a genuine wrap, e.g. the last real slide → the first, still emits), eager-set the new
   *  index, write `this.active` (reflects + wakes the active effect — a no-op there since the index already
   *  matches), and emit `select` ONLY when the real index CHANGED — so the renderer's own two-way write never
   *  echoes (ADR-0019). The loop's own teleport never produces a SECOND settle to double-count (`#onScroll`'s
   *  `#teleporting` guard suppresses the jump's own scroll events structurally) — one settle, one commit,
   *  one changed-index test (LLD §5). */
  #commit(index: number, moveFocus: boolean): void {
    const item = this.#slides[index]
    if (!item) return
    const changed = index !== this.#activeIndex
    const identity = item.key !== '' ? item.key : String(index)
    this.#activeIndex = index
    this.active = identity
    this.#announce(index)
    if (moveFocus) item.focus()
    if (changed) this.emit('select', { value: identity, index })
  }

  // ── keyboard (LLD-C6, SPEC-R4/R5) ──────────────────────────────────────────────────────────────────────

  #onKeydown = (evt: Event): void => {
    const event = evt as KeyboardEvent
    const horizontal = this.orientation === 'horizontal'
    const isNext = horizontal ? event.key === 'ArrowRight' : event.key === 'ArrowDown'
    const isPrev = horizontal ? event.key === 'ArrowLeft' : event.key === 'ArrowUp'
    if (isNext) {
      event.preventDefault()
      this.next()
    } else if (isPrev) {
      event.preventDefault()
      this.prev()
    } else if (event.key === 'Home') {
      event.preventDefault()
      this.goTo(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      if (this.#slides.length > 0) this.goTo(this.#slides.length - 1)
    }
  }

  // ── the infinite loop — clone-teleport (LLD-C5, SPEC-R10/R11) ──────────────────────────────────────────

  /** `k = ceil(slidesInView) + 1`. A pinned numeric `slides-in-view` resolves purely in JS; the `''`
   *  responsive-auto sentinel reads the CSS-resolved `--ui-swiper-columns` (real-browser-only — jsdom/no-CSS
   *  falls back to 1, the token default). */
  #slidesInViewCount(): number {
    const raw = this['slides-in-view']
    if (raw !== '') {
      const n = Number.parseFloat(raw)
      if (Number.isFinite(n) && n > 0) return n
    }
    if (!this.#track) return 1
    const computed = getComputedStyle(this.#track).getPropertyValue('--ui-swiper-columns').trim()
    const n = Number.parseFloat(computed)
    return Number.isFinite(n) && n > 0 ? n : 1
  }

  #cloneBandSize(): number {
    return Math.ceil(this.#slidesInViewCount()) + 1
  }

  #cloneSlide(src: UISwiperItemElement): UISwiperItemElement {
    const clone = src.cloneNode(true) as UISwiperItemElement
    clone.removeAttribute('id')
    for (const el of clone.querySelectorAll('[id]')) el.removeAttribute('id')
    clone.setAttribute('aria-hidden', 'true')
    clone.inert = true
    clone.dataset.swiperClone = ''
    return clone
  }

  #clearClones(): void {
    for (const c of this.#leadingClones) c.remove()
    for (const c of this.#trailingClones) c.remove()
    this.#leadingClones = []
    this.#trailingClones = []
  }

  /** (Re)build the clone band. Non-loop: clears clones and returns (real slides only). Loop: deep-clones the
   *  last `k` real slides → prepended (leading), the first `k` → appended (trailing); each clone is
   *  id-stripped + `aria-hidden` + `inert` + marked `data-swiper-clone` (excluded from `get slides`). Scrolls
   *  the first real slide to the align position WITHOUT animation so the leading clones sit off-viewport. */
  #rebuildLoop(): void {
    this.#clearClones()
    const track = this.#track
    if (!track || !this.loop || this.#slides.length === 0) return
    const real = this.#slides
    const k = Math.min(this.#cloneBandSize(), real.length)
    const lastK = real.slice(real.length - k)
    const firstK = real.slice(0, k)
    this.#leadingClones = lastK.map((src) => this.#cloneSlide(src))
    this.#trailingClones = firstK.map((src) => this.#cloneSlide(src))
    for (const clone of this.#leadingClones) track.insertBefore(clone, real[0])
    for (const clone of this.#trailingClones) track.appendChild(clone)
    this.#setScrollPos(this.#alignedOffset(real[0]), 'auto')
  }

  /** The pixel extent of the whole real slide set (the distance from the first-real to the first-trailing-
   *  clone snap target) — the exact jump distance a clone-band settle teleports by. */
  #realSetExtent(): number {
    if (this.#trailingClones.length === 0 || this.#slides.length === 0) return 0
    return this.#alignedOffset(this.#trailingClones[0]) - this.#alignedOffset(this.#slides[0])
  }

  /** The element to advance to (next()/prev()): the adjacent real slide, or — at a loop-mode boundary — the
   *  clone that represents the wrap target (never a `goTo(0)` rewind across the whole track). */
  #advanceTarget(dir: 1 | -1): HTMLElement | null {
    const count = this.#slides.length
    if (count === 0) return null
    const idx = this.activeIndex + dir
    if (idx >= 0 && idx < count) return this.#slides[idx]
    if (!this.loop) return null
    if (dir > 0) return this.#trailingClones[0] ?? this.#slides[0]
    return this.#leadingClones[this.#leadingClones.length - 1] ?? this.#slides[count - 1]
  }

  #onScroll = (): void => {
    if (this.#teleporting) return // suppress interim scroll-event handling during our own jump
    if (this.#scrollSettleTimer !== null) clearTimeout(this.#scrollSettleTimer)
    this.#scrollSettleTimer = setTimeout(() => {
      this.#scrollSettleTimer = null
      this.#onSettle()
    }, 120) as unknown as number
  }

  /** One settle → one #commit call, structurally (the `#teleporting` guard in `#onScroll` suppresses the
   *  jump's own scroll events, so a clone-band settle never produces a SECOND settle cycle to double-count).
   *  `#commit`'s changed-index test (against the PRE-settle `#activeIndex`) is what makes the emit correct —
   *  a real index change (e.g. the last real slide wrapping to the first) must still emit exactly once. */
  #onSettle(): void {
    if (!this.isConnected) return
    const node = this.#nearestSlide()
    if (!node) return
    const mapped = this.#mapToReal(node)
    if (!mapped) return
    const { index, band } = mapped
    if (band) this.#teleport(band)
    this.#commit(index, false)
  }

  /** The track child (real or clone) whose aligned snap target is nearest the current scroll position — the
   *  same box-alignment geometry native `scroll-snap-align` uses to settle. jsdom has no scroll layout (every
   *  rect is zero), so this resolves vacuously there — the real-engine browser leg carries this proof. */
  #nearestSlide(): HTMLElement | null {
    const track = this.#track
    if (!track) return null
    const candidates = [...track.children] as HTMLElement[]
    if (candidates.length === 0) return null
    const pos = this.#scrollPos()
    let best: HTMLElement | null = null
    let bestDelta = Infinity
    for (const el of candidates) {
      const delta = Math.abs(this.#alignedOffset(el) - pos)
      if (delta < bestDelta) {
        bestDelta = delta
        best = el
      }
    }
    return best
  }

  #mapToReal(node: HTMLElement): { index: number; band: LoopBand | null } | null {
    const realIdx = this.#slides.indexOf(node as UISwiperItemElement)
    if (realIdx !== -1) return { index: realIdx, band: null }
    const leadIdx = this.#leadingClones.indexOf(node as UISwiperItemElement)
    if (leadIdx !== -1) {
      const k = this.#leadingClones.length
      return { index: this.#slides.length - k + leadIdx, band: 'leading' }
    }
    const trailIdx = this.#trailingClones.indexOf(node as UISwiperItemElement)
    if (trailIdx !== -1) return { index: trailIdx, band: 'trailing' }
    return null
  }

  /** Jump the scroll offset by exactly the real-set extent, `scroll-behavior: auto` (instant, sub-frame) —
   *  pixel-seamless because the clone is pixel-identical to its real twin. `#teleporting` suppresses the
   *  jump's OWN scroll events; it is a secondary guard only (the changed-index test in `#commit` is primary,
   *  LLD §5). */
  #teleport(band: LoopBand): void {
    const extent = this.#realSetExtent()
    if (extent <= 0) return
    this.#teleporting = true
    const current = this.#scrollPos()
    const next = band === 'leading' ? current + extent : current - extent
    this.#setScrollPos(next, 'auto')
    requestAnimationFrame(() => {
      this.#teleporting = false
    })
  }

  #onResize(): void {
    if (!this.loop) return
    const k = this.#cloneBandSize()
    if (k === this.#lastCloneBand) return // a resize that does not change the column count is a no-op
    this.#lastCloneBand = k
    this.#scheduleMutationSync()
  }

  // ── the scroll-position + alignment maths (shared by goTo/teleport/settle-detection) ──────────────────────

  #prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  #scrollPos(): number {
    const track = this.#track
    if (!track) return 0
    return this.orientation === 'horizontal' ? track.scrollLeft : track.scrollTop
  }

  #setScrollPos(value: number, behavior: ScrollBehavior): void {
    const track = this.#track
    if (!track) return
    if (typeof track.scrollTo === 'function') {
      if (this.orientation === 'horizontal') track.scrollTo({ left: value, behavior })
      else track.scrollTo({ top: value, behavior })
    } else if (this.orientation === 'horizontal') {
      track.scrollLeft = value
    } else {
      track.scrollTop = value
    }
  }

  /** The scrollLeft/scrollTop that aligns `target`'s start/center/end edge with the track's, per `this.align`
   *  (the same geometry `scroll-snap-align` expresses in CSS). jsdom returns zero rects for every element, so
   *  this resolves to 0 there — a real-engine-only proof (the browser leg's seam-jump assertion). */
  #alignedOffset(target: Element): number {
    const track = this.#track
    if (!track) return 0
    const trackRect = track.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const horizontal = this.orientation === 'horizontal'
    const trackStart = horizontal ? trackRect.left : trackRect.top
    const trackSize = horizontal ? trackRect.width : trackRect.height
    const targetStart = horizontal ? targetRect.left : targetRect.top
    const targetSize = horizontal ? targetRect.width : targetRect.height
    const base = this.#scrollPos() + (targetStart - trackStart)
    if (this.align === 'center') return base - (trackSize - targetSize) / 2
    if (this.align === 'end') return base - (trackSize - targetSize)
    return base
  }

  /** Scroll (or jump) to `target`: instant under reduced-motion or while `#teleporting`, else a JS `rAF` scroll
   *  animation over `--ui-swiper-duration`/`--ui-swiper-easing` (F1 — native `scroll-behavior: smooth` ignores
   *  author custom properties, so this is NOT that). */
  #animateTo(target: HTMLElement): void {
    const to = this.#alignedOffset(target)
    const from = this.#scrollPos()
    if (this.#prefersReducedMotion() || this.#teleporting || Math.abs(to - from) < 0.5) {
      this.#setScrollPos(to, 'auto')
      return
    }
    this.#runScrollAnimation(from, to)
  }

  #runScrollAnimation(from: number, to: number): void {
    if (this.#animFrame !== null) cancelAnimationFrame(this.#animFrame)
    const track = this.#track
    const durationRaw = track ? getComputedStyle(track).getPropertyValue('--ui-swiper-duration') : ''
    const easingRaw = track ? getComputedStyle(track).getPropertyValue('--ui-swiper-easing') : ''
    const durationMs = parseCssTime(durationRaw, 250)
    const ease = bezierEase(parseCubicBezier(easingRaw || 'ease-in-out'))
    const start = performance.now()
    const step = (now: number): void => {
      const elapsed = now - start
      const t = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs)
      this.#setScrollPos(from + (to - from) * ease(t), 'auto')
      if (t < 1) this.#animFrame = requestAnimationFrame(step)
      else this.#animFrame = null
    }
    this.#animFrame = requestAnimationFrame(step)
  }

  // ── chrome drive (LLD-C9/C10/C11, SPEC-R12) ────────────────────────────────────────────────────────────

  #findPagination(): UISwiperPaginationElement | null {
    const existing = this.querySelector(':scope > ui-swiper-pagination')
    if (existing instanceof UISwiperPaginationElement) return existing
    if (!this.pagination) return null
    const stamped = document.createElement('ui-swiper-pagination') as UISwiperPaginationElement
    stamped.setAttribute('data-default', '') // default placement below the track (swiper.css)
    this.appendChild(stamped)
    return stamped
  }

  #findPaddles(): UISwiperPaddlesElement | null {
    const existing = this.querySelector(':scope > ui-swiper-paddles')
    if (existing instanceof UISwiperPaddlesElement) return existing
    if (!this.paddles) return null
    const stamped = document.createElement('ui-swiper-paddles') as UISwiperPaddlesElement
    stamped.setAttribute('data-default', '') // default placement overlaid on the track (swiper.css)
    this.insertBefore(stamped, this.#track)
    return stamped
  }

  /** Find a descendant pagination/paddles/label anchor (present wins over the boolean stamp); drive each in
   *  place. Re-run on child mutation + on active/pagination/paddles/orientation change (the single connected()
   *  effect above). */
  #driveChrome(): void {
    const pagination = this.#findPagination()
    const paddles = this.#findPaddles()

    if (pagination) pagination.renderInto(this.#slides.length, this.activeIndex, (i) => this.goTo(i))

    if (paddles) {
      paddles.fill(
        () => this.prev(),
        () => this.next(),
        this.orientation,
      )
      const prevBtn = paddles.querySelector('[data-part="prev"]') as UIButtonElement | null
      const nextBtn = paddles.querySelector('[data-part="next"]') as UIButtonElement | null
      const atStart = this.activeIndex <= 0
      const atEnd = this.activeIndex >= this.#slides.length - 1
      if (prevBtn) prevBtn.disabled = !this.loop && atStart // paddles never disable in loop mode
      if (nextBtn) nextBtn.disabled = !this.loop && atEnd
    }

    this.#applyRegionLabel()
  }
}

if (!customElements.get('ui-swiper')) customElements.define('ui-swiper', UISwiperElement)
