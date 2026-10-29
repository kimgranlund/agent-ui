// produce-empty-repair.test.ts: T-0499. Live round 16 cluster Q (regress-concierge-spa-booking-haiku-1 :13, Haiku 5.5):
// round 1 answered a confirm in prose with a target meta-line and no tool (SURFACE_MISSING), the forced round 2 came back
// empty (no text, no tool call) and was filed PARSE, so round 3 got the PARSE hint, answered note-only, and the confirm
// shipped in prose. An empty round after a semantic repair now re-sends that repair ask with its forced render; an empty
// round with no semantic repair before it still gets the PARSE hint. Keyless, scripted provider.
// T-0501 (T-0499 verifier note): so do the other forced repairs of a no-payload round, SURFACE_DROPPED (T-0281),
// SURFACE_CLAIMED (T-0442), CHANGE_CLAIMED (T-0448) and the T-0428 change-claim narration repair.
// T-0578: live round 18 cluster R (smoke-shopkeeper-browse-and-add-haiku-2 :43). A forced repair round that comes back
// non-empty but unparseable keeps the ask it was repairing beside the PARSE ask and its location, still forced, while a
// round is left; on the last round it is plain PARSE as before.

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { buildRequestBody } from '../agent/providers/anthropic.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { hospitalityFragment } from '../catalog/domains/hospitality/manifest.ts'
import { hospitalitySemanticChecks } from '../catalog/domains/hospitality/checks.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { croupierFragment } from '../catalog/personas/croupier/manifest.ts'
import { DEAL_TURN, toJsonl } from '../catalog/personas/croupier/hands.fixture.ts'

const catalog = composeCatalog(defaultCatalog, hospitalityFragment, 'hospitality')
const FORM = [
  { version: 'v1.0', createSurface: { surfaceId: 'spa-booking', catalogId: 'agent-ui--hospitality', sendDataModel: true } },
  { version: 'v1.0', updateDataModel: { surfaceId: 'spa-booking', value: { booking: { treatment: 'swedish-60', date: '2026-11-19', time: '15:00', guestName: 'Alex Moreau', guests: 1 } } } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'spa-booking',
      components: [
        {
          id: 'root',
          component: 'BookingForm',
          title: 'Book your spa treatment',
          value: { path: '/booking' },
          fields: [
            { kind: 'select', label: 'Treatment (60 min)', path: 'treatment', required: true, options: [{ label: 'Swedish massage, 60 min, €120', value: 'swedish-60' }] },
            { kind: 'dateSingle', label: 'Date', path: 'date', required: true },
            { kind: 'text', label: 'Guest name', path: 'guestName', required: true },
          ],
        },
      ],
    },
  },
]
  .map((m) => JSON.stringify(m))
  .join('\n')
const confirm: TurnInput = {
  kind: 'intent',
  text: 'Those details are right, please confirm the booking.',
  session: { turns: [{ role: 'user', content: 'Book a 60-minute Swedish massage on Thursday 19 November 2026 at 15:00, name Alex Moreau.' }, { role: 'assistant', content: FORM }] },
}
const PROSE = '{"a2uiMeta":{"note":"All set.","target":{"surfaceId":"spa-booking"}}}\nYour Swedish massage on Thursday 19 November at 15:00 is booked for Alex Moreau.'
const EMPTY = ''
const TOOL_PARSE_HINT = '`messages` is an ARRAY of A2UI message objects'

type SeamRequest = Parameters<AgentProvider['stream']>[0]

async function requests(outputs: string[], input: TurnInput = confirm, maxRounds = 3): Promise<SeamRequest[]> {
  let n = 0
  const reqs: SeamRequest[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req)
      yield outputs[Math.min(n++, outputs.length - 1)]!
    },
  }
  try {
    for await (const _ of produce(input, { provider, retrieve: () => [], catalog, semanticChecks: hospitalitySemanticChecks }, { maxRounds, model: 'claude-haiku-5-5', effort: 'medium' })) void _
  } catch {
    // a halt at the bound is fine here; only the requests are read
  }
  return reqs
}
const lastAsk = (req: SeamRequest): string => {
  const last = req.messages.at(-1)!.content
  return typeof last === 'string' ? last : JSON.stringify(last)
}

