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
  type PropType,
  type PropConfig,
  type PropsSchema,
  type ReactiveProps,
  type FormValue,
  type ValidityResult,
} from './index.ts'
import {
  UIElement as PkgUIElement,
  prop as pkgProp,
  UIFormElement as PkgUIFormElement,
  UIContainerElement as PkgUIContainerElement,
} from '@agent-ui/components'

// d-barrel (rubric element.md D7 — a-surface). The dom barrel exports EXACTLY the intended consumer surface:
// the element hosts (UIElement + the FACE form base UIFormElement + the FACE container surface base
// UIContainerElement), the typed-prop authoring API (prop, Types, and the types
// PropType/PropConfig/PropsSchema/ReactiveProps), the form value/verdict types
// (FormValue/ValidityResult), and the two G3 child directives (repeat, watch). The props/element wiring seams
// (finalize, coerceAttribute, observedAttributesFor, propForAttribute) and the codec factories
// (enumType/jsonType) are internal — NOT re-exported; the template.ts DIRECTIVE SEAM (Directive, directive,
// NO_COMMIT, RenderContext, the ChildPart engine, html/render/svg/TemplateResult) is internal too — only
// repeat/watch surface. The package barrel (@agent-ui/components) re-exports the dom surface so consumers reach it.

describe('d-barrel — the dom public surface (D7)', () => {
  it('a-surface: the runtime (value) exports are EXACTLY the hosts + prop API + the two directives', () => {
    expect(Object.keys(dom).sort()).toEqual([
      'Types',
      'UIContainerElement',
      'UIElement',
      'UIFormElement',
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

  it('a-surface: the template DIRECTIVE SEAM stays internal — only repeat/watch are public directives', () => {
    // These are the template.ts machinery `repeat`/`watch` ride; several are real template.ts exports, but the
    // dom barrel deliberately does NOT re-surface them (the seam is plumbing, not consumer surface).
    for (const seam of [
      'Directive',
      'directive',
      'NO_COMMIT',
      'RenderContext',
      'ChildPart',
      'TemplateResult',
      'html',
      'svg',
      'render',
    ]) {
      expect(seam in dom).toBe(false)
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

    // The type exports are proven present by being importable + used as annotations: erased at runtime,
    // so if any were not exported the import at the top of this file would fail `npm run check`.
    const codec: PropType<string> = Types.string
    const cfg: PropConfig<string> = prop.string('hi')
    const schema = { v: prop.enum(['a', 'b'] as const, 'a') } satisfies PropsSchema // plan §5's authoring constraint
    const reactive: ReactiveProps<typeof schema> = { v: 'a' }
    const value: FormValue = 'submitted' // File | string | FormData | null — the setFormValue value type
    const verdict: ValidityResult = { valid: true } // the discriminated validity verdict the base maps to setValidity
    expect(codec.from('y')).toBe('y')
    expect(cfg.default).toBe('hi')
    expect(schema.v.default).toBe('a')
    expect(reactive.v).toBe('a')
    expect(value).toBe('submitted')
    expect(verdict.valid).toBe(true)
  })

  it('a-surface: the package barrel (@agent-ui/components) re-exports the dom surface', () => {
    expect(PkgUIElement).toBe(UIElement) // same class, reachable from the package root
    expect(PkgUIFormElement).toBe(UIFormElement)
    expect(PkgUIContainerElement).toBe(UIContainerElement) // the container surface base flows through the package barrel too
    expect(pkgProp).toBe(prop)
  })
})
