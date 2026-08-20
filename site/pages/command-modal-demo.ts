// site/pages/command-modal-demo.ts — the ui-command-modal interaction demo (LLD-C17 / SPEC-R14 AC2). Illustrates
// the opened look as a STATIC, INERT visual mock over a realistic app backdrop (GH #1555 — a genuinely live,
// always-open ui-command-modal is a real top-layer `<dialog>` that correctly blocks pointer events across the
// WHOLE page, not just its own card, so a docs page with several independent examples cannot leave one pinned
// open); the mock reproduces the same grouped commands (Navigation, Actions), a leading ui-icon + label + a
// decorative shortcut display, matching paletteChildren() below. The only LIVE, interactive instance is the
// opt-in `hotkey="mod+k"` palette further down the page — press ⌘K/Ctrl+K or click its trigger to open it for
// real, with the author [slot=empty] affordance and a keyboard-flow callout.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import './command-modal-demo.css' // page-local: the "opened palette" static-mock chrome (GH #1555)
import { el, exampleSection, inline, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-command-modal — demo',
  intro: 'The CMD-K command palette, live. Type to filter; ArrowUp/Down move a highlighted option WITHOUT ' +
    'moving focus (it stays in the search field); Enter or click selects and closes; Escape dismisses via the ' +
    'nested ui-modal’s single close path. The API table is on the ui-command-modal API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the select event log ─────────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(line: string): void {
  seq += 1
  const li = document.createElement('li')
  li.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
  log.append(li)
  log.scrollTop = log.scrollHeight
}

// ── a realistic app backdrop (a mock editor/shell — page-authored content, not a control under test) ───────
const backdrop = el('div', { class: 'demo-mock-shell', style: 'border: 1px solid var(--md-sys-color-neutral-outline-variant); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px;' }, [
  el('div', { style: 'font-weight: 600' }, [text('acme-app / src / components / Editor.tsx')]),
  el('div', { style: 'color: var(--md-sys-color-neutral-on-surface-variant)' }, [text('12  export function Editor() {')]),
  el('div', { style: 'color: var(--md-sys-color-neutral-on-surface-variant)' }, [text('13    const [value, setValue] = useState(\'\')')]),
  el('div', { style: 'color: var(--md-sys-color-neutral-on-surface-variant)' }, [text('14    return <textarea value={value} />')]),
  el('div', { style: 'color: var(--md-sys-color-neutral-on-surface-variant)' }, [text('15  }')]),
])

// ── a real command item: leading icon + label + a decorative shortcut display ────────────────────────────
function commandOption(value: string, icon: string, label: string, shortcut: string, keywords?: string): HTMLElement {
  const attrs: Record<string, string> = { role: 'option', value }
  if (keywords) attrs['data-keywords'] = keywords
  return el('div', attrs, [
    el('ui-icon', { glyph: icon, 'data-role': 'icon' }),
    text(label),
    el('span', { 'data-role': 'shortcut', 'aria-hidden': 'true' }, [text(shortcut)]),
  ])
}

function groupLabel(id: string, label: string): HTMLElement {
  const heading = el('div', { id, 'data-role': 'group-label' }, [text(label)])
  return heading
}

function paletteChildren(): HTMLElement[] {
  return [
    el('div', { role: 'group', 'aria-labelledby': 'cmd-nav' }, [
      groupLabel('cmd-nav', 'Navigation'),
      commandOption('home', 'house', 'Go Home', '⌘H'),
      commandOption('settings', 'gear', 'Settings', '⌘,'),
    ]),
    el('div', { role: 'group', 'aria-labelledby': 'cmd-actions' }, [
      groupLabel('cmd-actions', 'Actions'),
      commandOption('logout', 'sign-out', 'Log out', '', 'sign out exit'),
      commandOption('share', 'share', 'Share file', ''),
    ]),
    el('div', { slot: 'empty' }, [text('No commands match — try a different search.')]),
  ]
}

