// site/lib/agent-manifest/agent-manifest.ts: one agent manifest per agent preset (GH #1812). The four
// members of an agent (its `AGENT_PRESETS` config, that preset's `seedVersion`, its persona catalog
// fragment `catalog.json`, and that fragment's `selection.json` sidecar) live in different places and share
// no pin, so a change to one never forced a look at the others. Each `<id>.manifest.json` here names all
// four and pins each by a canonical content digest; `agent-manifest.test.ts` is the drift gate that holds
// them in agreement, and `agent-manifest.write.test.ts` is the armed writer that refreshes the digests
// after a deliberate change.
//
// Consumer-owned on purpose: two members live in `site/` and two in `@agent-ui/a2ui`, and a2ui may never
// import site. The a2ui `PersonaCatalogManifest` (the Node-safe fragment triple) is a different thing and
// stays untouched.
import { AGENT_PRESETS, personaFromPreset } from '../../pages/agent-admin-presets.ts'
import { SHIPPED_PERSONA_CATALOGS, SHIPPED_PERSONA_CATALOG_MANIFESTS } from '@agent-ui/a2ui'
// @ts-expect-error - node:crypto is typed via @types/node; vitest/node resolves it at runtime (site/tsconfig.json carries no node types, see build-css.ts)
import { createHash } from 'node:crypto'
// @ts-expect-error - see above
import { existsSync, readdirSync, readFileSync } from 'node:fs'

declare const process: { cwd(): string }

/** One agent's pin set. Key order here is the on-disk key order (`formatManifest`). */
export interface AgentManifest {
  id: string
  preset: string | null
  seedVersion: number | null
  seedDigest: string | null
  fragment: { personaId: string; types: string[]; targetCatalogs: string[]; digest: string } | null
  selection: { digest: string } | null
  noFragment?: { why: string }
  noPreset?: { why: string }
}

/** The drift gate's legs, one finding code each. */
export const DRIFT_LEGS = [
  'schema',
  'declaration',
  'bijection',
  'identity',
  'unknown-local-patterns',
  'seed-version',
  'seed-digest',
  'fragment-digest',
  'selection-digest',
  'fragment-types',
  'target-catalogs',
  'list-coherence',
] as const

export type DriftLeg = (typeof DRIFT_LEGS)[number]

export interface DriftFinding {
  leg: DriftLeg
  id: string
  detail: string
}

/** Everything the gate reads, as plain JSON data (so a test can clone it and plant one defect). */
export interface DriftInput {
  manifests: { file: string; manifest: unknown }[]
  presets: { id: string; seedVersion: number; localPatterns?: string; seed: unknown }[]
  folders: { id: string; catalog: unknown; selection: unknown }[]
  shippedPackageIds: string[]
  shippedManifests: { personaId: string; targetCatalogs: string[] }[]
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj).sort()) {
      if (obj[key] !== undefined) out[key] = sortKeys(obj[key])
    }
    return out
  }
  return value
}

/** Sorted-key, undefined-dropped, unspaced JSON: the form every digest is taken over. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

/** `sha256:` plus the hex sha256 of `canonicalJson(value)` as UTF-8. */
export function canonicalDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

