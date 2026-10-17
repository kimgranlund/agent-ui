// theme-provider.test.ts — jsdom probes for UIThemeProviderElement (ADR-0117; LLD-C6, SPEC-R1…R5). Covers
// the component contract, the attribute↔property reflection + fail-open-on-malformed rule, the SPEC-R3
// scheme→color-scheme mapping (unset CLEARS rather than defaults to light — the load-bearing fix), the
// LOW-1 empty-vs-absent-attribute distinction, and the disconnect/reconnect regression net. SPEC-R3 AC4
// (nested-unset inherits an ANCESTOR provider's scheme) needs a real CSS cascade/inheritance resolution —
// jsdom does not implement `light-dark()`/inherited `color-scheme` resolution, so that leg is the browser
// suite's job (theme-provider.browser.test.ts, LLD-C7); this file proves the MECHANISM (the inline style
// this component itself writes/clears), not the cascade outcome.
import { describe, it, expect } from 'vitest'
import { UIElement, UIFormElement } from '../../dom/index.ts'
import { UIThemeProviderElement } from './theme-provider.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

const SRC = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/theme-provider/theme-provider.ts`,
  'utf8',
) as string

function mount(markup = '<ui-theme-provider></ui-theme-provider>'): UIThemeProviderElement {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  return wrap.querySelector('ui-theme-provider') as UIThemeProviderElement
}

describe('ui-theme-provider — base class + tag (SPEC-R1)', () => {
  it('customElements.get resolves to a UIElement subclass, self-defined on import', () => {
    const ctor = customElements.get('ui-theme-provider')
    expect(ctor).toBe(UIThemeProviderElement)
    expect(ctor?.prototype).toBeInstanceOf(UIElement)
  })

  it('an instance is NOT instanceof UIFormElement — carries no formAssociated behavior', () => {
    const el = mount()
    expect(el).not.toBeInstanceOf(UIFormElement)
  })
})

describe('ui-theme-provider — props schema (SPEC-R2)', () => {
  it('AC1: a fresh, never-touched instance reads "" on both properties', () => {
    const el = mount()
    expect(el.scheme).toBe('')
    expect(el.theme).toBe('')
  })

  it('T-0169: the retired scale and density carriers are gone from the props schema', () => {
    const names = Object.keys((customElements.get('ui-theme-provider') as unknown as { props: object }).props)
    expect(names.sort()).toEqual(['scheme', 'theme'])
  })

  it('AC2: property→attribute and attribute→property reflection both hold, for every axis', () => {
    const el = mount()
    el.scheme = 'dark'
    expect(el.getAttribute('scheme')).toBe('dark')
    el.setAttribute('scheme', 'light')
    expect(el.scheme).toBe('light')

    el.theme = 'acme'
    expect(el.getAttribute('theme')).toBe('acme')
    el.setAttribute('theme', 'other-package')
    expect(el.theme).toBe('other-package')
  })

  it('AC3: an out-of-vocabulary enum value set via setAttribute fails OPEN to "" — never throws, never coerces to a named value', () => {
    const el = mount()
    expect(() => el.setAttribute('scheme', 'not-a-real-scheme')).not.toThrow()
    expect(el.scheme).toBe('')
  })
})

describe('ui-theme-provider — the scheme→color-scheme mapping, unset-inherits (SPEC-R3, the load-bearing fix)', () => {
  it('AC1: scheme="dark" — style.colorScheme is "dark"', () => {
    const el = mount('<ui-theme-provider scheme="dark"></ui-theme-provider>')
    expect(el.style.colorScheme).toBe('dark')
  })

  it('AC2: scheme="light" — the symmetric light-scheme resolution', () => {
    const el = mount('<ui-theme-provider scheme="light"></ui-theme-provider>')
    expect(el.style.colorScheme).toBe('light')
  })

  it('AC3a: scheme NEVER set — style.colorScheme is "" (no inline override), never a stale/defaulted value', () => {
    const el = mount()
    expect(el.style.colorScheme).toBe('')
  })

  it('AC3b: scheme set then CLEARED to "" — style.colorScheme genuinely clears, not a stale prior value', async () => {
    const el = mount('<ui-theme-provider scheme="dark"></ui-theme-provider>')
    expect(el.style.colorScheme).toBe('dark')
    el.scheme = ''
    await el.updateComplete
    expect(el.style.colorScheme).toBe('')
  })

  it('the load-bearing fix, named: unset never defaults to "light" (the site-local predecessor collapsed it there)', () => {
    const el = mount()
    expect(el.style.colorScheme).not.toBe('light')
    expect(el.style.colorScheme).toBe('')
  })
})

describe('ui-theme-provider: the one effect reads only scheme (LLD-C2)', () => {
  it('the single this.effect(...) body reads this.scheme and no other axis', () => {
    // The ONE effect this component establishes (LLD-C2) is a single-statement `this.style.colorScheme = …`
    // reading only `this.scheme`.
    const effectMatch = SRC.match(/this\.effect\(\(\) => \{([\s\S]*?)\}\)/)
    expect(effectMatch, 'expected exactly one this.effect(...) call in theme-provider.ts').not.toBeNull()
    const body = effectMatch![1]!
    expect(body).not.toContain('this.theme')
    expect(body).toContain('this.scheme')
  })
})

describe('ui-theme-provider — theme stays the reserved, inert seam (SPEC-R5)', () => {
  it('AC1: any string, including an unregistered name, causes no visual change beyond scheme', () => {
    const el = mount('<ui-theme-provider scheme="light"></ui-theme-provider>')
    const before = el.style.colorScheme
    expect(() => {
      el.theme = 'a-totally-unregistered-package-name'
    }).not.toThrow()
    expect(el.style.colorScheme).toBe(before)
  })
})

describe('ui-theme-provider — empty-attribute vs absent-attribute (LOW-1)', () => {
  it('never-touched (absent attribute) and explicitly-set-to-"" (present, empty attribute) both resolve to the identical "" property, but are NOT DOM-identical', () => {
    const neverTouched = mount()
    expect(neverTouched.hasAttribute('theme')).toBe(false)
    expect(neverTouched.theme).toBe('')

    const explicitEmpty = mount('<ui-theme-provider theme=""></ui-theme-provider>')
    expect(explicitEmpty.hasAttribute('theme')).toBe(true) // present, empty: genuinely different DOM shape
    expect(explicitEmpty.getAttribute('theme')).toBe('')
    expect(explicitEmpty.theme).toBe('') // same resolved property value as the never-touched case
  })

  it('an explicit property write to "" ALSO reflects out a real, present, empty attribute (reflectOut always runs on an explicit set)', () => {
    const el = mount('<ui-theme-provider scheme="dark"></ui-theme-provider>')
    expect(el.hasAttribute('scheme')).toBe(true)
    el.scheme = ''
    expect(el.hasAttribute('scheme')).toBe(true) // still present — reflected out as scheme=""
    expect(el.getAttribute('scheme')).toBe('')
  })
})

describe('ui-theme-provider — disconnect/reconnect (the base-class regression net)', () => {
  it('the scheme effect is disposed on disconnect and re-established on reconnect', async () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = '<ui-theme-provider scheme="dark"></ui-theme-provider>'
    document.body.append(wrap)
    const el = wrap.querySelector('ui-theme-provider') as UIThemeProviderElement
    expect(el.style.colorScheme).toBe('dark')

    el.remove()
    el.scheme = 'light' // a write while disconnected — no live effect to react (this class's connected()
    // scope was already disposed by disconnectedCallback), so no assertion is made about the DETACHED
    // element's style here — only that RECONNECTING re-derives it correctly below.

    document.body.append(el) // reconnect — a fresh connected() call re-installs the effect (eager first run)
    expect(el.style.colorScheme).toBe('light')

    wrap.remove()
  })
})
