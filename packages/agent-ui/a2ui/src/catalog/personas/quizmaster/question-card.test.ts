// question-card.test.ts: QuestionCard through the real renderer in jsdom (T-0074, the croupier
// `templated-hand.test.ts` pattern; the approved-mockup states, T-0082). The derived `agent-ui--quizmaster` id
// is a lazy record (ADR-0241), so each render awaits its load before ingesting. jsdom lacks
// `ElementInternals.setFormValue`/`setValidity`, which the connected `ui-radio-group`/`ui-radio` call, so the
// suite stubs them (the `persona-exemplars.test.ts` precedent) and restores them after.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { whenFlushed } from '@agent-ui/components'
import { createRenderer } from '../../../renderer/renderer.ts'
import type { A2uiClientMessage } from '../../../renderer/renderer.ts'

let savedSetFormValue: unknown
let savedSetValidity: unknown
beforeAll(() => {
  savedSetFormValue = ElementInternals.prototype.setFormValue
  savedSetValidity = ElementInternals.prototype.setValidity
  if (typeof ElementInternals.prototype.setFormValue !== 'function') ElementInternals.prototype.setFormValue = function (): void {}
  if (typeof ElementInternals.prototype.setValidity !== 'function') ElementInternals.prototype.setValidity = function (): void {}
})
afterAll(() => {
  ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
  ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
})

const SID = 'quiz'
const CATALOG = 'agent-ui--quizmaster'
const isError = (m: A2uiClientMessage): boolean => 'error' in m

const OPTIONS = [
  { value: 'mercury', label: 'Mercury' },
  { value: 'venus', label: 'Venus' },
  { value: 'earth', label: 'Earth' },
  { value: 'mars', label: 'Mars' },
]

interface RadioEl extends HTMLElement {
  value: string
  checked: boolean
  disabled: boolean
}

const line = (msg: unknown): string => JSON.stringify(msg)
const write = (path: string, value: unknown): string => line({ version: 'v1.0', updateDataModel: { surfaceId: SID, path, value } })

interface SentAction {
  name: string
  sourceComponentId: string
  context: Record<string, unknown>
  dataModel?: Record<string, unknown>
}

async function render(
  card: Record<string, unknown>,
  extra: Record<string, unknown>[] = [],
  opts: { sendDataModel?: boolean } = {},
): Promise<{
  mount: HTMLElement
  ingest: (l: string) => void
  errors: () => A2uiClientMessage[]
  actions: () => SentAction[]
  cleanup: () => void
}> {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer()
  await r.preload(CATALOG)
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  const create = opts.sendDataModel === true ? { surfaceId: SID, catalogId: CATALOG, sendDataModel: true } : { surfaceId: SID, catalogId: CATALOG }
  r.ingest(line({ version: 'v1.0', createSurface: create }))
  r.ingest(write('/answer', ''))
  r.ingest(write('/revealed', false))
  r.ingest(
    line({
      version: 'v1.0',
      updateComponents: {
        surfaceId: SID,
        components: [
          { id: 'root', component: 'Column', children: ['card', 'echo'] },
          { id: 'card', component: 'QuestionCard', ...card },
          { id: 'echo', component: 'Text', text: { path: '/answer' } },
          ...extra,
        ],
      },
    }),
  )
  await whenFlushed()
  return {
    mount,
    ingest: (l) => r.ingest(l),
    errors: () => sent.filter(isError),
    actions: () => sent.flatMap((m) => ('action' in m ? [m.action as unknown as SentAction] : [])),
    cleanup: () => {
      r.dispose()
      mount.remove()
    },
  }
}

const BOUND = {
  label: 'Question 4 of 10',
  meta: 'Science · medium',
  question: 'Which planet is closest to the Sun?',
  options: OPTIONS,
  name: 'round1',
  value: { path: '/answer' },
  answer: 'mercury',
  revealed: { path: '/revealed' },
  explanation: 'Mercury orbits closest to the Sun.',
}

