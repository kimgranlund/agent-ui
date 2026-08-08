// agent-admin-planner.test.ts — ADR-0174 cl.1 / SPEC-R21: schema-level unit coverage for the planner-stage
// opt-in gate constant (`SURFACE_PLANNER_KEY`/`isPlannerSurfaceEnabled`). The SAME inverse-default fail-
// closed shape `isGenuiSurfaceEnabled`/`isGenuiDogfoodEnabled` already carry — only an explicit stored
// `true` turns the modality on. OF3 (the gate's own admin PRESENTATION) is now RULED and built:
// agent-admin.ts's own Planner row in Surface Options (beside GenUI, a bare ungrouped row — the stage
// itself has no sub-options yet) — that row's render/toggle/live-apply coverage lives in
// agent-admin.test.ts (the SAME idiom the markdown/a2ui/genui rows already use), THIS file stays the
// schema-level unit coverage only. ADR-0174 cl.6 still holds: all three stages —
// planning/executing/synthesizing — stay INTERNAL; the row is only the ONE user-facing lever the pilot
// introduces. The host loop that actually reads this gate is `site/lib/plan-runner.ts`'s `runPlannerTurn`
// (`plannerEnabled`), covered in its own test file.

import { describe, it, expect } from 'vitest'
import { SURFACE_PLANNER_KEY, isPlannerSurfaceEnabled } from './agent-admin-schema.ts'

describe('SURFACE_PLANNER_KEY / isPlannerSurfaceEnabled — fail-closed, absent/non-`true` reads as OFF', () => {
  it('the store key is a stable, distinct string (the SURFACE_A2UI_KEY/SURFACE_GENUI_KEY precedent)', () => {
    expect(SURFACE_PLANNER_KEY).toBe('surfacePlanner')
  })

  it('only a stored `true` reads as enabled', () => {
    expect(isPlannerSurfaceEnabled(true)).toBe(true)
  })

  it('undefined/false/a truthy non-boolean all read as OFF (fail-closed, the isGenuiSurfaceEnabled shape)', () => {
    expect(isPlannerSurfaceEnabled(undefined)).toBe(false)
    expect(isPlannerSurfaceEnabled(false)).toBe(false)
    expect(isPlannerSurfaceEnabled('true')).toBe(false)
    expect(isPlannerSurfaceEnabled(1)).toBe(false)
    expect(isPlannerSurfaceEnabled(null)).toBe(false)
  })
})
