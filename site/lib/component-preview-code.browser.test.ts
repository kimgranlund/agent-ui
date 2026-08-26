import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

// component-preview-code.browser.test.ts — the CROSS-ENGINE proof for <component-preview>'s tabbed code view
// (GH #1664, component-preview-code-tabs.lld.md §7 item 3). jsdom cannot prove this surface: it has no real
// CSS cascade (custom-property resolution via getComputedStyle needs the real Vite CSS pipeline — see
// preview-source.test.ts's own note on why jsdom mocks .css content), no real keyboard focus movement, and no
// real clipboard. Proven here, in BOTH Chromium and WebKit, mirroring component-preview.browser.test.ts's own
// mount/raf conventions (same file, same `site` vitest project).
import '@agent-ui/components/foundation-styles.css' // foundation tokens + dimensional ramp (geometry + --md-sys-* values are REAL)
import '@agent-ui/components/component-styles.css' // per-control CSS (the CSS tab's own token source)
import './component-preview.ts' // registers <component-preview> + the self-defining ui-* controls

// GH #347 — REAL-TIMING HEADROOM (same rationale as component-preview.browser.test.ts): this file awaits real
// rAF frames + real-input driver round trips.
vi.setConfig({ testTimeout: 30_000 })

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────────────
let root: HTMLElement
beforeEach(() => {
  root = document.createElement('div')
  document.body.append(root)
})
afterEach(() => {
  root.remove()
})

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Mount a <component-preview> with the given mode/target and let it settle (first paint + the rAF-coalesced
 *  code-view refresh both need a frame). */
async function mountPreview(mode: string, target: string): Promise<HTMLElement> {
  const preview = document.createElement('component-preview')
  preview.setAttribute('mode', mode)
  preview.setAttribute('target', target)
  root.append(preview)
  await raf()
  return preview
}

const codeTabs = (preview: HTMLElement): HTMLElement[] => Array.from(preview.querySelectorAll('.preview-code-tab'))
const codeTabLabels = (preview: HTMLElement): string[] => codeTabs(preview).map((t) => t.textContent ?? '')
const codeTab = (preview: HTMLElement, label: string): HTMLElement | undefined =>
  codeTabs(preview).find((t) => t.textContent === label)
const activeCodePanel = (preview: HTMLElement): HTMLElement | null =>
  preview.querySelector('.preview-code-panel:not([hidden])')
const codePanelText = (preview: HTMLElement, label: string): string => {
  const tab = codeTab(preview, label)
  const panelId = tab?.getAttribute('aria-controls')
  const panel = panelId ? (preview.querySelector(`#${panelId}`) as HTMLElement | null) : null
  return panel?.querySelector('ui-code')?.textContent ?? ''
}

// The knob controls are dogfooded ui-* controls (component-preview.browser.test.ts's own precedent).
const knobControl = <T extends HTMLElement>(preview: HTMLElement, name: string): T | undefined =>
  Array.from(preview.querySelectorAll<HTMLElement>('.knob')).find(
    (row) => row.querySelector('.knob-label')?.textContent === name,
  )?.querySelector('ui-select, ui-switch, ui-text-field, ui-segmented-control') as T | undefined

const knobSegment = (preview: HTMLElement, name: string, member: string): HTMLElement | undefined =>
  Array.from(
    Array.from(preview.querySelectorAll<HTMLElement>('.knob'))
      .find((row) => row.querySelector('.knob-label')?.textContent === name)
      ?.querySelectorAll<HTMLElement>('ui-segment') ?? [],
  ).find((r) => r.textContent === member)

/** A stubbed clipboard (jsdom-free real browser has no writable clipboard permission by default in this
 *  harness) — records the last write, resolves like the real API. */
function stubClipboard(): { lastWrite: () => string | undefined } {
  let last: string | undefined
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (text: string): Promise<void> => { last = text; return Promise.resolve() } },
  })
  return { lastWrite: () => last }
}

// ── tab set per mode ───────────────────────────────────────────────────────────────────────────────────────────

