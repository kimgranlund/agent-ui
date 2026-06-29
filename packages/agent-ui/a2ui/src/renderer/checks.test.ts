// checks.test.ts — A2UI `checks` reactive controller (renderer LLD-C13, ADR-0029).
//
// Probes (jsdom):
//   8a  no `checks` → no-op (wireChecks does not touch el)
//   8b  flat shape `{call,args,message}` — a passing check leaves customValidity ''
//   8c  flat shape — a failing check (required, value missing) sets customValidity to the message
//   8d  condition wrapper `{condition:{call,args},message}` is normalised correctly
//   8e  unrecognised entry shapes are skipped (non-fatal); recognised sibling still runs
//   8f  first failing check wins (multiple checks, first-fail short-circuit)
//   8g  FUNCTION error (unknown fn name) → treated as invalid (fault-gate, ADR-0029 §8)
//   8h  Button target → el.disabled instead of setCustomValidity; restores declared disabled on pass
//   8i  no-op target (neither UIFormElement nor button-like) — no throw
//   8j  reactive: a `{path}` arg re-evaluates the check when the data changes (SPEC-N2 reused)
//   8k  SPEC-N3 leak-free: the check effect dies with the scope (zero subscribers after dispose)

import { describe, it, expect } from 'vitest'
import { createScope, whenFlushed } from '@agent-ui/components'
import { wireChecks } from './checks.ts'
import { createSurface, disposeSurface } from './surface.ts'
import type { Surface } from './surface.ts'
import type { A2uiComponent, A2uiError } from '../protocol.ts'
import type { CatalogRegistry } from '../catalog/types.ts'
import { Registry } from '../catalog/registry.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'

// ── Harness helpers ──────────────────────────────────────────────────────────

function stubRegistry(): CatalogRegistry {
  const reg = new Registry()
  reg.register(defaultCatalog, defaultFactories)
  return reg
}

interface Env {
  surface: Surface
  registry: CatalogRegistry
  errors: A2uiError[]
  emitError: (e: A2uiError) => void
}

function env(): Env {
  const surface = createSurface({ id: 's1', catalogId: 'agent-ui', version: 'v1.0' })
  const registry = stubRegistry()
  const errors: A2uiError[] = []
  const emitError = (e: A2uiError) => void errors.push(e)
  return { surface, registry, errors, emitError }
}

function comp(c: Record<string, unknown>): A2uiComponent {
  return c as A2uiComponent
}

/** A minimal form-input element stub with `setCustomValidity` (mimics UIFormElement's public seam). */
function makeInputEl(): HTMLElement & { setCustomValidity(msg: string): void; customMessage: string } {
  const el = document.createElement('div') as unknown as HTMLElement & { setCustomValidity(msg: string): void; customMessage: string }
  el.customMessage = ''
  el.setCustomValidity = (msg: string) => {
    el.customMessage = msg
  }
  return el
}

/** A minimal button-like element stub with a `disabled` property (mimics ui-button). */
function makeButtonEl(initialDisabled = false): HTMLElement & { disabled: boolean } {
  const el = document.createElement('div') as unknown as HTMLElement & { disabled: boolean }
  el.disabled = initialDisabled
  return el
}

// ── 8a — no `checks` → no-op ─────────────────────────────────────────────────

describe('wireChecks — 8a: no `checks` on node → no-op', () => {
  it('does not call setCustomValidity or set disabled when `checks` is absent', () => {
    const { surface, registry, emitError } = env()
    const el = makeInputEl()
    wireChecks(el, comp({ id: 'c1', component: 'TextField' }), surface, surface.scope, surface.ac, undefined, emitError, registry)
    // no check was run; customMessage stays ''
    expect(el.customMessage).toBe('')
    disposeSurface(surface)
  })

  it('treats an empty `checks: []` as a no-op', () => {
    const { surface, registry, emitError } = env()
    const el = makeInputEl()
    wireChecks(el, comp({ id: 'c1', component: 'TextField', checks: [] }), surface, surface.scope, surface.ac, undefined, emitError, registry)
    expect(el.customMessage).toBe('')
    disposeSurface(surface)
  })
})

