// session.ts — LLD-C5 / SPEC-R8, ADR-0072: the pure multi-turn session reducer + turn-history helpers.
//
// "The agent continues": a client message from the rendered surface (`onClientMessage` — an `action`,
// a `functionResponse`, or an `error`) becomes the NEXT turn's user input. `frameClientMessage` is the
// pure framing that turns each arm into a distinct natural-language user turn (the `produce()` loop feeds
// it as the user message; ADR-0072). The proxy is STATELESS — the browser holds the `Session`, so these
// helpers are pure and return new sessions (no mutation, no store). Zero-dep; no I/O.
//
// ADR-0088 §3 adds ONE more pure reducer-adjacent decision here: `shouldRunTurn` — whether a client
// message should become a conversational turn at all, or apply silently. It is deliberately NOT folded
// into `nextTurn` (which always frames a turn): the page calls `shouldRunTurn` FIRST and only calls
// `nextTurn` when it answers `true`, so a caller can never construct a `TurnInput` for a message that
// should have stayed silent.
//
// genui-surface.spec.md SPEC-R8 — a GenUI bridge `action` (`GenuiActionMessage`, genui-line.ts) is the
// OTHER kind of "client message that becomes the next turn": deliberately NOT an `A2uiClientMessage` (it
// never came from a real A2UI surface), so `frameClientMessage`/`nextTurn` accept the SIBLING union
// `A2uiClientMessage | GenuiActionMessage` rather than pretending one masquerades as the other.
// `shouldRunTurn` stays `A2uiClientMessage`-only on purpose — no caller ever routes a genui action through
// it (agent-admin.ts's own surface-turn arm dispatches genui actions directly, never through this gate).

import type { A2uiClientMessage } from '../renderer/index.ts'
import type { A2uiOutput, A2uiServerMessage } from '../protocol.ts'
import type { Session, TurnInput } from './agent-transport.ts'
import type { GenuiActionMessage } from './genui-line.ts'

/** SPEC-R8 — true iff `message` is the genui bridge-action shape (`GenuiActionMessage`), never an
 *  `A2uiClientMessage`. A cheap structural narrow (the `isGenuiCandidate` precedent) — used by
 *  `frameClientMessage` to route to the DISTINCT genui framing before falling through to the three real
 *  A2UI client-message arms. */
export function isGenuiActionMessage(message: A2uiClientMessage | GenuiActionMessage): message is GenuiActionMessage {
  return typeof message === 'object' && message !== null && 'genuiAction' in message
}

/**
 * Frame a client message as the next USER turn's content (ADR-0072 / SPEC-R8 AC1/AC2). Each arm is framed
 * DISTINCTLY so the agent knows what happened and how to continue:
 *   - `genuiAction` (SPEC-R8 AC2) → "the user triggered <name> on GenUI surface <surfaceId>", carrying the
 *     payload JSON verbatim when present — the three facts SPEC-R8 names, ridden as framed intent text
 *     (never an `A2uiClientMessage` shape, which this message structurally is not).
 *   - `action` → "the user triggered <name>", carrying its `context`/`dataModel` when present.
 *   - `functionResponse` → the awaited `value` for the issued `callFunction`.
 *   - `error` → the validation failure, fed back for CROSS-turn recovery (distinct from `produce()`'s
 *     intra-turn self-correct loop — this is the agent getting a fresh turn to fix a rejected surface).
 */
export function frameClientMessage(message: A2uiClientMessage | GenuiActionMessage): string {
  if (isGenuiActionMessage(message)) {
    const { surfaceId, name, payload } = message.genuiAction
    const bits: string[] = [`The user triggered the GenUI action "${name}" on surface "${surfaceId}".`]
    if (payload !== undefined) bits.push(`Payload: ${JSON.stringify(payload)}.`)
    bits.push('Continue the conversation by responding appropriately (an updated genui surface, an A2UI surface, or prose, as fits).')
    return bits.join(' ')
  }
  if ('action' in message) {
    const a = message.action
    const bits: string[] = [`The user triggered the "${a.name}" action (from component ${a.sourceComponentId}).`]
    if (a.context && Object.keys(a.context).length > 0) bits.push(`Action context: ${JSON.stringify(a.context)}.`)
    if (a.dataModel !== undefined) bits.push(`Current surface data model: ${JSON.stringify(a.dataModel)}.`)
    bits.push('Continue the conversation by updating or replacing the surface as appropriate.')
    return bits.join(' ')
  }
  if ('functionResponse' in message) {
    const r = message.functionResponse
    return `The function "${r.call}" (call ${r.functionCallId}) returned: ${JSON.stringify(r.value)}. Use this result to continue.`
  }
  const e = message.error
  const locus = 'functionCallId' in e ? `function call ${e.functionCallId}` : `surface ${e.surfaceId}`
  return `The previous surface was rejected (${e.code} on ${locus}): ${e.message}. Emit a corrected, valid A2UI surface.`
}

