import { describe, it, expect } from 'vitest'
import { splitFrontmatter, parseDescriptor } from './component-descriptor.ts'
// Raw-text fs read: the same reverse-coupling fs-read pattern as site-coverage.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// descriptor-description.test.ts: every shipped control descriptor carries a one-line `description:` (T-0433).
// The A2UI Catalog page shows it on each control-backed card (site/lib/a2ui-type-description.ts) and the
// capability registry projects it; a descriptor without one made its card fall back to selection intents. The set
// is walked from the controls folders (every `{name}.md` whose frontmatter declares a `ui-*` tag), never a hand list.
// T-0436 widened the walk to the app, code and router packages, whose descriptors sit in the same shape.

const PKG = `${process.cwd()}/packages/agent-ui`
const ROOTS = ['components/src/controls', 'app/src/controls', 'router/src/controls', 'code/src/editor', 'code/src/markdown']

function descriptors(): { file: string; tag: string; description: unknown }[] {
  const out: { file: string; tag: string; description: unknown }[] = []
  const scan = (rel: string, dir: string) => {
    for (const name of readdirSync(dir) as string[]) {
      if (!name.endsWith('.md')) continue
      const raw = readFileSync(`${dir}/${name}`, 'utf8') as string
      if (!raw.startsWith('---')) continue
      const parsed = parseDescriptor(splitFrontmatter(raw).fence)
      // ui-super-shell's descriptor keys its tag as `name:`, every other one as `tag:`.
      const tag = parsed.scalars.get('tag') ?? parsed.scalars.get('name')
      if (typeof tag !== 'string' || !tag.startsWith('ui-')) continue
      out.push({ file: `${rel}/${name}`, tag, description: parsed.scalars.get('description') })
    }
  }
  for (const root of ROOTS) {
    // A root is either a folder of control folders (controls/) or a single control folder (code's editor, markdown).
    const base = `${PKG}/${root}`
    scan(root, base)
    for (const dir of readdirSync(base, { withFileTypes: true })) {
      if (dir.isDirectory()) scan(`${root}/${dir.name}`, `${base}/${dir.name}`)
    }
  }
  return out
}

describe('every control descriptor has a description (T-0433, T-0436)', () => {
  const all = descriptors()

  it('walks the whole fleet (anti-vacuous)', () => {
    expect(all.length).toBeGreaterThanOrEqual(110)
    const tags = all.map((d) => d.tag)
    for (const tag of ['ui-button', 'ui-super-shell', 'ui-markdown', 'ui-code-editor', 'ui-router-link']) expect(tags).toContain(tag)
  })

  it('each description is a non-empty single line', () => {
    const missing = all.filter((d) => typeof d.description !== 'string' || d.description.trim() === '').map((d) => d.file)
    expect(missing).toEqual([])
    const multiline = all.filter((d) => String(d.description).includes('\n')).map((d) => d.file)
    expect(multiline).toEqual([])
  })
})
