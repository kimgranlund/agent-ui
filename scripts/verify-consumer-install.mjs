// verify-consumer-install.mjs — the install-from-registry consumer smoke (GH #71). Every release up to now
// is verified at the TARBALL level only (dry-run pack + a registry-existence check, publish-packages.mjs).
// Nothing proves the INSTALLED experience — the v0.0.2->0.0.5 arc surfaced exactly the class of gaps only
// this catches: bare `@import`s in foundation-styles.css a real bundler can't resolve, the app package's
// `?raw`/`?url` constraint, sibling-specifier rewrites gone wrong. This script proves that experience
// directly:
//
//   1. scaffolds a minimal Vite consumer app in a scratch temp dir OUTSIDE this repo/workspace (never a
//      local link/workspace resolution — `npm workspaces` never sees it, so nothing here can silently
//      resolve through THIS repo's own `packages/agent-ui/*` sources instead of the published tarball)
//   2. `npm install`s the real `@agent-ui-kit/{shared,icons,components}` packages (the core path) at a given
//      version from the REAL npm registry
//   3. `vite build`s it — proving the bare-specifier + CSS `@import` chain resolves the way a real
//      consumer's bundler resolves it, not the way this monorepo's own workspace-symlinked node_modules do
//   4. inspects the built output for real component code/CSS (not a stub), then drives it in a real
//      headless browser (Playwright — borrowed from THIS repo's own devDependency as TEST INFRASTRUCTURE;
//      it is never installed into the scratch consumer app, so it is not part of what a consumer pulls) to
//      assert `<ui-button>` genuinely upgrades and renders with real component CSS applied
//   5. independently fetches one of the README's documented esm.sh CDN URLs and confirms it actually 200s
//      with real JS/CSS, not a 404/error page — the CDN (no-build-step) recipe stays honest too
//
// Red when a published artifact breaks consumers even if the repo's own gates (`npm run check && npm test`)
// are green — this deliberately never imports anything from `packages/agent-ui/*` source.
//
// Usage:
//   node scripts/verify-consumer-install.mjs [version] [--keep]
//   [version]  the @agent-ui-kit/* semver to verify (e.g. 0.0.5). Omit to resolve the CURRENT
//              @agent-ui-kit/components `latest` dist-tag from the real registry.
//   --keep     don't delete the scratch consumer-app directory on success (debugging; always kept on failure)

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
// The core path (GH #71 acceptance): components + its two direct runtime deps, listed explicitly (not left
// to resolve transitively) so a future change that drops one of them from `dependencies` can't silently
// stop being covered.
const CORE_PACKAGES = ['shared', 'icons', 'components']

function resolveVersion(explicit) {
  if (explicit) return explicit
  console.log("No version given — resolving @agent-ui-kit/components's current `latest` dist-tag from the registry…")
  const out = execFileSync('npm', ['view', '@agent-ui-kit/components', 'version'], { encoding: 'utf8' })
  const version = out.trim()
  if (!version) throw new Error('could not resolve a published version of @agent-ui-kit/components — is anything published yet?')
  return version
}

function run(cmd, args, cwd) {
  console.log(`\n$ ${cmd} ${args.join(' ')}  (cwd: ${cwd})`)
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

/** Scaffold the minimal Vite consumer app: package.json (pinned at `version`, real npm — no workspace/link
 *  resolution possible since `dir` sits outside this repo), an HTML entry with a bare `<ui-button>`, and a
 *  main.js that is EXACTLY the README's documented "npm install" usage recipe
 *  (packages/agent-ui/components/README.md) — the consumer-facing contract this whole check exists to keep
 *  honest, not a bespoke import shape invented for the test. */
function scaffoldApp(dir, version) {
  const viteRange = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).devDependencies.vite
  const pkgJson = {
    name: 'agent-ui-consumer-smoke',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { build: 'vite build' },
    dependencies: Object.fromEntries(CORE_PACKAGES.map((p) => [`@agent-ui-kit/${p}`, version])),
    devDependencies: { vite: viteRange },
  }
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkgJson, null, 2)}\n`)
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>agent-ui consumer smoke</title></head>
  <body>
    <ui-button id="probe" variant="solid">Save</ui-button>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`,
  )
  writeFileSync(
    join(dir, 'main.js'),
    `// Exactly the README's documented "npm install" recipe — the recipe this whole check keeps honest.
import '@agent-ui-kit/components/foundation-styles.css'
import '@agent-ui-kit/components/component-styles.css'
import '@agent-ui-kit/components/components'

window.__consumerSmoke = { defined: !!customElements.get('ui-button') }
`,
  )
}

