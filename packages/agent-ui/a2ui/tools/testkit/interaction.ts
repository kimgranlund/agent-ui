// interaction.ts: the kit's closed loop over a mounted renderer (T-0011): pull a turn from the scripted
// transport, judge order, heal and the seeded verdict, ingest, check the tree, bindings and data model,
// perform the act, check the client messages, then frame the emitted action into the next turn with the
// real `nextTurn` and `shouldRunTurn`. Browser-safe: no produce.ts import; a `rounds` turn needs
// `env.produceTurn` (producer-leg.ts, Node and jsdom only).
//
// `env`:
//   - `resolveCatalog(id)`: the catalog DOCUMENT for `scenario.catalogId` (the judge's verdict catalog).
//     The mounted renderer resolves the wire `createSurface.catalogId` itself from its own registry.
//   - `createMount()`: optional; default `createKitMount()`. The runner disposes it.
//   - `produceTurn`: optional; runs a `rounds` turn and returns its lines and judged findings, which reach
//     the runner through the transport `log`.
//
// Turn advancement: turn 0 runs on the scenario intent. Turn i >= 1 runs on `nextTurn(session, action)`
// when turn i-1's act emitted an action and `shouldRunTurn(action)` holds; otherwise on `turns[i].intent`
// when declared; otherwise the loop ends and any unpulled turn is one `SCRIPT_UNCONSUMED`. So an action
// with `wantResponse: false` runs no turn, and a wrongly pulled turn reds as `SCRIPT_EXHAUSTED`.
//
// Per turn, in order: pull and append the transport `log`; order, heal, verdict (judge.ts); ingest the
// healed messages (meta-lines are never ingested); finalize when `atFinalize`; settle; check `tree`,
// `bindings`, `dataModel`; act and settle again; check `clientMessages` (every message emitted from this
// turn's ingest through the post-act settle, partial deep match per entry, same count); append the turn
// to the session. A `RENDER_ERROR` from any settle becomes one finding and stops the scenario.
//
// Folds: the kit keeps per-surface folds of the ingested messages, because `RendererHost` has no data-model
// accessor. Components by id (`createSurface` resets, `deleteSurface` drops, `updateComponents` upserts,
// the `sessionSurfaceSeeds` rules); the data document mirrors the renderer's `#applyDataModel` (`path`
// absent, `''` or `'/'` replaces; any other path writes through the real `setPointer`). A `setValue`
// writeback lands in the renderer's data signal, not the fold: observe it through the next action's
// `context` or `dataModel` in `clientMessages`.
//
// `bindings` (opt-in per turn, because an unresolved binding is a legitimate render-time placeholder,
// SPEC-R4 AC2): every `{path}` prop in the component fold; an absolute path must resolve to a defined value
// in the folded data; a relative path on the template node of a ChildList `{ componentId, path: P }` with
// absolute P is checked at `P/<i>/<path>` for every index of the array at P. Other relative paths and
// `{call}` bindings are skipped; pointers in `allow` are exempt. Each miss is `BINDING_UNRESOLVED` with
// `path` the absolute pointer and `detail` `<surfaceId>/<componentId>.<prop>`.

import type { TurnInput, Session } from '../../src/agent/agent-transport.ts'
import { nextTurn, shouldRunTurn } from '../../src/agent/session.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import type { A2uiComponent, A2uiServerMessage } from '../../src/protocol.ts'
import type { A2uiClientMessage } from '../../src/renderer/renderer.ts'
import { setPointer } from '../../src/renderer/binding.ts'
import { kitFinding, resultOf } from './findings.ts'
import type { KitFinding, ScenarioResult } from './findings.ts'
import { judgeTurnLines } from './judge.ts'
import { createKitMount, RenderError } from './mount.ts'
import type { KitMount } from './mount.ts'
import { ScenarioError, isRoundsTurn } from './scenario.ts'
import type { A2uiScenario, ActTarget, ScenarioTurn, TurnExpect } from './scenario.ts'
import { createScriptedTransport } from './scripted-transport.ts'
import type { ProduceTurn } from './scripted-transport.ts'

