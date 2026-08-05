import { describe, it, expect } from 'vitest'
import { UIPaginationElement } from './pagination.ts'
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
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// pagination-descriptor.test.ts — the three-layer descriptor pattern (toolbar-descriptor.test.ts / table-
// descriptor.test.ts precedent): structural, contract↔props, contract↔source.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/pagination`
const md = readFileSync(`${DIR}/pagination.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/pagination.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/pagination.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['page', 'pages', 'label']

describe('pagination.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-pagination')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-pagination, tier=pattern, extends UIElement, face NOT form-associated', () => {
    expect(/^tag:\s*ui-pagination\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('declares role=navigation via internals (never a host attribute) + the label ARIA source', () => {
    expect(fence).toMatch(/role:\s*navigation\b/)
    expect(fence).toMatch(/roleSource:\s*internals\b/)
    expect(fence).toMatch(/labelSource:.*internals\.ariaLabel/)
  })

  it('declares no [size]/[scale] attribute — cl.6: no new geometry row of its own', () => {
    const names = new Set(parsed.attributes.map((a) => a.name))
    expect(names.has('size')).toBe(false)
    expect(names.has('scale')).toBe(false)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('the change event detail names {page:number}', () => {
    const change = parsed.sequences.get('events')?.find((e) => e.get('name') === 'change')
    expect(change?.get('detail')).toBe('{page:number}')
  })
})

describe('pagination.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with finalize(UIPaginationElement).props (0 drift)', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIPaginationElement.props)).toEqual([])
  })

  it('page defaults 1, pages defaults 0, label defaults the empty string — all reflect', () => {
    const page = parsed.attributes.find((a) => a.name === 'page')
    const pages = parsed.attributes.find((a) => a.name === 'pages')
    const label = parsed.attributes.find((a) => a.name === 'label')
    expect(page?.default).toBe('1')
    expect(pages?.default).toBe('0')
    expect(label?.default).toBe('')
    expect(page?.reflect).toBe(true)
    expect(pages?.reflect).toBe(true)
    expect(label?.reflect).toBe(true)
  })

  it('a drifted attribute FAILS the trip-wire (negative control)', () => {
    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'page' ? { ...a, default: '2' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIPaginationElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.page.default' }),
    )

    const dropPages: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'pages')
    expect(compareDescriptorToProps(dropPages, UIPaginationElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.pages' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIPaginationElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('pagination.ts — event DELEGATION, never a per-stop listener (component-checker retained-listener finding)', () => {
  it('#stopButton attaches NO listener of its own — #rebuild() discards every stop on every page/pages change', () => {
    // the DEFINITION only (`\n  #stopButton(`) — NOT a `this.#stopButton(…)` CALL site, which appears
    // earlier in the file (`#rebuild()` calls it repeatedly, defined before `#stopButton` itself) and would
    // otherwise be found first by a bare `#stopButton(` search.
    const start = ts.indexOf('\n  #stopButton(')
    expect(start, '#stopButton definition not found in pagination.ts').toBeGreaterThan(-1)
    const nextMethodStart = ts.indexOf('\n  #', start + 1)
    const body = ts.slice(start, nextMethodStart === -1 ? ts.length : nextMethodStart)
    expect(body, '#stopButton regressed to a per-node this.listen(').not.toMatch(/this\.listen\(/)
  })

  it('connected() registers exactly ONE delegated click listener, on the host itself', () => {
    expect([...ts.matchAll(/this\.listen\(this,/g)]).toHaveLength(1)
  })
})

describe('pagination.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth — no :state()/[slot=…] anywhere in source (0 drift)', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('a state used in source but undocumented FAILS (negative control)', () => {
    const withState = `${ts}\nthis.internals.states?.add('zzstate')`
    expect(compareDescriptorToSource(parsed, { ts: withState, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.zzstate' }),
    )
  })
})
