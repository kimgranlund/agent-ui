// index.ts — LLD-C10's defensive dispatch (SPEC-R11 AC4): provider id → `AgentProvider`, degrading an
// allowlisted-but-unimplemented (or unregistered) provider to a distinguishable signal rather than an
// unhandled crash. This is the ONLY place a provider *id* becomes a concrete adapter instance; the
// `produce()` loop and the dev-proxy plugin never construct one directly.
//
// This module intentionally does NOT consult `providers.json`'s `implemented` flag itself — that check
// already happened at the registry level (`resolvePair` in `providers-config.ts`, the PAIR-allowlist —
// SPEC-R12) before dispatch is ever reached. This dispatch table is the SECOND, independent line of
// defense named by SPEC-R11 AC4 ("a missing module" case): even a provider the registry marks
// `implemented: true` degrades gracefully here if its module isn't wired into `IMPLEMENTED` below —
// never an unhandled crash either way.

import type { AgentProvider } from '../../../src/agent/agent-transport.ts'
import { anthropicProvider } from '../../../src/agent/providers/anthropic.ts'

/** Reasons `providerFor` degrades instead of returning a live adapter (SPEC-R11 AC4) — mirrors, but is
 * independent of, `resolvePair`'s registry-level rejection reasons (that check runs first, upstream). */
export type ProviderDispatchFailureReason = 'unimplemented' | 'unknown-provider'

export type ProviderDispatchResult =
  | { ok: true; provider: AgentProvider }
  | { ok: false; reason: ProviderDispatchFailureReason }

/** The set of provider ids this module actually wires an adapter for. `openai`/`gemini` are registry
 * rows (ADR-0073) but their modules are stubs (§ `openai.ts`/`gemini.ts`) — NOT included here, so they
 * degrade the same as any other not-yet-wired id. Adding a real adapter is: land its module, add one
 * entry here. */
const IMPLEMENTED: Record<string, (opts: { apiKey: string; endpoint?: string }) => AgentProvider> = {
  anthropic: anthropicProvider,
}

/**
 * Provider id → `AgentProvider`, or a degrade signal (SPEC-R11 AC4). NEVER throws for a
 * known-but-unimplemented provider — that is the whole point of the defensive dispatch: the caller (the
 * dev-proxy plugin) treats `{ ok: false }` exactly like the no-key path (degrade to backbone-only).
 *
 * `opts.endpoint` is threaded straight to the adapter — the proxy passes the matched registry row's
 * `endpoint` (providers.json), so the adapter's request URL stays registry-authoritative (no second
 * source of truth). Omitted ⇒ the adapter's own built-in default.
 */
export function providerFor(id: string, opts: { apiKey: string; endpoint?: string }): ProviderDispatchResult {
  const factory = IMPLEMENTED[id]
  if (factory === undefined) {
    // Distinguish "we've never heard of this id at all" from "we know it, just haven't wired it yet"
    // isn't possible from this table alone (both look like "no factory") — and SPEC-R11 AC4 only
    // requires the degrade signal be distinguishable from a crash, not that this module itself tell
    // unknown-provider apart from unimplemented (the registry-level `resolvePair` already made that
    // distinction upstream, before dispatch is ever reached). Every un-wired id degrades as
    // 'unimplemented' here — the registry is the source of truth for "does this id exist at all".
    return { ok: false, reason: 'unimplemented' }
  }
  return { ok: true, provider: factory(opts) }
}
