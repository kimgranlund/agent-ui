// scenario.ts: the A2UI test kit's scenario format (`agent-ui-a2ui-scenario` v1), its strict parser, the
// match rule the scripted transport uses, and the bridge to the recorded backbone (T-0011).
//
// One `*.scenario.json` per scenario, expectations inline per turn (the conformance, T-0005 and
// `RecordedTurn.expectClientMessage` precedent). A turn's reply is one of three arms: `lines` (raw wire
// lines, the atom `RecordedTurn.lines` and T-0010's `respond.lines` share), `rounds` (raw model text per
// producer round, fed to the real `produce()` by producer-leg.ts) or `error` (one terminal error meta-line).
//
// The parser is strict: an unknown key in any kit-owned object is a `ScenarioError` whose `path` names the
// JSON path (T-0010's `scripts/e2e-admin/scenario.ts` precedent). Free-form slots are never key-checked:
// object entries of `lines`, `equals`, `value`, both `input` fields, `input_schema`, and every entry of
// `clientMessages`. Browser-safe: type-only imports plus the zero-dep meta-line module.

import type { RecordedTranscript } from '../../src/agent/recorded-transport.ts'
import type { TurnInput } from '../../src/agent/agent-transport.ts'
import { formatErrorLine } from '../../src/agent/meta-line.ts'
import { LAYERS, isLayer } from './findings.ts'
import type { Layer } from './findings.ts'

export interface A2uiScenario {
  kind: 'agent-ui-a2ui-scenario'
  version: 1
  name: string
  description?: string
  /** Selects the catalog DOCUMENT; the wire `createSurface.catalogId` may differ (conformance/manifest.json catalogsNote). */
  catalogId: string
  /** Turn 0's input text; `toRecordedTranscript` maps it to `RecordedTranscript.intent`. */
  intent: string
  turns: ScenarioTurn[]
  /** Seeded fixtures only: the layer and code this scenario must red with. */
  expectRed?: { layer: Layer; code: string }
}

export interface ScenarioTurn {
  /** Input for turn i >= 1 when turn i-1 produced no client input; a `ScenarioError` on turn 0. */
  intent?: string
  match?: TurnMatch
  respond: TurnRespond
  atFinalize?: boolean
  expect?: TurnExpect
  act?: TurnAct
}

export interface TurnMatch {
  inputKind?: 'intent' | 'client'
  textIncludes?: string
  actionName?: string
}

export type TurnRespond = LinesRespond | RoundsRespond | ErrorRespond
export interface LinesRespond {
  /** Normalized by the parser: an object entry becomes its one-line JSON string. */
  lines: string[]
}
export interface RoundsRespond {
  rounds: (string | ScriptedToolRound)[]
  maxRounds?: number
  tools?: ScriptedToolSpec[]
}
export interface ErrorRespond {
  error: string
}

export type TurnAct = { click: ActTarget } | { setValue: ActTarget & { prop: string; event: string; value: unknown } }
export interface ActTarget {
  surfaceId: string
  select: string
  nth?: number
}

/** A scripted provider round that calls one tool, then yields `then` as the round's model text. */
export interface ScriptedToolRound {
  tool: string
  input: Record<string, unknown>
  then: string
}

/** One scripted tool (scripted-tools.ts): `reply` resolves as the tool's result text, `{throw}` rejects. */
export interface ScriptedToolSpec {
  name: string
  description?: string
  input_schema: Record<string, unknown>
  reply: string | { throw: string }
}

/** heal.ts's closed repair names, minus `single-object-envelope`: per-line heal reports that one for every
 *  one-object line, so the kit drops it from every repair union and a scenario may not list it. */
export const HEAL_REPAIRS = ['fence-strip', 'trailing-comma', 'version-fill'] as const
export type HealRepair = (typeof HEAL_REPAIRS)[number]
export const ENVELOPE_REPAIR = 'single-object-envelope'

export interface TurnExpect {
  heal?: { ok: boolean; repairs?: HealRepair[] }
  verdict?: { valid: boolean; failures: { code: string; path: string }[] }
  produce?: { outcome: 'first-pass' | 'eventual' | 'halt'; rounds?: number; failureCodes?: string[] }
  tree?: TreeExpect[]
  bindings?: { allow?: string[] }
  clientMessages?: Record<string, unknown>[]
  dataModel?: { surfaceId: string; path: string; equals: unknown }[]
  tools?: { tool: string; input: Record<string, unknown> }[]
}

