// agent-admin-planner.test.ts — ADR-0174 cl.1 / SPEC-R21: schema-level unit coverage for the planner-stage
// opt-in gate constant (`SURFACE_PLANNER_KEY`/`isPlannerSurfaceEnabled`). The SAME inverse-default fail-
// closed shape `isGenuiSurfaceEnabled`/`isGenuiDogfoodEnabled` already carry — only an explicit stored
// `true` turns the modality on. No settings-pane row is built here (ADR-0174 cl.6: all three stages
// — planning/executing/synthesizing — stay INTERNAL; the gate's own admin PRESENTATION is a named-but-
// unbuilt LLD call, ADR-0174 Open fork OF3). The host loop that actually reads this gate is
// `site/lib/plan-runner.ts`'s `runPlannerTurn` (`plannerEnabled`), covered in its own test file.

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
