import { describe, it, expect, afterEach, vi } from 'vitest'
import { UIStepFlowElement } from './step-flow.ts'

// step-flow.test.ts: jsdom probes for ui-step-flow (T-0198). jsdom cannot prove paint or geometry
// (step-flow.browser.test.ts owns that); this pins the declared behaviour: one scene shown per `step` with the rest
// hidden and inert, the header first and the actions row last, Back absent on step 1, Next refused on an invalid
// field, the finish emit carrying `draft`, a recount after a scene is added, `data-self-commit` only on the last
// scene with no `finishAction`, and ARIA through internals.

class ProbeStepFlow extends UIStepFlowElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-step-flow-probe', ProbeStepFlow)

/** A scene field the Next gate reads: duck-typed constraint validation, with a spy on the report. */
class ProbeField extends HTMLElement {
  valid = true
  willValidate = true
  reportValidity = vi.fn(() => this.valid)
  checkValidity(): boolean {
    return this.valid
  }
}
customElements.define('step-flow-probe-field', ProbeField)

const mounted: HTMLElement[] = []
function make(scenes: number, init: (el: ProbeStepFlow) => void = () => {}): ProbeStepFlow {
  const el = new ProbeStepFlow()
  for (let i = 0; i < scenes; i++) el.append(scene(`scene ${i + 1}`))
  init(el)
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const scene = (text: string): HTMLElement => {
  const node = document.createElement('div')
  node.textContent = text
  return node
}
const q = (el: Element, sel: string): HTMLElement | null => el.querySelector(sel)
const scenesOf = (el: Element): HTMLElement[] => Array.from(el.children).filter((c) => !(c as HTMLElement).dataset.part) as HTMLElement[]
const childParts = (el: Element): (string | undefined)[] => Array.from(el.children).map((c) => (c as HTMLElement).dataset.part)
const actionParts = (el: Element): (string | undefined)[] => Array.from(q(el, '[data-part="actions"]')!.children).map((c) => (c as HTMLElement).dataset.part)
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const click = (el: Element, name: string): void => q(el, `:scope > [data-part="actions"] > [data-part="${name}"]`)!.click()

describe('UIStepFlowElement: scenes and step', () => {
  it('shows only the scene at step; the rest carry hidden and inert', async () => {
    const el = make(3, (e) => (e.step = 2))
    await tick()
    const visible = scenesOf(el).map((s) => [s.hidden, s.hasAttribute('inert')])
    expect(visible).toEqual([[true, true], [false, false], [true, true]])
    el.step = 3
    await tick()
    expect(scenesOf(el).map((s) => s.hidden)).toEqual([true, true, false])
  })

  it('an out-of-range step reads clamped and is never written back', async () => {
    const el = make(3, (e) => (e.step = 9))
    await tick()
    expect(scenesOf(el).map((s) => s.hidden)).toEqual([true, true, false])
    expect(el.step).toBe(9)
    expect(q(el, '[data-part="position"]')!.textContent).toBe('Step 3 of 3')
  })

  it('the header is the first child and the actions row the last, the scenes between', () => {
    const el = make(2)
    expect(childParts(el)).toEqual(['header', undefined, undefined, 'actions'])
    expect(Array.from(q(el, '[data-part="header"]')!.children).map((c) => (c as HTMLElement).dataset.part)).toEqual(['position', 'label', 'bar'])
  })

  it('position, label and one segment per scene with done, current and upcoming', async () => {
    const el = make(4, (e) => {
      e.steps = ['Dates', 'Guests']
      e.step = 2
    })
    await tick()
    expect(q(el, '[data-part="position"]')!.textContent).toBe('Step 2 of 4')
    expect(q(el, '[data-part="label"]')!.textContent).toBe('Guests')
    expect(q(el, '[data-part="label"]')!.tabIndex).toBe(-1)
    const states = Array.from(el.querySelectorAll('[data-part="segment"]')).map((s) => (s as HTMLElement).dataset.state)
    expect(states).toEqual(['done', 'current', 'upcoming', 'upcoming'])
    el.step = 4
    await tick()
    expect(q(el, '[data-part="label"]')!.textContent).toBe('Step 4') // no label at index 3
  })

  it('a recount after a child is added: the segment count and the actions row stay right', async () => {
    const el = make(2, (e) => (e.step = 2))
    await tick()
    expect(actionParts(el)).toEqual(['back'])
    el.append(scene('scene 3')) // the renderer appends a new scene after the actions row
    await tick()
    await tick()
    expect(childParts(el)).toEqual(['header', undefined, undefined, undefined, 'actions'])
    expect(el.querySelectorAll('[data-part="segment"]')).toHaveLength(3)
    expect(q(el, '[data-part="position"]')!.textContent).toBe('Step 2 of 3')
    expect(actionParts(el)).toEqual(['back', 'next'])
    expect(scenesOf(el)[2]!.hidden).toBe(true)
  })

  it('removing a scene recounts too', async () => {
    const el = make(3, (e) => (e.step = 3))
    await tick()
    scenesOf(el)[2]!.remove()
    await tick()
    await tick()
    expect(el.querySelectorAll('[data-part="segment"]')).toHaveLength(2)
    expect(q(el, '[data-part="position"]')!.textContent).toBe('Step 2 of 2')
  })
})

describe('UIStepFlowElement: Back and Next', () => {
  it('Back is absent on step 1; Next is absent on the last scene', async () => {
    const el = make(3)
    await tick()
    expect(actionParts(el)).toEqual(['next'])
    el.step = 2
    await tick()
    expect(actionParts(el)).toEqual(['back', 'next'])
    el.step = 3
    await tick()
    expect(actionParts(el)).toEqual(['back'])
  })

  it('Next writes step, emits change with the new step, and moves focus to the label', async () => {
    const el = make(3)
    await tick()
    const seen: unknown[] = []
    el.addEventListener('change', (e) => seen.push([(e as CustomEvent).detail, el.step]))
    click(el, 'next')
    expect(seen).toEqual([[2, 2]])
    expect(document.activeElement).toBe(q(el, '[data-part="label"]'))
    await tick()
    click(el, 'back')
    expect(seen).toEqual([[2, 2], [1, 1]])
  })

  it('Next refused on an invalid field: reports the first invalid field, stays, emits nothing', async () => {
    const el = make(2)
    const first = new ProbeField()
    const second = new ProbeField()
    first.valid = false
    second.valid = false
    scenesOf(el)[0]!.append(first, second)
    await tick()
    const change = vi.fn()
    el.addEventListener('change', change)
    click(el, 'next')
    expect(first.reportValidity).toHaveBeenCalledTimes(1)
    expect(second.reportValidity).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalled()
    expect(el.step).toBe(1)
    first.valid = true
    second.valid = true
    click(el, 'next')
    expect(el.step).toBe(2)
  })

  it('Next is never disabled', async () => {
    const el = make(2)
    const field = new ProbeField()
    field.valid = false
    scenesOf(el)[0]!.append(field)
    await tick()
    const next = q(el, '[data-part="next"]') as HTMLButtonElement
    expect(next.disabled).toBe(false)
    expect(next.hasAttribute('aria-disabled')).toBe(false)
  })
})

describe('UIStepFlowElement: finish and the self-commit row', () => {
  it('the finish emit carrying draft, folded into the action context', async () => {
    const el = make(2, (e) => {
      e.step = 2
      e.finishAction = { action: 'review_stay', context: { from: 'wizard' } }
      e.finishLabel = 'Review'
      e.draft = { guests: 2, room: 'deluxe' }
    })
    await tick()
    expect(actionParts(el)).toEqual(['back', 'finish'])
    expect(q(el, '[data-part="finish"]')!.textContent).toBe('Review')
    const seen: unknown[] = []
    el.addEventListener('action', (e) => seen.push((e as CustomEvent).detail))
    click(el, 'finish')
    expect(seen).toEqual([{ action: 'review_stay', context: { from: 'wizard', draft: { guests: 2, room: 'deluxe' } } }])
  })

  it('finish is gated on the last scene like Next', async () => {
    const el = make(1, (e) => (e.finishAction = { action: 'go' }))
    const field = new ProbeField()
    field.valid = false
    scenesOf(el)[0]!.append(field)
    await tick()
    const action = vi.fn()
    el.addEventListener('action', action)
    click(el, 'finish')
    expect(action).not.toHaveBeenCalled()
    expect(field.reportValidity).toHaveBeenCalledTimes(1)
  })

  it('data-self-commit set only on the last scene with no finishAction; Back steps down to md there', async () => {
    const el = make(3, (e) => (e.step = 2))
    await tick()
    const actions = q(el, '[data-part="actions"]')!
    expect(actions.hasAttribute('data-self-commit')).toBe(false)
    expect(q(el, '[data-part="back"]')!.dataset.size).toBe('lg')
    el.step = 3
    await tick()
    expect(actions.hasAttribute('data-self-commit')).toBe(true)
    expect(q(el, '[data-part="back"]')!.dataset.size).toBe('md')
    el.finishAction = { action: 'go' }
    await tick()
    expect(actions.hasAttribute('data-self-commit')).toBe(false)
    expect(q(el, '[data-part="back"]')!.dataset.size).toBe('lg')
  })
})

describe('UIStepFlowElement: ARIA through internals', () => {
  it('role group named by the current label; no host role or aria attribute', async () => {
    const el = make(2, (e) => (e.steps = ['Dates', 'Guests']))
    await tick()
    expect(el.probeInternals.role).toBe('group')
    expect(el.probeInternals.ariaLabel).toBe('Dates')
    expect(el.hasAttribute('role')).toBe(false)
    expect(Array.from(el.attributes).some((a) => a.name.startsWith('aria-'))).toBe(false)
    const label = q(el, '[data-part="label"]')!
    expect(label.getAttribute('aria-describedby')).toBe(q(el, '[data-part="position"]')!.id)
    expect(q(el, '[data-part="bar"]')!.getAttribute('aria-hidden')).toBe('true')
  })
})
