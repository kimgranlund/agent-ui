// agent-admin-bankroll.test.ts — GH #525 (design calls ruled 2026-08-07): the persistent cross-session
// bankroll capability. Schema-level unit coverage (sanitizeBankroll/isBankrollCapable) plus the three
// end-to-end behaviors driven through the real `ui-agent-admin` component: the post-turn MIRROR write
// (design call 1 — the turn's own already-captured wire lines, never a new a2ui read), the composed
// prompt's bankroll line (only when opted-in AND a value is stored), and the settings-pane RESET row
// (design call 3 — present only for an opted-in persona, clearing the stored figure on click).

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { createMemoryStore } from '@agent-ui/app'
import {
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  SURFACE_A2UI_KEY,
  isBankrollCapable,
  sanitizeBankroll,
} from './agent-admin-schema.ts'

// The jsdom ElementInternals stub (agent-admin.test.ts / agent-admin-local-patterns.test.ts verbatim) —
// jsdom's real attachInternals doesn't implement setFormValue/setValidity, and the real ui-agent-admin
// mounts real FACE form controls (ui-switch/ui-text-field/ui-slider) that call them on connect.
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

describe('sanitizeBankroll — fail-closed unset/malformed/negative coerce to undefined', () => {
  it('a non-negative finite number passes through unchanged', () => {
    expect(sanitizeBankroll(450)).toBe(450)
    expect(sanitizeBankroll(0)).toBe(0) // zero is a valid figure, not "absent"
    expect(sanitizeBankroll(12.5)).toBe(12.5)
  })
  it('undefined/null/a non-number all coerce to undefined ("no stored bankroll")', () => {
    expect(sanitizeBankroll(undefined)).toBeUndefined()
    expect(sanitizeBankroll(null)).toBeUndefined()
    expect(sanitizeBankroll('450')).toBeUndefined()
    expect(sanitizeBankroll(true)).toBeUndefined()
    expect(sanitizeBankroll({})).toBeUndefined()
  })
  it('negative or non-finite numbers coerce to undefined', () => {
    expect(sanitizeBankroll(-10)).toBeUndefined()
    expect(sanitizeBankroll(Number.NaN)).toBeUndefined()
    expect(sanitizeBankroll(Number.POSITIVE_INFINITY)).toBeUndefined()
  })
})

describe('isBankrollCapable — fail-closed, absent/non-`true` reads as "not capable"', () => {
  it('only a stored `true` reads as capable', () => {
    expect(isBankrollCapable(true)).toBe(true)
  })
  it('undefined/false/a truthy non-boolean all read as not capable', () => {
    expect(isBankrollCapable(undefined)).toBe(false)
    expect(isBankrollCapable(false)).toBe(false)
    expect(isBankrollCapable('true')).toBe(false)
    expect(isBankrollCapable(1)).toBe(false)
  })
})

