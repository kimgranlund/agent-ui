// leak-instrument.ts: the counting layer behind the standing leak gate (`leak-gate.browser.test.ts`, T-0543;
// promoted from the T-0535 probe). `installLeakInstrument()` wraps `addEventListener` / `removeEventListener`,
// the three observers, `setInterval` / `setTimeout` and `requestAnimationFrame` so a test can ask what a
// control left alive after it was removed. Test-only: no control or barrel imports it, and nothing runs at
// import time, so a bundle that never calls the installer is unaffected. Real-engine only (the wrappers patch
// the page's own globals); call the installer BEFORE the control modules load, so their first listener passes
// through the wrappers.

export interface LeakSnap {
  /** Listeners on window, document or any connected node outside the probed host. */
  globalListeners: number
  globalListenerKeys: string[]
  /** Listeners on the probed host or a node inside it. */
  hostListeners: number
  observers: number
  observerKinds: string[]
  intervals: number
  timeouts: number
  rafs: number
  popoverOpen: number
}

export interface LeakInstrument {
  snap(host: Element | null): LeakSnap
  /** Timers set while tracking is on are counted; the rest are ignored (module warm-up, test plumbing). */
  setTracking(on: boolean): void
  resetTimers(): void
  /** Untracked timer entry points, for the test's own waits. */
  realSetTimeout: typeof setTimeout
}

type ListenerKey = { target: EventTarget; type: string; fn: unknown; capture: boolean }
type ObserverRecord = { kind: string; targets: Set<Node | Element> }
type ObserverCtor = new (...a: never[]) => { observe: (...a: never[]) => void; disconnect: () => void }

const INSTALLED = Symbol.for('agent-ui.leak-instrument')

const captureOf = (o: unknown): boolean =>
  typeof o === 'boolean' ? o : !!(o as { capture?: boolean } | undefined)?.capture

const describeTarget = (t: EventTarget): string => {
  if (t === window) return 'window'
  if (t === document) return 'document'
  if (t instanceof Element) return t.localName + (t.getAttribute('data-part') ? `[${t.getAttribute('data-part')}]` : '')
  return t.constructor?.name ?? 'target'
}

