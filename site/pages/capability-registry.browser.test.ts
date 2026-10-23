import { describe, it, expect, vi, beforeAll } from 'vitest'

// capability-registry.browser.test.ts: the Capability Registry picker switches by a REAL pick (T-0433). The jsdom
// sibling (capability-registry.test.ts) fires the event by hand, so it passes whichever event the page listens
// for; here a trigger click and an option click go through ui-select's own commit, so a page listening for an
// event the control never fires (`change` where ui-select fires `select`) leaves the table stale and fails.

// GH #347: REAL-TIMING HEADROOM (rAF settles under host load); class and rationale in vitest.browser.config.ts.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const rowTypes = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('#registry-types-table tbody tr')].map((r) => r.dataset.type ?? '')

let select: HTMLElement & { value: string }

beforeAll(async () => {
  // Side-effect import: the page module builds the whole page into document.body (mountPage).
  await import('./capability-registry.ts')
  await raf()
  select = document.querySelector('ui-select.registry-select') as HTMLElement & { value: string }
})

/** Pick a catalog id the way a user does: open the trigger, click the option. */
async function pick(id: string): Promise<void> {
  select.querySelector<HTMLElement>('[data-part="trigger"]')!.click()
  await raf()
  const option = select.querySelector<HTMLElement>(`[role="option"][value="${id}"]`)
  expect(option, `no ${id} option in the picker`).not.toBeNull()
  option!.click()
  await raf()
  expect(select.value, `the pick did not commit ${id}`).toBe(id)
}

describe('capability-registry: the catalog picker switches the table (T-0433)', () => {
  it('starts on agent-ui with no persona-only type', () => {
    expect(select, 'no ui-select.registry-select on the page').not.toBeNull()
    expect(select.value).toBe('agent-ui')
    expect(rowTypes()).toContain('Button')
    expect(rowTypes()).not.toContain('PlayingCard')
  })

  it('picking agent-ui--croupier re-renders the table with PlayingCard marked persona-only', async () => {
    await pick('agent-ui--croupier')
    expect(rowTypes()).toContain('PlayingCard')
    const card = document.querySelector('#registry-types-table tr[data-type=PlayingCard]')
    expect(card?.hasAttribute('data-persona-only')).toBe(true)
    expect(document.querySelector('.registry-view')?.textContent).toContain('Types of agent-ui--croupier')
  })

  it('picking agent-ui again drops the persona-only rows', async () => {
    await pick('agent-ui')
    expect(rowTypes()).not.toContain('PlayingCard')
    expect(document.querySelector('.registry-view')?.textContent).toContain('Types of agent-ui')
  })
})
