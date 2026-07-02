import { describe, it, expect } from 'vitest'
import * as dom from './index.ts'
import {
  UIElement,
  UIFormElement,
  UIContainerElement,
  prop,
  Types,
  repeat,
  watch,
  Directive,
  directive,
  NO_COMMIT,
  mount,
  FORM_CONNECT_EVENT,
  FORM_RESET_EVENT,
  type PropType,
  type PropConfig,
  type PropsSchema,
  type ReactiveProps,
  type FormValue,
  type ValidityResult,
  type FormConnectDetail,
  type FieldLabelling,
  type RenderContext,
  type DirectiveResult,
} from './index.ts'
import {
  UIElement as PkgUIElement,
  prop as pkgProp,
  UIFormElement as PkgUIFormElement,
  UIContainerElement as PkgUIContainerElement,
  mount as pkgMount,
} from '@agent-ui/components'

// d-barrel (rubric element.md D7 — a-surface). The dom barrel exports EXACTLY the intended consumer surface:
// the element hosts (UIElement + the FACE form base UIFormElement + the FACE container surface base
// UIContainerElement), the typed-prop authoring API (prop, Types, and the types
// PropType/PropConfig/PropsSchema/ReactiveProps), the form value/verdict types
// (FormValue/ValidityResult), the two G3 child directives (repeat, watch), AND — since ADR-0023 — the
// directive-AUTHORING trio (Directive, directive, NO_COMMIT) + the imperative mount() host (with the
// RenderContext / DirectiveResult types). G7 (ADR-0050/0051) adds the `ui-`-prefixed protocol surface:
// FORM_CONNECT_EVENT/FORM_RESET_EVENT (the event names) + the FormConnectDetail/FieldLabelling types — a
// registry controller (traits/form-registry.ts) and a consuming control (controls/field/) need these
// reachable off the barrel without importing `./form.ts` directly. The props/element wiring seams
// (finalize, coerceAttribute, observedAttributesFor, propForAttribute) and the codec factories
// (enumType/jsonType) are internal — NOT re-exported; the template ENTRY (html/render/svg/TemplateResult,
// the ChildPart engine, prepare) stays internal too — a directive is the only PUBLIC render unit. The
// package barrel (@agent-ui/components) re-exports the dom surface so consumers reach it.

// A registered throwaway subclass — `UIFormElement` cannot be `new`'d directly (jsdom's custom-element
// registry check fires on the base class constructor same as any unregistered subclass would).
class ProbeFormEl extends UIFormElement {}
customElements.define('ui-form-surface-probe', ProbeFormEl)

