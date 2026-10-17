// produce-dropped-finding.test.ts: T-0330. Live round 9 (2026-10-17-r9-matrix :157, Haiku 5.5) built a booking
// read-back on ask-1 (BOOKING_FORM_MISSING), answered round 2 in prose (SURFACE_DROPPED), and the forced round 3 resent
// the same read-back, which shipped SEMANTIC_UNCORRECTED: the SURFACE_DROPPED repair asked for ask-1 back and never
// restated why it failed. The repair for a dropped surface now carries the missing-composite finding bound to it
// (T-0299). Keyless, scripted provider, the concierge catalog and its composite rows.

import { describe, it, expect } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { conciergeFragment } from '../catalog/personas/concierge/manifest.ts'
import { conciergeSemanticChecks } from '../catalog/personas/concierge/checks.ts'
import { compositeMomentChecks } from '../catalog/composite-moments.ts'
import { gateChecksOnCatalog } from '../catalog/semantic-check.ts'

const catalog = composeCatalog(defaultCatalog, conciergeFragment, 'concierge')
const semanticChecks = gateChecksOnCatalog([...conciergeSemanticChecks, ...compositeMomentChecks], catalog)
const input: TurnInput = { kind: 'intent', text: 'Book the first one for Thursday 19 November 2026 at 15:00, one guest, name Alex Moreau.', session: { turns: [] } }

// :157 round 1, less its update to the session's spa-menu: a hand-built read-back on ask-1.
const READ_BACK =
  '{"a2uiMeta":{"note":"Here is your booking. Shall I confirm it?","ask":{"surfaceId":"ask-1"}}}\n' +
  '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui--concierge","sendDataModel":true}}\n' +
  '{"version":"v1.0","updateDataModel":{"surfaceId":"ask-1","path":"/booking","value":{"treatment":"swedish-massage","date":"2026-11-19","time":"15:00","guests":1,"guestName":"Alex Moreau"}}}\n' +
  JSON.stringify({
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'ask-1',
      components: [
        { id: 'root', component: 'Card', children: ['ask_header', 'ask_content', 'ask_footer'] },
        { id: 'ask_header', component: 'CardHeader', children: ['ask_title'] },
        { id: 'ask_title', component: 'Text', variant: 'h4', text: 'Confirm your spa booking' },
        { id: 'ask_content', component: 'CardContent', children: ['receipt'] },
        { id: 'receipt', component: 'DescriptionList', rows: [{ label: 'Treatment', value: 'Swedish massage' }, { label: 'Date', value: 'Thursday 19 November 2026' }, { label: 'Time', value: '15:00' }] },
        { id: 'ask_footer', component: 'CardFooter', child: 'confirm_btn' },
        { id: 'confirm_btn', component: 'Button', label: 'Confirm booking', variant: 'solid', action: { action: 'confirm_booking', context: { booking: { path: '/booking' } }, submit: true } },
      ],
    },
  })
// :157 round 2: prose only.
const PROSE = '{"a2uiMeta":{"note":"Review the details and press Confirm booking when they are right.","target":{"surfaceId":"ask-1"}}}'

const surface = (sid: string, components: unknown[], meta = '{"a2uiMeta":{"note":"Here it is."}}'): string =>
  `${meta}\n{"version":"v1.0","createSurface":{"surfaceId":"${sid}","catalogId":"agent-ui--concierge"}}\n` + JSON.stringify({ version: 'v1.0', updateComponents: { surfaceId: sid, components } })
const TABLE = surface('table-1', [{ id: 'root', component: 'Text', text: 'Swedish massage, 60 minutes, 120 euros.' }])
const both = (a: string, b: string): string => `${a}\n${b.split('\n').slice(1).join('\n')}`
const FORM = surface('ask-1', [{ id: 'root', component: 'BookingForm', title: 'Spa booking', fields: [{ kind: 'text', path: 'name', label: 'Name' }], value: { path: '/booking' } }])

async function turn(outputs: string[], maxRounds = 3): Promise<{ reqs: string[]; halt: ProduceHalt | undefined }> {
  let n = 0
  const reqs: string[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req.messages.at(-1)!.content)
      yield outputs[Math.min(n++, outputs.length - 1)]!
    },
  }
  let halt: ProduceHalt | undefined
  try {
    for await (const _ of produce(input, { provider, retrieve: () => [], catalog, semanticChecks }, { maxRounds })) void _
  } catch (e) {
    if (!(e instanceof ProduceHalt)) throw e
    halt = e
  }
  return { reqs, halt }
}

const RESTATED = /Earlier this turn `ask-1` failed: ask-1 hand-builds [^]*?\. Resend it fixed, not as it was\./

describe('produce(): a SURFACE_DROPPED repair restates the composite finding the dropped surface still fails (T-0330)', () => {
  it(':157 shape (a prose round drops ask-1): round 3 restates BOOKING_FORM_MISSING in the hint, the failures list unchanged', async () => {
    const { reqs } = await turn([READ_BACK, PROSE, READ_BACK])
    expect(reqs).toHaveLength(3)
    expect(reqs[1]).toContain('BOOKING_FORM_MISSING at ask-1:receipt')
    expect(reqs[2]).toContain('INVALID (SURFACE_DROPPED at ask-1).')
    expect(reqs[2]).toMatch(RESTATED)
    expect(reqs[2]).not.toContain('contradictions inside your content') // SEMANTIC_HINT stays out
    const { halt } = await turn([READ_BACK, PROSE, PROSE])
    expect(halt?.failures).toEqual([{ code: 'SURFACE_DROPPED', path: 'ask-1' }])
  })

  it('a valid round that drops ask-1 restates it too, and the keep hint still names table-1', async () => {
    const { reqs } = await turn([both(READ_BACK, TABLE), TABLE, both(READ_BACK, TABLE)])
    expect(reqs).toHaveLength(3)
    expect(reqs[2]).toContain('INVALID (SURFACE_DROPPED at ask-1).')
    expect(reqs[2]).toMatch(RESTATED)
    expect(reqs[2]).toContain('Keep `table-1` exactly as you sent it')
  })

  it('a surface rebuilt with the composite and then dropped is not restated', async () => {
    const broken = surface('table-1', [{ id: 'root', component: 'Card', child: 'nope' }]) // sends round 2 back, naming table-1 only
    const { reqs } = await turn([READ_BACK, both(FORM, broken), PROSE, FORM], 4)
    expect(reqs).toHaveLength(4)
    expect(reqs[3]).toContain('SURFACE_DROPPED at ask-1')
    expect(reqs[3]).not.toContain('Earlier this turn')
  })

  it("a renamed surface (T-0328) has its own finding restated when it is dropped", async () => {
    const renamed = READ_BACK.replaceAll('ask-1', 'ask-2')
    const { reqs } = await turn([READ_BACK, renamed, PROSE, renamed], 4)
    expect(reqs).toHaveLength(4)
    expect(reqs[3]).toContain('INVALID (SURFACE_DROPPED at ask-2).')
    expect(reqs[3]).toMatch(/Earlier this turn `ask-2` failed: ask-2 hand-builds [^]*? Resend it fixed, not as it was\./)
  })
})
