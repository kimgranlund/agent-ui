// a2a-tic-tac-toe.ts — LLD-C11 (SPEC-R13, PRD-G2/G4): the A2A tic-tac-toe arena demo — the isolation
// PROOF made visible and the match made watchable. Three parts:
//  1. RECORDED-DEFAULT replay: a committed match fixture (flagship by default — a REAL Sonnet-vs-Haiku
//     match) replayed move by move with ZERO network/model calls (the raw JSONL is a Vite `?raw` static
//     import, so the static build ships no fetch for it).
//  2. THE ISOLATION PANEL (the centerpiece): the SAME `checkIsolation` the arena's own tests run, over the
//     loaded transcript, IN this page — never a hardcoded badge. Each seat's full recorded context is
//     shown side by side with the wire/board timeline, so "neither seat ever saw the other's reasoning" is
//     inspectable, not merely asserted. The contaminated fixtures are one click away, so the gate can be
//     seen FAILING loudly (the proof it bites — LLD §2/§9).
//  3. THE DEV-ONLY LIVE SEAM: the arena dev proxy (`/__a2a/arena`) runs a real match server-side; the "run
//     a live match" control appears only once `probeArenaLive()` reports a key is configured (mirrors the
//     a2ui-live `probeLive()` precedent) — a dynamic import behind `import.meta.env.DEV`, so `vite build`
//     tree-shakes the whole live path out (SPEC-N2).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2a-tic-tac-toe.css'
import type { Board, Transcript } from '@agent-ui/a2a'
import {
  buildIsolationReport,
  buildReplaySteps,
  ISOLATION_CHECKS,
  loadTranscript,
  type ContextLine,
  type IsolationReport,
  type LoadedTranscript,
  type ReplayStep,
} from '../lib/arena-replay.ts'

// The four committed fixtures (LLD-C9) — zero-network static imports (Vite `?raw`). Two must-fail negative
// controls sit right alongside the two must-pass matches, so a viewer can flip to either and watch the
// SAME verdict panel below go red.
import flagshipRaw from '../../packages/agent-ui/a2a/matches/flagship.match.jsonl?raw'
import scriptedRaw from '../../packages/agent-ui/a2a/matches/scripted.match.jsonl?raw'
import contaminatedControlRaw from '../../packages/agent-ui/a2a/matches/contaminated-control.match.jsonl?raw'
import contaminatedProviderRaw from '../../packages/agent-ui/a2a/matches/contaminated-provider-control.match.jsonl?raw'

type FixtureKey = 'flagship' | 'scripted' | 'contaminated-control' | 'contaminated-provider-control' | 'live'

const FIXTURES: Record<Exclude<FixtureKey, 'live'>, { label: string; raw: string }> = {
  flagship: { label: 'Flagship (Sonnet 5 vs Haiku 4.5)', raw: flagshipRaw },
  scripted: { label: 'Scripted (CI backbone)', raw: scriptedRaw },
  'contaminated-control': { label: 'Contaminated — in-transcript', raw: contaminatedControlRaw },
  'contaminated-provider-control': { label: 'Contaminated — shared provider', raw: contaminatedProviderRaw },
}

const { content } = mountPage({ title: 'A2A Tic-Tac-Toe Arena' })
content.append(
  pageLead(
    'Two agents play tic-tac-toe through a deterministic referee that is the ONLY thing either seat ever ' +
      'talks to — a wire audit and a canary token prove neither ever sees the other’s reasoning. Replay a ' +
      'real recorded match below, then read the isolation panel: it runs the SAME checker the build gate ' +
      'runs, live, over whatever transcript is loaded — flip to a contaminated fixture to watch it fail.',
  ),
)

// ── fixture picker ──────────────────────────────────────────────────────────────────────────────────────
const picker = document.createElement('div')
picker.className = 'fixture-picker'
picker.setAttribute('role', 'group')
picker.setAttribute('aria-label', 'Match fixture')
const fixtureButtons = new Map<FixtureKey, HTMLElement>()
for (const key of Object.keys(FIXTURES) as Exclude<FixtureKey, 'live'>[]) {
  const btn = document.createElement('ui-button')
  btn.setAttribute('variant', 'soft')
  btn.setAttribute('tabindex', '0')
  btn.dataset.fixture = key
  btn.textContent = FIXTURES[key].label
  btn.addEventListener('click', () => selectFixture(key))
  fixtureButtons.set(key, btn)
  picker.append(btn)
}
content.append(picker)

const errorPanel = document.createElement('p')
errorPanel.className = 'arena-error'
errorPanel.setAttribute('role', 'status')
errorPanel.dataset.error = ''
errorPanel.hidden = true
content.append(errorPanel)

