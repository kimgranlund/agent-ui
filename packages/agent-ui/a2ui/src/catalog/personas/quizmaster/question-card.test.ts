// question-card.test.ts: QuestionCard through the real renderer in jsdom (T-0074, the croupier
// `templated-hand.test.ts` pattern). The derived `agent-ui--quizmaster` id is a lazy record (ADR-0241), so
// each render awaits its load before ingesting. jsdom lacks `ElementInternals.setFormValue`/`setValidity`,
// which the connected `ui-radio-group`/`ui-radio` call, so the suite stubs them (the `persona-exemplars.test.ts`
// precedent) and restores them after.

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
  { value: 'mars', label: 'Mars' },
]

interface RadioEl extends HTMLElement {
  value: string
  checked: boolean
}

const line = (msg: unknown): string => JSON.stringify(msg)
const write = (path: string, value: unknown): string => line({ version: 'v1.0', updateDataModel: { surfaceId: SID, path, value } })

async function render(card: Record<string, unknown>): Promise<{ mount: HTMLElement; ingest: (l: string) => void; errors: () => A2uiClientMessage[]; cleanup: () => void }> {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer()
  await r.preload(CATALOG)
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: SID, catalogId: CATALOG } }))
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
        ],
      },
    }),
  )
  await whenFlushed()
  return {
    mount,
    ingest: (l) => r.ingest(l),
    errors: () => sent.filter(isError),
    cleanup: () => {
      r.dispose()
      mount.remove()
    },
  }
}

const BOUND = {
  question: 'Which planet is closest to the Sun?',
  options: OPTIONS,
  name: 'round1',
  value: { path: '/answer' },
  revealed: { path: '/revealed' },
  explanation: 'Mercury orbits closest to the Sun.',
  progress: { value: 1, max: 5 },
}

const radiosIn = (mount: HTMLElement): RadioEl[] => [...mount.querySelectorAll('ui-radio')] as RadioEl[]

describe('QuestionCard through the real renderer', () => {
  it('QuestionCard renders one radio per option, in order, labelled by text content', async () => {
    const { mount, errors, cleanup } = await render(BOUND)
    expect(errors()).toEqual([])
    const radios = radiosIn(mount)
    expect(radios.map((r) => [r.value, r.textContent])).toEqual(OPTIONS.map((o) => [o.value, o.label]))
    expect(mount.querySelector('[data-part="question"]')?.textContent).toBe(BOUND.question)
    expect((mount.querySelector('[data-part="options"]') as unknown as { name: string }).name).toBe('round1')
    cleanup()
  })

  it('QuestionCard: a radio click commits value to the bound data-model path', async () => {
    const { mount, errors, cleanup } = await render(BOUND)
    radiosIn(mount)[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await whenFlushed()
    expect(errors()).toEqual([])
    expect((mount.querySelector('[data-part="options"]') as unknown as { value: string }).value).toBe('mars')
    // the sibling Text bound to the same /answer path reads the committed value back
    const echo = [...mount.querySelectorAll('ui-text')].find((t) => t.closest('ui-card') === null)
    expect(echo?.textContent).toBe('mars')
    cleanup()
  })

  it('QuestionCard: a data-model write selects the matching radio', async () => {
    const { mount, ingest, errors, cleanup } = await render(BOUND)
    ingest(write('/answer', 'venus'))
    await whenFlushed()
    expect(errors()).toEqual([])
    expect(radiosIn(mount).map((r) => r.checked)).toEqual([false, true, false])
    cleanup()
  })

  it('QuestionCard: revealed disables the options and opens the explanation, and false undoes both', async () => {
    const { mount, ingest, errors, cleanup } = await render(BOUND)
    const group = mount.querySelector('[data-part="options"]') as unknown as { disabled: boolean }
    const fold = mount.querySelector('[data-part="explanation"]') as unknown as { open: boolean; textContent: string }
    expect(group.disabled).toBe(false)
    expect(fold.open).toBe(false)
    ingest(write('/revealed', true))
    await whenFlushed()
    expect(group.disabled).toBe(true)
    expect(fold.open).toBe(true)
    expect(fold.textContent).toContain(BOUND.explanation)
    ingest(write('/revealed', false))
    await whenFlushed()
    expect(group.disabled).toBe(false)
    expect(fold.open).toBe(false)
    expect(errors()).toEqual([])
    cleanup()
  })

  it('QuestionCard: no element style carries border-left, and each radio keeps a 44px minimum block size', async () => {
    const { mount, cleanup } = await render(BOUND)
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
    expect((mount.querySelector('[data-part="progress"]') as HTMLElement).style.display).toBe('none')
    cleanup()
  })
})
