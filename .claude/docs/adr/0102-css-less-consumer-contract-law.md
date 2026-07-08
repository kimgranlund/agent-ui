# ADR-0102 — The CSS-less-consumer contract law: no rendered-correctness concern may live only in "the page author's CSS"; the three-lane decision rule

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | system-planner — the design seat, from the 2026-07-08 gallery-defect family (tickets #29 #30 #31 #32 #33; fork-diagnosed, screenshot-grounded) |
> | **Ratified by** | Kim (host) · 2026-07-08 — Status flipped in Kim's own 0101–0106 ratification round (his approved→accepted sed, landed `e30ac3e`); cell was stale-pending until the 2026-07-08 housekeeping pass |
> | **Repairs** | This record is the owning doc for the law itself (a global pattern — no existing PRD/SPEC clause owns it). On ratification: `a2ui-catalog.spec.md` §5 gains one normative sentence citing this law (component rows may not delegate rendered correctness to page CSS); `.claude/docs/references/` gains a pointer if a fleet-standards page exists for contract authoring. The four mechanism rulings that apply the law are their own records: ADR-0103 (spacing pair), ADR-0104 (tabs surface), ADR-0105 (calendar width), ADR-0106 (text overflow). Decomp: [`css-less-consumer-family.decomp.json`](../decompositions/css-less-consumer-family.decomp.json) · **on accept: the reciprocal `Generalized by ADR-0102` back-link on ADR-0096** (scheduled per the back-links-land-at-accept convention) |
> | **Supersedes / Superseded by** | **Generalizes ADR-0096** (its forcing argument — the catalog consumer has no CSS-authoring verb — was ratified for `ui-row`/`ui-column` reflow; this ADR promotes the argument to a fleet-wide law and names the decision rule 0096 applied implicitly). Extends ADR-0091 (the taught-idiom lane's mechanism) · relates ADR-0071/0076/0098 (the catalog-prop lane's advertising + validation) · ADR-0015/0030 (the surface/default precedents the mechanism ADRs touch) · relates **ADR-0100** (the sibling application of 0096's no-CSS-verb argument, to query-container establishment — the other 0096 descendant, cross-referenced per review) |

## Context

ADR-0096 ratified a forcing argument this fleet had never priced in: **the catalog's primary consumer
class — a Gen-UI/A2UI model — composes from catalog props only and has NO CSS-authoring verb.** Its
entire vocabulary is `catalog.json`'s component types and props (ADR-0071 derives the prompt inventory
from it; ADR-0076/0098 drop or reject anything outside it). "Write a CSS rule on the element" is a verb
this consumer structurally does not have.

One session's gallery audit then produced **five independent defects with the same root**: a component
contract that reads "the page author supplies layout / spacing / surface / width" renders *deterministically
wrong* on every A2UI surface, because the consumer that would supply it does not exist there:

- `radio-group.css:22-24` / `radio-group.md:95` — "spacing and alignment are the page author's
  responsibility" → radios crash together (ticket #31; `ui-radio` is `display:inline-flex`, so they mash
  inline with zero gap).
- `form-provider.css` [1]/[2] — "the slotted subtree owns every box" → form fields crash together
  (ticket #33; repaired in the seed by the Column-gap wrap, `68d2a8d`).
- `tabs.css:16-20` — a bare `ui-tabs` seeds its own `neutral-surface` plane → a wrong second box inside a
  Card's elevated surface (ticket #29, the pattern-wizard seed: `Card elevation='1'` at
  `catalog-coverage.ts:115`).
- `calendar.css:202-208` — fixed 7×`cell-size` tracks; `calendar.css:116`: "callers set width … to control
  sizing" → half-empty panel when a stretched Column hands the calendar real width (ticket #30).
- `button.css:99-103` — a control label that wrapped to two lines (fixed, `442802d`) and no fleet answer
  for title-ellipsis (ticket #32).

The defects are not a coincidence of sloppy CSS; they are one contract *form* failing one consumer *class*.
Each was individually "correct" under the fleet's page-author assumption. The design cannot keep answering
this per component — the fleet needs the principle answered once, with a decision rule the next contract
author applies instead of re-litigating.

## Decision

We adopt the **CSS-less-consumer contract law**, fleet-wide, with a three-lane decision rule:

1. **The law.** A `ui-*` component contract may not delegate a **rendered-correctness concern** — layout
   axis, interior spacing, surface identity, width adaptation, overflow behavior — to "the page author's
   CSS" as the *sole* mechanism. Page-author CSS survives as an *override freedom* (element-level CSS still
   wins; nothing here removes it), never as the only path to a non-defective rendering. A contract clause
   of the form "the page author owns X" is valid only when the no-CSS rendering of X is already correct.
