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
export { valueCodec, numberCodecOptions, currencyCodecOptions } from './value-codec.ts'
export type { ValueCodecOptions, ValueCodecController } from './value-codec.ts'
export { scrollFade } from './scroll-fade.ts'
export type { ScrollFadeOptions } from './scroll-fade.ts'
