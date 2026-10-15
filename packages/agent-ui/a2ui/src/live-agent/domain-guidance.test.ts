// domain-guidance.test.ts: T-0207 (catalog architecture CA-R4). A catalog selects domains (its `+` tail, or its
// persona fragment's domain); selection guidance and mini-skills for a domain it does not select stay out of its
// prompt. Default-homed domain rows are exempt until W2, so no shipped inventory line moves (the
// prompt-equivalence baseline holds that).

import { describe, it, expect } from 'vitest'
import { isUnselectedDomainType, selectedDomains } from '../catalog/layers.ts'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from '../agent/mini-skills.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOGS } from '../catalog/personas/index.ts'

const INTENT = 'deal me a round of blackjack'
const croupier = SHIPPED_PERSONA_CATALOGS.find((p) => p.personaId === 'croupier')!
const croupierCatalog = composeCatalog(defaultCatalog, croupier.fragment, croupier.personaId)

/** The prompt a turn on `catalog` composes for `INTENT`: its own mini-skill selection, no exemplars. */
const promptFor = (catalog: typeof defaultCatalog): string =>
  buildSystemPrompt(catalog, [], undefined, selectMiniSkills(INTENT, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, catalog.catalogId))

describe('T-0207: selected domains', () => {
  it('a base id selects none; a persona catalog selects its fragment domain; a domain id selects its tail', () => {
    expect(selectedDomains('agent-ui')).toEqual([])
    expect(selectedDomains('agent-ui--croupier')).toContain('games')
    expect(selectedDomains('agent-ui--concierge')).toContain('hospitality')
    expect(selectedDomains('agent-ui--stylist')).not.toContain('games')
    expect([...selectedDomains('agent-ui--design+games')].sort()).toEqual(['design', 'games'])
  })

  it('a fragment-homed domain type is unselected unless its domain is; default-homed rows wait for W2', () => {
    expect(isUnselectedDomainType('CardTable', [])).toBe(true)
    expect(isUnselectedDomainType('CardTable', ['design'])).toBe(true)
    expect(isUnselectedDomainType('CardTable', ['games'])).toBe(false)
    expect(isUnselectedDomainType('GameHud', []), 'homed in default until W2').toBe(false)
    expect(isUnselectedDomainType('Card', [])).toBe(false)
  })
})

describe('T-0207: a domain-free agent is never taught a croupier-only type', () => {
  it('the plain agent-ui prompt for a blackjack intent carries no croupier row, clause or table teaching', () => {
    const text = promptFor(defaultCatalog)
    expect(text).not.toMatch(/^- (CardTable|PlayingCard) \(/m) // no inventory row, so no selection clause
    expect(text).not.toMatch(/\((?:CardTable|PlayingCard)\b|not for:[^\n]*(?:CardTable|PlayingCard)/) // no edge names one
    expect(text).not.toMatch(/ONE CardTable is the table/) // game-table-chrome is scoped to games
    // card-layout still names both types in its "if the catalog has" fallback; its retag waits for W1 (SPEC CA-R4).
  })

  it('control: the croupier catalog prompt for the same intent carries the CardTable row and its teaching', () => {
    const text = promptFor(croupierCatalog)
    expect(text).toMatch(/^- CardTable \(props: .* use: /m)
    expect(text).toMatch(/ONE CardTable is the table/)
  })
})