2. **The three lanes.** Every such concern is served by exactly one of:
   - **Lane A — component-owned safe default.** The component renders correctly with zero consumer action.
     Required when the catalog grammar *cannot express* the fix by composition (ADR-0096: "you cannot teach
     a consumer to use a mechanism its grammar cannot express") or when the concern is the component's own
     identity (its axis, its overflow, its interior rhythm between parts only it knows).
   - **Lane B — catalog-reachable prop.** A per-instance intent (surface on/off, magnitude, adaptation
     mode) becomes a prop with a safe default: `catalog.json` row → ADR-0071 advertising → ADR-0076/0098
     validation. The default must satisfy Lane A's bar; the prop expresses *intent*, never *repair*.
   - **Lane C — taught idiom.** Composition that the grammar already expresses (the Column-gap wrap) is
     taught through exemplars/corpus/mini-skills (ADR-0091), **only when the no-uptake failure is graceful**
     (readable, non-destructive, cosmetic). Lane C is never the answer to a destructive failure — that is
     ADR-0096's own rejected alternative 1.
3. **The chooser.** In order: (i) can the catalog grammar express the fix by composition at all? No → Lane
   A/B. (ii) Is the no-uptake rendering destructive (clipped, overlapping, unreadable, semantically wrong)
   or merely suboptimal? Destructive → the *default* must be safe (Lane A, or Lane B's default). Graceful →
   Lane C is acceptable, with the residual probabilistic-uptake risk stated and accepted in the applying
   record (the ADR-0096 row-side precedent). (iii) Is the concern per-instance intent? → Lane B on top of
   the safe default.
4. **Application discipline.** Each application of the law is its own decision record (one reversible
   mechanism per record), must **measure who relies on the old default** before flipping it (blast radius
   named, not guessed), and must repair the lying contract docs (`*.md` descriptors, SPEC rows) in the same
   change. The first four applications are ADR-0103/0104/0105/0106.

## Acceptance

- ADR-0103/0104/0105/0106 each cite this law and name their lane with the chooser's reasoning; each passes
  `adr_check.py`.
- After the four builds land, the shipped gallery seeds (rental-filter-panel, generative-form,
  pattern-wizard, booking-reservation, document-row-toolbar) render without the five diagnosed defects on
  an unmodified A2UI mount surface — screenshot-verified, both engines.
- A grep of the fleet's `*.md` descriptors for "page author" finds no clause where page CSS is the sole
  correctness mechanism (each hit is override-freedom phrasing or has a named lane).

## Consequences

- **"Layout-neutral by design" is demoted from a virtue to a claim that needs a lane.** Components whose
  neutrality was load-bearing simplicity (radio-group, form-provider) now owe either a safe default or a
  taught idiom; the neutrality stance survives only where the no-CSS rendering is already correct.
- **The catalog's prop surface will grow** (Lane B applications), each prop paying prompt-inventory tokens
  (ADR-0071) and validation rows (ADR-0098). Accepted: reachability is the product's substrate; growth is
  bounded by the chooser (intent props only, never repair props).
- **Page authors may see shipped defaults change under them** as applications land (radio-group gains
  layout; tabs loses its plane). Each application owes its own measured blast radius and same-change doc
  repairs — this law does not bulk-authorize silent default flips.
- **The teaching lane's residual risk is now a sanctioned cost** — but only for graceful failures, and only
  stated-not-silent. A future destructive failure discovered behind a Lane C choice re-opens the applying
  record, not this law.
- **Flagged, not repaired here:** (a) ticket #27 (ui-text `as=h*` stamp gaps in list-people/list-nested) —
  the shipped reset (`text.css:235-240`) already covers margin/font/letter-spacing/color, and the leaking
  property is not identifiable from the ticket record alone (candidates: `text-transform`, `text-align`,
  `text-wrap`, `font-variant` sub-longhands outside the `font` shorthand); **needs-live-diagnosis**, routed
  to the post-ADR-0100 visual re-audit. (b) The catalog `Text` row cannot express **emphasis** (no
  bold/weight knob — `variant` is `h1…h5|caption|body`, `factories.ts:91-99`), so Kim's "a name can simply
  be bolded" seed note is currently *unwritable* from the catalog — a Lane B intake for the next catalog
  wave, deliberately not decided here.

## Alternatives considered

- **Keep ruling per-defect, no law.** Rejected: this session alone produced five instances of the same
  fork; without the chooser every future contract re-litigates opinionated-defaults vs catalog-props vs
  teach-the-wrap from scratch, and the fleet's answers drift.
- **An A2UI-side blanket stylesheet on the mount surfaces** (the host patches spacing/surface/width for all
  `ui-*` under `.canvas-surface` etc.). Rejected: repairs embedders, not the contract — every A2UI host
  would need the same private patch (ADR-0096 rejected the identical host-side alternative), and the
  catalog would keep describing components that render wrong.
- **Renderer-injected presentation** (the renderer wraps/decorates validated payloads with layout it
  invents). Rejected: the renderer's charter is faithful DOM from the validated node tree; inventing
  structure the model never composed breaks payload↔DOM traceability and the corpus/judge story.
- **Declare the model's prompt responsible (teach everything, Lane C only).** Rejected: ADR-0096's own
  record measured that schema availability ≠ reliable uptake, and teaching cannot reach mechanisms the
  grammar lacks; a deterministic defect deserves a deterministic fix.
