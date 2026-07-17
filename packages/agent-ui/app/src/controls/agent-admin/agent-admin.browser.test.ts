import { describe, it, expect, afterEach } from 'vitest'

// The CROSS-ENGINE ui-agent-admin smoke (TKT-0039, ADR-0131). jsdom cannot resolve CSS flex/@scope
// layout — this file is where the three-pane side-by-side geometry becomes TRUE in BOTH Chromium and
// WebKit (the master-detail.browser.test.ts precedent). CSS wiring: the foundation first, then
// `component-styles.css` (the family barrel carries ui-split/ui-split-pane/ui-text-field/etc.'s shipped
// CSS), then every composed sibling's own CSS, then this element's own.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-composer.css' // TKT-0056 — the composed ui-conversation-composer's own layout/parts CSS
import '../surface-host/surface-host.css'
// TKT-0085 — <ui-tabs>/<ui-tab>/<ui-tab-panel> registration for the responsive shell's medium/narrow
// shells; its CSS is already carried by `component-styles.css` above (`@import
// './controls/tabs/tabs.css'`), no separate stylesheet import needed.
import '@agent-ui/components/controls/tabs'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import type { UITextareaElement } from '@agent-ui/components/controls/textarea'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
// Activates the Phosphor pack (TKT-0048) — without this, `ui-icon[glyph="plus"]` renders an EMPTY (but
// still correctly-sized) leading cell: `resolveIcon` against an inactive registry doesn't throw, so a
// typo'd `name` would silently ship past a suite that only checks the cell's box. `iconRenders()` below
// asserts a real `<path>` landed, not just a correctly-sized empty slot.
import '@agent-ui/icons/phosphor'
import { ENTRY_KINDS } from './entries.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  // component-reviewer finding (TKT-0060): the default store is localStorage-persisted
  // (persistKey: 'ui-agent-admin') and this cross-engine file shares one page/session across tests — an
  // entry a prior test's add-form add() committed otherwise leaks into a LATER test's own assertions (e.g.
  // a "web-search" skill added by one test pre-existing at the next test's mount), the agent-admin.test.ts
  // precedent already guards against the jsdom-side equivalent.
  localStorage.clear()
})

function mountAgentAdmin(): { wrapper: HTMLElement; el: UIAgentAdminElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = '1200px'
  wrapper.style.height = '600px'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto' // the master-detail.md/conversation.md "consumer-supplied block-size" precedent
  wrapper.style.display = 'flex'
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { wrapper, el }
}

/** TKT-0085 — a mount whose OWN width drives the real ResizeObserver `agent-admin.ts` installs
 *  (`mountAgentAdmin()` above fixes 1200px on a flex-item host inside a sized wrapper; this widens that
 *  to an arbitrary width so each of the three responsive bands is reachable with a REAL browser-measured
 *  resize, not a simulated one). */
function mountAgentAdminAt(widthPx: number): { wrapper: HTMLElement; el: UIAgentAdminElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = `${widthPx}px`
  wrapper.style.height = '600px'
  wrapper.style.display = 'flex'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto'
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { wrapper, el }
}

