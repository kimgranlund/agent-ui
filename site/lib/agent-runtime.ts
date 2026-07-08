// agent-runtime.ts — the site's ONE in-tree re-export shim for the Node-scoped live-agent harness
// (packages/agent-ui/a2ui/tools/agent/*). That harness is deliberately NOT a package export (SPEC-N1:
// the @agent-ui/a2ui surface stays `.`/`./examples`/`./corpus`), so the site reaches it by relative path
// through this single shim (LLD §0/§2 — "a thin site/lib re-export shim") rather than scattering deep
// ../../packages/… paths across the page. Everything re-exported here is browser-safe, zero-dep TS: the
// transport seam, the deterministic backbone, the pure session reducer, and the committed transcript —
// no fs, no key, no fetch. The LIVE overlay (proxy transport + switcher) is a SEPARATE, dev-only import.

export type {
  AgentTransport,
  TurnInput,
  Session,
  Turn,
} from '../../packages/agent-ui/a2ui/tools/agent/agent-transport.ts'
export { createRecordedTransport } from '../../packages/agent-ui/a2ui/tools/agent/recorded-transport.ts'
export {
  nextTurn,
  appendUserTurn,
  appendAssistantTurn,
  frameClientMessage,
  shouldRunTurn,
} from '../../packages/agent-ui/a2ui/tools/agent/session.ts'
export { recordedTranscript } from '../../packages/agent-ui/a2ui/tools/agent/transcript.ts'
// ADR-0088 §1/§2 — the reserved meta-line envelope (`note` + `TurnTrace`) `produce()` peels/composes.
// Zero-dep, browser-safe (meta-line.ts imports nothing) — re-exported here so the page filters it with
// the SAME discriminator `produce()` uses, never a reinvented one. ADR-0097 §1 adds `AskDeclaration` (the
// `ask` field's shape) to the same envelope — re-exported here for the SAME reason.
export type { TurnTrace, A2uiMetaEnvelope, AskDeclaration } from '../../packages/agent-ui/a2ui/tools/agent/meta-line.ts'
export { readMetaLine, isMetaLine } from '../../packages/agent-ui/a2ui/tools/agent/meta-line.ts'
// ADR-0097 §3 — the feed sub-catalog policy set (SPEC-R15): the page's own fail-closed check reads the
// SAME artifact `produce()`'s FEED_SCOPE gate and the prompt's derived list read — never a re-spelled copy.
export { isFeedSurfaceType } from '../../packages/agent-ui/a2ui/tools/agent/feed-catalog.ts'
