#!/usr/bin/env node
/**
 * scripts/e2e-admin.mjs: keyless, deterministic headless flows over the real agent-admin app.
 *
 * Boots one `vite dev` (OS-allocated port, detached, teardown verified), drives `agent-admin-app.html`
 * in headless Chromium, and answers every `/__a2ui/` request from a scripted scenario fixture, so no
 * request ever reaches the dev proxy or leaves the machine, even when `.env` holds a key. Flows assert on
 * the DOM, the public transcript readers, the wire log and persisted storage. The live-model leg
 * (`record`) needs a key and is a manual run, never a gate.
 *
 * Usage:
 *   node scripts/e2e-admin.mjs [run] [--only <glob>[,<glob>...]] [--fixture <path>]
 *   node scripts/e2e-admin.mjs list
 *   node scripts/e2e-admin.mjs record --flow <name> --out <path>
 *   node scripts/e2e-admin.mjs selftest
 *
 * Exit codes: 0 = pass, 1 = red (a flow failed, a negative control was wrongly green, teardown was
 * unverified, or the record scrub refused), 2 = usage or setup. Arguments are validated before vite boots.
 *
 * The typed modules live in scripts/e2e-admin/ and load through Node's native type stripping; `chromium`
 * loads only inside the run path, so `selftest` and `list` launch no browser.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPortReleased, freePort, killTree, waitForHttp } from './lib/dev-server.mjs'
import { FLOWS, NEGATIVE_CONTROLS } from './e2e-admin/flows/index.ts'
import { recordFlow } from './e2e-admin/record.ts'
import { parseCli, planRun, runFlows, SetupError, USAGE } from './e2e-admin/runner.ts'
import { runSelftest } from './e2e-admin/selftest.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KIT = { freePort, waitForHttp, killTree, assertPortReleased }

function usage(message) {
  console.error(`e2e-admin: ${message}`)
  console.error(USAGE)
  process.exit(2)
}

let command
try {
  command = parseCli(process.argv.slice(2))
} catch (err) {
  if (err instanceof SetupError) usage(err.message)
  throw err
}

if (command.mode === 'list') {
  for (const flow of FLOWS) console.log(flow.name)
  for (const control of NEGATIVE_CONTROLS) console.log(`negative ${control.flow} ${control.fixture}`)
  process.exit(0)
}

if (command.mode === 'selftest') {
  process.exit(await runSelftest())
}

if (command.mode === 'record') {
  const flow = FLOWS.find((f) => f.name === command.flow)
  if (flow === undefined) usage(`record --flow names no registered flow "${command.flow}"`)
  let code
  try {
    code = await recordFlow(flow, command.out, KIT, ROOT, process.cwd())
  } catch (err) {
    if (err instanceof SetupError) usage(err.message)
    throw err
  }
  process.exit(code)
}

let plan
try {
  plan = planRun(command, FLOWS, NEGATIVE_CONTROLS, process.cwd())
} catch (err) {
  if (err instanceof SetupError) usage(err.message)
  throw err
}
process.exit(await runFlows(plan, KIT, ROOT))