describe('ui-agent-admin surface turn — GH #525 design call 1: the post-turn mirror write', () => {
  const mounted: Element[] = []
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove()
  })

  function composerSubmit(el: UIAgentAdminElement, text: string): void {
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  }

  async function runTurn(el: UIAgentAdminElement, text = 'hit'): Promise<void> {
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    composerSubmit(el, text)
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0)) // the async iterator drains on a microtask+task boundary
    await whenFlushed()
  }

  // review MAJOR 1b (2026-08-07) — every well-formed mirror scenario now needs a REAL createSurface for
  // 'table-1' first (the surfaceId-known-set gate): a bare updateDataModel with no prior createSurface is
  // exactly the "unknown id" case its own dedicated test below covers, never a stand-in for it here.
  function createSurfaceLine(id = 'table-1'): string {
    return JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: id, catalogId: 'agent-ui' } })
  }

  function updateDataModelLine(path: string | undefined, value: unknown): string {
    return JSON.stringify({ version: 'v1.0', updateDataModel: { surfaceId: 'table-1', ...(path === undefined ? {} : { path }), value } })
  }

  it('a direct `/bankroll` path write mirrors into the store when the persona opted in', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'note' as const, note: 'Dealt.' }
      yield { kind: 'line' as const, line: createSurfaceLine() }
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 450) }
    }
    await runTurn(el)
    expect(el.store!.get(BANKROLL_KEY)).toBe(450)
  })

  it('a whole-document replace (`path` absent) is read at its own `.bankroll` key (the ADR-0099 root alias)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'line' as const, line: createSurfaceLine() }
      yield { kind: 'line' as const, line: updateDataModelLine(undefined, { bankroll: 900, hand: [] }) }
    }
    await runTurn(el)
    expect(el.store!.get(BANKROLL_KEY)).toBe(900)
  })

  it('the LAST touch to the pointer within the turn wins', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'line' as const, line: createSurfaceLine() }
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 100) }
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 250) }
    }
    await runTurn(el)
    expect(el.store!.get(BANKROLL_KEY)).toBe(250)
  })

  it('a persona that never opted in is never scanned — the store never gets the key, even with a matching wire line', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 450) }
    }
    await runTurn(el)
    expect(el.store!.get(BANKROLL_KEY)).toBeUndefined()
  })

  it('a turn that never touches `/bankroll` writes nothing — the previously-stored figure stands', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [BANKROLL_CAPABLE_KEY]: true, [BANKROLL_KEY]: 300 } })
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } }) }
    }
    await runTurn(el)
    expect(el.store!.get(BANKROLL_KEY)).toBe(300)
  })

  it('a malformed final figure (negative) fails to sanitize — no write, fail-closed', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    el.agentSurfaceTurn = async function* () {
      // A KNOWN surface (createSurface first) — this must fail on the VALUE, not accidentally pass via
      // the unknown-surfaceId path the dedicated test below already covers.
      yield { kind: 'line' as const, line: createSurfaceLine() }
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', -50) }
    }
    await runTurn(el)
    expect(el.store!.get(BANKROLL_KEY)).toBeUndefined()
  })

  // review MAJOR 1a (2026-08-07) — the mirror must never persist a value the A2UI toggle refused to
  // RENDER: `wireLines` collects every raw line regardless of the toggle (GH #418's own debugging-
  // visibility law), but a line the toggle refused never reached `handle.ingestLine`.
  it('A2UI OFF ⇒ no mirror write, even though the toggle-refused line still carries a well-formed `/bankroll` write', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(SURFACE_A2UI_KEY, false)
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 450) }
    }
    await runTurn(el)
    expect(el.store!.get(BANKROLL_KEY)).toBeUndefined()
  })

  // review MAJOR 1b (2026-08-07) — the real renderer no-ops `updateDataModel` for a surfaceId its own
  // `SurfaceStore` never created (renderer.ts:318-319); the mirror must degrade the SAME way for an
  // envelope naming a surfaceId THIS admin never actually rendered a `createSurface` for.
  it('an `updateDataModel` naming a surfaceId this turn never created ⇒ no mirror write (unknown/hallucinated id, real-renderer parity)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    el.agentSurfaceTurn = async function* () {
      // NO createSurface anywhere in this stream — 'table-1' is never known.
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 450) }
    }
    await runTurn(el)
    expect(el.store!.get(BANKROLL_KEY)).toBeUndefined()
  })

  // The positive counterpart of the unknown-id refusal above IS "a direct `/bankroll` path write mirrors
  // into the store when the persona opted in" (further up this file — it yields a real `createSurfaceLine()`
  // ahead of its `updateDataModel`, the SAME known-surface shape).

  it('a surface created in an EARLIER turn stays known for a later turn\'s settlement (no re-createSurface needed — "one surfaceId for the session")', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    let round = 0
    el.agentSurfaceTurn = async function* () {
      round += 1
      if (round === 1) {
        yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } }) }
        return
      }
      // Round 2: settles WITHOUT recreating the surface — the real croupier shape (round-loop.md:
      // "ONE surfaceId for the session").
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 650) }
    }
    await runTurn(el, 'deal')
    expect(el.store!.get(BANKROLL_KEY)).toBeUndefined() // round 1 never touched /bankroll
    await runTurn(el, 'hit')
    expect(el.store!.get(BANKROLL_KEY)).toBe(650)
  })

  it('a `deleteSurface` retires the id — a later turn naming it again is treated as unknown', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    let round = 0
    el.agentSurfaceTurn = async function* () {
      round += 1
      if (round === 1) {
        yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } }) }
        yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', deleteSurface: { surfaceId: 'table-1' } }) }
        return
      }
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 900) }
    }
    await runTurn(el, 'deal')
    await runTurn(el, 'hit')
    expect(el.store!.get(BANKROLL_KEY)).toBeUndefined()
  })

  it('a persona SWITCH clears the known-surfaceId set — a stale id from the old persona never authorizes the new one\'s mirror', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } }) }
    }
    await runTurn(el, 'deal')

    // A real store reassignment — the GH #145 persona-switch reset.
    el.store = createMemoryStore({ initial: { [BANKROLL_CAPABLE_KEY]: true } })
    await whenFlushed()
    el.agentSurfaceTurn = async function* () {
      // The SAME surfaceId the OLD persona created — never recreated under the new store.
      yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 999) }
    }
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'hit'
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()

    expect(el.store!.get(BANKROLL_KEY)).toBeUndefined()
  })

  it('a `client` (action-click) turn mirrors too, not just a typed `intent`', async () => {
    // The PROVEN jsdom shape (agent-admin.test.ts's GH #418 suite, `:1733`): a single ROOT Button —
    // real enough for the renderer to wire a REAL click → onClientMessage → the runner's `kind:'client'`
    // request, no follow-up re-render of the same surface needed (so the ADR-0128 root-resend guard
    // never enters into it).
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(SURFACE_A2UI_KEY, true)
    el.store!.set(BANKROLL_CAPABLE_KEY, true)
    let turnCount = 0
    el.agentSurfaceTurn = async function* (req) {
      turnCount += 1
      if (req.turn.kind === 'intent') {
        yield { kind: 'note' as const, note: 'Dealt.' }
        yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } }) }
        yield {
          kind: 'line' as const,
          line: JSON.stringify({
            version: 'v1.0',
            updateComponents: {
              surfaceId: 'table-1',
              components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Hit', action: { action: 'hit' } }],
            },
          }),
        }
      } else {
        // The follow-up CLIENT turn (the action click): settle with a fresh bankroll figure.
        yield { kind: 'line' as const, line: updateDataModelLine('/bankroll', 725) }
      }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    composerSubmit(el, 'deal')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
    expect(turnCount).toBe(1)

    const button = el.querySelector('ui-surface-host ui-button') as HTMLElement | null
    expect(button, 'a real rendered A2UI action control must exist to click').not.toBeNull()
    button!.click()
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0)) // GH #63 — the client turn is deferred to a fresh macrotask
    await whenFlushed()

    expect(turnCount, 'the click became the next surface turn').toBe(2)
    expect(el.store!.get(BANKROLL_KEY)).toBe(725)
  })
})

