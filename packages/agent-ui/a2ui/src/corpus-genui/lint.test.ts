// lint.test.ts — LLD-C1 §3.3 (GH #1584), AC3: `lintGenuiHtml` returns the exact counts over
// representative fixtures — a positive pack-anatomy snippet (0 external refs, ≥1 token ref) and a
// negative off-idiom snippet (a CDN `<script src>`, 1 external ref). Pure, no DOM.

import { describe, it, expect } from 'vitest'
import { lintGenuiHtml } from './lint.ts'

const ANATOMY_HTML =
  '<!doctype html><html><body><div class="chart">' +
  '<div class="bar"><div class="bar-fill" style="height:78%"></div></div>' +
  '</div><style>.bar-fill{background:var(--md-sys-color-primary);}' +
  '.chart{border:1px solid var(--md-sys-color-neutral-outline-variant);}</style></body></html>'

const OFF_IDIOM_HTML =
  '<!doctype html><html><head>' +
  '<script src="https://cdn.example.com/chart-lib.min.js"></script>' +
  '</head><body><div id="chart"></div><script>renderChart();</script></body></html>'

describe('lintGenuiHtml — the deterministic D4 evidence floor (LLD §3.3)', () => {
  it('a positive pack-anatomy snippet: zero external refs, at least one token ref, has a doctype', () => {
    const lint = lintGenuiHtml(ANATOMY_HTML)
    expect(lint.externalRefs).toBe(0)
    expect(lint.tokenRefs).toBeGreaterThanOrEqual(1)
    expect(lint.tokenRefs).toBe(2)
    expect(lint.hasDoctype).toBe(true)
    expect(lint.scriptBlocks).toBe(0)
    expect(lint.byteLength).toBe(new TextEncoder().encode(ANATOMY_HTML).length)
  })

  it('a negative off-idiom snippet: exactly one external ref (the CDN <script src>), two script blocks, zero token refs', () => {
    const lint = lintGenuiHtml(OFF_IDIOM_HTML)
    expect(lint.externalRefs).toBe(1)
    expect(lint.tokenRefs).toBe(0)
    expect(lint.scriptBlocks).toBe(2)
    expect(lint.hasDoctype).toBe(true)
  })

  it('a relative/data: src is never counted as an external ref', () => {
    const html = '<img src="/local/image.png"><img src="data:image/png;base64,AAAA">'
    expect(lintGenuiHtml(html).externalRefs).toBe(0)
  })

  it('an http(s) href on <link>/<iframe> is counted; a bare tag with no src/href is not', () => {
    const html = '<link href="https://fonts.example.com/f.css"><iframe src="https://embed.example.com/x"></iframe><div></div>'
    expect(lintGenuiHtml(html).externalRefs).toBe(2)
  })

  it('no leading doctype (a bare fragment) reads hasDoctype:false', () => {
    expect(lintGenuiHtml('<div>hello</div>').hasDoctype).toBe(false)
  })

  it('is pure and total — never throws on empty or malformed input', () => {
    expect(() => lintGenuiHtml('')).not.toThrow()
    expect(lintGenuiHtml('').byteLength).toBe(0)
    expect(() => lintGenuiHtml('<not really html')).not.toThrow()
  })
})
