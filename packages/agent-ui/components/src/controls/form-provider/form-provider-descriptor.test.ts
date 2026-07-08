import { describe, it, expect } from 'vitest'
import { UIFormProviderElement } from './form-provider.ts'
import { splitFrontmatter, parseDescriptor, validateComponentDescriptor, compareDescriptorToProps } from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// Read form-provider.md as text (no `@types/node` devDep — same readFileSync approach as the button s10 probe).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G7 s10 — form-provider.md descriptor (ADR-0004 / ADR-0050 / LLD-C7/C8, field-form-provider.lld.md §4).
// `ui-form-provider` is the fleet's FIRST component with a genuinely EMPTY `static props` (LLD-C7: "a
// coordination element takes no configuration"). Fleet-wide, every control — even a near-empty
// row/column/grid/tabs — still declares `static props = props`; this slice's own s10 pass found
// form-provider.ts initially had NO `static props` field at all, which does not even type-check as the
// `Class.props` argument every other descriptor test passes to `compareDescriptorToProps` (TS2339). Flagged
// back to the coordinator rather than shimmed here (a hand-rolled `{}` stand-in would defeat the trip-wire —
// it could never catch a REAL future drift); s5's builder resolved it the fleet-convention way,
// `static props = {} satisfies PropsSchema` (form-provider.ts, zero behavior change) — so the REAL comparator
// now runs below, same as every other component. Two layers:
//   • (a) STRUCTURAL — the frontmatter parses and is schema-valid: validateComponentDescriptor reports ZERO
//     failures (extends UIElement accepted by BASE_CLASSES; face.formAssociated=false). This ALSO verifies
//     the LLD-C7-flagged concern — that parseDescriptor's explicit inline-`[]` branch
//     (component-descriptor.ts:162) actually fires for `attributes: []`, producing a real (present, empty)
//     sequence, not a silently-absent field the schema would reject as MISSING_FIELD.
//   • (b) CONTRACT↔PROPS — the empty bijection (0 descriptor attributes ≡ 0 live props), through the real
//     `compareDescriptorToProps`, plus the planted-phantom negative control (the empty side is not vacuously
//     permissive — an added attribute still trips DRIFT_EXTRA).

const PROVIDER = `${process.cwd()}/packages/agent-ui/components/src/controls/form-provider`
const md = readFileSync(`${PROVIDER}/form-provider.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

describe('form-provider.md descriptor — frontmatter parses + schema-valid (s10 part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-form-provider') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-form-provider, extends UIElement, and face records a non-form-associated coordinator', () => {
    expect(/^tag:\s*ui-form-provider\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true) // NOT UIFormElement — the provider carries no value of its own
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('the parser\'s explicit inline-`[]` branch fires for `attributes: []` (LLD-C7 flag) — present, empty, not missing', () => {
    // The empty side of the bijection: zero descriptor attributes. A silently-absent `attributes` field
    // would also yield `parsed.attributes.length === 0`, so the anti-vacuous check is that the sequence is
    // PRESENT (component-descriptor.ts:162's dedicated inline-`[]` branch actually ran), not merely defaulted.
    expect(parsed.sequences.has('attributes')).toBe(true)
    expect(parsed.sequences.get('attributes')).toEqual([])
    expect(parsed.attributes).toEqual([])
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid, self-contained)', () => {
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('form-provider.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UIFormProviderElement).props (0 ≡ 0, empty both sides)', () => {
    // anti-vacuous: the descriptor genuinely parsed to zero attributes before the trip-wire is consulted
    expect(parsed.attributes).toEqual([])
    expect(compareDescriptorToProps(parsed.attributes, UIFormProviderElement.props)).toEqual([])
  })

  it('a planted phantom attribute FAILS the trip-wire (negative control — the empty side is not vacuously permissive)', () => {
    // ADD a phantom attribute → the descriptor row has no live prop (DRIFT_EXTRA), same as every other component.
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIFormProviderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
