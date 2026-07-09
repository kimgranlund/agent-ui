// core/history.ts — a tiny class; no DOM (the headless invariant, SPEC-R2, LLD-C4). The router-owned
// entry stack + index; the source of back/forward semantics in every mode (memory-only AND URL-reflected
// — history mode's `popstate` re-points this same index via `setIndex`, LLD-C6).

export class MemoryHistory {
  entries: string[]
  index: number

  constructor(initial: string) {
    this.entries = [initial]
    this.index = 0
  }

  get current(): string {
    return this.entries[this.index]
  }

  /** Truncate any forward tail, append, advance the index (the platform's own history semantics). */
  push(path: string): void {
    this.entries.length = this.index + 1
    this.entries.push(path)
    this.index++
  }

  /** Swap the entry at the current index in place — no new entry, no index change. */
  replace(path: string): void {
    this.entries[this.index] = path
  }

  /** Move the index by `delta`; clamps silently at either end — `null` (never a throw) when out of
   *  range, so the caller can no-op (SPEC-R2 AC3's clamp leg). */
  go(delta: number): string | null {
    const next = this.index + delta
    if (next < 0 || next >= this.entries.length) return null
    this.index = next
    return this.entries[this.index]
  }

  /** Jump directly to a stack index (the URL adapter's stamped-`popstate` re-point seam, LLD-C6). A
   *  stale/foreign index (outside this session's stack) returns `null`, never throws — the adapter falls
   *  back to path adoption (SPEC-R4's un-stamped rule). */
  setIndex(i: number): string | null {
    if (i < 0 || i >= this.entries.length) return null
    this.index = i
    return this.entries[this.index]
  }
}
