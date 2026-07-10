// a2a-tic-tac-toe.live.test.ts — LLD-C5 (SPEC-R17) jsdom page-level leg for the arena's REAL-TIME live
// arm. `global.fetch` is stubbed so the page's own dynamic-imported `arena-live-transport.ts` drives the
// exact production code path (`runLiveMatchStream` -> `readNdjsonLines` -> the incremental
// `ReplayAccumulator`) against a hand-controlled `ReadableStream` — no real dev proxy, no network, but
// every line of client code between the click and the rendered DOM is genuine. This is the page-level
// proof of SPEC-R17 AC2 (done gated on `isComplete()`, never stream end) and AC3 (cancel discards, the
// previously selected recorded fixture returns) that the accumulator/match-runner unit legs can't reach on
// their own, since they don't exercise the page's follow-tail rendering or its Cancel wiring.
import { describe, it, expect, beforeAll, vi } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (fleet precedent)
import { readFileSync } from 'node:fs'

declare const process: { cwd(): string }
const scriptedRaw = readFileSync(`${process.cwd()}/packages/agent-ui/a2a/matches/scripted.match.jsonl`, 'utf8') as string
const scriptedLines = scriptedRaw
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0)

/** A `ReadableStream<Uint8Array>` the test drives line-by-line (`push`), with no timers — every await in
 * a test is a real microtask boundary the page's `for await` loop must cross, so pacing is deterministic. */
interface ControllableStream {
  stream: ReadableStream<Uint8Array>
  push(line: string): void
  end(): void
  error(e: unknown): void
}
function createControllableStream(): ControllableStream {
  let ctrl: ReadableStreamDefaultController<Uint8Array> | undefined
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })
  return {
    stream,
    push: (line) => ctrl!.enqueue(encoder.encode(`${line}\n`)),
    end: () => ctrl!.close(),
    error: (e) => ctrl!.error(e),
  }
}

let root: ParentNode
let latestPostStream: ControllableStream | undefined

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const href = String(url)
      if (href.includes('/status')) {
        return new Response(JSON.stringify({ available: true, providers: 1 }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      const ctrl = createControllableStream()
      latestPostStream = ctrl
      // Mirror the real proxy's client-disconnect posture: an aborted signal ends the stream with the
      // platform's own AbortError — exactly what a genuinely aborted fetch's body reader would surface.
      init?.signal?.addEventListener('abort', () => ctrl.error(new DOMException('aborted', 'AbortError')))
      return new Response(ctrl.stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
    }),
  )

  const appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.append(appRoot)
  await import('./a2a-tic-tac-toe.ts')
  root = appRoot
  // wireLiveOverlay()'s probe + dynamic import (`import('../lib/arena-live-transport.ts')`) are
  // fire-and-forget on module import. Wait on the OBSERVABLE they produce — the Run control existing —
  // not a fixed wall-clock budget: under a full parallel suite the vite transform server is saturated and
  // that dynamic import routinely takes longer than any fixed setTimeout, leaving the live section hidden
  // and every test cascading off a null Run button. Polling settles exactly when ready and no sooner; the
  // generous tick bound still fails loudly on a genuine hang (a real regression), never on machine load.
  await waitUntil(() => appRoot.querySelector('[data-live-action="run"]') !== null, 1000)
})

const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement
function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}
// A macrotask tick (not a `Promise.resolve()` microtask chain) fully drains whatever the ReadableStream
// reader/decoder/async-generator chain queued in between — the robust way to wait out an unknown number
// of microtask hops without guessing a magic count.
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const flush = async (n = 3): Promise<void> => {
  for (let i = 0; i < n; i++) await tick()
}
/** Poll `pred` across up to `tries` macrotask ticks — the robust wait for "the async chain has settled",
 * used after pushing a whole batch of lines at once (an unknown, stream-length-dependent number of hops).
 * `unknown` (not `boolean`) because `HTMLElement.hidden`'s own DOM type is `boolean | "until-found"`. */
async function waitUntil(pred: () => unknown, tries = 200): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (pred()) return
    await tick()
  }
  throw new Error(`waitUntil: condition never became true after ${tries} ticks`)
}
const verdict = (): HTMLElement => q('[data-verdict]')
const narration = (): string => q('[data-narration]').textContent ?? ''
const stepLabel = (): string => q('[data-step-label]').textContent ?? ''
const runBtn = (): HTMLElement => q('[data-live-action="run"]')
const cancelBtn = (): HTMLElement => q('[data-live-action="cancel"]')
const nextBtn = (): HTMLElement => q('[data-action="next"]')
const fixtureBtn = (key: string): HTMLElement => q(`[data-fixture="${key}"]`)