describe('ui-agent-admin cross-engine smoke — the responsive shell (TKT-0085)', () => {
  it('wide (≥1024px): the 3-pane split is visible; the narrow all-tabs shell computes display:none', async () => {
    const { el } = mountAgentAdminAt(1200)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) // let the real ResizeObserver's first callback land
    const split = el.querySelector(':scope > ui-split') as HTMLElement
    const narrowTabs = el.querySelector(':scope > ui-tabs') as HTMLElement
    expect(getComputedStyle(split).display).not.toBe('none')
    expect(getComputedStyle(narrowTabs).display).toBe('none') // component-reviewer CRITICAL-class pin: [hidden] must actually compute none, not just carry the attribute (an author `display` declaration silently beats the UA [hidden] rule without an explicit guard — the entry-add-form/combo-box.css precedent this fix follows)
  })

  it('medium (640–1023px): [ Chat | {tabs} ] — the medium tabs pane renders a real, non-zero tab strip', async () => {
    const { el } = mountAgentAdminAt(800)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const canvas = el.querySelector('[data-role="canvas"]') as HTMLElement
    const tabsMediumPane = el.querySelector('[data-role="tabs-medium"]') as HTMLElement
    expect(canvas.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(tabsMediumPane.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(canvas.getBoundingClientRect().right).toBeLessThanOrEqual(tabsMediumPane.getBoundingClientRect().left + 1)
    const tabs = [...tabsMediumPane.querySelectorAll('ui-tab')]
    for (const tab of tabs) expect(tab.getBoundingClientRect().width).toBeGreaterThan(0)
    // Clicking the Agent tab actually switches the visible panel (a real click, real ui-tabs selection wiring).
    const agentTab = tabs.find((t) => t.textContent === 'Agent') as HTMLElement
    agentTab.click()
    await new Promise((r) => requestAnimationFrame(r))
    const agentHeading = el.querySelector('[data-part="agent-heading"]') as HTMLElement
    expect((agentHeading.closest('ui-tab-panel') as HTMLElement | null)?.hidden).toBe(false)
    expect(agentHeading.getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it('narrow (<640px): {Chat, Instructions, Agent} tabs fill the shell; the split computes display:none', async () => {
    const { el } = mountAgentAdminAt(500)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const split = el.querySelector(':scope > ui-split') as HTMLElement
    const narrowTabs = el.querySelector(':scope > ui-tabs') as HTMLElement
    expect(getComputedStyle(split).display).toBe('none') // the SAME [hidden]-specificity pin, the other direction
    expect(getComputedStyle(narrowTabs).display).not.toBe('none')
    const tabs = [...narrowTabs.querySelectorAll('ui-tab')]
    expect(tabs.map((t) => t.textContent)).toEqual(['Chat', 'Instructions', 'Agent'])
    for (const tab of tabs) expect(tab.getBoundingClientRect().width).toBeGreaterThan(0)
    // The composer is reachable and has real, non-zero geometry inside the Chat tab (the default selection).
    const composer = narrowTabs.querySelector('ui-conversation-composer') as HTMLElement
    expect(composer.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  /** Opens a real A2UI surface (a Hit button) in the mounted conversation, returns it + the conversation. */
  async function openLiveSurface(el: UIAgentAdminElement): Promise<{ conversation: HTMLElement }> {
    const conversation = el.querySelector('[data-role="canvas"] ui-conversation, ui-tabs ui-conversation') as HTMLElement & {
      beginAgentTurn(): { ingestLine(l: string): void; finalize(): void }
    }
    const handle = conversation.beginAgentTurn()
    handle.ingestLine(JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))
    handle.ingestLine(
      JSON.stringify({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Hit', action: { action: 'hit' } }],
        },
      }),
    )
    handle.finalize()
    expect(conversation.querySelector('ui-surface-host ui-button')).not.toBeNull()
    return { conversation }
  }

  it('component-reviewer MAJOR regression pin: a live surface SURVIVES a wide→medium crossing — Chat genuinely stays in place, its own split pane is never removed+re-added', async () => {
    const { el, wrapper } = mountAgentAdminAt(1200)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const { conversation } = await openLiveSurface(el)

    wrapper.style.width = '800px' // real resize into medium — canvasPane is a member of BOTH wide + medium
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    expect(el.querySelector('[data-role="tabs-medium"]'), 'did not actually reach medium').not.toBeNull()
    expect(conversation.querySelector('[data-state="closed"]'), 'the surface closed on a wide→medium crossing — it should have stayed open').toBeNull()
    expect(conversation.querySelector('ui-surface-host ui-button'), 'the rendered surface content should still be there').not.toBeNull()
  })

  it('a live surface open at a crossing INTO narrow shows the documented "Closed." treatment (narrow genuinely reached via a real resize, not silently landing in medium)', async () => {
    const { el, wrapper } = mountAgentAdminAt(1200)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const { conversation } = await openLiveSurface(el)

    wrapper.style.width = '500px' // real browser resize → the real ResizeObserver fires → 'narrow'
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // component-reviewer MAJOR fix: assert the layout ACTUALLY reached narrow — the pre-fix host floored
    // at its content's intrinsic width (~659px, missing `min-inline-size: 0`) and silently landed in
    // medium instead, which made the "Closed." assertion below pass for the WRONG reason (medium's own
    // wide-parity closure, itself a since-fixed bug) without ever exercising real narrow at all.
    const narrowTabs = el.querySelector(':scope > ui-tabs') as HTMLElement
    expect(getComputedStyle(narrowTabs).display, 'did not actually reach narrow').not.toBe('none')
    expect(el.querySelector(':scope > ui-split') && getComputedStyle(el.querySelector(':scope > ui-split') as HTMLElement).display).toBe('none')

    const bubble = conversation.querySelector('[data-state="closed"]')
    expect(bubble, 'the surface bubble should carry data-state="closed", not vanish silently').not.toBeNull()
    expect(bubble?.querySelector('[data-part="annotation"]')?.textContent).toBe('Closed.')
  })
})

describe('ui-agent-admin cross-engine smoke — three panes render side by side (ADR-0131 cl.2)', () => {
  it('canvas, prompts, and settings each occupy a non-zero, non-overlapping box, left to right', () => {
    const { el } = mountAgentAdmin()
    const canvas = el.querySelector('[data-role="canvas"]') as HTMLElement
    const prompts = el.querySelector('[data-role="prompts"]') as HTMLElement
    const settings = el.querySelector('[data-role="settings"]') as HTMLElement
    const c = canvas.getBoundingClientRect()
    const p = prompts.getBoundingClientRect()
    const s = settings.getBoundingClientRect()
    for (const box of [c, p, s]) {
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }
    expect(c.right).toBeLessThanOrEqual(p.left + 1) // canvas is left of prompts (integer rounding slop)
    expect(p.right).toBeLessThanOrEqual(s.left + 1) // prompts is left of settings
  })

  it('a seeded prompt-section entry\'s content field is visibly focusable and legible (a real element, not display:none)', () => {
    const { el } = mountAgentAdmin()
    const field = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement
    field.focus()
    // ui-textarea forwards .focus() to its internal contenteditable editor part (the text-field precedent) —
    // the ACTIVE element is that editor div, not the host; :focus-within proves focus landed inside the field.
    expect(field.matches(':focus-within')).toBe(true)
    const box = field.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })

  it('the toggle switch on a seeded entry is a real, visibly rendered ui-switch (whole-shape, not a collapsed stub)', () => {
    const { el } = mountAgentAdmin()
    const toggle = el.querySelector('[data-entry-id="foundation"] [data-part="entry-toggle"]') as HTMLElement
    expect(toggle.tagName.toLowerCase()).toBe('ui-switch')
    const box = toggle.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })

  it('all four capability sections (Skills/Workflows/Resources/Tools) render in the settings pane, each a real non-zero box', () => {
    const { el } = mountAgentAdmin()
    const settings = el.querySelector('[data-role="settings"]') as HTMLElement
    const sections = [...settings.querySelectorAll('[data-part="entry-section"]')]
    expect(sections.map((s) => s.getAttribute('data-kind'))).toEqual([
      ENTRY_KINDS.skill,
      ENTRY_KINDS.workflow,
      ENTRY_KINDS.resource,
      ENTRY_KINDS.tool,
    ])
    for (const section of sections) {
      const box = section.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }
  })
})

describe('ui-agent-admin cross-engine smoke — the add-form is GENUINELY collapsed when hidden (component-reviewer CRITICAL fix)', () => {
  it('a hidden add-form computes display:none; toggling reveals it as a real, visible box', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.tool}"]`) as HTMLElement
    const form = section.querySelector('[data-part="entry-add-form"]') as HTMLElement

    // Before the CSS fix, `display: flex` beat the UA [hidden] rule — this assertion is the one the
    // review found the shipped whole-shape suite was blind to.
    expect(getComputedStyle(form).display).toBe('none')
    expect(form.getBoundingClientRect().height).toBe(0)

    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    expect(getComputedStyle(form).display).not.toBe('none')
    expect(form.getBoundingClientRect().height).toBeGreaterThan(0)
  })
})

describe('ui-agent-admin cross-engine smoke — an uncommitted edit survives a sibling toggle (component-reviewer MAJOR fix)', () => {
  it('a mid-edit content field keeps its live value AND its focus after a sibling entry re-renders the list', async () => {
    const { el } = mountAgentAdmin()
    const foundationField = el.querySelector(
      '[data-entry-id="foundation"] [data-part="entry-content"]',
    ) as UITextareaElement
    foundationField.focus()
    foundationField.value = 'Half-typed, never committed'
    foundationField.dispatchEvent(new Event('input', { bubbles: true }))

    const personalityToggle = el.querySelector(
      '[data-entry-id="personality"] [data-part="entry-toggle"]',
    ) as HTMLElement & { checked: boolean }
    personalityToggle.checked = false
    personalityToggle.dispatchEvent(new Event('change', { bubbles: true }))

    const foundationAfter = el.querySelector(
      '[data-entry-id="foundation"] [data-part="entry-content"]',
    ) as UITextareaElement
    expect(foundationAfter.value).toBe('Half-typed, never committed')
    // component-reviewer MINOR fix: entry-list.ts's restore path awaits `updateComplete` before calling
    // `selectToEnd()` (the model→surface sync that populates the editor's textContent is async, and
    // collapsing a range onto a still-empty editor caret-lands at 0, not the end) — await the SAME flush
    // here before asserting focus, matching the real timing `selectToEnd()` now runs on.
    await foundationAfter.updateComplete
    // real browser focus semantics — the jsdom leg only asserts the value half; this leg is where the fix's
    // focus claim is actually provable. ui-textarea's selectToEnd() (entry-list.ts's ADR-0134 migration seam)
    // focuses the internal editor part, not the host — :focus-within proves focus survived onto the NEW row.
    expect(foundationAfter.matches(':focus-within')).toBe(true)
  })
})

describe('ui-agent-admin cross-engine smoke — adding a custom capability actually renders (ADR-0132)', () => {
  it('submitting the add-form for a Skill renders a new, real, toggleable entry row', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const labelField = section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement
    labelField.value = 'Web search'
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()

    const row = el.querySelector('[data-kind="skill"] [data-entry-id="web-search"]') as HTMLElement
    expect(row).not.toBeNull()
    const box = row.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    const toggle = row.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }
    expect(toggle.checked).toBe(true)
  })
})

describe('ui-agent-admin cross-engine smoke — TKT-0048: entry-list action buttons are real ui-button instances', () => {
  it('entry-add-toggle is a <ui-button> with a leading plus-icon adornment spaced from its label by a real, non-zero gap', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    const toggle = section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement
    expect(toggle.tagName.toLowerCase()).toBe('ui-button')

    const icon = toggle.querySelector('[slot="leading"][data-role="icon"]') as HTMLElement
    expect(icon).not.toBeNull()
    expect(icon.tagName.toLowerCase()).toBe('ui-icon')
    // A real glyph landed — not just a correctly-sized, empty leading cell. `ui-icon` treats an
    // unregistered/typo'd `name` as a silent no-op (icon.ts's open-string prop), so a box-only assertion
    // below would pass even if `name="plus"` never resolved to real path data.
    expect(icon.querySelector('path')).not.toBeNull()
    const label = toggle.querySelector('[data-part="label"]') as HTMLElement
    expect(label).not.toBeNull()
    expect(label.textContent).toBe('Add skill') // no leftover literal "+" — the icon supplies it now

    // The real claim under proof: a controlled, non-zero gap between the icon cell and the label cell —
    // NOT a "+" character glued straight onto the label text (the reported bug). button.css's host-as-grid
    // column-gap is the mechanism; asserting it here is a real engine resolving it, not a declared value.
    const gap = Number.parseFloat(getComputedStyle(toggle).columnGap)
    expect(gap).toBeGreaterThan(0)

    // Whole-shape: the icon cell sits strictly to the LEFT of the label with real, non-overlapping boxes
    // (button-geometry's own "test the whole shape" discipline — a per-part px assertion alone can't rule
    // out a visually collapsed/overlapping render).
    const iconBox = icon.getBoundingClientRect()
    const labelBox = label.getBoundingClientRect()
    expect(iconBox.width).toBeGreaterThan(0)
    expect(labelBox.left).toBeGreaterThan(iconBox.right)
  })

  it('entry-delete is a real <ui-button> (state-styling parity — TKT-0046\'s fleet sweep gap this control sat in)', () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    const wrapper = document.createElement('div')
    wrapper.style.width = '1200px'
    wrapper.style.height = '600px'
    el.style.flex = '1 1 auto'
    wrapper.style.display = 'flex'
    wrapper.append(el)
    document.body.append(wrapper)
    mounted.push(wrapper)

    // Custom entries (not built-ins) render a delete affordance — add one via the real add-form flow.
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const labelField = section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement
    labelField.value = 'Web search'
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()

    const deleteBtn = el.querySelector('[data-kind="skill"] [data-entry-id="web-search"] [data-part="entry-delete"]') as HTMLElement
    expect(deleteBtn.tagName.toLowerCase()).toBe('ui-button')
    expect(deleteBtn.textContent).toBe('Remove')
    const box = deleteBtn.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})

describe('ui-agent-admin cross-engine smoke — TKT-0045: no pane overflows at the docs demo frame\'s stated minimum', () => {
  it('at 48rem (768px, site/pages/agent-admin.css\'s .agent-admin-resize min-inline-size), every pane fits without internal overflow', () => {
    const wrapper = document.createElement('div')
    wrapper.style.width = '768px'
    wrapper.style.height = '420px'
    wrapper.style.overflow = 'hidden' // mirrors .agent-admin-resize's own overflow:hidden
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.style.display = 'flex'
    el.style.width = '100%'
    el.style.height = '100%'
    wrapper.append(el)
    document.body.append(wrapper)
    mounted.push(wrapper)

    // The frame itself never overflows (the ticket's literal framing) — but the REAL bug lived one level
    // deeper, in each pane's own nested content (the composer, the generated settings fields) silently
    // clipping via their own overflow-x, so every pane is checked independently too.
    expect(wrapper.scrollWidth).toBe(wrapper.clientWidth)

    const split = el.querySelector('ui-split') as HTMLElement
    expect(split.scrollWidth).toBe(split.clientWidth)

    const canvas = el.querySelector('[data-role="canvas"]') as HTMLElement
    const prompts = el.querySelector('[data-role="prompts"]') as HTMLElement
    const settings = el.querySelector('[data-role="settings"]') as HTMLElement
    for (const [label, pane] of [
      ['canvas', canvas],
      ['prompts', prompts],
      ['settings', settings],
    ] as const) {
      expect(pane.scrollWidth, `${label} pane must not overflow itself`).toBe(pane.clientWidth)
    }

    // The composer (ui-conversation's own overflow-x:hidden previously swallowed it invisibly) and the
    // nested ui-settings/ui-master-detail drill-in pane (the --_pane-min inheritance leak, TKT-0045) are
    // the two spots the bug actually lived — assert both directly, not just their ancestors.
    const composer = canvas.querySelector('ui-conversation-composer') as HTMLElement
    expect(composer.scrollWidth, 'the message composer must not overflow ui-conversation').toBeLessThanOrEqual(
      (canvas.querySelector('ui-conversation') as HTMLElement).clientWidth,
    )
    const uiSettingsInner = settings.querySelector('ui-settings') as HTMLElement
    expect(uiSettingsInner.scrollWidth, 'the generated settings form must not overflow its pane').toBe(uiSettingsInner.clientWidth)
  })
})

describe('ui-agent-admin cross-engine smoke — TKT-0049: entry-content/entry-add-content min-height is driven by ui-textarea\'s own `rows` lever, not dead agent-admin.css', () => {
  // `--ui-textarea-min-block-size`'s formula (textarea.css:52): rows × line-box + 2×padding-block, where
  // line-box = font-size × 1.5 and padding-block = font-size × 0.5. Deriving the expected px from the
  // field's OWN real computed font-size (never a hardcoded px) proves the FIX mechanism — `rows` is the
  // one lever that moves this — rather than re-asserting a specific legacy pixel value.
  function expectedMinBlockSize(field: HTMLElement, rows: number): number {
    const fontSize = Number.parseFloat(getComputedStyle(field).fontSize)
    const lineBox = fontSize * 1.5
    const paddingBlock = fontSize * 0.5
    return rows * lineBox + 2 * paddingBlock
  }

  it('entry-content (rows=4) renders a real computed min-height matching the rows formula', () => {
    const { el } = mountAgentAdmin()
    const field = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as UITextareaElement
    expect(field.rows).toBe(4)
    const computed = Number.parseFloat(getComputedStyle(field).minHeight)
    expect(computed).toBeCloseTo(expectedMinBlockSize(field, 4), 1)
  })

  it('entry-add-content (rows=2) renders a real computed min-height matching the rows formula', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.tool}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const field = section.querySelector('[data-part="entry-add-content"]') as UITextareaElement
    expect(field.rows).toBe(2)
    const computed = Number.parseFloat(getComputedStyle(field).minHeight)
    expect(computed).toBeCloseTo(expectedMinBlockSize(field, 2), 1)
  })

  it('changing `.rows` moves entry-content\'s rendered min-height (proves the mechanism; catches a future competing CSS rule that WINS the cascade)', async () => {
    const { el } = mountAgentAdmin()
    const field = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as UITextareaElement
    const before = Number.parseFloat(getComputedStyle(field).minHeight)
    field.rows = 8
    await field.updateComplete // the rows→CSS-custom-property write rides a reactive effect, not a sync write
    const after = Number.parseFloat(getComputedStyle(field).minHeight)
    expect(after).toBeGreaterThan(before)
    expect(after).toBeCloseTo(expectedMinBlockSize(field, 8), 1)
  })
})

