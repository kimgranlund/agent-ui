// trace-log.ts (T-0151): the dev proxy's per-turn trace log. Every live turn the dev proxy
// (`dev-proxy-plugin.ts`, `/__a2ui/agent`) runs appends ONE JSON line to `.agent-traces/YYYY-MM-DD.jsonl`
// at the repo root (git-ignored), so an agent can triage a turn from disk: the request, every trace step
// the activity UI shows, each retry and the validator failures behind it, the raw model output per round,
// the surface operations, token usage, duration and, on failure, the full upstream error. `routing`
// (T-0239) records how the turn's context was routed: the persona and domains of the catalog, the selected
// mini-skills, each system-prompt section with its size and cache side, and every capability entry the
// context named with its load mode (an index line, or the full text framed into a user message).
//
// Dev only. The dev proxy is `apply: 'serve'`, so `vite build` never runs it, and the Cloudflare Worker
// never imports this module (it is Node-only: `node:fs`). Keys are never written: the line is serialized
// through `redactSecrets`, which replaces every configured provider key by value and then key-shaped
// strings by pattern. The system prompt is not recorded; `dispatch` objects (which carry `apiKey`) never
// reach the collector.
//
// The vocabulary is the devtools one where it fits (ADR-0200): meta-lines are read with the a2ui guard
// `readMetaLine` (never a second parser), the outcome uses `TurnEndStatus`'s `ok | error | halt` plus the
// two host-only cases (`aborted`, `rejected`), and `usage` is `TokenUsage`. `@agent-ui/devtools` itself is
// not imported: a2ui sits below devtools in the package DAG, and no key or `produce()` crosses into it.
//
// Pure parts (the collector, redaction, the upstream-error reader) are separate from the one fs sink
// (`appendTraceLine`) so the unit test needs no filesystem for the line shape.

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { readMetaLine } from '../../src/agent/meta-line.ts'
import { heal } from '../../src/corpus/heal.ts'
import { renderSurfaceJsonl } from '../../src/agent/response-type.ts'
import { parseDomainCatalogId } from '../../src/catalog/catalog-id.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../../src/catalog/personas/manifests.ts'
import type { TokenUsage, TurnProgress, TurnTrace } from '../../src/agent/meta-line.ts'
import type { AgentProvider, ProviderEvent } from '../../src/agent/agent-transport.ts'

declare const process: { env: Record<string, string | undefined> }

/** The trace line format version. Bump only when a reader must know. */
export const TRACE_LINE_VERSION = 1 as const

/** The folder name under the repo root; git-ignored and excluded from the Vite and Vitest watchers. */
export const TRACE_DIR_NAME = '.agent-traces'

/** The env flag. Unset means ON under `vite dev`; `0`, `false` or `off` turns the log off. */
export const TRACE_ENV_FLAG = 'A2UI_AGENT_TRACES'

export function tracesEnabled(env: Record<string, string | undefined>): boolean {
  const v = env[TRACE_ENV_FLAG]?.trim().toLowerCase()
  return !(v === '0' || v === 'false' || v === 'off')
}

export type TraceRoute = 'chat' | 'produce'

/** `ok`, `error` and `halt` are devtools' `TurnEndStatus`. `aborted`: the client disconnected mid-turn.
 *  `rejected`: the proxy answered before any model call (a 400 pair, a 503 missing key or adapter). */
export type TraceOutcome = 'ok' | 'error' | 'halt' | 'aborted' | 'rejected'

/** One activity step, as the UI shows it: a progress meta-line, timed from the turn start. */
export interface TraceStep {
  ms: number
  stage: TurnProgress['stage']
  round?: number
  codes?: string[]
  detail?: string
}

/** One validator failure behind a retry or a halt (`code` at `path`, plus a semantic check's sentence).
 *  `message` is the plain-words reading of the code and path (`describeFailure`), set on a round's failures. */
export interface TraceFailure {
  code: string
  path: string
  detail?: string
  message?: string
}

/** Where a PARSE round's payload stopped parsing: the first payload line the healer rejects, the JSON
 *  parser's own error, the column in that line, and the text around it. */
