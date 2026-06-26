import { describe, it, expect } from 'vitest'
import * as dom from './index.ts'
import { UIElement, prop, Types, type PropType, type PropConfig, type PropsSchema, type ReactiveProps } from './index.ts'
import { UIElement as PkgUIElement, prop as pkgProp } from '@agent-ui/components'

// d-barrel (rubric element.md D7 — a-surface). The dom barrel exports EXACTLY the intended consumer
// surface: the element host (UIElement) + the typed-prop authoring API (prop, Types, and the types
// PropType/PropConfig/PropsSchema/ReactiveProps). The wiring seams (finalize, coerceAttribute,
// observedAttributesFor, propForAttribute) and the codec factories (enumType/jsonType) are internal — NOT
// re-exported. The package barrel (@agent-ui/components) re-exports the dom surface so consumers reach it.

describe('d-barrel — the dom public surface (D7)', () => {
  it('a-surface: the runtime (value) exports are EXACTLY UIElement, prop, Types', () => {
    expect(Object.keys(dom).sort()).toEqual(['Types', 'UIElement', 'prop'])
  })

  it('a-surface: the internal wiring seams + codec factories are NOT re-exported', () => {
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

  it('a-surface: the value exports are the intended shapes; the type exports are usable (tsc-checked)', () => {
    expect(typeof UIElement).toBe('function') // the FACE element host class
    expect(typeof prop.enum).toBe('function') // the typed prop constructors
    expect(Types.string.from('x')).toBe('x') // the fixed codecs

    // The type exports are proven present by being importable + used as annotations: erased at runtime,
    // so if any were not exported the import at the top of this file would fail `npm run check`.
    const codec: PropType<string> = Types.string
    const cfg: PropConfig<string> = prop.string('hi')
    const schema = { v: prop.enum(['a', 'b'] as const, 'a') } satisfies PropsSchema // plan §5's authoring constraint
    const reactive: ReactiveProps<typeof schema> = { v: 'a' }
    expect(codec.from('y')).toBe('y')
    expect(cfg.default).toBe('hi')
    expect(schema.v.default).toBe('a')
    expect(reactive.v).toBe('a')
  })

  it('a-surface: the package barrel (@agent-ui/components) re-exports the dom surface', () => {
    expect(PkgUIElement).toBe(UIElement) // same class, reachable from the package root
    expect(pkgProp).toBe(prop)
  })
})
