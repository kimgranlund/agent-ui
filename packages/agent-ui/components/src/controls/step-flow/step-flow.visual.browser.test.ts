import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// T-0198: the deliberately minted visual goldens for ui-step-flow's birth (the ADR-0110 harness; the
// confirm-receipt.visual.browser.test.ts precedent). Pins Direction B as the approved mockup draws it, with real
// fleet controls as the scenes: scene 2 (guests), scene 4 (extras), Next refused on scene 1 (departure missing),
// and the last scene as a self-committing BookingForm shape, where Back shares the commit Button's row (Kim's
// 2026-10-21 drawing change). Each on the A2UI canvas register (`data-tier="widget" data-scale="md"`, so Back and
// Next are the 28px lg step), in the light scheme and the dark scheme, then the four in the 400px column. Dark is set
// on the stage's own `color-scheme` (the super-shell.visual precedent), and the dark leg asserts the dark arm
// resolved before it compares a pixel. Chromium-only. Baselines commit under
// `__baselines__/step-flow.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `--update` on this file (a deliberate act, per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css' // the fleet sans body, so the golden reads like the mockup, not the UA serif
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

const STEPS = JSON.stringify(['Dates', 'Guests', 'Room', 'Extras', 'Confirm'])

const SCENES = [
  '<ui-column gap="sm"><ui-field label="Arrival"><ui-text-field type="date" value="2026-11-14" required></ui-text-field></ui-field>' +
    '<ui-field label="Departure"><ui-text-field type="date" required></ui-text-field></ui-field></ui-column>',
  '<ui-amount-picker label="Guests" value="2" min="1" max="8"></ui-amount-picker>',
  '<ui-column gap="sm"><ui-checkbox checked>Deluxe king, $240</ui-checkbox></ui-column>',
  '<ui-column gap="sm"><ui-checkbox checked>Breakfast</ui-checkbox><ui-checkbox>Spa credit</ui-checkbox>' +
    '<ui-checkbox checked>Late check-out</ui-checkbox></ui-column>',
  // The BookingForm shape: a form root with an inline column (a2ui hospitality/factories.ts), a card, and the md
  // commit Button a direct child at the end edge.
  '<ui-form-provider style="display:flex; flex-direction:column; align-items:flex-end; gap:var(--md-sys-widget-gutter)">' +
    '<ui-card style="align-self:stretch"><ui-card-content><ui-column gap="sm">' +
    '<ui-field label="Stay"><ui-text-field value="Fri 14 Nov to Sun 16 Nov" readonly></ui-text-field></ui-field>' +
    '<ui-field label="Name"><ui-text-field value="Ada Lovelace"></ui-text-field></ui-field>' +
    '</ui-column></ui-card-content></ui-card>' +
    '<ui-button size="md" variant="solid">Book stay</ui-button></ui-form-provider>',
].join('')

const flow = (step: number): string => `<ui-step-flow steps='${STEPS}' step="${step}">${SCENES}</ui-step-flow>`

/** Scene 2, scene 4, Next refused on scene 1 (the departure is empty), and the self-commit last scene. */
const FOUR = [flow(2), flow(4), `<div data-refused>${flow(1)}</div>`, flow(5)].join('')

const mount = (width: string, markup: string, columns: number, scheme: 'light' | 'dark'): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.setAttribute('data-tier', 'widget')
  wrap.setAttribute('data-scale', 'md')
  wrap.style.cssText = `inline-size:${width}; padding:16px; display:grid; gap:16px; align-items:start; grid-template-columns:repeat(${columns}, minmax(0, 1fr)); box-sizing:border-box; color-scheme:${scheme}; background:var(--md-sys-color-neutral-surface-bright); color:var(--md-sys-color-neutral-on-surface);`
  wrap.innerHTML = markup
  document.body.append(wrap)
  return wrap
}

const settle = async (wrap: HTMLElement): Promise<void> => {
  for (const el of wrap.querySelectorAll('*')) {
    const pending = (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    if (pending !== undefined) await pending
  }
  // Next refused: press Next on the empty departure, then drop focus so no ring rides the shot.
  for (const host of wrap.querySelectorAll('[data-refused] > ui-step-flow')) {
    ;(host.querySelector(':scope > [data-part="actions"] > [data-part="next"]') as HTMLElement).click()
  }
  ;(document.activeElement as HTMLElement | null)?.blur()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))))
}

/** Mean sRGB channel of the surface role resolved inside `wrap`: near-white in light, near-black in dark. The
 *  computed colour may serialize as oklch(), so it is painted on a 1px canvas and read back as sRGB bytes. */
const surfaceMean = (wrap: HTMLElement): number => {
  const probe = document.createElement('div')
  probe.style.color = 'var(--md-sys-color-neutral-surface)'
  wrap.append(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.fillStyle = '#ff00ff' // a sentinel: an unparsed colour leaves it, and the mean lands mid-range on purpose
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  expect(ctx.fillStyle, `the surface role must parse as a colour, got ${computed}`).not.toBe('#ff00ff')
  return (r! + g! + b!) / 3
}

/** Anti-vacuity: each flow shows one scene, the refused one stayed on step 1, and one row is self-committing. */
const expectStates = (wrap: HTMLElement, flows: number): void => {
  const hosts = Array.from(wrap.querySelectorAll('ui-step-flow'))
  expect(hosts).toHaveLength(flows)
  for (const host of hosts) {
    const shown = Array.from(host.children).filter((c) => !(c as HTMLElement).dataset.part && !(c as HTMLElement).hidden)
    expect(shown).toHaveLength(1)
  }
  expect(wrap.querySelectorAll('[data-refused] > ui-step-flow[step="1"]')).toHaveLength(flows / 4)
  expect(wrap.querySelectorAll('ui-step-flow > [data-part="actions"][data-self-commit]')).toHaveLength(flows / 4)
}

describe('ui-step-flow: visual regression (T-0198 Direction B)', () => {
  it.skipIf(server.browser !== 'chromium')('scene 2, scene 4, Next refused and the self-commit last scene, light, two columns', async () => {
    await page.viewport(900, 1000)
    const wrap = mount('860px', FOUR, 2, 'light')
    await settle(wrap)
    expect(surfaceMean(wrap), 'the light stage resolved the dark arm').toBeGreaterThan(160)
    expectStates(wrap, 4)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('step-flow-light')
    wrap.remove()
    await page.viewport(414, 896) // restore the fleet default viewport for the next test
  })

  it.skipIf(server.browser !== 'chromium')('scene 2, scene 4, Next refused and the self-commit last scene, dark, two columns', async () => {
    await page.viewport(900, 1000)
    const wrap = mount('860px', FOUR, 2, 'dark')
    await settle(wrap)
    expect(surfaceMean(wrap), 'the stage did not resolve the DARK arm; this would be a light shot under a dark name').toBeLessThan(96)
    expectStates(wrap, 4)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('step-flow-dark')
    wrap.remove()
    await page.viewport(414, 896)
  })

  it.skipIf(server.browser !== 'chromium')('the four states in the 400px column', async () => {
    await page.viewport(414, 1600)
    const wrap = mount('400px', FOUR, 1, 'light')
    await settle(wrap)
    expectStates(wrap, 4)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('step-flow-400')
    wrap.remove()
    await page.viewport(414, 896)
  })
})
