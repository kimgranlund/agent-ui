// scripts/e2e-admin/selftest.ts: the unit layer for the admin flow runner. No browser launches; fake
// route objects drive the intercept and the recorder, and fake flow bodies drive the negative-control
// verdict. Run by `node scripts/e2e-admin.mjs selftest`, folded into `npm run check:scripts`.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { NEGATIVE_CONTROLS, FLOWS } from './flows/index.ts'
import { createInterceptState, handleRoute, unconsumedTurns, type FulfillLike, type WireLog } from './intercept.ts'
import { createRecorderState, teeRoute, type RecordRouteLike, type ResponseLike } from './record.ts'
import { assertWireClean, FIXTURES_DIR, guardFlow, negativeVerdict } from './runner.ts'
import { FlowAssertion, parseScenario, ScenarioError, scrubScenario, ScrubRefusal, type AdminScenario } from './scenario.ts'

const ORIGIN = 'http://127.0.0.1:41234'

interface FakeCalls {
  fulfilled: FulfillLike[]
  aborted: number
  continued: number
  fetched: number
}

function fakeRoute(
  method: string,
  url: string,
  body?: unknown,
  response?: { status: number; contentType: string; text: string },
): { route: RecordRouteLike; calls: FakeCalls } {
  const calls: FakeCalls = { fulfilled: [], aborted: 0, continued: 0, fetched: 0 }
  const route: RecordRouteLike = {
    request: () => ({
      url: () => url,
      method: () => method,
      postData: () => (body === undefined ? null : JSON.stringify(body)),
    }),
    fulfill: async (options) => {
      calls.fulfilled.push(options)
    },
    abort: async () => {
      calls.aborted += 1
    },
    continue: async () => {
      calls.continued += 1
    },
    fetch: async (): Promise<ResponseLike> => {
      calls.fetched += 1
      if (response === undefined) throw new Error('fake: no response scripted')
      return {
        status: () => response.status,
        headers: () => ({ 'content-type': response.contentType }),
        text: async () => response.text,
      }
    },
  }
  return { route, calls }
}

function scenarioOf(turns: AdminScenario['turns']): AdminScenario {
  return { kind: 'agent-ui-admin-scenario', version: 1, name: 'selftest', turns }
}

function wireOf(state: ReturnType<typeof createInterceptState>): WireLog {
  return { entries: state.wire.entries, consumed: state.wire.consumed, ready: Promise.resolve() }
}

function fixtureFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return fixtureFiles(full)
    return entry.name.endsWith('.json') ? [full] : []
  })
}