// ── replay: board + scrubber ────────────────────────────────────────────────────────────────────────────
const replayCard = document.createElement('ui-card')
replayCard.className = 'replay-card'
const boardGrid = document.createElement('div')
boardGrid.className = 'board-grid'
boardGrid.dataset.board = ''
const cells: HTMLElement[] = []
for (let i = 0; i < 9; i++) {
  const cell = document.createElement('div')
  cell.className = 'board-cell'
  cell.dataset.cell = String(i)
  boardGrid.append(cell)
  cells.push(cell)
}
const narration = document.createElement('p')
narration.className = 'narration'
narration.dataset.narration = ''
const stepControls = document.createElement('div')
stepControls.className = 'step-controls'
const prevBtn = document.createElement('ui-button')
prevBtn.setAttribute('variant', 'ghost')
prevBtn.setAttribute('tabindex', '0')
prevBtn.dataset.action = 'prev'
prevBtn.textContent = '← Prev'
const stepLabel = document.createElement('span')
stepLabel.className = 'step-label'
stepLabel.dataset.stepLabel = ''
const nextBtn = document.createElement('ui-button')
nextBtn.setAttribute('variant', 'ghost')
nextBtn.setAttribute('tabindex', '0')
nextBtn.dataset.action = 'next'
nextBtn.textContent = 'Next →'
stepControls.append(prevBtn, stepLabel, nextBtn)
replayCard.append(boardGrid, narration, stepControls)
content.append(replayCard)

function renderBoard(board: Board): void {
  board.forEach((mark, i) => {
    cells[i]!.textContent = mark ?? ''
    cells[i]!.dataset.mark = mark ?? ''
  })
}

// ── isolation panel (the centerpiece) ──────────────────────────────────────────────────────────────────
const isolationCard = document.createElement('ui-card')
isolationCard.className = 'isolation-card'
const verdict = document.createElement('p')
verdict.className = 'isolation-verdict'
verdict.dataset.verdict = ''
const checksList = document.createElement('ul')
checksList.className = 'isolation-checks'
isolationCard.append(verdict, checksList)
content.append(isolationCard)

function renderIsolation(report: IsolationReport): void {
  verdict.dataset.verdict = report.clean ? 'clean' : 'failed'
  verdict.textContent = report.clean
    ? 'ISOLATION VERDICT: CLEAN — all 4 checks passed, no cross-contamination detected.'
    : `ISOLATION VERDICT: FAILED — ${report.failures.length} failure(s) across ${ISOLATION_CHECKS.filter((c) => report.byCheck[c].length > 0).length} check(s).`
  checksList.replaceChildren()
  for (const check of ISOLATION_CHECKS) {
    const failures = report.byCheck[check]
    const li = document.createElement('li')
    li.className = 'isolation-check'
    li.dataset.check = check
    li.dataset.checkStatus = failures.length === 0 ? 'pass' : 'fail'
    const head = document.createElement('span')
    head.className = 'isolation-check-head'
    head.textContent = `${failures.length === 0 ? '✓' : '✗'} ${check} — ${failures.length === 0 ? 'pass' : `${failures.length} failure(s)`}`
    li.append(head)
    if (failures.length > 0) {
      const detail = document.createElement('ul')
      detail.className = 'isolation-check-detail'
      for (const f of failures) {
        const item = document.createElement('li')
        item.textContent = f.detail
        detail.append(item)
      }
      li.append(detail)
    }
    checksList.append(li)
  }
}

// ── side-by-side context inspector: [ seat X | wire+board timeline | seat O ] ─────────────────────────────
const inspector = document.createElement('div')
inspector.className = 'context-columns'
function contextColumn(seatLabel: string): { col: HTMLElement; list: HTMLElement } {
  const col = document.createElement('div')
  col.className = 'context-col'
  const heading = document.createElement('h3')
  heading.textContent = seatLabel
  const list = document.createElement('div')
  list.className = 'context-lines'
  col.append(heading, list)
  return { col, list }
}
const seatXCol = contextColumn('Seat X — full recorded context')
seatXCol.col.dataset.seat = 'X'
const timelineCol = contextColumn('Wire + board timeline')
timelineCol.col.dataset.timeline = ''
const seatOCol = contextColumn('Seat O — full recorded context')
seatOCol.col.dataset.seat = 'O'
inspector.append(seatXCol.col, timelineCol.col, seatOCol.col)
content.append(inspector)

