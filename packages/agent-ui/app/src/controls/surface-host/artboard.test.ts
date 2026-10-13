import { describe, it, expect } from 'vitest'
import { applyRootStretch } from './artboard.ts'

// applyRootStretch's widget-root branch (ADR-0046 Amendment 7, the canvas gutter rule; T-0084): the ADR-0243
// widget roots fill the canvas like a container root, unless they carry the ADR-0223 `inline` hug opt-out, and
// an intrinsic control root still keeps its natural width. The painted width is
// site/lib/canvas-surface.browser.test.ts's job; this pins the branch itself.

function surfaceWith(tag: string, attrs: Record<string, string> = {}): { surface: HTMLElement; root: HTMLElement } {
  const surface = document.createElement('div')
  const root = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v)
  surface.append(root)
  return { surface, root }
}

describe('applyRootStretch: the ADR-0243 widget roots fill the canvas', () => {
  for (const tag of ['ui-game-hud', 'ui-product-card', 'ui-board-grid']) {
    it(`a ${tag} root is stretched`, () => {
      const { surface, root } = surfaceWith(tag)
      applyRootStretch(surface)
      expect(root.style.alignSelf).toBe('stretch')
    })

    it(`an [inline] ${tag} root keeps hugging (ADR-0223 R2)`, () => {
      const { surface, root } = surfaceWith(tag, { inline: '' })
      applyRootStretch(surface)
      expect(root.style.alignSelf).toBe('')
    })
  }

  it('negative control: an intrinsic control root (ui-button) is left alone', () => {
    const { surface, root } = surfaceWith('ui-button')
    applyRootStretch(surface)
    expect(root.style.alignSelf).toBe('')
  })
})