export async function runSelftest(): Promise<number> {
  let failures = 0
  const check = (name: string, ok: boolean, detail?: string): void => {
    console.log(`${ok ? 'ok' : 'FAIL'} - ${name}`)
    if (!ok) {
      failures += 1
      if (detail !== undefined) console.log(`    ${detail}`)
    }
  }
  const attempt = async (name: string, body: () => Promise<boolean> | boolean): Promise<void> => {
    try {
      check(name, await body())
    } catch (err) {
      check(name, false, err instanceof Error ? err.message : String(err))
    }
  }

  await attempt('parseScenario names the missing field', () => {
    const missing = JSON.stringify({
      kind: 'agent-ui-admin-scenario',
      version: 1,
      name: 'x',
      turns: [{ endpoint: 'produce' }],
    })
    let named = false
    try {
      parseScenario(missing)
    } catch (err) {
      named = err instanceof ScenarioError && err.path === 'turns[0].respond' && err.message.includes('turns[0].respond')
    }
    // Positive half: a complete scenario parses.
    const good = parseScenario(
      JSON.stringify({ kind: 'agent-ui-admin-scenario', version: 1, name: 'x', turns: [{ endpoint: 'chat', respond: { text: 'hi' } }] }),
    )
    return named && good.turns.length === 1
  })

  await attempt('scrubScenario refuses a key-shaped value', () => {
    const keyLine = `{"a2uiMeta":{"note":"sk-ant-${'a'.repeat(24)}"}}`
    const leaky = scenarioOf([{ endpoint: 'produce', respond: { lines: ['{}', keyLine] } }])
    let refusedShape = false
    try {
      scrubScenario(leaky, {})
    } catch (err) {
      refusedShape = err instanceof ScrubRefusal && err.path === 'turns[0].respond.lines[1]' && !err.message.includes('a'.repeat(24))
    }
    const envLeak = scenarioOf([{ endpoint: 'chat', respond: { text: 'token is zzzzzzzzzzzzzzzz here' } }])
    let refusedEnv = false
    try {
      scrubScenario(envLeak, { MY_SERVICE_TOKEN: 'zzzzzzzzzzzzzzzz' })
    } catch (err) {
      refusedEnv = err instanceof ScrubRefusal && err.path === 'turns[0].respond.text'
    }
    // Positive half: a clean scenario passes, and a short env value is not treated as a secret.
    const clean = scenarioOf([{ endpoint: 'chat', respond: { text: 'short' } }])
    const passes = scrubScenario(clean, { SHORT_KEY: 'short' }) === clean
    return refusedShape && refusedEnv && passes
  })

  await attempt('intercept aborts a non-origin request', async () => {
    const state = createInterceptState(scenarioOf([]), ORIGIN)
    const { route, calls } = fakeRoute('GET', 'https://example.com/e2e-admin-probe')
    await handleRoute(state, route)
    const entry = state.wire.entries[0]
    // Positive half: a same-origin page asset goes to vite untouched and is not logged.
    const asset = fakeRoute('GET', `${ORIGIN}/agent-admin-app.html`)
    await handleRoute(state, asset.route)
    return (
      calls.aborted === 1 &&
      calls.continued === 0 &&
      calls.fulfilled.length === 0 &&
      entry?.endpoint === 'external' &&
      entry.outcome === 'aborted' &&
      asset.calls.continued === 1 &&
      state.wire.entries.length === 1
    )
  })

  await attempt('intercept never passes an /__a2ui/ request through', async () => {
    const state = createInterceptState(
      scenarioOf([
        { endpoint: 'produce', respond: { lines: ['{"a2uiMeta":{"note":"n"}}'] } },
        { endpoint: 'chat', respond: { text: 't' } },
        { endpoint: 'produce', respond: { abort: true } },
      ]),
      ORIGIN,
    )
    const requests: [string, string, unknown?][] = [
      ['GET', '/__a2ui/agent/status'],
      ['GET', '/__a2ui/agent/integrations'],
      ['POST', '/__a2ui/agent', { builderMission: false, input: { kind: 'intent', text: 'hi' } }],
      ['POST', '/__a2ui/agent/chat', { messages: [{ role: 'user', content: 'hi' }] }],
      ['POST', '/__a2ui/agent', { builderMission: false, input: { kind: 'intent', text: 'again' } }],
      ['POST', '/__a2ui/agent', { builderMission: false, input: { kind: 'intent', text: 'exhausted' } }],
      ['GET', '/__a2ui/agent/unknown'],
      ['POST', '/__a2ui/other'],
    ]
    let clean = true
    const statusBodies: string[] = []
    for (const [method, pathname, body] of requests) {
      const { route, calls } = fakeRoute(method, `${ORIGIN}${pathname}`, body)
      await handleRoute(state, route)
      const answered = calls.fulfilled.length + calls.aborted
      if (calls.continued !== 0 || calls.fetched !== 0 || answered !== 1) clean = false
      if (pathname.endsWith('/status')) statusBodies.push(calls.fulfilled[0]?.body ?? '')
    }
    const endpoints = state.wire.entries.map((e) => e.endpoint).join(',')
    return (
      clean &&
      state.wire.entries.length === requests.length &&
      endpoints === 'status,integrations,produce,chat,produce,produce,other-a2ui,other-a2ui' &&
      statusBodies[0] === JSON.stringify({ available: true, providers: 1 })
    )
  })

  await attempt('intercept records unmatched and exhausted turns', async () => {
    const state = createInterceptState(
      scenarioOf([
        { endpoint: 'produce', match: { mission: true, textIncludes: 'draft' }, respond: { lines: ['{"a2uiMeta":{"note":"n"}}'] } },
      ]),
      ORIGIN,
    )
    const miss = fakeRoute('POST', `${ORIGIN}/__a2ui/agent`, { builderMission: false, input: { kind: 'intent', text: 'draft' } })
    await handleRoute(state, miss.route)
    const missEntry = state.wire.entries.at(-1)
    const unconsumedAfterMiss = unconsumedTurns(wireOf(state)).join(',')
    const hit = fakeRoute('POST', `${ORIGIN}/__a2ui/agent`, { builderMission: true, input: { kind: 'intent', text: 'a draft please' } })
    await handleRoute(state, hit.route)
    const hitEntry = state.wire.entries.at(-1)
    const more = fakeRoute('POST', `${ORIGIN}/__a2ui/agent`, { builderMission: true, input: { kind: 'intent', text: 'draft' } })
    await handleRoute(state, more.route)
    const moreEntry = state.wire.entries.at(-1)
    let redsTheFlow = false
    try {
      assertWireClean(wireOf(state))
    } catch (err) {
      redsTheFlow = err instanceof FlowAssertion && err.message.includes('unmatched') && err.message.includes('exhausted')
    }
    // An unconsumed scripted turn reds the flow too.
    const idle = createInterceptState(scenarioOf([{ endpoint: 'chat', respond: { text: 't' } }]), ORIGIN)
    let unusedReds = false
    try {
      assertWireClean(wireOf(idle))
    } catch (err) {
      unusedReds = err instanceof FlowAssertion && err.message.includes('turns[0]')
    }
    return (
      missEntry?.outcome === 'unmatched' &&
      miss.calls.fulfilled[0]?.status === 500 &&
      unconsumedAfterMiss === '0' &&
      hitEntry?.outcome === 'fulfilled' &&
      hitEntry.turnIndex === 0 &&
      hit.calls.fulfilled[0]?.contentType === 'application/x-ndjson' &&
      hit.calls.fulfilled[0]?.body === '{"a2uiMeta":{"note":"n"}}\n' &&
      moreEntry?.outcome === 'exhausted' &&
      more.calls.fulfilled[0]?.status === 500 &&
      redsTheFlow &&
      unusedReds
    )
  })

  await attempt('negative control reds a flow that passes its wrong-behavior fixture', async () => {
    const passing = await guardFlow(async () => {}, 1000)
    const passVerdict = negativeVerdict(passing)
    // Positive half: a FlowAssertion, raised by the flow or by the post-flow wire check, is the expected red.
    const asserted = negativeVerdict(
      await guardFlow(async () => {
        throw new FlowAssertion('wrong behavior caught')
      }, 1000),
    )
    const wireRed = negativeVerdict(
      await guardFlow(
        async () => {},
        1000,
        () => {
          throw new FlowAssertion('scripted turn(s) never consumed: turns[0]')
        },
      ),
    )
    return (
      passing.kind === 'pass' &&
      !passVerdict.ok &&
      passVerdict.message === 'passed against a wrong-behavior fixture' &&
      asserted.ok &&
      wireRed.ok
    )
  })

  await attempt('negative control rejects a crash as the expected red', async () => {
    const crashed = await guardFlow(async () => {
      throw new TypeError('cannot read properties of undefined')
    }, 1000)
    const timedOut = await guardFlow(() => new Promise<void>(() => {}), 50)
    return crashed.kind === 'crash' && !negativeVerdict(crashed).ok && timedOut.kind === 'timeout' && !negativeVerdict(timedOut).ok
  })

  await attempt('record tee builds turns from observed responses', async () => {
    const state = createRecorderState(ORIGIN)
    const persona = 'PRIVATE PERSONA PROMPT TEXT'
    const produce = fakeRoute(
      'POST',
      `${ORIGIN}/__a2ui/agent`,
      { builderMission: true, input: { kind: 'intent', text: 'hi' }, personaSystem: persona },
      { status: 200, contentType: 'application/x-ndjson', text: '{"a2uiMeta":{"note":"live"}}\n{"version":"v1.0"}\n' },
    )
    await teeRoute(state, produce.route)
    const chat = fakeRoute(
      'POST',
      `${ORIGIN}/__a2ui/agent/chat`,
      { system: persona, messages: [{ role: 'user', content: 'hi' }] },
      { status: 200, contentType: 'application/json', text: '{"text":"live reply"}' },
    )
    await teeRoute(state, chat.route)
    const status = fakeRoute('GET', `${ORIGIN}/__a2ui/agent/status`)
    await teeRoute(state, status.route)
    const expected = JSON.stringify([
      { endpoint: 'produce', match: { mission: true, inputKind: 'intent' }, respond: { lines: ['{"a2uiMeta":{"note":"live"}}', '{"version":"v1.0"}'] } },
      { endpoint: 'chat', respond: { text: 'live reply' } },
    ])
    return (
      JSON.stringify(state.turns) === expected &&
      produce.calls.fetched === 1 &&
      produce.calls.fulfilled[0]?.body === '{"a2uiMeta":{"note":"live"}}\n{"version":"v1.0"}\n' &&
      chat.calls.fulfilled[0]?.body === '{"text":"live reply"}' &&
      status.calls.continued === 1 &&
      status.calls.fetched === 0 &&
      !JSON.stringify(state).includes(persona)
    )
  })

  await attempt('every committed fixture parses', () => {
    const files = fixtureFiles(FIXTURES_DIR)
    if (files.length === 0) return false
    for (const file of files) parseScenario(readFileSync(file, 'utf8'))
    return true
  })

  await attempt('every registered flow names an existing fixture', () => {
    const names = new Set<string>()
    for (const flow of FLOWS) {
      if (names.has(flow.name)) throw new Error(`duplicate flow name ${flow.name}`)
      names.add(flow.name)
      if (!existsSync(path.join(FIXTURES_DIR, flow.fixture))) throw new Error(`${flow.name}: missing fixture ${flow.fixture}`)
    }
    for (const control of NEGATIVE_CONTROLS) {
      if (!names.has(control.flow)) throw new Error(`negative control names unknown flow ${control.flow}`)
      if (!existsSync(path.join(FIXTURES_DIR, control.fixture))) throw new Error(`negative control fixture missing: ${control.fixture}`)
    }
    return FLOWS.length > 0
  })

  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  return failures === 0 ? 0 : 1
}
