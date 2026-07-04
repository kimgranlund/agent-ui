// produce.ts — LLD-C3 / SPEC-R4/R5/R7, ADR-0070: the bounded runtime loop (streaming LLD-C2 realized).
//
// retrieve exemplars → build the catalog-derived prompt → generate via the injected AgentProvider →
// heal + validate (the SHARED surfaces, no fork — SPEC-N3) → on failure feed the validator's structured
// failures back → bounded at maxRounds → VALIDATE-THEN-STREAM (yield ONLY a fully validated payload's
// JSONL lines; SPEC-R5) → halt-and-report at the bound, emitting NOTHING invalid. The deterministic gate
// is the whole runtime verifier; there is NO runtime rubric-grading round (ADR-0070 — the a2ui-payload
// rubric is authoring/eval-time). Provider-agnostic: `deps.provider` is the injection point (a stub in
// tests, an adapter in the proxy), so the loop mechanics are gate-covered with no live model.

import type { A2uiServerMessage, A2uiOutput, Failure } from '../../src/protocol.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import type { CorpusRecord } from '../../src/corpus/record.ts'
import type { RetrieveQuery } from '../../src/corpus/retrieve.ts'
import { heal } from '../../src/corpus/heal.ts'
import { validateA2ui } from '../../src/renderer/validate.ts'
import type { AgentProvider, Turn, TurnInput } from './agent-transport.ts'
import { buildSystemPrompt } from './system-prompt.ts'
import { frameClientMessage } from './session.ts'

const PROTOCOL_VERSION = 'v1.0'
const CATALOG_ID = 'agent-ui'
const DEFAULT_MODEL = 'claude-sonnet-5' // the registry's defaultModel (providers.json)

/** The loop's injected surfaces (SPEC §5). `provider` is the model seam (stub|real); `retrieve` runs
 * over the JUDGED shard; `catalog` is the sole component authority. */
export interface ProduceDeps {
  provider: AgentProvider
  retrieve: (query: RetrieveQuery) => CorpusRecord[]
  catalog: Catalog
}

export interface ProduceOptions {
  maxRounds: number
  signal?: AbortSignal
  /** The AUTHORITATIVE model. The dev proxy passes the allowlist-VALIDATED `{provider,model}` here, and it
   * takes PRECEDENCE over any client-supplied `input.model` — the trust boundary (SPEC-R12): a crafted
   * `input.model` must never reach the API. `input.model` is only a fallback for callers that don't set it. */
  model?: string
  /** Retrieval top-k (defaults to 3). */
  k?: number
}

/** Thrown when the loop exhausts `maxRounds` without a valid payload — the page shows a "could not
 * compose a valid surface" error, NOT a broken render (SPEC-R5). Carries the last round's failures. */
export class ProduceHalt extends Error {
  readonly failures: Failure[]
  constructor(failures: Failure[]) {
    super(`produce: no valid surface within the round bound (${failures.map((f) => f.code).join(', ') || 'unknown'})`)
    this.name = 'ProduceHalt'
    this.failures = failures
  }
}

function userContent(input: TurnInput): string {
  return input.kind === 'intent' ? input.text : frameClientMessage(input.message)
}

function queryOf(input: TurnInput, k: number): RetrieveQuery {
  return { intent: userContent(input), k, catalogId: CATALOG_ID, protocolVersion: PROTOCOL_VERSION }
}

/**
 * Assemble the model messages for one generation round: the session history, the current user turn, and
 * — on a self-correct round — the prior INVALID attempt plus the validator's structured failures, so the
 * model sees exactly what it emitted and what was wrong (ADR-0070's "feed the failures back").
 */
function messagesFor(input: TurnInput, failures: Failure[] | undefined, lastRaw: string | undefined): Turn[] {
  const turns: Turn[] = [...input.session.turns, { role: 'user', content: userContent(input) }]
  if (failures && failures.length > 0 && lastRaw !== undefined) {
    turns.push({ role: 'assistant', content: lastRaw })
    const summary = failures.map((f) => `${f.code}${f.path ? ` at ${f.path}` : ''}`).join('; ')
    turns.push({
      role: 'user',
      content: `That output was INVALID (${summary}). Re-emit the COMPLETE corrected A2UI JSONL — nothing else.`,
    })
  }
  return turns
}

/** Strip a single wrapping markdown code fence (```json … ```), if the model added one despite the
 * prompt. The inner text is the JSONL the model actually emitted. */
function stripOuterFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/^```(?:json|jsonl)?\s*\n?([\s\S]*?)\n?```$/)
  return (m ? m[1]! : t).trim()
}

/**
 * The model emits JSONL (one A2UI message per line), NOT a single JSON value — so heal PER LINE (the
 * shared healer's designed per-line mode, ADR-0061) and flatten. Returns the assembled `A2uiOutput`, or
 * `undefined` if any line is unparseable (mapped by the caller to a PARSE failure fed back).
 */
function assembleFromRaw(raw: string): A2uiOutput | undefined {
  const lines = stripOuterFence(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return undefined
  const output: A2uiServerMessage[] = []
  for (const line of lines) {
    const healed = heal(line, { protocolVersion: PROTOCOL_VERSION })
    if (!healed.ok) return undefined
    output.push(...healed.messages)
  }
  return output
}

export async function* produce(input: TurnInput, deps: ProduceDeps, opts: ProduceOptions): AsyncIterable<string> {
  const k = opts.k ?? 3
  const exemplars = deps.retrieve(queryOf(input, k)) // SPEC-R7 — top-k over the judged shard
  const system = buildSystemPrompt(deps.catalog, exemplars) // SPEC-R6 — catalog-derived
  const model = opts.model ?? input.model ?? DEFAULT_MODEL // opts.model = the proxy's allowlist-validated model (SPEC-R12); it WINS over a client-supplied input.model

  let failures: Failure[] | undefined
  let lastRaw: string | undefined
  for (let round = 0; round < opts.maxRounds; round++) {
    let raw = ''
    for await (const frag of deps.provider.stream({
      model,
      system,
      messages: messagesFor(input, failures, lastRaw),
      signal: opts.signal,
    })) {
      raw += frag
    }
    lastRaw = raw

    const output = assembleFromRaw(raw)
    if (output === undefined) {
      failures = [{ code: 'PARSE', path: '' }]
      continue
    }
    const verdict = validateA2ui(output, deps.catalog) // SPEC-N3 — the shared validator, no fork
    if (verdict.valid) {
      for (const msg of output) yield JSON.stringify(msg) // SPEC-R5 — validate-then-stream (nothing invalid ever painted)
      return
    }
    failures = verdict.failures // SPEC-R4 — self-correct: feed the structured failures back
  }
  throw new ProduceHalt(failures ?? [{ code: 'SCHEMA', path: '' }])
}
