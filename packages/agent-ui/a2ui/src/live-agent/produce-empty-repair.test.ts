// produce-empty-repair.test.ts: T-0499. Live round 16 cluster Q (regress-concierge-spa-booking-haiku-1 :13, Haiku 5.5):
// round 1 answered a confirm in prose with a target meta-line and no tool (SURFACE_MISSING), the forced round 2 came back
// empty (no text, no tool call) and was filed PARSE, so round 3 got the PARSE hint, answered note-only, and the confirm
// shipped in prose. An empty round after a semantic repair now re-sends that repair ask with its forced render; an empty
// round with no semantic repair before it still gets the PARSE hint. Keyless, scripted provider.

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { buildRequestBody } from '../agent/providers/anthropic.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { hospitalityFragment } from '../catalog/domains/hospitality/manifest.ts'
import { hospitalitySemanticChecks } from '../catalog/domains/hospitality/checks.ts'

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
