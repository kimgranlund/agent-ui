// tool-dispatch.ts — LLD-C4 (SPEC-R17/R18 / ADR-0168 cl.3-4): the ONE place a resolved manifest list turns
// into the `tools` + `executeTool` pair `AgentProvider.stream` accepts. Both hosts (the dev proxy and the
// production Cloudflare Worker) call THIS instead of hand-rolling the pair — the `chat-validation.ts`
// anti-fork precedent applied to dispatch, so the validate → resolve-key → execute order can never drift
// between them (the GH #108 lesson: two copies of one rule become two different rules).
//
// Four behaviours worth naming, because each one is a contract someone else depends on:
//
//   · ZERO active manifests ⇒ `{}` — not `{tools: [], executeTool}`. Both hosts spread the result into
//     `produce()`'s options, so an empty object leaves the outbound request BYTE-IDENTICAL to a
//     tools-unaware caller's (the `effort?`/`onEvent?` additive precedent on that same seam). A caller
//     that enables nothing pays nothing.
//   · A model-authored input is VALIDATED against the manifest's declared `input_schema` BEFORE the
//     executor runs (SPEC-R17). A failure throws a structured message naming the tool AND every failing
//     field; that rejection travels the EXISTING path the Anthropic adapter already has for a thrown
//     executor (GH #49), which converts it to an `is_error` tool_result the model can read and retry
//     from. A malformed call therefore degrades the ANSWER, never the turn — and integration code never
//     sees the bad input at all.
//   · The key never lives on the manifest. `auth: 'serverKey'` names an env var (`envKey`); the VALUE is
//     read out of the host's env here, per dispatch, and handed to `execute` on the `ExecuteContext` —
//     never stored, never serialized, never returned (SPEC-R18 / ADR-0073 cl.5). Every v1 manifest is
//     `auth: 'none'`, so `apiKey` is `undefined` for all of them today; this is the seam a keyed
//     integration lands on, built now so it is never bolted on later.
//   · Every executor call runs under a per-call deadline (TOOL_CALL_TIMEOUT_MS), a backstop above the inner
//     10 s bounds (`FETCH_TIMEOUT_MS`, the MCP client's `DEFAULT_TIMEOUT_MS`), never a replacement for them.
//     An executor that never settles is rejected at the deadline with a named `Error`, which travels the
//     same GH #49 `is_error` path as any other throw (the catch at `src/agent/providers/anthropic.ts:424-429`
//     turns it into `tool failed: <message>`), so a hung tool degrades the answer, never the turn.

import type { ExecuteTool, ToolDef } from '../../../src/agent/agent-transport.ts'
import type { ExecuteContext, IntegrationManifest } from './registry.ts'
import { validateToolInput } from './validate-input.ts'

/** The per-call deadline for one tool execution. A BACKSTOP above the inner 10 s bounds (`FETCH_TIMEOUT_MS`
 *  in `fetch-json.ts`, `DEFAULT_TIMEOUT_MS` in `mcp/client.ts`), never a replacement for them: those still
 *  fire first for every cooperative executor. This one only catches an executor that never settles. */
export const TOOL_CALL_TIMEOUT_MS = 30_000

/** Read the secret VALUE for a keyed manifest out of the host's env. `undefined` for `auth: 'none'` (every
 *  v1 integration) and for a keyed manifest whose var is unset — though the latter cannot reach here in
 *  practice: `resolveIntegrations` already excludes an unprovisioned keyed manifest, so the model is never
 *  offered a tool that cannot run (SPEC-R18). Belt AND braces, because the cost is one `??` and the failure
 *  mode it guards is a secret-shaped one. */
function apiKeyFor(manifest: IntegrationManifest, env: Record<string, string | undefined>): string | undefined {
  if (manifest.auth !== 'serverKey' || manifest.envKey === undefined) return undefined
  return env[manifest.envKey]
}

/**
 * Build the `tools`/`executeTool` pair for one turn from an ALREADY-resolved manifest list (the caller runs
 * `resolveIntegrations` first — validation of the browser's enablement list is that function's job, not
 * this one's).
 *
 * `signal` is the TURN-level abort signal where the host has one (the Worker's `request.signal`; the dev
 * proxy's Node route has none). It is the FALLBACK: the adapter passes its own per-call signal as
 * `executeTool`'s third argument, and that one wins when present — same signal in practice today, since the
 * adapter forwards exactly what the host threaded into `produce()`. Either way an aborted turn cancels
 * in-flight tool work instead of leaving an orphaned outbound fetch running. The executor's `ctx.signal` is
 * that chosen signal composed with the per-call deadline (`TOOL_CALL_TIMEOUT_MS`), so it is always present.
 */
export function buildToolDispatch(
  active: readonly IntegrationManifest[],
  env: Record<string, string | undefined>,
  signal?: AbortSignal,
): { tools: readonly ToolDef[]; executeTool: ExecuteTool } | Record<string, never> {
  if (active.length === 0) return {}

  const executeTool: ExecuteTool = async (name, input, callSignal) => {
    // Matched on the WIRE name (`tool.name`), never on `id` — `id` is the enablement vocabulary the browser
    // forwards, `tool.name` is what the model actually calls (ADR-0168 cl.2, three facts three fields).
    const match = active.find((manifest) => manifest.tool.name === name)
    if (!match) throw new Error(`unknown tool ${name}`)

    const checked = validateToolInput(match.tool.input_schema, input)
    if (!checked.ok) throw new Error(`${name}: invalid input — ${checked.errors.join('; ')}`)

    // The per-call deadline: one cleared timer that aborts the executor's signal AND rejects the race, so a
    // cooperative executor stops its work and a non-cooperative one still cannot hang the turn.
    const deadline = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`${name}: tool call timed out after ${TOOL_CALL_TIMEOUT_MS} ms`)
        deadline.abort(err)
        reject(err)
      }, TOOL_CALL_TIMEOUT_MS)
    })

    const outer = callSignal ?? signal
    const ctx: ExecuteContext = {
      signal: outer ? AbortSignal.any([deadline.signal, outer]) : deadline.signal,
      apiKey: apiKeyFor(match, env),
    }
    try {
      const run = match.execute(input, ctx)
      run.catch(() => {}) // an executor rejecting after the deadline won the race must not surface as unhandled
      return await Promise.race([run, timedOut])
    } finally {
      clearTimeout(timer)
    }
  }

  return { tools: active.map((manifest) => manifest.tool), executeTool }
}