function renderContextLines(list: HTMLElement, lines: readonly ContextLine[]): void {
  list.replaceChildren()
  for (const line of lines) {
    const p = document.createElement('p')
    p.className = 'context-line'
    p.dataset.role = line.role
    p.textContent = `[${line.role}] ${line.content}`
    list.append(p)
  }
}

function renderTimeline(steps: readonly ReplayStep[]): void {
  timelineCol.list.replaceChildren()
  for (const step of steps) {
    const p = document.createElement('p')
    p.className = 'context-line timeline-step'
    p.dataset.kind = step.kind
    p.textContent = step.narration
    timelineCol.list.append(p)
  }
}

// ── state + wiring ──────────────────────────────────────────────────────────────────────────────────────
let currentSteps: ReplayStep[] = []
let stepIndex = 0
let liveRaw: string | undefined

function renderStep(): void {
  const step = currentSteps[stepIndex]
  if (step === undefined) return
  renderBoard(step.board)
  narration.textContent = step.narration
  stepLabel.textContent = `Move ${stepIndex} of ${currentSteps.length - 1}`
  prevBtn.toggleAttribute('disabled', stepIndex === 0)
  nextBtn.toggleAttribute('disabled', stepIndex === currentSteps.length - 1)
}

function applyLoaded(loaded: LoadedTranscript, key: FixtureKey): void {
  for (const [k, btn] of fixtureButtons) btn.setAttribute('variant', k === key ? 'solid' : 'soft')

  if (!loaded.ok) {
    errorPanel.hidden = false
    errorPanel.textContent = `Match unavailable — this fixture failed schema validation: ${loaded.reasons.join('; ')}`
    replayCard.hidden = true
    isolationCard.hidden = true
    inspector.hidden = true
    return
  }
  errorPanel.hidden = true
  replayCard.hidden = false
  isolationCard.hidden = false
  inspector.hidden = false

  const t: Transcript = loaded.transcript
  currentSteps = buildReplaySteps(t)
  stepIndex = 0
  renderStep()

  const report = buildIsolationReport(t)
  renderIsolation(report)
  renderContextLines(seatXCol.list, report.contexts.X)
  renderContextLines(seatOCol.list, report.contexts.O)
  renderTimeline(currentSteps)
}

function selectFixture(key: FixtureKey): void {
  const raw = key === 'live' ? liveRaw : FIXTURES[key].raw
  if (raw === undefined) return
  applyLoaded(loadTranscript(raw), key)
}

prevBtn.addEventListener('click', () => {
  if (stepIndex > 0) {
    stepIndex -= 1
    renderStep()
  }
})
nextBtn.addEventListener('click', () => {
  if (stepIndex < currentSteps.length - 1) {
    stepIndex += 1
    renderStep()
  }
})

selectFixture('flagship') // recorded-default (SPEC-R13 AC1) — zero network, zero keys

// ════════════════ the dev-only LIVE overlay (SPEC-N2: dynamic + DEV-guarded ⇒ tree-shaken from build) ════
const liveSection = document.createElement('div')
liveSection.className = 'live-section'
liveSection.dataset.live = ''
liveSection.hidden = true
content.append(liveSection)

function wireLiveOverlay(): void {
  if (!import.meta.env.DEV) return
  void (async () => {
    try {
      const overlay = await import('../lib/arena-live-transport.ts')
      const status = await overlay.probeArenaLive()
      if (!status.available) return
      liveSection.hidden = false
      const liveStatus = document.createElement('p')
      liveStatus.className = 'live-status'
      liveStatus.textContent = `Live agent connected (${status.providers} provider(s) available).`
      const runBtn = document.createElement('ui-button')
      runBtn.setAttribute('variant', 'solid')
      runBtn.setAttribute('tabindex', '0')
      runBtn.textContent = 'Run a live match (Sonnet 5 vs Haiku 4.5)'
      runBtn.addEventListener('click', () => {
        void (async () => {
          runBtn.setAttribute('disabled', '')
          liveStatus.textContent = 'Running a live match — this calls a real model and can take a little while…'
          try {
            const text = await overlay.runLiveMatch({
              X: { provider: 'anthropic', model: 'claude-sonnet-5' },
              O: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
            })
            liveRaw = text
            liveStatus.textContent = 'Live match complete — loaded below.'
            selectFixture('live')
          } catch (e) {
            liveStatus.textContent = `Live match failed: ${(e as Error).message}`
          } finally {
            runBtn.removeAttribute('disabled')
          }
        })()
      })
      liveSection.append(liveStatus, runBtn)
    } catch {
      /* no proxy (production build) or a network fault — the live section stays hidden */
    }
  })()
}
wireLiveOverlay()
