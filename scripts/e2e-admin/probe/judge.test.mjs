// T-0178: judged checks, keyless. A scripted provider stands in for the judge model: the tests pin the judged file's
// shape, the threshold verdict recomputed from the scores, evidence that must be found in the transcript, the strict
// reply parse, the transcript built from what the chat showed, the rubric and calibration parsers on the committed
// files, `signals.ts` reading a judged run as a measurement only, and the CLI arms with no key.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { estimate, main } from './eval-judge.ts'
import { calibrated, clip, JUDGE_MODEL, judgedPath, judgeTranscript, loadCalibration, loadRubric, parseReply, parseRubric, quoteFound, readJudge, transcriptOf, writeJudge } from './judge.ts'
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
const reply = (scores, evidence = ['Place your bet.']) => JSON.stringify({ criteria: Object.entries(scores).map(([id, score]) => ({ id, score, evidence, why: `${id} reasoning` })) })
const capture = () => {
  let out = ''
  return { write: (s) => void (out += s), get out() { return out } }
}

describe('judge', () => {
  const croupier = loadRubric('croupier')

  it('parses the committed rubrics and refuses a malformed one or one whose id is not its file name', () => {
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
    const dir = join(tmp, 'rubrics-misnamed')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'concierge.md'), '---\nid: croupier\nversion: 1\nthreshold: 3\ncriteria: [A]\n---\n### A: a\n')
    expect(() => loadRubric('concierge', dir)).toThrow(/front matter id croupier is not the file name concierge/)
  })

  it('builds the transcript from the meta-lines when the report has no proseText: steps, reply, surface, a halt, a missing click', () => {
    const t = transcriptOf(REPORT)
    expect(t).toContain('Persona: croupier')
    expect(t).toContain('User says: Blackjack, please.')
    expect(t).toContain('Agent says: Blackjack it is. Place your bet.')
    expect(t).toContain('Agent surface: CardTable, Button')
    expect(t).toContain('Surface text: "Blackjack" "Hit"')
    expect(t).toContain('User clicks: 100\nAgent: [turn failed] produce: no valid surface')
    expect(t).toContain('User clicks: Deal again\n(the probe found no such button on the page, so no agent turn ran)')
  })

  it('reads what the chat showed from proseText, the new part of the log per turn, keeping a long reply\'s head and tail', () => {
    const leak = '{"a2uiMeta":{"note":"x"}}'
    const long = `You Hit me. ${'The dealer draws. '.repeat(200)}${leak}`
    const report = {
      agent: 'croupier',
      turns: [
        // The meta-line note differs from what the page showed: proseText wins.
        { index: 0, step: { say: 'Blackjack, please.' }, lines: [note('meta note')], proseScope: 'log', proseText: 'You Blackjack, please. blackjack Blackjack it is.' },
        { index: 1, step: { say: 'Hit me.' }, lines: [], proseScope: 'log', proseText: `You Blackjack, please. blackjack Blackjack it is. ${long}` },
        { index: 2, step: { click: '100' }, lines: [], proseScope: 'log', proseText: 'You Blackjack, please. blackjack Bet of 100 is down.' },
      ],
    }
    const t = transcriptOf(report)
    expect(t).toContain('Chat shows (new this turn): You Blackjack, please. blackjack Blackjack it is.')
    expect(t).not.toContain('meta note')
    // Turn 1: only what it added, the head and the tail kept, so the trailing JSON leak is in view.
    const turn1 = t.split('## Turn 1')[1].split('## Turn 2')[0]
    expect(turn1).toContain('Chat shows (new this turn): You Hit me. The dealer draws.')
    expect(turn1).toMatch(/\[\.\.\. \d+ chars elided \.\.\.\]/)
    expect(turn1).toContain(leak)
    expect(turn1).not.toContain('Blackjack it is.')
    // Turn 2 replaced the earlier reply: the new text starts at a word, never mid-word.
    expect(t).toContain('Chat shows (new this turn): Bet of 100 is down.')
    expect(clip('abcdef', 2, 2)).toBe('ab [... 2 chars elided ...] ef')
    expect(clip('abcd', 2, 2)).toBe('abcd')
  })

  it('writes the judged file shape with the pinned model and the verdict recomputed at the threshold', async () => {
    const s = stub(reply({ C1: 5, C2: 4, C3: 3, C4: 5 }))
    const out = await judgeTranscript('run-1', transcriptOf(REPORT), croupier, { provider: s.provider, now: () => '2026-10-17T00:00:00.000Z' })
    expect(out.ok).toBe(true)
    const f = out.file
    expect(Object.keys(f)).toEqual(['kind', 'version', 'run', 'rubric', 'model', 'temperature', 'threshold', 'criteria', 'score', 'passed', 'usage', 'costUsd', 'at'])
    expect(f).toMatchObject({ kind: 'agent-ui-judge', version: 1, run: 'run-1', model: JUDGE_MODEL, temperature: null, threshold: 3, score: 3, passed: true, at: '2026-10-17T00:00:00.000Z' })
    expect(f.rubric).toEqual({ id: 'croupier', version: 1, sha256: croupier.sha256 })
    expect(Object.keys(f.criteria[0])).toEqual(['id', 'score', 'passed', 'supported', 'evidence', 'why'])
    expect(f.criteria.map((c) => [c.id, c.score, c.passed, c.supported])).toEqual([['C1', 5, true, true], ['C2', 4, true, true], ['C3', 3, true, true], ['C4', 5, true, true]])
    expect(f.criteria[0].evidence).toEqual([{ quote: 'Place your bet.', found: true }])
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

  it('fails a criterion whose evidence is invented or missing, however high it scored', async () => {
    const t = transcriptOf(REPORT)
    const invented = await judgeTranscript('run-4', t, croupier, { provider: stub(reply({ C1: 5, C2: 5, C3: 5, C4: 5 }, ['Place your bet.', 'The dealer cheated.'])).provider })
    expect(invented.file.criteria.every((c) => !c.supported && !c.passed)).toBe(true)
    expect(invented.file.criteria[0].evidence).toEqual([{ quote: 'Place your bet.', found: true }, { quote: 'The dealer cheated.', found: false }])
    expect(invented.file).toMatchObject({ score: 5, passed: false })
    const none = await judgeTranscript('run-5', t, croupier, { provider: stub(reply({ C1: 5, C2: 5, C3: 5, C4: 5 }, [])).provider })
    expect(none.file.passed).toBe(false)
    // Whitespace, curly quotes, outer quote marks and an elided middle still match the transcript.
    expect(quoteFound('“Blackjack   it is.”', t)).toBe(true)
    expect(quoteFound('Blackjack it is... the dealer wins.', t)).toBe(false)
    expect(quoteFound('Blackjack it is... Place your bet.', t)).toBe(true)
    expect(quoteFound('', t)).toBe(false)
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

  it('writes a judged run once into the round judged/ folder and never rewrites it; skips an invalid file with a warning', async () => {
    const round = join(tmp, 'write-round')
    const a = await judgeTranscript('regress-b-sonnet-1', 'Place your bet.', croupier, { provider: stub(reply({ C1: 4, C2: 2, C3: 4, C4: 4 })).provider })
    expect(writeJudge(round, a.file)).toEqual({ path: join(round, 'judged', 'regress-b-sonnet-1.json'), written: true })
    const before = readFileSync(judgedPath(round, 'regress-b-sonnet-1'), 'utf8')
    const b = await judgeTranscript('regress-b-sonnet-1', 'Place your bet.', croupier, { provider: stub(reply({ C1: 5, C2: 5, C3: 5, C4: 5 })).provider })
    expect(writeJudge(round, b.file).written).toBe(false)
    expect(readFileSync(judgedPath(round, 'regress-b-sonnet-1'), 'utf8')).toBe(before)
    expect(readJudge(round, 'regress-b-sonnet-1')).toEqual(JSON.parse(before))
    expect(readJudge(round, 'regress-a-haiku-1')).toBeUndefined()
    const warnings = []
    for (const [name, body] of [
      ['bad-json', '{'],
      ['bad-threshold', JSON.stringify({ ...a.file, run: 'bad-threshold', threshold: 7 })],
      ['bad-rubric', JSON.stringify({ ...a.file, rubric: {} })],
      ['bad-criteria', JSON.stringify({ ...a.file, criteria: [{ id: 'C1' }] })],
    ]) {
      writeFileSync(judgedPath(round, name), body)
      expect(readJudge(round, name, (s) => warnings.push(s))).toBeUndefined()
    }
    expect(warnings).toHaveLength(4)
    expect(warnings.join('')).toMatch(/threshold is not an integer 1 to 5[\s\S]*no rubric id[\s\S]*a criterion without/)
  })

  it('signals reads a judged run as a measurement: its own table, never the verdict, pass rates or failing checks', async () => {
    const round = join(tmp, 'rounds', '2026-01-02-next')
    cpSync(SIGNALS_NEXT, round, { recursive: true })
    const plain = aggregate(readRound(round))
    const out = await judgeTranscript('regress-b-sonnet-1', 'Place your bet.', croupier, { provider: stub(reply({ C1: 4, C2: 2, C3: 4, C4: 4 })).provider })
    writeJudge(round, out.file)
    writeFileSync(judgedPath(round, 'regress-a-haiku-1'), '{') // skipped, not a crash
    const runs = readRound(round)
    const judged = runs.find((r) => r.name === 'regress-b-sonnet-1')
    expect(judged.judge).toEqual({ rubric: 'croupier', score: 2, threshold: 3, passed: false, criteria: [{ id: 'C1', score: 4, passed: true }, { id: 'C2', score: 2, passed: false }, { id: 'C3', score: 4, passed: true }, { id: 'C4', score: 4, passed: true }] })
    expect(runs.find((r) => r.name === 'regress-a-haiku-1').judge).toBeNull()
    expect(judged.checks.some((c) => c.check.startsWith('judge'))).toBe(false)
    const s = aggregate(runs)
    for (const k of ['byModel', 'cells', 'presets', 'mixed', 'checks']) expect(s[k]).toEqual(plain[k])
    expect(s.judged).toEqual([{ rubric: 'croupier', model: 'sonnet', runs: 1, pass: 0, meanScore: 2 }])
    expect(s.judgedCriteria).toEqual([
      { rubric: 'croupier', criterion: 'C1', runs: 1, fails: 0 },
      { rubric: 'croupier', criterion: 'C2', runs: 1, fails: 1 },
      { rubric: 'croupier', criterion: 'C3', runs: 1, fails: 0 },
      { rubric: 'croupier', criterion: 'C4', runs: 1, fails: 0 },
    ])
    const md = renderSignals(runs, { rounds: ['2026-01-02-next'] })
    expect(md).toContain('## Judged checks')
    expect(md).toContain('| croupier | sonnet | 1 | 0 | 2 |')
    expect(md).toContain('| croupier.C2 | 1 | 1 |')
    expect(md.split('## Failing checks')[1].split('##')[0]).not.toContain('judge')
    // A round with no judged/ folder renders no judged section, so the committed signals.md files are unchanged.
    expect(renderSignals(readRound(SIGNALS_NEXT), { rounds: ['2026-01-02-next'] })).not.toContain('Judged checks')
  })

  it('checks the committed calibration set: real runs of the rubric persona, good cases passed and bad ones failed', () => {
    const { cases, problems } = loadCalibration(ROUNDS)
    expect(problems).toEqual([])
    for (const id of ['croupier', 'concierge', 'lexicographer']) {
      expect(cases.some((c) => c.rubric === id && c.expect === 'good')).toBe(true)
      expect(cases.some((c) => c.rubric === id && c.expect === 'bad')).toBe(true)
    }
    expect(loadCalibration(join(tmp, 'no-rounds')).problems.some((p) => p.includes('no report.json'))).toBe(true)
    // A good case citing a failed run, or a bad case citing a passed one, is a problem.
    const swapped = join(tmp, 'calibration-swapped.json')
    writeFileSync(swapped, JSON.stringify({ cases: cases.map((c) => ({ ...c, expect: c.expect === 'good' ? 'bad' : 'good' })) }))
    const { problems: p } = loadCalibration(ROUNDS, swapped)
    expect(p).toHaveLength(cases.length)
    expect(p[0]).toMatch(/a bad case must be a run with verdict fail, this one is pass/)
  })

  it('estimates a call from the max_tokens the adapter sends, so the cap holds for a full-length reply', () => {
    // Sonnet 5.5 with no effort: the adapter sends max_tokens 4096, at $10 per million output tokens.
    expect(estimate(croupier, 'x')).toBeGreaterThanOrEqual((4096 * 10) / 1e6)
  })

  it('runs the keyless CLI arms, refuses the keyed ones with no key, and survives provider errors', async () => {
    const c = capture()
    expect(await main(['check'], {}, c.write)).toBe(0)
    expect(c.out).toContain('3 rubrics (concierge, croupier, lexicographer), 8 calibration cases')
    expect(await main(['run', '--round', '2026-10-17-r10-targeted', '--only', 'concierge-facilities-then-tour-haiku', '--dry-run'], {}, c.write)).toBe(0)
    expect(c.out).toContain('would judge regress-concierge-facilities-then-tour-haiku-1 (concierge v1)')
    // No key in the env and no .env under --repo-root: the keyed arm stops before any call.
    expect(await main(['selftest', '--repo-root', tmp], {}, c.write)).toBe(2)
    expect(await main(['run', '--round', '2026-10-17-r10-targeted', '--repo-root', tmp], {}, c.write)).toBe(2)
    expect(await main(['nope'], {}, c.write)).toBe(2)
    expect(await main(['selftest', '--cap', '0'], {}, c.write)).toBe(2)

    // A round of two croupier runs in a scratch rounds dir.
    const roundsDir = join(tmp, 'cli-rounds')
    for (const name of ['croupier-a-haiku-1', 'croupier-b-haiku-1']) {
      mkdirSync(join(roundsDir, 'r1', 'runs', name), { recursive: true })
      writeFileSync(join(roundsDir, 'r1', 'runs', name, 'report.json'), JSON.stringify(REPORT))
    }
    // Every call throws: both runs stay unjudged, two in a row stop, the summary prints, exit 1, nothing written.
    let calls = 0
    const broken = { async *stream() { calls += 1; throw new Error('HTTP 529 overloaded') } }
    const e = capture()
    expect(await main(['run', '--round', 'r1', '--rounds-dir', roundsDir], {}, e.write, { provider: broken })).toBe(1)
    expect(calls).toBe(2)
    expect(e.out).toContain('ERROR croupier-a-haiku-1: unjudged, HTTP 529 overloaded')
    expect(e.out).toContain('stop: two provider errors in a row')
    expect(e.out).toMatch(/spent \$\d+\.\d{4} \(estimated at list prices, cap \$5\), judged 0, remaining 0, errors 2/)
    expect(existsSync(join(roundsDir, 'r1', 'judged'))).toBe(false)
    // One error, then a good reply: the first run is unjudged, the second written, still exit 1 for the error.
    let n = 0
    const flaky = { async *stream(req) { n += 1; if (n === 1) throw new Error('reset'); yield* stub(reply({ C1: 4, C2: 4, C3: 4, C4: 4 })).provider.stream(req) } }
    const f = capture()
    expect(await main(['run', '--round', 'r1', '--rounds-dir', roundsDir], {}, f.write, { provider: flaky })).toBe(1)
    expect(f.out).toContain('judged 1, remaining 0, errors 1')
    expect(existsSync(judgedPath(join(roundsDir, 'r1'), 'croupier-b-haiku-1'))).toBe(true)
    // A rerun judges only the run with no file and leaves the written one as it was.
    const kept = readFileSync(judgedPath(join(roundsDir, 'r1'), 'croupier-b-haiku-1'), 'utf8')
    const g = capture()
    expect(await main(['run', '--round', 'r1', '--rounds-dir', roundsDir], {}, g.write, { provider: stub(reply({ C1: 4, C2: 4, C3: 4, C4: 4 })).provider })).toBe(0)
    expect(g.out).toContain('already judged croupier-b-haiku-1')
    expect(g.out).toContain('judged 1, remaining 0, errors 0')
    expect(readFileSync(judgedPath(join(roundsDir, 'r1'), 'croupier-b-haiku-1'), 'utf8')).toBe(kept)
    expect(existsSync(judgedPath(join(roundsDir, 'r1'), 'croupier-a-haiku-1'))).toBe(true)
  })
})
