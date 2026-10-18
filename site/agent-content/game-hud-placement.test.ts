// game-hud-placement.test.ts (T-0363): the board-less game skills whose move is an ask teach where the GameHud goes.
// An ask surface hosts only the feed sub-catalog (`feed-catalog.ts`), which excludes GameHud, and grammar.md admits a
// game's ONE HUD surface beside the ask (Kim 2026-10-18). Each skill body names what the ask surface holds and what it
// never holds; each description (all an index-only skill shows the model) carries the same split. This test holds both
// against the feed set and the one-commit-Button rule.
import { describe, expect, it } from 'vitest'
import { FEED_EXCLUDED, FEED_SURFACE_TYPE_SET } from '../../packages/agent-ui/a2ui/src/agent/feed-catalog.ts'
import { AGENT_CONTENT } from './registry.gen.ts'

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

/** The ask-side problems of one placement rule match: an empty list is a sound ask surface. */
function askProblems(onAsk: string): string[] {
  const problems = types(onAsk).filter((t) => !FEED_SURFACE_TYPE_SET.has(t)).map((t) => `${t} is not a feed type`)
  if (buttons(onAsk) !== 1 || oneButton(onAsk) !== 1) problems.push(`${buttons(onAsk)} Buttons, not ONE commit Button`)
  return problems
}

describe('T-0363: game skills place the GameHud on a HUD surface beside the ask', () => {
  for (const id of ['guess-hud', 'deal-sheet']) {
    it(`${id}: the ask surface holds only feed types and ONE Button, and never the HUD types`, () => {
      const { body } = skill(id)
      const m = RULE.exec(body)
      expect(m, `${id} states the placement rule`).not.toBeNull()
      expect(askProblems(m![1]!)).toEqual([])
      const never = types(m![2]!)
      expect(never).toContain('GameHud')
      const hudSentence = body.slice(0, body.indexOf('. ') + 1)
      for (const t of types(hudSentence).filter((t) => EXCLUDED.has(t))) expect(never, `${id} keeps ${t} off the ask`).toContain(t)
    })

    it(`${id}: the description carries the split with ONE Button`, () => {
      const { description } = skill(id)
      expect(description).toContain('GameHud')
      expect(description).toContain('never on the ask')
      expect(buttons(description)).toBe(1)
    })
  }

  it('negative controls: no Button, three Buttons and a Timeline on the ask each fail', () => {
    expect(askProblems('the question and the SegmentedControl')).toEqual(['0 Buttons, not ONE commit Button'])
    expect(askProblems('the Slider, ONE Offer Button, an Accept Button and a Walk away Button')).toEqual(['3 Buttons, not ONE commit Button'])
    expect(askProblems('the question, a Timeline and ONE Answer Button')).toEqual(['Timeline is not a feed type'])
  })
})
