import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { UIConversationElement } from './conversation.ts'
import type { UISurfaceHostElement } from '../surface-host/surface-host.ts'
import '@agent-ui/components/all'
import { createRenderer as warm } from '@agent-ui/a2ui'
await warm().preload('agent-ui')
declare const process: { cwd(): string }

// T-0472 guarding T-0467: the keyless host leg of the round 14 same-turn ask deck. The probe replay
// scripts/e2e-admin/probe/replays/mentalist-haiku-same-turn-ask-deck.json is trace line :117 of the round, a turn whose ONE
// `messages` array creates `ask-1` (the OptionDeck) before `hud-1`. The offline replay leg (its `.test.mjs`) pins the
// recorded lines; this file feeds those same lines to the real ui-conversation, because the lost press was the GH #1164
// superseded sweep dimming `ask-1` when `hud-1` mounted, which only the host can show. Dropping `mintedThisTurn` from the
// sweep reds it.

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

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  vi.useRealTimers()
})

const REPLAY = 'scripts/e2e-admin/probe/replays/mentalist-haiku-same-turn-ask-deck.json'

describe('ui-conversation: the round 14 ask deck replay (T-0467)', () => {
  it('the recorded turn creates ask-1 before hud-1 and both hosts stay live', () => {
    const fixture = JSON.parse(readFileSync(`${process.cwd()}/${REPLAY}`, 'utf8')) as { turns: { lines: string[] }[] }
    const lines = fixture.turns[0]!.lines.filter((l) => {
      const m = JSON.parse(l) as Record<string, unknown>
      return m['createSurface'] !== undefined || m['updateComponents'] !== undefined || m['updateDataModel'] !== undefined
    })
    const created = lines.flatMap((l) => {
      const id = (JSON.parse(l) as { createSurface?: { surfaceId: string } }).createSurface?.surfaceId
      return id === undefined ? [] : [id]
    })
    expect(created, 'the recorded order is the shape that failed live').toEqual(['ask-1', 'hud-1'])

    const el = document.createElement('ui-conversation') as UIConversationElement
    document.body.append(el)
    mounted.push(el)
    const turn = el.beginAgentTurn()
    for (const l of lines) turn.ingestLine(l)
    turn.finalize()
    const hosts = Array.from(el.querySelectorAll('[data-part="log"] ui-surface-host')) as UISurfaceHostElement[]
    expect(hosts.length).toBe(2)
    expect(hosts[0]!.superseded, 'the ask deck minted first this turn stays answerable').toBe(false)
    expect(hosts[1]!.superseded).toBe(false)
  })
})
