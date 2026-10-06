// controls/_base/ — the shared control-base sub-layer (analogous to _surface/ for layout primitives).
// Exports the abstract bases leaf controls extend; NOT a generated `./controls/{name}` entry and absent from
// `registry.gen.ts` (ADR-0233); only the leaf controls that extend these classes are the public surface.
//
// Import these in leaf control files:
//   import { UIIndicatorElement } from '../_base/index.ts'  // (from controls/{name}/)
export { UIIndicatorElement } from './indicator-element.ts'
export { UIRangeElement } from './range-element.ts'
export { UIListboxElement } from './listbox-element.ts'
