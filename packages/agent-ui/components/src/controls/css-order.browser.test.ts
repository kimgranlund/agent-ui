// css-order.browser.test.ts: the ADR-0233 order proof. The host contract is foundation, then
// `shared-styles.css` (the `_surface/` and `_chart/` seams, once), then the control sheets in ANY order, each
// self-contained through its `uses` prologue. This test links the fleet's control sheets in canonical (sorted)
// order and in three fixed-seed shuffles (foundation and seams always first), renders one specimen per fleet
// tag, and requires every snapshot to be equal: every computed property of each specimen subtree (elements,
// `::before` and `::after`) plus every custom property any loaded sheet declares. Real engines only (chromium
// and webkit via the `packages` project): jsdom computes no cascade.
//
// The foundation is linked as shared's `tokens.css` then `dimensions.css`, because `foundation-styles.css`
// carries bare package imports a `<link>` cannot resolve (`release-facts.md`, the CDN recipe). Vite dev serves
// a direct stylesheet request as CSS, so each `?url` link exercises the sheet's own relative imports.
//
// The negative control proves the snapshot can see source order: two inline `<style>` elements the test
// creates set the same custom property on `:where(ui-order-probe)` and, inserted in swapped order, must give
// different snapshots.

import { describe, it, expect, afterAll } from 'vitest'
import tokensUrl from '@agent-ui/shared/tokens.css?url'
import dimensionsUrl from '@agent-ui/shared/dimensions.css?url'
import sharedStylesUrl from '../shared-styles.css?url'
import { fleetFromDescriptors } from '../descriptor/control-graph.ts'

// Every fleet sheet (never a `_` seam: those load once, through `shared-styles.css`).
const SHEETS = import.meta.glob('./*/*.css', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const CONTROL_SHEETS: string[] = Object.keys(SHEETS)
  .filter((k) => !k.startsWith('./_'))
  .sort()
  .map((k) => SHEETS[k])

// The fleet's definitions: every control-folder module except tests, generated props and `_` folders (never
// the barrel, which sits one level up). Importing them self-defines every fleet tag.
const MODULES = import.meta.glob(['./*/*.ts', '!./*/*.test.ts', '!./*/*.props.gen.ts', '!./_*/*.ts'], { eager: true }) as Record<
  string,
  Record<string, unknown>
>

// The fleet's tags: each descriptor's `tag:` (the shared `fleetFromDescriptors` reader), plus any other tag a
// fleet module defines (a region or item element without its own descriptor).
const DESCRIPTORS = import.meta.glob('./*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const DESCRIPTOR_TAGS = fleetFromDescriptors(
  Object.keys(DESCRIPTORS).map((k) => k.slice(2)),
  (p) => DESCRIPTORS[`./${p}`],
).map((e) => e.tag)
const getName = (customElements as CustomElementRegistry & { getName?: (c: CustomElementConstructor) => string | null }).getName
const MODULE_TAGS = Object.values(MODULES).flatMap((mod) =>
  Object.values(mod).flatMap((v) => {
    if (typeof v !== 'function' || getName === undefined) return []
    const name = getName.call(customElements, v as CustomElementConstructor)
    return name === null || !name.startsWith('ui-') ? [] : [name]
  }),
)
const FLEET_TAGS = [...new Set([...DESCRIPTOR_TAGS, ...MODULE_TAGS])].sort()

/** Deterministic PRNG (mulberry32) for the fixed-seed shuffles. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(list: readonly T[], seed: number): T[] {
  const out = [...list]
  const rand = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Append one `<link>` per url, in order, and resolve once every one has loaded (with its imports). */
async function link(urls: readonly string[]): Promise<HTMLLinkElement[]> {
  const links = urls.map((href) => {
    const el = document.createElement('link')
    el.rel = 'stylesheet'
    el.href = href
    return el
  })
  const loaded = links.map(
    (el) =>
      new Promise<void>((resolve, reject) => {
        el.addEventListener('load', () => resolve(), { once: true })
        el.addEventListener('error', () => reject(new Error(`stylesheet failed to load: ${el.href}`)), { once: true })
      }),
  )
  document.head.append(...links)
  await Promise.all(loaded)
  return links
}

let current: HTMLLinkElement[] = []
/** Swap the linked set to `urls` with no unstyled gap: the new links load before the old ones go. */
async function relink(urls: readonly string[]): Promise<void> {
  const next = await link(urls)
  for (const el of current) el.remove()
  current = next
}

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))
/** Let fonts, layout and any observer-driven writes settle, then freeze every animation at its start. */
async function settle(): Promise<void> {
  await document.fonts.ready
  for (let i = 0; i < 3; i++) await frame()
  for (const a of document.getAnimations()) {
    a.pause()
    a.currentTime = 0
  }
  await frame()
}

