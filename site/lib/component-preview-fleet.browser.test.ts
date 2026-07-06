import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/icons/phosphor'
import './component-preview.ts'
import { NO_SLOT_TEXT, SLOT_TEXT_OK } from './component-preview.ts'

// component-preview-fleet.browser.test.ts — the DIRECT component-preview regression probe for the SLOT_TEXT
// hardening (component-preview.ts's "SLOT_TEXT gating" section). Where gallery.browser.test.ts proves the
// fleet-wide completeness TRANSITIVELY (every member renders through <component-gallery>), this guards the
// fix at component-preview.ts's OWN level: build every fleet member in component mode and assert its
// structure survives the full knob-application loop — so a regression here is caught even if the gallery
// changes shape later. Runs in BOTH Chromium and WebKit.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

let root: HTMLElement | undefined
async function mountPreview(target: string): Promise<HTMLElement> {
  root = document.createElement('div')
  document.body.append(root)
  const preview = document.createElement('component-preview')
  preview.setAttribute('mode', 'component')
  preview.setAttribute('target', target)
  root.append(preview)
  await raf()
  // Scope to the canvas SPECIMEN: the knob column now dogfoods ui-* controls (ui-select/ui-checkbox/
  // ui-text-field), so a bare `querySelector(target)` would match a same-tag KNOB in the left column ahead
  // of the specimen. The live specimen is the one under `.canvas-surface`.
  return preview.querySelector(`.canvas-surface ${target}`) as HTMLElement
}
afterEach(() => {
  root?.remove()
  root = undefined
})

/** Mirrors component-preview.ts's own slotTextDefault(): a title-cased tag stem ('ui-text-field' → 'Text Field'). */
const slotTextDefault = (tag: string): string =>
  tag.replace(/^ui-/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

describe('component-preview — NO_SLOT_TEXT targets keep their structural children through the full knob build', () => {
  for (const tag of NO_SLOT_TEXT) {
    it(`${tag}: structure survives (SLOT_TEXT no-ops)`, async () => {
      const live = await mountPreview(tag)
      expect(live, `no live ${tag} rendered`).not.toBeNull()
      expect(live.children.length, `${tag} lost its structural children to SLOT_TEXT`).toBeGreaterThan(0)
    })
  }
})

// NOTE: this loop is a regression FLOOR, not a classification proof. It only re-checks that a control ALREADY
// believed SLOT_TEXT_OK still applies the text knob correctly on a later change — it can't catch a control
// that was WRONGLY classified OK, since `el.textContent = raw` still WRITES that string regardless of what
// structural child it just clobbered (a `textContent === default` read would pass even over the wreckage).
// The actual classification is verified per-control by direct diagnosis and pinned by the fleet PARTITION gate
// (component-preview-slot-text.test.ts) — this test only guards the already-classified-OK half against a
// future regression in the apply path itself.
describe('component-preview — SLOT_TEXT_OK targets still apply the default-slot text (no regression)', () => {
  for (const tag of SLOT_TEXT_OK) {
    it(`${tag}: textContent === the seeded default (SLOT_TEXT still applies)`, async () => {
      const live = await mountPreview(tag)
      expect(live, `no live ${tag} rendered`).not.toBeNull()
      expect(live.textContent).toBe(slotTextDefault(tag))
    })
  }
})

describe('component-preview — the two flagged edge cases (named regression guards)', () => {
  it('ui-combo-box: opens after a full build without throwing (the bug that started this investigation)', async () => {
    const live = await mountPreview('ui-combo-box')
    live.setAttribute('open', '')
    await raf() // the model→overlay effect settles here; a stale (wiped) listbox would throw InvalidStateError
    const panel = live.querySelector('[popover]') as HTMLElement | null
    expect(panel, 'ui-combo-box: no [popover] listbox found after opening').not.toBeNull()
    expect((panel as HTMLElement).getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it('ui-text: self-heals through an `as` change AND a later text-knob edit (the falsifying case for a children-count heuristic)', async () => {
    const preview = document.createElement('component-preview')
    preview.setAttribute('mode', 'component')
    preview.setAttribute('target', 'ui-text')
    root = document.createElement('div')
    document.body.append(root)
    root.append(preview)
    await raf()

    // Switch `as` to 'h1' via its derived variant chip (component-preview.ts's chip-row, one per enum knob).
    const asChip = [...preview.querySelectorAll<HTMLElement>('.chip-row')]
      .find((row) => row.querySelector('.chip-row-label')?.textContent === 'as')
      ?.querySelectorAll<HTMLButtonElement>('.chip')
    const h1Chip = [...(asChip ?? [])].find((c) => c.textContent === 'h1')
    expect(h1Chip, 'no `as=h1` chip found').toBeTruthy()
    h1Chip!.click()
    await raf()

    let live = preview.querySelector('ui-text') as HTMLElement
    expect(live.querySelector('h1'), 'ui-text did not stamp an <h1> for as=h1').not.toBeNull()

    // Now edit the "text" knob (SLOT_TEXT) — the stamp must survive/re-adopt, not vanish. The knob is now a
    // dogfooded ui-text-field (not a native <input>); its `.value` property is the edit surface and the
    // preview's own `input` listener reads it back.
    const textField = [...preview.querySelectorAll<HTMLElement>('.knob')]
      .find((row) => row.querySelector('.knob-label')?.textContent === 'text')
      ?.querySelector('ui-text-field') as (HTMLElement & { value: string }) | undefined
    expect(textField, 'no text knob control found (dogfooded ui-text-field)').toBeTruthy()
    textField!.value = 'Re-heal me'
    textField!.dispatchEvent(new Event('input', { bubbles: true }))
    await raf()

    live = preview.querySelector('ui-text') as HTMLElement
    const h1 = live.querySelector('h1')
    expect(h1, 'ui-text lost its <h1> stamp after a text-knob edit').not.toBeNull()
    expect(h1?.textContent).toBe('Re-heal me')
  })

  it('ui-icon: keeps its name-driven <svg> — no SLOT_TEXT knob is even grown to threaten it (T3 finding #1)', async () => {
    const preview = document.createElement('component-preview')
    preview.setAttribute('mode', 'component')
    preview.setAttribute('target', 'ui-icon')
    root = document.createElement('div')
    document.body.append(root)
    root.append(preview)
    await raf()

    const live = preview.querySelector('ui-icon') as HTMLElement
    expect(live, 'no live ui-icon rendered').not.toBeNull()
    expect(live.querySelector('svg'), 'ui-icon did not render its COMPONENT_INITIAL-seeded <svg>').not.toBeNull()

    // The exact clobber this fix closes: before the reclassification, ui-icon carried a live SLOT_TEXT ("text")
    // knob whose `el.textContent =` write would wipe the setIcon()-injected <svg> the moment `name` was set.
    // Prove the knob no longer exists at all (generation-time gating, not just a runtime no-op at apply time).
    const textKnob = [...preview.querySelectorAll<HTMLElement>('.knob')].find(
      (row) => row.querySelector('.knob-label')?.textContent === 'text',
    )
    expect(textKnob, 'ui-icon still grows a dead SLOT_TEXT knob').toBeUndefined()
    expect(live.querySelector('svg'), 'the <svg> did not survive a full knob build').not.toBeNull()
  })
})
