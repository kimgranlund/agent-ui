/**
 * Response type selection (SPEC RTS-R1, RTS-R6; LLD section 2). Pure helpers: the response-type
 * vocabulary, the `render_surface` tool the model calls when (and only when) the UI changes, the
 * user-override lexicon, and the legacy-shape sniff. One value import: the pure catalog layer map.
 */
import { CATALOG_LAYER_MAP } from '../catalog/layers.ts'
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
 *  the turn shipped text. T-0469: a string whose only defect is one named unclosed array (the `messagesParseNote` arm
 *  that names it) is closed in place by `closedInPlace`; T-0591: so is one whose only defect is one surplus closer.
 *  Any other string that does not parse as an array stays the empty payload (a PARSE round), never edited, and
 *  `messagesParseNote` tells the model where it broke. */
export function stringifiedMessages(input: Record<string, unknown>): unknown[] | undefined {
  const { messages } = input
  if (typeof messages !== 'string') return undefined
  try {
    const parsed: unknown = JSON.parse(messages)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return closedInPlace(messages)
  }
}

/** T-0469: the array a `messages` string holds once its closers are put right, or undefined. Only when JSON.parse
 *  stopped on a `}` where an array is the innermost open bracket (the unclosed array `messagesParseNote` names) and
 *  nothing but `]`, `}` and whitespace follows the last value: the closers after that value are then rewritten from the
 *  brackets still open, the one order valid JSON allows. Round 14 :33 sent one `}` too many where the `]` of
 *  `components` belongs, byte for byte on all three rounds after the T-0450 pinpoint; round 13 :145 left that `]` out.
 *  T-0591: else the array of messages left once the one closer JSON.parse stopped on is dropped (`withoutSurplus`). */
function closedInPlace(text: string): unknown[] | undefined {
  let pos: number | undefined
  try {
    JSON.parse(text)
    return undefined
  } catch (err) {
    const m = /position (\d+)/.exec(err instanceof Error ? err.message : '')
    pos = m === null ? undefined : Number(m[1])
  }
  if (pos === undefined) return undefined
  if (unclosedArray(text, pos, openAt(text, pos)) !== undefined) {
    let start = text.length
    while (start > 0 && /[\s\]}]/.test(text[start - 1]!)) start--
    const open = openAt(text, start).open
    const closers = open.map((b) => (b === '{' ? '}' : ']')).reverse().join('')
    try {
      const parsed: unknown = start > pos ? undefined : JSON.parse(text.slice(0, start) + closers)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // not closable from the brackets still open: try the surplus closer below
    }
  }
  return withoutSurplus(text, pos)
}

/** T-0591: the array of messages `text` holds once the one `}` or `]` at `pos` (where JSON.parse stopped) is dropped,
 *  or undefined. Round 21 :129 sent one `}` too many after a message and :139 one before the `]` of `components`, each
 *  byte for byte on every round after the pinpoint; any second defect still fails the parse. */