export interface ParseDiagnosis {
  /** 1-based line of the round's payload (after the leading meta-line and any outer code fence). */
  line: number
  column?: number
  message: string
  fragment: string
}

/** One self-correct round: `round` is the ordinal of the round about to run; `failures` are what the
 *  previous round failed on (the cause of the retry). */
export interface TraceRetry {
  round: number
  failures: TraceFailure[]
}

/** One provider call: the raw text the model streamed, the tool calls it made, and what it cost. */
export interface TraceRound {
  round: number
  ms: number
  text: string
  tools: Array<{ name: string; input: unknown }>
  usage?: TokenUsage
  error?: string
  /** `failed`: the round's payload failed a check and the next round retried it (or the turn halted on
   *  it). `passed`: the round the turn shipped. Absent on a round that threw. */
  status?: 'failed' | 'passed'
  /** What the round failed on, each with its plain-words `message`. */
  failures?: TraceFailure[]
  /** On a PARSE failure: where the payload stopped parsing. */
  parse?: ParseDiagnosis
  /** Thinking the provider streamed this round: how many deltas, and how many characters of text they
   *  carried. Deltas with zero characters mean the model thought but the API returned no thinking text. */
  thinking?: { deltas: number; chars: number }
}

export interface TraceSurface {
  lines: number
  /** Count per operation (`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`, ...). */
  ops: Record<string, number>
  components: number
  /** Count per component type the shipped `updateComponents` lines carried (`Text`, `Row`, ...). */
  types: Record<string, number>
  surfaceIds: string[]
}

export interface TraceError {
  name: string
  message: string
  /** The upstream HTTP status, when the error is a provider's non-2xx answer. */
  status?: number
  /** The upstream response body as the adapter captured it. */
  body?: string
  /** A halt's validator failures. */
  failures?: TraceFailure[]
}

/** T-0239: one skill, workflow (playbook), resource or other capability entry the turn's context named.
 *  `index-only`: one index line in the persona section (`## Resources available to you`), no content.
 *  `full`: the entry's whole text, framed under `## Referenced for this message` in this turn's user
 *  message (`via: message`) or an earlier user turn the session replays (`via: history`). */
export interface TraceReference {
  kind: string
  name: string
  load: 'full' | 'index-only'
  via: 'index' | 'message' | 'history'
}

/** T-0239: one composed system-prompt section; `stable` sections sit inside the cached prefix. */
export interface TraceSection {
  id: string
  chars: number
  cache: 'stable' | 'volatile'
}

/** T-0239: how the turn's context was routed. The catalog and references are known before the model call,
 *  so they are recorded on every outcome; `miniSkills`, `sections` and `cacheBoundary` come from produce()'s
 *  trace and are absent on a turn that threw before its final meta-line. */
export interface TraceRouting {
  catalog: { id: string; base: string; persona?: string; domains: string[] }
  references: TraceReference[]
  miniSkills?: string[]
  sections?: TraceSection[]
  cacheBoundary?: number
}

/** One line of `.agent-traces/YYYY-MM-DD.jsonl`. */
export interface AgentTraceLine {
  v: typeof TRACE_LINE_VERSION
  at: string
  ms: number
  route: TraceRoute
  agent?: string
  provider: string
  model: string
  effort?: string
  mode?: string
  catalogId?: string
  user: string
  outcome: TraceOutcome
  steps: TraceStep[]
  retries: TraceRetry[]
  rounds: TraceRound[]
  surface: TraceSurface
  usage?: TokenUsage
  trace?: Pick<TurnTrace, 'rounds' | 'healed' | 'failureCodes' | 'exemplarIds'> & { promptChars?: number; promptOver?: boolean }
  routing?: TraceRouting
  reply?: string
  warnings: string[]
  error?: TraceError
}

