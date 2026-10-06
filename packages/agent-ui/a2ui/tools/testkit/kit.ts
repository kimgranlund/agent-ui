// kit.ts: the A2UI test kit CLI (T-0011). Keyless and offline by construction: every command arms the
// tripwire first. Run from the repo root via Node type-stripping:
//
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts <cmd>
//
//   selftest [--repo-root <dir>]   Verifies the pins of every __seeded__/<layer>/, parses every scenario
//                                  and seeded doc, checks that every layer has a seeded fixture, runs every
//                                  green scenario's DOM-free legs (must stay green) and every DOM-free
//                                  seeded fixture (every layer except renderer) against its pinned code,
//                                  then its own negative control: a known-green fixture must come back
//                                  SEEDED_NOT_RED. Runs in `check:scripts`.
//   run <file>                     Runs the DOM-free legs of one scenario or seeded doc. Prints
//                                  `<file>: red layer=<layer> code=<code>` per finding and
//                                  `skip: needs DOM` once per turn with a mounted expectation or an act.
//   list [--repo-root <dir>]       One line per scenario: `<file>  catalog=<id>  tags=<comma list>`.
//
// Exit codes: 0 green, 1 red, 2 usage error or a missing or unparseable file.
//
// Two roots, never three (the `tools/agent-eval/eval-agent-behavior.ts` precedent): `--repo-root`
// redirects only the kit data dir (`scenarios/`, `__seeded__/`). Catalogs, selection sidecars and producer
// prompts always load from `process.cwd()`, because selection-guidance.ts and system-prompt.ts read cwd at
// module load. `run <file>` resolves `<file>` against cwd. The kit reads no `.env`.
//
// The static import closure holds no DOM module and no JSON-module import (no mount.ts, interaction.ts or
// catalogs.ts): plain Node runs it. The renderer layer's seeded fixture runs in the jsdom leg.

import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { armOffline } from './offline.ts'
import { LAYERS, formatFinding } from './findings.ts'
import type { KitFinding, Layer } from './findings.ts'
import { ScenarioError, needsDom, parseScenario } from './scenario.ts'
import type { A2uiScenario } from './scenario.ts'
import { KIT_REL, loadKitData, nodeCatalogResolver, verifyKitPins } from './load.node.ts'
import { domFreeRunner, parseSeededDoc, runScenarioDomFree, runSeeded, seededFixture, seededNeedsDom } from './seeded.ts'
import type { SeededDoc, SeededFixture } from './seeded.ts'

export interface CliOptions {
  /** Test hook: skip selftest's own negative control; selftest then returns 1. */
  skipNegativeControl?: boolean
  /** Output sinks (default the console). */
  out?: (line: string) => void
  err?: (line: string) => void
}

export function helpText(): string {
  return [
    'kit: the A2UI test kit CLI (T-0011)',
    '',
    'usage: node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts <command>',
    '',
    '  selftest [--repo-root <dir>]   pins, parse, layer coverage, DOM-free seeded fixtures (check:scripts)',
    '  run <file>                     the DOM-free legs of one scenario or seeded doc',
    '  list [--repo-root <dir>]       every scenario with its catalog and tags',
    '',
    'exit codes: 0 green, 1 red, 2 usage error or a missing or unparseable file',
  ].join('\n')
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const idx = argv.indexOf(`--${name}`)
  return idx === -1 ? undefined : argv[idx + 1]
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Every object anywhere under `v`, depth first. */
function* objectsIn(v: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(v)) for (const x of v) yield* objectsIn(x)
  else if (isObject(v)) {
    yield v
    for (const x of Object.values(v)) yield* objectsIn(x)
  }
}

/**
 * A scenario's `list` tags, derived from content: the respond arms it uses (`lines`, `rounds`, `error`),
 * `act`, `no-response` (it has an act, and some object inside one of its `lines` carries
 * `"wantResponse": false`: a content scan, not an act-to-component mapping), `persona` (catalogId contains
 * `--`) and `a2ui-basic` (catalogId starts with `a2ui-basic`).
 */
