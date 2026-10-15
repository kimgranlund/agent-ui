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
  const { messages, jsonl } = input
  if (Array.isArray(messages)) return messages.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('\n')
  return typeof jsonl === 'string' ? jsonl : ''
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
