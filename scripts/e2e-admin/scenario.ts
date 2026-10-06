// scripts/e2e-admin/scenario.ts: the admin scenario fixture format (v1), its strict parser, the record
// scrub, and the one assertion error every flow, page-object wait and wire check raises.
//
// Deliberately NOT a DevtoolsCapture: that format pins `backend` to three ids and replays wire lines only,
// while an admin scenario needs raw meta-lines, error answers, delays and aborts as first-class turns.

export interface AdminScenario {
  kind: 'agent-ui-admin-scenario'
  version: 1
  name: string
  seed?: { localStorage: Record<string, string> }
  /** What GET /__a2ui/agent/status answers. Default `{ available: true, providers: 1 }`. */
  status?: { available: boolean; providers: number }
  turns: ScriptedTurn[]
}

export type ScriptedRespond = { lines: string[] } | { text: string } | { status: number; error: string } | { abort: true }

export interface ScriptedTurn {
  endpoint: 'produce' | 'chat'
  match?: { mission?: boolean; inputKind?: 'intent' | 'client'; textIncludes?: string }
  respond: ScriptedRespond
  delayMs?: number
}

export const DEFAULT_STATUS = { available: true, providers: 1 } as const

/** The red every flow assertion, page-object wait and post-flow wire check raises. A negative control
 *  counts only this class as the expected red; any other throw is a crash. */
export class FlowAssertion extends Error {
  override name = 'FlowAssertion'
}

/** Assert inside a flow: a false condition raises `FlowAssertion` with the given message. */
export function assertFlow(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FlowAssertion(message)
}

/** A scenario that fails validation. `path` is the JSON path of the first bad field. */
export class ScenarioError extends Error {
  override name = 'ScenarioError'
  readonly path: string
  constructor(path: string, problem: string) {
    super(`scenario: ${path}: ${problem}`)
    this.path = path
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new ScenarioError(path === '' ? key : `${path}.${key}`, 'unknown field')
  }
}

function parseRespond(value: unknown, path: string): ScriptedRespond {
  if (value === undefined) throw new ScenarioError(path, 'required')
  if (!isObject(value)) throw new ScenarioError(path, 'must be an object')
  if ('lines' in value) {
    onlyKeys(value, ['lines'], path)
    if (!Array.isArray(value.lines)) throw new ScenarioError(`${path}.lines`, 'must be an array of strings')
    value.lines.forEach((line, j) => {
      if (typeof line !== 'string') throw new ScenarioError(`${path}.lines[${j}]`, 'must be a string')
    })
    return { lines: value.lines as string[] }
  }
  if ('text' in value) {
    onlyKeys(value, ['text'], path)
    if (typeof value.text !== 'string') throw new ScenarioError(`${path}.text`, 'must be a string')
    return { text: value.text }
  }
  if ('status' in value || 'error' in value) {
    onlyKeys(value, ['status', 'error'], path)
    if (!Number.isInteger(value.status) || (value.status as number) < 100 || (value.status as number) > 599) {
      throw new ScenarioError(`${path}.status`, 'must be an HTTP status integer')
    }
    if (typeof value.error !== 'string') throw new ScenarioError(`${path}.error`, 'must be a string')
    return { status: value.status as number, error: value.error }
  }
  if ('abort' in value) {
    onlyKeys(value, ['abort'], path)
    if (value.abort !== true) throw new ScenarioError(`${path}.abort`, 'must be true')
    return { abort: true }
  }
  throw new ScenarioError(path, 'must hold one of lines, text, status+error or abort')
}

function parseTurn(value: unknown, path: string): ScriptedTurn {
  if (!isObject(value)) throw new ScenarioError(path, 'must be an object')
  onlyKeys(value, ['endpoint', 'match', 'respond', 'delayMs'], path)
  if (value.endpoint !== 'produce' && value.endpoint !== 'chat') {
    throw new ScenarioError(`${path}.endpoint`, 'must be "produce" or "chat"')
  }
  const turn: ScriptedTurn = { endpoint: value.endpoint, respond: { abort: true } }
  if (value.match !== undefined) {
    const match = value.match
    if (!isObject(match)) throw new ScenarioError(`${path}.match`, 'must be an object')
    onlyKeys(match, ['mission', 'inputKind', 'textIncludes'], `${path}.match`)
    if (match.mission !== undefined && typeof match.mission !== 'boolean') {
      throw new ScenarioError(`${path}.match.mission`, 'must be a boolean')
    }
    if (match.inputKind !== undefined && match.inputKind !== 'intent' && match.inputKind !== 'client') {
      throw new ScenarioError(`${path}.match.inputKind`, 'must be "intent" or "client"')
    }
    if (match.textIncludes !== undefined && typeof match.textIncludes !== 'string') {
      throw new ScenarioError(`${path}.match.textIncludes`, 'must be a string')
    }
    turn.match = {
      ...(match.mission !== undefined ? { mission: match.mission as boolean } : {}),
      ...(match.inputKind !== undefined ? { inputKind: match.inputKind as 'intent' | 'client' } : {}),
      ...(match.textIncludes !== undefined ? { textIncludes: match.textIncludes as string } : {}),
    }
  }
  turn.respond = parseRespond(value.respond, `${path}.respond`)
  if (value.delayMs !== undefined) {
    if (typeof value.delayMs !== 'number' || !Number.isFinite(value.delayMs) || value.delayMs < 0) {
      throw new ScenarioError(`${path}.delayMs`, 'must be a non-negative number')
    }
    turn.delayMs = value.delayMs
  }
  return turn
}