/** Every custom property any loaded sheet declares, walking imported sheets and nested rules. */
function declaredCustomProperties(): string[] {
  const names = new Set<string>()
  const visit = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSImportRule) {
        if (rule.styleSheet) visit(rule.styleSheet.cssRules)
        continue
      }
      if (typeof CSSPropertyRule !== 'undefined' && rule instanceof CSSPropertyRule) names.add(rule.name)
      const style = (rule as CSSRule & { style?: CSSStyleDeclaration }).style
      if (style) {
        for (let i = 0; i < style.length; i++) {
          const name = style.item(i)
          if (name.startsWith('--')) names.add(name)
        }
      }
      const nested = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules
      if (nested) visit(nested)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) visit(sheet.cssRules)
  return [...names].sort()
}

type Snapshot = Map<string, string>

/** Serialize one element's (or pseudo-element's) computed style: every enumerated property, then the declared
 *  custom properties. */
function serialize(el: Element, pseudo: string | null, custom: readonly string[]): string {
  const cs = getComputedStyle(el, pseudo)
  const parts: string[] = []
  for (let i = 0; i < cs.length; i++) parts.push(`${cs[i]}:${cs.getPropertyValue(cs[i]).trim()}`)
  for (const name of custom) parts.push(`${name}:${cs.getPropertyValue(name).trim()}`)
  return parts.join(';')
}

/** The snapshot of `roots`' subtrees plus the document element, keyed by a stable node path. */
function snapshot(roots: readonly Element[]): Snapshot {
  const custom = declaredCustomProperties()
  const out: Snapshot = new Map()
  out.set('html', serialize(document.documentElement, null, custom))
  for (const root of roots) {
    const walk = (el: Element, path: string): void => {
      out.set(path, serialize(el, null, custom))
      out.set(`${path}::before`, serialize(el, '::before', custom))
      out.set(`${path}::after`, serialize(el, '::after', custom))
      Array.from(el.children).forEach((child, i) => walk(child, `${path}>${i}:${child.localName}`))
    }
    walk(root, root.localName)
  }
  return out
}

/** The first `limit` differences between two snapshots, as `node | property: a -> b` lines. */
function differences(a: Snapshot, b: Snapshot, limit = 12): string[] {
  const out: string[] = []
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(key)
    const y = b.get(key)
    if (x === y) continue
    if (x === undefined || y === undefined) {
      out.push(`${key} | ${x === undefined ? 'missing in the first' : 'missing in the second'}`)
    } else {
      const xs = new Map(x.split(';').map((p) => [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)] as const))
      const ys = new Map(y.split(';').map((p) => [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)] as const))
      for (const prop of new Set([...xs.keys(), ...ys.keys()])) {
        if (xs.get(prop) !== ys.get(prop)) out.push(`${key} | ${prop}: ${xs.get(prop)} -> ${ys.get(prop)}`)
        if (out.length >= limit) return out
      }
    }
    if (out.length >= limit) return out
  }
  return out
}

/** One specimen per tag, bare except where a control's contract requires more: an overlay throws without a
 *  trigger or anchor as its first child, and a toast auto-dismisses (leaves the DOM) unless its duration is 0. */
