import { describe, it, expect } from 'vitest'
import { prop } from '../dom/index.ts'
import { compareDescriptorToProps, type LiveProps, type ParsedAttribute } from './component-descriptor.ts'

// Phase-1 s10 — the contract↔props TRIP-WIRE, proven FLEET-WIDE (this is the reusable gate; the button apply
// + button drift control live in controls/button/button-descriptor.test.ts). The reference table spans EVERY
// codec kind built from the real `prop.*` constructors (NOT a hand-rolled mimic), so kindOf/enumMembersMatch
// are proven against the production codecs. Two halves: a faithful descriptor matches (0 drift, anti-vacuous
// across all kinds), and a per-code negative control flips ONE field to yield exactly the targeted DRIFT_*.

// A live `static props` table covering enum · number · string · boolean · json (reflect set where the prop reflects).
const LIVE: LiveProps = {
  variant: { ...prop.enum(['solid', 'soft', 'ghost'] as const, 'solid'), reflect: true },
  count: prop.number(0),
  label: prop.string('hi'),
  open: { ...prop.boolean(false), reflect: true },
  data: prop.json<number>(42),
}

// The faithful descriptor: one attribute row per live prop, every field agreeing (default is `String(default)`).
const GOOD: ReadonlyArray<ParsedAttribute> = [
  { name: 'variant', type: 'enum', values: ['solid', 'soft', 'ghost'], default: 'solid', reflect: true },
  { name: 'count', type: 'number', default: '0', reflect: false },
  { name: 'label', type: 'string', default: 'hi', reflect: false },
  { name: 'open', type: 'boolean', default: 'false', reflect: true },
  { name: 'data', type: 'json', default: '42', reflect: false },
]

/** A fresh copy of GOOD with one named attribute patched (so a control never mutates the shared baseline). */
const patch = (name: string, over: Partial<ParsedAttribute>): ParsedAttribute[] =>
  GOOD.map((a) => (a.name === name ? { ...a, ...over } : { ...a }))

/** The DRIFT_* codes present in a comparison result. */
const codesOf = (attrs: ParsedAttribute[]) => compareDescriptorToProps(attrs, LIVE).map((f) => f.code)

describe('contract↔props trip-wire — faithful descriptor matches (s10)', () => {
  it('a per-kind faithful descriptor is a 0-drift bijection with the live props', () => {
    // anti-vacuous: the baseline actually spans all five codec kinds before we assert 0 drift
    expect(GOOD.map((a) => a.type)).toEqual(['enum', 'number', 'string', 'boolean', 'json'])
    expect(compareDescriptorToProps([...GOOD], LIVE)).toEqual([])
  })
})

describe('contract↔props trip-wire — every drift is caught with the targeted code (s10)', () => {
  it('DRIFT_MISSING — a live prop with no descriptor attribute', () => {
    const dropped = GOOD.filter((a) => a.name !== 'count').map((a) => ({ ...a }))
    const failures = compareDescriptorToProps(dropped, LIVE)
    expect(failures).toContainEqual(expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.count' }))
  })

  it('DRIFT_EXTRA — a descriptor attribute with no live prop', () => {
    const extra = [...GOOD.map((a) => ({ ...a })), { name: 'phantom', type: 'string', default: '', reflect: false }]
    const failures = compareDescriptorToProps(extra, LIVE)
    expect(failures).toContainEqual(expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.phantom' }))
  })

  it('DRIFT_TYPE — a boolean prop the descriptor mislabels as string', () => {
    const failures = compareDescriptorToProps(patch('open', { type: 'string' }), LIVE)
    expect(failures).toContainEqual(expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.open.type' }))
  })

  it('DRIFT_DEFAULT — a default token that disagrees with String(config.default)', () => {
    const failures = compareDescriptorToProps(patch('count', { default: '5' }), LIVE)
    expect(failures).toContainEqual(expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.count.default' }))
  })

  it('DRIFT_REFLECT — a reflect flag that disagrees with the live config', () => {
    const failures = compareDescriptorToProps(patch('variant', { reflect: false }), LIVE)
    expect(failures).toContainEqual(expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.variant.reflect' }))
  })

  it('DRIFT_VALUES — an enum member the live codec does not accept', () => {
    const failures = compareDescriptorToProps(patch('variant', { values: ['solid', 'soft', 'ghost', 'plaid'] }), LIVE)
    expect(failures).toContainEqual(expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.variant.values' }))
  })

  it('DRIFT_VALUES — an enum first-member / ordering mismatch (the codec snaps to a different head)', () => {
    const failures = compareDescriptorToProps(patch('variant', { values: ['soft', 'solid', 'ghost'] }), LIVE)
    expect(failures).toContainEqual(expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.variant.values' }))
  })

  it('a single drift yields a single, non-noisy failure (TYPE drift does not also fire VALUES)', () => {
    // `open` mislabelled string: exactly DRIFT_TYPE (no DRIFT_VALUES — the enum branch is gated on a type match)
    expect(codesOf(patch('open', { type: 'string' }))).toEqual(['DRIFT_TYPE'])
  })
})
