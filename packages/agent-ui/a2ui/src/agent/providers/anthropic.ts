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
// T-0031: in a tool round the optional `ToolUseCollector` also logs the thinking blocks (text, signature) so the
// tool loop sends them back unmodified with the tool results; that replay is request-side only.

import type { AgentProvider, Turn, Effort, ProviderEvent, ToolDef } from '../agent-transport.ts'
import type { TokenUsage } from '../meta-line.ts'
import { AgentTimeoutError } from '../deadlines.ts'

/** The Anthropic Messages API's per-provider request body (this module's private wire shape — never
 * exported past this adapter; the `AgentProvider` seam is the only public contract). `content` grew the
 * BLOCK form with GH #49's tool loop (tool_use/tool_result round-trips are block-typed on the wire);
 * plain-string content is unchanged for the text-only path. */
type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'redacted_thinking'; data: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

/** T-0031: one content block of a tool round, in the order the API sent it. The assistant turn that carries
 *  the round's `tool_use` blocks back is rebuilt from this log, so the thinking blocks travel with their
 *  signatures, unmodified and in place (Haiku 5.5 / Sonnet 5 migration guide: pass `thinking` blocks back
 *  unmodified with tool results; reordering or dropping one edits the prefix of every later turn). `thinking`
 *  may be empty, since Haiku 5.5 returns only a `signature` by default; the block is still kept. `tool_use`
 *  points into `ToolUseCollector.calls`. */
export type RoundBlock =
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'redacted_thinking'; data: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; call: number }

/** GH #49 — the per-round tool-call collector `parseAnthropicSSE` fills when tools are active: block
 *  metadata from `content_block_start` (type tool_use), `input_json_delta` accumulation per block index,
 *  and `message_delta`'s stop_reason. T-0031 adds `blocks`, the round's whole content in arrival order
 *  (see `RoundBlock`); it stays request-side, never yielded and never an event. PURE state, fixture-testable
 *  alongside the parser. */
export interface ToolUseCollector {
  calls: Array<{ id: string; name: string; inputJson: string }>
  /** block index → position in `calls` (deltas arrive keyed by index). */
  byIndex: Map<number, number>
  /** T-0031: every content block of the round in arrival order. */
  blocks: RoundBlock[]
  /** T-0031: block index → position in `blocks`. */
  blockAt: Map<number, number>
  stopReason: string | undefined
}

export function newToolCollector(): ToolUseCollector {
  return { calls: [], byIndex: new Map(), blocks: [], blockAt: new Map(), stopReason: undefined }
}

/** Append a block to the round's log, keyed by its stream index when it has one. */
function openBlock(tools: ToolUseCollector, index: number | undefined, block: RoundBlock): void {
  if (index !== undefined) tools.blockAt.set(index, tools.blocks.length)
  tools.blocks.push(block)
}

/** The `thinking` or `text` block a delta targets: by stream index, or the latest block when the frame
 *  carries none. A delta whose `content_block_start` never arrived opens a block of its own. */
function blockFor<T extends 'thinking' | 'text'>(
  tools: ToolUseCollector,
  index: number | undefined,
  type: T,
): Extract<RoundBlock, { type: T }> {
  const at = index === undefined ? tools.blocks.length - 1 : (tools.blockAt.get(index) ?? -1)
  const found = tools.blocks[at]
  if (found?.type === type) return found as Extract<RoundBlock, { type: T }>
  const fresh = (type === 'thinking' ? { type, thinking: '', signature: '' } : { type, text: '' }) as Extract<RoundBlock, { type: T }>
  openBlock(tools, index, fresh)
  return fresh
}

/** ADR-0234 (proposed): the per-request token-usage collector `parseAnthropicSSE` fills when one is
 *  passed. Separate from `ToolUseCollector`, which stays byte-quiet. `usage` stays undefined until a
 *  `message_start` or `message_delta` frame carries a usage object. PURE state, fixture-testable. */
export interface UsageCollector {
  usage: Partial<TokenUsage> | undefined
}

export function newUsageCollector(): UsageCollector {
  return { usage: undefined }
}

/** Anthropic's snake_case usage fields → the camelCase `TokenUsage` keys. */
const USAGE_FIELDS: ReadonlyArray<readonly [string, keyof TokenUsage]> = [
  ['input_tokens', 'inputTokens'],
  ['output_tokens', 'outputTokens'],
  ['cache_read_input_tokens', 'cacheReadInputTokens'],
  ['cache_creation_input_tokens', 'cacheCreationInputTokens'],
]

