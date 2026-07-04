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
} from '../../packages/agent-ui/a2ui/tools/agent/session.ts'
export { recordedTranscript } from '../../packages/agent-ui/a2ui/tools/agent/transcript.ts'
