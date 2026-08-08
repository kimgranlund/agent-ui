// site/lib/build-css.ts — the shared REAL `vite build` shell-out + built-asset-read mechanics
// (light-dark-minify.test.ts's own mechanism, factored out per the ui-theme-provider LLD's LLD-C11 so the
// ui-theme-provider build-freshness gate reuses it verbatim rather than forking a second copy; GH #576
// (SPEC-R9 AC2, identity-mock-transport.spec.md) widened it to ALSO read the emitted JS assets, so the
// prod-bundle symbol-absence probe shares this SAME real build rather than shelling out a second one — see
// the single-flight section below). NODE-context only (spawnSync/fs) — never imported by a
// `.browser.test.ts` (LLD-C11: the browser project executes its test module IN the browser and cannot shell
// out or read files; it consumes a COMMITTED fixture instead — see theme-provider-build.browser.test.ts).
// @ts-expect-error - node:fs/node:child_process are typed via @types/node; vitest/node resolves them at
// runtime (site/tsconfig.json deliberately excludes "node" from its `types` array — see
// light-dark-minify.test.ts's own banner for the full ambient-declaration rationale).
import { mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
// @ts-expect-error - see above
import { spawnSync } from 'node:child_process'

declare const process: { platform: string; pid: number; env: Record<string, string | undefined> }

/** One real production build's assets, read off disk (never the real `dist/`) — the CSS text (joined, same
 *  shape it will ship) plus every emitted JS chunk's raw text, keyed by filename (content-hashed, so the key
 *  set itself varies build-to-build — a consumer greps VALUES, never depends on a specific key). */
export interface SiteBuildAssets {
  css: string
  js: Record<string, string>
}

/**
 * buildSiteAssets — run a REAL `vite build` (against the repo's real vite.config.ts) into a scratch --outDir,
 * then read every emitted CSS asset (joined into one string, in the SAME shape it will ship) AND every
 * emitted JS asset (kept as a filename→text map — a symbol-grep probe needs per-chunk text, not a join).
 * Removes its OWN scratch dir before running (so a stale prior run cannot leak in); the CALLER removes it
 * again afterward — each caller owns its own scratch dir name so parallel callers cannot collide (mirrors
 * light-dark-minify.test.ts's own try/finally shape).
 *
 * ROOT CAUSE fix (GH #576 build): `vite build`'s own CLI defaults `mode` to `'production'`, but Vite
 * resolves `import.meta.env.DEV`/`PROD` (and therefore whether a `if (!import.meta.env.DEV) {...} else {
 * await import(...) }` branch tree-shakes away) off the INHERITED `NODE_ENV`, not the CLI's `--mode` flag —
 * `--mode production` alone does NOT override an already-set `NODE_ENV`. `vitest` sets `process.env.NODE_ENV
 * = 'test'` for its own process, which this spawned CHILD inherits by default — so every prior call site of
 * this helper (under `npm test`) has been silently building with `import.meta.env.DEV` effectively TRUE,
 * never a genuine production build. Invisible for the two CSS-only consumers (LightningCSS's minify pipeline
 * doesn't key off NODE_ENV/mode at all — verified byte-identical CSS output either way while building this
 * fix), but load-bearing for identity-mock-transport-prod-bundle.test.ts's DEV-fence probe (GH #576, SPEC-R9
 * AC2): reproduced BOTH ways manually — `NODE_ENV=test` (even WITH an explicit `--mode production` flag)
 * leaks the mock transport into a real chunk; `NODE_ENV=production` (or unset, i.e. a plain terminal build)
 * eliminates it, matching AC2's own ruling. Forcing it here, once, makes every current AND future caller's
 * build genuinely production-equivalent regardless of the invoking process's own env.
 */
export function buildSiteAssets(root: string, scratchOutDir: string): SiteBuildAssets {
  rmSync(scratchOutDir, { recursive: true, force: true })
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'build', '--outDir', scratchOutDir, '--emptyOutDir', '--logLevel', 'silent'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } },
  )
  if (result.status !== 0) throw new Error(`vite build failed:\n${result.stdout}\n${result.stderr}`)

  const assetsDir = `${scratchOutDir}/assets`
  // SORTED — content-hashed filenames are themselves deterministic (same source ⇒ same hash), but
  // `readdirSync`'s OWN return order is filesystem-delivery order, not guaranteed stable across separate
  // build runs. A fixed alphabetical order makes the joined CSS text byte-identical run-to-run (load-bearing
  // for theme-provider-build-fixture.test.ts's LLD-C11 freshness comparison); harmless for
  // light-dark-minify.test.ts's `.toContain(...)` checks and the JS symbol-grep probe, neither of which
  // depends on join/iteration order.
  const allFiles = (readdirSync(assetsDir) as string[]).sort()
  const cssFiles = allFiles.filter((f: string) => f.endsWith('.css'))
  const jsFiles = allFiles.filter((f: string) => f.endsWith('.js'))
  if (cssFiles.length === 0) throw new Error(`buildSiteAssets: zero .css assets emitted under ${assetsDir}`)
  if (jsFiles.length === 0) throw new Error(`buildSiteAssets: zero .js assets emitted under ${assetsDir}`)
  const css = cssFiles.map((f: string) => readFileSync(`${assetsDir}/${f}`, 'utf8') as string).join('\n')
  const js: Record<string, string> = {}
  for (const f of jsFiles) js[f] = readFileSync(`${assetsDir}/${f}`, 'utf8') as string
  return { css, js }
}