export interface ScenarioEnv {
  resolveCatalog(catalogId: string): Catalog | undefined
  createMount?: () => KitMount
  produceTurn?: ProduceTurn
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---- folds ----

interface SurfaceFold {
  components: Map<string, A2uiComponent>
  data: unknown
}

export function foldMessages(folds: Map<string, SurfaceFold>, messages: readonly A2uiServerMessage[]): void {
  for (const m of messages as unknown as Record<string, unknown>[]) {
    const created = m.createSurface
    if (isObject(created) && typeof created.surfaceId === 'string') {
      folds.set(created.surfaceId, { components: new Map(), data: undefined })
      continue
    }
    const deleted = m.deleteSurface
    if (isObject(deleted) && typeof deleted.surfaceId === 'string') {
      folds.delete(deleted.surfaceId)
      continue
    }
    const update = m.updateComponents
    if (isObject(update) && typeof update.surfaceId === 'string' && Array.isArray(update.components)) {
      const fold = folds.get(update.surfaceId)
      if (fold === undefined) continue
      for (const c of update.components) if (isObject(c) && typeof c.id === 'string') fold.components.set(c.id, c as A2uiComponent)
      continue
    }
    const dm = m.updateDataModel
    if (isObject(dm) && typeof dm.surfaceId === 'string') {
      const fold = folds.get(dm.surfaceId)
      if (fold === undefined) continue
      if (dm.path === undefined || dm.path === '' || dm.path === '/') fold.data = dm.value
      else if (typeof dm.path === 'string') fold.data = setPointer(fold.data, dm.path, dm.value)
    }
  }
}

/** An RFC-6901 read matching binding.ts's private `resolvePointer`: `undefined` on any missing step. */
export function readPointer(doc: unknown, pointer: string): unknown {
  if (pointer === '') return doc
  if (pointer[0] !== '/') return undefined
  let cur: unknown = doc
  for (const raw of pointer.slice(1).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (Array.isArray(cur)) cur = cur[Number(key)]
    else if (isObject(cur)) cur = cur[key]
    else return undefined
    if (cur === undefined) return undefined
  }
  return cur
}

// ---- matchers ----

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (isObject(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]))
  return v
}
export const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/** Partial deep match: every matcher key must match; plain objects recurse; arrays and primitives compare whole. */
export function partialMatch(matcher: unknown, actual: unknown): boolean {
  if (isObject(matcher)) {
    if (!isObject(actual)) return false
    return Object.keys(matcher).every((k) => partialMatch(matcher[k], actual[k]))
  }
  return deepEqual(matcher, actual)
}

// ---- tree ----

function matchList(mount: KitMount, target: { surfaceId: string; select: string }): Element[] {
  const sroot = mount.surfaceRoot(target.surfaceId)
  if (sroot === undefined) return []
  const out: Element[] = []
  if (sroot.matches(target.select)) out.push(sroot)
  out.push(...Array.from(sroot.querySelectorAll(target.select)))
  return out
}

