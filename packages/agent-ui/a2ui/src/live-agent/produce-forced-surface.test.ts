// produce-forced-surface.test.ts: T-0298. Live round 6 (2026-10-15-r6-matrix :2 and :75, Haiku 5.5) answered a deal
// press with a target meta-line and prose, no render_surface call, through every repair round. A repair round after a
// no-payload round with a semantic finding (ACTION_NOT_APPLIED) now asks for render_surface by name. The seam carries
// `toolChoice`; the Anthropic body maps it to `tool_choice` only with thinking off (the API rejects a forced choice
// with extended thinking), so each request is built through the real `buildRequestBody`. Keyless, scripted provider.

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { ProduceOptions } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { buildRequestBody } from '../agent/providers/anthropic.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { croupierFragment } from '../catalog/personas/croupier/manifest.ts'
import { croupierSemanticChecks } from '../catalog/personas/croupier/checks.ts'

const catalog = composeCatalog(defaultCatalog, croupierFragment, 'croupier')
const TABLE_TURN =
  '{"version":"v1.0","createSurface":{"surfaceId":"table-1","catalogId":"agent-ui--croupier","sendDataModel":true}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[{"id":"root","component":"CardTable","title":"Blackjack","phase":{"path":"/phase"},"bet":{"path":"/bet"},"bankroll":{"path":"/bankroll"},"dealerHand":{"path":"/dealerHand"},"playerHand":{"path":"/playerHand"},"betAction":"deal"}]}}\n' +
  '{"version":"v1.0","updateDataModel":{"surfaceId":"table-1","value":{"phase":"betting","bankroll":1000,"bet":50,"dealerHand":[],"playerHand":[]}}}'
const press: TurnInput = {
  kind: 'client',
  session: { turns: [{ role: 'user', content: 'Black jack' }, { role: 'assistant', content: TABLE_TURN }] },
  message: { version: 'v1.0', action: { surfaceId: 'table-1', actionId: 'a1', name: 'deal', sourceComponentId: 'root', timestamp: '0', context: { bet: 50 }, dataModel: { phase: 'betting', bankroll: 1000, bet: 50, dealerHand: [], playerHand: [] } } },
}
const PROSE = '{"a2uiMeta":{"note":"Dealt.","target":{"surfaceId":"table-1"}}}\nI dealt you a 9 and a 7 for 16; the dealer shows a 10.'
const DEAL =
  '{"a2uiMeta":{"note":"Dealt."}}\n' +
  '{"version":"v1.0","updateDataModel":{"surfaceId":"table-1","value":{"phase":"playing","bankroll":950,"bet":50,"dealerHand":[{"rank":"10","suit":"spades"},{"rank":"6","suit":"clubs","faceDown":true}],"playerHand":[{"rank":"9","suit":"hearts"},{"rank":"7","suit":"clubs"}],"dealerTotal":"10 showing","playerTotal":16}}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[{"id":"root","component":"CardTable","title":"Blackjack","phase":{"path":"/phase"},"bet":{"path":"/bet"},"bankroll":{"path":"/bankroll"},"dealerHand":{"path":"/dealerHand"},"playerHand":{"path":"/playerHand"},"betAction":"deal","children":["hit","stand"]},' +
  '{"id":"hit","component":"Button","label":"Hit","action":{"event":{"name":"hit"}}},{"id":"stand","component":"Button","label":"Stand","action":{"event":{"name":"stand"}}}]}}'

/** Each round's Anthropic body, built from the seam request exactly as `anthropicProvider().stream` builds it. */
async function bodies(outputs: string[], opts: Partial<ProduceOptions>): Promise<Array<Record<string, unknown>>> {
  let n = 0
  const out: Array<Record<string, unknown>> = []
  const provider: AgentProvider = {
    async *stream(req) {
      out.push(buildRequestBody(req))
      yield outputs[Math.min(n++, outputs.length - 1)]!
    },
  }
  for await (const _ of produce(press, { provider, retrieve: () => [], catalog, semanticChecks: croupierSemanticChecks }, { maxRounds: 3, model: 'claude-haiku-5-5', ...opts })) void _
  return out
}

const FORCED = { type: 'tool', name: 'render_surface' }

describe('produce(): a repair round after a no-tool ACTION_NOT_APPLIED round forces render_surface (T-0298)', () => {
  it('Haiku with thinking off: round 1 offers the tool, round 2 forces it', async () => {
    for (const opts of [{}, { effort: 'low' as const }, { effort: 'medium' as const, modelSettings: { thinking: 'disabled' as const } }]) {
      const b = await bodies([PROSE, DEAL], opts)
      expect(b, JSON.stringify(opts)).toHaveLength(2)
      expect(b[0]!.tool_choice, JSON.stringify(opts)).toBeUndefined()
      expect(b[1]!.tool_choice, JSON.stringify(opts)).toEqual(FORCED)
    }
  })

  it('Haiku with thinking on: round 2 is not forced (the API rejects tool_choice with extended thinking)', async () => {
    const b = await bodies([PROSE, DEAL], { effort: 'medium' })
    expect(b).toHaveLength(2)
    expect(b[1]!.thinking).toMatchObject({ type: 'adaptive' })
    expect(b[1]!.tool_choice).toBeUndefined()
  })

  it('a round that passes is never followed by a forced round, and a first round is never forced', async () => {
    const b = await bodies([DEAL], {})
    expect(b).toHaveLength(1)
    expect(b[0]!.tool_choice).toBeUndefined()
  })
})
