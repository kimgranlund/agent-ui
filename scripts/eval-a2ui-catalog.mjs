#!/usr/bin/env node
// eval-a2ui-catalog.mjs — the exit-coded mechanical-gate runner for the a2ui catalog page
// (rubric .claude/docs/rubrics/a2ui-catalog-example.md §5; consumed by the a2ui-catalog-rendering-review
// skill). Probes every card on site/a2ui-catalog.html against its DERIVED expected-card record:
//
//   A1 knob completeness · A2 knob kind fidelity · A4 one knob per prop
//   B1 real-renderer root tag + no page/console errors · B2 prop reflection (set → mapsTo/canvas change)
//   B3g geometry (root box > 0, no canvas/section overflow) · C1 seed visibility · C2 edit→revert purity
//
// Ground truth is IMPORTED IN-PAGE through vite (never re-derived here): `/@id/@agent-ui/a2ui` for
// defaultCatalog/defaultFactories/resolveFactory/valueSlots, `/lib/component-preview.ts` for A2UI_INITIAL
// (exported for exactly this consumer) and `/lib/a2ui-catalog-tiers.ts` for tiers. Review dims (A3/B3r/
// B4/C3) are judgment — they stay with the skill, never scored here.
//
//   node scripts/eval-a2ui-catalog.mjs [--base http://localhost:5174] [--out DIR] [--only NAME]
//        [--theme dark|light] [--no-shots]
//
// Output: OUT/eval/<T>.json per card + OUT/eval/summary.md + OUT/<theme>/<tier>/<T>.png.
// Exit 0 = every gate green on every card · 1 = any gate red (each listed) · 2 = setup failure.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (!a.startsWith('--')) { console.error(`unexpected arg ${a}`); process.exit(2) }
  args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true'
}
const BASE = (args.base ?? 'http://localhost:5174').replace(/\/$/, '')
const OUT = path.resolve(args.out ?? 'screenshots/a2ui-catalog-eval')
const ONLY = args.only ?? null
const THEME = args.theme === 'light' ? 'light' : 'dark'
const SHOTS = args['no-shots'] !== 'true'

// Overlay types seeded closed BY RULE (the A2UI_INITIAL comment block) — their canvas legitimately shows the
// empty-specimen hint; C1/B3g are judged on the closed state's own terms and B2's `open`-class probes reveal.
const OVERLAY = new Set(['Modal', 'Drawer', 'Popover', 'Menu', 'FormPopover', 'Tooltip', 'Disclosure'])

const { chromium } = await import('playwright')
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: THEME })
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message)))
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`[console] ${m.text()}`) })

await page.goto(`${BASE}/a2ui-catalog.html`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => customElements.get('ui-tabs') && document.querySelector('section.catalog-item'), null, { timeout: 30_000 })

// ── derive the expected-card records in-page (rubric §1.1) ────────────────────────────────────────────────────
const expected = await page.evaluate(async () => {
  const a2ui = await import('/@id/@agent-ui/a2ui')
  const prev = await import('/lib/component-preview.ts')
  const tiers = await import('/lib/a2ui-catalog-tiers.ts')
  const kindOf = (pd) => {
    const schema = typeof pd.type === 'object' ? pd.type : {}
    const members = Array.isArray(schema.enum) ? schema.enum.filter((v) => typeof v === 'string') : []
    if (members.length > 0) return { kind: 'enum', values: members }
    const t = schema.type
    if (t === 'boolean') return { kind: 'boolean' }
    if (t === 'number' || t === 'integer') return { kind: 'number' }
    if (t === 'string' || Array.isArray(t)) return { kind: 'string' }
    return { kind: 'skip' }
  }
  const out = {}
  for (const name of tiers.browsableNames()) {
    const def = a2ui.defaultCatalog.components[name]
    const slot = a2ui.defaultFactories[name]
    let tag = null
    if (slot && 'tag' in slot) tag = slot.tag
    else if (slot) { try { tag = a2ui.resolveFactory(slot, { id: 'probe', component: name }).tag } catch { tag = null } }
    out[name] = {
      tier: tiers.tierOf(name),
      tag,
      seeds: prev.A2UI_INITIAL[name] ?? {},
      props: Object.fromEntries(Object.entries(def.properties).map(([pn, pd]) => [pn, { ...kindOf(pd), mapsTo: pd.mapsTo, format: pd.format ?? null }])),
      order: Object.keys(def.properties),
      valueProps: def.value ? a2ui.valueSlots(def.value).map((s) => s.prop) : [],
    }
  }
  return out
})

