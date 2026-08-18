import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-switch panel into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './switch-demo.ts'

// REAL-TIMING HEADROOM (GH #347): awaits rAF settles, so duration follows the browser's scheduling under load.
vi.setConfig({ testTimeout: 30_000 })

// switch-demo.browser.test.ts — page-level proof for the ui-switch demo (switch-demo.html): the REAL control
// mounts (not a mock), the master switch gates the topic rows via `disabled`, the policy row is disabled, and
// the event log is wired to the control's change/input contract. Runs in Chromium and WebKit (`site` project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const byName = (name: string): HTMLElement => {
  const sw = document.querySelector(`ui-switch[name="${name}"]`)
  if (!sw) throw new Error(`no ui-switch[name="${name}"]`)
  return sw as HTMLElement
}

describe('switch-demo — the real ui-switch panel mounts and its event log is wired', () => {
  it('mounts the real control, ≥2 example sections, and an aria-live event log', async () => {
    await raf()
    expect(customElements.get('ui-switch'), 'ui-switch must be a defined custom element').toBeDefined()
    expect(document.querySelectorAll('ui-switch').length).toBeGreaterThanOrEqual(5)
    expect(document.querySelectorAll('section').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('ul.event-log')?.getAttribute('aria-live')).toBe('polite')
    expect(byName('security').hasAttribute('disabled'), 'the policy-locked row is disabled').toBe(true)
    expect(byName('digest').hasAttribute('disabled'), 'master on ⇒ topics enabled').toBe(false)
  })

  it('a topic toggle logs change + input; the master gates the topics off (silently)', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLUListElement
    const before = log.children.length
    byName('digest').click()
    await raf()
    expect(log.children.length - before, 'a click logs change AND input').toBe(2)
    expect(byName('digest').hasAttribute('checked')).toBe(true)

    const mid = log.children.length
    byName('email').click()
    await raf()
    expect(byName('email').hasAttribute('checked')).toBe(false)
    for (const n of ['mentions', 'digest', 'marketing']) {
      expect(byName(n).hasAttribute('disabled'), `${n} should be gated off`).toBe(true)
    }
    expect(log.children.length - mid, 'only the master gesture logs; the disabled writes are silent').toBe(2)
  })
})
