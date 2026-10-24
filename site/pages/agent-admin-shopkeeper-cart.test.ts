// agent-admin-shopkeeper-cart.test.ts (T-0452): the Shopkeeper's cart reaches the composed prompt on the storefront
// turns. A `context` skill composes as its index line only (SPEC-R14), so the `cart-summary` rule rides two
// always-composed channels: its description (the first add opens ONE ConfirmReceipt plus one AmountPicker per line) and the persona's surface
// style (the browse surface holds only the tiles; the first pick opens the order summary). Round 13 cluster U
// hand-built an `orderCard` on the browse turn because the old surface style asked for "a running order summary"
// there. The prompt is captured off the real `ui-agent-admin` injected-runner seam
// (`agent-admin-ambient-budget.test.ts`), never recomputed.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { createMemoryStore } from '@agent-ui/app'
import type { AdminTurnRequest } from '@agent-ui/app/agent-admin-schema'
import { SURFACE_A2UI_KEY } from '@agent-ui/app/agent-admin-schema'
import { MINI_SKILLS, selectMiniSkills, DEFAULT_MINI_SKILL_CAP } from '../../packages/agent-ui/a2ui/src/agent/mini-skills.ts'
import { AGENT_PRESETS, presetSeed } from './agent-admin-presets.ts'

let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const mounted: Element[] = []
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove()
})

/** The reach probe's two storefront turns (`reach-shopkeeper-cart-amount-haiku`). */
const BROWSE = 'What lamps do you have?'
const ADD = 'Add two of the first one to my order and show me my cart.'

/** The system prompt the real component composes for each of `texts`, sent in order on the Shopkeeper's seed. */
async function composedPrompts(texts: readonly string[]): Promise<string[]> {
  const preset = AGENT_PRESETS.find((p) => p.id === 'shopkeeper')!
  const store = createMemoryStore({ initial: presetSeed(preset) })
  store.set(SURFACE_A2UI_KEY, false) // the prose arm: one composed string per turn, captured whole
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = store
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  const calls: AdminTurnRequest[] = []
  el.agentTurn = async (req) => (calls.push(req), 'ok')
  const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
  for (const [i, text] of texts.entries()) {
    composer.value = text
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    for (let n = 0; n < 200 && calls.length <= i; n += 1) await Promise.resolve()
    await whenFlushed()
  }
  expect(calls.map((c) => c.system.length > 0), 'the injected runner must receive every turn').toEqual(texts.map(() => true))
  return calls.map((c) => c.system)
}

describe('T-0452: the Shopkeeper cart is one ConfirmReceipt with AmountPicker lines on the storefront turns', () => {
  it('both storefront turns compose the cart-summary rule and a browse surface of tiles only', async () => {
    const prompts = await composedPrompts([BROWSE, ADD])
    for (const [i, system] of prompts.entries()) {
      const turn = i === 0 ? 'browse' : 'add'
      const cart = system.split('\n').find((l) => l.startsWith('- cart-summary'))
      expect(cart, `${turn}: the cart-summary index line`).toMatch(/the first add opens ONE ConfirmReceipt bound to the cart lines plus one AmountPicker per line bound to its quantity/)
      expect(cart, `${turn}: the cart-summary index line`).toMatch(/; never a hand-built Card$/)
      expect(system, `${turn}: the browse surface holds only the tiles`).toMatch(/one buy action, and nothing else yet\. The first item picked opens the order summary on THAT SAME surface/)
      expect(system, `${turn}: the order summary is the receipt, never a hand-built card`).toMatch(/one confirm-and-receipt card of the order lines with the total, plus one number picker per line for its quantity/)
      expect(system, `${turn}: the retired wording that built orderCard on the browse turn`).not.toMatch(/running order summary/)
    }
  })

  it('the add turn routes the confirm-receipt mini-skill beside the persona rule', () => {
    expect(selectMiniSkills(ADD, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)).toContain('confirm-receipt')
  })
})
