// persistence.test.ts — jsdom mount test for the persistence guide (GH #1046), the data-doc.browser.test.ts
// idiom (one static side-effect import builds the whole page into #app once; every `it` below queries that
// SAME mounted DOM): proves the live localStorage-tier demo genuinely writes/reads/clears through the REAL
// createLocalStorageAdapter, not a mock — the "honest labels" discipline this page's own banner claims.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const NAMESPACE = 'agent-ui-docs.persistence-demo'
const STORAGE_KEY = `${NAMESPACE}.draft-title`

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

beforeAll(async () => {
  // jsdom reality (the a2ui-chat.test.ts / a2ui-live.ask-lifecycle.test.ts precedent): `ElementInternals.
  // setFormValue`/`setValidity` are ABSENT in jsdom, and this page mounts two real ui-text-fields (form-
  // associated controls). Stub ONCE at the shared prototype — additive.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  // A DEFERRED import (never a static one at file top): a static import is hoisted and would build the page
  // (mounting the real ui-text-fields) BEFORE the stub above lands. Side-effect import — builds the whole
  // page into #app (mountPage) — the data-doc.browser.test.ts precedent.
  await import('./persistence.ts')
})

const sectionByTitle = (): HTMLElement => {
  const s = [...document.querySelectorAll<HTMLElement>('main[data-page-content] > section')].find((sec) =>
    sec.querySelector('h2')?.textContent?.startsWith('Live — createLocalStorageAdapter'),
  )
  if (!s) throw new Error('no "Live — createLocalStorageAdapter" section')
  return s
}
const buttonIn = (section: HTMLElement, label: string): HTMLElement => {
  const b = [...section.querySelectorAll<HTMLElement>('ui-button')].find((x) => x.textContent?.trim() === label)
  if (!b) throw new Error(`no ui-button "${label}" in section`)
  return b
}
const statusOf = (section: HTMLElement): string => section.querySelector<HTMLElement>('.persistence-demo-status')?.textContent ?? ''

describe('persistence.ts — the live localStorage-tier demo (GH #1046)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('mounts a real "Live — createLocalStorageAdapter" section with Write/Read/Clear ui-buttons and two ui-text-fields', () => {
    const section = sectionByTitle()
    expect(section.querySelectorAll('ui-text-field')).toHaveLength(2)
    expect(buttonIn(section, 'Write')).toBeTruthy()
    expect(buttonIn(section, 'Read')).toBeTruthy()
    expect(buttonIn(section, 'Clear')).toBeTruthy()
  })

  it('Write persists the real namespaced key to localStorage — not a mock (the seam under test)', async () => {
    const section = sectionByTitle()
    buttonIn(section, 'Write').click()
    // the localStorage tier's setItem runs synchronously inside the adapter's async set() body
    // (local-storage-adapter.ts's own banner) — no await needed to observe the write itself.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify('Hello, persistence'))
    await flush()
    expect(statusOf(section)).toContain(`wrote ${STORAGE_KEY}`)
  })

  it('Clear removes the key; Read then reports no value stored', async () => {
    const section = sectionByTitle()
    buttonIn(section, 'Write').click()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    buttonIn(section, 'Clear').click()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    buttonIn(section, 'Read').click()
    await flush()
    expect(statusOf(section)).toContain('no value stored')
  })
})
