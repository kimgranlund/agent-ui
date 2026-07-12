import { describe, it, expect } from 'vitest'
import { classifyRejections, shouldAbort } from './import-report.ts'
import type { SeedRejection } from './import-report.ts'
import { admit } from './admit.ts'
import type { AdmitDeps, Judge, JudgeVerdict } from './admit.ts'
import { createStore } from './store.ts'
import { createDedupIndex } from './dedup.ts'
import { demoCatalog } from '../fixtures.ts'
import type { A2uiOutput } from '../protocol.ts'

// import-report.test.ts — TKT-0022's E_QUALITY fix: `E_QUALITY` joins `E_DUP`'s own already-established
// non-aborting lane (`import-seeds.ts`'s `alreadyPresent`), so a mixed batch (some pass, one is judged
// below-bar) writes every passer and reports the reject, while a genuine hard-error code (E_SCHEMA etc.)
// still aborts the whole run — unchanged. Two legs: (a) the pure classification/abort decision in
// isolation; (b) the SAME decision driving the real `admit()` pipeline end-to-end (in-memory store, no
// fs) — proving what actually lands in the store, not just how the codes get bucketed.

/** Each candidate gets its OWN surface id + button label baked into its `a2uiOutput` — dedup (`admit.ts`
 *  stage 9) runs on canonical content BEFORE the judge (stage 10), so two candidates sharing identical
 *  output would collide `E_DUP` and never reach the judge at all; distinct content is what makes these
 *  tests actually exercise the E_QUALITY/E_SCHEMA judge-adjacent paths, not dedup. */
function mkOutput(name: string): A2uiOutput {
  return [
    { version: 'v1.0', createSurface: { surfaceId: name, catalogId: 'demo' } },
    { version: 'v1.0', updateComponents: { surfaceId: name, components: [{ id: 'root', component: 'Button', label: `Click me, ${name}` }] } },
  ]
}

function mkCandidate(name: string): unknown {
  return {
    name,
    description: `a sample record named ${name}`,
    promptText: `build me a button for ${name}`,
    a2uiOutput: mkOutput(name),
    meta: {
      facet: 'exemplar',
      protocolVersion: 'v1.0',
      catalogId: 'demo',
      provenance: { source: 'authored', origin: 'test-fixture' },
    },
  }
}

/** A malformed candidate — missing `description` — trips `E_SCHEMA` (ADR-0063's unconditional
 *  requirement), the hard-error family this fix must NOT move into the non-aborting lane. */
function mkBrokenCandidate(name: string): unknown {
  const c = mkCandidate(name) as Record<string, unknown>
  delete c.description
  return c
}

/** A fake tier-2 judge: passes every name in `passing`, rejects everything else with E_QUALITY. */
function fakeJudge(passing: ReadonlySet<string>): Judge {
  return {
    score(record): JudgeVerdict {
      if (passing.has(record.name)) return { qualityScore: 4, passed: true }
      return { qualityScore: 2, passed: false, failingDimensions: ['D5'] }
    },
  }
}

function mkDeps(judge: Judge): AdmitDeps {
  return { catalog: demoCatalog, store: createStore(), dedupIndex: createDedupIndex(), judge }
}

describe('classifyRejections / shouldAbort — the pure batch-abort decision', () => {
  it('a quality-only batch does not abort', () => {
    const rejections: SeedRejection[] = [{ name: 'stats-grid-dashboard', code: 'E_QUALITY', message: 'below the corpus-quality rubric bar', failingDimensions: ['D5'] }]
    const report = classifyRejections(rejections)
    expect(report.qualityRejected).toHaveLength(1)
    expect(report.hardErrors).toHaveLength(0)
    expect(shouldAbort(report)).toBe(false)
  })

  it('a mixed batch (quality + a hard-error code) still aborts — the hard-error family is unchanged', () => {
    const rejections: SeedRejection[] = [
      { name: 'stats-grid-dashboard', code: 'E_QUALITY', message: 'below the corpus-quality rubric bar' },
      { name: 'broken-seed', code: 'E_SCHEMA', message: 'E_SCHEMA: 1 field(s) failed', paths: ['description'] },
    ]
    const report = classifyRejections(rejections)
    expect(report.qualityRejected).toHaveLength(1)
    expect(report.hardErrors).toHaveLength(1)
    expect(report.hardErrors[0]!.code).toBe('E_SCHEMA')
    expect(shouldAbort(report)).toBe(true)
  })

  it('an empty batch does not abort (anti-vacuous: an all-clean run is still a "no abort" verdict)', () => {
    expect(shouldAbort(classifyRejections([]))).toBe(false)
  })
})

describe('the real admit() pipeline through the SAME decision — a mixed batch writes the passes', () => {
  it('pass + E_QUALITY: both land in the in-memory store during the batch, but the decision says do not abort — the CLI writes the batch, quality-rejected record excluded from what would ever be admitted', async () => {
    const deps = mkDeps(fakeJudge(new Set(['good-seed'])))
    const rejections: SeedRejection[] = []

    const goodResult = await admit(mkCandidate('good-seed'), deps)
    expect(goodResult.ok).toBe(true)

    const badResult = await admit(mkCandidate('bad-seed'), deps)
    expect(badResult.ok).toBe(false)
    if (!badResult.ok) rejections.push({ name: 'bad-seed', code: badResult.code, message: badResult.message, failingDimensions: badResult.failingDimensions })

    const report = classifyRejections(rejections)
    expect(shouldAbort(report)).toBe(false) // the CLI's `if (!abort) saveStore(...)` gate would fire
    expect(report.qualityRejected.map((r) => r.name)).toEqual(['bad-seed'])

    // What actually landed in-memory (what `saveStore` would persist, since abort is false): the
    // passer is there, the E_QUALITY reject genuinely never reached `admit()`'s write stage.
    expect(deps.store.get('good-seed')).toBeDefined()
    expect(deps.store.get('bad-seed')).toBeUndefined()
  })

  it('pass + a hard-error code (E_SCHEMA): the decision says ABORT — the negative control proving the hard-error family still blocks the whole run, even though the passer already landed in the in-memory store (the CLI never calls saveStore in this branch, so nothing reaches disk)', async () => {
    const deps = mkDeps(fakeJudge(new Set(['good-seed-2'])))
    const rejections: SeedRejection[] = []

    const goodResult = await admit(mkCandidate('good-seed-2'), deps)
    expect(goodResult.ok).toBe(true)

    const brokenResult = await admit(mkBrokenCandidate('broken-seed'), deps)
    expect(brokenResult.ok).toBe(false)
    if (!brokenResult.ok) rejections.push({ name: 'broken-seed', code: brokenResult.code, message: brokenResult.message, paths: brokenResult.paths })

    const report = classifyRejections(rejections)
    expect(report.hardErrors.map((r) => r.code)).toEqual(['E_SCHEMA'])
    expect(shouldAbort(report)).toBe(true) // the CLI must NOT call saveStore — nothing reaches disk

    // The passer's write already happened in-memory (admit()'s own stage 11, unchanged pre-existing
    // behavior) — `abort:true` is what keeps it from ever reaching `saveStore()`, not a store-level guard.
    expect(deps.store.get('good-seed-2')).toBeDefined()
  })
})