/**
 * The reducer (SPEC-R8): a client message becomes the next turn's `TurnInput`, carrying the running
 * `Session` (the browser is the source of truth). The raw message rides along; `produce()` frames it via
 * `frameClientMessage` when it assembles the model messages, so the framing lives in ONE place.
 */
export function nextTurn(session: Session, message: A2uiClientMessage | GenuiActionMessage): TurnInput {
  return { kind: 'client', message, session }
}

/**
 * The routing decision (ADR-0088 §3): does this client message warrant a full conversational turn (a
 * visible chat entry + a `nextTurn`/`produce()` round-trip), or should it apply SILENTLY (the surface's
 * own reactive data model already updated by the binding layer either way — silence only means "the
 * agent does not need to hear about this")?
 *
 * Only the `action` arm carries `wantResponse` (`A2uiAction.wantResponse`, `protocol.ts`) — the agent's
 * per-action authoring choice (ADR-0011), read here for routing, distinct from the renderer's OWN
 * `actionResponse`-RPC-correlation reading of the same flag (`action.ts`; the two are non-colliding
 * layer-local meanings, ADR-0088 Consequences). The default is the back-compat OPT-OUT Kim ratified:
 * absent or `true` ⇒ today's full-turn behavior (so the committed seed, `canvas-button.ts:27`, which sets
 * no `wantResponse`, keeps turning); only an EXPLICIT `false` opts out. `functionResponse`/`error` arms
 * always turn — they are inherently agent-directed (the agent asked for the result; an error needs
 * cross-turn recovery), so this predicate answers `true` for both without inspecting them further.
 */
export function shouldRunTurn(message: A2uiClientMessage): boolean {
  if ('action' in message) return message.action.wantResponse !== false
  return true
}

/** Append the agent's emitted A2UI JSONL as an `assistant` turn — pure (returns a new Session). */
export function appendAssistantTurn(session: Session, jsonl: string): Session {
  return { turns: [...session.turns, { role: 'assistant', content: jsonl }] }
}

/** Append a `user` turn (a framed intent or client message) — pure (returns a new Session). */
export function appendUserTurn(session: Session, content: string): Session {
  return { turns: [...session.turns, { role: 'user', content }] }
}

// ── Orchestrator surface-ID prefixing (ecosystem SPEC-R4, GH #475) ─────────────────────────────────
//
// The v1.0 spec source itself advises orchestrators to prefix subagent surface IDs to prevent
// conflicts (a2ui-ecosystem-alignment.spec.md §2.1/§3 SPEC-R4). Offered first-class on the Session
// seam (`session.surfacePrefix?: string`, `agent-transport.ts`) rather than baked into `produce()`'s
// default emit path: `produce()` already threads a same-shape "silent unless a model-authored `ask`
// happens to reference it" surfaceId comparison for ADR-0097's feed-ask integrity check
// (`askIntegrityHolds`), and rewriting `assembled.output`'s surfaceIds ahead of that check would need
// `ask.surfaceId` remapped identically or the ask feature silently breaks for any prefixed session — an
// interaction the ecosystem SPEC's R4 text does not address. Wiring this into `produce()`'s live emit
// path is a real follow-up, not guessed past here (SPEC-R4's route names only "the Session seam").
//
// `prefixSurfaceId`/`ownsSurfaceId` are pure and deterministic; `enforceSurfacePrefix` is the batch
// operator over one round's `A2uiOutput` (SPEC-R4 AC1). Every surfaceId-bearing message — `createSurface`
// INCLUDED — is classified THREE ways, never just "create rewrites, everything else only checks":
//   - OWN (bare `prefix`, or `` `${prefix}:...` ``)              → kept, surfaceId unchanged (idempotent)
//   - UNPREFIXED (no `:` at all — the model's own naming, un-namespaced) → REWRITTEN onto the namespace
//   - FOREIGN (carries `:` but under a DIFFERENT prefix)          → REJECTED, dropped, never forwarded
// The UNPREFIXED arm is load-bearing for `createSurface` AND `updateComponents` alike: a single round
// routinely BOTH creates a fresh surface and populates it in the same batch, both referencing the SAME
// model-authored, still-unprefixed id ("main") — rewriting only `createSurface` would silently strand
// that round's `updateComponents` as a "foreign" reject (it never got rewritten to match). Because
// `prefixSurfaceId` is pure and deterministic, the SAME unprefixed id maps to the SAME namespaced id
// everywhere it appears in the batch, so create + populate stay correctly paired. Two producers with
// distinct prefixes therefore mint DISJOINT ids BY CONSTRUCTION (AC1), and a message that already
// addresses a KNOWN-foreign namespace is rejected outright — a producer must never patch, delete, or
// read back a sibling producer's surface.

const PREFIX_SEPARATOR = ':'

