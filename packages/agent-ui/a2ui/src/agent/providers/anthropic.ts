// anthropic.ts — LLD-C10 / SPEC-R11/N5: the Anthropic `AgentProvider` adapter, implemented THIS wave.
//
// Plain `fetch` only — no `@anthropic-ai/sdk`, no vendor dependency (SPEC-N1/N5, ADR-0073 clause 2).
// The SSE handling is split in two per the LLD §5 sketch:
//   - `parseAnthropicSSE` — PURE, fixture-tested (SPEC-R11 AC3): SSE event/data text → the model's
//     accumulated text fragments. No network; the code most likely to break on an upstream-contract
//     change is gated by a deterministic unit test (`src/live-agent/anthropic-sse.test.ts`).
//   - `stream` — IMPURE: the `fetch` + `ReadableStream` reader that feeds `parseAnthropicSSE`. Manual
//     live acceptance only (needs a real key + network); NOT a standing gate (SPEC-R3).
//
// Host-verified contract (SPEC §6, 2026-07-04): `POST /v1/messages`, headers `x-api-key` +
// `anthropic-version: 2023-06-01` + `content-type: application/json`, body `stream: true`. SSE shape:
// `message_start → content_block_start → content_block_delta(delta.type==="text_delta", text at
// delta.text)* → content_block_stop → message_delta → message_stop`; `ping`/`message_delta` are ignored;
// `event: error` is surfaced mid-stream (a distinguishable failure, not silently dropped). ADR-0146 F1:
// the lifecycle frames (`message_start`/`content_block_start`/`content_block_stop`/`message_stop`) and
// `thinking_delta`s — previously dropped — are now surfaced through the OPTIONAL `onEvent` callback, mapped
// to the provider-agnostic `ProviderEvent` kinds; the ACCUMULATED text (only `text_delta`) is unchanged.

import type { AgentProvider, Turn, Effort, ProviderEvent, ToolDef } from '../agent-transport.ts'

/** The Anthropic Messages API's per-provider request body (this module's private wire shape — never
 * exported past this adapter; the `AgentProvider` seam is the only public contract). `content` grew the
 * BLOCK form with GH #49's tool loop (tool_use/tool_result round-trips are block-typed on the wire);
 * plain-string content is unchanged for the text-only path. */
type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

/** GH #49 — the per-round tool-call collector `parseAnthropicSSE` fills when tools are active: block
 *  metadata from `content_block_start` (type tool_use), `input_json_delta` accumulation per block index,
 *  and `message_delta`'s stop_reason. PURE state, fixture-testable alongside the parser. */
export interface ToolUseCollector {
  calls: Array<{ id: string; name: string; inputJson: string }>
  /** block index → position in `calls` (deltas arrive keyed by index). */
  byIndex: Map<number, number>
  stopReason: string | undefined
}

export function newToolCollector(): ToolUseCollector {
  return { calls: [], byIndex: new Map(), stopReason: undefined }
}

/** A sentinel yielded (never thrown) when the upstream stream carries an `event: error` frame — an
 * observable, distinguishable failure a caller can detect (`fragment.startsWith(ERROR_SENTINEL_PREFIX)`)
 * without the parser's own iteration having to throw mid-generator. Kept as a plain string (not a class)
 * so it survives the same `Iterable<string>`/`AsyncIterable<string>` contract the rest of `stream()`
 * fragments ride — no special-cased "or throw" arm needed by callers that don't care.
 */
export const ANTHROPIC_SSE_ERROR_PREFIX = ' ANTHROPIC_SSE_ERROR '

/** One SSE frame: an `event:` line paired with its `data:` payload (the two-line shape Anthropic emits
 * per event, tolerant of blank-line-separated multi-event chunks). */
interface SseFrame {
  event: string
  data: string
}

/** Split raw SSE text into whole frames. Anthropic's stream separates events with a blank line; each
 * frame carries one `event: <name>` line and one or more `data: <json>` lines (multi-line data is
 * joined, matching the SSE spec's `data` accumulation rule) — tolerant of a chunk carrying several
 * frames, and of a frame's `data:` being empty (e.g. `ping`). Buffering assumption (documented per the
 * LLD's "otherwise document the buffering assumption"): this function assumes each CALL is handed a
 * complete set of whole frames (no event split mid-frame across two chunks) — `stream()` below satisfies
 * this by buffering partial trailing text across `fetch` reads before calling this function, so a frame
 * is only ever parsed once it's whole.
 */
