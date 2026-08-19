import { describe, it, expect } from 'vitest'
import {
  splitFrontmatter,
  parseDescriptor,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
// Read button.md as text (vite strips `.md?raw`; no `@types/node` devDep — same approach as the s6/s7 probes).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s8 + s11 — button.md descriptor (ADR-0004; ADR-0173 for the s10 retirement below). Two layers now:
//   • s8 (structural) — the YAML frontmatter fence parses and carries the ADR-0004 / plan §10 field set.
//   • s11 (contract↔source) — the facts with NO `static props` row (customStates/slots) are cross-checked
//     against where they ACTUALLY live: the .ts internals.states usage + the .css :state()/[slot] selectors,
//     via compareDescriptorToSource (proven non-vacuous per-code in component-descriptor-sourcewire.test.ts).
// s10 (contract↔props) RETIRED here (ADR-0173 cl.4c/OF4): button.ts's `static props` now IMPORTS
// `button.props.gen.ts`, itself GENERATED from this same button.md — the descriptor↔props bijection is
// structurally true by construction, not something a runtime trip-wire needs to keep proving. The drift
// gate that replaces it — regenerating in-memory and diffing against the committed generated file — lives
// fleet-wide in `descriptor/props-gen-driftwire.test.ts` (this control's entry lands in the SAME commit as
// this retirement, per cl.4c: never a commit where both exist, never one where neither does).
// The fence READER lives in ../../descriptor/component-descriptor.ts (factored out at s9 so this probe, the
// s9 schema, and the s11 trip-wire share ONE parser — never a divergent copy).

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

  it('parses the real four attributes (anti-vacuous — the generator/drift-gate proof below assumes this)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(['variant', 'size', 'disabled', 'iconOnly', 'inline'])
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
