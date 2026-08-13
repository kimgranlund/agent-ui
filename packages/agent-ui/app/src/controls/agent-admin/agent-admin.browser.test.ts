import { describe, it, expect, afterEach } from 'vitest'

// The CROSS-ENGINE ui-agent-admin smoke (TKT-0039, ADR-0131; re-hosted GH #52/ADR-0154, then again by
// ADR-0179, then flattened onto a direct `ui-super-shell` composition by GH #700). jsdom cannot resolve
// CSS flex/@scope/container-query layout — this file is where the
// pane-nav geometry, the narrow one-place-at-a-time drill-in, and the wide Author⇄Settings pairing
// (the container-query narrow crossing) become TRUE in BOTH Chromium and WebKit (the master-detail
// .browser.test.ts precedent). CSS wiring: the foundation first, then
// `component-styles.css` (the family barrel carries ui-text-field/etc.'s shipped CSS), then every
// composed sibling's own CSS (incl. super-shell below), then this element's own.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css' // ADR-0139 — ui-code-editor's own sheet (the entry editors' frame + CM highlight tokens)
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-dialog.css' // ADR-0180 (GH #688) — the adopted-or-created log's own scroll/layout CSS, promoted off conversation.css
import '../conversation/conversation-composer.css' // TKT-0056 — the composed ui-conversation-composer's own layout/parts CSS
import '../surface-host/surface-host.css'
// GH #52/ADR-0154 — the re-host onto the shell-archetype grammar: super-shell's own CSS,
// replacing TKT-0085's <ui-tabs>/<ui-tab>/<ui-tab-panel> registration (no longer composed here at all).
// GH #700 flattened out the intermediate `ui-chat-shell` preset this element used to compose (and
// therefore no longer needs `../chat-shell/chat-shell.css` for) — `ui-super-shell` is composed directly.
import '../super-shell/super-shell.css'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import type { UICodeEditorElement } from '@agent-ui/code/editor'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
// Activates the Phosphor pack (TKT-0048) — without this, `ui-icon[glyph="plus"]` renders an EMPTY (but
// still correctly-sized) leading cell: `resolveIcon` against an inactive registry doesn't throw, so a
// typo'd `name` would silently ship past a suite that only checks the cell's box. `iconRenders()` below
// asserts a real `<path>` landed, not just a correctly-sized empty slot.
import '@agent-ui/icons/phosphor'
import { ENTRY_KINDS } from './entries.ts'
import { entriesStoreKey } from '../entry-list/entry-data.ts'
import { kindEnabledKey, A2UI_CATALOG_KEY, A2UI_CATALOG_OPTIONS, DEFAULT_A2UI_CATALOG_ID } from './agent-admin-schema.ts'
import { SURFACE_AUTHORING_KEY } from './agent-admin-schema.ts'
import { createMemoryStore } from '../settings/memory-store.ts'

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

/** GH #686's Amendment (LLD §16.2) retires the pane nav this helper used to drive by real click — the
 *  header bar that replaces it is S7-c's own build (a documented gap: no real pill/segment exists yet to
 *  click). Drives the visibility model's protected test seam instead — the SAME mechanism
 *  agent-admin.test.ts/agent-admin-authoring.test.ts already reach it through (`setPaneSeam`'s own
 *  successor, `setPaneVisibilitySeam`). Shows ALL THREE regions (so the target place paints regardless of
 *  band) and marks the requested one primary (so it paints SOLO below the triple line too) — the
 *  broadest-compatible single call for "make this place reachable" a real geometry probe needs. */
function goToPlace(el: HTMLElement, place: 'Chat' | 'Author' | 'Settings'): void {
  const pane = place === 'Chat' ? 'chat' : place === 'Author' ? 'copilot' : 'settings'
  ;(el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }).setPaneVisibilitySeam(
    ['chat', 'settings', 'copilot'],
    pane,
  )
}

/** GH #574 — Agent is the default active settings section; a caller reaching into another section's own
 *  content passes it here. GH #686's Amendment — the strip is the admin's own `settings-nav` inside the
 *  plain settings-pane sibling now (the pairing vehicle retired), and reaching ANY settings content still
 *  means the Settings region must actually be painting (below the triple line a non-primary region is
 *  `display:none`). An inactive section computes `display:none` in a real engine, so ITS content's own
 *  geometry (getBoundingClientRect, .focus()) reads zero/no-ops until its tab is selected — style-only
 *  reads (getComputedStyle of a cascade value like border-width/font-size) are unaffected either way and
 *  need no activation. */
function activateTab(el: HTMLElement, tab: 'Agent' | 'Capabilities' | 'Surface' | 'Context: System' | 'Context: Dialog'): void {
  goToPlace(el, 'Settings')
  const sectionTab = [...el.querySelectorAll('[data-part="settings-nav"] ui-tab')].find((t) => t.textContent === tab) as HTMLElement
  sectionTab.click()
}

/** GH #225 — the shared chrome every `settings-item` fold carries, regardless of which of the three
 *  ranked tabs (GH #574) hosts it: open by default (config is an editing surface), a real visibly-sized
 *  chevron on the heading row, and the ONE shared heading register (0.875rem/600 at the fleet's 16px
 *  root) the #222 Context probe pins the SAME live values against. */
function assertFoldChrome(item: HTMLElement & { open: boolean }): void {
  expect(item.open, `${item.getAttribute('data-item')} defaults open (config is an editing surface)`).toBe(true)
  const chevron = item.querySelector(':scope > [data-part="details"] > [data-part="summary"] > [data-part="chevron"]') as HTMLElement
  const box = chevron.getBoundingClientRect()
  expect(box.width, `${item.getAttribute('data-item')} chevron width`).toBeGreaterThan(0)
  expect(box.height, `${item.getAttribute('data-item')} chevron height`).toBeGreaterThan(0)
  const s = getComputedStyle(item.querySelector(':scope > [data-part="details"] > [data-part="summary"]') as HTMLElement)
  expect(s.fontSize, `${item.getAttribute('data-item')} register font`).toBe('14px')
  expect(s.fontWeight, `${item.getAttribute('data-item')} register weight`).toBe('600')
}

/** ADR-0179 — mounts land in the SETTINGS place by default. Nearly every probe in this file measures the
 *  settings region, which is `hidden` at the entry default (Chat, the pure test surface — cl.1's disjoint
 *  places); a probe that wants the Chat place calls `goToPlace(el, 'Chat')` explicitly, which is exactly
 *  the delta this IA introduces and the honest thing for a geometry suite to state out loud. */
/** `widthPx` (GH #662) exists for the place-EXCLUSIVITY probes: the default 1200 sits in the triple band,
 *  where all three places paint by contract, so a probe whose subject is "exactly one place has a box"
 *  mounts at `NARROW_BAND_WIDTH` instead — the same claim, in the band that still makes it. */
function mountAgentAdmin(tab: 'Agent' | 'Capabilities' | 'Surface' = 'Agent', widthPx = 1200): { wrapper: HTMLElement; el: UIAgentAdminElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = `${widthPx}px`
  wrapper.style.height = '600px'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto' // the master-detail.md/conversation.md "consumer-supplied block-size" precedent
  wrapper.style.display = 'flex'
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  activateTab(el, tab)
  return { wrapper, el }
}

/** GH #52/ADR-0154 — a mount whose OWN width drives ui-super-shell's real container query
 *  (`mountAgentAdmin()` above fixes 1200px on a flex-item host inside a sized wrapper; this widens that
 *  to an arbitrary width so both the wide and narrow bands are reachable with a REAL browser-measured
 *  resize, not a simulated one — TKT-0085's own ResizeObserver is gone with the shell it drove). */
/** Two CSS px below the 52.5rem triple line's own mount (840 holder + 24 gutter) — the widest frame at
 *  which exactly one place still paints (the `data-primary` region, solo), and therefore the honest home
 *  for every place-exclusivity probe written before GH #662 widened the wide band (renamed from the
 *  retired `PAIR_BAND_WIDTH` — GH #686's Amendment retires the "pair" concept along with the MD vehicle;
 *  the narrow band itself, and the 52.5rem line, are unchanged). */
const NARROW_BAND_WIDTH = 862

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

