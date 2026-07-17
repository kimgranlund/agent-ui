// agent-transport.ts — LLD-C1 / SPEC-R1: the live-agent isolation seam + the session/turn model.
//
// This is the ONE interface the demo page binds to (SPEC-R1). Where the A2UI stream originates —
// the deterministic recorded backbone (LLD-C2), the dev-only proxy overlay (LLD-C6/C7), or a future
// client-direct transport — lives entirely BEHIND `AgentTransport`; swapping one for another is a
// single construction-site edit, no page change (SPEC-R1 AC2).
//
// Placement (LLD §0, repaired by ADR-0137/TKT-0072): this file lives in `src/agent/` — pure, zero-dep TS
// with no `fs`/`fetch`/key, exported at the package's `"./agent"` subpath (SPEC-N1 v0.5). It is imported
// both by the Node harness (produce/proxy) and, for its TYPES only, by the browser page (types erase;
// A2uiClientMessage rides the package's public `@agent-ui/a2ui` surface).
//
// Refinement note vs the LLD skeleton: `AgentProvider` (the injected model seam, SPEC-R11/ADR-0073)
// is co-located here with the other seam interfaces rather than in `providers/index.ts`. Both the
// provider adapters and the `produce()` loop depend only on this signature, so hoisting it to the
// shared seam file decouples those two build units (they need no import-ordering between them) and
// keeps every cross-cutting seam type in one place. The adapters + the id→adapter dispatch still live
// under `providers/` (LLD-C10); only the interface moves up.

import type { A2uiClientMessage } from '../renderer/index.ts'

// ── The session (SPEC-R8 / ADR-0072) — the standard Messages-API turn array ─────────────────────────

/** A message role. `assistant.content` is the emitted A2UI JSONL for that turn. */
export type Role = 'user' | 'assistant'

/** One turn: a user intent / framed client message, or an assistant's emitted A2UI JSONL stream. */
export interface Turn {
  role: Role
  /** For `assistant` turns this is the A2UI JSONL the agent emitted; for `user` turns, the framed input. */
  content: string
}

/** The ordered turn history the BROWSER holds (SPEC-R8: the proxy is stateless). */
export interface Session {
  turns: Turn[]
}

/**
 * The provider+model selected for a turn (from the in-chat switcher, SPEC-R12). OPTIONAL: the recorded
 * backbone and the stub-provider tests ignore it; only the live overlay threads it to the proxy, which
 * validates the `{provider, model}` PAIR against the `providers.json` allowlist (SPEC-R12) before use.
 */
export interface ProviderSelection {
  provider?: string
  model?: string
}

/**
 * One agent turn's framed input (SPEC-R1 / SPEC-R8). Turn 1 is a raw user `intent`; every later turn is
 * a `client` message (`action` | `functionResponse` | `error`) that the pure `nextTurn` reducer (LLD-C5)
 * frames into the next user turn. Both carry the running `Session` (the browser is the source of truth)
 * and the optional `{provider, model}` selection.
 */
export type TurnInput =
  | ({ kind: 'intent'; text: string; session: Session } & ProviderSelection)
  | ({ kind: 'client'; message: A2uiClientMessage; session: Session } & ProviderSelection)

// ── The transport seam (SPEC-R1 / ADR-0069) ─────────────────────────────────────────────────────────

/**
 * The isolation seam: one agent turn in, an ordered stream of A2UI JSONL lines out. Zero-dep. The page
 * consumes ONLY this — no `fetch`, proxy URL, or concrete transport leaks into the rendering/round-trip
 * logic (SPEC-R1 AC1). Every emitted line is ALREADY validated (validate-then-stream, SPEC-R5); the
 * browser ingests them through one code path regardless of origin.
 */
export interface AgentTransport {
  turn(input: TurnInput): AsyncIterable<string>
}

// ── The provider seam (SPEC-R11 / ADR-0073) ─────────────────────────────────────────────────────────

/** A reasoning-effort dial (the Figma chat-input refactor's Effort picker) — a plain, LOCAL union rather
 *  than importing `@agent-ui/app`'s `EffortLevel` (composer-options.ts): the package DAG runs
 *  `a2ui ← app`, never the reverse — a duplicated four-value union is cheaper than an upward dependency
 *  (the `AdminTurn`/a2ui `Turn` precedent, TKT-0052). `undefined`
 *  ⇒ no effort dial requested, the provider's own default applies — byte-behavior-unchanged for every
 *  caller that predates this. */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh'

/**
 * The injected model seam (SPEC-R11): one isolated module PER provider implements this (Anthropic this
 * wave; OpenAI/Gemini the next slices). `stream` yields raw text fragments that accumulate into the
 * model's output (the A2UI JSONL the loop then heals+validates). The `produce()` driver (LLD-C3) depends
 * ONLY on this signature and never names a vendor; the key is passed IN via the factory, never read at
 * module scope (SPEC-R11: `process.env[<envKey>]` server-side). Each adapter is its provider's single
 * upstream-format (SSE → text) boundary (SPEC-N5).
 */
export interface AgentProvider {
  stream(req: {
    model: string
    system: string
    messages: Turn[]
    /** Optional reasoning-effort dial. This is the SEAM's contract, not a guarantee every adapter already
     *  meets: an adapter SHOULD ignore an effort level it can't map (a degraded DIAL, never a degraded
     *  REQUEST) rather than let it reach the upstream API unconditionally. The shipped Anthropic adapter
     *  (code-reviewer finding) currently sends `thinking` for every non-'low' value with no model-
     *  capability check — latent today because every `SUPPORTED_MODELS` entry supports extended thinking,
     *  but a future non-thinking model added to that list would 400 here, not degrade. Gate on model
     *  capability before adding one. */
    effort?: Effort
    signal?: AbortSignal
  }): AsyncIterable<string>
}
