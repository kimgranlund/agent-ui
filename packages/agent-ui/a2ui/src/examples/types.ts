// types.ts — the ExampleSeed shape (ADR-0055 clause 1, decomp a2ui-streaming-examples §3).
//
// A seed is an AUTHORED example payload: a typed, checked TS module (not JSON) declaring a name +
// pedagogy fields + the ordered A2UI message stream a `/site` page feeds through the real renderer.
// The first four fields pre-align field-for-field with the training-corpus `CorpusRecord` (corpus
// SPEC-R1/R9: `name`/`description`/`promptText`) — a seed IS a future authored admission candidate,
// `messages` standing in for the eventual `a2uiOutput` — but this is a PRE-ALIGNMENT, not a dependency:
// nothing here imports corpus code (none exists yet); when the store lands, a seed-import script maps
// this shape onto `CorpusRecord` (`provenance: {source:'authored', origin:'src/examples/<name>.ts'}`)
// and runs it through `admit()` — the store's single write path is untouched by this shelf.
//
// Home: `packages/agent-ui/a2ui/src/examples/`, exposed ONLY via the package.json `"./examples"`
// subpath export (never the root barrel — payload bytes must never enter a renderer consumer's
// bundle, the `@agent-ui/components/components` subpath precedent).

import type { A2uiServerMessage } from '../protocol.ts'

/** One authored example payload — a page's demo, the examples gate's fixture, and (later) a corpus seed. */
export interface ExampleSeed {
  /** Unique id (the future `CorpusRecord.name`) — kebab-case, stable (pages + the gate key off it). */
  name: string
  /** One-line description of what the payload demonstrates (the future `CorpusRecord.description`). */
  description: string
  /** The user-facing prompt an agent would have received to produce this UI (`CorpusRecord.promptText`). */
  promptText: string
  /** The surface id every message in `messages` addresses (page chrome's `finalize(surfaceId)` target). */
  surfaceId: string
  /** Pinned protocol version (SPEC-R13) — every seed targets the current default. */
  protocolVersion: 'v1.0'
  /** The default catalog id every seed renders against (SPEC-R3). */
  catalogId: 'agent-ui'
  /** The ordered A2UI server-message stream (the future `CorpusRecord.a2uiOutput`) — fed line-by-line via `ingest`. */
  messages: readonly A2uiServerMessage[]
}
