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
import { exampleSection, inline, uiButton } from '../lib/specimens.ts'
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

/** A fresh `ui-status-stream` instance, configured with the opt-in streaming header (ADR-0146 F8) +
 *  the receipt pattern (ADR-0159), the SAME trio a2ui-live.ts/gen-ui-live.ts already set on their own
 *  narration strips: header shows the live escalated status pinned outside the scroll region; oneline
 *  morphs to one line while a turn runs (current step + ticking clock); receipt auto-collapses that
 *  line to "N steps · total elapsed" + the settled outcome glyph once finalize() runs — click/Enter/
 *  Space re-expands the steps. A fresh INSTANCE per run (never a reused one, see `replay()` below) —
 *  the header/turn-clock/settled state this opts into has no public reset, and appendEntry's own
 *  duplicate-key guard would otherwise silently no-op every entry on a second run. */
function createStream(): UIStatusStreamElement {
  const el = document.createElement('ui-status-stream') as UIStatusStreamElement
  el.setAttribute('label', 'Live match')
  el.setAttribute('header', '')
  el.setAttribute('oneline', '')
  el.setAttribute('receipt', '')
  return el
}

let stream = createStream()

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
      const info = line.seats[seat]!
      stream.appendEntry({
        key: seat,
        status: 'pending',
        label: `Seat ${seat} — ${info.model}`,
        // `source` (status-stream.ts) is a creation-time-only affordance — an empty/absent value
        // plants no reveal at all, and a later update() can re-stamp an existing one but never
        // creates one late. Seed it here so each seat's own moves (below) can re-stamp it with the
        // seat's actual raw reply as the match plays.
        source: `${info.provider}/${info.model} joins the match as ${seat}.`,
      })
      seeded.add(seat)
    }
    return
  }
  if (line.wire !== undefined && (line.wire.to === 'X' || line.wire.to === 'O')) {
    stream.update(line.wire.to, { status: 'active', description: 'thinking…' })
    return
  }
  if (line.context !== undefined && line.context.entry.role === 'assistant') {
    // The seat's raw reply IS its move/reasoning for this turn — keep it inline (`text`, unchanged)
    // and re-stamp the seat's collapsed "Source" reveal with the SAME content, exercising the
    // per-entry disclosure (ADR-0143) this demo never touched before.
    stream.update(line.context.seat, { text: line.context.entry.content, source: line.context.entry.content })
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
  // A fresh run each time — swap in a brand-new instance rather than clearing this one's children:
  // `replaceChildren()` would also wipe the header/receipt DOM the opt-in effect above just built
  // (the header materializes as this element's own first child), and the class exposes no public
  // reset for its turn-clock/settled state or its appendEntry duplicate-key guard either way.
  const fresh = createStream()
  stream.replaceWith(fresh)
  stream = fresh

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
  // The completion invariant, always — it also settles the header/receipt (ADR-0146 F8/ADR-0159), so
  // the rollup only auto-collapses once a run has genuinely finished; "cut short" additionally
  // leaves a still-active seat visibly TRUNCATED.
  stream.finalize()

  running = false
  playButton.removeAttribute('disabled')
  cutButton.removeAttribute('disabled')
}

const playButton = inline(uiButton('▶ Replay the full match', 'solid')) // ADR-0223: bare demo action — hugs
playButton.addEventListener('click', () => void replay(false))

const cutButton = inline(uiButton('Cut short + finalize (show truncation)', 'ghost')) // ADR-0223: bare demo action — hugs
cutButton.addEventListener('click', () => void replay(true))

content.append(exampleSection('Live match replay', stream, playButton, cutButton))
void replay(false) // seed the page with a live run on load
