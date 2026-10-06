// surface-seeds.ts: the producer's cross-turn validation seed builder, moved verbatim out of produce.ts so
// a browser-safe caller can import it without produce.ts's import closure (system-prompt.ts reads prompt
// files relative to process.cwd() at module load). The A2UI test kit's judge (tools/testkit/judge.ts) is
// the second caller. Never re-exported from `src/agent/index.ts`: this is not part of the `./agent`
// package surface. Type-only imports, so the NODE-FENCE and SDK-FREE legs of gates.test.ts still hold.

import type { A2uiComponent } from '../protocol.ts'
import type { SurfaceSeed } from '../renderer/validate.ts'
import type { Session } from './agent-transport.ts'

/**
 * TKT-0081: the cross-turn validation seed: replay the session's prior ASSISTANT turns (validated JSONL,
 * exactly what `appendAssistantTurn` stored) into a per-surface `SurfaceSeed` for `validateA2ui`. Without
 * it the per-round validator is session-blind and structurally CONTRADICTS the renderer on follow-up
 * turns: an update-only payload (no `root`) fails `root-missing`/dangling standalone, while re-sending
 * `root` passes standalone but fails the renderer's cross-turn ADR-0128 IDGRAPH guard; live models
 * resolved the trap by shipping full trees and eating a client-error round per move (the Croupier game
 * loop, measured). Seeded, the validator judges the MERGED graph the renderer will actually hold:
 * update-only follow-ups validate; a root-resend fails HERE (`sid:root`) as a pre-wire self-correct
 * round. A prior `deleteSurface` drops that surface's seed (a later re-create starts fresh), and so does a
 * prior `createSurface` (see below).
 *
 * GH #307 review F2: a prior-turn `createSurface` RESETS that surfaceId's seed, exactly as `deleteSurface`
 * does. The renderer's re-create is a teardown-and-rebuild, not a merge (`renderer.ts` drops the prior
 * root's DOM, mints a FRESH surface in the store and a FRESH `SurfaceTree`), so every component delivered
 * before the re-create is gone from the live surface. Replaying those into the seed anyway left GHOST ids
 * that resolve dangling refs the renderer would then render as nothing, the seed claiming a richer graph
 * than the renderer holds, which is precisely the drift this seed exists to prevent, only in the permissive
 * direction. The reset is order-sensitive within a turn: the SAME turn's later `updateComponents` rebuild
 * the seed on top of the cleared surface, which is what a legitimate re-create + full-tree resend does,
 * and that resend is the escape hatch `IDGRAPH_HINTS.duplicateRoot` now teaches, so this path went from
 * rare to routine.
 */
export function sessionSurfaceSeeds(session: Session): Map<string, SurfaceSeed> {
  const seeds = new Map<string, { components: A2uiComponent[]; byId: Map<string, A2uiComponent>; rootDelivered: boolean }>()
  for (const turn of session.turns) {
    if (turn.role !== 'assistant') continue
    for (const line of turn.content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue
      try {
        const msg = JSON.parse(trimmed) as {
          createSurface?: { surfaceId?: string }
          updateComponents?: { surfaceId?: string; components?: A2uiComponent[] }
          deleteSurface?: { surfaceId?: string }
        }
        if (msg.deleteSurface?.surfaceId !== undefined) {
          seeds.delete(msg.deleteSurface.surfaceId)
          continue
        }
        if (msg.createSurface?.surfaceId !== undefined) {
          seeds.delete(msg.createSurface.surfaceId) // teardown-and-rebuild, not a merge (F2)
          continue
        }
        const body = msg.updateComponents
        if (body?.surfaceId === undefined || !Array.isArray(body.components)) continue
        let seed = seeds.get(body.surfaceId)
        if (seed === undefined) {
          seed = { components: [], byId: new Map(), rootDelivered: false }
          seeds.set(body.surfaceId, seed)
        }
        for (const comp of body.components) {
          if (typeof comp?.id !== 'string') continue
          seed.byId.set(comp.id, comp) // upsert: a later resend REPLACES (the renderer's merge)
          if (comp.id === 'root') seed.rootDelivered = true
        }
      } catch {
        // not JSON (shouldn't happen for a stored assistant turn): skip rather than throw
      }
    }
  }
  return new Map([...seeds].map(([sid, s]) => [sid, { components: [...s.byId.values()], rootDelivered: s.rootDelivered }]))
}
