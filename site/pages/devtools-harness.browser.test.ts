// devtools-harness.browser.test.ts — the S5 real-engine smoke (GH #1122; devtools-harness SPEC-R8 AC1
// / R9 AC1 / R11 AC2's drive, browser tier): the REAL page module in a REAL engine (chromium + webkit,
// the site project), driven through the SAME DOM hooks the `@agent-ui/devtools/playwright` helper's
// HARNESS_SELECTORS name — a replay turn posted through the real composer, the timeline pane showing
// every DevtoolsEvent row, the canvas rendering the seed button with REAL geometry (the whole-shape
// law), and the render-confirm verdict visible. Negative control: a surfaceId that never rendered has
// NO ok-verdict row. Vitest browser tests execute IN the page (no playwright `Page` handle exists
// here), so the helper FUNCTIONS are proven over the same hooks in devtools-harness.helper.test.ts —
// the residual gap (a real `Page` against a live `vite dev`) is named in the slice Findings.
import { describe, it, expect, vi } from 'vitest'
import { HARNESS_SELECTORS } from '@agent-ui/devtools/playwright'
import type { DevtoolsEvent, DevtoolsCapture } from '@agent-ui/devtools'
import './devtools-harness.ts' // side-effect import — mounts the real harness page

// REAL-TIMING HEADROOM (the a2ui-chat-click-turn precedent): this file awaits real elapsed frames.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

async function waitUntil(predicate: () => boolean, what: string, timeoutMs = 8000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error(`waitUntil timed out: ${what}`)
    await raf()
  }
}

function statusEl(): HTMLElement {
  return document.querySelector(HARNESS_SELECTORS.status) as HTMLElement
}

describe('devtools-harness — real-engine smoke (SPEC-R8 AC1 / SPEC-R9 AC1)', () => {
  it('a replay turn posted through the real composer streams the timeline, renders the surface, and posts the verdict', async () => {
    await raf()

    // The page arrived idle with the three backend rows (the helper's own hook list).
    expect(document.querySelector(HARNESS_SELECTORS.backendActive('replay'))).not.toBeNull()
    expect(statusEl().dataset.turnState).toBe('idle')

    // postTurn's drive, inlined (this test runs IN the browser — no Page handle): fill + send.
    const editor = document.querySelector(HARNESS_SELECTORS.composerEditor) as HTMLElement
    expect(editor, 'composer editor not found').not.toBeNull()
    editor.textContent = 'render the seed button'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    ;(document.querySelector(HARNESS_SELECTORS.composerSend) as HTMLElement).click()

    await waitUntil(() => statusEl().dataset.turnCount === '1' && statusEl().dataset.turnState === 'idle', 'turn 1 to end')

    // The timeline pane shows the WHOLE event stream, one parseable NDJSON row each (SPEC-R7 on-page).
    const rows = [...document.querySelectorAll(HARNESS_SELECTORS.timelineEvents)]
    const events = rows.map((row) => JSON.parse(row.textContent ?? '') as DevtoolsEvent)
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end', 'render'])
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4])
    expect(events.at(-1)).toMatchObject({ kind: 'render', surfaceId: 'canvas', ok: true })

    // Whole-shape: the seed Button REALLY rendered on the canvas — live element, real geometry.
    const button = document.querySelector('[data-devtools="canvas"] ui-button') as HTMLElement
    expect(button, 'the seed Button did not mount on the canvas').not.toBeNull()
    expect(button.textContent?.trim()).toBe('Click me')
    expect(button.getBoundingClientRect().width, 'the rendered button has real size').toBeGreaterThan(0)

    // The render-confirm verdict is a VISIBLE row (SPEC-R9: never a blank canvas), with real geometry.
    const verdict = document.querySelector(HARNESS_SELECTORS.verdictOk('canvas')) as HTMLElement
    expect(verdict).not.toBeNull()
    expect(verdict.getBoundingClientRect().height).toBeGreaterThan(0)

    // NEGATIVE control (SPEC-R11 AC2's red leg, DOM form): a never-rendered surfaceId has no ok row.
    expect(document.querySelector(HARNESS_SELECTORS.verdictOk('surface-that-never-rendered'))).toBeNull()
  })

  it('export writes a parseable v1 capture into the copyable output box (SPEC-R10 on-page)', async () => {
    ;(document.querySelector(HARNESS_SELECTORS.exportButton) as HTMLElement).click()
    await raf()
    const output = document.querySelector(HARNESS_SELECTORS.captureOutput) as HTMLTextAreaElement
    const capture = JSON.parse(output.value) as DevtoolsCapture
    expect(capture.kind).toBe('agent-ui-devtools-capture')
    expect(capture.version).toBe(1)
    expect(capture.timeline.length).toBeGreaterThanOrEqual(5)
  })
})