/** Per-field cap for raw text (a round's output, the reply, the user message): generous, never unbounded. */
export const TRACE_TEXT_CAP = 65_536
function cap(text: string, limit = TRACE_TEXT_CAP): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}\n[truncated ${text.length - limit} chars]`
}

const REDACTED = '[redacted]'
const KEY_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/g, REDACTED],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, REDACTED],
  [/\bAIza[0-9A-Za-z_-]{20,}/g, REDACTED],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, `$1${REDACTED}`],
  [/(x-api-key["']?\s*[:=]\s*["']?)[^\s"',}]{8,}/gi, `$1${REDACTED}`],
]

/** Replace every known secret value, then every key-shaped string, with `[redacted]`. */
export function redactSecrets(text: string, secrets: readonly string[] = []): string {
  let out = text
  for (const secret of secrets) if (secret.length >= 8) out = out.split(secret).join(REDACTED)
  for (const [pattern, replacement] of KEY_PATTERNS) out = out.replace(pattern, replacement)
  return out
}

/** The upstream status and body inside an adapter's error. The Anthropic adapter throws
 *  `anthropicProvider: upstream error <status>: <body>` on a non-2xx answer and `upstream error event`
 *  plus a dash and the frame on an SSE error frame; anything else yields `{}`. */
export function readUpstreamError(err: unknown): { status?: number; body?: string } {
  if (!(err instanceof Error)) return {}
  const http = /upstream error (\d{3})(?::\s*([\s\S]*))?$/.exec(err.message)
  if (http) return { status: Number(http[1]), ...(http[2] !== undefined ? { body: http[2] } : {}) }
  const frame = /upstream error event\s*\S?\s*([\s\S]*)$/.exec(err.message)
  if (frame) return { body: frame[1] }
  return {}
}

/** The provider's own error sentence inside a JSON body (`{"error":{"message":"invalid x-api-key"}}`). */
function upstreamMessage(body: string | undefined): string | undefined {
  if (body === undefined) return undefined
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown }
    const msg = parsed.error?.message ?? parsed.message
    return typeof msg === 'string' ? msg : undefined
  } catch {
    return undefined
  }
}

/** The dev-only failure reason the chat shows after the generic line: `upstream 401: invalid x-api-key`
 *  for a provider error (the status and the provider's own sentence, never the raw body), else the error's
 *  name and message. Redacted and capped. The production host (the Worker) never calls this. */
export function devFailureReason(err: unknown, secrets: readonly string[] = []): string {
  const { status, body } = readUpstreamError(err)
  let reason: string
  if (status !== undefined) {
    const msg = upstreamMessage(body)
    reason = `upstream ${status}${msg !== undefined ? `: ${msg}` : ''}`
  } else if (body !== undefined) {
    reason = `upstream error event: ${upstreamMessage(body) ?? 'see the trace log'}`
  } else if (err instanceof Error) {
    reason = `${err.name}: ${err.message}`
  } else {
    reason = String(err)
  }
  return redactSecrets(reason, secrets).slice(0, 300)
}

/** The agent label for a turn: an explicit `agent` string on the request body (capped), else the persona
 *  segment of a derived catalog id (`agent-ui--croupier` is `croupier`), else absent. */
export function agentLabel(bodyAgent: unknown, catalogId: unknown): string | undefined {
  if (typeof bodyAgent === 'string' && bodyAgent.trim() !== '') return bodyAgent.trim().slice(0, 80)
  if (typeof catalogId === 'string' && catalogId.includes('--')) return catalogId.slice(catalogId.indexOf('--') + 2)
  return undefined
}

const PERSONA_IDS: ReadonlySet<string> = new Set(SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => m.personaId))

/** T-0239: the effective catalog id read as base, persona and domains (`agent-ui--croupier` is the
 *  croupier persona on `agent-ui`; `agent-ui--games+hospitality` two domains). */
export function catalogRouting(catalogId: string): TraceRouting['catalog'] {
  const parsed = parseDomainCatalogId(catalogId)
  if (parsed === undefined) return { id: catalogId, base: catalogId.split('--')[0]!, domains: [] }
  const [only] = parsed.domains
  if (parsed.domains.length === 1 && only !== undefined && PERSONA_IDS.has(only)) return { id: catalogId, base: parsed.base, persona: only, domains: [] }
  return { id: catalogId, base: parsed.base, domains: [...parsed.domains] }
}

/** The agent-admin capability group headings (`agent-admin.ts` `liveHeading`) and the entry kind of each. */
const INDEX_HEADING_KINDS: Record<string, string> = {
  Skills: 'skill',
  Workflows: 'workflow',
  Resources: 'resource',
  Tools: 'tool',
  'Pattern sources': 'pattern-source',
  Catalogs: 'catalog',
}

/** T-0239: the index lines a composed persona section carries (`entries.ts` `composeLiveSystemPrompt`):
 *  `- label` or `- label <em dash> description` under a `## <Kind> available to you` heading. Names only. */
