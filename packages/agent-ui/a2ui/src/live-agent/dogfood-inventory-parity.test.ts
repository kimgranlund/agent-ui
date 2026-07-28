// dogfood-inventory-parity.test.ts — the standing gate backing `dogfood-inventory.ts`'s own header claim
// ("only the PARSER is local, not the data"): runs BOTH the local minimal reader (`readAttributes`,
// `src/agent/dogfood-inventory.ts`, which `gates.test.ts`'s ADR-0137 SDK-FREE fence confines to
// relative/`node:*` imports only) and the REAL descriptor parser (`@agent-ui/components/descriptor` —
// a lawful import HERE, outside the `src/agent/` fence) over every committed `{name}.md` under
// `packages/agent-ui/components/src/controls/*` and asserts attribute-for-attribute agreement.
//
// This closes the exact gap an independent review of the S3 build caught: the local reader's first cut
// split/trimmed/filtered-blank each `values[]` element but never UNQUOTED it (`component-descriptor.ts`'s
// own `addField` does — ADR-0083's `landmark` edge case: a quoted empty-string enum member, `''`, must
// unquote to a real empty string), so it disagreed with the real parser on 4 real attributes across 2
// real files (`theme-provider.md`'s `scheme`/`scale`/`density`, `timeline-item.md`'s `status`) — a defect
// that reached live model-facing prose (`enum(''|light|dark)` instead of `enum(|light|dark)`) and would
// have kept shipping silently without this test.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { splitFrontmatter as realSplitFrontmatter, parseDescriptor } from '@agent-ui/components/descriptor'
import { splitFrontmatter as localSplitFrontmatter, readAttributes } from '../agent/dogfood-inventory.ts'
import type { LocalAttribute } from '../agent/dogfood-inventory.ts'

declare const process: { cwd(): string }
const CONTROLS_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls`

/** Every `{name}.md` descriptor file under `controls/*` (the SAME discovery `dogfood-inventory.ts`'s own
 *  `discoverDogfoodControls` uses, reimplemented here so this test doesn't depend on that private
 *  function — only the exported reader functions it's proving agree with the real parser). */
function everyDescriptorFile(): { path: string; src: string }[] {
  const files: { path: string; src: string }[] = []
  for (const dirName of readdirSync(CONTROLS_DIR)) {
    const dirPath = `${CONTROLS_DIR}/${dirName}`
    if (!statSync(dirPath).isDirectory()) continue
    for (const fileName of readdirSync(dirPath)) {
      if (!fileName.endsWith('.md')) continue
      const path = `${dirPath}/${fileName}`
      files.push({ path, src: readFileSync(path, 'utf8') })
    }
  }
  return files
}

/** Reshape the real parser's `ParsedAttribute[]` down to `LocalAttribute`'s shape (name/type/values only
 *  — default/reflect are outside what a teaching inventory renders, and outside what the local reader
 *  ever claims to reproduce) so the two outputs are directly comparable. */
function toLocalShape(attrs: readonly { name?: string; type?: string; values?: string[] }[]): LocalAttribute[] {
  return attrs
    .filter((a): a is { name: string; type?: string; values?: string[] } => typeof a.name === 'string' && a.name !== '')
    .map((a) => ({ name: a.name, type: a.type, values: a.values }))
}

const FILES = everyDescriptorFile()

describe('dogfood-inventory.ts local reader ≡ the real @agent-ui/components/descriptor parser (parity gate)', () => {
  it('discovers at least the fleet\'s whole known descriptor set (a sanity floor, not a moving target)', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(50)
  })

  it('every real committed descriptor: the local reader\'s attributes[] EXACTLY match the real parser\'s', () => {
    const disagreements: string[] = []
    for (const { path, src } of FILES) {
      const { fence: realFence } = realSplitFrontmatter(src)
      const { fence: localFence } = localSplitFrontmatter(src)
      // The two readers' fence-extraction must agree too — a silent divergence here would mask an
      // attribute-level disagreement downstream by feeding the two readers different text.
      expect(localFence, `${path}: local/real fence extraction disagree`).toBe(realFence)

      const real = toLocalShape(parseDescriptor(realFence).attributes)
      const local = readAttributes(localFence)
      if (JSON.stringify(local) !== JSON.stringify(real)) {
        disagreements.push(`${path}:\n  local=${JSON.stringify(local)}\n  real =${JSON.stringify(real)}`)
      }
    }
    expect(disagreements, `${disagreements.length} file(s) disagree:\n${disagreements.join('\n')}`).toEqual([])
  })

  // The exact review-caught case, pinned directly: a quoted empty-string enum member unquotes to a real
  // empty string, matching the real parser's `addField`/`unquote` (component-descriptor.ts:117-121).
  it('unquotes a quoted empty-string enum member (ADR-0083 landmark edge case, theme-provider.md)', () => {
    const themeProvider = FILES.find((f) => f.path.endsWith('/theme-provider/theme-provider.md'))
    expect(themeProvider, 'theme-provider.md must exist in the committed tree').toBeDefined()
    const { fence } = localSplitFrontmatter(themeProvider!.src)
    const scheme = readAttributes(fence).find((a) => a.name === 'scheme')
    expect(scheme?.values).toEqual(['', 'light', 'dark'])
  })
})