/** Install the wrappers once per page and return the shared instrument (a second call returns the first). */
export function installLeakInstrument(): LeakInstrument {
  const g = globalThis as unknown as Record<symbol, LeakInstrument | undefined>
  const existing = g[INSTALLED]
  if (existing) return existing

  // Listeners
  const live = new Set<ListenerKey>()
  // The prototype's own native add, kept for the abort hook: window's own copy (patched below) cannot be
  // called on an AbortSignal, where it would register on window instead.
  const nativeProtoAdd = EventTarget.prototype.addEventListener
  const find = (target: EventTarget, type: string, fn: unknown, capture: boolean): ListenerKey | undefined => {
    for (const k of live) if (k.target === target && k.type === type && k.fn === fn && k.capture === capture) return k
    return undefined
  }
  // `owner` is where the method lives: EventTarget.prototype for most targets, but a [Global] interface such as
  // Window carries its own copy on the instance (Chromium and WebKit both), so window is patched separately.
  const patch = (owner: EventTarget | typeof EventTarget.prototype): void => {
    const origAdd = owner.addEventListener
    const origRemove = owner.removeEventListener
    owner.addEventListener = function (this: EventTarget, type: string, fn: unknown, opts?: unknown) {
      origAdd.call(this, type, fn as EventListener, opts as AddEventListenerOptions)
      if (!fn || this instanceof AbortSignal) return
      const capture = captureOf(opts)
      if (find(this, type, fn, capture)) return
      const signal = (opts as AddEventListenerOptions | undefined)?.signal
      if (signal?.aborted) return
      const k: ListenerKey = { target: this, type, fn, capture }
      live.add(k)
      if (signal) nativeProtoAdd.call(signal, 'abort', () => live.delete(k), { once: true })
    } as typeof EventTarget.prototype.addEventListener
    owner.removeEventListener = function (this: EventTarget, type: string, fn: unknown, opts?: unknown) {
      origRemove.call(this, type, fn as EventListener, opts as EventListenerOptions)
      const k = find(this, type, fn, captureOf(opts))
      if (k) live.delete(k)
    } as typeof EventTarget.prototype.removeEventListener
  }
  patch(EventTarget.prototype)
  if (Object.hasOwn(window, 'addEventListener')) patch(window)

  // Observers
  const liveObs = new Map<object, ObserverRecord>()
  const wrapObserver = <T extends ObserverCtor>(Orig: T, kind: string): T => {
    const W = class extends (Orig as unknown as new (...a: unknown[]) => {
      observe(t: Node, o?: unknown): void
      disconnect(): void
      unobserve?(t: Element): void
    }) {
      observe(t: Node, o?: unknown): void {
        super.observe(t, o)
        const rec = liveObs.get(this) ?? { kind, targets: new Set() }
        rec.targets.add(t)
        liveObs.set(this, rec)
      }
      unobserve(t: Element): void {
        ;(super.unobserve as ((t: Element) => void) | undefined)?.call(this, t)
        const rec = liveObs.get(this)
        if (rec) {
          rec.targets.delete(t)
          if (rec.targets.size === 0) liveObs.delete(this)
        }
      }
      disconnect(): void {
        super.disconnect()
        liveObs.delete(this)
      }
    }
    return W as unknown as T
  }
  const globals = globalThis as unknown as Record<string, unknown>
  globals['ResizeObserver'] = wrapObserver(ResizeObserver as never, 'RO')
  globals['IntersectionObserver'] = wrapObserver(IntersectionObserver as never, 'IO')
  globals['MutationObserver'] = wrapObserver(MutationObserver as never, 'MO')

  // Timers
  const liveIntervals = new Set<unknown>()
  const pendingTimeouts = new Set<unknown>()
  const pendingRaf = new Set<number>()
  const oSI = globalThis.setInterval.bind(globalThis)
  const oCI = globalThis.clearInterval.bind(globalThis)
  const oST = globalThis.setTimeout.bind(globalThis)
  const oCT = globalThis.clearTimeout.bind(globalThis)
  const oRaf = globalThis.requestAnimationFrame.bind(globalThis)
  const oCaf = globalThis.cancelAnimationFrame.bind(globalThis)
  let tracking = false
  globals['setInterval'] = (fn: () => void, ms?: number, ...a: unknown[]) => {
    const id = oSI(fn, ms, ...a)
    if (tracking) liveIntervals.add(id)
    return id
  }
  globals['clearInterval'] = (id: unknown) => {
    liveIntervals.delete(id)
    oCI(id as number)
  }
  globals['setTimeout'] = (fn: (...x: unknown[]) => void, ms?: number, ...a: unknown[]) => {
    const track = tracking
    const id: unknown = oST(
      (...x: unknown[]) => {
        pendingTimeouts.delete(id)
        fn(...x)
      },
      ms,
      ...a,
    )
    if (track) pendingTimeouts.add(id)
    return id
  }
  globals['clearTimeout'] = (id: unknown) => {
    pendingTimeouts.delete(id)
    oCT(id as number)
  }
  globals['requestAnimationFrame'] = (fn: FrameRequestCallback) => {
    const track = tracking
    const id: number = oRaf((t) => {
      pendingRaf.delete(id)
      fn(t)
    })
    if (track) pendingRaf.add(id)
    return id
  }
  globals['cancelAnimationFrame'] = (id: number) => {
    pendingRaf.delete(id)
    oCaf(id)
  }

  const instrument: LeakInstrument = {
    snap(host) {
      let globalCount = 0
      let hostCount = 0
      const keys: string[] = []
      for (const k of live) {
        const t = k.target
        const inHost = host !== null && t instanceof Node && (t === host || host.contains(t))
        if (inHost) {
          hostCount++
          continue
        }
        if (t === window || t === document || (t instanceof Node && t.isConnected)) {
          globalCount++
          keys.push(`${describeTarget(t)}:${k.type}`)
        }
      }
      return {
        globalListeners: globalCount,
        globalListenerKeys: keys.sort(),
        hostListeners: hostCount,
        observers: liveObs.size,
        observerKinds: [...liveObs.values()].map((r) => r.kind).sort(),
        intervals: liveIntervals.size,
        timeouts: pendingTimeouts.size,
        rafs: pendingRaf.size,
        popoverOpen: document.querySelectorAll(':popover-open').length,
      }
    },
    setTracking(on) {
      tracking = on
    },
    resetTimers() {
      liveIntervals.clear()
      pendingTimeouts.clear()
      pendingRaf.clear()
    },
    realSetTimeout: oST as typeof setTimeout,
  }
  g[INSTALLED] = instrument
  return instrument
}