/** Back-compat/CSS-only convenience wrapper over `buildSiteAssets` — the two existing LLD-C11/TKT-0002
 *  callers only ever needed the joined CSS text; kept as its own named export rather than inlining
 *  `buildSiteAssets(...).css` at each call site. */
export function buildSiteCss(root: string, scratchOutDir: string): string {
  return buildSiteAssets(root, scratchOutDir).css
}

// ── the single-flight shared-build cache ──────────────────────────────────────────────────────────────────
//
// MEASURED regression (not theoretical): `light-dark-minify.test.ts` and `theme-provider-build-fixture.test.ts`
// (LLD-C11) both need the IDENTICAL real production CSS text. Left as two independent `buildSiteCss()` calls,
// vitest can run both test FILES concurrently, so two real `vite build`s race in the same `npm test`
// invocation — reproduced: under this environment's CPU budget, the two concurrent builds intermittently
// starve an UNRELATED macrotask-timing test elsewhere in the suite (site/pages/a2a-tic-tac-toe.live.test.ts),
// which passes 100% of the time with either build alone. The shared cache below eliminates the race:
// whichever caller acquires the lock FIRST runs the one real build and caches it; every other concurrent
// caller waits and reuses that SAME result instead of shelling out a second build. Scoped entirely to this
// one helper module — no shared vitest config touched (LLD-C11 already rejected that route for the browser
// project's own fixture-passing problem; the same "touch zero shared infrastructure" reasoning applies here).
//
// GH #576 (SPEC-R9 AC2) widened this from a CSS-only cache to a CSS+JS one: identity-mock-transport-prod-
// bundle.test.ts needs the SAME real build's emitted JS chunks (to grep for the mock transport's symbols) —
// giving it its OWN independent single-flight lock/cache would still cost a SECOND real `vite build` per
// `npm test` run (the exact failure mode this mechanism exists to avoid), just with one fewer racing pair.
// `buildSiteAssetsShared` (private) is the ONE lock/cache both artifact kinds now share; `buildSiteCssShared`
// and `buildSiteJsAssetsShared` are thin public extractors over its single cached `SiteBuildAssets` result —
// regardless of which of the three test files happens to run first (or concurrently) and trigger the actual
// build, the other two always find a fresh combined cache waiting.
//
// CORRECTNESS (HIGH-1, host review — reproduced): a cache keyed on TIME ALONE is a soundness hole — it can
// serve a stale result across the exact edit→rerun loop the LLD-C11 freshness gate exists to catch (warm
// cache, edit a real build input, rerun within the window ⇒ false green). The cache below is therefore keyed
// on REAL SOURCE FRESHNESS, not a blanket time window: it is valid only while its own mtime is NEWER than
// every file under the real build inputs (`site/`, `packages/`, and the root `vite.config.ts`) — the instant
// ANY of them changes, the cache is stale by construction, regardless of how recently it was written. A
// generous absolute ceiling (CACHE_MAX_AGE_MS) is kept ONLY as defense-in-depth against a long-orphaned cache
// from an old, unrelated run — it is not the correctness mechanism.

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Belt-and-suspenders only (see the CORRECTNESS note above) — real staleness is decided by source mtimes.
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const LOCK_POLL_MS = 100
// A real full-site `vite build` measures ~1-3s (light-dark-minify.test.ts's own measured figure); if the
// lock-holder hasn't finished in 60s, treat it as abandoned rather than hang the suite.
const LOCK_MAX_WAIT_MS = 60_000

