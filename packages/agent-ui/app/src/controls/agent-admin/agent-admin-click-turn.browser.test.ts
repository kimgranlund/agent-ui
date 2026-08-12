// agent-admin-click-turn.browser.test.ts — GH #42: click→turn e2e coverage for ui-agent-admin,
// mirroring the ADR-0088 §3 pattern (a2ui-live-conversation.browser.test.ts). The injectable
// `agentSurfaceTurn` seam is the honest e2e vehicle (the DEV live path needs a key + proxy — SPEC-N1
// fences it from tests): a SCRIPTED runner replays the canvas-button seed (inlined below) for the
// intent turn, and the CLICK legs prove the component-side wiring — renderer action → onClientMessage →
// the runner's kind:'client' request (TKT-0094: no synthetic user echo row).
//
// GH #63 (RESOLVED — the "page freeze" this coverage found): the original client-turn reply re-sent the
// ROOT component, which the renderer's cross-turn IDGRAPH guard (ADR-0128) rejects — and a renderer
// error is emitted as a CLIENT MESSAGE on the same onClientMessage channel as an action click, which
// agent-admin turned into ANOTHER surface turn, synchronously, mid-ingest. A scripted runner answering
// every error turn with the same invalid line made that an unbounded synchronous turn loop (~2000
// turns/12s — the "livelock": macrotasks starved, so setTimeout/CDP went dark). Fixed in agent-admin.ts:
// client turns are deferred to a fresh macrotask and consecutive error-driven turns are budgeted
// (ERROR_TURN_BUDGET, the produce() maxRounds discipline) with a visible halt. The loop-regression test
// below pins the poisoned shape forever; the TKT-0079 follow-through test un-skipped with a VALID
// (update-only, no root-resend) reply.
import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css'
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-dialog.css' // ADR-0180 (GH #688) — the adopted-or-created log's own scroll/layout CSS, promoted off conversation.css
import '../conversation/conversation-composer.css'
import '../surface-host/surface-host.css'
import '@agent-ui/components/controls/tabs'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import type { AdminSurfaceTurnRequest, AdminSurfaceTurnEvent } from './agent-admin-schema.ts'

// The canvas-button seed's wire messages, INLINED (the @agent-ui/a2ui/examples canvasButtonSeed shape) —
// the app package's tests stay app-scoped. TWO nodes (a Column root + a separate Button child), not the
// old single root Button: a follow-up turn can then update the Button ALONE — a valid, update-only
// cross-turn payload — where updating a lone root Button forced a root-resend, which the renderer's
// cross-turn IDGRAPH guard (ADR-0128) rejects by design (the exact poisoned shape GH #63's loop test
// below now pins deliberately).
const SEED_SURFACE_ID = 'canvas'
const SEED_MESSAGES = [
  { version: 'v1.0', createSurface: { surfaceId: SEED_SURFACE_ID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: SEED_SURFACE_ID,
      components: [
        { id: 'root', component: 'Column', children: ['btn'] },
        { id: 'btn', component: 'Button', variant: 'solid', label: 'Click me', action: { action: 'submit' } },
      ],
    },
  },
]

/** A VALID follow-up: updates ONLY the child Button (no root-resend) — the cross-turn shape TKT-0081's
 *  seeded validation and the renderer's merge law both accept. */
const VALID_FOLLOWUP_LINE = JSON.stringify({
  version: 'v1.0',
  updateComponents: {
    surfaceId: SEED_SURFACE_ID,
    components: [{ id: 'btn', component: 'Button', variant: 'solid', label: 'Round 2', action: { action: 'submit' } }],
  },
})

/** The POISONED follow-up (GH #63's trigger): re-sends the ROOT on a live surface — the renderer's
 *  ADR-0128 IDGRAPH guard rejects it and emits an error client message every single time. */
const ROOT_RESEND_LINE = JSON.stringify({
  version: 'v1.0',
  updateComponents: {
    surfaceId: SEED_SURFACE_ID,
    components: [{ id: 'root', component: 'Column', children: ['btn'] }],
  },
})

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

async function waitUntil(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await raf()
  }
}

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

interface Mounted {
  el: UIAgentAdminElement
  requests: AdminSurfaceTurnRequest[]
}

/** Mount the admin with a scripted runner whose client branch is caller-supplied. `intentTurn` (GH #802)
 *  overrides the seed script for the INTENT leg — the ask test needs its first round declared as an ask;
 *  every pre-existing caller omits it and gets the byte-identical seed replay. */
