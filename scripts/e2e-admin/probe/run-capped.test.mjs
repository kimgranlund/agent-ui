// T-0225: the capped live-round runner, keyless. Fake traces stand in for the dev proxy: each fake probe appends
// one trace line, and the runner must stop before the run that would start at or over the cap, skip runs that
// already reported, and keep its baseline across a restart.
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeCommands, describeEvals, describeRound, estimateSpend, listRound, parseCommands, roundStart, runCapped, runRecord, runRound, shellWords, traceSpend, writeRoundReadme } from './run-capped.ts'

const line = (at, model, usage) => JSON.stringify({ at, model, usage })
const SCRIPT = ['#!/usr/bin/env bash', '# header', '', ...[1, 2, 3, 4, 5].map((i) => `npm run chat:probe -- --agent croupier --say hi --out runs/r${i} --name r${i}`)].join('\n')

describe('run-capped', () => {
  it('prices trace usage by model family and only counts turns since the round start', () => {
    const jsonl = [
      line('2026-10-14T10:00:00Z', 'claude-sonnet-5-5', { inputTokens: 1_000_000, outputTokens: 0 }),
      line('2026-10-14T12:00:00Z', 'claude-haiku-5-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 }),
      line('2026-10-14T12:00:01Z', 'claude-opus-5-5', { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 1_000_000 }),
      'not json',
    ].join('\n')
    expect(estimateSpend(jsonl)).toBeCloseTo(2 + 0.6 + 4)
    expect(estimateSpend(jsonl, '2026-10-14T11:00:00Z')).toBeCloseTo(0.6 + 4)
  })

  it('T-0260: describes each command as the probe parses it, and names the first one it would refuse', () => {
    expect(shellWords('npm run chat:probe -- --say "Let\'s \\"go\\" \\$5" --out runs/a')).toEqual(['npm', 'run', 'chat:probe', '--', '--say', 'Let\'s "go" $5', '--out', 'runs/a'])
    const ok = 'npm run chat:probe -- --agent croupier --say hi --expect-routing "{\\"domains\\":[\\"croupier\\"]}" --out runs/r1 --name r1'
    expect(describeCommands(ok)).toEqual(['r1: croupier on the default model, 1 steps, 0 --expect-turn, 1 --expect-routing'])
    expect(() => describeCommands(`${ok}\nnpm run chat:probe -- --agent croupier --say hi --expect-routing "{\\"domain\\":[]}" --out runs/r2`)).toThrow(/run 2 \(runs\/r2\): --expect-routing.domain: unknown field/)
    expect(() => describeCommands('npm run chat:probe -- --say hi --out runs/r3')).toThrow(/run 1 \(runs\/r3\): a live probe needs --agent/)
  })

  it('parses the probe lines of a live-commands.sh with their out folders', () => {
    const cmds = parseCommands(SCRIPT)
    expect(cmds).toHaveLength(5)
    expect(cmds[0].out).toBe('runs/r1')
  })

  it('stops at the cap read from fake traces', () => {
    const root = mkdtempSync(join(tmpdir(), 'run-capped-'))
    mkdirSync(join(root, '.agent-traces'))
    const since = '2026-10-14T00:00:00Z'
    // Spend before the round started never counts.
    writeFileSync(join(root, '.agent-traces', '2026-10-13.jsonl'), line('2026-10-13T09:00:00Z', 'claude-opus-5-5', { inputTokens: 0, outputTokens: 10_000_000 }) + '\n')
    const ran = []
    const result = runCapped({
      commands: parseCommands(SCRIPT),
      cap: 5,
      spend: () => traceSpend(root, since),
      // Each fake probe costs $2 (Sonnet, 200k output tokens).
      exec: (cmd) => {
        ran.push(cmd)
        appendFileSync(join(root, '.agent-traces', '2026-10-14.jsonl'), line(`2026-10-14T10:0${ran.length}:00Z`, 'claude-sonnet-5-5', { outputTokens: 200_000 }) + '\n')
        return ran.length === 2 ? 1 : 0
      },
      done: () => false,
    })
    // $0, $2, $4 start three runs; the fourth would start at $6 >= $5.
    expect(ran).toHaveLength(3)
    expect(result).toMatchObject({ ran: 3, capped: true })
    expect(result.spend).toBeCloseTo(6)
  })

  it('skips runs that already reported and runs the rest in order', () => {
    const ran = []
    const result = runCapped({ commands: parseCommands(SCRIPT), cap: 5, spend: () => 0, exec: (cmd) => (ran.push(cmd), 0), done: (out) => out === 'runs/r1' || out === 'runs/r3' })
    expect(ran.map((c) => /--out (\S+)/.exec(c)[1])).toEqual(['runs/r2', 'runs/r4', 'runs/r5'])
    expect(result).toMatchObject({ ran: 3, skipped: 2, capped: false })
  })

  // T-0342: the ledger keeps the sample and the effort; a bare numeric tail stays in the scenario until the archive
  // sees siblings with the same stem (the archive test below buckets T-0329-style samples).
  it('records the scenario, sample and effort a probe command names', () => {
    const r = runRecord('npm run chat:probe -- --agent croupier --model claude-haiku-5-5 --effort high --say hi --out runs/t0329-mix-7 --name t0329-mix-7', 0, 'a', 'b', 'pass')
    expect([r.scenario, r.sample, r.effort]).toEqual(['t0329-mix-7', 1, 'high'])
    const d = runRecord('npm run chat:probe -- --agent croupier --say hi --out runs/x --name regress-croupier-spanish-21-opus-2', 1, 'a', 'b', 'fail')
    expect([d.scenario, d.sample, d.effort]).toEqual(['regress-croupier-spanish-21', 2, 'default'])
  })

  // T-0341: a run whose estimate would take the spend past the cap is not started; cheaper runs after it still run.
  it('skips a run as a cap skip when the spend plus its estimate would pass the cap', () => {
    const script = ['# est $1', 'npm run chat:probe -- --out runs/a', '# est $5', 'npm run chat:probe -- --out runs/b', '# est $0.5', 'npm run chat:probe -- --out runs/c', 'npm run chat:probe -- --out runs/d'].join('\n')
    const cmds = parseCommands(script)
    expect(cmds.map((c) => c.est)).toEqual([1, 5, 0.5, undefined])
    let spend = 0
    const ran = []
    const skips = []
    const result = runCapped({
      commands: cmds,
      cap: 4,
      spend: () => spend,
      exec: (cmd) => {
        ran.push(/--out (\S+)/.exec(cmd)[1])
        spend += 1.5
        return 0
      },
      onCapSkip: (c, at) => skips.push([c.out, at]),
      done: () => false,
    })
    // a starts at $0 (+1 <= 4); b would reach $6.5; c starts at $1.5 (+0.5); d has no estimate and starts at $3.
    expect(ran).toEqual(['runs/a', 'runs/c', 'runs/d'])
    expect(skips).toEqual([['runs/b', 1.5]])
    expect(result).toMatchObject({ ran: 3, capped: true, capSkipped: ['runs/b'] })
    // Without the estimate line the same run starts: the skip is the estimate's doing.
    const plain = runCapped({ commands: parseCommands(script.replace('# est $5\n', '')), cap: 4, spend: () => 0, exec: () => 0, done: () => false })
    expect(plain).toMatchObject({ ran: 4, capped: false, capSkipped: [] })
  })

  it('keeps the round start across a restart', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'run-capped-')), 'runs', '.capped-start')
    expect(roundStart(file, () => '2026-10-14T10:00:00.000Z')).toBe('2026-10-14T10:00:00.000Z')
    expect(roundStart(file, () => '2026-10-14T23:00:00.000Z')).toBe('2026-10-14T10:00:00.000Z')
  })

  // T-0241: the round archives its traces, ledger and manifest, also when the cap stops it.
  describe('archive', () => {
    const ROUND = ['croupier-deal-haiku-1', 'croupier-deal-sonnet-1', 'admiral-salvo-sonnet-1'].map(
      (n) => `npm run chat:probe -- --agent ${n.split('-')[0]} --model claude-${n.split('-').at(-2)}-5-5 --say "Let's go." --out .sdlc/rt/runs/${n} --name ${n}`,
    ).join('\n')
    const SINCE = '2026-10-14T10:00:00.000Z'

    /** A tmp root with traces before and after the round window, and a fake probe that appends one turn per run. */
    function setup() {
      const root = mkdtempSync(join(tmpdir(), 'run-capped-archive-'))
      const traces = join(root, '.agent-traces')
      mkdirSync(traces)
      writeFileSync(join(traces, '2026-10-13.jsonl'), line('2026-10-13T09:00:00.000Z', 'claude-opus-5-5', { outputTokens: 1_000 }) + '\n')
      writeFileSync(join(traces, '2026-10-14.jsonl'), line('2026-10-14T09:59:59.000Z', 'claude-opus-5-5', { outputTokens: 1_000 }) + '\n')
      // A turn after the window closes (another session's), present before the round starts so nothing races.
      writeFileSync(join(traces, '2026-10-15.jsonl'), line('2026-10-15T23:00:00.000Z', 'claude-opus-5-5', { outputTokens: 1_000 }) + '\n')
      let tick = 0
      const now = () => `2026-10-14T10:${String(tick++).padStart(2, '0')}:00.000Z`
      const exec = (cmd) => {
        const model = /--model (\S+)/.exec(cmd)[1]
        // Two turns per run, each 100k input and 100k output tokens.
        for (let i = 0; i < 2; i++) appendFileSync(join(traces, '2026-10-14.jsonl'), line(now(), model, { inputTokens: 100_000, outputTokens: 100_000 }) + '\n')
        const out = join(root, /--out (\S+)/.exec(cmd)[1])
        mkdirSync(out, { recursive: true })
        writeFileSync(join(out, 'report.json'), JSON.stringify({ verdict: cmd.includes('admiral') ? 'fail' : 'pass' }))
        return cmd.includes('admiral') ? 1 : 0
      }
      return { root, now, exec, round: join(root, '.sdlc', 'rt') }
    }
    const read = (f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l))

    it('writes traces/, ledger.jsonl and round.json with the window lines, ranges and totals', () => {
      const { root, now, exec, round } = setup()
      writeFileSync(join(root, 'live.sh'), ROUND)
      const result = runRound({ root, liveCommands: 'live.sh', commands: parseCommands(ROUND), cap: 100, since: SINCE, exec, commit: 'abc123', now })
      expect(result).toMatchObject({ ran: 3, capped: false })

      // Only in-window lines: no file for the day before or the turn after, and the 09:59 line is dropped.
      expect(existsSync(join(round, 'traces', '2026-10-13.jsonl'))).toBe(false)
      expect(existsSync(join(round, 'traces', '2026-10-15.jsonl'))).toBe(false)
      const kept = read(join(round, 'traces', '2026-10-14.jsonl'))
      expect(kept).toHaveLength(6)
      expect(kept.every((d) => d.at >= SINCE)).toBe(true)

      const ledger = read(join(round, 'ledger.jsonl'))
      expect(ledger.map((r) => [r.scenario, r.agent, r.model, r.exitCode, r.verdict])).toEqual([
        ['croupier-deal', 'croupier', 'claude-haiku-5-5', 0, 'pass'],
        ['croupier-deal', 'croupier', 'claude-sonnet-5-5', 0, 'pass'],
        ['admiral-salvo', 'admiral', 'claude-sonnet-5-5', 1, 'fail'],
      ])
      expect(ledger.map((r) => r.traces)).toEqual([1, 3, 5].map((from) => [{ file: 'traces/2026-10-14.jsonl', from, to: from + 1 }]))
      // T-0342: the sample the name ends in, and the effort the command passed (none here: the default).
      expect(ledger.map((r) => [r.sample, r.effort])).toEqual([[1, 'default'], [1, 'default'], [1, 'default']])
      expect(ledger[0].tokens).toEqual({ input: 200_000, output: 200_000, cacheRead: 0, cacheCreation: 0 })
      // Haiku: 0.2M x $0.10 + 0.2M x $0.50; Sonnet: 0.2M x $2 + 0.2M x $10.
      expect(ledger.map((r) => r.costUsd)).toEqual([0.12, 2.4, 2.4])
      expect(ledger[0].startedAt < ledger[0].endedAt).toBe(true)

      const manifest = JSON.parse(readFileSync(join(round, 'round.json'), 'utf8'))
      expect(manifest).toMatchObject({ commit: 'abc123', liveCommands: 'live.sh', cap: 100, stop: 'done', window: { since: SINCE } })
      expect(manifest.prices.source).toMatch(/claude-api/)
      expect(manifest.totals).toEqual({ runs: 3, traceLines: 6, tokens: { input: 600_000, output: 600_000, cacheRead: 0, cacheCreation: 0 }, costUsd: 4.92 })
      expect(manifest.files.screenshots).toMatch(/local cache outside the repo/)
      expect(existsSync(join(round, '.gitignore'))).toBe(false)
    })

    // T-0259: a live probe's report carries the runId it sent as x-a2ui-run-id and the proxy wrote on its trace
    // lines; the ledger keeps it and matches the run's trace range on it, so a stray line inside the window
    // (another session's turn, or the next run's early turn) is not counted into the run.
    it('matches a run to its trace lines by runId, not by the time window, when the report has one', () => {
      const { root, now, round } = setup()
      const traces = join(root, '.agent-traces')
      const tagged = (at, model, runId) => JSON.stringify({ at, model, runId, usage: { inputTokens: 100_000, outputTokens: 100_000 } })
      const exec = (cmd) => {
        const name = /--name (\S+)/.exec(cmd)[1]
        const model = /--model (\S+)/.exec(cmd)[1]
        const runId = `${name}-cafe0001`
        appendFileSync(join(traces, '2026-10-14.jsonl'), tagged(now(), model, runId) + '\n')
        // A line from another session lands inside this run's window.
        appendFileSync(join(traces, '2026-10-14.jsonl'), tagged(now(), model, 'someone-else-0001') + '\n')
        appendFileSync(join(traces, '2026-10-14.jsonl'), tagged(now(), model, runId) + '\n')
        const out = join(root, /--out (\S+)/.exec(cmd)[1])
        mkdirSync(out, { recursive: true })
        writeFileSync(join(out, 'report.json'), JSON.stringify({ verdict: 'pass', runId }))
        return 0
      }
      runRound({ root, liveCommands: 'live.sh', commands: parseCommands(ROUND), cap: 100, since: SINCE, exec, commit: 'abc123', now })
      const ledger = read(join(round, 'ledger.jsonl'))
      expect(ledger.map((r) => r.runId)).toEqual(['croupier-deal-haiku-1-cafe0001', 'croupier-deal-sonnet-1-cafe0001', 'admiral-salvo-sonnet-1-cafe0001'])
      // Each run owns lines 1 and 3 of its own triple; the foreign middle line is in neither range.
      expect(ledger.map((r) => r.traces)).toEqual([0, 3, 6].map((o) => [{ file: 'traces/2026-10-14.jsonl', from: o + 1, to: o + 1 }, { file: 'traces/2026-10-14.jsonl', from: o + 3, to: o + 3 }]))
      expect(ledger.map((r) => r.tokens.input)).toEqual([200_000, 200_000, 200_000])
      // The kept trace lines themselves carry the id the ledger and the report name.
      const kept = read(join(round, 'traces', '2026-10-14.jsonl'))
      expect(kept.filter((d) => d.runId === ledger[0].runId)).toHaveLength(2)
    })

    it('still writes the archive when the cap stops the round, and keeps earlier rows on a restart', () => {
      const { root, now, exec, round } = setup()
      const commands = parseCommands(ROUND)
      // The first run (Haiku, $0.12) fits; the second would start at or over a $0.10 cap.
      const first = runRound({ root, liveCommands: 'live.sh', commands, cap: 0.1, since: SINCE, exec, commit: 'abc123', now })
      expect(first).toMatchObject({ ran: 1, capped: true })
      expect(JSON.parse(readFileSync(join(round, 'round.json'), 'utf8'))).toMatchObject({ stop: 'cap', totals: { runs: 1, traceLines: 2 } })
      expect(read(join(round, 'ledger.jsonl'))).toHaveLength(1)

      // A restart under a raised cap skips the reported run and the ledger keeps its row.
      runRound({ root, liveCommands: 'live.sh', commands, cap: 100, since: SINCE, exec, commit: 'abc123', now })
      const ledger = read(join(round, 'ledger.jsonl'))
      expect(ledger.map((r) => r.name)).toEqual(['croupier-deal-haiku-1', 'croupier-deal-sonnet-1', 'admiral-salvo-sonnet-1'])
      expect(ledger[0].traces).toEqual([{ file: 'traces/2026-10-14.jsonl', from: 1, to: 2 }])
      expect(JSON.parse(readFileSync(join(round, 'round.json'), 'utf8'))).toMatchObject({ stop: 'done', totals: { runs: 3, costUsd: 4.92 } })
    })

    // T-0341: an estimate that would pass the cap records a cap skip in round.json and stops the round as `cap`.
    it('records cap skips in round.json', () => {
      const { root, now, exec, round } = setup()
      const lines = ROUND.split('\n')
      const script = [lines[0], '# est $50', lines[1], lines[2]].join('\n')
      const result = runRound({ root, liveCommands: 'live.sh', commands: parseCommands(script), cap: 10, since: SINCE, exec, commit: 'abc123', now })
      expect(result).toMatchObject({ ran: 2, capped: true, capSkipped: ['.sdlc/rt/runs/croupier-deal-sonnet-1'] })
      expect(JSON.parse(readFileSync(join(round, 'round.json'), 'utf8'))).toMatchObject({ stop: 'cap', capSkipped: ['.sdlc/rt/runs/croupier-deal-sonnet-1'], totals: { runs: 2 } })
    })

    it('marks a crashed round and keeps the runs it finished', () => {
      const { root, now, exec, round } = setup()
      let n = 0
      const crashing = (cmd) => {
        if (++n === 2) throw new Error('probe crashed')
        return exec(cmd)
      }
      expect(() => runRound({ root, liveCommands: 'live.sh', commands: parseCommands(ROUND), cap: 100, since: SINCE, exec: crashing, commit: 'abc123', now })).toThrow('probe crashed')
      expect(JSON.parse(readFileSync(join(round, 'round.json'), 'utf8'))).toMatchObject({ stop: 'crash', totals: { runs: 1 } })
    })

    // T-0342: bare-numbered samples bucket into one scenario once the ledger holds their siblings, and signals.md is
    // written once, by the final archive, not after every run.
    it('buckets T-0329-style samples by their siblings and writes signals.md only at the end', () => {
      const root = mkdtempSync(join(tmpdir(), 'run-capped-samples-'))
      mkdirSync(join(root, '.agent-traces'))
      let tick = 0
      const now = () => `2026-10-14T12:${String(tick++).padStart(2, '0')}:00.000Z`
      const names = ['t0329-mix-1', 't0329-mix-2', 't0329-mix-pontoon']
      const script = names.map((n) => `npm run chat:probe -- --agent croupier --model claude-haiku-5-5 --say hi --out .sdlc/tq/runs/${n} --name ${n}`).join('\n')
      const dir = join(root, '.sdlc', 'tq')
      const seen = []
      runRound({
        root,
        liveCommands: 'live.sh',
        commands: parseCommands(script),
        cap: 100,
        since: '2026-10-14T12:00:00.000Z',
        commit: 'abc123',
        now,
        exec: (cmd) => {
          seen.push(existsSync(join(dir, 'signals.md')))
          const out = join(root, /--out (\S+)/.exec(cmd)[1])
          mkdirSync(out, { recursive: true })
          writeFileSync(join(out, 'report.json'), JSON.stringify({ verdict: 'pass', agent: 'croupier', model: 'claude-haiku-5-5' }))
          return 0
        },
      })
      expect(seen).toEqual([false, false, false])
      expect(read(join(dir, 'ledger.jsonl')).map((r) => [r.scenario, r.sample])).toEqual([['t0329-mix', 1], ['t0329-mix', 2], ['t0329-mix-pontoon', 1]])
      expect(readFileSync(join(dir, 'signals.md'), 'utf8')).toContain('| t0329-mix | 2 of 2 |')
    })
  })

  // T-0241 scope addition: the README names exactly the files in the folder, no more and no fewer.
  describe('README', () => {
    /** The paths a README claims: the Files bullets plus each Runs row's folder joined with its file cells. */
    function claimed(readme) {
      const paths = []
      for (const l of readme.split('\n')) {
        const bullet = /^- `([^`]+)`: /.exec(l)
        if (bullet && !l.startsWith('- `report.json`') && !l.startsWith('- `fixture.json`') && !l.startsWith('- `turn-<n>.png`')) paths.push(bullet[1])
        const row = /^\| `(runs\/[^`]+\/)` \|.*\| ([^|]*) \|$/.exec(l)
        if (row) for (const m of row[2].matchAll(/`([^`]+)`/g)) paths.push(row[1] + m[1])
      }
      return paths.sort()
    }

    it('the archive README lists every file the archive wrote and none it did not', () => {
      const root = mkdtempSync(join(tmpdir(), 'run-capped-readme-'))
      mkdirSync(join(root, '.agent-traces'))
      let tick = 0
      const now = () => `2026-10-14T11:${String(tick++).padStart(2, '0')}:00.000Z`
      const script = 'npm run chat:probe -- --agent croupier --model claude-haiku-5-5 --out .sdlc/rr/runs/croupier-deal-haiku-1 --name croupier-deal-haiku-1'
      runRound({
        root,
        liveCommands: 'live.sh',
        commands: parseCommands(script),
        cap: 100,
        since: '2026-10-14T11:00:00.000Z',
        commit: 'abc123',
        now,
        exec: (cmd) => {
          appendFileSync(join(root, '.agent-traces', '2026-10-14.jsonl'), line(now(), 'claude-haiku-5-5', { outputTokens: 10 }) + '\n')
          const out = join(root, /--out (\S+)/.exec(cmd)[1])
          mkdirSync(out, { recursive: true })
          writeFileSync(join(out, 'report.json'), JSON.stringify({ verdict: 'pass', agent: 'croupier', model: 'claude-haiku-5-5' }))
          writeFileSync(join(out, 'fixture.json'), '{}')
          return 0
        },
      })
      const dir = join(root, '.sdlc', 'rr')
      const readme = readFileSync(join(dir, 'README.md'), 'utf8')
      expect(listRound(dir)).toEqual(['README.md', 'ledger.jsonl', 'round.json', 'runs/croupier-deal-haiku-1/fixture.json', 'runs/croupier-deal-haiku-1/report.json', 'signals.md', 'traces/2026-10-14.jsonl'])
      expect(readme).toContain('local evidence cache')
      expect(claimed(readme)).toEqual(listRound(dir))
      expect(readme).toContain('commit `abc123`')
      expect(readme).toContain('--replay .sdlc/rr/runs/<name>/fixture.json')
      expect(readme).not.toContain('Not described')
    })

    it('--describe on a backfilled folder lists exactly its contents and claims no absent file', () => {
      const dir = join(mkdtempSync(join(tmpdir(), 'run-capped-describe-')), 'live-round-x')
      mkdirSync(join(dir, 'traces'), { recursive: true })
      mkdirSync(join(dir, 'runs', 'admiral-concede-sonnet-1'), { recursive: true })
      writeFileSync(join(dir, 'traces', '2026-10-15.jsonl'), '{}\n')
      writeFileSync(join(dir, 'traces', 'runner-ledger.log'), '[1/1] rc=0 $0.10 :: runs/admiral-concede-sonnet-1\n')
      writeFileSync(join(dir, 'runs', 'admiral-concede-sonnet-1', 'report.json'), JSON.stringify({ verdict: 'fail', agent: 'admiral', model: 'claude-sonnet-5-5', at: '2026-10-15T01:00:00.000Z' }))
      writeFileSync(join(dir, 'handoff.md'), '')
      writeRoundReadme(dir)
      const readme = readFileSync(join(dir, 'README.md'), 'utf8')
      expect(claimed(readme)).toEqual(listRound(dir))
      expect(claimed(readme)).toEqual(['README.md', 'handoff.md', 'runs/admiral-concede-sonnet-1/report.json', 'traces/2026-10-15.jsonl', 'traces/runner-ledger.log'])
      expect(readme).toMatch(/hand-copied runner log|hand-copied by the conductor on 2026-10-15/)
      expect(readme).not.toMatch(/`round\.json`:|`ledger\.jsonl`:|`live-commands\.sh`:|`report\.md`:/)
      expect(describeRound(dir)).toBe(readme)
    })

    // T-0248: a round ingested into context-fog-of-war shows its report id from `evals/fog/<round>.json`.
    it('--describe shows the fog report id when evals/fog holds a record for the round', () => {
      const evals = join(mkdtempSync(join(tmpdir(), 'run-capped-fog-')), 'evals')
      const dir = join(evals, 'rounds', '2026-10-15-r2-presets')
      mkdirSync(join(dir, 'traces'), { recursive: true })
      writeFileSync(join(dir, 'traces', '2026-10-15.jsonl'), '{}\n')
      expect(describeRound(dir)).not.toContain('## Context fog-of-war')
      mkdirSync(join(evals, 'fog'))
      writeFileSync(join(evals, 'fog', '2026-10-15-r2-presets.json'), JSON.stringify({ reportId: 'a7f791520f89dbbb61819b92', mapping: '.sdlc/evals/fog-manifest.json', mappingHash: 'c2396ca6924269db', events: 281, sources: 84, findings: 0, ticket: 'T-0248' }))
      const readme = describeRound(dir)
      expect(readme).toContain('Report: `a7f791520f89dbbb61819b92`')
      expect(readme).toContain('281 events, 84 sources, 0 findings')
      expect(claimed(readme)).toEqual(['README.md', 'traces/2026-10-15.jsonl'])
    })
  })

  // T-0241 scope addition 2: one home for every round, `.sdlc/evals/rounds/<date>-<slug>/`, and its index.
  describe('evals home', () => {
    it('--round writes under evals/rounds/<date>-<slug>/, reuses it on a restart and regenerates the index row', () => {
      const root = mkdtempSync(join(tmpdir(), 'run-capped-evals-'))
      mkdirSync(join(root, '.agent-traces'))
      // An earlier round already in the home, backfilled (no round.json).
      const old = join(root, '.sdlc', 'evals', 'rounds', '2026-10-14-r1-croupier', 'runs', 'blackjack-moves-haiku-1')
      mkdirSync(old, { recursive: true })
      writeFileSync(join(old, 'report.json'), JSON.stringify({ verdict: 'fail', agent: 'croupier', model: 'claude-haiku-5-5' }))
      writeFileSync(join(root, '.sdlc', 'evals', 'rounds', '2026-10-14-r1-croupier', 'live-commands.sh'), '# T-0184 Croupier closed-loop live runs.\n')
      // The generated script points at some other folder; --round retargets it.
      const script = ['# T-0300 smoke round', ...['croupier-deal-haiku-1', 'croupier-deal-sonnet-1'].map((n) => `npm run chat:probe -- --agent croupier --model claude-${n.split('-').at(-2)}-5-5 --out .sdlc/elsewhere/runs/${n} --name ${n}`)].join('\n')
      writeFileSync(join(root, 'live.sh'), script)
      let day = '2026-10-16'
      let tick = 0
      const now = () => `${day}T12:${String(tick++).padStart(2, '0')}:00.000Z`
      const ran = []
      const exec = (cmd) => {
        ran.push(/--out (\S+)/.exec(cmd)[1])
        appendFileSync(join(root, '.agent-traces', `${day}.jsonl`), line(now(), 'claude-haiku-5-5', { outputTokens: 1_000_000 }) + '\n')
        const out = join(root, /--out (\S+)/.exec(cmd)[1])
        mkdirSync(out, { recursive: true })
        writeFileSync(join(out, 'report.json'), JSON.stringify({ verdict: 'pass', agent: 'croupier', model: /--model (\S+)/.exec(cmd)[1] }))
        return 0
      }
      const first = runRound({ root, liveCommands: 'live.sh', commands: parseCommands(script), cap: 0.4, round: 'smoke', exec, commit: 'abc123', now })
      expect(first).toMatchObject({ ran: 1, capped: true })
      const home = '.sdlc/evals/rounds/2026-10-16-smoke'
      expect(ran).toEqual([`${home}/runs/croupier-deal-haiku-1`])
      expect(readFileSync(join(root, home, 'live-commands.sh'), 'utf8')).toContain(`--out ${home}/runs/croupier-deal-sonnet-1`)
      expect(readFileSync(join(root, home, 'runs', '.capped-start'), 'utf8').trim()).toBe('2026-10-16T12:01:00.000Z')

      // A restart on a later day keeps the folder its round start named.
      day = '2026-10-17'
      runRound({ root, liveCommands: 'live.sh', commands: parseCommands(script), cap: 100, round: 'smoke', exec, commit: 'abc123', now })
      expect(ran).toEqual([`${home}/runs/croupier-deal-haiku-1`, `${home}/runs/croupier-deal-sonnet-1`])
      expect(existsSync(join(root, '.sdlc', 'evals', 'rounds', '2026-10-17-smoke'))).toBe(false)
      expect(JSON.parse(readFileSync(join(root, home, 'round.json'), 'utf8'))).toMatchObject({ liveCommands: `${home}/live-commands.sh`, totals: { runs: 2 } })

      const index = readFileSync(join(root, '.sdlc', 'evals', 'README.md'), 'utf8')
      expect(index).toBe(describeEvals(join(root, '.sdlc', 'evals')))
      const rows = index.split('\n').filter((l) => /^\| \d{4}-/.test(l))
      expect(rows).toEqual([
        '| 2026-10-14 | [2026-10-14-r1-croupier](rounds/2026-10-14-r1-croupier/) | T-0184 | croupier | claude-haiku-5-5 | 1 | 0 | unknown |',
        '| 2026-10-16 | [2026-10-16-smoke](rounds/2026-10-16-smoke/README.md) | T-0300 | croupier | claude-haiku-5-5, claude-sonnet-5-5 | 2 | 2 | $1.00 |',
      ])
    })
  })
})
