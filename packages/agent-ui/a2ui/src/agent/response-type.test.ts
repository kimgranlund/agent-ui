import { describe, expect, it } from 'vitest'
import type { TurnInput } from './agent-transport.ts'
import {
  RENDER_SURFACE_TOOL_NAME,
  RESPONSE_PREFERENCES,
  RESPONSE_TYPES,
  classifyResponse,
  detectUserOverride,
  isLegacyShape,
  renderSurfaceJsonl,
  renderSurfaceReply,
  renderSurfaceTool,
} from './response-type.ts'

const intent = (text: string): TurnInput => ({ kind: 'intent', text, session: { turns: [] } }) as TurnInput

describe('response-type vocabulary', () => {
  it('pins the type and preference sets', () => {
    expect(RESPONSE_TYPES).toEqual(['text', 'surface', 'both'])
    expect(RESPONSE_PREFERENCES).toEqual(['text', 'surface', 'auto'])
    expect(RENDER_SURFACE_TOOL_NAME).toBe('render_surface')
  })
})

describe('renderSurfaceTool', () => {
  const tool = renderSurfaceTool(['main', 'quiz-7'])
  it('has the settled name and schema', () => {
    expect(tool.name).toBe('render_surface')
    expect(tool.input_schema).toEqual({
      type: 'object',
      properties: { reply: { type: 'string' }, messages: { type: 'array', items: { type: 'object' } }, target: { type: 'string' } },
      required: ['reply', 'messages'],
    })
    expect(tool.description).toMatch(/never a JSON string/)
  })
  it('T-0194: reads the trimmed `reply` line, else empty', () => {
    expect(renderSurfaceReply({ reply: '  Welcome to the table.  ', messages: [] })).toBe('Welcome to the table.')
    expect(renderSurfaceReply({ messages: [] })).toBe('')
    expect(renderSurfaceReply({ reply: 7 })).toBe('')
  })
  it('T-0172: reads structured `messages` as one JSON line each, still reads a legacy `jsonl` string, else empty', () => {
    const create = { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } }
    const update = { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'a "quoted" {brace}' }] } }
    expect(renderSurfaceJsonl({ messages: [create, update] })).toBe(`${JSON.stringify(create)}\n${JSON.stringify(update)}`)
    expect(renderSurfaceJsonl({ jsonl: 'line' })).toBe('line')
    expect(renderSurfaceJsonl({ messages: [create], jsonl: 'ignored' })).toBe(JSON.stringify(create))
    expect(renderSurfaceJsonl({})).toBe('')
  })
  it('names every open surface, gates on a structure, and prefers an update', () => {
    expect(tool.description).toContain('main')
    expect(tool.description).toContain('quiz-7')
    expect(tool.description).toMatch(/scan, compare, fill in or act on/)
    expect(tool.description).toMatch(/update/)
  })
  it('T-0172, T-0194: every call carries a short reply line (a Sonnet 5.5 greet shipped a surface with no words)', () => {
    expect(tool.description).toMatch(/carries `reply`, one short line to the user shown as your chat reply; the surface never replaces it/)
  })
  it('serializes under 1500 chars', () => {
    expect(JSON.stringify(tool).length).toBeLessThan(1500)
  })
})

describe('detectUserOverride', () => {
  it.each(['Just tell me the price', 'no card please', 'text only', "don't show a form", 'skip the UI'])(
    'text: %s',
    (t) => expect(detectUserOverride(intent(t))).toBe('text'),
  )
  it.each(['show me the plans', 'as a card', 'list them as a table', 'as a chart', 'build a form', 'make me a quiz form'])(
    'surface: %s',
    (t) => expect(detectUserOverride(intent(t))).toBe('surface'),
  )
  it('text wins when both lexicons match', () => {
    expect(detectUserOverride(intent('do not show me a card, just tell me'))).toBe('text')
  })
  it('matches whole phrases only', () => {
    expect(detectUserOverride(intent('book a table for two at eight'))).toBeUndefined()
    expect(detectUserOverride(intent('the renderer is slow'))).toBeUndefined()
  })
  it('is undefined for a client turn', () => {
    const client = { kind: 'client', message: { action: { name: 'show me', sourceComponentId: 'b' } }, session: { turns: [] } } as unknown as TurnInput
    expect(detectUserOverride(client)).toBeUndefined()
  })
})

describe('lexicon false positives', () => {
  it.each([
    'show me the capital of Finland',
    'Can you render my resume summary?',
    'what is a Render farm',
    'How do I build a house',
    'Please make me a sandwich recipe',
    'the render() function',
    'tell me a story in words of one syllable',
  ])('no override: %s', (t) => expect(detectUserOverride(intent(t))).toBeUndefined())
  it.each(['show me the plans as a table', 'Make me a short satisfaction survey', 'Build a settings panel', 'show me a pricing table'])(
    'still surface: %s',
    (t) => expect(detectUserOverride(intent(t))).toBe('surface'),
  )
  it.each(['Just tell me the price', 'text only please'])('still text: %s', (t) =>
    expect(detectUserOverride(intent(t))).toBe('text'),
  )
})

describe('lexicon round 2', () => {
  it.each([
    'build a list of reasons',
    'make me a table of contents',
    'show me the list of files in my home folder',
    'show me how a table join works',
    'show me the screen resolution settings in macOS',
    'show me what a card game looks like',
    'build a wizard character',
  ])('no override: %s', (t) => expect(detectUserOverride(intent(t))).toBeUndefined())
  it.each(['show me a diagram', 'Build me a form', 'show me a pricing tables', 'show me the plans as a table', 'Make me a short satisfaction survey', 'Build a settings panel', 'show me a chart of sales', 'render the page as a card', 'make me a dashboard'])(
    'surface: %s',
    (t) => expect(detectUserOverride(intent(t))).toBe('surface'),
  )
  it.each(['just tell me', 'text only'])('text: %s', (t) => expect(detectUserOverride(intent(t))).toBe('text'))
  it('text wins a tie', () => {
    expect(detectUserOverride(intent('show me a table, text only'))).toBe('text')
  })
})

describe('classifyResponse', () => {
  it('maps the two flags', () => {
    expect(classifyResponse(true, true)).toBe('both')
    expect(classifyResponse(false, true)).toBe('surface')
    expect(classifyResponse(true, false)).toBe('text')
    expect(classifyResponse(false, false)).toBe('text')
  })
})

describe('isLegacyShape', () => {
  const v = JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: 'agent-ui' } })
  const m = JSON.stringify({ a2uiMeta: { note: 'Hi.' } })
  const g = JSON.stringify({ genui: { surfaceId: 'g', html: '<p>x</p>' } })
  it('detects wire and genui lines, with or without a leading meta-line', () => {
    expect(isLegacyShape(v)).toBe(true)
    expect(isLegacyShape(`${m}\n${v}`)).toBe(true)
    expect(isLegacyShape(`${m}\n\n${g}`)).toBe(true)
    expect(isLegacyShape(g)).toBe(true)
  })
  it('is false for prose, a meta-line then prose, or a non-string version', () => {
    expect(isLegacyShape('Helsinki.')).toBe(false)
    expect(isLegacyShape(`${m}\nHelsinki.`)).toBe(false)
    expect(isLegacyShape(JSON.stringify({ version: 1 }))).toBe(false)
    expect(isLegacyShape('')).toBe(false)
  })
})
