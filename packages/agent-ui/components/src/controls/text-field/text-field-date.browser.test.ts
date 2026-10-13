import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import { whenFlushed } from '@agent-ui/components'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'

// T-0135 — type=date as a real date input, in a real engine (Chromium and WebKit): the trigger is a square,
// fully round icon-only button one control step below the field and concentric in its end; the calendar
// panel anchors to the field, opens on the current value's month every time, takes min/max fresh each open,
// closes on a pick and returns focus; the editor keys open and close it; the text is the locale date while
// the form value is the ISO date.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

const mounted: HTMLElement[] = []
const mount = (markup: string): { field: UITextFieldElement; editor: HTMLElement; trigger: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '320px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const field = wrap.querySelector('ui-text-field') as UITextFieldElement
  return {
    field,
    editor: field.querySelector('[data-part="editor"]') as HTMLElement,
    trigger: field.querySelector('[data-part="calendar-button"]') as HTMLElement,
  }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const box = (el: Element): DOMRect => el.getBoundingClientRect()
const popupOf = (field: HTMLElement): HTMLElement => field.querySelector('[data-part="calendar-popup"]') as HTMLElement
const isOpen = (field: HTMLElement): boolean => popupOf(field)?.matches(':popover-open') ?? false
const monthTitle = (field: HTMLElement): string => field.querySelector('ui-calendar [data-part="title"]')?.textContent ?? ''
const cell = (field: HTMLElement, iso: string): HTMLElement =>
  field.querySelector(`ui-calendar [role="gridcell"][data-date="${iso}"]`) as HTMLElement
const localeDate = (y: number, m: number, d: number): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(y, m - 1, d))
const formValue = (field: HTMLElement, name: string): FormDataEntryValue | null =>
  new FormData(field.closest('form') as HTMLFormElement).get(name)

describe('ui-text-field type=date: the calendar trigger (T-0135)', () => {
  it('is a square, fully round button one control step below the field, concentric in the frame end, at every size', async () => {
    for (const [size, below] of [['md', 'sm'], ['lg', 'md']] as const) {
      const { field, trigger } = mount(`<ui-text-field type="date" size="${size}"></ui-text-field>`)
      const { field: ref } = mount(`<ui-text-field size="${below}"></ui-text-field>`)
      await whenFlushed()
      const t = box(trigger)
      const f = box(field)
      expect(t.width, `${size}: square`).toBeCloseTo(t.height, 1)
      expect(t.height, `${size}: the ${below} control height`).toBeCloseTo(box(ref).height, 1)
      expect(getComputedStyle(trigger).borderTopLeftRadius, `${size}: fully round`).toBe('50%')
      const top = t.top - f.top
      expect(f.bottom - t.bottom, `${size}: vertically centred`).toBeCloseTo(top, 1)
      expect(f.right - t.right, `${size}: the end pad equals the block pad (concentric)`).toBeCloseTo(top, 1)
    }
  })

  it('a click opens the panel under the field (anchored to the field, not the trigger); a second click closes it', async () => {
    const { field, trigger } = mount('<ui-text-field type="date" value="2026-11-14"></ui-text-field>')
    await whenFlushed()
    trigger.click()
    await whenFlushed()
    expect(isOpen(field)).toBe(true)
    const panel = box(popupOf(field))
    expect(panel.left, 'aligned to the field start').toBeCloseTo(box(field).left, 0)
    expect(panel.top).toBeGreaterThanOrEqual(box(field).bottom)
    trigger.click()
    await whenFlushed()
    expect(isOpen(field)).toBe(false)
  })
})

