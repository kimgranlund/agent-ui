import { describe, it, expect } from 'vitest'
import {
  splitFrontmatter,
  parseDescriptor,
  scalarSeq,
  collectUsedStates,
  collectStyledSlots,
  compareDescriptorToSource,
} from './component-descriptor.ts'
// Read the real button source as TEXT (no @types/node — the proven button-descriptor.test.ts fs pattern).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s11 — the #5 source-scan trip-wire PROOF (compareDescriptorToSource, s10). Three planes:
//   • POSITIVE — the SHIPPED button.md descriptor is drift-free against the real button.ts + button.css
//     (`ready` documented + used; leading/trailing documented + styled; `label` the unstyled default cell).
//   • per-code NEGATIVE CONTROLS — each SOURCE_DRIFT code is fired by a synthetic source anchored on a
//     UNIQUE token (busy/gone/badge — NEVER `ready`, which also appears in button.ts comments, so a `ready`
//     mutation could leave the code untouched and falsely read "the check did not bite"; the #3b anchor
//     discipline). The SAME shape with the token documented returns [] — proving each check is non-vacuous.
//   • the bare-scalar reader fix (s10 addField) is load-bearing — scalarSeq over the REAL button.md keeps ['ready'].

const BTN = `${process.cwd()}/packages/agent-ui/components/src/controls/button`
const buttonTs = readFileSync(`${BTN}/button.ts`, 'utf8') as string
const buttonCss = readFileSync(`${BTN}/button.css`, 'utf8') as string
const buttonMd = readFileSync(`${BTN}/button.md`, 'utf8') as string
const buttonDesc = parseDescriptor(splitFrontmatter(buttonMd).fence)

describe('source-scan trip-wire — the REAL button is drift-free (s11 positive)', () => {
  it('button.md customStates/slots tell the truth about button.ts + button.css (0 source-drift)', () => {
    // anti-vacuous: the extractors actually matched the real source before zero-drift is asserted.
    expect([...collectUsedStates(buttonTs, buttonCss)]).toEqual(['ready']) // .states?.add('ready') + :state(ready)
    expect([...collectStyledSlots(buttonCss)].sort()).toEqual(['leading', 'trailing']) // `label` is the unstyled default cell
    expect(compareDescriptorToSource(buttonDesc, { ts: buttonTs, css: buttonCss })).toEqual([])
  })

  it('the bare-scalar reader fix survives on the real button.md (customStates `- ready` → ["ready"])', () => {
    expect(scalarSeq(buttonDesc, 'customStates')).toEqual(['ready'])
  })
})

// ── per-code negative controls (#3b — each anchored on a UNIQUE token, each proven non-vacuous) ──

describe('source-scan trip-wire — per-code negative controls (s11 / #5)', () => {
  it('a :state(busy) styled but absent from customStates → exactly STATE_UNDOCUMENTED', () => {
    const css = `:scope:state(busy) { opacity: 0.5; }` // unique token `busy` — never in a comment
    const descNoBusy = parseDescriptor(['customStates: []', 'slots: []'].join('\n'))
    const descBusy = parseDescriptor(['customStates:', '  - busy', 'slots: []'].join('\n'))
    // anti-vacuous: the extractor sees `busy` used in the css.
    expect([...collectUsedStates('', css)]).toEqual(['busy'])
    expect(compareDescriptorToSource(descNoBusy, { ts: '', css }).map((f) => f.code)).toEqual(['STATE_UNDOCUMENTED'])
    // documenting `busy` clears it — the check is non-vacuous.
    expect(compareDescriptorToSource(descBusy, { ts: '', css })).toEqual([])
  })

  it('a customStates `gone` no source uses → exactly STATE_UNUSED', () => {
    const descGone = parseDescriptor(['customStates:', '  - gone', 'slots: []'].join('\n'))
    // anti-vacuous: the descriptor really carries `gone` (the bare-scalar reader).
    expect(scalarSeq(descGone, 'customStates')).toEqual(['gone'])
    expect(compareDescriptorToSource(descGone, { ts: '', css: '' }).map((f) => f.code)).toEqual(['STATE_UNUSED'])
    // a source that USES `gone` clears it — the check is non-vacuous.
    expect(compareDescriptorToSource(descGone, { ts: `this.internals.states?.add('gone')`, css: '' })).toEqual([])
  })

  it("a [slot='badge'] styled but absent from slots → exactly SLOT_UNDOCUMENTED", () => {
    const css = `:scope > [slot='badge'] { inline-size: 1rem; }` // unique token `badge`
    const descNoBadge = parseDescriptor(['customStates: []', 'slots:', '  - name: label', '    optional: false'].join('\n'))
    const descBadge = parseDescriptor(['customStates: []', 'slots:', '  - name: label', '  - name: badge'].join('\n'))
    // anti-vacuous: the extractor sees `badge` styled.
    expect([...collectStyledSlots(css)]).toEqual(['badge'])
    expect(compareDescriptorToSource(descNoBadge, { ts: '', css }).map((f) => f.code)).toEqual(['SLOT_UNDOCUMENTED'])
    // documenting the `badge` slot clears it — the check is non-vacuous.
    expect(compareDescriptorToSource(descBadge, { ts: '', css })).toEqual([])
  })
})
