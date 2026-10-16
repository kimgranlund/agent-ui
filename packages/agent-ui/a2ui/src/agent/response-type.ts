/**
 * Response type selection (SPEC RTS-R1, RTS-R6; LLD section 2). Pure helpers: the response-type
 * vocabulary, the `render_surface` tool the model calls when (and only when) the UI changes, the
 * user-override lexicon, and the legacy-shape sniff. Zero value imports.
 */
import type { ToolDef, TurnInput } from './agent-transport.ts'

/** What one turn produced: plain text, an A2UI surface, or text then a surface. */
export const RESPONSE_TYPES = ['text', 'surface', 'both'] as const
export type ResponseType = (typeof RESPONSE_TYPES)[number]

/** A configured preference; `auto` lets the model decide inside the turn. */
export const RESPONSE_PREFERENCES = ['text', 'surface', 'auto'] as const
export type ResponsePreference = (typeof RESPONSE_PREFERENCES)[number]

export const RENDER_SURFACE_TOOL_NAME = 'render_surface'

/** The `render_surface` tool definition. T-0206: byte-stable across turns, because tools open the
 *  prompt-cache prefix; the open surfaces ride on the user turn instead (`openSurfacesNote`). */
export function renderSurfaceTool(): ToolDef {
  return {
    name: RENDER_SURFACE_TOOL_NAME,
    description:
      'Render or change the A2UI surface. Call this when the answer is a structure the user must scan, compare, ' +
      'fill in or act on (a comparison, table, steps, schedule, form or choice); facts, definitions and opinions ' +
      'stay plain text. To explain and show, write the explanation as text, then call this too. Every call ' +
      'carries `reply`, one short line to the user shown as your chat reply; the surface never replaces it. ' +
      'Prefer an update to an open surface over creating a new one when one fits. ' +
      '`messages` is the A2UI message list in order, each entry ONE message object (createSurface, ' +
      'updateComponents, updateDataModel or deleteSurface), never a JSON string; `target` is the surface id it updates.',
    input_schema: {
      type: 'object',
      properties: {
        // T-0194: required, so a surface turn always carries a line to the user (Sonnet 5.5 sent none).
        reply: { type: 'string' },
        messages: { type: 'array', items: { type: 'object' } },
        target: { type: 'string' },
      },
      required: ['reply', 'messages'],
    },
  }
}

/** T-0206: the line appended to the current user turn naming every surface open in the session, or ''
 *  when none is (the tool description used to carry it, which changed the cached prefix every turn). */
export function openSurfacesNote(openSurfaceIds: readonly string[]): string {
  return openSurfaceIds.length > 0 ? `[Open surfaces: ${openSurfaceIds.join(', ')}.]` : ''
}

/**
 * T-0172: the A2UI JSONL a `render_surface` call carries. The tool takes `messages`, an array of message
 * objects, so the model never hand-escapes JSON inside a string (Sonnet 5 unbalanced a brace in an escaped
 * `jsonl` string on two of three rounds, 2026-10-14). The legacy `jsonl` string is still read, for recorded
 * fixtures and traces made before the change. Anything else is the empty payload (a PARSE round).
 */
export function renderSurfaceJsonl(input: Record<string, unknown>): string {
  const { jsonl } = input
  const messages = Array.isArray(input['messages']) ? input['messages'] : stringifiedMessages(input)
  if (messages !== undefined) return messages.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('\n')
  return typeof jsonl === 'string' ? jsonl : ''
}

/** T-0304: the array a `messages` sent as one JSON string holds, or undefined. Haiku and Sonnet 5.5 sent the list as a
 *  string on every round of a turn despite the tool description (round 7 :16, :95, :96), so every round was PARSE and
 *  the turn shipped text. A string that does not parse as an array stays the empty payload (a PARSE round); the harness
 *  never edits it (Kim 2026-10-16), and `messagesParseNote` tells the model where it broke. */
