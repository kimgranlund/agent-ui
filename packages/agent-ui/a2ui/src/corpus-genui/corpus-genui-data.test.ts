// corpus-genui-data.test.ts — LLD-C6 (GH #1584, genui-b3-judged-eval.lld.md §0/§9 risk 4), the standing
// deterministic gate: keyless by construction (runs in `npm test`, no key, no model, ever).
//
// Re-validates the COMMITTED `corpus-genui/` dir on every `npm test`: every record line parses +
// `validateGenuiRecord`=[] + hashes recompute fresh; every `verdicts/*.json` parses against the CURRENT
// rubric marker and names only existing records; every record carrying a `qualityScore` has an archived
// verdict with IDENTICAL values (the no-fabrication leg, LLD §0's central law) — RED on a planted score
// with no archived verdict (the negative control, run over a temp copy, never the real committed dir);
// `index.json` is byte-identical to a fresh derivation (the `generate-sitemap.mjs` "no generator/gate
// drift pair" precedent — `deriveGenuiCorpusIndex` is imported, never re-implemented here); `prompts.json`
// rules (LLD-C2 n2a); the two fixtures never leak into `records/`/`verdicts/` (n2b); a self-grep proves
// no live-model/key construction anywhere under `tools/corpus-genui/*.test.ts`.
//
// Test-only `node:fs` (the `corpus-data.test.ts`/`admission-coverage.test.ts` precedent) — the pure core
// under `src/corpus-genui/` stays node-free (proven by `record.test.ts`'s own self-grep); this gate, and
// this gate alone, is allowed to read the committed tree directly.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateGenuiRecord, genuiRecordHashes } from './record.ts'
import type { GenuiCorpusRecord } from './record.ts'
import { parseArchivedGenuiVerdictsFile, mergeGenuiVerdictArchive } from './verdicts.ts'
import type { GenuiArchivedVerdict, GenuiArchivedVerdictsSource } from './verdicts.ts'
import { readGenuiLine } from '../agent/genui-line.ts'
import { GENUI_PACKS } from '../agent/prompts/genui-packs.ts'
import { deriveGenuiCorpusIndex } from '../../tools/corpus-genui/legs/report.ts'

declare const process: { cwd(): string }

const ROOT = process.cwd()
const DATA_DIR = join(ROOT, 'packages/agent-ui/a2ui/corpus-genui')
const RUBRIC_PATH = join(ROOT, '.claude/docs/rubrics/genui-pack-idiom.md')
const TOOLS_TEST_DIR = join(ROOT, 'packages/agent-ui/a2ui/tools/corpus-genui')

function listFiles(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) return []
  return (readdirSync(dir) as string[]).filter((f) => f.endsWith(suffix)).sort()
}

function readRubricVersionAt(root: string): string {
  const text = readFileSync(join(root, '.claude/docs/rubrics/genui-pack-idiom.md'), 'utf8') as string
  return text.match(/^version:\s*(\S+)\s*$/m)![1]!
}

interface GateResult {
  recordIssues: string[]
  verdictIssues: string[]
  noFabricationViolations: string[]
}

/** The gate's whole procedure, over ANY repo root (the real committed tree, or a temp copy for the
 *  negative control) — one function, so the negative control proves the SAME code path the real
 *  assertions run, never a re-implementation that could silently drift from what actually gates. */