describe('produce(): an empty round after a semantic repair keeps that repair (T-0499)', () => {
  it('r1 prose with a target meta-line, r2 empty: r3 re-sends the SURFACE_MISSING ask with render_surface forced', async () => {
    const reqs = await requests([PROSE, EMPTY, PROSE])
    expect(reqs).toHaveLength(3)
    expect(reqs[1]!.toolChoice).toEqual({ name: 'render_surface' })
    expect(lastAsk(reqs[2]!)).toBe(lastAsk(reqs[1]!))
    expect(lastAsk(reqs[2]!)).toContain('SURFACE_MISSING at intent:confirm')
    expect(lastAsk(reqs[2]!)).not.toContain('PARSE')
    expect(lastAsk(reqs[2]!)).not.toContain(TOOL_PARSE_HINT)
    expect(reqs[2]!.messages.at(-2)).toEqual({ role: 'assistant', content: PROSE }) // round 1's attempt, never an empty turn
    expect(reqs[2]!.toolChoice).toEqual({ name: 'render_surface' })
    expect(buildRequestBody(reqs[2]!).tool_choice).toEqual({ type: 'tool', name: 'render_surface' })
    expect(buildRequestBody(reqs[2]!).thinking).toEqual({ type: 'disabled' })
  })

  it('an empty round with no semantic repair before it still gets the PARSE hint, unforced', async () => {
    const reqs = await requests([EMPTY, EMPTY], confirm, 2)
    expect(reqs).toHaveLength(2)
    expect(reqs[0]!.toolChoice).toBeUndefined()
    expect(lastAsk(reqs[1]!)).toMatch(/^.*PARSE/)
    expect(lastAsk(reqs[1]!)).not.toContain('SURFACE_MISSING')
    expect(reqs[1]!.toolChoice).toBeUndefined()
  })
})

const croupier = composeCatalog(defaultCatalog, croupierFragment, 'croupier')
const table: TurnInput = { kind: 'intent', text: 'Check, or call if there is a bet.', session: { turns: [{ role: 'user', content: 'Deal round 3' }, { role: 'assistant', content: toJsonl(DEAL_TURN) }] } }
const CLEAN = '{"a2uiMeta":{"note":"I check behind. You act first."}}\n{"version":"v1.0","updateComponents":{"surfaceId":"table-3","components":[{"id":"messageZone","component":"Text","variant":"body","text":"Dealer stands on 17."}]}}'

async function run(outputs: string[], input: TurnInput, deps: Partial<Parameters<typeof produce>[1]>, maxRounds = 3): Promise<{ reqs: SeamRequest[]; codes: string[] | undefined }> {
  let n = 0
  const reqs: SeamRequest[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req)
      yield outputs[Math.min(n++, outputs.length - 1)]!
    },
  }
  const lines: string[] = []
  try {
    for await (const line of produce(input, { provider, retrieve: () => [], catalog: croupier, ...deps }, { maxRounds, model: 'claude-haiku-5-5', effort: 'medium' })) lines.push(line)
  } catch {
    // a halt at the bound is fine here; the requests are what is read
  }
  const meta = lines.map((l) => readMetaLine(l)?.a2uiMeta).find((m) => m?.trace !== undefined)
  return { reqs, codes: meta?.trace?.failureCodes !== undefined ? [...meta.trace.failureCodes] : undefined }
}