export function stringifiedMessages(input: Record<string, unknown>): unknown[] | undefined {
  const { messages } = input
  if (typeof messages !== 'string') return undefined
  try {
    const parsed: unknown = JSON.parse(messages)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** T-0304: one model-facing sentence naming where a `messages` string stopped being JSON, or undefined when `messages`
 *  is not a string or parses. The position is JSON.parse's own; when a new `{"version"` message begins there while
 *  objects of the one before are still open (every recorded round 7 string), the sentence names that message, its kind
 *  and how many `}` it lacks, else it quotes the text at the position. */
export function messagesParseNote(input: Record<string, unknown>): string | undefined {
  const { messages } = input
  if (typeof messages !== 'string') return undefined
  let pos: number | undefined
  try {
    JSON.parse(messages)
    return undefined
  } catch (err) {
    const m = /position (\d+)/.exec(err instanceof Error ? err.message : '')
    pos = m === null ? undefined : Number(m[1])
  }
  if (pos === undefined || pos > messages.length) return 'Your `messages` was not valid JSON.'
  const scan = openAt(messages, pos)
  const extra = scan.open.slice(1)
  if (scan.open[0] === '[' && extra.length > 0 && extra.every((b) => b === '{') && /^\s*\{\s*"version"\s*:/.test(messages.slice(pos))) {
    const missing = extra.length === 1 ? 'a closing } is missing' : `${extra.length} closing } are missing`
    const kind = scan.kind === undefined ? '' : ` (its ${scan.kind})`
    return `Your \`messages\` was not valid JSON: ${missing} in message ${scan.message}${kind}, so it is still open where message ${scan.message + 1} begins.`
  }
  const near = messages.slice(Math.max(0, pos - 40), pos + 20)
  return `Your \`messages\` was not valid JSON at character ${pos}${scan.message > 0 ? ` (message ${scan.message})` : ''}, here: ${near}`
}

/** The brackets still open at `pos` (outside strings), the 1-based number of the last message opened in the top-level
 *  array, and that message's kind (the key of the first object inside it). */
function openAt(text: string, pos: number): { open: string[]; message: number; kind: string | undefined } {
  const open: string[] = []
  let message = 0
  let kind: string | undefined
  let inString = false
  for (let i = 0; i < pos; i++) {
    const ch = text[i]!
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') {
      if (open.length === 1 && ch === '{') {
        message += 1
        kind = undefined
      } else if (open.length === 2 && ch === '{' && kind === undefined) kind = /"([^"\\]*)"\s*:\s*$/.exec(text.slice(0, i))?.[1]
      open.push(ch)
    } else if (ch === '}' || ch === ']') open.pop()
  }
  return { open, message, kind }
}

/** T-0194: the trimmed `reply` line a `render_surface` call carries, or '' (a recording made before the field). */
export function renderSurfaceReply(input: Record<string, unknown>): string {
  const { reply } = input
  return typeof reply === 'string' ? reply.trim() : ''
}

const TEXT_PHRASES = ['just tell me', 'no card', 'text only', "don't show", 'skip the ui']
const SURFACE_PHRASES = ['as a card', 'as a table', 'as a chart']
/** These count only when a surface noun heads the phrase ("show me a pricing table"): optional article, up to two modifiers. */
const GATED_SURFACE_VERBS = ['show me', 'build me', 'build', 'make me']
const SURFACE_NOUNS = [
  'form', 'card', 'table', 'chart', 'dashboard', 'panel', 'survey', 'calculator',
  'checklist', 'widget', 'page', 'screen', 'list', 'plans', 'tabs', 'wizard', 'diagram',
]
/** Words that open a question or clause, never a modifier of the surface noun ("show me how a table join works"). */
const NON_MODIFIERS = ['how', 'what', 'why', 'where', 'when', 'a', 'an', 'the', 'some', 'my', 'your', 'our']
/** What may follow the head noun: the end, punctuation, or a preposition; "list of" and "of contents" never. */
const NOUN_END = "(?=\\s*(?:$|[.,!?;:])|\\s+(?:of|for|with|to|that|which|as|from|in|on|about|please|and|so|using|showing)\\b)"

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const alt = (phrases: readonly string[]): string => `(?:${phrases.map(escape).join('|')})`
const lexicon = (pattern: string): RegExp => new RegExp(`(?<![\\w'])${pattern}(?![\\w'])`, 'i')
const GATED_RE =
  `${alt(GATED_SURFACE_VERBS)}\\s+(?:(?:a|an|the|some)\\s+)?(?:(?!${alt(NON_MODIFIERS)}\\b)[\\w'-]+\\s+){0,2}` +
  `(?:list(?!\\s+of\\b)|${alt(SURFACE_NOUNS.filter((n) => n !== 'list'))})s?(?!\\s+of\\s+contents)${NOUN_END}`
const TEXT_RE = lexicon(alt(TEXT_PHRASES))
const SURFACE_RE = lexicon(
  `(?:${alt(SURFACE_PHRASES)}|${GATED_RE})`,
)

/** The user's explicit ask for text or a surface, from an intent turn's words. Text wins a tie (PRD-G2). */
export function detectUserOverride(input: TurnInput): 'text' | 'surface' | undefined {
  if (input.kind !== 'intent') return undefined
  const text = input.text.replace(/’/g, "'")
  if (TEXT_RE.test(text)) return 'text'
  if (SURFACE_RE.test(text)) return 'surface'
  return undefined
}

export function classifyResponse(hasText: boolean, hasSurface: boolean): ResponseType {
  if (hasSurface) return hasText ? 'both' : 'surface'
  return 'text'
}

function parseObject(line: string): Record<string, unknown> | undefined {
  try {
    const v: unknown = JSON.parse(line)
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** True when the text is the legacy A2UI JSONL shape (an optional leading meta-line, then a wire or genui line). */
export function isLegacyShape(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l !== '')
  let i = 0
  if (lines[0] !== undefined && parseObject(lines[0])?.['a2uiMeta'] !== undefined) i = 1
  const next = lines[i] === undefined ? undefined : parseObject(lines[i])
  if (next === undefined) return false
  return typeof next['version'] === 'string' || 'genui' in next
}