export interface TreeExpect {
  surfaceId: string
  select: string
  count?: number
  textIncludes?: string
  attrs?: Record<string, string | null>
}

export class ScenarioError extends Error {
  override name = 'ScenarioError'
  readonly path: string
  constructor(path: string, problem: string) {
    super(`scenario: ${path}: ${problem}`)
    this.path = path
  }
}

export const isLinesTurn = (t: ScenarioTurn): t is ScenarioTurn & { respond: LinesRespond } => 'lines' in t.respond
export const isRoundsTurn = (t: ScenarioTurn): t is ScenarioTurn & { respond: RoundsRespond } => 'rounds' in t.respond
export const isErrorTurn = (t: ScenarioTurn): t is ScenarioTurn & { respond: ErrorRespond } => 'error' in t.respond

/** The expectations that need a mounted renderer; the rest (`heal`, `verdict`, `produce`, `tools`) are DOM-free. */
export const MOUNTED_EXPECTATIONS = ['tree', 'bindings', 'clientMessages', 'dataModel'] as const

/** True when a turn carries a mounted expectation or an act (a DOM-free runner skips those). */
export function needsDom(turn: ScenarioTurn): boolean {
  return turn.act !== undefined || MOUNTED_EXPECTATIONS.some((k) => turn.expect?.[k] !== undefined)
}

// ---- match ----

/** The match rule: absent accepts anything; `inputKind` equals `input.kind`; `textIncludes` holds only for
 *  an intent whose text includes it; `actionName` holds only for a client action of that name. */
export function matchesInput(match: TurnMatch | undefined, input: TurnInput): boolean {
  if (match === undefined) return true
  if (match.inputKind !== undefined && match.inputKind !== input.kind) return false
  if (match.textIncludes !== undefined && !(input.kind === 'intent' && input.text.includes(match.textIncludes))) return false
  if (match.actionName !== undefined) {
    if (input.kind !== 'client') return false
    const message = input.message as { action?: { name?: unknown } }
    if (message.action?.name !== match.actionName) return false
  }
  return true
}

// ---- the recorded backbone ----

/** Map a scenario to the recorded backbone. A `lines` turn replays its lines; an `error` turn replays its one
 *  error meta-line. A `rounds` turn has no recording (its lines come from the real producer), so it is a
 *  `ScenarioError`. */
export function toRecordedTranscript(scenario: A2uiScenario): RecordedTranscript {
  return {
    intent: scenario.intent,
    turns: scenario.turns.map((t, i) => {
      if (isLinesTurn(t)) return { lines: [...t.respond.lines] }
      if (isErrorTurn(t)) return { lines: [formatErrorLine(t.respond.error)] }
      throw new ScenarioError(`$.turns[${i}].respond.rounds`, 'a rounds turn has no recording; replay it through producer-leg.ts')
    }),
  }
}

// ---- the strict parser ----

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new ScenarioError(`${path}.${key}`, 'unknown field')
  }
}

function obj(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) throw new ScenarioError(path, 'must be an object')
  return value
}

function str(value: unknown, path: string, opts: { nonEmpty?: boolean } = {}): string {
  if (typeof value !== 'string') throw new ScenarioError(path, 'must be a string')
  if (opts.nonEmpty === true && value.length === 0) throw new ScenarioError(path, 'must be a non-empty string')
  return value
}

function optStr(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : str(value, path)
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new ScenarioError(path, 'must be a boolean')
  return value
}

function int(value: unknown, path: string, min: number): number {
  if (!Number.isInteger(value) || (value as number) < min) throw new ScenarioError(path, `must be an integer >= ${min}`)
  return value as number
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ScenarioError(path, 'must be an array')
  return value
}

function strings(value: unknown, path: string): string[] {
  return arr(value, path).map((v, i) => str(v, `${path}[${i}]`))
}

/** Parse and normalize one scenario document. Throws `ScenarioError` naming the first bad JSON path. */
export function parseScenario(text: string): A2uiScenario {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch (err) {
    throw new ScenarioError('$', `not JSON (${err instanceof Error ? err.message : String(err)})`)
  }
  return parseScenarioDoc(doc, '$')
}

