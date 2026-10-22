// agent-admin-seed-digests.test.ts: the T-0160 byte-identity pin. The preset and pack seeds moved from TS
// constants to files under site/agent-content/ (read through its generated registry), and that move must
// change no seed: every assembled persona (the 15 roster presets and the Builder), the resolved preset
// objects, the roster order and the library packs digest exactly as they did before the move. The table
// below was captured from the TS constants at the T-0160 base, so a red here means a content file no
// longer reproduces its seed. A deliberate seed edit: change the content file, run
// `node scripts/generate-agent-content.mjs` (the registries and the manifests' `seedVersion`), refresh the
// manifest's `seedDigest` with the armed writer (site/lib/agent-manifest/agent-manifest.write.test.ts),
// and update the row here in the same change.
import { describe, it, expect } from 'vitest'
import { AGENT_PRESETS, builderPersona, personaFromPreset } from './agent-admin-presets.ts'
import { ADMIN_LIBRARIES, setLiveIntegrations, setLiveServices } from './agent-admin-libraries.ts'
import { canonicalDigest } from '../lib/agent-manifest/agent-manifest.ts'

const PERSONA_DIGESTS: Record<string, string> = {
  croupier: 'sha256:af63636ced529226d3394519bb7d36883ef77dbcc3f897ac618b02a040ddb9b5',
  quant: 'sha256:2f361b72b293456b7b83ddde5da2594d2e0d6c6719cac70ae9024329e9cd16ea',
  concierge: 'sha256:c31551edf7aedde3ef647288a83068541469ea65b8d4302caf944e418620165f',
  restaurant: 'sha256:e98f4ddb690c02f7bd5b1629caa7ee7cb757b3409fbafa8630f8d41f6d6f1aa9',
  travel: 'sha256:6c278799c52a10627305adf37d415713076cbc6ce0d6ce431ef7195af9dd2a29',
  curator: 'sha256:81881cbdf3a5c96c88bf0ef47a874a020d8dc99d97520b3cd2f1763896fbcf49',
  stylist: 'sha256:5be5c45f741dd489178106991cf29bd19acc06721e592b446c7f3d95954a4226',
  shopkeeper: 'sha256:b7fc793c6387221e4bb13b225ed3caf4e084fceb7c8f445364be8803a455db9a',
  quizmaster: 'sha256:03f652e96ca7b556fe3eedea06e544c011a4f47ab911c01aa91b7f6572ec84f8',
  mentalist: 'sha256:0175a300c2e3a6a1f0d50f9067ca8d6e0a696e9ae9c27edbbdb4dc6224c654f5',
  negotiator: 'sha256:7d64711cac5c40fa2468bb38cd1b3f88d7e86b5021d367cc62926a40c524cb38',
  lexicographer: 'sha256:b499f4485ad8fc7d067163ddd8c7a0de0f983766062f0c8b77b39dc1aa1a835c',
  admiral: 'sha256:43c67aee742c8e13f9091d28aa25d94aef76d34f3a07fb85491c4af420c4461c',
  alchemist: 'sha256:82635280f88abbbb9f9035e3193694d3ab47e619378192ad2b7bce3d17ece26c',
  'dungeon-master': 'sha256:28338295337eb41790cef55fb3cec257ff2bf3d3bca165cc4fac072280add2c8',
}
const BUILDER_DIGEST = 'sha256:f68026d14f91395bf3f2861e45bb8ebdfb75a6fc9f4341074f83a983ec8d164a'
const PRESETS_DIGEST = 'sha256:7d2e3b9953e1a5485bc25f23e63d5cc97acc8dc976f510fb75911093b9a85ac4'
const ROSTER_DIGEST = 'sha256:641964d00b25540818a572324026901465e3ffd4316d829dcbcf06aeeecb6203'
const LIBRARIES_DIGEST = 'sha256:2f75cdabd8c5886be98a5fc003c05967376ff4d2a2abc312fe99f480f4c314cd'

describe('agent-admin seeds: byte-identical across the T-0160 move to content files', () => {
  it('every roster preset assembles to its pinned digest', () => {
    const actual = Object.fromEntries(AGENT_PRESETS.map((p) => [p.id, canonicalDigest(personaFromPreset(p))]))
    expect(actual).toEqual(PERSONA_DIGESTS)
  })

  it('the Builder assembles to its pinned digest', () => {
    expect(canonicalDigest(builderPersona())).toBe(BUILDER_DIGEST)
  })

  it('the resolved preset objects and the roster order are unchanged', () => {
    expect(canonicalDigest(JSON.parse(JSON.stringify(AGENT_PRESETS)))).toBe(PRESETS_DIGEST)
    expect(canonicalDigest(AGENT_PRESETS.map((p) => p.id))).toBe(ROSTER_DIGEST)
  })

  it('the library packs are unchanged (live overlays off)', () => {
    setLiveIntegrations(undefined)
    setLiveServices(undefined)
    expect(canonicalDigest(JSON.parse(JSON.stringify(ADMIN_LIBRARIES)))).toBe(LIBRARIES_DIGEST)
  })

  it('bites: one changed character moves a persona digest', () => {
    const p = AGENT_PRESETS.find((x) => x.id === 'quant')!
    expect(canonicalDigest(personaFromPreset({ ...p, foundation: `${p.foundation} ` }))).not.toBe(PERSONA_DIGESTS['quant'])
  })
})
