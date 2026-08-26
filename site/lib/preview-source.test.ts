import { describe, it, expect } from 'vitest'
import {
  generateComponentHtml,
  generateComponentJs,
  formatA2uiJson,
  cssTokenSource,
  type KnobLike,
} from './preview-source.ts'
import { descriptorKeyByTag } from './frontmatter.ts'
// Raw-text fs read — the same reverse-coupling fs-read pattern component-preview-slot-text.test.ts and the
// site drift gates use (descriptor/site-coverage.test.ts, gallery.test.ts): an INDEPENDENT source of the
// real fleet's tags, never the production glob re-consumed as its own proof.
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// preview-source.test.ts — LLD-C7 jsdom probe (`component-preview-code-tabs.lld.md` §7 item 2, GH #1664):
// proves the three pure generators against component-preview.ts's OWN `#applyKnob`/`#rootProps` semantics
// (read straight off that file's source, not re-derived here) plus `formatA2uiJson`'s round-trip, the E4
// md/css basename-invariant probe, and `cssTokenSource`'s E2/E5 comment-line degradations. Runs under the
// `site` jsdom project (vitest.config.ts) — no browser engine needed for pure string generators.

const S = (entries: readonly (readonly [string, string])[]): Map<string, string> => new Map(entries)

// ── generateComponentHtml — mirrors #applyKnob EXACTLY ─────────────────────────────────────────────────────

describe('generateComponentHtml — mirrors component-preview.ts #applyKnob per knob kind', () => {
  it('boolean knob: bare attribute when raw === "true"', () => {
    const knobs: KnobLike[] = [{ name: 'disabled', kind: 'boolean' }]
    const html = generateComponentHtml('ui-button', knobs, S([['disabled', 'true']]), {}, '')
    expect(html).toBe('<ui-button disabled></ui-button>')
  })

  it('boolean knob: absent (never ="false") when raw !== "true"', () => {
    const knobs: KnobLike[] = [{ name: 'disabled', kind: 'boolean' }]
    const html = generateComponentHtml('ui-button', knobs, S([['disabled', 'false']]), {}, '')
    expect(html).toBe('<ui-button></ui-button>')
  })

  it('kind "skip" is omitted entirely, even when #state carries a value', () => {
    const knobs: KnobLike[] = [{ name: 'values', kind: 'skip' }]
    const html = generateComponentHtml('ui-sparkline', knobs, S([['values', '[1,2,3]']]), {}, '')
    expect(html).toBe('<ui-sparkline></ui-sparkline>')
  })

  it('SLOT_TEXT sentinel renders as an escaped TEXT CHILD, never an attribute', () => {
    const knobs: KnobLike[] = [{ name: '#text', kind: 'text' }]
    const html = generateComponentHtml('ui-button', knobs, S([['#text', 'Click me']]), {}, '')
    expect(html).toBe('<ui-button>Click me</ui-button>')
    expect(html).not.toContain('#text=')
  })

  it('undefined raw omits the attribute', () => {
    const knobs: KnobLike[] = [{ name: 'variant', kind: 'enum' }]
    const html = generateComponentHtml('ui-button', knobs, S([]), {}, '')
    expect(html).toBe('<ui-button></ui-button>')
  })

  it('empty-string raw omits the attribute', () => {
    const knobs: KnobLike[] = [{ name: 'variant', kind: 'enum' }]
    const html = generateComponentHtml('ui-button', knobs, S([['variant', '']]), {}, '')
    expect(html).toBe('<ui-button></ui-button>')
  })

  it('else: attr="escaped value" for a genuinely set, non-boolean knob', () => {
    const knobs: KnobLike[] = [{ name: 'variant', kind: 'enum' }]
    const html = generateComponentHtml('ui-button', knobs, S([['variant', 'ghost']]), {}, '')
    expect(html).toBe('<ui-button variant="ghost"></ui-button>')
  })

  it('sampleAttrs render as ordinary attributes, ahead of knob-derived attributes', () => {
    const knobs: KnobLike[] = [{ name: 'variant', kind: 'enum' }]
    const html = generateComponentHtml('ui-slider', knobs, S([['variant', 'x']]), { 'aria-label': 'Volume' }, '')
    expect(html).toBe('<ui-slider aria-label="Volume" variant="x"></ui-slider>')
  })

  it('non-empty sampleChildren is embedded, indented block, between open/close tags', () => {
    const html = generateComponentHtml('ui-row', [], S([]), {}, '  <div>Item one</div>\n  <div>Item two</div>')
    expect(html).toBe('<ui-row>\n  <div>Item one</div>\n  <div>Item two</div>\n</ui-row>')
  })

  // E10 — escaping is about output correctness (a human copying the generated markup), never a runtime
  // injection surface (projectHighlight always writes via textContent/createTextNode).
  it('E10: escapes & < > " in both attribute values and the SLOT_TEXT text child', () => {
    const knobs: KnobLike[] = [
      { name: 'variant', kind: 'string' },
      { name: '#text', kind: 'text' },
    ]
    const html = generateComponentHtml(
      'ui-button',
      knobs,
      S([
        ['variant', '<script>&"x"</script>'],
        ['#text', '<b>"quoted" & bold</b>'],
      ]),
      {},
      '',
    )
    expect(html).toBe(
      '<ui-button variant="&lt;script&gt;&amp;&quot;x&quot;&lt;/script&gt;">&lt;b&gt;&quot;quoted&quot; &amp; bold&lt;/b&gt;</ui-button>',
    )
  })
})

