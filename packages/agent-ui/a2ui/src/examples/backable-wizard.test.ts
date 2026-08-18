// backable-wizard.test.ts — GH #1192 acceptance (req-a2ui-patterns.md R2 / ADR-0198's 2026-08-18
// amendment B1): a real-renderer proof that the `backable-wizard` seed's BACK round-trip actually
// preserves draft values (not merely that the scripted messages happen to repeat the same literals),
// and that the confirm scene's receipt passes the receipt-clause shape (a DescriptionList of label/value
// rows, ADR-0201) — the two acceptance criteria the ticket's clause work doesn't otherwise cover
// (examples.test.ts's generic validate+render-smoke proves the stream is WELL-FORMED; this proves the
// SPECIFIC mechanic the B1 carve-out exists for: a scene swap disposes the earlier scene's component
// records, but the bound data-model paths under `/draft/*` survive untouched, so the re-mounted control
// reads back what the user already chose).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { createRenderer } from '../renderer/renderer.ts'
import { backableWizardSeed } from './catalog-frontier.ts'
import type { A2uiServerMessage } from '../protocol.ts'

// jsdom reality (examples.test.ts's own precedent, restated here since this file mounts REAL Calendar/
// RadioGroup/Radio controls too): `ElementInternals.setFormValue`/`setValidity` are ABSENT in jsdom, and
// every form-associated control calls both unconditionally in its own `connectedCallback` — an uncaught
// exception inside a reactive effect that fails the run even though the calling test "passes". Stubbed
// once at the shared prototype for this file's duration only (saved + restored).
let savedSetFormValue: unknown
let savedSetValidity: unknown
beforeAll(() => {
  savedSetFormValue = ElementInternals.prototype.setFormValue
  savedSetValidity = ElementInternals.prototype.setValidity
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ElementInternals.prototype.setFormValue = function (): void {}
  }
  if (typeof ElementInternals.prototype.setValidity !== 'function') {
    ElementInternals.prototype.setValidity = function (): void {}
  }
})
afterAll(() => {
  ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
  ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
})

const line = (m: A2uiServerMessage): string => JSON.stringify(m)

// Index map into `backableWizardSeed.messages`, named so the test reads as the turn-by-turn story
// rather than magic numbers (mirrors the seed's own inline turn comments).
const [
  MSG_CREATE,
  MSG_SEED_DRAFT,
  MSG_SCENE_DATES,
  MSG_SET_FROM,
  MSG_SET_TO,
  MSG_SCENE_ROOM,
  MSG_WIRE_ROOM_VALUE_1,
  MSG_BACK_TO_DATES,
  MSG_FORWARD_TO_ROOM,
  MSG_WIRE_ROOM_VALUE_2,
  MSG_SET_ROWS,
  MSG_SCENE_CONFIRM,
] = backableWizardSeed.messages