describe('ui-text-field type=date: value, month, bounds and focus (T-0135)', () => {
  it('shows an ISO value as the locale date while the form value stays the ISO date', async () => {
    const { field, editor } = mount('<form><ui-text-field type="date" name="d" value="2026-11-14"></ui-text-field></form>')
    await whenFlushed()
    expect(editor.textContent).toBe(localeDate(2026, 11, 14))
    expect(formValue(field, 'd')).toBe('2026-11-14')
    field.value = '2027-02-03' // a programmatic ISO write formats too
    await whenFlushed()
    expect(editor.textContent).toBe(localeDate(2027, 2, 3))
    expect(formValue(field, 'd')).toBe('2027-02-03')
  })

  it('opens on the current value\'s month every time, not the month of the first open', async () => {
    const { field, trigger } = mount('<ui-text-field type="date" value="2026-11-14"></ui-text-field>')
    await whenFlushed()
    trigger.click()
    expect(monthTitle(field)).toContain('November')
    trigger.click()
    field.value = '2027-03-09'
    await whenFlushed()
    trigger.click()
    expect(monthTitle(field), 'the second open follows the new value').toContain('March')
    expect(monthTitle(field)).toContain('2027')
  })

  it('takes min and max fresh on each open: a removed bound no longer disables days', async () => {
    const { field, trigger } = mount('<ui-text-field type="date" value="2026-11-14" min="2026-11-10"></ui-text-field>')
    await whenFlushed()
    trigger.click()
    expect(cell(field, '2026-11-09').getAttribute('aria-disabled')).toBe('true')
    expect(cell(field, '2026-11-10').getAttribute('aria-disabled')).not.toBe('true')
    trigger.click()
    field.min = ''
    await whenFlushed()
    trigger.click()
    expect(cell(field, '2026-11-09').getAttribute('aria-disabled'), 'min removed').not.toBe('true')
  })

  it('a pick commits the ISO, shows the locale date, closes the panel and returns focus to the trigger', async () => {
    const { field, editor, trigger } = mount(
      '<ui-form-provider><ui-text-field type="date" name="d" value="2026-11-14"></ui-text-field></ui-form-provider>',
    )
    await whenFlushed()
    const provider = field.closest('ui-form-provider') as HTMLElement & { values(): Record<string, unknown> }
    const changes: unknown[] = []
    // the provider's values() reads the live form value (FormData sees the internals publish one flush later)
    field.addEventListener('change', () => changes.push(provider.values()['d']))
    trigger.click()
    cell(field, '2026-11-20').click()
    await whenFlushed()
    expect(changes, 'one change, carrying the ISO').toEqual(['2026-11-20'])
    expect(isOpen(field)).toBe(false)
    expect(editor.textContent).toBe(localeDate(2026, 11, 20))
    expect(document.activeElement).toBe(trigger)
  })

  it('a typed date before min is rangeUnderflow; inside the bounds it is valid', async () => {
    const { field } = mount('<form><ui-text-field type="date" name="d" min="2026-11-10" max="2026-11-30"></ui-text-field></form>')
    await whenFlushed()
    field.value = '2026-11-01'
    await whenFlushed()
    expect(field.validity.rangeUnderflow).toBe(true)
    field.value = '2026-12-01'
    await whenFlushed()
    expect(field.validity.rangeOverflow).toBe(true)
    field.value = '2026-11-15'
    await whenFlushed()
    expect(field.validity.valid).toBe(true)
  })
})

describe('ui-text-field type=date: the editor keys (T-0135)', () => {
  it('Enter opens the calendar from the editor, Escape closes it and focus comes back to the editor', async () => {
    const { field, editor } = mount('<ui-text-field type="date" value="2026-11-14"></ui-text-field>')
    await whenFlushed()
    editor.focus()
    await userEvent.keyboard('{Enter}')
    await whenFlushed()
    expect(isOpen(field)).toBe(true)
    expect(field.querySelector('ui-calendar')?.contains(document.activeElement), 'focus is on the day cursor').toBe(true)
    await userEvent.keyboard('{Escape}')
    await whenFlushed()
    expect(isOpen(field)).toBe(false)
    expect(document.activeElement).toBe(editor)
  })

  it('Alt+ArrowDown opens it; a plain ArrowUp never steps the date', async () => {
    const { field, editor } = mount('<form><ui-text-field type="date" name="d" value="2026-11-14"></ui-text-field></form>')
    await whenFlushed()
    editor.focus()
    await userEvent.keyboard('{ArrowUp}')
    await whenFlushed()
    expect(formValue(field, 'd')).toBe('2026-11-14')
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    await whenFlushed()
    expect(isOpen(field)).toBe(true)
  })
})
