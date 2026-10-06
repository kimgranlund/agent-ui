// types.ts — the ExampleSeed shape (ADR-0055 clause 1, decomp a2ui-streaming-examples §3).
//
// A seed is an AUTHORED example payload: a typed, checked TS module (not JSON) declaring a name +
// pedagogy fields + the ordered A2UI message stream a `/site` page feeds through the real renderer.
// The first four fields pre-align field-for-field with the training-corpus `CorpusRecord` (corpus
// SPEC-R1/R9: `name`/`description`/`promptText`), and `messages` stands in for the corpus `a2uiOutput`.
// This is a PRE-ALIGNMENT, not a dependency: nothing here imports corpus code. The seed-import script
// (`tools/corpus/import-seeds.ts`, corpus LLD-C14) maps this shape onto `CorpusRecord`
// (`provenance: {source:'authored', origin:'src/examples/<name>.ts'}`) and runs it through `admit()`,
// so the store's single write path is untouched by this shelf.
//
// Home: `packages/agent-ui/a2ui/src/examples/`, exposed ONLY via the package.json `"./examples"`
// subpath export (never the root barrel — payload bytes must never enter a renderer consumer's
// bundle, the `@agent-ui/components/all` demo-only subpath precedent).
//
// Two catalogs, two shelves (GH #1737, Kim's ruling 2026-10-03, ADR-0169 follow-up): the seed is generic
// over the catalog it renders against, `ExampleSeed<C extends SeedCatalogId = 'agent-ui'>`. The default
// parameter keeps every bare `ExampleSeed` the agent-ui seed it always was, so `allSeeds` is typed
// `readonly ExampleSeed[]` and a Basic seed is a COMPILE error there, not a runtime surprise. Basic seeds
// (the upstream A2UI Basic catalog, registered as `a2ui-basic`) live on their own `allBasicSeeds` shelf,
// which keeps the three `site/` consumers of `allSeeds` (gallery, catalog tiers, authoring counts)
// agent-ui-only by construction. Each seed's `catalogId` is the key everything downstream resolves its
// catalog from: the import script hands `admit()` the catalog matching it, and the corpus shard it lands
// in is `corpus/exemplar/v1_0/<catalogId>.jsonl`.

import type { A2uiActionMessage, A2uiServerMessage, Failure } from '../protocol.ts'

/** The catalog ids a seed may render against: the fleet's own default catalog and the upstream Basic
 *  catalog. Widening this union is a deliberate act: every `Record<SeedCatalogId, ...>` registry (the
 *  Node-side catalog file map, the corpus-data gate's catalog registry) fails to compile until it covers
 *  the new id. */
export type SeedCatalogId = 'agent-ui' | 'a2ui-basic'

/** One authored example payload — a page's demo, the examples gate's fixture, and (later) a corpus seed. */
export interface ExampleSeed<C extends SeedCatalogId = 'agent-ui'> {
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
  /** The catalog id this seed renders against: `'agent-ui'` (the default catalog, SPEC-R3) on the
   *  `allSeeds` shelf, `'a2ui-basic'` on the `allBasicSeeds` shelf. */
  catalogId: C
  /** The ordered A2UI server-message stream (the future `CorpusRecord.a2uiOutput`) — fed line-by-line via `ingest`. */
  messages: readonly A2uiServerMessage[]
}

// ADR-0231 cl.5: the two seed kinds beside `ExampleSeed`, one per new corpus facet. Same pre-alignment
// posture: `tools/corpus/import-seeds.ts` maps each onto its `CorpusRecord` branch and sets `meta.facet`.
// They are corpus seeds only: the site's example pages key off `ExampleSeed`, and rendering a multi-turn
// or repair seed on a page is a non-goal. Each lives on its own shelf (`allMultiTurnSeeds`,
// `allRepairSeeds`), never on `allSeeds`.

/** A two-turn conversation seed (the `multi-turn` facet): turn 1, the user's one action, the follow-up. */
export interface MultiTurnSeed<C extends SeedCatalogId = 'agent-ui'> extends Omit<ExampleSeed<C>, 'messages'> {
  /** Turn 1, the stream the surface already rendered (`CorpusRecord.priorOutput`). */
  priorMessages: readonly A2uiServerMessage[]
  /** The one client-to-server action the user took on turn 1's surface (`CorpusRecord.clientInput[0]`).
   *  Its `sourceComponentId` must name a turn-1 component whose action prop carries this `name`. */
  action: A2uiActionMessage
  /** The follow-up stream answering the action (`CorpusRecord.a2uiOutput`): updates the live surface,
   *  never resends `root`. */
  messages: readonly A2uiServerMessage[]
}

/** A repair-pair seed (the `repair` facet): a broken stream, the validator's verdict, the fix. */
export interface RepairSeed<C extends SeedCatalogId = 'agent-ui'> extends Omit<ExampleSeed<C>, 'messages'> {
  /** The broken stream a producer emitted or would emit (`CorpusRecord.invalidInput`). */
  invalidMessages: readonly A2uiServerMessage[]
  /** The shared validator's verdict on `invalidMessages` at finalize (`CorpusRecord.validatorErrors`):
   *  admission recomputes it and rejects a mismatch, so author it from a real `validateA2ui` run. */
  validatorErrors: readonly Failure[]
  /** The corrected stream (`CorpusRecord.a2uiOutput`); it must admit as an exemplar would. */
  messages: readonly A2uiServerMessage[]
}
