import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { UITextElement } from './text.ts'
import { signal, effect } from '../../reactive/index.ts'
declare const process: { cwd(): string }

// text-href-security.test.ts — the DEDICATED negative-control file for ui-text's hyperlink capability
// (ADR-0114, SPEC-R8…R12, SPEC-N5; LLD-C1/C2/C4 §8). The fleet's FIRST security-sensitive component
// contract: every `href` value, however it arrives, must pass the fail-closed scheme allowlist
// (`controls/text/href.ts`) before the stamped `<a>` ever carries it. A green suite here is NOT a
// courtesy pass — every denial AC below is paired with an ALLOWED twin through the SAME write path
// (SPEC-R8 AC9, "path liveness"): a passing denial test proves nothing on its own if the path is dead.
//
// The FOUR write paths (SPEC §2 "Write path"), each with its own driver below:
//   P1 attribute — markup-parsed (the HTML parser instantiates + upgrades the element; attributes are
//                  present before `connected()` runs).
//   P2 property  — the JS accessor (`el.href = …`) on an already-connected instance.
//   P3 factory   — the catalog `applyProp` static-prop apply. `controls/text/` cannot import
//                  `@agent-ui/a2ui` (a2ui depends on components, never the reverse — the layering law),
//                  so this reproduces LLD-C13's OWN literal write shape (`el.href = String(value ?? '')`)
//                  verbatim rather than inventing a different one; the write is mechanically identical to
//                  P2 from ui-text's perspective (both land on the reactive prop signal), which is
//                  exactly SPEC-R8's point — every path converges on the same gate.
//   P4 bound     — a `{path}` binding's render-time update. Simulated with a bare `effect()` writing the
//                  accessor from a `signal()` (the documented ADR-0076/ADR-0098 bound-prop-effect shape),
//                  again without pulling in the renderer package.

/** Wait for the reactive scheduler to settle — the ONE shared drain point every write path's effects use. */
const settle = (el: UITextElement): Promise<void> => el.updateComplete

/** The stamped `<a>` — the one place link attributes ever land. */
const stampOf = (el: UITextElement): HTMLAnchorElement | null => el.querySelector('a')

/**
 * The SPEC-R8 AC5 "identical-outcome pin": ONE shared assertion each write path's denial leg calls, so any
 * divergence between paths is a test failure by construction. Also the SPEC-R10 AC1 structural-AT-facts
 * probe: a denied stamp carries no href/rel/target and no role, no aria attribute, no tabindex — the facts
 * HTML-AAM maps to `generic` (plain text, never an announced-broken link).
 */
function expectDenied(el: UITextElement, label: string): void {
  const a = stampOf(el)
  expect(a, `${label}: stamp <a> is missing`).not.toBeNull()
  expect(a?.hasAttribute('href'), `${label}: href present on a denied stamp`).toBe(false)
  expect(a?.hasAttribute('rel'), `${label}: rel present on a denied stamp`).toBe(false)
  expect(a?.hasAttribute('target'), `${label}: target present on a denied stamp`).toBe(false)
  expect(a?.hasAttribute('role'), `${label}: role present on a denied stamp`).toBe(false)
  expect(a?.hasAttribute('tabindex'), `${label}: tabindex present on a denied stamp`).toBe(false)
  expect(a?.getAttributeNames().some((n) => n.startsWith('aria-')), `${label}: aria-* present on a denied stamp`).toBe(false)
  expect(a?.matches(':any-link'), `${label}: a denied stamp matches :any-link`).toBe(false)
}

/** The allowed twin — byte-identical href (the gate NEVER rewrites) + the fixed rel/target policy. */
function expectAllowed(el: UITextElement, raw: string, label: string): void {
  const a = stampOf(el)
  expect(a, `${label}: stamp <a> is missing`).not.toBeNull()
  expect(a?.getAttribute('href'), `${label}: href not byte-identical`).toBe(raw)
  expect(a?.getAttribute('rel'), `${label}: rel mismatch`).toBe('noopener noreferrer')
  expect(a?.getAttribute('target'), `${label}: target mismatch`).toBe('_blank')
}

// ── the four write-path drivers ─────────────────────────────────────────────────────────────────────────

