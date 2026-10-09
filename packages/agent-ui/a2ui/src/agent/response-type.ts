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

/** The `render_surface` tool definition, naming every surface currently open. */
export function renderSurfaceTool(openSurfaceIds: readonly string[]): ToolDef {
  const open = openSurfaceIds.length > 0 ? `Open surfaces: ${openSurfaceIds.join(', ')}.` : 'No surface is open yet.'
  return {
    name: RENDER_SURFACE_TOOL_NAME,
    description:
      'Render or change the A2UI surface. Answer in plain text by default; call this only when the UI changes. ' +
      `${open} Prefer an update to an open surface over creating a new one when one fits. ` +
      '`jsonl` is the A2UI JSONL message stream; `target` is the surface id it updates.',
    input_schema: {
      type: 'object',
      properties: { jsonl: { type: 'string' }, target: { type: 'string' } },
      required: ['jsonl'],
    },
  }
}

const TEXT_PHRASES = ['just tell me', 'in words', 'no card', 'text only', "don't show", 'skip the ui']
const SURFACE_PHRASES = ['show me', 'as a card', 'as a table', 'as a chart', 'build a', 'make me a', 'render']

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const lexicon = (phrases: readonly string[]): RegExp =>
  new RegExp(`(?<![\\w'])(?:${phrases.map(escape).join('|')})(?![\\w'])`, 'i')
const TEXT_RE = lexicon(TEXT_PHRASES)
const SURFACE_RE = lexicon(SURFACE_PHRASES)

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
