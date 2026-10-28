// component-merge.test.ts: T-0498 (round 16 cluster M, smoke-negotiator-first-offer-haiku-3, traces :83 and :84).
// One batch resends a mounted footer whose `child` moves from `walk` to a new Row that lists `walk`. The merge used
// to dispose `walk` as dropped, so the valid move read as the dangling `ask_row->walk` on every round.

import { describe, it, expect } from 'vitest'
import type { A2uiComponent } from '../protocol.ts'
import { applyComponentBatch } from './component-merge.ts'
import { validateA2ui } from './validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

const button = (id: string): A2uiComponent => ({ id, component: 'Button', label: id })

// :83 left the ask card with the footer holding `walk` alone.
const ASK: A2uiComponent[] = [
  { id: 'root', component: 'Card', children: ['ask_ct', 'ask_ft'] },
  { id: 'ask_ct', component: 'CardContent', children: ['picker'] },
  { id: 'picker', component: 'Text', text: 'offer' },
  { id: 'ask_ft', component: 'CardFooter', child: 'walk' },
  button('walk'),
]
// :84 moves `walk` under a new Row beside a new `accept`, in one batch.
const MOVE: A2uiComponent[] = [
  { id: 'ask_ft', component: 'CardFooter', child: 'ask_row' },
  { id: 'ask_row', component: 'Row', children: ['accept', 'walk'] },
  button('accept'),
  button('walk'),
]

const seeded = (records: readonly A2uiComponent[]): Map<string, A2uiComponent> => new Map(records.map((c) => [c.id, c]))

describe('T-0498: a child the same batch moves under a new parent survives the merge', () => {
  it('keeps the moved child', () => {
    const byId = seeded(ASK)
    applyComponentBatch(byId, MOVE)
    expect([...byId.keys()].sort()).toEqual(['accept', 'ask_ct', 'ask_ft', 'ask_row', 'picker', 'root', 'walk'])
    expect(byId.get('walk')).toEqual(button('walk'))
  })

  it('the server validator seeded with the :83 graph reports no IDGRAPH for the move', () => {
    const payload = [{ version: 'v1.0', updateComponents: { surfaceId: 'ask-1', components: MOVE } }]
    const seed = new Map([['ask-1', { components: ASK, rootDelivered: true }]])
    const idgraph = validateA2ui(payload, defaultCatalog, seed, { atFinalize: true }).failures.filter((f) => f.code === 'IDGRAPH')
    expect(idgraph).toEqual([])
  })

  it('keeps a grandchild moved out of a dropped container without redelivery', () => {
    const byId = seeded(ASK)
    applyComponentBatch(byId, [
      { id: 'root', component: 'Card', children: ['ask_ct', 'ask_row'] },
      { id: 'ask_row', component: 'Row', children: ['walk'] },
    ])
    expect(byId.has('ask_ft')).toBe(false) // the dropped footer still goes
    expect(byId.get('walk')).toEqual(button('walk')) // its moved child stays
  })

  it('keeps the record of a dropped child the batch redelivers, and still drops an unreferenced one', () => {
    const byId = seeded(ASK)
    applyComponentBatch(byId, [{ id: 'ask_ft', component: 'CardFooter' }, button('walk')])
    expect(byId.get('walk')).toEqual(button('walk'))

    const plain = seeded(ASK)
    applyComponentBatch(plain, [{ id: 'ask_ft', component: 'CardFooter' }])
    expect(plain.has('walk')).toBe(false) // T-0220 unchanged: a dropped child nothing names or redelivers goes
  })
})
