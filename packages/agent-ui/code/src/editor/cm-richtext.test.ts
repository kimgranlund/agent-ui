import { describe, it, expect, afterEach, vi } from 'vitest'

// cm-richtext.test.ts — jsdom regression coverage for the PURE platform-gate logic in cm-richtext.ts
// (code-review finding 1, the ADR-0147 review-fixes wave). This file is NOT part of the confinement
// trip-wire's designated pair (confinement.test.ts's own `walk()` excludes every `*.test.ts` file), so
// importing `./cm-richtext.ts` directly here does not violate the "only cm-editor.ts may statically
// import cm-richtext.ts" invariant.
//
// `isMac` (cm-richtext.ts) is computed ONCE at module evaluation from `navigator.platform`/`userAgent` —
// there is no per-call platform read. To exercise BOTH the macOS and non-macOS branches in one file we
// must force a FRESH module instance per platform: `vi.resetModules()` clears vitest's module registry,
// then a `navigator` stub (via `vi.stubGlobal`) is in place BEFORE the next dynamic `import()` re-runs
// the module's top-level `isMac` computation. No existing platform-fake pattern was found elsewhere in
// this repo (`editor.browser.test.ts`'s own `MOD` constant reads the REAL `navigator.platform` of the
// host running the browser test, it never stubs it) — this is a new, narrowly-scoped technique.

async function importWithPlatform(platform: string, userAgent = ''): Promise<typeof import('./cm-richtext.ts')> {
  vi.resetModules()
  vi.stubGlobal('navigator', { ...navigator, platform, userAgent })
  return await import('./cm-richtext.ts')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

// A minimal MouseEvent stand-in — `isOpenModifier` reads only `.metaKey`/`.ctrlKey`, so a real jsdom
// `MouseEvent` (matching the shape `editor.browser.test.ts`'s own click-modifier tests construct) is used
// rather than a hand-rolled cast, keeping this test's events indistinguishable from the real dispatch path.
const click = (init: MouseEventInit): MouseEvent => new MouseEvent('mousedown', init)

describe('cm-richtext — isOpenModifier platform gate (code-review finding 1)', () => {
  it('on macOS, Ctrl+click alone does NOT open — it must fall through to the platform context-menu gesture', async () => {
    const { isOpenModifier } = await importWithPlatform('MacIntel')
    expect(isOpenModifier(click({ ctrlKey: true, metaKey: false }))).toBe(false)
  })

  it('on macOS, Cmd+click ALWAYS opens — the universal, collision-free open-modifier', async () => {
    const { isOpenModifier } = await importWithPlatform('MacIntel')
    expect(isOpenModifier(click({ metaKey: true, ctrlKey: false }))).toBe(true)
    // Cmd+Ctrl together still opens (metaKey short-circuits — Ctrl's mac-specific refusal never applies).
    expect(isOpenModifier(click({ metaKey: true, ctrlKey: true }))).toBe(true)
  })

  it('off macOS (e.g. Windows), Ctrl+click opens — the Windows/Linux convention', async () => {
    const { isOpenModifier } = await importWithPlatform('Win32')
    expect(isOpenModifier(click({ ctrlKey: true, metaKey: false }))).toBe(true)
  })

  it('off macOS, Cmd+click still opens (platform-independent)', async () => {
    const { isOpenModifier } = await importWithPlatform('Win32')
    expect(isOpenModifier(click({ metaKey: true, ctrlKey: false }))).toBe(true)
  })

  it('a plain click (no modifier) never opens, on either platform', async () => {
    const mac = await importWithPlatform('MacIntel')
    expect(mac.isOpenModifier(click({ metaKey: false, ctrlKey: false }))).toBe(false)

    const win = await importWithPlatform('Win32')
    expect(win.isOpenModifier(click({ metaKey: false, ctrlKey: false }))).toBe(false)
  })

  it('macOS detection also reads a Mac userAgent when platform is absent/generic (the `navigator.platform || navigator.userAgent` fallback)', async () => {
    const { isOpenModifier } = await importWithPlatform('', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    expect(isOpenModifier(click({ ctrlKey: true, metaKey: false })), 'a Mac userAgent must still refuse a bare Ctrl+click').toBe(false)
  })
})