const radiosIn = (mount: HTMLElement): RadioEl[] => [...mount.querySelectorAll('ui-radio')] as RadioEl[]
const states = (mount: HTMLElement): (string | null)[] => radiosIn(mount).map((r) => r.getAttribute('data-state'))
const partText = (row: HTMLElement, name: string): string => row.querySelector(`[data-part="${name}"]`)?.textContent ?? ''
const click = (el: HTMLElement): void => void el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
const key = (el: HTMLElement, k: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  el.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }))
}
/** The tap-commit card (T-0429): a pick sends the `answer` action. */
const COMMIT = { ...BOUND, actionName: 'answer' }

describe('QuestionCard through the real renderer', () => {
  it('QuestionCard renders one lettered row per option, in order, labelled in its label span', async () => {
    const { mount, errors, cleanup } = await render(BOUND)
    expect(errors()).toEqual([])
    const radios = radiosIn(mount)
    expect(radios.map((r) => [r.value, partText(r, 'label')])).toEqual(OPTIONS.map((o) => [o.value, o.label]))
    expect(radios.map((r) => partText(r, 'key'))).toEqual(['A', 'B', 'C', 'D'])
    expect(states(mount)).toEqual(['idle', 'idle', 'idle', 'idle'])
    expect(mount.querySelector('[data-part="question"]')?.textContent).toBe(BOUND.question)
    expect((mount.querySelector('[data-part="options"]') as unknown as { name: string }).name).toBe('round1')
    cleanup()
  })

  it('QuestionCard: the header carries the label pill and the right-aligned meta', async () => {
    const { mount, cleanup } = await render(BOUND)
    const head = mount.querySelector('[data-part="head"]') as HTMLElement
    expect(head.style.display).toBe('flex')
    expect((mount.querySelector('[data-part="label"]') as unknown as { label: string }).label).toBe('Question 4 of 10')
    expect(mount.querySelector('[data-part="label"]')?.tagName.toLowerCase()).toBe('ui-badge')
    expect(mount.querySelector('[data-part="meta"]')?.textContent).toBe('Science · medium')
    cleanup()
  })

  it('QuestionCard: with no label, progress fills the pill as Question n of m', async () => {
    const { label: _label, ...rest } = BOUND
    const { mount, cleanup } = await render({ ...rest, progress: { value: 3, max: 10 } })
    expect((mount.querySelector('[data-part="label"]') as unknown as { label: string }).label).toBe('Question 3 of 10')
    cleanup()
  })

  it('QuestionCard: a radio click commits value to the bound data-model path and marks that row selected', async () => {
    const { mount, errors, cleanup } = await render(BOUND)
    click(radiosIn(mount)[2]!)
    await whenFlushed()
    expect(errors()).toEqual([])
    expect((mount.querySelector('[data-part="options"]') as unknown as { value: string }).value).toBe('earth')
    // the sibling Text bound to the same /answer path reads the committed value back
    const echo = [...mount.querySelectorAll('ui-text')].find((t) => t.closest('ui-card') === null)
    expect(echo?.textContent).toBe('earth')
    expect(states(mount)).toEqual(['idle', 'idle', 'selected', 'idle'])
    expect(radiosIn(mount).map((r) => partText(r, 'key'))).toEqual(['A', 'B', '●', 'D'])
    cleanup()
  })

  it('QuestionCard: a data-model write selects the matching radio and paints its row', async () => {
    const { mount, ingest, errors, cleanup } = await render(BOUND)
    ingest(write('/answer', 'venus'))
    await whenFlushed()
    expect(errors()).toEqual([])
    expect(radiosIn(mount).map((r) => r.checked)).toEqual([false, true, false, false])
    expect(states(mount)).toEqual(['idle', 'selected', 'idle', 'idle'])
    cleanup()
  })

  it('QuestionCard: revealed after a wrong pick marks the correct row and the pick, disables every option and opens the explanation', async () => {
    const { mount, ingest, errors, cleanup } = await render(BOUND)
    const group = mount.querySelector('[data-part="options"]') as unknown as { disabled: boolean }
    const panel = mount.querySelector('[data-part="explanation"]') as HTMLElement
    expect(panel.style.display).toBe('none')
    ingest(write('/answer', 'venus'))
    ingest(write('/revealed', true))
    await whenFlushed()
    expect(states(mount)).toEqual(['correct', 'wrong', 'idle', 'idle'])
    expect(radiosIn(mount).map((r) => partText(r, 'key'))).toEqual(['✓', '✕', 'C', 'D'])
    expect(radiosIn(mount).map((r) => partText(r, 'result'))).toEqual(['Correct', 'Your answer', '', ''])
    expect(group.disabled).toBe(true)
    expect(radiosIn(mount).every((r) => r.disabled)).toBe(true)
    expect(panel.style.display).toBe('')
    expect(panel.textContent).toContain(BOUND.explanation)
    ingest(write('/revealed', false))
    await whenFlushed()
    expect(states(mount)).toEqual(['idle', 'selected', 'idle', 'idle'])
    expect(group.disabled).toBe(false)
    expect(radiosIn(mount).some((r) => r.disabled)).toBe(false)
    expect(panel.style.display).toBe('none')
    expect(errors()).toEqual([])
    cleanup()
  })

  it('QuestionCard: revealed after the right pick marks one correct row and no wrong one', async () => {
    const { mount, ingest, cleanup } = await render(BOUND)
    ingest(write('/answer', 'mercury'))
    ingest(write('/revealed', true))
    await whenFlushed()
    expect(states(mount)).toEqual(['correct', 'idle', 'idle', 'idle'])
    expect(radiosIn(mount).map((r) => partText(r, 'result'))).toEqual(['Correct', '', '', ''])
    cleanup()
  })

  it('QuestionCard: once revealed, a click on another option changes neither the pick nor any row', async () => {
    const { mount, ingest, cleanup } = await render(BOUND)
    ingest(write('/answer', 'venus'))
    ingest(write('/revealed', true))
    await whenFlushed()
    click(radiosIn(mount)[3]!)
    await whenFlushed()
    expect(radiosIn(mount).map((r) => r.checked)).toEqual([false, true, false, false])
    expect((mount.querySelector('[data-part="options"]') as unknown as { value: string }).value).toBe('venus')
    expect(states(mount)).toEqual(['correct', 'wrong', 'idle', 'idle'])
    cleanup()
  })

  it('QuestionCard: a fresh pick sends exactly one answer action carrying the picked value, after the bound write', async () => {
    const { mount, actions, errors, cleanup } = await render(COMMIT, [], { sendDataModel: true })
    click(radiosIn(mount)[1]!)
    await whenFlushed()
    expect(errors()).toEqual([])
    const sent = actions()
    expect(sent.map((a) => [a.name, a.context, a.sourceComponentId])).toEqual([['answer', { value: 'venus' }, 'card']])
    expect(sent[0]!.dataModel?.answer).toBe('venus')
    cleanup()
  })

  it('QuestionCard: a click on a row label commits once, and a re-press of the picked row commits once more', async () => {
    const { mount, actions, cleanup } = await render(COMMIT)
    click(radiosIn(mount)[2]!.querySelector('[data-part="label"]') as HTMLElement)
    await whenFlushed()
    expect(actions().map((a) => a.context)).toEqual([{ value: 'earth' }])
    click(radiosIn(mount)[2]!)
    await whenFlushed()
    expect(actions().map((a) => a.context)).toEqual([{ value: 'earth' }, { value: 'earth' }])
    cleanup()
  })

  it('QuestionCard: Space commits on an unpicked row and on the picked row, once each; Enter on an unpicked row commits nothing', async () => {
    const { mount, actions, cleanup } = await render(COMMIT)
    key(radiosIn(mount)[3]!, 'Enter')
    await whenFlushed()
    expect(actions()).toEqual([])
    key(radiosIn(mount)[0]!, ' ')
    await whenFlushed()
    expect(actions().map((a) => a.context)).toEqual([{ value: 'mercury' }])
    key(radiosIn(mount)[0]!, ' ')
    await whenFlushed()
    expect(actions().map((a) => a.context)).toEqual([{ value: 'mercury' }, { value: 'mercury' }])
    cleanup()
  })

  it('QuestionCard: an arrow key moves the pick and commits nothing (selection follows focus)', async () => {
    const { mount, actions, cleanup } = await render(COMMIT)
    click(radiosIn(mount)[0]!)
    await whenFlushed()
    key(radiosIn(mount)[0]!, 'ArrowDown')
    await whenFlushed()
    expect((mount.querySelector('[data-part="options"]') as unknown as { value: string }).value).toBe('venus')
    expect(actions().map((a) => a.context)).toEqual([{ value: 'mercury' }])
    cleanup()
  })

  it('QuestionCard: a revealed card commits nothing, and a card with no actionName commits nothing', async () => {
    const revealed = await render(COMMIT)
    revealed.ingest(write('/answer', 'venus'))
    revealed.ingest(write('/revealed', true))
    await whenFlushed()
    click(radiosIn(revealed.mount)[1]!)
    click(radiosIn(revealed.mount)[3]!)
    await whenFlushed()
    expect(revealed.actions()).toEqual([])
    revealed.cleanup()

    const unnamed = await render(BOUND)
    click(radiosIn(unnamed.mount)[1]!)
    await whenFlushed()
    expect(unnamed.actions()).toEqual([])
    unnamed.cleanup()
  })

  it('QuestionCard: the revealed card holds the producer Next question Button after the explanation, at the button lg step (ADR-0243 Amendment 2)', async () => {
    const button = { id: 'next', component: 'Button', variant: 'solid', label: 'Next question', action: { action: 'next_question' } }
    const { mount, ingest, errors, cleanup } = await render({ ...COMMIT, children: ['next'] }, [button])
    ingest(write('/answer', 'venus'))
    ingest(write('/revealed', true))
    await whenFlushed()
    expect(errors()).toEqual([])
    const kids = [...(mount.querySelector('ui-card') as HTMLElement).children]
    const btn = kids.at(-1) as HTMLElement & { size: string }
    expect(btn.tagName.toLowerCase()).toBe('ui-button')
    expect(kids.at(-2)?.getAttribute('data-part')).toBe('explanation')
    expect(btn.getAttribute('size')).toBe('lg')
    expect(btn.size).toBe('lg')
    cleanup()
  })

  it('QuestionCard: no element style carries border-left, and each option row keeps a 44px minimum block size', async () => {
    const { mount, ingest, cleanup } = await render(BOUND)
    ingest(write('/answer', 'venus'))
    ingest(write('/revealed', true))
    await whenFlushed()
    const all = [mount, ...mount.querySelectorAll('*')]
    expect(all.filter((e) => (e.getAttribute('style') ?? '').includes('border-left'))).toEqual([])
    for (const r of radiosIn(mount)) expect(r.style.getPropertyValue('min-block-size')).toBe('44px')
    cleanup()
  })

  it('QuestionCard with every prop absent mounts with no error', async () => {
    const { mount, errors, cleanup } = await render({})
    expect(errors()).toEqual([])
    const card = mount.querySelector('ui-card')
    expect(card).not.toBeNull()
    expect(radiosIn(mount)).toEqual([])
    expect((mount.querySelector('[data-part="head"]') as HTMLElement).style.display).toBe('none')
    expect((mount.querySelector('[data-part="explanation"]') as HTMLElement).style.display).toBe('none')
    cleanup()
  })
})
