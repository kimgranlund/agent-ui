// a2a.ts — the A2UI-over-A2A bridge mapping (LLD-C1/C2, SPEC-R16; a2ui streaming-pipeline SPEC-R5,
// LLD-C5's "design landed here, realization builds at B6"). PRD-D2's ratified home: a2ui-tools →
// `@agent-ui/a2a` is the ratified cross-package edge. Pure and browser-safe — type-only imports both
// ways, zero runtime deps, no Node builtins — because the static-built artifact-feed page consumes it
// directly (the `tools/agent/recorded-transport.ts` precedent: a pure data/logic tools module IS
// site-bundleable; the never-in-a-consumer-bundle rule guards the package BARREL, `src/index.ts`, which
// does not export this). It never enters `@agent-ui/a2ui`'s `src/index.ts`.
//
// Every wire shape below cites SPEC §2 HV-8 (RESOLVED) — nothing here is re-derived from upstream:
//   - "Each A2UI envelope (e.g., `updateComponents`) corresponds to the payload of a single A2A message
//     Part." → one envelope per tagged DataPart (`envelopeToPart`/`partToEnvelope`).
//   - v1.0 adds the extension URI + the DataPart `metadata.mimeType` tag.
//   - "The `a2uiClientCapabilities` object is placed in the `metadata` field of every A2A `Message` sent
//     from the client to the server," value keyed `"v1.0"` with required `supportedCatalogIds`.
import type { A2uiServerMessage } from '../../../src/protocol.ts'
import type { A2uiClientMessage } from '../../../src/renderer/renderer.ts' // lives in renderer.ts (:79), NOT protocol.ts — review-verified split import
import type { A2aMessage, A2aDataPart, A2aPart } from '@agent-ui/a2a'

/** HV-8 (v1.0 extension): the DataPart tag + the extension URI — cited constants, never re-derived. */
export const A2UI_MIME = 'application/a2ui+json'
export const A2UI_A2A_EXTENSION_URI = 'https://a2ui.org/a2a-extension/a2ui/v1.0'

/** HV-8: the capabilities value is VERSION-KEYED; this family speaks A2UI v1.0 (catalog.json pin), so the
 *  key is "v1.0" with required supportedCatalogIds. Default catalog id: 'agent-ui' (catalog.json's own
 *  `catalogId`, the default/only catalog this family ships). */
export interface A2uiClientCapabilities {
  'v1.0': { supportedCatalogIds: string[] }
}

/** The default capability set every `wrapClientTurn` call falls back to when `opts.caps` is omitted. */
export const DEFAULT_CAPS: A2uiClientCapabilities = { 'v1.0': { supportedCatalogIds: ['agent-ui'] } }

// ── carriage (LLD-C1): one envelope per Part, tagged ────────────────────────────────────────────────

/** Wrap ONE A2UI envelope (server- or client-originated) as a tagged A2A DataPart (HV-8 carriage). */
export function envelopeToPart(msg: A2uiServerMessage | A2uiClientMessage): A2aDataPart {
  return { kind: 'data', data: msg as unknown as Record<string, unknown>, metadata: { mimeType: A2UI_MIME } }
}

/** Unwrap ONE A2A Part back to its A2UI envelope, or `undefined` for any part not `kind:'data'` or not
 *  mimeType-tagged (foreign parts tolerated, NEVER thrown — SPEC-R6's total-validator posture applied to
 *  this seam). No shape validation happens here; that is `validateA2ui`'s job downstream. */
export function partToEnvelope(part: A2aPart): A2uiServerMessage | A2uiClientMessage | undefined {
  if (part.kind !== 'data') return undefined
  if (part.metadata?.mimeType !== A2UI_MIME) return undefined
  return part.data as unknown as A2uiServerMessage | A2uiClientMessage
}

/** Options shared by `wrapServerTurn`/`wrapClientTurn` — the A2A envelope's addressing fields. */
export interface WrapTurnOptions {
  messageId: string
  taskId?: string
  contextId?: string
}

/** Wrap an ordered server→client A2UI sequence as ONE A2A agent message (one DataPart per envelope,
 *  order = parts order) — SPEC-R16 AC1's "identical to the loopback baseline" depends on this preserving
 *  `msgs` order exactly. Optional prose rides as a LEADING TextPart, ahead of every DataPart. */
export function wrapServerTurn(msgs: readonly A2uiServerMessage[], opts: WrapTurnOptions & { prose?: string }): A2aMessage {
  const parts: A2aPart[] = []
  if (opts.prose !== undefined) parts.push({ kind: 'text', text: opts.prose })
  for (const msg of msgs) parts.push(envelopeToPart(msg))
  return {
    kind: 'message',
    role: 'agent',
    messageId: opts.messageId,
    ...(opts.taskId !== undefined ? { taskId: opts.taskId } : {}),
    ...(opts.contextId !== undefined ? { contextId: opts.contextId } : {}),
    parts,
  }
}

/** Unwrap an A2A message back to its ordered envelopes (tagged DataParts only, parts order preserved).
 *  TextParts are routed to `prose` (never counted as foreign — they are the turn's own spoken content);
 *  any other part (an untagged DataPart, or a FilePart) is a foreign part: skipped + counted, never a
 *  throw (the error/edge table's "foreign part … skipped + counted"). */
export function unwrapTurn(msg: A2aMessage): {
  envelopes: (A2uiServerMessage | A2uiClientMessage)[]
  prose: string[]
  foreignParts: number
} {
  const envelopes: (A2uiServerMessage | A2uiClientMessage)[] = []
  const prose: string[] = []
  let foreignParts = 0
  for (const part of msg.parts) {
    if (part.kind === 'text') {
      prose.push(part.text)
      continue
    }
    const envelope = partToEnvelope(part)
    if (envelope !== undefined) envelopes.push(envelope)
    else foreignParts += 1
  }
  return { envelopes, prose, foreignParts }
}

// ── capabilities (LLD-C2): HV-8 — "placed in the metadata field of EVERY A2A Message sent from the
//   client to the server". `wrapClientTurn` is the ONLY way bridge code composes a client→server
//   message, so the "every message" clause is enforced BY CONSTRUCTION — there is no caps-less code path
//   through this module. ─────────────────────────────────────────────────────────────────────────────

/** The payload a client→server turn carries: free text and/or one A2UI client envelope (an action /
 *  error / functionResponse) — mirrors `wrapServerTurn`'s prose+envelope split, one direction over. */
export interface ClientTurnPayload {
  text?: string
  message?: A2uiClientMessage
}

/** Wrap a client→server turn. `metadata.a2uiClientCapabilities` is ALWAYS present (`opts.caps ??
 *  DEFAULT_CAPS`) and the v1.0 extension URI is ALWAYS declared — the HV-8 "every message" guarantee. */
export function wrapClientTurn(payload: ClientTurnPayload, opts: WrapTurnOptions & { caps?: A2uiClientCapabilities }): A2aMessage {
  const parts: A2aPart[] = []
  if (payload.text !== undefined) parts.push({ kind: 'text', text: payload.text })
  if (payload.message !== undefined) parts.push(envelopeToPart(payload.message))
  return {
    kind: 'message',
    role: 'user',
    messageId: opts.messageId,
    ...(opts.taskId !== undefined ? { taskId: opts.taskId } : {}),
    ...(opts.contextId !== undefined ? { contextId: opts.contextId } : {}),
    parts,
    extensions: [A2UI_A2A_EXTENSION_URI],
    metadata: { a2uiClientCapabilities: opts.caps ?? DEFAULT_CAPS },
  }
}
