// core.ts — the socket-free JSON-RPC server core (LLD-C8, SPEC-R8/R7/N1/N2). `createRpcCore(handlers)`
// owns the WHOLE path: parse (-32700) -> envelope validation (-32600) -> method dispatch (-32601/-32004)
// -> handler -> framed response; handler throws are caught at this boundary -> -32603. The core is
// TOTAL: `handleRpc` never throws, always resolves to a JSON-RPC response string. This is what the
// SPEC-N2/N3 "no standing test performs network I/O" letter is honored against — the thin `server.ts`
// node:http shell is the only piece that ever touches a real socket (manual smoke only).
import { classifyMethod, parseFrame, frameSuccess, frameError, type SupportedMethod } from '../../src/rpc/frame.ts'
import { encodeA2a } from '../../src/protocol/codec.ts'
import { RPC_ERROR_TABLE, toRpcError } from '../../src/rpc/errors.ts'
import type {
  JsonRpcId,
  MessageSendParams,
  MessageSendResult,
  TaskCancelResult,
  TaskGetResult,
  TaskIdParams,
  TaskQueryParams,
} from '../../src/rpc/frame.ts'

export interface RpcHandlers {
  'message/send'(params: MessageSendParams): Promise<MessageSendResult> | MessageSendResult
  'tasks/get'(params: TaskQueryParams): Promise<TaskGetResult> | TaskGetResult
  'tasks/cancel'(params: TaskIdParams): Promise<TaskCancelResult> | TaskCancelResult
}

export interface RpcCore {
  /** Parse -> validate -> dispatch -> respond, entirely in-process. Never throws. */
  handleRpc(body: string): Promise<string>
}

export function createRpcCore(handlers: RpcHandlers): RpcCore {
  return {
    async handleRpc(body: string): Promise<string> {
      const parsed = parseFrame(body)
      if (!parsed.ok) {
        // ONE mapping (no fork): toRpcError owns the parse(-32700) vs malformed-envelope(-32600) split.
        const entry = toRpcError(parsed.failures[0] ?? { code: 'A2A_RPC', path: '/', detail: 'malformed envelope' })
        return encodeA2a(frameError(null, entry.code, entry.name))
      }

      const frame = parsed.frame
      if (!('method' in frame)) {
        // a well-formed envelope that isn't a request (e.g. a bare response shape posted to the server)
        return encodeA2a(frameError(frame.id, RPC_ERROR_TABLE.InvalidRequest.code, RPC_ERROR_TABLE.InvalidRequest.name))
      }

      const id: JsonRpcId = frame.id
      const classification = classifyMethod(frame.method)
      if (classification === 'unknown') {
        return encodeA2a(frameError(id, RPC_ERROR_TABLE.MethodNotFound.code, RPC_ERROR_TABLE.MethodNotFound.name))
      }
      if (classification === 'known-unsupported') {
        return encodeA2a(
          frameError(id, RPC_ERROR_TABLE.UnsupportedOperationError.code, RPC_ERROR_TABLE.UnsupportedOperationError.name),
        )
      }

      try {
        const method = frame.method as SupportedMethod
        // Params shape is per-method (RpcHandlers narrows each key); dispatch here is necessarily
        // untyped at the call site — the handler signature is the source of truth for its own param type.
        const handler = handlers[method] as (p: unknown) => unknown | Promise<unknown>
        const result = await handler(frame.params)
        return encodeA2a(frameSuccess(id, result))
      } catch (e) {
        // Handler throws are caught HERE — the core stays total (LLD §8 "Handler throws inside the
        // server core").
        const message = e instanceof Error ? e.message : String(e)
        return encodeA2a(frameError(id, RPC_ERROR_TABLE.InternalError.code, message))
      }
    },
  }
}
