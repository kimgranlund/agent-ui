// table-baseline.fixture.ts — the FROZEN pre-widening `ui-table` DOM (ADR-0163 cl.10 / SPEC-R2). Captured
// verbatim (outerHTML) from the pre-widening `table.ts`/`table.css` at commit d6a93cb — the last commit to
// touch table.ts before the MA-1 interactive-widening diff — via a throwaway jsdom capture harness run against
// that unmodified source (never hand-edited). `table-byte-identity.test.ts` rebuilds the SAME three cases,
// in the SAME order, against the CURRENT (post-widening) `table.ts` at every capability's default (off) value,
// and asserts `outerHTML` equality — the "byte-identical at defaults" proof cl.10 requires. Do NOT edit these
// strings by hand; regenerate from a real pre-diff checkout if the baseline scenarios ever need to change.
// The one deliberate amendment since capture (T-0520, an accessibility fix, not a widening): the scroll part
// carries `role="region"` only while `label` names it, and `tabindex="0"` only while it overflows (never in
// jsdom, which lays nothing out), so those two attributes were dropped from the strings below where they no
// longer apply. Every other byte is the original capture.

export const TABLE_BASELINE = {
  withData:
    '<ui-table label="Revenue by region"><div data-part="scroll" role="region" aria-labelledby="ui-table-caption-1"><table><caption id="ui-table-caption-1">Revenue by region</caption><thead><tr><th scope="col">Region</th><th scope="col" data-type="number">Revenue</th></tr></thead><tbody><tr><td>EMEA</td><td data-type="number">42,000</td></tr><tr><td>APAC</td><td data-type="number">31,000</td></tr></tbody></table></div></ui-table>',
  empty: '<ui-table><div data-part="scroll"></div></ui-table>',
  noLabel:
    '<ui-table><div data-part="scroll"><table><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table></div></ui-table>',
} as const
