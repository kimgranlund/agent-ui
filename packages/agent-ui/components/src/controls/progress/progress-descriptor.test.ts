import { describe, it, expect } from 'vitest'
import { UIProgressElement } from './progress.ts'
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

// progress-descriptor.test.ts — the stat.md/button.md three-layer pattern: structural, contract↔props,
// contract↔source. `current` and `max` both ride the fleet's `prop.number` codec — kindOf classifies BOTH
// as "number" purely from the codec's `type.from` BEHAVIOUR (probed on null/''/5 inputs), never from the
// schema default (null vs 100); the dedicated describe block below pins that verdict before trusting the
// descriptor cells that depend on it (the stat.md LLD-C9 build-verify precedent).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/progress`
const md = readFileSync(`${DIR}/progress.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/progress.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/progress.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['current', 'max', 'label']

describe('kindOf build-verify — current AND max both classify "number" despite differing defaults', () => {
  it('current: a null-defaulting numeric codec classifies as "number"', () => {
    const drift = compareDescriptorToProps(
      parsed.attributes.map((a) => (a.name === 'current' ? { ...a, type: 'number' } : a)),
      UIProgressElement.props,
    )
    expect(drift.filter((d) => d.path.startsWith('attributes.current'))).toEqual([])
  })

  it('max: a 100-defaulting numeric codec ALSO classifies as "number" (kindOf probes behaviour, not the default)', () => {
    const drift = compareDescriptorToProps(
      parsed.attributes.map((a) => (a.name === 'max' ? { ...a, type: 'number' } : a)),
      UIProgressElement.props,
    )
    expect(drift.filter((d) => d.path.startsWith('attributes.max'))).toEqual([])
  })

  it('NEGATIVE: current mis-declared as "string" fails DRIFT_TYPE (kindOf does not blindly green everything)', () => {
    const flip = parsed.attributes.map((a) => (a.name === 'current' ? { ...a, type: 'string' } : a))
    expect(compareDescriptorToProps(flip, UIProgressElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.current.type' }),
    )
  })

  it('NEGATIVE: max mis-declared as "boolean" fails DRIFT_TYPE', () => {
    const flip = parsed.attributes.map((a) => (a.name === 'max' ? { ...a, type: 'boolean' } : a))
    expect(compareDescriptorToProps(flip, UIProgressElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.max.type' }),
    )
  })
})

describe('progress.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-progress')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-progress, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-progress\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events: [] — SPEC-R1 AC3, a display leaf emits nothing', () => {
    expect(parsed.sequences.get('events')).toEqual([])
  })
})

describe('progress.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIProgressElement.props by NAME', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const drift = compareDescriptorToProps(parsed.attributes, UIProgressElement.props)
    expect(drift.filter((d) => d.code === 'DRIFT_MISSING' || d.code === 'DRIFT_EXTRA')).toEqual([])
  })

  it('all three attributes are CLEAN — zero drift (type/default/reflect all agree with the live props)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UIProgressElement.props)
    expect(drift).toEqual([])
  })

  it('negative control: a genuinely drifted attribute still FAILS the trip-wire', () => {
    const flipDefault = parsed.attributes.map((a) => (a.name === 'max' ? { ...a, default: '50' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIProgressElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.max.default' }),
    )
    const dropLabel = parsed.attributes.filter((a) => a.name !== 'label')
    expect(compareDescriptorToProps(dropLabel, UIProgressElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.label' }),
    )
  })
})

describe('progress.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about progress.ts + progress.css (0 source-drift)', () => {
    // ui-progress has NO custom states (no :state() — a display leaf has nothing to transition) and NO
    // author-slotted content (no [slot=...] selector — the track/fill pair is entirely component-built).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-progress code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
