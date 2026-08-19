// skill-pack-store.test.ts — ADR-0208 D3's own acceptance surface (GH #1340/#1349 S2): fail-closed
// snapshot validation with NAMED refusal reasons, the whole-snapshot `skill-packs:<id>` store
// round-trip over the ADR-0193 StorageAdapter seam, remove-deletes-the-record-only, and the D4
// projection (`rejectOnCollision` forced true). The sibling `skill-pack-no-egress.test.ts` carries
// the egress trip-wire; `skill-pack-lazy.bundle.test.ts` carries the bundle assertion.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { StorageAdapter } from '@agent-ui/shared'
import {
  SKILL_PACK_FORMAT,
  SKILL_PACK_KEY_PREFIX,
  __testSetAdapter,
  importedSkillPackLibrary,
  loadSkillPacks,
  parseSkillPackSnapshot,
  parseSkillPackText,
  removeSkillPack,
  saveSkillPack,
  skillPackAttribution,
  skillPackStoreKey,
  type SkillPackSnapshot,
} from './skill-pack-store.ts'

function fakeAdapter(): StorageAdapter & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>()
  return {
    values,
    async get(key) {
      return values.get(key)
    },
    async set(key, value) {
      values.set(key, value)
    },
    async delete(key) {
      values.delete(key)
    },
    async keys() {
      return [...values.keys()]
    },
  }
}

/** A valid D1 snapshot — the exact shape `scripts/import-skill-pack.mjs` writes. */
function fixture(overrides: Partial<SkillPackSnapshot> = {}): SkillPackSnapshot {
  return {
    format: SKILL_PACK_FORMAT,
    pack: {
      id: 'github-com-example-skills',
      label: 'example/skills',
      description: 'Imported from https://github.com/example/skills @ a1b2c3d',
      rejectOnCollision: true,
      entries: [
        { id: 'good-skill', label: 'Good Skill', description: 'A well-formed skill.', content: '# Good\n\nUse this for good things.' },
        { id: 'second-skill', label: 'Second', description: '', content: 'Body two.' },
      ],
    },
    provenance: {
      sourceUrl: 'https://github.com/example/skills',
      commitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      importedAt: '2026-08-18T12:00:00.000Z',
      skillCount: 2,
      droppedFrontmatterKeys: ['allowed-tools', 'model'],
      skipped: ['no-fence'],
      scan: { flagged: [{ entryId: 'good-skill', line: 3, reason: 'override-directive' }] },
    },
    license: { fileName: 'LICENSE', text: 'MIT License\n' },
    ...overrides,
  }
}

let adapter: ReturnType<typeof fakeAdapter>

beforeEach(() => {
  adapter = fakeAdapter()
  __testSetAdapter(adapter)
})

afterEach(() => {
  __testSetAdapter(undefined)
})

