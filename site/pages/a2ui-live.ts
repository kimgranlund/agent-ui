// a2ui-live.ts — LLD-C9 / SPEC-R10: the live-agent demo chat app (the ladder's last rung made visible).
// Layout: [ chat | a2ui-canvas ]. The chat drives an AgentTransport; the agent's A2UI stream renders into
// the canvas (a REAL @agent-ui/a2ui surface); interacting with the surface round-trips a client message
// that becomes the next turn ("the agent continues"). The canvas pane is TABS — Canvas (the rendered
// surface, translate-centered), JSON (the JSONL payload), HTML (the rendered markup).
//
// The page consumes ONLY the AgentTransport seam (SPEC-R1): the default is the deterministic RECORDED
// BACKBONE (works offline, in the built static site, and under CI). The LIVE overlay — a real model via
// the dev proxy + the provider switcher — is swapped in ONLY under `import.meta.env.DEV` via a dynamic
// import, so `vite build` tree-shakes it out and no key path is ever baked into the build (SPEC-N2). No
// `fetch`, proxy URL, or transport internal appears in this file's render/round-trip logic — the swap is
// the construction site alone (SPEC-R1 AC1).

import { mountFullBleedPage } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './a2ui-live.css'
import { codeBlock } from '../lib/code-block.ts'
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, A2uiClientMessage, A2uiServerMessage } from '@agent-ui/a2ui'
import {
  createRecordedTransport,
  nextTurn,
  appendUserTurn,
  appendAssistantTurn,
  frameClientMessage,
} from '../lib/agent-runtime.ts'
import type { AgentTransport, TurnInput, Session } from '../lib/agent-runtime.ts'

const { content } = mountFullBleedPage()

// ── small light-DOM chrome helpers (page chrome only — never restyle a ui-* control) ────────────────────
function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}
function paneTitle(title: string, blurb: string): HTMLElement {
  const head = el('header', 'pane-head')
  const h = document.createElement('h2')
  h.className = 'pane-title'
  h.textContent = title
  const p = el('p', 'pane-blurb')
  p.textContent = blurb
  head.append(h, p)
  return head
}

// ════════════════ the two panes ════════════════
const chatPane = el('section', 'chat-pane')
const canvasPane = el('section', 'canvas-pane')
content.append(chatPane, canvasPane)

// ── chat pane: log · composer · (dev) switcher · reset ──────────────────────────────────────────────────
chatPane.append(paneTitle('Chat', 'Prompt the agent, then interact with the surface it renders.'))
const chatLog = el('div', 'chat-log')
chatLog.setAttribute('aria-live', 'polite')
chatPane.append(chatLog)

function addMessage(role: 'user' | 'agent' | 'system', text: string): void {
  const item = el('div', 'msg')
  item.dataset.role = role
  const who = el('span', 'msg-who')
  who.textContent = role === 'user' ? 'You' : role === 'agent' ? 'Agent' : 'System'
  const body = el('p', 'msg-body')
  body.textContent = text
  item.append(who, body)
  chatLog.append(item)
  chatLog.scrollTop = chatLog.scrollHeight
}

const switcherSlot = el('div', 'switcher-slot')

const composer = el('form', 'chat-composer')
const field = document.createElement('ui-text-field')
field.setAttribute('label', 'Message')
field.setAttribute('placeholder', 'Ask the agent to build something…')
const sendBtn = document.createElement('ui-button')
sendBtn.setAttribute('variant', 'solid')
sendBtn.setAttribute('tabindex', '0')
sendBtn.textContent = 'Send'
composer.append(field, sendBtn)

const readField = (): string => String((field as unknown as { value?: string }).value ?? '')
const clearField = (): void => {
  ;(field as unknown as { value: string }).value = ''
}

chatPane.append(switcherSlot, composer) // switcher (dev-only, populated on probe) sits ABOVE the composer

// ── canvas pane: tabs (Canvas · JSON · HTML) ────────────────────────────────────────────────────────────
canvasPane.append(paneTitle('A2UI canvas', 'The rendered surface, its JSONL payload, and its HTML.'))

const tabStrip = el('div', 'tab-strip')
tabStrip.setAttribute('role', 'tablist')
const tabPanels = el('div', 'tab-panels')
canvasPane.append(tabStrip, tabPanels)

