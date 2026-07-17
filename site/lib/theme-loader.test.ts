import { describe, it, expect, beforeEach } from 'vitest'
import {
  THEME_OPTIONS,
  applyTheme,
  applyScheme,
  persistTheme,
  persistScheme,
  loadPersistedTheme,
  loadPersistedScheme,
} from './theme-loader.ts'

// theme-loader.test.ts — TKT-0088's pure loader logic: persistence round-trips (never throw, degrade to
// the default on garbage/missing), applyTheme's pack-zero short-circuit (the default needs no stylesheet
// import at all — asserted by NEVER calling the dynamic `?url` import path, which jsdom can't resolve
// anyway), and applyScheme's ADR-0117 unset-is-'' passthrough (never silently promoted to 'light').

beforeEach(() => {
  localStorage.clear()
})

describe('THEME_OPTIONS', () => {
  it('includes "default" first (pack zero, ADR-0141 cl.2) and the two TKT-0087 proof packs', () => {
    expect(THEME_OPTIONS[0]!.id).toBe('default')
    expect(THEME_OPTIONS.map((o) => o.id)).toEqual(['default', 'ocean', 'ember'])
  })
})

describe('applyTheme', () => {
  it('the "default" theme never touches the pack loader — sets theme to \'\' directly, no async work', async () => {
    const provider = { theme: 'stale' }
    await applyTheme(provider, 'default') // would throw/hang if this tried a real dynamic import under jsdom
    expect(provider.theme).toBe('')
  })
})

describe('applyScheme', () => {
  it('passes \'\' straight through — the ADR-0117 unset-inherits value, never remapped to "light"', () => {
    const provider = { scheme: 'stale' }
    applyScheme(provider, '')
    expect(provider.scheme).toBe('')
  })
  it('passes an explicit scheme straight through', () => {
    const provider = { scheme: '' }
    applyScheme(provider, 'dark')
    expect(provider.scheme).toBe('dark')
  })
})

describe('theme/scheme persistence', () => {
  it('round-trips a persisted theme choice', () => {
    expect(loadPersistedTheme()).toBe('default') // nothing persisted yet
    persistTheme('ocean')
    expect(loadPersistedTheme()).toBe('ocean')
  })

  it('degrades an unrecognized persisted theme value to "default" (never throws, never trusts garbage)', () => {
    localStorage.setItem('agent-ui.theme', 'not-a-real-pack')
    expect(loadPersistedTheme()).toBe('default')
  })

  it('round-trips a persisted scheme choice', () => {
    expect(loadPersistedScheme()).toBe('') // nothing persisted yet — unset
    persistScheme('dark')
    expect(loadPersistedScheme()).toBe('dark')
    persistScheme('light')
    expect(loadPersistedScheme()).toBe('light')
  })

  it('degrades an unrecognized persisted scheme value to \'\' (unset, never a guessed light/dark)', () => {
    localStorage.setItem('agent-ui.scheme', 'sepia')
    expect(loadPersistedScheme()).toBe('')
  })

  it('persisting \'\' (explicitly resetting to Auto) round-trips back to \'\', not the prior explicit value', () => {
    persistScheme('dark')
    expect(loadPersistedScheme()).toBe('dark')
    persistScheme('')
    expect(loadPersistedScheme()).toBe('')
  })
})
