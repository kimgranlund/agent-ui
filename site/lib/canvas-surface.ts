// site/lib/canvas-surface.ts — the SHARED A2UI artboard helper. The live-agent canvas (a2ui-live) proved the
// translate-centered, checkered stage with a DEFINITE artboard width (the collapse-to-1ch trap its comment
// records); this module lifts that proven CSS + its two light-DOM elements out so both consumers — a2ui-live's
// Canvas tab AND the component-preview element's right column — mount the identical artboard instead of a
// hand-copied divergent one. The CSS derived from a2ui-live's rules lives in the sibling `.css`.
import './canvas-surface.css'

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

// applyRootStretch — when the rendered surface roots at a `ui-column`, stretch it to FILL the artboard: a column
// shrink-wraps to its content, but as the ROOT of the canvas it should fill the artboard width (Kim's `stretch`
// attribute on ui-column, ADR-0075). Mirrors a2ui-live's `applyRootStretch`; call after every (re)render, since a
// rebuild can replace the root node.
export function applyRootStretch(surface: HTMLElement): void {
  const root = surface.firstElementChild
  if (root && root.tagName.toLowerCase() === 'ui-column') root.setAttribute('stretch', '')
}
