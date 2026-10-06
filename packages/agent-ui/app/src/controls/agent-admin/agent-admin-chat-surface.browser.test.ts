// agent-admin-chat-surface.browser.test.ts: T-0019, the REAL-HOST leg. The strip and the chat Card were
// first guarded against a bare `ui-conversation` (conversation.browser.test.ts); the user saw the symptoms
// in the agent-admin Test Chat, so this file guards the same three paint facts through the real
// `ui-agent-admin` composition: its own `ui-conversation` chat pane, the SAME stylesheet set and order as
// site/pages/agent-admin-app.ts (foundation → base → all.css → the app sheets), a scripted
// `agentSurfaceTurn` runner (the click-turn test's seam) standing in for the live model, and the REAL composer
// driving the turn. Runs in both Chromium and WebKit (the shard config).
//
//   1. an expanded, still-running Agent activity strip never lets its step rows paint over the pinned header;
//   2. a Card streamed into the Test Chat paints its header/content/footer regions inset (never flush) and
//      seats a trailing Badge on the title row;
//   3. every text part of the settled, expanded strip sits inside the strip's own inline inset.
//
// The three are paint contracts of the shared stylesheets (card.css, status-stream.css, conversation.css), so
// each goes red when its sheet or rule is missing; builder-solo-2.md records the seeded mutations that prove it.
import { describe, it, expect, afterEach } from 'vitest'
import { server } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/code/editor.css'
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-dialog.css'
import '../conversation/conversation-composer.css'
import '../surface-host/surface-host.css'
import '../super-shell/super-shell.css'
import '../chat-shell/chat-shell.css'
import '@agent-ui/components/all' // the site page imports it too: the chat Card's sub-tags are defined before the first streamed line
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import type { AdminSurfaceTurnRequest, AdminSurfaceTurnEvent } from './agent-admin-schema.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

async function waitUntil(predicate: () => boolean, what: string, timeoutMs = 8000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error(`waitUntil: ${what} never became true within ${timeoutMs}ms`)
    await raf()
  }
}

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

type Runner = (req: AdminSurfaceTurnRequest) => AsyncIterable<AdminSurfaceTurnEvent>

/** Mount the admin at a desktop width (the Test Chat pane lands about 480px wide, the user's layout) with a
 *  scripted runner, send one message through the REAL composer, and hand back the chat pane. */
