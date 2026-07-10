// site/lib/build-css.ts — the shared REAL `vite build` shell-out + CSS-asset-join mechanics
// (light-dark-minify.test.ts's own mechanism, factored out per the ui-theme-provider LLD's LLD-C11 so the
// ui-theme-provider build-freshness gate reuses it verbatim rather than forking a second copy). NODE-context
// only (spawnSync/fs) — never imported by a `.browser.test.ts` (LLD-C11: the browser project executes its
// test module IN the browser and cannot shell out or read files; it consumes a COMMITTED fixture instead —
// see theme-provider-build.browser.test.ts).
// @ts-expect-error - node:fs/node:child_process are typed via @types/node; vitest/node resolves them at
// runtime (site/tsconfig.json deliberately excludes "node" from its `types` array — see
// light-dark-minify.test.ts's own banner for the full ambient-declaration rationale).
import { mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
// @ts-expect-error - see above
import { spawnSync } from 'node:child_process'

declare const process: { platform: string; pid: number }

/**
 * buildSiteCss — run a REAL `vite build` (against the repo's real vite.config.ts) into a scratch --outDir
 * (never the real `dist/`), then read + join every emitted CSS asset into one string, in the SAME shape it
 * will ship. Removes its OWN scratch dir before running (so a stale prior run cannot leak in); the CALLER
 * removes it again afterward — each caller owns its own scratch dir name so parallel callers cannot
 * collide (mirrors light-dark-minify.test.ts's own try/finally shape).
 */
export function buildSiteCss(root: string, scratchOutDir: string): string {
  rmSync(scratchOutDir, { recursive: true, force: true })
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'build', '--outDir', scratchOutDir, '--emptyOutDir', '--logLevel', 'silent'],
    { cwd: root, encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(`vite build failed:\n${result.stdout}\n${result.stderr}`)

  const assetsDir = `${scratchOutDir}/assets`
  // SORTED — content-hashed filenames are themselves deterministic (same source ⇒ same hash), but
  // `readdirSync`'s OWN return order is filesystem-delivery order, not guaranteed stable across separate
  // build runs. A fixed alphabetical order makes the joined text byte-identical run-to-run (load-bearing for
  // theme-provider-build-fixture.test.ts's LLD-C11 freshness comparison); harmless for
  // light-dark-minify.test.ts's `.toContain(...)` checks, which never depended on join order.
  const cssFiles = (readdirSync(assetsDir) as string[]).filter((f: string) => f.endsWith('.css')).sort()
  if (cssFiles.length === 0) throw new Error(`buildSiteCss: zero .css assets emitted under ${assetsDir}`)
  return cssFiles.map((f: string) => readFileSync(`${assetsDir}/${f}`, 'utf8') as string).join('\n')
}

// ── the single-flight shared-build cache ──────────────────────────────────────────────────────────────────
//
// MEASURED regression (not theoretical): `light-dark-minify.test.ts` and `theme-provider-build-fixture.test.ts`
// (LLD-C11) both need the IDENTICAL real production CSS text. Left as two independent `buildSiteCss()` calls,
// vitest can run both test FILES concurrently, so two real `vite build`s race in the same `npm test`
// invocation — reproduced: under this environment's CPU budget, the two concurrent builds intermittently
// starve an UNRELATED macrotask-timing test elsewhere in the suite (site/pages/a2a-tic-tac-toe.live.test.ts),
// which passes 100% of the time with either build alone. `buildSiteCssShared` below eliminates the race:
// whichever caller acquires the lock FIRST runs the one real build and caches it; every other concurrent
// caller waits and reuses that SAME result instead of shelling out a second build. Scoped entirely to this
// one helper module — no shared vitest config touched (LLD-C11 already rejected that route for the browser
// project's own fixture-passing problem; the same "touch zero shared infrastructure" reasoning applies here).
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

/**
 * buildSiteCssShared — the SAME real production CSS text `buildSiteCss()` produces, single-flight across
 * concurrent callers within one `npm test` invocation (see the file-banner rationale above). An atomic
 * `mkdirSync` (throws EEXIST if the dir already exists) is the lock primitive — portable, no extra
 * dependency. A caller that cannot acquire the lock polls (event-loop `setTimeout`, never a CPU busy-wait)
 * until either a fresh cache appears or `LOCK_MAX_WAIT_MS` elapses, at which point it self-heals by clearing
 * the (presumed-abandoned) lock and building independently rather than hanging forever.
 */
export async function buildSiteCssShared(root: string, scratchOutDir: string): Promise<string> {
  const cacheDir = `${root}/dist-shared-build-cache`
  const cacheFile = `${cacheDir}/all.css`
  const lockDir = `${cacheDir}/.lock`

  const fresh = readFreshCache(root, cacheFile)
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
      const built = buildSiteCss(root, scratchOutDir)
      writeCacheAtomically(cacheFile, built)
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
    const nowFresh = readFreshCache(root, cacheFile)
    if (nowFresh !== null) return nowFresh
  }
  // The lock-holder never finished in time (most likely a crashed/hung process, not a slow build) — clear
  // the abandoned lock (best-effort) and fall back to an independent build rather than hang the suite.
  try {
    rmdirSync(lockDir)
  } catch {
    // already cleared by someone else, or genuinely gone — either way, proceed
  }
  return buildSiteCss(root, scratchOutDir)
}