/** The repair ask in `reqs[at]` came back empty; the next request re-sends it, forced, showing the attempt it repaired. */
function expectResent(reqs: SeamRequest[], at: number, code: string, attempt: string): void {
  expect(reqs.length).toBeGreaterThan(at + 1)
  expect(lastAsk(reqs[at]!)).toContain(code)
  expect(reqs[at]!.toolChoice).toEqual({ name: 'render_surface' })
  expect(lastAsk(reqs[at + 1]!)).toBe(lastAsk(reqs[at]!))
  expect(lastAsk(reqs[at + 1]!)).not.toContain('PARSE')
  expect(lastAsk(reqs[at + 1]!)).not.toContain(TOOL_PARSE_HINT)
  expect(reqs[at + 1]!.messages.at(-2)).toEqual({ role: 'assistant', content: attempt }) // the repaired attempt, never an empty turn
  expect(reqs[at + 1]!.toolChoice).toEqual({ name: 'render_surface' })
  expect(buildRequestBody(reqs[at + 1]!).thinking).toEqual({ type: 'disabled' })
}

describe('produce(): an empty round after a SURFACE_DROPPED, SURFACE_CLAIMED or CHANGE_CLAIMED repair keeps that repair (T-0501)', () => {
  it('SURFACE_DROPPED (T-0281): a prose-only retry dropped ask-1 and the repair came back empty: the drop ask is re-sent', async () => {
    const ASK_OUT_OF_SCOPE =
      '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Modal","open":true}]}}'
    const PROSE_ONLY = '{"a2uiMeta":{"note":"press Book table to confirm","ask":{"surfaceId":"ask-1"}}}'
    const intent: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] } }
    const r = await run(['{"a2uiMeta":{"note":"pick one","ask":{"surfaceId":"ask-1"}}}\n' + ASK_OUT_OF_SCOPE, PROSE_ONLY, EMPTY, '{"a2uiMeta":{"note":"pick one"}}\n' + ASK_OUT_OF_SCOPE], intent, { catalog: defaultCatalog }, 4)
    expect(r.reqs).toHaveLength(4)
    expectResent(r.reqs, 2, 'SURFACE_DROPPED at ask-1', PROSE_ONLY)
  })

  it('SURFACE_DROPPED on a valid round (T-0172): an update-only retry is valid but dropped ask-1, then the repair came back empty: the drop ask is re-sent', async () => {
    const ASK_OUT_OF_SCOPE =
      '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Modal","open":true}]}}'
    const r = await run(['{"a2uiMeta":{"note":"Hit or stand? Pick one below.","ask":{"surfaceId":"ask-1"}}}\n' + ASK_OUT_OF_SCOPE, CLEAN, EMPTY, CLEAN], table, {}, 4)
    expect(r.reqs).toHaveLength(4)
    expectResent(r.reqs, 2, 'SURFACE_DROPPED at ask-1', CLEAN)
  })

  it('SURFACE_CLAIMED (T-0442): an ask naming a surface it never creates, then an empty round: the claim ask is re-sent', async () => {
    const ASKED = JSON.stringify({ a2uiMeta: { note: 'Hit or stand? Pick one below.', ask: { surfaceId: 'ask-9' } } })
    const r = await run([ASKED, EMPTY, CLEAN], table, {})
    expect(r.reqs).toHaveLength(3)
    expectResent(r.reqs, 1, 'SURFACE_CLAIMED at ask-9', ASKED)
  })

  it('CHANGE_CLAIMED (T-0448): a targeted change claim with no update, then an empty round: the change ask is re-sent', async () => {
    const CLAIM = JSON.stringify({ a2uiMeta: { note: "Done, the table is now Kim's table.", target: { surfaceId: 'table-3' } } })
    const r = await run([CLAIM, EMPTY, CLEAN], table, {})
    expect(r.reqs).toHaveLength(3)
    expectResent(r.reqs, 1, 'CHANGE_CLAIMED at table-3', CLAIM)
  })

  it('T-0428: a narrated reply that claims a change, then an empty round: the full narration repair is re-sent', async () => {
    const rename: TurnInput = { ...table, text: "Rename the table to Kim's table and show my chips as euros." }
    const SAID = JSON.stringify({ a2uiMeta: { note: "Done: table-3 is now titled Kim's table and your chips show as euros." } })
    const r = await run([SAID, EMPTY, CLEAN], rename, {})
    expect(r.reqs).toHaveLength(3)
    expectResent(r.reqs, 1, 'NARRATED_MECHANICS at table-3', SAID)
    expect(lastAsk(r.reqs[2]!)).not.toContain('send no A2UI lines')
  })

  it('an empty round after a narration-only repair (no change claimed) is not a forced repair: it still gets the PARSE hint', async () => {
    const NARRATED = JSON.stringify({ a2uiMeta: { note: 'There is no hand to hit; the round on table-3 is settled.' } })
    const r = await run([NARRATED, EMPTY, EMPTY], table, {}, 3)
    expect(r.reqs).toHaveLength(2)
    expect(r.reqs[1]!.tools).toBeUndefined()
  })
})

