// build-css.test.ts — HIGH-1 regression coverage (host review, reproduced): a warm shared-build cache must
// be INVALIDATED the instant any real build input changes — never silently reused, which would let
// theme-provider-build-fixture.test.ts / SPEC-R11 AC1 false-green through the exact edit→rerun loop the
// gate exists to catch. A CHEAP, real-filesystem probe of `newestSourceMtimeMs()`/`isCacheStale()` — the two
// pure building blocks the module's private `readFreshCache()` composes internally — against a small
// synthetic fixture tree with deterministic mtimes (`utimesSync`, never a real sleep). ZERO real `vite
// build` calls anywhere in this file.
import { describe, it, expect } from 'vitest'
import { newestSourceMtimeMs, isCacheStale } from './build-css.ts'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (build-css.ts's
// own banner — site/tsconfig.json deliberately has no "node" in its `types` array).
import { mkdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs'

declare const process: { cwd(): string }

const ROOT = process.cwd()
const SCRATCH = `${ROOT}/dist-build-css-probe-scratch`

/** Set a file's mtime (and atime) to an EXACT, deterministic Date — avoids any off-by-1000 unit mistakes
 *  between seconds and milliseconds, and needs no real sleep between "before" and "after" states. */
const setMtime = (path: string, date: Date): void => void utimesSync(path, date, date)

describe('build-css.ts — newestSourceMtimeMs finds the newest real file mtime', () => {
  it('under the scanned directory roots', () => {
    rmSync(SCRATCH, { recursive: true, force: true })
    mkdirSync(`${SCRATCH}/site`, { recursive: true })
    mkdirSync(`${SCRATCH}/packages`, { recursive: true })
    const older = new Date('2020-01-01T00:00:00Z')
    const newer = new Date('2020-01-02T00:00:00Z')
    writeFileSync(`${SCRATCH}/site/a.css`, 'a{}')
    setMtime(`${SCRATCH}/site/a.css`, older)
    writeFileSync(`${SCRATCH}/packages/b.css`, 'b{}')
    setMtime(`${SCRATCH}/packages/b.css`, newer)

    expect(newestSourceMtimeMs(SCRATCH, ['site', 'packages'], [])).toBe(newer.getTime())
    rmSync(SCRATCH, { recursive: true, force: true })
  })

  it('excludes node_modules/dist*/scratch dirs from the scan (a change there must NOT count)', () => {
    rmSync(SCRATCH, { recursive: true, force: true })
    mkdirSync(`${SCRATCH}/site/node_modules`, { recursive: true })
    mkdirSync(`${SCRATCH}/site/dist-scratch-thing`, { recursive: true })
    const real = new Date('2020-01-01T00:00:00Z')
    const excludedButNewer = new Date('2030-01-01T00:00:00Z') // deliberately far in the future
    writeFileSync(`${SCRATCH}/site/a.css`, 'a{}')
    setMtime(`${SCRATCH}/site/a.css`, real)
    writeFileSync(`${SCRATCH}/site/node_modules/x.js`, 'x')
    setMtime(`${SCRATCH}/site/node_modules/x.js`, excludedButNewer)
    writeFileSync(`${SCRATCH}/site/dist-scratch-thing/y.css`, 'y{}')
    setMtime(`${SCRATCH}/site/dist-scratch-thing/y.css`, excludedButNewer)

    expect(newestSourceMtimeMs(SCRATCH, ['site'], [])).toBe(real.getTime())
    rmSync(SCRATCH, { recursive: true, force: true })
  })

  it('also watches a standalone file (e.g. the real vite.config.ts, outside site/packages)', () => {
    rmSync(SCRATCH, { recursive: true, force: true })
    mkdirSync(SCRATCH, { recursive: true })
    const later = new Date('2021-06-01T00:00:00Z')
    writeFileSync(`${SCRATCH}/vite.config.ts`, 'export default {}')
    setMtime(`${SCRATCH}/vite.config.ts`, later)

    expect(newestSourceMtimeMs(SCRATCH, [], ['vite.config.ts'])).toBe(later.getTime())
    rmSync(SCRATCH, { recursive: true, force: true })
  })
})

describe('build-css.ts — isCacheStale (the pure freshness predicate)', () => {
  it('a cache written AFTER every source is fresh; equal is fresh; a cache OLDER than a source is stale', () => {
    expect(isCacheStale(2000, 1000)).toBe(false) // cache (2000) built after the source (1000)
    expect(isCacheStale(1000, 1000)).toBe(false) // equal — the cache's own write happens after its inputs
    expect(isCacheStale(1000, 2000)).toBe(true) // a source (2000) is NEWER than the cache (1000)
  })
})

describe("build-css.ts — THE REVIEWER'S EXACT REPRO (HIGH-1), reproduced then proven FIXED", () => {
  it('warm cache → edit a real build input → the cache now reads STALE (never a silent false-green)', () => {
    rmSync(SCRATCH, { recursive: true, force: true })
    mkdirSync(`${SCRATCH}/site`, { recursive: true })
    const buildTime = new Date('2020-01-01T00:00:00Z')
    const cacheWriteTime = new Date('2020-01-01T00:00:01Z') // the cache is written just after the build ran
    writeFileSync(`${SCRATCH}/site/theming.css`, '/* original */')
    setMtime(`${SCRATCH}/site/theming.css`, buildTime)

    // Warm cache: its own mtime is AFTER every source it was built from — fresh, as expected.
    const warmSourceMs = newestSourceMtimeMs(SCRATCH, ['site'], [])
    expect(isCacheStale(cacheWriteTime.getTime(), warmSourceMs), 'a genuinely warm cache must read fresh').toBe(false)

    // THE EDIT — the reviewer's own repro: "append a comment to site/pages/theming.css (a real build
    // input)" — a real source changes AFTER the cache was written.
    const editTime = new Date('2020-01-01T00:00:02Z')
    writeFileSync(`${SCRATCH}/site/theming.css`, '/* original */\n/* a new comment */')
    setMtime(`${SCRATCH}/site/theming.css`, editTime)

    // Pre-fix (a TIME-WINDOW-ONLY cache), this would still read fresh for up to CACHE_MAX_AGE_MS longer —
    // the reported false-green that silently defeated SPEC-R11 AC1. Post-fix: detected immediately,
    // unconditionally, independent of any time window.
    const editedSourceMs = newestSourceMtimeMs(SCRATCH, ['site'], [])
    expect(
      isCacheStale(cacheWriteTime.getTime(), editedSourceMs),
      'the cache must be STALE the instant a real build input changes — this is the HIGH-1 fix',
    ).toBe(true)

    rmSync(SCRATCH, { recursive: true, force: true })
  })
})