const ROOT = process.cwd()
export const MANIFEST_DIR = `${ROOT}/site/lib/agent-manifest`
const PERSONAS_DIR = `${ROOT}/packages/agent-ui/a2ui/src/catalog/personas`

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** The real tree, read off disk and out of the two persona lists. */
export function readTreeInput(): DriftInput {
  const manifests = (readdirSync(MANIFEST_DIR) as string[])
    .filter((f) => f.endsWith('.manifest.json'))
    .sort()
    .map((file) => ({ file, manifest: readJson(`${MANIFEST_DIR}/${file}`) }))
  const presets = AGENT_PRESETS.map((p) => ({
    id: p.id,
    // The effective version `personaStore` compares (agent-admin-presets.ts `wanted`).
    seedVersion: p.seedVersion ?? 1,
    ...(p.localPatterns === undefined ? {} : { localPatterns: p.localPatterns }),
    seed: JSON.parse(JSON.stringify(personaFromPreset(p))) as unknown,
  }))
  const folders = (readdirSync(PERSONAS_DIR) as string[])
    .filter((id) => existsSync(`${PERSONAS_DIR}/${id}/catalog.json`))
    .sort()
    .map((id) => ({
      id,
      catalog: readJson(`${PERSONAS_DIR}/${id}/catalog.json`),
      selection: existsSync(`${PERSONAS_DIR}/${id}/selection.json`) ? readJson(`${PERSONAS_DIR}/${id}/selection.json`) : null,
    }))
  return {
    manifests,
    presets,
    folders,
    shippedPackageIds: SHIPPED_PERSONA_CATALOGS.map((p) => p.personaId),
    // The `targetsFor` default (compose.ts:155,170): absent or empty resolves to ['agent-ui']. Both are
    // module-private in a2ui, so the rule is copied here rather than exported.
    shippedManifests: SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => ({
      personaId: m.personaId,
      targetCatalogs: m.targetCatalogs !== undefined && m.targetCatalogs.length > 0 ? [...m.targetCatalogs] : ['agent-ui'],
    })),
  }
}

const DIGEST = /^sha256:[0-9a-f]{64}$/
const REQUIRED_KEYS = ['id', 'preset', 'seedVersion', 'seedDigest', 'fragment', 'selection']
const OPTIONAL_KEYS = ['noFragment', 'noPreset']

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string')
const hasExactKeys = (o: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k))
const hasWhy = (o: { why: string } | undefined): boolean => o !== undefined && o.why.trim() !== ''
const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

function schemaProblems(file: string, m: unknown): string[] {
  if (!isObject(m)) return ['not an object']
  const out: string[] = []
  for (const k of REQUIRED_KEYS) if (!Object.hasOwn(m, k)) out.push(`missing key ${k}`)
  for (const k of Object.keys(m)) if (!REQUIRED_KEYS.includes(k) && !OPTIONAL_KEYS.includes(k)) out.push(`unknown key ${k}`)
  if (typeof m['id'] !== 'string') out.push('id is not a string')
  else if (file !== `${m['id']}.manifest.json`) out.push(`file ${file} is not ${m['id']}.manifest.json`)
  if (m['preset'] !== null && typeof m['preset'] !== 'string') out.push('preset is not a string or null')
  if (m['seedVersion'] !== null && typeof m['seedVersion'] !== 'number') out.push('seedVersion is not a number or null')
  const seedDigest = m['seedDigest']
  if (seedDigest !== null && (typeof seedDigest !== 'string' || !DIGEST.test(seedDigest))) out.push('seedDigest is not a sha256 digest or null')
  const fragment = m['fragment']
  if (fragment !== null) {
    if (!isObject(fragment) || !hasExactKeys(fragment, ['personaId', 'types', 'targetCatalogs', 'digest'])) out.push('fragment keys are not personaId, types, targetCatalogs, digest')
    else {
      if (typeof fragment['personaId'] !== 'string') out.push('fragment.personaId is not a string')
      if (!isStringArray(fragment['types'])) out.push('fragment.types is not a string array')
      if (!isStringArray(fragment['targetCatalogs'])) out.push('fragment.targetCatalogs is not a string array')
      if (typeof fragment['digest'] !== 'string' || !DIGEST.test(fragment['digest'])) out.push('fragment.digest is not a sha256 digest')
    }
  }
  const selection = m['selection']
  if (selection !== null) {
    if (!isObject(selection) || !hasExactKeys(selection, ['digest'])) out.push('selection keys are not digest')
    else if (typeof selection['digest'] !== 'string' || !DIGEST.test(selection['digest'])) out.push('selection.digest is not a sha256 digest')
  }
  for (const k of OPTIONAL_KEYS) {
    if (!Object.hasOwn(m, k)) continue
    const v = m[k]
    if (!isObject(v) || !hasExactKeys(v, ['why']) || typeof v['why'] !== 'string') out.push(`${k} is not { why: string }`)
  }
  return out
}

