// dom — the element hosts (UIElement, the FACE form base UIFormElement, and the FACE container surface base
// UIContainerElement) + the typed-prop authoring API + the G3 child directives (repeat/watch). Imports only
// ../reactive (and same-layer ./element.ts / ./props.ts / ./form.ts / ./container.ts / ./repeat.ts / ./watch.ts).
//
// The PUBLIC dom surface (rubric D7): the element hosts and the typed-prop schema API a control author uses,
// the two child directives a template author drives, PLUS the directive-AUTHORING trio + the imperative
// `mount` host (ADR-0023). The wiring seams that connect them stay module-private and are deliberately NOT
// re-exported here:
//   • props.ts/element.ts plumbing — `finalize`, `coerceAttribute`, `observedAttributesFor`, `propForAttribute`,
//     and the codec factories behind `prop.*` (`enumType`/`jsonType`).
//   • the template ENTRY — `render` / `html` / `svg` / `TemplateResult` / `ChildPart` / `prepare`. The template
//     machinery is internal cross-module plumbing; a directive is the only PUBLIC render unit.
// PUBLIC since ADR-0023: directive-AUTHORING (`Directive` / `directive` / `NO_COMMIT`, plus the `RenderContext`
// and `DirectiveResult` types) and the imperative `mount(result, container, ctx?)` host that commits a kernel
// directive (e.g. `repeat`) into a container WITHOUT the private `html\`\`` entry — what an imperative consumer
// (the a2ui renderer) needs to invoke AND author directives. `repeat` / `watch` remain the shipped directives.
export { UIElement } from './element.ts'
export { UIFormElement } from './form.ts'
export type { FormValue, ValidityResult } from './form.ts'
// The FACE container surface base (G9, ADR-0015/0016) — NOT form-associated. The shared spreadable surface +
// flex prop schemas ride its statics (`UIContainerElement.surfaceProps` / `.flexProps`), the ADR-0013 formProps
// precedent: a subclass folds them into its OWN `static props`, so there is no standalone schema value to
// re-export — the class IS the surface (matching how `UIFormElement` carries `formProps`).
export { UIContainerElement } from './container.ts'
export { prop, Types } from './props.ts'
export type { PropType, PropConfig, PropsSchema, ReactiveProps } from './props.ts'
export { repeat } from './repeat.ts'
export { watch } from './watch.ts'
// The directive-authoring trio + the imperative mount host (ADR-0023). `render`/`html`/`ChildPart` stay private.
export { Directive, directive, NO_COMMIT, mount } from './template.ts'
export type { RenderContext, DirectiveResult } from './template.ts'