describe('ui-agent-admin cross-engine smoke — TKT-0050/TKT-0059: entry-content/entry-add-content render off ui-textarea\'s OWN tokens, not agent-admin.css\'s dead competing declarations', () => {
  // TKT-0049 proved `min-block-size` alone; TKT-0050 extended real computed-style evidence to the REST of
  // both rule blocks (box-sizing/resize/font/color/background/border/border-radius/padding) — every one of
  // them loses to `ui-textarea`'s own `@scope`-scoped `:scope { ... }` rule via the same scoping-proximity
  // cascade tiebreak, so agent-admin.css's competing declarations were removed as dead weight. This pins the
  // two properties whose LOSS was independently observable (not just coincidentally-identical-either-way):
  // padding (agent-admin.css declared two DIFFERENT literal values for entry-content vs entry-add-content;
  // both render identically off ui-textarea's own font-derived formula instead) and border-color (agent-
  // admin.css named a DIFFERENT role — --md-sys-color-neutral-outline-variant — than the one that actually
  // renders — --md-sys-color-neutral, ui-textarea's own idle border token).
  function expectedPadding(field: HTMLElement): { block: number; inline: number } {
    const fontSize = Number.parseFloat(getComputedStyle(field).fontSize)
    return { block: fontSize * 0.5, inline: fontSize * 0.75 } // textarea.css:49-50's formula
  }

  it('entry-content and entry-add-content render the SAME computed padding despite agent-admin.css declaring two different literal values for them (both dead)', () => {
    const { el } = mountAgentAdmin()
    const entryContent = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.tool}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const entryAddContent = section.querySelector('[data-part="entry-add-content"]') as HTMLElement

    for (const field of [entryContent, entryAddContent]) {
      const cs = getComputedStyle(field)
      const expected = expectedPadding(field)
      expect(Number.parseFloat(cs.paddingBlock)).toBeCloseTo(expected.block, 1)
      expect(Number.parseFloat(cs.paddingInline)).toBeCloseTo(expected.inline, 1)
    }
  })

  it('entry-content\'s idle border-color is ui-textarea\'s OWN --ui-textarea-border token, not agent-admin.css\'s --ui-agent-admin-border (a genuinely different role)', () => {
    const { el } = mountAgentAdmin()
    const entryContent = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement
    // component-reviewer MINOR fix: comparing a RAW custom-property string (e.g. an unresolved
    // `light-dark(...)` expression) against `borderColor`'s resolved `rgb()`/`oklch()` serialization can
    // never match either way — vacuously true regardless of which rule actually won. Resolve BOTH
    // candidate tokens the same way the browser does: apply each to a real scratch element's `border-color`
    // inside the SAME tree (so `light-dark()` picks up the identical colour-scheme context) and read back
    // ITS computed value — a genuine apples-to-apples comparison.
    function resolveBorderColor(token: string): string {
      // `--ui-textarea-border` is declared ON `:where(ui-textarea)` itself (textarea.css:34) — custom
      // properties inherit DOWNWARD only, so the probe must be a DESCENDANT of entryContent to see it (a
      // sibling/ancestor probe would resolve an unset token instead). ui-textarea only ever references its
      // editor/message parts by stored reference (never by children[] index or count — verified against
      // textarea.ts), so an extra light-DOM child is inert to its own logic; removed immediately after read.
      const probe = document.createElement('div')
      probe.style.borderStyle = 'solid'
      probe.style.borderColor = `var(${token})`
      entryContent.append(probe)
      const resolved = getComputedStyle(probe).borderColor
      probe.remove()
      return resolved
    }
    const renderedBorderColor = getComputedStyle(entryContent).borderColor
    expect(renderedBorderColor).toBe(resolveBorderColor('--ui-textarea-border'))
    expect(renderedBorderColor).not.toBe(resolveBorderColor('--ui-agent-admin-border'))
  })

  it('TKT-0059: entry-content/entry-add-content\'s ui-textarea renders the SAME font-size/border-color/border-radius as the settings pane\'s ui-text-field (Name field) — the reported mismatch does not reproduce', async () => {
    const { el } = mountAgentAdmin()
    const entryContent = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement

    const uiSettings = el.querySelector('[data-role="settings"] ui-settings') as HTMLElement & { updateComplete: Promise<void> }
    await uiSettings.updateComplete
    // drill-in default: the panel is empty until a rail item is activated (the settings.browser.test.ts
    // precedent) — the "Agent" section is the first/only rail item at this schema's version.
    ;(uiSettings.querySelector('ui-nav-rail-item') as HTMLElement).click()
    await uiSettings.updateComplete
    const nameField = el.querySelector('[data-role="settings"] ui-text-field[name="name"]') as HTMLElement
    expect(nameField).not.toBeNull()

    const textareaStyle = getComputedStyle(entryContent)
    const textFieldStyle = getComputedStyle(nameField)
    expect(textareaStyle.fontSize).toBe(textFieldStyle.fontSize)
    expect(textareaStyle.borderColor).toBe(textFieldStyle.borderColor)
    expect(textareaStyle.borderRadius).toBe(textFieldStyle.borderRadius)
  })

  it('the entry-content/entry-add-content :focus-visible rule never matches (focus lands on ui-textarea\'s internal editor, not the host) — dead by a DIFFERENT mechanism than the cascade-proximity loss above', () => {
    const { el } = mountAgentAdmin()
    const entryContent = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement
    entryContent.focus()
    expect(entryContent.matches(':focus-within')).toBe(true) // focus genuinely landed inside
    expect(entryContent.matches(':focus-visible')).toBe(false) // but never on the HOST itself
  })

  it('TKT-0060: entry-add-label/entry-add-description are now real <ui-text-field>s — the agent-admin.css bespoke rule is gone, and focus draws the CONTROL\'S OWN :focus-within outline ring instead (the same dead-by-different-mechanism story TKT-0050 already proved for entry-content)', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.tool}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const addLabel = section.querySelector('[data-part="entry-add-label"]') as HTMLElement
    expect(addLabel.tagName.toLowerCase()).toBe('ui-text-field')
    addLabel.focus()
    // Focus lands on the internal `[data-part="editor"]` part, not the host — :focus-visible never matches
    // the host (same mechanism as ui-textarea, TKT-0050), but :focus-within does, and text-field.css draws
    // its own outline ring off it.
    expect(addLabel.matches(':focus-visible')).toBe(false)
    expect(addLabel.matches(':focus-within')).toBe(true)
    const cs = getComputedStyle(addLabel)
    expect(cs.outlineStyle).toBe('solid')
    expect(Number.parseFloat(cs.outlineWidth)).toBeGreaterThan(0)
  })
})

