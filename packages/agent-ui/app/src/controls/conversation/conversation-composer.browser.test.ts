import { describe, it, expect, afterEach } from 'vitest'
import { server, userEvent } from 'vitest/browser'

// GH #849 — the composer reference typeahead's REAL-ENGINE leg (capability-availability-tagging.spec.md
// SPEC-R7 AC1, the slice table's "ONE browser-shard case"). Runs in BOTH Chromium and WebKit.
//
// What only a real engine can prove (jsdom resolves NONE of it — no Popover API, no real caret, no
// document.activeElement under synthesised keystrokes, no layout):
//   [1] SPEC-R7 AC1 — the Arrow→Arrow→Enter walk under REAL keystrokes: DOM focus stays on the editor
//       throughout, `aria-activedescendant` tracks the highlight, the commit lands, and NO submit fires.
//   [2] The panel really enters the Popover API TOP LAYER (a painted, non-zero box) from a composer sitting
//       inside an `overflow: hidden` scroll ancestor — the shape every chat surface actually mounts, and the
//       GH #260 clipping-ancestor class this placement exists to survive.
//   [3] The committed chip renders as a real, non-zero pill in the chip row, and the typed token text is
//       gone from the editor's own painted text — the WHOLE rendered shape, not per-part assertions.
//
// CSS load order (ADR-0003): foundation roles + the dimensional ramp first, then this control's sheet.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './conversation-composer.css'
import { UIConversationComposerElement } from './conversation-composer.ts'
// GH #891 (SPEC-R9) — registers + activates the curated Phosphor pack (ADR-0066) AND defines the two
// composed controls a chip is built from, so the chip's kind glyph resolves to a REAL <svg> here (the
// entry-list.browser.test.ts import shape, reused). That is what makes the R9 icon leg a genuine proof
// rather than a name comparison: an unknown glyph name would render `data-icon-missing` (resolve.ts), and
// an UNDEFINED `ui-icon` would render nothing at all — both are visible failures of this assertion.
import '@agent-ui/icons/phosphor'
import '@agent-ui/components/controls/icon'
import '@agent-ui/components/controls/button'
// GH #891 (SPEC-R11) — the capabilities rows are REAL `ui-switch` controls; the panel's real-engine case
// needs them defined to click, focus and read `checked` at all.
import '@agent-ui/components/controls/switch'

const MENTIONABLES = [
  { id: 'res-menu', label: 'Menu PDF', kind: 'resource', description: 'Tonight’s menu' },
  { id: 'res-brand', label: 'Brand guide', kind: 'resource' },
  { id: 'res-notes', label: 'Meeting notes', kind: 'resource' },
]

const mounted: HTMLElement[] = []
afterEach(async () => {
  while (mounted.length) {
    const wrap = mounted.pop()!
    for (const panel of wrap.querySelectorAll<HTMLElement & { hidePopover?: () => void }>('[data-part="reference-menu"]')) {
      try {
        panel.hidePopover?.()
      } catch {
        // already closed — nothing to release
      }
    }
    wrap.remove()
  }
})

/** Mount the composer inside a realistic chat-surface shell: a bounded, `overflow: hidden` scroll column
 *  with the composer pinned at the bottom (the a2ui-chat / agent-admin shape). The clipping ancestor is the
 *  point — a non-top-layer panel would be cut off here. */
function mountComposer(): { wrap: HTMLElement; el: UIConversationComposerElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.justifyContent = 'flex-end'
  wrap.style.overflow = 'hidden'
  wrap.style.width = '420px'
  wrap.style.height = '260px'
  const el = document.createElement('ui-conversation-composer') as UIConversationComposerElement
  wrap.append(el)
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, el }
}

const editorOf = (el: UIConversationComposerElement): HTMLElement => el.querySelector('[data-part="editor"]')!

const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}
const px = (v: string): number => Number.parseFloat(v)
const menuOf = (el: UIConversationComposerElement): HTMLElement | null => el.querySelector('[data-part="reference-menu"]')
const optionsOf = (el: UIConversationComposerElement): HTMLElement[] => [
  ...(menuOf(el)?.querySelectorAll<HTMLElement>('[data-part="reference-option"]') ?? []),
]

