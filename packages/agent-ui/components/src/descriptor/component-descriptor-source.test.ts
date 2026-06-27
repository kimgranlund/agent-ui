import { describe, it, expect } from 'vitest'
import {
  parseDescriptor,
  scalarSeq,
  collectUsedStates,
  collectStyledSlots,
  collectStyledRoles,
  compareDescriptorToSource,
} from './component-descriptor.ts'

// Phase-1 s10 — the source-scan trip-wire (#5). MINIMAL sanity only: the bare-scalar reader fix keeps a
// `- ready` sequence item's value, and a descriptor that matches its (synthetic) source is 0-drift. The fleet
// synthetic + the per-code NEGATIVE CONTROLS (STATE_UNDOCUMENTED/STATE_UNUSED/SLOT_UNDOCUMENTED on unique
// tokens) + the real button.ts/button.css wiring are slice s11. Synthetic strings here (NO real-button read).

// A faithful descriptor: slots {leading, label, trailing}, customStates {ready} — mirroring the button shape.
const DESC = [
  'tag: ui-thing',
  'slots:',
  '  - name: leading',
  '    optional: true',
  '  - name: label',
  '    optional: false',
  '  - name: trailing',
  '    optional: true',
  'customStates:',
  '  - ready',
].join('\n')

// Synthetic source: `ready` armed via internals.states (optional-chained, like button.ts) AND styled via
// :state(ready); the two adornment slots styled in CSS; `label` deliberately NOT CSS-selected (the default cell).
const TS = `requestAnimationFrame(() => this.internals.states?.add('ready'))`
const CSS = `
  :scope > [slot='leading'],
  :scope > [slot='trailing'] { inline-size: 1rem; }
  :scope > [data-role='icon'] { padding: 0; }
  :scope > [data-role='caret'] { padding: 1px; }
  :scope:state(ready) { transition: background-color 1ms; }
`

describe('source-scan trip-wire — bare-scalar reader fix (s10)', () => {
  it('a `- ready` sequence item keeps its value (was dropped to an EMPTY map before the addField fix)', () => {
    expect(scalarSeq(parseDescriptor(DESC), 'customStates')).toEqual(['ready'])
  })
})

describe('source-scan trip-wire — a faithful descriptor is 0-drift (s10)', () => {
  it('the extractors find the source facts (anti-vacuous), then compareDescriptorToSource is empty', () => {
    // anti-vacuous: prove the regexes actually matched the source before asserting zero drift.
    expect([...collectUsedStates(TS, CSS)]).toEqual(['ready'])
    expect([...collectStyledSlots(CSS)].sort()).toEqual(['leading', 'trailing'])
    expect([...collectStyledRoles(CSS)].sort()).toEqual(['caret', 'icon'])
    // `label` is documented but never CSS-selected — the one slot asymmetry, NOT a SLOT_UNDOCUMENTED.
    expect(compareDescriptorToSource(parseDescriptor(DESC), { ts: TS, css: CSS })).toEqual([])
  })
})