/** The same rules over an already-parsed value (seeded scenario docs reuse it). */
export function parseScenarioDoc(doc: unknown, path = '$'): A2uiScenario {
  const d = obj(doc, path)
  onlyKeys(d, ['kind', 'version', 'name', 'description', 'catalogId', 'intent', 'turns', 'expectRed'], path)
  if (d.kind !== 'agent-ui-a2ui-scenario') throw new ScenarioError(`${path}.kind`, 'must be "agent-ui-a2ui-scenario"')
  if (d.version !== 1) throw new ScenarioError(`${path}.version`, 'must be 1')
  const turnsRaw = arr(d.turns, `${path}.turns`)
  if (turnsRaw.length === 0) throw new ScenarioError(`${path}.turns`, 'needs at least one turn')
  const scenario: A2uiScenario = {
    kind: 'agent-ui-a2ui-scenario',
    version: 1,
    name: str(d.name, `${path}.name`, { nonEmpty: true }),
    catalogId: str(d.catalogId, `${path}.catalogId`, { nonEmpty: true }),
    intent: str(d.intent, `${path}.intent`),
    turns: turnsRaw.map((t, i) => parseTurn(t, `${path}.turns[${i}]`, i)),
  }
  const description = optStr(d.description, `${path}.description`)
  if (description !== undefined) scenario.description = description
  if (d.expectRed !== undefined) scenario.expectRed = parseExpectRed(d.expectRed, `${path}.expectRed`)
  return scenario
}

export function parseExpectRed(value: unknown, path: string): { layer: Layer; code: string } {
  const e = obj(value, path)
  onlyKeys(e, ['layer', 'code'], path)
  if (!isLayer(e.layer)) throw new ScenarioError(`${path}.layer`, `must be one of ${LAYERS.join(', ')}`)
  return { layer: e.layer, code: str(e.code, `${path}.code`, { nonEmpty: true }) }
}

function parseTurn(value: unknown, path: string, index: number): ScenarioTurn {
  const t = obj(value, path)
  onlyKeys(t, ['intent', 'match', 'respond', 'atFinalize', 'expect', 'act'], path)
  const respond = parseRespond(t.respond, `${path}.respond`)
  const turn: ScenarioTurn = { respond }
  if (t.intent !== undefined) {
    if (index === 0) throw new ScenarioError(`${path}.intent`, 'turn 0 takes the scenario intent; move it to $.intent')
    turn.intent = str(t.intent, `${path}.intent`)
  }
  if (t.match !== undefined) turn.match = parseMatch(t.match, `${path}.match`)
  if (t.atFinalize !== undefined) turn.atFinalize = bool(t.atFinalize, `${path}.atFinalize`)
  if (t.expect !== undefined) turn.expect = parseExpect(t.expect, `${path}.expect`, respond)
  if (t.act !== undefined) turn.act = parseAct(t.act, `${path}.act`)
  return turn
}

function parseMatch(value: unknown, path: string): TurnMatch {
  const m = obj(value, path)
  onlyKeys(m, ['inputKind', 'textIncludes', 'actionName'], path)
  const out: TurnMatch = {}
  if (m.inputKind !== undefined) {
    if (m.inputKind !== 'intent' && m.inputKind !== 'client') throw new ScenarioError(`${path}.inputKind`, 'must be "intent" or "client"')
    out.inputKind = m.inputKind
  }
  if (m.textIncludes !== undefined) out.textIncludes = str(m.textIncludes, `${path}.textIncludes`)
  if (m.actionName !== undefined) out.actionName = str(m.actionName, `${path}.actionName`)
  return out
}

function parseRespond(value: unknown, path: string): TurnRespond {
  const r = obj(value, path)
  const arms = ['lines', 'rounds', 'error'].filter((k) => k in r)
  if (arms.length !== 1) throw new ScenarioError(path, 'needs exactly one of lines, rounds or error')
  if ('lines' in r) {
    onlyKeys(r, ['lines'], path)
    const lines = arr(r.lines, `${path}.lines`).map((line, j) => {
      if (typeof line === 'string') return line
      if (isObject(line)) return JSON.stringify(line)
      throw new ScenarioError(`${path}.lines[${j}]`, 'must be a string or an object')
    })
    return { lines }
  }
  if ('rounds' in r) {
    onlyKeys(r, ['rounds', 'maxRounds', 'tools'], path)
    const roundsRaw = arr(r.rounds, `${path}.rounds`)
    if (roundsRaw.length === 0) throw new ScenarioError(`${path}.rounds`, 'needs at least one round')
    const rounds = roundsRaw.map((round, j) => {
      const rp = `${path}.rounds[${j}]`
      if (typeof round === 'string') return round
      const o = obj(round, rp)
      onlyKeys(o, ['tool', 'input', 'then'], rp)
      return { tool: str(o.tool, `${rp}.tool`, { nonEmpty: true }), input: obj(o.input, `${rp}.input`), then: str(o.then, `${rp}.then`) }
    })
    const out: RoundsRespond = { rounds }
    if (r.maxRounds !== undefined) out.maxRounds = int(r.maxRounds, `${path}.maxRounds`, 1)
    if (r.tools !== undefined) out.tools = arr(r.tools, `${path}.tools`).map((spec, j) => parseToolSpec(spec, `${path}.tools[${j}]`))
    return out
  }
  onlyKeys(r, ['error'], path)
  return { error: str(r.error, `${path}.error`, { nonEmpty: true }) }
}

