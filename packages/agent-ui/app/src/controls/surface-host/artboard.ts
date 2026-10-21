// artboard.ts — the SHARED A2UI artboard behavior (ADR-0129 Amendment 2): the ONE canonical
// `applyRootStretch` implementation, extracted from `surface-host.ts`'s private `#applyRootStretch`
// (itself the promoted-verbatim descendant of `site/lib/canvas-surface.ts`'s original embryo). Both
// `ui-surface-host` and `site/lib/canvas-surface.ts` now delegate here rather than carrying their own
// copy — `canvas-surface.ts`'s own export becomes a re-export of this function (an anti-refork guard
// asserts reference identity), and `ui-surface-host`'s private method calls this for the shared stretch
// behavior, keeping only its own GH #1163 root-card mirroring locally (a `[bare]`-mode concern site
// artboards do not have).
import { UIContainerElement } from '@agent-ui/components'

/** The widget roots that fill the canvas like a container root (ADR-0046 Amendment 7, the canvas gutter rule):
 *  each is a full-width surface by role, but extends `UIElement`, not `UIContainerElement`, so the container
 *  branch below never reached it and a GameHud root hugged its content beside filling siblings. The ADR-0243
 *  three, plus ui-option-deck (T-0387): it is its own inline-size query container, so it has no intrinsic width
 *  and an unstretched deck root collapsed to 0px under the surface's `align-items: center`. Named by tag, not
 *  by a broader discriminator, so no other intrinsic root changes width. */
const WIDGET_ROOTS: ReadonlySet<string> = new Set(['ui-product-card', 'ui-board-grid', 'ui-game-hud', 'ui-option-deck'])

/** applyRootStretch — the rendered surface's ROOT should fill the artboard's available width (up to its
 *  definite cap, min(32rem, …) in artboard.css — the checkered artboard's own deliberate aesthetic, GH
 *  #892 Findings): a layout primitive otherwise shrink-wraps to its content. `ui-column` owns a dedicated
 *  `stretch` PROP (Kim's ADR-0016/ADR-0030 reflected opt-in) so it gets the semantic attribute. The
 *  sibling primitives (ui-row/ui-card/ui-list/ui-grid, …) carry no equivalent prop — `UIContainerElement`
 *  is the "layout primitive, not an intrinsic control" discriminator the fleet already draws
 *  (row/column/card/list/grid all extend it; button/badge/pill/etc. extend `UIElement` directly), so an
 *  imperative `align-self: stretch` is the width-fill for those without minting a `stretch` prop on each.
 *  The `WIDGET_ROOTS` widgets take the same stretch unless they carry `inline` (ADR-0223 R2, the one hug
 *  opt-out). Any other root that IS an intrinsic control (e.g. a lone Button) is untouched by every branch
 *  and keeps its own natural width, the named exception. Call after every (re)render, since a rebuild can
 *  replace the root node. */
export function applyRootStretch(surface: HTMLElement): void {
  const root = surface.firstElementChild
  if (!(root instanceof HTMLElement)) return
  const tag = root.tagName.toLowerCase()
  if (tag === 'ui-column') {
    if (!root.hasAttribute('stretch')) root.setAttribute('stretch', '')
  } else if (root instanceof UIContainerElement || (WIDGET_ROOTS.has(tag) && !root.hasAttribute('inline'))) {
    if (root.style.alignSelf !== 'stretch') root.style.alignSelf = 'stretch'
  }
}