describe('parseSkillPackText / parseSkillPackSnapshot — D3 fail-closed validation, named reasons', () => {
  it('accepts the exact D1 shape the CLI writes, whole (pack + provenance + license)', () => {
    const result = parseSkillPackText(JSON.stringify(fixture()))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.snapshot.pack.entries).toHaveLength(2)
      expect(result.snapshot.provenance.scan.flagged).toEqual([{ entryId: 'good-skill', line: 3, reason: 'override-directive' }])
      expect(result.snapshot.license).toEqual({ fileName: 'LICENSE', text: 'MIT License\n' })
    }
  })

  it('refuses a non-JSON file with its own named reason', () => {
    const result = parseSkillPackText('not json at all {')
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Not a JSON file') })
  })

  it('refuses a WRONG format marker (fail-closed on anything but agent-ui-skillpack@1)', () => {
    const result = parseSkillPackSnapshot({ ...fixture(), format: 'agent-ui-skillpack@2' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Unsupported format marker')
  })

  it('refuses an ABSENT format marker', () => {
    const { format: _format, ...rest } = fixture()
    const result = parseSkillPackSnapshot(rest)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Unsupported format marker')
  })

  it('refuses a non-EntryLibraryPack-shaped pack (missing id)', () => {
    const bad = fixture()
    const result = parseSkillPackSnapshot({ ...bad, pack: { ...bad.pack, id: '' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not EntryLibraryPack-shaped')
  })

  it('refuses a pack with no entries — nothing to import is a refusal, not an empty shelf row', () => {
    const bad = fixture()
    const result = parseSkillPackSnapshot({ ...bad, pack: { ...bad.pack, entries: [] } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('no entries')
  })

  it('refuses a malformed entry (an imported entry MUST carry its explicit folder-name id — LLD-C7)', () => {
    const bad = fixture()
    const entries = [{ label: 'No id', description: '', content: 'x' }]
    const result = parseSkillPackSnapshot({ ...bad, pack: { ...bad.pack, entries } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('entry 1 is malformed')
  })

  it('refuses an empty provenance.sourceUrl (snapshot origin unknown)', () => {
    const bad = fixture()
    const result = parseSkillPackSnapshot({ ...bad, provenance: { ...bad.provenance, sourceUrl: '  ' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('no sourceUrl')
  })

  it('refuses an empty provenance.commitSha (snapshot not pinned)', () => {
    const bad = fixture()
    const result = parseSkillPackSnapshot({ ...bad, provenance: { ...bad.provenance, commitSha: '' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('no commitSha')
  })

  it('refuses a malformed license record (present but not { fileName, text })', () => {
    const result = parseSkillPackSnapshot({ ...fixture(), license: { fileName: '' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('license record is malformed')
  })

  it('accepts license: null (D7 — the pack library states "no license file found", never guesses)', () => {
    const result = parseSkillPackSnapshot(fixture({ license: null }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.snapshot.license).toBeNull()
  })
})

describe('the shelf store — skill-packs:<id> round trip over the StorageAdapter seam (D3)', () => {
  it('saveSkillPack persists the WHOLE snapshot under skill-packs:<packId>; loadSkillPacks returns it', async () => {
    const snapshot = fixture()
    await saveSkillPack(snapshot)
    expect(adapter.values.has(skillPackStoreKey(snapshot.pack.id))).toBe(true)
    expect(skillPackStoreKey(snapshot.pack.id)).toBe(`${SKILL_PACK_KEY_PREFIX}${snapshot.pack.id}`)
    const loaded = await loadSkillPacks()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual(snapshot) // pack + provenance + license, whole — nothing shed on the way through
  })

  it('re-import REPLACES the shelf record wholesale (D2 idempotency — same key, fresh snapshot)', async () => {
    const v1 = fixture()
    await saveSkillPack(v1)
    const v2 = fixture()
    v2.pack.entries = [{ id: 'good-skill', label: 'Good Skill', description: 'REVISED upstream.', content: 'New body.' }]
    v2.provenance.commitSha = 'ffff1111ffff1111ffff1111ffff1111ffff1111'
    await saveSkillPack(v2)
    const loaded = await loadSkillPacks()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.provenance.commitSha).toBe(v2.provenance.commitSha)
    expect(loaded[0]!.pack.entries).toEqual(v2.pack.entries)
  })

  it('removeSkillPack deletes ONE pack record and nothing else — a second pack survives', async () => {
    const a = fixture()
    const b = fixture()
    b.pack = { ...b.pack, id: 'github-com-other-skills', label: 'other/skills' }
    await saveSkillPack(a)
    await saveSkillPack(b)
    await removeSkillPack(a.pack.id)
    const loaded = await loadSkillPacks()
    expect(loaded.map((s) => s.pack.id)).toEqual([b.pack.id])
  })

  it('loadSkillPacks is DEFENSIVE: a corrupt/foreign record under the prefix is skipped, never thrown', async () => {
    await saveSkillPack(fixture())
    adapter.values.set(`${SKILL_PACK_KEY_PREFIX}corrupt`, { format: 'something-else' })
    adapter.values.set('unrelated:key', 'noise')
    const loaded = await loadSkillPacks()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.pack.id).toBe('github-com-example-skills')
  })
})

describe('importedSkillPackLibrary — the D4 projection into the libraries seam', () => {
  it('projects one EntryLibraryPack per snapshot with entries VERBATIM', () => {
    const snapshot = fixture()
    const [pack] = importedSkillPackLibrary([snapshot])
    expect(pack!.id).toBe(snapshot.pack.id)
    expect(pack!.label).toBe(snapshot.pack.label)
    expect(pack!.entries).toEqual(snapshot.pack.entries)
  })

  it('FORCES rejectOnCollision: true regardless of what the file said (D4 — the foreign-key law)', () => {
    const snapshot = fixture()
    snapshot.pack.rejectOnCollision = false // a hand-tampered file cannot opt out of the collision law
    const [pack] = importedSkillPackLibrary([snapshot])
    expect(pack!.rejectOnCollision).toBe(true)
  })
})

describe('skillPackAttribution — D7 displayed, not just stored', () => {
  it('names source URL, short sha, import date, and the license file', () => {
    expect(skillPackAttribution(fixture())).toBe('https://github.com/example/skills @ a1b2c3d · imported 2026-08-18 · LICENSE')
  })

  it('states "no license file found" for license: null — never a guessed license', () => {
    expect(skillPackAttribution(fixture({ license: null }))).toContain('no license file found')
  })
})