function checkTree(mount: KitMount, tree: NonNullable<TurnExpect['tree']>, path: string): KitFinding[] {
  const out: KitFinding[] = []
  tree.forEach((t, k) => {
    const p = `${path}.expect.tree[${k}]`
    const list = matchList(mount, t)
    const problems: string[] = []
    if (t.count === undefined ? list.length === 0 : list.length !== t.count) {
      problems.push(`${t.select} on ${t.surfaceId}: expected ${t.count === undefined ? 'at least one match' : `${t.count} matches`}, got ${list.length}`)
    }
    const first = list[0]
    if (t.textIncludes !== undefined && !(first?.textContent ?? '').includes(t.textIncludes)) {
      problems.push(`text of the first match does not include ${JSON.stringify(t.textIncludes)} (got ${JSON.stringify(first?.textContent ?? null)})`)
    }
    for (const [name, want] of Object.entries(t.attrs ?? {})) {
      const got = first?.getAttribute(name) ?? null
      if (got !== want) problems.push(`attribute ${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
    }
    if (problems.length > 0) out.push(kitFinding('TREE_MISMATCH', { path: p, detail: problems.join('; ') }))
  })
  return out
}

// ---- bindings ----

const isPathBinding = (v: unknown): v is { path: string } => isObject(v) && typeof v.path === 'string' && Object.keys(v).length === 1

export function checkBindings(folds: Map<string, SurfaceFold>, allow: readonly string[] = []): KitFinding[] {
  const out: KitFinding[] = []
  const allowed = new Set(allow)
  for (const [sid, fold] of folds) {
    // template node id -> its ChildList data path (absolute only)
    const templates = new Map<string, string>()
    for (const c of fold.components.values()) {
      const ch = c.children
      if (isObject(ch) && typeof ch.componentId === 'string' && typeof ch.path === 'string' && ch.path.startsWith('/')) templates.set(ch.componentId, ch.path)
    }
    for (const c of fold.components.values()) {
      for (const [prop, value] of Object.entries(c)) {
        if (prop === 'id' || prop === 'component' || prop === 'child' || prop === 'children' || !isPathBinding(value)) continue
        const where = `${sid}/${c.id}.${prop}`
        const miss = (pointer: string): void => {
          if (!allowed.has(pointer) && readPointer(fold.data, pointer) === undefined) out.push(kitFinding('BINDING_UNRESOLVED', { path: pointer, detail: where }))
        }
        if (value.path.startsWith('/')) miss(value.path)
        else {
          const base = templates.get(c.id)
          if (base === undefined) continue
          const rows = readPointer(fold.data, base)
          if (!Array.isArray(rows)) continue
          const rel = value.path.replace(/^\.?\//, '')
          rows.forEach((_row, i) => miss(`${base}/${i}${rel === '' ? '' : `/${rel}`}`))
        }
      }
    }
  }
  return out
}

// ---- data model ----

function checkDataModel(folds: Map<string, SurfaceFold>, dataModel: NonNullable<TurnExpect['dataModel']>, path: string): KitFinding[] {
  const out: KitFinding[] = []
  dataModel.forEach((d, k) => {
    const got = readPointer(folds.get(d.surfaceId)?.data, d.path)
    if (!deepEqual(got, d.equals)) {
      out.push(kitFinding('DATA_MODEL_MISMATCH', { path: `${path}.expect.dataModel[${k}]`, detail: `${d.surfaceId}${d.path}: expected ${JSON.stringify(d.equals)}, got ${JSON.stringify(got)}` }))
    }
  })
  return out
}

// ---- acts ----

function performAct(mount: KitMount, turn: ScenarioTurn, path: string): KitFinding[] {
  const act = turn.act
  if (act === undefined) return []
  const target: ActTarget = 'click' in act ? act.click : act.setValue
  const el = matchList(mount, target)[target.nth ?? 0]
  if (el === undefined) {
    return [kitFinding('TREE_MISMATCH', { path: `${path}.act`, detail: `act target: no match ${target.nth ?? 0} for ${target.select} on ${target.surfaceId}` })]
  }
  if ('click' in act) (el as HTMLElement).click()
  else {
    ;(el as unknown as Record<string, unknown>)[act.setValue.prop] = act.setValue.value
    el.dispatchEvent(new Event(act.setValue.event, { bubbles: true }))
  }
  return []
}

function checkClientMessages(got: readonly A2uiClientMessage[], want: NonNullable<TurnExpect['clientMessages']>, path: string): KitFinding[] {
  const same = got.length === want.length && want.every((m, i) => partialMatch(m, got[i]))
  if (same) return []
  return [kitFinding('CLIENT_MESSAGE_MISMATCH', { path: `${path}.expect.clientMessages`, detail: `expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}` })]
}

const isAction = (m: A2uiClientMessage): m is Extract<A2uiClientMessage, { action: unknown }> => 'action' in m

// ---- the loop ----

export async function runScenario(scenario: A2uiScenario, env: ScenarioEnv): Promise<ScenarioResult> {
  const catalog = env.resolveCatalog(scenario.catalogId)
  if (catalog === undefined) throw new ScenarioError('$.catalogId', `unknown catalog ${scenario.catalogId}`)
  scenario.turns.forEach((t, i) => {
    if (isRoundsTurn(t) && env.produceTurn === undefined) throw new ScenarioError(`$.turns[${i}].respond.rounds`, 'a rounds turn needs env.produceTurn (Node and jsdom only)')
  })
  const produceTurn = env.produceTurn
  const transport = createScriptedTransport(scenario, produceTurn === undefined ? {} : { produceTurn: (input, turn, turnIndex) => produceTurn(input, turn, { turnIndex, catalog }) })
  const mount = (env.createMount ?? (() => createKitMount()))()
  const findings: KitFinding[] = []
  const folds = new Map<string, SurfaceFold>()
  let session: Session = { turns: [] }
  let input: TurnInput = { kind: 'intent', text: scenario.intent, session }
  let logCursor = 0
  try {
    for (let i = 0; ; i++) {
      const turn = scenario.turns[i]
      const lines: string[] = []
      for await (const line of transport.turn({ ...input, session } as TurnInput)) lines.push(line)
      findings.push(...transport.log.slice(logCursor))
      logCursor = transport.log.length
      if (turn === undefined) break // SCRIPT_EXHAUSTED is in the log
      const turnPath = `$.turns[${i}]`
      const respondPath = `${turnPath}.respond.${'lines' in turn.respond ? 'lines' : 'rounds' in turn.respond ? 'rounds' : 'error'}`
      const judged = judgeTurnLines(lines, { turn, catalog, catalogId: scenario.catalogId, session, respondPath, turnPath })
      findings.push(...judged.findings)
      const emittedBefore = mount.clientMessages().length
      mount.ingest(judged.messages.map((m) => JSON.stringify(m)))
      foldMessages(folds, judged.messages)
      if (turn.atFinalize === true) mount.finalize()
      await mount.settle()
      const expect = turn.expect
      if (expect?.tree !== undefined) findings.push(...checkTree(mount, expect.tree, turnPath))
      if (expect?.bindings !== undefined) findings.push(...checkBindings(folds, expect.bindings.allow))
      if (expect?.dataModel !== undefined) findings.push(...checkDataModel(folds, expect.dataModel, turnPath))
      const emittedBeforeAct = mount.clientMessages().length
      findings.push(...performAct(mount, turn, turnPath))
      if (turn.act !== undefined) await mount.settle()
      const emitted = mount.clientMessages().slice(emittedBefore)
      if (expect?.clientMessages !== undefined) findings.push(...checkClientMessages(emitted, expect.clientMessages, turnPath))
      session = judged.session
      const action = mount.clientMessages().slice(emittedBeforeAct).find(isAction)
      const next = scenario.turns[i + 1]
      if (action !== undefined && shouldRunTurn(action)) input = nextTurn(session, action)
      else if (next?.intent !== undefined) input = { kind: 'intent', text: next.intent, session }
      else {
        if (next !== undefined) findings.push(kitFinding('SCRIPT_UNCONSUMED', { path: `$.turns[${i + 1}]`, detail: `turns ${i + 1}..${scenario.turns.length - 1} were never pulled` }))
        break
      }
    }
  } catch (err) {
    if (!(err instanceof RenderError)) throw err
    findings.push(kitFinding('RENDER_ERROR', { detail: err.detail }))
  } finally {
    mount.dispose()
  }
  return resultOf(scenario.name, findings)
}
