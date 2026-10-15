// T-0259: the fog-of-war round manifest against real trace lines. The lines come from the real TurnTraceCollector
// (so the manifest is tested against the shape the dev proxy writes, not a hand-copy), a round folder is built
// from them, and the context-fog-of-war skill's own `engineer.py ingest` assesses it with `.sdlc/evals/fog-manifest.json`.
// The skill lives in the user's home (`~/.claude/skills/context-fog-of-war`), not in this repo, so the ingest legs skip
// where it is absent (CI); the line-shape leg always runs.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TurnTraceCollector } from '../../../packages/agent-ui/a2ui/tools/agent/trace-log.ts'

const SKILL = join(homedir(), '.claude', 'skills', 'context-fog-of-war', 'scripts', 'engineer.py')
const MANIFEST = new URL('../../../.sdlc/evals/fog-manifest.json', import.meta.url).pathname
const FINAL = '{"a2uiMeta":{"note":"ok","trace":{"turnIndex":0,"query":{"intent":"x","k":3},"exemplarIds":[],"rounds":1,"healed":0,"failureCodes":[],"model":"m"}}}'

let clock = Date.parse('2026-10-15T12:00:00Z')
/** One produce turn as the dev proxy writes it: context ids from produce(), tool events from the adapter. */
async function turn({ runId = 'run-1', retrieved, framed, tool, finish = true }) {
  clock += 1000
  const t = new TurnTraceCollector({ route: 'produce', provider: 'anthropic', model: 'm', user: 'u', ...(runId ? { runId } : {}) }, () => clock)
  t.onContext({ retrievedIds: retrieved, framedIds: framed })
  const provider = t.wrapProvider({
    async *stream(req) {
      if (tool) {
        req.onEvent?.({ kind: 'tool_result', id: tool.id, text: 'weather', ok: true })
        if (tool.submit) req.onEvent?.({ kind: 'tool_submitted', id: tool.id })
      }
      yield 'x'
    },
  })
  for await (const _ of provider.stream({ model: 'm', system: 's', messages: [] })) void _
  if (finish) t.observeLine(FINAL)
  return JSON.stringify(t.finish())
}

function round(lines) {
  const dir = mkdtempSync(join(tmpdir(), 'fog-round-'))
  mkdirSync(join(dir, 'round', 'traces'), { recursive: true })
  writeFileSync(join(dir, 'round', 'traces', '2026-10-15.jsonl'), lines.join('\n') + '\n')
  return dir
}

function ingest(dir) {
  const r = spawnSync('python3', [SKILL, '--root', join(dir, 'library'), 'ingest', join(dir, 'round'), '--mapping', MANIFEST, '--out', join(dir, 'out')], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout + r.stderr, session: existsSync(join(dir, 'out', 'session.json')) ? JSON.parse(readFileSync(join(dir, 'out', 'session.json'), 'utf8')) : undefined }
}

describe('trace events (T-0259)', () => {
  it('a turn records retrieved vs framed ids and each tool result with whether it was submitted', async () => {
    const line = JSON.parse(await turn({ runId: 'r-9', retrieved: ['e1', 'e2'], framed: ['e1'], tool: { id: 'toolu_1', submit: false } }))
    expect(line.events).toEqual({
      retrieval: { success: true, chunkIds: ['e1', 'e2'] },
      framedExemplarIds: ['e1'],
      toolResults: [{ runId: 'r-9', requestId: line.at, resultId: 'toolu_1', success: true }],
      submittedToolResultIds: [],
      complete: true,
    })
  })

  it('an empty retrieval is not a successful one, and a turn that never finished declares no completeness', async () => {
    const empty = JSON.parse(await turn({ retrieved: [], framed: [] }))
    expect(empty.events.retrieval).toEqual({ success: false, chunkIds: [] })
    const cut = JSON.parse(await turn({ retrieved: ['e1'], framed: ['e1'], finish: false }))
    expect(cut.events).not.toHaveProperty('complete')
  })
})

/** The coverage line of one detector in the ingest's diagnosis: its status, linked pairs and signals. */
function coverage(out, detector) {
  const m = new RegExp(`^${detector}: ([a-z-]+); (\\d+) linked [^;]*; (\\d+) signal`, 'm').exec(out)
  if (m === null) throw new Error(`no coverage line for ${detector} in:\n${out}`)
  return { status: m[1], pairs: Number(m[2]), signals: Number(m[3]) }
}

describe.skipIf(!existsSync(SKILL))('fog detectors assess a round (T-0259)', () => {
  it('reports an exemplar retrieved but not framed, and a tool result never placed in the next request', async () => {
    const dir = round([await turn({ retrieved: ['e1', 'e2'], framed: ['e1'], tool: { id: 'toolu_1', submit: false } })])
    const r = ingest(dir)
    expect(r.status).toBe(0)
    expect(coverage(r.out, 'retrieved-not-submitted')).toEqual({ status: 'findings-observed', pairs: 1, signals: 1 })
    expect(coverage(r.out, 'tool-result-not-propagated')).toEqual({ status: 'findings-observed', pairs: 1, signals: 1 })
    expect(r.out).toContain('Returned chunks absent from the complete target request identity list: e2')
    expect(r.out).toContain('Successful tool result toolu_1 absent from the complete target request identity list.')
  })

  it('a clean round has eligible pairs and no finding', async () => {
    const dir = round([
      await turn({ retrieved: ['e1', 'e2'], framed: ['e1', 'e2'], tool: { id: 'toolu_1', submit: true } }),
      await turn({ runId: 'run-2', retrieved: ['e3'], framed: ['e3'] }),
    ])
    const r = ingest(dir)
    expect(r.status).toBe(0)
    expect(r.out).toContain('Diagnosis: 0 evidence-backed signals')
    expect(coverage(r.out, 'retrieved-not-submitted')).toEqual({ status: 'assessed-no-signal', pairs: 2, signals: 0 })
    expect(coverage(r.out, 'tool-result-not-propagated')).toEqual({ status: 'assessed-no-signal', pairs: 1, signals: 0 })
    // One conversation per run: the two turns carry two run ids.
    expect(new Set(r.session.bundle.records.map((x) => x.normalized.conversationId))).toEqual(new Set(['run-1', 'run-2']))
  })

  it('a turn that never finished declares no completeness, an empty retrieval is excluded, a line with no runId is not grouped', async () => {
    const dir = round([
      await turn({ retrieved: ['e1', 'e2'], framed: ['e1'], finish: false }),
      await turn({ runId: 'run-2', retrieved: [], framed: [] }),
      await turn({ runId: '', retrieved: ['e5'], framed: [] }),
    ])
    const r = ingest(dir)
    expect(r.status).toBe(0)
    expect(coverage(r.out, 'retrieved-not-submitted')).toMatchObject({ status: 'insufficient-evidence', pairs: 0, signals: 0 })
    expect(r.out).not.toContain('Returned chunks absent')
    expect(r.session.bundle.records.every((x) => x.normalized.conversationId !== '')).toBe(true)
  })
})
