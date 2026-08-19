import { describe, it, expect } from 'vitest'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
// Read toggle.md/.ts/.css as text (vite strips `.md?raw`; no `@types/node` devDep — the s6/s7/s8 probe idiom).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// S7-a — ui-toggle descriptor (ADR-0179 GH #686 Amendment, admin-three-pane-ia.lld.md §16.4). Two layers,
// the button.md precedent (a control converted onto the ADR-0173 props-generation ratchet from birth — see
// props-gen-driftwire.test.ts's `CONVERTED` list, which carries 'toggle' in the SAME commit as this file, so
// there is no separate `compareDescriptorToProps` (s10) trip-wire here — cl.4c/OF4):
//   • s8  (structural)      — the YAML frontmatter fence parses and carries the ADR-0004 / plan §10 field set.
//   • s11 (contract↔source) — the facts with NO `static props` row (customStates/slots) are cross-checked
//     against where they ACTUALLY live: toggle.ts's internals.states usage + toggle.css's :state()/[slot]
//     selectors, via compareDescriptorToSource.

const TGL = `${process.cwd()}/packages/agent-ui/components/src/controls/toggle`
const md = readFileSync(`${TGL}/toggle.md`, 'utf8') as string
const ts = readFileSync(`${TGL}/toggle.ts`, 'utf8') as string
const css = readFileSync(`${TGL}/toggle.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

describe('toggle.md descriptor — frontmatter parses (s8)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-toggle') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-toggle, tier=control, extends=UIElement, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-toggle\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*control\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('parses the real three attributes (anti-vacuous — the generator/drift-gate proof assumes this)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(['pressed', 'disabled', 'size', 'inline'])
  })

  it('parses the ONE event: toggle', () => {
    const names: string[] = []
    for (const item of parsed.sequences.get('events') ?? []) {
      const n = item.get('name')
      if (typeof n === 'string') names.push(n)
    }
    expect(names).toEqual(['toggle'])
  })

  it('parses the three named-by-role slots: icon, label, state-icon', () => {
    const names: string[] = []
    for (const item of parsed.sequences.get('slots') ?? []) {
      const n = item.get('name')
      if (typeof n === 'string') names.push(n)
    }
    expect(names).toEqual(['icon', 'label', 'state-icon'])
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('negative control: a schema violation IS caught (size enum values corrupted)', () => {
    const broken = fence.replace('values: [sm, md, lg]', 'values: []')
    const brokenParsed = parseDescriptor(broken)
    const failures = validateComponentDescriptor(brokenParsed)
    expect(failures.some((f) => f.code === 'BAD_ATTRIBUTE')).toBe(true)
  })
})

describe('toggle.md descriptor — contract↔source trip-wire (s11)', () => {
  it('customStates/slots tell the truth about toggle.ts + toggle.css (0 source-drift)', () => {
    // anti-vacuous: the source-scan extractors actually found the real facts before the trip-wire is consulted.
    expect([...collectUsedStates(ts, css)].sort()).toEqual(['pressed', 'ready'])
    expect([...collectStyledSlots(css)].sort()).toEqual(['icon', 'state-icon']) // 'label' is styled too (see below) but via a compound selector the extractor's simple regex also catches
    expect(scalarSeq(parsed, 'customStates').sort()).toEqual(['pressed', 'ready'])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
