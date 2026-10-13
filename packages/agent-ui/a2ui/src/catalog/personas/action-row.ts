// action-row.ts: the persona composites' action row at the library's large control step (ADR-0243 Amendment 2,
// T-0083). A composite's action Buttons (CardTable's Hit, Stand and Double; QuestionCard's Check answer) are the
// producer's own children, appended by the renderer after `create()`, and neither the default nor the a2ui-basic
// `Button` row carries a size. So the composite watches its own subtree and stamps `size="lg"` (36px at the
// default scale, the button's own `[size]` ramp, never a custom height) on every `ui-button` that lands inside
// it, the late-child adoption shape of `ui-select`'s TKT-0026 observer. The only `ui-button`s a composite mints
// itself, CardTable's bet-row chips and Clear (ADR-0243 Amendment 3), are `lg` by design, so the stamp never
// changes their size.

function stamp(node: Node): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  if (el.localName === 'ui-button') el.setAttribute('size', 'lg')
  for (const button of el.querySelectorAll('ui-button')) button.setAttribute('size', 'lg')
}

/** Size every `ui-button` appended anywhere under `root` at `lg`, for the life of `root`. */
export function largeActionButtons(root: HTMLElement): void {
  new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(stamp)
  }).observe(root, { childList: true, subtree: true })
}
