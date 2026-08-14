import { describe, it, expect, afterEach } from 'vitest'

// canvas-surface.browser.test.ts — GH #892's cross-engine whole-shape leg for the SHARED artboard helper
// (`site/lib/canvas-surface.ts`), the exact mount both `component-preview.ts`'s gallery/preview canvas and
// `a2a-artifact-feed.ts`'s artifact stage compose. Measured directly at a CONTROLLED width — the docs
// pages' own responsive two-column grid squeezes `.canvas-surface` down to a few dozen px at this suite's
// default 414px mobile viewport (see the note in component-preview.browser.test.ts), which would make a
// width-fill assertion against the full `<component-preview>` element measure the page grid's incidental
// squeeze, not this ticket's fix. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import { createRenderer } from '@agent-ui/a2ui'
import { createCanvasSurface, applyRootStretch } from './canvas-surface.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const line = (obj: unknown): string => JSON.stringify(obj)

/** Mounts the real `{ stage, surface }` pair inside a definite-width wrapper — the shape both
 *  `component-preview.ts` (`.preview-canvas > .canvas-stage`) and `a2a-artifact-feed.ts` (`.feed-artifact-stage`)
 *  give it via their own page CSS; a plain fixed-width div stands in for that page chrome here. */
function mountArtboard(width = '700px'): { stage: HTMLElement; surface: HTMLElement; wrapper: HTMLDivElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = width
  wrapper.style.height = '400px'
  document.body.append(wrapper)
  mounted.push(wrapper)
  const { stage, surface } = createCanvasSurface()
  stage.style.blockSize = '100%'
  wrapper.append(stage)
  return { stage, surface, wrapper }
}

/** The surface's own CONTENT-box width (subtracting its own padding) — the box a stretched root actually
 *  has to fill. */
const contentWidth = (el: HTMLElement): number => {
  const cs = getComputedStyle(el)
  return el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
}

/** Renders `components` (with an implicit `createSurface` line first) into `surface`, then runs the SAME
 *  finalize→applyRootStretch sequence both real call sites (component-preview.ts, a2a-artifact-feed.ts) run. */
function renderInto(surface: HTMLElement, components: unknown[]): void {
  const host = createRenderer()
  host.mount(surface)
  host.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))
  host.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's1', components } }))
  host.finalize()
  applyRootStretch(surface)
}

describe('canvas-surface.ts — GH #892: applyRootStretch fills a Row/Card root, leaves an intrinsic root alone', () => {
  it('a Row root fills the surface content box (up to the 32rem/512px cap, well under a 700px wrapper)', () => {
    const { surface } = mountArtboard()
    renderInto(surface, [
      { id: 'root', component: 'Row', gap: 'md', children: ['b1', 'b2'] },
      { id: 'b1', component: 'Button', variant: 'soft', label: 'One' },
      { id: 'b2', component: 'Button', variant: 'soft', label: 'Two' },
    ])
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-row')
    expect(root.getBoundingClientRect().width, 'the Row root did not fill the artboard').toBeCloseTo(contentWidth(surface), 0)
  })

  it('a Card root fills the surface content box', () => {
    const { surface } = mountArtboard()
    renderInto(surface, [
      { id: 'root', component: 'Card', children: ['s_content'] },
      { id: 's_content', component: 'CardContent', children: ['s_text'] },
      { id: 's_text', component: 'Text', variant: 'body', text: 'A rendered card.' },
    ])
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-card')
    expect(root.getBoundingClientRect().width, 'the Card root did not fill the artboard').toBeCloseTo(contentWidth(surface), 0)
  })

  it('a List root fills the surface content box', () => {
    const { surface } = mountArtboard()
    renderInto(surface, [
      { id: 'root', component: 'List', children: ['t1', 't2'] },
      { id: 't1', component: 'Text', variant: 'body', text: 'Row one' },
      { id: 't2', component: 'Text', variant: 'body', text: 'Row two' },
    ])
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-list')
    expect(root.getBoundingClientRect().width, 'the List root did not fill the artboard').toBeCloseTo(contentWidth(surface), 0)
  })

  it('negative control: a lone Button root (an intrinsic control) keeps its own natural width, NOT force-stretched', () => {
    const { surface } = mountArtboard()
    renderInto(surface, [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go' }])
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-button')
    expect(root.getBoundingClientRect().width, 'a lone Button root was force-stretched to fill the artboard').toBeLessThan(
      contentWidth(surface) * 0.5,
    )
  })

  it('the artboard aesthetic (deliberate, GH #892 Findings): a Row root fills up to the 32rem cap, never the full wrapper width', () => {
    const { surface } = mountArtboard('1200px') // far wider than the 32rem/512px cap
    renderInto(surface, [
      { id: 'root', component: 'Row', gap: 'md', children: ['b1'] },
      { id: 'b1', component: 'Button', variant: 'soft', label: 'One' },
    ])
    const root = surface.firstElementChild as HTMLElement
    expect(root.getBoundingClientRect().width, 'the artboard cap was blown through — the row filled the whole 1200px wrapper').toBeLessThan(
      520,
    )
    expect(root.getBoundingClientRect().width).toBeCloseTo(contentWidth(surface), 0)
  })
})
