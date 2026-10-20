import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { UIAmountPickerElement } from './amount-picker.ts'
import { amountFormatter, cleanPresets, presetsProp } from './amount-picker-model.ts'
import type { FormValue } from '../../dom/index.ts'

// ui-amount-picker jsdom probes (T-0196 Design, Test plan): clamp and snap on every write, the bound-side step
// buttons, the presets codec, the input/change/action order and none from programmatic writes, the formatter for
// number, USD, JPY and a unit, and the FACE form value. Keyboard, tab order, geometry and the slider sync run in
// the real engines (amount-picker.browser.test.ts).
//
// jsdom has no form-association surface (setFormValue/setValidity are absent). The composed ui-slider is a FACE
// control built by the picker itself, so the stub goes on the prototype before any element connects.

beforeAll(() => {
  const proto = (globalThis as unknown as { ElementInternals?: { prototype: Record<string, unknown> } }).ElementInternals?.prototype
  if (proto && typeof proto['setFormValue'] !== 'function') {
    proto['setFormValue'] = function setFormValue(): void {}
    proto['setValidity'] = function setValidity(): void {}
  }
})

class ProbePicker extends UIAmountPickerElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
  probeFormValue(): FormValue {
    return this.formValue()
  }
}
if (!customElements.get('ui-amount-picker-probe')) customElements.define('ui-amount-picker-probe', ProbePicker)

const made: HTMLElement[] = []
afterEach(() => {
  for (const el of made.splice(0)) el.remove()
})

function make(attrs: Record<string, string> = {}): ProbePicker {
  const el = new ProbePicker()
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  document.body.append(el)
  made.push(el)
  return el
}

const q = <T extends Element = HTMLElement>(el: Element, name: string): T | null => el.querySelector<T & Element>(`:scope [data-part="${name}"]`) as T | null
const btn = (el: Element, name: string): HTMLButtonElement => q<HTMLButtonElement>(el, name)!
const chips = (el: Element): HTMLButtonElement[] => Array.from(el.querySelectorAll<HTMLButtonElement>('[data-part="preset"]'))

function record(el: HTMLElement): { log: string[]; actions: unknown[] } {
  const log: string[] = []
  const actions: unknown[] = []
  for (const type of ['input', 'change', 'action']) {
    el.addEventListener(type, (event) => {
      if (event.target !== el) return
      log.push(`${type}:${(el as UIAmountPickerElement).value}`)
      if (type === 'action') actions.push((event as CustomEvent).detail)
    })
  }
  return { log, actions }
}

