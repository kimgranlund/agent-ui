// option-deck-check.test.ts: T-0193's option-deck-count check fires on a static deck of fewer than 2 or more than 8
// options and on an option that claims the reserved `random` key, and stays quiet on a deck of 2 to 8, on a bound
// `options` and on any other component. It rides only a catalog that holds OptionDeck.

import { describe, expect, it } from 'vitest'
import { OPTION_DECK_MAX, OPTION_DECK_MIN, optionDeckCountCheck } from './option-deck-check.ts'
import { gateChecksOnCatalog, runSemanticChecks } from './semantic-check.ts'
import type { A2uiComponent } from '../protocol.ts'
import { loadCatalog } from './catalog.ts'
import defaultCatalogRaw from './default/catalog.json'
import basicCatalogRaw from './a2ui-basic/catalog.json'

const findings = (components: A2uiComponent[]) =>
  runSemanticChecks([optionDeckCountCheck], { surfaces: [{ surfaceId: 'greet-1', components: new Map(components.map((c) => [c.id, c])), dataModel: undefined }] }).findings

const options = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `start ${i + 1}`, title: `Option ${i + 1}` }))
const deck = (opts: unknown): A2uiComponent => ({ id: 'deck', component: 'OptionDeck', actionName: 'start', options: opts as never })

describe('optionDeckCountCheck (T-0193)', () => {
  it('passes a deck of 2 to 8 static options', () => {
    for (let n = OPTION_DECK_MIN; n <= OPTION_DECK_MAX; n++) expect(findings([deck(options(n))]), `${n}`).toEqual([])
  })

  it('flags a deck of 0 or 1 option as OPTION_DECK_COUNT, naming the deck and the range', () => {
    for (const n of [0, 1]) {
      const [f, ...rest] = findings([deck(options(n))])
      expect(rest).toEqual([])
      expect(f).toMatchObject({ code: 'OPTION_DECK_COUNT', path: 'greet-1:deck' })
      expect(f!.message).toContain('2 to 8')
    }
  })

  it('flags a deck of 9 options as OPTION_DECK_COUNT, asking to keep 8 or use a Select', () => {
    const [f, ...rest] = findings([deck(options(9))])
    expect(rest).toEqual([])
    expect(f).toMatchObject({ code: 'OPTION_DECK_COUNT', path: 'greet-1:deck' })
    expect(f!.message).toMatch(/9 options/)
    expect(f!.message).toMatch(/Select/)
  })

  it('skips a bound options array and every other component', () => {
    expect(findings([deck({ path: '/deck/options' })])).toEqual([])
    expect(findings([{ id: 'pick', component: 'ChoiceGroup', options: options(12) as never }])).toEqual([])
  })

  it('flags an option that claims the reserved random key as OPTION_DECK_RANDOM_VALUE', () => {
    const [f, ...rest] = findings([deck([...options(2), { value: 'random', title: 'Anything' }])])
    expect(rest).toEqual([])
    expect(f).toMatchObject({ code: 'OPTION_DECK_RANDOM_VALUE', path: 'greet-1:deck' })
    expect(f!.message).toMatch(/allowRandom/)
  })

  it('rides the default catalog, which holds OptionDeck, and not a2ui-basic', () => {
    expect(gateChecksOnCatalog([optionDeckCountCheck], loadCatalog(defaultCatalogRaw))).toEqual([optionDeckCountCheck])
    expect(gateChecksOnCatalog([optionDeckCountCheck], loadCatalog(basicCatalogRaw))).toEqual([])
  })
})
