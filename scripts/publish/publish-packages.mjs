// publish-packages.mjs — builds and publishes the 8 @agent-ui/* workspace packages to the public npm
// registry, SCOPED under the `agent-ui-kit` npm ORG (@agent-ui-kit/shared, @agent-ui-kit/components, …).
//
// WHY @agent-ui-kit/* (Kim-ruled 2026-07-19, supersedes the launch-day unscoped agent-ui-* names): npm
// requires a scoped package's `@scope` to match an owning org/user — the `agent-ui-kit` org now exists,
// so the packages live natively under it, and the redundant `agent-ui-` prefix drops (the scope carries
// the branding). This repo's packages stay `@agent-ui/*` INTERNALLY (naming law, hundreds of imports,
// tsconfig `paths`) — this script transforms a COPY of each package's package.json (published name, real
// version, dependency versions resolved) into a scratch publish directory and publishes THAT. The public
// install name (`@agent-ui-kit/components`) therefore differs from the internal import specifier
// (`@agent-ui/components`). The launch-day unscoped `agent-ui-*@0.0.2` set was fully UNPUBLISHED the
// same day — those 8 names no longer exist on the registry; never publish to them again.
//
// WHY a build step: every package's `exports` map points straight at `.ts` source (this monorepo's own
// Vite/Rolldown resolves that directly) — most external npm consumers can't import raw `.ts` from
// node_modules. This script runs a real `tsc` library build first (tsconfig.build.json, repo root) emitting
// `dist-lib/<pkg>/src/**/*.{js,d.ts}`, then copies each package's own slice — plus its CSS assets (tsc
// doesn't touch those) — into its scratch publish dir.
//
// Usage:
//   node scripts/publish/publish-packages.mjs <version> [--dry-run]
//   <version>   the lockstep semver every package publishes as (e.g. 0.1.0) — the CI workflow derives this
//               from the pushed git tag (v0.1.0 -> 0.1.0); every internal @agent-ui/* dependency gets
//               rewritten to the SAME version (all 8 packages release together, always in sync).
//   --dry-run   passes --dry-run to `npm publish` (packs + validates, never uploads) — the safety-net path
//               for the workflow's manual workflow_dispatch trigger and for local testing.
//
// CONSUMER-PROFILE — a deliberate, Kim-ratified decision (not a silent default): `agent-ui-app`'s
// app-shell.ts uses Vite-only import-query specifiers — `?url` (x2) and `?raw` (x1), e.g.
// `import ISOLATION_GRID_CSS from './app-shell-isolation.css?raw'`. tsc passes these through VERBATIM (it
// doesn't understand the query suffix), so the compiled dist/ output only resolves under a Vite/Rolldown-
// family bundler — plain Node ESM, webpack, and esbuild consumers will fail to import agent-ui-app's root
// barrel. Confined to exactly this one file (checked repo-wide). Accepted as-is: agent-ui-app's real
// consumer profile is Vite-family bundlers, not "any npm consumer" — reworking these 3 imports to a
// portable form is a real future option, not a defect to fix here.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DIST_LIB = join(REPO_ROOT, 'dist-lib')
const SCRATCH = join(REPO_ROOT, '.publish')
// The 'git+' prefix is what npm itself normalizes a bare https git URL to (confirmed in review: writing it
// pre-normalized silences npm's own "repository.url was normalized" warning on every publish).
const REPO_URL = 'git+https://github.com/kimgranlund/agent-ui.git'

// Publish order = topological (every package after everything it depends on) — not required for the BUILD
// step (tsc type-checks the whole monorepo as one program, paths already resolve any sibling), but keeps a
// fresh `npm install agent-ui-app` from ever hitting a transient window where a dependency it needs isn't
// on the registry yet. Mirrors CLAUDE.md's own documented DAG: shared/icons/a2a have no @agent-ui/* deps;
// components depends on shared+icons; router/code/a2ui depend on components(+shared); app depends on all.
const PACKAGE_ORDER = ['shared', 'icons', 'a2a', 'components', 'router', 'code', 'a2ui', 'app']