/** Merge one upstream usage object into the collector: each numeric field present overrides (the
 *  `message_delta` counts are cumulative, so the latest value wins). A non-object is ignored. */
function mergeUsage(collector: UsageCollector, raw: unknown): void {
  if (typeof raw !== 'object' || raw === null) return
  const next: Partial<TokenUsage> = { ...collector.usage }
  for (const [wire, key] of USAGE_FIELDS) {
    const v = (raw as Record<string, unknown>)[wire]
    if (typeof v === 'number' && Number.isFinite(v)) next[key] = v
  }
  collector.usage = next
}

/** The collected usage as a `TokenUsage` (input/output default to 0 when the upstream never sent them;
 *  the optional cache fields appear only when sent). */
function finishedUsage(u: Partial<TokenUsage>): TokenUsage {
  return {
    inputTokens: u.inputTokens ?? 0,
    outputTokens: u.outputTokens ?? 0,
    ...(u.cacheReadInputTokens !== undefined ? { cacheReadInputTokens: u.cacheReadInputTokens } : {}),
    ...(u.cacheCreationInputTokens !== undefined ? { cacheCreationInputTokens: u.cacheCreationInputTokens } : {}),
  }
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
 *
 * ADR-0234 (proposed): with the OPTIONAL `usage` collector, `message_start.message.usage` seeds the
 * token counts and each `message_delta.usage` overrides the fields it carries (cumulative, latest wins).
 * At `message_stop` it emits ONE `{kind:'usage'}` event immediately before `done`, only when a collector
 * was passed and a usage object was seen. Without the fourth argument the event sequence is unchanged.
 */
export function* parseAnthropicSSE(
  chunk: string,
  onEvent?: (ev: ProviderEvent) => void,
  tools?: ToolUseCollector,
  usage?: UsageCollector,
): Iterable<string> {
  for (const frame of splitFrames(chunk)) {
    if (frame.event === 'error') {
      yield ANTHROPIC_SSE_ERROR_PREFIX + frame.data
      continue
    }
    // Lifecycle frames → onEvent (ADR-0146 F1). No text is yielded for any of these; content still flows
    // ONLY from `content_block_delta`'s `text_delta` below, so the accumulated model output is unchanged.
    if (frame.event === 'message_start') {
      if (usage) mergeUsage(usage, (safeJson(frame.data) as { message?: { usage?: unknown } } | null)?.message?.usage)
      onEvent?.({ kind: 'message_start' })
      continue
    }
    if (frame.event === 'content_block_start') {
      onEvent?.({ kind: 'block_start' })
      // GH #49 — a tool_use block opening: capture id/name at the block's index so the input_json_delta
      // accumulation below has a home. Ignored entirely when no collector rides the request.
      // T-0031: the same collector logs the round's other blocks in arrival order (`RoundBlock`).
      if (tools) {
        const parsedStart = safeJson(frame.data)
        const block = (parsedStart as {
          index?: number
          content_block?: { type?: string; id?: string; name?: string; thinking?: string; signature?: string; data?: string }
        } | null)
        const index = typeof block?.index === 'number' ? block.index : undefined
        const started = block?.content_block
        if (started?.type === 'tool_use' && index !== undefined && started.id && started.name) {
          tools.byIndex.set(index, tools.calls.length)
          openBlock(tools, index, { type: 'tool_use', call: tools.calls.length })
          tools.calls.push({ id: started.id, name: started.name, inputJson: '' })
        } else if (started?.type === 'thinking') {
          openBlock(tools, index, {
            type: 'thinking',
            thinking: typeof started.thinking === 'string' ? started.thinking : '',
            signature: typeof started.signature === 'string' ? started.signature : '',
          })
        } else if (started?.type === 'redacted_thinking' && typeof started.data === 'string') {
          openBlock(tools, index, { type: 'redacted_thinking', data: started.data })
        } else if (started?.type === 'text') {
          openBlock(tools, index, { type: 'text', text: '' })
        }
      }
      continue
    }
    if (frame.event === 'content_block_stop') {
      onEvent?.({ kind: 'block_stop' })
      continue
    }
    if (frame.event === 'message_delta') {
      // Previously ignored wholesale; GH #49 needs its stop_reason ('tool_use' drives the loop), and
      // ADR-0234 its cumulative usage.
      if (tools || usage) {
        const parsedDelta = safeJson(frame.data) as { delta?: { stop_reason?: unknown }; usage?: unknown } | null
        if (tools && typeof parsedDelta?.delta?.stop_reason === 'string') tools.stopReason = parsedDelta.delta.stop_reason
        if (usage) mergeUsage(usage, parsedDelta?.usage)
      }
      continue
    }
    if (frame.event === 'message_stop') {
      if (usage?.usage !== undefined) onEvent?.({ kind: 'usage', usage: finishedUsage(usage.usage) })
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
      const delta = (parsed as { delta: { type?: unknown; text?: unknown; thinking?: unknown; signature?: unknown; partial_json?: unknown } }).delta
      const at = (parsed as { index?: unknown }).index
      const blockIndex = typeof at === 'number' ? at : undefined
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        if (tools) blockFor(tools, blockIndex, 'text').text += delta.text
        yield delta.text
      } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        // T-0031: the collector keeps the text for the tool-loop replay (request-side only).
        if (tools) blockFor(tools, blockIndex, 'thinking').thinking += delta.thinking
        // Raw chain-of-thought — surfaced as a lifecycle event, NEVER yielded onto the accumulated wire.
        onEvent?.({ kind: 'thinking', text: delta.thinking })
      } else if (delta.type === 'signature_delta' && typeof delta.signature === 'string') {
        // T-0031: the signature that makes a thinking block replayable; collector only, never an event.
        if (tools) blockFor(tools, blockIndex, 'thinking').signature += delta.signature
      } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string' && tools) {
        // GH #49 — a tool call's argument JSON, streamed in fragments keyed by block index.
        const slot = blockIndex !== undefined ? tools.byIndex.get(blockIndex) : undefined
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

/** Peer report (T-0034): on Haiku 5.5 with forced tool_use an object-typed input field can arrive as a JSON
 *  string. Where the tool's `input_schema` declares the field `type: 'object'` and the value is a string,
 *  parse it to an object; a string that does not parse to a plain object answers an error naming the field.
 *  Only object-typed fields are touched. */
export function coerceObjectFields(
  input: Record<string, unknown>,
  schema: Record<string, unknown> | undefined,
): { input: Record<string, unknown> } | { error: string } {
  const props = (schema?.properties ?? {}) as Record<string, { type?: unknown } | undefined>
  let out = input
  for (const [field, def] of Object.entries(props)) {
    const value = input[field]
    if (def?.type !== 'object' || typeof value !== 'string') continue
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = undefined
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: `tool input field "${field}" must be an object but arrived as a string that is not a JSON object: ${value.slice(0, 200)}` }
    }
    out = { ...out, [field]: parsed }
  }
  return { input: out }
}

