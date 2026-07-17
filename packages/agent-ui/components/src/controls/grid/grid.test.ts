import { describe, it, expect } from 'vitest'
import { UIGridElement } from './grid.ts'
import { UIContainerElement } from '../../dom/container.ts'
import { UIElement, UIFormElement } from '../../dom/index.ts'

// s6 — ui-grid jsdom behaviour (decomp g9-containers node s6). jsdom can't resolve the @scope/auto-fit grid
// (that is the cross-engine browser smoke, grid.browser.test.ts) — here we pin the STRUCTURAL contract: the
// element self-defines + extends the surface base (NOT form-associated), the four props (elevation/brightness/
// gap/min) reflect, the `min` <length> threads into the role-pure --ui-grid-min token (and is torn down on
// disconnect — zero LIVE residue, re-armed on reconnect), the host carries no ARIA role attribute, and the
// typed literal unions reject a bare number / arbitrary keyword at COMPILE time (@ts-expect-error).

describe('ui-grid — definition + the surface base (not form-associated)', () => {
  it('self-defines ui-grid as a UIGridElement', () => {
    expect(customElements.get('ui-grid')).toBe(UIGridElement)
  })

  it('extends UIContainerElement / UIElement but is NOT a UIFormElement (the non-form family)', () => {
    const el = document.createElement('ui-grid')
    expect(el).toBeInstanceOf(UIGridElement)
    expect(el).toBeInstanceOf(UIContainerElement)
    expect(el).toBeInstanceOf(UIElement)
    expect(el).not.toBeInstanceOf(UIFormElement)
  })

  it('declares no form-association surface (a container contributes nothing to a form)', () => {
    expect('formAssociated' in UIGridElement).toBe(false)
    const el = document.createElement('ui-grid')
    expect('form' in el).toBe(false)
    expect('validity' in el).toBe(false)
  })

  it('folds the shared surfaceProps + the single gap flexProps entry + min into its finalize table', () => {
    // the props order: surfaceProps (elevation, brightness) → gap → min. No align/justify/wrap (a track grid
    // consumes only `gap` of the flex grammar).
    expect(Object.keys(UIGridElement.props)).toEqual(['elevation', 'brightness', 'gap', 'min'])
  })
})

describe('ui-grid — props reflect', () => {
  it('elevation/brightness/gap/min reflect their value to the host attribute', () => {
    const el = document.createElement('ui-grid') as UIGridElement
    el.elevation = '2'
    el.brightness = '-1'
    el.gap = 'md'
    el.min = '12rem'
    expect(el.getAttribute('elevation')).toBe('2')
    expect(el.getAttribute('brightness')).toBe('-1')
    expect(el.getAttribute('gap')).toBe('md')
    expect(el.getAttribute('min')).toBe('12rem')
  })

  it('the declared defaults are the neutral base / no gap / no min, and a fresh grid carries no attributes', () => {
    const el = document.createElement('ui-grid') as UIGridElement
    expect([el.elevation, el.brightness, el.gap, el.min]).toEqual(['0', '0', 'none', ''])
    for (const a of ['elevation', 'brightness', 'gap', 'min']) expect(el.hasAttribute(a)).toBe(false)
  })

  it('an inbound `min` attribute crosses to the typed value', () => {
    const el = document.createElement('ui-grid') as UIGridElement
    document.body.append(el)
    el.setAttribute('min', '200px')
    expect(el.min).toBe('200px')
    el.remove()
  })

  it('the host carries NO role attribute — a grid is presentational (no internals role either)', () => {
    const el = document.createElement('ui-grid')
    document.body.append(el)
    expect(el.hasAttribute('role')).toBe(false)
    el.remove()
  })
})

describe('ui-grid — the `min` token thread (--ui-grid-min) + zero residue', () => {
  it('threads a set `min` into the inline --ui-grid-min token, and clears it when unset', async () => {
    const el = document.createElement('ui-grid') as UIGridElement
    document.body.append(el)
    expect(el.style.getPropertyValue('--ui-grid-min')).toBe('') // default ⇒ removeProperty (the sheet floor applies)

    el.min = '10rem' // a post-connect change schedules the effect re-run (the kernel batches on a microtask)
    await el.updateComplete
    expect(el.style.getPropertyValue('--ui-grid-min')).toBe('10rem') // the prop repoints the token inline

    el.min = '' // back to unset ⇒ the inline token is removed (the grid.css default floor takes over again)
    await el.updateComplete
    expect(el.style.getPropertyValue('--ui-grid-min')).toBe('')
    el.remove()
  })

  it('the thread effect is torn down on disconnect (zero LIVE residue) and re-armed on reconnect', () => {
    const el = document.createElement('ui-grid') as UIGridElement
    el.min = '8rem' // set BEFORE connect: the effect's synchronous FIRST run (on connect) threads it — no flush wait
    document.body.append(el)
    expect(el.style.getPropertyValue('--ui-grid-min')).toBe('8rem')

    el.remove() // disconnect disposes the connection scope → the thread effect dies (unsubscribes)
    el.min = '5rem' // the setter still reflects the attribute (connection-independent) …
    expect(el.getAttribute('min')).toBe('5rem')
    expect(el.style.getPropertyValue('--ui-grid-min')).toBe('8rem') // … but the DEAD effect does NOT re-thread → stale token = proof it was torn down

    document.body.append(el) // reconnect → a NEW effect, its synchronous first run re-reads min and re-threads
    expect(el.style.getPropertyValue('--ui-grid-min')).toBe('5rem')
    el.remove()
  })
})

describe('ui-grid — typed literal unions (the @ts-expect-error negative controls)', () => {
  it('rejects a bare number elevation, an arbitrary gap keyword, and a number min at COMPILE time', () => {
    const el = document.createElement('ui-grid') as UIGridElement
    // @ts-expect-error — elevation is the literal union '-3'…'3' (typed strings), NOT a bare number
    el.elevation = 2
    // @ts-expect-error — gap is the fixed --md-sys-space step union; an arbitrary keyword is rejected
    el.gap = 'huge'
    // @ts-expect-error — min is a CSS <length> string, not a number
    el.min = 12
    // the valid forms compile (sanity — the unions accept their own members)
    el.elevation = '2'
    el.gap = 'lg'
    el.min = '12rem'
    expect([el.elevation, el.gap, el.min]).toEqual(['2', 'lg', '12rem'])
  })
})