// npm-page metadata (publish concern, so it lives here, not in the workspace manifests): shared base
// keywords + a per-package flavor. `description` is single-sourced from each workspace package.json.
const BASE_KEYWORDS = ['agent-ui', 'web-components', 'custom-elements', 'design-system']
const PACKAGE_KEYWORDS = {
  shared: ['design-tokens', 'css', 'material-design', 'theming'],
  icons: ['icons', 'phosphor'],
  a2a: ['a2a', 'agent2agent', 'protocol', 'agents'],
  components: ['ui-components', 'signals', 'light-dom', 'form-controls', 'accessibility'],
  router: ['router', 'spa'],
  code: ['syntax-highlighting', 'markdown', 'code-editor', 'codemirror'],
  a2ui: ['a2ui', 'generative-ui', 'agents', 'renderer'],
  app: ['app-shell', 'chat', 'agent-admin'],
}
const HOMEPAGE = 'https://github.com/kimgranlund/agent-ui#readme'
const BUGS_URL = 'https://github.com/kimgranlund/agent-ui/issues'

const toPublished = (internalName) => internalName.replace('@agent-ui/', '@agent-ui-kit/')

// Exports subpaths that exist for INTERNAL monorepo consumption (site's own workspace-linked imports) but
// must NOT ship in the published package — each entry is a real bug an independent review caught by
// packing a dry-run payload and tracing what actually breaks for an external consumer, not a style choice:
//   a2ui "./agent" — the NODE-FIRST producer toolkit (system-prompt.ts/mini-skills.ts) reads its prompt
//   `.md` files via `${process.cwd()}/packages/agent-ui/a2ui/src/agent/prompts` at MODULE LOAD — a path
//   that cannot exist in any consumer's install, so `import 'agent-ui-a2ui/agent'` throws immediately, and
//   the `.md` files aren't packed anyway. "./agent/meta-line" (a separate, pure, type-only subpath) is
//   UNAFFECTED and stays published. Shipping the producer toolkit for real (packing the prompts, resolving
//   them via `import.meta.url` instead of cwd) is a separate, deliberate effort — not a silent default here.
const EXCLUDE_EXPORTS_FROM_PUBLISH = {
  '@agent-ui/a2ui': ['./agent'],
}

/** Rewrite one dependency map: `@agent-ui/X` keys -> the published scoped name + the lockstep version; every other
 *  (real, external) dependency passes through with its own declared range untouched. */
function transformDeps(deps, version) {
  if (!deps) return undefined
  const out = {}
  for (const [key, value] of Object.entries(deps)) {
    out[key.startsWith('@agent-ui/') ? toPublished(key) : key] = key.startsWith('@agent-ui/') ? `^${version}` : value
  }
  return out
}

/** Rewrite one `exports` map entry: EVERY string value first repoints its `./src/` prefix to `./dist/` —
 *  not just `.css`/`.ts` — since a glob/wildcard entry (e.g. shared's `"./themes/*": "./src/tokens/themes/*"`)
 *  ends in neither suffix and was silently left pointing at `./src/` (a real bug an independent review
 *  caught by inspecting a packed dry-run payload: `files: ["dist"]` never ships `src/`, so that subpath was
 *  unresolvable for every consumer). A `.ts` value additionally becomes a {types, default} pair pointing at
 *  the compiled `.d.ts` + `.js` — the standard modern npm-package dual (types + runtime) export shape. */
