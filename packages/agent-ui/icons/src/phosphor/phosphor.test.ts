// phosphor.test.ts — s-icons-tests accept (icon-adapter.decomp.json): "Phosphor subpath self-registers
// on import" (LLD §6), the one assertion in the LLD's unit list not already covered by types.test.ts /
// registry.test.ts / resolve.test.ts (which deliberately construct their own `Registry`, never the
// module singleton — see their headers). This file is the deliberate exception: importing `./index.ts`
// IS what triggers the self-register + activate side effect (LLD-C4) against the module-singleton
// `iconRegistry`, so exercising that singleton here is the behavior under test, not a leak to guard
// against. Vitest's default per-file module isolation keeps this from bleeding into other test files.

import { describe, expect, it } from 'vitest'
import { iconRegistry } from '../registry.ts'
import { ICON_NAMES } from '../types.ts'
import { resolveIcon } from '../resolve.ts'
import { phosphorPack } from './index.ts'

describe('the Phosphor subpath self-registers + activates on import (LLD-C4)', () => {
  it('registers under id "phosphor" and becomes the active pack on the default singleton', () => {
    expect(iconRegistry.activePack()?.id).toBe('phosphor')
    expect(iconRegistry.activePack()).toBe(phosphorPack)
  })

  it('the pack viewBox is the Phosphor canonical "0 0 256 256"', () => {
    expect(phosphorPack.viewBox).toBe('0 0 256 256')
  })

  it('every one of the 21 ICON_NAMES resolves to a distinct, non-empty body', () => {
    const bodies = ICON_NAMES.map((name) => phosphorPack.icons[name])
    for (const [i, body] of bodies.entries()) {
      expect(typeof body, `icons.${ICON_NAMES[i]} is not a string`).toBe('string')
      expect(body.length, `icons.${ICON_NAMES[i]} is empty`).toBeGreaterThan(0)
    }
    expect(new Set(bodies).size, 'two or more names share the same body').toBe(ICON_NAMES.length)
  })

  it('resolveIcon against the now-active singleton returns a real (non-missing) svg', () => {
    const svg = resolveIcon('eye-slash', iconRegistry)
    expect(svg.getAttribute('data-icon-missing')).toBeNull()
    expect(svg.getAttribute('viewBox')).toBe('0 0 256 256')
    expect(svg.children.length).toBeGreaterThan(0)
  })
})
