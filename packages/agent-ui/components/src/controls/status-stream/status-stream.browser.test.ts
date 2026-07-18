import { describe, it, expect, afterEach, vi } from 'vitest'
import { server } from 'vitest/browser'
import { readNdjsonLines } from '../../../../../../site/lib/ndjson-lines.ts'
import type { UIStatusStreamElement } from './status-stream.ts'
import type { UITimelineItemElement } from '../timeline-item/timeline-item.ts'

// timeline-family.lld.md §4 · SPEC-R10/R11/R19 — the cross-engine tail-follow + completion-invariant +
// REAL-stream proof for ui-status-stream. The real-stream leg feeds the in-repo arena flagship match
// transcript (a REAL recorded Sonnet-5-vs-Haiku-4.5 game, packages/agent-ui/a2a/matches/flagship.match.jsonl)
// through `readNdjsonLines` (the shared LLD-C1 reader) as an INSTRUMENT-BRIDGE: the fixture's A2A wire/
// game/context lines are projected onto StatusEntry appendEntry/update calls a live consumer would make — the
// SAME appendEntry/update/finalize path, never a mock of the component's own API.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

// The committed fixture, read the SAME way the a2a-tic-tac-toe demo page does (a Vite `?raw` static
// import — zero network, zero fetch; site/lib/arena-replay.test.ts's fs-read is the Node-side proxy for
// the identical bytes this resolves to under jsdom/the browser).
import flagshipRaw from '../../../../a2a/matches/flagship.match.jsonl?raw'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; stream: UIStatusStreamElement } => {
  const wrap = document.createElement('div')
  wrap.style.maxWidth = '400px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, stream: wrap.querySelector('ui-status-stream') as UIStatusStreamElement }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  vi.restoreAllMocks()
})

const raf2 = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const nearBottom = (el: HTMLElement): boolean => el.scrollHeight - el.scrollTop - el.clientHeight <= 24
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Wait until `read()` reports the SAME value on `stableFor` consecutive checks (a bounded wall-clock
 *  poll, not a fixed delay) — `scrollIntoView({behavior:'smooth'})` animates over a browser-determined
 *  duration, and rapid re-targeting (12 appendEntry calls in one tick, each retargeting the in-flight
 *  animation) can produce a MOMENTARY same-value read mid-animation; requiring several consecutive stable
 *  reads (not just one) avoids concluding "settled" too early. */
async function waitUntilSettled(read: () => number, stableFor = 4, maxChecks = 60): Promise<number> {
  let prev = read()
  let stableStreak = 0
  for (let i = 0; i < maxChecks; i++) {
    await wait(50)
    const next = read()
    stableStreak = next === prev ? stableStreak + 1 : 0
    prev = next
    if (stableStreak >= stableFor) return next
  }
  return prev
}

describe('ui-status-stream — the opt-in streaming header stays PINNED while entries overflow (ADR-0146 F8)', () => {
  it('the sticky header does not scroll away as the strip overflows and scrolls to the bottom', async () => {
    // a small bounded viewport so a handful of entries genuinely overflow it
    const { stream } = mount(
      '<ui-status-stream header label="Agent activity" style="--ui-status-stream-max-block-size:8rem"></ui-status-stream>',
    )
    for (let i = 0; i < 20; i++) {
      stream.appendEntry({ key: `k${i}`, status: 'active', label: `Step ${i} — a long enough label to force the strip to overflow` })
    }
    await raf2()
    const header = stream.querySelector('[data-part="header"]') as HTMLElement
    expect(header, 'the header must render when opted in').not.toBeNull()
    expect(stream.scrollHeight, 'the strip must have overflowed its bounded viewport').toBeGreaterThan(stream.clientHeight)

    // at scrollTop 0 the header sits at the top of the scroll viewport
    const topAtZero = header.getBoundingClientRect().top
    expect(Math.abs(topAtZero - stream.getBoundingClientRect().top), 'header should sit at the strip top').toBeLessThan(2)

    // scroll the strip to the bottom — the sticky header must stay at the SAME viewport position (pinned)
    stream.scrollTop = stream.scrollHeight
    stream.dispatchEvent(new Event('scroll'))
    await raf2()
    expect(stream.scrollTop, 'the strip actually scrolled its content').toBeGreaterThan(0)
    const topAfterScroll = header.getBoundingClientRect().top
    expect(Math.abs(topAfterScroll - topAtZero), 'the header must stay pinned, never scrolling away with the entries').toBeLessThan(2)
  })
})

