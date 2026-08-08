import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { splitFrontmatter, parseDescriptor } from './component-descriptor.ts'
declare const process: { cwd(): string }

// GH #610 — the descriptor comment rule. `stripComment` used to be `/\s+#.*$/`: not quote-aware and with no
// trailing boundary, so the FIRST `#NNN` reference inside any value silently truncated it. These probes pin
// the two halves of the replacement rule (quote-aware · `#` must be followed by whitespace/EOL) plus the LIVE
// instance the issue was filed from, and sweep the whole descriptor corpus for the truncation SHAPE.

const fenceOf = (path: string): string => splitFrontmatter(readFileSync(path, 'utf8') as string).fence
const repo = (rel: string): string => `${process.cwd()}/${rel}`

describe('descriptor comment rule — `#NNN` references survive (GH #610)', () => {
  it('a bare #NNN reference inside an unquoted value survives intact', () => {
    const d = parseDescriptor('description: the strip scrolls (GH #221 — overflow-x auto) always\n')
    expect(d.scalars.get('description')).toBe('the strip scrolls (GH #221 — overflow-x auto) always')
  })

  it('a #NNN reference inside a QUOTED value survives, quotes and all', () => {
    const d = parseDescriptor("description: 'GH #147/ADR-0153 — the retry affordance'\n")
    expect(d.scalars.get('description')).toBe('GH #147/ADR-0153 — the retry affordance')
  })

  it('a real trailing comment still strips (unquoted value)', () => {
    const d = parseDescriptor('reflect: true      # GH #581 — the strip axis\n')
    expect(d.scalars.get('reflect')).toBe('true')
  })

  it('a real trailing comment still strips AFTER a quoted value', () => {
    const d = parseDescriptor("detail: '{ value: string }'   # the select payload\n")
    expect(d.scalars.get('detail')).toBe('{ value: string }')
  })

  it('a whole-line comment and an inline comment carrying its own #NNN both strip', () => {
    const d = parseDescriptor(['# GH #610 — a whole-line comment', 'tag: ui-tabs   # see GH #221'].join('\n'))
    expect(d.scalars.get('tag')).toBe('ui-tabs')
    expect(d.topLevelKeys.has('#')).toBe(false)
  })

  it('a #NNN reference inside a sequence-item field survives (the attributes[]/parts[] shape)', () => {
    const d = parseDescriptor(
      ['parts:', '  - name: tablist', '    description: the viewport (GH #221) scrolls   # a real comment'].join('\n'),
    )
    expect(d.sequences.get('parts')?.[0].get('description')).toBe('the viewport (GH #221) scrolls')
  })

  it('an inline array and a codec flow-map keep their #NNN references', () => {
    const d = parseDescriptor(
      ['attributes:', '  - values: [a#1, b#2]   # GH #610', "    codec: { import: './x.ts#frag', name: 'y' }"].join('\n'),
    )
    expect(d.sequences.get('attributes')?.[0].get('values')).toEqual(['a#1', 'b#2'])
    expect((d.sequences.get('attributes')?.[0].get('codec') as Map<string, string>).get('import')).toBe('./x.ts#frag')
  })
})

describe('descriptor comment rule — the LIVE instances (GH #610)', () => {
  it("tabs.md's tablist part description is no longer truncated at `GH`", () => {
    const d = parseDescriptor(fenceOf(repo('packages/agent-ui/components/src/controls/tabs/tabs.md')))
    const tablist = d.sequences.get('parts')?.find((p) => p.get('name') === 'tablist')
    const description = tablist?.get('description')
    expect(typeof description).toBe('string')
    // the issue's exact symptom: the value ended at "(GH" — the reference and everything past it were lost
    expect(description as string).toContain('GH #221 — `overflow-x auto`')
    expect(description as string).toContain('--ui-tabs-strip-scrollbar-width')
    expect((description as string).endsWith('GH')).toBe(false)
  })

  it("status-stream.md's QUOTED part descriptions survive their leading GH reference", () => {
    const d = parseDescriptor(fenceOf(repo('packages/agent-ui/components/src/controls/status-stream/status-stream.md')))
    // these four are authored as single-quoted scalars OPENING on a `#NNN` reference — the old rule cut each
    // one down to the bare `'GH` fragment (an unterminated quote at that), losing the whole description
    const quoted = (d.sequences.get('parts') ?? [])
      .map((p) => p.get('description'))
      .filter((v): v is string => typeof v === 'string' && v.startsWith('GH #'))
    expect(quoted.length).toBe(4)
    for (const v of quoted) expect(v.length).toBeGreaterThan(120)
  })
})

describe('descriptor corpus — no value is cut at a `#` reference (GH #610)', () => {
  // The defect SHAPE, stated independently of the parser: a parsed value V appears in the raw fence
  // immediately followed by whitespace + `#` + a non-space — i.e. the parse stopped exactly at a `#NNN`
  // reference. This detector never re-implements the comment rule; it looks only at where a value ENDED.
  const CUT_AT_REFERENCE = /^[ \t]+#\S/

  const cutValues = (fence: string, values: string[]): string[] =>
    values.filter((v) => {
      if (v.length < 4) return false // too short to locate unambiguously in the fence text
      const idx = fence.indexOf(v)
      return idx >= 0 && CUT_AT_REFERENCE.test(fence.slice(idx + v.length))
    })

  const allValues = (fence: string): string[] => {
    const d = parseDescriptor(fence)
    const values: string[] = [...d.scalars.values()]
    for (const m of d.maps.values()) values.push(...m.values())
    for (const seq of d.sequences.values()) {
      for (const item of seq) {
        for (const v of item.values()) {
          if (typeof v === 'string') values.push(v)
          else if (Array.isArray(v)) values.push(...v)
          else values.push(...v.values())
        }
      }
    }
    return values
  }

  const files = execSync("git ls-files '*.md'", { cwd: process.cwd() })
    .toString()
    .trim()
    .split('\n')
    .filter((f) => /packages\/agent-ui\/.*\/[a-z0-9-]+\.md$/.test(f))
    .filter((f) => readFileSync(repo(f), 'utf8').startsWith('---\n'))

  it('sweeps a real corpus of descriptor fences (anti-vacuous)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('the detector FIRES on the pre-fix shape (anti-vacuous)', () => {
    const fence = 'description: the strip scrolls (GH #221 — overflow-x auto)\n'
    const preFix = ['the strip scrolls (GH'] // what `/\s+#.*$/` produced
    expect(cutValues(fence, preFix)).toEqual(preFix)
  })

  for (const f of files) {
    it(`${f} — no parsed value stops at a \`#\` reference`, () => {
      const fence = fenceOf(repo(f))
      expect(cutValues(fence, allValues(fence))).toEqual([])
    })
  }
})