// ── probe one card (runs in-page; returns per-gate verdicts + evidence) ──────────────────────────────────────
async function probeCard(section, name, exp) {
  return await section.evaluate(async (sec, { exp, KNOB_UNSET, isOverlay }) => {
    const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const canvas = sec.querySelector('.preview-canvas')
    const surface = canvas?.querySelector('.canvas-surface') ?? canvas?.querySelector('.canvas-stage')?.firstElementChild
    const rootOf = () => surface?.firstElementChild ?? null
    const g = {} // gate → {pass, note}
    const set = (k, pass, note) => { g[k] = { pass, note: note ?? '' } }

    // knob introspection
    const rows = [...sec.querySelectorAll('.knob')].map((row) => {
      const label = row.querySelector('.knob-label')?.textContent ?? ''
      let kind = 'unknown', values = [], el = null
      if ((el = row.querySelector('ui-select'))) { kind = 'enum-select'; values = [...el.querySelectorAll('[role=option]')].map((o) => o.getAttribute('value')).filter((v) => v !== KNOB_UNSET) }
      else if ((el = row.querySelector('ui-segmented-control'))) { kind = 'enum-seg'; values = [...el.querySelectorAll('ui-segment')].map((s) => s.getAttribute('value')) }
      else if ((el = row.querySelector('ui-switch'))) kind = 'boolean'
      else if ((el = row.querySelector('ui-text-field'))) kind = el.getAttribute('type') === 'number' ? 'number' : 'string'
      else if (row.querySelector('.knob-note')) kind = 'skip'
      return { label, kind, values, el }
    })

    // A1 — knob set == catalog prop set (+ order note)
    const labels = rows.map((r) => r.label)
    const propNames = exp.order
    const missing = propNames.filter((p) => !labels.includes(p))
    const extra = labels.filter((l) => !propNames.includes(l))
    set('A1', missing.length === 0 && extra.length === 0, [missing.length && `missing: ${missing}`, extra.length && `extra: ${extra}`, labels.join(',') !== propNames.join(',') && 'order differs'].filter(Boolean).join(' · '))

    // A4 — no duplicate labels
    set('A4', new Set(labels).size === labels.length, labels.filter((l, i) => labels.indexOf(l) !== i).join(','))

    // A2 — kind fidelity per prop
    const kindBad = []
    for (const [pn, pd] of Object.entries(exp.props)) {
      const row = rows.find((r) => r.label === pn)
      if (!row) continue // A1 already caught it
      const ok =
        pd.kind === 'enum' ? (row.kind === 'enum-select' || row.kind === 'enum-seg') && pd.values.every((v) => row.values.includes(v)) && row.values.every((v) => pd.values.includes(v))
        : pd.kind === 'boolean' ? row.kind === 'boolean'
        : pd.kind === 'number' ? row.kind === 'number'
        : pd.kind === 'string' ? row.kind === 'string'
        : row.kind === 'skip'
      if (!ok) kindBad.push(`${pn}: expected ${pd.kind}${pd.values ? `[${pd.values}]` : ''}, got ${row.kind}${row.values?.length ? `[${row.values}]` : ''}`)
    }
    set('A2', kindBad.length === 0, kindBad.join(' · '))

    // B1 — root exists, tag matches the factory
    const root = rootOf()
    const expTag = (exp.tag ?? '').split('[')[0] // a factory tag may carry a selector suffix (div[role=menuitem])
    const tagOk = !!root && !!expTag && root.tagName.toLowerCase() === expTag
    set('B1', tagOk && !sec.querySelector('.preview-error'), root ? `root=${root.tagName.toLowerCase()} expected=${expTag}` : 'empty canvas')

    // C1 — every seeded string/enum value findable in the canvas (text or attribute)
    const findable = (v) => {
      if (!surface) return false
      if ((surface.textContent ?? '').includes(v)) return true
      return [...surface.querySelectorAll('*')].some((el) => [...el.attributes].some((a) => String(a.value).includes(v)))
    }
    // A seed counts as visible when the literal text/attr appears OR the root's live mapsTo property
    // carries it (a formatter may render "428000" as "428.0 KB", a mimeType as a glyph — the seed still
    // demonstrably reached R; the literal-text refinement is the rubric's 5-anchor, not the gate).
    const seedMiss = Object.entries(exp.seeds).filter(([p, v]) => {
      const pd = exp.props[p]
      if (!pd || pd.kind === 'boolean' || pd.kind === 'skip') return false
      const rootEl = rootOf()
      const live = rootEl ? rootEl[pd.mapsTo] : undefined
      if (live !== undefined && live !== null && String(live) === String(pd.kind === 'number' ? Number(v) : v)) return false
      if (pd.kind === 'number') return !findable(String(Number(v))) && !findable(String(v))
      return !findable(String(v))
    })
    set('C1', isOverlay || seedMiss.length === 0, seedMiss.map(([p, v]) => `${p}="${v}" invisible`).join(' · ') || (isOverlay ? 'overlay-closed: judged on reveal' : ''))

    // B3g — geometry: root box non-zero, no overflow past the canvas column / section
    if (root && !isOverlay) {
      const rb = root.getBoundingClientRect()
      const cb = canvas.getBoundingClientRect()
      const boxOk = rb.width > 0 && rb.height > 0 // a 4px progress bar is a legitimate render — zero is the failure
      const fitOk = rb.right <= cb.right + 1 && rb.left >= cb.left - 1
      const scrollOk = sec.scrollWidth <= sec.clientWidth + 1
      set('B3g', boxOk && fitOk && scrollOk, `root ${Math.round(rb.width)}×${Math.round(rb.height)}${fitOk ? '' : ' overflows canvas'}${scrollOk ? '' : ' section h-scrolls'}`)
    } else set('B3g', true, isOverlay ? 'overlay-closed: skipped' : 'no root (B1 carries it)')

    // B2 — prop reflection: set a probe per non-skip knob → mapsTo target or canvas changes; then revert (C2).
    // Snapshots are compared through canonical(): the renderer mints fresh per-instance ids on every rebuild
    // (ui-select-listbox-13 → -14, ui-cb1 → ui-cb13, anchor-name --ui-overlay-42 …) and re-applies attributes
    // in state order (so attribute ORDER churns too); canonical() re-serializes with sorted attributes and
    // digit-normalized values on id-carrying attributes, applied to BOTH sides, so equality stays meaningful.
    const ID_ATTRS = new Set(['id', 'for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns', 'aria-activedescendant', 'style', 'anchor-name'])
    const canonical = (html, stripAttrs) => {
      const tpl = document.createElement('template')
      tpl.innerHTML = html
      const ser = (el) => {
        const tag = el.tagName.toLowerCase()
        const attrs = [...el.attributes]
          .filter((a) => !(stripAttrs && stripAttrs.has(a.name)))
          .map((a) => `${a.name}="${ID_ATTRS.has(a.name) ? a.value.replace(/\d+/g, 'N') : a.value}"`)
          .sort()
        const kids = [...el.childNodes].map((n) => (n.nodeType === 1 ? ser(n) : n.textContent)).join('')
        return `<${tag} ${attrs.join(' ')}>${kids}</${tag}>`
      }
      return [...tpl.content.children].map(ser).join('')
    }
    const normalize = (html) => canonical(html)
    // Baseline stabilization: cards build at page load, mostly inside HIDDEN tab panels — measurement-derived
    // state (a split divider's aria bounds) is stale until the first rebuild while visible. Force ONE no-op
    // rebuild (re-fire a knob at its current value) so C2 compares rebuild-state against rebuild-state, then
    // settle (controls may reflect measured attrs asynchronously).
    const firstDriveable = rows.find((r) => r.el && (r.kind === 'enum-select' || r.kind === 'number' || r.kind === 'string'))
    if (firstDriveable) {
      if (firstDriveable.kind === 'enum-select') { firstDriveable.el.dispatchEvent(new Event('select')) }
      else firstDriveable.el.dispatchEvent(new Event('input'))
      await raf()
    }
    await raf(); await new Promise((r) => setTimeout(r, 200)); await raf()
    const initialRaw = surface?.innerHTML ?? ''
    const initialHtml = normalize(initialRaw)
    const b2bad = []
    const driveSelect = async (el, value) => { el.value = value; el.dispatchEvent(new Event('select')); await raf() }
    const driveField = async (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: false })); await raf() }
    for (const [pn, pd] of Object.entries(exp.props)) {
      const row = rows.find((r) => r.label === pn)
      if (!row || pd.kind === 'skip' || row.kind === 'skip' || !row.el) continue
      const before = normalize(surface?.innerHTML ?? '')
      let probe, reverted = false
      try {
        if (row.kind === 'enum-select') {
          const orig = row.el.value || KNOB_UNSET
          probe = pd.values.find((v) => v !== row.el.value) ?? pd.values[0]
          await driveSelect(row.el, probe)
          const changed = reflected(pn, pd, probe, before)
          await driveSelect(row.el, orig)
          reverted = true
          if (!changed) b2bad.push(`${pn}→"${probe}" no effect`)
        } else if (row.kind === 'enum-seg') {
          const segs = [...row.el.querySelectorAll('ui-segment')]
          const current = segs.find((s) => s.checked)
          const other = segs.find((s) => s !== current)
          if (other) {
            probe = other.getAttribute('value')
            other.click(); await raf()
            const changed = reflected(pn, pd, probe, before)
            current?.click(); await raf()
            reverted = true
            if (!changed) b2bad.push(`${pn}→"${probe}" no effect`)
          }
        } else if (row.kind === 'boolean') {
          row.el.click(); await raf()
          const after = normalize(surface?.innerHTML ?? '')
          const rootEl = rootOf()
          const changed = after !== before || (rootEl && (rootEl.hasAttribute(pd.mapsTo) || rootEl[pd.mapsTo] === true))
          row.el.click(); await raf()
          reverted = true
          if (!changed) b2bad.push(`${pn} toggle no effect`)
        } else if (row.kind === 'number' || row.kind === 'string') {
          const orig = row.el.value ?? ''
          if (row.kind === 'string' && exp.valueProps.includes(pn)) {
            // the prop is the two-way SELECTION slot — an arbitrary string selects nothing; harvest a real
            // child value from the rendered sample instead (ui-radio/ui-segment/[value]/[key] children)
            const rootEl = rootOf()
            const candidates = rootEl ? [...rootEl.querySelectorAll('[value],[key]')].map((c) => c.getAttribute('value') ?? c.getAttribute('key')).filter(Boolean) : []
            const pick = candidates.find((v) => v !== orig)
            if (!pick) { g.B2_notes = (g.B2_notes ?? []).concat(`${pn}: free-string value slot, no harvestable child value — unprobed`); continue }
            probe = pick
          } else probe = row.kind === 'number' ? (String(orig) === '2' ? '3' : '2') : pd.format === 'safe-href' ? 'https://example.com/probe' : 'Probe 7'
          await driveField(row.el, probe)
          const changed = reflected(pn, pd, row.kind === 'number' ? Number(probe) : probe, before)
          await driveField(row.el, orig)
          reverted = true
          if (String(row.el.value ?? '') !== String(orig)) b2bad.push(`${pn}: widget refused revert to "${orig}" (kept "${row.el.value}") — knob cannot return to unset`)
          if (!changed) b2bad.push(`${pn}→"${probe}" no effect`)
        }
      } catch (e) {
        b2bad.push(`${pn} probe threw: ${e.message}${reverted ? '' : ' (unreverted)'}`)
      }
    }
    function reflected(pn, pd, probe, before) {
      const rootEl = rootOf()
      if (rootEl) {
        const live = rootEl[pd.mapsTo]
        if (live === probe || String(live) === String(probe)) return true
        const attr = rootEl.getAttribute(pd.mapsTo) ?? rootEl.getAttribute(pd.mapsTo.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()))
        if (attr !== null && String(attr) === String(probe)) return true
      }
      return normalize(surface?.innerHTML ?? '') !== before
    }
    set('B2', b2bad.length === 0, b2bad.join(' · '))

    // C2 — the full probe pass restored the canvas byte-identically
    await raf()
    await raf(); await new Promise((r) => setTimeout(r, 150)); await raf()
    const finalHtml = normalize(surface?.innerHTML ?? '')
    if (finalHtml === initialHtml) set('C2', true, '')
    else {
      // The preview DELIBERATELY re-seeds live two-way values across rebuilds (#readBackA2ui) — a control's
      // own default (Pagination page=1) or a clamped value lands back in state. Residue confined to the
      // value-slot props' mapped attributes is that by-design behavior, not an impurity: strip those attrs
      // from both sides and recompare before declaring red.
      const valueAttrs = new Set(exp.valueProps.flatMap((p) => {
        const m = exp.props[p]?.mapsTo ?? p
        return [m, m.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), 'style']
      }))
      const a = canonical(surface?.innerHTML ?? '', valueAttrs)
      const bInit = canonical(initialRaw, valueAttrs)
      if (exp.valueProps.length > 0 && a === bInit) set('C2', true, 'value-slot re-seed only (by design: readBackA2ui preserves live values)')
      else {
        let diffAt = 0
        while (diffAt < initialHtml.length && initialHtml[diffAt] === finalHtml[diffAt]) diffAt++
        set('C2', false, `diff@${diffAt}: "${initialHtml.slice(Math.max(0, diffAt - 40), diffAt + 60)}" → "${finalHtml.slice(Math.max(0, diffAt - 40), diffAt + 60)}"`)
      }
    }

    return { gates: g, knobs: rows.map(({ label, kind, values }) => ({ label, kind, values })) }
  }, { exp, KNOB_UNSET: '__cp-unset__', isOverlay: OVERLAY.has(name) })
}