async function mountAndSend(runner: Runner, text: string): Promise<UIAgentAdminElement> {
  const wrapper = document.createElement('div')
  wrapper.style.width = '1440px'
  wrapper.style.height = '900px'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto'
  el.agentSurfaceTurn = runner
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  await el.updateComplete
  await raf()
  const editor = el.querySelector('ui-conversation-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  ;(el.querySelector('ui-conversation-composer [data-part="send"]') as HTMLElement).click()
  return el
}

const chatPane = (el: UIAgentAdminElement): HTMLElement => el.querySelector('[data-part="chat-pane"]') as HTMLElement

const line = (o: unknown): AdminSurfaceTurnEvent => ({ kind: 'line', line: JSON.stringify({ version: 'v1.0', ...(o as object) }) })

/** The Blackjack table the Croupier teaches: Card › CardHeader (Text + a trailing Badge) › CardContent ›
 *  CardFooter, with a Row and Buttons inside. */
function cardTurn(): AdminSurfaceTurnEvent[] {
  return [
    line({ createSurface: { surfaceId: 'bj', catalogId: 'agent-ui' } }),
    line({
      updateComponents: {
        surfaceId: 'bj',
        components: [
          { id: 'root', component: 'Card', children: ['hdr', 'body', 'foot'] },
          { id: 'hdr', component: 'CardHeader', children: ['title', 'bank'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Blackjack' },
          { id: 'bank', component: 'Badge', label: 'Bankroll 1100', slot: 'trailing' },
          { id: 'body', component: 'CardContent', children: ['row'] },
          { id: 'row', component: 'Row', gap: 'sm', children: ['dealer', 'seven'] },
          { id: 'dealer', component: 'Text', variant: 'body', text: 'Dealer shows' },
          { id: 'seven', component: 'Badge', label: '7' },
          { id: 'foot', component: 'CardFooter', children: ['hit', 'stand'] },
          { id: 'hit', component: 'Button', variant: 'solid', label: 'Hit', action: { action: 'hit' } },
          { id: 'stand', component: 'Button', variant: 'soft', label: 'Stand', action: { action: 'stand' } },
        ],
      },
    }),
  ]
}

describe('ui-agent-admin Test Chat cross-engine: the activity strip and the chat Card in the real host (T-0019)', () => {
  it(`${server.browser}: an expanded strip, still running and overflowing its cap, never lets a step row paint over the pinned header`, async () => {
    let expanded!: () => void
    const wasExpanded = new Promise<void>((r) => (expanded = r))
    let release!: () => void
    const hold = new Promise<void>((r) => (release = r))
    const runner: Runner = async function* () {
      yield { kind: 'step', step: { id: 's0', kind: 'request', label: 'Request sent', status: 'ok', durationMs: 100 } }
      await wasExpanded // the user opens the strip while the turn is still running
      for (let i = 1; i <= 9; i++) {
        yield {
          kind: 'step',
          step: {
            id: `s${i}`,
            kind: i === 2 ? 'validate' : 'tool',
            label: i === 2 ? 'Validation failed' : `Called tool ${i}`,
            status: i === 9 ? 'running' : i === 2 ? 'failed' : 'ok',
            durationMs: 100,
            ...(i === 2 ? { summary: 'Round 1 failed (SCHEMA, UNKNOWN_COMPONENT), retrying in round 2' } : {}),
            ...(i === 9 ? { startedAt: Date.now() } : {}),
          },
        }
        await raf()
      }
      await hold // keep the turn live: the strip stays in its running (height-capped) state
    }
    const el = await mountAndSend(runner, 'black jack')
    const pane = chatPane(el)
    await waitUntil(() => pane.querySelector('[data-part="narration"] ui-timeline-item[data-kind="request"]') !== null, 'the first step row')
    const strip = pane.querySelector('[data-part="narration"]') as HTMLElement
    const header = strip.querySelector('[data-part="header"]') as HTMLElement
    header.click()
    await raf()
    expect(header.getAttribute('aria-expanded')).toBe('true')
    expanded()
    await waitUntil(() => strip.querySelectorAll(':scope > ui-timeline-item').length >= 10, 'all ten step rows')
    await raf()

    const sb = strip.getBoundingClientRect()
    expect(strip.scrollHeight, 'the rows overflow the running strip\'s height cap (the case a short list never exercises)').toBeGreaterThan(strip.clientHeight + 20)
    // rows scrolled under the header are exactly where an unpinned or translucent header would let them show through
    for (const top of [0, 60, strip.scrollHeight]) {
      strip.scrollTop = top
      await raf()
      const hb = header.getBoundingClientRect()
      expect(hb.top, `scrollTop ${top}: the header stays pinned to the strip's top edge`).toBeCloseTo(sb.top, 0)
      expect(hb.height, `scrollTop ${top}: the header row keeps its own height`).toBeGreaterThan(16)
      for (const fx of [0.15, 0.5, 0.85]) {
        const hit = document.elementFromPoint(hb.left + hb.width * fx, hb.top + hb.height / 2)
        expect(hit, `scrollTop ${top}: the probe point at ${fx} is inside the viewport`).not.toBeNull()
        expect(header.contains(hit), `scrollTop ${top}: the topmost element at ${fx} of the header is the header's own, not a step row`).toBe(true)
      }
    }
    expect(getComputedStyle(header).backgroundColor, 'the pinned header paints an opaque canvas').not.toMatch(/rgba\(.*,\s*0\)|transparent/)
    strip.scrollTop = 0
    await raf()
    const first = strip.querySelector<HTMLElement>(':scope > ui-timeline-item')!
    expect(first.getBoundingClientRect().top, 'at scrollTop 0 the first row starts below the header').toBeGreaterThanOrEqual(header.getBoundingClientRect().bottom - 0.5)
    release()
    await waitUntil(() => el.querySelector('[data-part="narration"] [data-part="header"]')?.getAttribute('data-status') !== 'running', 'the turn to settle')
  })

  it(`${server.browser}: a streamed Card in the Test Chat paints its regions inset and seats the trailing Badge on the title row`, async () => {
    const el = await mountAndSend(async function* () {
      for (const ev of cardTurn()) yield ev
    }, 'black jack')
    const pane = chatPane(el)
    await waitUntil(() => pane.querySelector('[data-part="mounts"] ui-card ui-card-footer ui-button') !== null, 'the streamed Card')
    await raf()
    const card = pane.querySelector('[data-part="mounts"] ui-card') as HTMLElement
    const cardBox = card.getBoundingClientRect()
    expect(cardBox.width, 'the Card paints a real box').toBeGreaterThan(200)
    for (const tag of ['ui-card-header', 'ui-card-content', 'ui-card-footer']) {
      const region = card.querySelector(tag) as HTMLElement
      const cs = getComputedStyle(region)
      expect(cs.paddingLeft, `${tag} keeps the 12px region inline padding`).toBe('12px')
      expect(cs.marginLeft, `${tag} keeps the 6px region inset margin`).toBe('6px')
      const ink = region.firstElementChild as HTMLElement
      expect(ink.getBoundingClientRect().left - cardBox.left, `${tag}: content is inset from the card edge, never flush`).toBeGreaterThanOrEqual(18 - 0.5)
    }
    const title = card.querySelector('ui-card-header ui-text') as HTMLElement
    const badge = card.querySelector('ui-card-header ui-badge') as HTMLElement
    const header = card.querySelector('ui-card-header') as HTMLElement
    const tb = title.getBoundingClientRect()
    const bb = badge.getBoundingClientRect()
    const hb = header.getBoundingClientRect()
    expect(bb.top, 'the trailing Badge shares the title row, not a row under it').toBeLessThan(tb.bottom)
    expect(bb.left, 'and sits to the right of the title').toBeGreaterThanOrEqual(tb.right - 0.5)
    expect(hb.right - bb.right, 'at the header\'s trailing edge, inside its padding').toBeGreaterThanOrEqual(11.5)
    expect(hb.right - bb.right).toBeLessThanOrEqual(12 + 0.5)
  })

  it(`${server.browser}: every text part of the settled, expanded strip sits inside the strip's own inline inset`, async () => {
    const el = await mountAndSend(async function* () {
      yield { kind: 'step', step: { id: 'generate', kind: 'generate', label: 'Generated', status: 'ok', durationMs: 1200, raw: '{"a":1}' } }
      yield { kind: 'step', step: { id: 'validate', kind: 'validate', label: 'Validated', status: 'repaired', retries: 1, durationMs: 800, summary: 'Round 1 failed (SCHEMA), repaired in round 2', raw: '{"a":1}' } }
      yield { kind: 'footer', footer: { rounds: 2, inputTokens: 900, outputTokens: 120, model: 'model-x' } }
      for (const ev of cardTurn()) yield ev
    }, 'black jack')
    const pane = chatPane(el)
    await waitUntil(() => pane.querySelector('[data-part="mounts"] ui-card ui-card-footer ui-button') !== null, 'the turn to land')
    await waitUntil(() => pane.querySelector('[data-part="narration"] [data-part="header-meta"]') !== null, 'the settled receipt')
    const strip = pane.querySelector('[data-part="narration"]') as HTMLElement
    ;(strip.querySelector('[data-part="header"]') as HTMLElement).click()
    await raf()
    const left = strip.getBoundingClientRect().left
    const leaves: { name: string; inset: number }[] = []
    const walk = (node: Element): void => {
      for (const child of node.children) {
        const own = [...child.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '')
        const box = child.getBoundingClientRect()
        if (own && box.width > 0) leaves.push({ name: `${child.tagName.toLowerCase()}[${child.getAttribute('data-part') ?? child.getAttribute('data-role') ?? ''}] "${(child.textContent ?? '').trim().slice(0, 24)}"`, inset: box.left - left })
        walk(child)
      }
    }
    walk(strip)
    expect(leaves.length, 'the expanded strip has its header, step labels, summary, raw output and footer text to inspect').toBeGreaterThanOrEqual(7)
    for (const leaf of leaves) expect(leaf.inset, `${leaf.name} is inset from the strip's left edge, never flush`).toBeGreaterThanOrEqual(12)
  })
})