describe('ui-status-stream — tail-follow + the stick-to-bottom guard (SPEC-R10)', () => {
  it('follows the newest entry to the bottom on appendEntry (stuck-to-bottom by default)', async () => {
    const { stream } = mount('<ui-status-stream label="Live"></ui-status-stream>')
    for (let i = 0; i < 12; i++) stream.appendEntry({ key: `k${i}`, status: 'active', label: `Step ${i}`, description: 'a line of description text' })
    await raf2()
    expect(stream.scrollHeight, 'the strip should have overflowed its bounded max-block-size').toBeGreaterThan(stream.clientHeight)
    await waitUntilSettled(() => stream.scrollTop) // let the smooth-scroll animation finish, not just the #tailFollow CALL
    expect(nearBottom(stream), 'the stream did not follow to the bottom on appendEntry').toBe(true)
  })

  it('scrolling UP pins the viewport — a new arrival does NOT yank it back to the bottom', async () => {
    const { stream } = mount('<ui-status-stream label="Live"></ui-status-stream>')
    for (let i = 0; i < 12; i++) stream.appendEntry({ key: `k${i}`, status: 'active', label: `Step ${i}`, description: 'a line of description text' })
    await raf2()

    stream.scrollTop = 0
    stream.dispatchEvent(new Event('scroll'))
    const scrollTopAfterUserScroll = stream.scrollTop

    stream.appendEntry({ key: 'new', status: 'active', label: 'A late arrival' })
    await raf2()
    expect(stream.scrollTop, 'an appendEntry yanked the viewport after the user scrolled up').toBeCloseTo(scrollTopAfterUserScroll, 0)
  })

  it('scrolling back down (within the threshold) resumes follow for the NEXT arrival', async () => {
    const { stream } = mount('<ui-status-stream label="Live"></ui-status-stream>')
    for (let i = 0; i < 12; i++) stream.appendEntry({ key: `k${i}`, status: 'active', label: `Step ${i}`, description: 'a line of description text' })
    await raf2()

    stream.scrollTop = 0
    stream.dispatchEvent(new Event('scroll'))
    stream.appendEntry({ key: 'ignored', status: 'active', label: 'Ignored while scrolled up' })
    await raf2()
    expect(nearBottom(stream)).toBe(false) // the guard held — still scrolled up

    stream.scrollTop = stream.scrollHeight // back to the bottom
    stream.dispatchEvent(new Event('scroll'))
    stream.appendEntry({ key: 'resumed', status: 'active', label: 'Follow resumes' })
    await raf2()
    await waitUntilSettled(() => stream.scrollTop) // let the smooth-scroll animation finish
    expect(nearBottom(stream), 'follow did not resume after returning to the bottom').toBe(true)
  })

  it('prefers-reduced-motion collapses the follow to an instant jump (behavior:"auto", not "smooth")', async () => {
    if (server.browser !== 'chromium') return // the reduced-motion emulation leg is Chromium-only (CDP), the button/timeline-item precedent
    const { cdp } = await import('vitest/browser')
    const session = cdp() as unknown as { send(method: string, params?: Record<string, unknown>): Promise<unknown> }
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      const { stream } = mount('<ui-status-stream label="Live"></ui-status-stream>')
      const spy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
      stream.appendEntry({ key: 'a', status: 'active', label: 'x' })
      await raf2()
      expect(spy).toHaveBeenCalled()
      const opts = spy.mock.calls.at(-1)?.[0] as ScrollIntoViewOptions
      expect(opts.behavior, 'reduced-motion should collapse the follow to an instant jump').toBe('auto')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

describe('ui-status-stream — the completion invariant, cross-engine (SPEC-R11)', () => {
  it('finalize() truncates a still-active entry — a distinct :state(truncated), not left "still working"', () => {
    const { stream } = mount('<ui-status-stream></ui-status-stream>')
    const item = stream.appendEntry({ key: 'a', status: 'active', label: 'Generating…' }) as UITimelineItemElement
    expect(item.matches(':state(truncated)')).toBe(false)
    stream.finalize()
    expect(item.matches(':state(truncated)'), 'an unresolved entry must be TRUNCATED after finalize()').toBe(true)
  })

  it('a resolved entry (done) is NOT truncated by finalize()', () => {
    const { stream } = mount('<ui-status-stream></ui-status-stream>')
    const item = stream.appendEntry({ key: 'a', status: 'done', label: 'Complete' }) as UITimelineItemElement
    stream.finalize()
    expect(item.matches(':state(truncated)')).toBe(false)
  })
})

// ── the REAL-stream proof (SPEC-R19) — the in-repo arena flagship match, fed via readNdjsonLines ─────────

interface WireLine { wire: { from: string; to: string } }
interface GameLine { game: { kind: 'move' | 'end'; seat?: string; move?: number } }
interface ContextLine { context: { seat: string; entry: { role: string; content: string } } }
interface HeaderLine { matchId: string; seats: Record<string, { provider: string; model: string }> }
type ArenaLine = Partial<WireLine & GameLine & ContextLine & HeaderLine>

/** Feed one parsed arena-transcript line through the stream's REAL appendEntry/update API (the INSTRUMENT-
 *  BRIDGE projection — a live consumer's job, never component code). Returns true once the header has
 *  seeded both seats (so the caller can assert non-vacuously that real projection happened). */
function projectLine(stream: UIStatusStreamElement, line: ArenaLine, seeded: Set<string>): void {
  if (line.matchId !== undefined && line.seats !== undefined) {
    for (const seat of Object.keys(line.seats)) {
      stream.appendEntry({ key: seat, status: 'pending', label: `Seat ${seat} — ${line.seats[seat]!.model}` })
      seeded.add(seat)
    }
    return
  }
  if (line.wire !== undefined && (line.wire.to === 'X' || line.wire.to === 'O')) {
    stream.update(line.wire.to, { status: 'active', description: 'thinking…' })
    return
  }
  if (line.context !== undefined && line.context.entry.role === 'assistant') {
    stream.update(line.context.seat, { text: line.context.entry.content })
    return
  }
  if (line.game !== undefined && line.game.kind === 'move' && line.game.seat !== undefined) {
    stream.update(line.game.seat, { status: 'done', description: `played cell ${line.game.move}` })
    return
  }
  if (line.game !== undefined && line.game.kind === 'end') {
    for (const seat of seeded) stream.update(seat, { status: 'done' })
  }
}

describe('ui-status-stream — the REAL arena NDJSON stream, fed line-by-line (SPEC-R19)', () => {
  it('appends both seats, transitions them in place (keyed update, no duplicate elements), and tail-follows — cross-engine', async () => {
    const { stream } = mount('<ui-status-stream label="Live match"></ui-status-stream>')
    const seeded = new Set<string>()
    const bytes = new TextEncoder().encode(flagshipRaw)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })
    let lineCount = 0
    for await (const raw of readNdjsonLines(body)) {
      lineCount++
      projectLine(stream, JSON.parse(raw) as ArenaLine, seeded)
    }
    await raf2()

    expect(lineCount, 'the recorded transcript must be a genuine multi-line match, not a vacuous fixture').toBeGreaterThan(10)
    expect(seeded.size, 'both seats (X and O) must have been seeded from the header').toBe(2)
    // keyed identity — exactly ONE ui-timeline-item per seat, never a duplicate appended by a later update.
    expect(stream.querySelectorAll('ui-timeline-item')).toHaveLength(2)
    for (const seat of seeded) {
      const item = stream.querySelector(`ui-timeline-item[data-key="${seat}"]`) as UITimelineItemElement
      expect(item.status, `seat ${seat} should have resolved to done by the recorded match's end`).toBe('done')
      // the streamed "text" cell carries the seat's real recorded reasoning (never parsed/tokenized).
      expect(item.querySelector('[data-role="text"]')?.textContent?.length, `seat ${seat} streamed text should be non-empty`).toBeGreaterThan(0)
    }
    expect(nearBottom(stream), 'the stream did not tail-follow to the bottom across the whole real match').toBe(true)
  })

  it('a feed truncated mid-entry (the header + moves only, no "end") leaves the active seat TRUNCATED after finalize() — runnable with no live key', async () => {
    const { stream } = mount('<ui-status-stream label="Live match"></ui-status-stream>')
    const seeded = new Set<string>()
    const allLines = flagshipRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    const withoutEnd = allLines.filter((l) => !l.includes('"kind":"end"'))
    expect(withoutEnd.length, 'the truncation fixture must genuinely drop the recorded end event').toBeLessThan(allLines.length)

    for (const raw of withoutEnd) projectLine(stream, JSON.parse(raw) as ArenaLine, seeded)
    await raf2()

    // at least one seat is still active/pending (the feed never reached "end") — the completion invariant applies.
    const stillUnresolved = [...seeded]
      .map((seat) => stream.querySelector(`ui-timeline-item[data-key="${seat}"]`) as UITimelineItemElement)
      .filter((item) => item.status === 'active' || item.status === 'pending')
    expect(stillUnresolved.length, 'the truncated feed must leave at least one seat unresolved (anti-vacuous)').toBeGreaterThan(0)

    stream.finalize()
    for (const item of stillUnresolved) expect(item.matches(':state(truncated)')).toBe(true)
  })
})