describe('ui-conversation-composer — GH #849 reference typeahead (both engines)', () => {
  it('AC1 — Arrow→Arrow→Enter: focus never leaves the editor, aria-activedescendant tracks, the commit lands, NO submit fires', async () => {
    const { el } = mountComposer()
    el.mentionables = MENTIONABLES
    const sent: [string, readonly { id: string; label: string; kind: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    await el.updateComplete
    const editor = editorOf(el)

    editor.focus()
    await userEvent.type(editor, 'total the order @')
    await el.updateComplete

    const menu = menuOf(el)!
    expect(menu.hasAttribute('data-open'), `${server.browser}: a token-start @ opens the typeahead`).toBe(true)
    expect(document.activeElement, 'opening the menu must not move DOM focus').toBe(editor)

    const ids = optionsOf(el).map((o) => o.id)
    expect(ids.length).toBe(3)
    expect(editor.getAttribute('aria-activedescendant'), 'the first option is highlighted on open').toBe(ids[0])

    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement, 'ArrowDown must not move DOM focus (active-descendant discipline)').toBe(editor)
    expect(editor.getAttribute('aria-activedescendant')).toBe(ids[1])

    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(editor)
    expect(editor.getAttribute('aria-activedescendant')).toBe(ids[2])
    expect(optionsOf(el)[2]!.hasAttribute('data-active'), 'the third option carries the visible highlight').toBe(true)

    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    expect(document.activeElement, 'the commit keeps DOM focus on the editor').toBe(editor)
    expect(sent, 'an Enter that COMMITS must never send').toEqual([])
    expect(menu.hasAttribute('data-open'), 'the commit closes the menu').toBe(false)
    expect(editor.getAttribute('aria-activedescendant'), 'and clears the active descendant').toBeNull()

    const chip = el.querySelector<HTMLElement>('[data-part="reference-chip"]')!
    expect(chip.querySelector('[data-part="reference-chip-label"]')!.textContent).toBe('Meeting notes')
    // WHOLE-SHAPE: the chip is a real painted pill (never a zero box), and the token text is gone.
    const chipBox = chip.getBoundingClientRect()
    expect(chipBox.width, `${server.browser}: the chip must render a real box`).toBeGreaterThan(20)
    expect(chipBox.height).toBeGreaterThan(8)
    // nbsp-normalised: a space typed at the END of a contenteditable can land as U+00A0 in both engines —
    // that is platform text-editing behaviour, not this control's, and `#send()`'s own `trim()` covers it.
    expect(editor.textContent!.replace(/ /g, ' '), 'the in-progress token left the editor').toBe('total the order ')

    // ...and a following Enter now SENDS, carrying the structured reference (the widened callback).
    await userEvent.keyboard('{Enter}')
    await el.updateComplete
    expect(sent).toEqual([['total the order', [{ id: 'res-notes', label: 'Meeting notes', kind: 'resource' }]]])
    expect(el.querySelector('[data-part="reference-chip"]'), 'chips clear with the text on send').toBeNull()
  })

  it('the panel enters the TOP LAYER — a real, non-zero box that escapes an overflow:hidden ancestor', async () => {
    const { wrap, el } = mountComposer()
    el.invocables = [
      { id: 'skill-style', label: 'House style', kind: 'skill' },
      { id: 'wf-review', label: 'Review flow', kind: 'workflow' },
      { id: 'svc:calc:*', label: 'Calculator', kind: 'tool' },
    ]
    await el.updateComplete
    const editor = editorOf(el)

    editor.focus()
    await userEvent.type(editor, '/')
    await el.updateComplete

    const menu = menuOf(el)!
    expect(menu.matches(':popover-open'), `${server.browser}: the panel is in the top layer`).toBe(true)
    const box = menu.getBoundingClientRect()
    expect(box.width, 'the panel honours its own min-inline-size floor').toBeGreaterThan(150)
    expect(box.height, 'three grouped rows have real height').toBeGreaterThan(40)
    // It ESCAPES the clipping ancestor, measured on the real page (the GH #260 class): the panel is the
    // hit-tested element at its own centre. A panel clipped by the `overflow: hidden` wrap — or painted
    // under it — would hand back something else entirely.
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    expect(hit && (hit === menu || menu.contains(hit)), `${server.browser}: the panel paints above its clipping ancestor`).toBe(true)
    expect(box.top, 'the panel opens ABOVE the editor, over the thread area').toBeLessThan(editor.getBoundingClientRect().top)
    expect(wrap.getBoundingClientRect().height, 'the clipping ancestor really is bounded').toBe(260)

    // Grouped-by-kind is real, painted structure — three groups, each with a visible header.
    const groups = [...menu.querySelectorAll<HTMLElement>('[data-part="reference-group"]')]
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Skill', 'Workflow', 'Tool'])
    for (const group of groups) {
      const header = group.querySelector<HTMLElement>('[data-part="reference-group-label"]')!
      expect(header.getBoundingClientRect().height, 'a group header must be painted, not collapsed').toBeGreaterThan(4)
    }

    await userEvent.keyboard('{Escape}')
    await el.updateComplete
    expect(menu.matches(':popover-open'), 'Escape leaves the top layer').toBe(false)
    expect(editor.textContent, 'the dismissed trigger stays as plain text').toBe('/')
    expect(document.activeElement, 'Escape never moves focus off the editor').toBe(editor)
  })
})

describe('ui-conversation-composer — GH #891 SPEC-R9: the chip is label + a REAL kind glyph, never a sigil (both engines)', () => {
  it('the committed chip paints its consumer glyph as a resolved svg, and no `/` character renders anywhere in it', async () => {
    const { el } = mountComposer()
    el.invocables = [{ id: 'skill-style', label: 'House style', kind: 'skill', icon: 'star' }]
    await el.updateComplete
    const editor = editorOf(el)

    editor.focus()
    await userEvent.type(editor, '/house')
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    const chip = el.querySelector<HTMLElement>('[data-part="reference-chip"]')!
    // WHOLE-SHAPE, on the real page: the pill paints, its rendered text is EXACTLY the label (no sigil), and
    // the removed sigil part is nowhere in the DOM.
    const chipBox = chip.getBoundingClientRect()
    expect(chipBox.width, `${server.browser}: the chip must render a real box`).toBeGreaterThan(20)
    expect(chip.innerText.trim(), 'the visible chip text is exactly the label').toBe('House style')
    expect(el.querySelector('[data-part="reference-chip-sigil"]'), 'the sigil node is gone from the DOM').toBeNull()

    const icon = chip.querySelector<HTMLElement>('[data-part="reference-chip-icon"]')!
    expect(icon.getAttribute('glyph')).toBe('star')
    // The glyph really RESOLVED against the curated pack (an unknown name renders data-icon-missing) and
    // paints a non-zero box inside the pill, left of the label.
    expect(icon.hasAttribute('data-icon-missing'), `${server.browser}: 'star' must exist in the curated set`).toBe(false)
    const svg = icon.querySelector('svg')
    expect(svg, 'the pack injected a real svg body').not.toBeNull()
    const iconBox = icon.getBoundingClientRect()
    expect(iconBox.width, 'the glyph cell is painted, not collapsed').toBeGreaterThan(4)
    expect(iconBox.height).toBeGreaterThan(4)
    const labelBox = chip.querySelector<HTMLElement>('[data-part="reference-chip-label"]')!.getBoundingClientRect()
    expect(iconBox.right, 'the glyph leads the label').toBeLessThanOrEqual(labelBox.left + 1)
    // ...and the glyph inherits the chip's accent ink rather than declaring its own colour (icon.css's
    // `color: inherit` + the chip's own reference-chip ink token).
    expect(getComputedStyle(icon).color).toBe(getComputedStyle(chip).color)
  })

  it('SPEC-R11 AC3 — the capabilities panel: open → toggle → toggle → Escape, with real focus discipline', async () => {
    const { wrap, el } = mountComposer()
    const rows = [
      { id: 'skill-style', label: 'House style', kind: 'skill', icon: 'star', included: true },
      { id: 'svc:calc:*', label: 'Calculator', kind: 'tool', icon: 'gear', included: false },
    ]
    el.capabilities = rows
    const toggles: [string, boolean][] = []
    el.onCapabilityToggle((id, included) => toggles.push([id, included]))
    await el.updateComplete

    const trigger = el.querySelector<HTMLElement>('[data-picker="capabilities"]')!
    await userEvent.click(trigger)
    await el.updateComplete

    const panel = el.querySelector<HTMLElement>('[data-part="capabilities-panel"]')!
    expect(panel.matches(':popover-open'), `${server.browser}: the panel is in the top layer`).toBe(true)
    // It ESCAPES the `overflow: hidden` chat shell (the GH #260 clipping class) and opens ABOVE the trigger.
    const box = panel.getBoundingClientRect()
    expect(box.width, 'the panel honours its own min-inline-size floor').toBeGreaterThan(150)
    expect(box.height, 'two switch rows have real height').toBeGreaterThan(40)
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    expect(hit && (hit === panel || panel.contains(hit)), `${server.browser}: the panel paints above its clipping ancestor`).toBe(true)
    expect(box.top, 'it opens ABOVE the options row').toBeLessThan(trigger.getBoundingClientRect().top)
    expect(wrap.getBoundingClientRect().height, 'the clipping ancestor really is bounded').toBe(260)

    const switches = [...panel.querySelectorAll<HTMLElement & { checked: boolean }>('[data-part="capability-switch"]')]
    expect(switches.length).toBe(2)
    for (const control of switches) {
      const switchBox = control.getBoundingClientRect()
      expect(switchBox.width, `${server.browser}: a switch must paint a real track`).toBeGreaterThan(12)
      expect(switchBox.height).toBeGreaterThan(8)
      // The switch is pinned to the row's trailing edge, past its label.
      const row = control.closest<HTMLElement>('[data-part="capability-row"]')!
      const label = row.querySelector<HTMLElement>('[data-part="capability-row-label"]')!
      expect(switchBox.left).toBeGreaterThan(label.getBoundingClientRect().right - 1)
      expect(switchBox.right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 1)
    }

    // A REAL click on the OFF switch: it reports the new state, keeps the panel open, and — the props-down
    // law under a real engine — snaps back to the prop's own value because no consumer answered.
    await userEvent.click(switches[1]!)
    await el.updateComplete
    expect(toggles).toEqual([['svc:calc:*', true]])
    expect(panel.matches(':popover-open'), 'the panel stays open across a toggle').toBe(true)
    expect(switches[1]!.checked, 'zero local mutation: the row reverts to the prop truth').toBe(false)
    // Focus is on the control the user actually clicked — never yanked to the editor (the click-to-focus
    // exclusion), which is what makes the next keyboard interaction land where the user is looking.
    expect(document.activeElement, `${server.browser}: the clicked switch keeps focus`).toBe(switches[1])

    // A second flip in the SAME visit, from the keyboard this time (Space activates a switch, platform parity).
    await userEvent.keyboard(' ')
    await el.updateComplete
    expect(toggles).toEqual([['svc:calc:*', true], ['svc:calc:*', true]])
    expect(panel.matches(':popover-open')).toBe(true)

    // The consumer answers — and the SAME switch node updates in place, so focus survives the answer.
    el.capabilities = rows.map((r) => (r.id === 'svc:calc:*' ? { ...r, included: true } : r))
    await el.updateComplete
    expect(switches[1]!.checked).toBe(true)
    expect(document.activeElement, 'an in-place answer never drops the user’s focus').toBe(switches[1])

    await userEvent.keyboard('{Escape}')
    await el.updateComplete
    expect(panel.matches(':popover-open'), 'Escape leaves the top layer').toBe(false)
    expect(document.activeElement, 'Escape returns focus to the trigger').toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('an icon-less roster entry commits a label-only chip — no glyph cell, no placeholder box', async () => {
    const { el } = mountComposer()
    el.mentionables = MENTIONABLES // no `icon` in this roster
    await el.updateComplete
    const editor = editorOf(el)

    editor.focus()
    await userEvent.type(editor, '@brand')
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    const chip = el.querySelector<HTMLElement>('[data-part="reference-chip"]')!
    expect(chip.querySelector('[data-part="reference-chip-icon"]')).toBeNull()
    expect(chip.innerText.trim()).toBe('Brand guide')
    expect(chip.getBoundingClientRect().width, `${server.browser}: still a real pill`).toBeGreaterThan(20)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  GH #858 — the reported surface: the placeholder ("Ask anything..") pins to the default-state
//  ink; hover/focus no longer forward-brighten it (the exact repro this issue was filed against —
//  a focused, EMPTY composer used to brighten "Ask anything.." to the near-white focus ink). Busy
//  (the composer's own disabled-equivalent, TKT-0034) still dims it — now an explicit repoint.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-conversation-composer — GH #858: placeholder ink is FROZEN across hover/focus, still dims when busy (both engines)', () => {
  it('the placeholder computed colour at FOCUS equals its colour at REST (an EMPTY composer)', async () => {
    const { el } = mountComposer()
    const editor = editorOf(el)
    const restColor = getComputedStyle(editor, '::before').color
    expect(alphaOf(restColor), 'the placeholder is invisible at rest — the probe would be vacuous').toBeGreaterThan(0)

    await userEvent.click(editor)
    expect(document.activeElement, 'the editor did not actually focus').toBe(editor)
    await new Promise((r) => setTimeout(r, 250)) // past --md-sys-motion-duration-fast — let any repaint settle

    expect(
      getComputedStyle(editor, '::before').color,
      `${server.browser}: GH #858 regressed — the placeholder brightened to the focus ink on an EMPTY composer`,
    ).toBe(restColor)
  })

  it('the placeholder computed colour on HOVER (unfocused) equals its colour at REST', async () => {
    const { el } = mountComposer()
    const editor = editorOf(el)
    const restColor = getComputedStyle(editor, '::before').color

    await userEvent.hover(el)
    await expect
      .poll(() => px(getComputedStyle(el).borderTopWidth), { timeout: 1500 })
      .toBeGreaterThan(0) // confirms the hover row really painted (the ONE visible-border state, TKT-0062)
    await new Promise((r) => setTimeout(r, 250))

    expect(
      getComputedStyle(editor, '::before').color,
      `${server.browser}: GH #858 regressed — the placeholder brightened to the hover ink on an EMPTY composer`,
    ).toBe(restColor)
    await userEvent.unhover(el)
  })

  it('busy (the disabled-equivalent, TKT-0034) still DIMS the placeholder (now an explicit repoint)', async () => {
    const { el } = mountComposer()
    const editor = editorOf(el)
    const idleColor = getComputedStyle(editor, '::before').color

    el.busy = true
    await el.updateComplete
    await new Promise((r) => setTimeout(r, 250))

    expect(
      getComputedStyle(editor, '::before').color,
      `${server.browser}: a busy composer's placeholder no longer dims — the explicit busy repoint regressed`,
    ).not.toBe(idleColor)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  GH #1211 — the attach path's drop/paste legs: jsdom has no real DataTransfer/ClipboardEvent
//  file-carrying behavior at all (the jsdom suite's own file-input `change` case covers the picker
//  button leg instead — real files only need a real engine for drop/paste). Both proofs construct a
//  REAL `DataTransfer` and populate it via `items.add(file)` (the only spec-legal way to get a real
//  `File` into one), then dispatch the real event carrying it.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-conversation-composer — GH #1211: drop/paste hand real Files up through onAttach (both engines)', () => {
  it('dropping a file onto the composer calls onAttach with it, and toggles [data-dragover] across the drag lifecycle', async () => {
    const { el } = mountComposer()
    el.onAttach(() => {})
    await el.updateComplete
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const dt = new DataTransfer()
    dt.items.add(file)

    el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    expect(el.hasAttribute('data-dragover'), `${server.browser}: dragover did not set the drop-affordance state`).toBe(true)

    const received: File[][] = []
    el.onAttach((files) => received.push([...files]))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))

    expect(el.hasAttribute('data-dragover'), 'drop clears the drop-affordance state').toBe(false)
    expect(received).toHaveLength(1)
    expect(received[0]!.map((f) => f.name)).toEqual(['notes.txt'])
  })

  it('a consumer that never calls onAttach never intercepts dragover — no [data-dragover], no preventDefault', async () => {
    const { el } = mountComposer()
    await el.updateComplete
    const dt = new DataTransfer()
    const event = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })
    el.dispatchEvent(event)
    expect(event.defaultPrevented, `${server.browser}: dragover was intercepted with no onAttach registered`).toBe(false)
    expect(el.hasAttribute('data-dragover')).toBe(false)
  })

  it('pasting a file into the editor calls onAttach and does not insert anything into the editor surface', async () => {
    const { el } = mountComposer()
    const editor = editorOf(el)
    const received: File[][] = []
    el.onAttach((files) => received.push([...files]))
    await el.updateComplete
    const file = new File(['hello'], 'pasted.md', { type: 'text/markdown' })
    const dt = new DataTransfer()
    dt.items.add(file)

    editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))

    expect(received).toHaveLength(1)
    expect(received[0]!.map((f) => f.name)).toEqual(['pasted.md'])
    expect(el.value, 'a file paste must not fall through to the plain-text paste path').toBe('')
  })

  it('an ordinary text paste (no files on the clipboard) is left completely alone — onAttach never fires', async () => {
    const { el } = mountComposer()
    const editor = editorOf(el)
    const received: File[][] = []
    el.onAttach((files) => received.push([...files]))
    await el.updateComplete
    const dt = new DataTransfer()
    dt.setData('text/plain', 'just some typed words')

    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt })
    editor.dispatchEvent(event)

    expect(received, `${server.browser}: a plain text paste must never reach onAttach`).toHaveLength(0)
    expect(event.defaultPrevented, 'a plain text paste must not be intercepted — the native paste path must run').toBe(false)
  })
})


