import { describe, it, expect } from 'vitest'
import { splitFrontmatter, parseDescriptor, validateComponentDescriptor } from './component-descriptor.ts'
// Read button.md as text via node:fs (same approach as the s6/s7/s8 probes).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s9 — the frontmatter contract SCHEMA (ADR-0004). The hand-rolled validateComponentDescriptor is the
// structural referential standard the descriptor fence is checked against (replacing the never-built
// component-api-contract.json). Two acceptance probes:
//   • descriptor-schema-valid   — the live button.md frontmatter passes (0 failures).
//   • descriptor-schema-rejects — a per-dimension malformed fixture yields the RIGHT failure (anti-vacuous).
// The contract↔props comparison (frontmatter ≡ finalize(Class)) is a LATER slice (s10) — not here.

const buttonMd = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/button/button.md`, 'utf8') as string

// A minimal, well-formed descriptor fence — the baseline the negative fixtures mutate one field at a time.
const GOOD = [
  'tag: ui-thing',
  'tier: control',
  'extends: UIElement',
  'attributes:',
  '  - name: variant',
  '    type: enum',
  '    values: [a, b]',
  '    default: a',
  '    reflect: true',
  '  - name: disabled',
  '    type: boolean',
  '    default: false',
  '    reflect: true',
  'properties: []',
  'events:',
  '  - name: change',
  "    detail: 'null'",
  'slots: []',
  'parts: []',
  'customStates: []',
  'face:',
  '  formAssociated: false',
  'aria:',
  '  role: button',
  'keyboard: []',
  'geometry:',
  '  sizeClass: control',
  'forcedColors: keeps the ink visible',
].join('\n')

describe('component-descriptor schema — conforms (s9)', () => {
  it('the live button.md frontmatter is a well-formed descriptor (0 failures)', () => {
    const { fence } = splitFrontmatter(buttonMd)
    const parsed = parseDescriptor(fence)
    // anti-vacuous: the reader actually populated the descriptor before the validator is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(['variant', 'size', 'disabled'])
    expect(parsed.maps.get('face')?.get('formAssociated')).toBe('false')
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('the minimal GOOD baseline fixture validates (0 failures)', () => {
    expect(validateComponentDescriptor(parseDescriptor(GOOD))).toEqual([])
  })
})

describe('component-descriptor schema — rejects malformed descriptors (s9)', () => {
  /** Validate a fence and return its failures (parses the same reader the trip-wire will reuse). */
  const failuresFor = (fence: string) => validateComponentDescriptor(parseDescriptor(fence))
  /** True when some failure has the given code (and path, if asserted). */
  const flags = (fence: string, code: string, path?: string) =>
    failuresFor(fence).some((f) => f.code === code && (path === undefined || f.path === path))

  it('flags every absent required field (anti-vacuous — an empty fence is all MISSING_FIELD)', () => {
    const failures = failuresFor('')
    expect(failures.length).toBeGreaterThanOrEqual(14)
    expect(failures.every((f) => f.code === 'MISSING_FIELD')).toBe(true)
    expect(failures.some((f) => f.path === 'geometry')).toBe(true)
  })

  it('flags a missing required field (drop geometry)', () => {
    expect(flags(GOOD.replace('geometry:\n  sizeClass: control\n', ''), 'MISSING_FIELD', 'geometry')).toBe(true)
  })

  it('flags a non-ui-* tag', () => {
    expect(flags(GOOD.replace('tag: ui-thing', 'tag: thing'), 'BAD_TAG', 'tag')).toBe(true)
  })

  it('flags a tier outside the size-class set', () => {
    expect(flags(GOOD.replace('tier: control', 'tier: gigantic'), 'BAD_TIER', 'tier')).toBe(true)
  })

  it('flags an extends outside the known base elements', () => {
    expect(flags(GOOD.replace('extends: UIElement', 'extends: HTMLElement'), 'BAD_EXTENDS', 'extends')).toBe(true)
  })

  it('flags an attribute with an invalid type', () => {
    expect(flags(GOOD.replace('type: enum', 'type: colour'), 'BAD_ATTRIBUTE', 'attributes[0].type')).toBe(true)
  })

  it('flags an attribute whose reflect is not a boolean', () => {
    expect(flags(GOOD.replace('default: false\n    reflect: true', 'default: false\n    reflect: yes'), 'BAD_ATTRIBUTE', 'attributes[1].reflect')).toBe(true)
  })

  it('flags an enum attribute with no values list', () => {
    expect(flags(GOOD.replace('    values: [a, b]\n', ''), 'BAD_ATTRIBUTE', 'attributes[0].values')).toBe(true)
  })

  it('flags a face whose formAssociated is not a boolean', () => {
    expect(flags(GOOD.replace('formAssociated: false', 'formAssociated: maybe'), 'BAD_FACE', 'face.formAssociated')).toBe(true)
  })
})