// ── generateComponentJs — mirrors #rootProps typing, with the boolean-omission correction the LLD names ────

describe('generateComponentJs — property assignments typed like #rootProps (boolean corrected to match HTML default)', () => {
  it('document.createElement + document.body.append(el) frame every output', () => {
    const js = generateComponentJs('ui-button', [], S([]), {})
    expect(js.startsWith("const el = document.createElement('ui-button')")).toBe(true)
    expect(js.endsWith('document.body.append(el)')).toBe(true)
  })

  it('boolean knob: el.name = true only when raw === "true"', () => {
    const knobs: KnobLike[] = [{ name: 'disabled', kind: 'boolean' }]
    expect(generateComponentJs('ui-button', knobs, S([['disabled', 'true']]), {})).toContain('el.disabled = true')
  })

  it('boolean knob: OMITTED (never "= false") when raw !== "true" — matches the HTML tab\'s absent-attribute default', () => {
    const knobs: KnobLike[] = [{ name: 'disabled', kind: 'boolean' }]
    const js = generateComponentJs('ui-button', knobs, S([['disabled', 'false']]), {})
    expect(js).not.toContain('disabled')
  })

  it('number knob: Number(raw) assigned when finite', () => {
    const knobs: KnobLike[] = [{ name: 'max', kind: 'number' }]
    expect(generateComponentJs('ui-slider', knobs, S([['max', '100']]), {})).toContain('el.max = 100')
  })

  it('number knob: omitted when non-finite', () => {
    const knobs: KnobLike[] = [{ name: 'max', kind: 'number' }]
    const js = generateComponentJs('ui-slider', knobs, S([['max', 'not-a-number']]), {})
    expect(js).not.toContain('el.max')
  })

  it('string/enum knob: el.name = JSON.stringify(raw)', () => {
    const knobs: KnobLike[] = [{ name: 'variant', kind: 'enum' }]
    expect(generateComponentJs('ui-button', knobs, S([['variant', 'ghost']]), {})).toContain(
      'el.variant = "ghost"',
    )
  })

  it('kind "skip" is omitted entirely', () => {
    const knobs: KnobLike[] = [{ name: 'values', kind: 'skip' }]
    const js = generateComponentJs('ui-sparkline', knobs, S([['values', '[1,2,3]']]), {})
    expect(js).not.toContain('el.values')
  })

  it('SLOT_TEXT: el.textContent = JSON.stringify(text)', () => {
    const knobs: KnobLike[] = [{ name: '#text', kind: 'text' }]
    expect(generateComponentJs('ui-button', knobs, S([['#text', 'Click me']]), {})).toContain(
      'el.textContent = "Click me"',
    )
  })

  it('sampleAttrs seed via el.setAttribute(...) ahead of the knob loop', () => {
    const js = generateComponentJs('ui-slider', [], S([]), { 'aria-label': 'Volume' })
    const setAttrLine = js.split('\n').findIndex((l) => l.includes('setAttribute'))
    const createLine = js.split('\n').findIndex((l) => l.includes('createElement'))
    expect(setAttrLine).toBeGreaterThan(createLine)
    expect(js).toContain("el.setAttribute('aria-label', \"Volume\")")
  })
})

// ── formatA2uiJson — round-trips the literal #a2uiPayload() JSONL, pretty-printed ────────────────────────────