/** The `input` JSON a tool call streamed, parsed; `{}` for empty or unparseable input (the unparseable case
 *  is already reported to the model through its `is_error` tool_result, so the echoed block stays well formed). */
function parseToolInput(inputJson: string): Record<string, unknown> {
  if (inputJson.trim().length === 0) return {}
  try {
    return JSON.parse(inputJson) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** T-0031: the assistant turn that carries a tool round's calls back to the model, rebuilt from the round's
 *  block log in the order the API sent it: `thinking` and `redacted_thinking` blocks with their signatures
 *  (the migration guide: pass them back unmodified with tool results), the round's text, the `tool_use`
 *  blocks with their parsed input. A `thinking` block is kept even when its `thinking` field is empty (Haiku
 *  5.5 returns only a signature by default; dropping it silently costs the model its earlier reasoning),
 *  but one whose signature never arrived is left out, because the API rejects an unsigned block with a 400
 *  and that would fail the turn. Whitespace-only text is left out too: the API rejects an empty text block. */
function assistantTurnBlocks(collector: ToolUseCollector): AnthropicContentBlock[] {
  const out: AnthropicContentBlock[] = []
  for (const block of collector.blocks) {
    if (block.type === 'tool_use') {
      const call = collector.calls[block.call]!
      out.push({ type: 'tool_use', id: call.id, name: call.name, input: parseToolInput(call.inputJson) })
    } else if (block.type === 'text') {
      if (block.text.trim().length > 0) out.push({ type: 'text', text: block.text })
    } else if (block.type === 'thinking') {
      if (block.signature.length > 0) out.push({ type: 'thinking', thinking: block.thinking, signature: block.signature })
    } else {
      out.push({ type: 'redacted_thinking', data: block.data })
    }
  }
  return out
}

/** `Turn[]` → the Anthropic Messages-API array. `system` is NOT a message here — it is Anthropic's
 * top-level `system` request param (SPEC §5's mapping note); this only maps the `user`/`assistant` turns. */
function toAnthropicMessages(turns: Turn[]): AnthropicMessage[] {
  return turns.map((t) => ({ role: t.role, content: t.content }))
}

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MAX_TOKENS = 4096 // a sane cap (LLD §5) — not a modeled/config value, just a runaway-response guard

/** `effort` → Anthropic's real extended-thinking `budget_tokens`, the PRE-4.6 Messages-API shape,
 *  applied ONLY to the models that still accept it (Haiku 4.5, the one pre-4.6 family in
 *  providers.json). Current families, Haiku 5.5 included, REJECT it: see the branch note in `buildRequestBody`. */
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
 *  `output_config: {effort}` instead. Haiku 4.5 is the one served model still on the legacy shape,
 *  and `output_config.effort` ERRORS there, so the two arms are mutually exclusive by API design.
 *  T-0030 (2026-10-07): the match is `haiku-4-5`, not bare `haiku`. Haiku 5.5 is adaptive-only (the
 *  model page and migration guide: `budget_tokens` returns a 400, effort `low` to `max`, default
 *  `medium`), so it takes the current-family arm below. */
const takesLegacyThinkingBudget = (model: string): boolean => /haiku-4-5/.test(model)

/** Haiku 5.5 (also the Bedrock id `anthropic.claude-haiku-5-5`): the one model whose default effort is `medium`. */
const isHaiku55 = (model: string): boolean => /haiku-5-5/.test(model)

/** T-0035: Haiku 5.5's tokenizer emits ~30% more tokens for the same text, so its max_tokens tiers
 *  (default/medium/high/xhigh) are scaled ~30% over the 4096/3072/4096/6144 the other models keep.
 *  Each stays strictly above any thinking budget (adaptive here sends none). */
const HAIKU_55_MAX_TOKENS = { default: 5376, medium: 4096, high: 5376, xhigh: 8192 } as const

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
  // 'low' (or unset) ⇒ no thinking params. Other models keep the pre-Effort max_tokens; Haiku 5.5 gets its own
  // scaled default (HAIKU_55_MAX_TOKENS.default, T-0035). Haiku 5.5 alone defaults to
  // `medium` effort (other current models default to high, Haiku 4.5 has no dial), so only it gets
  // `output_config: {effort: 'low'}` explicitly (T-0032), keeping the cheap no-thinking 4.5 behavior;
  // a model may still think a little at low. We send no `thinking` field rather than
  // `{type:'disabled'}`, which Fable 5 rejects.
  if (req.effort === undefined || req.effort === 'low') {
    return isHaiku55(req.model)
      ? { ...base, max_tokens: HAIKU_55_MAX_TOKENS.default, output_config: { effort: 'low' } }
      : { ...base, max_tokens: MAX_TOKENS }
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
  // Current-family arm (Fable 5 / Sonnet 5 / Opus 4.8+ / Haiku 5.5): adaptive thinking + the effort dial.
  // budget_tokens returns a 400 here (TKT-0075's silent-empty bug); adaptive is legal on ALL of them
  // (Fable 5: "omit or adaptive"). Effort vocabulary maps 1:1 (low/medium/high/xhigh are all real API
  // values). max_tokens gets the same headroom bump the legacy arm used at the equivalent tier, so the
  // reply room does not shrink with the migration; Haiku 5.5 instead takes its ~30% scaled
  // HAIKU_55_MAX_TOKENS tier (T-0035).
  return {
    ...base,
    max_tokens: isHaiku55(req.model) ? HAIKU_55_MAX_TOKENS[req.effort] : THINKING_BUDGET[req.effort] + REPLY_HEADROOM,
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

/** GH #1797 (c): the maximum wait from request start to the response headers. Generous so it never fires
 *  on a healthy turn; on expiry the round throws `anthropicProvider: no response within <ms> ms`. Applies
 *  to the `fetch` only, never to the body read (a long healthy stream is not cut off). */
export const ANTHROPIC_FIRST_BYTE_TIMEOUT_MS = 60_000
/** GH #1797 (c): the maximum silence between two body reads. Reset on every read, so a slow but live
 *  stream (high-effort reasoning) never trips it; on expiry the reader is cancelled and the round throws
 *  `anthropicProvider: stream stalled for <ms> ms`. */
export const ANTHROPIC_STALL_TIMEOUT_MS = 60_000

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

/**
 * GH #1797 gap (d): a bounded retry of the upstream REQUEST on transient failures, so a 429 or a 5xx at
 * connection time does not fail the whole turn. Only the connection phase is wrapped: the wrapper's job
 * ends once it returns a Response, so a body that errors mid-stream is never retried, and tool execution
 * never passes through here. On exhaustion the LAST Response is returned with its body unread, so
 * `runRound`'s existing `upstream error <status>: <body>` throw fires unchanged.
 */
export const ANTHROPIC_MAX_RETRIES = 2
export const ANTHROPIC_RETRY_BACKOFF_MS: readonly number[] = [500, 1500]
export const ANTHROPIC_RETRY_AFTER_CAP_MS = 10_000

const ANTHROPIC_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504, 529])

/** The default sleep: one timer, cancelled (timer cleared, promise rejected with `signal.reason`) on abort.
 *  No timer stays pending after an abort, and the listener is removed when the timer fires. */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** `Retry-After` as milliseconds: whole seconds, or an HTTP-date (never below 0). Undefined when absent
 *  or unparseable, which falls back to the jittered backoff. */
function retryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get('retry-after')
  if (raw === null) return undefined
  const value = raw.trim()
  if (/^\d+$/.test(value)) return Number(value) * 1000
  const at = Date.parse(value)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, at - Date.now())
}