export function scenarioTags(s: A2uiScenario): string[] {
  const tags = new Set<string>()
  let lineObjects: Record<string, unknown>[] = []
  for (const t of s.turns) {
    if ('lines' in t.respond) {
      tags.add('lines')
      for (const line of t.respond.lines) {
        try {
          lineObjects = lineObjects.concat([...objectsIn(JSON.parse(line))])
        } catch {
          // an unparseable line carries no tag
        }
      }
    }
    if ('rounds' in t.respond) tags.add('rounds')
    if ('error' in t.respond) tags.add('error')
    if (t.act !== undefined) tags.add('act')
  }
  if (tags.has('act') && lineObjects.some((o) => o.wantResponse === false)) tags.add('no-response')
  if (s.catalogId.includes('--')) tags.add('persona')
  if (s.catalogId.startsWith('a2ui-basic')) tags.add('a2ui-basic')
  return [...tags]
}

class SetupError extends Error {}

function parseKitData(kitDir: string): { scenarios: { name: string; scenario: A2uiScenario }[]; seeded: { name: string; doc: SeededDoc }[] } {
  const data = loadKitData(kitDir)
  const wrap = <T>(name: string, f: () => T): T => {
    try {
      return f()
    } catch (err) {
      if (err instanceof ScenarioError) throw new SetupError(`${name}: ${err.message}`)
      throw err
    }
  }
  return {
    scenarios: data.scenarios.map((f) => ({ name: f.name, scenario: wrap(f.name, () => parseScenario(f.raw)) })),
    seeded: data.seeded.map((f) => ({ name: f.name, doc: wrap(f.name, () => parseSeededDoc(f.raw, f.layer!)) })),
  }
}

async function selftest(repoRoot: string, opts: CliOptions, out: (l: string) => void, err: (l: string) => void): Promise<number> {
  const kitDir = join(repoRoot, KIT_REL)
  const red: string[] = []
  const pinProblems = verifyKitPins(kitDir)
  for (const p of pinProblems) red.push(`pins: ${p}`)
  if (pinProblems.length === 0) out('selftest: pins ok')

  let parsed: ReturnType<typeof parseKitData>
  try {
    parsed = parseKitData(kitDir)
  } catch (e) {
    if (e instanceof SetupError) {
      err(`selftest: ${e.message}`)
      return 2
    }
    throw e
  }
  if (parsed.scenarios.length === 0) {
    err('selftest: no scenarios under scenarios/')
    return 2
  }
  out(`selftest: parsed ${parsed.scenarios.length} scenarios and ${parsed.seeded.length} seeded fixtures`)

  const resolveCatalog = nodeCatalogResolver(process.cwd())
  const present = new Set<Layer>(parsed.seeded.map((s) => s.doc.expectRed.layer))
  for (const layer of LAYERS) if (!present.has(layer)) red.push(formatFinding({ layer, code: 'SEEDED_LAYER_UNCOVERED' }))

  for (const { name, scenario } of parsed.scenarios) {
    const found = await runScenarioDomFree(scenario, { resolveCatalog })
    for (const f of found) red.push(`${name}: ${formatFinding(f)}`)
    if (found.length === 0) out(`green ${name}`)
  }

  const fixtures: SeededFixture[] = []
  for (const { name, doc } of parsed.seeded) {
    if (seededNeedsDom(doc)) {
      out(`skip: needs DOM ${name} (runs in the jsdom leg src/testkit/seeded.test.ts)`)
      continue
    }
    fixtures.push(seededFixture(doc, domFreeRunner(doc, { resolveCatalog })))
  }
  const seededRed = await runSeeded(fixtures, [])
  for (const f of seededRed) red.push(formatFinding(f))
  if (seededRed.length === 0) out(`selftest: ${fixtures.length} DOM-free seeded fixtures red with their pinned codes`)

  if (opts.skipNegativeControl === true) red.push('negative control skipped')
  else {
    const green = parsed.scenarios.find(({ scenario }) => scenario.turns.every((t) => !needsDom(t)))?.scenario ?? parsed.scenarios[0]!.scenario
    const control: SeededFixture = {
      name: `negative-control:${green.name}`,
      layer: 'validator',
      expectRed: { layer: 'validator', code: 'IDGRAPH' },
      run: () => runScenarioDomFree(green, { resolveCatalog }),
    }
    const verdict = await runSeeded([control], [])
    if (verdict.length === 1 && verdict[0]!.code === 'SEEDED_NOT_RED') out('selftest: negative control ok (a known-green fixture is SEEDED_NOT_RED)')
    else red.push(`negative control did not bite: ${JSON.stringify(verdict)}`)
  }

  for (const r of red) err(`selftest: ${r}`)
  return red.length === 0 ? 0 : 1
}

