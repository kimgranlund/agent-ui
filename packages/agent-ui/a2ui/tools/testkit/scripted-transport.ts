// scripted-transport.ts: the kit's scripted `AgentTransport` (T-0011). It replays a scenario turn by turn,
// matching each incoming `TurnInput` against the next turn's `match` (scenario.ts `matchesInput`).
//
// Every `turn()` call consumes one script position:
//   - `lines` arm: the lines, in order.
//   - `error` arm: one terminal error meta-line (`formatErrorLine`, GH #144).
//   - `rounds` arm: the injected `produceTurn` runs the turn through the real producer (producer-leg.ts) and
//     its judged findings land in `log`. Injected, so this module never imports produce.ts and stays
//     browser-safe; a `rounds` turn with no `produceTurn` is a `ScenarioError`.
//   - an input the turn's `match` rejects: one error line plus `SCRIPT_UNMATCHED` in `log`.
//   - a call past the last turn: one error line plus `SCRIPT_EXHAUSTED` in `log`.
// `log` holds `KitFinding`s (layer `integration` for the script codes, per `KIT_CODE_LAYER`). A runner
// appends it after every pull, which is how a produce outcome reaches the runner through a string stream.

import type { AgentTransport, TurnInput } from '../../src/agent/agent-transport.ts'
import { formatErrorLine } from '../../src/agent/meta-line.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import { kitFinding } from './findings.ts'
import type { KitFinding } from './findings.ts'
import { ScenarioError, isErrorTurn, isLinesTurn, isRoundsTurn, matchesInput } from './scenario.ts'
import type { A2uiScenario, RoundsRespond, ScenarioTurn } from './scenario.ts'

export type RoundsTurn = ScenarioTurn & { respond: RoundsRespond }

/** What a produced turn hands back: the wire lines it streamed and its judged findings. */
export interface ProducedTurn {
  lines: string[]
  findings: KitFinding[]
}

/** The transport-side producer hook: the turn's input, the turn, and its index. */
export type TransportProduce = (input: TurnInput, turn: RoundsTurn, turnIndex: number) => Promise<ProducedTurn>

/** The runner-side producer hook (`runScenario`'s `env.produceTurn`, implemented by producer-leg.ts). */
export type ProduceTurn = (input: TurnInput, turn: RoundsTurn, ctx: { turnIndex: number; catalog: Catalog }) => Promise<ProducedTurn>

export interface ScriptedTransport extends AgentTransport {
  /** Script findings and produced-turn findings, in pull order. */
  readonly log: KitFinding[]
  /** How many script positions have been consumed. */
  readonly pulled: number
}

const describeInput = (input: TurnInput): string =>
  input.kind === 'intent'
    ? `intent ${JSON.stringify(input.text)}`
    : `client ${JSON.stringify((input.message as { action?: { name?: unknown } }).action?.name ?? Object.keys(input.message)[1] ?? 'message')}`

export function createScriptedTransport(scenario: A2uiScenario, opts: { produceTurn?: TransportProduce } = {}): ScriptedTransport {
  const log: KitFinding[] = []
  let next = 0
  return {
    log,
    get pulled() {
      return next
    },
    async *turn(input: TurnInput): AsyncIterable<string> {
      const index = next
      const turn = scenario.turns[index]
      if (turn === undefined) {
        log.push(kitFinding('SCRIPT_EXHAUSTED', { path: `$.turns[${index}]`, detail: `no turn left for ${describeInput(input)}` }))
        yield formatErrorLine(`SCRIPT_EXHAUSTED: no scripted turn ${index}`)
        return
      }
      next += 1
      if (!matchesInput(turn.match, input)) {
        log.push(kitFinding('SCRIPT_UNMATCHED', { path: `$.turns[${index}].match`, detail: `${describeInput(input)} does not match ${JSON.stringify(turn.match)}` }))
        yield formatErrorLine(`SCRIPT_UNMATCHED: turn ${index}`)
        return
      }
      if (isLinesTurn(turn)) {
        for (const line of turn.respond.lines) yield line
        return
      }
      if (isErrorTurn(turn)) {
        yield formatErrorLine(turn.respond.error)
        return
      }
      if (isRoundsTurn(turn)) {
        if (opts.produceTurn === undefined) {
          throw new ScenarioError(`$.turns[${index}].respond.rounds`, 'a rounds turn needs a produceTurn (Node and jsdom only)')
        }
        const produced = await opts.produceTurn(input, turn, index)
        log.push(...produced.findings)
        for (const line of produced.lines) yield line
      }
    },
  }
}
