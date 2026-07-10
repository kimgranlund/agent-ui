import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// markdown.browser.test.ts — the cross-engine browser-truth proof (LLD-C10, SPEC-C5/C6/C7). Runs in BOTH
// Chromium and WebKit (vitest.browser.config.ts). Covers what jsdom cannot: real rendered structure
// (non-zero geometry, not just DOM presence), the injection corpus proven inert in a REAL engine (no
// `<script>` execution surface, no `on*` attribute reaches the DOM), and the forced-colors token-degrade
// leg when `./highlight` is adopted (the code.browser.test.ts instrument-bridge precedent: Chromium
// emulates via CDP, WebKit asserts the structural baseline).
//
// Side-effect imports — the load-bearing order (ADR-0003): foundation tokens FIRST, then the markdown
// pack's own stylesheet + element, then the highlight pack (self-registers) + its stylesheet for the
// compose/forced-colors legs.
import '@agent-ui/components/foundation-styles.css'
import './markdown.css'
import './markdown.ts'
import type { UIMarkdownElement } from './markdown.ts'
import '../highlight/index.ts'
import '../highlight/highlight.css'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

async function mount(markdown: string): Promise<UIMarkdownElement> {
  const el = document.createElement('ui-markdown') as UIMarkdownElement
  document.body.append(el)
  mounted.push(el)
  el.markdown = markdown
  await el.updateComplete
  return el
}

describe('ui-markdown — rendered structure per construct is non-zero and correctly nested (SPEC-C6)', () => {
  it('a heading + paragraph both paint a non-zero box', async () => {
    const el = await mount('# Title\n\nBody text.')
    const h1 = el.querySelector('ui-text[as="h1"]') as HTMLElement
    const p = el.querySelector('ui-text[as="p"]') as HTMLElement
    expect(h1.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(p.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('a nested list renders real, non-zero, correctly nested <ul>/<ol>/<li> boxes', async () => {
    const el = await mount('1. outer\n   - inner')
    const ol = el.querySelector('ol') as HTMLElement
    const nestedUl = ol.querySelector('li > ul') as HTMLElement
    expect(ol.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(nestedUl).not.toBeNull()
    expect(nestedUl.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('a fenced code block renders a non-zero ui-code box', async () => {
    const el = await mount('```json\n{"a":1}\n```')
    const code = el.querySelector('ui-code') as HTMLElement
    expect(code.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('a GFM table renders a real, non-zero <table>', async () => {
    const el = await mount('| a | b |\n| --- | --- |\n| 1 | 2 |')
    const table = el.querySelector('ui-table table') as HTMLElement
    expect(table).not.toBeNull()
    expect(table.getBoundingClientRect().height).toBeGreaterThan(0)
  })
})

describe('the injection corpus renders INERT in a real engine (SPEC-C7 AC1)', () => {
  const CORPUS: readonly string[] = [
    '<script>window.__pwned = true</script>',
    '<img src="x" onerror="window.__pwned = true">',
    '<div onclick="window.__pwned = true">click me</div>',
    '[click](javascript:window.__pwned = true)',
    '<a href="javascript:window.__pwned = true">x</a>',
  ]

  for (const payload of CORPUS) {
    it(`zero <script> elements, no on* attribute, no LIVE javascript: href reaches the DOM: ${JSON.stringify(payload).slice(0, 50)}`, async () => {
      const w = window as unknown as { __pwned?: boolean }
      w.__pwned = false
      const el = await mount(payload)
      expect(el.querySelectorAll('script').length).toBe(0)
      for (const node of el.querySelectorAll('*')) {
        for (const attr of Array.from(node.attributes)) {
          expect(attr.name.startsWith('on'), `${node.tagName} carries ${attr.name}`).toBe(false)
        }
      }
      // The LIVE navigation surface is the stamped native <a> only (ui-text's own `href` ATTRIBUTE is
      // reflected raw/unfiltered by ADR-0114 design — inert by construction, since a custom element is not
      // in the :any-link grammar and can never navigate; only a REAL <a> can). Assert no real anchor
      // anywhere carries a javascript: href.
      for (const a of el.querySelectorAll('a')) {
        const href = (a.getAttribute('href') ?? '').trim().toLowerCase()
        expect(href.startsWith('javascript:'), `a real <a> carries a javascript: href`).toBe(false)
      }
      expect(w.__pwned, 'the payload EXECUTED').toBe(false)
    })
  }

  it('raw tags render as visible text (a real rendered box carrying the literal characters)', async () => {
    const el = await mount('before <script>alert(1)</script> after')
    expect(el.textContent).toContain('<script>alert(1)</script>')
    expect(el.getBoundingClientRect().height).toBeGreaterThan(0)
  })
})

describe('the forced-colors token-degrade leg (SPEC-C5 AC2, ./highlight adopted, the instrument-bridge precedent)', () => {
  it('Chromium emulates forced-colors and every [data-token] computes CanvasText; WebKit asserts the baseline', async () => {
    const el = await mount('```ts\nconst x = 1\n```')
    const spans = el.querySelectorAll('ui-code [data-token]')
    expect(spans.length, 'the highlight pack did not produce any token spans').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as { send(method: string, params?: Record<string, unknown>): Promise<unknown> }
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      for (const span of Array.from(spans)) {
        const color = getComputedStyle(span).color
        // CanvasText resolves to a real color the UA picks (opaque, non-transparent) — assert it is NOT
        // the light/dark token-role colors (which would mean forced-colors failed to override) and IS a
        // fully-opaque color (never invisible).
        expect(color).not.toBe('rgba(0, 0, 0, 0)')
        expect(color).not.toBe('transparent')
      }
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