async function runGate(repoRoot: string): Promise<GateResult> {
  const dataDir = join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui')
  const rubricVersion = readRubricVersionAt(repoRoot)

  const recordIssues: string[] = []
  const records: GenuiCorpusRecord[] = []
  const recordsDir = join(dataDir, 'records/v1')
  for (const file of listFiles(recordsDir, '.jsonl')) {
    const text = readFileSync(join(recordsDir, file), 'utf8') as string
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      let rec: GenuiCorpusRecord
      try {
        rec = JSON.parse(line) as GenuiCorpusRecord
      } catch {
        recordIssues.push(`${file}: unparseable line`)
        continue
      }
      const packBody = rec.packId === null ? null : (GENUI_PACKS.find((p) => p.id === rec.packId)?.body ?? null)
      const fresh = await genuiRecordHashes(rec.html, packBody)
      const failures = validateGenuiRecord(rec, fresh)
      if (failures.length > 0) recordIssues.push(`${file}: ${rec.name ?? '(unnamed)'}: ${failures.map((f) => f.code).join(', ')}`)
      records.push(rec)
    }
  }

  const verdictIssues: string[] = []
  const sources: GenuiArchivedVerdictsSource[] = []
  const verdictsDir = join(dataDir, 'verdicts')
  const recordNames = new Set(records.map((r) => r.name))
  for (const file of listFiles(verdictsDir, '.json')) {
    const text = readFileSync(join(verdictsDir, file), 'utf8') as string
    const parsed = parseArchivedGenuiVerdictsFile(text)
    if (!parsed.ok) {
      for (const issue of parsed.issues) verdictIssues.push(`${file}: ${issue.path || '(root)'}: ${issue.message}`)
      continue
    }
    if (parsed.file.rubricVersion !== rubricVersion) {
      verdictIssues.push(`${file}: rubricVersion "${parsed.file.rubricVersion}" != current marker "${rubricVersion}" (an archived file cites its OWN version — fine historically, but every name in it must still resolve)`)
    }
    for (const name of Object.keys(parsed.file.verdicts)) {
      if (!recordNames.has(name)) verdictIssues.push(`${file}: names unknown record "${name}"`)
    }
    sources.push({ sourceFile: file, file: parsed.file })
  }

  let archive = new Map<string, GenuiArchivedVerdict>()
  const merged = mergeGenuiVerdictArchive(sources)
  if (!merged.ok) {
    for (const c of merged.conflicts) verdictIssues.push(c.message)
  } else {
    archive = merged.archive
  }

  const noFabricationViolations: string[] = []
  for (const rec of records) {
    if (rec.meta.qualityScore === undefined) continue
    const archived = archive.get(rec.name)
    if (archived === undefined) {
      noFabricationViolations.push(`${rec.name}: meta.qualityScore=${rec.meta.qualityScore} present but NO archived verdict backs it`)
      continue
    }
    if (archived.qualityScore !== rec.meta.qualityScore || archived.passed !== rec.meta.passed) {
      noFabricationViolations.push(`${rec.name}: record (score=${rec.meta.qualityScore}, passed=${rec.meta.passed}) != archive (score=${archived.qualityScore}, passed=${archived.passed})`)
    }
  }

  return { recordIssues, verdictIssues, noFabricationViolations }
}

describe('corpus-genui-data — the committed shard/archive is self-consistent (LLD-C6)', () => {
  it('every committed record validates + hash pins recompute fresh; every verdicts file parses against the CURRENT marker and names only existing records', async () => {
    const result = await runGate(ROOT)
    expect(result.recordIssues).toEqual([])
    expect(result.verdictIssues).toEqual([])
  })

  it('the no-fabrication law holds on the committed tree — every scored record has a matching archived verdict', async () => {
    const result = await runGate(ROOT)
    expect(result.noFabricationViolations).toEqual([])
  })
})