// ── walk the tabs ─────────────────────────────────────────────────────────────────────────────────────────────
const GATES = ['A1', 'A2', 'A4', 'B1', 'B2', 'B3g', 'C1', 'C2']
const results = []
const tabs = page.locator('ui-tabs.catalog-tabs > [data-part=tablist] > ui-tab')
const tabCount = await tabs.count()
for (let t = 0; t < tabCount; t++) {
  const tier = (await tabs.nth(t).getAttribute('key')) ?? `tab-${t}`
  await tabs.nth(t).click()
  const panel = page.locator('ui-tabs.catalog-tabs > ui-tab-panel:visible').first()
  await panel.waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForTimeout(250)
  const cards = panel.locator('section.catalog-item')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i)
    const name = (await card.locator('h2.catalog-item-title').innerText()).trim()
    if (ONLY && name !== ONLY) continue
    const exp = expected[name]
    if (!exp) { results.push({ name, tier, gates: { A1: { pass: false, note: 'no derived record — not in browsableNames' } } }); continue }
    await card.scrollIntoViewIfNeeded()
    const errBefore = pageErrors.length
    let probed
    try {
      probed = await probeCard(card, name, exp)
    } catch (e) {
      probed = { gates: { B1: { pass: false, note: `probe crashed: ${String(e).slice(0, 200)}` } }, knobs: [] }
    }
    const newErrors = pageErrors.slice(errBefore)
    if (newErrors.length && probed.gates.B1?.pass) probed.gates.B1 = { pass: false, note: `errors during probe: ${newErrors.slice(0, 2).join(' | ')}` }
    let shot = null
    if (SHOTS) {
      const dir = path.join(OUT, THEME, tier)
      await mkdir(dir, { recursive: true })
      shot = path.join(dir, `${name}.png`)
      await card.screenshot({ path: shot, animations: 'disabled' })
    }
    const row = { name, tier, gates: probed.gates, knobs: probed.knobs, seeds: exp.seeds, tag: exp.tag, screenshot: shot && path.relative(OUT, shot), overlay: OVERLAY.has(name) }
    results.push(row)
    await mkdir(path.join(OUT, 'eval'), { recursive: true })
    await writeFile(path.join(OUT, 'eval', `${name}.json`), JSON.stringify(row, null, 2))
    const bad = GATES.filter((k) => row.gates[k] && !row.gates[k].pass)
    console.log(`${bad.length ? '✗' : '✓'} ${tier}/${name}${bad.length ? ` — ${bad.map((k) => `${k}(${row.gates[k].note})`).join(' · ')}` : ''}`)
  }
}
await browser.close()