function componentKeys(catalog: unknown): string[] | null {
  if (!isObject(catalog) || !isObject(catalog['components'])) return null
  return Object.keys(catalog['components']).sort()
}

/** Every disagreement between the manifests and the members they pin. Pure; `[]` means no drift. */
export function driftFindings(input: DriftInput): DriftFinding[] {
  const out: DriftFinding[] = []
  const add = (leg: DriftLeg, id: string, detail: string): void => {
    out.push({ leg, id, detail })
  }

  // schema: only well-formed manifests feed the later legs.
  const valid: AgentManifest[] = []
  for (const { file, manifest } of input.manifests) {
    const problems = schemaProblems(file, manifest)
    if (problems.length === 0) valid.push(manifest as AgentManifest)
    else for (const p of problems) add('schema', file, p)
  }

  // declaration
  for (const m of valid) {
    const presetNulls = [m.preset, m.seedVersion, m.seedDigest].filter((v) => v === null).length
    if (presetNulls !== 0 && presetNulls !== 3) add('declaration', m.id, 'preset, seedVersion and seedDigest are not all null or all set')
    if (hasWhy(m.noPreset) !== (m.preset === null)) add('declaration', m.id, 'noPreset.why must be non-empty exactly when preset is null')
    if ((m.fragment === null) !== (m.selection === null)) add('declaration', m.id, 'fragment and selection are not both null or both set')
    if (hasWhy(m.noFragment) !== (m.fragment === null)) add('declaration', m.id, 'noFragment.why must be non-empty exactly when fragment is null')
  }

  // bijection
  const presetIds = new Set(input.presets.map((p) => p.id))
  const byPreset = new Map<string, AgentManifest[]>()
  for (const m of valid) {
    if (m.preset === null) continue
    byPreset.set(m.preset, [...(byPreset.get(m.preset) ?? []), m])
    if (!presetIds.has(m.preset)) add('bijection', m.id, `preset ${m.preset} is not an AGENT_PRESETS id`)
  }
  for (const p of input.presets) {
    const n = byPreset.get(p.id)?.length ?? 0
    if (n !== 1) add('bijection', p.id, `AGENT_PRESETS id ${p.id} is named by ${n} manifests, not 1`)
  }
  const manifestFor = (presetId: string): AgentManifest | undefined => {
    const list = byPreset.get(presetId)
    return list !== undefined && list.length === 1 ? list[0] : undefined
  }

  const folderById = new Map(input.folders.map((f) => [f.id, f]))
  const shippedById = new Map(input.shippedManifests.map((s) => [s.personaId, s]))

  // identity, fragment-digest, selection-digest, fragment-types, target-catalogs
  for (const m of valid) {
    if (m.preset !== null && m.preset !== m.id) add('identity', m.id, `preset ${m.preset} is not the manifest id`)
    if (m.fragment === null) continue
    const pid = m.fragment.personaId
    if (pid !== m.id) add('identity', m.id, `fragment.personaId ${pid} is not the manifest id`)
    const folder = folderById.get(pid)
    if (folder === undefined) add('identity', m.id, `no persona folder ${pid} with a catalog.json`)
    else {
      const sel = folder.selection
      if (!isObject(sel) || sel['personaId'] !== pid) add('identity', m.id, `${pid}/selection.json is absent or names another personaId`)
      if (m.fragment.digest !== canonicalDigest(folder.catalog)) add('fragment-digest', m.id, `fragment.digest does not match ${pid}/catalog.json`)
      if (sel !== null && m.selection !== null && m.selection.digest !== canonicalDigest(sel)) add('selection-digest', m.id, `selection.digest does not match ${pid}/selection.json`)
      const types = componentKeys(folder.catalog)
      if (types === null || !sameList(m.fragment.types, types)) add('fragment-types', m.id, `fragment.types is not the sorted ${pid}/catalog.json components keys`)
    }
    const shipped = shippedById.get(pid)
    if (shipped === undefined) add('identity', m.id, `no SHIPPED_PERSONA_CATALOG_MANIFESTS entry for ${pid}`)
    else if (!sameList(m.fragment.targetCatalogs, shipped.targetCatalogs)) add('target-catalogs', m.id, `fragment.targetCatalogs is not the shipped ${pid} targetCatalogs`)
  }

  // identity (preset side), unknown-local-patterns, seed-version, seed-digest
  for (const p of input.presets) {
    const m = manifestFor(p.id)
    if (m?.fragment && p.localPatterns !== m.fragment.personaId) add('identity', p.id, `localPatterns ${String(p.localPatterns)} is not fragment.personaId ${m.fragment.personaId}`)
    if (p.localPatterns !== undefined) {
      if (!folderById.has(p.localPatterns)) add('unknown-local-patterns', p.id, `localPatterns ${p.localPatterns} names no persona folder`)
      else if (m !== undefined && m.fragment === null) add('unknown-local-patterns', p.id, `localPatterns ${p.localPatterns} is set but the manifest declares fragment: null`)
    }
    if (m === undefined) continue
    if (m.seedVersion !== p.seedVersion) add('seed-version', p.id, `manifest seedVersion ${String(m.seedVersion)} is not the preset's effective ${p.seedVersion}`)
    if (m.seedDigest !== canonicalDigest(p.seed)) add('seed-digest', p.id, 'seedDigest does not match personaFromPreset')
  }

  // list-coherence: the four persona id lists are one set.
  const lists: [string, string[]][] = [
    ['SHIPPED_PERSONA_CATALOGS', input.shippedPackageIds],
    ['SHIPPED_PERSONA_CATALOG_MANIFESTS', input.shippedManifests.map((s) => s.personaId)],
    ['persona folders', input.folders.map((f) => f.id)],
    ['manifest fragments', valid.flatMap((m) => (m.fragment === null ? [] : [m.fragment.personaId]))],
  ]
  const union = new Set(lists.flatMap(([, ids]) => ids))
  for (const id of [...union].sort()) {
    for (const [name, ids] of lists) if (!ids.includes(id)) add('list-coherence', id, `${id} is missing from ${name}`)
  }

  return out
}

