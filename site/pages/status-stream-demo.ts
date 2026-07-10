// site/pages/status-stream-demo.ts — the ui-status-stream LIVE demo (ADR-0122, SPEC-R18/R19). Replays the
// SAME in-repo arena flagship match transcript (packages/agent-ui/a2a/matches/flagship.match.jsonl — a REAL
// recorded Sonnet-5-vs-Haiku-4.5 tic-tac-toe game) the arena page itself uses, read via the shared
// `readNdjsonLines` reader (LLD-C1), through the component's REAL appendEntry/update/finalize API — one
// line at a time, paced with a short delay so the tail-follow + keyed transitions are visibly live, not an
// instant dump. "Cut short" demonstrates the completion invariant (SPEC-R11): finalize() before the match's
// recorded end leaves the still-active seat visibly TRUNCATED. The control owns the mechanics; this page
// only projects the transcript's wire/game/context lines onto StatusEntry calls, exactly as a live consumer
// narrating a real agent stream would (an INSTRUMENT-BRIDGE projection, never a mock of the component API).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { exampleSection, uiButton } from '../lib/specimens.ts'
import { readNdjsonLines } from '../lib/ndjson-lines.ts'
import type { UIStatusStreamElement } from '@agent-ui/components/components'
// The committed fixture, the SAME bytes the a2a-tic-tac-toe demo page's arena-replay reads (a Vite `?raw`
// static import — zero network, zero fetch).
import flagshipRaw from '../../packages/agent-ui/a2a/matches/flagship.match.jsonl?raw'

const { content } = mountPage({
  title: 'ui-status-stream — demo',
  intro:
    'The live "what the system is doing now" strip, replaying a REAL recorded arena match (Sonnet-5 vs ' +
    'Haiku-4.5, tic-tac-toe) one transcript line at a time through the real appendEntry/update/finalize ' +
    'API. Tail-follow keeps the newest entry in view; scroll up to pin it. "Cut short" proves the ' +
    'completion invariant — finalize() before the recorded end leaves the active seat TRUNCATED, never a ' +
    'forever-spinner. The API table is on the ui-status-stream API page.',
})

const stream = document.createElement('ui-status-stream') as UIStatusStreamElement
stream.setAttribute('label', 'Live match')

interface ArenaLine {
  matchId?: string
  seats?: Record<string, { provider: string; model: string }>
  wire?: { from: string; to: string }
  game?: { kind: 'move' | 'end'; seat?: string; move?: number }
  context?: { seat: string; entry: { role: string; content: string } }
}

/** Project one parsed arena-transcript line onto the stream's REAL appendEntry/update calls — a live
 *  consumer's job, exactly the shape a real agent-activity narrator would drive. */
function projectLine(line: ArenaLine, seeded: Set<string>): void {
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

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

let running = false
async function replay(cutShort: boolean): Promise<void> {
  if (running) return
  running = true
  playButton.setAttribute('disabled', '')
  cutButton.setAttribute('disabled', '')
  stream.replaceChildren() // a fresh run each time

  const bytes = new TextEncoder().encode(flagshipRaw)
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const seeded = new Set<string>()
  const lines: string[] = []
  for await (const raw of readNdjsonLines(body)) lines.push(raw)
  const feed = cutShort ? lines.filter((l) => !l.includes('"kind":"end"')) : lines

  for (const raw of feed) {
    projectLine(JSON.parse(raw) as ArenaLine, seeded)
    await delay(60) // paced so tail-follow + keyed transitions are visibly live
  }
  if (cutShort) stream.finalize() // the completion invariant — any still-active seat renders TRUNCATED

  running = false
  playButton.removeAttribute('disabled')
  cutButton.removeAttribute('disabled')
}

const playButton = uiButton('▶ Replay the full match', 'solid')
playButton.addEventListener('click', () => void replay(false))

const cutButton = uiButton('Cut short + finalize (show truncation)', 'ghost')
cutButton.addEventListener('click', () => void replay(true))

content.append(exampleSection('Live match replay', stream, playButton, cutButton))
void replay(false) // seed the page with a live run on load
