// settings-schema.test.ts — regression coverage for the hoisted fail-closed guards (ADR-0135 Piece A).
// Scoped to `sanitizeBoolean`, the guard ADR-0168 cl.6 (LLD-C8) added for the `boolean` member of
// `SettingsFieldType`: the vocabulary's other guards are exercised through their a2ui/app consumers'
// own suites, but a projected enablement toggle coercing a stray stored value truthy would silently arm
// a tool, so this one is pinned at its own definition site.

import { describe, it, expect } from 'vitest'
import type { SettingsSchema } from './settings-schema.ts'
import { sanitizeBoolean } from './settings-schema.ts'

const SCHEMA: SettingsSchema = {
  version: 1,
  sections: [
    {
      id: 'flags',
      label: 'Flags',
      fields: [
        { key: 'offByDefault', type: 'boolean', label: 'Off by default', default: false },
        { key: 'onByDefault', type: 'boolean', label: 'On by default', default: true },
        { key: 'notABoolean', type: 'text', label: 'Text field', default: 'hello' },
      ],
    },
  ],
}

describe('sanitizeBoolean — the boolean field guard (ADR-0135 Piece A / ADR-0168 cl.6)', () => {
  it('passes a real boolean straight through, both ways', () => {
    expect(sanitizeBoolean(SCHEMA, 'offByDefault', true, false)).toBe(true)
    expect(sanitizeBoolean(SCHEMA, 'onByDefault', false, true)).toBe(false)
  })

  it("falls back to the field's OWN declared default when nothing is stored", () => {
    expect(sanitizeBoolean(SCHEMA, 'offByDefault', undefined, true)).toBe(false)
    expect(sanitizeBoolean(SCHEMA, 'onByDefault', undefined, false)).toBe(true)
  })

  it('never coerces a truthy non-boolean — the stored value must BE a boolean', () => {
    for (const raw of ['true', 'yes', 1, [], {}, new Date()]) {
      expect(sanitizeBoolean(SCHEMA, 'offByDefault', raw, false)).toBe(false)
    }
  })

  it('never coerces a falsy non-boolean either — a `default: true` field stays true', () => {
    for (const raw of ['', 0, null, undefined, NaN]) {
      expect(sanitizeBoolean(SCHEMA, 'onByDefault', raw, false)).toBe(true)
    }
  })

  it('uses the passed fallback when the schema declares no usable default (unknown key / wrong type)', () => {
    expect(sanitizeBoolean(SCHEMA, 'noSuchField', 'true', false)).toBe(false)
    expect(sanitizeBoolean(SCHEMA, 'noSuchField', 'true', true)).toBe(true)
    // A field whose declared default isn't a boolean cannot supply one.
    expect(sanitizeBoolean(SCHEMA, 'notABoolean', 'hello', false)).toBe(false)
  })
})
