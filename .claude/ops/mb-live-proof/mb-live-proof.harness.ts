// mb-live-proof.test.ts — SCRATCH live-proof harness for M-B's DoD boxes 1+2 (goals.md). NEVER COMMIT.
// Runs the REAL ui-agent-admin element with the REAL persona preset stores and the REAL site live runner
// (createAdminSurfaceTurn → HTTP → dev-proxy → produce() → live Anthropic model), in jsdom. The one
// deviation from a hand-driven browser run: the calendar range / quiz answer commits are programmatic
// prop-set + the control's own change event (the exact seam input.ts's two-way binding listens on),
// because no live browser is attached to this session. Everything downstream of that seam — binding
// write, dataModel, action snapshot, frameClientMessage, nextTurn, the wire, the model — is real.
// Evidence transcript: $CLAUDE_JOB_DIR/tmp (EVIDENCE_DIR below).
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
// @ts-expect-error - node:fs typed via @types/node (sitemap.test.ts precedent)
import { mkdirSync, writeFileSync } from 'node:fs'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import type { AdminSurfaceTurnRequest, AdminSurfaceTurnEvent } from '@agent-ui/app/agent-admin-schema'
import { AGENT_PRESETS, presetStore } from '../pages/agent-admin-presets.ts'
import { createAdminSurfaceTurn } from './admin-live-runner.ts'

declare const process: { env: Record<string, string | undefined> }

const BASE = 'http://localhost:5173'
const EVIDENCE_DIR = process.env.MB_EVIDENCE_DIR ?? '/Users/kimba/.claude/jobs/f3d6d8ad/tmp/mb-live-proof'

// ── jsdom ElementInternals stub (agent-admin.test.ts verbatim) ───────────────────────────────────────────
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    // The form-provider submit gate walks reportValidity/checkValidity — also absent in jsdom.
    if (typeof internals.reportValidity !== 'function') internals.reportValidity = () => true
    if (typeof internals.checkValidity !== 'function') internals.checkValidity = () => true
    return internals as unknown as ElementInternals
  }
  mkdirSync(EVIDENCE_DIR, { recursive: true })
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

// ── absolutize relative fetches to the RUNNING dev server (jsdom has no fetch of its own; Node's undici
//    rejects relative URLs) — the runner's '/__a2ui/agent' + '/chat' paths land on the real proxy ─────────
const realFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' && input.startsWith('/') ? BASE + input : input
    return realFetch(url as RequestInfo, init)
  }) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = realFetch
})

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
async function waitUntil(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error(`waitUntil timed out (${timeoutMs}ms): ${what}`)
    await sleep(200)
  }
}

interface Rig {
  el: UIAgentAdminElement
  requests: AdminSurfaceTurnRequest[]
  turnsCompleted: () => number
  turnErrors: string[]
  evidence: unknown[]
}

/** Mount the REAL admin on the named preset with the REAL live runner, recording every request/event. */
function mountLive(presetId: string): Rig {
  const preset = AGENT_PRESETS.find((p) => p.id === presetId)
  if (!preset) throw new Error(`no preset '${presetId}'`)
  const requests: AdminSurfaceTurnRequest[] = []
  const turnErrors: string[] = []
  const evidence: unknown[] = []
  let completed = 0
  const real = createAdminSurfaceTurn()
  const recording = async function* (req: AdminSurfaceTurnRequest): AsyncIterable<AdminSurfaceTurnEvent> {
    requests.push(req)
    evidence.push({ at: new Date().toISOString(), dir: 'request', turn: req.turn, model: req.model })
    try {
      for await (const ev of real(req)) {
        evidence.push({ at: new Date().toISOString(), dir: 'event', ev })
        yield ev
      }
      completed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      turnErrors.push(msg)
      evidence.push({ at: new Date().toISOString(), dir: 'turn-error', msg })
      throw err
    }
  }
  const wrapper = document.createElement('div')
  wrapper.style.width = '1200px'
  wrapper.style.height = '800px'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto'
  el.store = presetStore(preset)
  el.agentSurfaceTurn = recording
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { el, requests, turnsCompleted: () => completed, turnErrors, evidence }
}

