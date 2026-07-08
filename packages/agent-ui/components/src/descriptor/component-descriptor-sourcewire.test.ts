import { describe, it, expect } from 'vitest'
import {
  splitFrontmatter,
  parseDescriptor,
  scalarSeq,
  collectUsedStates,
  collectStyledSlots,
  compareDescriptorToSource,
} from './component-descriptor.ts'
// Read the real button source as TEXT (the proven button-descriptor.test.ts fs pattern).
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

const SRC = `${process.cwd()}/packages/agent-ui/components/src/controls`

const BTN = `${SRC}/button`
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

// G6 s12 — extend the POSITIVE plane to ui-text-field. text-field-descriptor.test.ts (s10) deliberately scoped
// the contract↔SOURCE check OUT (it covers only the schema + the contract↔props trip-wire), so the integration
// slice is where text-field.md's customStates/slots are cross-checked against where they actually live —
// text-field.ts's internals.states usage + text-field.css's :state()/[slot] selectors. The four custom states
// (ready/disabled/user-invalid/revealed — `revealed` added by Wave 3 for the password reveal toggle, ADR-0044)
// are all add/delete'd in the .ts AND keyed in the .css, and the two adornment slots (leading/trailing) are
// both styled — so the shipped descriptor is drift-free.
const TF = `${SRC}/text-field`
const textFieldTs = readFileSync(`${TF}/text-field.ts`, 'utf8') as string
const textFieldCss = readFileSync(`${TF}/text-field.css`, 'utf8') as string
const textFieldMd = readFileSync(`${TF}/text-field.md`, 'utf8') as string
const textFieldDesc = parseDescriptor(splitFrontmatter(textFieldMd).fence)

describe('source-scan trip-wire — the REAL text-field is drift-free (s12 positive)', () => {
  it('text-field.md customStates/slots tell the truth about text-field.ts + text-field.css (0 source-drift)', () => {
    // anti-vacuous: the extractors actually matched the real source before zero-drift is asserted.
    expect([...collectUsedStates(textFieldTs, textFieldCss)].sort()).toEqual(['disabled', 'ready', 'revealed', 'user-invalid'])
    expect([...collectStyledSlots(textFieldCss)].sort()).toEqual(['leading', 'trailing'])
    expect(compareDescriptorToSource(textFieldDesc, { ts: textFieldTs, css: textFieldCss })).toEqual([])
  })

  it('the bare-scalar reader carries all four states off the real text-field.md', () => {
    expect(scalarSeq(textFieldDesc, 'customStates').sort()).toEqual(['disabled', 'ready', 'revealed', 'user-invalid'])
  })
})

// G9 s12 — extend the POSITIVE plane to the container family whose per-element descriptor probe deliberately
// scoped the contract↔SOURCE check OUT (card/list/modal). row/column/grid/tabs already cross-check source in
// their own `-descriptor.test.ts`; the three below defer to this integration slice (the text-field s12
// precedent above). The headline is CARD — a MULTI-ELEMENT folder (card.ts + three region sub-elements, ONE
// card.md): the source scan must CONCAT the folder's `.ts` files (a state/slot can live in any of them) before
// it cross-checks card.md, exactly as tabs-descriptor.test.ts already concats tabs.ts+tab.ts+tab-panel.ts.
const CARD = `${SRC}/card`
// concat ALL of the card family's behaviour files — the multi-element-folder rule (states/slots span files).
const cardTs = ['card.ts', 'card-header.ts', 'card-content.ts', 'card-footer.ts']
  .map((f) => readFileSync(`${CARD}/${f}`, 'utf8') as string)
  .join('\n')
const cardCss = readFileSync(`${CARD}/card.css`, 'utf8') as string
const cardDesc = parseDescriptor(splitFrontmatter(readFileSync(`${CARD}/card.md`, 'utf8') as string).fence)

describe('source-scan trip-wire — the REAL card family is drift-free (s12, MULTI-ELEMENT concat)', () => {
  it('card.md slots/customStates tell the truth about the CONCATENATED card.ts + region sub-elements + card.css', () => {
    // anti-vacuous: the header/footer adornment cells are styled in card.css; the body/region surface declares
    // no :state() custom states — a card is a static surface (card.md customStates: []).
    expect([...collectUsedStates(cardTs, cardCss)]).toEqual([]) // no interaction states across the four files
    expect([...collectStyledSlots(cardCss)].sort()).toEqual(['leading', 'trailing']) // `label` is the unstyled default cell
    expect(scalarSeq(cardDesc, 'customStates')).toEqual([]) // documented as stateless
    expect(compareDescriptorToSource(cardDesc, { ts: cardTs, css: cardCss })).toEqual([])
  })
})

// list / modal — single-element container folders that likewise deferred their source cross-check here.
const LIST = `${SRC}/list`
const listDesc = parseDescriptor(splitFrontmatter(readFileSync(`${LIST}/list.md`, 'utf8') as string).fence)
const MODAL = `${SRC}/modal`
const modalDesc = parseDescriptor(splitFrontmatter(readFileSync(`${MODAL}/modal.md`, 'utf8') as string).fence)

describe('source-scan trip-wire — the REAL list + modal are drift-free (s12)', () => {
  it('list.md is 0-drift: a semantic stack declares no :state() and no styled [slot] (items are default children)', () => {
    const ts = readFileSync(`${LIST}/list.ts`, 'utf8') as string
    const css = readFileSync(`${LIST}/list.css`, 'utf8') as string
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([]) // `items` is documented as the default/unnamed children — not a styled cell
    expect(compareDescriptorToSource(listDesc, { ts, css })).toEqual([])
  })

  it('modal.md is 0-drift: the dialog visibility is the native [open]/top-layer, not a custom :state()', () => {
    const ts = readFileSync(`${MODAL}/modal.ts`, 'utf8') as string
    const css = readFileSync(`${MODAL}/modal.css`, 'utf8') as string
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(modalDesc, { ts, css })).toEqual([])
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
