// agent-runtime.ts — the site's in-tree re-export shim for the A2UI producer toolkit's BROWSER-SAFE seam.
// As of ADR-0137 (TKT-0072) the portable producer half is a real package export — `@agent-ui/a2ui/agent`
// — but that barrel is NODE-FIRST by construction (clause 4: `system-prompt.ts`/`mini-skills.ts`
// `readFileSync` their `prompts/*.md` at module load), so a BROWSER consumer must not import the whole
// barrel (it would drag `node:fs` into the bundle). This shim therefore re-exports ONLY the browser-safe
// seam modules of the pack — the transport seam, the deterministic backbone, the pure session reducer,
// the meta-line envelope, the feed sub-catalog policy set — by relative path into `src/agent/`; none of
// them touch `fs`/keys/`fetch`. The Node-first producer surface (`produce`/`buildSystemPrompt`/the
// mini-skill registry) is consumed server-side via the bare `@agent-ui/a2ui/agent` specifier — see the
// server-side example. The committed DEMO transcript stays a site-internal fixture (ADR-0137 clause 3).
// The LIVE overlay (proxy transport + switcher) remains a SEPARATE, dev-only import.

export type { AgentTransport, TurnInput, Session, Turn } from '../../packages/agent-ui/a2ui/src/agent/agent-transport.ts'
export { createRecordedTransport } from '../../packages/agent-ui/a2ui/src/agent/recorded-transport.ts'
// `RecordedTranscript`/`RecordedTurn` (the replay engine's OWN turn shape — `lines`/`note`/`progress`) —
// re-exported here alongside the factory that consumes them so a site-authored transcript (gen-ui-
// live.ts's GenUI-flavored one, `../lib/genui-transcript.ts`) can type itself against the SAME shape
// `createRecordedTransport` accepts, without a second relative reach-through into `packages/`.
export type { RecordedTranscript, RecordedTurn } from '../../packages/agent-ui/a2ui/src/agent/recorded-transport.ts'
export {
  nextTurn,
  appendUserTurn,
  appendAssistantTurn,
  frameClientMessage,
  shouldRunTurn,
} from '../../packages/agent-ui/a2ui/src/agent/session.ts'
// ADR-0088 §1/§2 — the reserved meta-line envelope (`note` + `TurnTrace`) `produce()` peels/composes;
// ADR-0097 §1 adds `AskDeclaration` (the `ask` field's shape) to the same envelope.
export type { TurnTrace, A2uiMetaEnvelope, AskDeclaration } from '../../packages/agent-ui/a2ui/src/agent/meta-line.ts'
export { readMetaLine, isMetaLine } from '../../packages/agent-ui/a2ui/src/agent/meta-line.ts'
// ADR-0097 §3 — the feed sub-catalog policy set (SPEC-R15): the page's own fail-closed check reads the
// SAME artifact `produce()`'s FEED_SCOPE gate and the prompt's derived list read — never a re-spelled copy.
export { isFeedSurfaceType } from '../../packages/agent-ui/a2ui/src/agent/feed-catalog.ts'
// The committed DEMO transcript stays a site-internal fixture (ADR-0137 clause 3) — behind the export.
export { recordedTranscript } from '../../packages/agent-ui/a2ui/tools/agent/transcript.ts'