interface TabDef {
  id: string
  label: string
}
const TABS: TabDef[] = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
]
const registered: { id: string; btn: HTMLButtonElement; panel: HTMLElement }[] = []
let activeTabId = TABS[0]!.id
for (const t of TABS) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'tab'
  btn.textContent = t.label
  btn.id = `a2ui-tab-${t.id}`
  btn.setAttribute('role', 'tab')
  btn.setAttribute('aria-controls', `a2ui-panel-${t.id}`)
  btn.setAttribute('tabindex', '-1') // roving tabindex — selectTab promotes the active tab to 0
  btn.addEventListener('click', () => selectTab(t.id))
  tabStrip.append(btn)
  const panel = el('div', 'tab-panel')
  panel.id = `a2ui-panel-${t.id}`
  panel.setAttribute('role', 'tabpanel')
  panel.setAttribute('aria-labelledby', `a2ui-tab-${t.id}`)
  panel.setAttribute('tabindex', '0')
  tabPanels.append(panel)
  registered.push({ id: t.id, btn, panel })
}
function selectTab(id: string): void {
  activeTabId = id
  for (const r of registered) {
    const active = r.id === id
    r.btn.classList.toggle('is-active', active)
    r.btn.setAttribute('aria-selected', String(active))
    r.btn.setAttribute('tabindex', active ? '0' : '-1') // only the active tab is in the tab order
    r.panel.classList.toggle('is-active', active)
  }
}
// Arrow-key navigation (WAI-ARIA tabs pattern): Left/Right cycle, Home/End jump; focus follows selection.
tabStrip.addEventListener('keydown', (e) => {
  const key = (e as KeyboardEvent).key
  const cur = registered.findIndex((r) => r.id === activeTabId)
  let next = -1
  if (key === 'ArrowRight' || key === 'ArrowDown') next = (cur + 1) % registered.length
  else if (key === 'ArrowLeft' || key === 'ArrowUp') next = (cur - 1 + registered.length) % registered.length
  else if (key === 'Home') next = 0
  else if (key === 'End') next = registered.length - 1
  else return
  e.preventDefault()
  const target = registered[next]!
  selectTab(target.id)
  target.btn.focus()
})

// Canvas tab → a stage whose surface is CENTERED via a CSS translate transform (see a2ui-live.css).
const canvasPanel = registered[0]!.panel
const stage = el('div', 'canvas-stage')
const surfaceEl = el('div', 'canvas-surface')
stage.append(surfaceEl)
canvasPanel.append(stage)
// JSON + HTML tabs → scrollable <pre><code> blocks (rebuilt each turn).
const jsonPanel = registered[1]!.panel
const htmlPanel = registered[2]!.panel
selectTab('canvas')

function refreshJson(lines: string[]): void {
  const pretty = lines.map((l) => JSON.stringify(JSON.parse(l), null, 2)).join('\n')
  jsonPanel.replaceChildren(codeBlock(pretty || '(no payload yet)', 'json'))
}
function refreshHtml(): void {
  const html = surfaceEl.innerHTML.replace(/></g, '>\n<').trim()
  htmlPanel.replaceChildren(codeBlock(html || '(nothing rendered yet)', 'html'))
}

// ════════════════ the transport + the chat loop ════════════════
// Default: the deterministic recorded backbone (SPEC-R2). Swapped for the live overlay under dev only.
let transport: AgentTransport = createRecordedTransport()
let host: RendererHost = createRenderer()
let session: Session = { turns: [] }
const allLines: string[] = []
let busy = false

host.onClientMessage(handleClientMessage)
host.mount(surfaceEl)

let busyRow: HTMLElement | null = null
function setBusy(next: boolean): void {
  busy = next
  composer.classList.toggle('is-busy', next)
  if (next) {
    sendBtn.setAttribute('aria-disabled', 'true')
    // Show an in-flight indicator in the aria-live log so the wait is both visible and announced.
    busyRow = el('div', 'chat-status')
    busyRow.textContent = 'Agent is working…'
    chatLog.append(busyRow)
    chatLog.scrollTop = chatLog.scrollHeight
  } else {
    sendBtn.removeAttribute('aria-disabled')
    busyRow?.remove()
    busyRow = null
  }
}

function describeClientMessage(m: A2uiClientMessage): string {
  if ('action' in m) return `clicked "${m.action.name}"`
  if ('functionResponse' in m) return `function ${m.functionResponse.call} → ${JSON.stringify(m.functionResponse.value)}`
  return `error: ${m.error.code}`
}

function summarize(lines: string[]): string {
  const kinds = lines.map((l) => {
    const msg = JSON.parse(l) as A2uiServerMessage
    return Object.keys(msg).find((k) => k !== 'version') ?? '?'
  })
  return `Emitted ${lines.length} A2UI message(s): ${kinds.join(', ')}. See the JSON / HTML tabs.`
}

