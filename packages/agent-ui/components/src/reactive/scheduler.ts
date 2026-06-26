// scheduler.ts — the microtask-queue half of the reactivity kernel.
//
// Owns the effect queue, the ~100-wave write-loop budget, and the settled-promise
// machinery behind whenFlushed(). Imports NOTHING: the queue's element type is the
// structural `Schedulable` below, so this half never names the graph half. The
// cross-module seam is inbound only — an Effect calls schedule(this) on staleness
// and dequeue(this) on dispose.

/** The queue's structural element type — anything that can be run once. Naming it
 *  structurally (not Effect) is what keeps this module import-free. */
export interface Schedulable {
  run(): void
}

let queue = new Set<Schedulable>() // Set: structural dedupe — no `queued` flag to desync
let scheduled = false
let settled: Promise<void> = Promise.resolve()
let resolveSettled: (() => void) | null = null

/** Enqueue an effect; arm a microtask flush on the first add of a batch. */
export function schedule(effect: Schedulable): void {
  queue.add(effect)
  if (!scheduled) {
    scheduled = true
    settled = new Promise((r) => (resolveSettled = r))
    queueMicrotask(flush)
  }
}

/** Drop an effect from the pending queue — the dispose-while-queued seam. */
export function dequeue(effect: Schedulable): void {
  queue.delete(effect)
}

/** Drain the queue now. Production flow is microtask-driven; probes call this. */
export function flush(): void {
  let waves = 0
  try {
    while (queue.size) {
      if (++waves > 100) {
        queue.clear()
        throw new Error('effect write-loop: queue failed to settle in 100 waves')
      }
      const wave = [...queue]
      queue.clear()
      for (const e of wave) e.run()
    }
  } finally {
    // Runs on a normal drain, the budget throw, AND a throwing effect — the
    // scheduler must never wedge in `scheduled = true`.
    scheduled = false
    resolveSettled?.()
    resolveSettled = null
  }
}

/** Resolves after the current batch settles. */
export const whenFlushed = (): Promise<void> => settled
