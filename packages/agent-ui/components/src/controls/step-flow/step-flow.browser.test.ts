import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// step-flow.browser.test.ts: the real-engine painted proof for ui-step-flow (T-0198, Direction B). jsdom is blind to
// layout and focus, so this covers fill and hug, keyboard activation of the native Back and Next, focus landing on
// the label, validity reporting from a real FACE field, a hidden scene with an inline display taking no space (the
// BookingForm root sets one), the actions at their own lg step (28px on an A2UI canvas, ADR-0245 Amendment 2), the
// current segment's shape cue, and the self-commit row Kim drew on 2026-10-21.
//
// Side-effect imports, load-bearing order (ADR-0003): foundation roles and ramps first, then the sheets, then the
// controls.
import '@agent-ui/components/foundation-styles.css'
import '../button/button.css'
import '../form-provider/form-provider.css'
import '../text-field/text-field.css'
import './step-flow.css'
import '../button/button.ts'
import '../form-provider/form-provider.ts'
import '../text-field/text-field.ts'
import './step-flow.ts'
import type { UIStepFlowElement } from './step-flow.ts'

const mounted: HTMLElement[] = []
const container = (width: string, attrs: Record<string, string> = {}): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.cssText = `inline-size:${width}; padding:0; margin:0;`
  for (const [k, v] of Object.entries(attrs)) wrap.setAttribute(k, v)
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const CANVAS = { 'data-tier': 'widget', 'data-scale': 'md' }

const flow = (parent: HTMLElement, scenes: string[], init: (el: UIStepFlowElement) => void = () => {}): UIStepFlowElement => {
  const el = document.createElement('ui-step-flow') as UIStepFlowElement
  el.innerHTML = scenes.join('')
  init(el)
  parent.append(el)
  return el
}

