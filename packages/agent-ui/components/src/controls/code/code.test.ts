import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { UICodeElement } from './code.ts'
declare const process: { cwd(): string }

// code.test.ts — jsdom behaviour probes (LLD-C7, content-family.lld.md §3; SPEC-R1/R3/R4/R5). jsdom is
// blind to painted overflow/scroll geometry (SPEC-N2) — that leg lives in code.browser.test.ts. This file
// covers: prop typing/defaults/reflection, ARIA via internals (role=code, no host attribute), the
// zero-machinery grep-able-absence leg (SPEC-R1 AC2), the plain-text-under-clobber guarantee (SPEC-R3),
// `language`'s zero rendering effect (SPEC-R4), and zero residue across connect/disconnect.

// A throwaway subclass re-exposing the protected `internals` (the bar-chart/icon precedent), so a probe
// can read role set via ElementInternals (the FACE pattern — never a host attribute).
class ProbeCode extends UICodeElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-code-probe', ProbeCode)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UICodeElement — upgrade + typed props (SPEC-R1/R4)', () => {
  it('upgrades to the class; language defaults to empty string', () => {
    const el = document.createElement('ui-code') as UICodeElement
    expect(el).toBeInstanceOf(UICodeElement)
    expect(el.language).toBe('')
  })

  it('self-defines as ui-code, guarded against double-define', () => {
    expect(customElements.get('ui-code')).toBe(UICodeElement)
    expect(() => {
      if (!customElements.get('ui-code')) customElements.define('ui-code', UICodeElement)
    }).not.toThrow()
  })

  it('language reflects: a JS-set value round-trips through the attribute (SPEC-R4 AC2)', () => {
    const el = mount(document.createElement('ui-code')) as UICodeElement
    el.language = 'json'
    expect(el.getAttribute('language')).toBe('json')
    el.removeAttribute('language')
    expect(el.language).toBe('')
  })

  it('an attribute-set language reads back on the property', () => {
    const el = document.createElement('ui-code') as UICodeElement
    el.setAttribute('language', 'typescript')
    mount(el)
    expect(el.language).toBe('typescript')
  })

  it('language accepts any free string — not a closed enum (ADR-0113 cl.2)', () => {
    const el = mount(document.createElement('ui-code')) as UICodeElement
    el.language = 'made-up-lang-xyz'
    expect(el.language).toBe('made-up-lang-xyz')
  })
})

describe('UICodeElement — content is host-as-content, verbatim (SPEC-R1/R3)', () => {
  it('the light-DOM children ARE the code — no template, no stamp, textContent renders verbatim', () => {
    const el = document.createElement('ui-code') as UICodeElement
    el.textContent = 'npm run check && npm test'
    mount(el)
    expect(el.textContent).toBe('npm run check && npm test')
    expect(el.children).toHaveLength(0) // no injected element — pure text node
  })

  it('a bound textContent write of HTML-looking content renders as literal text, never parsed (SPEC-R3 AC1)', () => {
    const el = document.createElement('ui-code') as UICodeElement
    mount(el)
    el.textContent = '<img src=x onerror=alert(1)>'
    expect(el.children).toHaveLength(0)
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>')
    expect(el.querySelector('img')).toBeNull()
  })

  it('author-injected element children render untouched until a textContent write clobbers them (SPEC-R3 AC2)', () => {
    const el = document.createElement('ui-code') as UICodeElement
    const span = document.createElement('span')
    span.className = 'tok'
    span.textContent = 'const'
    el.append(span)
    mount(el)
    expect(el.querySelector('span.tok')).not.toBeNull()

    el.textContent = 'let' // the bound `code` lane — clobbers to one text node
    expect(el.querySelector('span.tok')).toBeNull()
    expect(el.textContent).toBe('let')
  })

  it('a leading newline inside the tag renders as authored (the parser nicety, SPEC-R2 AC4)', () => {
    const el = document.createElement('ui-code') as UICodeElement
    el.innerHTML = '\ncode'
    mount(el)
    expect(el.textContent).toBe('\ncode')
  })

  it('empty content paints an honest empty state — never throws (LLD §7 row 11)', () => {
    const el = document.createElement('ui-code') as UICodeElement
    expect(() => mount(el)).not.toThrow()
    expect(el.textContent).toBe('')
  })

  it('whitespace-only content is preserved verbatim, not collapsed', () => {
    const el = document.createElement('ui-code') as UICodeElement
    el.textContent = '   \n\t  '
    mount(el)
    expect(el.textContent).toBe('   \n\t  ')
  })

  it('huge unbroken single-line content is held verbatim as one text node (no wrap machinery, jsdom-observable half of SPEC-R2 AC1)', () => {
    const el = document.createElement('ui-code') as UICodeElement
    const long = 'x'.repeat(5000)
    el.textContent = long
    mount(el)
    expect(el.textContent).toBe(long)
    expect(el.childNodes).toHaveLength(1)
  })
})

