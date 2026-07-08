// a2a-tic-tac-toe.test.ts — LLD-C11 (SPEC-R13) jsdom page-level suite for the A2A tic-tac-toe arena demo.
// Mirrors a2ui-live.ask-lifecycle.test.ts's posture: drives the REAL page module (side-effect import) end
// to end, mounted once, then asserts DOM state as a viewer/reviewer would read it. `ui-button`/`ui-card`
// are not form-associated (their own descriptors), so — unlike the a2ui-live suite — no
// ElementInternals.setFormValue/setValidity stub is needed here.
//
// This is the STRUCTURAL leg (jsdom DOM state, real custom-element behavior, no real computed geometry).
// The WHOLE-SHAPE render (actual board rects, a real 3×3 grid) is proven separately in
// a2a-tic-tac-toe.browser.test.ts — jsdom cannot compute layout, so it is not asserted here.
import { describe, it, expect, beforeAll } from 'vitest'

let root: ParentNode

beforeAll(async () => {
  const appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.append(appRoot)
  await import('./a2a-tic-tac-toe.ts') // mounts on import (mountPage), exactly like every other /site page
  root = appRoot
})

function fixtureButton(key: string): HTMLElement {
  return root.querySelector(`[data-fixture="${key}"]`) as HTMLElement
}
function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}
const verdict = (): HTMLElement => root.querySelector('[data-verdict]') as HTMLElement
const checks = (): HTMLElement[] => [...root.querySelectorAll('.isolation-check')] as HTMLElement[]
const boardCells = (): HTMLElement[] => [...root.querySelectorAll('.board-cell')] as HTMLElement[]
const narration = (): string => (root.querySelector('[data-narration]') as HTMLElement).textContent ?? ''
const stepLabel = (): string => (root.querySelector('[data-step-label]') as HTMLElement).textContent ?? ''
const nextBtn = (): HTMLElement => root.querySelector('[data-action="next"]') as HTMLElement
const prevBtn = (): HTMLElement => root.querySelector('[data-action="prev"]') as HTMLElement
const seatCol = (mark: 'X' | 'O'): HTMLElement => root.querySelector(`[data-seat="${mark}"] .context-lines`) as HTMLElement
const timeline = (): HTMLElement => root.querySelector('[data-timeline] .context-lines') as HTMLElement

describe('the A2A tic-tac-toe page — recorded-default replay (SPEC-R13 AC1: zero network, zero keys)', () => {
  it('mounts with the flagship fixture selected (solid variant) and renders a real 3x3 board', () => {
    expect(fixtureButton('flagship').getAttribute('variant')).toBe('solid')
    expect(boardCells()).toHaveLength(9)
  })

  it('starts on step 0 with an empty board and a "moves first" narration', () => {
    expect(stepLabel()).toContain('Move 0 of')
    expect(boardCells().every((c) => c.textContent === '')).toBe(true)
    expect(narration()).toContain('X moves first')
  })

  it('prev is disabled at step 0; next advances the board and narration', () => {
    expect(prevBtn().hasAttribute('disabled')).toBe(true)
    click(nextBtn())
    expect(stepLabel()).toContain('Move 1 of')
    expect(narration()).toContain('X plays cell 4')
    expect(boardCells()[4]!.textContent).toBe('X')
  })

  it('going back to step 0 with prev restores the empty board', () => {
    click(prevBtn())
    expect(stepLabel()).toContain('Move 0 of')
    expect(boardCells().every((c) => c.textContent === '')).toBe(true)
  })

  it('advancing to the very last step lands on the recorded end narration and disables next', () => {
    // click "next" far more times than the match has steps — advancing must clamp at the end, not throw
    for (let i = 0; i < 30; i++) click(nextBtn())
    expect(narration()).toContain('X wins')
    expect(nextBtn().hasAttribute('disabled')).toBe(true)
    click(prevBtn()) // leave the DOM back near the start for the following describe blocks' own clicks
    for (let i = 0; i < 30; i++) click(prevBtn())
    expect(stepLabel()).toContain('Move 0 of')
  })
})

describe('the A2A tic-tac-toe page — the isolation panel is the SAME checker, run in-page (LLD §2)', () => {
  it('the flagship (must-pass) fixture shows all 4 checks passing', () => {
    click(fixtureButton('flagship'))
    expect(verdict().dataset.verdict).toBe('clean')
    const rows = checks()
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.dataset.checkStatus === 'pass')).toBe(true)
  })

  it("both seats' full recorded context render, non-empty, in the side-by-side inspector", () => {
    expect(seatCol('X').children.length).toBeGreaterThan(0)
    expect(seatCol('O').children.length).toBeGreaterThan(0)
    expect(timeline().children.length).toBeGreaterThan(0)
  })

  it('switching to the in-transcript contaminated control shows the verdict FAILING loudly — non-zero failing checks', () => {
    click(fixtureButton('contaminated-control'))
    expect(fixtureButton('contaminated-control').getAttribute('variant')).toBe('solid')
    expect(verdict().dataset.verdict).toBe('failed')
    const failing = checks().filter((r) => r.dataset.checkStatus === 'fail')
    expect(failing.length).toBeGreaterThan(0)
  })

  it('switching to the out-of-transcript (shared-provider) contaminated control ALSO fails', () => {
    click(fixtureButton('contaminated-provider-control'))
    expect(verdict().dataset.verdict).toBe('failed')
    expect(checks().some((r) => r.dataset.checkStatus === 'fail')).toBe(true)
  })

  it('switching back to the scripted CI-backbone fixture is clean too — the failure is fixture-specific, not sticky UI state', () => {
    click(fixtureButton('scripted'))
    expect(verdict().dataset.verdict).toBe('clean')
    expect(checks().every((r) => r.dataset.checkStatus === 'pass')).toBe(true)
  })

  it('negative control: the two verdict states are genuinely different DOM, not the same markup relabelled', () => {
    click(fixtureButton('flagship'))
    const cleanText = verdict().textContent
    click(fixtureButton('contaminated-control'))
    const failedText = verdict().textContent
    expect(cleanText).not.toBe(failedText)
  })
})

describe('the A2A tic-tac-toe page — the dev-only live section stays hidden without a configured proxy/key', () => {
  it('the live section is hidden (no dev proxy reachable under jsdom/vitest)', async () => {
    // wireLiveOverlay()'s probe is fire-and-forget on import; give its microtask/fetch-rejection chain a
    // turn to settle before asserting the negative (mirrors the a2ui-live precedent's async settle pattern).
    await new Promise((r) => setTimeout(r, 50))
    const live = root.querySelector('[data-live]') as HTMLElement
    expect(live.hidden).toBe(true)
  })
})
