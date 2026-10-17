// agent-content.test.mjs: the agent content CLI (T-0162, `scripts` vitest project, node). Every write runs
// in a scratch copy of the content roots, so the real tree is never mutated:
//   (a) `validate` exits 0 on the repo and 1 on a copy with one seeded bad file, naming the problem;
//   (b) `new` writes a blank roster persona that validates; `new --from` turns an exported persona file into
//       a seed folder that validates, refs an identical library entry, and lists what it could not carry;
//   (c) `add-skill` writes a persona-local and a library skill, each referenced and valid; it refuses an
//       existing file unless --force, never lists a ref twice, and needs exactly one of --persona and --pack;
//       `new --from` refuses a file whose state is not an object;
//   (d) `compile-check` exits 0 on an unedited copy and 1 on a hand-edited registry;
//   (e) a usage error exits 2.

import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OUT_REGISTRY } from './generate-agent-content.mjs'
import { splitJsonFrontmatter } from '../site/agent-content/schema.ts'

const SCRIPT = join(process.cwd(), 'scripts/agent-content.mjs')
const ROOTS = ['site/agent-content', 'site/lib/agent-manifest']

const scratch = []
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true })
})

function copyTree() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-content-cli-'))
  scratch.push(dir)
  for (const root of ROOTS) cpSync(join(process.cwd(), root), join(dir, root), { recursive: true })
  return dir
}

const cli = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' })
const frontmatterOf = (dir, path) => splitJsonFrontmatter(readFileSync(join(dir, path), 'utf8')).frontmatter

