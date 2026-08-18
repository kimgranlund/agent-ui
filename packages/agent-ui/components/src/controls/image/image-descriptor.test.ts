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
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// image-descriptor.test.ts — structural (s8) + contract↔source (s11); the avatar.md/button.md pattern. The
// contract↔props leg (s10) is NOT written here: image.ts's `static props` IMPORTS `image.props.gen.ts`,
// GENERATED from this same image.md (ADR-0173) — the bijection is structurally true by construction. The
// generator-drift gate lives fleet-wide in `descriptor/props-gen-driftwire.test.ts` ('image' is a member of
// its CONVERTED allowlist, landed in the SAME commit as this control).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/image`
const md = readFileSync(`${DIR}/image.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/image.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/image.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['src', 'alt', 'fit', 'aspect', 'usageHint']

describe('image.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-image')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-image, extends=UIElement, tier=display (Display-band, geometry.md), face.formAssociated=false', () => {
    expect(/^tag:\s*ui-image\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('image.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about image.ts + image.css (0 source-drift)', () => {
    // ui-image has NO custom states (no :state() — a static media leaf, nothing to transition) and its ONE
    // slot ("caption") is the default/unnamed-children position — CSS selects it structurally
    // (":not([data-part='media'])"), never by a literal [slot=...] name, so collectStyledSlots finds none
    // (the button.md "label" slot's exact asymmetry: documented but not CSS-name-selected is NOT a defect).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-image code"
    expect(compareDescriptorToSource(parsed, { ts: syntheticTs, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }),
    )
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    expect(compareDescriptorToSource(parsed, { ts, css: syntheticCss })).toContainEqual(
      expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }),
    )
  })
})
