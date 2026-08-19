import { describe, it, expect } from 'vitest'
import { UISuggestionsElement } from './suggestions.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// suggestions-descriptor.test.ts — the description-list.md/stat.md three-layer pattern: structural,
// contract↔props, contract↔source (ADR-0004/ADR-0213). `suggestions` classifies by BEHAVIOUR (kindOf
// probes the codec): from(null) is `[]` (an array) ⇒ 'json'. `selected` classifies as 'string'. `disabled`
// is a plain getter (suggestions.ts), NEVER a `static props` row — it must stay ABSENT from both
// UISuggestionsElement.props and this descriptor's attributes[], or the bijection trip-wire fires
// DRIFT_EXTRA/DRIFT_MISSING; the negative control below proves that.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/suggestions`
const md = readFileSync(`${DIR}/suggestions.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/suggestions.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/suggestions.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['suggestions', 'selected']

describe('kindOf build-verify — suggestions/selected classify correctly', () => {
  it('suggestions: the safeJsonCodec-shaped array prop classifies as "json" (zero drift as declared)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UISuggestionsElement.props)
    expect(drift.filter((d) => d.path.startsWith('attributes.suggestions'))).toEqual([])
  })

  it('selected: the string prop classifies as "string" (zero drift as declared)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UISuggestionsElement.props)
    expect(drift.filter((d) => d.path.startsWith('attributes.selected'))).toEqual([])
  })

  it('NEGATIVE: suggestions mis-declared as "string" fails DRIFT_TYPE (kindOf does not blindly green everything)', () => {
    const flip = parsed.attributes.map((a) => (a.name === 'suggestions' ? { ...a, type: 'string' } : a))
    expect(compareDescriptorToProps(flip, UISuggestionsElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.suggestions.type' }),
    )
  })
})

describe('suggestions.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-suggestions')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-suggestions, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-suggestions\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events[] declares exactly `select`', () => {
    const names = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(names).toEqual(['select'])
  })
})

describe('suggestions.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UISuggestionsElement.props (zero drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UISuggestionsElement.props)).toEqual([])
  })

  it('negative control: a genuinely drifted attribute still FAILS the trip-wire', () => {
    const dropSuggestions = parsed.attributes.filter((a) => a.name !== 'suggestions')
    expect(compareDescriptorToProps(dropSuggestions, UISuggestionsElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.suggestions' }),
    )
    const phantom = [...parsed.attributes, { name: 'phantom', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(phantom, UISuggestionsElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.phantom' }),
    )
  })

  it('NEGATIVE: `disabled` (a derived getter, never a static prop) must stay OFF this list — declaring it would DRIFT_EXTRA', () => {
    const withDisabled = [...parsed.attributes, { name: 'disabled', type: 'boolean', default: 'false', reflect: true }]
    expect(compareDescriptorToProps(withDisabled, UISuggestionsElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.disabled' }),
    )
    expect(Object.keys(UISuggestionsElement.props)).not.toContain('disabled')
  })
})

describe('suggestions.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about the source (0 source-drift)', () => {
    expect([...collectUsedStates(ts, css)]).toEqual(['ready'])
    expect([...collectStyledSlots(css)]).toEqual([]) // no author-slotted content — every chip is control-built
    expect(scalarSeq(parsed, 'customStates')).toEqual(['ready'])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('pending') // synthetic — not real code"
    expect(compareDescriptorToSource(parsed, { ts: syntheticTs, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.pending' }),
    )
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    expect(compareDescriptorToSource(parsed, { ts, css: syntheticCss })).toContainEqual(
      expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }),
    )
  })
})
