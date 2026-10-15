// T-0225: the capped live-round runner, keyless. Fake traces stand in for the dev proxy: each fake probe appends
// one trace line, and the runner must stop before the run that would start at or over the cap, skip runs that
// already reported, and keep its baseline across a restart.
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { estimateSpend, parseCommands, roundStart, runCapped, traceSpend } from './run-capped.ts'

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

  it('keeps the round start across a restart', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'run-capped-')), 'runs', '.capped-start')
    expect(roundStart(file, () => '2026-10-14T10:00:00.000Z')).toBe('2026-10-14T10:00:00.000Z')
    expect(roundStart(file, () => '2026-10-14T23:00:00.000Z')).toBe('2026-10-14T10:00:00.000Z')
  })
})
