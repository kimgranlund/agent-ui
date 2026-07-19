// agent-admin-click-turn.browser.test.ts — GH #42: click→turn e2e coverage for ui-agent-admin,
// mirroring the ADR-0088 §3 pattern (a2ui-live-conversation.browser.test.ts). The injectable
// `agentSurfaceTurn` seam is the honest e2e vehicle (the DEV live path needs a key + proxy — SPEC-N1
// fences it from tests): a SCRIPTED runner replays the canvas-button seed (inlined below) for the
// intent turn, and the CLICK legs prove the component-side wiring — renderer action → onClientMessage →
// the runner's kind:'client' request (TKT-0094: no synthetic user echo row).
//
// KNOWN LIMIT (the bug this coverage FOUND): ingesting a client-turn LINE through the TKT-0079
// bubble-resume path hard-freezes the page main thread within ~1s in BOTH engines (bisected: click
// dispatch alone passes; note-only client turns pass; a same-type updateComponents line ingests — with
// an "<ui-surface-host>: .ingest() called before connect" no-op warning — and the page then livelocks;
// even setTimeout stops firing). Filed with full bisection evidence as GH #63; the follow-through assertion lands when the freeze is fixed.
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

// The canvas-button seed's wire messages, INLINED (byte-equivalent to @agent-ui/a2ui/examples'
// canvasButtonSeed) — the app package's tests stay app-scoped.
const SEED_SURFACE_ID = 'canvas'
const SEED_MESSAGES = [
  { version: 'v1.0', createSurface: { surfaceId: SEED_SURFACE_ID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: SEED_SURFACE_ID,
      components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Click me', action: { action: 'submit' } }],
    },
  },
]

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

  it('a client turn carrying an update LINE still completes the request round-trip', async () => {
    const { el, requests } = await mountWithScript(() => [
      {
        kind: 'line',
        line: JSON.stringify({
          version: 'v1.0',
          updateComponents: {
            surfaceId: SEED_SURFACE_ID,
            components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Round 2', action: { action: 'submit' } }],
          },
        }),
      },
    ])
    const btn = await driveIntentToButton(el)
    btn.click()
    await waitUntil(() => requests.length === 2)
    expect(requests[1]!.turn.kind).toBe('client')
  })

  // BLOCKED by the page-freeze bug this suite discovered (bisection in the file banner): any DOM
  // follow-through read after a client-turn line ingest livelocks the page (document-wide reads stop
  // returning; setTimeout stops firing) — the update is ALSO dropped with an ingest-before-connect
  // no-op warning, so the TKT-0079 same-bubble assertion cannot pass until the resume-path ingest is
  // fixed. Un-skip when GH #63 closes.
  it.skip('FOLLOW-THROUGH (blocked by GH #63): the client update renders into the RESUMED bubble (TKT-0079)', () => {})
})
