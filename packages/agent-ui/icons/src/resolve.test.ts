// resolve.test.ts — s-resolve accept (icon-adapter.decomp.json): resolveIcon/setIcon per LLD-C3.
// Each test passes its own `Registry` instance explicitly (never the module singleton) for isolation.

import { describe, expect, it } from 'vitest'
import { Registry } from './registry.ts'
import { resolveIcon, setIcon } from './resolve.ts'
import { ICON_NAMES, type IconName, type IconPack } from './types.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

function makePack(id: string): IconPack {
  const icons = Object.fromEntries(
    ICON_NAMES.map((name) => [name, `<path data-name="${name}"/>`]),
  ) as Record<IconName, string>
  return { id, viewBox: '0 0 256 256', icons }
}

describe('resolveIcon', () => {
  it('returns an SVG-namespace element with the stamped attributes + a non-empty child', () => {
    const registry = new Registry()
    registry.registerPack(makePack('fixture'))
    const svg = resolveIcon('check', registry)

    expect(svg.namespaceURI).toBe(SVG_NS)
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg.getAttribute('viewBox')).toBe('0 0 256 256')
    expect(svg.getAttribute('fill')).toBe('currentColor')
    expect(svg.getAttribute('width')).toBe('100%')
    expect(svg.getAttribute('height')).toBe('100%')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(svg.children.length).toBeGreaterThan(0)
  })

  it('each call returns a NEW element', () => {
    const registry = new Registry()
    registry.registerPack(makePack('fixture'))
    expect(resolveIcon('check', registry)).not.toBe(resolveIcon('check', registry))
  })

  it('no active pack -> a non-throwing empty <svg data-icon-missing>', () => {
    const registry = new Registry()
    let svg: SVGElement | undefined
    expect(() => {
      svg = resolveIcon('check', registry)
    }).not.toThrow()
    expect(svg?.getAttribute('data-icon-missing')).toBe('check')
    expect(svg?.children.length).toBe(0)
  })

  it('an unknown name -> a non-throwing empty <svg data-icon-missing>', () => {
    const registry = new Registry()
    registry.registerPack(makePack('fixture'))
    let svg: SVGElement | undefined
    expect(() => {
      svg = resolveIcon('bogus' as IconName, registry)
    }).not.toThrow()
    expect(svg?.getAttribute('data-icon-missing')).toBe('bogus')
    expect(svg?.children.length).toBe(0)
  })
})

describe('setIcon', () => {
  it('replaces the element children with the resolved svg', () => {
    const registry = new Registry()
    registry.registerPack(makePack('fixture'))
    const el = document.createElement('span')
    el.append(document.createTextNode('stale'))

    setIcon(el, 'eye-slash', registry)

    expect(el.childNodes.length).toBe(1)
    const svg = el.firstElementChild as SVGElement
    expect(svg.namespaceURI).toBe(SVG_NS)
    expect(svg.tagName.toLowerCase()).toBe('svg')
  })

  it('a second call replaces the previously injected svg', () => {
    const registry = new Registry()
    registry.registerPack(makePack('fixture'))
    const el = document.createElement('span')

    setIcon(el, 'eye', registry)
    const firstSvg = el.firstElementChild
    setIcon(el, 'eye-slash', registry)

    expect(el.childNodes.length).toBe(1)
    expect(el.firstElementChild).not.toBe(firstSvg)
  })
})