function transformExportValue(value) {
  if (typeof value !== 'string') return value
  const distValue = value.replace(/^\.\/src\//, './dist/')
  if (value.endsWith('.ts')) {
    return { types: distValue.replace(/\.ts$/, '.d.ts'), default: distValue.replace(/\.ts$/, '.js') }
  }
  return distValue
}

/** Build the transformed, publish-ready package.json for one package — never mutates the real one on disk. */
function transformPackageJson(pkgJson, version) {
  const excluded = new Set(EXCLUDE_EXPORTS_FROM_PUBLISH[pkgJson.name] ?? [])
  const exportsOut = {}
  for (const [key, value] of Object.entries(pkgJson.exports ?? {})) {
    if (excluded.has(key)) continue
    exportsOut[key] = transformExportValue(value)
  }
  const pkgDir = pkgJson.name.replace('@agent-ui/', '')
  return {
    name: toPublished(pkgJson.name),
    version,
    description: pkgJson.description, // single-sourced from the workspace manifest
    keywords: [...BASE_KEYWORDS, ...(PACKAGE_KEYWORDS[pkgDir] ?? [])],
    license: 'MIT', // matches the root LICENSE file — Kim's decision
    homepage: HOMEPAGE,
    bugs: { url: BUGS_URL },
    type: pkgJson.type,
    repository: { type: 'git', url: REPO_URL, directory: `packages/agent-ui/${pkgJson.name.replace('@agent-ui/', '')}` },
    exports: exportsOut,
    ...(pkgJson.dependencies ? { dependencies: transformDeps(pkgJson.dependencies, version) } : {}),
    ...(pkgJson.optionalDependencies
      ? { optionalDependencies: transformDeps(pkgJson.optionalDependencies, version) }
      : {}),
    ...(pkgJson.peerDependencies ? { peerDependencies: transformDeps(pkgJson.peerDependencies, version) } : {}),
    // devDependencies deliberately dropped — irrelevant to a published package (never installed transitively)
    // and several reference @agent-ui/* packages by their internal scoped name, which would be a phantom,
    // unresolvable reference in the published metadata otherwise.
    files: ['dist'],
  }
}

/** Every `@agent-ui/X` specifier (bare, or as a subpath prefix like `@agent-ui/components/controls/text`)
 *  becomes `@agent-ui-kit/X` — applied to compiled JS + declarations, since the published sibling packages
 *  exist ONLY under the scoped name; a leftover `@agent-ui/*` specifier in emitted code would 404 at install.
 *  Also rewrites a relative `./foo.ts` / `../foo.ts` specifier to `.js` INSIDE .d.ts files only — confirmed
 *  empirically that `rewriteRelativeImportExtensions` (tsconfig.build.json) fixes this in compiled .js but
 *  NOT in .d.ts declaration output; a specifier ending in `.ts` there matches the standard, universally-
 *  resolvable `.js`-in-.d.ts-referencing-a-.d.ts convention every TS-authored npm package already relies on.
 *
 *  KNOWN HAZARD (flagged in review, not fixed here): this is a BLIND `replaceAll` over the whole file text,
 *  not scoped to import/export/`@import` specifier positions — it also mutates matching STRING LITERALS,
 *  e.g. a log/warning tag like `[@agent-ui/icons]` becomes `[@agent-ui-kit/icons]` in the published output,
 *  drifting from the repo's own source text. Cosmetic today (nothing currently asserts on such a literal),
 *  but a latent behavior-drift risk if one ever becomes load-bearing (a test string-matching a warning tag,
 *  for instance). Narrowing this to actual specifier positions is a real follow-up, not done here. */
function rewriteSpecifiers(content, isDeclaration) {
  let out = content
  for (const pkg of PACKAGE_ORDER) out = out.replaceAll(`@agent-ui/${pkg}`, `@agent-ui-kit/${pkg}`)
  if (isDeclaration) out = out.replace(/(['"])(\.\.?\/[^'"]*?)\.ts\1/g, '$1$2.js$1')
  return out
}

/** Recursively copy every file under `srcDir` whose NAME matches `include(fileName)` into `destDir`,
 *  applying `transform(content, fileName)` to each file's text before writing. */
function copyTree(srcDir, destDir, include, transform) {
  if (!existsSync(srcDir)) return
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const from = join(srcDir, entry.name)
    const to = join(destDir, entry.name)
    if (entry.isDirectory()) {
      copyTree(from, to, include, transform)
    } else {
      if (!include(entry.name)) continue
      mkdirSync(dirname(to), { recursive: true })
      const content = readFileSync(from, 'utf8')
      writeFileSync(to, transform ? transform(content, entry.name) : content)
    }
  }
}

/** True iff `name@version` already exists on the registry — makes a re-run after a partial failure
 *  RESUMABLE: 8 sequential `npm publish` calls means a failure at package k otherwise leaves 1..k-1 live at
 *  that version, and a naive re-run then dies immediately at package 1 with E403 (npm never allows
 *  republishing an existing version), permanently stranding the DAG half-published (caught in review). */
function isAlreadyPublished(name, version) {
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], { stdio: 'pipe' })
    return true
  } catch {
    return false // E404 (not found) is the expected "not yet published" case
  }
}

function runBuild() {
  rmSync(DIST_LIB, { recursive: true, force: true })
  execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json'], { cwd: REPO_ROOT, stdio: 'inherit' })
}

