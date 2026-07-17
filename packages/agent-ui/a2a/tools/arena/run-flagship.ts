// run-flagship.ts — LLD-C9/C10: the flagship proof run — a REAL model-vs-model match (dev-only, needs a
// live key), recorded through the exact same seams (`match.ts`/`model.ts`) the stub-driven tests use. Run
// with:
//   npx tsx packages/agent-ui/a2a/tools/arena/run-flagship.ts
// Reads `ANTHROPIC_API_KEY` from the repo-root `.env` (gitignored) or `process.env`. On success, writes
// `matches/flagship.match.jsonl` ONLY if the transcript validates AND the isolation gate is clean
// (LLD §5: "fixtures land only gate-green" — no partial/failed fixture is ever committed).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anthropicProvider } from '../../../a2ui/src/agent/providers/anthropic.ts'
import { runMatch } from './match.ts'
import { createModelSeat } from './seats/model.ts'
import { deriveCanaryPair } from './canary.ts'
import { checkIsolation } from '../../src/arena/isolation.ts'
import { serializeTranscript, validateTranscript } from '../../src/arena/transcript.ts'
import { PROTOCOL_VERSION } from '../../src/protocol/types.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined>; exit(code: number): never }

const HERE = dirname(fileURLToPath(import.meta.url))
const MATCHES_DIR = join(HERE, '..', '..', 'matches')
const ROOT = process.cwd()

/** Minimal `.env` reader (no dependency) — repo-root `.env`, gitignored, `KEY=value` per line. */
function loadDotEnv(): Record<string, string> {
  try {
    const text = readFileSync(join(ROOT, '.env'), 'utf8') as string
    const out: Record<string, string> = {}
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
    return out
  } catch {
    return {}
  }
}

const FLAGSHIP_MATCH_ID = 'flagship-001'
const SEAT_X_MODEL = 'claude-sonnet-5'
const SEAT_O_MODEL = 'claude-haiku-4-5-20251001'

async function main(): Promise<void> {
  const dotenv = loadDotEnv()
  const apiKey = process.env.ANTHROPIC_API_KEY ?? dotenv.ANTHROPIC_API_KEY
  if (apiKey === undefined || apiKey === '') {
    console.error('run-flagship: no ANTHROPIC_API_KEY found (process.env or repo-root .env) — aborting, not faking a result.')
    process.exit(1)
  }

  const provider = anthropicProvider({ apiKey })
  // deriveCanaryPair asserts X !== O at construction (review finding 3, LLD §7) — fail-fast, never silent.
  const { X: canaryX, O: canaryO } = deriveCanaryPair(FLAGSHIP_MATCH_ID)

  console.log(`run-flagship: starting ${SEAT_X_MODEL} (X) vs ${SEAT_O_MODEL} (O)...`)
  const result = await runMatch({
    matchId: FLAGSHIP_MATCH_ID,
    scripted: false,
    retryBound: 2,
    perMoveTimeoutMs: 30_000,
    seats: {
      X: { seat: createModelSeat({ mark: 'X', canary: canaryX, provider, model: SEAT_X_MODEL }), provider: 'anthropic', model: SEAT_X_MODEL },
      O: { seat: createModelSeat({ mark: 'O', canary: canaryO, provider, model: SEAT_O_MODEL }), provider: 'anthropic', model: SEAT_O_MODEL },
    },
  })

  const transcript = { header: result.header, events: result.events }
  const serialized = serializeTranscript(transcript)
  const lines = serialized.split('\n').filter((l) => l.length > 0)

  const schemaFailures = validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })
  const isolationFailures = checkIsolation(transcript)

  console.log(`run-flagship: match ended — ${JSON.stringify(result.end)}`)
  console.log(`run-flagship: schema failures: ${schemaFailures.length}, isolation failures: ${isolationFailures.length}`)

  if (schemaFailures.length > 0 || isolationFailures.length > 0) {
    console.error('run-flagship: NOT committing — the match failed schema validation or the isolation gate.')
    console.error(JSON.stringify({ schemaFailures, isolationFailures }, null, 2))
    process.exit(1)
  }

  writeFileSync(join(MATCHES_DIR, 'flagship.match.jsonl'), serialized, 'utf8')
  console.log(`run-flagship: committed matches/flagship.match.jsonl (gate-green).`)
}

void main()