// T-0578: :43 r1 answered "Add the first one to my order." with a storefront meta line and a note (CHANGE_CLAIMED); the
// forced r2 called render_surface with `messages` as a string one closing brace short after the updateComponents message.
const STORE = [
  { version: 'v1.0', createSurface: { surfaceId: 'storefront', catalogId: 'agent-ui' } },
  { version: 'v1.0', updateComponents: { surfaceId: 'storefront', components: [{ id: 'root', component: 'Column', children: ['heading'] }, { id: 'heading', component: 'Text', text: 'Lamps', variant: 'h4' }] } },
]
  .map((m) => JSON.stringify(m))
  .join('\n')
const addFirst: TurnInput = { kind: 'intent', text: 'Add the first one to my order.', session: { turns: [{ role: 'user', content: 'What lamps do you have?' }, { role: 'assistant', content: STORE }] } }
const ADDED = 'Added the Brass Desk Lamp ($84) to your order. The order summary is below the lamps, where you can change the quantity.'
const R1 = `${JSON.stringify({ a2uiMeta: { note: ADDED, target: { surfaceId: 'storefront' } } })}\n\n${ADDED}`
const BRACE_SHORT = '[{"version":"v1.0","updateComponents":{"surfaceId":"storefront","components":[{"id":"root","component":"Column","gap":"md","children":["heading","tiles","order"]},{"id":"heading","component":"Text","text":"Lamps","variant":"h4"},{"id":"tiles","component":"Row","gap":"md","wrap":true,"children":["p_brass","p_ceramic","p_linen","p_oak","p_paper"]},{"id":"p_brass","component":"ProductCard","title":"Brass Desk Lamp","subtitle":"Solid brass, 45 cm arm","price":"$84","badge":"Sale","badgeIntent":"success","actionLabel":"Buy","action":{"action":"buy","context":{"sku":"brass-desk-lamp","name":"Brass Desk Lamp","price":84}}},{"id":"p_ceramic","component":"ProductCard","title":"Ochre Ceramic Table Lamp","subtitle":"Hand-glazed stoneware, 38 cm","price":"$58","badge":"New","badgeIntent":"info","actionLabel":"Buy","action":{"action":"buy","context":{"sku":"ochre-ceramic-table-lamp","name":"Ochre Ceramic Table Lamp","price":58}}},{"id":"p_linen","component":"ProductCard","title":"Linen Drum Pendant","subtitle":"Natural linen shade, cotton cord","price":"$112","actionLabel":"Buy","action":{"action":"buy","context":{"sku":"linen-drum-pendant","name":"Linen Drum Pendant","price":112}}},{"id":"p_oak","component":"ProductCard","title":"Oak Floor Lamp","subtitle":"Oiled oak base, linen shade","price":"$149","badge":"Sold out","badgeIntent":"danger","actionLabel":"Sold out","disabled":true,"action":{"action":"buy","context":{"sku":"oak-floor-lamp"}}},{"id":"p_paper","component":"ProductCard","title":"Paper Lantern","subtitle":"Folding washi paper, 30 cm","price":"$24","badge":"Sale","badgeIntent":"success","actionLabel":"Buy","action":{"action":"buy","context":{"sku":"paper-lantern","name":"Paper Lantern","price":24}}},{"id":"order","component":"ConfirmReceipt","title":"Your order","data":{"path":"/order"},"items":[{"label":"Brass Desk Lamp","quantity":1,"amount":"$84"}],"totalLabel":"Total","totalPath":"/order/total","status":"pending","confirmAction":{"action":"confirm_order"},"backAction":{"action":"back"}}]},{"version":"v1.0","updateDataModel":{"surfaceId":"storefront","path":"/order","value":{"total":"$84"}}}]'
const CLOSED = BRACE_SHORT.replace('{"action":"back"}}]},{"version"', '{"action":"back"}}]}},{"version"')
type Round = string | { messages: string }

