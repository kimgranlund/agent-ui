// traits — stateless `(host, opts) => cleanup` behaviours and stateful controllers, invoked directly from a
// control's `connected()` (e.g. `tabbable(this, …)`); there is no `host.use()`.
export { tabbable } from './tabbable.ts'
export type { TabbableOptions } from './tabbable.ts'
export { trackUserInvalid } from './track-user-invalid.ts'
export type { TrackUserInvalidOptions, TrackUserInvalidController } from './track-user-invalid.ts'
// Wave 0 PREP stubs — interfaces pinned; implementations are the listbox-roving / overlay-controller /
// range-element LLD build slices.
export { rovingFocus } from './roving-focus.ts'
export type { RovingFocusOptions, RovingOrientation } from './roving-focus.ts'
export { overlay } from './overlay.ts'
export type { OverlayOptions, OverlayHandle, OverlayPlacement } from './overlay.ts'
export { selectionCommit } from './selection-commit.ts'
export type { SelectionCommitOptions, SelectionMode } from './selection-commit.ts'
export { valueDrag } from './value-drag.ts'
export type { ValueDragOptions } from './value-drag.ts'