describe('ui-agent-admin cross-engine smoke — the three-place shell grammar (GH #686\'s Amendment: shown-set visibility, no pairing vehicle)', () => {
  // GH #686's Amendment (LLD §16.1/§16.3/§16.4, S7-c) — the pane nav retired with the visibility model it
  // drove; the unified header bar that replaces it is a real, admin-composed box now, at EVERY band —
  // `ui-super-shell` only CREATES the `[data-part='bar'][data-bar='header']` box when at least one
  // `data-slot="header"` child is authored (super-shell.ts's own guard), and `#composeHeader` authors
  // exactly one (LLD §16.1's `admin-header`), so the box exists unconditionally from first connect.
  it('the header bar box exists at every band, and paints the right pane-visibility/actions rendering for its own width (LLD §16.1/§16.3 — pills⇄segments, wide⇄narrow actions)', async () => {
    // The header's own band line (agent-admin.css's own comment): the composed ui-super-shell's inline-size
    // is always the pane holder's 52.5rem line PLUS one shell-gutter on each side — 54rem (864px) here
    // fires at the IDENTICAL real pixel moment the holder's own 52.5rem (840px) does.
    for (const [width, band] of [[700, 'narrow'], [900, 'wide'], [1200, 'wide']] as const) {
      const { el, wrapper } = mountAgentAdminAt(width)
      // Register the New Agent seam so its own unregistered-hide degrade cannot be confused with the
      // band's own hide — the assertions below need to isolate the BAND rule, and an unregistered button
      // is `display:none` at every band regardless (LLD §16.3's own degrade).
      el.onNewAgentRequest(() => {})
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const header = el.querySelector('[data-slot="header"]') as HTMLElement
      expect(header, `width ${width}: the admin-composed header exists`).not.toBeNull()
      const bar = el.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
      expect(bar, `width ${width}: super-shell creates the header bar box`).not.toBeNull()
      expect(bar.getBoundingClientRect().height, `width ${width}: the bar box has real height`).toBeGreaterThan(0)

      const pills = el.querySelector('[data-part="pane-pills"]') as HTMLElement
      const segments = el.querySelector('[data-part="pane-segments"]') as HTMLElement
      const newAgentWide = el.querySelector('[data-part="new-agent-wide"]') as HTMLElement
      const newAgentNarrow = el.querySelector('[data-part="new-agent-narrow"]') as HTMLElement
      if (band === 'narrow') {
        expect(getComputedStyle(pills).display, `width ${width}: pills hidden narrow`).toBe('none')
        expect(getComputedStyle(segments).display, `width ${width}: segments paint narrow`).not.toBe('none')
        expect(getComputedStyle(newAgentWide).display, `width ${width}: wide actions hidden narrow`).toBe('none')
      } else {
        expect(getComputedStyle(pills).display, `width ${width}: pills paint wide`).not.toBe('none')
        expect(getComputedStyle(segments).display, `width ${width}: segments hidden wide`).toBe('none')
        expect(getComputedStyle(newAgentNarrow).display, `width ${width}: narrow actions hidden wide`).toBe('none')
      }
      wrapper.remove()
    }
    // cl.1 — the six-entry narrow-tabs vocabulary dissolved with the options-pane it enumerated, well before
    // this slice; still true here.
    const { el } = mountAgentAdminAt(700)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(el.querySelector('[data-part="narrow-tabs"]'), 'the shell composes no narrow-tabs strip any more').toBeNull()
    expect(el.querySelector('[data-slot-name="options-pane"]'), 'nothing occupies the end side any more').toBeNull()
  })

  // S7-c's own header inset rhythm — re-anchored from the retired pane-nav bar (this describe's own
  // banner note: "no real affordance survives to re-target these probes onto until S7-c lands"). GH #626's
  // bar-content law says the header supplies its OWN inline inset (the bar itself is padding-less); this
  // consumer deliberately reads `--ui-agent-admin-shell-gutter` (agent-admin.css's own comment on the
  // rule) rather than the fleet's generic `--ui-bar-inline-inset` default, so the header's zones land on
  // the SAME screen-x column as the canvas/pane content directly beneath them — measured here, both
  // engines, at both bands (a band crossing changes which pane-visibility control paints, never the
  // header's own inset).
  it('header inset rhythm: the header content lands on the SAME screen-x as the canvas/pane-holder content below it', async () => {
    for (const width of [700, 1200]) {
      const { el, wrapper } = mountAgentAdminAt(width)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      // The honest pair: `admin-header`'s own FIRST CHILD (a real content box, inset by the header's own
      // padding) against `pane-holder` (the canvas's content, inset by the canvas's own padding) — NOT
      // `admin-header` itself, whose bounding rect is the OUTER, unpadded border-box (comparing it
      // against the padded `pane-holder` would just measure the header's own padding back at itself, a
      // guaranteed-nonzero artifact of the wrong pair, not a real misalignment).
      const header = el.querySelector('[data-part="admin-header"]') as HTMLElement
      const agentSelect = el.querySelector('[data-part="agent-select"]') as HTMLElement
      const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
      expect(header.getBoundingClientRect().width, `width ${width}: the header genuinely renders`).toBeGreaterThan(0)
      expect(
        Math.abs(agentSelect.getBoundingClientRect().x - holder.getBoundingClientRect().x),
        `width ${width}: the header's own inline inset matches the pane holder's, one rhythm not two`,
      ).toBeLessThanOrEqual(1)
      wrapper.remove()
    }
  })

  it('at wide, the entry default paints all three regions side by side, in reading order, top-aligned (LLD §16.1/§16.2 — no pairing vehicle any more)', async () => {
    const { el } = mountAgentAdminAt(1200)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const chat = (el.querySelector('[data-part="chat-pane"]') as HTMLElement).getBoundingClientRect()
    const settings = (el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect()
    const copilot = (el.querySelector('[data-part="copilot-pane"]') as HTMLElement).getBoundingClientRect()
    for (const box of [chat, settings, copilot]) {
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }
    // PANE_ORDER's own reading order: chat, then settings, then copilot — never a runtime reparent, no
    // pairing vehicle to arrange two of the three specially.
    expect(chat.right, 'chat is start-side of settings').toBeLessThanOrEqual(settings.left + 1)
    expect(settings.right, 'settings is start-side of copilot').toBeLessThanOrEqual(copilot.left + 1)
    expect(Math.abs(chat.top - settings.top), 'displacement is on the INLINE axis only').toBeLessThanOrEqual(1)
    expect(Math.abs(settings.top - copilot.top), 'displacement is on the INLINE axis only').toBeLessThanOrEqual(1)
  })

  // GH #662's original claim, generalized by GH #686's Amendment: BELOW the triple line exactly the
  // `data-primary` region paints, alone — regardless of which regions the shown SET also names (the sheet
  // reads `data-primary` at this band, never `data-show`).
  it('below the triple line, exactly the PRIMARY region renders SOLO — the other two contribute zero box (LLD §16.2)', async () => {
    const { el } = mountAgentAdminAt(NARROW_BAND_WIDTH)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    goToPlace(el, 'Chat')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const conversation = el.querySelector('[data-part="chat-pane"]') as HTMLElement
    const settings = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const copilot = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const canvas = (el.querySelector('[data-part="canvas"]') as HTMLElement).getBoundingClientRect()
    const chat = conversation.getBoundingClientRect()
    expect(getComputedStyle(settings).display, 'the non-primary regions contribute no box').toBe('none')
    expect(getComputedStyle(copilot).display).toBe('none')
    expect(settings.getBoundingClientRect().width).toBe(0)
    expect(copilot.getBoundingClientRect().width).toBe(0)
    // whole-shape assert: the conversation card fills the canvas it now has to itself
    expect(chat.width).toBeGreaterThan(0)
    expect(Math.abs(chat.width - (canvas.width - 2 * parseFloat(getComputedStyle(el.querySelector('[data-part="canvas"]') as HTMLElement).paddingLeft)))).toBeLessThanOrEqual(1)
  })

  it('GH #161 — the settings sub-nav renders a real, non-zero strip; clicking each Context section switches to its OWN distinct content, no cross-section leakage', async () => {
    const { el } = mountAgentAdminAt(800)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    expect(pane.getBoundingClientRect().width).toBeGreaterThan(0)
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')]
    expect(tabs.map((t) => t.textContent)).toEqual(['Agent', 'Capabilities', 'Surface', 'Context: System', 'Context: Dialog'])
    // LLD-P6 (GH #656) — the strip runs `overflow="menu"` now, so a tab that doesn't fit this rail is
    // `[data-overflowed]` (display:none) and reachable through the menu instead. The claim this probe was
    // always making — no tab is a collapsed zero-box stub — is repointed onto the ones actually laid out;
    // the reachability of the rest is the LLD-P6 a6 probe's own subject, at both bands.
    const laidOut = tabs.filter((t) => !t.hasAttribute('data-overflowed'))
    expect(laidOut.length, 'at least the selected tab is always pinned onto the strip').toBeGreaterThan(0)
    for (const tab of laidOut) expect(tab.getBoundingClientRect().width).toBeGreaterThan(0)
    // Agent is the default active section (GH #574) — the Agent fold's heading row renders visibly
    // (GH #225: the old agent-heading h3 is the fold summary now).
    const agentHeading = el.querySelector('[data-part="settings-item"][data-item="agent"] [data-part="summary"]') as HTMLElement
    expect(agentHeading.getBoundingClientRect().width).toBeGreaterThan(0)

    // Clicking Context: System switches to a real, visible section carrying ONLY the System context sections.
    const systemTab = tabs.find((t) => t.textContent === 'Context: System') as HTMLElement
    systemTab.click()
    await new Promise((r) => requestAnimationFrame(r))
    const systemContent = pane.querySelector('[data-role="context-system-content"]') as HTMLElement
    expect(systemContent.hidden).toBe(false)
    expect(systemContent.getBoundingClientRect().width).toBeGreaterThan(0)
    // The Agent System JSON preview is a real, visible mono block with the compiled config in it.
    const agentJson = systemContent.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]') as HTMLElement
    expect(agentJson.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(agentJson.textContent).toContain('systemPrompt')
    // Distinct content: the System section carries NO Dialog Turns part.
    expect(systemContent.querySelector('[data-part="context-turns"]')).toBeNull()

    // Clicking Context: Dialog switches to a DIFFERENT, real, visible section carrying ONLY Dialog Turns.
    const dialogTab = tabs.find((t) => t.textContent === 'Context: Dialog') as HTMLElement
    dialogTab.click()
    await new Promise((r) => requestAnimationFrame(r))
    const dialogContent = pane.querySelector('[data-role="context-dialog-content"]') as HTMLElement
    expect(dialogContent.hidden).toBe(false)
    expect(dialogContent.getBoundingClientRect().width).toBeGreaterThan(0)
    // The System section (now inactive) is a DIFFERENT node than Dialog, and it's hidden again.
    expect(systemContent).not.toBe(dialogContent)
    expect(systemContent.hidden).toBe(true)
    // Distinct content: the Dialog section carries NO Agent System items.
    expect(dialogContent.querySelector('[data-part="context-item"]')).toBeNull()
  })

  it('GH #222: each Context section is FLAT — Settings-register heading rows + exactly ONE card-styled container on the content card\'s ancestor chain (no card-in-card)', async () => {
    const { el } = mountAgentAdminAt(900)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // Capture the LIVE Settings heading register FIRST (Agent is the default active section).
    // GH #225: the register's live source is a Settings fold's summary row now (the old plain
    // model-grid-heading h3 retired with the Settings accordions) — the probe's claim is unchanged:
    // the Context flavors must match the Settings flavor, the register must not fork.
    const headingRef = getComputedStyle(el.querySelector('[data-part="settings-item"][data-item="model"] > [data-part="details"] > [data-part="summary"]') as HTMLElement)
    const wantFont = { size: headingRef.fontSize, weight: headingRef.fontWeight, color: headingRef.color }

    // Log ONE stub turn so Context: Dialog has real content (the stub arm logs like every arm). ADR-0179 —
    // the composer lives in the Chat PLACE now, so the turn is driven from there and the probe returns.
    goToPlace(el, 'Chat')
    const composer = el.querySelector('[data-part="chat-pane"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'hello'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    const start = Date.now()
    while (el.querySelectorAll('[data-part="context-turn"]').length === 0) {
      if (Date.now() - start > 8000) throw new Error('stub turn never logged')
      await new Promise((r) => setTimeout(r, 50))
    }
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]
    /** The file's own card recipe — a real 1px solid border (model-grid/surface-row/entry/context-json). */
    const isCarded = (n: Element): boolean => {
      const s = getComputedStyle(n)
      return s.borderTopStyle === 'solid' && parseFloat(s.borderTopWidth) > 0
    }

    for (const { label, role, jsonSelector } of [
      { label: 'Context: System', role: 'context-system-content', jsonSelector: '[data-part="context-item"][data-item="agent"] [data-part="context-json"]' },
      { label: 'Context: Dialog', role: 'context-dialog-content', jsonSelector: '[data-part="context-turn"] [data-part="context-json"]' },
    ]) {
      ;(tabs.find((t) => t.textContent === label) as HTMLElement).click()
      await new Promise((r) => requestAnimationFrame(r))
      const segment = pane.querySelector(`[data-role="${role}"]`) as HTMLElement
      expect(segment.hidden).toBe(false)
      const json = segment.querySelector(jsonSelector) as HTMLElement
      expect(json.getBoundingClientRect().height).toBeGreaterThan(0)
      // The flattening law (GH #222): walking from the content card up to the segment container,
      // exactly ONE element is card-styled — the JSON card itself. No card-in-card.
      const chain: Element[] = []
      for (let n: Element | null = json; n !== null && n !== segment; n = n.parentElement) chain.push(n)
      const carded = chain.filter(isCarded)
      expect(carded, `${label}: exactly one card-styled container on the content chain`).toHaveLength(1)
      expect(carded[0]).toBe(json)
      // The section heading matches the Settings segment's heading register (font/weight/ink).
      const summary = json.closest('[data-part="context-item"], [data-part="context-turn"]')!.querySelector('[data-part="summary"]') as HTMLElement
      const s = getComputedStyle(summary)
      expect(s.fontSize).toBe(wantFont.size)
      expect(s.fontWeight).toBe(wantFont.weight)
      expect(s.color).toBe(wantFont.color)
    }
  })

  it('narrow (<640px): the visibility model drives a one-place-at-a-time surface — exactly one region has geometry per selection (LLD §16.2/OQ3)', async () => {
    const { el } = mountAgentAdminAt(500)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const widthsOf = (): [number, number, number] => [
      (el.querySelector('[data-part="chat-pane"]') as HTMLElement).getBoundingClientRect().width,
      (el.querySelector('[data-part="copilot-pane"]') as HTMLElement).getBoundingClientRect().width,
      (el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect().width,
    ]
    const oneVisible = (widths: [number, number, number], index: 0 | 1 | 2): void => {
      widths.forEach((w, i) => {
        if (i === index) expect(w, `region ${i} should own the surface`).toBeGreaterThan(0)
        else expect(w, `region ${i} should contribute no box`).toBe(0)
      })
    }

    // Chat — the composer is reachable with real, non-zero geometry.
    goToPlace(el, 'Chat')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    oneVisible(widthsOf(), 0)
    expect((el.querySelector('[data-part="chat-pane"] ui-conversation-composer') as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(0)

    // Author — the drill-in shows the `list` side alone.
    goToPlace(el, 'Author')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    oneVisible(widthsOf(), 1)

    // Settings — the drill-in shows the `detail` side alone, full-surface (the narrow home the shell
    // grammar had no state for), and each Context section still switches to its own distinct content.
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    oneVisible(widthsOf(), 2)
    const sectionTabs = [...el.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]
    ;(sectionTabs.find((t) => t.textContent === 'Context: System') as HTMLElement).click()
    await new Promise((r) => requestAnimationFrame(r))
    const systemContent = el.querySelector('[data-role="context-system-content"]') as HTMLElement
    expect(systemContent.hidden).toBe(false)
    expect(systemContent.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(systemContent.querySelector('[data-part="context-turns"]')).toBeNull()

    ;(sectionTabs.find((t) => t.textContent === 'Context: Dialog') as HTMLElement).click()
    await new Promise((r) => requestAnimationFrame(r))
    const dialogContent = el.querySelector('[data-role="context-dialog-content"]') as HTMLElement
    expect(dialogContent.hidden).toBe(false)
    expect(dialogContent.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(systemContent).not.toBe(dialogContent)
    expect(dialogContent.querySelector('[data-part="context-item"]')).toBeNull()
  })

  it('no top-level back affordance exists any more — the pairing vehicle it belonged to retired (LLD §16.5)', async () => {
    const { el } = mountAgentAdminAt(500)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    // `ui-settings` still composes its OWN unrelated rail|panel `ui-master-detail` (settings.ts) with its
    // own back affordance for ITS narrow drill-in — untouched by this slice — so the scope here is the
    // TOP-LEVEL one only: a direct child of the pane holder's own settings region.
    expect(el.querySelector('[data-part="settings-pane"] > [data-part="back"]'), 'no back affordance at the top level').toBeNull()
    expect(el.querySelector('[data-part="pane-pair"]'), 'the pairing vehicle itself is gone').toBeNull()
  })

  /** Opens a real A2UI surface (a Hit button) in the mounted conversation, returns it + the conversation. */
  async function openLiveSurface(el: UIAgentAdminElement): Promise<{ conversation: HTMLElement }> {
    const conversation = el.querySelector('[data-part="chat-pane"]') as HTMLElement & {
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

  it('regression pin (unchanged intent, simpler now): a live surface SURVIVES a 1200→800 resize — nothing ever reparents at all anymore', async () => {
    const { el, wrapper } = mountAgentAdminAt(1200)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const { conversation } = await openLiveSurface(el)

    wrapper.style.width = '800px' // still wide — nothing may move
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    expect(el.querySelector('[data-part="chat-pane"]'), 'the chat region should still be there — same node identity').toBe(conversation)
    expect(conversation.querySelector('[data-state="closed"]'), 'the surface closed on a same-band resize — it should have stayed open').toBeNull()
    expect(conversation.querySelector('ui-surface-host ui-button'), 'the rendered surface content should still be there').not.toBeNull()
  })

  it('ADR-0154 cl.4 (the ratified behavior UPGRADE): a live surface SURVIVES a crossing INTO narrow — no more "Closed." on a real width crossing', async () => {
    const { el, wrapper } = mountAgentAdminAt(1200)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const { conversation } = await openLiveSurface(el)

    wrapper.style.width = '500px' // real browser resize → the real container query crosses into narrow
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // Assert the layout ACTUALLY reached narrow (the component-reviewer MAJOR-fix discipline this pin
    // preserves) — GH #686's Amendment re-anchors the evidence onto the visibility model's own narrow
    // truth: below the triple line, the `data-primary` region (Settings) shows ALONE.
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect((el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect().width, 'did not actually reach narrow').toBeGreaterThan(0)
    expect((el.querySelector('[data-part="copilot-pane"]') as HTMLElement).getBoundingClientRect().width, 'both regions painted — still wide').toBe(0)

    // The upgrade itself (SPEC-R7c's survival law, ADR-0154's ratified behavior delta): the surface is
    // NEVER reparented crossing into narrow — it stays open, un-cycled, no "Closed." annotation anywhere.
    expect(conversation.querySelector('[data-state="closed"]'), 'the surface should NOT have closed — R7c is visibility-only').toBeNull()
    expect(conversation.querySelector('ui-surface-host ui-button'), 'the rendered surface content survives the crossing').not.toBeNull()

    // A full place round-trip (Settings → Author → Chat) leaves it exactly as un-cycled.
    goToPlace(el, 'Author')
    await new Promise((r) => requestAnimationFrame(r))
    goToPlace(el, 'Chat')
    await new Promise((r) => requestAnimationFrame(r))
    expect(conversation.querySelector('[data-state="closed"]'), 'a full tab round-trip should not close the surface either').toBeNull()
    expect(conversation.querySelector('ui-surface-host ui-button')).not.toBeNull()
  })
})

describe('ui-agent-admin cross-engine smoke — the settings region renders (GH #686\'s Amendment, no pairing vehicle)', () => {
  it('the settings region occupies a real, non-zero box', () => {
    const { el } = mountAgentAdmin('Agent', 700)
    const region = (el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect()
    expect(region.width).toBeGreaterThan(0)
    expect(region.height).toBeGreaterThan(0)
  })

  it('a seeded prompt-section entry\'s content field is visibly focusable and legible (a real element, not display:none)', () => {
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Instructions rides the Capabilities tab now
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
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Instructions rides the Capabilities tab now
    const toggle = el.querySelector('[data-entry-id="foundation"] [data-part="entry-toggle"]') as HTMLElement
    expect(toggle.tagName.toLowerCase()).toBe('ui-switch')
    const box = toggle.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })

  it('GH #574: the Capabilities and Surface tabs together render all SEVEN sections (Catalogs + Instructions + Skills/Workflows/Resources/Tools/Pattern sources), each a real non-zero box once its own tab is active — GH #488 nests Catalogs inside Surface Options, still leading the Surface tab', async () => {
    const { el } = mountAgentAdmin()
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]

    tabs.find((t) => t.textContent === 'Capabilities')!.click()
    await new Promise((r) => requestAnimationFrame(r))
    const capabilities = el.querySelector('[data-role="capabilities-content"]') as HTMLElement
    const capabilitiesSections = [...capabilities.querySelectorAll('[data-part="entry-section"]')]
    expect(capabilitiesSections.map((s) => s.getAttribute('data-kind'))).toEqual([
      ENTRY_KINDS.promptSection,
      ENTRY_KINDS.skill,
      ENTRY_KINDS.workflow,
      ENTRY_KINDS.resource,
      ENTRY_KINDS.tool,
    ])
    for (const section of capabilitiesSections) {
      const box = section.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }

    tabs.find((t) => t.textContent === 'Surface')!.click()
    await new Promise((r) => requestAnimationFrame(r))
    const surface = el.querySelector('[data-role="surface-content"]') as HTMLElement
    const surfaceSections = [...surface.querySelectorAll('[data-part="entry-section"]')]
    expect(surfaceSections.map((s) => s.getAttribute('data-kind'))).toEqual([ENTRY_KINDS.catalog, ENTRY_KINDS.patternSource])
    for (const section of surfaceSections) {
      const box = section.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }
  })
})

// ── GH #850 / capability-availability-tagging.spec.md SPEC-R2 — the availability affordance, COMPOSED ────
// entry-list.browser.test.ts proves the marker paints in a standalone mount; this proves it survives the
// REAL composition, where `agent-admin.css` (which `@import`s entry-list.css) and the whole shell cascade
// are also live — the environment a user actually looks at. Style-only reads need no tab activation (this
// file's own `activateTab` note), but the pill's BOX does, so the probe activates Capabilities.

describe('ui-agent-admin cross-engine smoke — the per-entry availability affordance (GH #850/SPEC-R2)', () => {
  /** A capability entry pair — one ambient, one user-invocable — seeded straight into a fresh store. */
  function mountWithSeededSkills(): UIAgentAdminElement {
    const wrapper = document.createElement('div')
    wrapper.style.width = '1200px'
    wrapper.style.height = '600px'
    wrapper.style.display = 'flex'
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.style.flex = '1 1 auto'
    el.store = createMemoryStore({
      initial: {
        [entriesStoreKey(ENTRY_KINDS.skill)]: [
          { id: 'house-style', kind: ENTRY_KINDS.skill, label: 'House style', description: 'The voice.', content: 'Be brief.', order: 0, enabled: true, builtin: false },
          { id: 'menu-pdf', kind: ENTRY_KINDS.skill, label: 'Menu PDF', description: 'The menu.', content: 'Starters.', order: 1, enabled: true, builtin: false, availability: 'invocable' },
        ],
      },
    })
    wrapper.append(el)
    document.body.append(wrapper)
    mounted.push(wrapper)
    activateTab(el, 'Capabilities')
    return el
  }

  it('the invocable row is visibly MARKED next to its ambient sibling, and its mode pill is a real hittable box', () => {
    const el = mountWithSeededSkills()
    const rowOf = (id: string): HTMLElement =>
      el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.skill}"] [data-entry-id="${id}"]`) as HTMLElement

    const ambient = getComputedStyle(rowOf('house-style'))
    const invocable = getComputedStyle(rowOf('menu-pdf'))
    expect(Number.parseFloat(ambient.borderInlineStartWidth), 'anti-vacuous: both cards paint a real edge').toBeGreaterThan(0)
    expect(Number.parseFloat(invocable.borderInlineStartWidth), 'the marked row reads different at a glance').toBeGreaterThan(
      Number.parseFloat(ambient.borderInlineStartWidth),
    )
    expect(invocable.borderInlineStartColor).not.toBe(ambient.borderInlineStartColor)

    // The mode control itself — a real ui-toggle with a real box, on BOTH rows (the mode is editable either
    // way), pressed on the invocable one only.
    for (const id of ['house-style', 'menu-pdf']) {
      const pill = rowOf(id).querySelector('[data-part="entry-availability"]') as HTMLElement & { pressed: boolean }
      expect(pill.tagName.toLowerCase()).toBe('ui-toggle')
      const box = pill.getBoundingClientRect()
      expect(box.width, `${id} pill width`).toBeGreaterThan(0)
      expect(box.height, `${id} pill height`).toBeGreaterThan(0)
      expect(pill.pressed, `${id} pressed state`).toBe(id === 'menu-pdf')
    }

    // …and the whole row is still a full card, not squeezed by the added control.
    const rowBox = rowOf('menu-pdf').getBoundingClientRect()
    expect(rowBox.height).toBeGreaterThan(20)
    expect(rowBox.width).toBeGreaterThan(200)
  })
})

// ── ADR-0170 (LLD-C7f) — the Catalogs section in a REAL engine ─────────────────────────────────────────
// jsdom proves the write semantics; only a real engine proves the section is a legible, non-collapsed row
// with a real switch, and that the mirror that replaced the `<ui-select>` actually PAINTS beside the A2UI
// toggle (a zero-box or invisible mirror would pass every jsdom probe while showing the user nothing).

describe('ui-agent-admin cross-engine smoke — the Catalogs library section (ADR-0170)', () => {
  it('renders the ensured Default row as a real, non-zero row: a visible switch, a legible label, and NO content editor', () => {
    const { el } = mountAgentAdmin('Surface') // GH #574 — Catalogs (nested in Surface Options) rides the Surface tab
    const section = el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`) as HTMLElement
    const rows = [...section.querySelectorAll('[data-part="entry"]')]
    expect(rows).toHaveLength(1)

    const row = rows[0] as HTMLElement
    const rowBox = row.getBoundingClientRect()
    expect(rowBox.width).toBeGreaterThan(0)
    expect(rowBox.height).toBeGreaterThan(0)

    const toggle = row.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }
    const toggleBox = toggle.getBoundingClientRect()
    expect(toggleBox.width, 'a real painted switch, not a collapsed stub').toBeGreaterThan(0)
    expect(toggleBox.height).toBeGreaterThan(0)
    expect(toggle.checked, 'the default catalog is the selection on a fresh store').toBe(true)

    const label = row.querySelector('[data-part="entry-label"]') as HTMLElement
    expect(label.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(getComputedStyle(label).visibility).toBe('visible')

    // ADR-0170 cl.8 — the suppressions, measured rather than assumed: no editor, no authoring form.
    expect(row.querySelector('[data-part="entry-content"]')).toBeNull()
    expect(section.querySelector('[data-part="entry-add-form"]')).toBeNull()
    expect(section.querySelector('[data-part="entry-add-toggle"]')).toBeNull()
  })

  // GH #488 — the picker moves INTO Surface Options, directly adjacent to the A2UI row (one visual
  // cluster: the toggle + its own catalog choice). Measured, not just structural: the section's real
  // painted top sits between the A2UI row's bottom and the GenUI row's top, inside the SAME Surface
  // Options card, never floated off to a separate later section.
  it('the catalog section paints directly BELOW the A2UI row and ABOVE the GenUI row, inside the Surface Options card', () => {
    const { el } = mountAgentAdmin('Surface') // GH #574 — Surface Options rides its own tab now
    const surfaceOptions = el.querySelector('[data-part="surface-options"]') as HTMLElement
    const a2uiRow = el.querySelector('[data-part="surface-row"][data-surface="a2ui"]') as HTMLElement
    const genuiRow = el.querySelector('[data-part="surface-row"][data-surface="genui"]') as HTMLElement
    const section = el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`) as HTMLElement

    expect(surfaceOptions.contains(section), 'the picker is a descendant of the Surface Options card').toBe(true)

    const a2uiBox = a2uiRow.getBoundingClientRect()
    const genuiBox = genuiRow.getBoundingClientRect()
    const sectionBox = section.getBoundingClientRect()
    expect(sectionBox.height, 'a real, non-zero painted box').toBeGreaterThan(0)
    expect(sectionBox.top, 'below the A2UI row it configures').toBeGreaterThanOrEqual(Math.round(a2uiBox.bottom) - 1)
    expect(sectionBox.bottom, 'above the GenUI row — never past it').toBeLessThanOrEqual(Math.round(genuiBox.top) + 1)
  })

  // GH #541 — the nesting must be REAL INK, not just DOM ancestry: a first-time reader tells a child
  // from a sibling by the indent, so the detail zone's left edge is measured against the row's own.
  it('the A2UI detail zone paints INDENTED under its modality row, inside one shared group card', () => {
    const { el } = mountAgentAdmin('Surface') // GH #574 — Surface Options rides its own tab now
    const group = el.querySelector('[data-part="surface-group"][data-surface="a2ui"]') as HTMLElement
    const a2uiRow = el.querySelector('[data-part="surface-row"][data-surface="a2ui"]') as HTMLElement
    const detail = group.querySelector('[data-part="surface-detail"]') as HTMLElement

    const groupBox = group.getBoundingClientRect()
    const rowBox = a2uiRow.getBoundingClientRect()
    const detailBox = detail.getBoundingClientRect()

    expect(detailBox.height, 'a real, non-zero painted box').toBeGreaterThan(0)
    expect(detailBox.left, 'indented past the modality row it belongs to').toBeGreaterThan(rowBox.left)
    expect(detailBox.top, 'below that row').toBeGreaterThanOrEqual(Math.round(rowBox.bottom) - 1)
    // Both inside ONE card — the group carries the chrome; the row inside it carries none of its own.
    expect(Math.round(detailBox.bottom)).toBeLessThanOrEqual(Math.round(groupBox.bottom))
    expect(getComputedStyle(group).borderTopWidth, 'the group is the card').toBe('1px')
    expect(getComputedStyle(a2uiRow).borderTopWidth, 'the row inside it is not a card-in-card').toBe('0px')
  })

  // GH #541 — the GenUI sub-option left the modality row: one toggle scope per row.
  it('the GenUI dogfood sub-option paints as a nested detail row, not a second toggle in the GenUI row', () => {
    const { el } = mountAgentAdmin('Surface') // GH #574 — Surface Options rides its own tab now
    const genuiRow = el.querySelector('[data-part="surface-row"][data-surface="genui"]') as HTMLElement
    const dogfoodRow = el.querySelector('[data-part="surface-detail-row"][data-detail="genui-dogfood"]') as HTMLElement

    expect(genuiRow.contains(dogfoodRow), 'out of the modality row entirely').toBe(false)
    expect(genuiRow.querySelectorAll('ui-switch')).toHaveLength(1)

    const rowBox = genuiRow.getBoundingClientRect()
    const dogfoodBox = dogfoodRow.getBoundingClientRect()
    expect(dogfoodBox.height).toBeGreaterThan(0)
    expect(dogfoodBox.left, 'indented under the modality it configures').toBeGreaterThan(rowBox.left)
    expect(dogfoodBox.top).toBeGreaterThanOrEqual(Math.round(rowBox.bottom) - 1)
  })

  // ADR-0174 cl.1 / OF3 (ruled) — the Planner row: a real, visibly painted bare row directly BELOW the
  // GenUI group (Kim's placement call, "beside the GenUI row"), never a collapsed/zero-box stub.
  it('the Planner row paints as a real, non-zero row directly below the GenUI group, with no group/detail chrome of its own', () => {
    const { el } = mountAgentAdmin('Surface') // GH #574 — Surface Options rides its own tab now
    const genuiGroup = el.querySelector('[data-part="surface-group"][data-surface="genui"]') as HTMLElement
    const plannerRow = el.querySelector('[data-part="surface-row"][data-surface="planner"]') as HTMLElement

    const rowBox = plannerRow.getBoundingClientRect()
    expect(rowBox.width, 'a real painted row, not a collapsed stub').toBeGreaterThan(0)
    expect(rowBox.height).toBeGreaterThan(0)
    expect(rowBox.top, 'below the GenUI group it sits beside').toBeGreaterThanOrEqual(Math.round(genuiGroup.getBoundingClientRect().bottom) - 1)

    const toggle = plannerRow.querySelector('[data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    const toggleBox = toggle.getBoundingClientRect()
    expect(toggleBox.width, 'a real painted switch').toBeGreaterThan(0)
    expect(toggleBox.height).toBeGreaterThan(0)
    expect(toggle.checked, 'fail-closed default OFF').toBe(false)

    const label = plannerRow.querySelector('[data-part="surface-label"]') as HTMLElement
    expect(label.textContent).toBe('Planner')
    expect(getComputedStyle(label).visibility).toBe('visible')

    // No group/detail zone — this modality has no sub-options yet.
    expect(plannerRow.closest('[data-part="surface-group"]'), 'a bare row, the markdown precedent').toBeNull()
  })

  it('flipping a catalog switch in a real engine moves the selection, radio-style', async () => {
    const { el } = mountAgentAdmin()
    const second = A2UI_CATALOG_OPTIONS.find((o) => o.id !== DEFAULT_A2UI_CATALOG_ID)!
    el.store!.set(entriesStoreKey(ENTRY_KINDS.catalog), [
      { id: second.id, kind: ENTRY_KINDS.catalog, label: second.label, description: '', content: '', order: 0, enabled: false, builtin: false },
    ])
    await el.updateComplete

    const section = el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`) as HTMLElement
    const toggleFor = (id: string): HTMLElement & { checked: boolean } =>
      section.querySelector(`[data-part="entry"][data-entry-id="${id}"] [data-part="entry-toggle"]`) as HTMLElement & { checked: boolean }
    expect(toggleFor(DEFAULT_A2UI_CATALOG_ID).checked).toBe(true)
    toggleFor(second.id).checked = true
    toggleFor(second.id).dispatchEvent(new Event('change'))
    await el.updateComplete

    expect(el.store!.get(A2UI_CATALOG_KEY)).toBe(second.id)
    expect(toggleFor(second.id).checked, 'the picked row').toBe(true)
    expect(toggleFor(DEFAULT_A2UI_CATALOG_ID).checked, 'and the sibling switched itself off — radio semantics in real paint').toBe(false)
  })
})

describe('ui-agent-admin cross-engine smoke — canvas/region gutter is module-derived, not a silently-defeatable literal (component-reviewer finding)', () => {
  // GH #686's Amendment (LLD §16.1/§16.5) — the pairing vehicle's own separator track retires with it, and
  // with it the asymmetric per-region leading padding this probe used to pin (author/settings each carried
  // their OWN 12px leading inline padding, hand-tuned around the retired split's track). Three flat
  // siblings need no per-region padding at all now — the pane holder's own row `gap` is the WHOLE
  // inter-column story, uniformly, and it reuses canvas's own `--ui-agent-admin-shell-gutter` value so the
  // outer margin and the inter-column rhythm still read as ONE consistent gutter (the ORIGINAL probe's
  // intent, carried over by a different mechanism).
  it('canvas carries its own 12px (0.75rem) inline padding; settings/copilot carry NONE of their own — the row gap (also 12px) is the whole inter-column story now', () => {
    const { el } = mountAgentAdmin()
    const canvas = el.querySelector('[data-part="canvas"]') as HTMLElement
    const settings = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const author = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    expect(getComputedStyle(canvas).paddingInlineStart).toBe('12px')
    for (const part of [settings, author]) {
      expect(getComputedStyle(part).paddingInlineStart, 'no own leading inline padding — the row gap supplies it').toBe('0px')
    }
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    expect(getComputedStyle(holder).columnGap, 'the row gap matches canvas\'s own gutter — one consistent rhythm').toBe('12px')
  })

  // GH #665 — author/settings carry NO OWN block padding either: canvas alone carries the block gutter for
  // all three columns (the chat conversation, relying on it exclusively, is unchanged), which is what keeps
  // the triple's top line shared rather than doubled ("ragged tops", Kim's screenshot).
  it('author/settings carry NO OWN block padding — the canvas gutter alone sets their vertical inset, matching the chat conversation', () => {
    const { el } = mountAgentAdmin()
    const settings = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const author = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    for (const part of [settings, author]) {
      const cs = getComputedStyle(part)
      expect(cs.paddingBlockStart).toBe('0px')
      expect(cs.paddingBlockEnd).toBe('0px')
    }
  })
})

describe('ui-agent-admin cross-engine smoke — the add-form is GENUINELY collapsed when hidden (component-reviewer CRITICAL fix)', () => {
  it('a hidden add-form computes display:none; toggling reveals it as a real, visible box', () => {
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Tools rides the Capabilities tab now
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
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Instructions rides the Capabilities tab now
    const foundationField = el.querySelector(
      '[data-entry-id="foundation"] [data-part="entry-content"]',
    ) as UICodeEditorElement
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
    ) as UICodeEditorElement
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
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Skills rides the Capabilities tab now
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
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Skills rides the Capabilities tab now
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
    activateTab(el, 'Capabilities') // GH #574 — Skills rides the Capabilities tab now

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

    const shell = el.querySelector('ui-super-shell') as HTMLElement
    expect(shell.scrollWidth).toBe(shell.clientWidth)

    const canvas = el.querySelector('[data-part="canvas"]') as HTMLElement
    const tabsPane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    for (const [label, pane] of [
      ['canvas', canvas],
      ['settings-pane', tabsPane],
    ] as const) {
      expect(pane.scrollWidth, `${label} pane must not overflow itself`).toBe(pane.clientWidth)
    }

    // The composer (ui-conversation's own overflow-x:hidden previously swallowed it invisibly) and the
    // nested ui-settings/ui-master-detail drill-in pane (the --_pane-min inheritance leak, TKT-0045) are
    // the two spots the bug actually lived — assert both directly, not just their ancestors.
    const chat = canvas.querySelector('[data-part="chat-pane"]') as HTMLElement
    const composer = chat.querySelector('ui-conversation-composer') as HTMLElement
    expect(composer.scrollWidth, 'the message composer must not overflow ui-conversation').toBeLessThanOrEqual(chat.clientWidth)
    const uiSettingsInner = tabsPane.querySelector('ui-settings') as HTMLElement
    expect(uiSettingsInner.scrollWidth, 'the generated settings form must not overflow its pane').toBe(uiSettingsInner.clientWidth)
  })
})

describe('ui-agent-admin cross-engine smoke — min-size-floors census (GH #185 follow-up): the LLD-C4 floor-token repoint actually reaches live paint', () => {
  // agent-admin.test.ts's own jsdom check (line ~255) only greps agent-admin.css's TEXT for the two
  // literal strings "16rem"/"20rem" — that proves the file still MENTIONS the right numbers, never that
  // ui-super-shell ever resolves them. It didn't: `:where(ui-super-shell)` (super-shell.css's own TOKEN
  // BLOCK) unconditionally re-declares its OWN default for the SAME two custom-property names, and a
  // directly-matching declaration on an element always beats one merely inherited from an ancestor,
  // regardless of the ancestor rule's specificity — so the OLD `:where(ui-agent-admin)`-only repoint
  // never won on the composed shell, verified via getComputedStyle on both engines before the fix moved
  // it onto a `ui-super-shell { ... }` rule that matches the shell directly. This is the REAL, live-paint
  // proof the regex could never be.
  it('the composed ui-super-shell actually resolves --ui-super-shell-canvas-min-size/-pane-min-size to 16rem/20rem, not the shell\'s own 9-module default', async () => {
    const { el } = mountAgentAdminAt(1200)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const shell = el.querySelector('ui-super-shell') as HTMLElement
    expect(getComputedStyle(shell).getPropertyValue('--ui-super-shell-canvas-min-size').trim()).toBe('16rem')
    expect(getComputedStyle(shell).getPropertyValue('--ui-super-shell-pane-min-size').trim()).toBe('20rem')
    // The REAL px the shell's own #resolvePx technique would compute (mirrors super-shell.ts:#resolvePx) —
    // a calc()-free custom property resolves through getPropertyValue, but the shell's OWN tokens are
    // calc() expressions elsewhere; these two are plain lengths here, so cross-check the applied px too
    // via the same "apply to a real layout property" probe the component's own clamp code uses.
    const probe = document.createElement('div')
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.inlineSize = 'var(--ui-super-shell-pane-min-size)'
    shell.append(probe)
    const resolvedPx = probe.getBoundingClientRect().width
    probe.remove()
    expect(resolvedPx, 'resolves to 20rem = 320px, not the shell default 9×18px = 162px').toBe(320)
  })
})

describe('ui-agent-admin cross-engine smoke — TKT-0049/ADR-0139: entry-content/entry-add-content min-height is driven by ui-code-editor\'s own `rows` lever, not dead agent-admin.css', () => {
  // `--ui-code-editor-min-block-size`'s formula (editor.css): rows × line-box + 2×padding-block, where
  // line-box = font-size × 1.5 and padding-block = font-size × 0.5 (identical to the ui-textarea it replaced,
  // ADR-0139 cl.6). Deriving the expected px from the field's OWN real computed font-size (never a hardcoded
  // px) proves the `rows` mechanism carried over rather than re-asserting a specific legacy pixel value.
  function expectedMinBlockSize(field: HTMLElement, rows: number): number {
    const fontSize = Number.parseFloat(getComputedStyle(field).fontSize)
    const lineBox = fontSize * 1.5
    const paddingBlock = fontSize * 0.5
    return rows * lineBox + 2 * paddingBlock
  }

  it('entry-content (rows=4) renders a real computed min-height matching the rows formula', () => {
    const { el } = mountAgentAdmin()
    const field = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as UICodeEditorElement
    expect(field.rows).toBe(4)
    const computed = Number.parseFloat(getComputedStyle(field).minHeight)
    expect(computed).toBeCloseTo(expectedMinBlockSize(field, 4), 1)
  })

  it('entry-add-content (rows=2) renders a real computed min-height matching the rows formula', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.tool}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const field = section.querySelector('[data-part="entry-add-content"]') as UICodeEditorElement
    expect(field.rows).toBe(2)
    const computed = Number.parseFloat(getComputedStyle(field).minHeight)
    expect(computed).toBeCloseTo(expectedMinBlockSize(field, 2), 1)
  })

  it('changing `.rows` moves entry-content\'s rendered min-height (proves the mechanism; catches a future competing CSS rule that WINS the cascade)', async () => {
    const { el } = mountAgentAdmin()
    const field = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as UICodeEditorElement
    const before = Number.parseFloat(getComputedStyle(field).minHeight)
    field.rows = 8
    await field.updateComplete // the rows→CSS-custom-property write rides a reactive effect, not a sync write
    const after = Number.parseFloat(getComputedStyle(field).minHeight)
    expect(after).toBeGreaterThan(before)
    expect(after).toBeCloseTo(expectedMinBlockSize(field, 8), 1)
  })
})

describe('ui-agent-admin cross-engine smoke — TKT-0050/TKT-0059/ADR-0139: entry-content/entry-add-content render off ui-code-editor\'s OWN tokens, not agent-admin.css\'s dead competing declarations', () => {
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
    return { block: fontSize * 0.5, inline: fontSize * 0.75 } // editor.css's formula (same factors as textarea's)
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

  it('entry-content\'s idle border-color is ui-code-editor\'s OWN --ui-code-editor-border token, not agent-admin.css\'s --ui-agent-admin-border (a genuinely different role)', () => {
    const { el } = mountAgentAdmin()
    const entryContent = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement
    // component-reviewer MINOR fix: comparing a RAW custom-property string (e.g. an unresolved
    // `light-dark(...)` expression) against `borderColor`'s resolved `rgb()`/`oklch()` serialization can
    // never match either way — vacuously true regardless of which rule actually won. Resolve BOTH
    // candidate tokens the same way the browser does: apply each to a real scratch element's `border-color`
    // inside the SAME tree (so `light-dark()` picks up the identical colour-scheme context) and read back
    // ITS computed value — a genuine apples-to-apples comparison.
    function resolveBorderColor(token: string): string {
      // `--ui-code-editor-border` is declared ON `:where(ui-code-editor)` itself (editor.css) — custom
      // properties inherit DOWNWARD only, so the probe must be a DESCENDANT of entryContent to see it (a
      // sibling/ancestor probe would resolve an unset token instead). ui-code-editor only ever references its
      // editor/message/cm parts by stored reference (never by children[] index or count — verified against
      // editor.ts), so an extra light-DOM child is inert to its own logic; removed immediately after read.
      const probe = document.createElement('div')
      probe.style.borderStyle = 'solid'
      probe.style.borderColor = `var(${token})`
      entryContent.append(probe)
      const resolved = getComputedStyle(probe).borderColor
      probe.remove()
      return resolved
    }
    const renderedBorderColor = getComputedStyle(entryContent).borderColor
    expect(renderedBorderColor).toBe(resolveBorderColor('--ui-code-editor-border'))
    expect(renderedBorderColor).not.toBe(resolveBorderColor('--ui-agent-admin-border'))
  })

  it('TKT-0059/ADR-0139: entry-content/entry-add-content\'s ui-code-editor renders the SAME font-size/border-color/border-radius as the settings pane\'s ui-text-field (Name field) — the frame parity carries over from ui-textarea', async () => {
    const { el } = mountAgentAdmin()
    const entryContent = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement

    const uiSettings = el.querySelector('[data-role="agent-content"] ui-settings') as HTMLElement & { updateComplete: Promise<void> }
    await uiSettings.updateComplete
    // drill-in default: the panel is empty until a rail item is activated (the settings.browser.test.ts
    // precedent) — the "Agent" section is the first/only rail item at this schema's version.
    ;(uiSettings.querySelector('ui-nav-rail-item') as HTMLElement).click()
    await uiSettings.updateComplete
    const nameField = el.querySelector('[data-role="agent-content"] ui-text-field[name="name"]') as HTMLElement
    expect(nameField).not.toBeNull()

    const editorStyle = getComputedStyle(entryContent)
    const textFieldStyle = getComputedStyle(nameField)
    expect(editorStyle.fontSize).toBe(textFieldStyle.fontSize)
    expect(editorStyle.borderColor).toBe(textFieldStyle.borderColor)
    expect(editorStyle.borderRadius).toBe(textFieldStyle.borderRadius)
  })

  it('the entry-content/entry-add-content :focus-visible rule never matches (focus lands on ui-textarea\'s internal editor, not the host) — dead by a DIFFERENT mechanism than the cascade-proximity loss above', () => {
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Instructions rides the Capabilities tab now; .focus() needs a real, non-display:none ancestor
    const entryContent = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement
    entryContent.focus()
    expect(entryContent.matches(':focus-within')).toBe(true) // focus genuinely landed inside
    expect(entryContent.matches(':focus-visible')).toBe(false) // but never on the HOST itself
  })

  it('TKT-0060: entry-add-label/entry-add-description are now real <ui-text-field>s — the agent-admin.css bespoke rule is gone, and focus draws the CONTROL\'S OWN :focus-within outline ring instead (the same dead-by-different-mechanism story TKT-0050 already proved for entry-content)', () => {
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Tools rides the Capabilities tab now; .focus() needs a real, non-display:none ancestor
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
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Skills rides the Capabilities tab now; .focus() needs a real, non-display:none ancestor
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
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Skills rides the Capabilities tab now; .focus() needs a real, non-display:none ancestor
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

    // ADR-0179 — the composer lives in the Chat PLACE; the setting was edited from the Settings place.
    goToPlace(el, 'Chat')
    const composer = el.querySelector('[data-part="chat-pane"] ui-conversation-composer') as HTMLElement & { value: string }
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

// ── GH #47/#48 — the add-from-library menu through the REAL popover path (both engines) ────────────────

describe('ui-agent-admin — entry libraries commit through the real menu (GH #47/#48)', () => {
  it('trigger opens the top-layer panel; a row commit adds the entry; the menu closes', async () => {
    const { wrapper, el } = mountAgentAdmin()
    el.libraries = {
      [ENTRY_KINDS.skill]: [{
        id: 'pack-a',
        label: 'Pack A',
        description: 'fixture pack',
        entries: [{ label: 'swiper-gallery', description: 'gallery idiom', content: 'Use a Swiper.' }],
      }],
    }
    // libraries is compose-time captured — set BEFORE append; mountAgentAdmin already appended, so
    // remount fresh: the helper appends inside itself, so build our own element here instead.
    wrapper.remove()
    const wrap2 = document.createElement('div')
    wrap2.style.width = '1200px'
    wrap2.style.height = '600px'
    const el2 = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el2.style.flex = '1 1 auto'
    el2.libraries = el.libraries
    wrap2.append(el2)
    document.body.append(wrap2)
    mounted.push(wrap2)
    await el2.updateComplete
    activateTab(el2, 'Capabilities') // GH #574 — Skills rides the Capabilities tab now; the trigger's real position needs a painted ancestor

    const section = el2.querySelector('[data-part="entry-section"][data-kind="skill"]') as HTMLElement
    const menu = section.querySelector('[data-part="entry-library-menu"]') as HTMLElement
    const trigger = menu.querySelector('[data-part="trigger"]') as HTMLElement
    trigger.click()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const row = menu.querySelector('[data-value="pack-a:0"]') as HTMLElement
    expect(row.getAttribute('role'), 'the row entered the menu item contract').toBe('menuitem')
    expect(row.getBoundingClientRect().width, 'the open panel renders the row visibly').toBeGreaterThan(0)
    row.click()
    await el2.updateComplete
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const entryRow = [...section.querySelectorAll<HTMLElement>('[data-part="entry"]')].find((e) =>
      e.textContent?.includes('swiper-gallery'),
    )
    expect(entryRow, 'the committed library entry renders in the section list').not.toBeUndefined()
    expect(row.getBoundingClientRect().width, 'the menu closed after the commit').toBe(0)
  })
})

describe('ui-agent-admin — the Agent config panel is a CARD like the entry cards (design-mode ask, 2026-07-19)', () => {
  it('the settings panel carries the entry-card chrome: real border, radius, surface, padding — matching an entry card computed-for-computed', async () => {
    const { el } = mountAgentAdmin()
    await el.updateComplete
    const panel = el.querySelector('ui-settings [data-part="panel"]') as HTMLElement
    const entry = el.querySelector('[data-part="entry"]') as HTMLElement
    expect(panel).not.toBeNull()
    expect(entry, 'an entry card exists to match against (the prompt sections seed three)').not.toBeNull()
    const p = getComputedStyle(panel)
    const e = getComputedStyle(entry)
    // The FULL border shorthand resolution (GH #50 settings.css's `ui-settings [data-part='panel']`
    // specificity-lift override, agent-admin.css: width/style/color each individually, not just width),
    // so a future settings.css specificity bump that reverts only style or color still goes red.
    expect(p.borderTopWidth, 'a real border').toBe(e.borderTopWidth)
    expect(p.borderTopStyle, 'the same border style').toBe(e.borderTopStyle)
    expect(p.borderTopStyle).not.toBe('none') // anti-vacuous: not none-matching-none
    expect(p.borderTopColor, 'the same border role').toBe(e.borderTopColor)
    expect(p.borderTopLeftRadius, 'the same card radius').toBe(e.borderTopLeftRadius)
    expect(p.borderTopRightRadius, 'the radius is uniform, not just the top-left corner').toBe(e.borderTopRightRadius)
    expect(p.backgroundColor, 'the same card surface').toBe(e.backgroundColor)
    expect(p.backgroundColor).not.toBe('rgba(0, 0, 0, 0)') // anti-vacuous: not transparent-matching-transparent
    // GH #191 follow-up (Kim's screenshot: the Agent card read with excess inset vs. its siblings) — the
    // panel had been minted with a UNIFORM 0.75rem padding instead of the entry card's own asymmetric
    // 0.5rem 0.75rem, a real 4px block-inset excess. Matching the padding, not just the chrome, is the
    // actual regression this pane-rhythm fix protects.
    expect(p.paddingBlockStart, 'block padding matches the entry-card norm, not a uniform 0.75rem').toBe(e.paddingBlockStart)
    expect(p.paddingInlineStart, 'inline padding matches the entry-card norm').toBe(e.paddingInlineStart)
  })
})

describe('ui-agent-admin — list-row vertical rhythm stays consistent across the pane (GH #191 follow-up)', () => {
  it('the model grid\'s row gap matches the entry-list/surface-options list convention (0.5rem), not the smaller entry-internal gap it had been minted with', async () => {
    const { el } = mountAgentAdmin()
    await el.updateComplete
    const modelGrid = el.querySelector('[data-part="model-grid"]') as HTMLElement
    const entryList = el.querySelector('[data-part="entry-list"]') as HTMLElement
    const surfaceOptions = el.querySelector('[data-part="surface-options"]') as HTMLElement
    expect(modelGrid).not.toBeNull()
    expect(entryList).not.toBeNull()
    expect(surfaceOptions).not.toBeNull()
    const modelGridGap = getComputedStyle(modelGrid).rowGap
    expect(modelGridGap, 'a real, non-zero gap').not.toBe('0px')
    expect(modelGridGap, 'matches entry-list\'s own row gap').toBe(getComputedStyle(entryList).rowGap)
    expect(modelGridGap, 'matches surface-options\' own row gap').toBe(getComputedStyle(surfaceOptions).rowGap)
    // Adjacent model rows within the SAME provider group render the declared gap, not a collapsed 0 —
    // the live-render claim underneath the CSS-source read (a provider-group boundary adds ITS OWN
    // margin-block-start on top, so only compare rows 0/1, both under "Anthropic").
    const rows = [...modelGrid.querySelectorAll('[data-part="model-row"]')] as HTMLElement[]
    expect(rows.length).toBeGreaterThanOrEqual(2)
    const gapPx = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().bottom
    expect(gapPx).toBeCloseTo(Number.parseFloat(modelGridGap), 1)
  })
})

describe('ui-agent-admin — segment content wins its OWN display:flex, not super-shell\'s active-segment display:block (GH #197)', () => {
  it('GH #574: each of the three ranked segments (Agent/Capabilities/Surface) computes display:flex and shows a REAL, non-zero measured gap between every pair of ITS OWN adjacent top-level sections', async () => {
    const { el } = mountAgentAdmin()
    await el.updateComplete
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]

    function assertSegmentFlexAndGaps(role: string, minChildren: number): void {
      const content = el.querySelector(`[data-role="${role}"]`) as HTMLElement
      expect(content).not.toBeNull()
      // The double-duty element: agent-admin's own `[data-role='...']` (specificity 0,1,0) declares
      // `display:flex; gap:1rem`, but the SAME node is also super-shell's `[data-segment][data-active]`
      // (specificity 0,3,0, super-shell.css) — before the fix, super-shell's `display:block` won on raw
      // specificity and silently zeroed the flex `gap` (gap has no effect on a block container); the fix
      // keeps every one of the three ranked segments winning that fight, not just the old single one.
      const cs = getComputedStyle(content)
      expect(cs.display, `${role} wins the specificity fight against super-shell's segment-visibility rule`).toBe('flex')
      expect(cs.flexDirection).toBe('column')

      // Real, measured gaps (not just computed style — `row-gap` still reports its declared value even
      // when display:block makes it inert) between EVERY adjacent pair of top-level children that
      // actually PAINT. GH #541 — the Bankroll fold is `hidden` for a persona that never opted in, and a
      // display:none flex item takes no `gap` at all, so measuring against its zero-box would assert a
      // gap the layout never had.
      const children = ([...content.querySelectorAll(':scope > *')] as HTMLElement[]).filter((c) => c.getBoundingClientRect().height > 0)
      expect(children.length, `${role} composes multiple top-level sections`).toBeGreaterThanOrEqual(minChildren)
      const expectedGapPx = Number.parseFloat(cs.rowGap)
      expect(expectedGapPx, 'a real, non-zero declared gap to measure against').toBeGreaterThan(0)
      for (let i = 1; i < children.length; i++) {
        const prev = children[i - 1]
        const next = children[i]
        const gapPx = next.getBoundingClientRect().top - prev.getBoundingClientRect().bottom
        expect(
          gapPx,
          `${role}: measured gap between child ${i - 1} (${prev.getAttribute('data-part') ?? prev.tagName}) and child ${i} (${next.getAttribute('data-part') ?? next.tagName})`,
        ).toBeCloseTo(expectedGapPx, 0)
      }
    }

    // Agent (the default active segment, no click needed) — Agent + Model; Bankroll stays hidden (no
    // opted-in persona on a fresh store).
    assertSegmentFlexAndGaps('agent-content', 2)

    tabs.find((t) => t.textContent === 'Capabilities')!.click()
    await new Promise((r) => requestAnimationFrame(r))
    assertSegmentFlexAndGaps('capabilities-content', 5) // Instructions, Skills, Workflows, Resources, Tools

    tabs.find((t) => t.textContent === 'Surface')!.click()
    await new Promise((r) => requestAnimationFrame(r))
    assertSegmentFlexAndGaps('surface-content', 2) // Surface Options, Pattern sources
  })

  it('the Context: System and Context: Dialog segments ALSO win display:flex once activated (same super-shell specificity collision, same fix)', async () => {
    const { el } = mountAgentAdminAt(800)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')]

    const systemTab = tabs.find((t) => t.textContent === 'Context: System') as HTMLElement
    systemTab.click()
    await new Promise((r) => requestAnimationFrame(r))
    const systemContent = pane.querySelector('[data-role="context-system-content"]') as HTMLElement
    expect(systemContent.hidden).toBe(false)
    expect(getComputedStyle(systemContent).display).toBe('flex')

    const dialogTab = tabs.find((t) => t.textContent === 'Context: Dialog') as HTMLElement
    dialogTab.click()
    await new Promise((r) => requestAnimationFrame(r))
    const dialogContent = pane.querySelector('[data-role="context-dialog-content"]') as HTMLElement
    expect(dialogContent.hidden).toBe(false)
    expect(getComputedStyle(dialogContent).display).toBe('flex')
  })
})

// ── GH #706 — a THIRD instance of this file's own named failure class (GH #197 above; the
// master-detail-pane @scope fix, agent-admin.css:405-415): the Model fold's `body` (a plain div,
// disclosure.css declares no `display` of its own) held TWO top-level cards once S7-d's
// `reset-agent-row` joined `model-grid` as its sibling, and the UA default `display:block` zeroed
// the gap `--ui-agent-admin-section-gap` was supposed to give them. ────────────────────────────────
describe('ui-agent-admin — the Model fold body wins its OWN display:flex, so model-grid and reset-agent-row get a real gap (GH #706)', () => {
  it('a real, non-zero measured gap separates the models-list card from the "Agent configuration" (Reset Agent) card', async () => {
    const { el } = mountAgentAdmin('Agent')
    el.onResetRequest(() => {}) // the WHOLE ROW is [hidden] unregistered (agent-admin.ts #applyActionAvailability,
    // GH #709) — register so the row paints at all, since this test measures a gap between two painted
    // boxes; the unregistered-hidden case has its own dedicated test below (GH #709's own regression pin).
    await el.updateComplete
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const modelFold = el.querySelector('[data-part="settings-item"][data-item="model"]') as HTMLElement
    const body = modelFold.querySelector('[data-part="details"] > [data-part="body"]') as HTMLElement
    const grid = body.querySelector('[data-part="model-grid"]') as HTMLElement
    const resetRow = body.querySelector('[data-part="reset-agent-row"]') as HTMLElement

    expect(getComputedStyle(body).display, 'the body wins display:flex, not the UA default display:block').toBe('flex')
    expect(grid.getBoundingClientRect().height, 'the models card is a real, painted box').toBeGreaterThan(0)
    expect(resetRow.getBoundingClientRect().height, 'the Reset Agent card is a real, painted box (registered, so not [hidden])').toBeGreaterThan(0)

    const expectedGapPx = Number.parseFloat(getComputedStyle(body).rowGap)
    expect(expectedGapPx, 'a real, non-zero declared section gap to measure against').toBeGreaterThan(0)
    const measuredGapPx = resetRow.getBoundingClientRect().top - grid.getBoundingClientRect().bottom
    expect(measuredGapPx, 'the models card and the Reset Agent card no longer butt together').toBeCloseTo(expectedGapPx, 0)
  })

  // GH #709 — the SAME failure class this describe block's own GH #706 fix already named for settings-item
  // ([hidden] loses to a bare author `display` declaration unless explicitly re-asserted): reset-agent-row's
  // own `display: flex` rule is exactly that shape, so hiding the ROW (not just its button, the fix this
  // ticket shipped) needs the matching `[data-part='reset-agent-row'][hidden] { display: none }` override —
  // a real-engine assertion, since jsdom never applies this cascade and would pass even if the CSS override
  // were missing entirely (only the DOM attribute/property, never computed style).
  it('an unregistered Reset Agent row actually PAINTS as display:none, not just carries the [hidden] attribute (GH #709)', async () => {
    const { el } = mountAgentAdmin('Agent') // no onResetRequest — the unregistered/hidden case
    await el.updateComplete
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const resetRow = el.querySelector('[data-part="reset-agent-row"]') as HTMLElement
    expect(resetRow.hidden, 'anti-vacuous: the attribute really is set').toBe(true)
    expect(getComputedStyle(resetRow).display, 'the CSS override wins — [hidden] actually removes the box').toBe('none')
    expect(resetRow.getBoundingClientRect().height, 'zero-height, not merely attribute-hidden while still laid out').toBe(0)
  })
})

// ── GH #225 — the Settings sections are heading-row FOLDS (the GH #222 Context pattern applied back to
// the config column): chevron on the heading row, one shared heading register, fold toggles content,
// and the master switches ride their fold summaries WITHOUT the summary swallowing their clicks. ──────
describe('ui-agent-admin — GH #225: the Settings sections fold like the Context sections', () => {
  it('GH #574: each of the three ranked tabs (Agent/Capabilities/Surface) renders a real chevron fold in the shared heading register — a CENSUS across tabs matches the old flat ten; clicking a summary folds ONLY that section\'s content', async () => {
    const { el } = mountAgentAdmin()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]
    const clickTab = async (label: string): Promise<void> => {
      tabs.find((t) => t.textContent === label)!.click()
      await new Promise((r) => requestAnimationFrame(r))
    }
    const itemsOf = (role: string): (HTMLElement & { open: boolean; hidden: boolean })[] =>
      [...(el.querySelector(`[data-role="${role}"]`) as HTMLElement).querySelectorAll(':scope > [data-part="settings-item"]')] as (HTMLElement & {
        open: boolean
        hidden: boolean
      })[]

    // Agent is the default active tab — GH #488 folded Catalogs INTO Surface Options; GH #541 lifted
    // Bankroll into its own group; GH #574 ranked the old flat ten folds into three tabs.
    const agentItems = itemsOf('agent-content')
    expect(agentItems.map((i) => i.getAttribute('data-item'))).toEqual(['agent', 'model', 'bankroll'])
    // …and `hidden` on a fold really removes it from layout here (ui-disclosure's own `display:block`
    // outranks the UA's `[hidden]` rule, so agent-admin.css restates it — this is the cross-engine proof).
    const bankroll = agentItems.find((i) => i.getAttribute('data-item') === 'bankroll')!
    expect(bankroll.hidden, 'no persona opted into the bankroll capability here').toBe(true)
    expect(getComputedStyle(bankroll).display).toBe('none')
    expect(bankroll.getBoundingClientRect().height).toBe(0)
    for (const item of agentItems.filter((i) => !i.hidden)) assertFoldChrome(item)

    await clickTab('Capabilities')
    const capabilitiesItems = itemsOf('capabilities-content')
    expect(capabilitiesItems.map((i) => i.getAttribute('data-item'))).toEqual([
      ENTRY_KINDS.promptSection, ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool,
    ])
    for (const item of capabilitiesItems) assertFoldChrome(item)

    await clickTab('Surface')
    const surfaceItems = itemsOf('surface-content')
    expect(surfaceItems.map((i) => i.getAttribute('data-item'))).toEqual(['surface', ENTRY_KINDS.patternSource])
    for (const item of surfaceItems) assertFoldChrome(item)

    // Census: the union of the three tabs' top-level folds is EXACTLY the old flat ten-item set —
    // nothing lost, nothing duplicated (the acceptance's own wording, proven mechanically).
    const OLD_FLAT_SET = [
      'agent', 'model', 'surface', 'bankroll', ENTRY_KINDS.promptSection,
      ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool, ENTRY_KINDS.patternSource,
    ]
    const union = [...agentItems, ...capabilitiesItems, ...surfaceItems].map((i) => i.getAttribute('data-item'))
    expect([...union].sort()).toEqual([...OLD_FLAT_SET].sort())
    expect(new Set(union).size, 'no fold duplicated across tabs').toBe(union.length)

    // Folding the Model section (back in the Agent tab) collapses it to its heading row — and ONLY it
    // (the sibling folds stay open). Geometry, not paint-API, on purpose: modern engines hide closed-
    // details content via `content-visibility` on the ::details-content pseudo, so the skipped content
    // can still REPORT client rects — the honest cross-engine claim is the fold host's own collapse.
    await clickTab('Agent')
    const modelItem = agentItems.find((i) => i.getAttribute('data-item') === 'model')!
    const modelGrid = el.querySelector('[data-part="model-grid"]') as HTMLElement
    expect(modelGrid.getBoundingClientRect().height).toBeGreaterThan(0)
    const modelSummary = modelItem.querySelector(':scope > [data-part="details"] > [data-part="summary"]') as HTMLElement
    const openHeight = modelItem.getBoundingClientRect().height
    expect(openHeight).toBeGreaterThan(modelSummary.getBoundingClientRect().height)
    modelSummary.click()
    await new Promise((r) => requestAnimationFrame(r))
    expect(modelItem.open).toBe(false)
    const closedHeight = modelItem.getBoundingClientRect().height
    expect(closedHeight, 'the closed fold collapses to just its heading row').toBeLessThanOrEqual(modelSummary.getBoundingClientRect().height + 2)
    expect(closedHeight).toBeLessThan(openHeight)
    const agentItem = el.querySelector('[data-part="settings-item"][data-item="agent"]') as HTMLElement & { open: boolean }
    expect(agentItem.open).toBe(true)
    expect(agentItem.getBoundingClientRect().height, 'the sibling fold stays expanded').toBeGreaterThan(
      agentItem.querySelector(':scope > [data-part="details"] > [data-part="summary"]')!.getBoundingClientRect().height,
    )
    modelSummary.click()
    await new Promise((r) => requestAnimationFrame(r))
    expect(modelItem.open).toBe(true)
    expect(modelItem.getBoundingClientRect().height).toBeCloseTo(openHeight, 0)
  })

  it('the Agent master toggle rides the Agent fold\'s heading row and switches WITHOUT folding it (toggle click ≠ fold toggle); the summary itself still folds', async () => {
    const { el } = mountAgentAdmin()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const agentItem = el.querySelector('[data-part="settings-item"][data-item="agent"]') as HTMLElement & { open: boolean }
    const summary = agentItem.querySelector(':scope > [data-part="details"] > [data-part="summary"]') as HTMLElement
    const toggle = summary.querySelector('[data-part="agent-enabled"]') as HTMLElement & { checked: boolean }
    expect(toggle, 'the master switch sits ON the heading row').not.toBeNull()
    expect(toggle.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(agentItem.open).toBe(true)
    expect(toggle.checked).toBe(true)

    // Clicking the switch flips the agent's ACTIVE state — the fold must NOT toggle (the summary's
    // activation behavior is preventDefault-cancelled by ui-disclosure's OWN summary-slot guard, GH #226/
    // ADR-0158 — the switch rides the fold declaratively via slot="summary"; ui-switch's own
    // click-listener flip is untouched by it — indicator-element.ts LLD-C3).
    toggle.click()
    await new Promise((r) => requestAnimationFrame(r))
    expect(toggle.checked).toBe(false)
    expect(el.store?.get('agentEnabled')).toBe(false)
    expect(agentItem.open, 'the fold did not toggle').toBe(true)
    toggle.click()
    await new Promise((r) => requestAnimationFrame(r))
    expect(toggle.checked).toBe(true)
    expect(el.store?.get('agentEnabled')).toBe(true)
    expect(agentItem.open).toBe(true)

    // A kind switch behaves identically on ITS heading row — and dims its (headless) section.
    const skillsItem = el.querySelector(`[data-part="settings-item"][data-item="${ENTRY_KINDS.skill}"]`) as HTMLElement & { open: boolean }
    const skillsToggle = skillsItem.querySelector(':scope > [data-part="details"] > [data-part="summary"] [data-part="kind-enabled"]') as HTMLElement & { checked: boolean }
    skillsToggle.click()
    await new Promise((r) => requestAnimationFrame(r))
    expect(skillsToggle.checked).toBe(false)
    expect(skillsItem.open, 'the kind fold did not toggle').toBe(true)
    const skillsSection = el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    expect(skillsSection.hasAttribute('data-kind-disabled')).toBe(true)
    expect(Number.parseFloat(getComputedStyle(skillsSection).opacity)).toBeLessThan(1)
    // The switch itself stays full-strength — it lives OUTSIDE the dimmed section, on the heading row.
    expect(Number.parseFloat(getComputedStyle(skillsToggle).opacity)).toBe(1)

    // Folding the Agent section via ITS summary still works (click the summary, not the switch) — the
    // fold collapses to its heading row and the master switch stays visible ON it: the way back never
    // folds away. (Geometry, not paint-API — the content-visibility caveat in the fold probe above.)
    const agentOpenHeight = agentItem.getBoundingClientRect().height
    summary.click()
    await new Promise((r) => requestAnimationFrame(r))
    expect(agentItem.open).toBe(false)
    expect(toggle.getBoundingClientRect().width, 'the switch survives the fold').toBeGreaterThan(0)
    expect(agentItem.getBoundingClientRect().height, 'the closed fold is just its heading row').toBeLessThanOrEqual(summary.getBoundingClientRect().height + 2)
    summary.click()
    await new Promise((r) => requestAnimationFrame(r))
    expect(agentItem.open).toBe(true)
    expect(agentItem.getBoundingClientRect().height).toBeCloseTo(agentOpenHeight, 0)
  })

  it('GH #226: a destructive fold-content clobber rebuilds the disclosure and the master switch SURVIVES on the fresh heading row (ui-disclosure\'s slot rescue, ADR-0158)', async () => {
    const { el } = mountAgentAdmin('Capabilities') // GH #574 — Skills rides the Capabilities tab now
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const skillsItem = el.querySelector(`[data-part="settings-item"][data-item="${ENTRY_KINDS.skill}"]`) as HTMLElement & { open: boolean }
    const toggle = skillsItem.querySelector('[data-part="kind-enabled"]') as HTMLElement & { checked: boolean }
    expect(toggle).not.toBeNull()
    const wasOpen = skillsItem.open

    // Force the rebuild path GH #226 named as the hazard: a destructive children write detaches the
    // fold's details part; ui-disclosure rebuilds fresh and RESCUES the slotted switch (same node).
    skillsItem.textContent = 'clobbered section body'
    await new Promise<void>((r) => queueMicrotask(r)) // the heal observer's callback
    await new Promise((r) => requestAnimationFrame(r))

    const freshSummary = skillsItem.querySelector(':scope > [data-part="details"] > [data-part="summary"]') as HTMLElement
    expect(freshSummary.contains(toggle), 'the SAME switch node survives on the fresh heading row').toBe(true)
    expect(toggle.getBoundingClientRect().width, 'and it paints').toBeGreaterThan(0)
    expect(skillsItem.open, 'fold state re-converged across the rebuild').toBe(wasOpen)

    // Still wired end-to-end: clicking it flips the kind's enabled state without folding — the
    // component-owned guard was re-wired onto the fresh part.
    const wasChecked = toggle.checked
    toggle.click()
    await new Promise((r) => requestAnimationFrame(r))
    expect(toggle.checked).toBe(!wasChecked)
    expect(el.store?.get(kindEnabledKey(ENTRY_KINDS.skill))).toBe(!wasChecked)
    expect(skillsItem.open, 'the rebuilt fold did not toggle on the switch click').toBe(wasOpen)
  })
})

// ── ADR-0178 / GH #633 — the guided-authoring flow, in BOTH real engines ──────────────────────────────
// jsdom proves the apply loop's LOGIC (agent-admin-authoring.test.ts). What only a real engine can prove
// is that the dual-context stack actually LAYS OUT: that arming the flow puts a second, genuinely visible
// conversation on screen, that a mode flip swaps which one occupies the canvas without either collapsing
// to a zero box, and that a patched value paints into the settings pane while the turn streams.

/** Go to a PLACE from a probe — the SAME mapping `goToPlace` above uses (all three shown, the requested
 *  one primary), through the visibility model's protected seam (`setPaneVisibilitySeam`, LLD §16.2). GH
 *  #686's Amendment retires `setPaneSeam`/the pane-nav strip this helper used to reach; `goToPlace` is the
 *  real-affordance-free equivalent this file already uses elsewhere — this second name survives only
 *  because this describe block's own tests read more naturally with a PANE-shaped call. */
const setPane = (el: UIAgentAdminElement, pane: 'chat' | 'author' | 'settings'): void => {
  const real = pane === 'author' ? 'copilot' : pane
  ;(el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }).setPaneVisibilitySeam(
    ['chat', 'settings', 'copilot'],
    real,
  )
}

describe('ui-agent-admin cross-engine smoke — the guided-authoring flow (ADR-0178 cl.5, GH #633)', () => {
  /** A scripted surface runner: one patch turn, then a note — the shape a real Builder turn has. */
  function armPatchRunner(el: UIAgentAdminElement): void {
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'patch' as const, patch: { values: { name: 'Painted By Patch' } } }
      yield { kind: 'note' as const, note: 'Named it for you.' }
    }
  }

  function conversationsOf(el: UIAgentAdminElement): { authoring: HTMLElement | null; test: HTMLElement } {
    return {
      authoring: el.querySelector('[data-part="copilot-pane"]'),
      test: el.querySelector('[data-part="chat-pane"]') as HTMLElement,
    }
  }

  it('unarmed, the Chat place paints exactly one visible conversation filling the canvas (zero-regression)', async () => {
    const { el } = mountAgentAdmin()
    setPane(el, 'chat')
    await el.updateComplete
    const { authoring, test } = conversationsOf(el)
    // GH #666 REOPENED — this used to assert the second conversation was LAZY (null until the flow armed).
    // Kim's pixel ruling makes the unarmed Author column that very card, so it is mounted from first paint
    // and, at this 1200px triple mount, painted beside Chat. The zero-regression claim this probe exists
    // for is untouched and is what the rest of it states: the Chat conversation still FILLS the canvas.
    expect(authoring, 'the Author card exists unarmed (GH #666)').not.toBeNull()
    const canvas = el.querySelector('[data-part="canvas"]') as HTMLElement
    const box = test.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    // it still FILLS the canvas — the stack wrapper must not have eaten the fill behaviour
    expect(Math.round(box.height)).toBeGreaterThan(Math.round(canvas.getBoundingClientRect().height) - 40)
  })

  // "exactly one place has a box" is the NARROW band's contract (below the 52.5rem triple line); at and
  // above it all three paint (GH #686's Amendment, LLD §16.2). Mounted narrow so the claim stays testable.
  it('arming the flow lands Co-pilot primary and paints the interview; the Chat place still takes over on demand — both keep real geometry across a visibility-set change (narrow band)', async () => {
    const { el } = mountAgentAdmin('Agent', NARROW_BAND_WIDTH)
    await el.updateComplete
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete

    const { authoring, test } = conversationsOf(el)
    expect(authoring).not.toBeNull()
    const authoringBox = authoring!.getBoundingClientRect()
    expect(authoringBox.width, 'the interview is genuinely on screen, not a zero-size stub').toBeGreaterThan(0)
    expect(authoringBox.height).toBeGreaterThan(0)
    expect(test.getBoundingClientRect().height, 'the Chat place contributes no box at all').toBe(0)

    setPane(el, 'chat')
    await el.updateComplete
    expect(authoring!.getBoundingClientRect().height).toBe(0)
    const testBox = test.getBoundingClientRect()
    expect(testBox.height, 'the test chat takes over the canvas — no collapsed layout').toBeGreaterThan(0)

    setPane(el, 'author')
    await el.updateComplete
    expect(authoring!.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('a patch turn HYDRATES the draft’s settings pane live, in a real painted turn', async () => {
    const { el } = mountAgentAdmin()
    await el.updateComplete
    armPatchRunner(el)
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete

    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const composer = authoring.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'call it whatever you like' // the Author place's OWN composer (cl.4 — per-pane composers)
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // the DRAFT's store took the write…
    expect(el.store!.get('name')).toBe('Painted By Patch')
    // …and the real settings field repainted it, with a real box (whole-shape, not just a value read)
    const nameField = el.querySelector('ui-settings [name="name"]') as UITextFieldElement
    expect(nameField.value).toBe('Painted By Patch')
    expect(nameField.getBoundingClientRect().width).toBeGreaterThan(0)
    // and the interview's own reply painted in the interview, not in the test chat
    const bubble = authoring.querySelector('[data-role="agent"] [data-part="body"]') as HTMLElement
    expect(bubble.textContent).toContain('Named it for you.')
  })

  it('the Authoring row paints in Surface Options, in row order, with a real toggle box', async () => {
    const { el } = mountAgentAdmin('Surface')
    await el.updateComplete
    const rows = [...el.querySelectorAll('[data-part="surface-options"] [data-part="surface-row"]')] as HTMLElement[]
    expect(rows.map((r) => r.getAttribute('data-surface'))).toEqual(['markdown', 'a2ui', 'genui', 'planner', 'authoring'])
    const row = rows[rows.length - 1]!
    const box = row.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    const toggle = row.querySelector('[data-part="surface-toggle"]') as HTMLElement
    expect(toggle.getBoundingClientRect().width, 'the switch itself renders, not an empty cell').toBeGreaterThan(0)
    // it sits on the same left edge as its siblings — one row grammar, not a bespoke one
    expect(Math.round(box.left)).toBe(Math.round(rows[0]!.getBoundingClientRect().left))
  })
})

// ── GH #686's Amendment — the PANE NAV retires (LLD §16.5); its replacement is S7-c's own header bar ──────
// (This describe used to prove the pane-nav strip's real paint/inset/click geometry, in BOTH engines. That
// strip no longer exists — no real affordance survives to re-target these probes onto until S7-c lands, so
// the strip-specific ones retire outright rather than being faked against the seam (a "click" that isn't a
// click would be exactly the kind of theater this fleet's testing law rejects). What DOES survive: the
// settings sub-nav's own column-alignment claim (unrelated to the top-level nav) and the visibility
// model's real cross-engine geometry, re-homed onto the seam-driven describe blocks below (the band matrix
// + density remeasure, `the wide TRIPLE dock` describe, renamed for the new geometry).
describe('ui-agent-admin cross-engine smoke — the settings sub-nav`s own column alignment (survives the pane-nav retirement)', () => {
  // §7 — the settings-nav strip's inset equality against the section content it labels: both sit in the
  // SAME column (the settings region), so a screen-x comparison between them is meaningful.
  it('the settings sub-nav and the section content it labels share ONE screen-x column', async () => {
    const { el } = mountAgentAdmin()
    await el.updateComplete
    const stripTab = el.querySelector('[data-part="settings-nav"] ui-tab') as HTMLElement
    const section = el.querySelector('[data-role="agent-content"]') as HTMLElement
    const sectionBox = section.getBoundingClientRect()
    expect(sectionBox.width, 'the section is genuinely on screen, not a zero-size stub').toBeGreaterThan(0)
    expect(Math.abs(stripTab.getBoundingClientRect().x - sectionBox.x), 'strip and content share the pane\'s one ambient gutter').toBeLessThanOrEqual(0.5)
  })
})

// ── LLD-P6 (GH #656, S2-a) — the SETTINGS grouping, in BOTH real engines ─────────────────────────────
// jsdom proves the grouping's LOGIC (the truth table, the key/label separation, state survival —
// agent-admin.test.ts). What only a real engine can prove is that the strip's not-enough-room strategy
// actually engages at the bands the admin ships at, that a section reached through the overflow menu
// paints for real, and that this second strip holds the SAME metric register as the pane-nav above it
// (the ledgered cross-strip equality method, extended one level down).
describe('ui-agent-admin cross-engine smoke — the settings sub-nav grouping (LLD-P6)', () => {
  const frames = async (n = 2): Promise<void> => {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
  }
  const SECTIONS = [
    ['Agent', 'agent-content'],
    ['Capabilities', 'capabilities-content'],
    ['Surface', 'surface-content'],
    ['Context: System', 'context-system-content'],
    ['Context: Dialog', 'context-dialog-content'],
  ] as const

  function strip(el: UIAgentAdminElement): HTMLElement & { selected: string } {
    return el.querySelector('[data-part="settings-nav"]') as HTMLElement & { selected: string }
  }
  function sectionTabs(el: UIAgentAdminElement): HTMLElement[] {
    return [...strip(el).querySelectorAll('ui-tab')] as HTMLElement[]
  }

  /** Reach ONE section the way a user at THIS band has to: its own tab when it fits the strip, otherwise
   *  the overflow menu's proxy row (GH #586). a6 says "reachable at every band" — this helper is what
   *  makes the claim honest instead of assuming the tab is always on screen. */
  async function reachSection(el: UIAgentAdminElement, label: string): Promise<'tab' | 'menu'> {
    const tab = sectionTabs(el).find((t) => t.textContent === label)!
    if (!tab.hasAttribute('data-overflowed')) {
      tab.click()
      await frames()
      return 'tab'
    }
    const menuEl = strip(el).querySelector('[data-part="overflow"]') as HTMLElement
    expect(menuEl.hidden, 'a tab is overflowed, so the trigger must be showing').toBe(false)
    ;(menuEl.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await frames()
    const proxy = [...menuEl.querySelectorAll('[role="menuitem"]')].find((p) => p.textContent === label) as HTMLElement
    expect(proxy, `${label} is neither on the strip nor in the overflow menu — unreachable at this band`).toBeTruthy()
    proxy.click()
    await frames()
    return 'menu'
  }

  /** The five sections' live widths — a hidden section is `display:none` in a real engine, so its box is 0. */
  function visibleRoles(el: UIAgentAdminElement): string[] {
    return SECTIONS.filter(([, role]) => (el.querySelector(`[data-role="${role}"]`) as HTMLElement).getBoundingClientRect().width > 0).map(
      ([, role]) => role,
    )
  }

  for (const widthPx of [414, 1200]) {
    it(`a6 at ${widthPx}px: every one of the five sections is reachable through the sub-nav, and each selection paints exactly ITS OWN section`, async () => {
      const { el } = mountAgentAdminAt(widthPx)
      await frames()
      goToPlace(el, 'Settings')
      await frames()
      expect(sectionTabs(el).map((t) => t.textContent), 'the ranked five, in GH #574 order').toEqual(SECTIONS.map(([label]) => label))
      expect((el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect().width, 'the pane is genuinely on screen').toBeGreaterThan(0)

      for (const [label, role] of SECTIONS) {
        await reachSection(el, label)
        expect(visibleRoles(el), `${widthPx}px · ${label}: exactly its own section paints`).toEqual([role])
        // The other four are genuinely OUT of layout, not merely dimmed — the truth table with teeth.
        for (const [, other] of SECTIONS) {
          const cs = getComputedStyle(el.querySelector(`[data-role="${other}"]`) as HTMLElement)
          expect(cs.display, `${widthPx}px · ${label}: ${other} display`).toBe(other === role ? 'flex' : 'none')
        }
        // …and the selected one has real content in it. `context-dialog-content` is the one exception: a
        // freshly-mounted admin has logged zero turns, so that section legitimately holds nothing yet and
        // its flex column collapses to zero height (an empty-state for it would be section INTERNALS —
        // outside LLD §5's grouping boundary; recorded on GH #656 rather than patched here).
        if (role !== 'context-dialog-content') {
          expect((el.querySelector(`[data-role="${role}"]`) as HTMLElement).getBoundingClientRect().height, `${label} has real height`).toBeGreaterThan(0)
        }
        // The selected tab is ALWAYS pinned visible (GH #586's own law) — a user can always see where they are.
        const selected = sectionTabs(el).find((t) => t.textContent === label)!
        expect(selected.hasAttribute('data-overflowed'), `${label} is selected, so it must be pinned onto the strip`).toBe(false)
        expect(selected.getBoundingClientRect().width, `${label}'s pinned tab paints`).toBeGreaterThan(0)
      }
    })
  }


  it('the not-enough-room strategy is the fleet MENU, not an affordance-less scroll — and it genuinely engages at the fleet-default narrow width', async () => {
    const { el } = mountAgentAdminAt(414)
    await frames()
    goToPlace(el, 'Settings')
    await frames(3)

    const s = strip(el)
    expect(s.getAttribute('overflow'), 'the reflected mode (tabs.md: connect-resolved)').toBe('menu')
    const menuEl = s.querySelector('[data-part="overflow"]') as HTMLElement
    expect(menuEl, 'overflow="menu" creates the part at connect').not.toBeNull()
    // Non-vacuous: the five labels really do outgrow this rail, which is the whole reason the mode is set.
    const overflowed = sectionTabs(el).filter((t) => t.hasAttribute('data-overflowed'))
    expect(overflowed.length, 'the five sections must not all fit 414px — otherwise this mode is decoration').toBeGreaterThan(0)
    expect(menuEl.hidden, 'so the trigger paints').toBe(false)
    const trigger = menuEl.querySelector('[data-part="trigger"]') as HTMLElement
    expect(trigger.getAttribute('aria-label')).toBe('More tabs')
    const box = trigger.getBoundingClientRect()
    expect(box.width, 'a real, on-screen trigger').toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    // …and reaching an overflowed section really goes THROUGH the menu at this band.
    const hiddenLabel = overflowed[0].textContent!
    expect(await reachSection(el, hiddenLabel), 'an overflowed section is reached via the menu').toBe('menu')
    expect(visibleRoles(el)).toEqual([SECTIONS.find(([label]) => label === hiddenLabel)![1]])
  })

  // GH #686's Amendment retires the pane nav this describe's own cross-strip equality probe used to
  // compare the settings sub-nav against ("one strip grammar, two levels") — there is no surviving second
  // `ui-tabs` instance at the top level to compare against until S7-c's header bar lands (LLD §16.4). The
  // claim itself (one shared `ui-tabs` metric register, fleet-wide) is not this component's to re-prove —
  // tabs.md/tabs.test.ts already own it at the control level.
})

// ── LLD-P7 (GH #658, S3-a) — the WIDE live-fill proof + density evidence, in BOTH real engines ────────
// The pairing's ANATOMY shipped in S1-b and its cl.3 dock geometry is already probed above. What S3 owes
// is #651's own acceptance line, exercised rather than cited: with the pair genuinely DOCKED, a gate-ON
// Builder turn running in the Author region must be visible in the SETTINGS region while it runs — the
// user watching their agent fill itself in. The failure mode this exists to catch is specifically
// store-green/paint-blank: S1-b's nesting bug (PR #655) had the write land in the store with the region
// painting nothing, so every assertion here is GEOMETRY and rendered text, never a store read alone.

/** The value the scripted Builder turn patches in — deliberately a string nothing else in this file or the
 *  admin's own defaults can produce, so "the rail shows it" can only mean the turn put it there. */
const LIVE_FILL_NAME = 'Filled While The Turn Ran'

describe('ui-agent-admin cross-engine smoke — the wide live-fill proof (LLD-P7, GH #658, re-anchored by GH #686\'s Amendment)', () => {
  const frames = async (n = 3): Promise<void> => {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
  }

  const regionsOf = (el: UIAgentAdminElement): { copilot: HTMLElement; settings: HTMLElement } => ({
    copilot: el.querySelector('[data-part="copilot-pane"]') as HTMLElement,
    settings: el.querySelector('[data-part="settings-pane"]') as HTMLElement,
  })

  /** Both regions really are side by side with real boxes — the anti-vacuous precondition every claim
   *  below rests on. The live-fill acceptance re-anchors from "the Author pairing" (retired) to the
   *  visibility state `{settings, copilot} ⊆ shown` (LLD §16's own words) — this is the ADJACENCY that
   *  state grants, not a band the layout imposes. */
  function expectAdjacent(el: UIAgentAdminElement): { copilot: DOMRect; settings: DOMRect } {
    const { copilot, settings } = regionsOf(el)
    const c = copilot.getBoundingClientRect()
    const s = settings.getBoundingClientRect()
    for (const [label, box] of [
      ['copilot', c],
      ['settings', s],
    ] as const) {
      expect(box.width, `${label} region width — both must be genuinely painted, not display:none`).toBeGreaterThan(0)
      expect(box.height, `${label} region height`).toBeGreaterThan(0)
    }
    expect(s.right, 'settings sits start-side of the interview (PANE_ORDER: chat · settings · copilot)').toBeLessThanOrEqual(c.left + 1)
    expect(Math.abs(c.top - s.top), 'displacement is on the INLINE axis only').toBeLessThanOrEqual(1)
    return { copilot: c, settings: s }
  }

  const contains = (outer: DOMRect, inner: DOMRect): boolean =>
    inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1

  it('cl.3/#651 — a gate-ON Builder turn in the Co-pilot region repaints the settings rail WHILE the turn is still streaming ({settings, copilot} ⊆ shown)', async () => {
    const { el } = mountAgentAdminAt(1200) // wide — the entry default shows all three (LLD §16.2's OQ-D rec)
    await frames()

    // A scripted Builder turn that HOLDS the stream open after emitting its patch. `armPatchRunner` one
    // describe up runs to completion before the test can look, which can only prove the value landed at
    // SOME point; gating the generator is what makes "mid-turn" a measured claim instead of a hopeful one
    // (LLD §11 LLD-P7: "assert the value CHANGED during the stream, not after").
    let releaseTurn = (): void => {}
    const held = new Promise<void>((resolve) => (releaseTurn = resolve))
    let patchApplied = (): void => {}
    const applied = new Promise<void>((resolve) => (patchApplied = resolve))
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'patch' as const, patch: { values: { name: LIVE_FILL_NAME } } }
      // The consumer has taken the patch and written it by the time it asks for the next event.
      patchApplied()
      await held
      yield { kind: 'note' as const, note: 'Named it for you.' }
    }

    // Gate ON: arming the authoring flow is what opens the fence AND lands Co-pilot visible + primary
    // (LLD §16.2). At this wide mount `{settings, copilot} ⊆ shown` holds by the entry default alone — no
    // navigation is needed, or owed, for either region to be on screen.
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    await frames()

    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    expect(holder.getAttribute('data-primary'), 'the gate-ON turn runs in the Co-pilot region').toBe('copilot')
    const adjacent = expectAdjacent(el)

    // The field this turn will fill is the Agent section's `name`, in the settings rail — asserted to be
    // GEOMETRICALLY inside the settings region (not merely present in the DOM somewhere) and to not
    // already read the target value, so neither half of the proof can pass vacuously.
    const nameField = el.querySelector('ui-settings [name="name"]') as UITextFieldElement
    const editorOf = (): HTMLElement => nameField.querySelector('[data-part="editor"]') as HTMLElement
    expect(contains(adjacent.settings, nameField.getBoundingClientRect()), 'the name field is painted inside the settings rail').toBe(true)
    expect(nameField.getBoundingClientRect().width, 'and it is a real box, not a collapsed stub').toBeGreaterThan(0)
    expect(nameField.value, 'the target value is not already showing (anti-vacuous)').not.toBe(LIVE_FILL_NAME)
    expect(editorOf().textContent, 'nor is it already painted').not.toContain(LIVE_FILL_NAME)

    // Drive the turn through the Co-pilot region's OWN composer (cl.4 — per-pane composers), the real path.
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const composer = authoring.querySelector('ui-conversation-composer') as HTMLElement & { value: string; busy: boolean }
    composer.value = 'call it whatever you like'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()

    await applied
    await frames()

    // ── MID-TURN. The turn is genuinely still in flight: the composer's own in-flight lock (TKT-0034) is
    // still held and the closing note has not painted yet. Everything asserted below is therefore
    // happening WHILE the interview runs, which is the whole claim.
    expect(composer.busy, 'the turn is still streaming — the composer lock has not released').toBe(true)
    expect(authoring.textContent, 'the closing note has not been emitted yet').not.toContain('Named it for you.')

    // The rail PAINTED the patched value. Three independent reads, because the S1-b nesting bug proved a
    // green store read can sit on top of a blank region: the control's value, the contenteditable text a
    // user actually sees, and the box that text occupies inside the still-visible rail.
    expect(el.store!.get('name'), 'the draft store took the write (the fence applied it)').toBe(LIVE_FILL_NAME)
    expect(nameField.value, 'the control re-rendered the patched value').toBe(LIVE_FILL_NAME)
    expect(editorOf().textContent, 'and it is the RENDERED text, not just a property').toContain(LIVE_FILL_NAME)
    const midBox = nameField.getBoundingClientRect()
    expect(midBox.width, 'the repainted field still occupies a real box').toBeGreaterThan(0)
    expect(midBox.height).toBeGreaterThan(0)

    // …and the user never left Co-pilot to see it: both regions are still painted, adjacent.
    expect(holder.getAttribute('data-primary'), 'no visibility change was needed to see the fill').toBe('copilot')
    const stillAdjacent = expectAdjacent(el)
    expect(contains(stillAdjacent.settings, midBox), 'the repainted field is still inside the settings rail').toBe(true)

    // Let the turn finish — the interview's own reply lands in the interview, the rail keeps the value.
    releaseTurn()
    await el.updateComplete
    await frames()
    const bubble = authoring.querySelector('[data-role="agent"] [data-part="body"]') as HTMLElement
    expect(bubble.textContent, 'the closing note painted in the interview, not the test chat').toContain('Named it for you.')
    expect(nameField.value, 'the filled value survives the turn ending').toBe(LIVE_FILL_NAME)
    expectAdjacent(el)
  })
})

// ── GH #662 (S6) / GH #686's Amendment (S7-b) — the WIDE band: [chat | settings | copilot] side by side ──
// Four things are proven here and nowhere else, because all four are questions only a real engine can
// answer: WHERE the wide band starts (a measured line, not an assumed one), that the three columns still
// hold their content there (the 20ch engagement floor, per region, in that region's own type — the S7-b
// density RE-MEASURE, LLD §16.2's own booking), that nothing paints a rule between the top-level regions
// (Kim's 2026-08-10 addition, carried over — regions separate by spacing and surface alone), and that a
// resize crossing the line writes no state (the shell family's own-container-width law — a band matrix
// proof, not merely a line proof).
describe('ui-agent-admin — the wide band (GH #662, re-ruled by GH #686\'s Amendment: a shown-SET, not a fixed triple)', () => {
  const frames = async (n = 3): Promise<void> => {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
  }

  /** The band line is `SHELL_COMPACT_BREAKPOINT` (52.5rem = 840px, ADR-0150/0155) measured on the pane
   *  HOLDER's own inline-size — the shell family's own-container-width law, never the viewport. The canvas
   *  the holder sits in adds one `--ui-agent-admin-shell-gutter` per side (12px, measured), so `line + 24`
   *  is the honest outer mount that puts the holder exactly ON the line; each test asserts that rather
   *  than trusting the arithmetic. `TRIPLE_BELOW` is two CSS px under it — the tightest honest "just below"
   *  probe, which is what makes the band a LINE and not a vibe. */
  const TRIPLE_LINE = 840
  const TRIPLE_AT = TRIPLE_LINE + 24
  const TRIPLE_BELOW = TRIPLE_AT - 2

  /** GH #665/#673's composer-internal `21rem` compact line lives on the COMPOSER's own inline-size
   *  (conversation-composer.css's own container, content-box — padding-excluded), never the chat column's.
   *  Under the RETIRED flex-2:1 pairing, a 1200px outer mount put chat at ~393px (the ADR's own density
   *  table), clearing the composer's threshold with room; GH #686's Amendment's equal-thirds geometry gives
   *  chat marginally LESS at the identical 1200px outer mount (~385px, measured — a real, honest consequence
   *  of three equal shares instead of one enlarged one), which lands the composer's OWN content-width just
   *  under 21rem and compacts it — a real behavior delta this slice surfaces, not a bug in either law.
   *  `WIDE_COMPOSER_MOUNT` is a deliberately wider outer mount for the two probes that specifically need
   *  the composer's OWN full/uncompacted state to compare against, chosen with real measured margin (chat
   *  ~484px, composer content clears 21rem by ~80px) rather than reusing the arbitrary `1200` literal every
   *  other "wide" probe in this file uses for its own, unrelated claims. */
  const WIDE_COMPOSER_MOUNT = 1500

  function twentyCh(region: HTMLElement): number {
    const probe = document.createElement('div')
    probe.style.inlineSize = '20ch'
    probe.style.position = 'absolute'
    region.append(probe)
    const used = probe.getBoundingClientRect().width
    probe.remove()
    expect(used, 'the ch floor resolves to real px in this region').toBeGreaterThan(0)
    return used
  }

  const partsOf = (el: UIAgentAdminElement): { holder: HTMLElement; chat: HTMLElement; author: HTMLElement; settings: HTMLElement } => ({
    holder: el.querySelector('[data-part="pane-holder"]') as HTMLElement,
    chat: el.querySelector('[data-part="chat-pane"]') as HTMLElement,
    author: el.querySelector('[data-part="copilot-pane"]') as HTMLElement,
    settings: el.querySelector('[data-part="settings-pane"]') as HTMLElement,
  })

  /** Mount ARMED — the interview is lazy, so an unarmed measurement would be grading the empty state's
   *  roominess instead of the composed triple's. Arming also lands Co-pilot primary (LLD §16.2's own
   *  "ensure copilot ∈ shown + primary = 'copilot'" line), which is deliberately NOT corrected here: at the
   *  triple line `data-primary` must stop deciding what paints (only `data-show` does), and leaving primary
   *  on Co-pilot is what puts that under test. */
  async function mountTripleAt(outer: number): Promise<UIAgentAdminElement> {
    const { el } = mountAgentAdminAt(outer)
    await frames()
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    await frames()
    return el
  }

  it('AT the 52.5rem line: all three regions paint side by side, in PANE_ORDER, on the inline axis alone', async () => {
    const el = await mountTripleAt(TRIPLE_AT)
    const { holder, chat, author, settings } = partsOf(el)
    expect(holder.getBoundingClientRect().width, 'the holder is ON the named line, not merely above it').toBeCloseTo(TRIPLE_LINE, 0)

    const boxes = [chat, author, settings].map((r) => r.getBoundingClientRect())
    for (const [i, label] of ['chat', 'copilot', 'settings'].entries()) {
      expect(boxes[i]!.width, `${label} has a real box in the triple`).toBeGreaterThan(0)
      expect(boxes[i]!.height, `${label} height`).toBeGreaterThan(0)
    }
    // PANE_ORDER's reading order, and displacement on the INLINE axis only (the ledgered screen-x/
    // displacement idiom).
    expect(boxes[0]!.right, 'chat is start-side of settings').toBeLessThanOrEqual(boxes[2]!.left + 1)
    expect(boxes[2]!.right, 'settings is start-side of copilot').toBeLessThanOrEqual(boxes[1]!.left + 1)
    for (const i of [1, 2]) expect(Math.abs(boxes[i]!.top - boxes[0]!.top), 'all three are top-aligned').toBeLessThanOrEqual(1)

    // `data-primary` still says Co-pilot (the arm's own doing). That the OTHER two regions paint anyway is
    // the whole Amendment: at this band `data-primary` names a region, `data-show` is what gates painting.
    expect(holder.getAttribute('data-primary')).toBe('copilot')
    expect(holder.getAttribute('data-show')?.split(' ').sort()).toEqual(['chat', 'copilot', 'settings'])
  })

  it('TWO PIXELS BELOW the line: the band collapses to exactly the PRIMARY region — the ladder is a line, not a slope', async () => {
    const el = await mountTripleAt(TRIPLE_BELOW)
    const { holder, chat, author, settings } = partsOf(el)
    expect(holder.getBoundingClientRect().width).toBeCloseTo(TRIPLE_LINE - 2, 0)
    // `data-primary` is Co-pilot (the arm), so it paints alone and the other two contribute no box.
    expect(getComputedStyle(chat).display, 'the Chat region has no box below the line').toBe('none')
    expect(chat.getBoundingClientRect().width).toBe(0)
    expect(getComputedStyle(settings).display, 'the Settings region has no box below the line either').toBe('none')
    expect(settings.getBoundingClientRect().width).toBe(0)
    expect(author.getBoundingClientRect().width, 'and Co-pilot takes the whole holder').toBeCloseTo(TRIPLE_LINE - 2, 0)

    // …and the same visibility change still works below the line: Chat solo, Co-pilot gone.
    goToPlace(el, 'Chat')
    await frames()
    expect(getComputedStyle(author).display).toBe('none')
    expect(chat.getBoundingClientRect().width).toBeCloseTo(TRIPLE_LINE - 2, 0)
  })

  // LLD §16.4 S7-b's own done-when: "browser band matrix (wide subsets paint, narrow paints primary
  // alone)" AND "no state written on resize". A real subset — not the entry-default's all-three — proven
  // at BOTH bands with the SAME shown-set/primary state via a REAL resize (never two separate mounts), so
  // both claims land on one continuous, honest measurement.
  it('band matrix + no-state-on-resize: a real SUBSET ({chat, copilot}, settings excluded) paints both members wide and only the primary narrow — data-show/data-primary never change across the crossing', async () => {
    const el = await mountTripleAt(TRIPLE_AT) // wide — clears the 52.5rem line
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    const { chat, author, settings } = partsOf(el)
    ;(el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }).setPaneVisibilitySeam(
      ['chat', 'copilot'],
      'chat',
    )
    await frames()
    const before = { show: holder.getAttribute('data-show'), primary: holder.getAttribute('data-primary') }
    expect(before).toEqual({ show: 'chat copilot', primary: 'chat' })

    // WIDE: both shown members paint, the excluded one (settings) does not.
    expect(getComputedStyle(chat).display, 'chat paints — a shown member').not.toBe('none')
    expect(getComputedStyle(author).display, 'copilot paints — a shown member').not.toBe('none')
    expect(getComputedStyle(settings).display, 'settings does NOT paint — excluded from the shown set').toBe('none')
    expect(chat.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(author.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(settings.getBoundingClientRect().width).toBe(0)

    // A REAL resize, narrow — the same wrapper `mountAgentAdminAt` sized, driving the real container query.
    const wrapper = el.parentElement as HTMLElement
    wrapper.style.width = '500px'
    await frames()
    expect(holder.getAttribute('data-show'), 'a wide→narrow crossing writes NOTHING to data-show').toBe(before.show)
    expect(holder.getAttribute('data-primary'), 'nor to data-primary').toBe(before.primary)
    // NARROW: only the primary (chat) paints — copilot, though still shown, does not (the narrow band
    // reads `data-primary` alone, LLD §16.2).
    expect(getComputedStyle(chat).display, 'chat (primary) paints narrow').not.toBe('none')
    expect(getComputedStyle(author).display, 'copilot (shown, not primary) has no box narrow').toBe('none')
    expect(chat.getBoundingClientRect().width, 'and it takes the whole holder').toBeCloseTo(500 - 24, 0)

    // Back wide — restored losslessly, and still no state written.
    wrapper.style.width = `${TRIPLE_AT}px`
    await frames()
    expect(holder.getAttribute('data-show'), 'a narrow→wide crossing back writes nothing either').toBe(before.show)
    expect(holder.getAttribute('data-primary')).toBe(before.primary)
    expect(getComputedStyle(author).display, 'the shown set is restored losslessly — copilot paints again').not.toBe('none')
    expect(getComputedStyle(settings).display, 'settings — never in the shown set — stays unpainted throughout').toBe('none')
  })

  // GH #686's Amendment (LLD §16.2's own booking) — the RE-MEASURE this slice owes: the first Amendment's
  // density table (200/320/320 under the retired `flex 2:1` + MD-40rem-floor arrangement) does not carry
  // over as evidence for the new EQUAL-THIRDS geometry (a plain row `gap`, no per-region flex weighting).
  // Both bands below the line's own name (52.5rem, unchanged — the only named line available, ADR-0150/
  // 0155) and one comfortably above it, so the table reads as a real measurement, not a single data point.
  for (const outer of [TRIPLE_AT, 1200]) {
    it(`density at holder ${outer - 24}px: all THREE columns are EQUAL width and clear the 20ch engagement floor`, async () => {
      const el = await mountTripleAt(outer)
      const { chat, author, settings } = partsOf(el)

      const boxes = { chat: chat.getBoundingClientRect(), copilot: author.getBoundingClientRect(), settings: settings.getBoundingClientRect() }
      // The equal-thirds claim itself — the wireframe's own "three regions, one geometry" reading, and the
      // reason a plain row `gap` replaced the old `flex: 2` pairing weight. Measured (both engines, both
      // bands): chat/copilot land within a shared fraction of a px of each other, settings a real but tiny
      // ~2px narrower — `flex-basis: 0` (a literal zero, not `0%`/`0px`) equalizes CONTENT-box shares among
      // flex siblings, so the two 1px-bordered `ui-conversation` regions (chat/copilot, border-box) end up
      // ~2px WIDER in their OUTER box than the borderless settings-pane once their content boxes match —
      // spec behavior (confirmed empirically: forcing `box-sizing: border-box` on settings-pane and toggling
      // its `overflow-y` both left the 2px unchanged), not a layout defect, and imperceptible against the
      // 20ch floor's own multi-hundred-pixel margin at this band.
      expect(Math.abs(boxes.chat.width - boxes.copilot.width), 'chat and copilot columns are equal width').toBeLessThanOrEqual(1)
      expect(Math.abs(boxes.copilot.width - boxes.settings.width), 'copilot and settings columns are equal width, within the flex-basis:0 content-box/border-box fraction').toBeLessThanOrEqual(2)

      // Per region, in that region's own type — the floor is content box ≥ 20ch, and nothing may "fit" by
      // spilling sideways instead.
      for (const [label, region] of [
        ['chat', chat],
        ['copilot', author],
        ['settings', settings],
      ] as const) {
        const cs = getComputedStyle(region)
        const content = region.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        expect(content, `${label} content width clears the 20ch floor`).toBeGreaterThan(twentyCh(region))
        expect(region.scrollWidth, `${label} holds its content without overflowing sideways`).toBeLessThanOrEqual(region.clientWidth + 1)
      }

      // The three columns' real occupants, each measured against its OWN intrinsic minimum (GH #74's 20ch
      // text-field floor).
      const chatComposer = chat.querySelector('ui-conversation-composer') as HTMLElement
      expect(chatComposer.getBoundingClientRect().width, 'the test composer clears its own 20ch minimum').toBeGreaterThan(twentyCh(chat))
      // GH #666 — the INTERVIEW's composer specifically (this probe mounts armed; the empty state's own
      // composer-first entry is the region's other, hidden one).
      const authorComposer = author.querySelector('ui-conversation-composer') as HTMLElement
      expect(authorComposer.getBoundingClientRect().width, 'the interview composer clears it too').toBeGreaterThan(twentyCh(author))
      // The ADR's own booked comparison: the settings name field's fit against the FIRST Amendment's table
      // (270px, measured under the retired arrangement) — that number does not carry over as evidence, so
      // this is a fresh, real-engine measurement of the SAME field, never an assumption.
      const nameField = el.querySelector('ui-settings [name="name"]') as UITextFieldElement
      const nameFieldWidth = nameField.getBoundingClientRect().width
      expect(nameFieldWidth, 'the rail’s name field clears its own 20ch minimum').toBeGreaterThan(twentyCh(settings))
      // eslint-disable-next-line no-console -- deliberate: the real-engine number this re-measure exists to produce, for the record (LLD §16.2's own booking)
      console.info(`[S7-b density] holder ${outer - 24}px: chat ${boxes.chat.width.toFixed(0)} / copilot ${boxes.copilot.width.toFixed(0)} / settings ${boxes.settings.width.toFixed(0)}, name field ${nameFieldWidth.toFixed(0)}px (old table's own booked comparison: 270px)`)
    })
  }

  it('at the top level, the three sibling regions have NO separator element at all — spacing alone, never a rule to unpaint', async () => {
    // GH #686's Amendment (LLD §16.5) — the top-level `ui-master-detail`/`ui-split` retires with the
    // pairing vehicle: there is no separator DOM between chat/settings/copilot any more (a plain flex
    // `gap`, agent-admin.css), so "no painted divider" is true at the top level by construction now, not
    // by a token repoint. Scoped to DIRECT children of the holder: `ui-settings`' own nested rail|panel
    // split (below) is a real, separate case this same law still has to hold for.
    const el = await mountTripleAt(1200)
    const { holder, author, settings } = partsOf(el)
    expect([...holder.children].some((c) => c.tagName.toLowerCase() === 'ui-split'), 'no split element is a direct child of the holder').toBe(false)
    const a = author.getBoundingClientRect()
    const s = settings.getBoundingClientRect()
    expect(a.left - s.right, 'the regions separate by the row gap alone (PANE_ORDER: settings before copilot)').toBeGreaterThan(0)
  })

  it('Kim’s 2026-08-10 addition, still binding for `ui-settings`\' own nested rail|panel split — NO painted divider, every resize mechanic intact', async () => {
    // `ui-settings`' own internal `ui-master-detail` only DOCKS once its own container clears 40rem — at
    // this element's realistic mount widths the settings region's own share of an equal-thirds holder never
    // reaches that on its own, so this probe mounts wide enough (holder share ≥ 40rem) to genuinely engage
    // the nested docked split the no-divider law has to hold for, rather than asserting against a narrow
    // drill-in that never renders an interactive separator at all.
    const { el } = mountAgentAdminAt(2100)
    await frames()
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    await frames()
    const settingsPane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const separators = [...settingsPane.querySelectorAll('ui-split > [data-separator]')] as HTMLElement[]
    expect(separators.length, 'the nested settings split really is docked, composing a separator to unpaint').toBeGreaterThan(0)

    for (const sep of separators) {
      const cs = getComputedStyle(sep)
      // The ink is RETRACTED, not the element: a fully transparent background and no border on any side.
      expect(cs.backgroundColor, 'the resting separator paints no fill').toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/)
      expect(cs.backgroundImage, 'nor a gradient standing in for one').toBe('none')
      for (const side of ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const) {
        expect(parseFloat(cs[side]), `no ${side} rule either`).toBe(0)
      }
      // …and the MECHANICS survive untouched (the retract-don't-delete pattern): the element is still a
      // real, focusable, grabbable separator with its ≥24px hit-slop.
      expect(sep.getAttribute('role')).toBe('separator')
      expect(sep.hasAttribute('tabindex')).toBe(true)
      expect(cs.cursor).toBe('col-resize')
      const slop = getComputedStyle(sep, '::before')
      expect(parseFloat(slop.insetInlineStart), 'the invisible hit-slop still expands past the track').toBeLessThan(0)
    }
  })

  // GH #665 — the four screenshot defects, each pinned by its own probe (extending the screen-x/
  // displacement idiom above rather than re-deriving it): a shared CONTENT top line (not merely the
  // region boxes', which the AT-the-line test above already covers), gutter equality between the two
  // inter-column seams, a visible identity kicker per conversation, and no mid-word composer-label crush.
  //
  // `screens:layout-checker` finding 2 folded in here: the probe compares TEXT rects (kicker
  // padding-top offset), not just box tops — box-true/text-false was the finding's own bug. Finding 1's
  // third "Settings" kicker was built, then OVERRULED by Kim (2026-08-10, GH #665 follow-up): the
  // sub-nav labels the settings column itself; the TWO conversation kickers are the labeling system.
  it('a shared CONTENT top line: the two conversation kickers land their TEXT on the same y, and the settings column carries NO kicker', async () => {
    const el = await mountTripleAt(1200)
    const { chat, author, settings } = partsOf(el)
    const chatKicker = chat.querySelector('[data-part="region-kicker"]') as HTMLElement
    const authorKicker = author.querySelector('[data-part="region-kicker"]') as HTMLElement
    expect(settings.querySelector('[data-part="region-kicker"]'), "Kim's overrule: no Settings kicker — the sub-nav is the label").toBeNull()

    const textTop = (el: HTMLElement): number => el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop)
    expect(Math.abs(textTop(authorKicker) - textTop(chatKicker)), "the interview kicker's TEXT lands on the test chat kicker's").toBeLessThanOrEqual(1)

    // …and BENEATH the kickers, the two conversation logs still share a bottom rhythm with each other.
    const chatLog = chat.querySelector('[data-part="log"]') as HTMLElement
    const authorLog = author.querySelector('[data-part="log"]') as HTMLElement
    expect(Math.abs(chatLog.getBoundingClientRect().top - authorLog.getBoundingClientRect().top), 'the two conversation logs align with each other, below their shared kicker line').toBeLessThanOrEqual(1)
  })

  // `screens:layout-checker` finding 4 (SHIPPABLE grade, MINOR) — the kicker's own trailing edge must NOT
  // double the rhythm the region's own next content already supplies (the log's `--ui-conversation-log-
  // pad`, or the settings pane's own flex `gap`): the gap from the card's own border to the kicker's TEXT
  // (one layer) must read the SAME as the gap from the kicker's text to the next real content (also one
  // layer), not twice it.
  it('one rhythm, not two: the gap above each kicker matches the gap below it', async () => {
    const el = await mountTripleAt(1200)
    const { chat, author } = partsOf(el)
    for (const [label, card, kicker, next] of [
      ['chat', chat, chat.querySelector('[data-part="region-kicker"]') as HTMLElement, chat.querySelector('[data-part="log"]') as HTMLElement],
      ['author', author, author.querySelector('[data-part="region-kicker"]') as HTMLElement, author.querySelector('[data-part="log"]') as HTMLElement],
      // settings row removed — Kim's 2026-08-10 overrule: no Settings kicker; the sub-nav's own
      // placement is pinned by the pane's flex gap, not a kicker rhythm.
    ] as const) {
      const cardTop = card.getBoundingClientRect().top
      const kickerTextTop = kicker.getBoundingClientRect().top + parseFloat(getComputedStyle(kicker).paddingTop)
      const aboveGap = kickerTextTop - cardTop
      // The kicker's own box bottom is what the region's next content butts against — assert THAT gap
      // reads close to the gap above the kicker's text, not doubled (the pre-fix defect measured a real
      // 2× stack here: 32px below vs 16px above).
      const belowGap = next.getBoundingClientRect().top - kicker.getBoundingClientRect().bottom
      expect(aboveGap, `${label}: a real gap above the kicker's text`).toBeGreaterThan(4)
      expect(belowGap, `${label}: the gap below the kicker's box reads as ONE rhythm with the gap above its text, not doubled`).toBeLessThanOrEqual(aboveGap + 2)
    }
  })

  // `screens:layout-checker` finding 3's own header-seam concern was MOOT only for as long as `header`
  // composed nothing (S7-b): with no authored `data-slot="header"` child, `ui-super-shell` never created
  // the `[data-part='bar'][data-bar='header']` box at all (super-shell.ts's own guard), so there was no
  // seam border to have an opinion about. S7-c composes a real header — the box exists now, and
  // ADR-0166 cl.2's blanket seam rule (every `[data-bar='header']` box carries a border-block-end,
  // unconditionally) applies to it exactly like every other shell-archetype consumer's header.
  it('S7-c\'s real header composes a real bar box, carrying the fleet\'s own header seam border (ADR-0166 cl.2)', async () => {
    const el = await mountTripleAt(1200)
    const shell = el.querySelector('ui-super-shell') as HTMLElement
    const bar = shell.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    expect(bar, 'the header bar box exists — this element authors a real data-slot="header" child now').not.toBeNull()
    expect(parseFloat(getComputedStyle(bar).borderBottomWidth), 'the shell-archetype header seam paints').toBeGreaterThan(0)
  })

  it('gutter equality: the chat↔settings gap and the settings↔copilot gap read as ONE rhythm, not two', async () => {
    const el = await mountTripleAt(1200)
    const { chat, author, settings } = partsOf(el)
    // PANE_ORDER: chat, settings, copilot — the region boxes themselves (not nested content) are the
    // honest measurement, since `settings-pane` carries no leading/trailing padding of its own any more
    // (the row `gap` is the WHOLE inter-column story now, LLD §16.1's three-sibling design).
    const chatBox = chat.getBoundingClientRect()
    const settingsBox = settings.getBoundingClientRect()
    const copilotBox = author.getBoundingClientRect()
    const chatSettingsGap = settingsBox.left - chatBox.right
    const settingsCopilotGap = copilotBox.left - settingsBox.right
    expect(chatSettingsGap, 'a real, positive gutter — not a coincidental zero').toBeGreaterThan(0)
    expect(Math.abs(chatSettingsGap - settingsCopilotGap), 'the two inter-column gaps equal (±1, rounding)').toBeLessThanOrEqual(1)
  })

  it('each conversation region carries its own visible identity kicker — the test chat and the Builder interview no longer read as two identical empty threads', async () => {
    const el = await mountTripleAt(1200)
    const { chat, author } = partsOf(el)
    const chatKicker = chat.querySelector('[data-part="region-kicker"]') as HTMLElement
    const authorKicker = author.querySelector('[data-part="region-kicker"]') as HTMLElement
    expect(chatKicker.getBoundingClientRect().height, 'the test chat kicker paints').toBeGreaterThan(0)
    expect(authorKicker.getBoundingClientRect().height, 'the interview kicker paints').toBeGreaterThan(0)
    expect(chatKicker.textContent?.trim()).not.toBe('')
    expect(authorKicker.textContent?.trim()).not.toBe('')
    expect(chatKicker.textContent, 'the two regions read as DIFFERENT identities').not.toBe(authorKicker.textContent)
    // The kicker sits BEFORE the log in reading order — an identity header, not a trailing caption.
    expect(chatKicker.compareDocumentPosition(chat.querySelector('[data-part="log"]') as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // GH #665 (Kim's ruling, superseding this describe block's own first pass — a full-label-never-crushes
  // assertion): at the triple's own tightest column the composer's action row has no room for two
  // full-width picker labels beside Send, and Kim's ruling is explicit — "no horizontal scrolling in the
  // action row, ever." The triggers collapse to icon-only (conversation-composer.css's own `21rem`
  // container query) instead: never a scroll, never a mid-word crush, and — the actual named acceptance —
  // the row's own scrollWidth never exceeds its clientWidth at this band, while the MENU POPUP (never
  // queried by the same container, a real ui-menu overlay in the top layer) keeps full labels regardless.
  it('the composer’s Models/Effort pickers compact to icon-only at the triple’s own tightest column — no row overflow, popup labels intact', async () => {
    const el = await mountTripleAt(TRIPLE_AT) // the narrowest real triple — the density table's own binding band
    const { chat } = partsOf(el)
    const composer = chat.querySelector('ui-conversation-composer') as HTMLElement
    const options = composer.querySelector('[data-part="options"]') as HTMLElement
    // The named acceptance, verbatim: NO overflow in the action row at this band.
    expect(options.scrollWidth, 'the action row fits its own rail — no horizontal scroll ever').toBeLessThanOrEqual(options.clientWidth)

    const modelsTrigger = composer.querySelector('[data-picker="models"]') as HTMLElement
    const effortTrigger = composer.querySelector('[data-picker="effort"]') as HTMLElement
    for (const [name, trigger] of [['Models', modelsTrigger], ['Effort', effortTrigger]] as const) {
      const label = trigger.querySelector('[data-part="label"]') as HTMLElement
      expect(label.getBoundingClientRect().width, `${name} trigger's label is fully collapsed (icon-only), not crushed to a sliver`).toBe(0)
      const icon = trigger.querySelector('[slot="leading"]') as HTMLElement
      expect(icon.getBoundingClientRect().width, `${name} trigger keeps its leading identity glyph`).toBeGreaterThan(0)
      // The accessible name survives compaction — the label's own text stays in the light DOM, merely
      // zero-width, never removed (screen-reader parity: "Haiku 4.5" either way).
      expect(label.textContent?.trim(), `${name} trigger keeps a real accessible name`).not.toBe('')
    }

    // The popup itself — a SEPARATE ui-menu overlay, never inside the composer's own container-query
    // subject — is untouched: opening it still shows full, un-collapsed option labels.
    const modelsMenu = composer.querySelector('[data-part="models-menu"]') as HTMLElement & { open: boolean }
    modelsMenu.open = true
    await el.updateComplete
    const firstItem = modelsMenu.querySelector('[role="menuitem"]') as HTMLElement | null
    expect(firstItem, 'the popup opens with real items').not.toBeNull()
    expect(firstItem!.textContent?.trim(), 'the popup itself never compacts — full labels regardless of the trigger').not.toBe('')
    modelsMenu.open = false
  })

  // GH #680 — the ghost-gap fix: `button.css`'s `:has(> [slot='leading']):has(> [slot='trailing'])`
  // structural rule keys off DOM PRESENCE, not paintedness (button.css:213-218), so it stays matched at
  // this same compacted band and the trigger keeps its 3-column `auto 1fr auto` template — without the
  // `--ui-button-gap` repoint (conversation-composer.css's `@container` block) the two now-empty seams
  // (icon⟷label, label⟷trailing) would still carry `column-gap`, inflating the box past a real
  // `[icon-only]` footprint. Proven against a GENUINE icon-only button (send — always present,
  // unlike mic which stays `[hidden]` until a consumer calls `onMicClick`, conversation-composer.ts:180
  // — same unset/default `md` size class) rather than a declared value, and the un-compacted (>=21rem)
  // trigger's real gap is checked unregressed in the same pass.
  it('the compacted picker trigger has no ghost grid gap — its box matches a true icon-only button, mic/send unregressed', async () => {
    const el = await mountTripleAt(TRIPLE_AT)
    const { chat } = partsOf(el)
    const composer = chat.querySelector('ui-conversation-composer') as HTMLElement
    const modelsTrigger = composer.querySelector('[data-picker="models"]') as HTMLElement
    const sendBtn = composer.querySelector('[data-part="send"]') as HTMLElement

    // The resolved column-gap is genuinely zero — a real engine resolving the repointed token, not a
    // declared value (the "column-gap is the mechanism" idiom, this file's own #74 precedent above).
    const gap = Number.parseFloat(getComputedStyle(modelsTrigger).columnGap)
    expect(gap, 'the compacted trigger carries zero column-gap — no ghost seam').toBe(0)

    // Byte-close to a real icon-only button at the same (default, unset) size class — no residual width
    // from the now-hidden label/trailing tracks.
    const triggerBox = modelsTrigger.getBoundingClientRect()
    const sendBox = sendBtn.getBoundingClientRect()
    expect(triggerBox.width, 'the compacted trigger is as wide as a true icon-only button — no ghost width').toBeCloseTo(sendBox.width, 0)
    expect(triggerBox.height, 'the compacted trigger is as tall as a true icon-only button').toBeCloseTo(sendBox.height, 0)

    // Unregressed: at full width the trigger keeps its real inter-adornment rhythm (the fix is scoped
    // to the `@container` compact block only, never touching the un-compacted state).
    const wideEl = await mountTripleAt(WIDE_COMPOSER_MOUNT)
    const wideComposer = partsOf(wideEl).chat.querySelector('ui-conversation-composer') as HTMLElement
    const wideTrigger = wideComposer.querySelector('[data-picker="models"]') as HTMLElement
    const wideGap = Number.parseFloat(getComputedStyle(wideTrigger).columnGap)
    expect(wideGap, 'the full-width trigger keeps its real label/caret gap, unregressed').toBeGreaterThan(0)

    // mic/send themselves are genuinely icon-only and were never touched by this fix — unregressed here too.
    const micBtn = composer.querySelector('[data-part="mic"]') as HTMLElement
    expect(getComputedStyle(micBtn).columnGap, 'mic stays column-gap-free (a real icon-only button, untouched by this fix)').toBe('normal')
    expect(getComputedStyle(sendBtn).columnGap, 'send stays column-gap-free too').toBe('normal')
  })

  // GH #673 — the inverse case: at FULL width (well above the composer's own 21rem line) the label is
  // visible, so the leading identity glyph is redundant beside it and must be gone — not merely invisible
  // structurally-but-painted, a real zero-size box — while the trailing caret still lands FLUSH on the
  // trigger's own trailing edge (the real risk this fix carries: `display:none`ing the FIRST grid item of
  // button.css's three-column `[leading|label|trailing]` template removes it from placement entirely, and
  // without an explicit `grid-column` pin auto-placement would slide label/caret one column left, pulling
  // the caret off the trailing edge — conversation-composer.css's own comment on the pin names this).
  it('the composer’s Models/Effort/Provider/Mode pickers show NO leading icon at full width — label + trailing caret only, caret still flush on the trailing edge', async () => {
    const el = await mountTripleAt(WIDE_COMPOSER_MOUNT)
    const { chat } = partsOf(el)
    const composer = chat.querySelector('ui-conversation-composer') as HTMLElement

    const modelsTrigger = composer.querySelector('[data-picker="models"]') as HTMLElement
    const effortTrigger = composer.querySelector('[data-picker="effort"]') as HTMLElement
    for (const [name, trigger] of [['Models', modelsTrigger], ['Effort', effortTrigger]] as const) {
      const icon = trigger.querySelector('[data-role="icon"]') as HTMLElement
      expect(icon, `${name} trigger still carries the icon in the light DOM (GH #665's a11y-stable shape, unregressed)`).not.toBeNull()
      expect(getComputedStyle(icon).display, `${name} trigger's leading icon is not painted at full width`).toBe('none')
      expect(icon.getBoundingClientRect().width, `${name} trigger's leading icon occupies no visual space at full width`).toBe(0)

      const label = trigger.querySelector('[data-part="label"]') as HTMLElement
      expect(label.getBoundingClientRect().width, `${name} trigger's label is fully visible at full width`).toBeGreaterThan(0)
      expect(label.textContent?.trim(), `${name} trigger still names the picker`).not.toBe('')

      const caret = trigger.querySelector('[data-role="caret"]') as HTMLElement
      const triggerRect = trigger.getBoundingClientRect()
      const caretRect = caret.getBoundingClientRect()
      expect(caretRect.width, `${name} trigger's trailing caret is real and painted at full width`).toBeGreaterThan(0)
      // Flush on the trailing edge, not slid left into the label's own track (the grid-column-pin regression
      // this test exists to catch) — within the trigger's own icon-cell inset, never past mid-trigger.
      expect(triggerRect.right - caretRect.right, `${name} trigger's caret sits at the trailing edge, not mid-row`).toBeLessThan(triggerRect.width / 2)
      expect(caretRect.left, `${name} trigger's caret is start-side of the trigger's OWN trailing edge`).toBeGreaterThan(triggerRect.left)
    }
  })

  // GH #665 (Kim's live-screenshot follow-on) — the kicker's own rect must inset from ui-conversation's
  // real, painted border on BOTH axes (not the flush 0/0 the earlier build shipped), and it must not have
  // MOVED the kicker's own box position (the padding-not-margin choice this same fix made, so the
  // cross-column shared-top-line probe above stays true unmodified).
  it('each region kicker insets from its card border on both axes — never flush, never clipped', async () => {
    const el = await mountTripleAt(1200)
    const { chat, author } = partsOf(el)
    for (const [label, region] of [['chat', chat], ['author', author]] as const) {
      const kicker = region.querySelector('[data-part="region-kicker"]') as HTMLElement
      const cs = getComputedStyle(kicker)
      expect(parseFloat(cs.paddingInlineStart), `${label} kicker insets on the inline axis`).toBeGreaterThan(4)
      expect(parseFloat(cs.paddingBlockStart), `${label} kicker insets on the block axis`).toBeGreaterThan(4)
      // Both regions read the SAME inset — one shared card-content rhythm, not a per-region guess.
    }
    const chatPad = getComputedStyle(chat.querySelector('[data-part="region-kicker"]') as HTMLElement)
    const authorPad = getComputedStyle(author.querySelector('[data-part="region-kicker"]') as HTMLElement)
    expect(chatPad.paddingInlineStart).toBe(authorPad.paddingInlineStart)
    expect(chatPad.paddingBlockStart).toBe(authorPad.paddingBlockStart)
  })

  // GH #665's convention, re-anchored by GH #686's Amendment (LLD §16.5) — the settings region OWNS its
  // own scroll now (no more wrapping `ui-split-pane`, agent-admin.css's `overflow-y: auto` directly on
  // `[data-part="settings-pane"]`), and still hides the OS/engine scrollbar chrome per the fleet's
  // app-chrome convention. Functional scroll survives untouched (the agent-admin-app-scroll.browser.test.ts
  // idiom: a real scrollTop write reaches real overflowing content) — only the scrollbar chrome goes.
  it('the settings region hides its own scrollbar (the fleet app-chrome convention) — scrolling itself stays fully functional', async () => {
    const el = await mountTripleAt(1200)
    const settingsPane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    expect(getComputedStyle(settingsPane).scrollbarWidth, 'the OS/engine scrollbar chrome is hidden').toBe('none')
    // Force real overflow (the settings content at the default 600px test height may or may not already
    // overflow) so the functional-scroll write is never vacuous.
    settingsPane.style.maxBlockSize = '100px'
    await frames()
    expect(settingsPane.scrollHeight, 'anti-vacuous: there is real overflowing content to reach').toBeGreaterThan(settingsPane.clientHeight)
    settingsPane.scrollTop = 99999
    expect(settingsPane.scrollTop, 'the region genuinely scrolls to reach the overflowing content — hiding the chrome never disabled scrolling').toBeGreaterThan(0)
  })

  it('the LIVE-FILL gate at TRIPLE (PR #659’s proof, extended to three-region liveness)', async () => {
    // #659 proved the pair: a held-open Builder turn repaints the docked rail while it streams. The triple
    // owes one more thing — that the third region is not collateral. The test chat must still be PAINTED,
    // with a real box, throughout a turn it has nothing to do with.
    const { el } = mountAgentAdminAt(1200)
    await frames()

    let releaseTurn = (): void => {}
    const held = new Promise<void>((resolve) => (releaseTurn = resolve))
    let patchApplied = (): void => {}
    const applied = new Promise<void>((resolve) => (patchApplied = resolve))
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'patch' as const, patch: { values: { name: LIVE_FILL_NAME } } }
      patchApplied()
      await held
      yield { kind: 'note' as const, note: 'Named it for you.' }
    }

    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    await frames()

    const { chat, author, settings } = partsOf(el)
    const chatBefore = chat.getBoundingClientRect()
    expect(chatBefore.width, 'all three regions paint before the turn starts').toBeGreaterThan(0)
    for (const [label, r] of [
      ['author', author],
      ['settings', settings],
    ] as const) {
      expect(r.getBoundingClientRect().width, `${label} paints too`).toBeGreaterThan(0)
    }

    const nameField = el.querySelector('ui-settings [name="name"]') as UITextFieldElement
    const editorOf = (): HTMLElement => nameField.querySelector('[data-part="editor"]') as HTMLElement
    expect(nameField.value, 'anti-vacuous: the target value is not already showing').not.toBe(LIVE_FILL_NAME)

    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    expect(authoring.getBoundingClientRect().width, 'the interview itself is painted, not merely mounted').toBeGreaterThan(0)
    const composer = authoring.querySelector('ui-conversation-composer') as HTMLElement & { value: string; busy: boolean }
    composer.value = 'call it whatever you like'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()

    await applied
    await frames()

    // MID-TURN — the composer lock is still held, so everything below is happening while it streams.
    expect(composer.busy, 'the turn is still streaming').toBe(true)
    expect(authoring.textContent, 'the closing note has not landed yet').not.toContain('Named it for you.')

    // (1) the interview paints, (2) the rail's field fills — the three independent reads plus its rect,
    // and (3) the test chat's region stays painted at its own unchanged size. Three-region liveness.
    expect(authoring.getBoundingClientRect().width, 'the interview is still painted mid-turn').toBeGreaterThan(0)
    expect(el.store!.get('name'), 'the draft store took the write').toBe(LIVE_FILL_NAME)
    expect(nameField.value, 'the control re-rendered it').toBe(LIVE_FILL_NAME)
    expect(editorOf().textContent, 'and it is the RENDERED text').toContain(LIVE_FILL_NAME)
    const midBox = nameField.getBoundingClientRect()
    expect(midBox.width, 'the repainted field occupies a real box').toBeGreaterThan(0)
    expect(midBox.left, 'still inside the settings column').toBeGreaterThanOrEqual(settings.getBoundingClientRect().left - 1)
    const chatMid = chat.getBoundingClientRect()
    expect(chatMid.width, 'the test chat is still painted — the third region is not collateral').toBeGreaterThan(0)
    expect(Math.abs(chatMid.width - chatBefore.width), 'and it did not reflow around the streaming turn').toBeLessThanOrEqual(1)

    releaseTurn()
    await el.updateComplete
    await frames()
    const bubble = authoring.querySelector('[data-role="agent"] [data-part="body"]') as HTMLElement
    expect(bubble.textContent, 'the reply landed in the interview, not the test chat').toContain('Named it for you.')
    expect(chat.textContent, 'the test chat never saw the interview’s turn').not.toContain('Named it for you.')
    expect(chat.getBoundingClientRect().width, 'and it is still painted after the turn').toBeGreaterThan(0)
  })

  // GH #666 (Kim's live report: "this UI makes no sense — where am I supposed to describe it?", then his
  // REOPEN the same day: "the center pane should be a CHAT, just like Test chat") — the UNARMED third.
  // Every probe above mounts ARMED, which is exactly how the near-orphan survived review. Two claims have
  // to be proven with real pixels, because both are claims about what the column LOOKS like: the unarmed
  // Author column is the same card treatment as Test chat, and typing into it starts the interview.

  /** Mount UNARMED at the triple with a mint path registered — the live page's own posture before the user
   *  has described anything. */
  async function mountUnarmedTriple(): Promise<UIAgentAdminElement> {
    const { el } = mountAgentAdminAt(1200)
    await frames()
    el.onGenerateRequest(() => {
      el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    })
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'note' as const, note: 'Tell me more.' }
    }
    await el.updateComplete
    await frames()
    return el
  }

  const cardsOf = (el: UIAgentAdminElement): { test: HTMLElement; author: HTMLElement } => ({
    test: el.querySelector('[data-part="chat-pane"]') as HTMLElement,
    author: el.querySelector('[data-part="copilot-pane"]') as HTMLElement,
  })

  it('UNARMED at the triple: the Author column wears Test chat`s card treatment — same border, same kicker, same bottom-pinned composer', async () => {
    // Kim's reopen was a TREATMENT complaint ("a borderless prose block beside a bordered chat card"), so
    // the probe compares the two cards against EACH OTHER rather than against literals: whatever the fleet
    // paints on a conversation card, both columns must paint the same. Cross-card parity also survives a
    // token change, which a hard-coded 1px/12px assertion would not.
    const el = await mountUnarmedTriple()
    const { test, author } = cardsOf(el)
    expect(author.getBoundingClientRect().width, 'the unarmed Author third has a real box in the triple').toBeGreaterThan(0)

    const chrome = (node: HTMLElement): string[] => {
      const s = getComputedStyle(node)
      return [s.borderTopWidth, s.borderTopStyle, s.borderTopColor, s.borderRadius, s.backgroundColor, s.overflow]
    }
    expect(chrome(author), 'the unarmed Author card is chromed exactly like Test chat').toEqual(chrome(test))
    expect(getComputedStyle(author).borderTopWidth, 'anti-vacuous: the shared treatment is a REAL painted border').not.toBe('0px')

    const kickerOf = (card: HTMLElement): HTMLElement => card.querySelector('[data-part="region-kicker"]') as HTMLElement
    const kickerMetrics = (card: HTMLElement): (string | number)[] => {
      const kicker = kickerOf(card)
      const s = getComputedStyle(kicker)
      return [
        s.paddingTop,
        s.paddingLeft,
        s.fontSize,
        s.textTransform,
        s.color,
        // its inset from the card's own edges — the thing Kim reads as "the same header"
        Math.round(kicker.getBoundingClientRect().top - card.getBoundingClientRect().top),
        Math.round(kicker.getBoundingClientRect().left - card.getBoundingClientRect().left),
      ]
    }
    expect(kickerMetrics(author), 'and its BUILDER INTERVIEW kicker sits exactly where Test chat`s does').toEqual(kickerMetrics(test))
    expect([kickerOf(test).textContent, kickerOf(author).textContent]).toEqual(['Test chat', 'Builder interview'])

    // The composer is the card's OWN, pinned at its bottom — the same gap on both cards.
    const composerOf = (card: HTMLElement): HTMLElement => card.querySelector(':scope > ui-conversation-composer') as HTMLElement
    const bottomGap = (card: HTMLElement): number =>
      Math.round(card.getBoundingClientRect().bottom - composerOf(card).getBoundingClientRect().bottom)
    expect(composerOf(author).getBoundingClientRect().height, 'the Author card`s composer is PAINTED, not merely mounted').toBeGreaterThan(0)
    expect(Math.abs(bottomGap(author) - bottomGap(test)), 'both composers are pinned the same distance off the card floor').toBeLessThanOrEqual(1)
    expect(bottomGap(author), 'and that distance is an inset, not a floating block halfway up the column').toBeLessThan(40)

    // GH #684 (Kim's later live pixel-truth ruling) — the log itself carries no dedicated empty-state node
    // any more (the headline + copy the reopen's own idiom named are gone entirely): the unarmed log
    // simply paints nothing of its own until the first turn lands.
    const log = author.querySelector(':scope > [data-part="log"]') as HTMLElement
    expect(log.children.length, 'the unarmed log paints nothing of its own').toBe(0)
  })

  it('UNARMED at the triple: the first message arms the flow and FILLS the same card — the log goes from empty to holding the transcript', async () => {
    const el = await mountUnarmedTriple()
    const { author } = cardsOf(el)
    const composer = author.querySelector(':scope > ui-conversation-composer') as HTMLElement & { value: string }
    const cardBefore = author.getBoundingClientRect()
    const logBefore = author.querySelector(':scope > [data-part="log"]') as HTMLElement
    expect(logBefore.children.length, 'unarmed ⇒ the log starts empty').toBe(0)

    composer.value = 'a hotel concierge please'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()
    await el.updateComplete
    await frames()
    await el.updateComplete
    await frames()

    expect(el.authoringStore, 'the first message armed the flow').toBeDefined()
    expect(el.querySelector('[data-part="copilot-pane"]'), 'the SAME card — arming fills it, never swaps it').toBe(author)
    const after = author.getBoundingClientRect()
    expect(Math.abs(after.width - cardBefore.width), 'and the column does not jump').toBeLessThanOrEqual(1)
    expect(author.textContent, 'the description the user typed opened it — nothing swallowed').toContain('a hotel concierge please')
    const bubble = author.querySelector('[data-part="log"] [data-part="bubble"][data-role="user"]') as HTMLElement
    expect(bubble.getBoundingClientRect().height, 'as a painted turn in the log').toBeGreaterThan(0)
  })

  // GH #670 — the unarmed card had NO Model/Effort picker at all (the filing's measured table: `models` and
  // `efforts` both `undefined`, no menu parts), so the first-touch surface offered no choice. Two claims here
  // need real pixels rather than a prop read: that both pickers PAINT in the unarmed card exactly as they do
  // in the card beside it, and that a pick made through the real overlay survives all the way into the
  // interviewer the arm mints.
  it('UNARMED at the triple: the Model and Effort pickers PAINT in the Author card’s own composer, laid out exactly like Test chat’s', async () => {
    const el = await mountUnarmedTriple()
    const { test, author } = cardsOf(el)
    const composerOf = (card: HTMLElement): HTMLElement => card.querySelector(':scope > ui-conversation-composer') as HTMLElement

    // Compared against the sibling card rather than literals (this describe's own cross-card idiom): whatever
    // the fleet paints for a picker row, the unarmed entry must paint the same one. WIDTH is deliberately not
    // in the comparison — the unarmed Models trigger reads its neutral "Models" label where Test chat's names
    // a committed model, so the two pills are honestly different lengths. What must match is the ROW: same
    // pill height, same vertical seat inside the action row, same leading edge to start from.
    const pickerRow = (card: HTMLElement): (string | number)[] => {
      const composer = composerOf(card)
      const options = composer.querySelector('[data-part="options"]') as HTMLElement
      const row = options.getBoundingClientRect()
      const triggers = ['models', 'effort'].map((p) => composer.querySelector(`[data-picker="${p}"]`) as HTMLElement)
      return [
        ...triggers.map((t) => Math.round(t.getBoundingClientRect().height)),
        ...triggers.map((t) => Math.round(t.getBoundingClientRect().top - row.top)),
        Math.round(triggers[0]!.getBoundingClientRect().left - row.left),
      ]
    }
    for (const picker of ['models', 'effort'] as const) {
      const trigger = composerOf(author).querySelector(`[data-picker="${picker}"]`) as HTMLElement | null
      expect(trigger, `the unarmed card carries a real ${picker} trigger`).not.toBeNull()
      expect(trigger!.getBoundingClientRect().height, `and it is PAINTED, not merely mounted`).toBeGreaterThan(0)
      expect(trigger!.getBoundingClientRect().width, `with a real width, not a collapsed sliver`).toBeGreaterThan(0)
    }
    expect(pickerRow(author), 'the unarmed Author card’s picker row wears Test chat’s own row treatment').toEqual(pickerRow(test))
    expect(pickerRow(author)[0], 'anti-vacuous: a real painted height, not two matching zeroes').toBeGreaterThan(0)
    // …and they sit in reading order with a real gap, not stacked on one another.
    const [models, effort] = ['models', 'effort'].map((p) => composerOf(author).querySelector(`[data-picker="${p}"]`) as HTMLElement)
    expect(effort!.getBoundingClientRect().left, 'Effort follows Models along the row').toBeGreaterThan(models!.getBoundingClientRect().right)
  })

  it('UNARMED at the triple: a Model picked through the real overlay sticks, then SEEDS the interviewer the first message mints', async () => {
    const el = await mountUnarmedTriple()
    // The page's real mint path is SEED-AWARE (agent-admin-app.ts → `builderStore(seed?.model)`), so this
    // probe's stands in for it — last registration wins, and the shared helper's own is deliberately naive.
    el.onGenerateRequest((seed) => {
      el.authoringStore = createMemoryStore({
        initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder', ...(seed?.model === undefined ? {} : { model: seed.model }) },
      })
    })
    await el.updateComplete
    const { author } = cardsOf(el)
    const composer = author.querySelector(':scope > ui-conversation-composer') as HTMLElement & { value: string }
    const trigger = composer.querySelector('[data-picker="models"]') as HTMLElement
    const menu = composer.querySelector('[data-part="models-menu"]') as HTMLElement & { open: boolean }
    const before = trigger.textContent

    // Through the REAL overlay: open the popover, click the row. A prop write would prove the plumbing but
    // not that the choice is reachable with a pointer on the unarmed card.
    trigger.click()
    await el.updateComplete
    await frames()
    const rows = [...menu.querySelectorAll('[role="menuitem"]')] as HTMLElement[]
    expect(rows.length, 'the popup holds real options').toBeGreaterThan(1)
    const wanted = rows.find((r) => r.dataset.value !== undefined && r.textContent?.trim() !== before?.trim())!
    const picked = wanted.dataset.value!
    expect(wanted.getBoundingClientRect().height, 'the row the user aims at is genuinely painted').toBeGreaterThan(0)
    wanted.click()
    await el.updateComplete
    await frames()

    expect(trigger.textContent, 'the pick STICKS on the unarmed trigger — the write that used to evaporate').toContain(wanted.textContent!.trim())

    composer.value = 'a hotel concierge please'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()
    await el.updateComplete
    await frames()
    await el.updateComplete
    await frames()

    expect(el.authoringStore, 'the first message armed the flow').toBeDefined()
    expect(el.authoringStore!.get('model'), 'and the interviewer was MINTED on the user’s pick, not corrected into it').toBe(picked)
    expect(trigger.textContent, 'which the armed composer still shows').toContain(wanted.textContent!.trim())
  })
})

// GH #666's original scope-proximity trap (`[data-part='settings-pane']` losing to
// `master-detail-pane.css`'s own `:scope { display: block }`) cannot recur any more — GH #686's Amendment
// (LLD §16.5) retires the `ui-master-detail-pane` wrapper that competing scope belonged to; settings-pane
// is a plain, unwrapped div now, with no second sheet contesting its `display`. The regression this
// describe pins is narrower but still real and still worth a live measurement: the section gap this
// element's OWN CSS declares actually renders, at both bands.
describe('ui-agent-admin — the settings pane is a real flex column, so its declared section gap actually applies (GH #666, re-anchored by GH #686\'s Amendment)', () => {
  const frames = async (n = 3): Promise<void> => {
    for (let i = 0; i < n; i += 1) await new Promise((r) => requestAnimationFrame(() => r(null)))
  }

  // Both states: wide (part of the shown set alongside its siblings) and narrow (solo, as primary).
  for (const [label, width] of [
    ['wide', 1200],
    ['narrow', 700],
  ] as const) {
    it(`${label}: the sub-nav and the first section are separated by the pane's own section gap, not a hairline`, async () => {
      const { el } = mountAgentAdminAt(width)
      await frames()
      setPane(el, 'settings')
      await frames()

      const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
      const nav = el.querySelector('[data-part="settings-nav"]') as HTMLElement
      const section = [...pane.children].find((c) => c !== nav && !(c as HTMLElement).hidden) as HTMLElement
      expect(section, 'exactly one settings section is revealed at a time').toBeDefined()

      const paneStyle = getComputedStyle(pane)
      expect(paneStyle.display, 'the pane is a real flex container').toBe('flex')
      expect(paneStyle.flexDirection).toBe('column')

      const declared = Math.round(parseFloat(paneStyle.rowGap))
      expect(declared, 'anti-vacuous: the section gap resolves to a real length').toBeGreaterThan(0)

      const measured = Math.round(section.getBoundingClientRect().top - nav.getBoundingClientRect().bottom)
      expect(measured, 'and the RENDERED distance is that gap, not zero').toBe(declared)
    })
  }
})







