// @vitest-environment jsdom
// T-0476: the persona seed a live probe fixture records (`seedVersion` and `seedDigest`) is read off the agent
// manifest, which `agent-manifest.test.ts` pins to the tree; this pins it again to the live preset, independently.
import { describe, expect, it } from 'vitest'
import { canonicalDigest } from '../../../site/agent-content/digest.ts'
import { AGENT_PRESETS, personaFromPreset } from '../../../site/pages/agent-admin-presets.ts'
import { personaSeedRecord } from './seed.ts'

describe('personaSeedRecord', () => {
  it('matches the live preset seedVersion and the digest of its assembled seed', () => {
    for (const id of ['croupier', 'concierge']) {
      const preset = AGENT_PRESETS.find((p) => p.id === id)
      const seed = personaSeedRecord(id, process.cwd())
      expect(seed).toEqual({ version: preset.seedVersion ?? 1, digest: canonicalDigest(JSON.parse(JSON.stringify(personaFromPreset(preset)))) })
      expect(seed.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    }
  })

  it('is undefined for an agent no manifest names', () => {
    expect(personaSeedRecord('no-such-agent', process.cwd())).toBeUndefined()
  })
})
