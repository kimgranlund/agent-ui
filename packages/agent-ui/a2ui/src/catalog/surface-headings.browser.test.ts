import { describe, it, expect, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { createRenderer } from '../renderer/renderer.ts'

// T-0418 (Kim 2026-10-22): one heading scale for surface titles. Every title slot renders through the real renderer
// on the canvas register (widget, scale md) and must compute to one of the two approved roles: the surface title
// (--md-sys-type-subhead at 600, line height 1.3) or the section title (--md-sys-type-title at 600, line height 1.4).
// A CardHeader also sits one card gutter (--md-sys-card-gutter) above its content. The expected values come from
// the tokens resolved on the surface, and the widget md literals (17px and 14px, 12px gutter) pin the register too.

type Spec = { catalog: string; components: unknown[]; data?: Record<string, unknown> }

const mounted: Array<{ dispose(): void; el: HTMLElement }> = []
afterEach(() => {
  for (const m of mounted.splice(0)) {
    m.dispose()
    m.el.remove()
  }
})

const render = async (spec: Spec): Promise<HTMLElement> => {
  const el = document.createElement('div')
  el.style.inlineSize = '400px'
  document.body.append(el)
  const r = createRenderer()
  r.mount(el)
  mounted.push({ dispose: () => r.dispose(), el })
  await r.preload(spec.catalog)
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: spec.catalog } } as never)
  for (const [path, value] of Object.entries(spec.data ?? {})) r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's', path, value } } as never)
  r.ingestMessage({ version: 'v1.0', updateComponents: { surfaceId: 's', components: spec.components } } as never)
  r.finalize('s')
  await whenFlushed()
  for (const node of el.querySelectorAll('*')) {
    const pending = (node as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    if (pending !== undefined) await pending
  }
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  const surface = el.querySelector('[data-a2ui-surface]') as HTMLElement
  expect(surface, 'anti-vacuous: the surface rendered').not.toBeNull()
  expect([surface.getAttribute('data-tier'), surface.getAttribute('data-scale')]).toEqual(['widget', 'md'])
  return surface
}

/** A token's px value resolved at `at`. */
const tokenPx = (at: Element, token: string): number => {
  const probe = document.createElement('div')
  probe.style.inlineSize = `var(${token})`
  probe.style.position = 'absolute'
  at.append(probe)
  const px = probe.getBoundingClientRect().width
  probe.remove()
  return px
}

const ROLES = {
  surface: { token: '--md-sys-type-subhead', px: 17, weight: '600', lineHeight: 1.3 },
  section: { token: '--md-sys-type-title', px: 14, weight: '600', lineHeight: 1.4 },
} as const

const expectRole = (surface: HTMLElement, selector: string, role: keyof typeof ROLES): void => {
  const el = surface.querySelector(selector)
  expect(el, `anti-vacuous: ${selector} rendered`).not.toBeNull()
  const want = ROLES[role]
  const cs = getComputedStyle(el!)
  const size = parseFloat(cs.fontSize)
  expect(size, `${selector} size = ${want.token} on the surface`).toBe(tokenPx(surface, want.token))
  expect(size, `${selector} size at widget md`).toBe(want.px)
  expect(cs.fontWeight, `${selector} weight`).toBe(want.weight)
  expect(parseFloat(cs.lineHeight), `${selector} line height`).toBeCloseTo(want.px * want.lineHeight, 1)
}

const card = (variant: string): Spec => ({
  catalog: 'agent-ui',
  components: [
    { id: 'root', component: 'Card', children: ['hd', 'ct'] },
    { id: 'hd', component: 'CardHeader', children: ['t'] },
    { id: 't', component: 'Text', variant, text: 'Dinner style for the week' },
    { id: 'ct', component: 'CardContent', children: ['dl'] },
    { id: 'dl', component: 'DescriptionList', rows: [{ label: 'Monday', value: 'Mung dal kitchari' }] },
  ],
})

describe('surface title role (T-0418)', () => {
  it('OptionDeck heading, and its card titles at the section role', async () => {
    const s = await render({
      catalog: 'agent-ui',
      components: [{ id: 'root', component: 'OptionDeck', heading: 'What temperament should the agent have?', options: [{ value: 'a', title: 'Warm' }, { value: 'b', title: 'Calm' }] }],
    })
    expectRole(s, 'ui-option-deck > [data-part="heading"]', 'surface')
    expectRole(s, 'ui-option-deck [data-part="title"]', 'section')
  })

  it('OptionCompare heading', async () => {
    const s = await render({
      catalog: 'agent-ui',
      components: [{
        id: 'root', component: 'OptionCompare', heading: 'Compare the plans', rows: [{ key: 'p', label: 'Price' }],
        options: [{ value: 'a', title: 'Starter', values: { p: '$9' } }, { value: 'b', title: 'Team', values: { p: '$29' } }],
      }],
    })
    expectRole(s, 'ui-option-compare > [data-part="heading"]', 'surface')
  })

  for (const variant of ['h3', 'h4', 'h5']) {
    it(`a ${variant} Text inside CardHeader is the surface title, by position`, async () => {
      expectRole(await render(card(variant)), 'ui-card-header ui-text', 'surface')
    })
  }

  it('ConfirmReceipt title', async () => {
    const s = await render({
      catalog: 'agent-ui',
      components: [{ id: 'root', component: 'ConfirmReceipt', title: 'Your order', items: [{ label: 'Kitchari kit', amount: '$18.00' }] }],
    })
    expectRole(s, 'ui-confirm-receipt [data-part="title"]', 'surface')
  })

  it('BookingForm title', async () => {
    const s = await render({
      catalog: 'agent-ui--hospitality',
      data: { '/booking': { covers: 2 } },
      components: [
        { id: 'root', component: 'BookingForm', title: 'Book a table at Vela', fields: [{ kind: 'stepper', path: 'covers', label: 'Covers', min: 1, max: 12, step: 1 }], value: { path: '/booking' }, child: 'go' },
        { id: 'go', component: 'Button', variant: 'solid', label: 'Confirm', action: { action: 'book', submit: true } },
      ],
    })
    expectRole(s, 'ui-text[data-part="title"]', 'surface')
  })
})

describe('section title role (T-0418)', () => {
  for (const variant of ['h3', 'h4']) {
    it(`a ${variant} Text outside a CardHeader (a List title)`, async () => {
      const s = await render({
        catalog: 'agent-ui',
        components: [
          { id: 'root', component: 'Column', children: ['t', 'l'] },
          { id: 't', component: 'Text', variant, text: 'Shopping list' },
          { id: 'l', component: 'List', children: ['a'] },
          { id: 'a', component: 'Text', text: 'Mung dal, 500 g' },
        ],
      })
      expectRole(s, `ui-text[as="${variant}"]`, 'section')
    })
  }
})

describe('CardHeader to content gap (T-0418)', () => {
  it('the header title sits one card gutter above the first content child', async () => {
    const s = await render(card('h3'))
    const title = s.querySelector('ui-card-header ui-text')!
    const first = s.querySelector('ui-card-content > *')!
    expect(first, 'anti-vacuous: the content has a child').not.toBeNull()
    const gap = first.getBoundingClientRect().top - title.getBoundingClientRect().bottom
    const gutter = tokenPx(title.closest('ui-card')!, '--md-sys-card-gutter')
    expect(gutter, 'the card gutter at widget md').toBe(12)
    expect(gap).toBeCloseTo(gutter, 1)
  })
})
