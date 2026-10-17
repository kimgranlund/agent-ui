// produce-forced-surface.test.ts: T-0298. Live round 6 (2026-10-15-r6-matrix :2 and :75, Haiku 5.5) answered a deal
// press with a target meta-line and prose, no render_surface call, through every repair round. A repair round after a
// no-payload round with a semantic finding (ACTION_NOT_APPLIED) now asks for render_surface by name. The seam carries
// `toolChoice`; the Anthropic body maps it to `tool_choice` only with thinking off (the API rejects a forced choice
// with extended thinking), so T-0301 asks for thinking off on that round, which the capability row grants or drops.
// T-0310 (Kim's R8 ruling, 2026-10-16): round 1 of a click turn is forced the same way where the row allows it (Haiku
// 5.5 up to high), an experiment against r7's 12 round-1 no-tool calls; a typed turn and a Sonnet click are unchanged.
// Each request is built through the real `buildRequestBody`. Keyless, scripted provider.

import { describe, it, expect } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { ProduceOptions } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { buildRequestBody } from '../agent/providers/anthropic.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import type { SemanticCheck } from '../catalog/semantic-check.ts'
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

type SeamRequest = Parameters<AgentProvider['stream']>[0]

/** Each round's seam request and the Anthropic body built from it exactly as `anthropicProvider().stream` builds it. */
async function requests(outputs: string[], opts: Partial<ProduceOptions>, input: TurnInput = press): Promise<Array<{ req: SeamRequest; body: Record<string, unknown> }>> {
  let n = 0
  const out: Array<{ req: SeamRequest; body: Record<string, unknown> }> = []
  const provider: AgentProvider = {
    async *stream(req) {
      out.push({ req, body: buildRequestBody(req) })
      yield outputs[Math.min(n++, outputs.length - 1)]!
    },
  }
  for await (const _ of produce(input, { provider, retrieve: () => [], catalog, semanticChecks: croupierSemanticChecks }, { maxRounds: 3, model: 'claude-haiku-5-5', ...opts })) void _
  return out
}

/** Each round's Anthropic body. */
async function bodies(outputs: string[], opts: Partial<ProduceOptions>, input: TurnInput = press): Promise<Array<Record<string, unknown>>> {
  return (await requests(outputs, opts, input)).map((r) => r.body)
}

const FORCED = { type: 'tool', name: 'render_surface' }

describe('produce(): a repair round after a no-tool ACTION_NOT_APPLIED round forces render_surface (T-0298)', () => {
  it('Haiku with thinking off: a no-tool round 1 is repaired by a forced round 2', async () => {
    for (const opts of [{}, { effort: 'low' as const }, { effort: 'medium' as const, modelSettings: { thinking: 'disabled' as const } }]) {
      const b = await bodies([PROSE, DEAL], opts)
      expect(b, JSON.stringify(opts)).toHaveLength(2)
      expect(b[1]!.tool_choice, JSON.stringify(opts)).toEqual(FORCED)
    }
  })

  it('T-0301 Haiku at effort medium (thinking on): the forced round 2 turns thinking off and forces the tool', async () => {
    const b = await bodies([PROSE, DEAL], { effort: 'medium' })
    expect(b).toHaveLength(2)
    expect(b[1]!.thinking).toEqual({ type: 'disabled' })
    expect(b[1]!.output_config).toEqual({ effort: 'medium' })
    expect(b[1]!.tool_choice).toEqual(FORCED)
  })

  it('T-0301 a model whose row has no thinking off at this effort keeps thinking and is not forced', async () => {
    const b = await bodies([PROSE, DEAL], { effort: 'xhigh' })
    expect(b).toHaveLength(2)
    expect(b[1]!.thinking).toMatchObject({ type: 'adaptive' })
    expect(b[1]!.tool_choice).toBeUndefined()
  })

  it('a round that passes is never followed by a forced round', async () => {
    const b = await bodies([DEAL], {})
    expect(b).toHaveLength(1)
  })
})

const typed: TurnInput = { kind: 'intent', text: 'Deal me in.', session: press.session }

