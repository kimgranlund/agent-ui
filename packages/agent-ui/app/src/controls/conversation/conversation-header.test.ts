import { describe, it, expect, afterEach } from 'vitest'
import { UIConversationHeaderElement } from './conversation-header.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '@agent-ui/components/descriptor'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// jsdom probes for ui-conversation-header (ADR-0180 · GH #688 · LLD §2) — the family's ONE fully
// author-composed member. What jsdom cannot resolve — real painted geometry, forced-colors — is
// conversation-header.browser.test.ts's job.

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})
function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-conversation-header — self-registers', () => {
  it('customElements.get resolves to UIConversationHeaderElement', () => {
    expect(customElements.get('ui-conversation-header')).toBe(UIConversationHeaderElement)
  })
})

describe('ui-conversation-header — the family\'s one fully author-composed member', () => {
  it('renders authored light-DOM children exactly as-authored, no role, no host attributes injected', () => {
    const el = document.createElement('ui-conversation-header') as UIConversationHeaderElement
    const strong = document.createElement('strong')
    strong.textContent = 'Support Agent'
    el.append(strong)
    mount(el)
    expect(el.querySelector('strong')?.textContent).toBe('Support Agent')
    expect(el.hasAttribute('role')).toBe(false)
  })

  it('legal standalone: renders as an inert band with no error/warning when never adopted', () => {
    expect(() => {
      const el = mount(document.createElement('ui-conversation-header') as UIConversationHeaderElement)
      el.textContent = 'standalone'
    }).not.toThrow()
  })

  it('carries no props beyond the empty schema (v1 has nothing to configure)', () => {
    expect(UIConversationHeaderElement.props).toEqual({})
  })
})

// ── descriptor — ADR-0004 (structural + contract↔props, the empty-bijection precedent) ──

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/conversation`

describe('conversation-header.md descriptor', () => {
  const md = readFileSync(`${DIR}/conversation-header.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-conversation-header')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-conversation-header\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('the empty side of the bijection: attributes: [] parses present-and-empty, not silently absent', () => {
    expect(parsed.sequences.has('attributes')).toBe(true)
    expect(parsed.sequences.get('attributes')).toEqual([])
    expect(parsed.attributes).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIConversationHeaderElement).props (0 ≡ 0)', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIConversationHeaderElement.props)).toEqual([])
  })

  it('a planted phantom attribute FAILS the trip-wire (negative control — the empty side is not vacuously permissive)', () => {
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIConversationHeaderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })

  it('declares a default slot naming the author-composed content model (compareDescriptorToSource has no mechanical slot-name check beyond styled-slot detection — this pins the documented contract directly)', () => {
    const slotNames = (parsed.sequences.get('slots') ?? []).map((item) => item.get('name'))
    expect(slotNames).toContain('default')
  })
})
