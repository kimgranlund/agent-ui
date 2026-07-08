// errors.ts — the error-code table + wire-error mapping (LLD-C5, SPEC-R7, HV-9 verbatim). ONE `as const`
// map, both directions: standard JSON-RPC codes (-32700/-32600/-32601/-32602/-32603) + the seven A2A
// codes (-32001..-32007). `toRpcError` maps validator codes outbound; `fromRpcError` maps inbound with
// an explicit 'unknown' fallback that preserves the numeric code — never a throw.
import type { A2aFailure } from '../protocol/validate.ts'

export interface RpcErrorEntry {
  code: number
  name: string
}

export const RPC_ERROR_TABLE = {
  ParseError: { code: -32700, name: 'ParseError' },
  InvalidRequest: { code: -32600, name: 'InvalidRequest' },
  MethodNotFound: { code: -32601, name: 'MethodNotFound' },
  InvalidParams: { code: -32602, name: 'InvalidParams' },
  InternalError: { code: -32603, name: 'InternalError' },
  TaskNotFoundError: { code: -32001, name: 'TaskNotFoundError' },
  TaskNotCancelableError: { code: -32002, name: 'TaskNotCancelableError' },
  PushNotificationNotSupportedError: { code: -32003, name: 'PushNotificationNotSupportedError' },
  UnsupportedOperationError: { code: -32004, name: 'UnsupportedOperationError' },
  ContentTypeNotSupportedError: { code: -32005, name: 'ContentTypeNotSupportedError' },
  InvalidAgentResponseError: { code: -32006, name: 'InvalidAgentResponseError' },
  AuthenticatedExtendedCardNotConfiguredError: { code: -32007, name: 'AuthenticatedExtendedCardNotConfiguredError' },
} as const satisfies Record<string, RpcErrorEntry>

export type RpcErrorName = keyof typeof RPC_ERROR_TABLE

const CODE_TO_NAME: ReadonlyMap<number, RpcErrorName> = new Map(
  (Object.keys(RPC_ERROR_TABLE) as RpcErrorName[]).map((name) => [RPC_ERROR_TABLE[name].code, name]),
)

/** Map a validator failure to a JSON-RPC error entry (outbound) — the LLD §5 3-tier rule, ONE mapping
 * (no fork): a parse-flavored failure (from either `decodeA2a`'s A2A_SCHEMA-coded JSON.parse failure or
 * `parseFrame`'s A2A_RPC-coded one — both carry the explicit `parse: true` flag, never sniffed from
 * `detail` text — review fix) is -32700; a non-parse A2A_RPC (malformed envelope shape) is -32600; every
 * other schema-shaped code (A2A_SCHEMA / A2A_PIN / A2A_CARD / A2A_STATE) is -32602. `InternalError` is
 * reserved for handler throws, mapped separately at the `createRpcCore` boundary — this function never
 * returns it. */
export function toRpcError(failure: A2aFailure): RpcErrorEntry {
  if (failure.parse) return RPC_ERROR_TABLE.ParseError
  if (failure.code === 'A2A_RPC') return RPC_ERROR_TABLE.InvalidRequest
  return RPC_ERROR_TABLE.InvalidParams
}

/** Map an inbound numeric JSON-RPC error code back to its name. Unknown codes get the declared
 * 'unknown' fallback name, preserving the numeric code — never a throw. */
export function fromRpcError(code: number): { name: RpcErrorName | 'unknown'; code: number } {
  const name = CODE_TO_NAME.get(code)
  return { name: name ?? 'unknown', code }
}
