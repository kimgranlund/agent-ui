// canvas-surface.test.ts — ADR-0129 Amendment 2's anti-refork guard: `canvas-surface.ts`'s re-exported
// `applyRootStretch` must be the SAME function object as `@agent-ui/app/artboard`'s own export, proving
// this module genuinely re-exports the shared implementation rather than carrying a second copy that
// happens to behave identically today and silently drifts tomorrow (exactly the fate the ADR's own
// Findings recorded for the pre-extraction pair).
import { describe, it, expect } from 'vitest'
import { applyRootStretch as siteApplyRootStretch } from './canvas-surface.ts'
import { applyRootStretch as packageApplyRootStretch } from '@agent-ui/app/artboard'

describe('canvas-surface.ts — applyRootStretch is a true re-export, not a second copy', () => {
  it('is reference-identical (===) to @agent-ui/app/artboard\'s own export', () => {
    expect(siteApplyRootStretch).toBe(packageApplyRootStretch)
  })
})
