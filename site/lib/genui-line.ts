// genui-line.ts — a SITE-LOCAL, DEMO-ONLY stub of the GenUI wire reader (genui-surface.spec.md SPEC-R1/
// R2): the reserved `{"genui":{surfaceId, html}}` JSONL line kind riding the SAME turn stream
// `AgentTransport.turn()` already returns — a THIRD reserved kind beside an `A2uiServerMessage` line
// (which always carries `version`) and an `a2uiMeta` meta-line (`meta-line.ts`'s `readMetaLine`) — provably
// disjoint from both (no `version` key, no `a2uiMeta` key), the same disjointness proof `readMetaLine`
// itself carries, mirrored here for the genui kind.
//
// SEAM NOTE (gen-ui-live.ts cites this too): the REAL, shipped reader — SPEC-R1's "ONE implementation both
// producer and client use" — belongs at `@agent-ui/a2ui/src/agent/genui-line.ts` under the SPEC's own B2
// build wave (wire + produce()-integration + packs + admin picker). B2 has not shipped as of this page —
// only B1 (the component, `ui-sandbox-frame`, PR #255) has. This file is therefore a hand-written,
// STRUCTURALLY IDENTICAL stand-in so `gen-ui-live.ts`'s consume path is already shaped exactly like the
// real contract: once B2 ships, swapping this one import for the real module is the entire migration — no
// page rewrite, no reshaping of the render path.
//
// Validation is STRUCTURAL ONLY (SPEC-R1), matching the real contract's own honest scope: well-formed JSON
// object · no `version` key · no `a2uiMeta` key · `genui` key an object · `surfaceId` a non-empty string ·
// `html` a string · `html` within the SPEC-R2 byte cap. Whole-line rejection, never throws (the
// `readMetaLine` shape) — a line failing ANY check yields `undefined`, never a partial envelope.

/** SPEC-R2 — 512 KiB, the SAME cap `ui-sandbox-frame` itself enforces as defense-in-depth
 *  (`GENUI_MAX_HTML_BYTES`, sandbox-frame.ts) — mirrored here as the WIRE-level check, so an oversize
 *  envelope is rejected before it ever reaches the control. */
export const GENUI_MAX_HTML_BYTES = 524_288

/** The wire envelope (SPEC §5's typed contract, mirrored verbatim). */
export interface GenuiEnvelope {
  genui: { surfaceId: string; html: string }
}

/** UTF-8 byte length (SPEC-R2 measures the byte length, not the JS string length — a non-ASCII payload's
 *  char count and byte count diverge). */
function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

/** Whole-line reject, never throws (the `readMetaLine` shape) — `undefined` on ANY structural failure. */
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

/** The inverse of `readGenuiLine` — compose a wire line from a surface id + html (used by the recorded
 *  transcript, `genui-transcript.ts`, so its authored turns are shaped through the SAME envelope this
 *  reader consumes, never a hand-rolled JSON string that could silently drift from the contract). */
export function formatGenuiLine(surfaceId: string, html: string): string {
  const envelope: GenuiEnvelope = { genui: { surfaceId, html } }
  return JSON.stringify(envelope)
}