async function storefront(rounds: Round[], maxRounds = 3): Promise<{ reqs: SeamRequest[]; lines: string[] }> {
  let n = 0
  const reqs: SeamRequest[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req)
      const round = rounds[Math.min(n++, rounds.length - 1)]!
      if (typeof round === 'string') {
        yield round
        return
      }
      await req.executeTool?.('render_surface', { reply: ADDED, target: 'storefront', messages: round.messages }, req.signal)
      yield ''
    },
  }
  const lines: string[] = []
  try {
    for await (const line of produce(addFirst, { provider, retrieve: () => [], catalog: defaultCatalog }, { maxRounds, model: 'claude-haiku-5-5', effort: 'medium' })) lines.push(line)
  } catch {
    // a halt at the bound is fine here; the requests are what is read
  }
  return { reqs, lines }
}

describe('produce(): an unparseable forced repair round keeps its repair ask and the forced render_surface (T-0578)', () => {
  it('r1 claims a change, r2 sends a string one brace short: r3 is forced and names CHANGE_CLAIMED and the parse location, and its update ships', async () => {
    expect(() => JSON.parse(BRACE_SHORT)).toThrow(/position 2028/)
    const { reqs, lines } = await storefront([R1, { messages: BRACE_SHORT }, { messages: CLOSED }])
    expect(reqs).toHaveLength(3)
    expect(lastAsk(reqs[1]!)).toContain('CHANGE_CLAIMED at storefront')
    expect(reqs[1]!.toolChoice).toEqual({ name: 'render_surface' })
    expect(lastAsk(reqs[2]!)).toContain('CHANGE_CLAIMED at storefront')
    expect(lastAsk(reqs[2]!)).toContain('PARSE')
    expect(lastAsk(reqs[2]!)).toContain('a closing } is missing in message 1')
    expect(reqs[2]!.messages.at(-2)!.content).toContain(BRACE_SHORT) // the string as sent, so the location names text the model can see
    expect(reqs[2]!.toolChoice).toEqual({ name: 'render_surface' })
    expect(buildRequestBody(reqs[2]!).thinking).toEqual({ type: 'disabled' })
    const shipped = lines.flatMap((l) => {
      const m = JSON.parse(l)
      return m.updateComponents?.surfaceId === 'storefront' ? m.updateComponents.components.map((c: { component: string }) => c.component) : []
    })
    expect(shipped).toContain('ConfirmReceipt')
    const trace = lines.map((l) => readMetaLine(l)?.a2uiMeta?.trace).find((t) => t !== undefined)
    expect(trace?.failureCodes).not.toContain('CHANGE_CLAIM_UNCORRECTED')
  })

  it('on the last round an unparseable forced repair stays plain PARSE: no round is left to repair it', async () => {
    const { reqs, lines } = await storefront([R1, { messages: BRACE_SHORT }], 2)
    expect(reqs).toHaveLength(2)
    expect(lastAsk(reqs[1]!)).toContain('CHANGE_CLAIMED at storefront')
    const trace = lines.map((l) => readMetaLine(l)?.a2uiMeta?.trace).find((t) => t !== undefined)
    expect(trace?.failureCodes).toEqual(['PARSE', 'SURFACE_DEGRADED']) // the repair ask is not carried past the last round
  })
})
