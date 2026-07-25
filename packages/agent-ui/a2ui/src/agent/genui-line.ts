// genui-line.ts — genui-surface.spec.md SPEC-R1/R2: the reserved `{"genui":{surfaceId, html}}` JSONL line
// kind riding the SAME turn stream `AgentTransport.turn()`/`produce()` already returns — a THIRD reserved
// kind beside an `A2uiServerMessage` line (always carries `version`) and an `a2uiMeta` meta-line
// (`meta-line.ts`'s `readMetaLine`). Provably disjoint from both (no `version` key, no `a2uiMeta` key) — the
// SAME disjointness proof `readMetaLine`'s own header documents, mirrored here for the genui kind
// (SPEC-R1: "the `meta-line.ts` disjointness proof, mirrored").
//
// This is THE canonical implementation SPEC-R1 names — "a pure, zero-dep `readGenuiLine(line)` /
// `isGenuiLine(line)` pair (the `readMetaLine` shape) MUST be the ONE implementation both producer and
// client use; it never throws." `produce.ts` (this same package) is the producer-side consumer; a
// client/renderer consumer imports this module from the `./agent` subpath (or, pre-B2, a site-local
// structural stand-in existed at `site/lib/genui-line.ts` — now a thin re-export of this module, SPEC §6 B2).
//
// Validation is STRUCTURAL ONLY (SPEC-R1's honest scope, SPEC-R2's amendment to live-agent SPEC-R5): a
// well-formed JSON object · no `version` key · no `a2uiMeta` key · a `genui` key that is itself an object ·
// `surfaceId` a non-empty string · `html` a string · `html` within the SPEC-R2 byte cap. Whole-line
// rejection, never throws — a line failing ANY check yields `undefined`, never a partial envelope.
//
// Zero-dep, pure (SPEC-N1's "the genui wire module is zero-dep pure in `a2ui/src/agent/`"): no imports.

/** SPEC-R2 — 512 KiB (524_288 bytes), measured on the UTF-8 byte length of `html`. Also enforced,
 *  independently, as `ui-sandbox-frame`'s OWN defense-in-depth never-paint check
 *  (`packages/agent-ui/components/src/controls/sandbox-frame/sandbox-frame.ts`) — the SAME number, two
 *  independent enforcement points (the wire and the control), neither trusting the other alone. */
export const GENUI_MAX_HTML_BYTES = 524_288

/** The wire envelope (SPEC §5's typed contract, verbatim). */
export interface GenuiEnvelope {
  genui: { surfaceId: string; html: string }
}

/** SPEC-R8 — the OTHER genui-shaped message: a bridge `action` bubbled up from a mounted
 *  `ui-sandbox-frame` (`ui-conversation`'s `mountGenui` routing, `GenuiActionDetail` re-keyed under
 *  `genuiAction`), routed as the NEXT USER TURN. Deliberately NOT an `A2uiClientMessage` — SPEC-R8's own
 *  reasoning: a GenUI action never came from a real A2UI surface, so it cannot honestly wear that
 *  protocol's shape. `session.ts`'s `frameClientMessage`/`nextTurn` and `agent-transport.ts`'s `TurnInput`
 *  accept `A2uiClientMessage | GenuiActionMessage` for exactly this reason — the two are siblings on the
 *  SAME "client message" union, never one masquerading as the other. */
export interface GenuiActionMessage {
  genuiAction: { surfaceId: string; name: string; payload?: unknown }
}

/** UTF-8 byte length (SPEC-R2 measures the byte length, not the JS string length — a non-ASCII payload's
 *  char count and byte count diverge). */
export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

/** Cheap structural probe: does `parsed` carry the reserved `genui` key at all (regardless of whether the
 *  rest of the envelope is well-formed)? Used by `produce()`'s peel to distinguish two cases: "not a genui
 *  candidate at all" (leave the line alone) versus "a genui candidate that failed validation" (reject it
 *  whole, per SPEC-R1, rather than letting it fall through to `heal`/`validateA2ui`, which don't know this
 *  kind exists). Never throws — a JSON parse failure reads as "not a candidate".
 */
export function isGenuiCandidate(line: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return false
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && 'genui' in parsed
}

/** Whole-line reject, never throws (the `readMetaLine` shape) — `undefined` on ANY structural failure
 *  (malformed JSON, a `version` or `a2uiMeta` key present, a non-object `genui`, an empty/missing
 *  `surfaceId`, a non-string `html`, or an over-cap `html`). SPEC-R1's ONE reader both producer (`produce.ts`,
 *  peel-before-heal) and client (a renderer/demo consumer) use. */
export function readGenuiLine(line: string): GenuiEnvelope | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  const obj = parsed as Record<string, unknown>
  if ('version' in obj || 'a2uiMeta' in obj) return undefined // disjointness (SPEC-R1) — never either other kind
  if (!('genui' in obj)) return undefined
  const genui = obj.genui
  if (typeof genui !== 'object' || genui === null || Array.isArray(genui)) return undefined
  const { surfaceId, html } = genui as Record<string, unknown>
  if (typeof surfaceId !== 'string' || surfaceId === '') return undefined
  if (typeof html !== 'string') return undefined
  if (utf8ByteLength(html) > GENUI_MAX_HTML_BYTES) return undefined
  return { genui: { surfaceId, html } }
}

/** A cheap boolean probe over the same structural check (the `isMetaLine` precedent). */
export function isGenuiLine(line: string): boolean {
  return readGenuiLine(line) !== undefined
}

/** The inverse of `readGenuiLine` — compose a wire line from a surface id + html. Not part of SPEC §5's
 *  typed reader contract (the SPEC names only `readGenuiLine`/`isGenuiLine` as the canonical pair the
 *  producer/client share) — a WRITER is never required on the read side of the wire, since the genui
 *  envelope is authored verbatim by the MODEL (produce() peels the model's own line intact, SPEC-R1's
 *  "ships intact" law; it never reconstructs one). Exported anyway as a small, honest convenience for any
 *  caller that composes a genui line programmatically (a recorded demo transcript, a test fixture) — so
 *  such a caller never hand-rolls the envelope shape and risks drifting from `readGenuiLine`'s own contract. */
export function formatGenuiLine(surfaceId: string, html: string): string {
  const envelope: GenuiEnvelope = { genui: { surfaceId, html } }
  return JSON.stringify(envelope)
}
