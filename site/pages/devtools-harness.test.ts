// devtools-harness.test.ts — jsdom coverage for the harness page (GH #1122 S4; devtools-harness
// SPEC-R8/R9/R10 observed ON the real page). Driven through the REAL page module (side-effect deferred
// import, the a2ui-chat.test.ts sibling idiom) over the page's own deterministic replay default — no
// injection seam needed: the replay backend IS the deterministic backbone (SPEC-R3). The real-engine
// whole-shape proof (real geometry on the canvas button, real composer interaction) lives in
// devtools-harness.browser.test.ts (the "jsdom-green ≠ done" discipline).
import { describe, it, expect, beforeAll } from 'vitest'
import type { DevtoolsEvent, DevtoolsCapture } from '@agent-ui/devtools'

beforeAll(async () => {
  // jsdom reality (the a2ui-chat.test.ts precedent): ElementInternals.setFormValue/setValidity are
  // ABSENT in jsdom and this page mounts real form-associated controls. Stub ONCE at the prototype,
  // BEFORE the page module's eager side effects evaluate — hence the deferred import below.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  await import('./devtools-harness.ts')
})

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

async function waitUntil(predicate: () => boolean, what: string, timeoutMs = 4000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error(`waitUntil timed out: ${what}`)
    await tick()
  }
}

function statusEl(): HTMLElement {
  return document.querySelector('[data-devtools="status"]') as HTMLElement
}

function timelineEvents(): DevtoolsEvent[] {
  return [...document.querySelectorAll('[data-devtools="timeline"] [data-devtools-event]')].map(
    (row) => JSON.parse(row.textContent ?? '') as DevtoolsEvent,
  )
}

async function postTurn(text: string): Promise<void> {
  const before = Number(statusEl().dataset.turnCount ?? '0')
  const editor = document.querySelector('[data-devtools="conversation"] ui-conversation-composer [data-part="editor"]') as HTMLElement
  expect(editor, 'composer editor not found').not.toBeNull()
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  ;(document.querySelector('[data-devtools="conversation"] ui-conversation-composer [data-part="send"]') as HTMLElement).click()
  await waitUntil(
    () => Number(statusEl().dataset.turnCount ?? '0') > before && statusEl().dataset.turnState === 'idle',
    `turn ${before + 1} to end`,
  )
}

describe('devtools-harness — the page mounts with every helper hook (SPEC-R8 AC1/AC3)', () => {
  it('backend switcher (3 rows), status, conversation, timeline, canvas, verdicts, capture controls all present', () => {
    const backendIds = [...document.querySelectorAll('[data-devtools="backend"]')].map((b) => (b as HTMLElement).dataset.backendId)
    expect(backendIds).toEqual(['replay', 'proxy', 'a2a'])
    expect(document.querySelector('[data-devtools="backend"][data-backend-id="replay"][data-active="true"]')).not.toBeNull()
    for (const hook of ['status', 'conversation', 'timeline', 'copy-timeline', 'canvas', 'export', 'download', 'capture-output', 'capture-input', 'import']) {
      expect(document.querySelector(`[data-devtools="${hook}"]`), `missing hook: ${hook}`).not.toBeNull()
    }
    expect(statusEl().dataset.turnState).toBe('idle')
    expect(statusEl().dataset.turnCount).toBe('0')
  })
})