/** The first-byte deadline's rejection. A distinct class so `fetchWithRetry` never retries it: the attempt
 *  already waited its full limit. */
class FirstByteTimeoutError extends AgentTimeoutError {
  constructor(limitMs: number) {
    super(
      `anthropicProvider: no response within ${limitMs} ms`,
      'The model did not answer in time, so I stopped waiting. Please try again.',
    )
    this.name = 'FirstByteTimeoutError'
  }
}

/** The stall guard's rejection (T-0023): the body went silent for the whole stall window. A distinct class,
 *  thrown from the body read, which sits after `fetchWithRetry` has returned, so it is never retried; the
 *  reader is cancelled by `runRound`'s `finally`. Its `userMessage` is the plain-words line a host writes. */
export class StreamStallError extends AgentTimeoutError {
  constructor(limitMs: number) {
    super(
      `anthropicProvider: stream stalled for ${limitMs} ms`,
      'The model stopped sending its reply partway through, so I stopped waiting. Please try again.',
    )
    this.name = 'StreamStallError'
  }
}

function isAbortError(err: unknown, signal: AbortSignal | undefined): boolean {
  if (signal?.aborted) return true
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
}

export async function fetchWithRetry(
  doFetch: () => Promise<Response>,
  opts: {
    signal?: AbortSignal
    maxRetries?: number
    backoffMs?: readonly number[]
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
    random?: () => number
  } = {},
): Promise<Response> {
  const {
    signal,
    maxRetries = ANTHROPIC_MAX_RETRIES,
    backoffMs = ANTHROPIC_RETRY_BACKOFF_MS,
    sleep = abortableSleep,
    random = Math.random,
  } = opts
  const backoff = (retry: number): number => {
    const base = backoffMs[Math.min(retry, backoffMs.length - 1)] ?? 0
    return base + Math.floor(random() * base * 0.2)
  }

  for (let attempt = 0; ; attempt++) {
    if (attempt > 0 && signal?.aborted) throw signal.reason
    const last = attempt >= maxRetries

    let res: Response
    try {
      res = await doFetch()
    } catch (err) {
      // An abort is the caller's decision: rethrown at once, unwrapped, with no wait. A first-byte timeout
      // already waited its full limit, so it is not retried either.
      if (isAbortError(err, signal) || err instanceof FirstByteTimeoutError || last) throw err
      await sleep(backoff(attempt), signal)
      continue
    }

    if (res.ok || !ANTHROPIC_RETRYABLE_STATUSES.has(res.status) || last) return res

    const hinted = retryAfterMs(res)
    // The discarded response's body is cancelled so its connection is not leaked.
    await res.body?.cancel().catch(() => {})
    await sleep(hinted === undefined ? backoff(attempt) : Math.min(hinted, ANTHROPIC_RETRY_AFTER_CAP_MS), signal)
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
    // GH #1797 (c): first-byte deadline, armed PER ATTEMPT. A local controller (not `AbortSignal.timeout`)
    // so the timer is cleared once headers arrive: the fetch signal also governs the body stream, and a
    // deadline left armed would abort a healthy long turn mid-stream. A caller abort keeps its own error
    // unrelabelled. GH #1797 (d): `fetchWithRetry` wraps each attempt; a first-byte timeout is never retried.
    const attempt = async (): Promise<Response> => {
      const deadline = new AbortController()
      const deadlineTimer = setTimeout(() => deadline.abort(), ANTHROPIC_FIRST_BYTE_TIMEOUT_MS)
      try {
        return await fetch(endpoint, {
          method: 'POST',
          headers: {
            'x-api-key': opts.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal,
        })
      } catch (err) {
        if (deadline.signal.aborted && !signal?.aborted) {
          throw new FirstByteTimeoutError(ANTHROPIC_FIRST_BYTE_TIMEOUT_MS)
        }
        throw err
      } finally {
        clearTimeout(deadlineTimer)
      }
    }
    const res = await fetchWithRetry(attempt, { signal })

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

    // ADR-0234 (proposed): ONE usage collector per accepted upstream request (created after retry
    // resolution and the res.ok check, so a retried request never double-reports), shared by the main
    // parse loop and the trailing flush: each request, and so each tool-loop round, reports once.
    const usage = newUsageCollector()
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // GH #1797 (c): stall guard. Each read races a fresh timer, cleared on every settle (no leaked timer).
    // The throw lands inside the try below, whose finally cancels the reader. No buffering: each read's
    // frames are still parsed and yielded in the same iteration (ADR-0146 live progress).
    const readOrStall = (): Promise<ReadableStreamReadResult<Uint8Array>> => {
      let stallTimer: ReturnType<typeof setTimeout> | undefined
      const stall = new Promise<never>((_, reject) => {
        stallTimer = setTimeout(() => reject(new StreamStallError(ANTHROPIC_STALL_TIMEOUT_MS)), ANTHROPIC_STALL_TIMEOUT_MS)
      })
      return Promise.race([reader.read(), stall]).finally(() => clearTimeout(stallTimer))
    }

    // try/finally so an early consumer break or a thrown upstream-error frame still releases the reader
    // lock + cancels the underlying network stream — no dangling connection.
    try {
      for (;;) {
        const { done, value } = await readOrStall()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Only hand `parseAnthropicSSE` whole frames (the buffering assumption documented above): split
        // on the LAST blank-line boundary, parse everything before it, keep the remainder (which may be
        // a still-arriving partial frame) buffered for the next read.
        const lastBoundary = buffer.lastIndexOf('\n\n')
        if (lastBoundary === -1) continue
        const complete = buffer.slice(0, lastBoundary)
        buffer = buffer.slice(lastBoundary + 2)
        for (const fragment of parseAnthropicSSE(complete, onEvent, collector, usage)) {
          if (fragment.startsWith(ANTHROPIC_SSE_ERROR_PREFIX)) {
            throw new Error(`anthropicProvider: upstream error event — ${fragment.slice(ANTHROPIC_SSE_ERROR_PREFIX.length)}`)
          }
          yield fragment
        }
      }

      // Flush any trailing complete-but-unterminated buffer (a stream that ends without a final blank line).
      if (buffer.trim().length > 0) {
        for (const fragment of parseAnthropicSSE(buffer, onEvent, collector, usage)) {
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
            const coerced = coerceObjectFields(input, req.tools?.find((t) => t.name === call.name)?.input_schema)
            if ('error' in coerced) return { call, content: coerced.error, isError: true }
            input = coerced.input
            try {
              // The turn's abort signal rides into the executor (PR #59 review) — an aborted turn also
              // cancels in-flight tool network work, not just the next round's fetch.
              return { call, content: await req.executeTool!(call.name, input, req.signal), isError: false }
            } catch (err) {
              return { call, content: `tool failed: ${err instanceof Error ? err.message : String(err)}`, isError: true }
            }
          }),
        )

        const assistantBlocks = assistantTurnBlocks(collector)
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
