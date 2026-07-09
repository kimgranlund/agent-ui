import { describe, it, expect } from 'vitest'
import { UIToastElement } from './toast.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
// Read toast.md/toast.ts/toast.css as TEXT (no `@types/node` devDep — the modal-descriptor.test.ts approach).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// toast-descriptor.test.ts — feed-family.lld.md LLD-C7/LLD-C10. Three layers, all targeting the fence:
//   (a) STRUCTURAL — the YAML frontmatter parses and is schema-valid (extends: UIElement is already in
//       the descriptor schema's BASE_CLASSES — no pending-failure tolerance needed, unlike modal.md's
//       UIContainerElement caveat).
//   (b) CONTRACT↔PROPS — attributes[] is a faithful BIJECTION with the live UIToastElement.props
//       (urgent/duration/action), via the fleet-wide compareDescriptorToProps trip-wire.
//   (c) CONTRACT↔SOURCE — customStates/slots tell the truth about the .ts/.css source (toast.ts uses NO
//       internals.states, toast.css has NO :state() selector, and NO [slot=x] selector — both empty).

const TOAST = `${process.cwd()}/packages/agent-ui/components/src/controls/toast`
const md = readFileSync(`${TOAST}/toast.md`, 'utf8') as string
const ts = readFileSync(`${TOAST}/toast.ts`, 'utf8') as string
const css = readFileSync(`${TOAST}/toast.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['urgent', 'duration', 'action']

describe('toast.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-toast')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-toast, extends UIElement, tier is pattern, and face is NOT form-associated', () => {
    expect(/^tag:\s*ui-toast\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    // anti-vacuous: the reader actually parsed the three attributes (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('toast.md descriptor — the select/close events + the app-surface consumption story', () => {
  it('records select and close, NOT the light-dismiss vocabulary (no open/toggle — a toast is never light-dismissed)', () => {
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('select')
    expect(events).toContain('close')
    expect(events).not.toContain('open')
    expect(events).not.toContain('toggle')
  })

  it('declares the message/action/close parts (not user slots)', () => {
    const parts = (parsed.sequences.get('parts') ?? []).map((i) => i.get('name'))
    expect(parts).toEqual(['message', 'action', 'close'])
  })

  it('none of the three attributes reflect (urgent/duration/action are inputs, not inspectable output state)', () => {
    for (const name of ATTR_NAMES) {
      const attr = parsed.attributes.find((a) => a.name === name)
      expect(attr?.reflect, `${name} should not reflect`).toBe(false)
    }
  })
})

describe('toast.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIToastElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UIToastElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — default)', () => {
    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'duration' ? { ...a, default: '3000' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIToastElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.duration.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropUrgent: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'urgent')
    expect(compareDescriptorToProps(dropUrgent, UIToastElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.urgent' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIToastElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('toast.md descriptor — contract↔source trip-wire (customStates/slots tell the truth)', () => {
  it('toast.ts uses no internals.states and toast.css uses no :state() selector — customStates is correctly empty', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('toast.css declares no [slot=x] selector — slots is correctly empty', () => {
    expect([...collectStyledSlots(css)]).toEqual([])
  })

  it('negative control: a used-but-undocumented state is caught', () => {
    const failures = compareDescriptorToSource(parsed, { ts: `${ts}\nthis.internals.states?.add('ready')`, css })
    expect(failures).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED' }))
  })

  it('negative control: a CSS-styled slot absent from the descriptor is caught', () => {
    const failures = compareDescriptorToSource(parsed, { ts, css: `${css}\n[slot='bogus'] { color: red; }` })
    expect(failures).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED' }))
  })
})