async function runFile(file: string | undefined, out: (l: string) => void, err: (l: string) => void): Promise<number> {
  if (file === undefined) {
    err('run: needs a file')
    return 2
  }
  const path = isAbsolute(file) ? file : join(process.cwd(), file)
  if (!existsSync(path)) {
    err(`run: no such file ${file}`)
    return 2
  }
  const text = readFileSync(path, 'utf8')
  const parts = relative(process.cwd(), path).split(sep)
  const seededAt = parts.lastIndexOf('__seeded__')
  let doc: SeededDoc | A2uiScenario
  try {
    doc = seededAt >= 0 && parts[seededAt + 1] !== undefined ? parseSeededDoc(text, parts[seededAt + 1]!) : parseScenario(text)
  } catch (e) {
    if (e instanceof ScenarioError) {
      err(`run: ${file}: ${e.message}`)
      return 2
    }
    throw e
  }
  const resolveCatalog = nodeCatalogResolver(process.cwd())
  if (doc.kind === 'agent-ui-a2ui-scenario') doc.turns.forEach((t, i) => (needsDom(t) ? out(`${file}: skip: needs DOM ($.turns[${i}])`) : undefined))
  let findings: KitFinding[]
  try {
    findings = doc.kind === 'agent-ui-a2ui-scenario' ? await runScenarioDomFree(doc, { resolveCatalog }) : await domFreeRunner(doc, { resolveCatalog })()
  } catch (e) {
    if (e instanceof ScenarioError) {
      err(`run: ${file}: ${e.message}`)
      return 2
    }
    throw e
  }
  for (const f of findings) out(`${file}: ${formatFinding(f)}`)
  const domSkipped = doc.kind === 'agent-ui-a2ui-scenario' && doc.turns.some(needsDom)
  if (findings.length === 0) out(`${file}: green${domSkipped ? ' (DOM-free legs only; the mounted checks run in the jsdom legs)' : ''}`)
  return findings.length === 0 ? 0 : 1
}

function list(repoRoot: string, out: (l: string) => void, err: (l: string) => void): number {
  let parsed: ReturnType<typeof parseKitData>
  try {
    parsed = parseKitData(join(repoRoot, KIT_REL))
  } catch (e) {
    if (e instanceof SetupError) {
      err(`list: ${e.message}`)
      return 2
    }
    throw e
  }
  for (const { name, scenario } of parsed.scenarios) out(`${name}  catalog=${scenario.catalogId}  tags=${scenarioTags(scenario).join(',')}`)
  return 0
}

/** The CLI body: `argv` excludes the node and script paths. Returns the exit code. */
export async function runCli(argv: readonly string[], repoRoot: string, opts: CliOptions = {}): Promise<number> {
  const out = opts.out ?? ((l: string) => console.log(l))
  const err = opts.err ?? ((l: string) => console.error(l))
  const disarm = armOffline()
  try {
    const cmd = argv[0]
    if (cmd === 'selftest') return await selftest(repoRoot, opts, out, err)
    if (cmd === 'run') return await runFile(argv[1], out, err)
    if (cmd === 'list') return list(repoRoot, out, err)
    err(helpText())
    return 2
  } finally {
    disarm()
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const repoRoot = flagValue(argv, 'repo-root') ?? process.cwd()
  // Red until proven green: if the event loop drains before `runCli` settles, Node exits with this code,
  // never a silent 0. The interval keeps the loop alive meanwhile: the MCP client's `AbortSignal.timeout`
  // timer is unref'd, so a scripted `hang` step would otherwise let the process exit mid-await.
  process.exitCode = 1
  const keepAlive = setInterval(() => {}, 60_000)
  try {
    process.exitCode = await runCli(argv, repoRoot)
  } finally {
    clearInterval(keepAlive)
  }
}

// The CLI entry guard: `main()` runs only as the process entry, never on import, so the vitest `tools`
// project can import `runCli` (GH #112).
if (process.argv[1]?.endsWith('kit.ts')) {
  void main()
}