describe('formatA2uiJson — round-trips #a2uiPayload() JSONL, pretty-printed, never re-derived', () => {
  it('each pretty block JSON.parses back to the SAME value as its input line', () => {
    const createSurface = JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'preview', catalogId: 'agent-ui' } })
    const updateComponents = JSON.stringify({
      version: 'v1.0',
      updateComponents: { surfaceId: 'preview', components: [{ id: 'root', component: 'Button', label: 'Hi' }] },
    })
    const formatted = formatA2uiJson([createSurface, updateComponents])
    const blocks = formatted.split('\n\n')
    expect(blocks).toHaveLength(2)
    expect(JSON.parse(blocks[0] as string)).toEqual(JSON.parse(createSurface))
    expect(JSON.parse(blocks[1] as string)).toEqual(JSON.parse(updateComponents))
  })

  it('is genuinely pretty-printed (2-space indent), not the compact single-line input', () => {
    const line = JSON.stringify({ a: { b: 1 } })
    const formatted = formatA2uiJson([line, line])
    expect(formatted).toContain('\n  "a": {\n    "b": 1\n  }\n')
  })
})

// ── cssTokenSource — E2/E5 degradations (jsdom tier); the browser tier proves resolved non-empty values ─────
// Vitest's jsdom project runs with CSS processing mocked by default (no `test.css: true` — the SAME reason
// every existing CSS-content probe in this repo reads its stylesheet via node:fs, never via a Vite `?raw`
// glob under this project: code-css.test.ts et al.), so `CONTROL_CSS_SOURCES` resolves every `.css` glob
// entry to an EMPTY string here — this tier can only prove the degradation shapes (E2/E5), never a resolved
// non-empty `--md-sys-*` value (that is `component-preview-code.browser.test.ts`'s job, §7 item 3, where the
// real Vite CSS pipeline + a real live root are both present).

describe('cssTokenSource — E2/E5 comment-line degradations, never throws', () => {
  it('E2: an unresolvable tag (no descriptor) degrades to a single CSS comment naming the reason', () => {
    const out = cssTokenSource('ui-zzfake-nonexistent', null)
    expect(out.startsWith('/*')).toBe(true)
    expect(out.endsWith('*/')).toBe(true)
    expect(out).toContain('ui-zzfake-nonexistent')
  })

  it('E5: a real stylesheet that references zero --md-sys-* tokens (ui-audio, true regardless of CSS-content mocking) degrades to a comment line', () => {
    const out = cssTokenSource('ui-audio', document.createElement('div'))
    expect(out.startsWith('/*')).toBe(true)
    expect(out).toContain('ui-audio')
    expect(out).toContain('no --md-sys-')
  })

  it('E5: a null liveRoot (root not available yet) degrades to a comment line, for a resolvable tag', () => {
    const out = cssTokenSource('ui-button', null)
    expect(out.startsWith('/*')).toBe(true)
    expect(out).toContain('ui-button')
  })

  it('never throws for a bare empty tag string', () => {
    expect(() => cssTokenSource('', null)).not.toThrow()
  })
})

// ── E4 — the md-basename ≡ css-basename invariant, repo-wide (pins descriptorKeyByTag's own contract) ───────

const ROOT = process.cwd()
const CONTROLS_DIR = `${ROOT}/packages/agent-ui/components/src/controls`
const read = (p: string): string => readFileSync(p, 'utf8') as string

type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }

function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const files: string[] = []
  for (const e of entries) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) files.push(...walk(full))
    else if (e.isFile()) files.push(full)
  }
  return files
}

/** Every real `ui-*` tag among the shipped `{name}.md` descriptors — an INDEPENDENT fs walk (not
 *  frontmatter.ts's own import.meta.glob re-consumed as its own proof). */
function fleetTags(): string[] {
  const tags: string[] = []
  for (const file of walk(CONTROLS_DIR)) {
    if (!file.endsWith('.md')) continue
    const src = read(file)
    const m = /^tag:\s*(\S+)/m.exec(src)
    if (m) tags.push(m[1] as string)
  }
  return tags
}

const CSS_SOURCES = import.meta.glob('../../packages/agent-ui/components/src/controls/*/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('E4 — descriptorKeyByTag / cssTokenSource basename invariant (repo-wide, fails loud on drift)', () => {
  const tags = fleetTags()

  it('found a real, sizeable fleet (anti-vacuous — the walk itself is not silently empty)', () => {
    expect(tags.length).toBeGreaterThanOrEqual(80)
  })

  it('every real fleet tag resolves via descriptorKeyByTag to a key whose sibling .css glob entry exists', () => {
    const missing: string[] = []
    for (const tag of tags) {
      const key = descriptorKeyByTag(tag)
      if (key === undefined) {
        missing.push(`${tag}: no descriptor key`)
        continue
      }
      const cssKey = key.replace(/\.md$/, '.css')
      if (CSS_SOURCES[cssKey] === undefined) missing.push(`${tag}: no sibling .css at ${cssKey}`)
    }
    expect(missing).toEqual([])
  })

  it('descriptorKeyByTag returns undefined for an unknown tag (never throws, never guesses)', () => {
    expect(descriptorKeyByTag('ui-definitely-not-real')).toBeUndefined()
  })
})
