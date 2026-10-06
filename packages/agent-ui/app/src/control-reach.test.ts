import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { posix } from 'node:path'
declare const process: { cwd(): string }

// Gate (ADR-0233): every fleet tag an app module renders is defined by a fleet module that app's own import
// graph reaches. Before ADR-0233 the a2ui catalog factories imported the whole components fleet, so app
// modules rendered `ui-icon`, `ui-switch` and friends with no import of their own; once the factories stopped
// importing the fleet, those tags would stay undefined. This crawl keeps that from coming back.
//
// For each `.ts` target in app's `package.json` `exports`, the crawl follows relative specifiers (static
// `from`, bare `import '…'`, dynamic `import('…')`; `import type`/`export type` statements carry no runtime
// edge and are dropped) and every `@agent-ui/components/controls/*` specifier, resolved through components'
// own `exports` map. Inside components it follows relative specifiers only, so a control's sibling imports
// (tabs → menu) and its sub-elements (card → card-header) count as reached. It never follows
// `@agent-ui/components/registry` or `/loader` (lazy thunks for the whole fleet), nor `@agent-ui/a2ui`.
//
// A reached app module "renders" a fleet tag when, comments stripped, its source holds `<ui-x` (a template)
// or `createElement('ui-x')`. "Fleet tag" means a tag some non-test components control module defines with
// `customElements.define('ui-x', …)`; app's own tags (ui-super-shell, …) are not fleet tags. The tag must be
// defined by a reached components module.

const ROOT = process.cwd()
const APP = 'packages/agent-ui/app'
const COMPONENTS = 'packages/agent-ui/components'

type Read = (path: string) => string | undefined

/**
 * `src` with `//` and `/* *\/` comments removed; string and template contents (nested `${…}` templates
 * included) are kept. Regex literals are not recognized; app sources hold none that look like a comment.
 */
export function stripComments(src: string): string {
  let out = ''
  let i = 0
  // Stack of open contexts: a template literal, or a `${` expression inside one (with its brace depth).
  const stack: Array<{ kind: 'tpl' } | { kind: 'expr'; depth: number }> = []
  let quote: "'" | '"' | undefined
  while (i < src.length) {
    const c = src[i]!
    const next = src[i + 1]
    const top = stack[stack.length - 1]
    if (quote !== undefined || top?.kind === 'tpl') {
      out += c
      i++
      if (c === '\\') {
        out += next ?? ''
        i++
      } else if (quote !== undefined) {
        if (c === quote) quote = undefined
      } else if (c === '`') {
        stack.pop()
      } else if (c === '$' && next === '{') {
        out += '{'
        i++
        stack.push({ kind: 'expr', depth: 0 })
      }
      continue
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }
    if (c === "'" || c === '"') quote = c
    else if (c === '`') stack.push({ kind: 'tpl' })
    else if (top?.kind === 'expr' && c === '{') top.depth++
    else if (top?.kind === 'expr' && c === '}') {
      if (top.depth === 0) stack.pop()
      else top.depth--
    }
    out += c
    i++
  }
  return out
}

