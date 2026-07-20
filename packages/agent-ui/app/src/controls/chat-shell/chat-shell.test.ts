// chat-shell.test.ts — jsdom probes for ui-chat-shell (LLD-C6, GH #98). jsdom cannot resolve real
// container-query/flex layout — the geometry/collapse/landmark behavior this element composes is already
// proven by super-shell.test.ts / super-shell.browser.test.ts; this file proves ONLY what's genuinely new
// here: the connect-time relocation into a real inner `ui-super-shell`, the `narrow-start="stack"` default,
// idempotent composition across a reconnect, and the descriptor's structural + contract↔props +
// contract↔source trip-wires (ADR-0004) — the SAME shape workspace-shell.test.ts already proves for its
// sibling composition.
import { describe, it, expect, afterEach } from 'vitest'
import { UIChatShellElement } from './chat-shell.ts'
import '../super-shell/super-shell.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '@agent-ui/components/descriptor'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mount(children: Partial<Record<string, string>>): UIChatShellElement {
  const el = document.createElement('ui-chat-shell') as UIChatShellElement
  for (const [slot, text] of Object.entries(children)) {
    const child = document.createElement('div')
    child.setAttribute('data-slot', slot)
    child.textContent = text ?? slot
    el.append(child)
  }
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-chat-shell — composition (LLD-C6, GH #98)', () => {
  it('relocates authored children into ONE inner ui-super-shell', () => {
    const el = mount({ header: 'H', content: 'C' })
    expect(el.children).toHaveLength(1)
    const shell = el.querySelector('ui-super-shell')
    expect(shell).not.toBeNull()
    expect(shell?.querySelector('[data-part="canvas"]')?.textContent).toBe('C')
  })

  it('the narrower chat slice — header + nav-pane + content — composes with no options side authored', () => {
    const el = mount({ header: 'H', 'nav-pane': 'NP', content: 'C' })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].map((c) => c.getAttribute('data-slot-name'))
    expect(order).toEqual(['nav-pane', 'content'])
    expect(el.querySelector('[data-slot-name="options-pane"]')).toBeNull()
    expect(el.querySelector('[data-slot-name="global-options"]')).toBeNull()
  })

  it('nav-pane genuinely absent (no real consumer authors it yet) contributes no box — the absence law', () => {
    const el = mount({ header: 'H', content: 'C' })
    expect(el.querySelector('[data-part="rail"]')).toBeNull()
    expect(el.querySelector('[data-part="pane"]')).toBeNull()
  })

  it('sets the sensible chat default narrow-start="stack" on the inner shell', () => {
    const el = mount({ content: 'C' })
    expect(el.querySelector('ui-super-shell')?.getAttribute('narrow-start')).toBe('stack')
  })

  it('composition is idempotent — a second connect (no new children) never double-composes', () => {
    const el = mount({ content: 'C' })
    el.remove()
    document.body.append(el) // reconnect, no DOM change of its own
    expect(el.children).toHaveLength(1)
    expect(el.querySelectorAll('ui-super-shell')).toHaveLength(1)
  })
})

// ── descriptor — ADR-0004 (structural + contract↔props + contract↔source) ────────────────────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/chat-shell`
const chatShellTs = readFileSync(`${DIR}/chat-shell.ts`, 'utf8') as string
const chatShellCss = readFileSync(`${DIR}/chat-shell.css`, 'utf8') as string

describe('chat-shell.md descriptor (ui-chat-shell)', () => {
  const md = readFileSync(`${DIR}/chat-shell.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-chat-shell')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-chat-shell\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is empty and agrees with the live (empty) static props — no API surface of its own', () => {
    expect(parsed.attributes).toEqual([])
    expect(compareDescriptorToProps(parsed.attributes, UIChatShellElement.props)).toEqual([])
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts: chatShellTs, css: chatShellCss })).toEqual([])
  })
})