describe('a replay turn end-to-end (SPEC-R8 AC1 / R9 AC1)', () => {
  it('streams the whole DevtoolsEvent timeline, mounts the seed button on the canvas, and posts render{ok:true}', async () => {
    await postTurn('show me a button')
    const events = timelineEvents()
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end', 'render'])
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4]) // page-level contiguous re-stamp
    expect(events[0]).toMatchObject({ kind: 'turn-start', backend: 'replay' })
    expect(events.at(-1)).toMatchObject({ kind: 'render', surfaceId: 'canvas', ok: true })
    // browser-truth verdict row, visible (SPEC-R9: never a blank canvas without a verdict)
    const verdict = document.querySelector('[data-devtools="verdict"][data-surface-id="canvas"]') as HTMLElement
    expect(verdict).not.toBeNull()
    expect(verdict.dataset.ok).toBe('true')
    // the REAL renderer mounted the seed Button under the canvas hook
    expect(document.querySelector('[data-devtools="canvas"] ui-button')).not.toBeNull()
  })

  it('export produces a parseable v1 capture carrying the whole page timeline (SPEC-R10)', async () => {
    ;(document.querySelector('[data-devtools="export"]') as HTMLElement).click()
    const output = document.querySelector('[data-devtools="capture-output"]') as HTMLTextAreaElement
    const capture = JSON.parse(output.value) as DevtoolsCapture
    expect(capture.kind).toBe('agent-ui-devtools-capture')
    expect(capture.version).toBe(1)
    expect(capture.backend).toBe('replay')
    expect(capture.timeline.map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end', 'render'])
  })
})

