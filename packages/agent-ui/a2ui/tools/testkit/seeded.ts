// seeded.ts: the kit's seeded-defect layer (T-0011, Kim's 2026-10-05 ruling). Each fixture under
// `tools/testkit/__seeded__/<layer>/` is a known defect pinned to the layer and code that must catch it,
// protected by the T-0005 pin file. Red-then-green: a seeded fixture is accepted by nothing and rejected
// with its pinned code; a fixture that comes back green, or red with another layer or code, reds the kit.
//
// Three document kinds, parsed with the scenario parser's strictness (`ScenarioError` with a JSON path):
//   - a scenario (`agent-ui-a2ui-scenario`) carrying `expectRed`;
//   - `agent-ui-a2ui-seeded-catalog`: delete `dropEntries` from a copy of the LIVE selection sidecar
//     guidance of `catalogId`, then judge the bijection (a frozen copy would red with a loader code as soon
//     as the selection loader rules tighten, not with the bijection);
//   - `agent-ui-a2ui-seeded-mcp`: one MCP call through the real client against a scripted server.
// A doc whose `expectRed.layer` differs from its directory name is a `ScenarioError`.
//
// `domFreeRunner` builds `run()` for every doc that needs no DOM. A scenario doc is judged turn by turn, in
// order, with no mount and no transport matching: order checks, heal, the seeded verdict with the session
// fold, and the producer judge for a `rounds` turn (its input is the intent `turn.intent ?? scenario.intent`).
// Mounted expectations and acts are skipped (`kit.ts run` says so per turn). The renderer layer's runner is
// built only in jsdom legs, through `runScenario` and `mount.ts`.
//
// Node and jsdom only, never a browser leg: it imports catalog-gates.ts (sidecars via `node:fs`), the MCP
// client and producer-leg.ts (prompt files from the repo-root cwd).

import type { Catalog } from '../../src/catalog/catalog.ts'
import { formatErrorLine } from '../../src/agent/meta-line.ts'
import type { Session } from '../../src/agent/agent-transport.ts'
import { selectionGuidanceFor } from '../../src/agent/selection-guidance.ts'
import type { SelectionEntry } from '../../src/agent/selection-guidance.ts'
import { createMcpClient, McpClientError } from '../agent/integrations/mcp/client.ts'
import { bijectionDefects } from './catalog-gates.ts'
import { LAYERS, kitFinding, isKitCode } from './findings.ts'
import type { KitFinding, Layer } from './findings.ts'
import { judgeTurnLines } from './judge.ts'
import { judgeProduce, runProducerTurn } from './producer-leg.ts'
import { ScenarioError, isErrorTurn, isLinesTurn, isRoundsTurn, parseExpectRed, parseScenarioDoc } from './scenario.ts'
import type { A2uiScenario } from './scenario.ts'
import type { McpServerScript } from './scripted-mcp.ts'
import { scriptedMcpServer } from './scripted-mcp.ts'

export interface SeededCatalogDoc {
  kind: 'agent-ui-a2ui-seeded-catalog'
  version: 1
  name: string
  /** Resolved by the caller's catalog resolver. */
  catalogId: string
  /** Type names deleted from the LIVE sidecar guidance before judging. */
  dropEntries: string[]
  expectRed: { layer: 'catalog'; code: string }
}

export interface SeededMcpDoc {
  kind: 'agent-ui-a2ui-seeded-mcp'
  version: 1
  name: string
  /** `scriptedMcpServer`'s script. */
  server: McpServerScript
  call: { tool: string; arguments: Record<string, unknown> }
  /** The MCP client's per-request timeout. */
  timeoutMs: number
  expectRed: { layer: 'integration'; code: string }
}

export type SeededDoc = (A2uiScenario & { expectRed: { layer: Layer; code: string } }) | SeededCatalogDoc | SeededMcpDoc

export interface SeededFixture {
  name: string
  layer: Layer
  expectRed: { layer: Layer; code: string }
  run(): Promise<KitFinding[]>
}

// ---- parsing ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new ScenarioError(`${path}.${key}`, 'unknown field')
}

function nonEmpty(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new ScenarioError(path, 'must be a non-empty string')
  return value
}

function parseMcpScript(value: unknown, path: string): McpServerScript {
  if (!isObject(value)) throw new ScenarioError(path, 'must be an object')
  onlyKeys(value, ['framing', 'protocolVersion', 'sessionId', 'tools', 'pageSize', 'calls'], path)
  if (value.framing !== undefined && value.framing !== 'json' && value.framing !== 'sse') throw new ScenarioError(`${path}.framing`, 'must be "json" or "sse"')
  if (!Array.isArray(value.tools)) throw new ScenarioError(`${path}.tools`, 'must be an array')
  value.tools.forEach((t, i) => {
    if (!isObject(t) || typeof t.name !== 'string' || !isObject(t.inputSchema)) throw new ScenarioError(`${path}.tools[${i}]`, 'must be { name, inputSchema, ... }')
  })
  if (value.pageSize !== undefined && (!Number.isInteger(value.pageSize) || (value.pageSize as number) < 1)) throw new ScenarioError(`${path}.pageSize`, 'must be an integer >= 1')
  if (value.calls !== undefined) {
    if (!isObject(value.calls)) throw new ScenarioError(`${path}.calls`, 'must be an object')
    for (const [name, step] of Object.entries(value.calls)) {
      const sp = `${path}.calls.${name}`
      if (!isObject(step)) throw new ScenarioError(sp, 'must be an object')
      const arms = ['result', 'error', 'hang'].filter((k) => k in step)
      if (arms.length !== 1) throw new ScenarioError(sp, 'needs exactly one of result, error or hang')
      onlyKeys(step, arms, sp)
      if ('hang' in step && step.hang !== true) throw new ScenarioError(`${sp}.hang`, 'must be true')
    }
  }
  return value as unknown as McpServerScript
}

