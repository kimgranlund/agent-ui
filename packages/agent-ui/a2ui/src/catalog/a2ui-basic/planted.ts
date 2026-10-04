// planted.ts: shared TEST material for the Basic-catalog corpus pipeline (GH #1737, ADR-0169 follow-up).
// Imported only by `*.test.ts` files (`examples.test.ts`, `admission-coverage.test.ts`,
// `corpus-data.test.ts`, `tools/corpus/import-seeds.test.ts`, `tools/harness/validate-payload.test.ts`);
// never by shipped code, and never by a Node-side CLI (the JSON imports below are bundler/Vitest-only,
// the `ERR_IMPORT_ATTRIBUTE_MISSING` trap `tools/catalog-files.ts` documents). The `src/fixtures.ts`
// shared-test-material precedent.
//
// Why it exists: `allBasicSeeds` is empty until GH #1732 seeds the first Basic exemplar, so a gate that
// walks the Basic shelf proves nothing while the shelf is empty. These helpers PLANT a real Basic payload
// (one of the three upstream fixtures `upstream-fixtures.test.ts` already proves valid and renderable) as
// an in-memory seed or record, so each Basic leg is shown to pass on a genuine Basic seed AND to fail on
// a wrong-dialect one. Nothing here is written to the shelf or to a corpus shard.

import type { A2uiServerMessage } from '../../protocol.ts'
import type { ExampleSeed, SeedCatalogId } from '../../examples/types.ts'
import interactiveButtonRaw from './fixtures/upstream-example-00_interactive-button.json'
import loginFormRaw from './fixtures/upstream-example-00_simple-login-form.json'
import productCardRaw from './fixtures/upstream-example-05_product-card.json'

interface UpstreamFixture {
  name: string
  description: string
  messages: A2uiServerMessage[]
}

/** The three pinned upstream payloads, by short key. */
export const UPSTREAM_BASIC_FIXTURES = {
  'interactive-button': interactiveButtonRaw as unknown as UpstreamFixture,
  'login-form': loginFormRaw as unknown as UpstreamFixture,
  'product-card': productCardRaw as unknown as UpstreamFixture,
} as const

export type PlantedBasicKey = keyof typeof UPSTREAM_BASIC_FIXTURES

/** Re-stamp every `createSurface.catalogId` in `messages`. Used to MIS-stamp a payload (an agent-ui
 *  dialect payload claiming `a2ui-basic`) as well as to stamp a Basic one. Every other byte is verbatim. */
export function stampCatalogId(messages: readonly A2uiServerMessage[], catalogId: SeedCatalogId): A2uiServerMessage[] {
  return messages.map((m) => ('createSurface' in m ? { ...m, createSurface: { ...m.createSurface, catalogId } } : m))
}

/** A genuine Basic-dialect stream: the upstream fixture with the framing-only `v0.9` to `v1.0` envelope
 *  translation (`upstream-fixtures.test.ts` `toV1`) and its `createSurface` stamped with the LOCAL short
 *  id `a2ui-basic`, the id the corpus shard and the producer stamp use (ADR-0169 cl.13). */
export function plantedBasicMessages(key: PlantedBasicKey): A2uiServerMessage[] {
  const v1 = UPSTREAM_BASIC_FIXTURES[key].messages.map((m) => ({ ...m, version: 'v1.0' }) as A2uiServerMessage)
  return stampCatalogId(v1, 'a2ui-basic')
}

/** The surface id the planted stream's `createSurface` declares. */
export function plantedBasicSurfaceId(key: PlantedBasicKey): string {
  const create = plantedBasicMessages(key).find((m) => 'createSurface' in m)
  if (create === undefined || !('createSurface' in create)) throw new Error(`planted fixture ${key} has no createSurface`)
  return create.createSurface.surfaceId
}

/** A planted `ExampleSeed<'a2ui-basic'>`, in memory only (the real shelf stays empty until GH #1732). */
export function plantedBasicSeed(key: PlantedBasicKey, name = `planted-basic-${key}`): ExampleSeed<'a2ui-basic'> {
  return {
    name,
    description: `planted Basic seed from the upstream ${key} fixture (test material, never on the shelf)`,
    promptText: `planted prompt for the ${key} fixture`,
    surfaceId: plantedBasicSurfaceId(key),
    protocolVersion: 'v1.0',
    catalogId: 'a2ui-basic',
    messages: plantedBasicMessages(key),
  }
}