describe('the A2A tic-tac-toe page — the live overlay appears once probeArenaLive reports a key', () => {
  it('the live section is visible with a Run control, once the (mocked) probe resolves', () => {
    expect(q('[data-live]').hidden).toBe(false)
    expect(runBtn()).not.toBeNull()
  })
})

describe('the A2A tic-tac-toe page — a live run streams incrementally and completes via isComplete(), the same checker as a recorded fixture (SPEC-R17 AC1/AC2)', () => {
  it('renders the header + first move BEFORE the match completes — genuine mid-stream paint, not a batch dump at the end', async () => {
    click(runBtn())
    await flush()
    expect(runBtn().hasAttribute('disabled')).toBe(true)
    expect(cancelBtn().hidden).toBe(false)
    expect(verdict().dataset.verdict).toBe('pending')

    latestPostStream!.push(scriptedLines[0]!) // header
    await flush()
    expect(stepLabel()).toContain('Move 0 of 0')

    latestPostStream!.push(scriptedLines[1]!) // first wire event (referee -> X, no game event yet)
    await flush()
    // still pending — the match is genuinely mid-flight, no premature verdict.
    expect(verdict().dataset.verdict).toBe('pending')
  })

  it('completing the stream (through the trailing game:end line) flips to done — verdict computed from the COMPLETED transcript, code-identical to a recorded fixture', async () => {
    for (const line of scriptedLines.slice(2)) latestPostStream!.push(line)
    latestPostStream!.end()
    await waitUntil(() => cancelBtn().hidden)

    expect(runBtn().hasAttribute('disabled')).toBe(false)
    expect(verdict().dataset.verdict).toBe('clean') // the scripted fixture is isolation-clean (arena-replay.test.ts's own proof)
    // `selectFixture('live')` re-enters the EXISTING batch call site (LLD-C5) — which, like every fixture
    // load, resets the scrubber to step 0. Prove the FULL replay loaded (not a partial) by scrubbing to the
    // end exactly as the recorded-fixture suite does.
    expect(stepLabel()).toContain('Move 0 of')
    for (let i = 0; i < 30; i++) click(nextBtn())
    expect(narration()).toContain('X wins')
  })
})

describe('the A2A tic-tac-toe page — cancel mid-match discards the partial stream and restores the previously selected recorded fixture (SPEC-R17 AC3)', () => {
  it('pins the scripted fixture as the "previously selected recorded" one before going live', () => {
    click(fixtureBtn('scripted'))
    expect(fixtureBtn('scripted').getAttribute('variant')).toBe('solid')
  })

  it('clicking Cancel mid-stream aborts the fetch, discards the partial accumulation, and re-selects the scripted fixture', async () => {
    click(runBtn())
    await flush()
    latestPostStream!.push(scriptedLines[0]!) // header only — nowhere near isComplete()
    await flush()
    expect(cancelBtn().hidden).toBe(false)

    click(cancelBtn())
    await waitUntil(() => cancelBtn().hidden)

    expect(runBtn().hasAttribute('disabled')).toBe(false)
    // discarded, not loaded: the scripted fixture (pinned above) is back, its own clean verdict restored —
    // never a partial live transcript reaching the isolation panel.
    expect(fixtureBtn('scripted').getAttribute('variant')).toBe('solid')
    expect(verdict().dataset.verdict).toBe('clean')
  })

  it('negative control (SPEC-R17 AC2\'s completion-gate arm, at the page level): a stream that ends WITHOUT the terminal game-end event is also discarded, never loaded as done', async () => {
    click(fixtureBtn('flagship')) // pin a DIFFERENT recorded fixture this time
    expect(fixtureBtn('flagship').getAttribute('variant')).toBe('solid')

    click(runBtn())
    await flush()
    // Push every line EXCEPT the trailing {"game":{"kind":"end",...}} line, then end the stream cleanly —
    // exactly the proxy's "error-after-headers clean res.end()" case the LLD names: the prefix would
    // VALIDATE, but isComplete() must still be false.
    for (const line of scriptedLines.slice(0, -1)) latestPostStream!.push(line)
    latestPostStream!.end()
    await waitUntil(() => cancelBtn().hidden)

    expect(runBtn().hasAttribute('disabled')).toBe(false)
    // discarded — the flagship fixture (pinned above) is restored, never the truncated live transcript.
    expect(fixtureBtn('flagship').getAttribute('variant')).toBe('solid')
    expect(verdict().dataset.verdict).toBe('clean')
  })
})
