// skill-pack-opt-in.test.ts — ADR-0208 D4's own acceptance surface (GH #1340/#1349 S3): per-agent
// opt-in rides the UNCHANGED validateNewEntry/entries pipeline (the genui-pack-library.test.ts
// precedent), `rejectOnCollision` refuses a genuine duplicate, refresh replaces the SHELF only (an
// opted-in copy never mutates behind the user — the collision-DISABLED picker row is the visible
// staleness), and the default-off negative assertion in prompt assembly: nothing from a merely-
// imported pack ever reaches a composed prompt — an explicitly added + enabled entry contributes
// exactly ONE index line (GH #891/SPEC-R14), full text rides ONLY the invocation framing
// (`resolveTurnReferences`, Kim's confirmed reading: index-line-ambient + full-text-on-invocation).
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import type { StorageAdapter } from '@agent-ui/shared'
import { validateNewEntry, type Entry } from '../entry-list/entry-data.ts'
import { mountEntryList, type EntryListHandlers } from '../entry-list/entry-list.ts'
import { ENTRY_KINDS, composeLiveSystemPrompt, resolveTurnReferences } from './entries.ts'
import {
  __testSetAdapter,
  importedSkillPackLibrary,
  loadSkillPacks,
  saveSkillPack,
  type SkillPackSnapshot,
} from './skill-pack-store.ts'

// entry-list composes real FACE controls; jsdom's ElementInternals carries no setFormValue/setValidity
// (the agent-admin.test.ts jsdom-reality stub, copied verbatim for this file's DOM leg).
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})

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

const V1_CONTENT = '# Deploy checklist\n\nAlways run the gates before shipping.'
const V2_CONTENT = '# Deploy checklist (REVISED)\n\nUpstream rewrote this body after the import.'

function snapshotWith(content: string, sha: string): SkillPackSnapshot {
  return {
    format: 'agent-ui-skillpack@1',
    pack: {
      id: 'github-com-example-skills',
      label: 'example/skills',
      description: `Imported from https://github.com/example/skills @ ${sha.slice(0, 7)}`,
      rejectOnCollision: true,
      entries: [{ id: 'deploy-checklist', label: 'Deploy Checklist', description: 'How deploys run.', content }],
    },
    provenance: {
      sourceUrl: 'https://github.com/example/skills',
      commitSha: sha,
      importedAt: '2026-08-18T12:00:00.000Z',
      skillCount: 1,
      droppedFrontmatterKeys: [],
      skipped: [],
      scan: { flagged: [] },
    },
    license: null,
  }
}

const SHA_V1 = '1111111111111111111111111111111111111111'
const SHA_V2 = '2222222222222222222222222222222222222222'

beforeEach(() => {
  __testSetAdapter(fakeAdapter())
})

afterEach(() => {
  __testSetAdapter(undefined)
})

describe('D4 — opt-in commits through the UNCHANGED validateNewEntry pipeline (the genui round-trip precedent)', () => {
  it('every projected entry mints a real skill Entry: folder-name id EXPLICIT, content verbatim, enabled, deletable', () => {
    const [pack] = importedSkillPackLibrary([snapshotWith(V1_CONTENT, SHA_V1)])
    for (const input of pack!.entries) {
      const result = validateNewEntry([], ENTRY_KINDS.skill, input, { rejectOnCollision: pack!.rejectOnCollision })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.entry.id, 'the source folder name survives as the id — never slugged from the label (LLD-C7)').toBe('deploy-checklist')
        expect(result.entry.kind).toBe(ENTRY_KINDS.skill)
        expect(result.entry.content, 'the body rides verbatim').toBe(V1_CONTENT)
        expect(result.entry.enabled, 'a library add commits pre-enabled — but it still had to be ADDED (never automatic)').toBe(true)
        expect(result.entry.builtin, 'an imported entry is an ordinary deletable custom entry').toBe(false)
      }
    }
  })

  it('a colliding id is REJECTED outright — never suffix-deduped into a phantom copy (GH #564 at pack grain)', () => {
    const [pack] = importedSkillPackLibrary([snapshotWith(V1_CONTENT, SHA_V1)])
    const input = pack!.entries[0]!
    const first = validateNewEntry([], ENTRY_KINDS.skill, input, { rejectOnCollision: true })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = validateNewEntry([first.entry], ENTRY_KINDS.skill, input, { rejectOnCollision: true })
    expect(second).toEqual({ ok: false, error: 'Already in the list.' })
  })
})

