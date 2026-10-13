// action-row.ts: the persona composites' action row at the library's large control step (ADR-0243 Amendment 2,
// T-0083). A composite's action Buttons (CardTable's Hit, Stand and Double; QuestionCard's Check answer) are the
// producer's own children, appended by the renderer after `create()`, and neither the default nor the a2ui-basic
// `Button` row carries a size. So the composite watches its own subtree and stamps `size="lg"` (32px on the A2UI
// canvas register, `data-tier="widget" data-scale="md"`: sm / md / lg = 24 / 28 / 32, ADR-0245 Amendment 2; the
// button's own `[size]` ramp, never a custom height) on every `ui-button` that lands inside it, the late-child
// adoption shape of `ui-select`'s TKT-0026 observer. The only `ui-button`s a composite mints itself, CardTable's
// bet-row chips and Clear (ADR-0243 Amendment 3), are `lg` by design, so the stamp never changes their size.
// `BookingForm` (T-0106) is the one composite that steps down: its action Button is `md` (28px), and the
// date-picker buttons it mints itself are skipped so they keep their own `sm`.

type ActionSize = 'md' | 'lg'

function stamp(node: Node, size: ActionSize, skip: string | undefined): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  if (el.localName === 'ui-button' && !(skip !== undefined && el.matches(skip))) el.setAttribute('size', size)
  for (const button of el.querySelectorAll(skip === undefined ? 'ui-button' : `ui-button:not(${skip})`)) button.setAttribute('size', size)
}

/** Size every `ui-button` appended anywhere under `root` at `size`, except those matching `skip`, for the life of `root`. */
export function sizedActionButtons(root: HTMLElement, size: ActionSize, skip?: string): void {
  new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach((node) => stamp(node, size, skip))
  }).observe(root, { childList: true, subtree: true })
}

/** Size every `ui-button` appended anywhere under `root` at `lg`, for the life of `root`. */
export function actionRowButtons(root: HTMLElement): void {
  sizedActionButtons(root, 'lg')
}