// The real build inputs a change to which MUST invalidate the cache — directory roots (relative to `root`)
// plus one standalone file (`vite.config.ts`, at repo root, outside both directory roots but load-bearing for
// the build itself — e.g. the LightningCSS `Features.LightDark` exclude flag). Broad by design: an
// unnecessary rebuild costs ~1-3s; a false cache HIT that masks a real source edit is the defect this exists
// to prevent.
const SOURCE_DIR_ROOTS = ['site', 'packages'] as const
const SOURCE_STANDALONE_FILES = ['vite.config.ts'] as const
const EXCLUDED_DIR_NAMES = new Set(['node_modules', '.git', '.vite', '__screenshots__'])
const isScratchOrDist = (name: string): boolean => name === 'dist' || name.startsWith('dist-')

/**
 * newestSourceMtimeMs — the newest mtime (ms) among every file under `roots` (paths relative to `base`) plus
 * `standaloneFiles` (also relative to `base`), skipping node_modules/.git/dist-prefixed scratch dirs. Exported for
 * direct, cheap regression coverage of the HIGH-1 staleness fix (build-css.test.ts) — no real `vite build`
 * needed to prove the invalidation logic itself is correct, only real files on real disk.
 */
export function newestSourceMtimeMs(
  base: string,
  roots: readonly string[] = SOURCE_DIR_ROOTS,
  standaloneFiles: readonly string[] = SOURCE_STANDALONE_FILES,
): number {
  let newest = 0
  const note = (mtimeMs: number): void => {
    if (mtimeMs > newest) newest = mtimeMs
  }
  const walk = (dir: string): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return // a missing/unreadable dir contributes nothing (e.g. a roots entry that doesn't exist yet)
    }
    for (const entry of entries as { name: string; isDirectory(): boolean; isFile(): boolean }[]) {
      if (EXCLUDED_DIR_NAMES.has(entry.name) || isScratchOrDist(entry.name)) continue
      const full = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) {
        try {
          note(statSync(full).mtimeMs)
        } catch {
          // a file that vanished mid-walk (e.g. a concurrent scratch-dir cleanup elsewhere) — skip it
        }
      }
    }
  }
  for (const r of roots) walk(`${base}/${r}`)
  for (const f of standaloneFiles) {
    try {
      note(statSync(`${base}/${f}`).mtimeMs)
    } catch {
      // the standalone file is genuinely absent — contributes nothing
    }
  }
  return newest
}

/**
 * isCacheStale — a cache with mtime `cacheMtimeMs` is stale iff any REAL source is newer than it
 * (`sourceMtimeMs > cacheMtimeMs`, strict — a cache built FROM a given source state always has an mtime at
 * or after every source file that existed when the build ran, so equality/older-source means still fresh).
 * A pure predicate, exported so the HIGH-1 regression test can drive it directly with synthetic timestamps
 * as well as with the real-file walk above.
 */
export function isCacheStale(cacheMtimeMs: number, sourceMtimeMs: number): boolean {
  return sourceMtimeMs > cacheMtimeMs
}

/** The cached result, or null if absent/stale — real-source-mtime freshness (HIGH-1) first, the generous
 *  absolute-age ceiling second (defense-in-depth only, see the file-banner CORRECTNESS note). */
function readFreshCache(root: string, cacheFile: string): string | null {
  let cacheMtimeMs: number
  try {
    cacheMtimeMs = statSync(cacheFile).mtimeMs
  } catch {
    return null // no cache file yet
  }
  if (Date.now() - cacheMtimeMs > CACHE_MAX_AGE_MS) return null
  if (isCacheStale(cacheMtimeMs, newestSourceMtimeMs(root))) return null
  try {
    return readFileSync(cacheFile, 'utf8') as string
  } catch {
    return null // vanished between the stat and the read (a concurrent cleanup) — treat as absent
  }
}

/** Write `content` to `cacheFile` ATOMICALLY (LOW-1b, host review): a poller's `readFreshCache` must never
 *  observe a partially-written file. Write to a per-writer temp path, then `renameSync` — atomic on the same
 *  filesystem (POSIX), so a concurrent reader sees either the OLD file or the FULLY-written new one, never a
 *  truncation. The temp name embeds the pid so two writers (should the lock ever be double-held) cannot
 *  collide on the same temp path. */
