import { describe, it, expect, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UICommandModalElement } from './command-modal.ts'
import '../modal/modal.ts' // ensures ui-modal self-defines (command-modal.ts already imports it — explicit here for clarity)

// command-modal.test.ts — LLD-C14 jsdom behavior suite (command-modal.lld.md; command-modal.spec.md SPEC-R2,
// R4, R5, R6, R10). jsdom reality (verified by modal.test.ts): the native <dialog> modal surface (showModal/
// close/the `open` IDL/the cancel+close events) is ABSENT from jsdom's HTMLDialogElement — the SAME sanctioned
// stub modal.test.ts installs is installed here too (command-modal NESTS a real ui-modal, so its own tests hit
// the identical gap one layer down). The REAL top-layer/focus-trap/Escape/backdrop behaviour is proven
// cross-engine in command-modal.browser.test.ts; these pin the palette's OWN logic: parts creation, ARIA, the
// filter, active-descendant navigation (structural — the FOCUS-STAYS proof is browser-only), selection, the
// nested-modal relay, and the opt-in hotkey.

// ── the native-dialog stub (jsdom lacks the whole modal surface) — copied from modal.test.ts's own stub ──────

const dialogOpen = new WeakMap<HTMLDialogElement, boolean>()

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void }
  if (typeof proto.showModal === 'function') return // a real engine (browser harness) — leave the platform alone
  Object.defineProperty(HTMLDialogElement.prototype, 'open', {
    configurable: true,
    get(this: HTMLDialogElement): boolean {
      return dialogOpen.get(this) ?? false
    },
    set(this: HTMLDialogElement, v: boolean): void {
      dialogOpen.set(this, Boolean(v))
    },
  })
  proto.showModal = function (this: HTMLDialogElement): void {
    dialogOpen.set(this, true)
  }
  proto.close = function (this: HTMLDialogElement): void {
    if (!(dialogOpen.get(this) ?? false)) return
    dialogOpen.set(this, false)
    this.dispatchEvent(new Event('close'))
  }
})

