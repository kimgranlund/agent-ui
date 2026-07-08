// frame.ts — JSON-RPC 2.0 framing + correlation (LLD-C6, SPEC-R7). Envelopes are the one external
// standard cited directly (jsonrpc: '2.0', id, method/params | result/error); A2A specifics ride
// HV-3/HV-9. Two method tables distinguish known-but-unsupported (-32004) from unknown (-32601) — the
// SPEC-R7 ratified JSON-RPC-only posture (HV-2).
import { validateA2a, type A2aFailure } from '../protocol/validate.ts'
import { PROTOCOL_VERSION, type A2aMessage, type A2aTask } from '../protocol/types.ts'

/** What B1 frames + serves (HV-10 correlation: message/send for each move + the input-required
 * continuation; tasks/get for the runner's state poll; tasks/cancel for the abort->forfeit arm). */
export const SUPPORTED_METHODS = ['message/send', 'tasks/get', 'tasks/cancel'] as const
export type SupportedMethod = (typeof SUPPORTED_METHODS)[number]

/** The full HV-3 v0.3.0 JSON-RPC surface — lets the server distinguish known-but-unsupported (-32004)
 * from unknown (-32601). */
export const KNOWN_METHODS = [
  'message/send',
  'message/stream',
  'tasks/get',
  'tasks/cancel',
  'tasks/resubscribe',
  'tasks/pushNotificationConfig/set',
  'tasks/pushNotificationConfig/get',
  'tasks/pushNotificationConfig/list',
  'tasks/pushNotificationConfig/delete',
  'agent/getAuthenticatedExtendedCard',
] as const
export type KnownMethod = (typeof KNOWN_METHODS)[number]

export function isSupportedMethod(method: string): method is SupportedMethod {
  return (SUPPORTED_METHODS as readonly string[]).includes(method)
}

export function isKnownMethod(method: string): method is KnownMethod {
  return (KNOWN_METHODS as readonly string[]).includes(method)
}

/** Classify a method name for dispatch: supported (B1 frames+serves it), known-but-unsupported
 * (-32004), or unknown (-32601). */
export function classifyMethod(method: string): 'supported' | 'known-unsupported' | 'unknown' {
  if (isSupportedMethod(method)) return 'supported'
  if (isKnownMethod(method)) return 'known-unsupported'
  return 'unknown'
}

// — per-method params/results (HV-12) —————————————————————————————————————————

export interface A2aMessageSendConfiguration {
  acceptedOutputModes?: string[]
  historyLength?: number
  pushNotificationConfig?: unknown // known-unsupported (-32004); typing it would be gold-plating
  blocking?: boolean
}

export interface MessageSendParams {
  message: A2aMessage
  configuration?: A2aMessageSendConfiguration
  metadata?: Record<string, unknown>
}
export type MessageSendResult = A2aTask | A2aMessage

export interface TaskQueryParams {
  id: string
  historyLength?: number
  metadata?: Record<string, unknown>
}
export type TaskGetResult = A2aTask

export interface TaskIdParams {
  id: string
  metadata?: Record<string, unknown>
}
export type TaskCancelResult = A2aTask

// — envelopes ———————————————————————————————————————————————————————————————

export type JsonRpcId = string | number | null

export interface JsonRpcRequestFrame {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: unknown
}

export interface JsonRpcSuccessFrame {
  jsonrpc: '2.0'
  id: JsonRpcId
  result: unknown
}

export interface JsonRpcErrorFrame {
  jsonrpc: '2.0'
  id: JsonRpcId
  error: { code: number; message: string; data?: unknown }
}

export type JsonRpcResponseFrame = JsonRpcSuccessFrame | JsonRpcErrorFrame

export function frameRequest(id: JsonRpcId, method: SupportedMethod, params: unknown): JsonRpcRequestFrame {
  return { jsonrpc: '2.0', id, method, params }
}

export function frameSuccess(id: JsonRpcId, result: unknown): JsonRpcSuccessFrame {
  return { jsonrpc: '2.0', id, result }
}

export function frameError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcErrorFrame {
  return data === undefined ? { jsonrpc: '2.0', id, error: { code, message } } : { jsonrpc: '2.0', id, error: { code, message, data } }
}

// — parsing (total) ———————————————————————————————————————————————————————————

export type ParsedFrame =
  | { ok: true; frame: JsonRpcRequestFrame | JsonRpcResponseFrame }
  | { ok: false; failures: A2aFailure[] }

/** Parse + validate a raw JSON-RPC frame. Total: parse failure and malformed envelope both become
 * A2A_RPC, never a throw. */
export function parseFrame(text: string): ParsedFrame {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { ok: false, failures: [{ code: 'A2A_RPC', path: '/', detail: `parse error: ${String(e)}`, parse: true }] }
  }
  const expect = isObject(parsed) && 'method' in parsed ? 'rpc-request' : 'rpc-response'
  const failures = validateA2a(parsed, { protocolVersion: PROTOCOL_VERSION, expect })
  if (failures.length > 0) return { ok: false, failures }
  return { ok: true, frame: parsed as JsonRpcRequestFrame | JsonRpcResponseFrame }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// — correlation (SPEC-N3/N5: deterministic, no randomness — the arena's byte-stable transcripts sit on
// this) ————————————————————————————————————————————————————————————————————————

export interface RpcCorrelator {
  /** Monotonic integer id counter starting at 1. */
  nextId(): number
  /** Record an outbound request's id (+ method) as pending. */
  track(id: number, method: string): void
  /** Resolve an inbound response id against the pending map. An id with no pending request is a
   * correlation failure (A2A_RPC, orphan id in `detail`) — dropped-with-record, never a throw. */
  resolve(id: JsonRpcId): { ok: true; method: string } | { ok: false; failure: A2aFailure }
}

export function createRpcCorrelator(): RpcCorrelator {
  let counter = 1
  const pending = new Map<number, string>()
  return {
    nextId() {
      return counter++
    },
    track(id, method) {
      pending.set(id, method)
    },
    resolve(id) {
      const key = typeof id === 'number' ? id : NaN
      const method = pending.get(key)
      if (method === undefined) {
        return {
          ok: false,
          failure: { code: 'A2A_RPC', path: '/id', detail: `response id ${String(id)} matches no pending request` },
        }
      }
      pending.delete(key)
      return { ok: true, method }
    },
  }
}
