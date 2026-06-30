// call-function.ts — server-initiated callFunction RPC handler (renderer LLD-C14 / ADR-0034 / SPEC-R14).
//
// Decoupled from the binding-eval surface (`functions.ts evaluate` / ADR-0026): both share the
// function *registry* (catalog.functions metadata + catalogFunctions impls) but use DISTINCT
// invocation surfaces — this module owns the flat, surfaceless, concrete-arg RPC path;
// `functions.ts` owns the reactive, per-prop, `{path}`-resolved binding path (ADR-0034 fact 6 /
// fork 2). They MUST NOT be merged. Zero surface coupling: no `surfaceId`, no data model,
// no `resolveValue` — args are concrete literals the server provides (ADR-0034 fork 1).
//
// The `callableFrom` lookup uses "first-allows-match": catalogs are scanned in registration order;
// a `clientOnly` declaration is SKIPPED (a project catalog can opt a function into remote invocation
// even when the default catalog marks it `clientOnly` — ADR-0034 clause 4b). `catalogFunctions` is
// the single impl source (ADR-0034 fork 2: NOT a parallel registry; the same functions serve both
// the binding-eval and the server-invoke surface).

import type { CatalogRegistry } from '../catalog/types.ts'
import { catalogFunctions } from '../catalog/functions.ts'
import type { A2uiCallFunctionBody, A2uiErrorMessage, A2uiFunctionResponseMessage } from '../protocol.ts'

type Emit = (msg: A2uiFunctionResponseMessage | A2uiErrorMessage) => void

/**
 * Handle one inbound `callFunction` RPC envelope (SPEC-R14, LLD-C14 / ADR-0034).
 *
 * Gate: `INVALID_FUNCTION_CALL` is emitted (carrying `functionCallId`, NOT `surfaceId`) when:
 *   - the function is unregistered in every catalog, OR
 *   - every catalog that declares it marks it `clientOnly`, OR
 *   - the function has no registered impl in `catalogFunctions`, OR
 *   - the impl throws during invocation (fork 5: non-fatal, renderer intact — SPEC-N4).
 * Rejection is ALWAYS emitted — not gated on `wantResponse` (ADR-0034 fork 4: the server must learn
 * its call was invalid regardless of whether it wanted a response value).
 *
 * On success: `wantResponse:true` → emit `functionResponse{functionCallId, call, value}` with the
 * `functionCallId` copied verbatim (SPEC-R14 fact 2); `wantResponse` false/absent → fire-and-forget.
 */
export function handleCallFunction(
  body: A2uiCallFunctionBody,
  registry: CatalogRegistry,
  version: string,
  emit: Emit,
): void {
  const { functionCallId, wantResponse, callFunction: { call, args } } = body

  // ── catalog lookup: first-allows-match ────────────────────────────────────────────
  // Scan all registered catalogs in registration order. A `clientOnly` declaration is skipped
  // (another catalog may opt the function in). Stop at the first `remoteOnly`/`clientOrRemote`.
  // Track whether we saw a `clientOnly` declaration for the diagnostic message.
  let foundAllowsRemote = false
  let foundClientOnly = false
  for (const catalogId of registry.supportedCatalogIds()) {
    const entry = registry.get(catalogId)
    if (entry === undefined) continue
    const def = entry.catalog.functions[call]
    if (def === undefined) continue // not declared in this catalog
    if (def.callableFrom === 'clientOnly') {
      foundClientOnly = true
      continue // skip — another catalog may opt it in
    }
    // callableFrom is 'remoteOnly' or 'clientOrRemote' — remote invocation permitted
    foundAllowsRemote = true
    break
  }

  if (!foundAllowsRemote) {
    const message = foundClientOnly
      ? `function "${call}" is configured as clientOnly and cannot be invoked by the server`
      : `function "${call}" is not registered in any catalog`
    emit({ version, error: { code: 'INVALID_FUNCTION_CALL', functionCallId, message } })
    return
  }

  // ── impl lookup from the shared catalogFunctions table ────────────────────────────
  // ADR-0034 fork 2: SHARE the registry — catalogFunctions is the single impl source.
  // A declared-but-unimplemented function is a catalog misconfiguration (the "project catalog
  // future follow-up" gap noted in catalog/functions.ts).
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
    // (renderer stays intact, SPEC-N4). Maps to INVALID_FUNCTION_CALL (not VALIDATION_FAILED):
    // the error must carry `functionCallId` (the server's correlation key); only the
    // INVALID_FUNCTION_CALL arm does (ADR-0034 fork 5 / ADR-0031 §9 error table).
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
