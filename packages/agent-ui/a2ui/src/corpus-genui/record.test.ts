// record.test.ts — LLD-C1 §3.1 (GH #1584), AC1: `validateGenuiRecord` returns `[]` on a well-formed
// record and the listed `E_*` on each defect; `src/corpus-genui/` carries no `node:` import (self-grep).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { validateGenuiRecord, genuiRecordHashes } from './record.ts'
import type { GenuiCorpusRecord } from './record.ts'
import { lintGenuiHtml } from './lint.ts'

declare const process: { cwd(): string }

const HTML = '<!doctype html><body><p>chart</p></body>'
const LINT = lintGenuiHtml(HTML)

function wellFormed(overrides: Partial<GenuiCorpusRecord> = {}): GenuiCorpusRecord {
  return {
    name: 'data-viz-layouts--rev-by-region--r1',
    promptId: 'data-viz-layouts-1',
    promptText: 'Compare monthly revenue across our four regions.',
    packId: 'data-viz-layouts',
    surfaceId: 'q3-revenue',
    html: HTML,
    meta: {
      facet: 'eval',
      status: 'pending',
      promptSetVersion: 1,
      packHash: 'abc123',
      htmlHash: 'def456',
      model: 'claude-sonnet-5',
      dogfood: false,
      generatedAt: '2026-08-22T00:00:00.000Z',
      provenance: { source: 'generated', origin: 'run:2026-08-22T00:00:00Z-abc12' },
      lint: LINT,
      ...(overrides.meta ?? {}),
    },
    ...overrides,
  }
}

function codesOf(failures: { code: string; path: string }[]): string[] {
  return failures.map((f) => f.code)
}

describe('validateGenuiRecord — [] on a well-formed record', () => {
  it('returns [] on a well-formed pending record', () => {
    expect(validateGenuiRecord(wellFormed())).toEqual([])
  })

  it('returns [] on a well-formed judged record (score fields present, status judged)', () => {
    const rec = wellFormed({
      meta: {
        ...wellFormed().meta,
        status: 'judged',
        qualityScore: 5,
        passed: true,
        failingDimensions: [],
        verdictDate: '2026-08-22',
      },
    })
    expect(validateGenuiRecord(rec)).toEqual([])
  })

  it('returns [] on a well-formed control-arm record (packId null, packHash null, model null)', () => {
    const rec = wellFormed({
      name: 'control--data-viz-layouts-1--r1',
      packId: null,
      meta: { ...wellFormed().meta, packHash: null, model: null },
    })
    expect(validateGenuiRecord(rec)).toEqual([])
  })
})

describe('validateGenuiRecord — E_SCHEMA (missing/mistyped name/promptText/html/meta pins)', () => {
  it('a non-object input', () => {
    expect(codesOf(validateGenuiRecord(null))).toEqual(['E_SCHEMA'])
    expect(codesOf(validateGenuiRecord('nope'))).toEqual(['E_SCHEMA'])
  })

  it('missing name', () => {
    const rec = wellFormed() as unknown as Record<string, unknown>
    delete rec.name
    const failures = validateGenuiRecord(rec)
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'name' })
  })

  it('missing promptText', () => {
    const rec = wellFormed() as unknown as Record<string, unknown>
    delete rec.promptText
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_SCHEMA', path: 'promptText' })
  })

  it('empty promptText (D3 floor, LLD §6)', () => {
    expect(validateGenuiRecord(wellFormed({ promptText: '' }))).toContainEqual({ code: 'E_SCHEMA', path: 'promptText' })
  })

  it('missing html', () => {
    const rec = wellFormed() as unknown as Record<string, unknown>
    delete rec.html
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_SCHEMA', path: 'html' })
  })

  it('missing meta entirely', () => {
    const rec = wellFormed() as unknown as Record<string, unknown>
    delete rec.meta
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_SCHEMA', path: 'meta' })
  })

  it('meta.facet outside the closed enum', () => {
    const rec = wellFormed({ meta: { ...wellFormed().meta, facet: 'exemplar' as never } })
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_SCHEMA', path: 'meta.facet' })
  })

  it('meta.promptSetVersion not a number', () => {
    const rec = wellFormed({ meta: { ...wellFormed().meta, promptSetVersion: '1' as unknown as number } })
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_SCHEMA', path: 'meta.promptSetVersion' })
  })

  it('meta.lint missing a field', () => {
    const badLint = { ...LINT } as Partial<typeof LINT>
    delete badLint.externalRefs
    const rec = wellFormed({ meta: { ...wellFormed().meta, lint: badLint as typeof LINT } })
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_SCHEMA', path: 'meta.lint.externalRefs' })
  })

  it('meta.provenance.source outside the closed enum', () => {
    const rec = wellFormed({ meta: { ...wellFormed().meta, provenance: { source: 'authored' as never, origin: 'x' } } })
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_SCHEMA', path: 'meta.provenance.source' })
  })

  it('batches multiple defects in one pass (never short-circuits)', () => {
    const rec = wellFormed() as unknown as Record<string, unknown>
    delete rec.name
    delete rec.promptText
    const failures = validateGenuiRecord(rec)
    expect(failures.length).toBeGreaterThanOrEqual(2)
  })
})