/** SPEC-R4 — `true` iff `surfaceId` belongs to `prefix`'s namespace (`prefix` itself, or
 *  `` `${prefix}:...` ``). A session with NO prefix owns every id (today's unprefixed behavior). */
export function ownsSurfaceId(prefix: string | undefined, surfaceId: string): boolean {
  if (prefix === undefined || prefix === '') return true
  return surfaceId === prefix || surfaceId.startsWith(`${prefix}${PREFIX_SEPARATOR}`)
}

/** SPEC-R4 — deterministically namespaces `surfaceId` under `prefix`. Idempotent: an id that already
 *  carries the prefix is returned UNCHANGED (never double-prefixed), so re-applying across rounds/turns
 *  is safe. A FOREIGN id (already namespaced under a DIFFERENT prefix) gets `prefix` stacked in front —
 *  this raw utility never silently swallows one; `enforceSurfacePrefix` below instead REJECTS a foreign
 *  id outright rather than calling this on it. `prefix` absent/empty ⇒ `surfaceId` unchanged (the
 *  byte-identical default). */
export function prefixSurfaceId(prefix: string | undefined, surfaceId: string): string {
  if (prefix === undefined || prefix === '') return surfaceId
  return ownsSurfaceId(prefix, surfaceId) ? surfaceId : `${prefix}${PREFIX_SEPARATOR}${surfaceId}`
}

/** SPEC-R4 — is `surfaceId` namespaced under some OTHER prefix (carries the separator, but isn't OWN)?
 *  Used only to distinguish the unprefixed-rewrite case from the foreign-reject case inside
 *  `enforceSurfacePrefix`; `ownsSurfaceId`/`prefixSurfaceId` above stay the two general-purpose exports. */
function isForeignSurfaceId(prefix: string, surfaceId: string): boolean {
  return !ownsSurfaceId(prefix, surfaceId) && surfaceId.includes(PREFIX_SEPARATOR)
}

/** SPEC-R4 AC1 — one round's prefix-enforcement result: `output` is the KEPT messages (in original
 *  order, every unprefixed surfaceId rewritten onto the namespace); `rejected` is every message whose
 *  surfaceId addressed a FOREIGN namespace, dropped rather than forwarded. */
export interface PrefixEnforcement {
  output: A2uiOutput
  rejected: A2uiServerMessage[]
}

/** SPEC-R4 AC1 — enforce `session.surfacePrefix` over one round's emitted `A2uiOutput`, "applied on
 *  emit": absent/empty `surfacePrefix` ⇒ `{output, rejected: []}` UNCHANGED (byte-identical to every
 *  caller that predates this — the `mode`/`genuiSurface` precedent). A `callFunction` envelope (no
 *  `surfaceId` field, SPEC-R14) always passes through untouched — it has no surface to own or reject. */
export function enforceSurfacePrefix(session: Session, output: A2uiOutput): PrefixEnforcement {
  const prefix = session.surfacePrefix
  if (prefix === undefined || prefix === '') return { output, rejected: [] }
  const kept: A2uiServerMessage[] = []
  const rejected: A2uiServerMessage[] = []
  for (const msg of output) {
    if ('createSurface' in msg) {
      const id = msg.createSurface.surfaceId
      if (isForeignSurfaceId(prefix, id)) rejected.push(msg)
      else kept.push({ ...msg, createSurface: { ...msg.createSurface, surfaceId: prefixSurfaceId(prefix, id) } })
    } else if ('updateComponents' in msg) {
      const id = msg.updateComponents.surfaceId
      if (isForeignSurfaceId(prefix, id)) rejected.push(msg)
      else kept.push({ ...msg, updateComponents: { ...msg.updateComponents, surfaceId: prefixSurfaceId(prefix, id) } })
    } else if ('updateDataModel' in msg) {
      const id = msg.updateDataModel.surfaceId
      if (isForeignSurfaceId(prefix, id)) rejected.push(msg)
      else kept.push({ ...msg, updateDataModel: { ...msg.updateDataModel, surfaceId: prefixSurfaceId(prefix, id) } })
    } else if ('deleteSurface' in msg) {
      const id = msg.deleteSurface.surfaceId
      if (isForeignSurfaceId(prefix, id)) rejected.push(msg)
      else kept.push({ ...msg, deleteSurface: { ...msg.deleteSurface, surfaceId: prefixSurfaceId(prefix, id) } })
    } else if ('actionResponse' in msg) {
      const id = msg.actionResponse.surfaceId
      if (isForeignSurfaceId(prefix, id)) rejected.push(msg)
      else kept.push({ ...msg, actionResponse: { ...msg.actionResponse, surfaceId: prefixSurfaceId(prefix, id) } })
    } else {
      kept.push(msg) // the callFunction envelope (SPEC-R14) — no surfaceId field, nothing to own/reject
    }
  }
  return { output: kept, rejected }
}