/** Mirror a platform-initiated close of the NESTED modal's dialog (Escape/backdrop/external). */
function simulatePlatformClose(dialog: HTMLDialogElement): void {
  ;(dialog as unknown as { open: boolean }).open = false
  dialog.dispatchEvent(new Event('close'))
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────

function option(value: string, label: string, extra?: { keywords?: string; disabled?: boolean; shortcut?: string; description?: string }): HTMLElement {
  const opt = document.createElement('div')
  opt.setAttribute('role', 'option')
  opt.setAttribute('value', value)
  opt.append(document.createTextNode(label))
  if (extra?.shortcut) {
    const s = document.createElement('span')
    s.setAttribute('data-role', 'shortcut')
    s.setAttribute('aria-hidden', 'true')
    s.textContent = extra.shortcut
    opt.append(s)
  }
  if (extra?.description) {
    // TKT-0019 — the second-line description: NOT aria-hidden (stays in the a11y tree), only excluded from
    // #labelText/select.label (the same shape as the shortcut precedent above, minus the aria-hidden).
    const d = document.createElement('div')
    d.setAttribute('data-role', 'description')
    d.textContent = extra.description
    opt.append(d)
  }
  if (extra?.keywords) opt.setAttribute('data-keywords', extra.keywords)
  if (extra?.disabled) opt.setAttribute('aria-disabled', 'true')
  return opt
}

function group(headingText: string, ...options: HTMLElement[]): HTMLElement {
  const g = document.createElement('div')
  g.setAttribute('role', 'group')
  const heading = document.createElement('div')
  heading.setAttribute('data-role', 'group-label')
  heading.textContent = headingText
  g.append(heading, ...options)
  return g
}

interface Palette {
  el: UICommandModalElement
  search: HTMLElement
  list: HTMLElement
  status: HTMLElement
  emptyRow: HTMLElement
  modal: HTMLElement
  dialog: HTMLDialogElement
}

function makePalette(children: HTMLElement[] = [], attrs: Record<string, string> = {}): Palette {
  const el = document.createElement('ui-command-modal') as UICommandModalElement
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.append(...children)
  document.body.append(el)
  const search = el.querySelector<HTMLElement>('[data-part="search"]')!
  const list = el.querySelector<HTMLElement>('[data-part="list"]')!
  const status = el.querySelector<HTMLElement>('[data-part="status"]')!
  const emptyRow = el.querySelector<HTMLElement>('[data-part="empty"]')!
  const modal = el.querySelector<HTMLElement>('ui-modal')!
  const dialog = el.querySelector<HTMLDialogElement>('[data-part="dialog"]')!
  return { el, search, list, status, emptyRow, modal, dialog }
}

function fireKey(el: HTMLElement, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  el.dispatchEvent(ev)
  return ev
}

// ── upgrade + typed prop surface ────────────────────────────────────────────────────────────────────────

describe('ui-command-modal — upgrade + typed prop surface', () => {
  it('upgrades with open/label/placeholder/hotkey at their defaults', () => {
    const el = document.createElement('ui-command-modal') as UICommandModalElement
    expect(el.open).toBe(false)
    expect(el.label).toBe('')
    expect(el.placeholder).toBe('')
    expect(el.hotkey).toBe('')
  })

  it('ADR-0127: filter defaults to \'substring\' (a fresh instance is unaffected by the new prop)', () => {
    const el = document.createElement('ui-command-modal') as UICommandModalElement
    expect(el.filter).toBe('substring')
  })

  it('self-defines ui-command-modal, guarded against a double-define', () => {
    expect(customElements.get('ui-command-modal')).toBe(UICommandModalElement)
    expect(() => {
      if (!customElements.get('ui-command-modal')) customElements.define('ui-command-modal', UICommandModalElement)
    }).not.toThrow()
  })

  it('is NOT instanceof any form-associated base — holds no form value', () => {
    const el = document.createElement('ui-command-modal') as UICommandModalElement
    expect('formValue' in el).toBe(false)
  })
})

// ── parts creation (idempotent) + host/part ARIA ────────────────────────────────────────────────────────

describe('ui-command-modal — control-created parts (idempotent) + ARIA', () => {
  it('creates exactly ONE search/list/status/empty part on connect, nested inside ONE ui-modal', () => {
    const { el } = makePalette([option('a', 'Alpha')])
    expect(el.querySelectorAll('[data-part="search"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="list"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="status"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="empty"]')).toHaveLength(1)
    expect(el.querySelectorAll('ui-modal')).toHaveLength(1)
    el.remove()
  })

  it('parts are NOT re-created on disconnect + reconnect', () => {
    const { el } = makePalette([option('a', 'Alpha')])
    const searchBefore = el.querySelector('[data-part="search"]')
    const listBefore = el.querySelector('[data-part="list"]')
    el.remove()
    document.body.append(el)
    expect(el.querySelector('[data-part="search"]')).toBe(searchBefore)
    expect(el.querySelector('[data-part="list"]')).toBe(listBefore)
    el.remove()
  })

  it('the search part is role=combobox, aria-autocomplete=list, aria-controls→the list id, contenteditable, native-assist OFF', () => {
    const { search, list, el } = makePalette([option('a', 'Alpha')])
    expect(search.getAttribute('role')).toBe('combobox')
    expect(search.getAttribute('aria-autocomplete')).toBe('list')
    expect(search.getAttribute('aria-controls')).toBe(list.id)
    expect(search.getAttribute('contenteditable')).toBe('plaintext-only')
    expect(search.getAttribute('autocorrect')).toBe('off')
    expect(search.getAttribute('autocapitalize')).toBe('off')
    expect(search.getAttribute('autocomplete')).toBe('off')
    expect(search.getAttribute('spellcheck')).toBe('false')
    el.remove()
  })

  it('the list part is role=listbox, tabindex=-1, and adopts the shared [data-box] container box-model', () => {
    const { list, el } = makePalette([option('a', 'Alpha')])
    expect(list.getAttribute('role')).toBe('listbox')
    expect(list.getAttribute('tabindex')).toBe('-1')
    expect(list.hasAttribute('data-box')).toBe(true)
    el.remove()
  })

  it('the HOST carries no role/aria-* attribute (roles ride the parts, never the host)', () => {
    const { el } = makePalette([option('a', 'Alpha')])
    expect(el.hasAttribute('role')).toBe(false)
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('author [role=option]/[role=group] children are child-moved into the list (ADR-0017)', () => {
    const { list, el } = makePalette([group('Navigation', option('home', 'Go Home'), option('settings', 'Settings'))])
    expect(list.querySelectorAll('[role=group]')).toHaveLength(1)
    expect(list.querySelectorAll('[role=option]')).toHaveLength(2)
    expect(el.querySelectorAll(':scope > [role=option], :scope > [role=group]')).toHaveLength(0)
    el.remove()
  })

  it('options get stable ids assigned at connect (for aria-activedescendant)', () => {
    const { list, el } = makePalette([option('a', 'Alpha'), option('b', 'Beta')])
    for (const opt of list.querySelectorAll<HTMLElement>('[role=option]')) expect(opt.id).toBeTruthy()
    el.remove()
  })

  it('label reactively sets the search field aria-label (falls back to "Search commands" when unset)', async () => {
    const { search, el } = makePalette([option('a', 'Alpha')])
    await whenFlushed()
    expect(search.getAttribute('aria-label')).toBe('Search commands')
    el.label = 'Command palette'
    await whenFlushed()
    expect(search.getAttribute('aria-label')).toBe('Command palette')
    el.remove()
  })

  it('label is forwarded onto the nested ui-modal ONCE, at connect (the dialog accessible name)', () => {
    const { dialog, el } = makePalette([option('a', 'Alpha')], { label: 'Command palette' })
    expect(dialog.getAttribute('aria-label')).toBe('Command palette')
    el.remove()
  })

  it('placeholder reactively sets data-placeholder on the search field', async () => {
    const { search, el } = makePalette([option('a', 'Alpha')], { placeholder: 'Type a command…' })
    await whenFlushed()
    expect(search.getAttribute('data-placeholder')).toBe('Type a command…')
    el.remove()
  })
})

// ── the nested-modal surface seam ────────────────────────────────────────────────────────────────────────

describe('ui-command-modal — the nested ui-modal surface seam (no own dialog/backdrop/Escape)', () => {
  it('el.open=true opens the nested modal; el.open=false closes it', async () => {
    const { el, dialog, search } = makePalette([option('a', 'Alpha')])
    el.open = true
    await whenFlushed()
    expect(dialog.open).toBe(true)
    expect(search.getAttribute('aria-expanded')).toBe('true')

    el.open = false
    await whenFlushed()
    expect(dialog.open).toBe(false)
    expect(search.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('a platform dismissal of the nested modal syncs el.open=false and re-emits close+toggle exactly once', async () => {
    const { el, dialog } = makePalette([option('a', 'Alpha')])
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    simulatePlatformClose(dialog)
    expect(el.open).toBe(false)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('a palette-driven close (el.open=false) does NOT double-fire close/toggle', async () => {
    const { el, dialog } = makePalette([option('a', 'Alpha')])
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = false // the agent/select-commit drives the close
    await whenFlushed()
    expect(dialog.open).toBe(false) // the nested modal WAS closed
    expect(closes).toBe(0) // …but no redundant emit — open was already false when the dialog `close` fired
    expect(toggles).toBe(0)
    el.remove()
  })

  it('creates NO dialog/backdrop/cancel machinery of its own — all delegated to ui-modal', () => {
    const { el } = makePalette([option('a', 'Alpha')])
    // only ONE dialog exists in the whole subtree (ui-modal's own) — the palette adds none
    expect(el.querySelectorAll('dialog')).toHaveLength(1)
    el.remove()
  })
})

// ── filter + active-descendant (structural — focus-stays is browser-only) ──────────────────────────────

describe('ui-command-modal — filter (SPEC-R5)', () => {
  it('typing filters options by item label, case-insensitive; the shortcut glyph is EXCLUDED from the match', () => {
    const { el, search, list } = makePalette([
      option('home', 'Go Home', { shortcut: '⌘H' }),
      option('settings', 'Settings', { shortcut: '⌘,' }),
    ])
    search.textContent = 'HOME'
    search.dispatchEvent(new Event('input', { bubbles: true }))

    const opts = [...list.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.hidden).toBe(false) // "Go Home" matches "home"
    expect(opts[1]!.hidden).toBe(true)

    search.textContent = '⌘h' // the decorative shortcut glyph must NOT be matchable
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(opts.every((o) => o.hidden)).toBe(true)
    el.remove()
  })

  it('data-keywords fold into the filter source', () => {
    const { el, search, list } = makePalette([option('logout', 'Log out', { keywords: 'sign out exit' })])
    search.textContent = 'exit'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(list.querySelector<HTMLElement>('[role=option]')!.hidden).toBe(false)
    el.remove()
  })

  it('a group with zero surviving options hides its heading', () => {
    const { el, search, list } = makePalette([group('Navigation', option('home', 'Go Home'))])
    search.textContent = 'zzz-no-match'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(list.querySelector<HTMLElement>('[role=group]')!.hidden).toBe(true)
    el.remove()
  })

  it('the query change resets the active option (no stale aria-activedescendant)', () => {
    const { el, search } = makePalette([option('a', 'Alpha'), option('b', 'Beta')])
    fireKey(search, 'ArrowDown')
    expect(search.hasAttribute('aria-activedescendant')).toBe(true)

    search.textContent = 'a'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(search.hasAttribute('aria-activedescendant')).toBe(false)
    el.remove()
  })

  it('ArrowDown/ArrowUp move aria-activedescendant + [data-active] among visible options, skipping disabled ones', () => {
    const { el, search, list } = makePalette([
      option('a', 'Alpha'),
      option('b', 'Beta', { disabled: true }),
      option('c', 'Gamma'),
    ])
    const opts = [...list.querySelectorAll<HTMLElement>('[role=option]')]

    fireKey(search, 'ArrowDown') // Alpha
    expect(search.getAttribute('aria-activedescendant')).toBe(opts[0]!.id)
    fireKey(search, 'ArrowDown') // skips Beta (disabled) → Gamma
    expect(search.getAttribute('aria-activedescendant')).toBe(opts[2]!.id)
    fireKey(search, 'ArrowDown') // wraps → Alpha
    expect(search.getAttribute('aria-activedescendant')).toBe(opts[0]!.id)
    fireKey(search, 'ArrowUp') // wraps back → Gamma (ArrowUp from the first visible wraps to the last)
    expect(search.getAttribute('aria-activedescendant')).toBe(opts[2]!.id)
    el.remove()
  })

  it('Home/End jump to the first/last visible option', () => {
    const { el, search, list } = makePalette([option('a', 'Alpha'), option('b', 'Beta'), option('c', 'Gamma')])
    const opts = [...list.querySelectorAll<HTMLElement>('[role=option]')]
    fireKey(search, 'End')
    expect(search.getAttribute('aria-activedescendant')).toBe(opts[2]!.id)
    fireKey(search, 'Home')
    expect(search.getAttribute('aria-activedescendant')).toBe(opts[0]!.id)
    el.remove()
  })
})

// ── ADR-0127 regex filter mode (LLD-C14) — additive, does not touch the substring-mode tests above ─────────

describe('ui-command-modal — regex filter mode (ADR-0127, LLD-C14)', () => {
  it('filter="regex" narrows to a valid pattern over the item label', () => {
    const { el, search, list } = makePalette(
      [option('home', 'Go Home'), option('settings', 'Settings')],
      { filter: 'regex' },
    )
    search.textContent = '^go'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const opts = [...list.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.hidden).toBe(false) // "Go Home" matches /^go/i
    expect(opts[1]!.hidden).toBe(true)
    el.remove()
  })

  it('filter="regex" folds data-keywords into the same regex haystack', () => {
    const { el, search, list } = makePalette(
      [option('logout', 'Log out', { keywords: 'sign out exit' })],
      { filter: 'regex' },
    )
    search.textContent = 'sign.+exit' // spans the label + the data-keywords string in the SAME haystack
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(list.querySelector<HTMLElement>('[role=option]')!.hidden).toBe(false)
    el.remove()
  })

  it('an invalid regex pattern does NOT throw and falls back to literal-substring matching for that keystroke', () => {
    const { el, search, list } = makePalette(
      [option('home', 'Go Home'), option('paren', 'ui-swiper(')],
      { filter: 'regex' },
    )
    expect(() => {
      search.textContent = 'ui-swiper(' // an unbalanced group — `new RegExp` throws SyntaxError
      search.dispatchEvent(new Event('input', { bubbles: true }))
    }).not.toThrow()
    const opts = [...list.querySelectorAll<HTMLElement>('[role=option]')]
    // literal-substring fallback: only the option whose label CONTAINS the literal string "ui-swiper(" matches
    expect(opts[0]!.hidden).toBe(true)
    expect(opts[1]!.hidden).toBe(false)
    el.remove()
  })

  it('filter="regex" does NOT lowercase the pattern text — a case-sensitive escape (\\D) keeps its meaning', () => {
    // Regression: lowercasing the query BEFORE compiling would corrupt \D/\S/\W/\B into \d/\s/\w/\b (a
    // materially different match, not merely a case change). The 'i' flag alone must deliver case-insensitivity.
    const { el, search, list } = makePalette(
      [option('v2', 'v2'), option('beta', 'beta')],
      { filter: 'regex' },
    )
    search.textContent = '\\D' // "a non-digit character" — every label has one; \d would match ONLY "v2"
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const opts = [...list.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.hidden).toBe(false) // "v2" — the '2' is a digit but the 'v' is not, so \D still matches
    expect(opts[1]!.hidden).toBe(false) // "beta" — no digits at all, \D matches
    el.remove()
  })

  it('TKT-0019: a [data-role=description] second line is excluded from the filter haystack (labelText), so an anchored `^` pattern still narrows on the title alone', () => {
    const { el, search, list } = makePalette(
      [
        option('home', 'ui-home (Home)', { description: 'Navigate to the dashboard' }),
        option('button', 'ui-button (Button)', { description: 'A pressable control' }),
      ],
      { filter: 'regex' },
    )
    search.textContent = '^ui-home' // an anchor: can only match a labelText that STARTS with it — never the description
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const opts = [...list.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.hidden).toBe(false) // "ui-home (Home)" — labelText itself starts with the anchor
    expect(opts[1]!.hidden).toBe(true) // "ui-button (Button)" — excluded, even though it too starts with "ui-"
    // The DISCRIMINATING leg (review fold-in): "dashboard" appears ONLY inside opts[0]'s description div
    // (no data-keywords in this fixture). If #labelText wrongly folded the description in, this would
    // match — the anchor assertions above alone cannot tell (the description is appended AFTER the title,
    // so a `^` pattern inspects position 0 identically either way).
    search.textContent = 'dashboard'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(opts[0]!.hidden).toBe(true) // description text is NOT in the haystack (only label + data-keywords are)
    expect(opts[1]!.hidden).toBe(true)
    el.remove()
  })

  it('filter="substring" (the default, no attribute) is unaffected by regex-special characters', () => {
    const { el, search, list } = makePalette([option('a', 'a(b)c')])
    search.textContent = 'a('
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(list.querySelector<HTMLElement>('[role=option]')!.hidden).toBe(false) // plain includes(), never a RegExp
    el.remove()
  })
})

// ── result-count live region ─────────────────────────────────────────────────────────────────────────────

describe('ui-command-modal — result-count live region (SPEC-R7)', () => {
  it('is aria-live=polite and announces the visible count on every filter', () => {
    const { el, search, status } = makePalette([option('a', 'Alpha'), option('b', 'Beta')])
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('2 results')

    search.textContent = 'alp'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(status.textContent).toBe('1 result')

    search.textContent = 'zzz-no-match'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(status.textContent).toBe('No results')
    el.remove()
  })
})

// ── empty state ──────────────────────────────────────────────────────────────────────────────────────────

describe('ui-command-modal — empty state (SPEC-R8)', () => {
  it('shows the default "No results" row (role=presentation) when nothing matches; hides it otherwise', () => {
    const { el, search, emptyRow } = makePalette([option('a', 'Alpha')])
    expect(emptyRow.hidden).toBe(true)
    expect(emptyRow.getAttribute('role')).toBe('presentation')

    search.textContent = 'zzz-no-match'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(emptyRow.hidden).toBe(false)

    search.textContent = ''
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect(emptyRow.hidden).toBe(true)
    el.remove()
  })

  it('an author [slot=empty] child shows INSTEAD of the default row', () => {
    const authorEmpty = document.createElement('div')
    authorEmpty.setAttribute('slot', 'empty')
    authorEmpty.textContent = 'No commands match.'
    const { el, search, emptyRow, list } = makePalette([option('a', 'Alpha'), authorEmpty])

    search.textContent = 'zzz-no-match'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const authored = list.querySelector<HTMLElement>('[slot=empty]')!
    expect(authored.hidden).toBe(false)
    expect(emptyRow.hidden).toBe(true) // the default row yields to the author's own
    el.remove()
  })
})

// ── selection ────────────────────────────────────────────────────────────────────────────────────────────

describe('ui-command-modal — selection = select + close (SPEC-R6)', () => {
  it('Enter on the active option emits select {value,label,group} (shortcut/icon excluded from label) then closes', () => {
    const { el, search } = makePalette([
      group('Navigation', option('home', 'Go Home', { shortcut: '⌘H' })),
    ])
    el.open = true

    let detail: { value: string; label: string; group: string } | undefined
    el.addEventListener('select', (e) => { detail = (e as CustomEvent).detail })

    fireKey(search, 'ArrowDown')
    fireKey(search, 'Enter')

    expect(detail).toEqual({ value: 'home', label: 'Go Home', group: 'Navigation' })
    expect(el.open).toBe(false)
    el.remove()
  })

  it('TKT-0019: a [data-role=description] second line is excluded from select.label but stays in the a11y tree (no aria-hidden)', () => {
    const { el, search } = makePalette([
      option('home', 'Go Home', { description: 'Navigate to the dashboard' }),
    ])
    let detail: { value: string; label: string; group: string } | undefined
    el.addEventListener('select', (e) => { detail = (e as CustomEvent).detail })

    const desc = el.querySelector<HTMLElement>('[data-role=description]')!
    expect(desc.hasAttribute('aria-hidden'), 'the description must stay in the accessibility tree').toBe(false)
    expect(desc.textContent).toBe('Navigate to the dashboard')

    fireKey(search, 'ArrowDown')
    fireKey(search, 'Enter')
    expect(detail?.label, 'select.label must be the title only, never the description').toBe('Go Home')
    el.remove()
  })

  it('an ungrouped option select carries group: \'\'', () => {
    const { el, search } = makePalette([option('logout', 'Log out')])
    let detail: { value: string; label: string; group: string } | undefined
    el.addEventListener('select', (e) => { detail = (e as CustomEvent).detail })
    fireKey(search, 'ArrowDown')
    fireKey(search, 'Enter')
    expect(detail?.group).toBe('')
    el.remove()
  })

  it('clicking an enabled option commits it; clicking a disabled/hidden option emits nothing', () => {
    const { el, list } = makePalette([option('a', 'Alpha'), option('b', 'Beta', { disabled: true })])
    let selectCount = 0
    el.addEventListener('select', () => selectCount++)

    const beta = [...list.querySelectorAll<HTMLElement>('[role=option]')].find((o) => o.textContent === 'Beta')!
    beta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(selectCount).toBe(0)

    const alpha = [...list.querySelectorAll<HTMLElement>('[role=option]')].find((o) => o.textContent === 'Alpha')!
    alpha.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(selectCount).toBe(1)
    el.remove()
  })

  it('a selection-driven close emits ONLY select — never close/toggle', () => {
    const { el, search } = makePalette([option('a', 'Alpha')])
    let closes = 0
    let toggles = 0
    let selects = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)
    el.addEventListener('select', () => selects++)

    fireKey(search, 'ArrowDown')
    fireKey(search, 'Enter')

    expect(selects).toBe(1)
    expect(closes).toBe(0)
    expect(toggles).toBe(0)
    el.remove()
  })
})

// ── Escape — negative control (no palette-owned handler; SPEC-R9) ──────────────────────────────────────────

describe('ui-command-modal — no Escape branch of its own (SPEC-R9)', () => {
  it('Escape on the search field is a no-op at the palette level (no active-descendant move, no close)', () => {
    const { el, search } = makePalette([option('a', 'Alpha')])
    el.open = true
    const before = search.getAttribute('aria-activedescendant')
    const ev = fireKey(search, 'Escape')
    expect(search.getAttribute('aria-activedescendant')).toBe(before)
    expect(ev.defaultPrevented).toBe(false) // NOT handled by the palette — falls through to the platform/modal
    el.remove()
  })
})

// ── the opt-in hotkey (SPEC-R10) ─────────────────────────────────────────────────────────────────────────

describe('ui-command-modal — the opt-in hotkey (no global singleton)', () => {
  it('hotkey=\'\' installs NO document keydown listener for this instance', () => {
    const spy: Array<[string, EventListenerOrEventListenerObject]> = []
    const original = document.addEventListener.bind(document)
    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, opts?: unknown) => {
      spy.push([type, listener])
      return original(type, listener as EventListenerOrEventListenerObject, opts as AddEventListenerOptions)
    }) as typeof document.addEventListener
    try {
      const { el } = makePalette([option('a', 'Alpha')])
      expect(spy.filter(([t]) => t === 'keydown')).toHaveLength(0)
      el.remove()
    } finally {
      document.addEventListener = original
    }
  })

  it('hotkey="mod+k" preventDefaults a ⌘/Ctrl+K document keydown and toggles open; removed on disconnect', () => {
    const { el } = makePalette([option('a', 'Alpha')], { hotkey: 'mod+k' })
    expect(el.open).toBe(false)

    const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true })
    document.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(el.open).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    expect(el.open).toBe(false) // toggled back

    el.remove()
    let opened = false
    // A prop write after disconnect wouldn't run the effect anyway; the residue proof is the listener itself:
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    opened = el.open
    expect(opened).toBe(false) // no residual listener flipped it back open
  })

  it('a hotkey change aborts the old listener and installs the new (no duplicate)', async () => {
    const { el } = makePalette([option('a', 'Alpha')], { hotkey: 'mod+k' })
    el.hotkey = 'mod+j'
    await whenFlushed()

    // the OLD chord no longer does anything
    const kEvent = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true })
    document.dispatchEvent(kEvent)
    expect(kEvent.defaultPrevented).toBe(false)
    expect(el.open).toBe(false)

    // the NEW chord works, exactly once (not doubled)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true }))
    expect(el.open).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true }))
    expect(el.open).toBe(false) // exactly one toggle per keydown — not double-bound
    el.remove()
  })

  it('clearing hotkey back to \'\' removes the listener entirely', async () => {
    const { el } = makePalette([option('a', 'Alpha')], { hotkey: 'mod+k' })
    el.hotkey = ''
    await whenFlushed()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    expect(el.open).toBe(false)
    el.remove()
  })

  it('multi-instance: two palettes sharing a hotkey both toggle themselves independently (no arbitration)', () => {
    const a = makePalette([option('a', 'Alpha')], { hotkey: 'mod+k' })
    const b = makePalette([option('b', 'Beta')], { hotkey: 'mod+k' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    expect(a.el.open).toBe(true)
    expect(b.el.open).toBe(true)
    a.el.remove()
    b.el.remove()
  })
})

// ── zero residue across disconnect/reconnect ────────────────────────────────────────────────────────────────

describe('ui-command-modal — zero residue across connect/disconnect', () => {
  it('after disconnect, input events do not filter (listener removed); reconnect re-wires exactly once', () => {
    const { el, search, list } = makePalette([option('a', 'Alpha'), option('b', 'Beta')])
    el.remove()

    search.textContent = 'alpha'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    // no crash, no filter applied post-disconnect (listener gone) — the options remain as they were
    expect([...list.querySelectorAll('[role=option]')].every((o) => !(o as HTMLElement).hidden)).toBe(true)

    document.body.append(el)
    const newSearch = el.querySelector<HTMLElement>('[data-part="search"]')!
    const newList = el.querySelector<HTMLElement>('[data-part="list"]')!
    newSearch.textContent = 'alpha'
    newSearch.dispatchEvent(new Event('input', { bubbles: true }))
    const opts = [...newList.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.hidden).toBe(false)
    expect(opts[1]!.hidden).toBe(true)
    el.remove()
  })
})
