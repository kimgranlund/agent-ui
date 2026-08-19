// skill-pack-no-egress.test.ts — ADR-0208 D5.1's own acceptance line (GH #1340/#1349 S2), the
// document-ingest-no-egress.test.ts precedent extended to the skill-pack ingestion path: the app
// NEVER fetches skill content — the egress happened once, on the developer's machine, through their
// own git (D2), and the snapshot's bytes arrive only by the user's explicit local-file choice (D3,
// the ADR-0202 trust shape). This suite proves the boundary mechanically: a `fetch` spy over the
// WHOLE ingest pipeline — file text → fail-closed parse → shelf store → libraries projection →
// per-agent opt-in mint — records ZERO calls, for the accept path, the refusal path, and removal.
// ADR-0073's trust boundary (the dev proxy as the only sanctioned egress mount) is untouched by
// construction; this trip-wire keeps it that way against regression.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { StorageAdapter } from '@agent-ui/shared'
import { validateNewEntry } from '../entry-list/entry-data.ts'
import { ENTRY_KINDS } from './entries.ts'
import {
  SKILL_PACK_FORMAT,
  __testSetAdapter,
  importedSkillPackLibrary,
  loadSkillPacks,
  parseSkillPackText,
  removeSkillPack,
  saveSkillPack,
} from './skill-pack-store.ts'

function fakeAdapter(): StorageAdapter {
  const values = new Map<string, unknown>()
  return {
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

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  __testSetAdapter(fakeAdapter())
  fetchSpy = vi.fn(async () => {
    throw new Error('skill-pack-no-egress: fetch must never be called by the skill-pack ingest/store pipeline')
  })
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  __testSetAdapter(undefined)
  vi.unstubAllGlobals()
})

const snapshotText = (content: string): string =>
  JSON.stringify({
    format: SKILL_PACK_FORMAT,
    pack: {
      id: 'github-com-example-skills',
      label: 'example/skills',
      description: 'Imported from https://github.com/example/skills @ a1b2c3d',
      rejectOnCollision: true,
      entries: [{ id: 'good-skill', label: 'Good Skill', description: 'desc', content }],
    },
    provenance: {
      sourceUrl: 'https://github.com/example/skills',
      commitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      importedAt: '2026-08-18T12:00:00.000Z',
      skillCount: 1,
      droppedFrontmatterKeys: [],
      skipped: [],
      scan: { flagged: [] },
    },
    license: null,
  })

describe('ADR-0208 D5.1 — no bytes-egress proof over the skill-pack pipeline', () => {
  it('accept path: parse → save → load → project → opt-in mint makes ZERO fetch calls', async () => {
    const parsed = parseSkillPackText(snapshotText('# Body\n\nA whole third-party skill body.'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    await saveSkillPack(parsed.snapshot)
    const shelf = await loadSkillPacks()
    expect(shelf).toHaveLength(1)

    const [pack] = importedSkillPackLibrary(shelf)
    const input = pack!.entries[0]!
    const minted = validateNewEntry([], ENTRY_KINDS.skill, input, { rejectOnCollision: true })
    expect(minted.ok).toBe(true)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('a LARGE third-party body rides the same zero-egress path (the IDB tier is what absorbs it, D3/D6)', async () => {
    const parsed = parseSkillPackText(snapshotText('third-party-line\n'.repeat(5000)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await saveSkillPack(parsed.snapshot)
    expect((await loadSkillPacks())[0]!.pack.entries[0]!.content.length).toBeGreaterThan(50_000)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('the refusal path (fail-closed validation) also makes zero fetch calls', async () => {
    const refused = parseSkillPackText(JSON.stringify({ format: 'wrong' }))
    expect(refused.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('removal makes zero fetch calls', async () => {
    const parsed = parseSkillPackText(snapshotText('body'))
    if (parsed.ok) await saveSkillPack(parsed.snapshot)
    await removeSkillPack('github-com-example-skills')
    expect(await loadSkillPacks()).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