/** P1 — attribute, parsed from markup (a connected container's innerHTML triggers real HTML parsing). */
async function viaAttribute(href: string): Promise<UITextElement> {
  const container = document.createElement('div')
  document.body.append(container)
  const esc = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  container.innerHTML = `<ui-text as="a" href="${esc}">x</ui-text>`
  const el = container.querySelector('ui-text') as UITextElement
  await settle(el)
  return el
}

/** P2 — property, the JS accessor on an already-connected instance. */
async function viaProperty(href: string): Promise<UITextElement> {
  const el = document.createElement('ui-text') as UITextElement
  el.as = 'a'
  document.body.append(el)
  await settle(el)
  el.href = href
  await settle(el)
  return el
}

/** P3 — factory, simulating LLD-C13's OWN documented write shape (`el.href = String(value ?? '')`);
 *  see the file header for why this file cannot import the real `textFactory`. */
async function viaFactorySim(href: string): Promise<UITextElement> {
  const el = document.createElement('ui-text') as UITextElement
  el.as = 'a'
  document.body.append(el)
  await settle(el)
  el.href = String(href ?? '')
  await settle(el)
  return el
}

/** P4 — bound, a `{path}` binding's render-time update via a bare reactive effect (the documented
 *  ADR-0076/ADR-0098 bound-prop-effect shape) writing the accessor from a data-model signal. */
async function viaBound(href: string): Promise<UITextElement> {
  const el = document.createElement('ui-text') as UITextElement
  el.as = 'a'
  document.body.append(el)
  await settle(el)
  const model = signal(href)
  effect(() => {
    el.href = model.value
  })
  await settle(el)
  return el
}

const PATHS = [
  { name: 'P1 attribute', via: viaAttribute },
  { name: 'P2 property', via: viaProperty },
  { name: 'P3 factory', via: viaFactorySim },
  { name: 'P4 bound', via: viaBound },
] as const

const DENIED_TWIN = 'javascript:alert(1)'
const ALLOWED_TWIN = 'https://example.com'

describe('ui-text href security — denial + the allowed twin, through EVERY write path (SPEC-R8 AC1–AC5, AC9)', () => {
  for (const { name, via } of PATHS) {
    it(`${name}: a javascript: href is DENIED (no href/rel/target; not :any-link)`, async () => {
      const el = await via(DENIED_TWIN)
      expectDenied(el, name)
      el.remove()
    })

    it(`${name}: the allowed twin (https://example.com) lands byte-identical with rel/target (path liveness)`, async () => {
      const el = await via(ALLOWED_TWIN)
      expectAllowed(el, ALLOWED_TWIN, name)
      el.remove()
    })
  }
})

describe('ui-text href security — the full scheme matrix, via P2 (SPEC-R8 AC6)', () => {
  const DENIED = [
    'data:text/html,<script>alert(1)</script>',
    'blob:https://example.com/x',
    'file:///etc/passwd',
    'vbscript:x',
    'foo:bar',
    ' javascript:alert(1)', // leading whitespace
    'JAVASCRIPT:alert(1)', // case smuggling
    'java\nscript:alert(1)', // embedded newline smuggling
    'http://[', // unparseable
  ]
  const ALLOWED = [
    'https://example.com',
    'http://intranet.local/x',
    'mailto:a@b.example',
    'docs/page', // relative — resolves against document.baseURI
    '//example.com/x', // protocol-relative
  ]

  for (const href of DENIED) {
    it(`denies ${JSON.stringify(href)}`, async () => {
      const el = await viaProperty(href)
      expectDenied(el, href)
      el.remove()
    })
  }

  for (const href of ALLOWED) {
    it(`allows ${JSON.stringify(href)} byte-identical`, async () => {
      const el = await viaProperty(href)
      expectAllowed(el, href, href)
      el.remove()
    })
  }
})

describe('ui-text href security — no destination ≠ denied (SPEC-R8 AC7, the self-link trap)', () => {
  it('href="" (the default) stamps no href — never a self-link to document.baseURI', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.as = 'a'
    document.body.append(el)
    await settle(el)
    expectDenied(el, 'href=""') // same rendered state as denial, reached without a violation
    el.remove()
  })

  it('href="   " (whitespace-only) also stamps no href', async () => {
    const el = await viaProperty('   ')
    expectDenied(el, 'href="   "')
    el.remove()
  })
})

