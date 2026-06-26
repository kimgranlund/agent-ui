import { describe, it, expect } from 'vitest'

// G0 toolchain proof: Vitest + jsdom + strict TS + custom elements work end-to-end.
// Replace with the real reactivity-kernel probes at G1.
describe('toolchain', () => {
  it('runs strict TypeScript under Vitest', () => {
    const double = (n: number): number => n * 2
    expect(double(21)).toBe(42)
  })

  it('has a jsdom document that upgrades custom elements and fires reactions', () => {
    class HelloElement extends HTMLElement {
      connectedCallback(): void {
        this.textContent = 'hello'
      }
    }
    customElements.define('hello-toolchain', HelloElement)

    const el = document.createElement('hello-toolchain')
    document.body.append(el)
    expect(el).toBeInstanceOf(HelloElement)
    expect(el.textContent).toBe('hello')
    el.remove()
  })
})
