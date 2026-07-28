/** Type surface for build-dogfood-assets.mjs — LLD-C1 (genui-dogfood.lld.md, GH #316/ADR-0162). Shared by
 *  the CLI itself and dogfood-assets-freshness.test.ts (per the generate-llms-full.d.mts / slug.d.mts
 *  cross-boundary-import precedent: a `.mjs` runtime file paired with a sibling `.d.mts` declaration so a
 *  `.ts` consumer outside root tsconfig's `include` set can still import it typed). */
export const ROOT: string
export const OUT_MODULE: string

export interface BuiltDogfoodAssets {
  readonly css: string
  readonly js: string
  readonly tags: readonly string[]
  readonly moduleSource: string
}

export function buildDogfoodAssets(scratchOutDir: string, scratchEntryDir: string): Promise<BuiltDogfoodAssets>
export function extractTags(js: string): string[]
