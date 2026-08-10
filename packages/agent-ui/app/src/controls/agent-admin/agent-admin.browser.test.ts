import { describe, it, expect, afterEach } from 'vitest'

// The CROSS-ENGINE ui-agent-admin smoke (TKT-0039, ADR-0131; re-hosted GH #52/ADR-0154, then again by
// ADR-0179). jsdom cannot resolve CSS flex/@scope/container-query layout — this file is where the
// pane-nav geometry, the narrow one-place-at-a-time drill-in, and the wide Author⇄Settings pairing
// (the container-query narrow crossing) become TRUE in BOTH Chromium and WebKit (the master-detail
// .browser.test.ts precedent). CSS wiring: the foundation first, then
// `component-styles.css` (the family barrel carries ui-text-field/etc.'s shipped CSS), then every
// composed sibling's own CSS (incl. chat-shell/super-shell below), then this element's own.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css' // ADR-0139 — ui-code-editor's own sheet (the entry editors' frame + CM highlight tokens)
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-composer.css' // TKT-0056 — the composed ui-conversation-composer's own layout/parts CSS
import '../surface-host/surface-host.css'
// GH #52/ADR-0154 — the re-host onto the shell-archetype grammar: chat-shell/super-shell's own CSS,
// replacing TKT-0085's <ui-tabs>/<ui-tab>/<ui-tab-panel> registration (no longer composed here at all).
import '../chat-shell/chat-shell.css'
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

/** ADR-0179 — go to one of the three PLACES through the real pane-nav strip (synchronously: clicking a
 *  real `ui-tabs` tab commits immediately, the agent-admin.test.ts jsdom precedent). */
function goToPlace(el: HTMLElement, place: 'Chat' | 'Author' | 'Settings'): void {
  ;([...el.querySelectorAll('[data-part="pane-nav"] ui-tab')].find((t) => t.textContent === place) as HTMLElement).click()
}

/** GH #574 — Agent is the default active settings section; a caller reaching into another section's own
 *  content passes it here. ADR-0179 re-anchored this one level down: the strip is the admin's own
 *  `settings-nav` inside the master-detail's detail pane, and reaching ANY settings content now also means
 *  standing in the Settings place (at Chat the whole region is `hidden`). An inactive section computes
 *  `display:none` in a real engine, so ITS content's own geometry (getBoundingClientRect, .focus()) reads
 *  zero/no-ops until its tab is selected — style-only reads (getComputedStyle of a cascade value like
 *  border-width/font-size) are unaffected either way and need no activation. */
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
 *  mounts at `PAIR_BAND_WIDTH` instead — the same claim, in the band that still makes it. */
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
 *  which exactly one place still paints, and therefore the honest home for every place-exclusivity probe
 *  written before GH #662 widened the wide band. */
const PAIR_BAND_WIDTH = 862

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

