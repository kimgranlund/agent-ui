// chat-validation.ts — GH #108: the PAIR-allowlist trust-boundary validation shared by both HTTP
// transports (`dev-proxy-plugin.ts`'s Vite middleware and `worker/index.ts`'s Cloudflare Worker). Extracted
// here — rather than each transport re-declaring its own copy, or the Worker importing directly from
// `dev-proxy-plugin.ts` — because `dev-proxy-plugin.ts`'s module scope has a live `import { loadEnv } from
// 'vite'` and a side-effecting `process.cwd()` call, neither of which belongs in (or would even survive) a
// Workers bundle. This module has neither: zero vite/node imports, safe for both consumers.
//
// `dev-proxy-plugin.ts` re-exports everything below UNCHANGED, so its own existing tests
// (`validate-mode.test.ts`, `chat-route.test.ts`, both importing from `dev-proxy-plugin.ts`) needed no
// changes for this extraction.

import type { ProvidersConfig } from './providers-config.ts'
import { providerForModel, resolvePair } from './providers-config.ts'
import type { Turn, Effort } from '../../src/agent/agent-transport.ts'
import { GEN_UI_MODES } from '../../src/agent/gen-ui-mode.ts'
import type { GenUiMode } from '../../src/agent/gen-ui-mode.ts'

// ADR-0090 §4 — `mode` is trusted input at a security-adjacent boundary (Consequences): a crafted/stale
// `mode` string must NEVER reach `buildSystemPrompt` raw. Unlike `{provider,model}` (a registry lookup via
// `resolvePair`), `mode` is a closed 3-member enum, so validation is a plain membership check — an unknown
// value is defaulted silently (return `undefined`, which `produce()`/`buildSystemPrompt` already treat as
// the zero-regression default, ADR-0090 §1), never a 400. The request itself must never fail on a bad mode.
// The membership set is `GEN_UI_MODES` (`gen-ui-mode.ts`) — the single source of truth, not a local copy.
export function validateMode(mode: unknown): GenUiMode | undefined {
  return typeof mode === 'string' && (GEN_UI_MODES as readonly string[]).includes(mode) ? (mode as GenUiMode) : undefined
}

/**
 * ALM-C6 (TKT-0052/ADR-0136) — the `/chat` route's pure validation spine, extracted so its 400/503 arms
 * are deterministically testable without a live key or a real fetch (the impure `provider.stream` path
 * stays manual live acceptance, the SPEC-R3 adapter precedent). Derives the `{provider}` server-side from
 * the bare model id (`providerForModel` — `providers.json` is the single source, the browser never names a
 * provider), then runs `resolvePair` belt-and-braces (the SAME trust-boundary check the produce route uses),
 * then reads the env key. Returns the resolved dispatch bits, or a `{status, error}` degrade — never a key.
 */
export type ChatDispatch =
  | { ok: true; provider: string; apiKey: string; endpoint: string }
  | { ok: false; status: number; error: string }

/**
 * ALM-C6 follow-up (TKT-0052 review MEDIUM-1) — the `/chat` route's own request-shape guard, a pure
 * predicate so the 400 `bad-request` arm is deterministically testable without a live key. A malformed
 * body (missing `messages`, or `system`/`model` of the wrong type) must never reach `resolveChatDispatch`/
 * `provider.stream()` — that lands the failure in the untested "impure" remainder as a 500, not a 400.
 */
export const EFFORT_VALUES = ['low', 'medium', 'high', 'xhigh'] as const

export function isChatBody(body: {
  system?: unknown
  model?: unknown
  messages?: unknown
  effort?: unknown
}): body is {
  system: string
  model: string
  messages: Turn[]
  effort?: Effort
} {
  return (
    typeof body.system === 'string' &&
    typeof body.model === 'string' &&
    Array.isArray(body.messages) &&
    // `effort` is OPTIONAL (the Figma chat-input refactor's Effort picker) — absent is valid (no dial
    // requested); present must be one of the closed four values, never forwarded as an arbitrary string.
    (body.effort === undefined || (EFFORT_VALUES as readonly unknown[]).includes(body.effort))
  )
}

export function resolveChatDispatch(
  config: ProvidersConfig,
  env: Record<string, string | undefined>,
  model: string,
): ChatDispatch {
  const providerId = providerForModel(config, model)
  if (providerId === undefined) return { ok: false, status: 400, error: 'unknown-model' }
  const pair = resolvePair(config, providerId, model) // belt-and-braces (SPEC-R12 PAIR-allowlist)
  if (!pair.ok) return { ok: false, status: 400, error: pair.reason }
  const apiKey = env[pair.envKey]
  if (apiKey === undefined || apiKey === '') return { ok: false, status: 503, error: 'no-key' }
  return { ok: true, provider: providerId, apiKey, endpoint: pair.entry.endpoint }
}
