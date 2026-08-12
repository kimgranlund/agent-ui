import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// follow-the-change.browser.test.ts — the REAL-engine probes (GH #695/#721, ADR-0181;
// follow-the-change.spec.md SPEC-R3 AC1/AC3 · SPEC-R4 AC2 · SPEC-R5): real scroll position, real focus
// identity, real narrow-band paint truth, real animationend/reduced-motion. jsdom's halves (the
// zero-reaction table, coalescing, pending/epoch clears, the receipt, the per-fold truth-table) live in
// follow-the-change.test.ts — this file proves only what a real engine alone can (the agent-admin
// .browser.test.ts split, mirrored). Its OWN file, not an agent-admin.browser.test.ts append — the shard
// rule (`agent-ui-component-testing`): never re-monolith a grown suite.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css'
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-dialog.css'
import '../conversation/conversation-composer.css'
import '../surface-host/surface-host.css'
import '../super-shell/super-shell.css'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import '@agent-ui/icons/phosphor'
import { SURFACE_AUTHORING_KEY, SUPPORTED_MODELS } from './agent-admin-schema.ts'
import { createMemoryStore } from '../settings/memory-store.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

const frames = async (n = 3): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
}

/** Two CSS px below the 52.5rem line's own mount — exactly one place paints (the agent-admin
 *  .browser.test.ts constant, mirrored). */
const NARROW_BAND_WIDTH = 862

function mountAt(widthPx: number): { el: UIAgentAdminElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = `${widthPx}px`
  wrapper.style.height = '600px'
  wrapper.style.display = 'flex'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto'
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { el }
}

/** Arm a gate-ON Builder whose ONE scripted turn emits `patch` then a closing note. Arming itself
 *  legitimately writes visibility (§16.2's arm rule: Co-pilot lands visible AND primary) — so callers
 *  measuring "the REACTION writes nothing" must capture their baseline AFTER this settles. */
async function armBuilder(el: UIAgentAdminElement, patch: { values?: Record<string, unknown>; entries?: Record<string, unknown[]> }): Promise<void> {
  el.agentSurfaceTurn = async function* () {
    yield { kind: 'patch' as const, patch }
    yield { kind: 'note' as const, note: 'Done.' }
  }
  el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
  await el.updateComplete
  await frames()
}

/** Run the armed turn through the Co-pilot region's real composer; resolves once it fully settles. */
async function sendTurn(el: UIAgentAdminElement): Promise<void> {
  const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
  const composer = authoring.querySelector('ui-conversation-composer') as HTMLElement & { value: string; busy: boolean }
  composer.value = 'apply the change'
  ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()
  // settle: the composer lock releases when the turn finalizes
  for (let i = 0; i < 40 && composer.busy; i++) await new Promise((r) => setTimeout(r, 50))
  await frames()
}

async function runPatchTurn(el: UIAgentAdminElement, patch: { values?: Record<string, unknown>; entries?: Record<string, unknown[]> }): Promise<void> {
  await armBuilder(el, patch)
  await sendTurn(el)
}

const navOf = (el: UIAgentAdminElement): { selected: string } => el.querySelector('[data-part="settings-nav"]') as unknown as { selected: string }
const holderOf = (el: UIAgentAdminElement): HTMLElement => el.querySelector('[data-part="pane-holder"]') as HTMLElement
const foldOf = (el: UIAgentAdminElement, item: string): HTMLElement =>
  el.querySelector(`[data-part="settings-item"][data-item="${item}"]`) as HTMLElement
const paneOf = (el: UIAgentAdminElement): HTMLElement => el.querySelector('[data-part="settings-pane"]') as HTMLElement

describe('follow-the-change — SPEC-R3 AC1/AC3: the wide-band reaction, real scroll + focus identity (both engines)', () => {
  it('a consumed model patch selects Agent, scrolls the Model fold into the pane viewport, washes it, and never moves focus', async () => {
    const { el } = mountAt(1200)
    await frames()
    // the ticket's own scenario: the user sits on Capabilities first
    const nav = navOf(el)
    nav.selected = 'capabilities-content'
    const seam = el as unknown as { applySettingsSectionSeam?: (k: string) => void }
    // drive the section apply the way the compose's own select handler does (programmatic write emits none)
    ;(el.querySelector('[data-part="settings-nav"]') as HTMLElement).dispatchEvent(
      new CustomEvent('select', { detail: { value: 'capabilities-content', index: 1 } }),
    )
    void seam
    await frames()
    const focusBefore = document.activeElement

    await runPatchTurn(el, { values: { model: SUPPORTED_MODELS[1]!.id } })

    expect(nav.selected, 'the sub-nav landed on the owning section').toBe('agent-content')
    const fold = foldOf(el, 'model')
    expect(fold.hasAttribute('data-attention'), 'the owning fold carries the wash').toBe(true)
    // real scroll truth: the fold's box intersects the settings pane's viewport
    const paneBox = paneOf(el).getBoundingClientRect()
    const foldBox = fold.getBoundingClientRect()
    expect(foldBox.bottom, 'the fold is scrolled into the pane viewport (top edge)').toBeGreaterThan(paneBox.top - 1)
    expect(foldBox.top, 'the fold is scrolled into the pane viewport (bottom edge)').toBeLessThan(paneBox.bottom + 1)
    expect(document.activeElement, 'keyboard focus is untouched on every path (AC3)').toBe(focusBefore)
  })
})