async function mountWithScript(
  clientTurn: (req: AdminSurfaceTurnRequest) => AdminSurfaceTurnEvent[],
  intentTurn?: (req: AdminSurfaceTurnRequest) => AdminSurfaceTurnEvent[],
): Promise<Mounted> {
  const requests: AdminSurfaceTurnRequest[] = []
  const script = async function* (req: AdminSurfaceTurnRequest): AsyncIterable<AdminSurfaceTurnEvent> {
    requests.push(req)
    if (req.turn.kind === 'intent') {
      if (intentTurn !== undefined) {
        for (const ev of intentTurn(req)) yield ev
        return
      }
      for (const message of SEED_MESSAGES) yield { kind: 'line', line: JSON.stringify(message) }
      yield { kind: 'note', note: 'seed surface up' }
    } else {
      for (const ev of clientTurn(req)) yield ev
    }
  }
  const wrapper = document.createElement('div')
  wrapper.style.width = '1200px'
  wrapper.style.height = '600px'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto'
  el.agentSurfaceTurn = script
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  await el.updateComplete
  return { el, requests }
}

/** Type an intent through the REAL composer and wait for the seed Button to render. */
async function driveIntentToButton(el: UIAgentAdminElement): Promise<HTMLElement> {
  const editor = el.querySelector('ui-conversation-composer [data-part="editor"]') as HTMLElement
  editor.textContent = 'show me a button'
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  ;(el.querySelector('ui-conversation-composer [data-part="send"]') as HTMLElement).click()
  await waitUntil(() => el.querySelector('[data-part="mounts"] ui-surface-host ui-button') !== null)
  const btn = [...el.querySelectorAll<HTMLElement>('[data-part="mounts"] ui-surface-host ui-button')].find(
    (b) => b.textContent?.trim() === 'Click me',
  )
  expect(btn, 'the seed Button renders in the conversation canvas').not.toBeUndefined()
  return btn!
}

