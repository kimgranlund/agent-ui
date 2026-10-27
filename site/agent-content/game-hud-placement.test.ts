// game-hud-placement.test.ts (T-0363): the board-less game skills whose move is an ask teach where the GameHud goes.
// An ask surface hosts only the feed sub-catalog (`feed-catalog.ts`), which excludes GameHud, and grammar.md admits a
// game's ONE HUD surface beside the ask (Kim 2026-10-18). Each skill body names what the ask surface holds and what it
// never holds; each description (all an index-only skill shows the model) carries the same split. This test holds both
// against the feed set and the one-commit rule: ONE Button, or (T-0419) none beside an own-commit OptionDeck.
import { describe, expect, it } from 'vitest'
import { FEED_EXCLUDED, FEED_SURFACE_TYPE_SET } from '../../packages/agent-ui/a2ui/src/agent/feed-catalog.ts'
import { GAME_HUD_PERSONAS } from '../../packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts'
import { AGENT_CONTENT } from './registry.gen.ts'
import { findRef } from './schema.ts'

const RULE = /the ask surface holds only (.+?), never (.+?), and the (?:HUD surface|deal sheet) stays beside it\./
const EXCLUDED = new Set(FEED_EXCLUDED.map((e) => e.type))

/** The catalog type names in a phrase: capitalized words that are feed or feed-excluded types. */
const types = (phrase: string): string[] =>
  (phrase.match(/\b[A-Z][A-Za-z]+\b/g) ?? []).filter((w) => FEED_SURFACE_TYPE_SET.has(w) || EXCLUDED.has(w))
const buttons = (phrase: string): number => (phrase.match(/\bButton\b/g) ?? []).length
const oneButton = (phrase: string): number => (phrase.match(/\bONE (?:\w+ )?Button\b/g) ?? []).length

function skill(id: string): { body: string; description: string } {
  const record = AGENT_CONTENT.find((r) => r.kind === 'skill' && r.id === id) as { body?: string; frontmatter?: { description?: string } } | undefined
  if (record?.body === undefined || record.frontmatter?.description === undefined) throw new Error(`no skill ${id}`)
  return { body: record.body, description: record.frontmatter.description }
}

/** T-0419: an ask whose answer control commits by its own press (OptionDeck, OptionCompare) carries no Button. */
const ownCommit = (phrase: string): boolean => /\b(?:OptionDeck|OptionCompare)\b/.test(phrase)

/** The ask-side problems of one placement rule match: an empty list is a sound ask surface. */
function askProblems(onAsk: string): string[] {
  const problems = types(onAsk).filter((t) => !FEED_SURFACE_TYPE_SET.has(t)).map((t) => `${t} is not a feed type`)
  if (ownCommit(onAsk)) {
    if (buttons(onAsk) !== 0) problems.push(`${buttons(onAsk)} Buttons beside an own-commit control`)
  } else if (buttons(onAsk) !== 1 || oneButton(onAsk) !== 1) problems.push(`${buttons(onAsk)} Buttons, not ONE commit Button`)
  return problems
}

/** The Buttons each skill's description names: the own-commit deck none, the deal sheet's form its one Send. */
const DESCRIPTION_BUTTONS: Readonly<Record<string, number>> = { 'guess-hud': 0, 'deal-sheet': 1 }

describe('T-0363: game skills place the GameHud on a HUD surface beside the ask', () => {
  for (const id of ['guess-hud', 'deal-sheet']) {
    it(`${id}: the ask surface holds only feed types and its commit (ONE Button, or none beside an own-commit OptionDeck), and never the HUD types`, () => {
      const { body } = skill(id)
      const m = RULE.exec(body)
      expect(m, `${id} states the placement rule`).not.toBeNull()
      expect(askProblems(m![1]!)).toEqual([])
      const never = types(m![2]!)
      expect(never).toContain('GameHud')
      const hudSentence = body.slice(0, body.indexOf('. ') + 1)
      for (const t of types(hudSentence).filter((t) => EXCLUDED.has(t))) expect(never, `${id} keeps ${t} off the ask`).toContain(t)
    })

    it(`${id}: the description carries the split and its commit`, () => {
      const { description } = skill(id)
      expect(description).toContain('GameHud')
      expect(description).toContain('never on the ask')
      expect(buttons(description)).toBe(DESCRIPTION_BUTTONS[id])
    })
  }

  it('negative controls: no Button, three Buttons and a Timeline on the ask each fail', () => {
    expect(askProblems('the question and the SegmentedControl')).toEqual(['0 Buttons, not ONE commit Button'])
    expect(askProblems('the Slider, ONE Offer Button, an Accept Button and a Walk away Button')).toEqual(['3 Buttons, not ONE commit Button'])
    expect(askProblems('the question, a Timeline and ONE Answer Button')).toEqual(['Timeline is not a feed type'])
    expect(askProblems('ONE OptionDeck and ONE Answer Button')).toEqual(['1 Buttons beside an own-commit control'])
  })
})

// T-0479: the game-ask-hud check knows a game from the session's persona id (`GAME_HUD_PERSONAS`, a2ui-side, which
// cannot read this content). The set is exactly the personas whose own text or skill and workflow text teaches a GameHud,
// less the ones whose game opens with no HUD by design.
const NO_HUD_GAME: Readonly<Record<string, string>> = { croupier: 'its CardTable carries the status, and its game picker (pick-croupier-game-deck) opens before any table' }

describe('T-0479: GAME_HUD_PERSONAS names the personas whose content teaches a GameHud', () => {
  it('matches the persona, skill and workflow text', () => {
    const teaches = AGENT_CONTENT.filter((r) => r.kind === 'persona')
      .filter((p) => {
        const fm = p.frontmatter as { skills: string[]; workflows: string[] }
        const refs = [...fm.skills.map((ref) => findRef(AGENT_CONTENT, ref, 'skill', p.id)), ...fm.workflows.map((ref) => findRef(AGENT_CONTENT, ref, 'workflow', p.id))]
        return [p, ...refs].some((r) => (r as { body?: string } | null)?.body?.includes('GameHud') === true)
      })
      .map((p) => p.id)
    expect(Object.keys(NO_HUD_GAME).every((id) => teaches.includes(id))).toBe(true)
    expect(teaches.filter((id) => NO_HUD_GAME[id] === undefined).sort()).toEqual([...GAME_HUD_PERSONAS].sort())
  })
})
