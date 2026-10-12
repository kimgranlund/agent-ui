// product-card-action.test.ts: ADR-0243 (T-0072 verifier finding). Drives the FULL renderer host with the REAL
// default catalog and the REAL ui-product-card to prove the wire-to-DOM action path: the renderer withholds a
// `mapsTo: 'action'` prop from applyProp (it wires the host click instead), and the control draws its action
// button only when its own `action` prop is non-null, so productCardFactory must also hand the static action spec
// to the element. Without that the button never renders and no action can fire.

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/all' // self-defines ui-* controls
import { createRenderer } from './renderer.ts'

await createRenderer().preload('agent-ui')

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function harness() {
  const r = createRenderer()
  const mount = document.createElement('div')
  document.body.append(mount)
  r.mount(mount)
  const sent: Array<{ action?: { name: string; context?: Record<string, unknown> } }> = []
  r.onClientMessage((m) => void sent.push(m as never))
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } })
  return { r, mount, sent, cleanup: () => { r.dispose(); mount.remove() } }
}

describe('ProductCard action on the wire (ADR-0243, T-0072)', () => {
  it('renders exactly one action button labelled actionLabel, and one click emits exactly one action message', async () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'ProductCard', title: 'Harbour View Suite', price: '$312', actionLabel: 'Book', action: { action: 'book_room', context: { room: 'harbour' } } },
        ],
      },
    })
    await settle()

    const buttons = mount.querySelectorAll('ui-product-card button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.textContent).toBe('Book')

    ;(buttons[0] as HTMLElement).click()
    await settle()
    const actions = sent.filter((m) => m.action !== undefined)
    expect(actions).toHaveLength(1)
    expect(actions[0]!.action!.name).toBe('book_room')
    expect(actions[0]!.action!.context).toEqual({ room: 'harbour' })
    cleanup()
  })

  it('a structural resend keeps one button and still emits exactly one action per click', async () => {
    const { r, mount, sent, cleanup } = harness()
    const update = {
      version: 'v1.0' as const,
      updateComponents: {
        surfaceId: 's1',
        components: [{ id: 'root', component: 'ProductCard', title: 'Skyline Loft', actionLabel: 'Book', action: { action: 'book_room' } }],
      },
    }
    r.ingestMessage(update)
    r.ingestMessage(update)
    await settle()
    const buttons = mount.querySelectorAll('ui-product-card button')
    expect(buttons).toHaveLength(1)
    ;(buttons[0] as HTMLElement).click()
    await settle()
    expect(sent.filter((m) => m.action !== undefined)).toHaveLength(1)
    cleanup()
  })

  it('a card with no action renders no button and a click emits nothing (the exhibit tile)', async () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'ProductCard', title: 'Lobby mural', icon: 'image' }] },
    })
    await settle()
    expect(mount.querySelectorAll('ui-product-card button')).toHaveLength(0)
    ;(mount.querySelector('ui-product-card') as HTMLElement).click()
    await settle()
    expect(sent.filter((m) => m.action !== undefined)).toHaveLength(0)
    cleanup()
  })

  it('a disabled card bound to the data model emits nothing, and emits again once re-enabled (ADR-0243 Amendment 2)', async () => {
    const { r, mount, sent, cleanup } = harness()
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's1', value: { soldOut: true } } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'ProductCard', title: 'Penthouse', price: '$640', priceOld: '$720', ratingCount: 12, selected: false, disabled: { path: '/soldOut' }, actionLabel: 'Unavailable', action: { action: 'book_room' } },
        ],
      },
    })
    await settle()
    const card = mount.querySelector('ui-product-card') as HTMLElement & { disabled: boolean; priceOld: string; ratingCount: number }
    expect(card.disabled).toBe(true)
    expect(card.priceOld).toBe('$720')
    expect(card.ratingCount).toBe(12)
    expect((card.querySelector('button[data-part="action"]') as HTMLButtonElement).disabled).toBe(true)
    card.click()
    await settle()
    expect(sent.filter((m) => m.action !== undefined)).toHaveLength(0)
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/soldOut', value: false } })
    await settle()
    card.click()
    await settle()
    expect(sent.filter((m) => m.action !== undefined)).toHaveLength(1)
    cleanup()
  })
})