function writeCacheAtomically(cacheFile: string, content: string): void {
  const tmp = `${cacheFile}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, content)
  renameSync(tmp, cacheFile)
}

/** Parse a cached JS-assets JSON blob back into its `Record<filename, text>` shape; `null` on ANY parse
 *  failure (a corrupted or pre-GH#576 cache written before this key existed) so the caller treats it exactly
 *  like a cache miss and rebuilds, rather than throwing mid-suite. */
function parseJsCache(raw: string | null): Record<string, string> | null {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return null
  }
}

/**
 * buildSiteAssetsShared — the SAME real production build's assets (`SiteBuildAssets`) `buildSiteAssets()`
 * produces, single-flight across concurrent callers within one `npm test` invocation (see the file-banner
 * rationale above) — private; `buildSiteCssShared`/`buildSiteJsAssetsShared` below are its public,
 * single-artifact extractors. An atomic `mkdirSync` (throws EEXIST if the dir already exists) is the lock
 * primitive — portable, no extra dependency. A caller that cannot acquire the lock polls (event-loop
 * `setTimeout`, never a CPU busy-wait) until either a fresh cache appears or `LOCK_MAX_WAIT_MS` elapses, at
 * which point it self-heals by clearing the (presumed-abandoned) lock and building independently rather than
 * hanging forever.
 */
async function buildSiteAssetsShared(root: string, scratchOutDir: string): Promise<SiteBuildAssets> {
  // Guard: a falsy/relative root once minted a literal `undefined/dist-shared-build-cache/` dir at the
  // caller's CWD (found at the 2026-07-12 repo-alignment sweep) — fail loud instead of littering.
  if (!root || !root.startsWith('/')) throw new Error(`buildSiteAssetsShared: root must be an absolute path, got ${JSON.stringify(root)}`)
  const cacheDir = `${root}/dist-shared-build-cache`
  const cssCacheFile = `${cacheDir}/all.css`
  const jsCacheFile = `${cacheDir}/all-js.json`
  const lockDir = `${cacheDir}/.lock`

  // BOTH cache files must be fresh — a lone stale/missing JS cache (e.g. a warm CSS cache left over from a
  // pre-GH#576 run that never wrote one) must NOT read as a full hit; it forces exactly one rebuild, which
  // then repopulates both together.
  const tryReadFresh = (): SiteBuildAssets | null => {
    const css = readFreshCache(root, cssCacheFile)
    const js = parseJsCache(readFreshCache(root, jsCacheFile))
    if (css === null || js === null) return null
    return { css, js }
  }

  const fresh = tryReadFresh()
  if (fresh !== null) return fresh

  mkdirSync(cacheDir, { recursive: true })
  let haveLock = false
  try {
    mkdirSync(lockDir) // atomic: throws EEXIST if another caller already holds it
    haveLock = true
  } catch {
    haveLock = false
  }

  if (haveLock) {
    try {
      const built = buildSiteAssets(root, scratchOutDir)
      writeCacheAtomically(cssCacheFile, built.css)
      writeCacheAtomically(jsCacheFile, JSON.stringify(built.js))
      return built
    } finally {
      // LOW-1b (host review): a waiter that timed out (LOCK_MAX_WAIT_MS) may already have cleared this SAME
      // lockDir and taken over — guard symmetrically with that waiter's own guarded clear below, so a slow-
      // but-successful holder's cleanup can never turn a successful build into a rejected promise.
      try {
        rmdirSync(lockDir)
      } catch {
        // already cleared by a waiter that gave up on us, or genuinely gone — either way, nothing to do
      }
    }
  }

  // Another caller holds the lock — wait for its result rather than building a second time concurrently.
  const deadline = Date.now() + LOCK_MAX_WAIT_MS
  while (Date.now() < deadline) {
    await sleep(LOCK_POLL_MS)
    const nowFresh = tryReadFresh()
    if (nowFresh !== null) return nowFresh
  }
  // The lock-holder never finished in time (most likely a crashed/hung process, not a slow build) — clear
  // the abandoned lock (best-effort) and fall back to an independent build rather than hang the suite.
  try {
    rmdirSync(lockDir)
  } catch {
    // already cleared by someone else, or genuinely gone — either way, proceed
  }
  return buildSiteAssets(root, scratchOutDir)
}

/** The joined production CSS text, single-flight-shared with every other caller (see the section banner
 *  above) — `light-dark-minify.test.ts` and `theme-provider-build-fixture.test.ts`'s existing consumer. */
export async function buildSiteCssShared(root: string, scratchOutDir: string): Promise<string> {
  return (await buildSiteAssetsShared(root, scratchOutDir)).css
}

/** Every emitted production JS chunk's raw text, keyed by (content-hashed) filename — single-flight-shared
 *  with the CSS consumers above, so identity-mock-transport-prod-bundle.test.ts's symbol-absence probe (GH
 *  #576, SPEC-R9 AC2) never triggers its own second real `vite build`. */
export async function buildSiteJsAssetsShared(root: string, scratchOutDir: string): Promise<Record<string, string>> {
  return (await buildSiteAssetsShared(root, scratchOutDir)).js
}