// ── 8b — flat shape, passing check → customValidity '' ───────────────────────

describe('wireChecks — 8b: flat check shape, check passes (required, non-empty value)', () => {
  it('setCustomValidity is called with "" when the required check passes', async () => {
    const { surface, registry, errors, emitError } = env()
    // seed the data model: /value = 'hello' → required passes
    surface.data.value = { value: 'hello' }
    const el = makeInputEl()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [{ call: 'required', args: { value: { path: '/value' } }, message: 'Value is required' }],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.customMessage).toBe('') // passing → no custom message
    expect(errors).toHaveLength(0) // no FUNCTION error
    disposeSurface(surface)
  })
})

// ── 8c — flat shape, failing check → customValidity = message ────────────────

describe('wireChecks — 8c: flat check shape, check fails (required, empty value)', () => {
  it('setCustomValidity is called with the check message when the required check fails', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { value: '' } // empty → required fails
    const el = makeInputEl()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [{ call: 'required', args: { value: { path: '/value' } }, message: 'Field is required' }],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.customMessage).toBe('Field is required')
    disposeSurface(surface)
  })
})

// ── 8d — condition wrapper ────────────────────────────────────────────────────

describe('wireChecks — 8d: condition-wrapper shape `{condition:{call,args},message}`', () => {
  it('the condition wrapper is unwrapped and evaluated identically to the flat shape', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { zip: '' }
    const el = makeInputEl()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [
        {
          condition: { call: 'required', args: { value: { path: '/zip' } } },
          message: 'Zip code is required',
        },
      ],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.customMessage).toBe('Zip code is required')
    disposeSurface(surface)
  })
})

// ── 8e — unrecognised entries are skipped; recognised sibling still runs ──────

describe('wireChecks — 8e: unrecognised check entries are skipped (non-fatal)', () => {
  it('a bad entry is skipped; a recognised sibling check still runs and fails', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { v: '' }
    const el = makeInputEl()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [
        null, // bad entry → skipped
        42,   // bad entry → skipped
        { call: 'required', args: { value: { path: '/v' } }, message: 'V is required' },
      ],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.customMessage).toBe('V is required') // the recognised check ran
    disposeSurface(surface)
  })
})

// ── 8f — first failing check wins ────────────────────────────────────────────

describe('wireChecks — 8f: first failing check wins (multiple checks)', () => {
  it('only the first failing check message is surfaced', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { email: 'not-an-email' }
    const el = makeInputEl()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [
        // `required` passes (value is non-empty), `email` fails
        { call: 'required', args: { value: { path: '/email' } }, message: 'Email is required' },
        { call: 'email', args: { value: { path: '/email' } }, message: 'Must be a valid email' },
      ],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.customMessage).toBe('Must be a valid email')
    disposeSurface(surface)
  })

  it('clears the message when the previously failing check now passes', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { v: '' } // required fails
    const el = makeInputEl()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [{ call: 'required', args: { value: { path: '/v' } }, message: 'Required' }],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.customMessage).toBe('Required')

    // now the value is non-empty → required passes → customValidity cleared
    surface.data.value = { v: 'hello' }
    await whenFlushed()
    expect(el.customMessage).toBe('')
    disposeSurface(surface)
  })
})

// ── 8g — FUNCTION error → treated as invalid (fault-gate) ────────────────────

describe('wireChecks — 8g: unknown function → FUNCTION error + treated as invalid', () => {
  it('an unknown function name emits FUNCTION and treats the check as failing', async () => {
    const { surface, registry, errors, emitError } = env()
    const el = makeInputEl()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [{ call: 'nonExistentFn', args: {}, message: 'Always fails' }],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(errors.some((e) => e.code === 'FUNCTION')).toBe(true) // FUNCTION error emitted
    expect(el.customMessage).toBe('Always fails') // treated as invalid (fault-gate, ADR-0029 §8)
    disposeSurface(surface)
  })
})

// ── 8h — Button target → el.disabled ─────────────────────────────────────────