function specimen(tag: string): HTMLElement {
  const el = document.createElement(tag)
  if (tag === 'ui-popover' || tag === 'ui-menu' || tag === 'ui-tooltip') {
    const trigger = document.createElement('button')
    trigger.textContent = 'Trigger'
    el.append(trigger)
  }
  if (tag === 'ui-toast') el.setAttribute('duration', '0')
  return el
}

const host = document.createElement('div')
afterAll(() => {
  host.remove()
  for (const el of current) el.remove()
  current = []
})

describe('css-order: the control-sheet order is free (canonical vs three fixed-seed shuffles)', () => {
  const SEEDS = [0x5eed1, 0x5eed2, 0x5eed3]
  const lead = [tokensUrl, dimensionsUrl, sharedStylesUrl]

  it('anti-vacuous: the fleet, its sheets and its modules are discovered, and every fleet tag is defined', () => {
    expect(CONTROL_SHEETS.length).toBeGreaterThan(50)
    expect(Object.keys(MODULES).length).toBeGreaterThan(50)
    expect(Object.keys(MODULES).some((k) => k.endsWith('index.ts'))).toBe(false)
    expect(DESCRIPTOR_TAGS.length).toBeGreaterThan(50)
    for (const tag of FLEET_TAGS) expect(customElements.get(tag), `${tag} is not defined`).not.toBeUndefined()
    for (const seed of SEEDS) expect(shuffled(CONTROL_SHEETS, seed)).not.toEqual(CONTROL_SHEETS)
  })

  it('every shuffled order gives the same computed styles as the canonical order', { timeout: 300_000 }, async () => {
    await relink([...lead, ...CONTROL_SHEETS])
    document.body.append(host)
    const specimens = FLEET_TAGS.map(specimen)
    host.append(...specimens)
    await settle()
    const canonical = snapshot(specimens)

    // Non-trivial: the snapshot covers every specimen, sees the declared custom properties, and resolves the
    // one proven order dependence (card's `--ui-container-bg` seed over the container seam) to a real value.
    expect(canonical.size).toBeGreaterThan(FLEET_TAGS.length * 3)
    expect(declaredCustomProperties().length).toBeGreaterThan(500)
    const card = specimens[FLEET_TAGS.indexOf('ui-card')]
    expect(getComputedStyle(card).getPropertyValue('--ui-container-bg').trim()).not.toBe('')
    expect(getComputedStyle(card).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

    for (const seed of SEEDS) {
      await relink([...lead, ...shuffled(CONTROL_SHEETS, seed)])
      await settle()
      expect(differences(canonical, snapshot(specimens)), `seed ${seed.toString(16)}`).toEqual([])
    }

    // Stability control: canonical again equals the first canonical, so an equal result above is about order,
    // never timing.
    await relink([...lead, ...CONTROL_SHEETS])
    await settle()
    expect(differences(canonical, snapshot(specimens)), 'canonical re-run').toEqual([])
  })

  it('negative control: two inline sheets setting one custom property, swapped, give different snapshots', async () => {
    const probe = document.createElement('ui-order-probe')
    document.body.append(probe)
    const style = (value: string): HTMLStyleElement => {
      const el = document.createElement('style')
      el.textContent = `:where(ui-order-probe) { --ui-order-probe-value: ${value}; }`
      return el
    }
    const take = async (first: string, second: string): Promise<Snapshot> => {
      const sheets = [style(first), style(second)]
      document.head.append(...sheets)
      await settle()
      const snap = snapshot([probe])
      for (const el of sheets) el.remove()
      return snap
    }
    const ab = await take('a', 'b')
    const ba = await take('b', 'a')
    probe.remove()
    expect(ab.get('ui-order-probe')).toContain('--ui-order-probe-value:b')
    expect(ba.get('ui-order-probe')).toContain('--ui-order-probe-value:a')
    // The probe and its pseudo-elements (which inherit the property) differ, and in nothing else.
    const diffs = differences(ab, ba)
    expect(diffs).toContain('ui-order-probe | --ui-order-probe-value: b -> a')
    expect(diffs.filter((d) => !d.endsWith('| --ui-order-probe-value: b -> a'))).toEqual([])
  })
})
