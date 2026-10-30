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
  wireLineParseNote,
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
  it('T-0304: a string that does not parse, other than one unclosed array (T-0469), is never edited; the note names where it broke', () => {
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
  it('T-0450: a `]` missing where a `}` closes the message names the array left open (round 13 :145, :50, :13)', () => {
    const deck =
      '[{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui--croupier"}},{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"OptionDeck","actionName":"pick_game","options":[{"value":"blackjack","title":"Blackjack"}]}]}}]'
    const short = deck.replace('}]}]}}]', '}]}}}]')
    expect(short).not.toBe(deck)
    expect(messagesParseNote({ messages: short })).toBe(
      `Your \`messages\` was not valid JSON: a closing ] is missing in message 2 (its updateComponents): its \`components\` array is still open at character ${short.length - 3}, where a } comes instead.`,
    )
    expect(messagesParseNote({ messages: deck })).toBeUndefined()
    const line = JSON.stringify(JSON.parse(deck)[1])
    const shortLine = line.replace('}]}]}}', '}]}}}')
    expect(wireLineParseNote(shortLine)).toBe(
      `Your A2UI line was not valid JSON: a closing ] is missing in its updateComponents: its \`components\` array is still open at character ${shortLine.length - 2}, where a } comes instead.`,
    )
    expect(wireLineParseNote(line)).toBeUndefined()
    expect(wireLineParseNote(line.slice(0, -2))).toBeUndefined() // any other break keeps the plain reminder
  })
  it('T-0469: a string whose only defect is one named unclosed array is closed in place (round 14 :33, round 13 :145)', () => {
    const deck =
      '[{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui--croupier"}},{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"OptionDeck","actionName":"pick_game","options":[{"value":"blackjack","title":"Blackjack"}]}]}}]'
    const missing = deck.replace('}]}]}}]', '}]}}}]') // round 13 :145: the `]` of `components` is missing
    const surplus = deck.replace('}]}]}}]', '}]}}]}}]') // round 14 :33: one `}` too many where that `]` belongs
    for (const s of [missing, surplus]) {
      expect(stringifiedMessages({ messages: s })).toEqual(JSON.parse(deck))
      expect(renderSurfaceJsonl({ messages: s })).toBe(renderSurfaceJsonl({ messages: JSON.parse(deck) }))
    }
    expect(messagesParseNote({ messages: missing })).toMatch(/its `components` array is still open/)
    expect(messagesParseNote({ messages: surplus })).toMatch(/^Your `messages` was not valid JSON: it has one \} too many at character \d+, in message 2 \(its updateComponents\)/) // T-0591
    // Any other break is never edited: a truncated string, a break before the closers, a `}` missing between messages.
    expect(stringifiedMessages({ messages: deck.slice(0, -2) })).toBeUndefined()
    const early = deck.replace('"actionName"', '"tags":["a"},"actionName"')
    expect(messagesParseNote({ messages: early })).toMatch(/its `tags` array is still open/)
    expect(stringifiedMessages({ messages: early })).toBeUndefined()
    expect(stringifiedMessages({ messages: deck.replace('"agent-ui--croupier"}},', '"agent-ui--croupier"},') })).toBeUndefined()
  })
  it('T-0591: a string whose only defect is one surplus closer drops it and is named (round 21 :129, :139)', () => {
    // Round 21 :129 (all three rounds byte for byte): one `}` too many after message 2, the updateDataModel.
    const palette =
      '[{"version":"v1.0","createSurface":{"surfaceId":"palette-calm-blue","catalogId":"agent-ui--stylist"}},{"version":"v1.0","updateDataModel":{"surfaceId":"palette-calm-blue","value":{"title":"Calm blue banking palette","primary":{"label":"Primary (navy)","value":"#1F4E79"},"secondary":{"label":"Secondary (steel)","value":"#5B8DB8"},"accent":{"label":"Accent (sky)","value":"#4FB3D9"},"tonal":[{"label":"100","value":"#EAF2F9"},{"label":"300","value":"#9EC1E0"},{"label":"500","value":"#2F6A9E"},{"label":"700","value":"#1F4E79"},{"label":"900","value":"#12304D"}]}}}},{"version":"v1.0","updateComponents":{"surfaceId":"palette-calm-blue","components":[{"id":"root","component":"Card","elevation":"1","children":["root_content"]},{"id":"root_content","component":"CardContent","children":["col"]},{"id":"col","component":"Column","gap":"md","children":["title","roles_row","tonal_caption","tonal_ramp","pairs_caption","pairs_row"]},{"id":"title","component":"Text","text":{"path":"/title"},"variant":"h3"},{"id":"roles_row","component":"Row","gap":"lg","wrap":true,"children":["sw_primary","sw_secondary","sw_accent"]},{"id":"sw_primary","component":"Swatch","label":{"path":"/primary/label"},"value":{"path":"/primary/value"}},{"id":"sw_secondary","component":"Swatch","label":{"path":"/secondary/label"},"value":{"path":"/secondary/value"}},{"id":"sw_accent","component":"Swatch","label":{"path":"/accent/label"},"value":{"path":"/accent/value"}},{"id":"tonal_caption","component":"Text","text":"Primary tonal range","variant":"caption"},{"id":"tonal_ramp","component":"Ramp","label":"Primary tonal range","steps":{"path":"/tonal"}},{"id":"pairs_caption","component":"Text","text":"Text pairings (AA)","variant":"caption"},{"id":"pairs_row","component":"Row","gap":"lg","wrap":true,"children":["cp_body","cp_button","cp_tint","cp_dark"]},{"id":"cp_body","component":"ContrastPair","label":"Body text on white","foreground":"#1F4E79","background":"#FFFFFF","sample":"Your balance"},{"id":"cp_button","component":"ContrastPair","label":"Button label","foreground":"#FFFFFF","background":"#2F6A9E","sample":"Transfer"},{"id":"cp_tint","component":"ContrastPair","label":"Ink on tint","foreground":"#12304D","background":"#EAF2F9","sample":"Recent activity"},{"id":"cp_dark","component":"ContrastPair","label":"Accent on navy","foreground":"#4FB3D9","background":"#12304D","sample":"New statement"}]}}]'
    // Round 21 :139 (rounds 2 and 3 byte for byte): one `}` too many after the ConfirmReceipt's backAction, before `]`.
    const cart =
      '[{"version":"v1.0","updateComponents":{"surfaceId":"storefront-1","components":[{"id":"root","component":"Column","gap":"md","children":["heading","grid","order"]},{"id":"heading","component":"Text","text":"Lamps","variant":"h4"},{"id":"grid","component":"Row","gap":"md","wrap":true,"children":["lamp_brass","lamp_linen","lamp_ceramic","lamp_rattan"]},{"id":"lamp_brass","component":"ProductCard","title":"Brass Arc Floor Lamp","subtitle":"Brass, 140 cm tall","price":"$189","priceNote":"In stock","badge":"New","badgeIntent":"info","actionLabel":"Add to order","action":{"action":"buy","context":{"sku":"lamp-brass-arc"}}},{"id":"lamp_linen","component":"ProductCard","title":"Linen Drum Pendant","subtitle":"Linen shade, 35 cm wide","price":"$96","priceOld":"$120","priceNote":"In stock","badge":"Sale","badgeIntent":"success","actionLabel":"Add to order","action":{"action":"buy","context":{"sku":"lamp-linen-drum"}}},{"id":"lamp_ceramic","component":"ProductCard","title":"Glazed Ceramic Table Lamp","subtitle":"Stoneware, 42 cm tall","price":"$64","priceNote":"Sold out","badge":"Sold out","badgeIntent":"danger","disabled":true,"actionLabel":"Sold out","action":{"action":"buy","context":{"sku":"lamp-ceramic-table"}}},{"id":"lamp_rattan","component":"ProductCard","title":"Rattan Lantern Lamp","subtitle":"Rattan, 30 cm tall","price":"$48","priceNote":"In stock","actionLabel":"Add to order","action":{"action":"buy","context":{"sku":"lamp-rattan-lantern"}}},{"id":"order","component":"ConfirmReceipt","title":"Your order","items":[{"label":"Brass Arc Floor Lamp","quantity":2,"amount":"$378"}],"totalLabel":"Total","totalPath":"/order/total","data":{"order":{"total":"$378"}},"status":"pending","confirmAction":{"action":"confirm_order"},"backAction":{"action":"back"}}}]}},{"version":"v1.0","updateDataModel":{"surfaceId":"storefront-1","path":"/order","value":{"total":"$378"}}}]'
    for (const [s, at, count] of [[palette, 565, 3], [cart, 1778, 2]] as const) {
      expect(s[at]).toBe('}')
      expect(stringifiedMessages({ messages: s })).toEqual(JSON.parse(s.slice(0, at) + s.slice(at + 1)))
      expect(stringifiedMessages({ messages: s })).toHaveLength(count)
    }
    expect(renderSurfaceJsonl({ messages: palette }).split('\n')).toHaveLength(3)
    expect(messagesParseNote({ messages: palette })).toBe(
      'Your `messages` was not valid JSON: it has one } too many at character 565, after message 2 (its updateDataModel) ends, here: `"},{"label":"900","value":"#12304D"}]}}}},{"version":"v1.0",`.',
    )
    expect(messagesParseNote({ messages: cart })).toBe(
      'Your `messages` was not valid JSON: it has one } too many at character 1778, in message 1 (its updateComponents), here: `_order"},"backAction":{"action":"back"}}}]}},{"version":"v1.`.',
    )
    // Two defects are never edited: a second surplus closer, a surplus closer and a missing one, a truncated tail.
    const twice = palette.replace('"sample":"New statement"}]}}]', '"sample":"New statement"}}]}}]')
    const andShort = cart.replace('"value":{"total":"$378"}}}]', '"value":{"total":"$378"}}]')
    for (const s of [twice, andShort, cart.slice(0, -2)]) {
      expect(stringifiedMessages({ messages: s })).toBeUndefined()
      expect(renderSurfaceJsonl({ messages: s })).toBe('')
    }
    // Dropping the closer must leave an array of messages: a bare object or a non-object entry stays unparsed.
    expect(stringifiedMessages({ messages: '{"version":"v1.0"}}' })).toBeUndefined()
    expect(stringifiedMessages({ messages: '[1,2]]' })).toBeUndefined()
    expect(messagesParseNote({ messages: '[1,2]]' })).not.toMatch(/too many/)
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

describe('"form of payment" is a phrase, not a form surface (T-0408)', () => {
  const concierge = ['Card', 'Text', 'BookingForm', 'BookingConfirmation']
  const payment = [
    'make me a form of payment',
    'build me a form of payment',
    'build a form of payment',
    'what forms of payment do you take',
    'make me a form of payment, please',
  ]
  it.each(payment)('no override with no catalog types: %s', (t) => expect(detectUserOverride(intent(t))).toBeUndefined())
  it.each(payment)('no override in a catalog that owns form: %s', (t) =>
    expect(detectUserOverride(intent(t), concierge)).toBeUndefined())
  it.each(['make me a form', 'build a form for the booking', 'make me a form of the order details'])(
    'surface still forced: %s',
    (t) => {
      expect(detectUserOverride(intent(t))).toBe('surface')
      expect(detectUserOverride(intent(t), concierge)).toBe('surface')
    },
  )
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
  const concierge = ['Card', 'Text', 'BookingForm', 'BookingConfirmation']
  it.each([
    ['as a card', croupier],
    ['Show me the cards as a table.', croupier],
    ['as a table', croupier],
    ['build me a form', concierge],
    ['make me a summary card', croupier],
    ['show me a summary card', croupier],
    ['show me a pricing table', croupier],
    ['show me a booking form', concierge],
    ['build me a card', croupier],
  ])('explicit format phrasing forces a surface where the catalog owns the noun (T-0354): %s', (t, types) =>
    expect(detectUserOverride(intent(t), types)).toBe('surface'))
  it.each([
    'show me a card',
    'show me a hole card',
    'show me the summary card',
    'show me the cards',
    'build the cards',
    'make me a table of contents',
    'build me a deck of cards',
    'make me a pair of cards',
    'make me a lucky card',
    'I worked as a card dealer',
    'seat me as a table captain',
    'render it as a form',
  ])('croupier: an owned noun without a format signal is no override (T-0354): %s', (t) =>
    expect(detectUserOverride(intent(t), croupier)).toBeUndefined())
  it.each([
    'show me a form',
    'show me the form',
    'make me a lucky form',
    'I work as a form designer',
    'render it as a form',
  ])('concierge: an owned noun without a format signal is no override (T-0354): %s', (t) =>
    expect(detectUserOverride(intent(t), concierge)).toBeUndefined())
  it('owning a noun never makes a phrase more surface-forcing than the default catalog (T-0354)', () => {
    for (const t of ['render it as a form', 'I worked as a card dealer', 'make me a table of contents', 'build me a deck of cards']) {
      expect(detectUserOverride(intent(t), base)).toBeUndefined()
    }
  })
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
