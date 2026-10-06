// seeded-run.test.ts: the red-then-green judge over synthetic fixtures (tools/testkit/seeded.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { runSeeded } from '../../tools/testkit/seeded.ts'
import type { SeededFixture } from '../../tools/testkit/seeded.ts'
import type { KitFinding, Layer } from '../../tools/testkit/findings.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const fixture = (name: string, layer: Layer, code: string, found: KitFinding[]): SeededFixture => ({
  name,
  layer,
  expectRed: { layer, code },
  run: async () => found,
})

describe('runSeeded', () => {
  it('a fixture red with exactly its pinned layer and code passes', async () => {
    expect(await runSeeded([fixture('ok', 'heal', 'HEAL_UNPARSEABLE', [{ layer: 'heal', code: 'HEAL_UNPARSEABLE' }])], ['heal'])).toEqual([])
  })

  it('a green fixture is SEEDED_NOT_RED', async () => {
    const out = await runSeeded([fixture('green', 'validator', 'IDGRAPH', [])], [])
    expect(out.map((f) => `${f.layer}:${f.code}`)).toEqual(['validator:SEEDED_NOT_RED'])
  })

  it('a red fixture with another code is SEEDED_WRONG_CODE', async () => {
    const out = await runSeeded([fixture('wrong-code', 'validator', 'IDGRAPH', [{ layer: 'validator', code: 'SCHEMA' }])], [])
    expect(out.map((f) => f.code)).toEqual(['SEEDED_WRONG_CODE'])
  })

  it('the right code on the wrong layer is SEEDED_WRONG_CODE too', async () => {
    const out = await runSeeded([fixture('wrong-layer', 'interop', 'CATALOG', [{ layer: 'validator', code: 'CATALOG' }])], [])
    expect(out.map((f) => f.code)).toEqual(['SEEDED_WRONG_CODE'])
    expect(out[0]!.detail).toContain('got validator/CATALOG')
  })

  it('only the FIRST finding counts: a later right code does not rescue a wrong first one', async () => {
    const out = await runSeeded([fixture('order', 'heal', 'HEAL_UNPARSEABLE', [{ layer: 'producer', code: 'ORDER_CONTENT_BEFORE_META' }, { layer: 'heal', code: 'HEAL_UNPARSEABLE' }])], [])
    expect(out.map((f) => f.code)).toEqual(['SEEDED_WRONG_CODE'])
  })

  it('a layer with no fixture is SEEDED_LAYER_UNCOVERED', async () => {
    const out = await runSeeded([fixture('ok', 'heal', 'HEAL_UNPARSEABLE', [{ layer: 'heal', code: 'HEAL_UNPARSEABLE' }])], ['heal', 'catalog'])
    expect(out).toEqual([{ layer: 'catalog', code: 'SEEDED_LAYER_UNCOVERED', detail: 'no seeded fixture for layer catalog' }])
  })
})
