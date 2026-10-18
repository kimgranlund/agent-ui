// T-0178: judged checks, keyless. A scripted provider stands in for the judge model: the tests pin the `judge.json`
// shape, the threshold verdict recomputed from the scores, the strict reply parse, the rubric and calibration
// parsers on the committed files, `signals.ts` folding a judged run into its checks, and the CLI's keyless arms.
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { main } from './eval-judge.ts'
import { calibrated, JUDGE_MODEL, judgeTranscript, loadCalibration, loadRubric, parseReply, parseRubric, readJudge, transcriptOf, writeJudge } from './judge.ts'
import { aggregate, readRound, renderSignals } from './signals.ts'

const here = dirname(fileURLToPath(import.meta.url))
const ROUNDS = join(here, '..', '..', '..', '.sdlc', 'evals', 'rounds')
const SIGNALS_NEXT = join(here, 'fixtures', 'signals', 'rounds', '2026-01-02-next')
const tmp = mkdtempSync(join(tmpdir(), 'judge-test-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

const note = (text) => JSON.stringify({ a2uiMeta: { note: text } })
const table = JSON.stringify({ version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [{ id: 'root', component: 'CardTable', title: 'Blackjack' }, { id: 'hit', component: 'Button', label: 'Hit' }] } })
const REPORT = {
  kind: 'agent-ui-chat-probe-report',
  agent: 'croupier',
  turns: [
    { index: 0, step: { say: 'Blackjack, please.' }, lines: [note('Blackjack it is. Place your bet.'), table] },
    { index: 1, step: { click: '100' }, lines: [JSON.stringify({ a2uiMeta: { error: 'produce: no valid surface within the round bound (SURFACE_DROPPED)' } })] },
    { index: 2, step: { click: 'Deal again' }, clickMissing: { label: 'Deal again' }, lines: [] },
  ],
}

/** A scripted judge: replies `reply` and reports `usage` once, recording each request. */
function stub(reply, usage = { inputTokens: 1000, outputTokens: 200 }) {
  const requests = []
  return {
    requests,
    provider: {
      async *stream(req) {
        requests.push(req)
        req.onEvent?.({ kind: 'usage', usage })
        yield reply.slice(0, 10)
        yield reply.slice(10)
      },
    },
  }
}
const reply = (scores) => JSON.stringify({ criteria: Object.entries(scores).map(([id, score]) => ({ id, score, evidence: ['Place your bet.', 'not in the transcript'], why: `${id} reasoning` })) })

describe('judge', () => {
  const croupier = loadRubric('croupier')

  it('parses the committed rubrics and refuses a malformed one', () => {
    for (const id of ['croupier', 'concierge', 'lexicographer']) {
      const r = loadRubric(id)
      expect(r.id).toBe(id)
      expect(r.threshold).toBe(3)
      expect(r.criteria.length).toBeGreaterThan(0)
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(croupier.criteria).toEqual(['C1', 'C2', 'C3', 'C4'])
    expect(loadRubric('no-such-persona')).toBeUndefined()
    expect(() => parseRubric('# no front matter\n')).toThrow(/front matter/)
    expect(() => parseRubric('---\nid: x\nversion: 1\nthreshold: 3\ncriteria: [A]\n---\n### B: other\n')).toThrow(/criterion A/)
    expect(() => parseRubric('---\nid: x\nversion: 1\nthreshold: 9\ncriteria: [A]\n---\n### A: a\n')).toThrow(/threshold/)
  })

  it('builds the transcript from the probe report: steps, reply text, surface, a halted turn and a missing click', () => {
    const t = transcriptOf(REPORT)
    expect(t).toContain('Persona: croupier')
    expect(t).toContain('User says: Blackjack, please.')
    expect(t).toContain('Agent says: Blackjack it is. Place your bet.')
    expect(t).toContain('Agent surface: CardTable, Button')
    expect(t).toContain('Surface text: "Blackjack" "Hit"')
    expect(t).toContain('User clicks: 100\nAgent: [turn failed] produce: no valid surface')
    expect(t).toContain('User clicks: Deal again\n(the probe found no such button on the page, so no agent turn ran)')
  })

  it('writes the judge.json shape with the pinned model, the verdict recomputed at the threshold, and quote checks', async () => {
    const s = stub(reply({ C1: 5, C2: 4, C3: 3, C4: 5 }))
    const out = await judgeTranscript('run-1', transcriptOf(REPORT), croupier, { provider: s.provider, now: () => '2026-10-17T00:00:00.000Z' })
    expect(out.ok).toBe(true)
    const f = out.file
    expect(Object.keys(f)).toEqual(['kind', 'version', 'run', 'rubric', 'model', 'temperature', 'threshold', 'criteria', 'score', 'passed', 'usage', 'costUsd', 'at'])
    expect(f).toMatchObject({ kind: 'agent-ui-judge', version: 1, run: 'run-1', model: JUDGE_MODEL, temperature: null, threshold: 3, score: 3, passed: true, at: '2026-10-17T00:00:00.000Z' })
    expect(f.rubric).toEqual({ id: 'croupier', version: 1, sha256: croupier.sha256 })
    expect(f.criteria.map((c) => [c.id, c.score, c.passed])).toEqual([['C1', 5, true], ['C2', 4, true], ['C3', 3, true], ['C4', 5, true]])
    expect(f.criteria[0].evidence).toEqual([{ quote: 'Place your bet.', found: true }, { quote: 'not in the transcript', found: false }])
    expect(f.usage).toEqual({ inputTokens: 1000, outputTokens: 200 })
    expect(f.costUsd).toBeCloseTo((1000 * 2 + 200 * 10) / 1e6, 9)
    // The rubric body is the prompt verbatim, after the wrapper; the pinned model is asked, no sampling parameter sent.
    expect(s.requests).toHaveLength(1)
    expect(s.requests[0].system.endsWith(croupier.body)).toBe(true)
    expect(s.requests[0].model).toBe('claude-sonnet-5-5')
    expect('temperature' in s.requests[0]).toBe(false)
    expect(s.requests[0].messages[0].content).toContain('User says: Blackjack, please.')
  })

  it('fails the run when one criterion scores under the threshold, whatever the others score', async () => {
    const out = await judgeTranscript('run-2', transcriptOf(REPORT), croupier, { provider: stub(reply({ C1: 5, C2: 5, C3: 2, C4: 5 })).provider })
    expect(out.ok && out.file.passed).toBe(false)
    expect(out.file.score).toBe(2)
    expect(out.file.criteria.find((c) => c.id === 'C3').passed).toBe(false)
    expect(calibrated({ expect: 'bad' }, out.file)).toBe(true)
    expect(calibrated({ expect: 'good' }, out.file)).toBe(false)
  })

  it('refuses a reply that is not one JSON object over exactly the rubric criteria', async () => {
    expect(parseReply('Here is my verdict: ...', croupier)).toBeUndefined()
    expect(parseReply(reply({ C1: 5, C2: 5, C3: 5 }), croupier)).toBeUndefined() // C4 missing
    expect(parseReply(reply({ C1: 5, C2: 5, C3: 5, C4: 6 }), croupier)).toBeUndefined() // out of range
    expect(parseReply(reply({ C1: 5, C2: 5, C3: 5, C4: 5, C9: 1 }), croupier)).toBeUndefined() // unknown id
    expect(parseReply(JSON.stringify({ criteria: [{ id: 'C1', score: 4.5, evidence: [] }] }), croupier)).toBeUndefined()
    expect(parseReply('```json\n' + reply({ C4: 1, C3: 2, C2: 3, C1: 4 }) + '\n```', croupier).map((c) => c.id)).toEqual(['C1', 'C2', 'C3', 'C4'])
    const out = await judgeTranscript('run-3', 'x', croupier, { provider: stub('not json').provider })
    expect(out).toMatchObject({ ok: false, reason: 'E_JUDGE_PARSE', raw: 'not json' })
  })

  it('round-trips judge.json, and signals folds it into the run checks and a Judged checks table', async () => {
    const round = join(tmp, 'rounds', '2026-01-02-next')
    cpSync(SIGNALS_NEXT, round, { recursive: true })
    const runDir = join(round, 'runs', 'regress-b-sonnet-1')
    const out = await judgeTranscript('regress-b-sonnet-1', 'Place your bet.', croupier, { provider: stub(reply({ C1: 4, C2: 2, C3: 4, C4: 4 })).provider })
    writeJudge(runDir, out.file)
    expect(readJudge(runDir)).toEqual(JSON.parse(readFileSync(join(runDir, 'judge.json'), 'utf8')))
    expect(readJudge(join(round, 'runs', 'regress-a-haiku-1'))).toBeUndefined()

    const runs = readRound(round)
    const judged = runs.find((r) => r.name === 'regress-b-sonnet-1')
    expect(judged.judge).toEqual({ rubric: 'croupier', score: 2, threshold: 3, passed: false })
    expect(judged.checks.filter((c) => c.check.startsWith('judge ')).map((c) => [c.check, c.status])).toEqual([
      ['judge croupier.C1', 'pass'], ['judge croupier.C2', 'fail'], ['judge croupier.C3', 'pass'], ['judge croupier.C4', 'pass'],
    ])
    const s = aggregate(runs)
    expect(s.judged).toEqual([{ rubric: 'croupier', model: 'sonnet', runs: 1, pass: 0, meanScore: 2 }])
    expect(s.checks.find((c) => c.check === 'judge croupier.C2')).toEqual({ check: 'judge croupier.C2', fails: 1, runs: 1 })
    const md = renderSignals(runs, { rounds: ['2026-01-02-next'] })
    expect(md).toContain('## Judged checks')
    expect(md).toContain('| croupier | sonnet | 1 | 0 | 2 |')
    // A round with no judge.json renders no judged section, so the committed signals.md files are unchanged.
    expect(renderSignals(readRound(SIGNALS_NEXT), { rounds: ['2026-01-02-next'] })).not.toContain('Judged checks')
  })

  it('checks the committed calibration set: real runs of the rubric persona, a good and a bad case per rubric', () => {
    const { cases, problems } = loadCalibration(ROUNDS)
    expect(problems).toEqual([])
    for (const id of ['croupier', 'concierge', 'lexicographer']) {
      expect(cases.some((c) => c.rubric === id && c.expect === 'good')).toBe(true)
      expect(cases.some((c) => c.rubric === id && c.expect === 'bad')).toBe(true)
    }
    // Good cases are passed runs and bad cases failed ones.
    for (const c of cases) expect(JSON.parse(readFileSync(join(ROUNDS, c.round, 'runs', c.run, 'report.json'), 'utf8')).verdict).toBe(c.expect === 'good' ? 'pass' : 'fail')
    expect(loadCalibration(join(tmp, 'no-rounds')).problems.some((p) => p.includes('no report.json'))).toBe(true)
  })

  it('runs the keyless CLI arms and refuses the keyed ones with no key', async () => {
    let out = ''
    const write = (s) => void (out += s)
    expect(await main(['check'], {}, write)).toBe(0)
    expect(out).toContain('3 rubrics (concierge, croupier, lexicographer), 8 calibration cases')
    out = ''
    expect(await main(['run', '--round', '2026-10-17-r10-targeted', '--only', 'concierge-facilities-then-tour-haiku', '--dry-run'], {}, write)).toBe(0)
    expect(out).toContain('would judge regress-concierge-facilities-then-tour-haiku-1 (concierge v1)')
    // No key in the env and no .env under --repo-root: the keyed arm stops before any call.
    expect(await main(['selftest', '--repo-root', tmp], {}, write)).toBe(2)
    expect(await main(['run', '--round', '2026-10-17-r10-targeted', '--repo-root', tmp], {}, write)).toBe(2)
    expect(await main(['nope'], {}, write)).toBe(2)
    expect(await main(['selftest', '--cap', '0'], {}, write)).toBe(2)
  })
})
