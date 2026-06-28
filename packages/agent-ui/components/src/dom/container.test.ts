import { describe, it, expect } from 'vitest'
import { signal, inspect, type Signal } from '@agent-ui/components'
import { type PropsSchema, type ReactiveProps } from './props.ts'
import { UIElement } from './element.ts'
import { UIFormElement } from './form.ts'
import { UIContainerElement } from './container.ts'

// s2 — UIContainerElement, the FACE container surface base (ADR-0015 / ADR-0016; decomp g9-containers s2).
// The probes cover the slice's fixed contract: the base is a plain `UIElement` and NOT form-associated (no
// `formAssociated`, no value/validity surface) · the two SPREADABLE prop sets (`surfaceProps`/`flexProps`)
// fold into a subclass's own `static props` (the ADR-0013 no-prototype-merge pattern) and finalize into
// reflecting, signal-backed accessors · the surface/flex props are TYPED literal unions (a `@ts-expect-error`
// proves a bare number / arbitrary string is rejected) · connect→disconnect leaves zero residue. The CSS
// surface seam (the `--ui-container-bg`/`-tint` repoints) is verified by the browser gate, not here.

// ── a throwaway subclass that spreads BOTH sets into its own static props ──────
// (the canonical consumer shape — `static props = { ...surfaceProps, ...flexProps }`; a real element adds its
// own props alongside. `ReactiveProps<typeof probeProps>` declare-merges the six typed accessors.)
const probeProps = { ...UIContainerElement.surfaceProps, ...UIContainerElement.flexProps } satisfies PropsSchema
interface ProbeContainer extends ReactiveProps<typeof probeProps> {}
class ProbeContainer extends UIContainerElement {
  static props = probeProps
  // An inspectable signal a scope-owned effect reads — its subscriber count is exactly the effect's presence,
  // so zero-residue is a real assertion (the connection scope owns + disposes it; inherited from UIElement).
  readonly probe: Signal<number> = signal(0)
  protected connected(): void {
    this.effect(() => {
      void this.probe.value
    })
  }
}
customElements.define('ui-probe-container', ProbeContainer)

// ── extends UIElement, NOT form-associated ────────────────────────────────────

describe('UIContainerElement — extends UIElement, not form-associated', () => {
  it('is a UIElement subclass but NOT a UIFormElement (the non-form family)', () => {
    const el = new ProbeContainer()
    expect(el).toBeInstanceOf(UIElement)
    expect(el).toBeInstanceOf(UIContainerElement)
    expect(el).not.toBeInstanceOf(UIFormElement)
  })

  it('declares no form-association surface — no static formAssociated, no value/validity members', () => {
    // UIFormElement sets `static formAssociated = true`; the container base must NOT (a container contributes
    // nothing to a form), so the platform never runs the form lifecycle on it.
    expect('formAssociated' in UIContainerElement).toBe(false)
    expect(UIFormElement.formAssociated).toBe(true) // contrast — the form base does opt in
    // none of the UIFormElement IDL surface leaks onto a container instance
    const el = new ProbeContainer()
    expect('form' in el).toBe(false)
    expect('validity' in el).toBe(false)
    expect('willValidate' in el).toBe(false)
  })

  it('reuses the inherited single ElementInternals handle — a second attachInternals() throws', () => {
    const el = new ProbeContainer()
    expect(() => el.attachInternals()).toThrow() // the base never re-acquires (used for ARIA on tabs/modal)
  })
})

// ── the spreadable surfaceProps / flexProps fold into static props ────────────