describe('validateGenuiRecord — E_WIRE (the wire\'s own structural gate)', () => {
  it('an over-cap html', () => {
    const rec = wellFormed({ html: 'a'.repeat(524_288 + 1) })
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_WIRE', path: 'html' })
  })

  it('an empty surfaceId', () => {
    const rec = wellFormed({ surfaceId: '' })
    // empty surfaceId is ALSO E_SCHEMA (requireStr) — E_WIRE only fires when both fields typed as strings,
    // so an empty string still reaches the wire round-trip and fails it too.
    const codes = codesOf(validateGenuiRecord(rec))
    expect(codes).toContain('E_SCHEMA')
  })
})

describe('validateGenuiRecord — E_HASH (stored vs fresh recomputation, caller-supplied)', () => {
  it('is not checked at all when no `fresh` argument is supplied', () => {
    const rec = wellFormed({ meta: { ...wellFormed().meta, htmlHash: 'stale' } })
    expect(validateGenuiRecord(rec)).toEqual([])
  })

  it('fires when the stored htmlHash disagrees with the fresh recomputation', async () => {
    const fresh = await genuiRecordHashes(HTML, null)
    const rec = wellFormed({ meta: { ...wellFormed().meta, htmlHash: 'definitely-not-it', packHash: fresh.packHash } })
    expect(validateGenuiRecord(rec, fresh)).toContainEqual({ code: 'E_HASH', path: 'meta.htmlHash' })
  })

  it('agrees (no E_HASH) when the stored hashes match a real recomputation', async () => {
    const fresh = await genuiRecordHashes(HTML, 'pack body text')
    const rec = wellFormed({ meta: { ...wellFormed().meta, htmlHash: fresh.htmlHash, packHash: fresh.packHash } })
    expect(validateGenuiRecord(rec, fresh)).toEqual([])
  })
})

describe('validateGenuiRecord — E_SCORE_ORPHAN (a score-bearing field on a non-judged record)', () => {
  it('fires when qualityScore is present but status is still pending', () => {
    const rec = wellFormed({ meta: { ...wellFormed().meta, qualityScore: 5 } })
    expect(validateGenuiRecord(rec)).toContainEqual({ code: 'E_SCORE_ORPHAN', path: 'meta.qualityScore' })
  })
})

describe('genuiRecordHashes — pure sha-256 over the artifact bytes', () => {
  it('packHash is null for the control arm (packBody null)', async () => {
    const { packHash } = await genuiRecordHashes(HTML, null)
    expect(packHash).toBeNull()
  })

  it('is deterministic: the same input hashes identically twice', async () => {
    const a = await genuiRecordHashes(HTML, 'pack body')
    const b = await genuiRecordHashes(HTML, 'pack body')
    expect(a).toEqual(b)
  })

  it('a different html hashes differently', async () => {
    const a = await genuiRecordHashes(HTML, null)
    const b = await genuiRecordHashes(HTML + '!', null)
    expect(a.htmlHash).not.toBe(b.htmlHash)
  })
})

describe('self-grep — src/corpus-genui/ is pure (no node: import), off every barrel', () => {
  it('none of the three pure-core modules import anything under node:', () => {
    const dir = join(process.cwd(), 'packages/agent-ui/a2ui/src/corpus-genui')
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    expect(files.length).toBeGreaterThanOrEqual(3) // record.ts, verdicts.ts, lint.ts
    for (const file of files) {
      const text = readFileSync(join(dir, file), 'utf8') as string
      const nodeImports = text.match(/from\s+['"]node:[^'"]+['"]/g) ?? []
      expect(nodeImports, `${file} imports node:* — pure-core must stay platform-neutral`).toEqual([])
    }
  })
})
