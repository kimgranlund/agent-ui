// agent-manifest.test.ts: the agent-manifest drift gate (GH #1812), run by `npm test` in the `site`
// vitest project. The real tree must show no drift between each `<id>.manifest.json` and the preset,
// fragment and sidecar it pins; every leg has a planted-defect negative control (`bites: <leg>`).
//
// A red `seed-digest`, `fragment-digest`, `selection-digest`, `fragment-types` or `target-catalogs` after a
// deliberate change: run the armed writer (agent-manifest.write.test.ts header), then decide by hand
// whether the preset's `seedVersion` bumps (a bump drops users' persisted stores).
import { describe, it, expect } from 'vitest'
import { AGENT_PRESETS, personaFromPreset } from '../../pages/agent-admin-presets.ts'
import {
  canonicalDigest,
  driftFindings,
  readTreeInput,
  refreshManifest,
  type AgentManifest,
  type DriftInput,
  type DriftLeg,
} from './agent-manifest.ts'

const REAL = readTreeInput()
const clone = (): DriftInput => JSON.parse(JSON.stringify(REAL)) as DriftInput
const manifestOf = (input: DriftInput, id: string): AgentManifest => {
  const entry = input.manifests.find((m) => (m.manifest as AgentManifest).id === id)
  if (entry === undefined) throw new Error(`no manifest ${id}`)
  return entry.manifest as AgentManifest
}
const legsOf = (input: DriftInput): DriftLeg[] => driftFindings(input).map((f) => f.leg)

describe('agent manifests: the drift gate', () => {
  it('the real tree has no drift', () => {
    expect(driftFindings(readTreeInput())).toEqual([])
  })

  it('bites: schema', () => {
    const input = clone()
    ;(manifestOf(input, 'quant') as unknown as Record<string, unknown>)['extra'] = true
    expect(legsOf(input)).toContain('schema')
  })

  it('bites: declaration', () => {
    const input = clone()
    manifestOf(input, 'croupier').noFragment = { why: 'a fragment and a no-fragment why at once' }
    expect(legsOf(input)).toContain('declaration')
  })

  it('bites: bijection', () => {
    const input = clone()
    input.manifests = input.manifests.filter((m) => (m.manifest as AgentManifest).id !== 'quant')
    expect(legsOf(input)).toContain('bijection')
  })

  it('bites: identity', () => {
    const input = clone()
    const folder = input.folders.find((f) => f.id === 'croupier')
    ;(folder!.selection as Record<string, unknown>)['personaId'] = 'concierge'
    expect(legsOf(input)).toContain('identity')
  })

  it('bites: unknown-local-patterns', () => {
    const input = clone()
    input.presets.find((p) => p.id === 'quant')!.localPatterns = 'qaunt'
    expect(legsOf(input)).toContain('unknown-local-patterns')
  })

  it('bites: seed-version', () => {
    const input = clone()
    input.presets.find((p) => p.id === 'croupier')!.seedVersion += 1
    expect(legsOf(input)).toContain('seed-version')
  })

  it('bites: seed-digest', () => {
    const input = clone()
    ;(input.presets.find((p) => p.id === 'quant')!.seed as Record<string, unknown>)['label'] = 'Another Quant'
    expect(legsOf(input)).toContain('seed-digest')
  })

  it('bites: fragment-digest', () => {
    const input = clone()
    ;(input.folders.find((f) => f.id === 'croupier')!.catalog as Record<string, unknown>)['planted'] = true
    expect(legsOf(input)).toContain('fragment-digest')
  })

  it('bites: selection-digest', () => {
    const input = clone()
    ;(input.folders.find((f) => f.id === 'concierge')!.selection as Record<string, unknown>)['planted'] = true
    expect(legsOf(input)).toContain('selection-digest')
  })

  it('bites: fragment-types', () => {
    const input = clone()
    manifestOf(input, 'croupier').fragment!.types = []
    expect(legsOf(input)).toContain('fragment-types')
  })

  it('bites: target-catalogs', () => {
    const input = clone()
    input.shippedManifests.find((s) => s.personaId === 'croupier')!.targetCatalogs = ['agent-ui']
    expect(legsOf(input)).toContain('target-catalogs')
  })

  it('bites: list-coherence', () => {
    const input = clone()
    input.shippedPackageIds.push('ghost')
    expect(legsOf(input)).toContain('list-coherence')
  })

  it('canonicalDigest ignores key order', () => {
    expect(canonicalDigest({ a: 1, b: { c: [1, 2], d: 'x' } })).toBe(canonicalDigest({ b: { d: 'x', c: [1, 2] }, a: 1 }))
  })

  it('canonicalDigest changes when a value changes', () => {
    expect(canonicalDigest({ a: 1, b: { c: [1, 2] } })).not.toBe(canonicalDigest({ a: 1, b: { c: [2, 1] } }))
    expect(canonicalDigest({ a: 1 })).not.toBe(canonicalDigest({ a: 2 }))
  })

  it('the seed digest is deterministic', () => {
    for (const p of AGENT_PRESETS) {
      expect(canonicalDigest(personaFromPreset(p))).toBe(canonicalDigest(personaFromPreset(p)))
    }
  })

  it('refreshManifest keeps identity, seedVersion and why', () => {
    const stale = 'sha256:' + '0'.repeat(64)
    const real = manifestOf(clone(), 'croupier')
    const quant = manifestOf(clone(), 'quant')
    const plantedWhy = 'a planted why that the writer must not touch'
    const croupier = refreshManifest(
      { ...real, seedVersion: 99, seedDigest: stale, fragment: { ...real.fragment!, types: [], targetCatalogs: [], digest: stale }, selection: { digest: stale } },
      REAL,
    )
    expect(croupier).toEqual({ ...real, seedVersion: 99 })
    const refreshedQuant = refreshManifest({ ...quant, seedVersion: 42, seedDigest: stale, noFragment: { why: plantedWhy } }, REAL)
    expect(refreshedQuant).toEqual({ ...quant, seedVersion: 42, noFragment: { why: plantedWhy } })
    expect(refreshedQuant.fragment).toBeNull()
    expect(refreshedQuant.selection).toBeNull()
  })
})