describe('follow-the-change — SPEC-R4 AC2: the narrow band leaves visibility byte-unchanged, paint truth (both engines)', () => {
  it('at a band where only primary paints, a consumed patch writes no visibility; the user’s own reveal fires the wash once', async () => {
    const { el } = mountAt(NARROW_BAND_WIDTH)
    await frames()
    const holder = holderOf(el)
    // arm FIRST — arming itself writes visibility (§16.2's arm rule), and this test measures the
    // REACTION's writes, so the baseline is captured after the arm settles.
    await armBuilder(el, { values: { model: SUPPORTED_MODELS[1]!.id } })
    // anti-vacuous: at this band only primary (now copilot) paints — settings does not
    expect(paneOf(el).getClientRects().length, 'narrow: the settings pane does not paint').toBe(0)
    const showBefore = holder.getAttribute('data-show')
    const primaryBefore = holder.getAttribute('data-primary')

    await sendTurn(el)

    expect(holder.getAttribute('data-show'), 'data-show byte-unchanged at reaction completion').toBe(showBefore)
    expect(holder.getAttribute('data-primary'), 'data-primary byte-unchanged').toBe(primaryBefore)
    expect(foldOf(el, 'model').hasAttribute('data-attention'), 'nothing washed while nothing painted').toBe(false)

    // the user reveals Settings themselves (a write-driven reveal — SPEC-R4.2 fire hook (b); Agent is
    // already the selected section, so NO section flip happens — the exact scenario hook (a) alone misses)
    const reveal = el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }
    reveal.setPaneVisibilitySeam(['settings'], 'settings')
    await frames()
    expect(paneOf(el).getClientRects().length, 'the pane paints after the reveal').toBeGreaterThan(0)
    expect(foldOf(el, 'model').hasAttribute('data-attention'), 'the queued wash fired on the reveal').toBe(true)
  })
})

describe('follow-the-change — SPEC-R5: wash mechanics, real animationend + reduced motion', () => {
  it('AC1: data-attention appears on the reaction and clears after the wash completes', async () => {
    const { el } = mountAt(1200)
    await frames()
    await runPatchTurn(el, { values: { model: SUPPORTED_MODELS[1]!.id } })
    const fold = foldOf(el, 'model')
    expect(fold.hasAttribute('data-attention'), 'present immediately after the reaction').toBe(true)
    const style = getComputedStyle(fold)
    expect(style.animationName, 'the wash keyframe is actually running').toBe('ui-admin-attention')
    // the animation runs 1.6s; animationend (or the 2.5s fallback) strips the attribute
    for (let i = 0; i < 60 && fold.hasAttribute('data-attention'); i++) await new Promise((r) => setTimeout(r, 50))
    expect(fold.hasAttribute('data-attention'), 'absent after the wash completes').toBe(false)
  })

  it('AC2: reduced motion runs NO animation — the static outline appears instead (Chromium CDP; WebKit asserts the baseline)', async () => {
    const { el } = mountAt(1200)
    await frames()
    if (server.browser !== 'chromium') {
      // WebKit: no CDP media emulation in this driver stack (the menu.browser.test.ts split, mirrored) —
      // assert the NON-reduced baseline so the test still measures something real on this engine.
      await runPatchTurn(el, { values: { model: SUPPORTED_MODELS[1]!.id } })
      const fold = foldOf(el, 'model')
      expect(getComputedStyle(fold).animationName).toBe('ui-admin-attention')
      return
    }
    interface CdpSession {
      send(method: string, params?: Record<string, unknown>): Promise<unknown>
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      await runPatchTurn(el, { values: { model: SUPPORTED_MODELS[1]!.id } })
      const fold = foldOf(el, 'model')
      expect(fold.hasAttribute('data-attention'), 'the attention mark still lands').toBe(true)
      const style = getComputedStyle(fold)
      expect(style.animationName, 'no CSS animation runs under reduced motion').toBe('none')
      expect(style.outlineStyle, 'the static outline appears instead').toBe('solid')
      // the timeout fallback still clears it (no animationend will ever fire)
      for (let i = 0; i < 70 && fold.hasAttribute('data-attention'); i++) await new Promise((r) => setTimeout(r, 50))
      expect(fold.hasAttribute('data-attention'), 'the outline clears via the timeout fallback').toBe(false)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