describe('produce(): round 1 of a Haiku click turn forces render_surface with thinking off (T-0310, R8)', () => {
  it('Haiku 5.5 click turn, effort unset to high: round 1 sends thinking disabled and tool_choice render_surface', async () => {
    for (const opts of [{}, { effort: 'low' as const }, { effort: 'medium' as const }, { effort: 'high' as const }]) {
      const b = await bodies([DEAL], opts)
      expect(b, JSON.stringify(opts)).toHaveLength(1)
      expect(b[0]!.thinking, JSON.stringify(opts)).toEqual({ type: 'disabled' })
      expect(b[0]!.tool_choice, JSON.stringify(opts)).toEqual(FORCED)
    }
  })

  it('Haiku 5.5 at xhigh (no thinking off in its row): round 1 is not forced', async () => {
    const [r] = await requests([DEAL], { effort: 'xhigh' })
    expect(r!.req.toolChoice).toBeUndefined()
    expect(r!.req.modelSettings).toBeUndefined()
    expect(r!.body.tool_choice).toBeUndefined()
  })

  it('a typed-message Haiku turn is unchanged: round 1 carries no toolChoice and no thinking override', async () => {
    const [r] = await requests([DEAL], { effort: 'medium' }, typed)
    expect(r!.req.toolChoice).toBeUndefined()
    expect(r!.req.modelSettings).toBeUndefined()
    expect(r!.body.thinking).toMatchObject({ type: 'adaptive' })
    expect(r!.body.tool_choice).toBeUndefined()
  })

  it('a Sonnet 5.5 click turn is unchanged: round 1 carries no toolChoice and no thinking override', async () => {
    const [r] = await requests([DEAL], { model: 'claude-sonnet-5-5', effort: 'medium' })
    expect(r!.req.toolChoice).toBeUndefined()
    expect(r!.req.modelSettings).toBeUndefined()
    expect(r!.body.thinking).toMatchObject({ type: 'adaptive' })
    expect(r!.body.tool_choice).toBeUndefined()
  })
})

