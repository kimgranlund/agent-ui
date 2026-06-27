import { describe, it, expect } from 'vitest'
import { html, svg, render } from './template.ts'

// G3 slice 3 — t-positions (rubric template.md D6): svg`` parses in the SVG namespace; unsupported binding
// positions throw at prepare with a message that NAMES the position; tag-name indirection throws.
// Named probes: svg-namespace · position-naming-throws · tag-indirection-throws.

const SVG_NS = 'http://www.w3.org/2000/svg'

describe('template positions — svg namespace (D6)', () => {
  it('svg-namespace: an svg`` fragment yields SVG-namespaced elements; child + attr holes commit', () => {
    const c = document.createElement('div')
    render(svg`<circle r=${'5'}></circle>`, c)
    const circle = c.querySelector('circle')!
    expect(circle.namespaceURI).toBe(SVG_NS) // a real SVGElement, not an unknown HTML element
    expect(circle.getAttribute('r')).toBe('5') // attribute hole committed

    const c2 = document.createElement('div')
    render(svg`<text>${'hi'}</text>`, c2)
    const text = c2.querySelector('text')!
    expect(text.namespaceURI).toBe(SVG_NS)
    expect(text.textContent).toBe('hi') // child hole committed inside the svg fragment
  })

  it('svg-namespace: html`` is unaffected — its elements stay in the HTML namespace', () => {
    const c = document.createElement('div')
    render(html`<div>${'x'}</div>`, c)
    expect(c.querySelector('div')!.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
  })
})

describe('template positions — unsupported-position throws (D6)', () => {
  it('position-naming-throws: a comment-position hole throws, NAMING the comment position', () => {
    const c = document.createElement('div')
    expect(() => render(html`<!-- ${'x'} -->`, c)).toThrow(/COMMENT/)
  })

  it('position-naming-throws: a partial (multi-string) attribute value throws, NAMING the position', () => {
    const c = document.createElement('div')
    expect(() => render(html`<div class="a ${'b'}"></div>`, c)).toThrow(/PARTIAL attribute/)
  })

  it('tag-indirection-throws: a hole in tag-name position throws at prepare (open and close tag)', () => {
    const c = document.createElement('div')
    expect(() => render(html`<${'div'}>x</div>`, c)).toThrow(/TAG-NAME/)
    expect(() => render(html`<div>x</${'div'}>`, c)).toThrow(/TAG-NAME/)
  })

  it('the error names the offending hole index (actionable, not a bare throw)', () => {
    const c = document.createElement('div')
    expect(() => render(html`<div>ok</div><!-- ${'x'} -->`, c)).toThrow(/hole #0/)
  })
})
