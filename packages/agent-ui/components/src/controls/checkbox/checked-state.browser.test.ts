import { describe, it, expect, afterEach } from 'vitest'

// T-0509: the real-engine proof of ui-checkbox's `:state(checked)` / `:state(indeterminate)` (LLD-C2).
// The jsdom suite's `states.has(...)` tests are skipped there (jsdom has no CustomStateSet), and
// checkbox.browser.test.ts reads only the mark geometry under each state, never the state itself.
//
// Side-effect imports: the load-bearing CSS order (ADR-0003).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import type { UICheckboxElement } from './checkbox.ts'

const mounted: HTMLElement[] = []
const mount = (): UICheckboxElement => {
  const el = document.createElement('ui-checkbox') as UICheckboxElement
  el.textContent = 'State probe'
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const states = (el: HTMLElement): { checked: boolean; indeterminate: boolean } => ({
  checked: el.matches(':state(checked)'),
  indeterminate: el.matches(':state(indeterminate)'),
})

describe('ui-checkbox: :state(checked) / :state(indeterminate) real-engine mirror (LLD-C2, T-0509)', () => {
  it('checked toggles :state(checked) both ways; neither state on a fresh box', async () => {
    const el = mount()
    await el.updateComplete
    expect(states(el)).toEqual({ checked: false, indeterminate: false })
    el.checked = true
    await el.updateComplete
    expect(states(el)).toEqual({ checked: true, indeterminate: false })
    el.checked = false
    await el.updateComplete
    expect(states(el)).toEqual({ checked: false, indeterminate: false })
  })

  it('indeterminate adds :state(indeterminate) and suppresses :state(checked); clearing restores checked', async () => {
    const el = mount()
    el.checked = true
    await el.updateComplete
    el.indeterminate = true
    await el.updateComplete
    expect(states(el)).toEqual({ checked: false, indeterminate: true })
    el.indeterminate = false
    await el.updateComplete
    expect(states(el)).toEqual({ checked: true, indeterminate: false })
  })
})
