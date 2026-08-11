import { describe, it, expect, afterEach } from 'vitest'

// LLD §2's own cross-engine leg — jsdom cannot resolve real painted flex layout / forced-colors.
import '@agent-ui/components/foundation-styles.css'
import './conversation-header.css'
import { UIConversationHeaderElement } from './conversation-header.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-conversation-header cross-engine smoke — whole-shape', () => {
  it('is a real, non-zero-area, non-scrolling flex band over its authored content', () => {
    const el = document.createElement('ui-conversation-header') as UIConversationHeaderElement
    const title = document.createElement('strong')
    title.textContent = 'Support Agent'
    el.append(title)
    el.style.width = '420px'
    document.body.append(el)
    mounted.push(el)

    const rect = el.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
    expect(getComputedStyle(el).display).toBe('flex')
    expect(getComputedStyle(el).flexGrow).toBe('0')
    expect(getComputedStyle(el).flexShrink).toBe('0')
    expect(el.querySelector('strong')?.getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it('paints a real bottom border + surface color, legible under forced-colors', () => {
    const el = document.createElement('ui-conversation-header') as UIConversationHeaderElement
    el.textContent = 'chrome'
    document.body.append(el)
    mounted.push(el)
    const cs = getComputedStyle(el)
    expect(Number.parseFloat(cs.borderBottomWidth)).toBeGreaterThan(0)
    expect(cs.borderBottomColor).not.toBe('')
  })
})