// -- ADR-0223 (Fill by Default, slice 1 -- the entry family): the two-posture acceptance leg, the
//    generalized ADR-0021 smoke (the text-field pilot's shape): FILL -- a bare host in block flow
//    stretches to the container's inline size (the container IS the floor); [inline] -- the host hugs,
//    held open by the relocated content floor (clause 3(b)), and sits BELOW the container.
describe('ui-conversation-composer -- ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host >= its floor and < container (hug)', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container -- wider than any ch-floor resolution
    wrap.innerHTML = `<ui-conversation-composer></ui-conversation-composer>`
    document.body.append(wrap)
    mounted.push(wrap)
    const host = wrap.querySelector('ui-conversation-composer') as HTMLElement & { updateComplete: Promise<unknown> }
    await host.updateComplete
    // FILL (the default): block-level -- the host stretches to the container.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(host.offsetWidth, 'the bare host did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(host).display, 'the default host is not block-level').toBe('flex')
    // HUG (the ONE opt-out): [inline] flips display level AND posture; the relocated floor holds it open.
    host.setAttribute('inline', '')
    const floorPx = px(getComputedStyle(host).minInlineSize)
    expect(floorPx, 'the hug floor did not resolve to a positive px in [inline]').toBeGreaterThan(0)
    const hugged = host.offsetWidth
    expect(hugged, 'the [inline] host is narrower than its floor').toBeGreaterThanOrEqual(Math.floor(floorPx))
    expect(hugged, 'the [inline] host did not HUG -- it still fills the container').toBeLessThan(containerWidth)
    expect(getComputedStyle(host).display, 'the [inline] host is not inline-level').toBe('inline-flex')
  })
})