function preparePackage(pkgDir, version) {
  const pkgRoot = join(REPO_ROOT, 'packages/agent-ui', pkgDir)
  const pkgJson = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
  const publishedName = toPublished(pkgJson.name)
  const scratchRoot = join(SCRATCH, publishedName.replace('/', '__'))
  rmSync(scratchRoot, { recursive: true, force: true })
  mkdirSync(scratchRoot, { recursive: true })

  // Compiled JS + .d.ts + .json (tsc's own output for this package's slice of the whole-monorepo build).
  // .json matters: `resolveJsonModule` lets source do `import catalogDoc from './catalog.json'` — tsc
  // copies the JSON alongside the compiled JS as part of its own emit, and omitting it here (a real bug an
  // independent review caught) leaves that import unresolvable for every consumer of the affected package.
  copyTree(
    join(DIST_LIB, pkgDir, 'src'),
    join(scratchRoot, 'dist'),
    (fileName) => fileName.endsWith('.js') || fileName.endsWith('.d.ts') || fileName.endsWith('.json'),
    (content, fileName) => (fileName.endsWith('.json') ? content : rewriteSpecifiers(content, fileName.endsWith('.d.ts'))),
  )
  // CSS assets (tsc never touches non-.ts files) — same relative path under dist/, and the SAME @agent-ui/*
  // -> agent-ui-* rewrite as compiled JS/d.ts: several sheets `@import '@agent-ui/shared/tokens.css'` etc,
  // a real load-bearing specifier a bundler resolves, not just a comment (caught in the smoke test — the
  // published sibling only exists under its scoped name).
  copyTree(
    join(pkgRoot, 'src'),
    join(scratchRoot, 'dist'),
    (fileName) => fileName.endsWith('.css'),
    (content) => rewriteSpecifiers(content, false),
  )

  // README + LICENSE ship with every package (npm renders the package page from README and only
  // auto-packs both from the PACKAGE root — which at publish time is this scratch dir). READMEs are
  // authored against the PUBLISHED names already (no specifier rewrite) — but their CDN examples pin
  // versions, and a hand-pinned version rots one release later: rewrite every
  // `@agent-ui-kit/<pkg>@<semver>` pin to THIS release's version at publish time.
  const readmePath = join(pkgRoot, 'README.md')
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, 'utf8').replace(/@agent-ui-kit\/([a-z0-9-]+)@\d+\.\d+\.\d+/g, `@agent-ui-kit/$1@${version}`)
    writeFileSync(join(scratchRoot, 'README.md'), readme)
  }
  writeFileSync(join(scratchRoot, 'LICENSE'), readFileSync(join(REPO_ROOT, 'LICENSE'), 'utf8'))

  writeFileSync(join(scratchRoot, 'package.json'), `${JSON.stringify(transformPackageJson(pkgJson, version), null, 2)}\n`)
  return { publishedName, scratchRoot }
}

async function main() {
  const [version, ...flags] = process.argv.slice(2)
  if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    console.error('Usage: node scripts/publish/publish-packages.mjs <semver-version> [--dry-run]')
    console.error(`Got version: ${JSON.stringify(version)}`)
    process.exit(1)
  }
  const dryRun = flags.includes('--dry-run')

  console.log(`\n=== Building all packages (tsc -p tsconfig.build.json) ===`)
  runBuild()

  rmSync(SCRATCH, { recursive: true, force: true })
  for (const pkgDir of PACKAGE_ORDER) {
    console.log(`\n=== ${pkgDir} ===`)
    const { publishedName, scratchRoot } = preparePackage(pkgDir, version)
    console.log(`  prepared ${publishedName}@${version} at ${relative(REPO_ROOT, scratchRoot)}`)
    if (isAlreadyPublished(publishedName, version)) {
      console.log(`  ${publishedName}@${version} is already on the registry — skipping (resumable re-run)`)
      continue
    }
    const publishArgs = ['publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])]
    execFileSync('npm', publishArgs, { cwd: scratchRoot, stdio: 'inherit' })
  }
  console.log(`\n=== Done: ${PACKAGE_ORDER.length} packages ${dryRun ? '(dry-run) ' : ''}published at ${version} ===`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