describe('d-barrel — the dom public surface (D7)', () => {
  it('a-surface: the runtime (value) exports are EXACTLY the hosts + prop API + directives + the authoring trio + mount + the ADR-0050 protocol events', () => {
    expect(Object.keys(dom).sort()).toEqual([
      'Directive',
      'FORM_CONNECT_EVENT',
      'FORM_RESET_EVENT',
      'NO_COMMIT',
      'Types',
      'UIContainerElement',
      'UIElement',
      'UIFormElement',
      'directive',
      'mount',
      'prop',
      'repeat',
      'watch',
    ])
  })

  it('a-surface: the internal props/element wiring seams + codec factories are NOT re-exported', () => {
    for (const internal of [
      'finalize',
      'coerceAttribute',
      'observedAttributesFor',
      'propForAttribute',
      'enumType',
      'jsonType',
    ]) {
      expect(internal in dom).toBe(false)
    }
  })

  it('a-surface: the template ENTRY stays internal (a directive is the only public render unit)', () => {
    // Real template.ts exports the dom barrel deliberately does NOT re-surface: the template entry + its engine
    // (`render`/`html`/`svg`/`TemplateResult`/`ChildPart`/`prepare`). ADR-0023 widened the surface to the
    // directive HOST + AUTHORING, NOT the template entry — `html`/`render` remain private.
    for (const internal of ['render', 'html', 'svg', 'TemplateResult', 'ChildPart', 'prepare']) {
      expect(internal in dom).toBe(false)
    }
  })

  it('a-surface: the directive-authoring trio + the mount host ARE public (ADR-0023)', () => {
    // Authoring moved from internal plumbing to public API: an imperative consumer can now invoke a kernel
    // directive (`mount`) and write its own (`Directive`/`directive`/`NO_COMMIT`). `RenderContext`/
    // `DirectiveResult` are type-only (runtime-erased), so they are proven by the typed annotations below.
    for (const pub of ['Directive', 'directive', 'NO_COMMIT', 'mount']) {
      expect(pub in dom).toBe(true)
    }
  })

  it('a-surface: the value exports are the intended shapes; the type exports are usable (tsc-checked)', () => {
    expect(typeof UIElement).toBe('function') // the FACE element host class
    expect(typeof UIFormElement).toBe('function') // the FACE form-associated base class
    expect(UIFormElement.formAssociated).toBe(true) // the form-participation activation flag (clause 1)
    expect(typeof UIContainerElement).toBe('function') // the FACE container surface base (G9)
    expect('formAssociated' in UIContainerElement).toBe(false) // a container contributes nothing to a form (ADR-0015)
    // The spreadable surface + flex schemas ride the class statics (the formProps precedent) — the surface IS
    // the class, so there is no standalone schema value on the barrel; a subclass spreads these into `static props`.
    expect(Object.keys(UIContainerElement.surfaceProps).sort()).toEqual(['brightness', 'elevation'])
    expect(Object.keys(UIContainerElement.flexProps).sort()).toEqual(['align', 'gap', 'justify', 'wrap'])
    expect(typeof prop.enum).toBe('function') // the typed prop constructors
    expect(Types.string.from('x')).toBe('x') // the fixed codecs
    expect(typeof repeat).toBe('function') // the G3 keyed-list directive
    expect(typeof watch).toBe('function') // the G3 per-hole reactive directive
    expect(typeof Directive).toBe('function') // the directive base class (authoring, ADR-0023)
    expect(typeof directive).toBe('function') // the directive-factory wrapper
    expect(typeof NO_COMMIT).toBe('symbol') // the DOM-owning directive's sentinel
    expect(typeof mount).toBe('function') // the imperative directive host
    expect(FORM_CONNECT_EVENT).toBe('ui-form-connect') // the ADR-0050 protocol event names
    expect(FORM_RESET_EVENT).toBe('ui-form-reset')

    // The type exports are proven present by being importable + used as annotations: erased at runtime,
    // so if any were not exported the import at the top of this file would fail `npm run check`.
    const codec: PropType<string> = Types.string
    const cfg: PropConfig<string> = prop.string('hi')
    const schema = { v: prop.enum(['a', 'b'] as const, 'a') } satisfies PropsSchema // plan §5's authoring constraint
    const reactive: ReactiveProps<typeof schema> = { v: 'a' }
    const value: FormValue = 'submitted' // File | string | FormData | null — the setFormValue value type
    const verdict: ValidityResult = { valid: true } // the discriminated validity verdict the base maps to setValidity
    const labelling: FieldLabelling = { label: null, description: null, error: null } // the ADR-0051 handoff shape
    const detail: FormConnectDetail = {
      control: new ProbeFormEl(),
      signal: new AbortController().signal,
      value: () => null,
      validity: () => ({ valid: true }),
      userInvalid: () => false,
    } // the ADR-0050 connect-event detail shape
    // RenderContext + DirectiveResult (ADR-0023) typed: mount's signature is (DirectiveResult, Node, ctx?) → cleanup.
    const result: DirectiveResult = repeat([], (k) => k, (k) => k) // repeat() returns a branded DirectiveResult
    const mountFn: (r: DirectiveResult, c: Node, ctx?: RenderContext) => () => void = mount
    expect(codec.from('y')).toBe('y')
    expect(cfg.default).toBe('hi')
    expect(schema.v.default).toBe('a')
    expect(reactive.v).toBe('a')
    expect(value).toBe('submitted')
    expect(verdict.valid).toBe(true)
    expect(typeof result).toBe('object') // the inert branded result mount commits
    expect(mountFn).toBe(mount)
    expect(labelling.label).toBe(null)
    expect(detail.control).toBeInstanceOf(UIFormElement) // ProbeFormEl IS-A UIFormElement
  })

  it('a-surface: the package barrel (@agent-ui/components) re-exports the dom surface', () => {
    expect(PkgUIElement).toBe(UIElement) // same class, reachable from the package root
    expect(PkgUIFormElement).toBe(UIFormElement)
    expect(PkgUIContainerElement).toBe(UIContainerElement) // the container surface base flows through the package barrel too
    expect(pkgProp).toBe(prop)
    expect(pkgMount).toBe(mount) // the ADR-0023 mount host reaches the package root too (a2ui imports it from there)
  })
})
