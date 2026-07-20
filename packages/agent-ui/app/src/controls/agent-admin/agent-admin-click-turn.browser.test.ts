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

/** Mount the admin with a scripted runner whose client branch is caller-supplied. */
async function mountWithScript(clientTurn: (req: AdminSurfaceTurnRequest) => AdminSurfaceTurnEvent[]): Promise<Mounted> {
  const requests: AdminSurfaceTurnRequest[] = []
  const script = async function* (req: AdminSurfaceTurnRequest): AsyncIterable<AdminSurfaceTurnEvent> {
    requests.push(req)
    if (req.turn.kind === 'intent') {
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
})