/** Recompute the digests and derived facts; identity, `seedVersion`, nullness and every `why` stay as written. */
export function refreshManifest(manifest: AgentManifest, input: DriftInput): AgentManifest {
  const preset = manifest.preset === null ? undefined : input.presets.find((p) => p.id === manifest.preset)
  const fragment = manifest.fragment
  const folder = fragment === null ? undefined : input.folders.find((f) => f.id === fragment.personaId)
  const shipped = fragment === null ? undefined : input.shippedManifests.find((s) => s.personaId === fragment.personaId)
  return {
    ...manifest,
    seedDigest: preset === undefined ? manifest.seedDigest : canonicalDigest(preset.seed),
    fragment:
      fragment === null
        ? null
        : {
            personaId: fragment.personaId,
            types: (folder && componentKeys(folder.catalog)) ?? fragment.types,
            targetCatalogs: shipped ? [...shipped.targetCatalogs] : fragment.targetCatalogs,
            digest: folder ? canonicalDigest(folder.catalog) : fragment.digest,
          },
    selection:
      manifest.selection === null
        ? null
        : { digest: folder && folder.selection !== null ? canonicalDigest(folder.selection) : manifest.selection.digest },
  }
}

/** The on-disk bytes: interface key order, two-space indent, trailing newline. */
export function formatManifest(m: AgentManifest): string {
  const ordered: AgentManifest = {
    id: m.id,
    preset: m.preset,
    seedVersion: m.seedVersion,
    seedDigest: m.seedDigest,
    fragment: m.fragment === null ? null : { personaId: m.fragment.personaId, types: m.fragment.types, targetCatalogs: m.fragment.targetCatalogs, digest: m.fragment.digest },
    selection: m.selection === null ? null : { digest: m.selection.digest },
    ...(m.noFragment === undefined ? {} : { noFragment: { why: m.noFragment.why } }),
    ...(m.noPreset === undefined ? {} : { noPreset: { why: m.noPreset.why } }),
  }
  return `${JSON.stringify(ordered, null, 2)}\n`
}