function splitFrames(text: string): SseFrame[] {
  const frames: SseFrame[] = []
  const blocks = text.split('\n\n')
  for (const block of blocks) {
    if (block.trim().length === 0) continue
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim())
      }
      // any other SSE field (id:, retry:, a bare comment) is ignored — Anthropic's stream doesn't use them.
    }
    frames.push({ event, data: dataLines.join('\n') })
  }
  return frames
}

/**
 * PURE (SPEC-R11 AC3, fixture-tested): SSE chunk text → the accumulated model text fragments. Yields
 * `delta.text` for every `content_block_delta` event whose `delta.type === "text_delta"` — the text
 * accumulation is BYTE-IDENTICAL to before, whether or not `onEvent` is passed (a regression guard). The
 * lifecycle frames it used to silently DROP — `message_start`, `content_block_start`, `content_block_stop`,
 * `message_stop` — plus `thinking_delta`s are now surfaced through the OPTIONAL `onEvent` callback
 * (ADR-0146 F1): they are NEVER yielded as text (a `thinking` delta carries raw reasoning, kept off the
 * accumulated wire — `produce()` gates whether any of it is forwarded, F3). A caller passing NO `onEvent`
 * gets today's behaviour exactly. On `event: error` it yields ONE sentinel fragment
 * (`ANTHROPIC_SSE_ERROR_PREFIX + data`) rather than throwing — this keeps the function a plain generator
 * (no try/catch obligation on every caller) while still making the failure observable and distinguishable
 * from ordinary text (`stream()` below checks the prefix and throws/reports from there).
 */
export function* parseAnthropicSSE(chunk: string, onEvent?: (ev: ProviderEvent) => void, tools?: ToolUseCollector): Iterable<string> {
  for (const frame of splitFrames(chunk)) {
    if (frame.event === 'error') {
      yield ANTHROPIC_SSE_ERROR_PREFIX + frame.data
      continue
    }
    // Lifecycle frames → onEvent (ADR-0146 F1). No text is yielded for any of these; content still flows
    // ONLY from `content_block_delta`'s `text_delta` below, so the accumulated model output is unchanged.
    if (frame.event === 'message_start') {
      onEvent?.({ kind: 'message_start' })
      continue
    }
    if (frame.event === 'content_block_start') {
      onEvent?.({ kind: 'block_start' })
      // GH #49 — a tool_use block opening: capture id/name at the block's index so the input_json_delta
      // accumulation below has a home. Ignored entirely when no collector rides the request.
      if (tools) {
        const parsedStart = safeJson(frame.data)
        const block = (parsedStart as { index?: number; content_block?: { type?: string; id?: string; name?: string } } | null)
        if (block?.content_block?.type === 'tool_use' && typeof block.index === 'number' && block.content_block.id && block.content_block.name) {
          tools.byIndex.set(block.index, tools.calls.length)
          tools.calls.push({ id: block.content_block.id, name: block.content_block.name, inputJson: '' })
        }
      }
      continue
    }
    if (frame.event === 'content_block_stop') {
      onEvent?.({ kind: 'block_stop' })
      continue
    }
    if (frame.event === 'message_delta') {
      // Previously ignored wholesale; GH #49 needs its stop_reason ('tool_use' drives the loop).
      if (tools) {
        const parsedDelta = safeJson(frame.data) as { delta?: { stop_reason?: unknown } } | null
        if (typeof parsedDelta?.delta?.stop_reason === 'string') tools.stopReason = parsedDelta.delta.stop_reason
      }
      continue
    }
    if (frame.event === 'message_stop') {
      onEvent?.({ kind: 'done' })
      continue
    }
    if (frame.event !== 'content_block_delta') continue
    if (frame.data.length === 0) continue

    const parsed = safeJson(frame.data)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'delta' in parsed &&
      typeof (parsed as { delta: unknown }).delta === 'object' &&
      (parsed as { delta: unknown }).delta !== null
    ) {
      const delta = (parsed as { delta: { type?: unknown; text?: unknown; thinking?: unknown; partial_json?: unknown } }).delta
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        yield delta.text
      } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        // Raw chain-of-thought — surfaced as a lifecycle event, NEVER yielded onto the accumulated wire.
        onEvent?.({ kind: 'thinking', text: delta.thinking })
      } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string' && tools) {
        // GH #49 — a tool call's argument JSON, streamed in fragments keyed by block index.
        const at = (parsed as { index?: number }).index
        const slot = typeof at === 'number' ? tools.byIndex.get(at) : undefined
        if (slot !== undefined) tools.calls[slot]!.inputJson += delta.partial_json
      }
    }
  }
}