/** Locate the built JS/CSS assets and return their concatenated text, for the static content assertions
 *  below. Missing assets entirely is itself a failure worth a clear message, not a crash on readdirSync. */
function readBuiltAssets(distDir) {
  const assetsDir = join(distDir, 'assets')
  if (!existsSync(assetsDir)) throw new Error(`build produced no ${assetsDir} — vite build did not emit the expected output shape`)
  const files = readdirSync(assetsDir)
  const js = files.filter((f) => f.endsWith('.js'))
  const css = files.filter((f) => f.endsWith('.css'))
  if (js.length === 0) throw new Error(`build produced no .js assets under ${assetsDir}`)
  if (css.length === 0) throw new Error(`build produced no .css assets under ${assetsDir}`)
  return {
    jsText: js.map((f) => readFileSync(join(assetsDir, f), 'utf8')).join('\n'),
    cssText: css.map((f) => readFileSync(join(assetsDir, f), 'utf8')).join('\n'),
  }
}

/** Static-content leg: the built bundle must contain REAL fleet code/CSS, not stub/empty output — catches a
 *  build that silently produced an empty chunk (e.g. an unresolved import tree-shaken to nothing) before
 *  even reaching the browser. */
function assertRealBuildOutput({ jsText, cssText }) {
  if (!jsText.includes('customElements.define') || !jsText.includes('ui-button')) {
    throw new Error('built JS does not contain a ui-button customElements.define call — the fleet did not bundle in')
  }
  if (!cssText.includes('--ui-button-')) {
    throw new Error('built CSS does not contain --ui-button-* tokens — component-styles.css did not resolve into the build')
  }
  if (!cssText.includes('--md-sys-color-')) {
    throw new Error('built CSS does not contain --md-sys-color-* tokens — foundation-styles.css (the @agent-ui-kit/shared chain) did not resolve into the build')
  }
  console.log('  build output: real ui-button code + real --ui-button-*/--md-sys-color-* CSS present')
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }

/** Serve `distDir` as static files on an ephemeral local port; returns { url, close }. */
function serveDist(distDir) {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      const reqPath = req.url === '/' ? '/index.html' : req.url.split('?')[0]
      const filePath = join(distDir, decodeURIComponent(reqPath))
      if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
        res.writeHead(404)
        res.end('not found')
        return
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
      res.end(readFileSync(filePath))
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolvePromise({ url: `http://127.0.0.1:${port}/`, close: () => server.close() })
    })
  })
}

/** The runtime leg: launch a real headless browser (Playwright, resolved from THIS script's own module
 *  graph — i.e. this repo's node_modules, never the scratch app's) against the built dist/, and assert the
 *  control actually upgraded and rendered with real component CSS — not just that a bundle exists. */