/** Parse one seeded document found in `__seeded__/<layerDir>/`. */
export function parseSeededDoc(text: string, layerDir: string): SeededDoc {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch (err) {
    throw new ScenarioError('$', `not JSON (${err instanceof Error ? err.message : String(err)})`)
  }
  if (!isObject(doc)) throw new ScenarioError('$', 'must be an object')
  let out: SeededDoc
  if (doc.kind === 'agent-ui-a2ui-scenario') {
    const s = parseScenarioDoc(doc)
    if (s.expectRed === undefined) throw new ScenarioError('$.expectRed', 'a seeded scenario needs expectRed')
    out = s as SeededDoc
  } else if (doc.kind === 'agent-ui-a2ui-seeded-catalog') {
    onlyKeys(doc, ['kind', 'version', 'name', 'catalogId', 'dropEntries', 'expectRed'], '$')
    if (doc.version !== 1) throw new ScenarioError('$.version', 'must be 1')
    if (!Array.isArray(doc.dropEntries) || doc.dropEntries.length === 0) throw new ScenarioError('$.dropEntries', 'must be a non-empty array')
    const dropEntries = doc.dropEntries.map((d, i) => nonEmpty(d, `$.dropEntries[${i}]`))
    const expectRed = parseExpectRed(doc.expectRed, '$.expectRed')
    if (expectRed.layer !== 'catalog') throw new ScenarioError('$.expectRed.layer', 'a seeded catalog doc reds on the catalog layer')
    out = { kind: doc.kind, version: 1, name: nonEmpty(doc.name, '$.name'), catalogId: nonEmpty(doc.catalogId, '$.catalogId'), dropEntries, expectRed: { layer: 'catalog', code: expectRed.code } }
  } else if (doc.kind === 'agent-ui-a2ui-seeded-mcp') {
    onlyKeys(doc, ['kind', 'version', 'name', 'server', 'call', 'timeoutMs', 'expectRed'], '$')
    if (doc.version !== 1) throw new ScenarioError('$.version', 'must be 1')
    const call = doc.call
    if (!isObject(call)) throw new ScenarioError('$.call', 'must be an object')
    onlyKeys(call, ['tool', 'arguments'], '$.call')
    if (!isObject(call.arguments)) throw new ScenarioError('$.call.arguments', 'must be an object')
    if (!Number.isInteger(doc.timeoutMs) || (doc.timeoutMs as number) < 1) throw new ScenarioError('$.timeoutMs', 'must be an integer >= 1')
    const expectRed = parseExpectRed(doc.expectRed, '$.expectRed')
    if (expectRed.layer !== 'integration') throw new ScenarioError('$.expectRed.layer', 'a seeded MCP doc reds on the integration layer')
    out = {
      kind: doc.kind,
      version: 1,
      name: nonEmpty(doc.name, '$.name'),
      server: parseMcpScript(doc.server, '$.server'),
      call: { tool: nonEmpty(call.tool, '$.call.tool'), arguments: call.arguments },
      timeoutMs: doc.timeoutMs as number,
      expectRed: { layer: 'integration', code: expectRed.code },
    }
  } else {
    throw new ScenarioError('$.kind', 'must be agent-ui-a2ui-scenario, agent-ui-a2ui-seeded-catalog or agent-ui-a2ui-seeded-mcp')
  }
  if (out.expectRed.layer !== layerDir) throw new ScenarioError('$.expectRed.layer', `is ${out.expectRed.layer} but the fixture sits in __seeded__/${layerDir}/`)
  return out
}

// ---- the DOM-free runner ----

export interface RunnerDeps {
  resolveCatalog(catalogId: string): Catalog | undefined
}

function catalogOf(deps: RunnerDeps, catalogId: string): Catalog {
  const catalog = deps.resolveCatalog(catalogId)
  if (catalog === undefined) throw new ScenarioError('$.catalogId', `unknown catalog ${catalogId}`)
  return catalog
}

