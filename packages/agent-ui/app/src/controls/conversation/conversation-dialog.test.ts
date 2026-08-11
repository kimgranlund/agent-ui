import { describe, it, expect, vi, afterEach } from 'vitest'
import { UIConversationDialogElement } from './conversation-dialog.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '@agent-ui/components/descriptor'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// jsdom probes for ui-conversation-dialog (ADR-0180 · GH #688 · LLD §3) — the scrolling thread's
// mechanical role, promoted to its own element. What jsdom CANNOT resolve — real painted geometry, real
// scrollHeight/scrollTop behaviour under actual layout, forced-colors — is
// conversation-dialog.browser.test.ts's job; scroll GEOMETRY here is synthetic (Object.defineProperty, the
// scroll-fade.test.ts precedent), proving the ARITHMETIC/promise-resolution contract only.

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  vi.useRealTimers()
})
function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

function stubScroll(el: HTMLElement, geo: { scrollHeight: number; clientHeight: number; scrollTop: number }): void {
  Object.defineProperty(el, 'scrollHeight', { value: geo.scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: geo.clientHeight, configurable: true })
  Object.defineProperty(el, 'scrollTop', { value: geo.scrollTop, configurable: true, writable: true })
}

describe('ui-conversation-dialog — self-registers', () => {
  it('customElements.get resolves to UIConversationDialogElement', () => {
    expect(customElements.get('ui-conversation-dialog')).toBe(UIConversationDialogElement)
  })
})

describe('ui-conversation-dialog — ARIA via internals, never a host attribute (ADR-0180 cl.1b)', () => {
  it('internals.role is "log" and internals.ariaLive is "polite", set before insertion; no host role/aria-live attribute', () => {
    const el = document.createElement('ui-conversation-dialog') as UIConversationDialogElement
    // @ts-expect-error — internals is protected; the status-stream.test.ts precedent for probing it directly
    expect(el.internals.role).toBe('log')
    // @ts-expect-error — see above
    expect(el.internals.ariaLive).toBe('polite')
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('aria-live')).toBe(false)
    mount(el)
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('aria-live')).toBe(false)
  })
})

describe('ui-conversation-dialog — isNearBottom() (SPEC-R4 AC2, moved verbatim off ui-conversation)', () => {
  it('true when within the 24px threshold of the bottom edge', () => {
    const el = mount(document.createElement('ui-conversation-dialog') as UIConversationDialogElement)
    stubScroll(el, { scrollHeight: 500, clientHeight: 300, scrollTop: 200 - 10 }) // 500-190-300=10 <=24
    expect(el.isNearBottom()).toBe(true)
  })

  it('false when scrolled away past the threshold', () => {
    const el = mount(document.createElement('ui-conversation-dialog') as UIConversationDialogElement)
    stubScroll(el, { scrollHeight: 500, clientHeight: 300, scrollTop: 0 }) // 500-0-300=200 > 24
    expect(el.isNearBottom()).toBe(false)
  })

  it('true at the exact 24px boundary (<=, not <)', () => {
    const el = mount(document.createElement('ui-conversation-dialog') as UIConversationDialogElement)
    stubScroll(el, { scrollHeight: 324, clientHeight: 300, scrollTop: 0 }) // 324-0-300=24
    expect(el.isNearBottom()).toBe(true)
  })
})

describe('ui-conversation-dialog — followTail() (GH #365 — three distinguishable outcomes, never rejects)', () => {
  it("resolves 'skipped' immediately when wasNear is false — never touches scrollTop", async () => {
    const el = mount(document.createElement('ui-conversation-dialog') as UIConversationDialogElement)
    stubScroll(el, { scrollHeight: 500, clientHeight: 300, scrollTop: 123 })
    const result = await el.followTail(false)
    expect(result).toBe('skipped')
    expect(el.scrollTop).toBe(123) // untouched
  })

  it("resolves 'settled' once the scroll extent holds still for 3 consecutive checks", async () => {
    vi.useFakeTimers()
    const el = mount(document.createElement('ui-conversation-dialog') as UIConversationDialogElement)
    // A static scrollHeight/clientHeight — every tick's `this.scrollTop = this.scrollHeight` write reads
    // back the SAME value (jsdom does not clamp/reflow), so the stability streak accumulates immediately.
    stubScroll(el, { scrollHeight: 500, clientHeight: 300, scrollTop: 0 })
    const p = el.followTail(true)
    await vi.advanceTimersByTimeAsync(3 * 40)
    expect(await p).toBe('settled')
    expect(el.scrollTop).toBe(500)
  })

  it("resolves 'exhausted' when the scroll extent keeps changing past the ~1s ceiling", async () => {
    vi.useFakeTimers()
    const el = mount(document.createElement('ui-conversation-dialog') as UIConversationDialogElement)
    let height = 500
    Object.defineProperty(el, 'clientHeight', { value: 300, configurable: true })
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get() {
        return height
      },
      set() {
        height += 1 // NEVER stabilizes — every write nudges the read-back value, defeating the streak
      },
    })
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get() {
        return height
      },
    })
    const p = el.followTail(true)
    await vi.advanceTimersByTimeAsync(25 * 40)
    expect(await p).toBe('exhausted')
  })
})

// ── descriptor — ADR-0004 (structural + contract↔props, the ui-toast-region/ui-form-provider empty-bijection precedent) ──

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/conversation`

describe('conversation-dialog.md descriptor', () => {
  const md = readFileSync(`${DIR}/conversation-dialog.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-conversation-dialog')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-conversation-dialog\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('the empty side of the bijection: attributes: [] parses present-and-empty, not silently absent', () => {
    expect(parsed.sequences.has('attributes')).toBe(true)
    expect(parsed.sequences.get('attributes')).toEqual([])
    expect(parsed.attributes).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIConversationDialogElement).props (0 ≡ 0)', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIConversationDialogElement.props)).toEqual([])
  })

  it('a planted phantom attribute FAILS the trip-wire (negative control — the empty side is not vacuously permissive)', () => {
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIConversationDialogElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
