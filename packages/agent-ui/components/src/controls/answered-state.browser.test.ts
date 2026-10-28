import { describe, it, expect, afterEach } from 'vitest'

// T-0509: the real-engine proof of ADR-0196's `:state(answered)` mirror for every answered-bearing
// choice control other than ui-checkbox (checkbox/answered-state.browser.test.ts). The jsdom suites'
// `states.has('answered')` tests are skipped there (jsdom has no CustomStateSet), so this file is the
// only place the mirror is checked. ui-segmented-control inherits the mirror from ui-radio-group.
//
// Side-effect imports: the load-bearing CSS order (ADR-0003).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

type Answerable = HTMLElement & { answered: boolean }

const OPTIONS = `
  <div role="option" value="a">Alpha</div>
  <div role="option" value="b">Beta</div>
`

const CONTROLS: Record<string, string> = {
  'ui-multi-select': `<ui-multi-select>${OPTIONS}</ui-multi-select>`,
  'ui-select': `<ui-select placeholder="Choose">${OPTIONS}</ui-select>`,
  'ui-combo-box': `<ui-combo-box placeholder="Search">${OPTIONS}</ui-combo-box>`,
  'ui-radio-group': `<ui-radio-group><ui-radio value="a">Alpha</ui-radio><ui-radio value="b">Beta</ui-radio></ui-radio-group>`,
  'ui-segmented-control': `<ui-segmented-control><ui-segment value="a">One</ui-segment><ui-segment value="b">Two</ui-segment></ui-segmented-control>`,
  'ui-switch': `<ui-switch>Answered probe</ui-switch>`,
}

const mounted: HTMLElement[] = []
const mount = (tag: string): Answerable => {
  const wrap = document.createElement('div')
  wrap.innerHTML = CONTROLS[tag]
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector(tag) as Answerable
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Effects are microtask-batched; one frame plus a task is past any flush. */
const settle = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))

describe('answered-bearing controls: :state(answered) real-engine mirror (ADR-0196, T-0509)', () => {
  for (const tag of Object.keys(CONTROLS)) {
    it(`${tag}: answered=true mirrors into :state(answered); clearing removes it`, async () => {
      const el = mount(tag)
      await settle()
      expect(el.matches(':state(answered)'), 'not answered before the prop is set').toBe(false)
      el.answered = true
      await settle()
      expect(el.matches(':state(answered)'), 'answered=true must add the state').toBe(true)
      el.answered = false
      await settle()
      expect(el.matches(':state(answered)'), 'answered=false must remove the state').toBe(false)
    })
  }
})