export function parseToolSpec(value: unknown, path: string): ScriptedToolSpec {
  const s = obj(value, path)
  onlyKeys(s, ['name', 'description', 'input_schema', 'reply'], path)
  const spec: ScriptedToolSpec = {
    name: str(s.name, `${path}.name`, { nonEmpty: true }),
    input_schema: obj(s.input_schema, `${path}.input_schema`),
    reply: '',
  }
  if (typeof s.reply === 'string') spec.reply = s.reply
  else {
    const reply = obj(s.reply, `${path}.reply`)
    onlyKeys(reply, ['throw'], `${path}.reply`)
    spec.reply = { throw: str(reply.throw, `${path}.reply.throw`, { nonEmpty: true }) }
  }
  const description = optStr(s.description, `${path}.description`)
  if (description !== undefined) spec.description = description
  return spec
}

function parseExpect(value: unknown, path: string, respond: TurnRespond): TurnExpect {
  const e = obj(value, path)
  onlyKeys(e, ['heal', 'verdict', 'produce', 'tree', 'bindings', 'clientMessages', 'dataModel', 'tools'], path)
  const rounds = 'rounds' in respond
  const error = 'error' in respond
  for (const key of ['produce', 'tools'] as const) {
    if (e[key] !== undefined && !rounds) throw new ScenarioError(`${path}.${key}`, 'only a rounds turn may expect it')
  }
  for (const key of ['heal', 'verdict'] as const) {
    if (e[key] !== undefined && error) throw new ScenarioError(`${path}.${key}`, 'an error turn has no content to judge')
  }
  const out: TurnExpect = {}
  if (e.heal !== undefined) {
    const p = `${path}.heal`
    const h = obj(e.heal, p)
    onlyKeys(h, ['ok', 'repairs'], p)
    out.heal = { ok: bool(h.ok, `${p}.ok`) }
    if (h.repairs !== undefined) {
      out.heal.repairs = strings(h.repairs, `${p}.repairs`).map((name, j) => {
        if (name === ENVELOPE_REPAIR) throw new ScenarioError(`${p}.repairs[${j}]`, 'per-line heal reports single-object-envelope for every one-object line; the kit drops it, so never list it')
        if (!(HEAL_REPAIRS as readonly string[]).includes(name)) throw new ScenarioError(`${p}.repairs[${j}]`, `must be one of ${HEAL_REPAIRS.join(', ')}`)
        return name as HealRepair
      })
    }
  }
  if (e.verdict !== undefined) {
    const p = `${path}.verdict`
    const v = obj(e.verdict, p)
    onlyKeys(v, ['valid', 'failures'], p)
    out.verdict = {
      valid: bool(v.valid, `${p}.valid`),
      failures: arr(v.failures, `${p}.failures`).map((f, j) => {
        const fp = `${p}.failures[${j}]`
        const fo = obj(f, fp)
        onlyKeys(fo, ['code', 'path'], fp)
        return { code: str(fo.code, `${fp}.code`, { nonEmpty: true }), path: str(fo.path, `${fp}.path`) }
      }),
    }
  }
  if (e.produce !== undefined) {
    const p = `${path}.produce`
    const pr = obj(e.produce, p)
    onlyKeys(pr, ['outcome', 'rounds', 'failureCodes'], p)
    if (pr.outcome !== 'first-pass' && pr.outcome !== 'eventual' && pr.outcome !== 'halt') {
      throw new ScenarioError(`${p}.outcome`, 'must be "first-pass", "eventual" or "halt"')
    }
    out.produce = { outcome: pr.outcome }
    if (pr.rounds !== undefined) out.produce.rounds = int(pr.rounds, `${p}.rounds`, 1)
    if (pr.failureCodes !== undefined) out.produce.failureCodes = strings(pr.failureCodes, `${p}.failureCodes`)
  }
  if (e.tree !== undefined) {
    out.tree = arr(e.tree, `${path}.tree`).map((t, j) => {
      const p = `${path}.tree[${j}]`
      const to = obj(t, p)
      onlyKeys(to, ['surfaceId', 'select', 'count', 'textIncludes', 'attrs'], p)
      const tree: TreeExpect = { surfaceId: str(to.surfaceId, `${p}.surfaceId`, { nonEmpty: true }), select: str(to.select, `${p}.select`, { nonEmpty: true }) }
      if (to.count !== undefined) tree.count = int(to.count, `${p}.count`, 0)
      if (to.textIncludes !== undefined) tree.textIncludes = str(to.textIncludes, `${p}.textIncludes`)
      if (to.attrs !== undefined) {
        const attrs = obj(to.attrs, `${p}.attrs`)
        tree.attrs = {}
        for (const [name, v] of Object.entries(attrs)) {
          if (v !== null && typeof v !== 'string') throw new ScenarioError(`${p}.attrs.${name}`, 'must be a string or null')
          tree.attrs[name] = v
        }
      }
      return tree
    })
  }
  if (e.bindings !== undefined) {
    const p = `${path}.bindings`
    const b = obj(e.bindings, p)
    onlyKeys(b, ['allow'], p)
    out.bindings = {}
    if (b.allow !== undefined) out.bindings.allow = strings(b.allow, `${p}.allow`)
  }
  if (e.clientMessages !== undefined) {
    out.clientMessages = arr(e.clientMessages, `${path}.clientMessages`).map((m, j) => obj(m, `${path}.clientMessages[${j}]`))
  }
  if (e.dataModel !== undefined) {
    out.dataModel = arr(e.dataModel, `${path}.dataModel`).map((d, j) => {
      const p = `${path}.dataModel[${j}]`
      const dm = obj(d, p)
      onlyKeys(dm, ['surfaceId', 'path', 'equals'], p)
      if (!('equals' in dm)) throw new ScenarioError(`${p}.equals`, 'required')
      return { surfaceId: str(dm.surfaceId, `${p}.surfaceId`, { nonEmpty: true }), path: str(dm.path, `${p}.path`), equals: dm.equals }
    })
  }
  if (e.tools !== undefined) {
    out.tools = arr(e.tools, `${path}.tools`).map((t, j) => {
      const p = `${path}.tools[${j}]`
      const to = obj(t, p)
      onlyKeys(to, ['tool', 'input'], p)
      return { tool: str(to.tool, `${p}.tool`, { nonEmpty: true }), input: obj(to.input, `${p}.input`) }
    })
  }
  return out
}