describe('backable-wizard seed (GH #1192, req-a2ui-patterns.md R2) — real-renderer BACK round-trip', () => {
  it('has exactly the 12 scripted turns this test indexes by name (a shape guard against silent reordering)', () => {
    expect(backableWizardSeed.messages).toHaveLength(12)
  })

  it('scene 1 (dates): the Calendar starts EMPTY, bound to /draft/from and /draft/to', async () => {
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(line(MSG_CREATE!))
    r.ingest(line(MSG_SEED_DRAFT!))
    r.ingest(line(MSG_SCENE_DATES!))
    await whenFlushed()

    const cal = mount.querySelector('ui-calendar') as (HTMLElement & { valueStart: string; valueEnd: string }) | null
    expect(cal).not.toBeNull()
    expect(cal!.valueStart).toBe('')
    expect(cal!.valueEnd).toBe('')

    r.dispose()
    mount.remove()
  })

  it('BACK round-trip: dates → room → BACK to dates re-renders the SAME chosen range untouched (B1)', async () => {
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    r.ingest(line(MSG_CREATE!))
    r.ingest(line(MSG_SEED_DRAFT!))
    r.ingest(line(MSG_SCENE_DATES!))
    await whenFlushed()

    // the user picks a range and hits Continue — the committed range lands in the draft
    r.ingest(line(MSG_SET_FROM!))
    r.ingest(line(MSG_SET_TO!))
    r.ingest(line(MSG_SCENE_ROOM!))
    r.ingest(line(MSG_WIRE_ROOM_VALUE_1!))
    await whenFlushed()

    // scene 2: the Calendar is GONE (its component record was disposed by the scene swap) — only the
    // RadioGroup exists now, proving the swap really replaced the tree rather than merely hiding it.
    expect(mount.querySelector('ui-calendar')).toBeNull()
    const rooms = mount.querySelector('ui-radio-group') as (HTMLElement & { value: string | null }) | null
    expect(rooms).not.toBeNull()
    expect(rooms!.value).toBe('deluxe')

    // BACK: "scene" swaps to the dates shape again — a FRESH Calendar mount (the old one was disposed),
    // re-bound to the SAME /draft/from,/draft/to paths, which this update never rewrites.
    r.ingest(line(MSG_BACK_TO_DATES!))
    await whenFlushed()

    expect(mount.querySelector('ui-radio-group')).toBeNull() // the room scene is gone in turn
    const calAgain = mount.querySelector('ui-calendar') as (HTMLElement & { valueStart: string; valueEnd: string }) | null
    expect(calAgain).not.toBeNull()
    expect(calAgain!.valueStart, 'the range chosen before the detour must survive the scene swap').toBe('2026-08-21')
    expect(calAgain!.valueEnd, 'the range chosen before the detour must survive the scene swap').toBe('2026-08-24')

    // forward again: the room scene remounts, and /draft/room is STILL "deluxe" — the value already
    // committed before the detour, the second half of the round-trip proof.
    r.ingest(line(MSG_FORWARD_TO_ROOM!))
    r.ingest(line(MSG_WIRE_ROOM_VALUE_2!))
    await whenFlushed()
    const roomsAgain = mount.querySelector('ui-radio-group') as (HTMLElement & { value: string | null }) | null
    expect(roomsAgain).not.toBeNull()
    expect(roomsAgain!.value, 'the room chosen before the detour must survive the round-trip too').toBe('deluxe')

    r.dispose()
    mount.remove()
  })

  it('the receipt rows land via a targeted /draft/rows write, and the confirm scene resends "scene" alone', () => {
    expect(MSG_SET_ROWS).toMatchObject({ updateDataModel: { path: '/draft/rows' } })
    expect(MSG_SCENE_CONFIRM).toMatchObject({ updateComponents: {} })
    const ids = 'updateComponents' in MSG_SCENE_CONFIRM! ? MSG_SCENE_CONFIRM.updateComponents.components.map((c) => c.id) : []
    expect(ids).toEqual(['scene', 'rcpt', 'nav3', 'back3', 'commit'])
  })

  it('confirm scene: the receipt passes the receipt-clause shape — a DescriptionList of humanized label/value rows', async () => {
    const r = createRenderer()
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    for (const m of backableWizardSeed.messages) r.ingest(line(m))
    await whenFlushed()

    // the final scene is the confirm receipt — the room scene's RadioGroup is gone, replaced in kind.
    expect(mount.querySelector('ui-radio-group')).toBeNull()
    const receipt = mount.querySelector('ui-description-list')
    expect(receipt, 'the confirm scene must render ONE DescriptionList (ADR-0201 receipt clause)').not.toBeNull()

    const rows = [...receipt!.querySelectorAll('[data-part="row"]')]
    expect(rows).toHaveLength(2)
    const labels = rows.map((row) => row.querySelector('[data-part="label"]')?.textContent?.trim())
    const values = rows.map((row) => row.querySelector('[data-part="value"]')?.textContent?.trim())
    expect(labels).toEqual(['Dates', 'Room'])
    expect(values).toEqual(['21–24 Aug · 3 nights', 'Deluxe King · €240/night'])

    // the flow-final commit Button is present, alongside a ghost Back — the confirm-before-concluding
    // law (grammar.md) still lets the user go back and amend even at the last scene.
    const buttons = [...mount.querySelectorAll('ui-button')].map((b) => b.textContent?.trim())
    expect(buttons).toEqual(['Back', 'Confirm booking'])

    r.dispose()
    mount.remove()
  })

  it('the whole stream is ONE surface throughout — never a second createSurface, matching posture (i)', () => {
    const createCount = backableWizardSeed.messages.filter((m) => 'createSurface' in m).length
    expect(createCount).toBe(1)
    for (const m of backableWizardSeed.messages) {
      const surfaceId =
        ('createSurface' in m && m.createSurface.surfaceId) ||
        ('updateComponents' in m && m.updateComponents.surfaceId) ||
        ('updateDataModel' in m && m.updateDataModel.surfaceId) ||
        undefined
      expect(surfaceId).toBe(backableWizardSeed.surfaceId)
    }
  })

  it('root is delivered exactly once — every later structural turn resends "scene" (or its receipt), never "root"', () => {
    const componentIds = backableWizardSeed.messages.flatMap((m) => ('updateComponents' in m ? m.updateComponents.components.map((c) => c.id) : []))
    expect(componentIds.filter((id) => id === 'root')).toHaveLength(1)
    expect(componentIds.filter((id) => id === 'shell')).toHaveLength(1)
  })
})
