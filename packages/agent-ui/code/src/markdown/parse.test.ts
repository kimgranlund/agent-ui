import { describe, it, expect } from 'vitest'
import { parse, parseInline, type Block, type Inline } from './parse.ts'

describe('parse — headings (LLD-C8, SPEC-C6)', () => {
  it('parses ATX headings level 1-6', () => {
    for (let level = 1; level <= 6; level++) {
      const src = `${'#'.repeat(level)} Title ${level}`
      const blocks = parse(src)
      expect(blocks).toEqual([{ kind: 'heading', level, inline: [{ kind: 'text', text: `Title ${level}` }] }])
    }
  })

  it('strips trailing #s (closed ATX form)', () => {
    expect(parse('## Title ##')).toEqual([{ kind: 'heading', level: 2, inline: [{ kind: 'text', text: 'Title' }] }])
  })

  it('7+ leading #s is NOT a heading — falls back to a paragraph', () => {
    const blocks = parse('####### not a heading')
    expect(blocks[0].kind).toBe('paragraph')
  })
})

describe('parse — paragraphs', () => {
  it('a single line is one paragraph', () => {
    expect(parse('hello world')).toEqual([{ kind: 'paragraph', inline: [{ kind: 'text', text: 'hello world' }] }])
  })

  it('a blank line separates two paragraphs', () => {
    const blocks = parse('first\n\nsecond')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].kind).toBe('paragraph')
    expect(blocks[1].kind).toBe('paragraph')
  })

  it('consecutive non-blank lines join one paragraph (soft-wrapped)', () => {
    const blocks = parse('line one\nline two') as Block[]
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'paragraph' })
  })
})

describe('parse — lists (ordered/unordered, nested — I-2)', () => {
  it('an unordered list with three items', () => {
    const blocks = parse('- a\n- b\n- c')
    expect(blocks).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [
          [{ kind: 'paragraph', inline: [{ kind: 'text', text: 'a' }] }],
          [{ kind: 'paragraph', inline: [{ kind: 'text', text: 'b' }] }],
          [{ kind: 'paragraph', inline: [{ kind: 'text', text: 'c' }] }],
        ],
      },
    ])
  })

  it('an ordered list', () => {
    const blocks = parse('1. one\n2. two')
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: true })
  })

  it('a nested list (an unordered sub-list inside an ordered item)', () => {
    const blocks = parse('1. outer\n   - inner a\n   - inner b') as Block[]
    expect(blocks).toHaveLength(1)
    const list = blocks[0] as Extract<Block, { kind: 'list' }>
    expect(list.ordered).toBe(true)
    expect(list.items).toHaveLength(1)
    const itemBlocks = list.items[0]
    expect(itemBlocks[0]).toMatchObject({ kind: 'paragraph' })
    expect(itemBlocks[1]).toMatchObject({ kind: 'list', ordered: false })
  })

  it('asterisk (*) markers also form an unordered list', () => {
    const blocks = parse('* x\n* y')
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: false })
  })
})

describe('parse — blockquotes', () => {
  it('a blockquote containing two paragraphs', () => {
    const blocks = parse('> first\n>\n> second') as Block[]
    expect(blocks).toHaveLength(1)
    const bq = blocks[0] as Extract<Block, { kind: 'blockquote' }>
    expect(bq.kind).toBe('blockquote')
    expect(bq.blocks).toHaveLength(2)
    expect(bq.blocks[0]).toMatchObject({ kind: 'paragraph' })
    expect(bq.blocks[1]).toMatchObject({ kind: 'paragraph' })
  })
})

describe('parse — fenced code (SPEC-C6/C8)', () => {
  it('a fence with a language info-string', () => {
    const blocks = parse('```json\n{"a":1}\n```')
    expect(blocks).toEqual([{ kind: 'code', language: 'json', text: '{"a":1}' }])
  })

  it('an unterminated fence runs to end-of-input as a code block, never throws (LLD-C8)', () => {
    expect(() => parse('```\nnever closes')).not.toThrow()
    const blocks = parse('```\nnever closes')
    expect(blocks).toEqual([{ kind: 'code', language: '', text: 'never closes' }])
  })

  it('a fence with no info-string has an empty language', () => {
    const blocks = parse('```\nplain\n```')
    expect(blocks).toEqual([{ kind: 'code', language: '', text: 'plain' }])
  })
})

