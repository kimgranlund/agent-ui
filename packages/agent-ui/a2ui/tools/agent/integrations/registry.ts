// registry.ts — LLD-C1 (SPEC-R16/R18 / ADR-0168 cl.1-2, cl.4): the integration MANIFEST registry that
// replaces the hardcoded array. Node-side, site-internal (the ADR-0137 shell law: everything
// key/proxy/registry-shaped stays in tools/agent/, the portable core in src/agent/ carries only the
// ToolDef/ExecuteTool seam). Each manifest keeps `id` (the registry key + the enablement wire vocabulary),
// `tool.name` (the model-visible wire name), and `label` (human display text) as THREE independent facts.
//
// TRUST NOTE (PR #59 review; amended by ADR-0152, and by ADR-0168 cl.5): this registry widens the proxy's
// outbound surface — BOTH POST routes (the produce route and `/chat`) can now drive real outbound
// third-party fetches, not just the LLM call. Outbound volume is bounded (the adapter's MAX_TOOL_ROUNDS ×
// MAX_CALLS_PER_ROUND ceiling + the shared fetch helper's per-response size cap), every integration URL is
// host-pinned with encodeURIComponent'd values only. This path no longer exists ONLY in `vite dev` — as of
// ADR-0152 the SAME registry ships in the production Cloudflare Worker (`tools/agent/worker/index.ts`),
// reachable from the deployed docs site. The dev server's own LAN-exposure caveat (do NOT run `--host` on
// an untrusted network) still applies unchanged; the production path is separately gated by a same-origin
// check on every POST route + a Cloudflare rate-limiting rule (ADR-0152's mitigations), not by dev-only
// reachability. Every `execute` returns compact TEXT for the model (never raw response dumps) and throws on
// upstream failure — the adapter converts a rejection into an `is_error` tool_result the model can react to
// (the ExecuteTool contract), so a downed API degrades the answer, never the turn.

import type { ToolDef } from '../../../src/agent/agent-transport.ts'
import { assertSupportedSchema } from './validate-input.ts'

/** What the HOST hands an executor at dispatch time. `signal` is the turn's abort signal (an executor
 *  combines it with its own timeout); `apiKey` is present iff the manifest declares `auth: 'serverKey'` and
 *  the host resolved its `envKey` — resolved per dispatch, never stored on the manifest, never serialized
 *  (SPEC-R18 / ADR-0073 cl.5: no key value ever reaches the browser, a tool_result, or a log line). */
export interface ExecuteContext {
  signal?: AbortSignal
  apiKey?: string
}

/** One integration, described once. The registry row IS the config — there is no parallel integrations.json
 *  (ADR-0168's rejected alternative; the drift class GH #115 fixed). */
export interface IntegrationManifest {
  /** Stable registry key AND the enablement wire vocabulary the browser forwards. */
  id: string
  /** Per-manifest semver — admin-displayable, registry-owned; it never crosses to the model. */
  version: string
  /** Human display text (admin UI); free to change without touching `id` or `tool.name`. */
  label: string
  description: string
  /** The declaration the model sees. `tool.name` MAY equal `id`; nothing requires it. */
  tool: ToolDef
  auth: 'none' | 'serverKey'
  /** REQUIRED iff `auth === 'serverKey'` — an env-var NAME, never a value (the providers.json discipline). */
  envKey?: string
  execute(input: Record<string, unknown>, ctx: ExecuteContext): Promise<string>
}

/** The defensive ceiling on a browser-supplied enablement list (carried over from the shipped
 *  `resolveIntegrations`) — far above any real pack, low enough to bound a hostile list. */
const MAX_ENABLED = 16

const REGISTRY: IntegrationManifest[] = []

/**
 * Register one manifest. BOOT-FAIL-FAST (SPEC-R16 / ADR-0168 cl.1) — this runs at module import, so a throw
 * here is a startup error in both hosts, the same posture both already take on a malformed `providers.json`:
 *   · a duplicate `id` would make the enablement wire ambiguous;
 *   · a duplicate wire `tool.name` would make the model's tool_use call ambiguous;
 *   · an `input_schema` beyond the validator's supported subset would silently HALF-validate at dispatch
 *     (SPEC-R17) — registration is the ONE call site of `assertSupportedSchema`;
 *   · a `serverKey` manifest without an `envKey` names no secret to resolve (SPEC-R18).
 */
export function registerIntegration(m: IntegrationManifest): void {
  if (REGISTRY.some((existing) => existing.id === m.id)) {
    throw new Error(`integration registry: duplicate id \`${m.id}\``)
  }
  if (REGISTRY.some((existing) => existing.tool.name === m.tool.name)) {
    throw new Error(`integration registry: duplicate tool name \`${m.tool.name}\` (id \`${m.id}\`)`)
  }
  if (m.auth === 'serverKey' && (m.envKey === undefined || m.envKey.length === 0)) {
    throw new Error(`integration registry: \`${m.id}\` declares auth "serverKey" but no envKey`)
  }
  try {
    assertSupportedSchema(m.tool.input_schema)
  } catch (error) {
    throw new Error(`integration registry: \`${m.id}\` — ${error instanceof Error ? error.message : String(error)}`)
  }
  REGISTRY.push(m)
}

/** Every registered manifest, in registration order. */
export function listIntegrations(): readonly IntegrationManifest[] {
  return REGISTRY
}

/** A `serverKey` manifest is only offerable once its env var actually holds a value — the host resolves it,
 *  so an unprovisioned key degrades to "tool not offered" rather than a runtime failure mid-turn. */
function isProvisioned(m: IntegrationManifest, env: Record<string, string | undefined>): boolean {
  if (m.auth !== 'serverKey') return true
  const value = m.envKey === undefined ? undefined : env[m.envKey]
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validate + resolve the browser-supplied enablement list: strings only, intersected with the registry
 * (unknown ids silently dropped — the browser forwards ids; only registry matches count), capped
 * defensively, and — new in ADR-0168 cl.4 — with every `serverKey` manifest whose env var is unset or empty
 * EXCLUDED, so the model is never offered a tool that cannot run. Anything malformed ⇒ empty (tools off),
 * never a throw.
 */
export function resolveIntegrations(
  ids: unknown,
  env: Record<string, string | undefined>,
): IntegrationManifest[] {
  if (!Array.isArray(ids)) return []
  const wanted = new Set(ids.filter((v): v is string => typeof v === 'string').slice(0, MAX_ENABLED))
  return REGISTRY.filter((m) => wanted.has(m.id) && isProvisioned(m, env))
}
