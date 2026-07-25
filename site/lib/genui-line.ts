// genui-line.ts — SPEC §6 B2 migration: this file WAS a site-local, demo-only STRUCTURAL STAND-IN for the
// GenUI wire reader (genui-surface.spec.md SPEC-R1/R2). B2 has now shipped the REAL, canonical
// implementation at `@agent-ui/a2ui/src/agent/genui-line.ts` (SPEC-R1's "ONE implementation both producer
// and client use") — this file is now a THIN RE-EXPORT of it, so `gen-ui-live.ts`'s consume path (and any
// future real-producer wiring on this page) reads the wire through the exact same module the producer
// itself peels genui lines with, never a page-local re-implementation that could drift.
//
// `formatGenuiLine` is NOT part of the real module's canonical reader/writer pair (SPEC §5's typed
// contract names only `readGenuiLine`/`isGenuiLine` — the envelope is authored verbatim by the MODEL,
// never reconstructed by a reader) — but the real module exports a small honest writer convenience anyway
// (see its own doc comment), which this file re-exports unchanged for `genui-transcript.ts`'s recorded-demo
// authoring use (composing this page's four canned turns through the SAME envelope shape the real reader
// consumes, never a hand-rolled JSON string).
export { readGenuiLine, isGenuiLine, formatGenuiLine, GENUI_MAX_HTML_BYTES, utf8ByteLength, isGenuiCandidate } from '@agent-ui/a2ui/agent/genui-line'
export type { GenuiEnvelope } from '@agent-ui/a2ui/agent/genui-line'
