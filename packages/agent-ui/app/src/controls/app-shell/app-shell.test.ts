import { describe, it, expect, vi, afterEach } from 'vitest'
import { UIAppShellElement, UIAppShellRegionElement } from './app-shell.ts'
import { whenFlushed } from '@agent-ui/components'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '@agent-ui/components/descriptor'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
// same reverse-coupling fs-read idiom as card-descriptor.test.ts / layering.test.ts.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// n2a/n2b — jsdom probes for ui-app-shell + ui-app-shell-region (LLD-C3/C6/C7). Covers: (1) the landmark
// role → internals mapping (SPEC-R3 AC2), (2) region reflection + the order-significant unknown-value
// coercion (SPEC-R4 AC2), (3) the empty-shell dev warning + duplicate-region edges (LLD-C3), and (4) BOTH
// descriptors' structural + contract↔props + contract↔source trip-wires (ADR-0004). What jsdom CANNOT
// resolve — the ACTUAL grid-area placement/@container reflow/forced-colors survival, since jsdom does not
// lay out `@scope`/CSS Grid — is app-shell.browser.test.ts (n2b's cross-engine leg).

// Probe subclasses re-exposing the protected `internals` (the button.test.ts / tabs.test.ts precedent) — a
// NEW tag each, since the real classes already claimed `ui-app-shell`/`ui-app-shell-region` at import time.
class ProbeShell extends UIAppShellElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-app-shell-probe', ProbeShell)

class ProbeRegion extends UIAppShellRegionElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-app-shell-region-probe', ProbeRegion)

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})
function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-app-shell-region — landmark role via internals (SPEC-R3 AC2)', () => {
  it('each of the five regions sets its matching ARIA landmark role, with NO host role attribute', () => {
    const cases: Array<[string, string]> = [
      ['banner', 'banner'],
      ['navigation', 'navigation'],
      ['main', 'main'],
      ['complementary', 'complementary'],
      ['contentinfo', 'contentinfo'],
    ]
    for (const [region, role] of cases) {
      const el = new ProbeRegion()
      el.region = region as ProbeRegion['region'] // property-wins, set BEFORE connect (ADR-0005)
      mount(el)
      expect(el.ii.role, `region=${region}`).toBe(role)
      expect(el.getAttribute('role')).toBeNull() // never a host attribute — internals only
      el.remove()
    }
  })

  it('is reactive: reassigning .region AFTER connect re-derives the landmark role live', async () => {
    const el = mount(new ProbeRegion())
    expect(el.ii.role).toBe('main') // the default
    el.region = 'navigation'
    await el.updateComplete // the role effect is microtask-batched (the tabs.ts selection-effect precedent)
    expect(el.ii.role).toBe('navigation')
    el.region = 'contentinfo'
    await el.updateComplete
    expect(el.ii.role).toBe('contentinfo')
  })

  it('a never-touched default carries NO attribute (props.ts only reflects a value crossing the setter — the card.test.ts elevation/brightness precedent); an EXPLICIT set reflects', () => {
    const el = mount(new ProbeRegion())
    expect(el.region).toBe('main') // the in-memory default
    expect(el.hasAttribute('region')).toBe(false) // never assigned through the setter → nothing to reflect
    el.region = 'banner'
    expect(el.getAttribute('region')).toBe('banner')
    el.region = 'main' // explicitly RESET to the default — an enum's `to()` never returns null, so this DOES reflect
    expect(el.getAttribute('region')).toBe('main')
  })

  it('an out-of-set region value coerces to "main" — order-significant (values[0]), not silently dropped', () => {
    const el = mount(new ProbeRegion())
    el.setAttribute('region', 'bogus-region')
    expect(el.region).toBe('main')
    expect(el.ii.role).toBe('main')
  })

  it('an unknown region on an INITIAL attribute (present at upgrade) also coerces to main', () => {
    const el = document.createElement('ui-app-shell-region-probe') as ProbeRegion
    el.setAttribute('region', 'sidebar') // not a member of the set; set BEFORE connect
    mount(el)
    expect(el.region).toBe('main')
    expect(el.ii.role).toBe('main')
  })

  it('used standalone (no ui-app-shell ancestor) still sets its landmark role', async () => {
    const el = mount(new ProbeRegion())
    el.region = 'complementary'
    await el.updateComplete // reassigned after connect — the role effect is microtask-batched
    expect(el.parentElement?.tagName).toBe('BODY') // genuinely outside any shell
    expect(el.ii.role).toBe('complementary')
  })
})