describe('D4 — refresh replaces the SHELF only; an opted-in copy never mutates behind the user', () => {
  it('re-import lands v2 on the shelf while the minted copy keeps v1 byte-identical; the collision predicate makes the staleness visible; remove-and-re-add takes the refreshed text', async () => {
    // Import v1 and opt in — the copy law: a library add IS a custom add with the typing done.
    await saveSkillPack(snapshotWith(V1_CONTENT, SHA_V1))
    const [v1pack] = importedSkillPackLibrary(await loadSkillPacks())
    const minted = validateNewEntry([], ENTRY_KINDS.skill, v1pack!.entries[0]!, { rejectOnCollision: true })
    expect(minted.ok).toBe(true)
    if (!minted.ok) return
    const optedInCopy: Entry = minted.entry

    // Upstream revises; the user re-imports. The SHELF refreshes wholesale…
    await saveSkillPack(snapshotWith(V2_CONTENT, SHA_V2))
    const shelf = await loadSkillPacks()
    expect(shelf).toHaveLength(1)
    expect(shelf[0]!.pack.entries[0]!.content, 'the shelf carries the refreshed text').toBe(V2_CONTENT)
    expect(shelf[0]!.provenance.commitSha).toBe(SHA_V2)

    // …and the opted-in copy is UNTOUCHED — what the user reviewed and enabled stays byte-identical.
    expect(optedInCopy.content, 'no background mutation of prompt-reaching text, ever').toBe(V1_CONTENT)

    // The refreshed entry cannot silently re-add over the stale copy: the SAME collision predicate the
    // picker-disable uses refuses it — that disabled row IS the visible "your copy is older" state.
    const [v2pack] = importedSkillPackLibrary(shelf)
    const reAdd = validateNewEntry([optedInCopy], ENTRY_KINDS.skill, v2pack!.entries[0]!, { rejectOnCollision: true })
    expect(reAdd).toEqual({ ok: false, error: 'Already in the list.' })

    // The sanctioned refresh path: the user removes the old entry, then re-adds the refreshed one.
    const afterRemove = validateNewEntry([], ENTRY_KINDS.skill, v2pack!.entries[0]!, { rejectOnCollision: true })
    expect(afterRemove.ok).toBe(true)
    if (afterRemove.ok) expect(afterRemove.entry.content).toBe(V2_CONTENT)
  })

  it('the picker ROW itself disables on the stale copy (the GH #564 visible-not-hidden UX, DOM-level)', async () => {
    await saveSkillPack(snapshotWith(V2_CONTENT, SHA_V2))
    const libraries = importedSkillPackLibrary(await loadSkillPacks())
    const entries: Entry[] = [
      { id: 'deploy-checklist', kind: ENTRY_KINDS.skill, label: 'Deploy Checklist', description: 'How deploys run.', content: V1_CONTENT, order: 0, enabled: true, builtin: false },
    ]
    const handlers: EntryListHandlers = {
      onAdd: () => true,
      onDelete: () => {},
      onToggle: () => {},
      onContentChange: () => {},
    }
    const section = mountEntryList(ENTRY_KINDS.skill, 'Add skill', handlers, { libraries, contentField: false })
    document.body.append(section.host)
    section.render(entries)
    await whenFlushed()
    const row = section.host.querySelector('[data-value="github-com-example-skills:0"]') as HTMLElement
    expect(row.getAttribute('aria-disabled'), 'the stale opted-in copy disables the shelf row — visible staleness').toBe('true')
    expect(row.textContent).toContain('already added')

    // NEGATIVE control: with no opted-in copy the same row is enabled.
    section.render([])
    await whenFlushed()
    const fresh = section.host.querySelector('[data-value="github-com-example-skills:0"]') as HTMLElement
    expect(fresh.getAttribute('aria-disabled')).toBeNull()
    section.host.remove()
  })
})

