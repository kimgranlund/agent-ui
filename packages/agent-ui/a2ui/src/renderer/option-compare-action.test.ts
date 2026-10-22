// option-compare-action.test.ts: T-0393 step 2. Drives the FULL renderer host with the REAL default catalog and the
// REAL ui-option-compare to prove the wire-to-DOM pick path, on the option-deck-action.test.ts model.
// `OptionCompare.actionName` rides the forwarded-action channel (the BoardGrid `actionName` row, T-0081): the
// renderer applies it and listens for the control's own DOM `action` event, sending `{name: actionName, context:
// {value}}` as one A2UI action per picked column. The row-level `value` mark two-way binds the pick on `select`,
// which the control fires before `action`, so a bound path already holds the pick when the action leaves.

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

const ROWS = [
  { key: 'duration', label: 'Duration' },
  { key: 'price', label: 'Price' },
]

const OPTIONS = [
  { value: 'train', title: 'Train', subtitle: 'Alfa Pendular', values: { duration: '2h 50m', price: '€31' } },
  { value: 'bus', title: 'Bus', values: { duration: '3h 30m', price: '€15' } },
  { value: 'flight', title: 'Flight', values: { duration: '55m', price: '€89' } },
]

function compare(extra: Record<string, unknown> = {}) {
  return {
    version: 'v1.0' as const,
    updateComponents: {
      surfaceId: 's1',
      components: [{ id: 'root', component: 'OptionCompare', heading: 'Lisbon to Porto', rows: ROWS, options: OPTIONS, best: 'train', ...extra }],
    },
  }
}

const columnFor = (mount: HTMLElement, key: string): HTMLElement =>
  mount.querySelector<HTMLElement>(`ui-option-compare [data-part="option"][data-key="${key}"]`)!

describe('OptionCompare pick on the wire (T-0393)', () => {
  it('mounts three columns, and pressing one with actionName "choose" emits exactly one action carrying its value', async () => {
    const { r, mount, actions, cleanup } = harness()
    r.ingestMessage(compare({ actionName: 'choose' }))
    await settle()
    expect(mount.querySelectorAll('ui-option-compare [data-part="option"]')).toHaveLength(3)
    expect(columnFor(mount, 'train').hasAttribute('data-best')).toBe(true)
    columnFor(mount, 'bus').click()
    await settle()
    expect(actions()).toHaveLength(1)
    expect(actions()[0]).toMatchObject({ name: 'choose', context: { value: 'bus' } })
    cleanup()
  })

  it('a click on the heading emits nothing', async () => {
    const { r, mount, actions, cleanup } = harness()
    r.ingestMessage(compare({ actionName: 'choose' }))
    await settle()
    const heading = mount.querySelector<HTMLElement>('ui-option-compare [data-part="heading"]')!
    expect(heading.textContent).toBe('Lisbon to Porto')
    heading.click()
    await settle()
    expect(actions()).toHaveLength(0)
    cleanup()
  })

  it('a node without actionName emits nothing', async () => {
    const { r, mount, actions, cleanup } = harness()
    r.ingestMessage(compare())
    await settle()
    columnFor(mount, 'flight').click()
    await settle()
    expect(actions()).toHaveLength(0)
    cleanup()
  })

  it('a bound value path receives the pick, and with sendDataModel the action dataModel already holds it', async () => {
    const { r, mount, actions, cleanup } = harness(true)
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's1', value: { trip: { leg: '' } } } })
    r.ingestMessage(compare({ actionName: 'choose', value: { path: '/trip/leg' } }))
    await settle()
    columnFor(mount, 'flight').click()
    await settle()
    expect(actions()).toHaveLength(1)
    expect(actions()[0]).toMatchObject({ name: 'choose', context: { value: 'flight' } })
    expect(actions()[0]!.dataModel).toEqual({ trip: { leg: 'flight' } })
    expect(columnFor(mount, 'flight').getAttribute('aria-selected')).toBe('true')
    cleanup()
  })
})
