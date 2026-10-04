// multi-turn-shard.test.ts: the GH #1741 acceptance legs for the committed `multi-turn` shard
// (`corpus/multi-turn/v1_0/agent-ui.jsonl`, ADR-0231 cl.2). `corpus-data.test.ts` already holds every
// committed line to `checkTier1` + the identity hash; this file pins the facts that make a multi-turn
// record a CONVERSATION step rather than a second exemplar:
//
// 1. the shard is real (at least the two ruled seeds, form submit and list item select), and each line
//    carries its shape marker (a `submit:true` Button; a `{path, componentId}` children template);
// 2. each follow-up validates clean ONLY under the prior-derived session seed (`priorSurfaceSeeds`):
//    standalone it is a fragment with no root, so the validator reports IDGRAPH `<surfaceId>:root-missing`;
// 3. each record's action grounding passes, and a mutated `sourceComponentId` rejects E_IDGRAPH at that path;
// 4. no turn deletes the surface: both ruled seeds update in place, which is GH #1741's scope (admission
//    has handled a delete-then-recreate follow-up per epoch since GH #1750; such a seed is a later wave's).
//
// Test-only `node:fs` (the `corpus-data.test.ts` precedent): reads the committed shard text directly.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { validateA2ui } from './validate.ts'
import { checkTier1, priorSurfaceSeeds } from './admit.ts'
import type { CorpusRecord } from './record.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import type { Catalog } from '../catalog/catalog.ts'
import type { SeedCatalogId } from '../examples/types.ts'
import { allMultiTurnSeeds, orderListSelectSeed, rsvpFormSubmitSeed } from '../examples/index.ts'

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

// The `corpus-data.test.ts` resolver: each record is checked against ITS OWN catalog, never a hardcoded one.
const CATALOGS: Readonly<Record<SeedCatalogId, Catalog>> = { 'agent-ui': defaultCatalog, 'a2ui-basic': a2uiBasicCatalog }
function catalogFor(catalogId: string): Catalog {
  if (!Object.hasOwn(CATALOGS, catalogId)) {
    throw new Error(`unregistered catalogId "${catalogId}" (registered: ${Object.keys(CATALOGS).join(', ')})`)
  }
  return CATALOGS[catalogId as SeedCatalogId]
}

type Comp = { id: string; component: string; [prop: string]: unknown }

/** Every component an `updateComponents` message in the stream carries. */
function components(stream: readonly Record<string, unknown>[]): Comp[] {
  const out: Comp[] = []
  for (const msg of stream) {
    const body = msg['updateComponents'] as { components?: Comp[] } | undefined
    if (body?.components) out.push(...body.components)
  }
  return out
}

function recordNamed(name: string): CorpusRecord {
  const rec = RECORDS.find((r) => r.name === name)
  if (!rec) throw new Error(`shard has no line named "${name}"`)
  return rec
}

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

  it('the form-submit line carries its shape marker: the acted-on Button is a submit:true action', () => {
    const rec = recordNamed(rsvpFormSubmitSeed.name)
    const source = rec.clientInput![0]!.action.sourceComponentId
    const button = components((rec.priorOutput ?? []) as unknown as Record<string, unknown>[]).find((c) => c.id === source)
    expect(button).toMatchObject({ component: 'Button', action: { submit: true } })
  })

  it('the list-select line carries its shape marker: a {path, componentId} children template over the acted-on row', () => {
    const rec = recordNamed(orderListSelectSeed.name)
    const source = rec.clientInput![0]!.action.sourceComponentId
    const templated = components((rec.priorOutput ?? []) as unknown as Record<string, unknown>[]).filter((c) => {
      const children = c['children'] as { path?: unknown; componentId?: unknown } | undefined
      return children !== undefined && !Array.isArray(children) && typeof children.path === 'string' && children.componentId === source
    })
    expect(templated.length).toBe(1)
  })

  for (const rec of RECORDS) {
    describe(rec.name, () => {
      const prior = rec.priorOutput ?? []
      const followUp = rec.a2uiOutput ?? []
      const catalog = catalogFor(rec.meta.catalogId)

      it('the follow-up validates clean under the prior-derived session seed', () => {
        expect(validateA2ui(followUp, catalog, priorSurfaceSeeds(prior), { atFinalize: true })).toEqual({
          valid: true,
          failures: [],
        })
      })

      it('standalone, the same follow-up fails IDGRAPH <surfaceId>:root-missing (it is a fragment, not a surface)', () => {
        const standalone = validateA2ui(followUp, catalog, undefined, { atFinalize: true })
        expect(standalone.valid).toBe(false)
        const sids = surfaceIds(followUp as unknown as Record<string, unknown>[])
        expect(sids.length).toBeGreaterThan(0)
        for (const sid of sids) {
          expect(standalone.failures).toContainEqual(expect.objectContaining({ code: 'IDGRAPH', path: `${sid}:root-missing` }))
        }
      })

      it('passes tier-1, which includes the action grounding check', () => {
        expect(checkTier1(rec, catalog)).toBeNull()
      })

      it('a mutated sourceComponentId rejects E_IDGRAPH (the grounding check bites)', () => {
        const action = rec.clientInput![0]!.action
        const mutated: CorpusRecord = {
          ...rec,
          clientInput: [{ ...rec.clientInput![0]!, action: { ...action, sourceComponentId: `${action.sourceComponentId}_gone` } }],
        }
        const rejection = checkTier1(mutated, catalog)
        expect(rejection).toMatchObject({ ok: false, code: 'E_IDGRAPH', paths: ['clientInput[0].action.sourceComponentId'] })
      })

      it('neither turn deletes the surface', () => {
        for (const msg of [...prior, ...followUp]) expect(msg).not.toHaveProperty('deleteSurface')
      })
    })
  }
})
