// factories.test.ts: the `stylist` persona's factory table (ADR-0244 cl.3, T-0090), the quizmaster precedent.
// Probes run on detached elements: the DOM shape, the pills, the Unrated state and the group's name. The painted
// colors and the geometry are real-engine facts, held by `contrast-pair.browser.test.ts`.

import { describe, it, expect } from 'vitest'
import { contrastPairFactory, stylistFactories, SAMPLE_LINE } from './factories.ts'
import { stylistFragment } from './index.ts'

type Pill = HTMLElement & { label: string; intent: string }

const part = (el: HTMLElement, name: string): HTMLElement => el.querySelector(`[data-part="${name}"]`) as HTMLElement
const pills = (el: HTMLElement): Pill[] => [...el.querySelectorAll('[data-part="verdict"]')] as Pill[]

function pair(props: Record<string, unknown>): HTMLElement {
  const el = contrastPairFactory.create()
  for (const [prop, value] of Object.entries(props)) contrastPairFactory.applyProp(el, prop, value)
  return el
}

describe('ContrastPair factory table', () => {
  it('ContrastPair: one factory per fragment component type, no gap, no extra', () => {
    expect(Object.keys(stylistFactories).sort()).toEqual(Object.keys(stylistFragment.components).sort())
  })

  it('ContrastPair: the tag is ui-card, create() mints an unparented ui-card, and uses names ui-badge and ui-text', () => {
    expect(contrastPairFactory.tag).toBe('ui-card')
    const el = contrastPairFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-card')
    expect(el.parentNode).toBeNull()
    expect([...(contrastPairFactory.uses ?? [])].sort()).toEqual(['ui-badge', 'ui-text'])
  })

  it('ContrastPair: display only, so no value mark and no submit gate', () => {
    expect(contrastPairFactory.value).toBeUndefined()
    expect(contrastPairFactory.submitGate).toBeUndefined()
    expect(stylistFragment.components.ContrastPair!.value).toBeUndefined()
  })

  it('ContrastPair: the parts are header, sample, verdicts and values, in order', () => {
    const el = contrastPairFactory.create()
    expect([...el.children].map((c) => c.getAttribute('data-part'))).toEqual(['header', 'sample', 'verdicts', 'values'])
    expect([...part(el, 'header').children].map((c) => c.getAttribute('data-part'))).toEqual(['label', 'ratio'])
    expect(part(el, 'sample-large').textContent).toBe('Aa')
    expect(part(el, 'sample-body').textContent).toBe(SAMPLE_LINE)
  })

  it('ContrastPair: a payload with every prop absent mounts as an Unrated pair', () => {
    const el = contrastPairFactory.create()
    expect(el.getAttribute('data-rated')).toBe('false')
    expect(part(el, 'ratio').textContent).toBe('Unrated')
    expect(part(el, 'verdicts').style.display).toBe('none')
  })

  it('#777777 on #ffffff: the header ratio reads 4.47:1 and the pills read Fail, Pass, Fail with their intents', () => {
    const el = pair({ label: 'Muted caption', foreground: '#777777', background: '#ffffff' })
    expect(el.getAttribute('data-rated')).toBe('true')
    expect(part(el, 'label').textContent).toBe('Muted caption')
    expect(part(el, 'ratio').textContent).toBe('4.47:1')
    expect(part(el, 'verdicts').style.display).toBe('flex')
    expect(pills(el).map((p) => [p.getAttribute('data-floor'), p.label, p.intent, p.getAttribute('data-verdict')])).toEqual([
      ['aa-body', 'AA body 4.5 Fail', 'danger', 'fail'],
      ['aa-large', 'AA large 3 Pass', 'success', 'pass'],
      ['aaa-body', 'AAA body 7 Fail', 'danger', 'fail'],
    ])
    expect(part(el, 'values').textContent).toBe('#777777 on #ffffff')
  })

  it('#000000 on #ffffff: 21.00:1 and every pill passes with the success intent', () => {
    const el = pair({ foreground: '#000000', background: '#ffffff' })
    expect(part(el, 'ratio').textContent).toBe('21.00:1')
    expect(pills(el).map((p) => p.intent)).toEqual(['success', 'success', 'success'])
    expect(pills(el).every((p) => p.label.endsWith(' Pass'))).toBe(true)
  })

  it('a pair just under 4.5 shows 4.49:1 and an AA body Fail, never 4.50', () => {
    const el = pair({ foreground: '#946894', background: '#ffffff' })
    expect(part(el, 'ratio').textContent).toBe('4.49:1')
    expect(pills(el)[0]!.label).toBe('AA body 4.5 Fail')
  })

  it('Unrated (translucent background): no ratio, no pills, the raw values kept', () => {
    const el = pair({ label: 'Overlay', foreground: '#ffffff99', background: '#14142880' })
    expect(el.getAttribute('data-rated')).toBe('false')
    expect(part(el, 'ratio').textContent).toBe('Unrated')
    expect(part(el, 'verdicts').style.display).toBe('none')
    expect(part(el, 'values').textContent).toBe('#ffffff99 on #14142880')
  })

  it('Unrated (unparseable): a rated pair whose foreground turns unparseable drops its ratio and pills', () => {
    const el = pair({ foreground: '#000000', background: '#ffffff' })
    contrastPairFactory.applyProp(el, 'foreground', 'rgb(0, 0, 0)')
    expect(el.getAttribute('data-rated')).toBe('false')
    expect(part(el, 'ratio').textContent).toBe('Unrated')
    expect(part(el, 'verdicts').style.display).toBe('none')
    expect(part(el, 'values').textContent).toBe('rgb(0, 0, 0) on #ffffff')
  })

  it('the group name is composed text: label, both values, the ratio "to 1" and the floors it passes', () => {
    const el = pair({ label: 'Muted caption', foreground: '#777777', background: '#ffffff' })
    expect(el.getAttribute('aria-label')).toBe('Muted caption, #777777 on #ffffff, contrast 4.47 to 1, passes AA large')
    contrastPairFactory.applyProp(el, 'foreground', '#000000')
    expect(el.getAttribute('aria-label')).toBe('Muted caption, #000000 on #ffffff, contrast 21.00 to 1, passes AA body, AA large, AAA body')
    contrastPairFactory.applyProp(el, 'background', '#ffffff80')
    expect(el.getAttribute('aria-label')).toBe('Muted caption, #000000 on #ffffff80, contrast unrated')
  })

  it('the card carries its name from create(), so ui-card mints its group role at connect', () => {
    expect(contrastPairFactory.create().getAttribute('aria-label')).toBe('Contrast pair, unset on unset, contrast unrated')
  })

  it('sample replaces the large specimen and falls back to Aa when cleared', () => {
    const el = pair({ sample: 'Hello' })
    expect(part(el, 'sample-large').textContent).toBe('Hello')
    contrastPairFactory.applyProp(el, 'sample', '')
    expect(part(el, 'sample-large').textContent).toBe('Aa')
  })

  it('an unknown prop is a no-op and never throws', () => {
    const el = contrastPairFactory.create()
    const before = el.innerHTML
    expect(() => contrastPairFactory.applyProp(el, 'unknownProp', 'x')).not.toThrow()
    expect(el.innerHTML).toBe(before)
  })

  it('no part carries a border-left of its own', () => {
    const el = pair({ foreground: '#777777', background: '#ffffff' })
    for (const node of [el, ...el.querySelectorAll<HTMLElement>('*')]) {
      expect(node.getAttribute('style') ?? '', node.getAttribute('data-part') ?? node.tagName).not.toMatch(/border-(left|inline-start)/)
    }
  })
})
