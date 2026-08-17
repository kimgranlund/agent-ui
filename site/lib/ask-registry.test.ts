// ask-registry.test.ts — ADR-0097 §2: the per-ask lifecycle mechanism, jsdom-covered (the pure routing
// helpers + the registry's DOM-mutation contract). Real `inert`/tab-order/focus semantics are NOT true
// under jsdom (jsdom-green ≠ done, CLAUDE.md) — those are proven in `ask-registry.browser.test.ts`
// (real Chromium/WebKit via vitest-browser). This file covers what jsdom CAN prove faithfully: the pure
// parsing helpers, and that `freeze`/`disposeAll` mutate the DOM/registry state exactly as documented.

import { describe, it, expect, afterEach } from 'vitest'
// jsdom reality (the a2ui-live.ask-lifecycle.test.ts precedent): `ElementInternals.setFormValue`/
// `setValidity` are ABSENT in jsdom, and the ADR-0196 settle leg below connects a REAL `ui-radio-group`
// (form-associated). Stub ONCE at the shared prototype BEFORE the controls import — additive, a no-op
// once a future jsdom ships the real methods.
if (typeof ElementInternals.prototype.setFormValue !== 'function') {
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
}
import '@agent-ui/components/components' // self-defines ui-* controls so the renderer's nodes upgrade
import { AskRegistry, surfaceIdOf, componentTypesOf } from './ask-registry.ts'

describe('surfaceIdOf (ADR-0097 §2 routing helper)', () => {
  it('reads surfaceId off every envelope kind that carries one', () => {
    expect(surfaceIdOf('{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}')).toBe('ask-1')
    expect(surfaceIdOf('{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[]}}')).toBe('main')
    expect(surfaceIdOf('{"version":"v1.0","updateDataModel":{"surfaceId":"s1","value":1}}')).toBe('s1')
    expect(surfaceIdOf('{"version":"v1.0","deleteSurface":{"surfaceId":"s2"}}')).toBe('s2')
    expect(surfaceIdOf('{"version":"v1.0","actionResponse":{"surfaceId":"s3","actionId":"a1"}}')).toBe('s3')
  })

  it('returns undefined for an envelope kind with no surface context, or unparseable input — never throws', () => {
    expect(surfaceIdOf('{"version":"v1.0","callFunction":{"call":"ping"},"functionCallId":"f1"}')).toBeUndefined()
    expect(surfaceIdOf('not json')).toBeUndefined()
    expect(surfaceIdOf('[]')).toBeUndefined()
    expect(surfaceIdOf('null')).toBeUndefined()
    expect(surfaceIdOf('42')).toBeUndefined()
  })
})

describe('componentTypesOf (ADR-0097 §3 fail-closed helper)', () => {
  it('collects every component type from updateComponents lines, order-preserving, duplicates kept', () => {
    const lines = [
      '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}',
      '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"RadioGroup","children":["a"]},{"id":"a","component":"Radio"}]}}',
      '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"b","component":"Radio"}]}}',
    ]
    expect(componentTypesOf(lines)).toEqual(['RadioGroup', 'Radio', 'Radio'])
  })

  it('returns [] for lines with no updateComponents, unparseable lines, or an empty list — never throws', () => {
    expect(componentTypesOf([])).toEqual([])
    expect(componentTypesOf(['not json', '{"version":"v1.0","createSurface":{"surfaceId":"x","catalogId":"y"}}'])).toEqual([])
  })
})

