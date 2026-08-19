// site/pages/toast-region-demo.ts — the ui-toast-region interaction demo (the layout-tier host of the toast
// family, ADR-0112 / feed-family.lld.md LLD-C8; pairs with toast-region-doc.ts, the API page). Where the ui-toast
// demo proves ONE toast's timing model, THIS page proves the REGION's job: the queue — a burst of show() calls
// stacking oldest→newest, the popover opening on the first child and closing on the last (the childList
// MutationObserver), a "dismiss all" sweep via each toast's own close(), and TWO independent regions that never
// contend (no static singleton — ADR-0082's per-instance isolation). The stack log proves it: every show() and
// every close is logged with the live child count. The control owns the top-layer + stacking mechanics
// (toast-region.ts + toast.ts); this page only stages the regions, drives show(), and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, inline, uiButton } from '../lib/specimens.ts'
import type { UIToastRegionElement, UIToastElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-toast-region — demo',
  intro:
    'The top-layer host toasts stack inside, live. Raise a burst of toasts and watch them queue oldest→newest; ' +
    'the region opens its popover on the first child and closes it on the last. Dismiss them one by one, or ' +
    'sweep the whole stack. A second, independent region proves no hidden global state is shared. The API ' +
    'table is on the ui-toast-region API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// ── the shared stack log — every show()/close, with the region's live child count ────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logLine(regionName: string, verb: string, detail: string, count: number): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${regionName.padEnd(8)}${verb.padEnd(8)}${detail}  (stack=${count})`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── the primary region: a file-sync scenario (a believable burst source) ────────────────────────────────────
const region = document.createElement('ui-toast-region') as UIToastRegionElement
const stackCount = el('span', { 'data-role': 'stack-count' }, [text('0')])

function refreshCount(): void {
  stackCount.textContent = String(region.querySelectorAll('ui-toast').length)
}

function raise(target: UIToastRegionElement, name: string, options: Parameters<UIToastRegionElement['show']>[0]): void {
  const toast = target.show(options) as UIToastElement
  const message = typeof options === 'string' ? options : options.message
  const short = message.length > 28 ? `${message.slice(0, 27)}…` : message
  logLine(name, 'show', short, target.querySelectorAll('ui-toast').length)
  toast.addEventListener('close', () => {
    // close fires BEFORE the element is removed — count the survivors, not the closing one.
    const remaining = target.querySelectorAll('ui-toast').length - 1
    logLine(name, 'close', short, remaining)
    if (target === region) queueMicrotask(refreshCount)
  })
  if (target === region) refreshCount()
}

// A realistic sync log: five files finish in quick succession — the burst a queue exists for.
const SYNC_BURST = [
  'quarterly-report.pdf synced',
  'brand-assets.zip synced',
  'notes.md synced',
  'budget-2026.xlsx synced',
  'team-photo.jpg synced',
]

const oneBtn = uiButton('Raise one toast', 'soft')
oneBtn.addEventListener('click', () => raise(region, 'primary', { message: 'notes.md synced' }))

const burstBtn = uiButton('Raise a burst of five', 'soft')
burstBtn.addEventListener('click', () => {
  for (const message of SYNC_BURST) raise(region, 'primary', { message })
})

const stickyBtn = uiButton('Raise a sticky urgent toast', 'soft')
stickyBtn.addEventListener('click', () =>
  raise(region, 'primary', { message: 'Sync paused — storage is full.', urgent: true, duration: 0, action: 'Manage' }),
)

const dismissAllBtn = uiButton('Dismiss all', 'soft')
dismissAllBtn.addEventListener('click', () => {
  // The sweep goes through each toast's OWN close() (idempotent, one `close` per instance) — the region has no
  // dismiss-all API by design: it coordinates the stack, each toast owns its lifecycle.
  for (const toast of [...region.querySelectorAll('ui-toast')] as UIToastElement[]) toast.close()
})

const controls = el('div', { style: 'display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;' }, [
  oneBtn, burstBtn, stickyBtn, dismissAllBtn,
  el('span', { style: 'font-family: var(--md-sys-typeface-mono); font-size: 0.85rem;' }, [text('stack: '), stackCount]),
])

const queueNote = el('p', {}, [
  text('Toasts stack '), strong('oldest → newest, top → bottom'), text(' in a normal-flow flex column — zero JS positioning. The region is a '),
  code('popover="manual"'), text(' element that opens itself when the first '), code('ui-toast'),
  text(' child arrives and closes when the last one leaves (a childList '), code('MutationObserver'),
  text('). Plain toasts auto-dismiss after 6s (paused while hovered/focused); the sticky one ('), code('duration=0'),
  text(' + an action) stays until you act on it or sweep the stack.'),
])

// ── two independent regions — per-instance isolation, no static singleton ───────────────────────────────────
const secondRegion = document.createElement('ui-toast-region') as UIToastRegionElement

const secondBtn = uiButton('Raise on the SECOND region', 'soft')
secondBtn.addEventListener('click', () => raise(secondRegion, 'second', { message: 'Second region: comment posted.' }))

const bothBtn = uiButton('Raise on BOTH regions', 'soft')
bothBtn.addEventListener('click', () => {
  raise(region, 'primary', { message: 'Primary: export ready.' })
  raise(secondRegion, 'second', { message: 'Second: export ready.' })
})

const isolationNote = el('p', {}, [
  text('There is '), strong('no static singleton'), text(' — '), code('show()'),
  text(' is an instance method, so two regions on one page never contend over hidden global state (ADR-0082). ' +
    'The log names which region each toast rode; both regions share the same fixed inset in v1 (placement is ' +
    'tokens, a '), code('placement'), text(' prop is the named foreseen extension), so their stacks overlap ' +
    'visually — the point here is independence, not layout.'),
])

const secondControls = el('div', { style: 'display:flex; gap:0.75rem; flex-wrap:wrap;' }, [secondBtn, bothBtn])

// ── the declarative path — author-authored markup, no show() call ────────────────────────────────────────────
const declarativeBtn = inline(uiButton('Mount a region with two authored toasts', 'soft')) // ADR-0223: bare demo action — hugs
let declarative: UIToastRegionElement | undefined
declarativeBtn.addEventListener('click', () => {
  declarative?.remove()
  declarative = el('ui-toast-region', {}, [
    el('ui-toast', {}, [text('Draft restored from 09:41.')]),
    el('ui-toast', { urgent: '' }, [text('Two collaborators are editing this page.')]),
  ]) as UIToastRegionElement
  content.append(declarative)
  logLine('authored', 'mount', '2 authored ui-toast children', 2)
})

const declarativeNote = el('p', {}, [
  text('The region composes either imperatively via '), code('show()'),
  text(' (the sanctioned entry point — it sets the message text BEFORE appending, so the announcement is ' +
    'complete the instant the live region shows) or declaratively: author-authored '), code('<ui-toast>'),
  text(' children already in the markup open the region at connect. Each authored toast still runs its own ' +
    'auto-dismiss timer.'),
])

content.append(
  exampleSection('The queue — raise, burst, sweep', controls, queueNote, region),
  exampleSection('Two independent regions', secondControls, isolationNote, secondRegion),
  exampleSection('Declarative markup path', declarativeBtn, declarativeNote),
  exampleSection('show / close stack log', log),
)