/** Runtime import specifiers of `src` (static, bare and dynamic; type-only statements dropped). */
export function runtimeSpecifiers(src: string): string[] {
  const code = stripComments(src).replace(/\b(?:import|export)\s+type\b[^;]*?\bfrom\s*['"][^'"]+['"]/g, '')
  const out: string[] = []
  const patterns = [
    /\b(?:import|export)\b[^;'"`]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /(?:^|[;\n])\s*import\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) for (const m of code.matchAll(re)) out.push(m[1]!)
  return out
}

/** The `ui-*` tags `src` renders: `<ui-x` in a template or `createElement('ui-x')`, comments stripped. */
export function renderedTags(src: string): string[] {
  const code = stripComments(src)
  const tags = new Set<string>()
  for (const m of code.matchAll(/<(ui-[a-z][a-z0-9-]*)/g)) tags.add(m[1]!)
  for (const m of code.matchAll(/createElement\(\s*['"](ui-[a-z][a-z0-9-]*)['"]/g)) tags.add(m[1]!)
  return [...tags]
}

/** The `ui-*` tags `src` defines with `customElements.define('ui-x', …)`. */
export function definedTags(src: string): string[] {
  return [...stripComments(src).matchAll(/customElements\.define\(\s*['"](ui-[a-z][a-z0-9-]*)['"]/g)].map((m) => m[1]!)
}

export interface ReachWorld {
  readonly appRoot: string // e.g. `packages/agent-ui/app/src`
  readonly componentsRoot: string // e.g. `packages/agent-ui/components/src`
  readonly read: Read
  /** `@agent-ui/components/controls/*` specifier → repo path, or undefined when it is not one. */
  readonly resolveControl: (specifier: string) => string | undefined
  /** Every fleet tag (defined by some components control module). */
  readonly fleetTags: ReadonlySet<string>
}

/**
 * `"{app module}: {tag}"` for every fleet tag an app module reached from `entry` renders but no fleet module
 * reached from `entry` defines. Each export target is its own graph: a consumer may import only that one.
 */
export function unreachedFrom(entry: string, world: ReachWorld): string[] {
  const seen = new Set<string>()
  const appModules: string[] = []
  const defined = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)
    const src = world.read(path)
    if (src === undefined) continue
    const inApp = path.startsWith(`${world.appRoot}/`)
    if (inApp) appModules.push(path)
    else for (const tag of definedTags(src)) defined.add(tag)
    for (const spec of runtimeSpecifiers(src)) {
      const bare = spec.split('?')[0]!
      let target: string | undefined
      if (bare.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(path), bare))
      else if (inApp) target = world.resolveControl(bare)
      if (target !== undefined && target.endsWith('.ts')) queue.push(target)
    }
  }
  const out: string[] = []
  for (const path of appModules) {
    for (const tag of renderedTags(world.read(path)!)) {
      if (world.fleetTags.has(tag) && !defined.has(tag)) out.push(`${path}: ${tag}`)
    }
  }
  return out
}

/** `unreachedFrom` over every entry, deduplicated and sorted. */
export function unreachedTags(entries: readonly string[], world: ReachWorld): string[] {
  return [...new Set(entries.flatMap((entry) => unreachedFrom(entry, world)))].sort()
}

// ── the real app package ──────────────────────────────────────────────────────

const readRepo: Read = (path) => {
  const abs = posix.join(ROOT, path)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : undefined
}

const json = (path: string): { exports: Record<string, string> } => JSON.parse(readRepo(path)!)

function realWorld(): ReachWorld {
  const componentsExports = json(`${COMPONENTS}/package.json`).exports
  const fleetTags = new Set<string>()
  const controlsDir = `${COMPONENTS}/src/controls`
  for (const dir of readdirSync(posix.join(ROOT, controlsDir), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    for (const file of readdirSync(posix.join(ROOT, controlsDir, dir.name))) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
      for (const tag of definedTags(readRepo(`${controlsDir}/${dir.name}/${file}`)!)) fleetTags.add(tag)
    }
  }
  return {
    appRoot: `${APP}/src`,
    componentsRoot: `${COMPONENTS}/src`,
    read: readRepo,
    resolveControl: (spec) => {
      const prefix = '@agent-ui/components/controls/'
      if (!spec.startsWith(prefix)) return undefined
      const target = componentsExports[`./controls/${spec.slice(prefix.length)}`]
      return target === undefined ? undefined : posix.join(COMPONENTS, target)
    },
    fleetTags,
  }
}

function appEntries(): string[] {
  return Object.values(json(`${APP}/package.json`).exports)
    .filter((target) => target.endsWith('.ts'))
    .map((target) => posix.join(APP, target))
}

describe('control reach: every fleet tag an app module renders is defined by its own imports (ADR-0233)', () => {
  it('anti-vacuous: the world finds the fleet, the entries, and rendering app modules', () => {
    const world = realWorld()
    expect(world.fleetTags.has('ui-switch')).toBe(true)
    expect(world.fleetTags.has('ui-card-header')).toBe(true)
    const entries = appEntries()
    expect(entries.length).toBeGreaterThan(20)
    for (const entry of entries) expect(readRepo(entry), entry).toBeDefined()
    const composer = readRepo(`${APP}/src/controls/conversation/conversation-composer.ts`)!
    expect(renderedTags(composer)).toContain('ui-switch')
  })

  it('every fleet tag a reached app module renders is defined by a reached fleet module', () => {
    expect(unreachedTags(appEntries(), realWorld())).toEqual([])
  })
})

describe('control reach: the crawler bites (in-memory fixtures)', () => {
  const files: Record<string, string> = {
    'fx/components/src/controls/switch/switch.ts': `customElements.define('ui-switch', class extends HTMLElement {})`,
    'fx/components/src/controls/card/card.ts': `import './card-header.ts'\ncustomElements.define('ui-card', class extends HTMLElement {})`,
    'fx/components/src/controls/card/card-header.ts': `customElements.define('ui-card-header', class extends HTMLElement {})`,
  }
  const world = (extra: Record<string, string>): ReachWorld => ({
    appRoot: 'fx/app/src',
    componentsRoot: 'fx/components/src',
    read: (path) => extra[path] ?? files[path],
    resolveControl: (spec) => {
      const m = /^@agent-ui\/components\/controls\/([a-z-]+)$/.exec(spec)
      return m === null ? undefined : `fx/components/src/controls/${m[1]}/${m[1]}.ts`
    },
    fleetTags: new Set(['ui-switch', 'ui-card', 'ui-card-header']),
  })

  it('negative control: an app module rendering <ui-switch> with no import of it is flagged', () => {
    const app = { 'fx/app/src/entry.ts': 'const t = html`<ui-switch label="x"></ui-switch>`' }
    expect(unreachedTags(['fx/app/src/entry.ts'], world(app))).toEqual(['fx/app/src/entry.ts: ui-switch'])
  })

  it('negative control: createElement of an unimported fleet tag, reached through a relative helper, is flagged', () => {
    const app = {
      'fx/app/src/entry.ts': "import { make } from './helper.ts'",
      'fx/app/src/helper.ts': "export const make = () => document.createElement('ui-switch')",
    }
    expect(unreachedTags(['fx/app/src/entry.ts'], world(app))).toEqual(['fx/app/src/helper.ts: ui-switch'])
  })

  it('a type-only import of the control does not count as defining it', () => {
    const app = {
      'fx/app/src/entry.ts': "import type { UISwitchElement } from '@agent-ui/components/controls/switch'\nconst t = html`<ui-switch></ui-switch>`",
    }
    expect(unreachedTags(['fx/app/src/entry.ts'], world(app))).toEqual(['fx/app/src/entry.ts: ui-switch'])
  })

  it('negative control: each entry is its own graph; a sibling entry importing the control does not cover it', () => {
    const app = {
      'fx/app/src/a.ts': "import '@agent-ui/components/controls/switch'\nconst t = html`<ui-switch></ui-switch>`",
      'fx/app/src/b.ts': "const t = html`<ui-switch></ui-switch>`",
    }
    expect(unreachedTags(['fx/app/src/a.ts', 'fx/app/src/b.ts'], world(app))).toEqual(['fx/app/src/b.ts: ui-switch'])
  })

  it('positive: a side-effect or dynamic import of the control satisfies it, sub-elements included', () => {
    const app = {
      'fx/app/src/entry.ts': "import '@agent-ui/components/controls/switch'\nimport('./lazy.ts')\nconst t = html`<ui-switch></ui-switch>`",
      'fx/app/src/lazy.ts': "await import('@agent-ui/components/controls/card')\nconst t = html`<ui-card><ui-card-header></ui-card-header></ui-card>`",
    }
    expect(unreachedTags(['fx/app/src/entry.ts'], world(app))).toEqual([])
  })

  it('a nested template holding a URL does not hide a later tag', () => {
    const app = {
      'fx/app/src/entry.ts': "const t = html`${ok ? html`<a href=\"https://x.dev/a\">x</a>` : ''}<ui-switch></ui-switch>`",
    }
    expect(unreachedTags(['fx/app/src/entry.ts'], world(app))).toEqual(['fx/app/src/entry.ts: ui-switch'])
  })

  it('comments and non-fleet tags are ignored', () => {
    const app = { 'fx/app/src/entry.ts': '// renders <ui-switch> later\n/* createElement(\'ui-card\') */\nconst t = html`<ui-super-shell></ui-super-shell>`' }
    expect(unreachedTags(['fx/app/src/entry.ts'], world(app))).toEqual([])
  })
})
