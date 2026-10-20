// option-deck-action.test.ts: T-0193 step 3. Drives the FULL renderer host with the REAL default catalog and the
// REAL ui-option-deck to prove the wire-to-DOM pick path. `OptionDeck.actionName` rides the forwarded-action
// channel (the BoardGrid `actionName` row, T-0081): the renderer applies it and listens for the control's own DOM
// `action` event, sending `{name: actionName, context: {value}}` as one A2UI action per pressed card. The row-level
// `value` mark two-way binds the pick on `select`, which the control fires before `action`, so a bound path already
// holds the pick when the action leaves (the step 2 listener order).

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/all' // self-defines ui-* controls
import { createRenderer } from './renderer.ts'

await createRenderer().preload('agent-ui')

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

type Sent = { action?: { name: string; context?: Record<string, unknown>; dataModel?: unknown } }

function harness(sendDataModel = false) {
  const r = createRenderer()
  const mount = document.createElement('div')
  document.body.append(mount)
  r.mount(mount)
  const sent: Sent[] = []
  r.onClientMessage((m) => void sent.push(m as never))
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui', ...(sendDataModel ? { sendDataModel } : {}) } })
  const actions = (): NonNullable<Sent['action']>[] => sent.flatMap((m) => (m.action ? [m.action] : []))
  return { r, mount, actions, cleanup: () => { r.dispose(); mount.remove() } }
}

const OPTIONS = [
  { value: 'play blackjack', title: 'Blackjack', description: 'Beat the dealer to 21', tone: 'primary' },
  { value: 'play word guess', title: 'Word guess', tone: 'accent' },
  { value: 'play battleship', title: 'Battleship' },
]

function deck(extra: Record<string, unknown> = {}) {
  return {
    version: 'v1.0' as const,
    updateComponents: {
      surfaceId: 's1',
      components: [{ id: 'root', component: 'OptionDeck', heading: 'Pick a game', options: OPTIONS, ...extra }],
    },
  }
}

const cardFor = (mount: HTMLElement, key: string): HTMLElement =>
  mount.querySelector<HTMLElement>(`ui-option-deck [data-part="option"][data-key="${key}"]`)!

describe('OptionDeck pick on the wire (T-0193)', () => {
  it('pressing a card with actionName "start" emits exactly one action named start carrying the option value', async () => {
    const { r, mount, actions, cleanup } = harness()
    r.ingestMessage(deck({ actionName: 'start' }))
    await settle()
    expect(mount.querySelectorAll('ui-option-deck [data-part="option"]:not([data-random])')).toHaveLength(3)
    cardFor(mount, 'play word guess').click()
    await settle()
    expect(actions()).toHaveLength(1)
    expect(actions()[0]).toMatchObject({ name: 'start', context: { value: 'play word guess' } })
    cleanup()
  })

  it('the Surprise me card emits context.value "random"', async () => {
    const { r, mount, actions, cleanup } = harness()
    r.ingestMessage(deck({ actionName: 'start', allowRandom: true }))
    await settle()
    const random = mount.querySelector<HTMLElement>('ui-option-deck [data-part="option"][data-random]')!
    expect(random.hidden).toBe(false)
    random.click()
    await settle()
    expect(actions()).toHaveLength(1)
    expect(actions()[0]).toMatchObject({ name: 'start', context: { value: 'random' } })
    cleanup()
  })

  it('a click on the heading emits nothing', async () => {
    const { r, mount, actions, cleanup } = harness()
    r.ingestMessage(deck({ actionName: 'start' }))
    await settle()
    const heading = mount.querySelector<HTMLElement>('ui-option-deck [data-part="heading"]')!
    expect(heading.textContent).toBe('Pick a game')
    heading.click()
    await settle()
    expect(actions()).toHaveLength(0)
    cleanup()
  })

  it('a node without actionName emits nothing', async () => {
    const { r, mount, actions, cleanup } = harness()
    r.ingestMessage(deck())
    await settle()
    cardFor(mount, 'play blackjack').click()
    await settle()
    expect(actions()).toHaveLength(0)
    cleanup()
  })

  it('a bound value path receives the pick, and with sendDataModel the action dataModel already holds it', async () => {
    const { r, mount, actions, cleanup } = harness(true)
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's1', value: { pick: '' } } })
    r.ingestMessage(deck({ actionName: 'start', value: { path: '/pick' } }))
    await settle()
    cardFor(mount, 'play battleship').click()
    await settle()
    expect(actions()).toHaveLength(1)
    expect(actions()[0]).toMatchObject({ name: 'start', context: { value: 'play battleship' } })
    expect(actions()[0]!.dataModel).toEqual({ pick: 'play battleship' })
    cleanup()
  })
})