describe('ui-text href security — clobber survival (SPEC-R8 AC8)', () => {
  it('a bound-text textContent clobber re-stamps with the gated href intact', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.as = 'a'
    el.href = ALLOWED_TWIN
    el.textContent = 'Source'
    document.body.append(el)
    await settle(el)
    expectAllowed(el, ALLOWED_TWIN, 'before clobber')
    const before = stampOf(el)

    el.textContent = 'Replaced' // destroys every child, stamp included — the A2UI bound-text path
    await settle(el)
    await settle(el) // the heal observer's microtask + the settle it triggers

    const after = stampOf(el)
    expect(after, 'a fresh stamp exists after the clobber').not.toBeNull()
    expect(after).not.toBe(before) // never reused — the stale stamp held stale content
    expectAllowed(el, ALLOWED_TWIN, 'after clobber')
    expect(after?.textContent).toBe('Replaced')
    el.remove()
  })

  it('a DENIED href also survives a clobber — still denied, never silently promoted to allowed', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.as = 'a'
    el.href = DENIED_TWIN
    el.textContent = 'Source'
    document.body.append(el)
    await settle(el)
    expectDenied(el, 'before clobber')

    el.textContent = 'Replaced'
    await settle(el)
    await settle(el)

    expectDenied(el, 'after clobber')
    el.remove()
  })
})

describe('ui-text href security — host-attribute inertness (SPEC-R9 AC1)', () => {
  it('the HOST reflects the raw value honestly, but never matches :any-link — even when denied', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.as = 'a'
    el.href = DENIED_TWIN
    document.body.append(el)
    await settle(el)
    expect(el.getAttribute('href'), 'reflection must be HONEST — the raw, unsanitized value').toBe(DENIED_TWIN)
    expect(el.matches(':any-link'), 'a custom element host is never in the :any-link grammar').toBe(false)
    el.remove()
  })

  it('the HOST never matches :any-link even when ALLOWED — only the gated stamp ever carries a live href', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.as = 'a'
    el.href = ALLOWED_TWIN
    document.body.append(el)
    await settle(el)
    expect(el.getAttribute('href')).toBe(ALLOWED_TWIN)
    expect(el.matches(':any-link')).toBe(false)
    el.remove()
  })
})

describe('ui-text href security — href is inert without as="a" (SPEC-R7 AC2)', () => {
  it('a non-anchor stamp never carries href/rel/target, allowed value or not', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.as = 'p'
    el.href = ALLOWED_TWIN
    document.body.append(el)
    await settle(el)
    const p = el.querySelector('p')
    expect(p?.hasAttribute('href')).toBe(false)
    expect(p?.hasAttribute('rel')).toBe(false)
    expect(p?.hasAttribute('target')).toBe(false)
    el.remove()
  })
})

describe('ui-text href security — the one-writer invariant (LLD-C2, grep-able)', () => {
  it("setAttribute('href' appears EXACTLY ONCE in text.ts — inside #syncLink, the SOLE writer", () => {
    const source = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/text/text.ts`, 'utf8') as string
    const matches = source.match(/setAttribute\('href'/g) ?? []
    expect(matches.length).toBe(1)
    const idx = source.indexOf("setAttribute('href'")
    const syncLinkIdx = source.indexOf('#syncLink(): void')
    const nextMethodIdx = source.indexOf('#heal(): void')
    expect(idx, 'the single setAttribute(\'href\' call must live inside #syncLink').toBeGreaterThan(syncLinkIdx)
    expect(idx).toBeLessThan(nextMethodIdx)
  })
})

// Booked, not shipped (LLD §8 / ADR-0114 Acceptance b): a build-wave ONE-TIME manual check — temporarily
// short-circuit safeHref to always return `raw` and confirm the P1 denial leg above FAILS, proving the
// last line is load-bearing independent of the (not-yet-built) catalog validator. Not a standing test: a
// permanently-bypassed gate would defeat its own proof by construction.