async function assertRendersInBrowser(distDir) {
  const { chromium } = await import('playwright')
  const { url, close } = await serveDist(distDir)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    const pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(String(err)))

    await page.goto(url, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__consumerSmoke?.defined === true, undefined, { timeout: 10_000 })

    if (pageErrors.length > 0) throw new Error(`page threw during load: ${pageErrors.join('; ')}`)
    if (consoleErrors.length > 0) throw new Error(`console errors during load: ${consoleErrors.join('; ')}`)

    const result = await page.evaluate(() => {
      const el = document.getElementById('probe')
      const cs = getComputedStyle(el)
      return {
        isUpgraded: el.constructor.name !== 'HTMLElement' && el.constructor.name !== 'HTMLUnknownElement',
        height: el.getBoundingClientRect().height,
        buttonBg: cs.getPropertyValue('--ui-button-bg').trim(),
        backgroundColor: cs.backgroundColor,
      }
    })
    if (!result.isUpgraded) throw new Error(`<ui-button> did not upgrade to its custom-element class (still ${result.isUpgraded})`)
    if (!(result.height > 0)) throw new Error(`<ui-button> rendered with zero height (${result.height}) — component CSS did not apply`)
    if (!result.buttonBg) throw new Error('<ui-button> --ui-button-bg resolved empty — the token chain did not reach the rendered element')
    if (!result.backgroundColor || result.backgroundColor === 'rgba(0, 0, 0, 0)') {
      throw new Error(`<ui-button> rendered with a transparent background (${result.backgroundColor}) — solid-variant CSS did not apply`)
    }
    console.log(`  browser render: <ui-button> upgraded, height=${result.height}px, --ui-button-bg=${result.buttonBg}, backgroundColor=${result.backgroundColor}`)
  } finally {
    await browser.close()
    close()
  }
}

/** The second, independent check the acceptance criteria names: fetch the README's documented esm.sh CDN
 *  URLs for `version` and confirm each one actually 200s and returns real JS/CSS — not a 404/error page,
 *  which esm.sh returns as a 200 HTML document for some failure modes, hence the content sniff below. */
async function assertCdnRecipeIsHonest(version) {
  const checks = [
    { url: `https://esm.sh/@agent-ui-kit/shared@${version}/tokens.css`, kind: 'css' },
    { url: `https://esm.sh/@agent-ui-kit/components@${version}/component-styles.css`, kind: 'css' },
    { url: `https://esm.sh/@agent-ui-kit/components@${version}/components`, kind: 'js' },
  ]
  for (const { url, kind } of checks) {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`esm.sh CDN probe failed: ${url} -> HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') ?? ''
    const text = await res.text()
    const looksLikeErrorPage = /<html/i.test(text) || text.length < 20
    if (looksLikeErrorPage) throw new Error(`esm.sh CDN probe returned a non-${kind} payload (looks like an error page): ${url}`)
    if (kind === 'css' && !contentType.includes('css')) throw new Error(`esm.sh CDN probe: ${url} content-type ${contentType} is not CSS`)
    if (kind === 'js' && !/javascript/.test(contentType)) throw new Error(`esm.sh CDN probe: ${url} content-type ${contentType} is not JS`)
    console.log(`  CDN OK: ${url} (HTTP ${res.status}, ${contentType}, ${text.length} bytes)`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const keep = args.includes('--keep')
  const version = resolveVersion(args.find((a) => !a.startsWith('--')))

  console.log(`\n=== Consumer-install smoke: @agent-ui-kit/{${CORE_PACKAGES.join(',')}}@${version} ===`)

  const appDir = mkdtempSync(join(tmpdir(), 'agent-ui-consumer-smoke-'))
  console.log(`scratch app: ${appDir} (outside the repo/workspace — npm workspaces never sees it)`)

  try {
    console.log('\n--- 1/4: scaffold ---')
    scaffoldApp(appDir, version)

    console.log('\n--- 2/4: npm install (real registry) ---')
    run('npm', ['install', '--no-audit', '--no-fund'], appDir)

    console.log('\n--- 3/4: vite build ---')
    run('npx', ['vite', 'build'], appDir)
    const distDir = join(appDir, 'dist')
    const assets = readBuiltAssets(distDir)
    assertRealBuildOutput(assets)

    console.log('\n--- 4/4: real headless-browser render ---')
    await assertRendersInBrowser(distDir)

    console.log('\n--- CDN recipe (esm.sh, no build step) ---')
    await assertCdnRecipeIsHonest(version)

    console.log(`\n=== PASS: @agent-ui-kit@${version} installs, builds, and renders as consumers see it ===`)
  } catch (err) {
    console.error(`\n=== FAIL: ${err.message ?? err} ===`)
    console.error(`scratch app left at ${appDir} for inspection`)
    process.exitCode = 1
    return
  }

  if (keep) {
    console.log(`--keep passed — scratch app left at ${appDir}`)
  } else {
    rmSync(appDir, { recursive: true, force: true })
  }
}

main()
