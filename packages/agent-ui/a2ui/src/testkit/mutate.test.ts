// mutate.test.ts: the seeded mutation operators (tools/testkit/mutate.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { FORM_REPAIR, OPERATORS, SEMANTIC_CODE, mutate, mutateWith } from '../../tools/testkit/mutate.ts'
import { heal } from '../corpus/heal.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const j = (v: unknown): string => JSON.stringify(v)
const LINES = [
  j({ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } }),
  j({ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Column', children: ['a'] }, { id: 'a', component: 'Text', text: 'x' }] } }),
]
const repairsOf = (line: string): string[] => {
  const h = heal(line, { protocolVersion: 'v1.0' })
  return h.ok ? h.repairs.filter((r) => r !== 'single-object-envelope') : ['UNHEALABLE']
}

describe('mutate', () => {
  it('the same seed yields byte-identical mutants on two runs', () => {
    for (const seed of [1, 7, 42, 2026]) expect(mutate(LINES, seed)).toEqual(mutate(LINES, seed))
    for (const op of OPERATORS) expect(mutateWith(LINES, op.name, 9)).toEqual(mutateWith(LINES, op.name, 9))
  })

  it('different seeds reach more than one operator (the choice is not constant)', () => {
    const names = new Set([...Array(32).keys()].map((s) => mutate(LINES, s)?.operator))
    expect(names.size).toBeGreaterThan(1)
  })

  it('every operator is tagged; every form operator has a FORM_REPAIR entry and every semantic one a SEMANTIC_CODE', () => {
    for (const op of OPERATORS) {
      expect(['form', 'semantic']).toContain(op.kind)
      if (op.kind === 'form') expect(FORM_REPAIR[op.name], op.name).toBeDefined()
      else expect(SEMANTIC_CODE[op.name], op.name).toBeDefined()
    }
    expect(Object.keys(FORM_REPAIR).sort()).toEqual(OPERATORS.filter((o) => o.kind === 'form').map((o) => o.name).sort())
    expect(OPERATORS.map((o) => o.name)).not.toContain('single-object-envelope')
  })

  it('control: each form repair name is absent on the unmutated line and present on its mutant', () => {
    for (const op of OPERATORS.filter((o) => o.kind === 'form')) {
      const m = mutateWith(LINES, op.name, 3)!
      expect(repairsOf(LINES[m.index]!), op.name).not.toContain(FORM_REPAIR[op.name])
      expect(repairsOf(m.lines[m.index]!), op.name).toContain(FORM_REPAIR[op.name])
    }
  })

  it('drop-root applies only to a multi-node updateComponents that delivers root', () => {
    const single = [j({ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'x' }] } })]
    expect(mutateWith(single, 'drop-root', 1)).toBeUndefined()
    expect(mutateWith(LINES, 'drop-root', 1)?.index).toBe(1)
  })
})
