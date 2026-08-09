// agent-admin-authoring.test.ts — ADR-0178 cl.3 / SPEC-R30: schema-level unit coverage for the
// persona-authoring opt-in gate constant (`SURFACE_AUTHORING_KEY`/`isAuthoringSurfaceEnabled`). The SAME
// inverse-default fail-closed shape `isGenuiSurfaceEnabled`/`isPlannerSurfaceEnabled` already carry — only
// an explicit stored `true` turns the modality on, so a persona that does not author agents is
// byte-identical to before this capability existed.
//
// This file is the schema-level unit coverage only. The gate's other two halves live where they belong:
// the persona-file round trip (the key joining `PERSONA_STATE_KEYS`) in
// `site/pages/agent-admin-persona-file.test.ts`, and the producer-side teaching gate (the composed prompt
// composing zero bytes while off) in `system-prompt-grammar.test.ts`. The gate's admin ROW and the
// host-side apply loop it feeds are ADR-0178 cl.2's, built at S3 with its own LLD.

import { describe, it, expect } from 'vitest'
import { SURFACE_AUTHORING_KEY, isAuthoringSurfaceEnabled } from './agent-admin-schema.ts'
import { SURFACE_A2UI_KEY, SURFACE_GENUI_KEY, SURFACE_GENUI_DOGFOOD_KEY, SURFACE_MARKDOWN_KEY, SURFACE_PLANNER_KEY } from './agent-admin-schema.ts'

describe('SURFACE_AUTHORING_KEY / isAuthoringSurfaceEnabled — fail-closed, absent/non-`true` reads as OFF', () => {
  it('the store key is a stable, distinct string (the SURFACE_A2UI_KEY/SURFACE_PLANNER_KEY precedent)', () => {
    expect(SURFACE_AUTHORING_KEY).toBe('surfaceAuthoring')
  })

  it('it collides with no other Surface Option key — one key, one modality', () => {
    const others = [SURFACE_MARKDOWN_KEY, SURFACE_A2UI_KEY, SURFACE_GENUI_KEY, SURFACE_GENUI_DOGFOOD_KEY, SURFACE_PLANNER_KEY]
    expect(others).not.toContain(SURFACE_AUTHORING_KEY)
  })

  it('only a stored `true` reads as enabled', () => {
    expect(isAuthoringSurfaceEnabled(true)).toBe(true)
  })

  it('undefined/false/a truthy non-boolean all read as OFF (fail-closed, the isGenuiSurfaceEnabled shape)', () => {
    expect(isAuthoringSurfaceEnabled(undefined)).toBe(false)
    expect(isAuthoringSurfaceEnabled(false)).toBe(false)
    expect(isAuthoringSurfaceEnabled('true')).toBe(false)
    expect(isAuthoringSurfaceEnabled(1)).toBe(false)
    expect(isAuthoringSurfaceEnabled(null)).toBe(false)
    expect(isAuthoringSurfaceEnabled({})).toBe(false)
  })
})