describe('UICodeElement — a11y via internals (SPEC-R5)', () => {
  it('role=code is set via ElementInternals on connect — NEVER a host role attribute', () => {
    const el = mount(new ProbeCode()) as ProbeCode
    expect(el.probeInternals.role).toBe('code')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('role=code is re-asserted idempotently across reconnects', () => {
    const el = mount(new ProbeCode()) as ProbeCode
    expect(el.probeInternals.role).toBe('code')
    el.remove()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('code')
    el.remove()
  })

  it('no aria-* attribute is ever set on the host — semantics live entirely on internals', () => {
    const el = mount(document.createElement('ui-code')) as UICodeElement
    for (const attr of el.getAttributeNames()) expect(attr.startsWith('aria-')).toBe(false)
  })
})

describe('UICodeElement — the zero-machinery grep-able-absence leg (SPEC-R1 AC2)', () => {
  const src = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/code/code.ts`, 'utf8') as string

  it('no MutationObserver, no stamp/adoption machinery, no clipboard API, no tokenizer in code.ts', () => {
    expect(src).not.toMatch(/MutationObserver/)
    expect(src).not.toMatch(/replaceWith|appendChild|replaceChildren/) // no stamp/adoption calls
    expect(src).not.toMatch(/clipboard/i)
    expect(src).not.toMatch(/tokeniz|highlight/i)
  })

  it('render() is never overridden — the inherited void stands (host-as-content)', () => {
    expect(src).not.toMatch(/protected (override )?render\(/)
  })

  it('there is exactly ONE internals write (the constant role, SPEC-R5) and no reactive `this.effect(` call', () => {
    expect([...src.matchAll(/this\.internals\.\w+\s*=/g)]).toHaveLength(1)
    expect(src).not.toMatch(/this\.effect\(/)
  })
})

describe('UICodeElement — `language` has zero rendering effect (SPEC-R4 AC1)', () => {
  it('with vs without `language`, the rendered DOM shape is byte-identical (attribute aside)', () => {
    const a = mount(document.createElement('ui-code')) as UICodeElement
    a.textContent = 'x'
    const b = mount(document.createElement('ui-code')) as UICodeElement
    b.language = 'typescript'
    b.textContent = 'x'
    expect(a.children.length).toBe(b.children.length)
    expect(a.textContent).toBe(b.textContent)
  })
})

describe('UICodeElement — zero residue across connect/disconnect', () => {
  it('role re-installs idempotently; no leaked observers/effects (there are none to leak, SPEC-R1 AC2)', () => {
    const el = mount(new ProbeCode()) as ProbeCode
    el.textContent = 'a'
    el.remove()
    el.textContent = 'b' // mutate while disconnected — no observer exists to react either way
    document.body.append(el)
    expect(el.probeInternals.role).toBe('code')
    expect(el.textContent).toBe('b')
    el.remove()
  })
})