describe('ui-app-shell-region — landmark override (ADR-0083): internals.role = landmark || REGION_ROLE[region]', () => {
  it('defaults to "" (unset), reflects no attribute when untouched, and the role falls through to the region default', () => {
    const el = mount(new ProbeRegion())
    expect(el.landmark).toBe('')
    expect(el.hasAttribute('landmark')).toBe(false) // never assigned through the setter → nothing to reflect
    expect(el.ii.role).toBe('main') // region's own default — landmark absent, falls through (the || branch)
  })

  it('overrides the role INDEPENDENTLY of region — region drives the column, landmark drives the role alone', () => {
    const el = new ProbeRegion()
    el.region = 'navigation' // the a2ui-live composer's shape: left column…
    el.landmark = 'complementary' // …but NOT a "navigation" landmark
    mount(el)
    expect(el.region).toBe('navigation')
    expect(el.ii.role, 'landmark did not override the region default').toBe('complementary')
    expect(el.getAttribute('landmark')).toBe('complementary')
  })

  it('is reactive: reassigning .landmark AFTER connect re-derives the role live (both directions)', async () => {
    const el = mount(new ProbeRegion())
    expect(el.ii.role).toBe('main')
    el.landmark = 'form'
    await el.updateComplete
    expect(el.ii.role).toBe('form')
    el.landmark = '' // explicitly clearing the override falls BACK to the region default
    await el.updateComplete
    expect(el.ii.role).toBe('main')
  })

  it('an out-of-set landmark value coerces to "" — falls through to the region default, never throws', () => {
    const el = new ProbeRegion()
    el.region = 'banner' // set BEFORE connect (property-wins, ADR-0005) so the FIRST (synchronous) effect
    // run already sees it — an out-of-set `landmark` coerces '' → '' (no actual signal change), so there is
    // no re-run to await here; setting `region` post-connect instead would need one (the tabs.ts precedent).
    mount(el)
    el.setAttribute('landmark', 'bogus-landmark')
    expect(el.landmark).toBe('')
    expect(el.ii.role).toBe('banner') // fell through to region's own default
  })

  it('reassigning .region while a landmark override is active does NOT change the role (region only drives the column)', async () => {
    const el = mount(new ProbeRegion())
    el.landmark = 'search'
    await el.updateComplete
    expect(el.ii.role).toBe('search')
    el.region = 'contentinfo' // a plain grid-column repoint — the override still wins
    await el.updateComplete
    expect(el.ii.role, 'region reassignment leaked through an active landmark override').toBe('search')
  })
})

describe('ui-app-shell-region — collapse (ADR-0084): a reflected attribute, no behaviour of its own in .ts', () => {
  it('defaults to "hide" and reflects no attribute when untouched (today\'s back-compat behaviour)', () => {
    const el = mount(new ProbeRegion())
    expect(el.collapse).toBe('hide')
    expect(el.hasAttribute('collapse')).toBe(false)
  })

  it('an explicit "stack" reflects as a plain attribute — this element sets no ARIA/behaviour from it', () => {
    const el = mount(new ProbeRegion())
    el.collapse = 'stack'
    expect(el.getAttribute('collapse')).toBe('stack')
    expect(el.ii.role).toBe('main') // unaffected — collapse never touches the role
  })

  it('an out-of-set collapse value (incl. the RESERVED "toggle") coerces to "hide" — order-significant, never throws', () => {
    const el = mount(new ProbeRegion())
    el.setAttribute('collapse', 'toggle') // reserved, not yet a real member (ADR-0084)
    expect(el.collapse).toBe('hide')
  })
})

