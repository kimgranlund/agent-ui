import { describe, it, expect, afterEach } from 'vitest'

// LLD §7 items 5/6's own-element leg — jsdom cannot resolve real painted flex layout / real
// scrollHeight/scrollTop behaviour under actual layout. Standalone whole-shape + the REAL scroll-follow
// guard, proven directly against ui-conversation-dialog (the composed-inside-ui-conversation path is
// conversation.browser.test.ts's own "scroll-follow guard" describe, S4).
import '@agent-ui/components/foundation-styles.css'
import './conversation-dialog.css'
import { UIConversationDialogElement } from './conversation-dialog.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mountDialog(width = '420px', height = '200px'): UIConversationDialogElement {
  const el = document.createElement('ui-conversation-dialog') as UIConversationDialogElement
  el.style.width = width
  el.style.height = height
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-conversation-dialog cross-engine smoke — standalone whole-shape', () => {
  it('is a real, non-zero-area scrollable box (legal standalone — ADR-0180 §3)', () => {
    const el = mountDialog()
    const rect = el.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
    expect(getComputedStyle(el).overflowY).toBe('auto')
  })

  it('author-authored initial content is preserved standalone (LLD §3 slot — nothing here is engine-owned)', () => {
    const el = document.createElement('ui-conversation-dialog') as UIConversationDialogElement
    const child = document.createElement('p')
    child.textContent = 'consumer content'
    el.append(child)
    document.body.append(el)
    mounted.push(el)
    expect(el.querySelector('p')?.textContent).toBe('consumer content')
  })
})

describe('ui-conversation-dialog cross-engine smoke — accessibility', () => {
  it('internals.role/ariaLive are reflected — no host role/aria-live attribute leaks into a real engine', () => {
    const el = mountDialog()
    // @ts-expect-error — internals is protected; the status-stream.browser.test.ts precedent
    expect(el.internals.role).toBe('log')
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('aria-live')).toBe(false)
  })
})

describe('ui-conversation-dialog cross-engine smoke — the stick-to-bottom guard, real scrollHeight (SPEC-R4 AC2)', () => {
  const fill = (el: UIConversationDialogElement, n: number): void => {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('p')
      p.textContent = `line ${i} — enough real content to force real overflow in a short box`
      el.append(p)
    }
  }

  it('near the bottom, followTail(true) scrolls to the real new bottom and settles', async () => {
    const el = mountDialog('420px', '180px')
    fill(el, 30)
    el.scrollTop = el.scrollHeight // start pinned at the real bottom
    const wasNear = el.isNearBottom() // sampled BEFORE the new content grows scrollHeight (SPEC-R4 AC2's own discipline)
    fill(el, 5)
    const result = await el.followTail(wasNear)
    expect(result === 'settled' || result === 'exhausted', `unexpected followTail result: ${result}`).toBe(true)
    expect(el.scrollHeight - el.scrollTop - el.clientHeight, 'did not follow to the real new bottom').toBeLessThanOrEqual(24)
  })

  it('scrolled away from the bottom, isNearBottom() reads false against real layout', () => {
    const el = mountDialog('420px', '180px')
    fill(el, 40)
    el.scrollTop = 0
    expect(el.isNearBottom()).toBe(false)
  })
})