describe('ui-agent-admin cross-engine smoke — the three-place shell grammar (ADR-0179: pane nav + the master-detail pairing)', () => {
  // GH #665, ADR-0179 Amendment addendum (Kim's 2026-08-10 follow-on ruling) — the pane nav is redundant
  // once the triple paints all three places at once and goes away at that line (54rem outer/864px here,
  // the composed shell's own inline-size — see agent-admin.css's "54rem" comment for why that number, not
  // 52.5rem, on THIS element). 700px keeps this probe below that line: real pane-nav geometry, in the
  // band where the nav is still the pairing's only drill-in vehicle, unaffected by the wide-hide rule
  // this same GH also added (a SEPARATE probe, "the pane nav vanishes…" below, owns that line).
  it('wide (≥640px, below the wide-hide line): the pane nav paints three real tabs in the header; the retired six-entry narrow-tabs strip does not exist at all', async () => {
    const { el } = mountAgentAdminAt(700)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const nav = el.querySelector('[data-part="pane-nav"]') as HTMLElement
    expect(getComputedStyle(nav).display).not.toBe('none')
    const tabs = [...nav.querySelectorAll('ui-tab')] as HTMLElement[]
    expect(tabs.map((t) => t.textContent)).toEqual(['Chat', 'Author', 'Settings'])
    for (const tab of tabs) expect(tab.getBoundingClientRect().width).toBeGreaterThan(0)
    // cl.1 — the six-entry vocabulary dissolved with the options-pane it enumerated.
    expect(el.querySelector('[data-part="narrow-tabs"]'), 'the shell composes no narrow-tabs strip any more').toBeNull()
    expect(el.querySelector('[data-slot-name="options-pane"]'), 'nothing occupies the end side any more').toBeNull()
  })

  it('cl.3 — at wide, the Author and Settings regions DOCK as one pair: both non-zero, top-aligned, split on the INLINE axis only', async () => {
    const { el } = mountAgentAdminAt(1200)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    goToPlace(el, 'Author')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const author = (el.querySelector('[data-part="author-pane"]') as HTMLElement).getBoundingClientRect()
    const settings = (el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect()
    for (const box of [author, settings]) {
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }
    // the shipped adjacency probe, re-anchored from canvas/options-pane onto the pairing
    expect(author.right, 'the interview is start-side of the settings rail').toBeLessThanOrEqual(settings.left + 1)
    expect(Math.abs(author.top - settings.top), 'displacement is on the INLINE axis only').toBeLessThanOrEqual(1)
  })

  // GH #662 RE-ANCHOR: this probe's claim is now BAND-BOUND. Kim's S1-b delta (Chat solo, disjoint places)
  // is the reading BELOW the 52.5rem triple line; at and above it his 2026-08-10 revision supersedes it and
  // all three places paint (ADR-0179 cl.1's Amendment, probed in the triple-dock describe at the foot of
  // this file). The mount moves from 1200 to 862 — two CSS px under the line — so the probe keeps testing
  // exactly what it was written to test, in the band where that is still the contract.
  it('the Kim-blessed delta — the Chat place renders SOLO in the PAIR band: no settings rail beside it (cl.1`s disjoint places, below the triple line)', async () => {
    const { el } = mountAgentAdminAt(862)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    goToPlace(el, 'Chat')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const conversation = el.querySelector('[data-part="pane-holder"] > ui-conversation') as HTMLElement
    const pair = el.querySelector('[data-part="pane-pair"]') as HTMLElement
    const canvas = (el.querySelector('[data-part="canvas"]') as HTMLElement).getBoundingClientRect()
    const chat = conversation.getBoundingClientRect()
    expect(getComputedStyle(pair).display, 'the pairing contributes no box at Chat').toBe('none')
    expect(pair.getBoundingClientRect().width).toBe(0)
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
    const composer = el.querySelector('[data-part="pane-holder"] > ui-conversation ui-conversation-composer') as HTMLElement & { value: string }
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

  it('narrow (<640px): the SAME three-place nav drives a one-place-at-a-time surface — exactly one region has geometry per selection (cl.1/OQ3)', async () => {
    const { el } = mountAgentAdminAt(500)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const nav = el.querySelector('[data-part="pane-nav"]') as HTMLElement
    expect(getComputedStyle(nav).display, 'ONE vehicle at every band').not.toBe('none')
    const tabs = [...nav.querySelectorAll('ui-tab')] as HTMLElement[]
    expect(tabs.map((t) => t.textContent)).toEqual(['Chat', 'Author', 'Settings'])
    for (const tab of tabs) expect(tab.getBoundingClientRect().width).toBeGreaterThan(0)

    const widthsOf = (): [number, number, number] => [
      (el.querySelector('[data-part="pane-holder"] > ui-conversation') as HTMLElement).getBoundingClientRect().width,
      (el.querySelector('[data-part="author-pane"]') as HTMLElement).getBoundingClientRect().width,
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
    expect((el.querySelector('[data-part="pane-holder"] > ui-conversation ui-conversation-composer') as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(0)

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

  it('the back affordance master-detail renders narrow is SUPPRESSED — the pane nav is the one nav vocabulary (LLD §2)', async () => {
    const { el } = mountAgentAdminAt(500)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const back = el.querySelector('[data-part="pane-pair"] [data-part="back"]') as HTMLElement
    expect(getComputedStyle(back).display, 'admin CSS out-specifies master-detail.css\'s narrow reveal').toBe('none')
    expect(back.getBoundingClientRect().height).toBe(0)
  })

  /** Opens a real A2UI surface (a Hit button) in the mounted conversation, returns it + the conversation. */
  async function openLiveSurface(el: UIAgentAdminElement): Promise<{ conversation: HTMLElement }> {
    const conversation = el.querySelector('[data-part="pane-holder"] > ui-conversation') as HTMLElement & {
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

    expect(el.querySelector('[data-part="pane-pair"]'), 'the pairing should still be there').not.toBeNull()
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
    // preserves) — ADR-0179 re-anchors the evidence onto the pairing's own drill-in: at Settings, narrow
    // shows the detail region ALONE, which is only true below master-detail's 40rem own-container line.
    goToPlace(el, 'Settings')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect((el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect().width, 'did not actually reach narrow').toBeGreaterThan(0)
    expect((el.querySelector('[data-part="author-pane"]') as HTMLElement).getBoundingClientRect().width, 'both regions painted — still wide').toBe(0)

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

describe('ui-agent-admin cross-engine smoke — the settings region renders inside the pairing (ADR-0179)', () => {
  // GH #665 — below the wide-hide line (700px, see the "wide (≥640px, below the wide-hide line)" test's
  // own comment); mountAgentAdmin()'s 1200px default sits ABOVE it, where the nav pane vanishes by design.
  it('the pane nav and the settings region each occupy a non-zero box, the nav above the region', () => {
    const { el } = mountAgentAdmin('Agent', 700)
    const nav = (el.querySelector('[data-part="pane-nav"]') as HTMLElement).getBoundingClientRect()
    const region = (el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect()
    for (const box of [nav, region]) {
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }
    expect(nav.bottom).toBeLessThanOrEqual(region.top + 1) // the header bar sits above the places (rounding slop)
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
  it('[data-part="canvas"] and both master-detail regions compute the SAME 12px (0.75rem) leading INLINE padding — nothing gates this today, and under @scope cascade rules a future innocuous `padding: 0` on a shared rule would silently defeat it with every other gate green', () => {
    const { el } = mountAgentAdmin()
    const canvas = el.querySelector('[data-part="canvas"]') as HTMLElement
    const settings = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const author = el.querySelector('[data-part="author-pane"]') as HTMLElement
    for (const part of [canvas, settings, author]) {
      expect(getComputedStyle(part).paddingInlineStart).toBe('12px')
    }
  })

  // GH #665 — the BLOCK half of the old combined assert above is retired, not merely loosened: it used to
  // pin author/settings' own top padding at the SAME 12px as canvas's, which is exactly the double-layered
  // gutter ("ragged tops") Kim's screenshot caught — author/settings sat a full canvas-gutter PLUS their
  // own gutter below the chat conversation's un-padded top. Canvas alone now carries the block gutter for
  // all three triple columns (the chat conversation, relying on it exclusively, is unchanged); author and
  // settings drop their own block padding to match it — this probe pins THAT law so a future `padding-block:
  // var(--ui-agent-admin-shell-gutter)` re-add on the shared rule (the exact regression the retired half
  // guarded against, just inverted) fails loudly instead of silently re-raggeding the triple.
  it('author/settings carry NO OWN block padding — the canvas gutter alone sets their vertical inset, matching the chat conversation', () => {
    const { el } = mountAgentAdmin()
    const settings = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const author = el.querySelector('[data-part="author-pane"]') as HTMLElement
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

    const shell = el.querySelector('ui-chat-shell') as HTMLElement
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
    const chat = canvas.querySelector(':scope > [data-part="pane-holder"] > ui-conversation') as HTMLElement
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
    const composer = el.querySelector('[data-part="pane-holder"] > ui-conversation ui-conversation-composer') as HTMLElement & { value: string }
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

/** ADR-0179 — go to a PLACE from a probe (this replaces the retired `flipMode`/`setModeSeam` pair).
 *  `setPaneSeam` is `protected` — a compile-time construct only — so a cast reaches it without widening
 *  the element's public API. Deliberately NOT a probe SUBCLASS (the split.ts precedent): agent-admin.css
 *  is `@scope (ui-agent-admin)`, so a probe tag would render unstyled and quietly void every geometry
 *  assertion. The real pane-nav strip is exercised by `goToPlace` in the probes above. */
const setPane = (el: UIAgentAdminElement, pane: 'chat' | 'author' | 'settings'): void => {
  ;(el as unknown as { setPaneSeam(p: 'chat' | 'author' | 'settings'): void }).setPaneSeam(pane)
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
      authoring: el.querySelector('[data-part="author-pane"] [data-part="authoring-conversation"]'),
      test: el.querySelector('[data-part="pane-holder"] > ui-conversation') as HTMLElement,
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

  // GH #662 RE-ANCHOR: "exactly one place has a box" is the PAIR band's contract; at and above the triple
  // line all three paint (ADR-0179 cl.1's Amendment). Mounted in the pair band so the claim stays testable.
  it('arming the flow LANDS in Author and paints the interview; the Chat place still takes over on demand — both keep real geometry across a place change (pair band)', async () => {
    const { el } = mountAgentAdmin('Agent', PAIR_BAND_WIDTH)
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

    const authoring = el.querySelector('[data-part="authoring-conversation"]') as HTMLElement
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

// ── ADR-0179 cl.1 — the PANE NAV strip, in BOTH real engines ─────────────────────────────────────────────
// (This describe replaces the retired try-it bar's, GH #646/LLD-C9 — §7's "the probes' METHOD survives
// re-anchored; their strip subject retires". jsdom proves the place change's LOGIC
// (agent-admin-authoring.test.ts). What only a real engine can prove is that the strip genuinely PAINTS,
// that its inset lands where the header rhythm says it should, and that clicking it visually swaps which
// place occupies the canvas — the same three claims the try-it probes made, one level up.)
describe('ui-agent-admin cross-engine smoke — the pane nav (ADR-0179 cl.1)', () => {
  function nav(el: UIAgentAdminElement): { strip: HTMLElement & { selected: string }; tab: (key: string) => HTMLElement } {
    const strip = el.querySelector('[data-part="pane-nav"]') as HTMLElement & { selected: string }
    return { strip, tab: (key) => strip.querySelector(`[data-part="pane-nav-${key}"]`) as HTMLElement }
  }

  /** The USED px value of `--ui-bar-inline-inset` where `host` sits — the `_page-bar-inset.browser.test.ts`
   *  (GH #626) resolution idiom: an unregistered custom property computes to its substituted token stream,
   *  which never string-equals a used `padding` value, so a throwaway probe element resolves it for real.
   *  GH #646 follow-up #2 taught the OPPOSITE lesson for the retired try-it strip (its parent nested inside
   *  the padded canvas box, so the strip owed no inset of its own). This strip is genuinely header content
   *  — super-shell's `bar`/`bar-content` deliberately carry no padding, GH #626 — so the fleet
   *  header-content role IS its inset, and the #650 split's header-BEARING arm is the one that applies. */
  function resolvedBarInset(host: HTMLElement): number {
    const probe = document.createElement('div')
    probe.style.paddingInline = 'var(--ui-bar-inline-inset)'
    host.append(probe)
    const used = getComputedStyle(probe).paddingInlineStart
    probe.remove()
    expect(used, 'the shared header-content inset role resolves').not.toBe('0px')
    return parseFloat(used)
  }

  // GH #665 — below the wide-hide line (700px; mountAgentAdmin()'s 1200px default sits above it).
  it('paints as a real strip with three genuinely on-screen tabs, armed or not (the always-present Author place)', async () => {
    const { el } = mountAgentAdmin('Agent', 700)
    await el.updateComplete
    const { strip, tab } = nav(el)
    const stripBox = strip.getBoundingClientRect()
    expect(stripBox.width).toBeGreaterThan(0)
    expect(stripBox.height).toBeGreaterThan(0)
    for (const key of ['chat', 'author', 'settings']) {
      const box = tab(key).getBoundingClientRect()
      expect(box.width, `${key} tab width`).toBeGreaterThan(0)
      expect(box.height, `${key} tab height`).toBeGreaterThan(0)
    }
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    expect(nav(el).strip.getBoundingClientRect().height, 'arming changes nothing about the nav itself').toBe(stripBox.height)
  })

  // §7 — the #650 screen-x METHOD, repointed: the pane-nav strip's inset-vs-header rhythm. The
  // border-box screen-x measurement is frame-independent (the shipped 122–124 adjacency probe's own
  // technique); anti-vacuous because the resolved inset is asserted to be real slack first, so a flush
  // layout cannot pass with a zero delta.
  // GH #665 — below the wide-hide line (700px; mountAgentAdmin()'s 1200px default sits above it, where
  // the strip this probe measures no longer exists).
  it('the strip`s first tab starts ONE header inset in from the bar`s own edge (the #650 rhythm, repointed)', async () => {
    const { el } = mountAgentAdmin('Agent', 700)
    await el.updateComplete
    const bar = el.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    expect(bar, 'the admin composes a real header now — the #650 split\'s header-BEARING arm').not.toBeNull()
    const inset = resolvedBarInset(bar)
    expect(inset, 'the resolved inset is real slack, not a collapsed token').toBeGreaterThan(4)
    const firstTabX = nav(el).tab('chat').getBoundingClientRect().x
    expect(Math.abs(firstTabX - (bar.getBoundingClientRect().x + inset)), 'the first tab lands one header inset in from the bar edge').toBeLessThanOrEqual(0.5)
  })

  // §7 — the settings-nav strip's inset equality against the section content it labels: both sit in the
  // SAME column (the master-detail detail pane), so a screen-x comparison between them is meaningful
  // (the cross-strip probe the follow-up #4 finding said only holds within one column).
  it('the settings sub-nav and the section content it labels share ONE screen-x column', async () => {
    const { el } = mountAgentAdmin()
    await el.updateComplete
    const stripTab = el.querySelector('[data-part="settings-nav"] ui-tab') as HTMLElement
    const section = el.querySelector('[data-role="agent-content"]') as HTMLElement
    const sectionBox = section.getBoundingClientRect()
    expect(sectionBox.width, 'the section is genuinely on screen, not a zero-size stub').toBeGreaterThan(0)
    expect(Math.abs(stripTab.getBoundingClientRect().x - sectionBox.x), 'strip and content share the pane\'s one ambient gutter').toBeLessThanOrEqual(0.5)
  })

  it('paints exactly ONE separator line below the strip — the tablist`s own divider, not a second one on the host', async () => {
    const { el } = mountAgentAdmin()
    await el.updateComplete
    const { strip } = nav(el)
    const tablist = strip.querySelector('[data-part="tablist"]') as HTMLElement
    expect(getComputedStyle(strip).borderBottomWidth, 'the strip host itself paints no border — the doubled-hairline defect').toBe('0px')
    expect(parseFloat(getComputedStyle(tablist).borderBottomWidth), 'the tablist part still paints its own real divider').toBeGreaterThan(0)
  })

  // GH #662 RE-ANCHOR: same reason as above — a nav click "flips which place occupies the canvas" only
  // below the triple line, where there is one canvas to occupy.
  it('clicking the tabs flips which place occupies the canvas, with real (non-collapsed) geometry every way (pair band)', async () => {
    const { el } = mountAgentAdmin('Agent', PAIR_BAND_WIDTH)
    await el.updateComplete
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    const { strip, tab } = nav(el)
    const authoring = el.querySelector('[data-part="authoring-conversation"]') as HTMLElement
    const test = el.querySelector('[data-part="pane-holder"] > ui-conversation') as HTMLElement

    // arming landed on Author (the IA-entry re-point)
    expect(strip.selected).toBe('author')
    const authoringBox = authoring.getBoundingClientRect()
    expect(authoringBox.height).toBeGreaterThan(0)
    expect(test.getBoundingClientRect().height).toBe(0)

    tab('chat').click()
    await el.updateComplete
    expect(strip.selected).toBe('chat')
    expect(authoring.getBoundingClientRect().height, 'the interview collapses to zero, not just visually dims').toBe(0)
    expect(test.getBoundingClientRect().height, 'the test chat takes over the canvas — no collapsed layout').toBeGreaterThan(0)

    tab('settings').click()
    await el.updateComplete
    expect(strip.selected).toBe('settings')
    expect(test.getBoundingClientRect().height).toBe(0)
    expect((el.querySelector('[data-part="settings-pane"]') as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(0)

    tab('author').click()
    await el.updateComplete
    expect(strip.selected).toBe('author')
    expect(authoring.getBoundingClientRect().height).toBeGreaterThan(0)
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

  // GH #665 — below the wide-hide line (700px; mountAgentAdmin()'s 1200px default sits above it, where
  // the pane nav this probe cross-compares against no longer paints real geometry).
  it('the sub-nav holds the SAME metric register as the pane nav above it — one strip grammar, two levels (the cross-strip equality method, extended)', async () => {
    const { el } = mountAgentAdmin('Agent', 700)
    await el.updateComplete
    const paneNav = el.querySelector('[data-part="pane-nav"]') as HTMLElement
    const subNav = strip(el)
    // The strip-level register: both are the same GH #221 panel-less composition, so their token-derived
    // metrics must not fork. Read from the CONTROLS (tokens resolve on the host), then from the real
    // painted tablist parts (gap is only true once laid out).
    for (const token of ['--ui-tabs-tab-height', '--ui-tabs-tab-font', '--ui-tabs-strip-gap']) {
      const a = getComputedStyle(paneNav).getPropertyValue(token).trim()
      expect(a, `${token} resolves to a real value on the pane nav`).not.toBe('')
      expect(getComputedStyle(subNav).getPropertyValue(token).trim(), `${token} must not fork between the two strips`).toBe(a)
    }
    const tablistOf = (host: HTMLElement): CSSStyleDeclaration =>
      getComputedStyle(host.querySelector('[data-part="tablist"]') as HTMLElement)
    expect(tablistOf(subNav).columnGap, 'the strips share one gap').toBe(tablistOf(paneNav).columnGap)

    // The painted tabs agree too — same height, same type register.
    const paneTab = paneNav.querySelector('ui-tab') as HTMLElement
    const subTab = subNav.querySelector('ui-tab') as HTMLElement
    expect(subTab.getBoundingClientRect().height, 'both strips draw the same tab height').toBeCloseTo(paneTab.getBoundingClientRect().height, 1)
    const paneCs = getComputedStyle(paneTab)
    const subCs = getComputedStyle(subTab)
    expect([subCs.fontSize, subCs.fontWeight]).toEqual([paneCs.fontSize, paneCs.fontWeight])
  })
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

/** The five settings sections' label → content-role map (the LLD-P6 describe's own SECTIONS list, keyed
 *  the way the overflow-menu leg below needs to look one up from a proxy row's text). */
const SECTION_ROLE_BY_LABEL: Record<string, string> = {
  Agent: 'agent-content',
  Capabilities: 'capabilities-content',
  Surface: 'surface-content',
  'Context: System': 'context-system-content',
  'Context: Dialog': 'context-dialog-content',
}

describe('ui-agent-admin cross-engine smoke — the wide live-fill proof + density (LLD-P7, GH #658)', () => {
  const frames = async (n = 3): Promise<void> => {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
  }

  /** The two named density lines are the PAIR's own container inline-size (`ui-master-detail` is
   *  `container-type: inline-size`, so 40rem is measured on it, never on the viewport). The canvas box the
   *  pair sits in adds one `--ui-agent-admin-shell-gutter` per side (12px, measured), so an OUTER mount of
   *  `line + 24` is what puts the container exactly ON the line — each band asserts that below rather than
   *  trusting the arithmetic. Below the line the pair drills in and only one region paints (probed above),
   *  which is why 664 — not 640 — is the honest "at the 40rem line" mount. */
  const BANDS = [
    { name: 'the 40rem line', line: 640, outer: 664 },
    // GH #662 RE-ANCHOR: `line` is and always was the PAIR's OWN container width, and the outer mount is
    // whatever produces it. Below the triple line the pair takes the whole holder, so `line + 24` did; at
    // and above it the pair is two of three columns (`flex: 2` of the holder, floored at its 40rem dock
    // line), so an 864 mount now yields a 640 pair — the same claim, a different arithmetic. 1284 is the
    // mount that puts the pair's own container on 840 in the triple world; the assert below still measures
    // it rather than trusting this number. (1286, not 1284: the Chat column's own 2px border is not
    // shrinkable, so the flex free space the `2` share divides is `holder - 2`.)
    { name: '52.5rem', line: 840, outer: 1286 },
  ] as const

  /** The used px width of `20ch` IN THIS REGION — the region's own font, not an assumed 8px/ch. The
   *  `resolvedBarInset` idiom one describe up: a throwaway probe element is the only honest way to turn a
   *  font-relative unit into the number a layout assertion can compare against. */
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

  const regionsOf = (el: UIAgentAdminElement): { pair: HTMLElement; author: HTMLElement; settings: HTMLElement } => ({
    pair: el.querySelector('[data-part="pane-pair"]') as HTMLElement,
    author: el.querySelector('[data-part="author-pane"]') as HTMLElement,
    settings: el.querySelector('[data-part="settings-pane"]') as HTMLElement,
  })

  /** Both regions really are side by side with real boxes — the anti-vacuous precondition every claim
   *  below rests on. A drilled-in pair (one region at zero) would otherwise let a "the rail updated"
   *  assertion pass against a rail nobody can see. */
  function expectDocked(el: UIAgentAdminElement): { author: DOMRect; settings: DOMRect } {
    const { author, settings } = regionsOf(el)
    const a = author.getBoundingClientRect()
    const s = settings.getBoundingClientRect()
    for (const [label, box] of [
      ['author', a],
      ['settings', s],
    ] as const) {
      expect(box.width, `${label} region width — the pair must be genuinely docked, not drilled in`).toBeGreaterThan(0)
      expect(box.height, `${label} region height`).toBeGreaterThan(0)
    }
    expect(a.right, 'the interview sits start-side of the settings rail').toBeLessThanOrEqual(s.left + 1)
    expect(Math.abs(a.top - s.top), 'displacement is on the INLINE axis only').toBeLessThanOrEqual(1)
    return { author: a, settings: s }
  }

  const contains = (outer: DOMRect, inner: DOMRect): boolean =>
    inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1

  it('cl.3/#651 — a gate-ON Builder turn in the Author region repaints the DOCKED settings rail WHILE the turn is still streaming', async () => {
    const { el } = mountAgentAdminAt(1200)
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

    // Gate ON: arming the authoring flow is what opens the fence AND lands the pane on Author (§4).
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    await frames()

    const nav = el.querySelector('[data-part="pane-nav"]') as HTMLElement & { selected: string }
    expect(nav.selected, 'the gate-ON turn runs in the Author place').toBe('author')
    const docked = expectDocked(el)

    // The field this turn will fill is the Agent section's `name`, in the docked rail — asserted to be
    // GEOMETRICALLY inside the settings region (not merely present in the DOM somewhere) and to not
    // already read the target value, so neither half of the proof can pass vacuously.
    const nameField = el.querySelector('ui-settings [name="name"]') as UITextFieldElement
    const editorOf = (): HTMLElement => nameField.querySelector('[data-part="editor"]') as HTMLElement
    expect(contains(docked.settings, nameField.getBoundingClientRect()), 'the name field is painted inside the docked settings rail').toBe(true)
    expect(nameField.getBoundingClientRect().width, 'and it is a real box, not a collapsed stub').toBeGreaterThan(0)
    expect(nameField.value, 'the target value is not already showing (anti-vacuous)').not.toBe(LIVE_FILL_NAME)
    expect(editorOf().textContent, 'nor is it already painted').not.toContain(LIVE_FILL_NAME)

    // Drive the turn through the Author place's OWN composer (cl.4 — per-pane composers), the real path.
    const authoring = el.querySelector('[data-part="author-pane"] [data-part="authoring-conversation"]') as HTMLElement
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
    // user actually sees, and the box that text occupies inside the still-docked rail.
    expect(el.store!.get('name'), 'the draft store took the write (the fence applied it)').toBe(LIVE_FILL_NAME)
    expect(nameField.value, 'the control re-rendered the patched value').toBe(LIVE_FILL_NAME)
    expect(editorOf().textContent, 'and it is the RENDERED text, not just a property').toContain(LIVE_FILL_NAME)
    const midBox = nameField.getBoundingClientRect()
    expect(midBox.width, 'the repainted field still occupies a real box').toBeGreaterThan(0)
    expect(midBox.height).toBeGreaterThan(0)

    // …and the user never left Author to see it: the pair is still docked, both regions still painted.
    expect(nav.selected, 'no place change was needed to see the fill').toBe('author')
    const stillDocked = expectDocked(el)
    expect(contains(stillDocked.settings, midBox), 'the repainted field is still inside the docked rail').toBe(true)

    // Let the turn finish — the interview's own reply lands in the interview, the rail keeps the value.
    releaseTurn()
    await el.updateComplete
    await frames()
    const bubble = authoring.querySelector('[data-role="agent"] [data-part="body"]') as HTMLElement
    expect(bubble.textContent, 'the closing note painted in the interview, not the test chat').toContain('Named it for you.')
    expect(nameField.value, 'the filled value survives the turn ending').toBe(LIVE_FILL_NAME)
    expectDocked(el)
  })

  for (const band of BANDS) {
    it(`density at ${band.name}: the docked pair splits evenly and BOTH regions clear the 20ch floor, with the sub-nav reachable through its menu`, async () => {
      const { el } = mountAgentAdminAt(band.outer)
      await frames()
      // Density is measured in the state the pairing EXISTS for: a live interview beside the rail. The
      // interview conversation is lazy (never mounted until the flow arms), so an unarmed measurement
      // would be grading the empty state's roominess instead of the composed pair's.
      el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
      await el.updateComplete
      await frames()
      goToPlace(el, 'Author')
      await frames()

      const { pair, author, settings } = regionsOf(el)
      expect(pair.getBoundingClientRect().width, `the pair's own container is ON ${band.name}, not merely above it`).toBeCloseTo(band.line, 0)
      const boxes = expectDocked(el)

      // The EVEN default (§6(c) polishes this only if it reads cramped — see the floor check below).
      expect(Math.abs(boxes.author.width - boxes.settings.width), 'the composed split defaults to an even share').toBeLessThanOrEqual(1)

      // The floor, per region, measured in that region's own type: content box ≥ 20ch, and nothing spills
      // sideways (a region that "fits" by overflowing is not holding its content).
      for (const [label, region] of [
        ['author', author],
        ['settings', settings],
      ] as const) {
        const cs = getComputedStyle(region)
        const content = region.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        expect(content, `${label} content width clears the 20ch floor at ${band.name}`).toBeGreaterThan(twentyCh(region))
        expect(region.scrollWidth, `${label} holds its content without overflowing sideways`).toBeLessThanOrEqual(region.clientWidth + 1)
      }

      // The two regions' real occupants — the rail's widest field and the interview's composer — are each
      // genuinely usable, not merely non-zero (the 20ch floor is ui-text-field's own intrinsic minimum,
      // GH #74; a field pinned AT its floor is the tell that the split has run out of room).
      const nameField = el.querySelector('ui-settings [name="name"]') as UITextFieldElement
      expect(nameField.getBoundingClientRect().width, `the rail's name field clears its own 20ch minimum at ${band.name}`).toBeGreaterThan(twentyCh(settings))
      // GH #666 — scoped to the INTERVIEW's own composer: the Author region now holds a second one (the
      // unarmed empty state's composer-first entry), and this probe mounts ARMED, where that one is hidden.
      const composer = el.querySelector('[data-part="authoring-conversation"] ui-conversation-composer') as HTMLElement
      expect(composer.getBoundingClientRect().width, 'the interview composer paints a real box').toBeGreaterThan(0)

      // S2's flagged band behaviour, asserted as the EXPECTED path rather than a regression: the five
      // section labels do not fit a rail this narrow, so reaching an overflowed section goes through the
      // GH #586 menu — a6 ("every section reachable at every band") is what must hold here, not "tabs fit".
      // Measured from the Author place deliberately: the docked rail is the surface this slice is about,
      // so the sub-nav has to work in it without a place change, at the very width just measured.
      // GH #662 RE-ANCHOR: the CLAIM here is a6 — every section reachable at this band — not "the strip
      // overflows". Which of those two roads a6 travels is a measured property of the rail's width, and the
      // triple re-anchor moved it: at the 40rem line the rail is 296px and the two long `Context: …` tabs
      // overflow; at 52.5rem the rail is 420px and all five now fit outright. Asserting overflow
      // unconditionally would be asserting the road instead of the destination, so the leg takes whichever
      // road this band actually offers and proves the SAME reachability either way.
      const strip = el.querySelector('[data-part="settings-nav"]') as HTMLElement
      const overflowed = [...strip.querySelectorAll('ui-tab[data-overflowed]')] as HTMLElement[]
      const menu = strip.querySelector('[data-part="overflow"]') as HTMLElement
      let label: string
      if (overflowed.length > 0) {
        expect(menu.hidden, 'the rail overflows at this band, so the overflow trigger paints').toBe(false)
        label = overflowed[overflowed.length - 1]!.textContent!
        ;(menu.querySelector('[data-part="trigger"]') as HTMLElement).click()
        await frames()
        const proxy = [...menu.querySelectorAll('[role="menuitem"]')].find((p) => p.textContent === label) as HTMLElement
        expect(proxy, `${label} is neither on the strip nor in the menu — unreachable at ${band.name}`).toBeTruthy()
        proxy.click()
      } else {
        // The rail holds all five: the menu retires and every tab is a real, directly clickable box.
        expect(menu.hidden, 'nothing overflows, so the trigger is gone rather than an empty affordance').toBe(true)
        const tabs = [...strip.querySelectorAll('ui-tab')] as HTMLElement[]
        expect(tabs).toHaveLength(5)
        for (const t of tabs) expect(t.getBoundingClientRect().width, `${t.textContent} is laid out, not a stub`).toBeGreaterThan(0)
        const last = tabs[tabs.length - 1]!
        label = last.textContent!
        last.click()
      }
      await frames()
      const reached = el.querySelector(`[data-role="${SECTION_ROLE_BY_LABEL[label]}"]`) as HTMLElement
      expect(getComputedStyle(reached).display, `${label} reached through the menu really is the section now showing`).not.toBe('none')
      const selected = [...strip.querySelectorAll('ui-tab')].find((t) => t.textContent === label) as HTMLElement
      expect(selected.hasAttribute('data-overflowed'), 'and the selected tab pinned itself back onto the strip (GH #586)').toBe(false)
    })
  }
})

// ── GH #662 (S6) — the WIDE TRIPLE DOCK: [chat | author-chat | settings] side by side ─────────────────
// ADR-0179 cl.1's Amendment (2026-08-10). Three things are proven here and nowhere else, because all
// three are questions only a real engine can answer: WHERE the triple band starts (a measured line, not an
// assumed one), that the three columns still hold their content there (the 20ch engagement floor, per
// region, in that region's own type), and that nothing paints a rule between them (Kim's 2026-08-10
// addition — regions separate by spacing and surface alone).
describe('ui-agent-admin — the wide TRIPLE dock (GH #662, ADR-0179 cl.1 Amendment)', () => {
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

  const partsOf = (el: UIAgentAdminElement): { holder: HTMLElement; chat: HTMLElement; pair: HTMLElement; author: HTMLElement; settings: HTMLElement } => ({
    holder: el.querySelector('[data-part="pane-holder"]') as HTMLElement,
    chat: el.querySelector('[data-part="pane-holder"] > ui-conversation') as HTMLElement,
    pair: el.querySelector('[data-part="pane-pair"]') as HTMLElement,
    author: el.querySelector('[data-part="author-pane"]') as HTMLElement,
    settings: el.querySelector('[data-part="settings-pane"]') as HTMLElement,
  })

  /** Mount ARMED — the interview is lazy, so an unarmed measurement would be grading the empty state's
   *  roominess instead of the composed triple's. Arming also lands the nav on Author (the IA-entry
   *  re-point), which is deliberately NOT corrected here: at the triple line the place the nav names must
   *  stop deciding what paints, and leaving it on Author is what puts that under test. */
  async function mountTripleAt(outer: number): Promise<UIAgentAdminElement> {
    const { el } = mountAgentAdminAt(outer)
    await frames()
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    await frames()
    return el
  }

  it('AT the 52.5rem line: all three places paint side by side, in reading order, on the inline axis alone', async () => {
    const el = await mountTripleAt(TRIPLE_AT)
    const { holder, chat, author, settings } = partsOf(el)
    expect(holder.getBoundingClientRect().width, 'the holder is ON the named line, not merely above it').toBeCloseTo(TRIPLE_LINE, 0)

    const boxes = [chat, author, settings].map((r) => r.getBoundingClientRect())
    for (const [i, label] of ['chat', 'author', 'settings'].entries()) {
      expect(boxes[i]!.width, `${label} has a real box in the triple`).toBeGreaterThan(0)
      expect(boxes[i]!.height, `${label} height`).toBeGreaterThan(0)
    }
    // Reading order, and displacement on the INLINE axis only (the ledgered screen-x/displacement idiom).
    expect(boxes[0]!.right, 'the test chat is start-side of the interview').toBeLessThanOrEqual(boxes[1]!.left + 1)
    expect(boxes[1]!.right, 'the interview is start-side of the settings rail').toBeLessThanOrEqual(boxes[2]!.left + 1)
    for (const i of [1, 2]) expect(Math.abs(boxes[i]!.top - boxes[0]!.top), 'all three are top-aligned').toBeLessThanOrEqual(1)

    // The nav still says Author. That the OTHER two places paint anyway is the whole Amendment: at this
    // band the nav names a place, it no longer gates one.
    expect((el.querySelector('[data-part="pane-nav"]') as HTMLElement & { selected: string }).selected).toBe('author')
    expect(holder.getAttribute('data-pane')).toBe('author')
  })

  // GH #665, ADR-0179 Amendment addendum (Kim's 2026-08-10 follow-on ruling) — the pane nav is redundant
  // once all three places already paint side by side, and goes away exactly on the SAME line the triple
  // itself engages: below it the nav is the drill-in's only vehicle and stays (a separate probe, "the
  // pane nav (ADR-0179 cl.1)" describe block above, pins that band unaffected); at and above it, gone.
  it('the pane nav vanishes AT the same 52.5rem line the triple engages — one line, not two', async () => {
    const atLine = await mountTripleAt(TRIPLE_AT)
    const navBarAtLine = atLine.querySelector('[data-part="pane-nav-bar"]') as HTMLElement
    expect(getComputedStyle(navBarAtLine).display, 'gone AT the line, the same frame the triple starts painting').toBe('none')
    expect(navBarAtLine.getBoundingClientRect().height).toBe(0)

    const belowLine = await mountTripleAt(TRIPLE_BELOW)
    const navBarBelowLine = belowLine.querySelector('[data-part="pane-nav-bar"]') as HTMLElement
    expect(getComputedStyle(navBarBelowLine).display, 'two pixels below the line the nav is still the ONLY drill-in vehicle').not.toBe('none')
    expect(navBarBelowLine.getBoundingClientRect().height, 'a real, on-screen strip').toBeGreaterThan(0)
  })

  it('TWO PIXELS BELOW the line: the band collapses back to one place — the ladder is a line, not a slope', async () => {
    const el = await mountTripleAt(TRIPLE_BELOW)
    const { holder, chat, pair } = partsOf(el)
    expect(holder.getBoundingClientRect().width).toBeCloseTo(TRIPLE_LINE - 2, 0)
    // The nav stands on Author, so the pair paints and the test chat does not — S1-b's behaviour, intact.
    expect(getComputedStyle(chat).display, 'the Chat place has no box below the line').toBe('none')
    expect(chat.getBoundingClientRect().width).toBe(0)
    expect(pair.getBoundingClientRect().width, 'and the pair takes the whole holder').toBeCloseTo(TRIPLE_LINE - 2, 0)

    // …and the same place change still works below the line: Chat solo, the pair gone.
    goToPlace(el, 'Chat')
    await frames()
    expect(getComputedStyle(pair).display).toBe('none')
    expect(chat.getBoundingClientRect().width).toBeCloseTo(TRIPLE_LINE - 2, 0)
  })

  for (const outer of [TRIPLE_AT, 1200]) {
    it(`density at holder ${outer - 24}px: all THREE columns clear the 20ch engagement floor`, async () => {
      const el = await mountTripleAt(outer)
      const { chat, author, settings } = partsOf(el)

      // Per region, in that region's own type — the floor is content box ≥ 20ch, and nothing may "fit" by
      // spilling sideways instead.
      for (const [label, region] of [
        ['chat', chat],
        ['author', author],
        ['settings', settings],
      ] as const) {
        const cs = getComputedStyle(region)
        const content = region.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        expect(content, `${label} content width clears the 20ch floor`).toBeGreaterThan(twentyCh(region))
        expect(region.scrollWidth, `${label} holds its content without overflowing sideways`).toBeLessThanOrEqual(region.clientWidth + 1)
      }

      // The three columns' real occupants, each measured against its OWN intrinsic minimum (GH #74's 20ch
      // text-field floor). The Chat composer is the binding constraint of the whole band — it is the
      // narrowest thing in the narrowest column, and it is what decides that 52.5rem, not 40rem, is where
      // a triple can live at all.
      const chatComposer = chat.querySelector('ui-conversation-composer') as HTMLElement
      expect(chatComposer.getBoundingClientRect().width, 'the test composer clears its own 20ch minimum').toBeGreaterThan(twentyCh(chat))
      // GH #666 — the INTERVIEW's composer specifically (this probe mounts armed; the empty state's own
      // composer-first entry is the region's other, hidden one).
      const authorComposer = author.querySelector('[data-part="authoring-conversation"] ui-conversation-composer') as HTMLElement
      expect(authorComposer.getBoundingClientRect().width, 'the interview composer clears it too').toBeGreaterThan(twentyCh(author))
      const nameField = el.querySelector('ui-settings [name="name"]') as UITextFieldElement
      expect(nameField.getBoundingClientRect().width, 'the rail’s name field clears its own 20ch minimum').toBeGreaterThan(twentyCh(settings))
    })
  }

  it('Kim’s 2026-08-10 addition — NO painted divider between docked regions, with every resize mechanic intact', async () => {
    const el = await mountTripleAt(1200)
    const { holder, author, settings } = partsOf(el)
    const separators = [...holder.querySelectorAll('ui-split > [data-separator]')] as HTMLElement[]
    expect(separators.length, 'the docked arrangement really does compose separators to unpaint').toBeGreaterThan(0)

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

    // The rendered-pixel-adjacent assert (the ledgered displacement idiom): with no ink between them, the
    // two regions are separated by the separator's own track and nothing more — the gap between the
    // author region's trailing edge and the settings region's leading edge is at most that 1px track plus
    // the regions' own padding, and it contains no painted box of its own.
    const a = author.getBoundingClientRect()
    const s = settings.getBoundingClientRect()
    const sepBox = separators[separators.length - 1]!.getBoundingClientRect()
    expect(s.left - a.right, 'the regions sit hairline-adjacent — no painted rule occupies the seam').toBeLessThanOrEqual(sepBox.width + 1)
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
    const authorKicker = author.querySelector('ui-conversation [data-part="region-kicker"]') as HTMLElement
    expect(settings.querySelector('[data-part="region-kicker"]'), "Kim's overrule: no Settings kicker — the sub-nav is the label").toBeNull()

    const textTop = (el: HTMLElement): number => el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop)
    expect(Math.abs(textTop(authorKicker) - textTop(chatKicker)), "the interview kicker's TEXT lands on the test chat kicker's").toBeLessThanOrEqual(1)

    // …and BENEATH the kickers, the two conversation logs still share a bottom rhythm with each other.
    const chatLog = chat.querySelector('[data-part="log"]') as HTMLElement
    const authorLog = author.querySelector('ui-conversation [data-part="log"]') as HTMLElement
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
      ['author', author, author.querySelector('ui-conversation [data-part="region-kicker"]') as HTMLElement, author.querySelector('ui-conversation [data-part="log"]') as HTMLElement],
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

  // `screens:layout-checker` finding 3 (SHIPPABLE grade, MINOR) — the vacated header bar's own structural
  // seam border must retract (transparent ink), never paint a stray hairline across a headerless band —
  // the SAME retract-don't-delete law the no-divider ruling above already applies to the split separators.
  it('the vacated header bar paints no stray seam hairline — the ink retracts, the border-box geometry does not', async () => {
    const el = await mountTripleAt(1200)
    const shell = el.querySelector('ui-chat-shell') as HTMLElement
    const barHeader = shell.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    const cs = getComputedStyle(barHeader)
    expect(cs.borderBottomColor, 'the seam ink is fully transparent, not merely thin').toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/)
  })

  it('gutter equality: the chat↔author gap and the author↔settings gap read as ONE rhythm, not two', async () => {
    const el = await mountTripleAt(1200)
    const { chat, author, settings } = partsOf(el)
    const chatLog = chat.querySelector('[data-part="log"]') as HTMLElement
    const authorLog = author.querySelector('ui-conversation [data-part="log"]') as HTMLElement
    const settingsNav = settings.querySelector('[data-part="settings-nav"]') as HTMLElement
    const chatAuthorGap = authorLog.getBoundingClientRect().left - chatLog.getBoundingClientRect().right
    const authorSettingsGap = settingsNav.getBoundingClientRect().left - authorLog.getBoundingClientRect().right
    expect(chatAuthorGap, 'a real, positive gutter — not a coincidental zero').toBeGreaterThan(0)
    expect(Math.abs(chatAuthorGap - authorSettingsGap), 'the two inter-column gaps equal (±1, the split track hairline)').toBeLessThanOrEqual(1)
  })

  it('each conversation region carries its own visible identity kicker — the test chat and the Builder interview no longer read as two identical empty threads', async () => {
    const el = await mountTripleAt(1200)
    const { chat, author } = partsOf(el)
    const chatKicker = chat.querySelector('[data-part="region-kicker"]') as HTMLElement
    const authorKicker = author.querySelector('ui-conversation [data-part="region-kicker"]') as HTMLElement
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

  // GH #665 (Kim's live-screenshot follow-on) — the pane nav's own `display:none` (above) must not leave
  // an empty band behind: super-shell's structural header bar carries a `min-block-size` FLOOR
  // (`--ui-super-shell-bar-size`) independent of its content, ADR-0166 cl.3's "bars are never hidden"
  // law — a real, measured regression this same fix's OWN box could reintroduce if the floor were left
  // standing. Collapsed to (at most) its own hairline seam border, never a painted band.
  it('the vacated pane-nav band genuinely collapses at the triple line — no empty header strip left behind', async () => {
    const el = await mountTripleAt(1200)
    const shell = el.querySelector('ui-chat-shell') as HTMLElement
    const barHeader = shell.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    expect(barHeader.getBoundingClientRect().height, 'collapsed to (at most) its own seam hairline').toBeLessThanOrEqual(2)
  })

  // GH #665 (Kim's ruling) — the settings column's own scroller (a real `ui-split-pane`, GH #662's wide
  // triple dock put one back under the author⇄settings pairing) painted a visible scrollbar the fleet's
  // app-chrome convention hides everywhere else in this surface — `--ui-split-pane-scrollbar-width` was
  // simply never wired (split-pane.css's own comment already claimed agent-admin did this). Functional
  // scroll survives untouched (the agent-admin-app-scroll.browser.test.ts idiom: a real scrollTop write
  // reaches real overflowing content) — only the OS/engine scrollbar chrome goes.
  it('the settings scroller hides its scrollbar (the fleet app-chrome convention) — scrolling itself stays fully functional', async () => {
    const el = await mountTripleAt(1200)
    const settingsPane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const scroller = settingsPane.closest('ui-split-pane') as HTMLElement
    expect(scroller, 'the settings pane\'s real scrolling ancestor is a ui-split-pane').not.toBeNull()
    expect(getComputedStyle(scroller).scrollbarWidth, 'the OS/engine scrollbar chrome is hidden').toBe('none')
    // Force real overflow (the settings content at the default 600px test height may or may not already
    // overflow) so the functional-scroll write is never vacuous.
    scroller.style.maxBlockSize = '100px'
    await frames()
    expect(scroller.scrollHeight, 'anti-vacuous: there is real overflowing content to reach').toBeGreaterThan(scroller.clientHeight)
    scroller.scrollTop = 99999
    expect(scroller.scrollTop, 'the scroller genuinely scrolls to reach the overflowing content — hiding the chrome never disabled scrolling').toBeGreaterThan(0)
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

    const authoring = el.querySelector('[data-part="author-pane"] [data-part="authoring-conversation"]') as HTMLElement
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
    test: el.querySelector('[data-part="pane-holder"] > ui-conversation') as HTMLElement,
    author: el.querySelector('[data-part="authoring-conversation"]') as HTMLElement,
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

    // The copy occupies the LOG area — inside the log's box, above the composer (the empty-conversation
    // idiom Kim named). A headline rendered outside the card is the shape the reopen rejected.
    const logBox = (author.querySelector(':scope > [data-part="log"]') as HTMLElement).getBoundingClientRect()
    const copyBox = (el.querySelector('[data-part="author-empty"]') as HTMLElement).getBoundingClientRect()
    expect(copyBox.height, 'the copy paints').toBeGreaterThan(0)
    expect(copyBox.top).toBeGreaterThanOrEqual(logBox.top - 1)
    expect(copyBox.bottom).toBeLessThanOrEqual(logBox.bottom + 1)
    expect(copyBox.bottom, 'and it sits above the composer, not under it').toBeLessThanOrEqual(composerOf(author).getBoundingClientRect().top + 1)
  })

  it('UNARMED at the triple: the first message arms the flow and FILLS the same card — the copy leaves, the transcript takes the log', async () => {
    const el = await mountUnarmedTriple()
    const { author } = cardsOf(el)
    const composer = author.querySelector(':scope > ui-conversation-composer') as HTMLElement & { value: string }
    const cardBefore = author.getBoundingClientRect()

    composer.value = 'a hotel concierge please'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()
    await el.updateComplete
    await frames()
    await el.updateComplete
    await frames()

    expect(el.authoringStore, 'the first message armed the flow').toBeDefined()
    expect(el.querySelector('[data-part="authoring-conversation"]'), 'the SAME card — arming fills it, never swaps it').toBe(author)
    expect(el.querySelector('[data-part="author-empty"]'), 'the empty-log copy is gone from the log').toBeNull()
    const after = author.getBoundingClientRect()
    expect(Math.abs(after.width - cardBefore.width), 'and the column does not jump').toBeLessThanOrEqual(1)
    expect(author.textContent, 'the description the user typed opened it — nothing swallowed').toContain('a hotel concierge please')
    const bubble = author.querySelector('[data-part="log"] [data-part="bubble"][data-role="user"]') as HTMLElement
    expect(bubble.getBoundingClientRect().height, 'as a painted turn in the log').toBeGreaterThan(0)
  })
})

// GH #666 (Kim's 2026-08-10 additional pixel note) — the settings sub-nav sat flush against the first
// section heading. The cause was NOT a missing declaration: `[data-part='settings-pane']`'s `display: flex`
// lost to `master-detail-pane.css`'s own `@scope`d `:scope { display: block }` at equal specificity, where
// the cascade's SCOPE PROXIMITY step outranks source order — so the pane never became a flex container and
// its declared `gap` did nothing. That failure is invisible to any probe that reads the STYLESHEET; only a
// measured box between two real siblings catches it, which is what this describe is.
describe('ui-agent-admin — the settings pane is a real flex column, so its declared section gap actually applies (GH #666)', () => {
  const frames = async (n = 3): Promise<void> => {
    for (let i = 0; i < n; i += 1) await new Promise((r) => requestAnimationFrame(() => r(null)))
  }

  // Both states Kim named: the docked pair inside the triple, and the narrow single-panel drill-in.
  for (const [label, width] of [
    ['the triple/docked pair', 1200],
    ['the narrow single panel', 700],
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
      // The mechanism, stated: a declared `gap` on a BLOCK box is inert, so the container type is the
      // thing that has to hold, not merely the gap declaration.
      expect(paneStyle.display, 'the pane is a flex container — the tag in its selector is load-bearing').toBe('flex')
      expect(paneStyle.flexDirection).toBe('column')

      const declared = Math.round(parseFloat(paneStyle.rowGap))
      expect(declared, 'anti-vacuous: the section gap resolves to a real length').toBeGreaterThan(0)

      const measured = Math.round(section.getBoundingClientRect().top - nav.getBoundingClientRect().bottom)
      expect(measured, 'and the RENDERED distance is that gap, not zero').toBe(declared)
    })
  }

  it('the Author pane is the same real flex column — its `flex` child rule is live, not dead weight', async () => {
    // The same shared selector governs both regions, so the Author card's fill was riding on
    // `ui-conversation`'s own `block-size: 100%` while `> ui-conversation { flex: 1 1 auto }` did nothing.
    const { el } = mountAgentAdminAt(1200)
    await frames()
    const authorPane = el.querySelector('[data-part="author-pane"]') as HTMLElement
    const card = el.querySelector('[data-part="authoring-conversation"]') as HTMLElement
    expect(getComputedStyle(authorPane).display).toBe('flex')
    expect(getComputedStyle(card).flexGrow, 'the card is a real flex item now').toBe('1')
    expect(
      Math.round(authorPane.getBoundingClientRect().height - card.getBoundingClientRect().height),
      'and it still fills its column exactly, as it did before the container type was fixed',
    ).toBe(0)
  })
})







