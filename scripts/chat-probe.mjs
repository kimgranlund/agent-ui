#!/usr/bin/env node
/**
 * scripts/chat-probe.mjs: drive the real agent-admin Test Chat headless, live or replayed, and check it
 * (T-0174).
 *
 * Live (spends API credit): boots its own `vite dev` (the dev proxy holds the key server-side and writes
 * the `.agent-traces/` line), opens the admin app on a preset, picks the model and effort through the
 * composer's pickers, plays `--say` and `--click` steps in order, and records per turn the request, the
 * wire lines, the trace line, the surfaces, the chat prose, the render lint and a full-page screenshot.
 * Writes `<out>/report.json`, the PNGs and `<out>/fixture.json` (the run as a keyless replay), prints a
 * short table, and exits 1 when a named check fails.
 *
 * Replay (keyless): `--replay <fixture.json>` answers every model call from the fixture.
 * `--from-trace <spec>` turns trace lines into a fixture plus a vitest regression (default folder
 * `scripts/e2e-admin/probe/replays/`). `selftest` is the fast DOM-free leg (in `check:scripts`);
 * `selftest --browser` replays the selftest fixtures in the real page.
 *
 * Exit codes: 0 pass, 1 a check failed, a selftest case missed or teardown was unverified, 2 usage or setup.
 * The typed modules live in scripts/e2e-admin/probe/; `playwright` loads only on a browser path.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPortReleased, freePort, killTree, waitForHttp } from './lib/dev-server.mjs'
import { SetupError } from './e2e-admin/runner.ts'
import { parseProbeCli, PROBE_USAGE } from './e2e-admin/probe/cli.ts'
import { FixtureError, parseProbeFixture } from './e2e-admin/probe/model.ts'
import { runBrowserSelftest, runProbeSelftest } from './e2e-admin/probe/selftest.ts'
import { fixtureFromTrace, readTraceEntries, regressionTestText, resolveTraceSpec, TRACE_DIR } from './e2e-admin/probe/trace.ts'
import { scrubJson } from './e2e-admin/scenario.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KIT = { freePort, waitForHttp, killTree, assertPortReleased }
const REPLAYS_DIR = path.join(ROOT, 'scripts', 'e2e-admin', 'probe', 'replays')

function usage(message) {
  console.error(`chat-probe: ${message}`)
  console.error(PROBE_USAGE)
  process.exit(2)
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

let command
try {
  command = parseProbeCli(process.argv.slice(2))
} catch (err) {
  if (err instanceof SetupError) usage(err.message)
  throw err
}

if (command.mode === 'selftest') {
  if (!command.browser) process.exit(await runProbeSelftest())
  process.exit(await runBrowserSelftest(KIT, ROOT, path.join(ROOT, TRACE_DIR, 'probe', `selftest-${stamp()}`)))
}

if (command.mode === 'from-trace') {
  let entries
  try {
    entries = resolveTraceSpec(readTraceEntries(path.join(ROOT, TRACE_DIR)), command.spec)
  } catch (err) {
    usage(err instanceof Error ? err.message : String(err))
  }
  const first = entries[0].line
  const name = command.name ?? `${first.agent ?? 'agent'}-${entries[0].id.replace(/\.jsonl:/, '-')}`.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
  const fixture = await fixtureFromTrace(entries, name, process.cwd())
  const out = path.resolve(process.cwd(), command.out ?? REPLAYS_DIR)
  mkdirSync(out, { recursive: true })
  writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(scrubJson(fixture, process.env), null, 2)}\n`)
  writeFileSync(path.join(out, `${name}.test.mjs`), regressionTestText(name, fixture.source ?? command.spec))
  console.log(`[chat-probe] ${entries.length} trace turn(s) -> ${path.relative(process.cwd(), path.join(out, `${name}.json`))}`)
  console.log(`[chat-probe] regression: npx vitest run ${path.relative(process.cwd(), path.join(out, `${name}.test.mjs`))}`)
  console.log(`[chat-probe] browser replay: npm run chat:probe -- --replay ${path.relative(process.cwd(), path.join(out, `${name}.json`))}`)
  process.exit(0)
}

let fixture
if (command.replay !== undefined) {
  try {
    fixture = parseProbeFixture((await import('node:fs')).readFileSync(path.resolve(process.cwd(), command.replay), 'utf8'))
  } catch (err) {
    usage(`${command.replay}: ${err instanceof FixtureError || err instanceof Error ? err.message : String(err)}`)
  }
}
const name = command.name ?? fixture?.name ?? `${command.agent}-probe`
const plan = {
  mode: fixture !== undefined ? 'replay' : 'live',
  name,
  agent: fixture?.agent ?? command.agent,
  // A replay's answers are fixed, so only a live probe picks a model and effort (and checks they landed).
  ...(fixture === undefined && command.model !== undefined ? { model: command.model } : {}),
  ...(fixture === undefined && command.effort !== undefined ? { effort: command.effort } : {}),
  steps: command.steps.length > 0 ? command.steps : fixture.steps,
  expectComponents: [...command.expectComponents, ...(fixture?.expect?.components ?? [])],
  out: path.resolve(process.cwd(), command.out ?? path.join(TRACE_DIR, 'probe', `${name}-${stamp()}`)),
  ...(fixture !== undefined ? { fixture } : {}),
}
const { fixtureFromReport, runProbes, writeReport } = await import('./e2e-admin/probe/run.ts')
const code = await runProbes([plan], KIT, ROOT, (report, p) => {
  writeReport(report, p.out)
  if (p.mode === 'live') {
    writeFileSync(path.join(p.out, 'fixture.json'), `${JSON.stringify(scrubJson(fixtureFromReport(report), process.env), null, 2)}\n`)
    console.log(`[chat-probe] keyless replay of this run: npm run chat:probe -- --replay ${path.relative(process.cwd(), path.join(p.out, 'fixture.json'))}`)
  }
})
process.exit(code === 3 ? 1 : code) // 3: teardown unverified, red