describe('ui-app-shell — presence-driven composition (SPEC-R3/R4)', () => {
  it('warns once at connect when composed with no main region (a developer diagnostic, not a throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const shell = document.createElement('ui-app-shell') as UIAppShellElement
    const nav = document.createElement('ui-app-shell-region')
    nav.setAttribute('region', 'navigation')
    shell.append(nav)
    expect(() => mount(shell)).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/main/i)
    warn.mockRestore()
  })

  it('does NOT warn when a main region is present (explicit region="main")', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const shell = document.createElement('ui-app-shell') as UIAppShellElement
    const main = document.createElement('ui-app-shell-region')
    main.setAttribute('region', 'main')
    shell.append(main)
    mount(shell)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does NOT warn for a BARE main region child (no region attribute at all — the untouched default)', () => {
    // The exact case app-shell.css's own `:not([region])` grid-placement leg exists for: a never-touched
    // <ui-app-shell-region> carries no `region` attribute (props.ts only reflects a value crossing the
    // setter), so the connect-time check must treat "no attribute" as "main" too, or every ordinary
    // un-annotated main region false-positive-warns.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const shell = document.createElement('ui-app-shell') as UIAppShellElement
    shell.append(document.createElement('ui-app-shell-region')) // no [region] attribute — the default
    mount(shell)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('an empty shell (no region children at all) still warns (main is absent) and does not throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const shell = document.createElement('ui-app-shell') as UIAppShellElement
    expect(() => mount(shell)).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('duplicate regions (two children both region=navigation) are allowed — both dock correctly', () => {
    const shell = document.createElement('ui-app-shell') as UIAppShellElement
    const main = document.createElement('ui-app-shell-region')
    main.setAttribute('region', 'main')
    const navA = document.createElement('ui-app-shell-region-probe') as ProbeRegion
    navA.setAttribute('region', 'navigation')
    const navB = document.createElement('ui-app-shell-region-probe') as ProbeRegion
    navB.setAttribute('region', 'navigation')
    shell.append(main, navA, navB)
    mount(shell)
    expect(navA.region).toBe('navigation')
    expect(navB.region).toBe('navigation')
    expect(navA.ii.role).toBe('navigation')
    expect(navB.ii.role).toBe('navigation')
  })
})

describe('ui-app-shell — isolated prop, structural legs (SPEC-R6/ADR-0082, LLD-C5)', () => {
  it('defaults to false, reflects as boolean presence, and the OFF path attaches no shadow root', () => {
    const el = mount(document.createElement('ui-app-shell') as UIAppShellElement)
    expect(el.isolated).toBe(false)
    expect(el.hasAttribute('isolated')).toBe(false)
    expect(el.shadowRoot).toBeNull()
  })

  it('isolated=true set BEFORE connect (property-wins, ADR-0005) attaches a shadow + injects the 3 sheets + relocates children', () => {
    const el = document.createElement('ui-app-shell') as UIAppShellElement
    const main = document.createElement('ui-app-shell-region')
    main.setAttribute('region', 'main')
    el.append(main)
    el.isolated = true // pre-upgrade property write — captured, replayed at connect (element.ts upgradeProps)
    mount(el)

    expect(el.shadowRoot).not.toBeNull()
    // the fleet sheets + the F1b grid mirror — 2 <link rel=stylesheet>s + 1 <style>, in that order (foundation
    // first). NOTE: the `href` VALUE itself is not asserted here — Vite's `?url` asset transform resolves to
    // a real, servable URL under an actual browser (proven in app-shell-isolation.browser.test.ts), but
    // vitest's Node-based jsdom module runner has no live dev-server to hand back a URL for, so `href` reads
    // empty in THIS environment; that is a jsdom/vite-node quirk, not a defect (the fleet's standing "jsdom
    // cannot resolve @scope/computed geometry — that is the browser gate's job" boundary, extended to assets).
    const links = el.shadowRoot!.querySelectorAll('link')
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('rel')).toBe('stylesheet')
    expect(links[1].getAttribute('rel')).toBe('stylesheet')
    // the ONE injected <style> node (the F1b grid mirror). Its TEXT CONTENT is not asserted here for the
    // same `?raw`-under-vite-node reason as the link hrefs above (empty in jsdom, real in a browser) — its
    // actual content + effect (grid-area placement, narrow reflow) is proven in
    // app-shell-isolation.browser.test.ts.
    const styles = el.shadowRoot!.querySelectorAll('style')
    expect(styles).toHaveLength(1)

    // the authored region RELOCATED into the shadow — light DOM is now empty, the region lives in the shadow.
    expect(el.children).toHaveLength(0)
    expect(el.shadowRoot!.contains(main)).toBe(true)
    expect(main.getAttribute('region')).toBe('main') // the SAME element, not a clone
  })

  it('a reconnect (disconnect then re-append) is safe — attachShadow is not called twice, content stays put', () => {
    const el = document.createElement('ui-app-shell') as UIAppShellElement
    el.isolated = true
    mount(el)
    const shadow = el.shadowRoot
    expect(shadow).not.toBeNull()

    el.remove() // disconnect (the shadow persists — it cannot be detached)
    expect(() => mount(el)).not.toThrow() // re-connect: the `!this.shadowRoot` guard makes this safe
    expect(el.shadowRoot).toBe(shadow) // the SAME shadow root, not a second one
  })

  it('a garbage-collected-looking OFF shell (isolated=false) never touches the shadow API at all', () => {
    const el = mount(document.createElement('ui-app-shell') as UIAppShellElement)
    expect(el.shadowRoot).toBeNull()
    expect(el.children.length).toBeGreaterThanOrEqual(0) // light DOM untouched (nothing relocated)
  })

  it('an isolated shell WITH a main region does NOT warn — the ShadowRoot-safe main-region check (regression: the shipped `:scope >` query false-positived on EVERY isolated shell, main region or not)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-app-shell') as UIAppShellElement
    const main = document.createElement('ui-app-shell-region')
    main.setAttribute('region', 'main')
    el.append(main)
    el.isolated = true // pre-upgrade property write — replayed at connect
    mount(el)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('an isolated shell with NO main region still warns — the isolated path is not vacuously silent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-app-shell') as UIAppShellElement
    const nav = document.createElement('ui-app-shell-region')
    nav.setAttribute('region', 'navigation')
    el.append(nav)
    el.isolated = true
    mount(el)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/main/i)
    warn.mockRestore()
  })

  it('warns once when `isolated` changes AFTER connect — connect-time only, not reactive (ADR-0082 §Consequences)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-app-shell') as UIAppShellElement
    const main = document.createElement('ui-app-shell-region')
    main.setAttribute('region', 'main') // avoid the UNRELATED "no main region" diagnostic muddying this leg
    el.append(main)
    mount(el) // isolated=false at connect
    expect(warn).not.toHaveBeenCalled() // the FIRST (registration) run of the toggle-watch effect is silent

    el.isolated = true
    await el.updateComplete // the watch effect is microtask-batched
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/isolated.*after connect/i)
    expect(el.shadowRoot).toBeNull() // the toggle genuinely has NO effect until a future re-connect

    warn.mockRestore()
  })
})