/** JSON.parse that answers null instead of throwing — a malformed data line is not this parser's
 *  failure to report (the pre-#49 inline try/catch, factored once). */
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** `Turn[]` → the Anthropic Messages-API array. `system` is NOT a message here — it is Anthropic's
 * top-level `system` request param (SPEC §5's mapping note); this only maps the `user`/`assistant` turns. */
function toAnthropicMessages(turns: Turn[]): AnthropicMessage[] {
  return turns.map((t) => ({ role: t.role, content: t.content }))
}

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MAX_TOKENS = 4096 // a sane cap (LLD §5) — not a modeled/config value, just a runaway-response guard

/** `effort` → Anthropic's real extended-thinking `budget_tokens` — the PRE-4.6 Messages-API shape,
 *  applied ONLY to the models that still accept it (Haiku 4.5, the one pre-4.6 family in
 *  providers.json). Current families REJECT it — see the branch note in `buildRequestBody`. */
const THINKING_BUDGET: Record<Exclude<Effort, 'low'>, number> = {
  medium: 1024,
  high: 2048,
  xhigh: 4096,
}
/** Anthropic requires `max_tokens > thinking.budget_tokens` — this is the room left for the actual reply
 *  BEYOND the thinking budget, not a config knob. */
const REPLY_HEADROOM = 2048

/** A model that still takes the LEGACY extended-thinking shape (`{type:'enabled', budget_tokens}`).
 *  TKT-0075 (API truth, measured 2026-07-16): the Claude 5-family + Opus 4.7/4.8 REJECT budget_tokens
 *  with a 400 (`temperature`-style parameter removal); they take `thinking: {type:'adaptive'}` +
 *  `output_config: {effort}` instead. Haiku 4.5 is the one served model still on the legacy shape —
 *  and `output_config.effort` ERRORS there, so the two arms are mutually exclusive by API design. */
const takesLegacyThinkingBudget = (model: string): boolean => /haiku/.test(model)

/** The Anthropic Messages-API request BODY, PURE (SPEC-R11 AC3, fixture-tested — the `parseAnthropicSSE`
 *  precedent, this file's OTHER extracted-for-testability seam): `effort` → thinking/effort params, with
 *  no network/key involved. The impure `stream()` below is the ONLY caller; kept exported so the mapping
 *  itself is directly testable without a live key. */
export function buildRequestBody(req: {
  model: string
  system: string
  messages: Turn[]
  effort?: Effort
  /** GH #49 — tool declarations (present ⇒ the body carries `tools`) and the tool-loop's follow-up
   *  messages (assistant tool_use + user tool_result rounds), appended AFTER the mapped turns. */
  tools?: readonly ToolDef[]
  extraMessages?: readonly AnthropicMessage[]
}): Record<string, unknown> {
  const base = {
    model: req.model,
    system: req.system,
    messages: [...toAnthropicMessages(req.messages), ...(req.extraMessages ?? [])],
    stream: true,
    ...(req.tools && req.tools.length > 0 ? { tools: req.tools } : {}),
  }
  // 'low' (or unset) ⇒ no thinking/effort params at all — the exact pre-Effort request shape on every
  // model, never a behavior change for a caller that predates the dial. (On the Claude 5 family this
  // means adaptive thinking runs at ITS default; we deliberately send nothing rather than
  // `{type:'disabled'}`, which Fable 5 rejects.)
  if (req.effort === undefined || req.effort === 'low') {
    return { ...base, max_tokens: MAX_TOKENS }
  }
  if (takesLegacyThinkingBudget(req.model)) {
    // Pre-4.6 arm (Haiku 4.5): the legacy budget shape, max_tokens strictly above the budget.
    const budget = THINKING_BUDGET[req.effort]
    return {
      ...base,
      max_tokens: budget + REPLY_HEADROOM,
      thinking: { type: 'enabled', budget_tokens: budget },
    }
  }
  // Current-family arm (Fable 5 / Sonnet 5 / Opus 4.8+): adaptive thinking + the effort dial.
  // budget_tokens returns a 400 here (TKT-0075's silent-empty bug); adaptive is legal on ALL of them
  // (Fable 5: "omit or adaptive"). Effort vocabulary maps 1:1 (low/medium/high/xhigh are all real API
  // values). max_tokens gets the same headroom bump the legacy arm used at the equivalent tier, so the
  // reply room does not shrink with the migration.
  return {
    ...base,
    max_tokens: THINKING_BUDGET[req.effort] + REPLY_HEADROOM,
    thinking: { type: 'adaptive' },
    output_config: { effort: req.effort },
  }
}

/**
 * The Anthropic `AgentProvider` factory (ADR-0073). The key is passed IN (`opts.apiKey`), never read at
 * module scope — the same adapter instance shape serves the proxy (server-side key) and any future
 * client-direct overlay unchanged.
 */
/** GH #49 — the tool-loop's round cap: a runaway model calling tools forever is cut off here; the text
 *  accumulated so far still flows (a degraded ANSWER, never a hung turn). */
const MAX_TOOL_ROUNDS = 4
/** PR #59 review — the PER-ROUND fan-out cap: one round may emit arbitrarily many tool_use blocks
 *  within its token budget, and every one fired a concurrent upstream fetch. Only the first N execute;
 *  the REST still get a (capped-error) tool_result — Anthropic requires every tool_use id to be paired —
 *  so total outbound work is bounded at MAX_TOOL_ROUNDS × MAX_CALLS_PER_ROUND. */
const MAX_CALLS_PER_ROUND = 4

/**
 * Ticket #1634 — `/status` today only checks the env var is a non-empty string, never that it actually
 * authenticates, so a revoked/invalid key still reads "available" until a real chat turn fails (masked).
 * `GET /v1/models` is the cheapest live check Anthropic's API offers: no completion, no token cost, just
 * confirms the key authenticates. The models URL is derived from the SAME registry-authoritative
 * `endpoint` `stream()` takes (never a second hardcoded origin) by swapping the trailing `/messages` for
 * `/models`. A 401/403 is the only definitive "this key is bad" signal — any other outcome (200, an
 * unexpected status, a network fault reaching the check itself) fails OPEN, matching the non-empty-string
 * check's own permissive posture: this is a dev-experience signal, not a security gate, and a hiccup in
 * the CHECK is not evidence the KEY is bad.
 */
export async function validateAnthropicKey(apiKey: string, endpoint: string = DEFAULT_ENDPOINT): Promise<boolean> {
  const modelsUrl = endpoint.replace(/\/messages$/, '/models')
  try {
    const res = await fetch(modelsUrl, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } })
    return res.status !== 401 && res.status !== 403
  } catch {
    return true
  }
}

