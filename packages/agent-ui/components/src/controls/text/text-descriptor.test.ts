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
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// ADR-0025 / text.md descriptor — three layers per the s8/s10/s11 pattern (button-descriptor precedent):
//   • s8 (structural) — the YAML frontmatter fence parses and carries the ADR-0004 / plan §10 field set.
//   • s10 (contract↔props) — `attributes[]` is a faithful bijection with UITextElement.props (just `variant`).
//   • s11 (contract↔source) — customStates/slots cross-checked against text.ts internals.states + text.css
//     :state()/[slot] selectors.

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

describe('text.md descriptor — contract↔props trip-wire (s10)', () => {
  it('attributes[] is a faithful bijection with UITextElement.props (single prop: variant)', () => {
    // anti-vacuous: the reader actually parsed variant before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(['variant'])
    expect(compareDescriptorToProps(parsed.attributes, UITextElement.props)).toEqual([])
  })

  it('variant is enum type, reflect=true, default=body', () => {
    const v = parsed.attributes.find((a) => a.name === 'variant')
    expect(v?.type).toBe('enum')
    expect(v?.default).toBe('body')
    expect(v?.reflect).toBe(true)
    expect(v?.values).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body'])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'variant' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UITextElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.variant.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'variant' ? { ...a, default: 'h1' } : { ...a },
    )
    expect(compareDescriptorToProps(flipDefault, UITextElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.variant.default' }),
    )
  })
})

describe('text.md descriptor — contract↔source trip-wire (s11)', () => {
  it('customStates/slots tell the truth about text.ts + text.css (0 source-drift)', () => {
    // ui-text has NO custom states (no :state(ready) — a Display leaf has nothing to transition)
    // and NO styled slots (light-DOM, host-as-content — the default children are not a named slot in CSS).
    expect([...collectUsedStates(ts, css)]).toEqual([]) // no internals.states usage; no :state() in css
    expect([...collectStyledSlots(css)]).toEqual([]) // no [slot=...] selectors (the host IS the text node)
    expect(scalarSeq(parsed, 'customStates')).toEqual([]) // descriptor records none
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    // Prove compareDescriptorToSource bites for ui-text (the all-empty compare above is anti-vacuous here):
    // synthetic .ts text that calls internals.states?.add('ready') — as if ui-text had gained a motion gate.
    // The descriptor still declares NO customStates, so the source-wire must catch STATE_UNDOCUMENTED.
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-text code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }),
    )
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    // Prove the one-directional slot check also bites: synthetic css that uses [slot=leading] — as if a
    // future revision added an adornment slot to ui-text without updating the descriptor.
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(
      expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }),
    )
  })
})