/** What one connect / remove / reconnect cycle measured for a tag. */
export interface LeakRow {
  tag: string
  base: LeakSnap
  connected: LeakSnap[]
  after: LeakSnap[]
  errors: string[]
}

/** The leak verdict for a row: an empty array is clean. Mirrors the T-0535 probe's flag rules. */
export function leakFlags(r: LeakRow): string[] {
  const f: string[] = []
  const a1 = r.after[0]
  const a3 = r.after[r.after.length - 1]
  const c1 = r.connected[0]
  const c3 = r.connected[r.connected.length - 1]
  if (a1 && a3) {
    if (a1.globalListeners > r.base.globalListeners) {
      const fresh = [...a1.globalListenerKeys]
      for (const k of r.base.globalListenerKeys) {
        const at = fresh.indexOf(k)
        if (at >= 0) fresh.splice(at, 1)
      }
      f.push(`global listeners +${a1.globalListeners - r.base.globalListeners} after remove: ${fresh.join(',')}`)
    }
    if (a3.globalListeners > a1.globalListeners) f.push(`global listeners grow per cycle ${a1.globalListeners}->${a3.globalListeners}`)
    if (a1.observers > r.base.observers) f.push(`observers +${a1.observers - r.base.observers} after remove (${a1.observerKinds.join(',')})`)
    if (a3.observers > a1.observers) f.push(`observers grow per cycle ${a1.observers}->${a3.observers}`)
    if (a1.intervals > r.base.intervals) f.push(`intervals +${a1.intervals - r.base.intervals} after remove`)
    if (a3.timeouts > 0) f.push(`timeouts pending after remove: ${a3.timeouts}`)
    if (a3.rafs > 0) f.push(`rafs pending after remove: ${a3.rafs}`)
    if (a3.popoverOpen > 0) f.push(`popover open after remove: ${a3.popoverOpen}`)
  }
  if (c1 && c3 && c3.hostListeners > c1.hostListeners) f.push(`host listeners stack on reconnect ${c1.hostListeners}->${c3.hostListeners}`)
  if (r.errors.length) f.push(`errors: ${r.errors.join(' | ')}`)
  return f
}

export interface LeakCycleOptions {
  /** innerHTML for the host (a control that needs children to arm its lazy paths). */
  children?: string
  /** Runs after each connect to arm a lazy path (open an overlay, start a timer) before the removal. */
  arm?: (el: HTMLElement & Record<string, unknown>) => void | Promise<void>
  /** The test's collected page errors; cleared at the start and read at the end. */
  errors: string[]
  /** Connect / remove rounds after the warm-up (default 3). */
  rounds?: number
}

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))

/** Connect, remove and reconnect one tag, snapshotting the page after each step. */
export async function runLeakCycle(inst: LeakInstrument, tag: string, opts: LeakCycleOptions): Promise<LeakRow> {
  const wait = (ms: number): Promise<void> => new Promise((r) => inst.realSetTimeout(r, ms))
  const el = document.createElement(tag) as HTMLElement & Record<string, unknown>
  if (opts.children) el.innerHTML = opts.children
  opts.errors.length = 0
  // Warm-up round: module-level one-time installs land before the baseline.
  document.body.append(el)
  await frame()
  await frame()
  el.remove()
  await frame()
  await wait(30)
  inst.resetTimers()
  inst.setTracking(true)
  const row: LeakRow = { tag, base: inst.snap(el), connected: [], after: [], errors: [] }
  const armErrors: string[] = []
  for (let i = 0; i < (opts.rounds ?? 3); i++) {
    document.body.append(el)
    await frame()
    await frame()
    try {
      await opts.arm?.(el)
    } catch (e) {
      armErrors.push(`arm: ${String(e)}`)
    }
    await frame()
    await wait(20)
    row.connected.push(inst.snap(el))
    el.remove()
    await frame()
    await wait(20)
    row.after.push(inst.snap(el))
  }
  inst.setTracking(false)
  row.errors = [...new Set([...opts.errors, ...armErrors])]
  return row
}
