// bind-guest-edit.browser.test.ts (T-0171): a guest's hand-typed edit in a two-way bound field survives the
// renderer's bind effect and reaches the data model on the SAME commit, in a real engine (Chromium and WebKit).
// The date and number legs type through the field's codec: the commit must carry the parsed value, never the
// value from before the edit (which the bind would then write back over the guest's text).

import { describe, it, expect } from 'vitest'
import { userEvent } from 'vitest/browser'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/components/all'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, A2uiServerMessage } from './renderer.ts'
import type { A2uiActionMessage } from './action.ts'

await createRenderer().preload('agent-ui')

const localeDate = (y: number, m: number, d: number): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(y, m - 1, d))

type Field = HTMLElement & { value: string }

/** Mount one surface from `components` over `data`; its last button's action carries the data model. */
async function mountSurface(catalogId: string, data: unknown, components: unknown[]) {
  const mount = document.createElement('div')
  mount.style.inlineSize = '480px'
  document.body.append(mount)
  const r = createRenderer()
  r.mount(mount)
  await r.preload(catalogId)
  const sent: A2uiClientMessage[] = []
  r.onClientMessage((m) => sent.push(m))
  const msgs = [
    { version: 'v1.0', createSurface: { surfaceId: 's', catalogId, sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: 's', path: '/', value: data } },
    { version: 'v1.0', updateComponents: { surfaceId: 's', components } },
  ] as unknown as A2uiServerMessage[]
  for (const m of msgs) r.ingestMessage(m)
  r.finalize('s')
  await whenFlushed()
  const go = [...mount.querySelectorAll<HTMLElement>('ui-button')].at(-1)!
  /** The data model as a submitted action carries it right now. */
  const model = (): Record<string, unknown> => {
    go.click()
    const last = sent.filter((m): m is A2uiActionMessage => 'action' in m).at(-1)
    return last!.action.dataModel as Record<string, unknown>
  }
  const field = (i: number): Field => mount.querySelectorAll<Field>('ui-text-field')[i]!
  /** Type `text` into field `i` as a guest would, then leave the field (the commit). */
  const typeAndLeave = async (i: number, text: string): Promise<void> => {
    const editor = field(i).querySelector('[data-part="editor"]') as HTMLElement
    editor.focus()
    await userEvent.fill(editor, text)
    editor.blur()
  }
  const done = (): void => {
    r.dispose()
    mount.remove()
  }
  return { model, field, typeAndLeave, done }
}

const goButton = { id: 'go', component: 'Button', label: 'Go', action: { action: 'go' } }

describe('a guest edit in a bound field keeps its text and reaches the data model on the same commit (T-0171)', () => {
  it('a default-catalog TextField', async () => {
    const s = await mountSurface('agent-ui', { name: 'Ada' }, [
      { id: 'root', component: 'Column', children: ['t', 'go'] },
      { id: 't', component: 'TextField', label: 'Name', value: { path: '/name' } },
      goButton,
    ])
    await s.typeAndLeave(0, 'Grace')
    expect(s.model()['name'], 'on the commit itself').toBe('Grace')
    await whenFlushed()
    expect(s.field(0).value, 'the bind never writes the old value back').toBe('Grace')
    expect(s.model()['name']).toBe('Grace')
    s.done()
  })

  it('BookingForm text, number and date fields (a typed date is the ISO on the commit that typed it)', async () => {
    const s = await mountSurface('agent-ui--concierge', { stay: { guestName: 'Ada', guests: '2', checkIn: '2026-11-14' } }, [
      { id: 'root', component: 'Column', children: ['form', 'go'] },
      {
        id: 'form',
        component: 'BookingForm',
        title: 'Your stay',
        fields: [
          { kind: 'text', path: 'guestName', label: 'Guest name' },
          { kind: 'number', path: 'guests', label: 'Guests' },
          { kind: 'dateSingle', path: 'checkIn', label: 'Arrival' },
        ],
        value: { path: '/stay' },
      },
      goButton,
    ])
    const stay = (): Record<string, unknown> => s.model()['stay'] as Record<string, unknown>

    await s.typeAndLeave(0, 'Grace')
    expect(stay()['guestName']).toBe('Grace')

    await s.typeAndLeave(1, '5')
    expect(stay()['guests'], 'the number on its own commit').toBe('5')
    await whenFlushed()
    expect(s.field(1).value, 'the bind never writes the old number back').toBe('5')

    await s.typeAndLeave(2, localeDate(2026, 12, 1))
    expect(stay()['checkIn'], 'a typed locale date publishes its ISO on its own commit').toBe('2026-12-01')
    await s.typeAndLeave(2, '2026-12-05')
    expect(stay()['checkIn'], 'a typed ISO date on its own commit, not the one before').toBe('2026-12-05')
    await whenFlushed()
    expect(s.field(2).value, 'the field keeps the guest\'s date').toBe(localeDate(2026, 12, 5))
    expect(stay()).toEqual({ guestName: 'Grace', guests: '5', checkIn: '2026-12-05' })
    s.done()
  })
})
