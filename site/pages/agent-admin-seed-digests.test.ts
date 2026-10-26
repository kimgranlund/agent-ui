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
  concierge: 'sha256:4361d792dd1ab28752000c051392e5813afc4d5ec9d13c34b159582518fc4cec',
  restaurant: 'sha256:6628561bbf3c9d1e4e218dd3fc6060a28ede6c6ed289386d2db101487c0b83f3',
  travel: 'sha256:6c278799c52a10627305adf37d415713076cbc6ce0d6ce431ef7195af9dd2a29',
  curator: 'sha256:81881cbdf3a5c96c88bf0ef47a874a020d8dc99d97520b3cd2f1763896fbcf49',
  stylist: 'sha256:5be5c45f741dd489178106991cf29bd19acc06721e592b446c7f3d95954a4226',
  shopkeeper: 'sha256:9b7a913f834344373bdbc527bfcca807c82db2c6ee08db03df42e0b8032f42b8',
  quizmaster: 'sha256:65f7e46dcc4e0a4a3d5ac1a627ca6b14320ea7e9895a6314906d76bc4d8a5766',
  mentalist: 'sha256:e110c13f0cb88f2894857b73cb49f5a464a40ea86adbbcda0bbbd055079d56ab',
  negotiator: 'sha256:7d64711cac5c40fa2468bb38cd1b3f88d7e86b5021d367cc62926a40c524cb38',
  lexicographer: 'sha256:b499f4485ad8fc7d067163ddd8c7a0de0f983766062f0c8b77b39dc1aa1a835c',
  admiral: 'sha256:43c67aee742c8e13f9091d28aa25d94aef76d34f3a07fb85491c4af420c4461c',
  alchemist: 'sha256:82635280f88abbbb9f9035e3193694d3ab47e619378192ad2b7bce3d17ece26c',
  'dungeon-master': 'sha256:28338295337eb41790cef55fb3cec257ff2bf3d3bca165cc4fac072280add2c8',
}
// T-0447: recaptured for the code-authored edit-session section (seeded disabled; no content file moved).
const BUILDER_DIGEST = 'sha256:c0700a01a032eaea15ee806c26458c0d0a8b07259ea58db46349f69e5de8abe0'
const PRESETS_DIGEST = 'sha256:d79d04d37c157f00c6d78504d0317572ebd31a3c5478b0978ebec7972cc6b52a'
const ROSTER_DIGEST = 'sha256:641964d00b25540818a572324026901465e3ffd4316d829dcbcf06aeeecb6203'
const LIBRARIES_DIGEST = 'sha256:06816be10277caa0dc42fe5fdce2a5357b002d30f1df7e747d3f2644937ae271' // T-0451: step-flow mini-skill trigger and body

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
