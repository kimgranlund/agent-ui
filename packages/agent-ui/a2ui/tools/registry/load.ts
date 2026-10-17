// load.ts: the build-tier loader, `RegistrySources` from disk (GH #1807). Everything the pure
// `src/registry/` composition cannot know: the fleet descriptors, the catalogs and persona fragments
// as files, the selection sidecars, the mini-skill and genui-pack registries, the corpus shards, the
// exclusion allowlist.
//
// Plain-Node safe (`node --experimental-strip-types`, no DOM, no vite): catalog and fragment JSON is read
// with `readFileSync`. The persona list and each persona's `targetCatalogs` derive from
// `SHIPPED_PERSONA_CATALOG_MANIFESTS` (T-0209): the persona `manifest.ts` files import their `catalog.json` with
// `with { type: 'json' }`, so plain Node loads them; `src/registry/registry-wiring.test.ts` still holds the
// two equal. The preset rows (T-0012, GH #1812) are not added here.
//
// Reads resolve from `process.cwd()` (the repo root), like `mini-skills.ts` and `selection-guidance.ts`
// whose registries this loader reuses; `root` names the repo root for the files read here.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseDescriptor, scalarSeq, splitFrontmatter } from '@agent-ui/components/descriptor'
import { BASE_CATALOG_IDS, CATALOG_FILES, loadCatalogById } from '../catalog-files.ts'
import { loadCatalogFragment } from '../../src/catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../../src/catalog/personas/manifests.ts'
import { EXCLUSION_ALLOWLIST } from '../../src/catalog/default/exclusions.ts'
import { FEED_EXCLUDED, FEED_SURFACE_TYPES } from '../../src/agent/feed-catalog.ts'
import { MINI_SKILLS } from '../../src/agent/mini-skills.ts'
import { GENUI_PACKS } from '../../src/agent/prompts/genui-packs.ts'
import { loadAppendedEdges, loadSelectionGuidance } from '../../src/agent/selection-guidance.ts'
import type { SelectionGuidance } from '../../src/agent/selection-guidance.ts'
import type {
  CatalogSource,
  ControlSource,
  CorpusShardSource,
  FragmentSource,
  GenuiPackSource,
  GuidanceMap,
  MiniSkillSource,
  RegistrySources,
} from '../../src/registry/types.ts'

const A2UI = 'packages/agent-ui/a2ui'
const CATALOG_DIR = `${A2UI}/src/catalog`
const CONTROLS_DIR = 'packages/agent-ui/components/src/controls'
const PROMPTS_DIR = `${A2UI}/src/agent/prompts`
const CORPUS_DIR = `${A2UI}/corpus`

/** The shipped persona fragments and the bases each targets, sorted by id: derived from the manifests. */
export const PERSONA_FRAGMENTS: readonly { readonly personaId: string; readonly targetCatalogs: readonly string[] }[] = SHIPPED_PERSONA_CATALOG_MANIFESTS.map(
  (m) => ({ personaId: m.personaId, targetCatalogs: [...(m.targetCatalogs ?? [])] }),
).sort((a, b) => (a.personaId < b.personaId ? -1 : 1))

/** T-0202 (catalog architecture CA-R7): the shipped domain fragments and their bases, hard-coded and held equal to
 *  `SHIPPED_DOMAIN_CATALOG_MANIFESTS` by `registry-wiring.test.ts`. Empty until W1 lands the first domain; their
 *  sidecars reach the selection projection under `domain`, which is omitted while this list is empty. */
export const DOMAIN_FRAGMENTS: readonly { readonly domainId: string; readonly targetCatalogs: readonly string[] }[] = []

/** The corpus shard kinds, one folder each under `corpus/`. */
const CORPUS_KINDS = ['exemplar', 'multi-turn', 'repair'] as const
const CORPUS_VERSION = 'v1_0'

const readText = (root: string, rel: string): string => readFileSync(join(root, rel), 'utf8') as string
const readJson = (root: string, rel: string): unknown => JSON.parse(readText(root, rel))

const sortedNames = (root: string, rel: string, ext: string): string[] =>
  (readdirSync(join(root, rel)) as string[]).filter((n) => n.endsWith(ext)).sort()

/** A `selection.json` pinned to `pinKey: pinValue`; a pin mismatch is a mis-mapped file and fails here. */
function readSidecar(root: string, rel: string, pinKey: 'catalogId' | 'personaId' | 'domainId', pinValue: string): SelectionGuidance {
  const doc = readJson(root, rel) as Record<string, unknown>
  if (doc[pinKey] !== pinValue) throw new Error(`registry load: ${rel} must pin ${pinKey} "${pinValue}"`)
  return loadSelectionGuidance(doc)
}

