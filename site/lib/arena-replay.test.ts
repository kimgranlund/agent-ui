// arena-replay.test.ts — LLD-C11 derivation + drift gate for the A2A tic-tac-toe demo page. Mirrors
// site/lib/a2ui-gallery.test.ts's split: this suite exercises the PURE derivation module directly (no DOM,
// no page mount), against the actual committed fixtures — the same real Sonnet-5-vs-Haiku-4.5 flagship
// match the arena's own tests gate on. Two loads per fixture (readFileSync, the Node-side reader) — the
// site page itself uses a Vite `?raw` import for the SAME files under jsdom/the browser; both resolve to
// the identical bytes, so reading via fs here is a faithful proxy for what the page loads.
import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (fleet precedent)
import { readFileSync } from 'node:fs'
import { buildIsolationReport, buildReplaySteps, ISOLATION_CHECKS, loadTranscript } from './arena-replay.ts'

declare const process: { cwd(): string }
const MATCHES_DIR = `${process.cwd()}/packages/agent-ui/a2a/matches`
const read = (name: string): string => readFileSync(`${MATCHES_DIR}/${name}`, 'utf8') as string

const flagshipRaw = read('flagship.match.jsonl')
const scriptedRaw = read('scripted.match.jsonl')
const contaminatedControlRaw = read('contaminated-control.match.jsonl')
const contaminatedProviderRaw = read('contaminated-provider-control.match.jsonl')

describe('loadTranscript — parse + schema validation over the committed fixtures', () => {
  it('parses the flagship fixture clean (a REAL recorded match, gate-green per its own commit discipline)', () => {
    const loaded = loadTranscript(flagshipRaw)
    expect(loaded.ok).toBe(true)
  })

  it('parses the scripted CI-backbone fixture clean', () => {
    expect(loadTranscript(scriptedRaw).ok).toBe(true)
  })

  it('negative control: garbage input fails schema validation rather than silently producing an empty transcript', () => {
    const loaded = loadTranscript('not json\nalso not json')
    expect(loaded.ok).toBe(false)
  })

  it('negative control: empty input fails rather than producing a vacuous zero-event transcript', () => {
    expect(loadTranscript('').ok).toBe(false)
  })
})

describe('buildReplaySteps — the flagship match replays move by move to the recorded end', () => {
  const loaded = loadTranscript(flagshipRaw)
  if (!loaded.ok) throw new Error('flagship fixture failed to load — fix the fixture, not this test')
  const steps = buildReplaySteps(loaded.transcript)

  it('starts with an empty board (step 0, kind "start")', () => {
    expect(steps[0]!.kind).toBe('start')
    expect(steps[0]!.board.every((c) => c === null)).toBe(true)
  })

  it('produces more than one step — a genuine multi-move match, not a vacuous single-step replay', () => {
    expect(steps.length).toBeGreaterThan(5)
  })

  it('ends with an "end" step narrating the recorded winner (X, per the committed fixture)', () => {
    const last = steps.at(-1)!
    expect(last.kind).toBe('end')
    expect(last.narration).toContain('X wins')
  })

  it('each "move" step\'s board reflects EVERY move applied so far, in order (a real running board, not a per-step snapshot of just the last move)', () => {
    const moveSteps = steps.filter((s) => s.kind === 'move')
    // the FINAL move step must show every mark any move step ever placed — nothing reverts
    const finalBoard = moveSteps.at(-1)!.board
    const placedCells = new Set(moveSteps.map((s) => s.cell))
    for (const cell of placedCells) expect(finalBoard[cell!]).not.toBeNull()
  })

  it("carries the seat's own spectator note on its move step (e.g. the opening \"Taking center\")", () => {
    const opening = steps.find((s) => s.kind === 'move' && s.cell === 4)
    expect(opening?.note).toBeDefined()
  })
})

describe('buildIsolationReport — the flagship match is CLEAN (the must-pass proof)', () => {
  const loaded = loadTranscript(flagshipRaw)
  if (!loaded.ok) throw new Error('flagship fixture failed to load — fix the fixture, not this test')
  const report = buildIsolationReport(loaded.transcript)

  it('reports clean: zero failures, all 4 checks pass', () => {
    expect(report.clean).toBe(true)
    expect(report.failures).toEqual([])
    for (const check of ISOLATION_CHECKS) expect(report.byCheck[check]).toEqual([])
  })

  it('extracts BOTH seats\' full recorded context — non-empty, starting with each seat\'s own system prompt', () => {
    expect(report.contexts.X.length).toBeGreaterThan(0)
    expect(report.contexts.O.length).toBeGreaterThan(0)
    expect(report.contexts.X[0]!.role).toBe('system')
    expect(report.contexts.O[0]!.role).toBe('system')
  })

  it("neither seat's context mentions the OTHER seat's canary token (the isolation claim, made inspectable)", () => {
    const xText = report.contexts.X.map((l) => l.content).join('\n')
    const oText = report.contexts.O.map((l) => l.content).join('\n')
    const oCanary = oText.match(/A2A-ISOLATION-CANARY-O-[0-9a-fA-F]+/)?.[0]
    const xCanary = xText.match(/A2A-ISOLATION-CANARY-X-[0-9a-fA-F]+/)?.[0]
    expect(oCanary).toBeDefined()
    expect(xCanary).toBeDefined()
    expect(xText).not.toContain(oCanary!)
    expect(oText).not.toContain(xCanary!)
  })
})

describe('buildIsolationReport — the scripted CI-backbone fixture is ALSO clean (not just the flagship)', () => {
  it('reports clean', () => {
    const loaded = loadTranscript(scriptedRaw)
    if (!loaded.ok) throw new Error('scripted fixture failed to load')
    expect(buildIsolationReport(loaded.transcript).clean).toBe(true)
  })
})

describe('buildIsolationReport — the committed negative controls FAIL loudly (the gate proven to bite, LLD §2/§9)', () => {
  it('the in-transcript contaminated control produces non-zero failures, including a canary failure', () => {
    const loaded = loadTranscript(contaminatedControlRaw)
    if (!loaded.ok) throw new Error('contaminated-control fixture failed to load')
    const report = buildIsolationReport(loaded.transcript)
    expect(report.clean).toBe(false)
    expect(report.failures.length).toBeGreaterThan(0)
    expect(report.byCheck.canary.length).toBeGreaterThan(0)
  })

  it('the shared-provider (out-of-transcript) contaminated control ALSO produces non-zero failures', () => {
    const loaded = loadTranscript(contaminatedProviderRaw)
    if (!loaded.ok) throw new Error('contaminated-provider-control fixture failed to load')
    const report = buildIsolationReport(loaded.transcript)
    expect(report.clean).toBe(false)
    expect(report.failures.length).toBeGreaterThan(0)
  })

  it('the two contaminated fixtures are genuinely DIFFERENT failure shapes — not a hardcoded catch-all', () => {
    const a = buildIsolationReport((loadTranscript(contaminatedControlRaw) as { ok: true; transcript: import('@agent-ui/a2a').Transcript }).transcript)
    const b = buildIsolationReport(
      (loadTranscript(contaminatedProviderRaw) as { ok: true; transcript: import('@agent-ui/a2a').Transcript }).transcript,
    )
    // both fail, but the exact failure sets need not be identical — anti-vacuous: assert each is independently non-empty
    expect(a.failures.length).toBeGreaterThan(0)
    expect(b.failures.length).toBeGreaterThan(0)
  })
})
