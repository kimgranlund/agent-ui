// judge.test.ts: the kit's DOM-free judges (tools/testkit/judge.ts, T-0011). Every leg is a negative
// control: it plants one defect and asserts the judge reds with the intended layer and code, beside the
// clean twin that stays green.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { judgeHeal, judgeTurnLines, judgeVerdict, orderDefects } from '../../tools/testkit/judge.ts'
import type { ScenarioTurn } from '../../tools/testkit/scenario.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import type { A2uiServerMessage } from '../protocol.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const j = (v: unknown): string => JSON.stringify(v)
const create = (sid = 's', catalogId = 'agent-ui') => ({ version: 'v1.0', createSurface: { surfaceId: sid, catalogId } })
const update = (components: unknown[], sid = 's') => ({ version: 'v1.0', updateComponents: { surfaceId: sid, components } })
const text = (id = 'root', t = 'hi') => ({ id, component: 'Text', text: t })
const meta = (a2uiMeta: Record<string, unknown>) => ({ a2uiMeta })
const codes = (fs: { code: string }[]) => fs.map((f) => f.code)

describe('orderDefects', () => {
  it('a meta-line first is clean; a content line before a meta-line yields ORDER_CONTENT_BEFORE_META', () => {
    expect(orderDefects([j(meta({ note: 'n' })), j(create()), j(update([text()]))])).toEqual([])
    const red = orderDefects([j(create()), j(meta({ note: 'late' }))])
    expect(codes(red)).toEqual(['ORDER_CONTENT_BEFORE_META'])
    expect(red[0]!.layer).toBe('producer')
  })

  it('a lone terminal error line after content is the GH #144 contract, not an order defect', () => {
    expect(orderDefects([j(create()), j(meta({ error: 'halted' }))])).toEqual([])
  })

  it('a meta-line target that no content line mutates yields TARGET_NOT_MUTATED', () => {
    expect(orderDefects([j(meta({ note: 'n', target: { surfaceId: 's' } })), j(update([text()]))])).toEqual([])
    expect(codes(orderDefects([j(meta({ note: 'n', target: { surfaceId: 'other' } })), j(update([text()]))]))).toEqual(['TARGET_NOT_MUTATED'])
  })
})

describe('judgeHeal', () => {
  it('an unhealable fence yields HEAL_UNPARSEABLE at its line path and skips the verdict', () => {
    const fenced = '```json\n{"version":"v1.0", createSurface\n```'
    const h = judgeHeal([j(create()), fenced], undefined, '$.turns[0].respond.lines')
    expect(codes(h.findings)).toEqual(['HEAL_UNPARSEABLE'])
    expect(h.findings[0]!.path).toBe('$.turns[0].respond.lines[1]')
    expect(h.findings[0]!.layer).toBe('heal')
    expect(h.skipVerdict).toBe(true)
  })

  it('a fenced, healable line reports fence-strip; single-object-envelope never appears in the union', () => {
    const h = judgeHeal(['```json\n' + j(create()) + '\n```'], { ok: true, repairs: ['fence-strip'] })
    expect(h.findings).toEqual([])
    expect(h.repairs).toEqual(['fence-strip'])
  })

  it('a wrong expect.heal.repairs yields HEAL_MISMATCH', () => {
    const h = judgeHeal(['```json\n' + j(create()) + '\n```'], { ok: true, repairs: ['trailing-comma'] })
    expect(codes(h.findings)).toEqual(['HEAL_MISMATCH'])
  })

  it('an expected-unhealable line passes heal and is handed to the verdict', () => {
    const h = judgeHeal(['{not json'], { ok: false })
    expect(h.findings).toEqual([])
    expect(h.skipVerdict).toBe(false)
    expect(h.unhealable).toEqual(['{not json'])
  })
})

describe('judgeVerdict', () => {
  const msgs = [create(), update([text()])] as unknown as A2uiServerMessage[]

  it('a clean payload has no findings; one extra (code, path) pair in the expectation yields VERDICT_MISMATCH', () => {
    expect(judgeVerdict(msgs, defaultCatalog, { turns: [] }, { catalogId: 'agent-ui' })).toEqual([])
    expect(judgeVerdict(msgs, defaultCatalog, { turns: [] }, { catalogId: 'agent-ui', expect: { valid: true, failures: [] } })).toEqual([])
    const red = judgeVerdict(msgs, defaultCatalog, { turns: [] }, {
      catalogId: 'agent-ui',
      expect: { valid: true, failures: [{ code: 'IDGRAPH', path: 's:root' }] },
    })
    expect(codes(red)).toEqual(['VERDICT_MISMATCH'])
    expect(red[0]!.layer).toBe('validator')
    expect(red[0]!.detail).toContain('missing [IDGRAPH @ s:root]')
  })

  it('a two-turn root resend without createSurface yields native IDGRAPH at s:root, layer validator', () => {
    const t0: ScenarioTurn = { respond: { lines: [j(create()), j(update([text()]))] } }
    const first = judgeTurnLines((t0.respond as { lines: string[] }).lines, {
      turn: t0, catalog: defaultCatalog, catalogId: 'agent-ui', session: { turns: [] }, respondPath: '$.turns[0].respond.lines', turnPath: '$.turns[0]',
    })
    expect(first.findings).toEqual([])
    const t1: ScenarioTurn = { intent: 'again', respond: { lines: [j(update([text('root', 'again')]))] } }
    const second = judgeTurnLines((t1.respond as { lines: string[] }).lines, {
      turn: t1, catalog: defaultCatalog, catalogId: 'agent-ui', session: first.session, respondPath: '$.turns[1].respond.lines', turnPath: '$.turns[1]',
    })
    expect(second.findings).toEqual([{ layer: 'validator', code: 'IDGRAPH', path: 's:root' }])
    // The clean twin: an update-only follow-up that does not resend root validates against the seed.
    const t1ok: ScenarioTurn = { intent: 'again', respond: { lines: [j(update([text('extra', 'x')]))] } }
    const clean = judgeTurnLines((t1ok.respond as { lines: string[] }).lines, {
      turn: t1ok, catalog: defaultCatalog, catalogId: 'agent-ui', session: first.session, respondPath: '$.turns[1].respond.lines', turnPath: '$.turns[1]',
    })
    expect(clean.findings).toEqual([])
  })

  it('an agent-ui Button with label on a2ui-basic yields CATALOG with layer interop', () => {
    const plant = [create('s', 'a2ui-basic'), update([{ id: 'root', component: 'Button', label: 'Go', child: 'x' }, { id: 'x', component: 'Text', text: 'Go' }])] as unknown as A2uiServerMessage[]
    const red = judgeVerdict(plant, a2uiBasicCatalog, { turns: [] }, { catalogId: 'a2ui-basic' })
    expect(red).toContainEqual({ layer: 'interop', code: 'CATALOG', path: 'root.label' })
    expect(red.every((f) => f.layer === 'interop')).toBe(true)
  })

  it('an expected-unhealable raw line reaches the verdict as native PARSE at ""', () => {
    const red = judgeVerdict([], defaultCatalog, { turns: [] }, { catalogId: 'agent-ui', unhealable: ['{not json'] })
    expect(red).toEqual([{ layer: 'validator', code: 'PARSE', path: '' }])
  })
})
