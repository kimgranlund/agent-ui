import { describe, it, expect } from 'vitest'
import { splitFrontmatter, parseDescriptor } from './component-descriptor.ts'
// Raw-text fs read: the same reverse-coupling fs-read pattern as site-coverage.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// descriptor-description.test.ts: every shipped control descriptor carries a one-line `description:` (T-0433).
// The A2UI Catalog page shows it on each control-backed card (site/lib/a2ui-type-description.ts) and the
// capability registry projects it; a descriptor without one made its card fall back to selection intents. The set
// is walked from the controls folder (every `{name}.md` whose frontmatter declares a `ui-*` tag), never a hand list.

const CONTROLS = `${process.cwd()}/packages/agent-ui/components/src/controls`

function descriptors(): { file: string; tag: string; description: unknown }[] {
  const out: { file: string; tag: string; description: unknown }[] = []
  for (const dir of readdirSync(CONTROLS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    for (const name of readdirSync(`${CONTROLS}/${dir.name}`) as string[]) {
      if (!name.endsWith('.md')) continue
      const raw = readFileSync(`${CONTROLS}/${dir.name}/${name}`, 'utf8') as string
      if (!raw.startsWith('---')) continue
      const parsed = parseDescriptor(splitFrontmatter(raw).fence)
      const tag = parsed.scalars.get('tag')
      if (typeof tag !== 'string' || !tag.startsWith('ui-')) continue
      out.push({ file: `${dir.name}/${name}`, tag, description: parsed.scalars.get('description') })
    }
  }
  return out
}

describe('every control descriptor has a description (T-0433)', () => {
  const all = descriptors()

  it('walks the whole fleet (anti-vacuous)', () => {
    expect(all.length).toBeGreaterThanOrEqual(90)
    expect(all.map((d) => d.tag)).toContain('ui-button')
  })

  it('each description is a non-empty single line', () => {
    const missing = all.filter((d) => typeof d.description !== 'string' || d.description.trim() === '').map((d) => d.file)
    expect(missing).toEqual([])
    const multiline = all.filter((d) => String(d.description).includes('\n')).map((d) => d.file)
    expect(multiline).toEqual([])
  })
})
