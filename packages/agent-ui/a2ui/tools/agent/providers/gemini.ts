// gemini.ts — LLD-C10 / ADR-0073: the Gemini `AgentProvider` — the IMMEDIATE NEXT SLICE.
//
// The config row is present now (`providers.json`'s `gemini` entry, `implemented: false`) and the
// dispatch (`providers/index.ts`) already degrades an unimplemented provider to backbone-only — this
// stub exists only so a future direct import/dispatch of the module fails LOUDLY, never silently, if
// something bypasses that degrade path. Per ADR-0073: Gemini's streaming contract is host-verify-BEFORE-
// this adapter is actually built (Anthropic-first makes this non-blocking now).

import type { AgentProvider } from '../../../src/agent/agent-transport.ts'

/** Not yet implemented (ADR-0073: Gemini is the next adapter slice, gated on its streaming-contract
 * host-verify). `providers/index.ts` never reaches this factory for a live call — it degrades on the
 * registry's `implemented: false` flag first; this throw is a defense-in-depth backstop only. */
export function geminiProvider(_opts: { apiKey: string; endpoint?: string }): AgentProvider {
  return {
    stream() {
      throw new Error('geminiProvider: not implemented — next slice (ADR-0073; host-verify Gemini streaming contract first)')
    },
  }
}
