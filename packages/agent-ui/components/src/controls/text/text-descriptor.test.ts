import { describe, it, expect } from 'vitest'
import { UITextElement } from './text.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// Read text.md/text.ts/text.css as text (vite strips `.md?raw`; no `@types/node` devDep — same approach
// as the s6/s7 probes).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// ADR-0078 / text.md descriptor — three layers per the s8/s10/s11 pattern (button-descriptor precedent):
//   • s8 (structural) — the YAML frontmatter fence parses and carries the ADR-0004 / plan §10 field set.
//   • s10 (contract↔props) — `attributes[]` is a faithful bijection with UITextElement.props (variant/size/as,
//     the ADR-0078 three-axis redesign — supersedes the single-prop ADR-0025 shape) + `href` (ADR-0114, the
//     hyperlink capability) + `truncate` (ADR-0106, the fourth axis) + `emphasis` (ADR-0109, the fifth axis).
//   • s11 (contract↔source) — customStates/slots cross-checked against text.ts internals.states + text.css
//     :state()/[slot] selectors (still zero — a Display leaf with no internals usage and no named slots;
//     ADR-0114's `a[href]` selector is an attribute selector, not a named [slot], so this stays zero too).

const TXT = `${process.cwd()}/packages/agent-ui/components/src/controls/text`
const md = readFileSync(`${TXT}/text.md`, 'utf8') as string
const ts = readFileSync(`${TXT}/text.ts`, 'utf8') as string
const css = readFileSync(`${TXT}/text.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

describe('text.md descriptor — frontmatter parses (s8)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-text') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-text, tier is display, face records a non-form-associated display leaf', () => {
    expect(/^tag:\s*ui-text\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*display/m.test(fence)).toBe(true) // the Display size-class (no control frame)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // extends UIElement, NOT UIFormElement
  })
})

describe('text.md descriptor — contract↔props trip-wire (s10, ADR-0078 three-axis + ADR-0114 href + ADR-0106 truncate + ADR-0109 emphasis)', () => {
  it('attributes[] is a faithful bijection with UITextElement.props (variant, size, as, href, truncate, emphasis — in that order)', () => {
    // anti-vacuous: the reader actually parsed all six props before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(['variant', 'size', 'as', 'href', 'truncate', 'emphasis'])
    expect(compareDescriptorToProps(parsed.attributes, UITextElement.props)).toEqual([])
  })

  it('variant is enum, reflect=true, default=body, the 9-role vocabulary', () => {
    const v = parsed.attributes.find((a) => a.name === 'variant')
    expect(v?.type).toBe('enum')
    expect(v?.default).toBe('body')
    expect(v?.reflect).toBe(true)
    expect(v?.values).toEqual(['display', 'headline', 'title', 'body', 'label', 'kicker', 'overline', 'quote', 'lead'])
  })

  it('size is enum, reflect=true, default=md, sm/md/lg', () => {
    const s = parsed.attributes.find((a) => a.name === 'size')
    expect(s?.type).toBe('enum')
    expect(s?.default).toBe('md')
    expect(s?.reflect).toBe(true)
    expect(s?.values).toEqual(['sm', 'md', 'lg'])
  })

  it('as is enum, reflect=true, default=none, the 11-tag stamping vocabulary (incl. h6/blockquote/a — ADR-0114)', () => {
    const a = parsed.attributes.find((x) => x.name === 'as')
    expect(a?.type).toBe('enum')
    expect(a?.default).toBe('none')
    expect(a?.reflect).toBe(true)
    expect(a?.values).toEqual(['none', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'blockquote', 'a'])
  })

  it('href is string, reflect=true, default=\'\' (ADR-0114 — the HOST reflection is inert, SPEC-R9)', () => {
    const h = parsed.attributes.find((x) => x.name === 'href')
    expect(h?.type).toBe('string')
    expect(h?.default).toBe('')
    expect(h?.reflect).toBe(true)
  })

  it('truncate is boolean, reflect=true, default=false (ADR-0106)', () => {
    const t = parsed.attributes.find((x) => x.name === 'truncate')
    expect(t?.type).toBe('boolean')
    expect(t?.default).toBe('false') // default OFF — the trip-wire compares String(config.default)
    expect(t?.reflect).toBe(true)
  })

  it('emphasis is boolean, reflect=true, default=false (ADR-0109)', () => {
    const e = parsed.attributes.find((x) => x.name === 'emphasis')
    expect(e?.type).toBe('boolean')
    expect(e?.default).toBe('false') // default OFF — no shipped visual change
    expect(e?.reflect).toBe(true)
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((x) =>
      x.name === 'as' ? { ...x, reflect: false } : { ...x },
    )
    expect(compareDescriptorToProps(flipReflect, UITextElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.as.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((x) =>
      x.name === 'variant' ? { ...x, default: 'display' } : { ...x },
    )
    expect(compareDescriptorToProps(flipDefault, UITextElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.variant.default' }),
    )
  })
})

describe('text.md descriptor — contract↔source trip-wire (s11)', () => {
  it('customStates/slots tell the truth about text.ts + text.css (0 source-drift)', () => {
    // ui-text has NO custom states (no :state(ready) — a Display leaf has nothing to transition) and NO
    // styled slots (light-DOM, host-as-content — the default children, and the `as` stamp, are not a
    // named [slot] in CSS).
    expect([...collectUsedStates(ts, css)]).toEqual([]) // no internals.states usage; no :state() in css
    expect([...collectStyledSlots(css)]).toEqual([]) // no [slot=...] selectors
    expect(scalarSeq(parsed, 'customStates')).toEqual([]) // descriptor records none
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-text code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }),
    )
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(
      expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }),
    )
  })
})
