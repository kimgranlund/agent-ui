// site/lib/canvas-surface.ts — the SHARED A2UI artboard helper. The live-agent canvas (a2ui-live) proved the
// translate-centered, checkered stage with a DEFINITE artboard width (the collapse-to-1ch trap its comment
// records); this module lifts that proven CSS + its two light-DOM elements out so both consumers — a2ui-live's
// Canvas tab AND the component-preview element's right column — mount the identical artboard instead of a
// hand-copied divergent one. The CSS derived from a2ui-live's rules lives in the sibling `.css`.
import './canvas-surface.css'
import { UIContainerElement } from '@agent-ui/components'

/** The artboard pair: the checkered `stage` box and the translate-centered `surface` that renderer roots mount under. */
export interface CanvasSurface {
  /** The checkered artboard box (position:relative). Give it a definite block-size in the consuming layout. */
  readonly stage: HTMLElement
  /** The centered mount point — pass THIS to `host.mount(surface)`; the rendered root attaches as its child. */
  readonly surface: HTMLElement
}

/** createCanvasSurface — build the `{ stage, surface }` light-DOM pair (the surface nested in the stage). */
export function createCanvasSurface(): CanvasSurface {
  const stage = document.createElement('div')
  stage.className = 'canvas-stage'
  const surface = document.createElement('div')
  surface.className = 'canvas-surface'
  stage.append(surface)
  return { stage, surface }
}

// applyRootStretch — the rendered surface's ROOT should fill the artboard's available width (up to its
// definite cap, min(32rem, …) above — the checkered artboard's own deliberate aesthetic, GH #892 Findings):
// a layout primitive otherwise shrink-wraps to its content. `ui-column` owns a dedicated `stretch` PROP
// (Kim's ADR-0016/ADR-0030 reflected opt-in) so it gets the semantic attribute. The sibling primitives
// (ui-row/ui-card/ui-list/ui-grid, …) carry no equivalent prop — `UIContainerElement` is the "layout
// primitive, not an intrinsic control" discriminator the fleet already draws (row/column/card/list/grid all
// extend it; button/badge/pill/etc. extend `UIElement` directly), so an imperative `align-self: stretch` is
// the width-fill for those without minting a `stretch` prop on each (GH #892). A root that IS an intrinsic
// control (e.g. a lone Button) is untouched by either branch and keeps its own natural width — the named
// exception. Mirrored in `@agent-ui/app`'s `surface-host.ts` (packages can't import site code); call after
// every (re)render, since a rebuild can replace the root node.
export function applyRootStretch(surface: HTMLElement): void {
  const root = surface.firstElementChild
  if (root && root.tagName.toLowerCase() === 'ui-column') root.setAttribute('stretch', '')
  else if (root instanceof UIContainerElement) root.style.alignSelf = 'stretch'
}
