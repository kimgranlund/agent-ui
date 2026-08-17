// ndjson-lines.ts — a one-line re-export shim (ADR-0192 clause 5 + Consequences). The real
// implementation lives at `@agent-ui/data/stream`'s `stream/ndjson-lines.ts` — hoisted verbatim so
// the fleet carries ONE implementation body; this file's own test suite
// (`site/lib/ndjson-lines.test.ts`) still runs, now proving parity against the hoisted body.
export { readNdjsonLines } from '@agent-ui/data/stream'
