// framed-choice-check.test.ts: T-0258's framed-choice check fires on the recorded Haiku 5.5 hello (a Card per starter
// choice, each a CardFooter around one Button) and on the CardContent and bare forms, and stays quiet on a Row of
// Buttons and a Card with more than one Button. T-0300: a single lone-button Card (the recorded Sonnet 5.5 Omaha
// showdown's Deal again) is LONE_BUTTON_FRAME.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { framedChoiceCheck } from './framed-choice-check.ts'
import { gateChecksOnCatalog, runSemanticChecks, semanticSurfaceViews } from './semantic-check.ts'
import type { SemanticTurnLog } from './semantic-check.ts'
import type { A2uiComponent, A2uiOutput, A2uiServerMessage } from '../protocol.ts'
import { loadCatalog } from './catalog.ts'
import defaultCatalogRaw from './default/catalog.json'
import basicCatalogRaw from './a2ui-basic/catalog.json'

const findings = (components: A2uiComponent[]) =>
  runSemanticChecks([framedChoiceCheck], { surfaces: [{ surfaceId: 'greet-1', components: new Map(components.map((c) => [c.id, c])), dataModel: undefined }] }).findings

const button = (id: string, label: string): A2uiComponent => ({ id, component: 'Button', label, variant: 'soft' })

/** The recorded live Haiku 5.5 "hello" surface (the T-0174 smoke, before T-0257's hand edit). */
const RECORDED: A2uiComponent[] = [
  { id: 'root', component: 'Column', children: ['prompt', 'row'] },
  { id: 'prompt', component: 'Text', text: 'Where would you like to start?' },
  { id: 'row', component: 'Row', wrap: true, children: ['c1', 'c2', 'c3'] },
  { id: 'c1', component: 'Card', children: ['f1'] },
  { id: 'f1', component: 'CardFooter', children: ['b1'] },
  button('b1', 'Book a room'),
  { id: 'c2', component: 'Card', children: ['f2'] },
  { id: 'f2', component: 'CardFooter', children: ['b2'] },
  button('b2', 'Reserve a table'),
  { id: 'c3', component: 'Card', children: ['f3'] },
  { id: 'f3', component: 'CardFooter', children: ['b3'] },
  button('b3', 'Plan a day out'),
]

describe('framedChoiceCheck (T-0258)', () => {
  it('flags the recorded Card per choice once, naming the cards and asking for a Row of Buttons', () => {
    const [f, ...rest] = findings(RECORDED)
    expect(rest).toEqual([])
    expect(f!.code).toBe('FRAMED_CHOICE')
    expect(f!.path).toBe('greet-1:c1')
    expect(f!.message).toContain('(c1, c2, c3)')
    expect(f!.message).toContain('"Book a room"')
    expect(f!.message).toContain('one Row')
  })

  it('flags sibling Cards that hold one Button directly or through a lone CardContent', () => {
    expect(findings([{ id: 'r', component: 'Row', children: ['a', 'b'] }, { id: 'a', component: 'Card', children: ['x'] }, button('x', 'Hit'), { id: 'b', component: 'Card', child: 'cc' }, { id: 'cc', component: 'CardContent', children: ['y'] }, button('y', 'Stand')]).map((f) => f.code)).toEqual(['FRAMED_CHOICE'])
  })

  it('stays quiet on the repaired Row of Buttons and a Card with a header beside its Button', () => {
    expect(findings([{ id: 'row', component: 'Row', children: ['b1', 'b2', 'b3'] }, button('b1', 'Book a room'), button('b2', 'Reserve a table'), button('b3', 'Plan a day out')])).toEqual([])
    expect(findings([{ id: 'row', component: 'Row', children: ['c1', 'c2'] }, { id: 'c1', component: 'Card', children: ['h1', 'b1'] }, { id: 'h1', component: 'CardHeader', children: [] }, button('b1', 'A'), { id: 'c2', component: 'Card', children: ['h2', 'b2'] }, { id: 'h2', component: 'CardHeader', children: [] }, button('b2', 'B')])).toEqual([])
  })

  it('rides every catalog that holds Card and Button', () => {
    expect(gateChecksOnCatalog([framedChoiceCheck], loadCatalog(defaultCatalogRaw))).toEqual([framedChoiceCheck])
    expect(gateChecksOnCatalog([framedChoiceCheck], loadCatalog(basicCatalogRaw))).toEqual([framedChoiceCheck])
  })
})

// T-0300 (live round 6 :234, Sonnet 5.5 Omaha): the showdown turn swapped the table's actions footer down to Deal again
// alone, so actionsCard framed one Button. FRAMED_CHOICE needs two such Cards under one parent and stayed quiet.
describe('LONE_BUTTON_FRAME (T-0300)', () => {
  const fixture = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../../../.sdlc/evals/rounds/2026-10-15-r6-matrix/runs/regress-croupier-omaha-sonnet-1/fixture.json'), 'utf8'),
  ) as { turns: { lines: string[] }[] }
  const wire = (i: number): A2uiOutput => fixture.turns[i]!.lines.filter((l) => !l.includes('"a2uiMeta"')).map((l) => JSON.parse(l) as A2uiServerMessage)
  const session = (upTo: number): SemanticTurnLog => ({
    turns: [...Array(upTo).keys()].map((i) => ({ role: 'assistant', content: wire(i).map((m) => JSON.stringify(m)).join('\n') })),
  })
  const codesAt = (turn: number) => runSemanticChecks([framedChoiceCheck], { surfaces: semanticSurfaceViews(session(turn), wire(turn)) }).findings

  it('the recorded showdown that leaves Deal again alone in actionsCard is LONE_BUTTON_FRAME', () => {
    const found = codesAt(4)
    expect(found.map((f) => `${f.code} ${f.path}`)).toEqual(['LONE_BUTTON_FRAME table-1:actionsCard'])
    expect(found[0]!.message).toContain('"Deal again" (dealBtn)')
    expect(found[0]!.message).toContain('drop actionsCard')
  })

  it('the opening table (three Buttons in the footer) and a Card with a header beside its Button pass', () => {
    expect(codesAt(0)).toEqual([])
    expect(findings([{ id: 'k', component: 'Card', children: ['h', 'b'] }, { id: 'h', component: 'CardHeader', children: [] }, button('b', 'Deal again')])).toEqual([])
  })

  it('a single lone-button Card, directly or through a CardContent, is LONE_BUTTON_FRAME', () => {
    expect(findings([{ id: 'root', component: 'Column', children: ['c1', 't'] }, { id: 'c1', component: 'Card', children: ['b1'] }, button('b1', 'Go'), { id: 't', component: 'Text', text: 'Hi' }]).map((f) => `${f.code} ${f.path}`)).toEqual(['LONE_BUTTON_FRAME greet-1:c1'])
    expect(findings([{ id: 'c', component: 'Card', child: 'cc' }, { id: 'cc', component: 'CardContent', children: ['b'] }, button('b', 'Stand')]).map((f) => f.code)).toEqual(['LONE_BUTTON_FRAME'])
  })

  it('Cards already named by FRAMED_CHOICE are not named again', () => {
    expect(findings(RECORDED).map((f) => f.code)).toEqual(['FRAMED_CHOICE'])
  })
})
