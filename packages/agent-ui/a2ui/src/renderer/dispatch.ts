// dispatch.ts — version-aware server-message routing (renderer LLD-C2, SPEC-R1/R13).
//
// `dispatch` is the pure routing seam between the parser (LLD-C1, produces an `A2uiServerMessage`)
// and the stateful handlers (the renderer host, LLD-C13, wires real ones over the surface store).
// It does two things only: (1) honor the message `version` against the pinned protocol set, and
// (2) route the single envelope key to its handler. It owns the two routing error mappings —
// `VERSION_UNSUPPORTED` (unsupported version, SPEC-R13 AC2) and `SCHEMA` (no known envelope key,
// LLD-C2 `default`). It does NOT re-validate body *shape*: that is validate.ts's SCHEMA stage
// (LLD-C11); keeping dispatch a pure switch is what makes it trivially testable in isolation.
//
// The handler surface is injected (`DispatchHandlers`) so this slice ships without the host: the host
// supplies handlers that close over the `SurfaceStore` and apply version-specific semantics (the
// `version` is threaded through to each — e.g. v1.0 `surfaceProperties` vs v0.9.x `theme`, SPEC-R13
// AC1). Errors are returned, not emitted: dispatch stays side-effect-free; the host emits the
// returned `A2uiError` to the server and skips the message (LLD §9).

import { SUPPORTED_VERSIONS } from '../protocol.ts'
import type {
  A2uiServerMessage,
  A2uiCreateSurface,
  A2uiUpdateComponents,
  A2uiUpdateDataModel,
  A2uiDeleteSurface,
  A2uiActionResponse,
  A2uiCallFunctionBody,
  A2uiError,
} from '../protocol.ts'

/**
 * Every server-message envelope key `dispatch` routes below (LLD-C2). A static mirror of the `if`-chain
 * (not the loop driver — `callFunction`'s body shape differs from the other five, so a fully data-driven
 * dispatch would need its own special case anyway) — exported so the shared validator's `MESSAGE_KINDS`
 * (`validate.ts`) can be probed for parity against it (`dispatch.test.ts`), closing the ADR-0055 §1.2
 * discovered gap for good: the two lists must never silently drift again.
 */
export const DISPATCHED_ENVELOPE_KEYS = [
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
  'actionResponse',
  'callFunction',
] as const

/**
 * The handler per server message kind, injected by the renderer host (LLD-C13). Each receives the
 * typed envelope body plus the message `version`, so a handler can apply version-specific semantics
 * (e.g. map v0.9.x `theme`→`surfaceProperties` when standing up a surface, SPEC-R13 AC1). Handlers
 * mutate surface state and return nothing; routing/version errors are dispatch's concern, not theirs.
 */
export interface DispatchHandlers {
  createSurface(body: A2uiCreateSurface, version: string): void
  updateComponents(body: A2uiUpdateComponents, version: string): void
  updateDataModel(body: A2uiUpdateDataModel, version: string): void
  deleteSurface(body: A2uiDeleteSurface, version: string): void
  actionResponse(body: A2uiActionResponse, version: string): void
  /**
   * Server-initiated function-call RPC (SPEC-R14 / ADR-0034 clause 3). Envelope-level — no
   * `surfaceId`. `body` carries the top-level fields the handler needs (functionCallId + wantResponse
   * + the inner callFunction object), extracted from the narrowed `A2uiServerMessage` arm by `dispatch`.
   */
  callFunction(body: A2uiCallFunctionBody, version: string): void
}

/**
 * Route one server message to its handler by **version + envelope key** (renderer LLD-C2).
 * Returns `undefined` when the message was routed; an `A2uiError` when it could not be:
 * - `VERSION_UNSUPPORTED` — `version` is outside the pinned set; the message is skipped (SPEC-R13 AC2).
 * - `SCHEMA` — no known envelope key is present; unroutable (LLD-C2 `default`, §9).
 * The host emits the returned error to the server and renders nothing for that message.
 */
export function dispatch(msg: A2uiServerMessage, handlers: DispatchHandlers): A2uiError | undefined {
  const { version } = msg

  // (1) Version gate (SPEC-R13). An unsupported version never reaches a handler.
  if (!SUPPORTED_VERSIONS.has(version)) {
    return { code: 'VERSION_UNSUPPORTED', message: `unsupported protocol version "${version}"` }
  }

  // (2) Envelope-key routing — a pure switch over the five server message kinds (SPEC-R1). `in`
  // narrowing keeps each handler call fully typed with no casts. Body shape is validate.ts's job.
  if ('createSurface' in msg) {
    handlers.createSurface(msg.createSurface, version)
    return
  }
  if ('updateComponents' in msg) {
    handlers.updateComponents(msg.updateComponents, version)
    return
  }
  if ('updateDataModel' in msg) {
    handlers.updateDataModel(msg.updateDataModel, version)
    return
  }
  if ('deleteSurface' in msg) {
    handlers.deleteSurface(msg.deleteSurface, version)
    return
  }
  if ('actionResponse' in msg) {
    handlers.actionResponse(msg.actionResponse, version)
    return
  }
  if ('callFunction' in msg) {
    // Narrowed to the callFunction arm: { version; functionCallId; wantResponse?; callFunction }.
    // Extract the body the handler needs (version is already the second arg; exclude it from body).
    const { functionCallId, wantResponse, callFunction } = msg
    handlers.callFunction({ functionCallId, wantResponse, callFunction }, version)
    return
  }

  // No known envelope key (LLD-C2 `default`) → unroutable → SCHEMA.
  return { code: 'SCHEMA', message: 'unknown or missing server message envelope key' }
}