/** Type an intent through the REAL composer (click-turn test's exact drive). */
function sendIntent(el: UIAgentAdminElement, text: string): void {
  const editor = el.querySelector('ui-conversation-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  ;(el.querySelector('ui-conversation-composer [data-part="send"]') as HTMLElement).click()
}

const haltBubbles = (el: UIAgentAdminElement): number =>
  [...el.querySelectorAll<HTMLElement>('[data-part="bubble"]')].filter((b) =>
    b.textContent?.includes('surface loop halted'),
  ).length

const surfaceHosts = (el: UIAgentAdminElement): HTMLElement[] => [
  ...el.querySelectorAll<HTMLElement>('[data-part="mounts"] ui-surface-host'),
]

function saveEvidence(name: string, rig: Rig, extra: Record<string, unknown>): void {
  writeFileSync(
    `${EVIDENCE_DIR}/${name}.json`,
    JSON.stringify({ savedAt: new Date().toISOString(), ...extra, transcript: rig.evidence }, null, 2),
  )
}

/** Fill every input control in the surface the way a real guest would — the payload's `checks` gate the
 *  Submit action until required fields hold values (renderer.ts #submitGatePermits), so an honest run
 *  completes the whole form, not just the calendar. */
async function fillSurfaceInputs(host: HTMLElement): Promise<void> {
  for (const f of host.querySelectorAll<HTMLElement & { value: string; type?: string }>('ui-text-field')) {
    const type = f.type ?? f.getAttribute('type') ?? 'text'
    f.value = type === 'number' ? '2' : type === 'email' ? 'kim@example.com' : type === 'tel' ? '+3912345678' : 'Kim Granlund'
    f.dispatchEvent(new Event('change', { bubbles: true }))
  }
  for (const f of host.querySelectorAll<HTMLElement & { value: string }>('ui-textarea')) {
    f.value = 'No special requests.'
    f.dispatchEvent(new Event('change', { bubbles: true }))
  }
  for (const s of host.querySelectorAll<HTMLElement & { value: string }>('ui-select, ui-combo-box')) {
    // catalog Option = div[role=option] with a `value` ATTRIBUTE (factories.ts, ADR-0053) — never ui-option
    const opt = s.querySelector<HTMLElement>('[role="option"][value]')
    const v = opt?.getAttribute('value')
    if (v) {
      s.value = v
      // select's two-way event is 'select' (factories.ts); combo-box commits on 'change' — fire both.
      s.dispatchEvent(new Event('select', { bubbles: true }))
      s.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }
  for (const g of host.querySelectorAll<HTMLElement & { value: string }>('ui-radio-group, ui-segmented-control')) {
    const opt = g.querySelector<HTMLElement>('[value], [data-value], ui-radio, ui-segment')
    const v = opt?.getAttribute('value') ?? opt?.getAttribute('data-value') ?? opt?.textContent?.trim()
    if (v) {
      g.value = v
      g.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }
  await sleep(200)
}

/** Depth-limited tag outline of a surface for failure diagnosis. */
function outline(node: Element, depth = 0): string {
  if (depth > 6) return ''
  const attrs = [...node.attributes]
    .filter((a) => a.name !== 'style' && a.name !== 'class')
    .map((a) => ` ${a.name}="${a.value.slice(0, 40)}"`)
    .join('')
  const kids = [...node.children].map((c) => outline(c, depth + 1)).join('')
  return `${'  '.repeat(depth)}<${node.tagName.toLowerCase()}${attrs}> ${node.children.length === 0 ? (node.textContent ?? '').slice(0, 60).trim() : ''}\n${kids}`
}

describe('M-B DoD box 1 — Hotel Concierge: the submit snapshot carries BOTH range dates (ADR-0161)', () => {
  it('live booking flow: user-picked range reaches the model', async () => {
    const rig = mountLive('concierge')
    const { el, requests } = rig
    try {
      await runBox1(rig)
    } catch (err) {
      const provider = el.querySelector('[data-part="mounts"] ui-form-provider') as
        | (HTMLElement & { valid(): boolean; invalid(): HTMLElement[]; values(): unknown })
        | null
      saveEvidence('box1-concierge-FAIL', rig, {
        failure: err instanceof Error ? err.message : String(err),
        formValid: provider?.valid(),
        formInvalidMembers: provider?.invalid().map((m) => `${m.tagName}[name=${m.getAttribute('name')}]`),
        formValues: provider?.values(),
        surfaces: surfaceHosts(el).map((h) => outline(h)),
        requests: requests.map((r) => r.turn),
      })
      throw err
    }
  })

  async function runBox1(rig: Rig): Promise<void> {
    const { el, requests } = rig
    await (el as unknown as { updateComplete?: Promise<unknown> }).updateComplete

    sendIntent(el, 'I would like to book a room for a few nights in mid-August. Please show me a booking form with a date-range calendar so I can pick my dates.')
    await waitUntil(() => rig.turnsCompleted() >= 1 || rig.turnErrors.length > 0, 150_000, 'intent turn completes')
    expect(rig.turnErrors, 'intent turn must not fault').toEqual([])

    // The booking surface must carry a range calendar; nudge once conversationally if the model
    // rendered something else first (a natural user follow-up, still fully live).
    const findRangeCal = (): (HTMLElement & { valueStart: string; valueEnd: string; mode?: string }) | undefined =>
      surfaceHosts(el)
        .flatMap((h) => [...h.querySelectorAll<HTMLElement>('ui-calendar')])
        .find((c) => (c as HTMLElement & { mode?: string }).mode === 'range' || c.getAttribute('mode') === 'range') as
        | (HTMLElement & { valueStart: string; valueEnd: string })
        | undefined
    if (!findRangeCal()) {
      sendIntent(el, 'Could you show that as a booking form with a range calendar (mode="range") so I can select check-in and check-out dates?')
      await waitUntil(() => rig.turnsCompleted() >= 2 || rig.turnErrors.length > 0, 150_000, 'follow-up turn completes')
      expect(rig.turnErrors, 'follow-up turn must not fault').toEqual([])
    }
    const cal = findRangeCal()
    expect(cal, 'a mode="range" ui-calendar renders in the live booking surface').toBeTruthy()

    // Commit the range the way the control itself commits (#commitRangeDate lands both props, then ONE
    // change event) — the exact seam input.ts's two-way binding listens on (ADR-0161's three-slot mark).
    const START = '2026-08-12'
    const END = '2026-08-15'
    cal!.valueStart = START
    cal!.valueEnd = END
    cal!.dispatchEvent(new Event('change', { bubbles: true }))
    await sleep(300)
    await fillSurfaceInputs(cal!.closest('ui-surface-host') as HTMLElement)

    // Click the surface's REAL submit action button.
    const clicksBefore = requests.length
    const buttons = surfaceHosts(el).flatMap((h) => [...h.querySelectorAll<HTMLElement>('ui-button')])
    const submit =
      buttons.find((b) => /book|submit|confirm|reserve|request/i.test(b.textContent ?? '')) ?? buttons.at(-1)
    expect(submit, 'the booking surface carries an action button').toBeTruthy()
    submit!.click()
    await waitUntil(() => requests.length > clicksBefore, 30_000, 'the click becomes a client surface turn')

    // THE PROOF: the submit snapshot — the exact message nextTurn feeds the model — carries BOTH dates.
    const clientReq = requests.findLast((r) => r.turn.kind === 'client')
    expect(clientReq, 'a client turn was requested').toBeTruthy()
    const snapshot = JSON.stringify((clientReq!.turn as { kind: 'client'; message: unknown }).message)
    expect(snapshot, 'submit snapshot carries the START date').toContain(START)
    expect(snapshot, 'submit snapshot carries the END date').toContain(END)

    // Let the live resume turn finish (the model actually consumed the snapshot) — no fault, no halt.
    await waitUntil(() => rig.turnsCompleted() >= requests.length || rig.turnErrors.length > 0, 150_000, 'resume turn completes')
    expect(rig.turnErrors, 'the resume turn must not fault').toEqual([])
    expect(haltBubbles(el), 'zero produce-halt bubbles across the whole flow').toBe(0)

    saveEvidence('box1-concierge', rig, {
      box: 'M-B DoD box 1 (ADR-0161)',
      submittedRange: { START, END },
      submitSnapshot: JSON.parse(snapshot),
      turns: requests.length,
    })
  }
})

describe('M-B DoD box 2 — quizmaster: a full multi-round quiz survives the action-click resume path live', () => {
  it('live multi-round session: >=5 resume rounds, zero halts', async () => {
    const rig = mountLive('quizmaster')
    const { el, requests } = rig
    try {
      await runBox2(rig)
    } catch (err) {
      saveEvidence('box2-quizmaster-FAIL', rig, {
        failure: err instanceof Error ? err.message : String(err),
        haltBubbles: haltBubbles(el),
        bubbleTexts: [...el.querySelectorAll<HTMLElement>('[data-part="bubble"]')].map((b) =>
          (b.textContent ?? '').slice(0, 200),
        ),
        surfaces: surfaceHosts(el).map((h) => outline(h)),
        requests: requests.map((r) => r.turn),
      })
      throw err
    }
  })

  async function runBox2(rig: Rig): Promise<void> {
    const { el, requests } = rig
    await (el as unknown as { updateComplete?: Promise<unknown> }).updateComplete

    sendIntent(el, 'Start a 5-question multiple-choice quiz. Keep it in one surface and advance round by round as I answer.')
    await waitUntil(() => rig.turnsCompleted() >= 1 || rig.turnErrors.length > 0, 150_000, 'quiz opening turn completes')
    expect(rig.turnErrors, 'opening turn must not fault').toEqual([])

    const ROUNDS = 6 // 5 answers + one advance-to-results click, mirroring #307 leg-2 run 3's shape
    for (let round = 0; round < ROUNDS; round++) {
      const before = requests.length
      const done = rig.turnsCompleted()
      // Prefer a two-way choice control (radio/segmented/select): commit its first real option, then
      // click the action button. If the round is button-answered, click an answer button directly.
      const hosts = surfaceHosts(el)
      const latest = hosts.at(-1)
      if (!latest) throw new Error('no live surface host on the canvas')
      const choice = latest.querySelector<HTMLElement & { value: string }>(
        'ui-radio-group, ui-segmented-control, ui-select',
      )
      const buttons = [...latest.querySelectorAll<HTMLElement>('ui-button')].filter((b) => !b.hasAttribute('disabled'))
      if (choice) {
        const option = choice.querySelector<HTMLElement>('[data-value], [value], ui-radio, ui-option, ui-segment')
        const optionValue =
          option?.getAttribute('data-value') ?? option?.getAttribute('value') ?? option?.textContent?.trim() ?? 'A'
        choice.value = optionValue
        choice.dispatchEvent(new Event('change', { bubbles: true }))
        await sleep(200)
        const actionBtn = buttons.find((b) => /submit|next|answer|lock|advance|continue|finish|reveal|results/i.test(b.textContent ?? '')) ?? buttons.at(-1)
        if (!actionBtn) throw new Error(`round ${round + 1}: choice control present but no action button`)
        actionBtn.click()
      } else {
        const answerBtn = buttons[0]
        if (!answerBtn) {
          // No interactive affordance left — the quiz likely finished early (results surface). Stop looping.
          break
        }
        answerBtn.click()
      }
      await waitUntil(() => requests.length > before, 30_000, `round ${round + 1}: click becomes a client turn`)
      await waitUntil(
        () => rig.turnsCompleted() > done || rig.turnErrors.length > 0 || haltBubbles(el) > 0,
        150_000,
        `round ${round + 1}: resume turn completes`,
      )
      expect(haltBubbles(el), `zero halt bubbles through round ${round + 1}`).toBe(0)
      expect(rig.turnErrors, `round ${round + 1} must not fault`).toEqual([])
    }

    const clientTurns = requests.filter((r) => r.turn.kind === 'client').length
    expect(clientTurns, 'a genuinely multi-round session ran (>=5 action-click resumes)').toBeGreaterThanOrEqual(5)
    expect(haltBubbles(el), 'zero produce-halt bubbles across the whole session').toBe(0)
    expect(rig.turnErrors).toEqual([])

    saveEvidence('box2-quizmaster', rig, {
      box: 'M-B DoD box 2 (round-budget policy per GH #307 closure: produce() maxRounds + per-member repair hints + CODE-at-path halts)',
      totalTurns: requests.length,
      clientTurns,
    })
  }
})
