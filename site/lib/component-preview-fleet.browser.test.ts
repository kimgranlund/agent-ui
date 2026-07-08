import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/icons/phosphor'
import './component-preview.ts'
import { NO_SLOT_TEXT, SLOT_TEXT_OK, STRUCTURAL } from './component-preview.ts'

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
    // ui-slider is the one exception (batch C): it is NO_SLOT_TEXT NOT because it owns structural children to
    // protect (it has none — its track is ::before/::after only) but because it has NO text slot to grow a
    // knob for at all. It carries its own dedicated assertion below (no stray textContent), not this
    // children-count check.
    if (tag === 'ui-slider') continue
    it(`${tag}: structure survives (SLOT_TEXT no-ops)`, async () => {
      const live = await mountPreview(tag)
      expect(live, `no live ${tag} rendered`).not.toBeNull()
      expect(live.children.length, `${tag} lost its structural children to SLOT_TEXT`).toBeGreaterThan(0)
    })
  }
})

// STRUCTURAL (batch B) — the container's default slot IS its content model; a bare specimen must mount REAL,
// countable sample children (the representative-specimen law: a single stub cell / empty box teaches nothing).
// This is the "whole shape, measured" assertion the fleet gate needs — it fails if a future edit ever drops
// COMPONENT_SAMPLE_CHILDREN back down to a stub for one of these targets.
describe('component-preview — STRUCTURAL targets mount a representative specimen (batch B, not a stub)', () => {
  const CASES: ReadonlyArray<{ tag: string; minChildren: number }> = [
    { tag: 'ui-grid', minChildren: 6 }, // 6 cells — multiple auto-fit tracks form
    { tag: 'ui-row', minChildren: 3 },
    { tag: 'ui-column', minChildren: 3 },
    { tag: 'ui-list', minChildren: 3 },
    { tag: 'ui-card', minChildren: 3 }, // header + content + footer
    { tag: 'ui-radio-group', minChildren: 3 }, // sm/md/lg radios
    { tag: 'ui-segmented-control', minChildren: 3 }, // sm/md/lg segments (ADR-0095)
    { tag: 'ui-form-provider', minChildren: 2 }, // a field + a submit button
  ]
  it('CASES covers every STRUCTURAL tag (anti-vacuous)', () => {
    expect(new Set(CASES.map((c) => c.tag))).toEqual(STRUCTURAL)
  })
  for (const { tag, minChildren } of CASES) {
    it(`${tag}: mounts ≥ ${minChildren} real children (not a single stub / an empty box)`, async () => {
      const live = await mountPreview(tag)
      expect(live, `no live ${tag} rendered`).not.toBeNull()
      expect(live.children.length, `${tag} rendered a stub`).toBeGreaterThanOrEqual(minChildren)
    })
  }
})

// A handful of the other NO_SLOT_TEXT targets ALSO gained real sample content in batch B (previously just a
// bare trigger, or nothing at all) — spot-check the enriched shape survives a full knob build, at the
// descendant level (several of these controls reparent their author children into a control-created part, so
// a bare `.children.length` count on the host itself would not reflect what actually got mounted).
describe('component-preview — other enriched NO_SLOT_TEXT specimens mount representative content (batch B)', () => {
  it('ui-field: mounts its slotted ui-text-field', async () => {
    const live = await mountPreview('ui-field')
    expect(live?.querySelector('ui-text-field'), 'ui-field: no slotted text-field').not.toBeNull()
  })
  it('ui-tabs: mounts 2 ui-tab + 2 ui-tab-panel', async () => {
    const live = await mountPreview('ui-tabs')
    expect(live?.querySelectorAll('ui-tab').length).toBe(2)
    expect(live?.querySelectorAll('ui-tab-panel').length).toBe(2)
  })
  it('ui-select: mounts 3 [role=option] entries', async () => {
    const live = await mountPreview('ui-select')
    expect(live?.querySelectorAll('[role="option"]').length).toBe(3)
  })
  it('ui-combo-box: mounts 3 [role=option] entries', async () => {
    const live = await mountPreview('ui-combo-box')
    expect(live?.querySelectorAll('[role="option"]').length).toBe(3)
  })
  it('ui-menu: mounts a trigger + 4 menu items', async () => {
    const live = await mountPreview('ui-menu')
    expect(live?.querySelectorAll('[data-value]').length).toBe(4)
  })
  it('ui-popover: mounts a trigger + a heading+text section', async () => {
    const live = await mountPreview('ui-popover')
    expect(live?.querySelector('section h3')).not.toBeNull()
    expect(live?.querySelector('section p')).not.toBeNull()
  })
  it('ui-tooltip: mounts a trigger + its content text', async () => {
    const live = await mountPreview('ui-tooltip')
    expect(live?.textContent).toContain('Save your changes')
  })
  it('ui-modal: mounts heading + body + an action row inside its dialog part (does NOT auto-open)', async () => {
    const live = await mountPreview('ui-modal')
    expect(live?.hasAttribute('open'), 'ui-modal should not be seeded open').toBe(false)
    const dialog = live?.querySelector('dialog')
    expect(dialog, 'ui-modal: no dialog part').not.toBeNull()
    expect(dialog?.querySelector('h2')).not.toBeNull()
    expect(dialog?.querySelector('p')).not.toBeNull()
    expect(dialog?.querySelector('ui-row')).not.toBeNull()
  })
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

    // Switch `as` to 'h1' via its knob — `as` has 10 members (none/h1…h6/p/span/blockquote), so it routes to
    // the ui-select knob (batch A's >5-member branch), not ui-radio-group. Drive it the same way the other
    // knob tests do: set `.value` then dispatch the control's own commit event (`select`, NOT `change`).
    const asSelect = [...preview.querySelectorAll<HTMLElement>('.knob')]
      .find((row) => row.querySelector('.knob-label')?.textContent === 'as')
      ?.querySelector('ui-select') as (HTMLElement & { value: string }) | undefined
    expect(asSelect, 'no `as` knob control found (dogfooded ui-select)').toBeTruthy()
    asSelect!.value = 'h1'
    asSelect!.dispatchEvent(new Event('select', { bubbles: true }))
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

  it('ui-slider: grows no SLOT_TEXT knob and stays free of stray textContent (batch C)', async () => {
    const live = await mountPreview('ui-slider')
    expect(live, 'no live ui-slider rendered').not.toBeNull()
    const preview = live.closest('component-preview') as HTMLElement
    const textKnob = [...preview.querySelectorAll<HTMLElement>('.knob')].find(
      (row) => row.querySelector('.knob-label')?.textContent === 'text',
    )
    expect(textKnob, 'ui-slider still grows a dead SLOT_TEXT knob').toBeUndefined()
    expect(
      live.textContent,
      'ui-slider textContent should stay empty — its track is ::before/::after, no text slot to inject into',
    ).toBe('')
    expect(live.getAttribute('aria-label'), 'ui-slider should carry a seeded accessible name (COMPONENT_SAMPLE_ATTRS)').toBe(
      'Volume',
    )
  })
})