describe('component-preview code view — the tablist renders the correct tab set per mode (both engines)', () => {
  it('mode="component" renders exactly HTML, JS, CSS (in that order), HTML active by default', async () => {
    const preview = await mountPreview('component', 'ui-button')
    expect(codeTabLabels(preview)).toEqual(['HTML', 'JS', 'CSS'])
    const active = activeCodePanel(preview)
    expect(active, 'no active (non-hidden) panel found').not.toBeNull()
    expect(codeTab(preview, 'HTML')?.getAttribute('aria-selected')).toBe('true')
  })

  it('mode="a2ui" renders exactly JSON, CSS (in that order), JSON active by default', async () => {
    const preview = await mountPreview('a2ui', 'Button')
    expect(codeTabLabels(preview)).toEqual(['JSON', 'CSS'])
    expect(codeTab(preview, 'JSON')?.getAttribute('aria-selected')).toBe('true')
  })
})

// ── tab click swaps the visible panel ─────────────────────────────────────────────────────────────────────────

describe('component-preview code view — clicking a tab swaps the visible panel (both engines)', () => {
  it('hidden toggles and aria-selected flips when a different tab is clicked', async () => {
    const preview = await mountPreview('component', 'ui-button')
    const htmlTab = codeTab(preview, 'HTML') as HTMLElement
    const jsTab = codeTab(preview, 'JS') as HTMLElement
    const htmlPanelId = htmlTab.getAttribute('aria-controls') as string
    const jsPanelId = jsTab.getAttribute('aria-controls') as string
    const htmlPanel = preview.querySelector(`#${htmlPanelId}`) as HTMLElement
    const jsPanel = preview.querySelector(`#${jsPanelId}`) as HTMLElement

    expect(htmlPanel.hidden).toBe(false)
    expect(jsPanel.hidden).toBe(true)

    await userEvent.click(jsTab)
    await raf()

    expect(jsTab.getAttribute('aria-selected')).toBe('true')
    expect(htmlTab.getAttribute('aria-selected')).toBe('false')
    expect(jsPanel.hidden).toBe(false)
    expect(htmlPanel.hidden).toBe(true)
  })
})

// ── a knob edit updates the ACTIVE panel's rendered text ──────────────────────────────────────────────────────

describe('component-preview code view — a knob edit regenerates the active panel (both engines)', () => {
  it('variant knob → generated HTML gains variant="ghost" (default-active HTML tab, component mode)', async () => {
    const preview = await mountPreview('component', 'ui-button')
    expect(codePanelText(preview, 'HTML')).toContain('variant="solid"') // the A2UI/component seed default

    const ghost = knobSegment(preview, 'variant', 'ghost')
    expect(ghost, 'no `ghost` segment found in the variant knob').toBeTruthy()
    await userEvent.click(ghost as HTMLElement)
    await raf()

    expect(codePanelText(preview, 'HTML')).toContain('variant="ghost"')
  })

  it('a2ui mode: a label edit regenerates the active JSON panel with the new value', async () => {
    const preview = await mountPreview('a2ui', 'Button')
    const field = knobControl<HTMLElement & { value: string }>(preview, 'label')
    expect(field, 'no label knob control found').toBeTruthy()
    field!.value = 'Re-rendered label'
    field!.dispatchEvent(new Event('input', { bubbles: true }))
    await raf()
    expect(codePanelText(preview, 'JSON')).toContain('Re-rendered label')
  })
})

// ── active tab persists across an a2ui rebuild (E1) ───────────────────────────────────────────────────────────

