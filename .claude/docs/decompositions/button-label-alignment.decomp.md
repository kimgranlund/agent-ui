# Decomposition — ui-button label-alignment law (GH #442 · single adornment ⇒ start-aligned label)

> Status: proposed · v0.1 · 2026-08-05 · Contract:
> [ADR-0171](../adr/0171-button-label-alignment-single-adornment-start.md) (proposed — build
> starts only from the ratified text). Build plan:
> [`../lld/button-label-alignment.lld.md`](../lld/button-label-alignment.lld.md).
> One writer per file; the build is ONE dispatchable slice; gates FOREGROUND, judged by exit
> codes, never grep.

## Plane 1 — outside-in (the whole, broken into parts)

The domain: WHERE the ui-button label sits within its (unchanged) `1fr` track, per anatomy
structure. Everything else about the button — grid templates, cells, pads, gap, the `[icon-only]`
square, BTN-CARET, the wrapper/heal mechanism, tokens, states, a11y — is a non-goal fence, not a
part.

1. **The CSS law** (`button.css`) — one additive rule: the two single-adornment structure
   selectors (reused verbatim from the `auto 1fr` / `1fr auto` template rules) set
   `justify-self: start` on `> [data-part='label']`; the base rule keeps `center` for bare and
   double-adorned; the GH #293 comment gains a dated ADR-0171 pointer (ADR-0171 cl.1/cl.2).
2. **The probe contract** (`button-css.test.ts` · `button-label-overflow.browser.test.ts`) — the
   LLD §4 frozen flip list: two flips, six holds, three new probes (per-structure alignment
   matrix · single-adorned overflow ellipsis · selector-text pin) (ADR-0171 cl.5).
3. **The docs** (`button.md` prose only) — an alignment column in the anatomy narrative + the
   row-8 clarification (`icon-only` = "adornment-only / no label", role-agnostic) (ADR-0171
   cl.3); frontmatter `attributes[]` byte-untouched, so no descriptor-gate churn.
4. **The visual re-baseline** (`site/pages/button-permutations.ts` inspection) — the permutation
   page shows the new law; comments only, no assertions to edit.

## Plane 2 — inside-out (the actions each part must support)

| Action | Part |
|---|---|
| bare `[label]` stretched wide: label CENTERS (row 7 — unchanged law, probe holds) | 1, 2 |
| `[leading\|label]` stretched wide: label hugs the adornment side (START) | 1, 2 |
| `[label\|trailing]` stretched wide: label at the start edge, adornment at end (START) | 1, 2 |
| `[leading\|label\|trailing]` stretched wide: label CENTERS between the cells | 1, 2 |
| single-adorned + overflowing label: clamp at track width + rendered ellipsis (GH #293 intact) | 1, 2 |
| bare + overflowing label: clamp + ellipsis exactly as today (probe holds) | 2 |
| `[icon-only]` (row 8/9 incl. caret-only): square + centered glyph, byte-untouched | 2 (holds) |
| row 10 (icon+caret, no label): stays ILLEGAL — nothing renders it a structure | non-goal fence (ADR-0171 cl.4 rejection) |
| a stray label rule can never catch the fifth structure (`:not([icon-only])` pinned) | 2 |
| an author reads the per-structure alignment law from the component doc | 3 |
| a reviewer sees the new law across all permutations on one page | 4 |

Coverage: every Plane-2 action maps to a part (or the named fence); every part carries ≥1 action.

## Gates (the build's definition of done)

- `npm run check && npm test` exit 0 — FOREGROUND.
- `npm run test:browser` exit 0 — FOREGROUND, six shards as shipped (no re-monolith, no heap
  bump — the `agent-ui-component-testing` shard law).
- No probe edited outside LLD §4's flip list; a red probe outside it reopens the design via
  escalation, never a local workaround.
- GH #442 Findings comment dated; close on merge.
