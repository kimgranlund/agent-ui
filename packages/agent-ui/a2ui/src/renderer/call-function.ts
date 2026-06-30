// call-function.ts — server-initiated callFunction RPC handler (renderer LLD-C14 / ADR-0034 / SPEC-R14).
//
// Decoupled from the binding-eval surface (`functions.ts evaluate` / ADR-0026): both share the
// function *registry* (catalog.functions metadata + catalogFunctions impls) but use DISTINCT
// invocation surfaces — this module owns the flat, surfaceless, concrete-arg RPC path;
// `functions.ts` owns the reactive, per-prop, `{path}`-resolved binding path (ADR-0034 fact 6 /
// fork 2). They MUST NOT be merged. Zero surface coupling: no `surfaceId`, no data model,
// no `resolveValue` — args are concrete literals the server provides (ADR-0034 fork 1).
//
// Cross-catalog collision: MOST-RESTRICTIVE-WINS (`clientOnly` is a hard floor, ADR-0034 amendment).
// ALL registered catalogs are scanned; if ANY declares the function `clientOnly`, the call is
// rejected — registration order does not change the verdict. `catalogFunctions` is the single impl
// source (ADR-0034 fork 2: NOT a parallel registry).

import type { CatalogRegistry } from '../catalog/types.ts'
import { catalogFunctions } from '../catalog/functions.ts'
import type { A2uiCallFunctionBody, A2uiErrorMessage, A2uiFunctionResponseMessage } from '../protocol.ts'

type Emit = (msg: A2uiFunctionResponseMessage | A2uiErrorMessage) => void

/**
 * Handle one inbound `callFunction` RPC envelope (SPEC-R14, LLD-C14 / ADR-0034).
 *
 * Gate: `INVALID_FUNCTION_CALL` is emitted (carrying `functionCallId`, NOT `surfaceId`) when:
 *   - the function is unregistered in every catalog, OR
 *   - ANY active catalog declares it `clientOnly` (most-restrictive-wins — a hard floor; a permissive
 *     sibling does NOT loosen it; order-independent; ADR-0034 amendment + SPEC-R14), OR
 *   - the function has no registered impl in `catalogFunctions`, OR
 *   - the impl throws during invocation (fork 5: non-fatal, renderer intact — SPEC-N4).
 * Rejection is ALWAYS emitted — not gated on `wantResponse` (ADR-0034 fork 4).
 *
 * On success: `wantResponse:true` → emit `functionResponse{functionCallId, call, value}` with
 * `functionCallId` copied verbatim (SPEC-R14 fact 2); `wantResponse` false/absent → fire-and-forget.
 */
export function handleCallFunction(
  body: A2uiCallFunctionBody,
  registry: CatalogRegistry,
  version: string,
  emit: Emit,
): void {
  const { functionCallId, wantResponse, callFunction: { call, args } } = body

  // ── catalog scan: most-restrictive-wins (ADR-0034 amendment / SPEC-R14) ────────────
  // Scan ALL registered catalogs for the function name. `clientOnly` is a hard floor:
  // if ANY catalog declares it clientOnly, the call is rejected regardless of other catalogs.
  // Result is order-independent — registration order has no effect on the verdict.
  let declaredInAny = false
  let anyClientOnly = false
  for (const catalogId of registry.supportedCatalogIds()) {
    const entry = registry.get(catalogId)
    if (entry === undefined) continue
    const def = entry.catalog.functions[call]
    if (def === undefined) continue // not declared in this catalog — keep scanning
    declaredInAny = true
    if (def.callableFrom === 'clientOnly') {
      anyClientOnly = true
      // Do NOT break — all catalogs must be checked (order-independence requires full scan)
    }
  }

  if (!declaredInAny) {
    emit({
      version,
      error: { code: 'INVALID_FUNCTION_CALL', functionCallId, message: `function "${call}" is not registered in any catalog` },
    })
    return
  }
  if (anyClientOnly) {
    // Hard floor: clientOnly in any active catalog → server-un-invocable (fail-closed security gate)
    emit({
      version,
      error: {
        code: 'INVALID_FUNCTION_CALL',
        functionCallId,
        message: `function "${call}" is marked clientOnly in one or more active catalogs and cannot be invoked by the server`,
      },
    })
    return
  }

  // ── impl lookup from the shared catalogFunctions table ────────────────────────────
  // ADR-0034 fork 2: SHARE the registry — catalogFunctions is the single impl source.
  // A declared-but-unimplemented function is a catalog misconfiguration.
  const impl = catalogFunctions[call]
  if (impl === undefined) {
    emit({
      version,
      error: {
        code: 'INVALID_FUNCTION_CALL',
        functionCallId,
        message: `function "${call}" has no registered implementation`,
      },
    })
    return
  }

  // ── invoke ─────────────────────────────────────────────────────────────────────────
  let value: unknown
  try {
    value = impl(args ?? {})
  } catch (err) {
    // Fork 5: a throwing server-invocable impl → INVALID_FUNCTION_CALL + functionCallId, non-fatal
    // (renderer stays intact, SPEC-N4). INVALID_FUNCTION_CALL is the only wire arm that carries
    // functionCallId (ADR-0034 fork 5 / ADR-0031 §9 error table).
    const message = err instanceof Error ? err.message : `function "${call}" threw during server invocation`
    emit({ version, error: { code: 'INVALID_FUNCTION_CALL', functionCallId, message } })
    return
  }

  // ── respond or fire-and-forget ─────────────────────────────────────────────────────
  if (wantResponse === true) {
    // functionCallId copied VERBATIM (SPEC-R14 fact 2: "client MUST copy this ID verbatim").
    emit({ version, functionResponse: { functionCallId, call, value } })
  }
  // wantResponse false/absent → fire-and-forget (invoke completed; no response emitted — fork 4)
}
