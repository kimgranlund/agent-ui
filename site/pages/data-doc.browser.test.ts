// data-doc.browser.test.ts — the WHOLE-SHAPE cross-engine smoke for the @agent-ui/data guide page
// (ADR-0192; saas-data-utilities.spec.md SPEC-R14 e's "nav/toc gates green" leg is jsdom's sitemap/llms
// suites; THIS proves the PAGE actually mounts in a real engine and its live specimens run the REAL package
// end to end — the resource() demo transitions idle/loading → success over its in-page fake source, the
// paginated() demo appends a page on loadMore(), the pushToPull bridge yields what a click pushes).
import { describe, it, expect, vi } from 'vitest'
// Side-effect import: builds the whole page into #app (mountPage) — the a2a-concepts.browser.test.ts precedent.
import './data-doc.ts'

// REAL-TIMING HEADROOM (GH #347): the fake sources carry 400–600 ms latency by design.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const until = async (pred: () => boolean, ms = 8_000): Promise<void> => {
  const t0 = performance.now()
  while (!pred()) {
    if (performance.now() - t0 > ms) throw new Error('timed out waiting for the page state')
    await new Promise((r) => setTimeout(r, 50))
  }
}
const sections = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('main[data-page-content] > section')]
const sectionByTitle = (prefix: string): HTMLElement => {
  const s = sections().find((sec) => sec.querySelector('h2')?.textContent?.startsWith(prefix))
  if (!s) throw new Error(`no section titled "${prefix}…"`)
  return s
}
const statusOf = (section: HTMLElement): string => section.querySelector<HTMLElement>('p[style*="typeface-mono"]')?.textContent ?? ''
const buttonIn = (section: HTMLElement, label: string): HTMLElement => {
  const b = [...section.querySelectorAll<HTMLElement>('ui-button')].find((x) => x.textContent?.trim().startsWith(label))
  if (!b) throw new Error(`no ui-button "${label}" in section`)
  return b
}

describe('the @agent-ui/data guide page — real render, live specimens run the real package (both engines)', () => {
  it('mounts with the seven guide sections and real, non-zero geometry', async () => {
    await raf()
    const titles = sections().map((s) => s.querySelector('h2')?.textContent ?? '')
    expect(titles.length).toBeGreaterThanOrEqual(7)
    expect(titles.some((t) => t.startsWith('The seam'))).toBe(true)
    expect(titles.some((t) => t.startsWith('resource()'))).toBe(true)
    expect(titles.some((t) => t.startsWith('mutation()'))).toBe(true)
    expect(titles.some((t) => t.startsWith('paginated()'))).toBe(true)
    expect(titles.some((t) => t.startsWith('./gateway'))).toBe(true)
    expect(titles.some((t) => t.startsWith('./stream'))).toBe(true)
    const rect = sectionByTitle('resource()').getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it('resource(): the live status line reaches success with real data from the fake source (SWR + pending)', async () => {
    const section = sectionByTitle('resource()')
    await until(() => /status = success/.test(statusOf(section)))
    expect(statusOf(section)).toMatch(/data\s+= \{"id":1,"name":"Ada","reads":1\}/)
    expect(statusOf(section)).toMatch(/pending = false/)
    // refetch(): pending flips true while status STAYS success (SPEC-R3 a), then a fresh read lands
    buttonIn(section, 'refetch()').click()
    await until(() => /pending = true/.test(statusOf(section)))
    expect(statusOf(section)).toMatch(/status = success/)
    await until(() => /"reads":2/.test(statusOf(section)))
    expect(statusOf(section)).toMatch(/pending = false/)
  })

  it('paginated(): loadMore() appends the second page; hasMore reads from the cursor', async () => {
    const section = sectionByTitle('paginated()')
    await until(() => /pages = 1 {3}hasMore = true/.test(statusOf(section)))
    buttonIn(section, 'loadMore()').click()
    await until(() => /pages = 2/.test(statusOf(section)))
    expect(statusOf(section)).toMatch(/items = \[alpha, bravo, charlie, delta, echo, foxtrot\]/)
    expect(statusOf(section)).toMatch(/hasMore = true/)
  })

  it('./stream: the pushToPull bridge yields what a click pushes, in order', async () => {
    const section = sectionByTitle('./stream')
    buttonIn(section, 'push(value)').click()
    buttonIn(section, 'push(value)').click()
    await until(() => /received = \[v1, v2\]/.test(statusOf(section)))
  })
})