describe('backend switching is the one-construction-site swap (SPEC-R8 AC2)', () => {
  it('selecting a2a flips data-active and a turn round-trips the loopback peer to the same rendered shape', async () => {
    ;(document.querySelector('[data-devtools="backend"][data-backend-id="a2a"]') as HTMLElement).click()
    expect(document.querySelector('[data-devtools="backend"][data-backend-id="a2a"][data-active="true"]')).not.toBeNull()
    expect(document.querySelector('[data-devtools="backend"][data-backend-id="replay"][data-active="true"]')).toBeNull()
    const eventsBefore = timelineEvents().length
    await postTurn('again, over a2a')
    const fresh = timelineEvents().slice(eventsBefore)
    expect(fresh.map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end', 'render'])
    expect(fresh[0]).toMatchObject({ kind: 'turn-start', backend: 'a2a' })
    expect(fresh.at(-1)).toMatchObject({ kind: 'render', surfaceId: 'canvas', ok: true })
  })
})

describe('capture import → replay (SPEC-R10 AC1 on the page) and the failed-render verdict (SPEC-R9 AC1)', () => {
  it('an imported capture whose surface fails validation replays to a VISIBLE render{ok:false} verdict', async () => {
    const badLines = [
      '{"version":"v1.0","createSurface":{"surfaceId":"bad-surface","catalogId":"agent-ui"}}',
      '{"version":"v1.0","updateComponents":{"surfaceId":"bad-surface","components":[{"id":"root","component":"NoSuchWidget"}]}}',
    ]
    const capture: DevtoolsCapture = {
      kind: 'agent-ui-devtools-capture',
      version: 1,
      createdAt: '2026-08-17T00:00:00.000Z',
      backend: 'replay',
      session: { turns: [] },
      timeline: [
        { seq: 0, at: 't', kind: 'turn-start', input: { kind: 'intent', text: 'x', session: { turns: [] } }, backend: 'replay' },
        { seq: 1, at: 't', kind: 'line', line: badLines[0] as string },
        { seq: 2, at: 't', kind: 'line', line: badLines[1] as string },
        { seq: 3, at: 't', kind: 'turn-end', status: 'ok', lines: 2, ms: 0 },
      ],
    }
    const inputBox = document.querySelector('[data-devtools="capture-input"]') as HTMLTextAreaElement
    inputBox.value = JSON.stringify(capture)
    ;(document.querySelector('[data-devtools="import"]') as HTMLElement).click()
    // import arms the replay backend (the page announces it)
    expect(document.querySelector('[data-devtools="backend"][data-backend-id="replay"][data-active="true"]')).not.toBeNull()

    const eventsBefore = timelineEvents().length
    await postTurn('replay the imported capture')
    const fresh = timelineEvents().slice(eventsBefore)
    const lines = fresh.filter((e): e is Extract<DevtoolsEvent, { kind: 'line' }> => e.kind === 'line')
    expect(lines.map((e) => e.line)).toEqual(badLines) // byte-identical replay of the imported line sequence
    const render = fresh.find((e): e is Extract<DevtoolsEvent, { kind: 'render' }> => e.kind === 'render')
    expect(render).toMatchObject({ surfaceId: 'bad-surface', ok: false })
    const verdict = document.querySelector('[data-devtools="verdict"][data-surface-id="bad-surface"]') as HTMLElement
    expect(verdict, 'the failed verdict row must be VISIBLE, never a blank canvas').not.toBeNull()
    expect(verdict.dataset.ok).toBe('false')
    expect(verdict.textContent).toContain('FAILED')
  })

  it('two surfaces where one is SILENTLY empty verdict per-surface: one ok:true + one ok:false (GH #1165)', async () => {
    // "twin-good" renders a real Button root; "twin-ghost" is named on the wire (an updateDataModel to a
    // surface that was never created — the renderer silently ignores it: no DOM, no VALIDATION_FAILED).
    // The retired global-canvas heuristic read BOTH as ok:true because twin-good's DOM filled the canvas.
    const lines = [
      '{"version":"v1.0","createSurface":{"surfaceId":"twin-good","catalogId":"agent-ui"}}',
      '{"version":"v1.0","updateComponents":{"surfaceId":"twin-good","components":[{"id":"root","component":"Button","variant":"solid","label":"Twin"}]}}',
      '{"version":"v1.0","updateDataModel":{"surfaceId":"twin-ghost","value":{"x":1}}}',
    ]
    const capture: DevtoolsCapture = {
      kind: 'agent-ui-devtools-capture',
      version: 1,
      createdAt: '2026-08-17T00:00:00.000Z',
      backend: 'replay',
      session: { turns: [] },
      timeline: [
        { seq: 0, at: 't', kind: 'turn-start', input: { kind: 'intent', text: 'x', session: { turns: [] } }, backend: 'replay' },
        ...lines.map((line, i) => ({ seq: i + 1, at: 't', kind: 'line' as const, line })),
        { seq: 4, at: 't', kind: 'turn-end' as const, status: 'ok' as const, lines: 3, ms: 0 },
      ],
    }
    const inputBox = document.querySelector('[data-devtools="capture-input"]') as HTMLTextAreaElement
    inputBox.value = JSON.stringify(capture)
    ;(document.querySelector('[data-devtools="import"]') as HTMLElement).click()

    const eventsBefore = timelineEvents().length
    await postTurn('replay the two-surface capture')
    const fresh = timelineEvents().slice(eventsBefore)
    const renders = fresh.filter((e): e is Extract<DevtoolsEvent, { kind: 'render' }> => e.kind === 'render')
    expect(renders.find((r) => r.surfaceId === 'twin-good')).toMatchObject({ ok: true })
    expect(renders.find((r) => r.surfaceId === 'twin-ghost')).toMatchObject({ ok: false })
    // and both verdicts are VISIBLE rows, each judged against its OWN root
    const good = document.querySelector('[data-devtools="verdict"][data-surface-id="twin-good"]') as HTMLElement
    const ghost = document.querySelector('[data-devtools="verdict"][data-surface-id="twin-ghost"]') as HTMLElement
    expect(good.dataset.ok).toBe('true')
    expect(ghost.dataset.ok).toBe('false')
    expect(ghost.textContent).toContain('no root mounted')
    // the good surface's root carries the per-surface marker on the canvas
    expect(document.querySelector('[data-devtools="canvas"] [data-a2ui-surface="twin-good"]')).not.toBeNull()
  })

  it('a malformed capture import fails with the typed field-naming message, never arming replay', () => {
    const inputBox = document.querySelector('[data-devtools="capture-input"]') as HTMLTextAreaElement
    inputBox.value = '{"kind":"something-else"}'
    ;(document.querySelector('[data-devtools="import"]') as HTMLElement).click()
    expect(statusEl().textContent).toContain('Import failed')
    expect(statusEl().textContent).toContain('kind')
  })
})
