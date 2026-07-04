// round-trip.test.ts — LLD-C8a / SPEC-R2 AC1, SPEC-R8 AC1. The visible page's proof (like
// renderer.test.ts is a2ui-canvas's): the committed transcript driven through the REAL renderer host,
// deterministically, with no network/key — turn-1 renders + finalizes clean, the scripted click
// round-trips the expected action, the reducer frames it, and turn-2 continues the conversation.

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/components' // self-defines the ui-* controls so the renderer's nodes upgrade + wire clicks
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'
import type { A2uiActionMessage } from '../protocol.ts'
import { recordedTranscript } from '../../tools/agent/transcript.ts'
import { nextTurn, frameClientMessage } from '../../tools/agent/session.ts'

const isAction = (m: A2uiClientMessage): m is A2uiActionMessage => 'action' in m

describe('recorded backbone round-trip (LLD-C2/C8 / SPEC-R2 AC1)', () => {
  it('renders turn-1, round-trips the click, and turn-2 continues — deterministic, no network', () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const sent: A2uiClientMessage[] = []
    // Deterministic id/clock (the renderer.test.ts pattern) so the action round-trip is exact.
    const host = createRenderer({ newId: () => 'act-1', now: () => '2026-07-04T00:00:00.000Z' })
    host.onClientMessage((m) => void sent.push(m))
    host.mount(mount)

    const [turn1, turn2] = recordedTranscript.turns

    // Turn 1 — the canvas-button seed renders a live ui-button; the complete set finalizes clean.
    for (const line of turn1!.lines) host.ingest(line)
    expect(mount.querySelector('ui-button')).not.toBeNull()
    host.finalize('canvas')

    // The scripted interaction: click the button → exactly one action client-message round-trips.
    ;(mount.querySelector('ui-button') as HTMLElement).click()
    expect(sent).toHaveLength(1)
    const msg = sent[0]!
    expect(isAction(msg)).toBe(true)
    const expected = turn1!.expectClientMessage
    if (isAction(msg) && expected && 'action' in expected) {
      expect(msg.action.name).toBe(expected.action.name) // 'submit'
      expect(msg.action.surfaceId).toBe(expected.action.surfaceId) // 'canvas'
    }

    // The reducer frames it into a distinct, non-empty next-turn user input (SPEC-R8).
    expect(frameClientMessage(msg)).toContain('submit')
    expect(nextTurn({ turns: [] }, msg).kind).toBe('client')

    // Turn 2 — the agent continues: a second surface (a Text confirmation) renders under the same mount.
    const before = mount.childElementCount
    for (const line of turn2!.lines) host.ingest(line)
    host.finalize('confirmation')
    expect(mount.querySelector('ui-text')).not.toBeNull()
    expect(mount.childElementCount).toBeGreaterThan(before)

    host.dispose()
    mount.remove()
  })
})
