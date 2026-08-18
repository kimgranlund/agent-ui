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

// video-descriptor.test.ts — structural (s8) + contract↔source (s11); the image-descriptor.test.ts pattern
// verbatim (GH #1209). The contract↔props leg (s10) is structurally true by construction: video.ts imports
// video.props.gen.ts, GENERATED from this same video.md (ADR-0173); 'video' rides the fleet driftwire.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/video`
const md = readFileSync(`${DIR}/video.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/video.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/video.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['src', 'label', 'poster', 'aspect', 'preload']

describe('video.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-video')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-video, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-video\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('video.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about video.ts + video.css (0 source-drift)', () => {
    // No custom states (a display leaf hosting a native player) and no slots at v1 (video.md's fence).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-video code"
    expect(compareDescriptorToSource(parsed, { ts: syntheticTs, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }),
    )
  })
})
