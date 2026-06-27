// action.ts — action dispatch + actionResponse correlation (renderer LLD-C9, SPEC-R8).
//
// On a triggered action this builds the v1.0 `action` client→server message (client-generated
// `actionId`, resolved `context`, `wantResponse`, and the full data model when `sendDataModel` was
// set) and, when a reply is expected, registers a correlation entry keyed by `actionId`. An incoming
// `actionResponse` is matched back to its pending action and resolves/rejects the awaiting caller; an
// `actionResponse` for an unknown `actionId` is dropped with a logged warning, never thrown (§9 edge).
//
// Determinism (the testability discipline this slice owns): `actionId` and `timestamp` come from
// injected providers — this module never calls ambient `Date.now()`/`Math.random()`, so tests pin a
// fake id/clock and assert an exact message shape + the correlation round-trip.
//
// Out of this slice: `context` is *collected* by the host/widget (LLD-C9 `collectContext`, which
// resolves bound paths + input values via the binding slice, LLD-C5) and handed in via `opts.context`.
// This module only assembles the message and owns the correlation map — it imports no binding code.

import type { A2uiActionResponse, A2uiComponent } from '../protocol.ts'
import type { Surface } from './surface.ts'

/** The v1.0 `action` body the renderer sends on a triggered action (runtime SPEC §5.2). */
export interface A2uiAction {
  surfaceId: string
  actionId: string
  name: string
  sourceComponentId: string
  timestamp: string
  context: Record<string, unknown>
  wantResponse?: boolean
  dataModel?: unknown
}

/** The `action` client→server envelope (runtime SPEC §5.2). */
export interface A2uiActionMessage {
  version: string
  action: A2uiAction
}

/** Injected, deterministic-by-construction dependencies of the action dispatcher (LLD-C9). */
export interface ActionDeps {
  /** Client-generated unique action id (v1.0, SPEC-R8). Injected ⇒ no ambient randomness. */
  newId: () => string
  /** ISO-8601 timestamp string for the action. Injected ⇒ no ambient `Date.now()`. */
  now: () => string
  /** Sink for the assembled client→server message (the host's `onClientMessage`, SPEC-R8). */
  emitClient: (message: A2uiActionMessage) => void
  /** Logger for the unknown-`actionId` drop (§9 edge). Defaults to `console.warn`; injected in tests. */
  warn?: (message: string) => void
}

/** Per-action emission inputs. `context` is pre-collected by the host (LLD-C9); defaults to `{}`. */
export interface EmitActionOptions {
  name: string
  context?: Record<string, unknown>
  wantResponse?: boolean
}

/** A pending-action correlation slot: the promise handed to the caller plus its settle functions. */
interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * Action dispatcher (LLD-C9, SPEC-R8). Builds the `action` client message and correlates the matching
 * `actionResponse` back to the awaiting caller. One instance per renderer host; `actionId`s are
 * client-generated and globally unique, so the correlation map is keyed by `actionId` alone.
 */
export class ActionDispatcher {
  readonly #newId: () => string
  readonly #now: () => string
  readonly #emitClient: (message: A2uiActionMessage) => void
  readonly #warn: (message: string) => void
  readonly #pending = new Map<string, Deferred<unknown>>()

  constructor(deps: ActionDeps) {
    this.#newId = deps.newId
    this.#now = deps.now
    this.#emitClient = deps.emitClient
    this.#warn = deps.warn ?? ((message: string) => void console.warn(message))
  }

  /**
   * Emit an `action` for `node` on `surface` (SPEC-R8). Builds the message with a fresh `actionId`,
   * injected `timestamp`, the resolved `context`, `wantResponse`, and — when `surface.sendDataModel`
   * is set — the full data model (peeked untracked). When `wantResponse` is set, registers the
   * correlation slot *before* emitting and returns its promise; otherwise returns `undefined`.
   */
  emitAction(node: A2uiComponent, surface: Surface, opts: EmitActionOptions): Promise<unknown> | undefined {
    const actionId = this.#newId()
    const wantResponse = opts.wantResponse === true
    const action: A2uiAction = {
      surfaceId: surface.id,
      actionId,
      name: opts.name,
      sourceComponentId: node.id,
      timestamp: this.#now(),
      context: opts.context ?? {},
      wantResponse,
    }
    // sendDataModel (SPEC-R8 AC2): peek (untracked) so building the message never subscribes to data.
    if (surface.sendDataModel) action.dataModel = surface.data.peek()

    let promise: Promise<unknown> | undefined
    if (wantResponse) {
      const slot = deferred<unknown>()
      this.#pending.set(actionId, slot) // register before emit: a synchronous response still correlates
      promise = slot.promise
    }
    this.#emitClient({ version: surface.version, action })
    return promise
  }

  /**
   * Correlate an incoming `actionResponse` to its originating action (SPEC-R8 AC1) and settle the
   * awaiting caller: reject with `error` when present, else resolve with `value`. The slot is removed
   * either way. An unknown `actionId` is dropped with a warning (never thrown, §9 edge); returns
   * whether the response was correlated.
   */
  actionResponse(message: A2uiActionResponse): boolean {
    const slot = this.#pending.get(message.actionId)
    if (slot === undefined) {
      this.#warn(`a2ui: dropping actionResponse for unknown actionId "${message.actionId}"`)
      return false
    }
    this.#pending.delete(message.actionId) // delete before settling so the map reflects "no longer pending"
    if (message.error !== undefined) slot.reject(message.error)
    else slot.resolve(message.value)
    return true
  }

  /** Count of actions still awaiting a response (test/lifetime visibility into the correlation map). */
  get pendingCount(): number {
    return this.#pending.size
  }
}
