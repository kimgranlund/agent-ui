// registry.test.ts — s-registry accept (icon-adapter.decomp.json): registerPack/setActivePack/
// activePack/overrideIcon/body semantics, per LLD-C2. Each test constructs its own `Registry` (never
// the module singleton) for isolation.

import { describe, expect, it, vi } from 'vitest'
import { Registry } from './registry.ts'
import { ICON_NAMES, type IconName, type IconPack } from './types.ts'

function makePack(id: string, overrides: Partial<Record<IconName, string>> = {}): IconPack {
  const icons = Object.fromEntries(
    ICON_NAMES.map((name) => [name, overrides[name] ?? `<path data-pack="${id}" data-name="${name}"/>`]),
  ) as Record<IconName, string>
  return { id, viewBox: '0 0 256 256', icons }
}

describe('Registry.registerPack / setActivePack / activePack', () => {
  it('has no active pack before any registration', () => {
    const registry = new Registry()
    expect(registry.activePack()).toBeNull()
  })

  it('the first registered pack becomes active', () => {
    const registry = new Registry()
    const a = makePack('a')
    registry.registerPack(a)
    expect(registry.activePack()).toBe(a)
  })

  it('a second, distinct pack does NOT become active on its own', () => {
    const registry = new Registry()
    const a = makePack('a')
    const b = makePack('b')
    registry.registerPack(a)
    registry.registerPack(b)
    expect(registry.activePack()).toBe(a)
  })

  it('setActivePack switches the active pack', () => {
    const registry = new Registry()
    const a = makePack('a')
    const b = makePack('b')
    registry.registerPack(a)
    registry.registerPack(b)
    registry.setActivePack('b')
    expect(registry.activePack()).toBe(b)
  })

  it('setActivePack throws on an unknown id', () => {
    const registry = new Registry()
    registry.registerPack(makePack('a'))
    expect(() => registry.setActivePack('unknown')).toThrow()
  })

  it('registering a duplicate id is last-wins and warns', () => {
    const registry = new Registry()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = makePack('a', { x: '<path data-first/>' })
    const second = makePack('a', { x: '<path data-second/>' })
    registry.registerPack(first)
    registry.registerPack(second)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(registry.activePack()).toBe(second)
    expect(registry.activePack()?.icons.x).toBe('<path data-second/>')
    warn.mockRestore()
  })
})

describe('Registry.overrideIcon / body', () => {
  it('body() reads the active pack when no override is set', () => {
    const registry = new Registry()
    const a = makePack('a')
    registry.registerPack(a)
    expect(registry.body('check')).toBe(a.icons.check)
  })

  it('body() returns null when there is no active pack', () => {
    const registry = new Registry()
    expect(registry.body('check')).toBeNull()
  })

  it('overrideIcon takes precedence over the active pack body', () => {
    const registry = new Registry()
    const a = makePack('a')
    registry.registerPack(a)
    registry.overrideIcon('x', '<path data-override/>')
    expect(registry.body('x')).toBe('<path data-override/>')
    expect(registry.body('check')).toBe(a.icons.check)
  })

  it('overrideIcon does NOT mutate the pack object', () => {
    const registry = new Registry()
    const a = makePack('a')
    const originalX = a.icons.x
    registry.registerPack(a)
    registry.overrideIcon('x', '<path data-override/>')
    expect(a.icons.x).toBe(originalX)
  })

  it('an override survives a later setActivePack (registry-level, pack-independent)', () => {
    const registry = new Registry()
    const a = makePack('a')
    const b = makePack('b')
    registry.registerPack(a)
    registry.registerPack(b)
    registry.overrideIcon('x', '<path data-override/>')
    registry.setActivePack('b')
    expect(registry.body('x')).toBe('<path data-override/>')
  })
})
