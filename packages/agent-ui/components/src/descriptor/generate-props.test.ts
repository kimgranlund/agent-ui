import { describe, it, expect } from 'vitest'
import { generatePropsModule, baseNameFromTag } from './generate-props.ts'

// generate-props.test.ts — the GENERATOR's own synthetic unit tests (ADR-0173 cl.3/cl.4). Every branch of
// `generatePropsModule` gets a real, minimal synthetic descriptor fixture — plain bare prop.*() calls per
// kind, a const:-declared enum, a codec: reference, description: emission, attribute: overrides — plus a
// per-code negative control proving each GEN_* failure genuinely bites. The real fleet controls' own
// byte-identity proof lives in `props-gen-driftwire.test.ts`; this file proves the GENERATOR's logic in
// isolation, synthetic-input-driven (the component-descriptor-driftwire.test.ts precedent for s10).

const fence = (body: string): string => `---\n${body}\n---\n\n# doc\n`

describe('generatePropsModule — baseNameFromTag', () => {
  it('strips the ui- prefix', () => {
    expect(baseNameFromTag('ui-button')).toBe('button')
    expect(baseNameFromTag('ui-status-stream')).toBe('status-stream')
  })
})

describe('generatePropsModule — whole-descriptor failure modes (GEN_DESCRIPTOR_UNRESOLVED)', () => {
  it('no frontmatter fence at all', () => {
    const result = generatePropsModule('not a descriptor')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_DESCRIPTOR_UNRESOLVED', path: 'fence' }))
  })

  it('no tag: scalar', () => {
    const result = generatePropsModule(fence('attributes:\n  - name: x\n    type: string\n    default: \'\'\n    reflect: false'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_DESCRIPTOR_UNRESOLVED', path: 'tag' }))
  })

  it('zero attributes', () => {
    const result = generatePropsModule(fence('tag: ui-zz\nattributes: []'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_DESCRIPTOR_UNRESOLVED', path: 'attributes' }))
  })
})

describe('generatePropsModule — the plain bare-prop.*() majority case (every codec kind, no const/codec)', () => {
  const md = fence(`tag: ui-zz
attributes:
  - name: label
    type: string
    default: ''
    reflect: false
  - name: count
    type: number
    default: 0
    reflect: false
  - name: open
    type: boolean
    default: false
    reflect: true
  - name: variant
    type: enum
    values: [solid, soft, ghost]
    default: solid
    reflect: true`)

  it('anti-vacuous: succeeds and emits every prop, source-declaration order', () => {
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toContain("import { prop, type PropsSchema } from '../../dom/index.ts'")
    expect(result.code).toContain("label: prop.string(''),")
    expect(result.code).toContain('count: prop.number(0),')
    expect(result.code).toContain("open: { ...prop.boolean(false), reflect: true },")
    expect(result.code).toContain("variant: { ...prop.enum(['solid', 'soft', 'ghost'] as const, 'solid'), reflect: true },")
    // declaration order preserved
    const order = ['label:', 'count:', 'open:', 'variant:'].map((needle) => result.code.indexOf(needle))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('is byte-stable across repeated calls (determinism, cl.4a)', () => {
    const a = generatePropsModule(md)
    const b = generatePropsModule(md)
    expect(a).toEqual(b)
  })

  it('a prop with no reflect/attribute override stays a BARE prop.*() call, never a needless spread', () => {
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).not.toContain('{ ...prop.string')
    expect(result.code).not.toContain('{ ...prop.number')
  })
})

describe('generatePropsModule — attribute: override (a string name and the literal false)', () => {
  it('a string override emits attribute: "…"', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: iconOnly
    type: boolean
    default: false
    reflect: true
    attribute: icon-only`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toContain("iconOnly: { ...prop.boolean(false), reflect: true, attribute: 'icon-only' },")
  })

  it('attribute: false emits attribute: false (property-only)', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: sizes
    type: json
    tsType: number[] | undefined
    default: undefined
    reflect: false
    attribute: false`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toContain('sizes: { ...prop.json<number[] | undefined>(undefined), attribute: false },')
  })
})

describe('generatePropsModule — const: shared-tuple enum (ADR-0173 cl.2/12-control pattern)', () => {
  const md = fence(`tag: ui-zz
attributes:
  - name: intent
    type: enum
    values: [neutral, info, success, warning, danger]
    default: neutral
    reflect: true
    const: INTENTS`)

  it('emits an exported const tuple ABOVE props, and the prop references it by name', () => {
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toContain("export const INTENTS = ['neutral', 'info', 'success', 'warning', 'danger'] as const")
    expect(result.code).toContain('intent: { ...prop.enum(INTENTS, \'neutral\'), reflect: true },')
    expect(result.code.indexOf('export const INTENTS')).toBeLessThan(result.code.indexOf('export const props'))
  })

  it('two rows sharing the SAME const name with the SAME values reuse one export (no duplicate)', () => {
    const twice = fence(`tag: ui-zz
attributes:
  - name: a
    type: enum
    values: [x, y]
    default: x
    reflect: false
    const: XY
  - name: b
    type: enum
    values: [x, y]
    default: y
    reflect: false
    const: XY`)
    const result = generatePropsModule(twice)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code.match(/export const XY/g)?.length).toBe(1)
  })

  it('GEN_CONST_UNRESOLVED: the same const name reused with DIFFERING values conflicts', () => {
    const conflict = fence(`tag: ui-zz
attributes:
  - name: a
    type: enum
    values: [x, y]
    default: x
    reflect: false
    const: XY
  - name: b
    type: enum
    values: [x, z]
    default: x
    reflect: false
    const: XY`)
    const result = generatePropsModule(conflict)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_CONST_UNRESOLVED' }))
  })
})

describe('generatePropsModule — codec: reference (ADR-0173 OF1 — the 7 bespoke-codec controls)', () => {
  it('imports the codec by name and splices a bare reference (no prop.*() synthesized)', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: columns
    type: json
    default: ''
    reflect: false
    codec: { import: './zz-model.ts', name: 'zzColumnsProp' }`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toContain("import { zzColumnsProp } from './zz-model.ts'")
    expect(result.code).toContain('columns: zzColumnsProp,')
    // no `prop` import needed — the whole descriptor is codec-only
    expect(result.code).toContain("import { type PropsSchema } from '../../dom/index.ts'")
  })

  it('multiple codec attributes from the SAME source dedupe into one import line, sorted', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: rows
    type: json
    default: ''
    reflect: false
    codec: { import: './zz-model.ts', name: 'zzRowsProp' }
  - name: columns
    type: json
    default: ''
    reflect: false
    codec: { import: './zz-model.ts', name: 'zzColumnsProp' }`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code.match(/from '\.\/zz-model\.ts'/g)?.length).toBe(1)
    expect(result.code).toContain("import { zzColumnsProp, zzRowsProp } from './zz-model.ts'")
  })

  it('a reflect/attribute override on a codec prop spreads over the imported identifier', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: columns
    type: json
    default: ''
    reflect: true
    codec: { import: './zz-model.ts', name: 'zzColumnsProp' }`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toContain('columns: { ...zzColumnsProp, reflect: true },')
  })

  it('GEN_CODEC_UNRESOLVED: codec: declared but missing name', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: columns
    type: json
    default: ''
    reflect: false
    codec: { import: './zz-model.ts' }`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_CODEC_UNRESOLVED', path: 'attributes.columns.codec' }))
  })

  it('GEN_CODEC_UNRESOLVED: codec: declared but missing import', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: columns
    type: json
    default: ''
    reflect: false
    codec: { name: 'zzColumnsProp' }`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_CODEC_UNRESOLVED' }))
  })
})

describe('generatePropsModule — description: emission (ADR-0173 OF2, provenance-stamped)', () => {
  it('a description: rides a leading comment above the field, WITH the regenerate stamp', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: label
    type: string
    default: ''
    reflect: false
    description: The accessible name.`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toContain('// The accessible name. — generated from zz.md attributes.label — edit the descriptor, not this file.')
  })

  it('absent description: still emits a bare provenance stamp (never silent)', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: label
    type: string
    default: ''
    reflect: false`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toContain('// generated from zz.md attributes.label — edit the descriptor, not this file.')
  })
})

describe('generatePropsModule — type: json without codec: requires tsType (GEN_TYPE_UNRESOLVED)', () => {
  it('no tsType fails, named and coded', () => {
    const md = fence(`tag: ui-zz
attributes:
  - name: sizes
    type: json
    default: undefined
    reflect: false`)
    const result = generatePropsModule(md)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_TYPE_UNRESOLVED', path: 'attributes.sizes.tsType' }))
  })

  it('with tsType, "undefined"/"null" defaults reparse to the literal keyword, not a JSON.parse attempt', () => {
    const undef = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: sizes
    type: json
    tsType: number[] | undefined
    default: undefined
    reflect: false`))
    expect(undef.ok).toBe(true)
    if (undef.ok) expect(undef.code).toContain('prop.json<number[] | undefined>(undefined)')

    const nul = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: sort
    type: json
    tsType: '{key:string} | null'
    default: null
    reflect: false`))
    expect(nul.ok).toBe(true)
    if (nul.ok) expect(nul.code).toContain("prop.json<{key:string} | null>(null)")
  })

  it('a well-formed JSON default round-trips through JSON.parse/stringify', () => {
    const result = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: point
    type: json
    tsType: '{x:number,y:number}'
    default: '{"x":0,"y":0}'
    reflect: false`))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.code).toContain('prop.json<{x:number,y:number}>({"x":0,"y":0})')
  })

  it('GEN_DEFAULT_UNRESOLVED: a malformed JSON default (not undefined/null/parseable) fails, named and coded', () => {
    const result = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: point
    type: json
    tsType: '{x:number}'
    default: 'not json'
    reflect: false`))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_DEFAULT_UNRESOLVED', path: 'attributes.point.default' }))
  })
})

describe('generatePropsModule — default-reparse failures for boolean/number/enum (GEN_DEFAULT_UNRESOLVED)', () => {
  it('a boolean default that is not exactly true|false fails', () => {
    const result = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: open
    type: boolean
    default: yes
    reflect: false`))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_DEFAULT_UNRESOLVED', path: 'attributes.open.default' }))
  })

  it('a non-finite/non-numeric number default fails (null is legal, "" and "abc" are not)', () => {
    const bad = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: current
    type: number
    default: abc
    reflect: false`))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.failures).toContainEqual(expect.objectContaining({ code: 'GEN_DEFAULT_UNRESOLVED', path: 'attributes.current.default' }))

    const nul = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: current
    type: number
    default: null
    reflect: false`))
    expect(nul.ok).toBe(true)
    if (nul.ok) expect(nul.code).toContain('current: prop.number(null),')
  })

  it('an enum default outside values[] fails', () => {
    const result = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: variant
    type: enum
    values: [solid, soft]
    default: ghost
    reflect: false`))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_DEFAULT_UNRESOLVED', path: 'attributes.variant.default' }))
  })
})

describe('generatePropsModule — an unresolvable/missing type fails GEN_TYPE_UNRESOLVED', () => {
  it('a row with no type at all', () => {
    const result = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: mystery
    default: ''
    reflect: false`))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_TYPE_UNRESOLVED', path: 'attributes.mystery.type' }))
  })
})

describe('generatePropsModule — failures COLLECT (never fail-fast on the first bad row)', () => {
  it('two independently-bad rows both surface in one failures[] array', () => {
    const result = generatePropsModule(fence(`tag: ui-zz
attributes:
  - name: a
    type: boolean
    default: nope
    reflect: false
  - name: b
    type: json
    default: undefined
    reflect: false`))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_DEFAULT_UNRESOLVED', path: 'attributes.a.default' }))
    expect(result.failures).toContainEqual(expect.objectContaining({ code: 'GEN_TYPE_UNRESOLVED', path: 'attributes.b.tsType' }))
    expect(result.failures.length).toBeGreaterThanOrEqual(2)
  })
})