function loadControls(root: string): ControlSource[] {
  const controls: ControlSource[] = []
  for (const dir of sortedNames(root, CONTROLS_DIR, '')) {
    let files: string[]
    try {
      files = sortedNames(root, `${CONTROLS_DIR}/${dir}`, '.md')
    } catch {
      continue // a loose file, not a control folder
    }
    for (const file of files) {
      const rel = `${CONTROLS_DIR}/${dir}/${file}`
      let parsed
      try {
        parsed = parseDescriptor(splitFrontmatter(readText(root, rel)).fence)
      } catch {
        continue // a .md with no frontmatter fence is not a descriptor
      }
      const tag = parsed.scalars.get('tag')
      const tier = parsed.scalars.get('tier')
      if (typeof tag !== 'string' || !tag.startsWith('ui-')) continue
      if (typeof tier !== 'string') throw new Error(`registry load: ${rel} declares tag "${tag}" but no tier`)
      const description = parsed.scalars.get('description')
      const uses = scalarSeq(parsed, 'uses')
      controls.push({ tag, tier, ...(description === undefined || description === '' ? {} : { description }), uses, path: rel })
    }
  }
  return controls.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
}

function loadCorpusShards(root: string): CorpusShardSource[] {
  const shards: CorpusShardSource[] = []
  for (const kind of CORPUS_KINDS) {
    const dir = `${CORPUS_DIR}/${kind}/${CORPUS_VERSION}`
    for (const file of sortedNames(root, dir, '.jsonl')) {
      const rel = `${dir}/${file}`
      const catalogId = file.slice(0, -'.jsonl'.length)
      const lines = readText(root, rel).split('\n').filter((l) => l.trim() !== '')
      shards.push({ path: rel, kind, catalogId, records: lines.length })
    }
  }
  return shards
}

/** Every build-tier and runtime-tier source, read from `root` (the repo root, which is also `process.cwd()`). */
export function loadRegistrySources(root: string): RegistrySources {
  const catalogs: CatalogSource[] = BASE_CATALOG_IDS.map((id) => { // the bases only; persona ids compose below
    const catalog = loadCatalogById(root, id)
    return { catalogId: catalog.catalogId, components: catalog.components, functions: catalog.functions, path: CATALOG_FILES[id] }
  })

  const fragments: FragmentSource[] = PERSONA_FRAGMENTS.map(({ personaId, targetCatalogs }) => {
    const path = `${CATALOG_DIR}/personas/${personaId}/catalog.json`
    return { personaId, fragment: loadCatalogFragment(readJson(root, path)), targetCatalogs, path }
  })

  const guidance = {
    base: {
      'agent-ui': readSidecar(root, `${CATALOG_DIR}/default/selection.json`, 'catalogId', 'agent-ui'),
      'a2ui-basic': readSidecar(root, `${CATALOG_DIR}/a2ui-basic/selection.json`, 'catalogId', 'a2ui-basic'),
    } as Record<string, GuidanceMap>,
    persona: Object.fromEntries(
      PERSONA_FRAGMENTS.map(({ personaId }) => [
        personaId,
        readSidecar(root, `${CATALOG_DIR}/personas/${personaId}/selection.json`, 'personaId', personaId),
      ]),
    ) as Record<string, GuidanceMap>,
    ...(DOMAIN_FRAGMENTS.length === 0
      ? {}
      : {
          domain: Object.fromEntries(
            DOMAIN_FRAGMENTS.map(({ domainId }) => {
              const rel = `${CATALOG_DIR}/domains/${domainId}/selection.json`
              return [domainId, { types: readSidecar(root, rel, 'domainId', domainId), append: loadAppendedEdges(readJson(root, rel)) }]
            }),
          ),
        }),
  }

  const miniSkills: MiniSkillSource[] = MINI_SKILLS.map((m) => {
    const path = `${PROMPTS_DIR}/mini-skills/${m.id}.md`
    readText(root, path) // a mini-skill whose file is not named for its id fails here, not silently
    return { id: m.id, catalogId: m.catalogId, path }
  })

  const genuiPacks: GenuiPackSource[] = GENUI_PACKS.map((p) => {
    const path = `${PROMPTS_DIR}/genui-packs/${p.id}.md`
    readText(root, path)
    return { id: p.id, path }
  })

  return {
    catalogs,
    fragments,
    guidance,
    miniSkills,
    feed: {
      catalogId: 'agent-ui',
      surface: [...FEED_SURFACE_TYPES],
      excluded: FEED_EXCLUDED.map((e) => ({ type: e.type, reason: e.reason })),
    },
    controls: loadControls(root),
    exclusions: EXCLUSION_ALLOWLIST,
    genuiPacks,
    corpusShards: loadCorpusShards(root),
  }
}
