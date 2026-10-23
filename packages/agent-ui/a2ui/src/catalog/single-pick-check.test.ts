// single-pick-check.test.ts: T-0419's single-pick check fires SINGLE_PICK_DECK on an ask surface whose only input is
// one RadioGroup or SegmentedControl of 2 to 8 options, and OPTION_DECK_WRAPPED on an OptionDeck under a Card; it stays
// quiet on a pick inside a form, a canvas surface, a templated list, nine options, the deal-sheet shape and a root
// OptionDeck. It rides only a catalog that holds OptionDeck.

import { describe, expect, it } from 'vitest'
import { singlePickCheck } from './single-pick-check.ts'
import { gateChecksOnCatalog, runSemanticChecks } from './semantic-check.ts'
import type { A2uiComponent } from '../protocol.ts'
import { loadCatalog } from './catalog.ts'
import defaultCatalogRaw from './default/catalog.json'
import basicCatalogRaw from './a2ui-basic/catalog.json'

const findings = (components: A2uiComponent[], surfaceId = 'ask-1') =>
  runSemanticChecks([singlePickCheck], { surfaces: [{ surfaceId, components: new Map(components.map((c) => [c.id, c])), dataModel: undefined }] }).findings

const radios = (n: number): A2uiComponent[] => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, component: 'Radio', value: `v${i}`, label: `Option ${i}` }))
const radioAsk = (n: number, extra: A2uiComponent[] = []): A2uiComponent[] => [
  { id: 'root', component: 'Column', children: ['q', 'pick', ...extra.map((c) => c.id), 'go'] },
  { id: 'q', component: 'Text', text: 'Which one?' },
  { id: 'pick', component: 'RadioGroup', value: { path: '/answer' }, children: radios(n).map((r) => r.id) },
  ...radios(n),
  ...extra,
  { id: 'go', component: 'Button', label: 'Answer', action: { event: { name: 'answer' } } },
]
const deck: A2uiComponent = {
  id: 'deck',
  component: 'OptionDeck',
  heading: 'Which dinner style this week?',
  actionName: 'choose',
  options: [{ value: 'quick', title: 'Quick' }, { value: 'slow', title: 'Slow' }] as never,
}

describe('singlePickCheck (T-0419)', () => {
  it('fires SINGLE_PICK_DECK on a lone RadioGroup of 3 on ask-1, naming the OptionDeck repair', () => {
    const [f, ...rest] = findings(radioAsk(3))
    expect(rest).toEqual([])
    expect(f).toMatchObject({ code: 'SINGLE_PICK_DECK', path: 'ask-1:pick' })
    expect(f!.message).toMatch(/ONE OptionDeck with "actionName":"choose"/)
  })

  it('fires OPTION_DECK_WRAPPED on an OptionDeck under a Card, on any surface', () => {
    const wrapped: A2uiComponent[] = [
      { id: 'root', component: 'Card', children: ['body'] },
      { id: 'body', component: 'CardContent', child: 'deck' },
      deck,
    ]
    const [f, ...rest] = findings(wrapped, 'main')
    expect(rest).toEqual([])
    expect(f).toMatchObject({ code: 'OPTION_DECK_WRAPPED', path: 'main:deck' })
    expect(f!.message).toMatch(/drop root/)
  })

  it('passes a root OptionDeck', () => {
    expect(findings([{ ...deck, id: 'root' }])).toEqual([])
  })

  it('passes a RadioGroup beside a TextField (a form)', () => {
    expect(findings(radioAsk(3, [{ id: 'name', component: 'TextField', value: { path: '/name' } }]))).toEqual([])
  })

  it('passes the same pick on a canvas surface', () => {
    expect(findings(radioAsk(3), 'main')).toEqual([])
  })

  it('passes a templated RadioGroup and a RadioGroup of nine', () => {
    const templated = radioAsk(3).map((c) => (c.id === 'pick' ? { ...c, children: { path: '/opts', componentId: 'r0' } as never } : c))
    expect(findings(templated)).toEqual([])
    expect(findings(radioAsk(9))).toEqual([])
  })

  it('passes the deal-sheet shape (AmountPicker, SegmentedControl and Send)', () => {
    expect(
      findings([
        { id: 'root', component: 'Column', children: ['amt', 'terms', 'send'] },
        { id: 'amt', component: 'AmountPicker', value: { path: '/amount' } },
        { id: 'terms', component: 'SegmentedControl', value: { path: '/terms' }, children: ['s1', 's2', 's3'] },
        { id: 's1', component: 'Segment', value: 'net30', label: 'Net 30' },
        { id: 's2', component: 'Segment', value: 'net60', label: 'Net 60' },
        { id: 's3', component: 'Segment', value: 'net90', label: 'Net 90' },
        { id: 'send', component: 'Button', label: 'Send', action: { event: { name: 'send' } } },
      ]),
    ).toEqual([])
  })

  it('rides the default catalog, which holds OptionDeck, and not a2ui-basic', () => {
    expect(gateChecksOnCatalog([singlePickCheck], loadCatalog(defaultCatalogRaw))).toEqual([singlePickCheck])
    expect(gateChecksOnCatalog([singlePickCheck], loadCatalog(basicCatalogRaw))).toEqual([])
  })
})
