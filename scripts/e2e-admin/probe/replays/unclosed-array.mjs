// T-0450: the helpers the round 13 and 14 unclosed-array replays share (croupier-haiku-deck-string-unclosed,
// concierge-haiku-confirm-text-unclosed, concierge-haiku-confirm-string-unclosed, concierge-haiku-spa-string-unclosed),
// T-0578's round 18 shopkeeper-haiku-repair-parse-keeps-ask and T-0583's round 19 claim replays.
import { produce } from '../../../../packages/agent-ui/a2ui/src/agent/produce.ts'
import { nodeCatalogResolver } from '../../../../packages/agent-ui/a2ui/tools/testkit/load.node.ts'
import { replaySemanticChecks } from '../trace.ts'

export const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
export const shipped = (record) => record.lines.map((l) => JSON.parse(l)).flatMap((m) => m.updateComponents?.components.map((c) => c.component) ?? [])

/** The JSON a text holds once the one `]` JSON.parse stopped for is put back. */
export const closedLine = (s) => {
  try {
    return JSON.parse(s)
  } catch (err) {
    const pos = Number(/position (\d+)/.exec(err.message)[1])
    return JSON.parse(`${s.slice(0, pos)}]${s.slice(pos)}`)
  }
}

/** The requests produce() sends while turn `t`'s recorded rounds play in order, on the session the replay shipped
 *  before it, so a test reads the repair text the model got. */
export async function repairRequests(fixture, report, t, catalogId) {
  const catalog = nodeCatalogResolver(process.cwd())(catalogId)
  const session = {
    turns: report.records.slice(0, t).flatMap((r, i) => [
      { role: 'user', content: fixture.turns[i].input.kind === 'intent' ? fixture.turns[i].input.text : JSON.stringify(fixture.turns[i].input.message) },
      { role: 'assistant', content: r.lines.filter((l) => !l.includes('"a2uiMeta"')).join('\n') },
    ]),
  }
  const rounds = fixture.turns[t].rounds
  const requests = []
  let n = 0
  const provider = {
    async *stream(req) {
      requests.push(req)
      const round = rounds[Math.min(n++, rounds.length - 1)]
      const tool = round.tools.find((x) => x.name === 'render_surface')
      if (tool !== undefined) await req.executeTool?.(tool.name, tool.input, req.signal)
      yield round.text
    },
  }
  const deps = { provider, retrieve: () => [], catalog, semanticChecks: replaySemanticChecks(catalog) }
  for await (const _line of produce({ ...fixture.turns[t].input, session }, deps, { maxRounds: 3 })) void _line
  return requests
}