/** Parse and validate one scenario JSON text. Throws `ScenarioError` naming the first bad field's path. */
export function parseScenario(text: string): AdminScenario {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    throw new ScenarioError('$', `not valid JSON (${err instanceof Error ? err.message : String(err)})`)
  }
  if (!isObject(raw)) throw new ScenarioError('$', 'must be an object')
  onlyKeys(raw, ['kind', 'version', 'name', 'seed', 'status', 'turns'], '')
  if (raw.kind !== 'agent-ui-admin-scenario') throw new ScenarioError('kind', 'must be "agent-ui-admin-scenario"')
  if (raw.version !== 1) throw new ScenarioError('version', 'must be 1')
  if (typeof raw.name !== 'string' || raw.name === '') throw new ScenarioError('name', 'must be a non-empty string')
  const scenario: AdminScenario = { kind: 'agent-ui-admin-scenario', version: 1, name: raw.name, turns: [] }
  if (raw.seed !== undefined) {
    const seed = raw.seed
    if (!isObject(seed)) throw new ScenarioError('seed', 'must be an object')
    onlyKeys(seed, ['localStorage'], 'seed')
    if (!isObject(seed.localStorage)) throw new ScenarioError('seed.localStorage', 'must be an object of strings')
    for (const [key, value] of Object.entries(seed.localStorage)) {
      if (typeof value !== 'string') throw new ScenarioError(`seed.localStorage.${key}`, 'must be a string')
    }
    scenario.seed = { localStorage: { ...(seed.localStorage as Record<string, string>) } }
  }
  if (raw.status !== undefined) {
    const status = raw.status
    if (!isObject(status)) throw new ScenarioError('status', 'must be an object')
    onlyKeys(status, ['available', 'providers'], 'status')
    if (typeof status.available !== 'boolean') throw new ScenarioError('status.available', 'must be a boolean')
    if (!Number.isInteger(status.providers) || (status.providers as number) < 0) {
      throw new ScenarioError('status.providers', 'must be a non-negative integer')
    }
    scenario.status = { available: status.available, providers: status.providers as number }
  }
  if (!Array.isArray(raw.turns)) throw new ScenarioError('turns', 'must be an array')
  scenario.turns = raw.turns.map((turn, i) => parseTurn(turn, `turns[${i}]`))
  return scenario
}

// ── the record scrub ──────────────────────────────────────────────────────────────────────────────────

const KEY_SHAPES: readonly RegExp[] = [/sk-ant-[A-Za-z0-9_-]{16,}/, /sk-[A-Za-z0-9]{32,}/, /AIza[0-9A-Za-z_-]{35}/]
const SECRET_ENV_NAME = /_(KEY|TOKEN|SECRET)$/
const SECRET_ENV_MIN_LENGTH = 12

/** A scrub that refused to let a scenario reach disk. `path` names the offending string. */
export class ScrubRefusal extends Error {
  override name = 'ScrubRefusal'
  readonly path: string
  constructor(path: string, why: string) {
    super(`scrub refused ${path}: ${why}`)
    this.path = path
  }
}

/** Refuse (throw `ScrubRefusal`) when any string in the scenario, key or value, looks like a provider key
 *  or contains the value of an env var named `*_KEY`, `*_TOKEN` or `*_SECRET` of at least 12 characters.
 *  Returns the scenario unchanged when it is clean. The refusal names the JSON path, never the value. */
export function scrubScenario(scenario: AdminScenario, env: Readonly<Record<string, string | undefined>>): AdminScenario {
  const secrets = Object.entries(env)
    .filter(([name, value]) => SECRET_ENV_NAME.test(name) && typeof value === 'string' && value.length >= SECRET_ENV_MIN_LENGTH)
    .map(([name, value]) => ({ name, value: value as string }))
  const inspect = (text: string, path: string): void => {
    for (const shape of KEY_SHAPES) {
      if (shape.test(text)) throw new ScrubRefusal(path, `matches the key shape ${shape.source}`)
    }
    for (const secret of secrets) {
      if (text.includes(secret.value)) throw new ScrubRefusal(path, `contains the value of $${secret.name}`)
    }
  }
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      inspect(value, path)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    if (isObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        const child = path === '' ? key : `${path}.${key}`
        inspect(key, child)
        walk(item, child)
      }
    }
  }
  walk(scenario, '')
  return scenario
}
