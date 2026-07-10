import { describe, it, expect } from 'vitest'
import { parse, parseInline, type Block, type Inline } from './parse.ts'

// injection.test.ts (LLD-C8, SPEC-C7) — the injection corpus, at the PARSER boundary. The AST's `Block`/
// `Inline` unions have NO html/raw node kind at all (a TS structural fact, not a runtime filter) — so every
// entry below can only ever surface as a `text` node (inert, rendered as literal characters downstream,
// LLD-C9) or, for the one scheme-carrying case, a `link` node whose href is denied by ui-text's gate later
// (SPEC-C6 AC3) — the parser itself applies no scheme logic (one gate, not two).

/** Collect every text string reachable from a block sequence — walks headings/paragraphs/lists/
 *  blockquotes/tables' inline runs. */
function allText(blocks: Block[]): string {
  const out: string[] = []
  const walkInline = (inline: Inline[]): void => {
    for (const n of inline) {
      if (n.kind === 'text') out.push(n.text)
      else if (n.kind === 'code') out.push(n.text)
      else if (n.kind === 'link') out.push(n.text)
      else walkInline(n.inline)
    }
  }
  for (const b of blocks) {
    if (b.kind === 'heading' || b.kind === 'paragraph') walkInline(b.inline)
    else if (b.kind === 'blockquote') out.push(allText(b.blocks))
    else if (b.kind === 'list') for (const item of b.items) out.push(allText(item))
    else if (b.kind === 'code') out.push(b.text)
    else if (b.kind === 'table') {
      out.push(...b.header, ...b.rows.flat())
    }
  }
  return out.join('\n')
}

/** Every `link` node anywhere in the tree (to check href verbatim-capture, never executed by the parser). */
function allLinks(blocks: Block[]): Extract<Inline, { kind: 'link' }>[] {
  const out: Extract<Inline, { kind: 'link' }>[] = []
  const walkInline = (inline: Inline[]): void => {
    for (const n of inline) {
      if (n.kind === 'link') out.push(n)
      else if (n.kind === 'em' || n.kind === 'strong') walkInline(n.inline)
    }
  }
  for (const b of blocks) {
    if (b.kind === 'heading' || b.kind === 'paragraph') walkInline(b.inline)
    else if (b.kind === 'blockquote') out.push(...allLinks(b.blocks))
    else if (b.kind === 'list') for (const item of b.items) out.push(...allLinks(item))
  }
  return out
}

describe('the injection corpus (SPEC-C7) — every entry produces only text/link AST nodes, never throws', () => {
  const CORPUS: readonly string[] = [
    '<script>alert(1)</script>',
    '<script src="evil.js"></script>',
    '<img src="x" onerror="alert(1)">',
    '<div onclick="alert(1)">click me</div>',
    '<svg onload="alert(1)">',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">click</a>',
    '<style>body{background:url("javascript:alert(1)")}</style>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<div class="card">\n<script>alert(1)</script>\n</div>',
  ]

  for (const payload of CORPUS) {
    it(`never throws and produces no raw-HTML node kind: ${JSON.stringify(payload).slice(0, 60)}`, () => {
      expect(() => parse(payload)).not.toThrow()
      const blocks = parse(payload)
      // TS structural guarantee: Block/Inline unions carry no 'html'/'raw' kind at all — assert every
      // block/inline we DO see is one of the known, safe kinds (the parser cannot produce anything else).
      const KNOWN_BLOCK_KINDS = new Set(['heading', 'paragraph', 'list', 'blockquote', 'code', 'table'])
      const walk = (bs: Block[]): void => {
        for (const b of bs) {
          expect(KNOWN_BLOCK_KINDS.has(b.kind)).toBe(true)
          if (b.kind === 'blockquote') walk(b.blocks)
          if (b.kind === 'list') for (const item of b.items) walk(item)
        }
      }
      walk(blocks)
    })
  }

  it('the raw <script> tag text appears only as inert TEXT content — never dropped, never a script node', () => {
    const blocks = parse('<script>alert(1)</script>')
    const text = allText(blocks)
    expect(text).toContain('<script>alert(1)</script>') // present as literal text (SPEC-C7 AC1)
  })

  it('an onerror-bearing raw tag appears only as text', () => {
    const blocks = parse('<img src="x" onerror="alert(1)">')
    expect(allText(blocks)).toContain('onerror="alert(1)"')
  })

  it('a javascript: link parses to a LINK node with the raw href verbatim — denied downstream (SPEC-C6 AC3), not here', () => {
    const blocks = parse('[click](javascript:alert(1))')
    const links = allLinks(blocks)
    expect(links).toEqual([{ kind: 'link', text: 'click', href: 'javascript:alert(1)' }])
  })

  it('a data:text/html link also parses verbatim — the SAME single gate denies it downstream', () => {
    const inline = parseInline('[x](data:text/html,<script>alert(1)</script>)')
    expect(inline).toContainEqual({ kind: 'link', text: 'x', href: 'data:text/html,<script>alert(1)</script>' })
  })

  it('mixed prose + injection payload: the safe prose still parses as structure, the payload stays inert text', () => {
    const blocks = parse('# Report\n\n<script>alert(1)</script>\n\nEnd of report.')
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 })
    expect(blocks.some((b) => b.kind === 'paragraph')).toBe(true)
    expect(allText(blocks)).toContain('<script>alert(1)</script>')
  })
})