describe('parse — GFM tables (I-3)', () => {
  it('a header + separator + two body rows', () => {
    const src = '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |'
    const blocks = parse(src)
    expect(blocks).toEqual([
      { kind: 'table', header: ['a', 'b'], rows: [['1', '2'], ['3', '4']] },
    ])
  })

  it('a ragged row is padded/truncated to the header width (LLD-C8)', () => {
    const src = '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 |\n| 3 | 4 | 5 | 6 |'
    const blocks = parse(src) as Block[]
    const table = blocks[0] as Extract<Block, { kind: 'table' }>
    expect(table.rows[0]).toEqual(['1', '2', '']) // padded
    expect(table.rows[1]).toEqual(['3', '4', '5']) // truncated
  })

  it('a table with NO --- separator is NOT a table — falls back to paragraphs (the GFM rule)', () => {
    const blocks = parse('| a | b |\n| 1 | 2 |')
    expect(blocks.every((b) => b.kind !== 'table')).toBe(true)
  })

  it('alignment markers in the separator are recognized (parsed) but not stored (not rendered, I-3)', () => {
    const src = '| a | b |\n| :--- | ---: |\n| 1 | 2 |'
    const blocks = parse(src)
    expect(blocks[0].kind).toBe('table')
  })
})

describe('parse — inline (I-1: em/strong/code/link)', () => {
  it('strong, em, inline code, and a link all parse', () => {
    const inline = parseInline('a **bold** word, an *em* word, `code`, and a [link](https://example.com)')
    expect(inline).toContainEqual({ kind: 'strong', inline: [{ kind: 'text', text: 'bold' }] })
    expect(inline).toContainEqual({ kind: 'em', inline: [{ kind: 'text', text: 'em' }] })
    expect(inline).toContainEqual({ kind: 'code', text: 'code' })
    expect(inline).toContainEqual({ kind: 'link', text: 'link', href: 'https://example.com' })
  })

  it('unbalanced emphasis (**bold with no closer) stays literal text', () => {
    const inline = parseInline('this is **not closed')
    expect(inline).toEqual([{ kind: 'text', text: 'this is **not closed' }])
  })

  it('an unmatched inline-code backtick stays literal text', () => {
    const inline = parseInline('a stray ` backtick')
    expect(inline).toEqual([{ kind: 'text', text: 'a stray ` backtick' }])
  })

  it('an unmatched link bracket stays literal text', () => {
    const inline = parseInline('a [bracket with no close')
    expect(inline).toEqual([{ kind: 'text', text: 'a [bracket with no close' }])
  })

  it('nested emphasis (strong containing em) recurses correctly', () => {
    const inline = parseInline('**bold *and em* together**')
    expect(inline).toHaveLength(1)
    const strong = inline[0] as Extract<Inline, { kind: 'strong' }>
    expect(strong.kind).toBe('strong')
    expect(strong.inline).toContainEqual({ kind: 'em', inline: [{ kind: 'text', text: 'and em' }] })
  })

  it('the link href is kept VERBATIM — the parser applies no scheme logic (SPEC-C6/C8, one gate not two)', () => {
    const inline = parseInline('[x](javascript:alert(1))')
    expect(inline).toEqual([{ kind: 'link', text: 'x', href: 'javascript:alert(1)' }])
  })
})

describe('parse — out-of-subset syntax stays literal text, never throws, never a half-render (LLD-C8)', () => {
  it('a raw HTML block renders as literal text lines (SPEC-C7 AC1) — this IS the fence, not a bug', () => {
    const blocks = parse('<div class="card">\nhello\n</div>')
    expect(blocks.every((b) => b.kind === 'paragraph')).toBe(true)
    const joined = blocks
      .flatMap((b) => (b.kind === 'paragraph' ? b.inline : []))
      .map((i) => (i.kind === 'text' ? i.text : ''))
      .join('\n')
    expect(joined).toContain('<div class="card">')
  })

  it('an autolink stays literal text (out of subset)', () => {
    const inline = parseInline('see <https://example.com> for more')
    expect(inline).toEqual([{ kind: 'text', text: 'see <https://example.com> for more' }])
  })

  it('a footnote reference stays literal text (out of subset)', () => {
    const inline = parseInline('a claim[^1]')
    expect(inline).toEqual([{ kind: 'text', text: 'a claim[^1]' }])
  })

  it('inline math stays literal text (out of subset)', () => {
    const inline = parseInline('the value is $x^2$')
    expect(inline).toEqual([{ kind: 'text', text: 'the value is $x^2$' }])
  })

  it('never throws on pathological/empty input', () => {
    expect(() => parse('')).not.toThrow()
    expect(parse('')).toEqual([])
    expect(() => parse('\n\n\n')).not.toThrow()
    expect(() => parse('#'.repeat(500))).not.toThrow()
  })
})
