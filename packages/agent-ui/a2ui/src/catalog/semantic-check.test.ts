// semantic-check.test.ts: the generic persona semantic-check hook (ADR-0238, proposed; GH #1795). The view
// builder replays the session the way the renderer does and never writes into the payload it reads; the
// runner is fail-open; and the catalog resolver hands a derived persona id its declared checks and every
// other id none.

import { describe, it, expect } from 'vitest'
import { readPointer, runSemanticChecks, semanticSurfaceViews } from './semantic-check.ts'
import type { SemanticCheck } from './semantic-check.ts'
import type { Session } from '../agent/agent-transport.ts'
import type { A2uiOutput } from '../protocol.ts'
import { semanticChecksForCatalog } from './compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from './personas/manifests.ts'
import { croupierSemanticChecks } from './personas/croupier/checks.ts'

const jsonl = (out: A2uiOutput): string => out.map((m) => JSON.stringify(m)).join('\n')
const assistant = (out: A2uiOutput): Session['turns'][number] => ({ role: 'assistant', content: jsonl(out) })

describe('semanticSurfaceViews: the renderer replay, merged under this round', () => {
  const prior: A2uiOutput = [
    { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } },
    { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'a' }, { id: 'x', component: 'Text', text: 'x' }] } },
    { version: 'v1.0', updateDataModel: { surfaceId: 's', value: { hand: [1, 2], total: 3 } } },
    { version: 'v1.0', createSurface: { surfaceId: 'old', catalogId: 'agent-ui' } },
    { version: 'v1.0', updateComponents: { surfaceId: 'old', components: [{ id: 'root', component: 'Text', text: 'history' }] } },
  ]

  it('merges prior components and data under this round, upserting by id and writing at a pointer', () => {
    const round: A2uiOutput = [
      { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'x', component: 'Text', text: 'x2' }] } },
      { version: 'v1.0', updateDataModel: { surfaceId: 's', path: '/hand/2', value: 9 } },
    ]
    const [view, ...rest] = semanticSurfaceViews({ turns: [{ role: 'user', content: 'hi' }, assistant(prior)] }, round)
    expect(rest).toEqual([]) // `old` was not touched this round: never judged
    expect(view!.surfaceId).toBe('s')
    expect([...view!.components.keys()]).toEqual(['root', 'x'])
    expect(view!.components.get('x')!['text']).toBe('x2')
    expect(view!.dataModel).toEqual({ hand: [1, 2, 9], total: 3 })
  })

  it('a createSurface resets the surface (teardown and rebuild); a deleteSurface drops it from the views', () => {
    const recreate: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } },
      { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'fresh' }] } },
    ]
    const [view] = semanticSurfaceViews({ turns: [assistant(prior)] }, recreate)
    expect([...view!.components.keys()]).toEqual(['root'])
    expect(view!.dataModel).toBeUndefined()
    expect(semanticSurfaceViews({ turns: [assistant(prior)] }, [...recreate, { version: 'v1.0', deleteSurface: { surfaceId: 's' } }])).toEqual([])
  })

  it('root-alias data writes replace the whole model; the payload objects it read are never mutated', () => {
    const value = { hand: [{ rank: 'A' }] }
    const round: A2uiOutput = [
      { version: 'v1.0', updateDataModel: { surfaceId: 's', path: '/', value } },
      { version: 'v1.0', updateDataModel: { surfaceId: 's', path: '/hand/1', value: { rank: 'K' } } },
    ]
    const before = JSON.stringify(round)
    const [view] = semanticSurfaceViews({ turns: [assistant(prior)] }, round)
    expect(view!.dataModel).toEqual({ hand: [{ rank: 'A' }, { rank: 'K' }] })
    expect(JSON.stringify(round)).toBe(before) // the shipped lines are byte-unchanged
  })

  it('tolerates junk in a stored turn (skips, never throws)', () => {
    const session: Session = { turns: [{ role: 'assistant', content: 'not json\n\n' + jsonl(prior) }] }
    expect(semanticSurfaceViews(session, [{ version: 'v1.0', updateDataModel: { surfaceId: 's', path: '/total', value: 4 } }])[0]!.dataModel).toEqual({ hand: [1, 2], total: 4 })
  })

  it('readPointer reads RFC-6901 pointers, the root alias, and misses as undefined', () => {
    const doc = { a: { 'b/c': [10, 20] } }
    expect(readPointer(doc, '/a/b~1c/1')).toBe(20)
    expect(readPointer(doc, '/')).toBe(doc)
    expect(readPointer(doc, '/a/missing/0')).toBeUndefined()
    expect(readPointer(doc, 'relative')).toBeUndefined()
  })
})

describe('runSemanticChecks: findings collected, a throwing check fail-open', () => {
  const finds: SemanticCheck = { id: 'finds', check: () => [{ code: 'X', path: 's:a', message: 'm' }] }
  const throws: SemanticCheck = {
    id: 'throws',
    check: () => {
      throw new Error('bug in a check')
    },
  }
  it('collects every finding and names the check that threw', () => {
    expect(runSemanticChecks([throws, finds], { surfaces: [] })).toEqual({ findings: [{ code: 'X', path: 's:a', message: 'm' }], errored: ['throws'] })
  })
})

describe('semanticChecksForCatalog: the selected catalog id resolves its persona checks', () => {
  it('a derived croupier id, on either base, resolves the croupier checks', () => {
    expect(semanticChecksForCatalog('agent-ui--croupier', SHIPPED_PERSONA_CATALOG_MANIFESTS)).toBe(croupierSemanticChecks)
    expect(semanticChecksForCatalog('a2ui-basic--croupier', SHIPPED_PERSONA_CATALOG_MANIFESTS)).toBe(croupierSemanticChecks)
  })

  it('a base id, a persona that declares none, and an unknown id resolve to no checks', () => {
    for (const id of ['agent-ui', 'a2ui-basic', 'agent-ui--concierge', 'agent-ui--fixture-demo', 'agent-ui--nobody', '']) {
      expect(semanticChecksForCatalog(id, SHIPPED_PERSONA_CATALOG_MANIFESTS), id).toEqual([])
    }
  })
})
