import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

// component-preview.browser.test.ts — the CROSS-ENGINE VISUAL smoke for the docs-site <component-preview> element
// (site/lib/component-preview.ts). This is the risky piece the "test the whole shape" rule targets: a preview can
// pass every per-part assertion and still ship a COLLAPSED specimen (a control with no width in a flex column, the
// ui-slider dot precedent), so this proves — in real engines — that (1) an a2ui-mode target renders a LIVE ui-*
// control with real, non-collapsed geometry inside the shared canvas, (2) a knob change re-renders it through a
// fresh renderer, and (3) a component-mode target renders directly and mutates IN PLACE on a knob change. jsdom
// resolves none of this (no @scope, no dimensional ramp, no computed geometry), so it can only be proven here.
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → two playwright instances).
//
// The foundation CSS cascade (ADR-0003) is imported explicitly (the two barrels) so the control geometry is REAL;
// the site module itself imports the self-defining controls + its own chrome. Runs under the `site` vitest project
// (vitest.browser.config.ts's `test.projects`), co-located with the module it tests.
import '@agent-ui/components/foundation-styles.css' // foundation tokens + dimensional ramp (FIRST — geometry source)
import '@agent-ui/components/component-styles.css' // per-control CSS (so the specimen has real geometry, not 0×0)
import './component-preview.ts' // registers <component-preview> + the self-defining ui-* controls

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (rAF frame settles + real-input
// driver round trips), so its duration is set by the browser's scheduling, which stretches under load.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
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

// A custom element's connectedCallback builds synchronously, but a ui-* control's first render + the A2UI
// renderer's mount settle across a frame — await two rAFs so computed geometry is available before asserting.
const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Mount a <component-preview> with the given mode/target and let it settle. */
async function mountPreview(mode: string, target: string): Promise<HTMLElement> {
  const preview = document.createElement('component-preview')
  preview.setAttribute('mode', mode)
  preview.setAttribute('target', target)
  root.append(preview)
  await raf()
  return preview
}

const surfaceButton = (preview: HTMLElement): HTMLElement | null =>
  preview.querySelector('.canvas-surface ui-button') as HTMLElement | null

const surfaceControl = (preview: HTMLElement, tag: string): HTMLElement | null =>
  preview.querySelector(`.canvas-surface ${tag}`) as HTMLElement | null

// The knob controls are dogfooded ui-* controls (ui-segmented-control / ui-select / ui-switch / ui-text-field),
// not native <input>/<select>/<button> — so a knob is read/written through its control's own property
// (`.value` / `.checked`), not a native input node. This resolves the ui-* control hosting the named knob's
// editable value.
const knobControl = <T extends HTMLElement>(preview: HTMLElement, name: string): T | undefined =>
  Array.from(preview.querySelectorAll<HTMLElement>('.knob')).find(
    (row) => row.querySelector('.knob-label')?.textContent === name,
  )?.querySelector('ui-select, ui-switch, ui-text-field, ui-segmented-control') as T | undefined

// The ONE `ui-segment` member (by its visible label) inside a small-enum knob's `ui-segmented-control`
// (batch A: a ≤5-member enum prop routes to ui-segmented-control, not ui-select — ADR-0095's "every option
// visible" control, superseding the retired ui-radio-group[variant="segmented"]).
const knobSegment = (preview: HTMLElement, name: string, member: string): HTMLElement | undefined =>
  Array.from(
    Array.from(preview.querySelectorAll<HTMLElement>('.knob'))
      .find((row) => row.querySelector('.knob-label')?.textContent === name)
      ?.querySelectorAll<HTMLElement>('ui-segment') ?? [],
  ).find((r) => r.textContent === member)

// ── a2ui mode (both engines) ───────────────────────────────────────────────────────────────────────────────────

describe('component-preview — a2ui mode renders a live control through the real renderer (both engines)', () => {
  it('mode="a2ui" target="Button" mounts a live ui-button in the canvas with real, non-collapsed geometry', async () => {
    const preview = await mountPreview('a2ui', 'Button')
    const button = surfaceButton(preview)
    expect(button, 'no ui-button rendered under .canvas-surface — the a2ui payload did not render').not.toBeNull()
    const rect = (button as HTMLElement).getBoundingClientRect()
    expect(rect.width, 'ui-button collapsed to ~0 width (the ui-slider-dot failure mode)').toBeGreaterThan(24)
    expect(rect.height, 'ui-button collapsed to ~0 height').toBeGreaterThan(16)
    expect((button as HTMLElement).textContent).toContain('Button') // the seeded label knob
  })

  it('a knob change re-renders the canvas through a fresh renderer (edit label → the new button reflects it)', async () => {
    const preview = await mountPreview('a2ui', 'Button')
    const field = knobControl<HTMLElement & { value: string }>(preview, 'label')
    expect(field, 'no label knob control found (dogfooded ui-text-field)').toBeTruthy()
    field!.value = 'Re-rendered' // the ui-text-field `value` property (the preview's `input` listener reads it back)
    field!.dispatchEvent(new Event('input', { bubbles: true }))
    await raf()
    expect(surfaceButton(preview)?.textContent, 'the canvas did not re-render on the knob change').toContain('Re-rendered')
  })

  // The enum knob is DERIVED from a catalog enum — any enum prop grows a knob for free. `Button.variant`
  // (solid·soft·ghost, 3 members) routes to the ui-segmented-control knob (batch A's ≤5-member branch):
  // clicking a segment re-renders through a fresh renderer. (This test used to drive `TextField.size` —
  // GH #1188: the 2026-08-17 size-attr scrub, commit 6b3f90f9/#1148, deliberately removed `size` from every
  // catalog component including TextField, per Kim's ruling; `Button.variant` is the still-real small enum
  // this test now proves the mechanism against.) Button carries an A2UI_INITIAL seed of `variant: 'solid'`
  // (component-preview.ts), so this test targets 'ghost' instead — a genuinely UNCHECKED member — to prove
  // the click really drives a commit, not merely re-observe the seed (the same reasoning the component-mode
  // `ghost` segment test below already relies on).
  it('a segmented-control knob click re-renders with the chosen member (Button.variant, a real catalog enum)', async () => {
    const preview = await mountPreview('a2ui', 'Button')
    const ghost = knobSegment(preview, 'variant', 'ghost')
    expect(ghost, 'no `ghost` segment found in the variant knob (dogfooded ui-segmented-control)').toBeTruthy()
    await userEvent.click(ghost as HTMLElement)
    await raf()
    expect(surfaceButton(preview)?.getAttribute('variant')).toBe('ghost')
  })
})

// ── component mode (both engines) ──────────────────────────────────────────────────────────────────────────────

describe('component-preview — component mode renders the ui-* control directly (both engines)', () => {
  it('mode="component" target="ui-button" renders a ui-button with real, non-collapsed geometry', async () => {
    const preview = await mountPreview('component', 'ui-button')
    const button = surfaceButton(preview)
    expect(button, 'no ui-button rendered under .canvas-surface in component mode').not.toBeNull()
    const rect = (button as HTMLElement).getBoundingClientRect()
    expect(rect.width, 'ui-button collapsed to ~0 width').toBeGreaterThan(24)
    expect(rect.height, 'ui-button collapsed to ~0 height').toBeGreaterThan(16)
  })

  it('a knob change mutates the SAME element in place (component mode does not tear down)', async () => {
    const preview = await mountPreview('component', 'ui-button')
    const before = surfaceButton(preview)
    const ghost = knobSegment(preview, 'variant', 'ghost')
    expect(ghost, 'no `ghost` segment found in the variant knob (dogfooded ui-segmented-control)').toBeTruthy()
    await userEvent.click(ghost as HTMLElement)
    await raf()
    const after = surfaceButton(preview)
    expect(after, 'the ui-button was replaced — component mode should mutate in place').toBe(before)
    expect(after?.getAttribute('variant')).toBe('ghost')
  })
})

// ── canvas → knob direction (the gap that hid the desync bug) — both engines ───────────────────────────────────
// The render used to be a blind full re-apply from #state with no read-back, so any DIRECT interaction with the
// live specimen was reverted on the next knob edit. These pin the fix: direct interaction must SURVIVE a knob edit
// AND reflect back into its knob (component mode), and typed text must survive an a2ui rebuild (read-back).

describe('component-preview — direct canvas interaction survives a knob edit (both engines)', () => {
  it('component: toggling the live checkbox reflects into its knob AND survives an unrelated knob edit', async () => {
    const preview = await mountPreview('component', 'ui-checkbox')
    const box = surfaceControl(preview, 'ui-checkbox')
    expect(box, 'no ui-checkbox rendered').not.toBeNull()

    await userEvent.click(box as HTMLElement) // toggle the live control (canvas → knob read-back)
    await raf()
    expect((box as unknown as { checked: boolean }).checked, 'the click did not check the live control').toBe(true)
    expect(
      knobControl<HTMLElement & { checked: boolean }>(preview, 'checked')?.checked,
      'the `checked` knob did not reflect the live toggle (dogfooded ui-switch)',
    ).toBe(true)

    const lg = knobSegment(preview, 'size', 'lg') // edit an UNRELATED knob (size)
    expect(lg, 'no `lg` segment found in the size knob').toBeTruthy()
    await userEvent.click(lg as HTMLElement)
    await raf()
    const after = surfaceControl(preview, 'ui-checkbox')
    expect(after, 'the checkbox was torn down on an unrelated knob edit (component mode should diff in place)').toBe(box)
    expect((after as unknown as { checked: boolean }).checked, 'live checked was REVERTED by an unrelated knob edit').toBe(true)
    expect(after?.getAttribute('size')).toBe('lg') // the actual edit landed
  })

  it('a2ui: text typed into the live field survives a disabled re-render (read-back before rebuild)', async () => {
    const preview = await mountPreview('a2ui', 'TextField')
    const field = surfaceControl(preview, 'ui-text-field')
    expect(field, 'no ui-text-field rendered').not.toBeNull()
    ;(field as unknown as { value: string }).value = 'typed by user' // the live value the rebuild must preserve

    // This test used to drive `TextField.size` as the "unrelated knob" — GH #1188: the 2026-08-17 size-attr
    // scrub (commit 6b3f90f9/#1148) deliberately removed `size` from every catalog component, TextField
    // included, per Kim's ruling. `disabled` (boolean, bindable, no A2UI_INITIAL seed ⇒ starts unchecked) is
    // still a real, unrelated TextField knob whose commit forces the same a2ui dispose+rebuild — clicking its
    // dogfooded ui-switch knob flips it from its genuine default (false), so the commit is real, not vacuous.
    const disabledKnob = knobControl<HTMLElement>(preview, 'disabled')
    expect(disabledKnob, 'no `disabled` knob control found (dogfooded ui-switch)').toBeTruthy()
    await userEvent.click(disabledKnob as HTMLElement) // change an unrelated knob → a2ui dispose+rebuild
    await raf()
    const after = surfaceControl(preview, 'ui-text-field')
    expect((after as unknown as { value: string }).value, 'typed text vanished on the disabled re-render').toBe(
      'typed by user',
    )
    expect(
      after?.hasAttribute('disabled'),
      'the click did not commit — the a2ui payload never re-rendered with `disabled`',
    ).toBe(true)
  })
})

// GH #892 note: the gallery/preview mount's WIDTH-FILL contract rides the shared `site/lib/canvas-surface.ts`
// helper this element composes (`createCanvasSurface`/`applyRootStretch`) — measured directly, at a
// controlled width, in `canvas-surface.browser.test.ts` (the docs-page's own two-column responsive grid
// squeezes `.canvas-surface` down to a few dozen px at this suite's default 414px mobile viewport, which
// would make a width-fill assertion HERE measure the grid's incidental squeeze, not this ticket's fix).
