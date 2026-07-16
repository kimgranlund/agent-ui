
// component-descriptor-quoted-default.test.ts — rule 5b's own gate + negative control (TKT-0070, closing
// TKT-0069's String(default) hole): a QUOTED scalar default on a boolean/number attribute is a YAML
// mis-typing the contract↔props trip-wire is structurally blind to (it compares String(config.default),
// so 'false' == false) — the schema now rejects it at validation. String attributes' quoted defaults
// ('') stay legal.
import { describe, it, expect } from 'vitest'
import { parseDescriptor, validateComponentDescriptor } from './component-descriptor.ts'

const FENCE = (dflt: string): string => `tag: ui-fake
tier: display
extends: UIElement
attributes:
  - name: persistent
    type: boolean
    default: ${dflt}
    reflect: true
events: []
slots: []
customStates: []
face:
  formAssociated: false
`
describe('rule 5b — quoted scalar default on a typed attribute (TKT-0070 negative control)', () => {
  it("default: 'false' (QUOTED) on a boolean FAILS", () => {
    const failures = validateComponentDescriptor(parseDescriptor(FENCE("'false'")))
    expect(failures.some((f) => f.code === 'BAD_ATTRIBUTE' && /QUOTED default/.test(f.message))).toBe(true)
  })
  it('default: false (bare) on a boolean PASSES rule 5b', () => {
    const failures = validateComponentDescriptor(parseDescriptor(FENCE('false')))
    expect(failures.some((f) => /QUOTED default/.test(f.message))).toBe(false)
  })
})
