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
  croupier: 'sha256:046bbc442fb41f84d5d7abc6b9f1693846d2b9ec4fd6f51fdbe00ae1dbd9c566',
  quant: 'sha256:2f361b72b293456b7b83ddde5da2594d2e0d6c6719cac70ae9024329e9cd16ea',
  concierge: 'sha256:048051cdbc9d982cce88f239bacd54a6db2683147c2a46f836101b1e54ebefdf',
  restaurant: 'sha256:092d927d4284358bda7fbe00ab1bd1e8d6b6c95a24d0c4c858164c9c4e41364d',
  travel: 'sha256:6d254b9f63074f9fbfe265ab5b13d95bb90576ee4ccdcc0c67aedc16a1fd3746',
  curator: 'sha256:81881cbdf3a5c96c88bf0ef47a874a020d8dc99d97520b3cd2f1763896fbcf49',
  stylist: 'sha256:5be5c45f741dd489178106991cf29bd19acc06721e592b446c7f3d95954a4226',
  shopkeeper: 'sha256:2f9ad865a97e33ff9ae776f0a8b4ab9a45a0a1e28113d665faa7754864df2fd9',
  quizmaster: 'sha256:03f652e96ca7b556fe3eedea06e544c011a4f47ab911c01aa91b7f6572ec84f8',
  mentalist: 'sha256:0175a300c2e3a6a1f0d50f9067ca8d6e0a696e9ae9c27edbbdb4dc6224c654f5',
  negotiator: 'sha256:7d64711cac5c40fa2468bb38cd1b3f88d7e86b5021d367cc62926a40c524cb38',
  lexicographer: 'sha256:b499f4485ad8fc7d067163ddd8c7a0de0f983766062f0c8b77b39dc1aa1a835c',
  admiral: 'sha256:43c67aee742c8e13f9091d28aa25d94aef76d34f3a07fb85491c4af420c4461c',
  alchemist: 'sha256:82635280f88abbbb9f9035e3193694d3ab47e619378192ad2b7bce3d17ece26c',
  'dungeon-master': 'sha256:28338295337eb41790cef55fb3cec257ff2bf3d3bca165cc4fac072280add2c8',
}
const BUILDER_DIGEST = 'sha256:3127b77df486f0a96fec2cd99ec93fbeacade3aac9545b5e66f689925eac94c6'
const PRESETS_DIGEST = 'sha256:3965a9b7af2bf3c0c6d1fabe4e19e39b150d0a6f23a75b80943d6c4d9cc8b221'
const ROSTER_DIGEST = 'sha256:641964d00b25540818a572324026901465e3ffd4316d829dcbcf06aeeecb6203'
const LIBRARIES_DIGEST = 'sha256:61fb153cff5db5791f2260ad0c3e7eb9b7e0975b648a1ce9a1a5ce0a08a41d7e'

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
