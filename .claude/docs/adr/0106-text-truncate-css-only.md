# ADR-0106 — `ui-text` gains a `truncate` prop: CSS-only single-line ellipsis on the host AND the stamp, an unconditional `title` mirror, and the Tooltip pairing idiom for rich reveal

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | system-planner — the design seat; ticket #32 (document-row-toolbar), the remaining intake after the `ui-button` nowrap fix (`442802d`); Kim's sketch: `<ui-text overflow-ellipsis>` + tooltip for the full text |
> | **Ratified by** | Kim (host) · 2026-07-08 — Status flipped by Kim's own edit, AFTER his CSS-only ruling ("truncate should be CSS-only solution. no resize-observer overkill") was folded in. The `truncate`-name RATIFICATION FLAG is RESOLVED: Kim's ruling itself used the name `truncate`, confirming it over his earlier `overflow-ellipsis` sketch. |
> | **Repairs** | on ratification+build: `controls/text/text.ts` (the `truncate` prop + the unconditional `title` mirror riding the existing render path — NO new observer) · `controls/text/text.css` (the `[truncate]` rules, host + stamp legs) · `controls/text/text.md` (prop row + the reveal/pairing guidance) · `catalog.json` `Text` row gains `truncate` (boolean) + `factories.ts` textFactory case · `prompt-drift.test.ts` + catalog `index.test.ts` rows · `a2ui-catalog.spec.md` §5.2 Text row. Decomp: [`css-less-consumer-family.decomp.json`](../decompositions/css-less-consumer-family.decomp.json) · **on accept: the reciprocal `Extended by ADR-0106` back-link on ADR-0078** (scheduled per convention) |
> | **Supersedes / Superseded by** | Applies **ADR-0102** (Lane B — overflow intent as a catalog-reachable prop; the safe default is today's wrapping behavior, so the prop is pure intent, never repair). Extends **ADR-0078** (the stamp model: the reset at `text.css:235-240` gains a truncation-aware sibling; the three-axis prop schema gains a fourth orthogonal axis) · relates ADR-0045 (tooltip dismissal platform, the pairing idiom's other half) · the `ui-button` label-wrapper anatomy (`button.css:99-103`) stays a NAMED DEFERRAL, not this record · **acceptance re-realized by ADR-0110** (the truncate pixel legs — the ellipsis gestalt gains a real pixel gate) |

## Context

