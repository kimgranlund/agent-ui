// traits — stateless `(host, opts) => cleanup` behaviours and stateful controllers, invoked directly from a
// control's `connected()` (e.g. `tabbable(this, …)`); there is no `host.use()`.
export { tabbable } from './tabbable.ts'
export type { TabbableOptions } from './tabbable.ts'
export { trackUserInvalid } from './track-user-invalid.ts'
export type { TrackUserInvalidOptions, TrackUserInvalidController } from './track-user-invalid.ts'
// The form registry controller (G7 — ADR-0050/ADR-0051, LLD-C3): the ui-form-provider discovery/aggregation
// controller, invoked from a provider's `connected()` — the same trackUserInvalid controller pattern above.
export { formRegistry } from './form-registry.ts'
export type { FormRegistryController, FormMember } from './form-registry.ts'
export { rovingFocus } from './roving-focus.ts'
export type { RovingFocusOptions, RovingOrientation } from './roving-focus.ts'
export { overlay } from './overlay.ts'
export type { OverlayOptions, OverlayHandle, OverlayPlacement } from './overlay.ts'
export { selectionCommit } from './selection-commit.ts'
export type { SelectionCommitOptions, SelectionMode } from './selection-commit.ts'
export { valueDrag } from './value-drag.ts'
export type { ValueDragOptions } from './value-drag.ts'
// ui-split's N-separator drag gesture (app-surfaces-m4.lld.md LLD-C2) — a NEW sibling to `value-drag`,
// deliberately not a generalization of it (axis+RTL+multi-separator+delta vs value-drag's 1-D/LTR/absolute
// value contract; widening value-drag risks the shipped ui-slider/ui-slider-multi).
export { paneResize } from './pane-resize.ts'
export type { PaneResizeOptions, PaneResizeHandle } from './pane-resize.ts'
export { valueCodec, numberCodecOptions, currencyCodecOptions } from './value-codec.ts'
export type { ValueCodecOptions, ValueCodecController } from './value-codec.ts'
export { scrollFade } from './scroll-fade.ts'
export type { ScrollFadeOptions } from './scroll-fade.ts'
export { pressActivation } from './press-activation.ts'
export type { PressActivationOptions } from './press-activation.ts'
export { areaDrag } from './area-drag.ts'
export type { AreaDragOptions } from './area-drag.ts'
