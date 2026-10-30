// T-0590 (live round 21 cluster Q, `.sdlc/evals/rounds/2026-10-29-r21-pattern/`, smoke-shopkeeper-browse-and-add-haiku-2,
// trace 2026-10-29.jsonl:42, converted with `npm run chat:probe -- --from-trace`): "What lamps do you have?" is answered on
// storefront-1 with four Cards, each a CardHeader name, a price Text ("$189") and a CardFooter Button, and no ProductCard.
// The ProductCard row read only priced Table columns and priced rows on a services ask, so it shipped. The fixture is the
// recorded run verbatim; the row's priced-Card arm now sends round 1 back (PRODUCT_CARD_MISSING), and round 2 is AUTHORED
// as round 1 with the four Cards replaced by ProductCards.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-browse-priced-cards.json', import.meta.url), 'utf8'))
const [round1] = fixture.turns[0].rounds

it('shopkeeper-haiku-browse-priced-cards: the hand-made priced Cards on a product ask draw PRODUCT_CARD_MISSING', async () => {
  const components = round1.tools[0].input.messages.flatMap((m) => m.updateComponents?.components ?? [])
  expect(components.filter((c) => c.component === 'Card')).toHaveLength(4)
  expect(components.some((c) => c.component === 'ProductCard')).toBe(false)
  const report = await offlineReplay(fixture, process.cwd())
  expect(trace(report.records[0]).failureCodes).toContain('PRODUCT_CARD_MISSING')
})

it('shopkeeper-haiku-browse-priced-cards: a round 2 with one ProductCard per lamp ships clean', async () => {
  const input = round1.tools[0].input
  const all = input.messages.flatMap((m) => m.updateComponents?.components ?? [])
  const text = (id) => all.find((c) => c.id === id)?.text
  const cards = ['p1', 'p2', 'p3', 'p4']
  const messages = input.messages.map((m) => {
    if (m.updateComponents === undefined) return m
    const components = m.updateComponents.components
      .filter((c) => !/^p\d_/.test(c.id))
      .map((c) => {
        if (!cards.includes(c.id)) return c
        const sold = all.find((k) => k.id === `${c.id}_btn`)?.disabled === true
        return { id: c.id, component: 'ProductCard', title: text(`${c.id}_name`), subtitle: text(`${c.id}_desc`), price: text(`${c.id}_price`), actionLabel: sold ? 'Sold out' : 'Add to order', ...(sold ? { disabled: true } : {}), action: { action: 'buy', context: { sku: c.id } } }
      })
    return { ...m, updateComponents: { ...m.updateComponents, components } }
  })
  const authored = { text: '', tools: [{ name: 'render_surface', input: { ...input, messages } }] }
  const turn = { ...fixture.turns[0], rounds: [round1, authored] }
  const report = await offlineReplay({ ...fixture, turns: [turn] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0])).toMatchObject({ rounds: 2 })
  expect(trace(report.records[0]).failureCodes).toContain('PRODUCT_CARD_MISSING')
  expect(trace(report.records[0]).failureCodes).not.toContain('SEMANTIC_UNCORRECTED')
  expect(shipped(report.records[0]).filter((t) => t === 'ProductCard')).toHaveLength(4)
})