The document-row-toolbar ticket ended with `ui-button` labels pinned to one line
(`button.css:99: white-space: nowrap`, committed `442802d`) — and left the fleet without an answer for the
other half of the pattern: **a title that must hold one line, show an ellipsis when constrained, and keep
its full text reachable.** Today `ui-text` always wraps; no catalog prop expresses "truncate", and the
CSS trio (`nowrap`/`overflow:hidden`/`text-overflow`) is a page-author verb the A2UI consumer does not
have (ADR-0102/0096). The button fix's own comment points here: "Ellipsis-on-constraint needs a label
wrapper (anonymous grid text can't carry text-overflow) — that anatomy follow-up is ticketed with the
ui-text overflow-ellipsis pattern."

Two facts shape the API:

- **`ui-text` needs no wrapper anatomy.** Unlike `ui-button` (whose label is anonymous grid text), the
  Display primitive's text lives in a real block box — the host itself, or the ADR-0078 **stamp** when
  `as ≠ none` (`text.ts:91-107`). `text-overflow` applies to the box that clips, so the rules must land on
  *both*: the host for the unstamped 80% case, the stamped element (`:scope > :is(h1…span)`) for the rest —
  the same two-legged shape as the existing stamp-transparency reset (`text.css:235-240`).
- **The full text is already accessible.** Ellipsis clipping is visual-only: AT reads the complete
  light-DOM text regardless. The reveal problem is for *sighted pointer users* — which the platform's
  native `title` tooltip serves at zero dependency cost, and rich cases can compose from the shipped
  catalog `Tooltip` (whose first child is its anchor, `factories.ts:316-319`).

## Decision

1. **A `truncate` boolean prop on `ui-text`** (`prop.boolean(false)`, reflected — the `[truncate]` attr is
   the CSS hook), the schema's fourth orthogonal axis: `variant` = role, `size` = row, `as` = semantics,
   `truncate` = overflow intent. Default `false` keeps today's wrapping — no shipped rendering changes.
2. **CSS, two legs mirroring the stamp reset:** `:scope[truncate]` → `white-space: nowrap; overflow:
   hidden; text-overflow: ellipsis;` and `:scope[truncate] > :is(h1, h2, h3, h4, h5, h6, p, blockquote,
   span)` → `overflow: hidden; text-overflow: ellipsis;` (`white-space` inherits into the stamp; the clip
   must sit on whichever box holds the text). Stamping/unstamping keeps zero geometry delta under
   truncation — the ADR-0078 cl.4 invariant extends to the clipped box.
3. **The unconditional `title` mirror (Kim's CSS-only ruling, 2026-07-08 — "no resize-observer
   overkill"):** while `truncate` is set, the element maintains `title` = its own trimmed `textContent`,
   UNCONDITIONALLY — a static mirror riding the EXISTING render/childList path (`text.ts:75`), written on
   content change and removed when `truncate` unsets. **No ResizeObserver, no clipped-state measurement**:
   the clipping is pure CSS (clause 2), and the reveal does not attempt to know whether the ellipsis is
   currently visible — a `title` on an unclipped truncate-text is the accepted, ruled cost (harmless
   native tooltip noise) in exchange for zero measurement machinery on the Display class. An author-set
   `title` attribute is never overwritten (presence-checked before the first write; the mirror owns only
   titles it minted).
4. **Rich reveal = the Tooltip pairing idiom, taught not minted:** `Tooltip > [Text truncate, Text …]` —
   the catalog already expresses it (first-child anchor). `text.md` carries the pairing guidance; one
   ADR-0091 mini-skill line rides the existing idiom module budget if the registry lands. `ui-text` never
   auto-creates a `ui-tooltip`.
5. **Catalog reachability:** the `Text` row gains `truncate` (boolean, non-bindable — presentation intent,
   not state); `textFactory` passes it through (its `default:` arm already `setAttr`s unknown props —
   verified boolean handling at build); the ADR-0071 derived inventory advertises it; ADR-0098 has nothing
   to gate (boolean, no enum).
6. **The `ui-button` ellipsis anatomy stays deferred, named:** a clipped *control* label needs the label
   wrapper `button.css:99-103` describes — a separate anatomy decision on a shipped control, to be taken
   with evidence it is needed (buttons that overflow their container are first a layout defect). This
   record decides the Display-class pattern only.

## Acceptance

- Cross-engine browser legs: a `truncate` `ui-text` in a 12rem box with long content shows a clipped
  single line (`clientWidth < scrollWidth` + computed `text-overflow: ellipsis` on the clipping box) and
  carries `title` = its full text (the unconditional mirror — present in wide boxes too, per the CSS-only
  ruling); toggling `as` between `none` and `h4` under truncation keeps the rendered box identical (the
  cl.4 invariant leg); an author-set `title` survives the mirror. Negative control: the stamp leg
  removed → the `as="h4"` truncation leg FAILS (proves the second leg is load-bearing).
- jsdom legs: prop/attr reflection, title mirrored on content change + removed on `truncate` unset,
  zero-residue disconnect (the EXISTING observer discipline only — a grep leg asserts `ResizeObserver`
  does not appear in `text.ts`).
- `prompt-drift.test.ts` green with the new Text row; a live-loop probe lists `truncate` under `Text`.
- The document-row-toolbar seed's title cell renders one line with ellipsis + hover reveal on an
  unmodified A2UI mount — screenshot-verified.
- `npm run check && npm test` + `test:browser` green.

## Consequences

- **The `title` mirror is unconditional** (Kim's CSS-only ruling): a truncate-text that happens to fit
  still carries a native `title` tooltip — accepted noise, in exchange for the Display class staying
  measurement-free (NO ResizeObserver ever installed; the rejected measured variant is recorded under
  Alternatives). Elements without `truncate` pay nothing.
- **Keyboard-only sighted users get no reveal from `title`** — a real gap, accepted: the full text is in
  the accessible name (AT unaffected), and the rich-reveal idiom (clause 4) is the sanctioned answer where
  the pattern matters; auto-minting overlay machinery into a text primitive costs more than it serves
  (§Alternatives).
- **`title` is a second, native tooltip visual** beside `ui-tooltip`'s styled one — two reveal styles can
  coexist in one UI. Accepted as the zero-dependency floor; the pairing guidance names when to step up.
- **Truncation hides content by design** — a model can now compose a surface whose text is partially
  invisible; the prompt inventory line should carry the "titles/labels, never body copy" hint (build-time
  wording, ADR-0071 lane).
- **Multi-line clamping is NOT this decision** — `truncate` is single-line. A future `line-clamp` need is
  an extension (a count prop riding `-webkit-line-clamp`), reserved, not designed here.
- **Out of scope, unchanged:** `ui-button`'s anatomy (clause 6), the stamp/heal mechanism, the Text
  catalog `variant` fan-out table, `ui-tooltip` itself.

## Alternatives considered

- **The measured auto-`title` reveal (this record's own first draft)** — maintain `title` only when
  actually clipped (`scrollWidth > clientWidth`), re-measured via a ResizeObserver. Rejected by Kim's
  ratification-round ruling (2026-07-08): "truncate should be CSS-only solution. no resize-observer
  overkill." The precision (`title` appears exactly when an ellipsis does) does not buy enough to put
  measurement machinery on the Display class; the unconditional mirror keeps the reveal at zero
  observers.

- **Kim's sketch name `overflow-ellipsis` as the prop.** Adopted in substance, renamed: the fleet's boolean
  props are single-word intents (`disabled`, `required`, `wrap`, `persistent`); `truncate` says the intent,
  not the mechanism, and leaves the mechanism free to grow (a future clamp extension would make
  `overflow-ellipsis` a lie). The sketch's semantics — ellipsis + tooltip for full text — are exactly
  clauses 2–4.
- **Auto-mint a `ui-tooltip` when clipped.** Rejected: the Display primitive would grow overlay lifecycle
  (anchor wiring, dismissal, placement — ADR-0045 machinery) for a reveal `title` already provides; it
  would double-reveal beside any author-composed Tooltip; and a self-wrapping element breaks the
  first-child-anchor composition model. The idiom stays composition (clause 4).
- **`title` always (unmeasured), skip the observer.** Rejected: a permanent tooltip on every truncatable
  text lies whenever the text fits (hover noise, AT double-speak risk on some stacks); measurement is the
  difference between an affordance and a nuisance.
- **An enum `overflow: 'wrap' | 'ellipsis'` instead of a boolean.** Rejected for now: no third value has a
  design (fade? clamp needs a count, not an enum member); a boolean converts cleanly later (the
  `mode`-enum precedent, ADR-0093) — mint vocabulary when the second value exists.
- **A generic fleet `truncate` on every control.** Rejected: controls own their own overflow contracts
  (`ui-button` chose nowrap-clip at the control level; inputs scroll). The Display primitive is where
  free text lives; per-control adoption stays per-control evidence.

## Erratum (2026-07-08)

The Alternatives bullet "**`title` always (unmeasured), skip the observer.** Rejected: …" is first-draft
residue and contradicts accepted clause 3. Kim's ratification-round ruling ("truncate should be CSS-only
solution. no resize-observer overkill") flipped exactly that alternative INTO the decision — the
unconditional mirror IS title-always-unmeasured, plus the ownership-by-value guard. The bullet's stated
costs (hover noise while the text fits, AT double-speak risk on some stacks) were re-weighed at
ratification and accepted as the CSS-only price; the Consequences section carries them honestly ("present
even when the text isn't actually clipped"). Read that bullet as the FIRST DRAFT's reasoning against its
own eventual decision, kept for the record — not as the accepted position. (Surfaced by the ADR-0109
intake, 2026-07-08.)