describe('ui-agent-admin cross-engine smoke — TKT-0060: entry-add-form drops its native <form>/<input>/<button type="submit"> anatomy', () => {
  it('entry-add-form is a plain container (no native form-submission semantics to work around)', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    const form = section.querySelector('[data-part="entry-add-form"]') as HTMLElement
    expect(form.tagName.toLowerCase()).toBe('div')
  })

  it('entry-add-label/entry-add-description are real <ui-text-field>s, entry-add-submit is a real <ui-button>', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    expect((section.querySelector('[data-part="entry-add-label"]') as HTMLElement).tagName.toLowerCase()).toBe('ui-text-field')
    expect((section.querySelector('[data-part="entry-add-description"]') as HTMLElement).tagName.toLowerCase()).toBe('ui-text-field')
    expect((section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).tagName.toLowerCase()).toBe('ui-button')
  })

  it('a REAL keyboard Enter keydown in entry-add-label submits the form and adds the entry (not .requestSubmit() — the actual keyboard path a user drives)', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const labelField = section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement
    labelField.focus()
    labelField.value = 'Web search'
    // Dispatch on the internal editor part (the real caret-holding node, text-field.ts's own keydown
    // listener target) rather than the host — this is what actually exercises `ui-text-field`'s OWN
    // Enter-commit handler (text-field.ts:226-233) bubbling up to entry-list.ts's host-level listener,
    // the same path a real keystroke takes, not just a dispatch that happens to reach the host directly.
    const editor = labelField.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    const row = el.querySelector('[data-kind="skill"] [data-entry-id="web-search"]') as HTMLElement
    expect(row).not.toBeNull()
    const toggle = row.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }
    expect(toggle.checked).toBe(true)
    // the same reset-on-success behavior a click submit gets — proves the Enter path runs the SAME logic
    const form = section.querySelector('[data-part="entry-add-form"]') as HTMLElement
    expect(form.hidden).toBe(true)
  })

  it('Enter in entry-add-description does NOT submit (only the required single-line label field gets Enter-to-submit, matching what a native single-line required <input> would have done)', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const labelField = section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement
    const descriptionField = section.querySelector('[data-part="entry-add-description"]') as UITextFieldElement
    labelField.value = 'Web search'
    descriptionField.focus()
    const descriptionEditor = descriptionField.querySelector('[data-part="editor"]') as HTMLElement
    descriptionEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    expect(el.querySelector('[data-kind="skill"] [data-entry-id="web-search"]')).toBeNull()
    const form = section.querySelector('[data-part="entry-add-form"]') as HTMLElement
    expect(form.hidden).toBe(false) // still open — no submission happened
  })
})

describe('ui-agent-admin cross-engine smoke — the live-apply loop actually renders in a real turn (ADR-0131)', () => {
  it('editing a setting, then submitting, paints a reply bubble that visibly cites the new value', () => {
    const { el } = mountAgentAdmin()
    const store = el.store!
    store.set('name', 'Cross-engine Scout')

    const composer = el.querySelector('[data-role="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'ping' // the composer's own value prop (TKT-0058 — the nested field/form are gone)
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()

    const agentBubbles = el.querySelectorAll('[data-role="agent"]')
    expect(agentBubbles.length).toBeGreaterThan(0)
    const body = agentBubbles[agentBubbles.length - 1].querySelector('[data-part="body"]') as HTMLElement
    expect(body.textContent).toContain('Cross-engine Scout')
    // whole-shape: the bubble itself is a real, visible box, not a zero-size DOM stub
    const box = agentBubbles[agentBubbles.length - 1].getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})
