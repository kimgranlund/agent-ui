// surface-seeds.test.ts: T-0220. The cross-turn seed must hold the graph the renderer holds. A resent
// container that drops a child makes the renderer dispose that child's subtree (tree.ts `#reconcileChildren`,
// RSR-C7), so a later turn that lists the child again without redelivering it dangles in the renderer. The
// seed (and the semantic surface views, the same replay) used to keep the dropped record, so the server
// passed the update and the renderer rejected it (the five-card-draw `acts->bBet` trace).

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { sessionSurfaceSeeds } from './surface-seeds.ts'
import type { Session } from './agent-transport.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { semanticSurfaceViews } from '../catalog/semantic-check.ts'
import type { A2uiOutput } from '../protocol.ts'

await createRenderer().preload('agent-ui')

const text = (id: string): { id: string; component: string; text: string } => ({ id, component: 'Text', text: id })
const jsonl = (out: A2uiOutput): string => out.map((m) => JSON.stringify(m)).join('\n')

// Turn 1 deals: the betting row holds Check, Bet, Fold.
const DEAL: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 's',
      components: [
        { id: 'root', component: 'Column', children: ['hud', 'acts'] },
        text('hud'),
        { id: 'acts', component: 'Row', children: ['bCheck', 'bBet', 'bFold'] },
        text('bCheck'),
        text('bBet'),
        text('bFold'),
      ],
    },
  },
]
// Turn 2 moves to the draw: the row now holds Draw, Fold, so the renderer disposes Check and Bet.
const DRAW: A2uiOutput = [
  { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'acts', component: 'Row', children: ['bDraw', 'bFold'] }, text('bDraw')] } },
]
// Turn 3 lists Check and Bet again without redelivering them: dangling in the renderer.
const FINAL_BET_DANGLING: A2uiOutput = [
  { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'acts', component: 'Row', children: ['bCheck', 'bBet', 'bFold'] }] } },
]
// The repaired turn 3 redelivers them.
const FINAL_BET_REDELIVERED: A2uiOutput = [
  {
    version: 'v1.0',
    updateComponents: { surfaceId: 's', components: [{ id: 'acts', component: 'Row', children: ['bCheck', 'bBet', 'bFold'] }, text('bCheck'), text('bBet')] },
  },
]

const session: Session = {
  turns: [
    { role: 'user', content: 'deal' },
    { role: 'assistant', content: jsonl(DEAL) },
    { role: 'user', content: 'check' },
    { role: 'assistant', content: jsonl(DRAW) },
  ],
}

/** The id-graph errors the real renderer sends for `payload` mounted on the DEAL and DRAW state. */
function rendererIdGraphErrors(payload: A2uiOutput): string[] {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer()
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  for (const turn of [DEAL, DRAW, payload]) {
    for (const msg of turn) r.ingest(JSON.stringify(msg))
    r.finalize('s')
  }
  r.dispose()
  mount.remove()
  return sent.flatMap((m) => ('error' in m && m.error.message.startsWith('id-graph violation') ? [m.error.message] : [])).sort()
}

const serverIdGraphPaths = (payload: A2uiOutput): string[] =>
  validateA2ui(payload, defaultCatalog, sessionSurfaceSeeds(session), { atFinalize: true })
    .failures.filter((f) => f.code === 'IDGRAPH')
    .map((f) => f.path)
    .sort()

describe('T-0220: the server judges the graph the renderer holds after a resend drops children', () => {
  it('the seed drops the children a resent container no longer lists', () => {
    const ids = sessionSurfaceSeeds(session).get('s')!.components.map((c) => c.id)
    expect(ids).toContain('bDraw')
    expect(ids).toContain('bFold')
    expect(ids).not.toContain('bCheck')
    expect(ids).not.toContain('bBet')
  })

  it('an update listing a dropped child without redelivering it fails on the server, as the renderer rejects it', () => {
    expect(serverIdGraphPaths(FINAL_BET_DANGLING)).toEqual(['acts->bBet', 'acts->bCheck'])
    expect(rendererIdGraphErrors(FINAL_BET_DANGLING)).toEqual(['id-graph violation: acts->bBet (at acts->bBet)', 'id-graph violation: acts->bCheck (at acts->bCheck)'])
  })

  it('the redelivered update passes on the server and mounts with no id-graph error', () => {
    expect(serverIdGraphPaths(FINAL_BET_REDELIVERED)).toEqual([])
    expect(rendererIdGraphErrors(FINAL_BET_REDELIVERED)).toEqual([])
  })

  it('the semantic surface views replay the same disposal', () => {
    const [view] = semanticSurfaceViews(session, FINAL_BET_DANGLING)
    // DRAW disposed Check and Bet; this round's resend disposes Draw in turn.
    expect([...view!.components.keys()].sort()).toEqual(['acts', 'bFold', 'hud', 'root'])
  })
})