describe('corpus-genui-data — NEGATIVE CONTROL: a planted score with no archived verdict REDS the gate (over a temp copy)', () => {
  it('never touches the real committed dir — only a throwaway copy', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'corpus-genui-negative-'))
    try {
      mkdirSync(join(tmp, '.claude/docs/rubrics'), { recursive: true })
      writeFileSync(join(tmp, '.claude/docs/rubrics/genui-pack-idiom.md'), readFileSync(RUBRIC_PATH))
      const dataDir = join(tmp, 'packages/agent-ui/a2ui/corpus-genui/records/v1')
      mkdirSync(dataDir, { recursive: true })
      const fakeRecord = {
        name: 'data-viz-layouts--fake--planted',
        promptId: 'data-viz-layouts-1',
        promptText: 'Compare monthly revenue across our four regions, and call out the top performer.',
        packId: 'data-viz-layouts',
        surfaceId: 'q3',
        html: '<p>fake</p>',
        meta: {
          facet: 'eval',
          status: 'judged',
          promptSetVersion: 1,
          packHash: null,
          htmlHash: 'whatever',
          model: 'claude-sonnet-5',
          dogfood: false,
          generatedAt: '2026-08-22T00:00:00.000Z',
          provenance: { source: 'generated', origin: 'run:test' },
          lint: { byteLength: 10, externalRefs: 0, tokenRefs: 0, scriptBlocks: 0, hasDoctype: false },
          qualityScore: 5, // <-- planted: no archived verdict anywhere backs this
          passed: true,
        },
      }
      writeFileSync(join(dataDir, 'data-viz-layouts.jsonl'), `${JSON.stringify(fakeRecord)}\n`)
      // NO verdicts/ dir at all — the archive is empty.

      const result = await runGate(tmp)
      expect(result.noFabricationViolations.length).toBeGreaterThan(0)
      expect(result.noFabricationViolations[0]).toMatch(/planted/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('corpus-genui-data — index.json is byte-identical to a fresh derivation', () => {
  it('re-deriving with the COMMITTED generatedAt held constant matches byte-for-byte (only the wall-clock stamp is caller-supplied)', () => {
    const committedText = readFileSync(join(DATA_DIR, 'index.json'), 'utf8') as string
    const committed = JSON.parse(committedText) as { generatedAt: string }
    const fresh = deriveGenuiCorpusIndex(ROOT, { now: () => committed.generatedAt })
    const freshText = `${JSON.stringify(fresh, null, 2)}\n`
    expect(freshText).toBe(committedText)
  })

  it('every judged record in the committed index.json carries a matching qualityScore/passed pair; no non-judged record carries a score (no-fabrication, index-level; the literal-empty check retired at AC18 landing, LLD §8)', () => {
    const committed = JSON.parse(readFileSync(join(DATA_DIR, 'index.json'), 'utf8') as string) as {
      records: { name: string; status: string; packId: string | null; qualityScore?: number; passed?: boolean }[]
      m3: { judged: number } | null
    }
    for (const r of committed.records) {
      if (r.status === 'judged') {
        expect(r.qualityScore, `${r.name}: judged record missing qualityScore`).toBeTypeOf('number')
        expect(r.passed, `${r.name}: judged record missing passed`).toBeTypeOf('boolean')
        expect(r.passed, `${r.name}: passed must equal qualityScore >= 4`).toBe((r.qualityScore as number) >= 4)
      } else {
        expect(r.qualityScore, `${r.name}: non-judged record must not carry a score`).toBeUndefined()
        expect(r.passed, `${r.name}: non-judged record must not carry passed`).toBeUndefined()
      }
    }
    // LLD §5: m3 is null until >= 1 judged pack-conditioned record exists; holds vacuously true when
    // the corpus is still empty, and exactly when it is not once AC18 lands real records.
    const judgedPackConditioned = committed.records.filter((r) => r.status === 'judged' && r.packId !== null)
    expect(committed.m3 === null).toBe(judgedPackConditioned.length === 0)
  })
})

describe('corpus-genui-data — prompts.json rules (LLD-C2 n2a)', () => {
  const promptSet = JSON.parse(readFileSync(join(DATA_DIR, 'prompts.json'), 'utf8') as string) as {
    promptSetVersion: number
    prompts: { id: string; packId: string; promptText: string }[]
  }

  it('version 2, 12 prompts (4 per pack x 3 packs)', () => {
    expect(promptSet.promptSetVersion).toBe(2)
    expect(promptSet.prompts).toHaveLength(12)
  })

  it('every packId ∈ GENUI_PACKS ids', () => {
    const ids = new Set(GENUI_PACKS.map((p) => p.id))
    expect(ids.size).toBeGreaterThan(0) // anti-vacuous
    for (const p of promptSet.prompts) expect(ids.has(p.packId), p.id).toBe(true)
  })

  it('every promptText is non-empty and NEVER names its paired pack\'s id or label (grep-asserted)', () => {
    for (const p of promptSet.prompts) {
      expect(p.promptText.length, p.id).toBeGreaterThan(0)
      const pack = GENUI_PACKS.find((g) => g.id === p.packId)!
      expect(p.promptText.toLowerCase(), `${p.id} leaks its pack's id`).not.toContain(pack.id.toLowerCase())
      expect(p.promptText.toLowerCase(), `${p.id} leaks its pack's label`).not.toContain(pack.label.toLowerCase())
    }
  })

  it('ids are unique', () => {
    const ids = promptSet.prompts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('corpus-genui-data — the two fixtures are calibration-only (LLD-C2 n2b)', () => {
  const fixtureFiles = listFiles(join(DATA_DIR, 'fixtures'), '.genui.json')

  it('exactly two fixtures exist and each validates as a bare genui envelope', () => {
    expect(fixtureFiles).toHaveLength(2)
    for (const f of fixtureFiles) {
      const text = readFileSync(join(DATA_DIR, 'fixtures', f), 'utf8') as string
      const parsed = JSON.parse(text) as { genui: { surfaceId: string; html: string } }
      expect(readGenuiLine(JSON.stringify(parsed)), f).toBeDefined()
    }
  })

  it('no fixture\'s html (by htmlHash) appears in any committed record, and no verdict file names a fixture id', async () => {
    const fixtureHashes = new Set<string>()
    for (const f of fixtureFiles) {
      const text = readFileSync(join(DATA_DIR, 'fixtures', f), 'utf8') as string
      const parsed = JSON.parse(text) as { genui: { html: string } }
      const { htmlHash } = await genuiRecordHashes(parsed.genui.html, null)
      fixtureHashes.add(htmlHash)
    }
    const recordsDir = join(DATA_DIR, 'records/v1')
    for (const file of listFiles(recordsDir, '.jsonl')) {
      const text = readFileSync(join(recordsDir, file), 'utf8') as string
      for (const line of text.split('\n')) {
        if (line.trim() === '') continue
        const rec = JSON.parse(line) as GenuiCorpusRecord
        expect(fixtureHashes.has(rec.meta.htmlHash), rec.name).toBe(false)
      }
    }
  })
})

describe('corpus-genui-data — records/ and verdicts/ integrity (LLD §0; the literal-empty check retired at AC18 landing, LLD §8)', () => {
  it('no verdicts file is a byte-identical duplicate of another (guards the apply-leg re-archive-under-a-new-name class of bug)', () => {
    const verdictsDir = join(DATA_DIR, 'verdicts')
    const seen = new Map<string, string>()
    for (const f of listFiles(verdictsDir, '.json')) {
      const text = readFileSync(join(verdictsDir, f), 'utf8') as string
      const dup = seen.get(text)
      expect(dup, `${f} is a byte-identical duplicate of ${String(dup)}`).toBeUndefined()
      seen.set(text, f)
    }
  })

  it('every records/*.jsonl file present, if any, holds at least one non-empty line', () => {
    const recordsDir = join(DATA_DIR, 'records/v1')
    for (const f of listFiles(recordsDir, '.jsonl')) {
      const text = readFileSync(join(recordsDir, f), 'utf8') as string
      const lines = text.split('\n').filter((l) => l.trim() !== '')
      expect(lines.length, `${f} is empty`).toBeGreaterThan(0)
    }
  })
})

describe('corpus-genui-data — self-grep: no live-model/key construction in any tools/corpus-genui test', () => {
  it('no *.test.ts under tools/corpus-genui/ ever constructs the real anthropicProvider adapter', () => {
    const files = (readdirSync(TOOLS_TEST_DIR) as string[]).filter((f) => f.endsWith('.test.ts'))
    expect(files.length).toBeGreaterThan(0) // anti-vacuous
    for (const file of files) {
      const text = readFileSync(join(TOOLS_TEST_DIR, file), 'utf8') as string
      expect(text, file).not.toMatch(/anthropicProvider\s*\(/)
      expect(text, file).not.toMatch(/api\.anthropic\.com/)
    }
  })
})