describe('wireChecks — 8h: Button target — el.disabled driven by checks', () => {
  it('sets el.disabled=true when a check fails; restores to node declared disabled on pass', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { v: '' } // required fails
    const el = makeButtonEl(false) // node declares disabled=false
    const node = comp({
      id: 'c1',
      component: 'Button',
      disabled: false,
      checks: [{ call: 'required', args: { value: { path: '/v' } }, message: 'Required' }],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.disabled).toBe(true) // check failed → button disabled

    // value filled → check passes → restore declared disabled (false)
    surface.data.value = { v: 'x' }
    await whenFlushed()
    expect(el.disabled).toBe(false) // restored to node.disabled
    disposeSurface(surface)
  })

  it('respects node.disabled=true as the restore value when checks pass', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { v: 'ok' } // passes immediately
    const el = makeButtonEl(true) // node declares disabled=true
    const node = comp({
      id: 'c1',
      component: 'Button',
      disabled: true,
      checks: [{ call: 'required', args: { value: { path: '/v' } }, message: 'Required' }],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.disabled).toBe(true) // passes but declared disabled → stays true
    disposeSurface(surface)
  })
})

// ── 8i — no-op target (no setCustomValidity, no disabled) ────────────────────

describe('wireChecks — 8i: unknown target element — no throw', () => {
  it('does not throw when the element has neither setCustomValidity nor disabled', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { v: '' }
    const el = document.createElement('span') // neither input nor button
    const node = comp({
      id: 'c1',
      component: 'Text',
      checks: [{ call: 'required', args: { value: { path: '/v' } }, message: 'Required' }],
    })
    // must not throw — unrecognised target is silently a no-op
    await expect(
      (async () => {
        wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
        await whenFlushed()
      })(),
    ).resolves.toBeUndefined()
    disposeSurface(surface)
  })
})

// ── 8j — reactive: {path} arg re-evaluates when data changes (SPEC-N2) ───────

describe('wireChecks — 8j: reactive evaluation (SPEC-N2 reused via evaluate/{path} memo)', () => {
  it('the check effect re-runs when the bound data path changes', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { username: '' } // starts failing
    const el = makeInputEl()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [{ call: 'required', args: { value: { path: '/username' } }, message: 'Username required' }],
    })
    wireChecks(el, node, surface, surface.scope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.customMessage).toBe('Username required') // initially fails

    surface.data.value = { username: 'alice' }
    await whenFlushed()
    expect(el.customMessage).toBe('') // data changed → check re-ran → passes

    surface.data.value = { username: '' }
    await whenFlushed()
    expect(el.customMessage).toBe('Username required') // reverted → fails again
    disposeSurface(surface)
  })
})

// ── 8k — SPEC-N3 leak-free: scope disposal tears down the check effect ────────

describe('wireChecks — 8k: SPEC-N3 leak-free scope teardown', () => {
  it('the check effect leaves zero subscribers after the scope is disposed', async () => {
    const { surface, registry, emitError } = env()
    surface.data.value = { v: 'x' }
    const el = makeInputEl()

    // Use a standalone scope (mirrors a list-item pattern) so we can dispose it independently.
    const childScope = createScope()
    const node = comp({
      id: 'c1',
      component: 'TextField',
      checks: [{ call: 'required', args: { value: { path: '/v' } }, message: 'Required' }],
    })
    wireChecks(el, node, surface, childScope, surface.ac, undefined, emitError, registry)
    await whenFlushed()
    expect(el.customMessage).toBe('') // passing

    // Verify the signal is subscribed (the effect is alive)
    // We can confirm reactivity worked by mutating and checking — the effect ran at least once.
    surface.data.value = { v: '' }
    await whenFlushed()
    expect(el.customMessage).toBe('Required') // the effect is tracking

    // Now dispose the child scope — the effect should die
    childScope.dispose()
    surface.data.value = { v: 'y' }
    await whenFlushed()
    // After scope disposal, the check effect is gone — customMessage stays at the last value
    // (the effect no longer re-runs, so it does not clear the message)
    expect(el.customMessage).toBe('Required') // no re-run — effect is dead
    disposeSurface(surface)
  })
})
