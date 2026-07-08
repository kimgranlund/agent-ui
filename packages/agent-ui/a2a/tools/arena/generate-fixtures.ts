// generate-fixtures.ts — LLD-C9: a dev-only Node script (never imported by src/, never a standing gate)
// that (re)generates the arena's committed scripted-match fixtures deterministically. Run with:
//   npx tsx packages/agent-ui/a2a/tools/arena/generate-fixtures.ts
// Writes `matches/scripted.match.jsonl` (the CI backbone) and `matches/contaminated-control.match.jsonl`
// (the in-transcript negative control — the scripted transcript with ONE injected leak: seat X's note +
// canary copied into a referee->O message). The out-of-transcript control
// (`contaminated-provider-control.match.jsonl`) is generated separately by its own standing test
// (model-seat.test.ts) since it exercises the model-seat/provider-stub path, not the scripted one.
// @ts-expect-error - node:fs/node:path untyped without @types/node (the fleet-wide precedent)
import { writeFileSync } from 'node:fs'
// @ts-expect-error - see above
import { dirname, join } from 'node:path'
// @ts-expect-error - import.meta.url typing needs node types; runtime-only script, not part of the tsc graph
import { fileURLToPath } from 'node:url'
import { runMatch } from './match.ts'
import { createScriptedSeat } from './seats/scripted.ts'
import { deriveCanary, deriveCanaryPair } from './canary.ts'
import { readWireData, serializeTranscript, wireMessage } from '../../src/arena/transcript.ts'
import type { Transcript, WireEvent } from '../../src/arena/transcript.ts'
import type { BoardMessage } from '../../src/arena/referee.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const MATCHES_DIR = join(HERE, '..', '..', 'matches')

const SCRIPTED_MATCH_ID = 'scripted-001'
const PINNED_DATE = '2026-07-08T00:00:00.000Z'

async function generateScripted(): Promise<Transcript> {
  // deriveCanaryPair asserts X !== O at construction (review finding 3, LLD §7) — fail-fast, never silent.
  const { X: canaryX, O: canaryO } = deriveCanaryPair(SCRIPTED_MATCH_ID)
  const result = await runMatch({
    matchId: SCRIPTED_MATCH_ID,
    scripted: true,
    date: PINNED_DATE,
    seats: {
      X: {
        seat: createScriptedSeat('X', canaryX, [
          { move: 4, note: 'take the center' },
          { move: 0 },
          { move: 8, note: 'winning diagonal' },
        ]),
        provider: 'scripted',
        model: 'scripted',
      },
      O: {
        seat: createScriptedSeat('O', canaryO, [{ move: 1 }, { move: 2 }]),
        provider: 'scripted',
        model: 'scripted',
      },
    },
  })
  const transcript: Transcript = { header: result.header, events: result.events }
  writeFileSync(join(MATCHES_DIR, 'scripted.match.jsonl'), serializeTranscript(transcript), 'utf8')
  return transcript
}

/** Build the in-transcript contaminated control from an already-generated CLEAN transcript: inject ONE
 * leak — seat X's `note` + canary copied into a referee->O `BoardMessage` (an extra key + a foreign
 * canary in a single mutation, LLD §2). Exported so the standing test can regenerate the SAME mutation
 * deterministically over the committed clean fixture (rather than re-deriving it by hand). */
export function injectContamination(transcript: Transcript, canaryX: string): Transcript {
  const events = transcript.events.slice()
  const idx = events.findIndex((e): e is WireEvent => 'wire' in e && e.wire.from === 'referee' && e.wire.to === 'O')
  if (idx === -1) throw new Error('generate-fixtures: no referee->O wire event found to contaminate')
  const original = events[idx] as WireEvent
  const originalBody = readWireData(original.wire.message) as BoardMessage
  const contaminatedBody = { ...originalBody, note: `spectator commentary leaked from X — canary: ${canaryX}` }
  events[idx] = { wire: { from: 'referee', to: 'O', message: wireMessage('referee', 9999, contaminatedBody) } }
  return { header: transcript.header, events }
}

async function main(): Promise<void> {
  const scripted = await generateScripted()
  const canaryX = deriveCanary(SCRIPTED_MATCH_ID, 'X')
  const contaminated = injectContamination(scripted, canaryX)
  writeFileSync(join(MATCHES_DIR, 'contaminated-control.match.jsonl'), serializeTranscript(contaminated), 'utf8')
  // eslint-disable-next-line no-console -- a dev-only generator script, console output is the point
  console.log(`Wrote fixtures under ${MATCHES_DIR}`)
}

void main()
