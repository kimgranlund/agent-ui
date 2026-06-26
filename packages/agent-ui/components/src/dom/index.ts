// dom — UIElement (the FACE element host) + the typed-prop authoring API. Imports only ../reactive
// (and same-layer ./element.ts / ./props.ts).
//
// The PUBLIC dom surface (rubric D7): the element host and the typed-prop schema API a control author
// uses. The wiring seams that connect them — `finalize`, `coerceAttribute`, `observedAttributesFor`,
// `propForAttribute` — and the codec factories behind `prop.*` (`enumType`/`jsonType`) stay module-private
// to props.ts/element.ts: internal cross-module plumbing, NOT consumer surface, so they are deliberately
// not re-exported here.
export { UIElement } from './element.ts'
export { prop, Types } from './props.ts'
export type { PropType, PropConfig, PropsSchema, ReactiveProps } from './props.ts'