function withoutSurplus(text: string, pos: number): unknown[] | undefined {
  if (text[pos] !== '}' && text[pos] !== ']') return undefined
  try {
    const parsed: unknown = JSON.parse(text.slice(0, pos) + text.slice(pos + 1))
    return Array.isArray(parsed) && parsed.every((m) => typeof m === 'object' && m !== null && !Array.isArray(m)) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** T-0304: one model-facing sentence naming where a `messages` string stopped being JSON, or undefined when `messages`
 *  is not a string or parses. The position is JSON.parse's own; when a new `{"version"` message begins there while
 *  objects of the one before are still open (every recorded round 7 string), the sentence names that message, its kind
 *  and how many `}` it lacks, else it quotes the text at the position. T-0591: a closer there that parses once dropped
 *  is named as one too many, ahead of the T-0450 unclosed-array arm (round 21 :139 got "a closing ] is missing"). */
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
  const near = messages.slice(Math.max(0, pos - 40), pos + 20)
  if (withoutSurplus(messages, pos) !== undefined && scan.message > 0) {
    const where = scan.open.length > 1 ? `in message ${scan.message}` : `after message ${scan.message}`
    const kind = scan.kind === undefined ? '' : ` (its ${scan.kind})`
    return `Your \`messages\` was not valid JSON: it has one ${messages[pos]} too many at character ${pos}, ${where}${kind}${scan.open.length > 1 ? '' : ' ends'}, here: \`${near}\`.`
  }
  const extra = scan.open.slice(1)
  if (scan.open[0] === '[' && extra.length > 0 && extra.every((b) => b === '{') && /^\s*\{\s*"version"\s*:/.test(messages.slice(pos))) {
    const missing = extra.length === 1 ? 'a closing } is missing' : `${extra.length} closing } are missing`
    const kind = scan.kind === undefined ? '' : ` (its ${scan.kind})`
    return `Your \`messages\` was not valid JSON: ${missing} in message ${scan.message}${kind}, so it is still open where message ${scan.message + 1} begins.`
  }
  const unclosed = unclosedArray(messages, pos, scan)
  if (unclosed !== undefined && scan.message > 0) {
    const kind = scan.kind === undefined ? '' : ` (its ${scan.kind})`
    return `Your \`messages\` was not valid JSON: a closing ] is missing in message ${scan.message}${kind}: its \`${unclosed}\` array is still open at character ${pos}, where a } comes instead.`
  }
  return `Your \`messages\` was not valid JSON at character ${pos}${scan.message > 0 ? ` (message ${scan.message})` : ''}, here: \`${near}\`.`
}

/** T-0450: the key of the array still open where JSON.parse stopped on a `}`, or undefined. Haiku 5.5 dropped the `]`
 *  that closes `components` after a last component ending in its own array (round 13 :13, :50, :145, every string and
 *  text round), and the quoted text at the break never named it. */
function unclosedArray(text: string, pos: number, scan: { open: string[]; keys: (string | undefined)[] }): string | undefined {
  if (text[pos] !== '}' || scan.open.length < 2 || scan.open.at(-1) !== '[') return undefined
  return scan.keys.at(-1)
}

/** T-0450: one model-facing sentence for a text-channel A2UI line that does not parse because an array inside it is
 *  never closed, or undefined (any other break keeps the plain PARSE reminder). */
export function wireLineParseNote(line: string): string | undefined {
  let pos: number | undefined
  try {
    JSON.parse(line)
    return undefined
  } catch (err) {
    const m = /position (\d+)/.exec(err instanceof Error ? err.message : '')
    pos = m === null ? undefined : Number(m[1])
  }
  if (pos === undefined || pos > line.length) return undefined
  const scan = openAt(line, pos)
  const unclosed = unclosedArray(line, pos, scan)
  if (unclosed === undefined) return undefined
  const kind = /^\s*\{\s*"version"\s*:\s*"[^"]*"\s*,\s*"([^"\\]+)"\s*:/.exec(line)?.[1]
  return `Your A2UI line was not valid JSON: a closing ] is missing${kind === undefined ? '' : ` in its ${kind}`}: its \`${unclosed}\` array is still open at character ${pos}, where a } comes instead.`
}

/** The brackets still open at `pos` (outside strings) with the key each one is the value of, the 1-based number of the
 *  last message opened in the top-level array, and that message's kind (the key of the first object inside it). */
function openAt(text: string, pos: number): { open: string[]; keys: (string | undefined)[]; message: number; kind: string | undefined } {
  const open: string[] = []
  const keys: (string | undefined)[] = []
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
      keys.push(/"([^"\\]*)"\s*:\s*$/.exec(text.slice(Math.max(0, i - 200), i))?.[1])
    } else if (ch === '}' || ch === ']') {
      open.pop()
      keys.pop()
    }
  }
  return { open, keys, message, kind }
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
/** The verbs that make a build ask: with these an owned noun needs no modifier ("build me a form"). */
const BUILD_VERBS = ['build me', 'build', 'make me']
/** T-0354: the modifiers that make "show me a <modifier> card" an explicit format ask where a catalog owns the noun. */
const FORMAT_MODIFIERS = [
  'summary', 'status', 'profile', 'info', 'stats', 'pricing', 'comparison', 'score', 'report', 'contact',
  'signup', 'login', 'feedback', 'settings',
]
const SURFACE_NOUNS = [
  'form', 'card', 'table', 'chart', 'dashboard', 'panel', 'survey', 'calculator',
  'checklist', 'widget', 'page', 'screen', 'list', 'plans', 'tabs', 'wizard', 'diagram',
]
/** Words that open a question or clause, never a modifier of the surface noun ("show me how a table join works", "a deck of cards"). */
const NON_MODIFIERS = ['how', 'what', 'why', 'where', 'when', 'a', 'an', 'the', 'some', 'my', 'your', 'our', 'of']
/** What may follow the head noun: the end, punctuation, or a preposition; "list of" and "of contents" never. */
const NOUN_END = "(?=\\s*(?:$|[.,!?;:])|\\s+(?:of|for|with|to|that|which|as|from|in|on|about|please|and|so|using|showing)\\b)"

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const alt = (phrases: readonly string[]): string => `(?:${phrases.map(escape).join('|')})`
const lexicon = (pattern: string): RegExp => new RegExp(`(?<![\\w'])${pattern}(?![\\w'])`, 'i')

/**
 * T-0348: the surface nouns a catalog's domain types own. A type the layer map homes outside the default catalog
 * ("PlayingCard", "CardTable", "BookingForm") is that domain's own word, so a noun that is one of its camel-case parts
 * ("card", "table", "form") names the domain thing in that catalog, never a UI surface.
 */
export function domainSurfaceNouns(catalogTypes: readonly string[]): readonly string[] {
  const nouns = new Set<string>()
  for (const type of catalogTypes) {
    const row = Object.hasOwn(CATALOG_LAYER_MAP, type) ? CATALOG_LAYER_MAP[type]! : undefined
    if (row?.layer !== 'domain' || row.home === 'default') continue
    for (const part of type.match(/[A-Z][a-z]+|[A-Z]+(?![a-z])|[a-z]+/g) ?? []) {
      if (SURFACE_NOUNS.includes(part.toLowerCase())) nouns.add(part.toLowerCase())
    }
  }
  return [...nouns].sort()
}

/** The words that lead an owned noun inside a domain type's own name ("booking" in BookingForm, "playing" in PlayingCard). */
function domainLeadWords(catalogTypes: readonly string[]): readonly string[] {
  const words = new Set<string>()
  for (const type of catalogTypes) {
    const row = Object.hasOwn(CATALOG_LAYER_MAP, type) ? CATALOG_LAYER_MAP[type]! : undefined
    if (row?.layer !== 'domain' || row.home === 'default') continue
    const parts = (type.match(/[A-Z][a-z]+|[A-Z]+(?![a-z])|[a-z]+/g) ?? []).map((p) => p.toLowerCase())
    const at = parts.findIndex((p) => SURFACE_NOUNS.includes(p))
    for (const part of at > 0 ? parts.slice(0, at) : []) words.add(part)
  }
  return [...words].sort()
}

interface Lexicon {
  text: RegExp
  surface: RegExp
}

const lexicons = new Map<string, Lexicon>()

/** The head noun and what may follow it, shared by every gated branch: plural allowed, "list of", "of contents" and
 *  "form of payment" (T-0408) never. */
function nounTail(nouns: readonly string[]): string {
  const rest = nouns.filter((n) => n !== 'list')
  return `(?!forms?\\s+of\\s+payments?\\b)(?:${nouns.includes('list') ? 'list(?!\\s+of\\b)|' : ''}${alt(rest)})s?(?!\\s+of\\s+contents)${NOUN_END}`
}

/** The text and surface lexicons. An `owned` noun (one the catalog's domain types name) leaves the open gated rule and
 *  the "no card" text phrase; it still counts as a surface only under an explicit format signal: a build verb with
 *  "a" or "an" ("build me a form"), or "show me a" plus a format modifier ("show me a summary card", "show me a
 *  booking form"). A phrase that opens on an owned noun may still lead into another surface ask ("show me the hole
 *  card and a pricing chart"). */
function lexiconFor(owned: readonly string[], leads: readonly string[]): Lexicon {
  const key = `${owned.join(',')}|${leads.join(',')}`
  let lex = lexicons.get(key)
  if (lex === undefined) {
    const nouns = SURFACE_NOUNS.filter((n) => !owned.includes(n))
    const modifiers = `(?:(?!${alt(NON_MODIFIERS)}\\b)[\\w'-]+\\s+)`
    const article = '(?:(?:a|an|the|some)\\s+)?'
    const lead =
      owned.length === 0 ? '' : `(?:${article}${modifiers}{0,2}${alt(owned)}s?\\s+and\\s+)?`
    const branches = [
      `${alt(GATED_SURFACE_VERBS)}\\s+${lead}${article}${modifiers}{0,2}${nounTail(nouns)}`,
    ]
    if (owned.length > 0) {
      const format = `(?:(?:${alt([...FORMAT_MODIFIERS, ...leads])})\\s+)`
      branches.push(
        `${alt(BUILD_VERBS)}\\s+an?\\s+${format}{0,2}${nounTail(owned)}`,
        `show me\\s+an?\\s+${format}{1,2}${nounTail(owned)}`,
      )
    }
    const textPhrases = TEXT_PHRASES.filter((p) => !owned.some((n) => p === `no ${n}`))
    lex = {
      text: lexicon(alt(textPhrases)),
      surface: lexicon(`(?:${alt(SURFACE_PHRASES)}${NOUN_END}|${branches.join('|')})`),
    }
    lexicons.set(key, lex)
  }
  return lex
}

/** The user's explicit ask for text or a surface, from an intent turn's words. Text wins a tie (PRD-G2). `catalogTypes`
 *  is the turn's catalog: a noun its domain types own (`domainSurfaceNouns`) is not read as a surface or text word. */
export function detectUserOverride(input: TurnInput, catalogTypes?: readonly string[]): 'text' | 'surface' | undefined {
  if (input.kind !== 'intent') return undefined
  const text = input.text.replace(/’/g, "'")
  const lex = catalogTypes === undefined ? lexiconFor([], []) : lexiconFor(domainSurfaceNouns(catalogTypes), domainLeadWords(catalogTypes))
  if (lex.text.test(text)) return 'text'
  if (lex.surface.test(text)) return 'surface'
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
