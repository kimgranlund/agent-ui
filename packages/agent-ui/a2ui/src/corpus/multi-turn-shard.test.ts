// multi-turn-shard.test.ts: the GH #1741 acceptance legs for the committed `multi-turn` shard
// (`corpus/multi-turn/v1_0/agent-ui.jsonl`, ADR-0231 cl.2). `corpus-data.test.ts` already holds every
// committed line to `checkTier1` + the identity hash; this file pins the facts that make a multi-turn
// record a CONVERSATION step rather than a second exemplar:
//
// 1. the shard is real (at least the two ruled seeds, form submit and list item select);
// 2. each follow-up validates clean ONLY under the prior-derived session seed (`priorSurfaceSeeds`):
//    standalone it is a fragment with no root, so the validator reports IDGRAPH `<surfaceId>:root-missing`;
// 3. each record's action grounding passes, and a mutated `sourceComponentId` rejects E_IDGRAPH;
// 4. no turn deletes the surface (a delete-then-recreate follow-up waits for GH #1750).
//
// Test-only `node:fs` (the `corpus-data.test.ts` precedent): reads the committed shard text directly.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { validateA2ui } from './validate.ts'
import { checkTier1, priorSurfaceSeeds } from './admit.ts'
import type { CorpusRecord } from './record.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { allMultiTurnSeeds } from '../examples/index.ts'

declare const process: { cwd(): string }

const SHARD = `${process.cwd()}/packages/agent-ui/a2ui/corpus/multi-turn/v1_0/agent-ui.jsonl`

function shardRecords(): CorpusRecord[] {
  if (!existsSync(SHARD)) return []
  return (readFileSync(SHARD, 'utf8') as string)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as CorpusRecord)
}

const RECORDS = shardRecords()

/** The surface ids a stream touches, in first-seen order. */
function surfaceIds(stream: readonly Record<string, unknown>[]): string[] {
  const ids: string[] = []
  for (const msg of stream) {
    for (const [key, body] of Object.entries(msg)) {
      if (key === 'version') continue
      const sid = (body as { surfaceId?: string }).surfaceId
      if (sid !== undefined && !ids.includes(sid)) ids.push(sid)
    }
  }
  return ids
}

describe('multi-turn shard (GH #1741): the committed conversation steps', () => {
  it('holds at least two lines, one per ruled seed shape (form submit, list item select)', () => {
    expect(RECORDS.length).toBeGreaterThanOrEqual(2)
    const names = RECORDS.map((r) => r.name)
    for (const seed of allMultiTurnSeeds) expect(names).toContain(seed.name)
  })

  for (const rec of RECORDS) {
    describe(rec.name, () => {
      const prior = rec.priorOutput ?? []
      const followUp = rec.a2uiOutput ?? []

      it('the follow-up validates clean under the prior-derived session seed', () => {
        expect(validateA2ui(followUp, defaultCatalog, priorSurfaceSeeds(prior), { atFinalize: true })).toEqual({
          valid: true,
          failures: [],
        })
      })

      it('standalone, the same follow-up fails IDGRAPH <surfaceId>:root-missing (it is a fragment, not a surface)', () => {
        const standalone = validateA2ui(followUp, defaultCatalog, undefined, { atFinalize: true })
        expect(standalone.valid).toBe(false)
        const sids = surfaceIds(followUp as unknown as Record<string, unknown>[])
        expect(sids.length).toBeGreaterThan(0)
        for (const sid of sids) {
          expect(standalone.failures).toContainEqual(expect.objectContaining({ code: 'IDGRAPH', path: `${sid}:root-missing` }))
        }
      })

      it('passes tier-1, which includes the action grounding check', () => {
        expect(checkTier1(rec, defaultCatalog)).toBeNull()
      })

      it('a mutated sourceComponentId rejects E_IDGRAPH (the grounding check bites)', () => {
        const action = rec.clientInput![0]!.action
        const mutated: CorpusRecord = {
          ...rec,
          clientInput: [{ ...rec.clientInput![0]!, action: { ...action, sourceComponentId: `${action.sourceComponentId}_gone` } }],
        }
        const rejection = checkTier1(mutated, defaultCatalog)
        expect(rejection).toMatchObject({ ok: false, code: 'E_IDGRAPH' })
      })

      it('neither turn deletes the surface', () => {
        for (const msg of [...prior, ...followUp]) expect(msg).not.toHaveProperty('deleteSurface')
      })
    })
  }
})
