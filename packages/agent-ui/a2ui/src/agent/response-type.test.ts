import { describe, expect, it } from 'vitest'
import type { TurnInput } from './agent-transport.ts'
import {
  RENDER_SURFACE_TOOL_NAME,
  RESPONSE_PREFERENCES,
  RESPONSE_TYPES,
  classifyResponse,
  detectUserOverride,
  domainSurfaceNouns,
  isLegacyShape,
  openSurfacesNote,
  renderSurfaceJsonl,
  renderSurfaceReply,
  renderSurfaceTool,
  messagesParseNote,
  stringifiedMessages,
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
  const tool = renderSurfaceTool()
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
  it('T-0304: a `messages` string that parses as a JSON array reads as the array (Haiku and Sonnet 5.5, round 7), else empty', () => {
    const create = { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } }
    const update = { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'a "quoted" {brace}' }] } }
    expect(renderSurfaceJsonl({ messages: JSON.stringify([create, update]) })).toBe(renderSurfaceJsonl({ messages: [create, update] }))
    expect(renderSurfaceJsonl({ messages: '[{"version":"v1.0","createSurface":{"surfaceId":"s"' })).toBe('')
    expect(renderSurfaceJsonl({ messages: JSON.stringify(create) })).toBe('')
    expect(stringifiedMessages({ messages: JSON.stringify([create]) })).toEqual([create])
    expect(stringifiedMessages({ messages: [create] })).toBeUndefined()
  })
  it('T-0304: a string that does not parse is never edited; the note names where it broke', () => {
    const data = { version: 'v1.0', updateDataModel: { surfaceId: 's', value: { hand: [{ rank: 'A' }], note: 'a ,{"version": in text' } } }
    const update = { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'hi' }] } }
    const whole = JSON.stringify([update, data, update])
    const short = whole.replace('"}}},{"version"', '"}},{"version"') // round 7 :95: one `}` short before the next message
    expect(short).not.toBe(whole)
    expect(renderSurfaceJsonl({ messages: short })).toBe('')
    expect(messagesParseNote({ messages: short })).toBe(
      'Your `messages` was not valid JSON: a closing } is missing in message 2 (its updateDataModel), so it is still open where message 3 begins.',
    )
    const shorter = whole.replace('"}}},{"version"', '"},{"version"')
    expect(messagesParseNote({ messages: shorter })).toMatch(/^Your `messages` was not valid JSON: 2 closing \} are missing in message 2 \(its updateDataModel\)/)
    // No message boundary at the break: the position and the text there.
    expect(messagesParseNote({ messages: whole.slice(0, -3) })).toMatch(/^Your `messages` was not valid JSON at character \d+ \(message 3\), here: `[^`]*`\.$/)
    expect(messagesParseNote({ messages: whole })).toBeUndefined()
    expect(messagesParseNote({ messages: [update] })).toBeUndefined()
  })
  it('T-0206: the note names every open surface; the stable description gates on a structure and prefers an update', () => {
    expect(openSurfacesNote(['main', 'quiz-7'])).toBe('[Open surfaces: main, quiz-7.]')
    expect(openSurfacesNote([])).toBe('')
    expect(renderSurfaceTool()).toEqual(tool)
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

describe('a noun a catalog domain type owns is not a surface noun there (T-0348)', () => {
  const croupier = ['Card', 'Text', 'PlayingCard', 'CardTable']
  const base = ['Card', 'Text', 'ProductCard', 'ResultCard', 'Table']
  it('domainSurfaceNouns reads domain types homed outside the default catalog', () => {
    expect(domainSurfaceNouns(croupier)).toEqual(['card', 'table'])
    expect(domainSurfaceNouns(['BookingForm', 'Card'])).toEqual(['form'])
    expect(domainSurfaceNouns(base)).toEqual([])
    expect(domainSurfaceNouns([])).toEqual([])
  })
  it.each([
    "Show me the dealer's hole card.",
    'show me the cards',
    "show me the players' cards",
    'I have no card to play',
    'show me the table',
  ])('croupier: no override for %s', (t) => expect(detectUserOverride(intent(t), croupier)).toBeUndefined())
  it.each(["show me today's summary card", 'show me a summary card', 'as a card', 'Show me the dealer\'s hole card.'])(
    'default catalog: surface for %s',
    (t) => expect(detectUserOverride(intent(t), base)).toBe('surface'),
  )
  it('no catalog types keeps the plain lexicon', () => {
    expect(detectUserOverride(intent('show me the cards'))).toBe('surface')
    expect(detectUserOverride(intent('no card please'))).toBe('text')
  })
  it('a non-domain noun in the same sentence still forces a surface', () => {
    expect(detectUserOverride(intent('show me the hole card and a pricing chart'), croupier)).toBe('surface')
    expect(detectUserOverride(intent('show me the hole card and the cards'), croupier)).toBeUndefined()
  })
  it('text phrases other than the owned noun still apply', () => {
    expect(detectUserOverride(intent('just tell me the hole card'), croupier)).toBe('text')
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