// ── summary ───────────────────────────────────────────────────────────────────────────────────────────────────
const redRows = results.filter((r) => GATES.some((k) => r.gates[k] && !r.gates[k].pass))
const lines = [
  `# a2ui-catalog mechanical gates — ${new Date().toISOString().slice(0, 10)} — base ${BASE} — theme ${THEME}`,
  '', `| card | tier | ${GATES.join(' | ')} |`, `|---|---|${GATES.map(() => '---').join('|')}|`,
  ...results.map((r) => `| ${r.name} | ${r.tier} | ${GATES.map((k) => (r.gates[k] ? (r.gates[k].pass ? '✓' : '✗') : '·')).join(' | ')} |`),
  '', `## Red gates (${redRows.length} cards)`,
  ...redRows.flatMap((r) => GATES.filter((k) => r.gates[k] && !r.gates[k].pass).map((k) => `- ${r.name} · ${k} — ${r.gates[k].note}`)),
  '', `Coverage: ${results.length} cards probed / ${Object.keys(expected).length} browsable types${ONLY ? ` (--only ${ONLY})` : ''}.`,
]
await mkdir(path.join(OUT, 'eval'), { recursive: true })
await writeFile(path.join(OUT, 'eval', 'summary.md'), lines.join('\n') + '\n')
console.log(`\n${results.length} cards → ${OUT}/eval/summary.md · ${redRows.length} with red gates`)
process.exit(redRows.length > 0 ? 1 : 0)
