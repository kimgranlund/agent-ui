import { describe, it, expect } from 'vitest'
import { UIGameHudElement } from './game-hud.ts'
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

// game-hud.md descriptor: structural validity, contract<->props and contract<->source trip-wires
// (the playing-card-descriptor.test.ts shape; ADR-0243 GameHud fork sheet).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/game-hud`
const md = readFileSync(`${DIR}/game-hud.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/game-hud.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/game-hud.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['title', 'status', 'statusIntent', 'stats', 'progress', 'inline']

describe('game-hud.md descriptor: structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-game-hud')
  })

  it('carries the descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-game-hud, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-game-hud\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures, attributes in the pinned order', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events, slots, keyboard and customStates are all empty: a read-out with no activation', () => {
    expect(scalarSeq(parsed, 'events')).toEqual([])
    expect(scalarSeq(parsed, 'slots')).toEqual([])
    expect(scalarSeq(parsed, 'keyboard')).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
  })

  it('the first body paragraph is the one inventory sentence (the dogfood budget pin)', () => {
    const afterHeading = body.slice(body.indexOf('# ui-game-hud') + '# ui-game-hud'.length).trim()
    expect(afterHeading.split(/\n\s*\n/)[0]).toBe('`ui-game-hud` is a game score and status strip.')
  })
})

describe('game-hud.md descriptor: contract<->props trip-wire', () => {
  it('the full bijection is clean', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIGameHudElement.props)).toEqual([])
  })

  it('title is observed as hud-title and statusIntent as status-intent, neither reflected', () => {
    const title = parsed.attributes.find((a) => a.name === 'title')
    const intent = parsed.attributes.find((a) => a.name === 'statusIntent')
    expect(title?.attribute).toBe('hud-title')
    expect(title?.reflect).toBe(false)
    expect(intent?.attribute).toBe('status-intent')
    expect(intent?.values).toEqual(['neutral', 'info', 'success', 'warning', 'danger'])
    expect(intent?.default).toBe('neutral')
  })

  it('inline is the reflected boolean sizing opt-out (ADR-0223)', () => {
    const inline = parsed.attributes.find((a) => a.name === 'inline')
    expect(inline?.type).toBe('boolean')
    expect(inline?.reflect).toBe(true)
  })

  it('negative control: a removed or added attribute fails the trip-wire (isolated on `inline`)', () => {
    const inlineOnly = { inline: UIGameHudElement.props.inline }
    expect(compareDescriptorToProps([], inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.inline' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })

  it('negative control: a drifted reflect fails the trip-wire (isolated on `inline`)', () => {
    const flipped = parsed.attributes.filter((a) => a.name === 'inline').map((a) => ({ ...a, reflect: false }))
    expect(compareDescriptorToProps(flipped, { inline: UIGameHudElement.props.inline })).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.inline.reflect' }),
    )
  })
})

describe('game-hud.md descriptor: contract<->source trip-wire', () => {
  it('customStates and slots tell the truth about game-hud.ts and game-hud.css', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('negative: a synthetic source using an undocumented state fails the source-wire', () => {
    const syntheticCss = css + '\n:scope:state(bogus) { color: red; } /* synthetic */'
    expect(compareDescriptorToSource(parsed, { ts, css: syntheticCss })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.bogus' }),
    )
  })

  it('every part game-hud.ts builds is documented in parts[]', () => {
    const built = new Set([...ts.matchAll(/part\('(?:div|span|ui-badge)', '([\w-]+)'\)/g)].map((m) => m[1]))
    expect(built.size).toBeGreaterThan(0)
    const documented = new Set([...fence.matchAll(/^\s+- name: ([\w-]+)\s*$/gm)].map((m) => m[1]))
    for (const name of built) expect(documented, `part ${name} is built but not documented`).toContain(name)
  })
})