const settle = async (el: HTMLElement): Promise<void> => {
  await (el as UIStepFlowElement).updateComplete
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

const partOf = (el: Element, name: string): HTMLElement => el.querySelector(`:scope > * > [data-part="${name}"]`) as HTMLElement
const box = (node: Element): DOMRect => node.getBoundingClientRect()

const TEXT_SCENES = ['<div>Pick your dates</div>', '<div>How many guests</div>', '<div>Any extras</div>']

describe('ui-step-flow: sizing (ADR-0223)', () => {
  it('fills its container by default and hugs under inline', async () => {
    const wrap = container('640px')
    const fill = flow(wrap, TEXT_SCENES)
    const hug = flow(wrap, TEXT_SCENES, (el) => (el.inline = true))
    await settle(fill)
    expect(box(fill).width).toBeCloseTo(640, 0)
    expect(box(hug).width).toBeLessThan(640)
  })
})

describe('ui-step-flow: keyboard, focus and validity', () => {
  it('keyboard activation: Enter on Next and Space on Back move the step', async () => {
    const el = flow(container('400px', CANVAS), TEXT_SCENES)
    await settle(el)
    partOf(el, 'next').focus()
    await userEvent.keyboard('{Enter}')
    await settle(el)
    expect(el.step).toBe(2)
    partOf(el, 'back').focus()
    await userEvent.keyboard(' ')
    await settle(el)
    expect(el.step).toBe(1)
  })

  it('focus landing on the indicator label after Next and after Back, never a Tab stop', async () => {
    const el = flow(container('400px', CANVAS), TEXT_SCENES, (e) => (e.steps = ['Dates', 'Guests', 'Extras']))
    await settle(el)
    const label = el.querySelector('[data-part="label"]') as HTMLElement
    const position = el.querySelector('[data-part="position"]') as HTMLElement
    partOf(el, 'next').click()
    // At focus time, before any settle: the label and position already name the new scene.
    expect(document.activeElement).toBe(label)
    expect(label.textContent).toBe('Guests')
    expect(position.textContent).toBe('Step 2 of 3')
    await settle(el)
    expect(label.textContent).toBe('Guests')
    partOf(el, 'back').click()
    expect(label.textContent).toBe('Dates')
    await settle(el)
    expect(document.activeElement).toBe(label)
    expect(label.textContent).toBe('Dates')
    expect(label.tabIndex).toBe(-1)
  })

  it('validity reporting: Next on an empty required field reports it and stays; filled, Next moves', async () => {
    const el = flow(container('400px', CANVAS), ['<div><ui-text-field label="Arrival" required></ui-text-field></div>', '<div>Guests</div>'])
    await settle(el)
    const field = el.querySelector('ui-text-field') as HTMLElement & { value: string; validity: ValidityState }
    await settle(field)
    let invalid = 0
    field.addEventListener('invalid', () => (invalid += 1))
    let changes = 0
    el.addEventListener('change', (e) => {
      if (e.target === el) changes += 1
    })
    partOf(el, 'next').click()
    await settle(el)
    expect(el.step).toBe(1)
    expect(changes).toBe(0)
    expect(invalid, 'checkValidity then reportValidity each fire invalid').toBeGreaterThanOrEqual(1)
    expect(field.validity.valueMissing).toBe(true)
    expect(partOf(el, 'next').hasAttribute('disabled')).toBe(false)
    field.value = '2026-11-14'
    await settle(field)
    partOf(el, 'next').click()
    await settle(el)
    expect(el.step).toBe(2)
    expect(changes).toBe(1)
  })
})

describe('ui-step-flow: geometry on the A2UI canvas', () => {
  it('a hidden scene with an inline display takes no space', async () => {
    const el = flow(container('400px', CANVAS), [
      '<div>Pick your dates</div>',
      '<div style="display:flex; flex-direction:column; block-size:200px">Guests</div>',
    ])
    await settle(el)
    const [first, second] = Array.from(el.children).filter((c) => !(c as HTMLElement).dataset.part) as HTMLElement[]
    expect(second!.hidden).toBe(true)
    expect(getComputedStyle(second!).display).toBe('none')
    expect(box(second!).height).toBe(0)
    const header = el.querySelector(':scope > [data-part="header"]')!
    const actions = el.querySelector(':scope > [data-part="actions"]')!
    expect(box(first!).top).toBeGreaterThan(box(header).bottom)
    expect(box(actions).top).toBeGreaterThan(box(first!).bottom)
    expect(box(el).bottom).toBeCloseTo(box(actions).bottom, 0)
    expect(box(el).height).toBeLessThan(200)
  })

  it('Back and Next are the lg step, 28px on the canvas and 40px at the root; the current segment is taller', async () => {
    const onCanvas = flow(container('400px', CANVAS), TEXT_SCENES, (e) => (e.step = 2))
    const atRoot = flow(container('400px'), TEXT_SCENES, (e) => (e.step = 2))
    await settle(onCanvas)
    for (const name of ['back', 'next']) {
      expect(box(partOf(onCanvas, name)).height, `${name} on the canvas`).toBeCloseTo(28, 0)
      expect(box(partOf(atRoot, name)).height, `${name} at the root`).toBeCloseTo(40, 0)
    }
    expect(box(partOf(onCanvas, 'back')).left).toBeCloseTo(box(onCanvas).left, 0)
    expect(box(partOf(onCanvas, 'next')).right).toBeCloseTo(box(onCanvas).right, 0)
    const segments = Array.from(onCanvas.querySelectorAll('[data-part="segment"]')).map((s) => box(s).height)
    expect(segments[1]).toBeGreaterThan(segments[0]!)
    expect(segments[0]).toBeCloseTo(segments[2]!, 1)
  })

  it('on a self-committing last scene, Back shares one row with the commit Button, Back leading', async () => {
    const el = flow(
      container('400px', CANVAS),
      [
        '<div>Pick your dates</div>',
        '<ui-form-provider style="display:flex; flex-direction:column; align-items:flex-end; gap:var(--md-sys-widget-gutter)">' +
          '<div data-part="card" style="align-self:stretch; block-size:120px; border:1px solid currentColor">Your stay</div>' +
          '<ui-button size="md">Book stay</ui-button>' +
          '</ui-form-provider>',
      ],
      (e) => (e.step = 2),
    )
    await settle(el)
    const form = el.querySelector('ui-form-provider') as HTMLElement
    const commit = form.querySelector('ui-button') as HTMLElement
    await settle(commit)
    const back = partOf(el, 'back')
    expect(commit.parentElement, 'the commit stays a direct child of the form root').toBe(form)
    expect(el.querySelector(':scope > [data-part="actions"]')!.hasAttribute('data-self-commit')).toBe(true)
    expect(Math.abs(box(back).bottom - box(commit).bottom), 'one row: shared bottom').toBeLessThanOrEqual(1)
    expect(Math.abs(box(back).height - box(commit).height), 'one row: shared height').toBeLessThanOrEqual(1)
    expect(box(back).height, 'Back steps down to md, 24px on the canvas').toBeCloseTo(24, 0)
    expect(Math.abs(box(back).left - box(form).left), "Back at the scene's start edge").toBeLessThanOrEqual(1)
    expect(box(back).right, 'Back ends before the commit starts').toBeLessThan(box(commit).left)
    expect(Math.abs(box(el).bottom - box(form).bottom), 'no actions track or gap under the scene').toBeLessThanOrEqual(1)
  })
})
