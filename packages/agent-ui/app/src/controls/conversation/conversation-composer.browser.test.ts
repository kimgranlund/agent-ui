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
      { id: 'mcp:calc:*', label: 'Calculator', kind: 'tool' },
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