// T-0321 (round 8 cluster B, 2026-10-16-r8-matrix :169, Haiku 5.5): round 1 built a read-back the composite check sent
// back, rounds 2 and 3 answered in prose with thinking on and no tool call, and the T-0302 fallback shipped round 1. A
// SURFACE_DROPPED repair round is now forced the T-0298 way, and the fallback never ships a round a check failed.
describe('produce(): T-0321 a SURFACE_DROPPED repair round is forced; the fallback skips a check-failed round', () => {
  const flagCheck: SemanticCheck = {
    id: 'flag',
    check: ({ surfaces }) =>
      surfaces.flatMap((v) => [...v.components.values()].filter((c) => typeof c['text'] === 'string' && c['text'].startsWith('flagged')).map((c) => ({ code: 'FLAGGED', path: `${v.surfaceId}:${c.id}`, message: `${c.id} is flagged: drop the word.` }))),
  }
  const surface = (sid: string, text: string): string =>
    `{"version":"v1.0","createSurface":{"surfaceId":"${sid}","catalogId":"agent-ui--croupier"}}\n` +
    `{"version":"v1.0","updateComponents":{"surfaceId":"${sid}","components":[{"id":"root","component":"Text","text":"${text}"}]}}`
  const FLAGGED = `{"a2uiMeta":{"note":"Here it is."}}\n${surface('ask-1', 'flagged read-back')}`
  const PROSE_ONLY = '{"a2uiMeta":{"note":"Booked, see you then."}}\nYour spa slot is booked.'
  const PARSE = '{"a2uiMeta":{"note":"Here it is."}}\n{"version":"v1.0","createSurface":'
  const ask = { surfaceId: 'ask-1' }

  async function turn(outputs: string[], maxRounds: number, model = 'claude-haiku-5-5'): Promise<{ reqs: SeamRequest[]; bodies: Array<Record<string, unknown>>; lines: string[]; halt: ProduceHalt | undefined }> {
    let n = 0
    const reqs: SeamRequest[] = []
    const provider: AgentProvider = {
      async *stream(req) {
        reqs.push(req)
        yield outputs[Math.min(n++, outputs.length - 1)]!
      },
    }
    const lines: string[] = []
    let halt: ProduceHalt | undefined
    try {
      for await (const l of produce(typed, { provider, retrieve: () => [], catalog, semanticChecks: [flagCheck] }, { maxRounds, model, effort: 'medium' })) lines.push(l)
    } catch (e) {
      if (!(e instanceof ProduceHalt)) throw e
      halt = e
    }
    return { reqs, bodies: reqs.map((r) => buildRequestBody(r)), lines, halt }
  }
  const codesOf = (lines: string[]): string[] | undefined => lines.map((l) => readMetaLine(l)?.a2uiMeta.trace).find((t) => t !== undefined)?.failureCodes
  const contentOf = (lines: string[]): string[] => lines.filter((l) => readMetaLine(l) === undefined)

  it('a prose round that drops a built surface is followed by a forced Haiku round with thinking off', async () => {
    const { reqs, bodies } = await turn([FLAGGED, PROSE_ONLY, `{"a2uiMeta":{"note":"Here it is."}}\n${surface('ask-1', 'Your booking form')}`], 3)
    expect(bodies).toHaveLength(3)
    expect(bodies[1]!.tool_choice).toBeUndefined() // round 1 sent a payload, so round 2 is not forced
    expect(reqs[2]!.toolChoice).toEqual({ name: 'render_surface' })
    expect(bodies[2]!.thinking).toEqual({ type: 'disabled' })
    expect(bodies[2]!.tool_choice).toEqual(FORCED)
    expect(reqs[2]!.messages.at(-1)!.content).toContain('SURFACE_DROPPED at ask-1')
  })

  it('a valid round that drops a built surface is followed by a forced round too', async () => {
    const both = `{"a2uiMeta":{"note":"Here it is."}}\n${surface('ask-1', 'Your booking form')}\n${surface('ask-2', 'flagged read-back')}`
    // T-0328: only a surface that would have shipped counts, so the round drops the clean ask-1, not the flagged ask-2.
    const one = `{"a2uiMeta":{"note":"Here it is."}}\n${surface('ask-2', 'Your read-back')}`
    const { reqs, bodies } = await turn([both, one, both.replace('flagged read-back', 'Your read-back')], 3)
    expect(bodies).toHaveLength(3)
    expect(reqs[2]!.messages.at(-1)!.content).toContain('SURFACE_DROPPED at ask-1')
    expect(bodies[2]!.thinking).toEqual({ type: 'disabled' })
    expect(bodies[2]!.tool_choice).toEqual(FORCED)
  })

  it('the fallback never ships a round a check failed: two prose rounds after a flagged round halt with SURFACE_DROPPED', async () => {
    const { lines, halt } = await turn([FLAGGED, PROSE_ONLY, PROSE_ONLY], 3)
    expect(contentOf(lines)).toEqual([])
    expect(codesOf(lines)).toBeUndefined()
    expect(halt?.failures).toEqual([{ code: 'SURFACE_DROPPED', path: 'ask-1' }])
  })

  it('a flagged round then a parse failure on the last round ships no payload and never EARLIER_ROUND_SHIPPED', async () => {
    const { lines, halt } = await turn([FLAGGED, PARSE], 2)
    expect(contentOf(lines)).toEqual([])
    expect(codesOf(lines) ?? []).not.toContain('EARLIER_ROUND_SHIPPED')
    expect(halt === undefined ? codesOf(lines) : halt.failures.map((f) => f.code)).toContain(halt === undefined ? 'SURFACE_DEGRADED' : 'PARSE')
  })

  it('the fallback prefers the latest round no check failed over a later flagged one', async () => {
    const outOfScope =
      '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui--croupier"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Modal","open":true}]}}'
    const scoped = `{"a2uiMeta":{"note":"pick one","ask":${JSON.stringify(ask)}}}\n${outOfScope}`
    const { lines, halt } = await turn([scoped, FLAGGED, PARSE], 3)
    expect(halt).toBeUndefined()
    expect(codesOf(lines)).toEqual(['PARSE', 'FEED_SCOPE_RESCOPED', 'TEXT_JSONL_ROUTED', 'EARLIER_ROUND_SHIPPED']) // the typed turn's text rounds are routed
    expect(contentOf(lines).join('\n')).toContain('"component":"Modal"')
    expect(contentOf(lines).join('\n')).not.toContain('flagged')
  })
})
