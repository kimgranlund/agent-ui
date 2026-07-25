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
