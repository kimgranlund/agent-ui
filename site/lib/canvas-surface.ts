// site/lib/canvas-surface.ts — the SHARED A2UI artboard helper. The live-agent canvas (a2ui-live) proved the
// translate-centered, checkered stage with a DEFINITE artboard width (the collapse-to-1ch trap its comment
// records); this module lifts that proven CSS + its two light-DOM elements out so both consumers — a2ui-live's
// Canvas tab AND the component-preview element's right column — mount the identical artboard instead of a
// hand-copied divergent one.
//
// ADR-0129 Amendment 2: the visual core (the CSS this module used to own directly, plus `applyRootStretch`)
// is now `@agent-ui/app`'s shared `./artboard`/`./artboard.css` — this module is a thin wrapper: the
// `{ stage, surface }` DOM-pair builder (tagging both parts with the shared `.ui-artboard-*` classes
// alongside its own `.canvas-stage`/`.canvas-surface` classes, which other consumers still select on) plus
// a re-export of the canonical `applyRootStretch`, no longer a second copy of it.
import '@agent-ui/app/artboard.css'
export { applyRootStretch } from '@agent-ui/app/artboard'

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
  stage.className = 'canvas-stage ui-artboard-stage'
  const surface = document.createElement('div')
  surface.className = 'canvas-surface ui-artboard-surface'
  stage.append(surface)
  return { stage, surface }
}