/** Judge a scenario's turns in order, DOM-free (see the module header). */
export async function runScenarioDomFree(scenario: A2uiScenario, deps: RunnerDeps): Promise<KitFinding[]> {
  const catalog = catalogOf(deps, scenario.catalogId)
  const findings: KitFinding[] = []
  let session: Session = { turns: [] }
  for (const [i, turn] of scenario.turns.entries()) {
    const turnPath = `$.turns[${i}]`
    let lines: string[]
    let respondPath: string
    if (isLinesTurn(turn)) {
      lines = turn.respond.lines
      respondPath = `${turnPath}.respond.lines`
    } else if (isErrorTurn(turn)) {
      lines = [formatErrorLine(turn.respond.error)]
      respondPath = `${turnPath}.respond.error`
    } else if (isRoundsTurn(turn)) {
      const result = await runProducerTurn({ kind: 'intent', text: turn.intent ?? scenario.intent, session }, turn.respond.rounds, catalog, {
        ...(turn.respond.tools !== undefined ? { tools: turn.respond.tools } : {}),
        ...(turn.respond.maxRounds !== undefined ? { maxRounds: turn.respond.maxRounds } : {}),
      })
      findings.push(...judgeProduce(result, turn.expect, turnPath))
      lines = result.lines
      respondPath = `${turnPath}.respond.rounds`
    } else continue
    const judged = judgeTurnLines(lines, { turn, catalog, catalogId: scenario.catalogId, session, respondPath, turnPath })
    findings.push(...judged.findings)
    session = judged.session
  }
  return findings
}

async function runCatalogDoc(doc: SeededCatalogDoc, deps: RunnerDeps): Promise<KitFinding[]> {
  const catalog = catalogOf(deps, doc.catalogId)
  const patched: Record<string, SelectionEntry> = { ...selectionGuidanceFor(catalog) }
  for (const t of doc.dropEntries) delete patched[t]
  return bijectionDefects(patched, Object.keys(catalog.components)).map((d) => kitFinding('SELECTION_BIJECTION', { path: doc.catalogId, detail: d }))
}

async function runMcpDoc(doc: SeededMcpDoc): Promise<KitFinding[]> {
  const server = scriptedMcpServer(doc.server)
  const client = createMcpClient({ endpoint: 'http://kit.invalid/mcp', fetchImpl: server.fetchImpl, timeoutMs: doc.timeoutMs })
  try {
    const init = await client.initialize()
    if (!init.ok) return [kitFinding('MCP_PARSE', { detail: `unsupported protocol version ${init.negotiated}` })]
    const result = await client.callTool(doc.call.tool, doc.call.arguments)
    return result.isError === true ? [kitFinding('MCP_TOOL_ERROR', { detail: JSON.stringify(result.content) })] : []
  } catch (err) {
    if (!(err instanceof McpClientError)) throw err
    const code = `MCP_${err.code.toUpperCase().replace(/-/g, '_')}`
    return [isKitCode(code) ? kitFinding(code, { detail: err.message }) : { layer: 'integration', code, detail: err.message }]
  }
}

/** True when a seeded doc needs a mounted renderer to red (a scenario with a mounted expectation or act). */
export function seededNeedsDom(doc: SeededDoc): boolean {
  return doc.kind === 'agent-ui-a2ui-scenario' && doc.turns.some((t) => t.act !== undefined || ['tree', 'bindings', 'clientMessages', 'dataModel'].some((k) => t.expect?.[k as 'tree'] !== undefined))
}

/** The DOM-free `run()` for a seeded doc. */
export function domFreeRunner(doc: SeededDoc, deps: RunnerDeps): () => Promise<KitFinding[]> {
  if (doc.kind === 'agent-ui-a2ui-seeded-catalog') return () => runCatalogDoc(doc, deps)
  if (doc.kind === 'agent-ui-a2ui-seeded-mcp') return () => runMcpDoc(doc)
  return () => runScenarioDomFree(doc, deps)
}

export function seededFixture(doc: SeededDoc, run: () => Promise<KitFinding[]>): SeededFixture {
  return { name: doc.name, layer: doc.expectRed.layer, expectRed: doc.expectRed, run }
}

// ---- the red-then-green judge ----

/**
 * Run every fixture and compare its FIRST finding with its `expectRed`: green is `SEEDED_NOT_RED`, red with
 * another layer or code is `SEEDED_WRONG_CODE`; a member of `layers` with no fixture is
 * `SEEDED_LAYER_UNCOVERED`. The `SEEDED_*` codes take the fixture's (or the uncovered) layer.
 */
export async function runSeeded(fixtures: readonly SeededFixture[], layers: readonly Layer[] = LAYERS): Promise<KitFinding[]> {
  const out: KitFinding[] = []
  for (const f of fixtures) {
    const found = await f.run()
    const first = found[0]
    if (first === undefined) out.push({ layer: f.layer, code: 'SEEDED_NOT_RED', path: f.name, detail: `expected ${f.expectRed.layer}/${f.expectRed.code}, got green` })
    else if (first.layer !== f.expectRed.layer || first.code !== f.expectRed.code) {
      out.push({ layer: f.layer, code: 'SEEDED_WRONG_CODE', path: f.name, detail: `expected ${f.expectRed.layer}/${f.expectRed.code}, got ${first.layer}/${first.code}` })
    }
  }
  const covered = new Set(fixtures.map((f) => f.layer))
  for (const layer of layers) if (!covered.has(layer)) out.push({ layer, code: 'SEEDED_LAYER_UNCOVERED', detail: `no seeded fixture for layer ${layer}` })
  return out
}