describe('component-preview code view — active tab survives an a2ui knob edit (E1, both engines)', () => {
  it('the CSS tab stays selected/visible (and its own DOM node persists) across an a2ui dispose+rebuild', async () => {
    const preview = await mountPreview('a2ui', 'Button')
    const cssTab = codeTab(preview, 'CSS') as HTMLElement
    await userEvent.click(cssTab)
    await raf()
    expect(cssTab.getAttribute('aria-selected')).toBe('true')

    const codeViewEl = preview.querySelector('.preview-code') as HTMLElement
    expect(codeViewEl, 'no .preview-code element found').not.toBeNull()

    // An unrelated knob edit forces a2ui's dispose+rebuild (surface.replaceChildren() + a fresh renderer).
    const disabledKnob = knobControl<HTMLElement>(preview, 'disabled')
    expect(disabledKnob, 'no `disabled` knob control found').toBeTruthy()
    await userEvent.click(disabledKnob as HTMLElement)
    await raf()

    // .preview-code is a SIBLING of the artboard, never inside #surface — the SAME node survives the rebuild.
    expect(preview.querySelector('.preview-code')).toBe(codeViewEl)
    expect(cssTab.getAttribute('aria-selected'), 'the CSS tab selection did not survive the a2ui rebuild').toBe('true')
    const cssPanelId = cssTab.getAttribute('aria-controls') as string
    const cssPanel = preview.querySelector(`#${cssPanelId}`) as HTMLElement
    expect(cssPanel.hidden, 'the CSS panel is no longer the visible one after the a2ui rebuild').toBe(false)
  })
})

// ── tablist a11y — roving tabindex, ArrowRight moves focus AND selection ─────────────────────────────────────

describe('component-preview code view — tablist keyboard nav (roving tabindex, both engines)', () => {
  it('ArrowRight moves focus to the next tab AND selects it', async () => {
    const preview = await mountPreview('component', 'ui-button')
    const htmlTab = codeTab(preview, 'HTML') as HTMLElement
    const jsTab = codeTab(preview, 'JS') as HTMLElement

    expect(htmlTab.tabIndex).toBe(0)
    expect(jsTab.tabIndex).toBe(-1)

    htmlTab.focus()
    expect(document.activeElement).toBe(htmlTab)
    await userEvent.keyboard('{ArrowRight}')
    await raf()

    expect(document.activeElement, 'focus did not move to the JS tab on ArrowRight').toBe(jsTab)
    expect(jsTab.getAttribute('aria-selected')).toBe('true')
    expect(jsTab.tabIndex).toBe(0)
    expect(htmlTab.getAttribute('aria-selected')).toBe('false')
    expect(htmlTab.tabIndex).toBe(-1)
  })
})

// ── Copy writes to the clipboard + the status span reads "Copied" ────────────────────────────────────────────

describe('component-preview code view — Copy writes the active panel source to the clipboard (both engines)', () => {
  it('clicking Copy on the active (HTML) panel writes its cached source and the status reads "Copied"', async () => {
    const { lastWrite } = stubClipboard()
    const preview = await mountPreview('component', 'ui-button')
    const activePanel = activeCodePanel(preview) as HTMLElement
    const copyButton = activePanel.querySelector('.preview-code-copy') as HTMLElement
    const status = activePanel.querySelector('.preview-code-status') as HTMLElement
    expect(copyButton, 'no Copy button found in the active panel').toBeTruthy()

    await userEvent.click(copyButton)
    await raf()

    expect(lastWrite()).toContain('<ui-button')
    expect(lastWrite()).toBe(codePanelText(preview, 'HTML'))
    expect(status.textContent).toBe('Copied')
  })
})

// ── the CSS panel resolves real --md-sys-* values for ui-button ──────────────────────────────────────────────

describe('component-preview code view — the CSS tab resolves real --md-sys-* token values (both engines)', () => {
  it('ui-button\'s CSS panel contains at least one --md-sys- line resolved to a non-empty value', async () => {
    const preview = await mountPreview('component', 'ui-button')
    const cssTab = codeTab(preview, 'CSS') as HTMLElement
    await userEvent.click(cssTab)
    await raf()

    const cssText = codePanelText(preview, 'CSS')
    expect(cssText.startsWith('ui-button {'), `unexpected CSS panel shape: ${cssText.slice(0, 80)}`).toBe(true)
    const tokenLine = cssText.split('\n').find((line) => /^\s*--md-sys-[\w-]+:\s*\S/.test(line))
    expect(tokenLine, `no resolved --md-sys- line found in:\n${cssText}`).toBeTruthy()
  })
})