describe('agent-content CLI', () => {
  it('validate exits 0 on the repo', () => {
    const r = cli(process.cwd(), 'validate')
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })

  it('validate exits 1 on a seeded bad file, naming the file and the field', () => {
    const dir = copyTree()
    const path = 'site/agent-content/personas/quant/agent.md'
    const source = readFileSync(join(dir, path), 'utf8')
    writeFileSync(join(dir, path), source.replace('"toolsEnabled": true,', '"toolsEnabled": true,\n  "effort": "turbo",'))
    const r = cli(dir, 'validate')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain(`${path}: effort "turbo" is not one of low, medium, high, xhigh`)
  })

  it('new writes a blank roster persona that validates', () => {
    const dir = copyTree()
    const r = cli(dir, 'new', 'sommelier', '--label', 'The Sommelier')
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    const fm = frontmatterOf(dir, 'site/agent-content/personas/sommelier/agent.md')
    expect(fm).toMatchObject({ id: 'sommelier', version: 1, label: 'The Sommelier', name: 'The Sommelier', toolsEnabled: true, skills: [] })
  })

  it('new --from turns an exported persona file into a seed folder: library entries as refs, the rest local, the rest listed', () => {
    const dir = copyTree()
    const menu = splitJsonFrontmatter(readFileSync(join(dir, 'site/agent-content/skills/menu-card/SKILL.md'), 'utf8'))
    const file = {
      kind: 'agent-ui-persona',
      version: 1,
      exportedAt: '2026-10-17T00:00:00.000Z',
      persona: { label: 'Wine Bar', tagline: 'Pours and pairs.', category: 'hospitality', sourceId: 'new-agent' },
      state: {
        name: 'Wine Bar',
        model: 'claude-haiku-5-5',
        effort: 'low',
        surfaceMarkdown: false,
        'entries:prompt-section': [
          { id: 'foundation', kind: 'prompt-section', label: 'Foundation', content: 'You pour wine.', builtin: true, enabled: true, order: 0 },
          { id: 'personality', kind: 'prompt-section', label: 'Personality', content: 'Warm.', builtin: true, enabled: false, order: 1 },
          { id: 'surface-style', kind: 'prompt-section', label: 'Surface style', content: 'One wine list surface.', builtin: false, enabled: true, order: 2 },
        ],
        'entries:skill': [
          { id: 'menu-card', kind: 'skill', label: 'menu-card', description: menu.frontmatter.description, content: menu.body, enabled: true, order: 0 },
          { id: 'pairing', kind: 'skill', label: 'Pairing', description: 'Pair a wine.', content: 'Suggest one wine per dish.', enabled: true, order: 1 },
        ],
      },
    }
    const exported = join(dir, 'wine-bar.persona.json')
    writeFileSync(exported, JSON.stringify(file))
    const r = cli(dir, 'new', 'wine-bar', '--from', exported)
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    const fm = frontmatterOf(dir, 'site/agent-content/personas/wine-bar/agent.md')
    expect(fm).toMatchObject({ label: 'Wine Bar', category: 'hospitality', name: 'Wine Bar', effort: 'low', disabledBuiltins: ['personality'], skills: ['menu-card@1', './pairing@1'] })
    expect(existsSync(join(dir, 'site/agent-content/personas/wine-bar/skills/pairing/SKILL.md'))).toBe(true)
    expect(r.stdout).toContain('not carried: surfaceMarkdown')
    expect(r.stdout).toContain('not carried: prompt section Personality')
    expect(r.stdout).toContain('not carried: skill pairing: its display label "Pairing"')
  })

  it('add-skill writes a persona-local skill and a library skill, each referenced and valid', () => {
    const dir = copyTree()
    const local = cli(dir, 'add-skill', 'chart-legend', '--persona', 'quant', '--description', 'chart legend, key')
    expect(local.stderr).toBe('')
    expect(local.status).toBe(0)
    expect(frontmatterOf(dir, 'site/agent-content/personas/quant/agent.md').skills).toContain('./chart-legend@1')
    const library = cli(dir, 'add-skill', 'room-map', '--pack', 'hospitality')
    expect(library.stderr).toBe('')
    expect(library.status).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'site/agent-content/packs/hospitality/pack.json'), 'utf8')).entries).toContain('room-map@1')
  })

  it('add-skill refuses an existing skill file (library or persona-local) unless --force, and never lists a ref twice', () => {
    const dir = copyTree()
    const libraryPath = join(dir, 'site/agent-content/skills/amenity-service-card/SKILL.md')
    const before = readFileSync(libraryPath, 'utf8')
    const refused = cli(dir, 'add-skill', 'amenity-service-card', '--pack', 'hospitality')
    expect(refused.status).toBe(2)
    expect(refused.stderr).toContain('already exists')
    expect(readFileSync(libraryPath, 'utf8')).toBe(before)

    const packPath = join(dir, 'site/agent-content/packs/hospitality/pack.json')
    const forced = cli(dir, 'add-skill', 'amenity-service-card', '--pack', 'hospitality', '--force')
    expect(forced.status).toBe(0)
    const entries = JSON.parse(readFileSync(packPath, 'utf8')).entries
    expect(entries.filter((ref) => ref.startsWith('amenity-service-card@'))).toHaveLength(1)

    const agentPath = 'site/agent-content/personas/quant/agent.md'
    const local = frontmatterOf(dir, agentPath).skills.find((ref) => ref.startsWith('./'))
    const localId = local.slice(2, local.indexOf('@'))
    expect(cli(dir, 'add-skill', localId, '--persona', 'quant').status).toBe(2)
    expect(cli(dir, 'add-skill', localId, '--persona', 'quant', '--force').status).toBe(0)
    expect(frontmatterOf(dir, agentPath).skills.filter((ref) => ref === local)).toHaveLength(1)
  })

  it('add-skill without --persona or --pack (or with both) is a usage error', () => {
    const dir = copyTree()
    for (const args of [['add-skill', 'loose-skill'], ['add-skill', 'loose-skill', '--persona', 'quant', '--pack', 'hospitality']]) {
      const r = cli(dir, ...args)
      expect(r.status).toBe(2)
      expect(r.stderr).toContain('exactly one of --persona and --pack')
    }
    expect(existsSync(join(dir, 'site/agent-content/skills/loose-skill'))).toBe(false)
  })

  it('new --from a file whose state is not an object is a usage error, never a crash', () => {
    const dir = copyTree()
    for (const state of [null, [], 'text']) {
      const exported = join(dir, 'bad.persona.json')
      writeFileSync(exported, JSON.stringify({ kind: 'agent-ui-persona', version: 1, persona: null, state }))
      const r = cli(dir, 'new', 'bad-one', '--from', exported)
      expect(r.status).toBe(2)
      expect(r.stderr).toContain('with a state object')
      expect(r.stderr).not.toContain('    at ')
    }
    expect(existsSync(join(dir, 'site/agent-content/personas/bad-one'))).toBe(false)
  })

  it('compile-check exits 0 on an unedited copy and 1 on a hand-edited registry', () => {
    const dir = copyTree()
    expect(cli(dir, 'compile-check').status).toBe(0)
    appendFileSync(join(dir, OUT_REGISTRY), '// hand edit\n')
    const r = cli(dir, 'compile-check')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain(`${OUT_REGISTRY} is stale`)
  })

  it('a usage error exits 2', () => {
    expect(cli(process.cwd(), 'publish').status).toBe(2)
    expect(cli(process.cwd(), 'new', 'Not An Id').status).toBe(2)
  })
})
