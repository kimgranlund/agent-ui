import { describe, it, expect } from 'vitest'
import { UIButtonElement } from './button.ts'
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
// Read button.md as text (vite strips `.md?raw`; no `@types/node` devDep — same approach as the s6/s7 probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s8 + s10 + s11 — button.md descriptor (ADR-0004). Three layers:
//   • s8 (structural) — the YAML frontmatter fence parses and carries the ADR-0004 / plan §10 field set.
//   • s10 (contract↔props) — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     `UIButtonElement.props` (what `finalize` installs from), via the fleet-wide compareDescriptorToProps
//     trip-wire. This SUPERSEDES s8's by-hand attribute checks: the gate now lives in ONE reusable function
//     (proven fleet-wide in src/descriptor/component-descriptor-driftwire.test.ts), applied here to the button.
//   • s11 (contract↔source) — the facts with NO `static props` row (customStates/slots) are cross-checked
//     against where they ACTUALLY live: the .ts internals.states usage + the .css :state()/[slot] selectors,
//     via compareDescriptorToSource (proven non-vacuous per-code in component-descriptor-sourcewire.test.ts).
// The fence READER lives in ../../descriptor/component-descriptor.ts (factored out at s9 so this probe, the
// s9 schema, and the s10/s11 trip-wires share ONE parser — never a divergent copy).

const BTN = `${process.cwd()}/packages/agent-ui/components/src/controls/button`
const md = readFileSync(`${BTN}/button.md`, 'utf8') as string
const ts = readFileSync(`${BTN}/button.ts`, 'utf8') as string
const css = readFileSync(`${BTN}/button.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

describe('button.md descriptor — frontmatter parses (s8)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-button') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-button and face records a non-form-associated control', () => {
    expect(/^tag:\s*ui-button\s*$/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // extends UIElement, NOT UIFormElement
  })
})

describe('button.md descriptor — contract↔props trip-wire (s10)', () => {
  it('attributes[] is a faithful bijection with finalize(UIButtonElement).props (0 drift)', () => {
    // anti-vacuous: the reader actually parsed variant/size/disabled before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(['variant', 'size', 'disabled'])
    expect(compareDescriptorToProps(parsed.attributes, UIButtonElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    // mutate a COPY of the parsed descriptor (button.md is never touched); each patch flips ONE field.
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'variant' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIButtonElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.variant.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, default: 'sm' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIButtonElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.size.default' }),
    )
  })
})

describe('button.md descriptor — contract↔source trip-wire (s11)', () => {
  it('customStates/slots tell the truth about button.ts + button.css (0 source-drift)', () => {
    // anti-vacuous: the source-scan extractors actually found the real facts before the trip-wire is consulted.
    expect([...collectUsedStates(ts, css)]).toEqual(['ready']) // internals.states.add('ready') + :state(ready)
    expect([...collectStyledSlots(css)].sort()).toEqual(['leading', 'trailing']) // `label` is the unstyled default cell
    expect(scalarSeq(parsed, 'customStates')).toEqual(['ready'])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