export function anthropicProvider(opts: { apiKey: string; endpoint?: string }): AgentProvider {
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT

  /** ONE upstream round as an async GENERATOR: POST the body, walk the SSE, yield text fragments AS THEY
   *  ARRIVE (the pre-#49 pass-through latency, load-bearing for ADR-0146's live progress), fill
   *  `collector` when tools are active. The GH #49 loop consumes it buffered; the text-only path yields
   *  it straight through. */
  async function* runRound(
    body: Record<string, unknown>,
    onEvent: ((ev: ProviderEvent) => void) | undefined,
    signal: AbortSignal | undefined,
    collector: ToolUseCollector | undefined,
  ): AsyncIterable<string> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      // TKT-0075: a non-200 carries a JSON error body, NOT an SSE stream — without this guard it
      // parsed as zero frames and the caller returned a silent EMPTY reply. Surface the upstream
      // error so the turn FAILS visibly (the conversation's ⚠ fail path).
      let detail = `${res.status}`
      try {
        detail = `${res.status}: ${(await res.text()).slice(0, 500)}`
      } catch {
        /* unreadable body — keep the bare status */
      }
      throw new Error(`anthropicProvider: upstream error ${detail}`)
    }
    if (res.body === null) {
      throw new Error('anthropicProvider: response carried no body to stream')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // try/finally so an early consumer break or a thrown upstream-error frame still releases the reader
    // lock + cancels the underlying network stream — no dangling connection.
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Only hand `parseAnthropicSSE` whole frames (the buffering assumption documented above): split
        // on the LAST blank-line boundary, parse everything before it, keep the remainder (which may be
        // a still-arriving partial frame) buffered for the next read.
        const lastBoundary = buffer.lastIndexOf('\n\n')
        if (lastBoundary === -1) continue
        const complete = buffer.slice(0, lastBoundary)
        buffer = buffer.slice(lastBoundary + 2)
        for (const fragment of parseAnthropicSSE(complete, onEvent, collector)) {
          if (fragment.startsWith(ANTHROPIC_SSE_ERROR_PREFIX)) {
            throw new Error(`anthropicProvider: upstream error event — ${fragment.slice(ANTHROPIC_SSE_ERROR_PREFIX.length)}`)
          }
          yield fragment
        }
      }

      // Flush any trailing complete-but-unterminated buffer (a stream that ends without a final blank line).
      if (buffer.trim().length > 0) {
        for (const fragment of parseAnthropicSSE(buffer, onEvent, collector)) {
          if (fragment.startsWith(ANTHROPIC_SSE_ERROR_PREFIX)) {
            throw new Error(`anthropicProvider: upstream error event — ${fragment.slice(ANTHROPIC_SSE_ERROR_PREFIX.length)}`)
          }
          yield fragment
        }
      }
    } finally {
      await reader.cancel().catch(() => {})
    }
  }

  return {
    async *stream(req) {
      const useTools = (req.tools?.length ?? 0) > 0 && req.executeTool !== undefined

      if (!useTools) {
        // The pre-#49 path, byte-identical: ONE round, live pass-through streaming, no collector.
        yield* runRound(buildRequestBody(req), req.onEvent, req.signal, undefined)
        return
      }

      // GH #49 — the bounded tool loop. Each round's TEXT is buffered and flushed ONLY when the round
      // ends withOUT stop_reason 'tool_use': intermediate scratch prose ("checking the weather…") never
      // reaches the accumulated wire the A2UI producer validates — only the post-tools round's real
      // output flows. The buffered text still travels back to the model as the assistant turn's text
      // block, so the model keeps its own context.
      const extra: AnthropicMessage[] = []
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const collector = newToolCollector()
        const roundText: string[] = []
        const body = buildRequestBody({ ...req, tools: req.tools, extraMessages: extra })
        for await (const fragment of runRound(body, req.onEvent, req.signal, collector)) roundText.push(fragment)

        const wantsTools = collector.stopReason === 'tool_use' && collector.calls.length > 0 && round < MAX_TOOL_ROUNDS
        if (!wantsTools) {
          yield* roundText
          return
        }

        // Execute every call (parallel — integrations are independent fetches); a rejection becomes an
        // is_error tool_result the model can react to, never a thrown turn (the ExecuteTool contract).
        const results = await Promise.all(
          collector.calls.map(async (call, at) => {
            // The fan-out cap (PR #59 review): calls past the per-round ceiling are NOT executed —
            // they answer with a capped-error result (the pairing law: every id gets a tool_result).
            if (at >= MAX_CALLS_PER_ROUND) {
              return { call, content: `tool-call cap reached (${MAX_CALLS_PER_ROUND}/round) — consolidate calls or continue without this one`, isError: true }
            }
            req.onEvent?.({ kind: 'tool', text: call.name })
            let input: Record<string, unknown> = {}
            try {
              input = call.inputJson.trim().length > 0 ? (JSON.parse(call.inputJson) as Record<string, unknown>) : {}
            } catch {
              return { call, content: `tool input was not valid JSON: ${call.inputJson.slice(0, 200)}`, isError: true }
            }
            try {
              // The turn's abort signal rides into the executor (PR #59 review) — an aborted turn also
              // cancels in-flight tool network work, not just the next round's fetch.
              return { call, content: await req.executeTool!(call.name, input, req.signal), isError: false }
            } catch (err) {
              return { call, content: `tool failed: ${err instanceof Error ? err.message : String(err)}`, isError: true }
            }
          }),
        )

        const assistantBlocks: AnthropicContentBlock[] = [
          ...(roundText.join('').trim().length > 0 ? [{ type: 'text' as const, text: roundText.join('') }] : []),
          ...results.map(({ call }) => {
            let input: Record<string, unknown> = {}
            try {
              input = call.inputJson.trim().length > 0 ? (JSON.parse(call.inputJson) as Record<string, unknown>) : {}
            } catch {
              /* unparseable input already reported via the is_error result — echo an empty object */
            }
            return { type: 'tool_use' as const, id: call.id, name: call.name, input }
          }),
        ]
        extra.push({ role: 'assistant', content: assistantBlocks })
        extra.push({
          role: 'user',
          content: results.map(({ call, content, isError }) => ({
            type: 'tool_result' as const,
            tool_use_id: call.id,
            content,
            ...(isError ? { is_error: true } : {}),
          })),
        })
      }
    },
  }
}