// When the agent roots its surface at a ui-column, stretch it to FILL the artboard: a column shrink-wraps to
// content, but as the ROOT of the canvas it should fill the artboard width (Kim's `stretch` attribute on
// ui-column). Re-applied after every render — a turn's updateComponents can replace the root node.
function applyRootStretch(): void {
  const root = surfaceEl.firstElementChild
  if (root && root.tagName.toLowerCase() === 'ui-column') root.setAttribute('stretch', '')
}

async function runTurn(input: TurnInput): Promise<void> {
  if (busy) return
  setBusy(true)
  try {
    const turnLines: string[] = []
    for await (const line of transport.turn(input)) {
      turnLines.push(line)
      allLines.push(line)
      host.ingest(line) // validated JSONL streamed line-by-line → progressive paint (SPEC-N4)
    }
    host.finalize()
    applyRootStretch() // a root ui-column fills the artboard (before refreshHtml so the HTML tab reflects it)
    if (turnLines.length === 0) {
      addMessage('system', 'The agent has no further turns in this recorded transcript. Reset to start over.')
      return
    }
    session = appendUserTurn(session, input.kind === 'intent' ? input.text : frameClientMessage(input.message))
    session = appendAssistantTurn(session, turnLines.join('\n'))
    addMessage('agent', summarize(turnLines))
    refreshJson(allLines)
    refreshHtml()
    selectTab('canvas')
  } catch (e) {
    addMessage('system', `⚠ ${(e as Error).message}`)
  } finally {
    setBusy(false)
  }
}

function handleClientMessage(message: A2uiClientMessage): void {
  // A control in the canvas emitted an action/response/error → the agent continues on the next turn.
  // The pure reducer (SPEC-R8) frames it as the next TurnInput.
  addMessage('user', `↳ ${describeClientMessage(message)}`)
  void runTurn(nextTurn(session, message))
}

function send(): void {
  const text = readField().trim()
  if (text === '' || busy) return
  addMessage('user', text)
  clearField()
  void runTurn({ kind: 'intent', text, session })
}
sendBtn.addEventListener('click', send)
composer.addEventListener('submit', (e) => {
  e.preventDefault()
  send()
})
field.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') {
    e.preventDefault()
    send()
  }
})

// ── Reset: dispose the renderer, clear the session + canvas + log, restart the transport ────────────────
const resetBtn = document.createElement('ui-button')
resetBtn.setAttribute('variant', 'ghost')
resetBtn.setAttribute('tabindex', '0')
resetBtn.textContent = 'Reset'
resetBtn.addEventListener('click', () => {
  host.dispose()
  host = createRenderer()
  host.onClientMessage(handleClientMessage)
  host.mount(surfaceEl)
  surfaceEl.replaceChildren()
  session = { turns: [] }
  allLines.length = 0
  transport = createRecordedTransport()
  chatLog.replaceChildren()
  refreshJson([])
  refreshHtml()
  addMessage('system', 'New conversation. Send a prompt to begin.')
  wireLiveOverlay() // re-probe (dev only)
})
const resetBar = el('div', 'reset-bar')
resetBar.append(resetBtn)
canvasPane.append(resetBar)

// ── initial state ───────────────────────────────────────────────────────────────────────────────────────
refreshJson([])
refreshHtml()

// ════════════════ the dev-only LIVE overlay (SPEC-N2: dynamic + DEV-guarded ⇒ tree-shaken from build) ════
function wireLiveOverlay(): void {
  if (!import.meta.env.DEV) {
    addMessage('system', 'Recorded backbone demo. Send any prompt to render turn 1, then click the button to continue.')
    return
  }
  void (async () => {
    try {
      const overlay = await import('../lib/live-proxy-transport.ts')
      const status = await overlay.probeLive()
      if (status.available) {
        const { mountSwitcher } = await import('../lib/provider-switcher.ts')
        const selection = mountSwitcher(switcherSlot)
        transport = overlay.createLiveProxyTransport(selection)
        addMessage('system', `Live agent connected (${status.providers} provider(s) available). Prompt it to generate a real A2UI surface.`)
      } else {
        addMessage('system', 'Recorded backbone (no live API key found). Set a provider key in .env and restart `npm run dev` for a live agent.')
      }
    } catch {
      addMessage('system', 'Recorded backbone demo (live overlay unavailable).')
    }
  })()
}
wireLiveOverlay()