// ── "opened palette" illustration — GH #1555: a genuinely live ui-command-modal with `open` pre-set builds a
// real top-layer `<dialog>` (showModal()), which correctly (per platform modal semantics) intercepts pointer
// events across the ENTIRE page, not just its own example card — a visitor could not reach any OTHER section
// on this page without dismissing it first. `ui-modal`/`ui-command-modal` (modal.ts / command-modal.ts) have
// no non-modal/inert rendering mode to opt into, so this illustration is now a STATIC, INERT visual mock: the
// same real content (icons/labels/shortcuts, matching paletteChildren() below) laid out to match the live
// control's look via plain divs (styled once in containers.css, `.demo-modal-mock*`), never a real `<dialog>`
// — so it cannot block anything. `aria-hidden` because it is decorative (not a real listbox).
function mockOption(icon: string, label: string, shortcut: string): HTMLElement {
  const children: Node[] = [el('ui-icon', { glyph: icon, 'data-role': 'icon' }), text(label)]
  if (shortcut) children.push(el('span', { 'data-role': 'shortcut' }, [text(shortcut)]))
  return el('div', { class: 'demo-modal-mock-option' }, children)
}
function mockGroup(label: string, ...options: HTMLElement[]): HTMLElement {
  return el('div', { class: 'demo-modal-mock-group' }, [el('div', { class: 'demo-modal-mock-group-label' }, [text(label)]), ...options])
}
const openedPaletteMock = el('div', { class: 'demo-modal-mock', 'aria-hidden': 'true' }, [
  el('div', { class: 'demo-modal-mock-search', 'data-placeholder': 'Type a command…' }),
  el('div', { class: 'demo-modal-mock-list' }, [
    mockGroup('Navigation', mockOption('house', 'Go Home', '⌘H'), mockOption('gear', 'Settings', '⌘,')),
    mockGroup('Actions', mockOption('sign-out', 'Log out', ''), mockOption('share', 'Share file', '')),
  ]),
])
const openedPaletteNote = el('p', {}, [
  text('Static illustration, not a live control — a real opened '), code('ui-command-modal'), text(' is a genuine '),
  text('top-layer '), code('<dialog>'), text(' that (correctly) blocks the rest of the page until dismissed, so a '),
  text('page showing several independent examples cannot leave one pinned open. Try the fully live, fully '),
  text('interactive palette in the '), el('strong', {}, [text('opt-in hotkey')]), text(' section below.'),
])

// ── instance B — the opt-in hotkey convenience (mod+k), closed by default ───────────────────────────────────
const hotkeyPalette = el('ui-command-modal', { label: 'Command palette (hotkey)', placeholder: 'Type a command…', hotkey: 'mod+k' }, paletteChildren())
hotkeyPalette.addEventListener('select', (e) => {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  logEvent(`hotkey  select  value=${JSON.stringify(value)}`)
})
const hotkeyTrigger = inline(uiButton('Or click here to open it', 'soft')) // ADR-0223: bare trigger in prose — hugs
hotkeyTrigger.addEventListener('click', () => hotkeyPalette.setAttribute('open', ''))

const keyboardNote = el('p', {}, [
  text('Type to filter (the '), code('⌘H'), text('/'), code('⌘,'), text(' shortcut glyphs are decorative — typing '),
  code('⌘h'), text(' does not match “Go Home”). '),
  el('strong', {}, [text('ArrowDown')]), text('/'), el('strong', {}, [text('ArrowUp')]),
  text(' move the highlighted option ('), code('aria-activedescendant'), text(' + '), code('[data-active]'), text(') '),
  el('strong', {}, [text('without moving focus')]), text(' off the search field. '),
  el('strong', {}, [text('Enter')]), text(' or a click selects the highlighted command and closes the palette. '),
  el('strong', {}, [text('Escape')]), text(' dismisses via the nested '), code('ui-modal'), text('’s single close path — the palette binds no Escape handler of its own.'),
])

const hotkeyNote = el('p', {}, [
  text('This second instance is opt-in-hotkey: press '), el('strong', {}, [text('⌘K')]), text(' (or Ctrl+K) to toggle it — '),
  text('a per-instance document listener, not a global singleton (two palettes sharing a hotkey would both toggle themselves; the palette does not arbitrate).'),
])

content.append(
  exampleSection('Opened palette (static illustration) — grouped commands', backdrop, openedPaletteNote, openedPaletteMock),
  exampleSection('Keyboard flow', keyboardNote),
  exampleSection('The opt-in hotkey (⌘K / Ctrl+K)', hotkeyTrigger, hotkeyPalette, hotkeyNote),
  exampleSection('select event log', log),
)
