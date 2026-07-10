import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import './markdown.ts' // self-defines <ui-markdown>
import type { UIMarkdownElement } from './markdown.ts'

declare const process: { cwd(): string }

// `this.effect(...)` (the reactive kernel, graph.ts) runs synchronously ONCE at creation, then re-runs
// BATCHED on a later dependency change — every subsequent `.markdown` write needs an `await
// el.updateComplete` before the DOM reflects it (the ui-table test.ts precedent).
async function mount(markdown: string): Promise<UIMarkdownElement> {
  const el = document.createElement('ui-markdown') as UIMarkdownElement
  document.body.append(el)
  el.markdown = markdown
  await el.updateComplete
  return el
}

describe('ui-markdown — self-registration (LLD-C9)', () => {
  it('registers the ui-markdown custom element', () => {
    expect(customElements.get('ui-markdown')).toBeDefined()
  })
})

describe('ui-markdown — render structure per construct (SPEC-C6, jsdom)', () => {
  it('AC1 — a heading + a paragraph with strong/code inline', async () => {
    const el = await mount('# Title\n\nA **bold** word and `code`.')
    const h1 = el.querySelector('ui-text[as="h1"]')
    const p = el.querySelector('ui-text[as="p"]')
    expect(h1).not.toBeNull()
    expect(h1?.textContent).toBe('Title')
    expect(p).not.toBeNull()
    expect(p?.querySelector('strong')?.textContent).toBe('bold')
    expect(p?.querySelector('code')?.textContent).toBe('code')
  })

  it('AC2 — an ordered list with a nested unordered list preserves nesting', async () => {
    const el = await mount('1. outer\n   - inner')
    const ol = el.querySelector('ol')
    expect(ol).not.toBeNull()
    const li = ol!.querySelector(':scope > li')
    expect(li).not.toBeNull()
    const nestedUl = li!.querySelector('ul')
    expect(nestedUl).not.toBeNull()
    expect(nestedUl!.querySelector('li')?.textContent).toContain('inner')
  })

  it('AC2 — a blockquote containing two paragraphs wraps two ui-text as="p"', async () => {
    const el = await mount('> first\n>\n> second')
    const bq = el.querySelector('ui-text[as="blockquote"]')
    expect(bq).not.toBeNull()
    // the paragraphs land inside the blockquote's own STAMP (the <blockquote> ui-text moves its content
    // into when it connects), one level deeper than the host itself — a descendant query, not :scope >.
    const paras = bq!.querySelectorAll('ui-text[as="p"]')
    expect(paras.length).toBe(2)
  })

  it('AC3 — a safe link renders ui-text as="a" whose STAMPED <a> carries the href', async () => {
    const el = await mount('[src](https://example.com)')
    const a = el.querySelector('ui-text[as="a"]') as HTMLElement | null
    expect(a).not.toBeNull()
    // the gate writes the live href onto the INNER STAMP <a>, not the (inert-by-construction) host attribute
    expect(a?.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
  })

  it('AC3 — a javascript: link denies the stamped <a> href (ui-text gate, cross-referenced by SPEC-C7)', async () => {
    const el = await mount('[x](javascript:alert(1))')
    const a = el.querySelector('ui-text[as="a"]') as HTMLElement | null
    expect(a).not.toBeNull()
    expect(a?.querySelector('a')?.getAttribute('href')).toBeNull() // gate denied — no href, an inert placeholder
    expect(a?.textContent).toBe('x') // the link TEXT still renders
  })

  it('AC4 — a GFM table renders ui-table with columns from the header and body rows', async () => {
    const el = await mount('| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |')
    const table = el.querySelector('ui-table') as HTMLElement & {
      columns: { key: string; label: string }[]
      rows: Record<string, string>[]
    }
    expect(table).not.toBeNull()
    expect(table.columns).toEqual([{ key: 'c0', label: 'a' }, { key: 'c1', label: 'b' }])
    expect(table.rows).toEqual([{ c0: '1', c1: '2' }, { c0: '3', c1: '4' }])
  })

  it('AC4 — re-assigning markdown="" clears children with no residue', async () => {
    const el = await mount('# Title')
    expect(el.childNodes.length).toBeGreaterThan(0)
    el.markdown = ''
    await el.updateComplete
    expect(el.childNodes.length).toBe(0)
  })

  it('a fenced code block renders ui-code with language forwarded and verbatim content (no ./highlight registered)', async () => {
    const el = await mount('```json\n{"a":1}\n```')
    const code = el.querySelector('ui-code')
    expect(code).not.toBeNull()
    expect(code?.getAttribute('language')).toBe('json')
    expect(code?.textContent).toBe('{"a":1}')
    expect(code?.querySelectorAll('[data-token]').length).toBe(0) // identity path — no ./highlight imported here
  })

  it('re-assignment churn replaces children wholesale (a later markdown write swaps the tree)', async () => {
    const el = await mount('# First')
    const firstChild = el.firstElementChild
    el.markdown = '# Second'
    await el.updateComplete
    expect(el.firstElementChild).not.toBe(firstChild)
    expect(el.firstElementChild?.textContent).toBe('Second')
  })
})

describe('ui-markdown — renderer never touches innerHTML and never imports ./highlight (SPEC-C7/C8)', () => {
  const DIR = `${process.cwd()}/packages/agent-ui/code/src/markdown`
  // Every SOURCE file in the pack, not just render.ts (widened per review, 2026-07-10) — parse.ts/
  // markdown.ts/index.ts are clean today, and this gate exists to keep them that way as the pack grows,
  // not to certify render.ts alone. `.test.ts` files are excluded — they legitimately contain PLANTED
  // negative-control strings (e.g. the innerHTML negative control below) that must never trip this grep.
  const SOURCE_FILES = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('anti-vacuous: the source-file set is non-trivial', () => {
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(4) // parse.ts, render.ts, markdown.ts, index.ts
  })

  it('no markdown/*.ts source contains an innerHTML/outerHTML/insertAdjacentHTML write', () => {
    for (const f of SOURCE_FILES) {
      const src = readFileSync(`${DIR}/${f}`, 'utf8') as string
      expect(src, f).not.toMatch(/\.innerHTML\s*=/)
      expect(src, f).not.toMatch(/\.outerHTML\s*=/)
      expect(src, f).not.toMatch(/insertAdjacentHTML/)
    }
  })

  it('markdown.ts/render.ts/index.ts import no ./highlight module (the compose-via-registry separation, SPEC-C8)', () => {
    for (const f of ['markdown.ts', 'render.ts', 'index.ts']) {
      const src = readFileSync(`${DIR}/${f}`, 'utf8') as string
      expect(src, f).not.toMatch(/highlight\/index\.ts|\.\.\/highlight/)
    }
  })

  it('negative control: a planted innerHTML write would fail the grep', () => {
    const planted = 'el.innerHTML = markdown\n'
    expect(planted).toMatch(/\.innerHTML\s*=/)
  })
})