describe('ui-agent-admin — GH #42: a REAL canvas click drives the next surface turn', () => {
  it('the intent turn renders the seed through the composer; whole-shape real size', async () => {
    const { el } = await mountWithScript(() => [])
    const btn = await driveIntentToButton(el)
    expect(btn.getBoundingClientRect().width, 'whole-shape: real rendered size').toBeGreaterThan(0)
    expect(btn.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('a REAL click becomes the kind:"client" surface turn — and adds NO user echo row (TKT-0094)', async () => {
    const { el, requests } = await mountWithScript(() => [{ kind: 'note', note: 'click acknowledged' }])
    const btn = await driveIntentToButton(el)
    const userRows = (): number =>
      [...el.querySelectorAll<HTMLElement>('[data-part="bubble"]')].filter((b) => b.dataset.role === 'user').length
    const userBefore = userRows()
    btn.click() // the REAL A2uiAction through the renderer into onClientMessage
    await waitUntil(() => requests.length === 2)
    expect(requests[1]!.turn.kind, 'the click became the next surface turn').toBe('client')
    expect(userRows(), 'a client-action click must NOT add a user echo row (TKT-0094)').toBe(userBefore)
  })

  // genui-surface.spec.md SPEC-R10/R11 — independent-review MODERATE fix: a `client` message's OWN
  // modality gates it (never an OR across both switches). A2UI OFF must keep a REAL A2UI action click
  // inert even while GenUI is ON — the exact symmetric direction the review's fix closes (the button
  // itself rendered from an EARLIER turn while A2UI was still on; flipping it off afterward must not let
  // a stale, already-rendered surface's click still spawn a hidden turn).
  it('A2UI OFF (GenUI ON): a REAL A2UI action click stays INERT — no hidden turn (independent-review MODERATE fix)', async () => {
    const { el, requests } = await mountWithScript(() => [{ kind: 'note', note: 'should never run' }])
    const btn = await driveIntentToButton(el)
    el.store!.set('surfaceA2ui', false)
    el.store!.set('surfaceGenui', true)
    const before = requests.length
    btn.click() // the SAME real A2uiAction the passing test above proves DOES turn when A2UI is on
    // Give the deferred macrotask (GH #63's setTimeout(...,0) defer) every chance to fire before asserting
    // silence — a flaky false-negative here would be worse than a slightly generous wait.
    await new Promise((r) => setTimeout(r, 200))
    expect(requests.length, 'A2UI is off — the click must never spawn a hidden client turn').toBe(before)
  })

  it('a client turn carrying a VALID update LINE completes the round-trip', async () => {
    const { el, requests } = await mountWithScript(() => [{ kind: 'line', line: VALID_FOLLOWUP_LINE }])
    const btn = await driveIntentToButton(el)
    btn.click()
    await waitUntil(() => requests.length === 2)
    expect(requests[1]!.turn.kind).toBe('client')
  })

  it('FOLLOW-THROUGH (TKT-0079, un-skipped by the GH #63 fix): the client update renders into the RESUMED bubble', async () => {
    const { el } = await mountWithScript(() => [{ kind: 'line', line: VALID_FOLLOWUP_LINE }])
    const btn = await driveIntentToButton(el)
    const host = btn.closest('ui-surface-host') as HTMLElement
    const bubble = host.closest('[data-part="bubble"]') as HTMLElement
    const bubblesBefore = el.querySelectorAll('[data-part="bubble"]').length

    btn.click()
    // The update-only follow-up must land in the SAME surface host, SAME bubble — the ADR-0129/TKT-0079
    // same-card routing — with the Button's label re-rendered by the renderer's merge.
    await waitUntil(() => host.querySelector('ui-button')?.textContent?.trim() === 'Round 2')

    expect(host.isConnected, 'the original host survives the client turn').toBe(true)
    expect(host.closest('[data-part="bubble"]'), 'the surface stays in ITS bubble').toBe(bubble)
    expect(bubble.querySelectorAll('ui-surface-host').length, 'no second host minted in the bubble').toBe(1)
    expect(bubble.querySelector('[data-state="closed"]'), 'the surface never closed').toBeNull()
    expect(
      el.querySelectorAll('[data-part="bubble"]').length,
      'a resumed client turn opens NO new bubble (TKT-0079)',
    ).toBe(bubblesBefore)
  })

  // GH #802 (ADR-0097 §1, Kim's 2026-08-13 ruling) — the SAME click→turn vehicle, one round of a real
  // interview: an ASK-declared card is answered, so the reply advances the DIALOG (a fresh bubble carrying
  // the next ask) instead of resuming the answered card. The TKT-0079 follow-through test right above is
  // this test's own control — same file, same driver, non-ask surface, resume unchanged.
  it('GH #802: answering a DECLARED ask advances the dialog round — a fresh bubble/card, the answered card untouched', async () => {
    const askLines = (surfaceId: string, label: string): AdminSurfaceTurnEvent[] => [
      { kind: 'line', line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId, catalogId: 'agent-ui' } }) },
      {
        kind: 'line',
        line: JSON.stringify({
          version: 'v1.0',
          updateComponents: {
            surfaceId,
            components: [{ id: 'root', component: 'Button', variant: 'solid', label, action: { action: 'submit' } }],
          },
        }),
      },
    ]
    const { el, requests } = await mountWithScript(
      () => [{ kind: 'ask', ask: { surfaceId: 'ask-2' } }, { kind: 'note', note: 'Got it — and which colour?' }, ...askLines('ask-2', 'Commit 2')],
      () => [{ kind: 'ask', ask: { surfaceId: 'ask-1' } }, { kind: 'note', note: 'Which size?' }, ...askLines('ask-1', 'Commit 1')],
    )
    const buttonLabeled = (label: string): HTMLElement | undefined =>
      [...el.querySelectorAll<HTMLElement>('[data-part="mounts"] ui-surface-host ui-button')].find((b) => b.textContent?.trim() === label)
    const agentBubbles = (): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('[data-part="bubble"][data-role="agent"]')]

    const editor = el.querySelector('ui-conversation-composer [data-part="editor"]') as HTMLElement
    editor.textContent = 'coach me'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    ;(el.querySelector('ui-conversation-composer [data-part="send"]') as HTMLElement).click()
    await waitUntil(() => buttonLabeled('Commit 1') !== undefined)

    const firstCard = buttonLabeled('Commit 1')!
    const firstHost = firstCard.closest('ui-surface-host') as HTMLElement
    const firstBubble = firstHost.closest('[data-part="bubble"]') as HTMLElement
    expect(agentBubbles(), 'round 1 is one agent bubble').toHaveLength(1)

    firstCard.click() // the REAL A2uiAction through the renderer → onClientMessage → the client turn
    await waitUntil(() => requests.length === 2 && buttonLabeled('Commit 2') !== undefined)

    const secondHost = buttonLabeled('Commit 2')!.closest('ui-surface-host') as HTMLElement
    const secondBubble = secondHost.closest('[data-part="bubble"]') as HTMLElement
    expect(agentBubbles(), 'the answered ask advanced the dialog: a SECOND agent bubble').toHaveLength(2)
    expect(secondBubble, 'the next round mounted in a DIFFERENT bubble').not.toBe(firstBubble)
    // The answered card is untouched history — still there, still in its own bubble, still its own label.
    expect(firstHost.isConnected).toBe(true)
    expect(firstHost.closest('[data-part="bubble"]'), 'the answered ask stays in ITS bubble').toBe(firstBubble)
    expect(firstBubble.querySelectorAll('ui-surface-host'), 'nothing new mounted into the answered bubble').toHaveLength(1)
    expect(buttonLabeled('Commit 1'), 'the answered ask was never rebuilt or deleted').not.toBeUndefined()
    // Whole-shape, real engine: BOTH rounds are genuinely laid out, stacked in reading order (the answered
    // card above the new one) — not one card overwritten in place.
    const firstRect = firstCard.getBoundingClientRect()
    const secondRect = buttonLabeled('Commit 2')!.getBoundingClientRect()
    expect(firstRect.width, 'the answered card still occupies real space').toBeGreaterThan(0)
    expect(secondRect.width, "the new round's card has real size").toBeGreaterThan(0)
    expect(secondRect.top, 'the new round renders BELOW the answered one').toBeGreaterThan(firstRect.top)
  })

  it('GH #63 regression: a producer that answers every error turn with a poisoned root-resend HALTS at the budget instead of livelocking', async () => {
    const { el, requests } = await mountWithScript(() => [{ kind: 'line', line: ROOT_RESEND_LINE }])
    const btn = await driveIntentToButton(el)
    btn.click()

    // Pre-fix this livelocked the page within ~1s (unbounded synchronous turn loop — GH #63's bisection:
    // even setTimeout stopped firing, so this waitUntil itself could never have polled). Post-fix the
    // loop is budgeted: the halt bubble appears, macrotasks keep flowing (this raf/poll loop IS the
    // liveness proof), and the turn count stays bounded.
    await waitUntil(() => [...el.querySelectorAll<HTMLElement>('[data-part="bubble"]')].some((b) => b.textContent?.includes('surface loop halted')))

    // 1 intent + 1 click turn + at most ERROR_TURN_BUDGET (3) error-driven turns = 5.
    expect(requests.length, 'the turn loop is bounded by the error budget').toBeLessThanOrEqual(5)
    // The page is genuinely alive: a real macrotask round-trip still works.
    await new Promise((r) => setTimeout(r, 0))
    expect(document.body.isConnected).toBe(true)
  })

  // GH #805 — answered A2UI cards disable their inputs. Real-engine coverage: jsdom cannot compute CSS at
  // all (no `pointer-events`, no `getComputedStyle` truth), so the double-submit guard — a REAL platform
  // fact, not a JS flag — can only be proven here.
  it('GH #805: a REAL click disables the card SYNCHRONOUSLY, with the real pointer-events:none guard engaged', async () => {
    const { el } = await mountWithScript(() => [{ kind: 'note', note: 'click acknowledged' }])
    const btn = (await driveIntentToButton(el)) as HTMLElement & { disabled: boolean }
    expect(btn.disabled).toBe(false)
    expect(getComputedStyle(btn).pointerEvents).not.toBe('none')

    btn.click() // the REAL A2uiAction through the renderer into onClientMessage
    // Disabled the INSTANT the action fires — synchronous, before the deferred (setTimeout(0), GH #63)
    // surface turn even starts. No `waitUntil` needed for this assertion; it proves the disable is not
    // waiting on the turn's own async round-trip.
    expect(btn.disabled, 'disabled synchronously on click, ahead of any turn even starting').toBe(true)
    expect(getComputedStyle(btn).pointerEvents, 'the REAL platform double-submit guard — CSS, not JS').toBe('none')
  })

  it('GH #805/TKT-0079: the follow-through update re-renders the SAME card LIVE — a stale disabled state never survives a real re-render', async () => {
    const { el } = await mountWithScript(() => [{ kind: 'line', line: VALID_FOLLOWUP_LINE }])
    const btn = (await driveIntentToButton(el)) as HTMLElement & { disabled: boolean }
    btn.click()
    expect(btn.disabled).toBe(true)
    await waitUntil(() => btn.textContent?.trim() === 'Round 2') // TKT-0079's own resumed-update proof, unchanged
    expect(btn.disabled, "the resumed update (this SAME node, rewireNode's identity-preserving reconcile) comes back live").toBe(false)
    expect(getComputedStyle(btn).pointerEvents).not.toBe('none')
  })

  it('GH #805: a failed/aborted turn re-enables the card — never a stranded disabled control', async () => {
    const { el } = await mountWithScript(() => {
      throw new Error('boom')
    })
    const btn = (await driveIntentToButton(el)) as HTMLElement & { disabled: boolean }
    btn.click()
    expect(btn.disabled, 'disabled synchronously, ahead of the (about-to-throw) turn').toBe(true)
    await waitUntil(() => btn.disabled === false)
    expect(getComputedStyle(btn).pointerEvents, 're-enabled for real, not just a stale JS flag').not.toBe('none')
    expect(el.textContent, "fail()'s own existing system-bubble behavior is untouched").toContain('boom')
  })
})