export function indexedReferences(personaSystem: string): TraceReference[] {
  const out: TraceReference[] = []
  let kind: string | undefined
  for (const line of personaSystem.split('\n')) {
    const heading = /^## (.+) available to you$/.exec(line)
    if (heading) {
      kind = INDEX_HEADING_KINDS[heading[1]!] ?? heading[1]!.toLowerCase()
      continue
    }
    if (kind === undefined) continue
    const item = /^- (.+?)(?: \u2014 .*)?$/.exec(line)
    if (item) out.push({ kind, name: item[1]!.trim(), load: 'index-only', via: 'index' })
    else kind = undefined
  }
  return out
}

const FRAMED_HEADING = '## Referenced for this message\n'

/** T-0239: the entries framed whole into one user message (`entries.ts` `resolveTurnReferences`):
 *  each `### label (kind)` block heading under `## Referenced for this message`. Names only. */
export function framedReferences(text: string, via: 'message' | 'history'): TraceReference[] {
  const at = text.indexOf(FRAMED_HEADING)
  if (at === -1) return []
  const out: TraceReference[] = []
  for (const m of text.slice(at).matchAll(/^### (.+) \((skill|workflow|resource)\)$/gm)) out.push({ kind: m[2]!, name: m[1]!.trim(), load: 'full', via })
  return out
}

/** The plain-words reading of one failure. IDGRAPH paths are the validator's own shapes
 *  (`renderer/validate.ts`): `<surface>:root-missing`, `<surface>:root`, `<surface>:cycle`,
 *  `<surface>:update-after-delete`, and `<component>-><child>` for a dangling reference. */
export function describeFailure(f: { code: string; path: string; detail?: string }): string {
  let text: string
  if (f.code === 'IDGRAPH') {
    const ref = /^(.+)->(.+)$/.exec(f.path)
    const sid = /^(.+):(root-missing|root|cycle|update-after-delete)$/.exec(f.path)
    if (ref) text = `component "${ref[1]}" references "${ref[2]}", which no component in the payload or the session defines (dangling id)`
    else if (sid?.[2] === 'root-missing') text = `surface "${sid[1]}" has no component with id "root"`
    else if (sid?.[2] === 'root') text = `surface "${sid[1]}" receives "root" twice (two roots in one payload, or a root resent as another component type)`
    else if (sid?.[2] === 'cycle') text = `surface "${sid[1]}" has a cycle in its component tree`
    else if (sid?.[2] === 'update-after-delete') text = `surface "${sid[1]}" is updated after it was deleted`
    else text = `broken component tree at ${f.path || '(no path)'}`
  } else if (f.code === 'PARSE') {
    text = 'the payload did not parse as JSON lines'
  } else if (f.code === 'SURFACE_DROPPED') {
    text = `surface "${f.path}" was created by an earlier round of this turn and left out of this one (T-0172)`
  } else {
    text = f.path ? `at ${f.path}` : 'no path reported'
  }
  return `${f.code}: ${text}${f.detail ? ` (${f.detail})` : ''}`
}

/** The payload a round handed to validation: the `render_surface` tool's payload when the round called it
 *  (its `messages` as JSON lines, or the legacy `jsonl` string, T-0172), else the round's text. */
export function roundCandidate(round: Pick<TraceRound, 'text' | 'tools'>): string {
  const call = [...round.tools].reverse().find((t) => t.name === 'render_surface')
  const input = call?.input
  return input !== null && typeof input === 'object' ? renderSurfaceJsonl(input as Record<string, unknown>) : round.text
}

/** Where `candidate` stops parsing, the way produce() reads it: skip a leading meta-line, strip one outer
 *  code fence, then heal each non-empty line; the first line the healer rejects is reported with the JSON
 *  parser's own message. `undefined` when every line heals (the PARSE came from an empty payload). */
export function diagnoseParse(candidate: string): ParseDiagnosis | undefined {
  let body = candidate.trim()
  const fence = /^```(?:json|jsonl)?\s*\n?([\s\S]*?)\n?```$/.exec(body)
  if (fence) body = fence[1]!.trim()
  const lines = body.split('\n')
  let n = 0
  let metaSkipped = false
  for (const raw of lines) {
    const line = raw.trim()
    if (line === '' || /^```/.test(line)) continue
    if (!metaSkipped && readMetaLine(line) !== undefined) {
      metaSkipped = true
      continue
    }
    n += 1
    if (heal(line).ok) continue
    let message = 'unparseable'
    let column: number | undefined
    try {
      JSON.parse(line)
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
      const col = /column (\d+)/.exec(message)
      const pos = /position (\d+)/.exec(message)
      column = col ? Number(col[1]) : pos ? Number(pos[1]) + 1 : undefined
    }
    const at = (column ?? line.length) - 1
    const fragment = `${at > 40 ? '...' : ''}${line.slice(Math.max(0, at - 40), at + 40)}${at + 40 < line.length ? '...' : ''}`
    return { line: n, ...(column !== undefined ? { column } : {}), message, fragment }
  }
  return undefined
}

/** The plain-words account of one failed round, for the trace reader and the dev build's Validated step. */
export function failedRoundSummary(round: Pick<TraceRound, 'round' | 'failures' | 'parse'>): string[] {
  const out = [`Round ${round.round} failed:`]
  for (const f of round.failures ?? []) out.push(`  ${f.message ?? describeFailure(f)}`)
  if (round.parse !== undefined) {
    const p = round.parse
    out.push(`  parse error at payload line ${p.line}${p.column !== undefined ? `, column ${p.column}` : ''}: ${p.message}`)
    out.push(`  near: ${p.fragment}`)
  }
  return out
}

function addUsage(a: TokenUsage | undefined, b: TokenUsage): TokenUsage {
  if (a === undefined) return { ...b }
  const sum: TokenUsage = { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens }
  if (a.cacheReadInputTokens !== undefined || b.cacheReadInputTokens !== undefined)
    sum.cacheReadInputTokens = (a.cacheReadInputTokens ?? 0) + (b.cacheReadInputTokens ?? 0)
  if (a.cacheCreationInputTokens !== undefined || b.cacheCreationInputTokens !== undefined)
    sum.cacheCreationInputTokens = (a.cacheCreationInputTokens ?? 0) + (b.cacheCreationInputTokens ?? 0)
  return sum
}

function toFailures(list: unknown): TraceFailure[] {
  if (!Array.isArray(list)) return []
  return list.map((f: { code?: unknown; path?: unknown; detail?: unknown }) => ({
    code: String(f.code),
    path: typeof f.path === 'string' ? f.path : '',
    ...(typeof f.detail === 'string' ? { detail: f.detail } : {}),
  }))
}

export interface TurnTraceStart {
  route: TraceRoute
  provider: string
  model: string
  user: string
  agent?: string
  effort?: string
  mode?: string
  catalogId?: string
}

/**
 * Collects one turn. The proxy feeds it the provider (`wrapProvider`), the repair seam (`onRepairRound`),
 * every line it writes to the client (`observeLine`) and the turn's end (`fail`, `reject`, `abort`,
 * `setReply`), then calls `finish()` once for the line.
 */
export class TurnTraceCollector {
  readonly #start: TurnTraceStart
  readonly #now: () => number
  readonly #t0: number
  readonly #at: string
  #steps: TraceStep[] = []
  #retries: TraceRetry[] = []
  #rounds: TraceRound[] = []
  #surface: TraceSurface = { lines: 0, ops: {}, components: 0, types: {}, surfaceIds: [] }
  #usage: TokenUsage | undefined
  #trace: TurnTrace | undefined
  #reply: string | undefined
  #replyDeltas = ''
  #error: TraceError | undefined
  #outcome: TraceOutcome | undefined
  #wireError: string | undefined
  #routing: Pick<TraceRouting, 'catalog' | 'references'> | undefined

  constructor(start: TurnTraceStart, now: () => number = Date.now) {
    this.#start = start
    this.#now = now
    this.#t0 = now()
    this.#at = new Date(this.#t0).toISOString()
  }

  /** A provider whose every `stream()` call is recorded as one round (the adapter's tool loop runs inside
   *  one call). Text, tool calls and usage are teed; every fragment, event and error still reaches the caller. */
  wrapProvider(provider: AgentProvider): AgentProvider {
    return {
      stream: (req) => this.#teeStream(provider, req),
    }
  }

  async *#teeStream(provider: AgentProvider, req: Parameters<AgentProvider['stream']>[0]): AsyncIterable<string> {
    const round: TraceRound = { round: this.#rounds.length + 1, ms: 0, text: '', tools: [] }
    this.#rounds.push(round)
    const started = this.#now()
    const onEvent = (ev: ProviderEvent): void => {
      if (ev.kind === 'usage' && ev.usage !== undefined) round.usage = addUsage(round.usage, ev.usage)
      if (ev.kind === 'thinking') {
        round.thinking ??= { deltas: 0, chars: 0 }
        round.thinking.deltas += 1
        round.thinking.chars += ev.text?.length ?? 0
      }
      req.onEvent?.(ev)
    }
    const executeTool = req.executeTool
    const wrapped = {
      ...req,
      onEvent,
      ...(executeTool !== undefined
        ? {
            executeTool: (name: string, input: Record<string, unknown>, signal?: AbortSignal) => {
              round.tools.push({ name, input })
              return executeTool(name, input, signal)
            },
          }
        : {}),
    }
    try {
      for await (const fragment of provider.stream(wrapped)) {
        round.text += fragment
        yield fragment
      }
    } catch (err) {
      round.error = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      round.ms = this.#now() - started
      round.text = cap(round.text)
    }
  }

  /** `ProduceOptions.onRepairRound`: records the failures that caused the retry and changes nothing.
   *  `ctx.round` is the round about to run, so the failures belong to the round before it. */
  readonly onRepairRound = (ctx: { round: number; failures: readonly { code: string; path: string }[] }): undefined => {
    const failures = toFailures(ctx.failures)
    this.#retries.push({ round: ctx.round, failures })
    this.#settleFailed(ctx.round - 1, failures)
    return undefined
  }

  /** Mark round `n` failed with `failures`, each with its plain-words message, and locate a PARSE. */
  #settleFailed(n: number, failures: TraceFailure[]): void {
    const round = this.#rounds[n - 1]
    if (round === undefined) return
    round.status = 'failed'
    round.failures = failures.map((f) => ({ ...f, message: describeFailure(f) }))
    if (failures.some((f) => f.code === 'PARSE')) {
      const parse = diagnoseParse(roundCandidate(round))
      if (parse !== undefined) round.parse = parse
    }
  }

  /** The dev build's enrichment of a `retry` progress line: the same line with `detail` set to the failed
   *  round's account (`failedRoundSummary`), so the Validated step can show why the round failed. Any
   *  other line, or a retry whose round is unknown, comes back unchanged. */
  enrichRetryLine(line: string, secrets: readonly string[] = []): string {
    const meta = readMetaLine(line)
    const p = meta?.a2uiMeta.progress
    if (p === undefined || p.stage !== 'retry' || p.round === undefined || p.detail !== undefined) return line
    const failed = this.#rounds[p.round - 2]
    if (failed?.failures === undefined) return line
    const detail = redactSecrets(failedRoundSummary(failed).join('\n'), secrets).slice(0, 4000)
    return JSON.stringify({ a2uiMeta: { progress: { ...p, detail } } })
  }

  /** One line the proxy wrote to the client: a meta-line (progress, text delta, the final note and trace,
   *  a terminal error) or an A2UI content line. */
  observeLine(line: string): void {
    const meta = readMetaLine(line)
    if (meta !== undefined) {
      const m = meta.a2uiMeta
      if (m.progress !== undefined) {
        const { stage, round, codes, detail } = m.progress
        this.#steps.push({
          ms: this.#now() - this.#t0,
          stage,
          ...(round !== undefined ? { round } : {}),
          ...(codes !== undefined ? { codes } : {}),
          ...(detail !== undefined ? { detail } : {}),
        })
      }
      if (m.textDelta !== undefined) this.#replyDeltas += m.textDelta
      if (m.note !== undefined) this.#reply = m.note
      if (m.trace !== undefined) {
        this.#trace = m.trace
        if (m.trace.usage !== undefined) this.#usage = m.trace.usage
      }
      if (m.error !== undefined) this.#wireError = m.error
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      return
    }
    if (typeof parsed !== 'object' || parsed === null) return
    this.#surface.lines += 1
    const msg = parsed as Record<string, unknown>
    const op = Object.keys(msg).find((k) => k !== 'version') ?? 'unknown'
    this.#surface.ops[op] = (this.#surface.ops[op] ?? 0) + 1
    const body = msg[op]
    if (typeof body === 'object' && body !== null) {
      const b = body as { surfaceId?: unknown; components?: unknown }
      if (typeof b.surfaceId === 'string' && !this.#surface.surfaceIds.includes(b.surfaceId)) this.#surface.surfaceIds.push(b.surfaceId)
      if (op === 'updateComponents' && Array.isArray(b.components)) {
        this.#surface.components += b.components.length
        for (const c of b.components as Array<{ component?: unknown }>) {
          const type = typeof c?.component === 'string' ? c.component : 'unknown'
          this.#surface.types[type] = (this.#surface.types[type] ?? 0) + 1
        }
      }
    }
  }

  /** T-0239: the host-known routing: the effective catalog, the persona section's index lines, and the
   *  entries framed whole into this message or an earlier user turn. Only names and kinds are kept. */
  noteRouting(catalogId: string, personaSystem: string | undefined, history: readonly unknown[] = []): void {
    const references = [
      ...indexedReferences(personaSystem ?? ''),
      ...framedReferences(this.#start.user, 'message'),
      ...history.flatMap((turn) => {
        const t = turn as { role?: unknown; content?: unknown } | null
        return t?.role === 'user' && typeof t.content === 'string' ? framedReferences(t.content, 'history') : []
      }),
    ]
    this.#routing = { catalog: catalogRouting(catalogId), references }
  }

  setReply(text: string): void {
    this.#reply = text
  }

  /** The turn threw. A `ProduceHalt` (the round bound exhausted) is a `halt`; anything else an `error`. */
  fail(err: unknown): void {
    const upstream = readUpstreamError(err)
    const name = err instanceof Error ? err.name : typeof err
    this.#error = {
      name,
      message: err instanceof Error ? err.message : String(err),
      ...upstream,
      ...(name === 'ProduceHalt' ? { failures: toFailures((err as { failures?: unknown }).failures) } : {}),
    }
    this.#outcome = name === 'ProduceHalt' ? 'halt' : 'error'
    // A halt's failures belong to the last round the provider ran.
    if (name === 'ProduceHalt' && this.#error.failures !== undefined) this.#settleFailed(this.#rounds.length, this.#error.failures)
  }

  /** The proxy answered without a model call (`status` 400 or 503, `error` the code it sent). */
  reject(status: number, error: string): void {
    this.#error = { name: 'Rejected', message: error, status }
    this.#outcome = 'rejected'
  }

  abort(): void {
    this.#outcome = 'aborted'
  }

  finish(): AgentTraceLine {
    const s = this.#start
    const usage = this.#usage ?? this.#rounds.reduce<TokenUsage | undefined>((acc, r) => (r.usage ? addUsage(acc, r.usage) : acc), undefined)
    const reply = this.#reply ?? (this.#replyDeltas !== '' ? this.#replyDeltas : undefined)
    const outcome = this.#outcome ?? (this.#wireError !== undefined ? 'halt' : 'ok')
    const error = this.#error ?? (this.#wireError !== undefined ? { name: 'WireError', message: this.#wireError } : undefined)
    const t = this.#trace
    const last = this.#rounds.at(-1)
    if (outcome === 'ok' && last !== undefined && last.status === undefined && last.error === undefined) last.status = 'passed'
    const warnings: string[] = []
    for (const r of this.#retries) {
      const codes = [...new Set(r.failures.map((f) => f.code))].join(', ') || 'no codes'
      warnings.push(`retried as round ${r.round}: ${codes}`)
    }
    if (t?.prompt?.over) warnings.push(`prompt over budget: ${t.prompt.total} > ${t.prompt.limit} chars`)
    if (t !== undefined && t.healed > 0) warnings.push(`healer corrected ${t.healed} line(s)`)
    for (const r of this.#rounds) if (r.error !== undefined && error === undefined) warnings.push(`round ${r.round}: ${r.error}`)
    const routing = this.#routingFor(t)
    return {
      v: TRACE_LINE_VERSION,
      at: this.#at,
      ms: this.#now() - this.#t0,
      route: s.route,
      ...(s.agent !== undefined ? { agent: s.agent } : {}),
      provider: s.provider,
      model: s.model,
      ...(s.effort !== undefined ? { effort: s.effort } : {}),
      ...(s.mode !== undefined ? { mode: s.mode } : {}),
      ...(s.catalogId !== undefined ? { catalogId: s.catalogId } : {}),
      user: cap(s.user),
      outcome,
      steps: this.#steps,
      retries: this.#retries,
      rounds: this.#rounds,
      surface: this.#surface,
      ...(usage !== undefined ? { usage } : {}),
      ...(t !== undefined
        ? {
            trace: {
              rounds: t.rounds,
              healed: t.healed,
              failureCodes: t.failureCodes,
              exemplarIds: t.exemplarIds,
              ...(t.prompt !== undefined ? { promptChars: t.prompt.total, promptOver: t.prompt.over } : {}),
            },
          }
        : {}),
      ...(routing !== undefined ? { routing } : {}),
      ...(reply !== undefined ? { reply: cap(reply) } : {}),
      warnings,
      ...(error !== undefined ? { error } : {}),
    }
  }

  /** The host-known routing plus what produce()'s trace adds; a section is stable while its end stays
   *  inside the cached prefix (the stable sections open the prompt, T-0206). */
  #routingFor(t: TurnTrace | undefined): TraceRouting | undefined {
    if (this.#routing === undefined) return undefined
    const routing: TraceRouting = { ...this.#routing }
    if (t?.miniSkillIds !== undefined) routing.miniSkills = [...t.miniSkillIds]
    if (t?.prompt !== undefined) {
      const boundary = t.cacheBoundary ?? 0
      let end = 0
      routing.sections = t.prompt.sections.map((s) => {
        end += s.chars
        return { id: s.id, chars: s.chars, cache: end <= boundary ? 'stable' : 'volatile' }
      })
    }
    if (t?.cacheBoundary !== undefined) routing.cacheBoundary = t.cacheBoundary
    return routing
  }
}

/** The JSON text of one trace line with every string value redacted. */
export function serializeTraceLine(line: AgentTraceLine, secrets: readonly string[] = []): string {
  return JSON.stringify(line, (_key, value: unknown) => (typeof value === 'string' ? redactSecrets(value, secrets) : value))
}

/** The day file a line lands in: `<dir>/YYYY-MM-DD.jsonl`, the UTC date of the turn start. */
export function traceFileFor(dir: string, line: AgentTraceLine): string {
  return join(dir, `${line.at.slice(0, 10)}.jsonl`)
}

/** Append one redacted line. Never throws: a full disk or a read-only tree must not fail a turn. */
export function appendTraceLine(dir: string, line: AgentTraceLine, secrets: readonly string[] = []): void {
  try {
    mkdirSync(dir, { recursive: true })
    appendFileSync(traceFileFor(dir, line), serializeTraceLine(line, secrets) + '\n')
  } catch (err) {
    console.warn(`agent trace: could not write ${dir}:`, err instanceof Error ? err.message : err)
  }
}

/** Whether the dev proxy should trace by default: on, unless the env flag turns it off or the code runs
 *  under Vitest (tests opt in explicitly with a temp dir, so a test run never writes into the tree). */
export function defaultTracing(env: Record<string, string | undefined>): boolean {
  return process.env['VITEST'] === undefined && tracesEnabled(env)
}