describe('D5 — the default-off negative assertion in prompt assembly (nothing merely-imported ever composes)', () => {
  const group = (entries: readonly Entry[], enabled = true) => [{ kind: ENTRY_KINDS.skill, heading: 'Skills available to you', entries, enabled }]

  it('a merely-imported pack (on the shelf, never added) contributes ZERO bytes to the live system prompt', () => {
    // The shelf holds the pack; the persona's skill store holds nothing — the composed prompt must not
    // carry one byte of the imported label, description, or content.
    const prompt = composeLiveSystemPrompt([], group([]))
    expect(prompt).not.toContain('Deploy Checklist')
    expect(prompt).not.toContain('How deploys run.')
    expect(prompt).not.toContain('Deploy checklist') // the content's own heading text
  })

  it('an added + enabled entry contributes exactly ONE index line — label + description, NEVER the content (SPEC-R14)', () => {
    const minted = validateNewEntry([], ENTRY_KINDS.skill, importedSkillPackLibrary([snapshotWith(V1_CONTENT, SHA_V1)])[0]!.entries[0]!, { rejectOnCollision: true })
    expect(minted.ok).toBe(true)
    if (!minted.ok) return
    const prompt = composeLiveSystemPrompt([], group([minted.entry]))
    const indexLine = '- Deploy Checklist — How deploys run.'
    expect(prompt).toContain(indexLine)
    expect(prompt.indexOf(indexLine), 'exactly one index line').toBe(prompt.lastIndexOf(indexLine))
    expect(prompt, 'full text never rides ambient — index-line only').not.toContain('Always run the gates')
  })

  it('a DISABLED copy and a master-switched-off kind both compose nothing (the three independent conjuncts)', () => {
    const minted = validateNewEntry([], ENTRY_KINDS.skill, importedSkillPackLibrary([snapshotWith(V1_CONTENT, SHA_V1)])[0]!.entries[0]!, { rejectOnCollision: true })
    if (!minted.ok) return
    expect(composeLiveSystemPrompt([], group([{ ...minted.entry, enabled: false }]))).not.toContain('Deploy Checklist')
    expect(composeLiveSystemPrompt([], group([minted.entry], false))).not.toContain('Deploy Checklist')
  })

  it('full text rides ONLY the invocation framing (resolveTurnReferences) — verbatim, labeled, kind-named', () => {
    const minted = validateNewEntry([], ENTRY_KINDS.skill, importedSkillPackLibrary([snapshotWith(V1_CONTENT, SHA_V1)])[0]!.entries[0]!, { rejectOnCollision: true })
    if (!minted.ok) return
    const groups = [{ kind: ENTRY_KINDS.skill, entries: [minted.entry], enabled: true }]
    const resolved = resolveTurnReferences('run the deploy', [{ id: 'deploy-checklist', label: 'Deploy Checklist', kind: ENTRY_KINDS.skill }], groups)
    expect(resolved.text).toContain('## Referenced for this message')
    expect(resolved.text).toContain('### Deploy Checklist (skill)')
    expect(resolved.text, 'content verbatim on invocation — the load path').toContain('Always run the gates before shipping.')
    expect(resolved.text.endsWith('run the deploy'), 'typed text last').toBe(true)

    // NEGATIVE control: the same invocation against a store that never opted in resolves to the bare text.
    const unresolved = resolveTurnReferences('run the deploy', [{ id: 'deploy-checklist', label: 'Deploy Checklist', kind: ENTRY_KINDS.skill }], group([]))
    expect(unresolved.text, 'fail-closed: never added ⇒ the reference contributes nothing').toBe('run the deploy')
  })
})
