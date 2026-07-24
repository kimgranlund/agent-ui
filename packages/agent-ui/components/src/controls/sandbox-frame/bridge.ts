// bridge.ts — the CLOSED six-member agent↔frame postMessage vocabulary (genui-surface.spec.md
// SPEC-R7/R8). Pure message-guard functions: parse an `unknown` postMessage payload structurally,
// never throw, return `undefined` for anything out-of-vocabulary or malformed — the caller (
// sandbox-frame.ts's `message` listener) drops + counts (`droppedMessages`), never emits a DOM event
// for a rejected message (SPEC-R7 AC1). Zero DOM — unit-testable in plain Node/Vitest.

/** The closed six-member vocabulary (SPEC-R7 table) — growth is a SPEC amendment + a Kim ruling. */
export const BRIDGE_MEMBERS = ['initialize', 'initialized', 'teardown', 'size-changed', 'host-context-changed', 'action'] as const
export type BridgeMember = (typeof BRIDGE_MEMBERS)[number]

/** SPEC-R8 — `name` a non-empty string ≤ 128 chars. */
export const ACTION_NAME_MAX_LENGTH = 128
/** SPEC-R8 — `payload` absent or JSON-serializable ≤ 16 KiB serialized. */
export const ACTION_PAYLOAD_MAX_BYTES = 16_384

export interface InitializeMessage {
  type: 'initialize'
}
export interface SizeChangedMessage {
  type: 'size-changed'
  height: number
}
export interface ActionMessage {
  type: 'action'
  name: string
  payload?: unknown
}
/** The three frame→host members the host side must accept (SPEC-R7 table). */
export type FrameToHostMessage = InitializeMessage | SizeChangedMessage | ActionMessage

export interface InitializedMessage {
  type: 'initialized'
  tokens: Record<string, string>
  colorScheme: string
}
export interface HostContextChangedMessage {
  type: 'host-context-changed'
  tokens: Record<string, string>
  colorScheme: string
}
export interface TeardownMessage {
  type: 'teardown'
}
/** The three host→frame members (SPEC-R7 table) — the host originates these, so no guard needed. */
export type HostToFrameMessage = InitializedMessage | HostContextChangedMessage | TeardownMessage

/** The measured UTF-8 byte length of a string (SPEC-R2's "measured on the UTF-8 byte length" convention,
 *  applied here to the `action` payload cap — SPEC-R8). */
export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

/**
 * Structurally validate one candidate `postMessage` payload against the CLOSED frame→host vocabulary
 * (SPEC-R7). Returns `undefined` for anything out-of-vocabulary or malformed (a non-object payload, an
 * unknown `type`, a non-finite `size-changed.height`, an empty/over-length `action.name`, a non-JSON-
 * serializable or over-cap `action.payload`) — never throws.
 */
export function parseFrameMessage(data: unknown): FrameToHostMessage | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const rec = data as Record<string, unknown>
  const type = rec.type

  if (type === 'initialize') return { type: 'initialize' }

  if (type === 'size-changed') {
    const height = rec.height
    return typeof height === 'number' && Number.isFinite(height) ? { type: 'size-changed', height } : undefined
  }

  if (type === 'action') {
    const name = rec.name
    if (typeof name !== 'string' || name.length === 0 || name.length > ACTION_NAME_MAX_LENGTH) return undefined
    const payload = rec.payload
    if (payload === undefined) return { type: 'action', name }
    let json: string
    try {
      json = JSON.stringify(payload)
    } catch {
      return undefined // not JSON-serializable (e.g. a cyclic structure) — malformed, dropped
    }
    if (typeof json !== 'string' || utf8ByteLength(json) > ACTION_PAYLOAD_MAX_BYTES) return undefined
    return { type: 'action', name, payload }
  }

  return undefined // out-of-vocabulary type (incl. a host→frame member arriving on the wrong channel)
}