describe('AskRegistry (ADR-0097 §2)', () => {
  const mounted: HTMLElement[] = []
  afterEach(() => {
    while (mounted.length) mounted.pop()?.remove()
  })

  function fixture(): { bubble: HTMLElement; mountEl: HTMLElement } {
    const bubble = document.createElement('div')
    const mountEl = document.createElement('div')
    bubble.append(mountEl)
    document.body.append(bubble)
    mounted.push(bubble)
    return { bubble, mountEl }
  }

  it('create() mounts a fresh host as pending; get()/has() see it; a duplicate surfaceId THROWS (collision guard is the caller\'s job)', () => {
    const registry = new AskRegistry()
    const { bubble, mountEl } = fixture()
    const entry = registry.create('ask-1', bubble, mountEl, () => {})
    expect(entry.state).toBe('pending')
    expect(registry.get('ask-1')).toBe(entry)
    expect(registry.has('ask-1')).toBe(true)
    expect(registry.pending()).toBe(entry)
    expect(registry.size).toBe(1)

    const { bubble: bubble2, mountEl: mountEl2 } = fixture()
    expect(() => registry.create('ask-1', bubble2, mountEl2, () => {})).toThrow(/already known/)
  })

  it("freeze('bypassed') sets inert + data-state, and is idempotent (a second freeze call is a no-op)", () => {
    // NOTE: jsdom does not implement the `inert` IDL attribute's reflection/default (`Element.prototype`
    // has no getter, so an un-set `.inert` reads `undefined`, not the spec's `false`) — real inert
    // semantics (interaction/tab-order suppression) are proven in `ask-registry.browser.test.ts` (a real
    // engine). This leg only asserts the PROPERTY ASSIGNMENT `freeze()` performs actually lands.
    const registry = new AskRegistry()
    const { bubble, mountEl } = fixture()
    registry.create('ask-1', bubble, mountEl, () => {})
    expect(bubble.dataset.state).toBeUndefined()

    expect(registry.freeze('ask-1', 'bypassed')).toBe(true)
    expect(bubble.inert).toBe(true)
    expect(bubble.dataset.state).toBe('bypassed')
    expect(registry.isFrozen('ask-1')).toBe(true)
    expect(registry.pending()).toBeUndefined()

    // Idempotent: a second freeze (even with a DIFFERENT state) does nothing — the first freeze wins.
    expect(registry.freeze('ask-1', 'answered')).toBe(false)
    expect(bubble.dataset.state).toBe('bypassed')
  })

  it("freeze('answered') SETTLES, never inert (ADR-0196 cl.4/cl.5): data-state lands, the bubble stays interactive, and the choice controls gain answered=true", () => {
    const registry = new AskRegistry()
    const { bubble, mountEl } = fixture()
    // A representative choice control inside the bubble — a bare element is enough for the prop-assignment
    // contract (the real `:state(answered)` mirror is each control's own effect, pinned in its own tests).
    const group = document.createElement('ui-radio-group') as HTMLElement & { answered?: boolean }
    mountEl.append(group)
    registry.create('ask-1', bubble, mountEl, () => {})

    expect(registry.freeze('ask-1', 'answered')).toBe(true)
    expect(bubble.dataset.state).toBe('answered')
    // NON-VACUOUS form (a2ui-mechanism review, GH #1065): jsdom's `inert` is a bare expando that never
    // reflects to the attribute, so `hasAttribute('inert')` is false even when the code wrongly sets it.
    // Assert the EXPANDO's absence instead — the same readback the bypassed test uses positively.
    expect((bubble as HTMLElement & { inert?: boolean }).inert, 'an ANSWERED ask settles — it must NOT go inert (the Edit-anchor law)').toBeUndefined()
    expect(group.answered, 'freeze(answered) sets the ADR-0196 answered prop on the choice controls').toBe(true)
    expect(registry.isFrozen('ask-1')).toBe(true)
  })

  it('freeze() on an unknown surfaceId is a no-op, not a throw', () => {
    const registry = new AskRegistry()
    expect(registry.freeze('nope', 'bypassed')).toBe(false)
  })

  it('isFrozen() is false for a pending entry and false for an unknown id — only true once frozen', () => {
    const registry = new AskRegistry()
    const { bubble, mountEl } = fixture()
    registry.create('ask-1', bubble, mountEl, () => {})
    expect(registry.isFrozen('ask-1')).toBe(false) // still pending
    expect(registry.isFrozen('unknown')).toBe(false)
    registry.freeze('ask-1', 'bypassed')
    expect(registry.isFrozen('ask-1')).toBe(true)
  })

  it('disposeAll() disposes every host and clears the registry — get()/pending() see nothing after', () => {
    const registry = new AskRegistry()
    const { bubble: b1, mountEl: m1 } = fixture()
    const { bubble: b2, mountEl: m2 } = fixture()
    registry.create('ask-1', b1, m1, () => {})
    const entry2 = registry.create('ask-2', b2, m2, () => {})
    registry.freeze('ask-1', 'answered')
    expect(registry.size).toBe(2)

    registry.disposeAll()

    expect(registry.size).toBe(0)
    expect(registry.get('ask-1')).toBeUndefined()
    expect(registry.get('ask-2')).toBeUndefined()
    expect(registry.pending()).toBeUndefined()
    expect(registry.has('ask-1')).toBe(false)
    // The still-pending ask-2's host was disposed too, not just the frozen one — disposeAll is unconditional.
    expect(() => entry2.host.finalize()).not.toThrow() // dispose is idempotent-safe to call post-dispose ops on
  })

  it('a real ask surface (RadioGroup + commit Button) renders into mountEl via the created host', () => {
    const registry = new AskRegistry()
    const { bubble, mountEl } = fixture()
    const entry = registry.create('ask-1', bubble, mountEl, () => {})
    entry.host.ingest('{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui","sendDataModel":true}}')
    entry.host.ingest(
      '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Button","label":"Go","action":{"action":"submit"}}]}}',
    )
    entry.host.finalize()
    expect(mountEl.querySelector('ui-button')).not.toBeNull()
  })
})

// ── GH #1065 (a2ui-mechanism review M4) — the single-source drift guard ─────────────────────────────
// CHOICE_CONTROL_TAGS is the family's one source; a2ui-live.ts's readAskAnswer projects each tag's
// VALUE-READ shape. A tag added to the const but not wired into the projection silently drops that
// control's answer from the settle summary — this pin reddens instead.
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (tokens-doc.test.ts precedent)
import { readFileSync as __read } from 'node:fs'
import { CHOICE_CONTROL_TAGS as __TAGS } from './ask-registry.ts'
declare const process: { cwd(): string }

describe('readAskAnswer stays wired to every CHOICE_CONTROL_TAGS member (drift guard)', () => {
  it('every tag in the const appears in a2ui-live.ts', () => {
    const live = __read(`${process.cwd()}/site/pages/a2ui-live.ts`, 'utf8')
    const missing = __TAGS.filter((t) => !live.includes(t))
    expect(missing, `tags in CHOICE_CONTROL_TAGS but absent from a2ui-live.ts: ${missing.join(', ')}`).toEqual([])
  })
})