function parseTarget(value: unknown, path: string, extra: readonly string[]): Record<string, unknown> & ActTarget {
  const t = obj(value, path)
  onlyKeys(t, ['surfaceId', 'select', 'nth', ...extra], path)
  const target: ActTarget = { surfaceId: str(t.surfaceId, `${path}.surfaceId`, { nonEmpty: true }), select: str(t.select, `${path}.select`, { nonEmpty: true }) }
  if (t.nth !== undefined) target.nth = int(t.nth, `${path}.nth`, 0)
  return Object.assign(t, target)
}

function parseAct(value: unknown, path: string): TurnAct {
  const a = obj(value, path)
  const arms = ['click', 'setValue'].filter((k) => k in a)
  if (arms.length !== 1) throw new ScenarioError(path, 'needs exactly one of click or setValue')
  if ('click' in a) {
    onlyKeys(a, ['click'], path)
    const t = parseTarget(a.click, `${path}.click`, [])
    return { click: pickTarget(t) }
  }
  onlyKeys(a, ['setValue'], path)
  const p = `${path}.setValue`
  const t = parseTarget(a.setValue, p, ['prop', 'event', 'value'])
  if (!('value' in t)) throw new ScenarioError(`${p}.value`, 'required')
  return { setValue: { ...pickTarget(t), prop: str(t.prop, `${p}.prop`, { nonEmpty: true }), event: str(t.event, `${p}.event`, { nonEmpty: true }), value: t.value } }
}

function pickTarget(t: ActTarget): ActTarget {
  return { surfaceId: t.surfaceId, select: t.select, ...(t.nth !== undefined ? { nth: t.nth } : {}) }
}
