import { describe, it, expect, afterEach } from 'vitest'
import { projectHighlight } from './project.ts'
import { highlighterRegistry } from './registry.ts'
import type { Highlighter } from './token.ts'

// The registry is a module-level singleton, but vitest gives each test FILE its own module graph, so
// `highlighterRegistry` starts fresh (nothing registered) at the top of this file — the identity path is
// exercised BEFORE any test registers a highlighter, and each subsequent test re-registers what it needs.
// `registerHighlighter` has no unregister; tests that register restore a passthrough afterward so later
// tests in this file never see a stale engine.

afterEach(() => {
  highlighterRegistry.registerHighlighter((code) => [{ kind: 'plain', text: code }])
})

describe('projectHighlight (LLD-C5, SPEC-C3)', () => {
  it('AC2 — an EMPTY registry (nothing ever registered) projects ONE text node, zero spans', () => {
    const host = document.createElement('ui-code')
    projectHighlight(host, 'const x = 1', 'ts')
    expect(host.childNodes.length).toBe(1)
    expect(host.childNodes[0].nodeType).toBe(Node.TEXT_NODE)
    expect(host.textContent).toBe('const x = 1')
    expect(host.querySelectorAll('[data-token]').length).toBe(0)
  })

  it('AC1 — a registered highlighter projects [data-token] spans whose concatenated text is exact, incl. a keyword span', () => {
    const kwHighlighter: Highlighter = () => [
      { kind: 'keyword', text: 'const' },
      { kind: 'plain', text: ' x = ' },
      { kind: 'number', text: '1' },
    ]
    highlighterRegistry.registerHighlighter(kwHighlighter)
    const host = document.createElement('ui-code')
    projectHighlight(host, 'const x = 1', 'ts')
    const spans = host.querySelectorAll('[data-token]')
    expect(spans.length).toBe(2) // keyword + number (plain is a bare text node, not a span)
    expect(spans[0].getAttribute('data-token')).toBe('keyword')
    expect(spans[0].textContent).toBe('const')
    expect(spans[1].getAttribute('data-token')).toBe('number')
    expect(spans[1].textContent).toBe('1')
    expect(host.textContent).toBe('const x = 1') // concatenated text exactly equals the input
  })

  it('a highlighter that itself returns a single plain token also takes the byte-identical text-node path', () => {
    // The seam's rendering branch is driven by the TOKEN SHAPE (length 1, kind plain), not by whether a
    // highlighter object exists — this covers the unknown-language / boundary-downgrade shape too.
    highlighterRegistry.registerHighlighter((code) => [{ kind: 'plain', text: code }])
    const host = document.createElement('ui-code')
    projectHighlight(host, 'const x = 1', 'ts')
    expect(host.childNodes.length).toBe(1)
    expect(host.childNodes[0].nodeType).toBe(Node.TEXT_NODE)
    expect(host.querySelectorAll('[data-token]').length).toBe(0)
  })

  it('AC3 — a subsequent plain textContent write clobbers the spans (plain-wins, ADR-0113 unchanged)', () => {
    const kwHighlighter: Highlighter = (code) => [{ kind: 'keyword', text: code }]
    highlighterRegistry.registerHighlighter(kwHighlighter)
    const host = document.createElement('ui-code')
    projectHighlight(host, 'const', 'ts')
    expect(host.querySelectorAll('[data-token]').length).toBe(1)
    host.textContent = 'const' // the bare-write shape the a2ui Code.code clobber lane produces downstream
    expect(host.querySelectorAll('[data-token]').length).toBe(0)
    expect(host.childNodes.length).toBe(1)
    expect(host.childNodes[0].nodeType).toBe(Node.TEXT_NODE)
  })

  it('the empty-string input never leaves a stray node (textContent/createTextNode only, no innerHTML)', () => {
    const host = document.createElement('ui-code')
    projectHighlight(host, '', 'ts')
    expect(host.childNodes.length).toBe(1)
    expect(host.textContent).toBe('')
  })
})
