// site/pages/command-modal-demo.ts — the ui-command-modal interaction demo (LLD-C17 / SPEC-R14 AC2). Mounts
// the REAL palette OPENED over a realistic app backdrop, with two [role=group] sections (Navigation, Actions),
// real command items (a leading ui-icon + label + a [data-role=shortcut] display), the author [slot=empty]
// affordance, and a keyboard-flow callout. Shows BOTH hotkey modes: a consumer-wired open button (the F2 floor)
// and a second instance with `hotkey="mod+k"` (the opt-in convenience) — each toggles only its OWN instance.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

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

// ── instance A — consumer-wired open (the F2 floor: a plain trigger, no document listener) ─────────────────
const openedPalette = el('ui-command-modal', { label: 'Command palette', placeholder: 'Type a command…', open: '' }, paletteChildren())
openedPalette.addEventListener('select', (e) => {
  const { value, label, group } = (e as CustomEvent<{ value: string; label: string; group: string }>).detail
  logEvent(`opened  select  value=${JSON.stringify(value)} label=${JSON.stringify(label)} group=${JSON.stringify(group)}`)
})

// ── instance B — the opt-in hotkey convenience (mod+k), closed by default ───────────────────────────────────
const hotkeyPalette = el('ui-command-modal', { label: 'Command palette (hotkey)', placeholder: 'Type a command…', hotkey: 'mod+k' }, paletteChildren())
hotkeyPalette.addEventListener('select', (e) => {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  logEvent(`hotkey  select  value=${JSON.stringify(value)}`)
})
const hotkeyTrigger = uiButton('Or click here to open it', 'soft')
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
  exampleSection('Opened palette — grouped commands, an empty-state affordance, consumer-wired open', backdrop, openedPalette),
  exampleSection('Keyboard flow', keyboardNote),
  exampleSection('The opt-in hotkey (⌘K / Ctrl+K)', hotkeyTrigger, hotkeyPalette, hotkeyNote),
  exampleSection('select event log', log),
)
