// ask-registry.ts — ADR-0097 §2 (LLD-C9): the per-ask renderer-host lifecycle the page (`a2ui-live.ts`)
// wires into its chat feed. One `createRenderer()` host per ask, mounted into that turn's own message
// bubble; `pending` -> `frozen(answered|bypassed)`. Frozen entries stay VISIBLE (never disposed — history
// must stay truthful), closed to interaction via `inert` + `data-state`; a later line targeting a frozen
// id is dropped + counted by the caller (closed by construction — this module exposes `isFrozen` for
// exactly that check). `disposeAll()` (Reset) is the only thing that clears entries.
//
// This module owns NO page-specific markup — the caller supplies an already-built `bubble` element (its
// own CSS/ARIA is the page's concern) and a `mountEl` inside it for the ask surface to render into. That
// keeps the lifecycle mechanism testable in isolation from the transport/produce() pipeline it never
// depends on (it consumes only raw A2UI JSONL lines + the renderer's public seams — ADR-0023).

import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, ClientMessageListener } from '@agent-ui/a2ui'

export type AskState = 'pending' | 'answered' | 'bypassed'

export interface AskEntry {
  readonly surfaceId: string
  readonly host: RendererHost
  readonly bubble: HTMLElement
  state: AskState
}

/**
 * Parse one raw A2UI JSONL line and return the `surfaceId` it targets — `undefined` for an envelope kind
 * with no surface context (e.g. `callFunction`) or an unparseable line. Never throws.
 */
export function surfaceIdOf(line: string): string | undefined {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof msg !== 'object' || msg === null) return undefined
  const m = msg as Record<string, { surfaceId?: unknown } | undefined>
  for (const key of ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse'] as const) {
    const body = m[key]
    if (body && typeof body.surfaceId === 'string') return body.surfaceId
  }
  return undefined
}

/**
 * Every component `type` named by any `updateComponents` line in `lines` (order-preserving, duplicates
 * kept). Used by the page's fail-closed feed-scope check (ADR-0097 §3) — callers that only need
 * membership wrap the result in a `Set`. Never throws on an unparseable/irrelevant line.
 */
export function componentTypesOf(lines: readonly string[]): string[] {
  const types: string[] = []
  for (const line of lines) {
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    const uc = (msg as { updateComponents?: { components?: unknown } }).updateComponents
    if (!uc || !Array.isArray(uc.components)) continue
    for (const c of uc.components) {
      const t = (c as { component?: unknown }).component
      if (typeof t === 'string') types.push(t)
    }
  }
  return types
}

/**
 * The per-ask lifecycle registry (ADR-0097 §2). Keyed by `surfaceId`; entries persist after freezing
 * (never removed) so a later line targeting a frozen id can be recognized and dropped — "an old ask is
 * closed, by construction". At most one entry is ever `pending` at a time by the page's OWN discipline
 * (freeze-on-turn-dispatch, ADR-0097 §2) — this class does not itself enforce that invariant, it only
 * exposes `pending()` for a caller that already holds it.
 */
export class AskRegistry {
  readonly #entries = new Map<string, AskEntry>()

  /**
   * Mount a FRESH ask host into `bubble`/`mountEl` and register it `pending`. Throws if `surfaceId` is
   * already known — the caller (the page's collision guard, ADR-0097 §2/§3) MUST check `get()` first;
   * this class never silently replaces or re-uses a known entry.
   */
  create(surfaceId: string, bubble: HTMLElement, mountEl: HTMLElement, onClientMessage: ClientMessageListener): AskEntry {
    if (this.#entries.has(surfaceId)) {
      throw new Error(`AskRegistry.create: surfaceId "${surfaceId}" is already known — collision-guard before calling`)
    }
    const host = createRenderer()
    host.onClientMessage(onClientMessage)
    host.mount(mountEl)
    const entry: AskEntry = { surfaceId, host, bubble, state: 'pending' }
    this.#entries.set(surfaceId, entry)
    return entry
  }

  get(surfaceId: string): AskEntry | undefined {
    return this.#entries.get(surfaceId)
  }

  /** `true` iff `surfaceId` is a KNOWN entry (pending or frozen) — the collision-guard predicate. */
  has(surfaceId: string): boolean {
    return this.#entries.has(surfaceId)
  }

  /** The pending ask, if any (ADR-0097 §2's at-most-one invariant). */
  pending(): AskEntry | undefined {
    for (const entry of this.#entries.values()) if (entry.state === 'pending') return entry
    return undefined
  }

  /** `true` iff `surfaceId` is a KNOWN entry that is no longer pending — a line targeting it must be
   * dropped + counted, never ingested anywhere (ADR-0097 §2: "closed by construction"). */
  isFrozen(surfaceId: string): boolean {
    const entry = this.#entries.get(surfaceId)
    return entry !== undefined && entry.state !== 'pending'
  }

  /**
   * Freeze a PENDING entry — a no-op (returns `false`) on an unknown or already-frozen `surfaceId`, so
   * freezing is idempotent and never re-fires the `inert`/`data-state` side effects twice. `inert` kills
   * interaction and tab order platform-wide; the bubble stays in the DOM as VISIBLE history (never
   * `dispose()`d — ADR-0097 §2: dispose would detach the rendered root, and history must stay visible).
   */
  freeze(surfaceId: string, state: 'answered' | 'bypassed'): boolean {
    const entry = this.#entries.get(surfaceId)
    if (entry === undefined || entry.state !== 'pending') return false
    entry.state = state
    entry.bubble.inert = true
    entry.bubble.dataset.state = state
    return true
  }

  /** Dispose every ask host and drop every entry (Reset, ADR-0097 §2). */
  disposeAll(): void {
    for (const entry of this.#entries.values()) entry.host.dispose()
    this.#entries.clear()
  }

  /** The number of known entries (pending + frozen) — test/lifetime visibility, mirroring the renderer's
   * own `ActionDispatcher.pendingCount` precedent. */
  get size(): number {
    return this.#entries.size
  }
}