describe('ui-agent-admin — GH #525 design call 1: the composed prompt states the stored bankroll', () => {
  const mounted: Element[] = []
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove()
  })

  async function requestFor(el: UIAgentAdminElement): Promise<{ personaSystem: string }> {
    const seen: { personaSystem: string }[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req as { personaSystem: string })
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'play'
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
    return seen[0]!
  }

  it('opted-in AND a stored figure exists ⇒ the line appears, stating the exact figure', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [BANKROLL_CAPABLE_KEY]: true, [BANKROLL_KEY]: 620 } })
    const req = await requestFor(el)
    expect(req.personaSystem).toContain('Your current bankroll is 620.')
    expect(req.personaSystem).toContain('seed /bankroll from this figure')
  })

  it('opted-in but nothing stored yet ⇒ no line (a fresh seed applies, per the design ruling)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [BANKROLL_CAPABLE_KEY]: true } })
    const req = await requestFor(el)
    expect(req.personaSystem).not.toContain('Your current bankroll is')
  })

  it('a stored figure with NO opt-in ⇒ no line (a persona whose games track no `/bankroll` pointer)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [BANKROLL_KEY]: 620 } })
    const req = await requestFor(el)
    expect(req.personaSystem).not.toContain('Your current bankroll is')
  })
})

describe('ui-agent-admin settings pane — GH #525 design call 3: the bankroll RESET row', () => {
  const mounted: Element[] = []
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove()
  })

  function bankrollRow(el: UIAgentAdminElement): HTMLElement {
    return el.querySelector('[data-part="surface-row"][data-surface="bankroll"]') as HTMLElement
  }

  it('HIDDEN for a persona that never opted in (a bare default store)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    expect(bankrollRow(el).hidden).toBe(true)
  })

  it('VISIBLE for a persona that opted in', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [BANKROLL_CAPABLE_KEY]: true } })
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    expect(bankrollRow(el).hidden).toBe(false)
  })

  it('a persona SWITCH (a real store reassignment) re-derives visibility — never sticky from the prior persona', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [BANKROLL_CAPABLE_KEY]: true } })
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    expect(bankrollRow(el).hidden).toBe(false)
    el.store = createMemoryStore({}) // a different persona, never opted in
    await whenFlushed()
    expect(bankrollRow(el).hidden).toBe(true)
  })

  it('clicking Reset clears the stored figure — a re-render reads "no stored bankroll" back', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [BANKROLL_CAPABLE_KEY]: true, [BANKROLL_KEY]: 550 } })
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const resetBtn = bankrollRow(el).querySelector('[data-part="bankroll-reset"]') as HTMLElement
    expect(resetBtn).not.toBeNull()
    resetBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await whenFlushed()
    expect(sanitizeBankroll(el.store!.get(BANKROLL_KEY))).toBeUndefined()
  })
})