describe('UIContainerElement — spreadable surfaceProps / flexProps', () => {
  it('surfaceProps owns exactly elevation/brightness, flexProps owns align/justify/gap/wrap', () => {
    expect(Object.keys(UIContainerElement.surfaceProps)).toEqual(['elevation', 'brightness'])
    expect(Object.keys(UIContainerElement.flexProps)).toEqual(['align', 'justify', 'gap', 'wrap'])
  })

  it('a subclass folds BOTH sets into its own finalize table (the spread is real, not inheritance)', () => {
    // props.ts has no static-props prototype merge, so the base itself exposes no `static props`; the subclass
    // must spread them in. The order is surfaceProps then flexProps.
    expect('props' in UIContainerElement).toBe(false)
    expect(Object.keys(ProbeContainer.props)).toEqual(['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap'])
  })

  it('all six props reflect (so the [elevation]/[align]/… attribute selectors apply to JS-set values)', () => {
    for (const cfg of Object.values(UIContainerElement.surfaceProps)) expect(cfg.reflect).toBe(true)
    for (const cfg of Object.values(UIContainerElement.flexProps)) expect(cfg.reflect).toBe(true)
  })

  it('the declared defaults are the neutral base / flex defaults, and defaults do NOT reflect', () => {
    const el = new ProbeContainer()
    expect([el.elevation, el.brightness]).toEqual(['0', '0']) // neutral surface (ADR-0015 cl.1)
    expect([el.align, el.justify, el.gap, el.wrap]).toEqual(['start', 'start', 'none', false])
    // a fresh container carries no surface/flex attributes — an unset container is unchanged
    for (const a of ['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap']) {
      expect(el.hasAttribute(a)).toBe(false)
    }
  })
})

// ── reflection — typed value → attribute ──────────────────────────────────────

describe('UIContainerElement — surface / flex props reflect', () => {
  it('elevation/brightness/align/justify/gap reflect their string value; wrap reflects boolean presence', () => {
    const el = new ProbeContainer()
    el.elevation = '2'
    el.brightness = '-1'
    el.align = 'center'
    el.justify = 'between'
    el.gap = 'md'
    expect(el.getAttribute('elevation')).toBe('2')
    expect(el.getAttribute('brightness')).toBe('-1')
    expect(el.getAttribute('align')).toBe('center')
    expect(el.getAttribute('justify')).toBe('between')
    expect(el.getAttribute('gap')).toBe('md')

    el.wrap = true
    expect(el.hasAttribute('wrap')).toBe(true)
    el.wrap = false
    expect(el.hasAttribute('wrap')).toBe(false) // boolean-false removes the attribute
  })

  it('an inbound attribute crosses to the typed value (and snaps an out-of-range value to the neutral base)', () => {
    const el = new ProbeContainer()
    document.body.append(el)
    el.setAttribute('elevation', '3')
    expect(el.elevation).toBe('3')
    el.setAttribute('elevation', '9') // out of range → enumType.from snaps to values[0] = '0' (the neutral base)
    expect(el.elevation).toBe('0')
    el.remove()
  })
})

// ── typed literal unions — the @ts-expect-error negative controls ─────────────

describe('UIContainerElement — props are typed literal unions, not number/string', () => {
  it('rejects a bare number elevation and an arbitrary align keyword at COMPILE time', () => {
    const el = new ProbeContainer()
    // @ts-expect-error — elevation is the literal union '-3'…'3' (typed strings), NOT a bare number
    el.elevation = 2
    // @ts-expect-error — align is a fixed keyword union; an arbitrary string is rejected
    el.align = 'middle'
    // the valid forms compile (sanity — proves the union accepts its own members)
    el.elevation = '2'
    el.align = 'center'
    expect(el.elevation).toBe('2')
    expect(el.align).toBe('center')
  })
})

// ── zero residue — the connection scope tears down ────────────────────────────

describe('UIContainerElement — connect/disconnect zero residue', () => {
  it('subscribes on connect, leaves zero subscribers on disconnect, re-subscribes on reconnect', () => {
    const el = new ProbeContainer()
    expect(inspect(el.probe).subscribers).toBe(0) // not connected → no effect

    document.body.append(el)
    expect(inspect(el.probe).subscribers).toBe(1) // exactly the scope-owned connected() effect

    el.remove()
    expect(inspect(el.probe).subscribers).toBe(0) // scope.dispose() tore it down — zero residue

    document.body.append(el) // reconnect re-arms cleanly
    expect(inspect(el.probe).subscribers).toBe(1)
    el.remove()
  })
})