describe('ui-amount-picker: registration and roles', () => {
  it('self-defines the tag and the host is a group named by label through internals', () => {
    expect(customElements.get('ui-amount-picker')).toBe(UIAmountPickerElement)
    const el = make({ label: 'Quantity' })
    expect(el.probeInternals.role).toBe('group')
    expect(el.probeInternals.ariaLabel).toBe('Quantity')
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('the readout is the spinbutton with the value ARIA and the step buttons leave the tab order', () => {
    const el = make({ min: '1', max: '20', value: '4' })
    const readout = q(el, 'readout')!
    expect(readout.getAttribute('role')).toBe('spinbutton')
    expect(readout.getAttribute('tabindex')).toBe('0')
    expect(readout.getAttribute('aria-valuenow')).toBe('4')
    expect(readout.getAttribute('aria-valuemin')).toBe('1')
    expect(readout.getAttribute('aria-valuemax')).toBe('20')
    expect(readout.getAttribute('aria-valuetext')).toBe('4')
    expect(btn(el, 'decrease').tabIndex).toBe(-1)
    expect(btn(el, 'increase').tabIndex).toBe(-1)
    expect(btn(el, 'decrease').getAttribute('aria-label')).toBe('Decrease')
    expect(btn(el, 'increase').getAttribute('aria-label')).toBe('Increase')
  })
})

describe('ui-amount-picker: clamp and snap on every write', () => {
  it('clamps to the bounds and snaps to the step (the shared helper)', async () => {
    const el = make({ min: '0', max: '100', step: '5' })
    el.value = 7
    await el.updateComplete
    expect(el.value).toBe(5)
    el.value = 250
    await el.updateComplete
    expect(el.value).toBe(100)
    el.value = -3
    await el.updateComplete
    expect(el.value).toBe(0)
    el.min = 10
    await el.updateComplete
    expect(el.value).toBe(10)
  })

  it('the form value is the normalised value as a string', () => {
    const el = make({ min: '1', max: '8', value: '3' })
    expect(el.probeFormValue()).toBe('3')
    el.value = 99
    expect(el.probeFormValue()).toBe('8')
  })
})

describe('ui-amount-picker: the step buttons', () => {
  it('decrease is disabled at min and increase at max', async () => {
    const el = make({ min: '1', max: '3', value: '1' })
    expect(btn(el, 'decrease').disabled).toBe(true)
    expect(btn(el, 'increase').disabled).toBe(false)
    el.value = 3
    await el.updateComplete
    expect(btn(el, 'decrease').disabled).toBe(false)
    expect(btn(el, 'increase').disabled).toBe(true)
  })

  it('a host disabled disables every part and a press does nothing', () => {
    const el = make({ min: '0', max: '10', value: '5', presets: '[2,4]', 'action-name': 'go', disabled: '' })
    expect(btn(el, 'decrease').disabled).toBe(true)
    expect(btn(el, 'increase').disabled).toBe(true)
    expect(chips(el).every((c) => c.disabled)).toBe(true)
    expect(btn(el, 'commit').disabled).toBe(true)
    expect(q(el, 'readout')!.hasAttribute('tabindex')).toBe(false)
    const { log } = record(el)
    btn(el, 'increase').click()
    expect(el.value).toBe(5)
    expect(log).toEqual([])
  })
})

describe('ui-amount-picker: events', () => {
  it('a plus or minus press fires input then change; programmatic writes fire nothing', () => {
    const el = make({ min: '0', max: '10', value: '5' })
    const { log } = record(el)
    btn(el, 'increase').click()
    btn(el, 'decrease').click()
    btn(el, 'decrease').click()
    expect(log).toEqual(['input:6', 'change:6', 'input:5', 'change:5', 'input:4', 'change:4'])
    el.value = 9
    el.setAttribute('value', '2')
    expect(log.length).toBe(6)
  })

  it('a preset press writes the preset and fires input then change; the same preset again fires nothing', () => {
    const el = make({ min: '1', max: '20', value: '3', presets: '[1,2,4,8]' })
    const { log } = record(el)
    chips(el)[2]!.click()
    expect(el.value).toBe(4)
    chips(el)[2]!.click()
    expect(log).toEqual(['input:4', 'change:4'])
  })

  it('the commit fires action after the value write, with the number in context; none without actionName', async () => {
    const el = make({ min: '0', max: '10', value: '5', 'action-name': 'set_amount', 'action-label': 'Set' })
    const { log, actions } = record(el)
    btn(el, 'increase').click()
    btn(el, 'commit').click()
    expect(log).toEqual(['input:6', 'change:6', 'action:6'])
    expect(actions).toEqual([{ action: 'set_amount', context: { value: 6 } }])
    expect(btn(el, 'commit').textContent).toBe('Set')

    el.actionName = ''
    await el.updateComplete
    expect(q(el, 'commit')).toBeNull()
  })

  it('an empty actionLabel reads Confirm', () => {
    const el = make({ 'action-name': 'go' })
    expect(btn(el, 'commit').textContent).toBe('Confirm')
  })
})

describe('ui-amount-picker: presets', () => {
  it('the codec drops malformed JSON and non-finite entries, sorts and dedupes, and never throws', () => {
    expect(presetsProp.type.from('[8, 2, "x", 2, null, 4]')).toEqual([2, 4, 8])
    expect(presetsProp.type.from('not json')).toEqual([])
    expect(presetsProp.type.from(null)).toEqual([])
    expect(presetsProp.type.from('{"a":1}')).toEqual([])
    expect(cleanPresets([50, 5, 1000, Number.NaN, 5], 1, 100)).toEqual([5, 50])
  })

  it('draws one chip per in-bounds preset; a chip reads selected only while the value equals it', async () => {
    const el = make({ min: '1', max: '20', value: '4', presets: '[8,1,4,2,40]' })
    expect(chips(el).map((c) => c.textContent)).toEqual(['1', '2', '4', '8'])
    const pressed = (): string[] => chips(el).map((c) => c.getAttribute('aria-pressed')!)
    expect(pressed()).toEqual(['false', 'false', 'true', 'false'])
    expect(chips(el)[2]!.querySelector('[data-part="glyph"]')).not.toBeNull()
    btn(el, 'decrease').click()
    await el.updateComplete
    expect(pressed()).toEqual(['false', 'false', 'false', 'false'])
    expect(el.querySelectorAll('[data-part="preset"] [data-part="glyph"]').length).toBe(0)
  })

  it('no surviving preset renders no chip row', () => {
    const el = make({ min: '1', max: '5', presets: '[10, 20]' })
    expect(q(el, 'presets')).toBeNull()
  })
})

describe('ui-amount-picker: formatting', () => {
  it('formats plain, USD, JPY and a unit through the codec helpers', () => {
    expect(amountFormatter('', '')(1234.5)).toBe(new Intl.NumberFormat().format(1234.5))
    expect(amountFormatter('USD', '')(420)).toMatch(/^\$420[.,]00$/)
    expect(amountFormatter('JPY', '')(1500)).toMatch(/^¥1[,.\s]?500$/)
    expect(amountFormatter('', 'kilometer')(12)).toMatch(/^12 km$/)
    expect(amountFormatter('USD', 'kilometer')(5)).toMatch(/^\$5/) // currency wins
  })

  it('the readout, aria-valuetext and the chip labels share the formatter', () => {
    const el = make({ min: '5', max: '250', value: '250', currency: 'USD', presets: '[25,50]' })
    const readout = q(el, 'readout')!
    expect(readout.textContent).toMatch(/^\$250[.,]00$/)
    expect(readout.getAttribute('aria-valuetext')).toBe(readout.textContent)
    expect(chips(el)[0]!.textContent).toMatch(/^\$25[.,]00$/)
  })
})

describe('ui-amount-picker: slider and label parts', () => {
  it('the slider part is present only with slider and mirrors the value and bounds', async () => {
    const el = make({ min: '200', max: '600', step: '10', value: '420', label: 'Your offer' })
    expect(q(el, 'slider')).toBeNull()
    el.slider = true
    await el.updateComplete
    const slider = q<HTMLElement & { value: number; min: number; max: number }>(el, 'slider')!
    expect(slider.localName).toBe('ui-slider')
    expect(slider.hasAttribute('readout-hidden')).toBe(true)
    expect(slider.getAttribute('aria-label')).toBe('Your offer')
    expect([slider.min, slider.max, slider.value]).toEqual([200, 600, 420])
    el.value = 500
    await el.updateComplete
    expect(slider.value).toBe(500)
  })

  it('the slider input is re-emitted from the host and never leaks', () => {
    const el = make({ min: '0', max: '100', value: '10', slider: '' })
    const { log } = record(el)
    const seen: string[] = []
    el.addEventListener('input', (e) => seen.push((e.target as Element).localName))
    const slider = q<HTMLElement & { value: number; emit(type: string): boolean }>(el, 'slider')!
    slider.value = 40
    slider.emit('input')
    expect(el.value).toBe(40)
    expect(seen).toEqual(['ui-amount-picker-probe'])
    expect(log).toEqual(['input:40'])
  })

  it('the label part is present only with a label and is aria-hidden', async () => {
    const el = make()
    expect(q(el, 'label')).toBeNull()
    el.label = 'Guests'
    await el.updateComplete
    const label = q(el, 'label')!
    expect(label.textContent).toBe('Guests')
    expect(label.getAttribute('aria-hidden')).toBe('true')
    expect(el.firstElementChild).toBe(label)
  })
})