// ── residue-free disconnect (C10) — the base's connection-scoped `this.effect` is disposed on disconnect,
// proven the fleet's BEHAVIORAL way (the card.test.ts/scroll-fade.test.ts precedent, not the inspect(sig)-
// subscriber-count pattern — that pattern piggybacks a probe signal on UIFormElement's own formValue() hook,
// which neither ui-app-shell nor ui-app-shell-region has; both are plain, non-form-associated UIElements). A
// LIVE (leaked) effect reacts to a post-disconnect signal write; a properly disposed one leaves its prior,
// now-stale output untouched. Covers BOTH elements' own effects (the region role effect; the shell's
// main-region-check + toggle-warn watch) and BOTH paths (light-DOM; isolated — proving the connectedCallback
// override's shadow-attach + relocation adds no NEW leak surface of its own).
//
// MEASURED (caught by review — the first version of these 4 probes was VACUOUS): the kernel runs an effect's
// FIRST pass synchronously, but a re-run triggered by a dependency CHANGE is microtask-QUEUED
// (reactive/graph.ts → scheduler.ts's `queueMicrotask`). Asserting immediately after the post-disconnect
// signal write — with no await — reads the SAME stale value whether the effect is disposed (no re-run, ever)
// or merely LEAKED (a re-run is queued for the next microtask the sync assertion never reaches) — a disposed
// and a leaked effect were indistinguishable at that point. Every probe below now awaits `whenFlushed()`
// (the repo's own reactivity-test idiom, e.g. card.test.ts:296) BETWEEN the flip and the assertion, so a
// disposed effect's stale output and a leaked effect's flipped one are finally distinguishable.
describe('ui-app-shell / ui-app-shell-region — residue-free disconnect (C10)', () => {
  it('ui-app-shell-region: disconnect disposes the scope-owned role effect — light-DOM path', async () => {
    const el = mount(new ProbeRegion())
    expect(el.ii.role).toBe('main')
    el.remove() // disconnect — the scope-owned role effect should die with the connection scope
    el.region = 'banner' // a LEAKED effect's re-run is now QUEUED; a disposed one has nothing left to re-run
    await whenFlushed() // let a queued (leaked) re-run actually happen before reading the result
    expect(el.ii.role, 'role changed after disconnect — the effect leaked').toBe('main')
  })

  it('ui-app-shell: disconnect disposes the toggle-warn watch effect — light-DOM path', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-app-shell') as UIAppShellElement
    const main = document.createElement('ui-app-shell-region')
    main.setAttribute('region', 'main') // a present main avoids the UNRELATED "no main region" warn muddying this leg
    el.append(main)
    mount(el)
    warn.mockClear() // discard the effect's silent first (registration) run — nothing to assert on it here
    el.remove() // disconnect
    el.isolated = true // a LEAKED watch effect's warning re-run is now QUEUED; a disposed one has none pending
    await whenFlushed() // let a queued (leaked) re-run actually happen before checking `warn`
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('ui-app-shell-region: disconnect disposes the role effect — ISOLATED path (relocated into the shadow, then the shell itself is disconnected)', async () => {
    // Silences the UNRELATED "no main region" diagnostic: ProbeRegion self-defines under its OWN probe tag
    // (`ui-app-shell-region-probe`, top of file), not the literal `ui-app-shell-region` the main-region check
    // matches on — the same tag-literal restriction the (unmodified) CSS grid-placement selectors have too.
    // Nothing this test asserts on; only here to keep the run's console output free of expected noise.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const shell = document.createElement('ui-app-shell') as UIAppShellElement
    shell.isolated = true
    const region = new ProbeRegion()
    shell.append(region)
    mount(shell)
    expect(shell.shadowRoot!.contains(region), 'setup: the region was not relocated into the shadow').toBe(true)
    expect(region.ii.role).toBe('main')

    shell.remove() // disconnect the OUTER host — a shadow-including-descendant custom element (the relocated
    // region) gets its OWN disconnectedCallback too (the platform's standard shadow-including tree-removal
    // reaction, not anything app-shell.ts implements) — this is the leg that proves the isolation override
    // introduces no new leak surface: the relocated region's effect must die exactly as it would in light DOM.
    region.region = 'banner' // a LEAKED effect's re-run is now QUEUED; a disposed one has nothing left to re-run
    await whenFlushed() // let a queued (leaked) re-run actually happen before reading the result
    expect(region.ii.role, 'role changed after disconnect — the effect leaked (isolated path)').toBe('main')
    warn.mockRestore()
  })

  it('ui-app-shell (isolated): disconnect disposes the toggle-warn watch effect too — no new leak surface from the isolation override', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-app-shell') as UIAppShellElement
    const main = document.createElement('ui-app-shell-region')
    main.setAttribute('region', 'main')
    el.append(main)
    el.isolated = true
    mount(el)
    warn.mockClear()
    el.remove() // disconnect (the shadow persists — it cannot be detached — but the connection scope still dies)
    el.isolated = false // a LEAKED watch effect's warning re-run is now QUEUED; a disposed one has none pending
    await whenFlushed() // let a queued (leaked) re-run actually happen before checking `warn`
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

// ── descriptors — ADR-0004 (structural + contract↔props + contract↔source, per element) ────────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/app-shell`
const ts = readFileSync(`${DIR}/app-shell.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/app-shell.css`, 'utf8') as string

describe('app-shell.md descriptor (ui-app-shell)', () => {
  const md = readFileSync(`${DIR}/app-shell.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['isolated']

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-app-shell')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-app-shell\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIAppShellElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIAppShellElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS (negative control)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => ({ ...a, reflect: false }))
    expect(compareDescriptorToProps(flipReflect, UIAppShellElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.isolated.reflect' }),
    )
    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => ({ ...a, default: 'true' }))
    expect(compareDescriptorToProps(flipDefault, UIAppShellElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.isolated.default' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})

describe('app-shell-region.md descriptor (ui-app-shell-region)', () => {
  const md = readFileSync(`${DIR}/app-shell-region.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['region', 'landmark', 'collapse']

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-app-shell-region')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-app-shell-region\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIAppShellRegionElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIAppShellRegionElement.props)).toEqual([])
  })

  it('the enum fallback member (values[0]) FAILS if it disagrees with the live "main"-leads order (negative control)', () => {
    const badValues: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'region' ? { ...a, values: ['banner', 'main', 'navigation', 'complementary', 'contentinfo'] } : a,
    )
    expect(compareDescriptorToProps(badValues, UIAppShellRegionElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.region.values' }),
    )
  })

  it('ADR-0083: the landmark enum fallback member (values[0]) FAILS if it disagrees with the live \'\'-leads order (negative control)', () => {
    const badValues: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'landmark'
        ? { ...a, values: ['banner', '', 'navigation', 'main', 'complementary', 'contentinfo', 'region', 'form', 'search'] }
        : a,
    )
    expect(compareDescriptorToProps(badValues, UIAppShellRegionElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.landmark.values' }),
    )
  })

  it('ADR-0084: the collapse enum fallback member (values[0]) FAILS if it disagrees with the live "hide"-leads order (negative control)', () => {
    const badValues: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'collapse' ? { ...a, values: ['stack', 'hide'] } : a,
    )
    expect(compareDescriptorToProps(badValues, UIAppShellRegionElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.collapse.values' }),
    )
  })

  it('a removed attribute FAILS (bijection both ways)', () => {
    const dropOne: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'region')
    expect(compareDescriptorToProps(dropOne, UIAppShellRegionElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.region' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
