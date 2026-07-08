# ADR-0092 — "Segmented control" becomes a first-class NAMED PATTERN; the tag stays `ui-radio-group[variant=segmented]` (ADR-0086 stands)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07 *(authored — the design-only revisit of ADR-0086, Kim's intake)* · 2026-07-07 *(superseded — Kim ruled the T3 fork the same day: the tag IS the requirement; discarded unratified per §Consequences last bullet. The supersession is [ADR-0095](./0095-ui-segmented-control-standalone-component.md), authored from §Alternatives-1 exactly as this ADR instructs for this outcome)*
>
> | Field | Value |
> |---|---|
> | **Status** | superseded |
> | **Date** | 2026-07-07 |
> | **Proposed by** | planner (the design seat) — Kim's revisit intake: looking at the component-preview PROPS knobs (the `variant`/`size` segmented pickers, `component-preview.ts:643–647`), *"ui-segmented-control: should be its own component."* This ADR is the rigorous answer to that ask — it revisits a decision Kim himself ratified one day earlier (ADR-0086, "ratify & build", 2026-07-06) and therefore owes a real reason in whichever direction it lands, not deference in either. |
> | **Ratified by** | not ratified — overtaken by Kim's T3 ruling (2026-07-07): the tag itself IS the requirement. The fork this ADR reserved for him resolved against its recommendation, and per its own §Consequences (last bullet) it is discarded unratified; the supersession record — [ADR-0095](./0095-ui-segmented-control-standalone-component.md) — is built from §Alternatives-1, whose costed design + the trigger discipline are this record's surviving contribution. The clause-1 docs-positioning slice is moot (the promotion makes the name descriptor-derived) and must not be built. |
> | **Repairs** | On ratification+build (no source is touched in the ADR pass): `controls/radio/radio-group.md` — the descriptor **prose** leads with the dual identity (the doc title/summary names "segmented control"; a dedicated *Segmented control* section with specimens), so the site doc page, its toc, and text search surface the name; the frontmatter `attributes[]` block is already true (ADR-0086) and is NOT touched. · `.claude/docs/adr/0086-…md` — the reciprocal **`Extended by ADR-0092`** back-link in its *Supersedes / Superseded by* row (the ADR-0091 precedent: back-link applied on accept, the original's substance untouched). · this ADR's `README.md` index row. |
> | **Supersedes / Superseded by** | **Superseded by ADR-0095** ([`0095-ui-segmented-control-standalone-component.md`](./0095-ui-segmented-control-standalone-component.md)) — T3 fired: Kim ruled the tag is the requirement, so the recommendation below never took effect (the `Extends ADR-0086` link was never applied — 0086 is instead superseded by ADR-0095). As authored: **Extends ADR-0086** (its Decision — a presentation variant on `ui-radio-group`, not a new component — **stands**; this ADR adds the naming/discoverability layer that decision never addressed, and records the costed promotion design + the triggers that would reopen it as a supersession). Relates **ADR-0080** (the per-control exports + marginal-size surface a promotion would owe) · **ADR-0077/0079** (the gallery derives its members 1:1 from descriptor tags — `component-gallery.ts:44–60` — which is *why* a variant is invisible there) · **ADR-0074/0078** (the fleet's hard-cutover rename precedent the promotion branch would follow). |

## Context

One day after ratifying ADR-0086, Kim looked at its first consumer — the component-preview PROPS knobs,
where every small closed enum renders as `<ui-radio-group variant="segmented">`
(`component-preview.ts:643–647`) — and asked for `ui-segmented-control` as its own component. That is a
revisit of his own ratified decision, so the forcing question must be located precisely: **what is new
since ratification?**

Nothing behavioral. ADR-0086's core claim — *a segmented control IS a single-select radio-group; 100% of
the behavior is shared; only presentation differs* — re-verifies against the shipped code: single-select
exclusivity, roving focus (orientation-driven axis), the commit path, the group form value + validity,
and reset-coherence all live once in `radio-group.ts` (`#applySelection`/`#commit`:216–246,
`formReset()`:299–305), and the segmented delta really is one CSS section (`radio-group.css:55–224`) plus
two reflected props and a two-line state seam (`#writeIndexCount`, `radio-group.ts:202–205`). Its
Alternatives section already considered and rejected "a new `ui-segmented` component" for duplication/drift
reasons that remain true. The steelman holds.

What IS new is **naming evidence**. The fleet has no findable artifact named "segmented control": the
gallery derives its member list 1:1 from descriptor `tag:` scalars (`component-gallery.ts:44–60`), so a
variant can never appear there under its own name; the only doc home is a `variant` enum row inside
`radio-group.md`; the site nav/toc never says the words. Meanwhile the control's industry identity is a
*name* — iOS `UISegmentedControl`, M3 *segmented button*, Ant `Segmented` — and the strongest possible
proof of the gap is the intake itself: **the fleet's owner, looking at his own shipped surface, read it as
"a segmented control," not "a radio group,"** and reached for a tag that doesn't exist. A user (or the
a2ui live model) reaching for "segmented control" today finds nothing to grab.

So the constraint the current design can't satisfy is **discoverability of the pattern's name** — not the
behavior, not the architecture. The design question is whether the name must be a **tag** (promotion — a
supersession of ADR-0086 and a real migration) or a **pattern name** (positioning — an extension that
leaves the architecture alone). The honest costing of the tag path (§Alternatives 1) shows "a thin new tag
over the same machinery" is not thin in this fleet, and buys naming only.

## Decision

We will make **"Segmented control" a first-class named pattern whose single canonical spelling is
`ui-radio-group[variant=segmented]`** — ADR-0086's architecture stands unchanged — and we will **record the
costed promotion design + the explicit triggers that would reopen it**. Four clauses:

1. **The name becomes findable (the docs/positioning slice).** `radio-group.md`'s prose is repositioned to
   lead with the dual identity: the title/summary names the segmented control explicitly ("`ui-radio-group`
   — the radio group *and the fleet's segmented control*"), and a dedicated **Segmented control** section
   (specimens: horizontal row + vertical stack, the moving indicator, the orientation rule) gives the
   pattern a home a reader lands on by searching its name. The site doc page, toc, and search derive from
   this `.md` (the existing toc/nav trip-wires gate it) — no new site machinery. The frontmatter
   `attributes[]` contract is already correct and is not touched.
2. **One spelling, no alias.** No `ui-segmented-control` tag, no second a2ui wire type, no CSS/TS churn in
   this pass. The a2ui catalog's existing `RadioGroup.variant: default|segmented` (`catalog.json:233`)
   remains the wire vocabulary; teaching the live model the *name* is corpus/prompt content (an exemplar
   whose description says "segmented control" mapping to `RadioGroup variant=segmented`), not schema.
3. **The promotion design is recorded, not discarded.** §Alternatives 1 below is the costed, mechanism-level
   design for `ui-segmented-control`. If a reopen trigger fires, the supersession ADR starts from that
   design — re-verified against the then-current code, not rebuilt from scratch.
4. **Named reopen triggers** (any one suffices to author the supersession):
   - **(T1) semantics the radio model cannot host** — a consumer needs multi-select segments, icon-only /
     label-less segments, or a non-form context where the inherited form machinery (`formReset` snapping a
     view-switcher back to `defaultChecked` inside a resetting `<form>`, an exposed-but-meaningless
     `required`) demonstrably bites. Multi-select in particular is *not* a radio group — it forces a new
     component regardless, and promotion-now would not have saved that work.
   - **(T2) measured discoverability failure** — the a2ui live model (or a real consumer) demonstrably fails
     to find the segmented rendering through `RadioGroup.variant` after clause 1+2 land (an eval-able claim,
     not a vibe).
   - **(T3) Kim rules the tag itself is the requirement** — an API-surface taste ruling this ADR cannot
     pre-empt; it stays live at ratification (see the fork in Consequences).

## Consequences

- **The naming asymmetry persists by choice.** The control's common name and its tag differ; docs mitigate
  but do not dissolve that. An author skimming *tags only* still won't see "segmented" — they must hit the
  docs, the gallery specimen (radio-group's preview, whose own knobs demonstrate the variant), or search.
  This is the real cost of the pattern-name path, accepted deliberately against the migration's price.
- **Zero migration, zero duplicate machinery, stable wire vocabulary.** All ADR-0086 consumers
  (`component-preview.ts` knobs + both segmented browser suites + `catalog.json` + `radio-group` docs/tests
  + the `dimensions.css:76` doctrine comment) stand untouched; the a2ui protocol surface doesn't churn one
  day after shipping.
- **The recorded promotion design ages.** §Alternatives 1 cites today's `file:line` mechanics
  (`#writeIndexCount` privacy, `--ui-radio-group-*` names, tag-keyed selectors); a future reopen must
  re-verify them before building — the design is a head start, not a frozen spec.
- **A fleet precedent is set:** a presentation variant that owns an industry name gets a *named-pattern doc
  surface* (a variant is invisible to the descriptor-derived gallery by construction —
  `component-gallery.ts:44–60`), and the promotion question is answered with recorded triggers instead of
  either a silent "no" or a reflexive fork. Future variant-vs-component calls cite this.
- **The genuine fork stays Kim's.** This ADR argues the name-not-tag call from evidence, but if Kim's ask
  was the tag itself (T3), the correct record is a **supersession ADR built from §Alternatives 1**
  (~1.5–2 day multi-seat wave), and this ADR is discarded unratified. What this ADR forecloses either way
  is the *worst* outcome: two public spellings of one control (§Alternatives 3).

## Acceptance

- `adr_check.py` exit 0 on this file; `README.md` index row present; ADR-0086's file untouched in the
  proposal pass (`git diff --name-only` shows no `0086-*` change).
- On ratification+build (clause 1): `radio-group.md` prose names "segmented control" in its title/summary
  and carries a *Segmented control* section (grep-checkable: `grep -i "segmented control" radio-group.md`
  hits prose, not just the `variant` enum row); the existing descriptor/toc/nav trip-wires stay green
  (`npm run check && npm test`); ADR-0086 gains the `Extended by ADR-0092` back-link.
- On ratification (clause 2): a zero-diff assertion on source — the build touches `.md` prose (+ optional
  corpus exemplar content, clause 2) only; `radio-group.ts` / `radio-group.css` / `catalog.json` byte-stable.
- Standing (clause 4): the three triggers are the reopen contract — a supersession ADR that arrives without
  citing a fired trigger is out of order.

## Alternatives considered

- **1 — Promote to a standalone `ui-segmented-control` (the recorded reopen design; rejected for now, not
  forever).** The honest mechanism-level costing of "a thin new tag over the same machinery":
  - *Class:* `UISegmentedControlElement extends UIRadioGroupElement` is genuinely small (~30 lines: lock
    `variant` out of the props, default `orientation` to horizontal) — the behavior reuse composition is
    cheap at the class level; the repo's base/trait architecture (`controls/_base/`, `traits/roving-focus.ts`)
    does its job. Everything after that is not thin:
  - *CSS:* every segmented rule is tag-keyed (`radio-group.css:88–224` — `ui-radio-group[variant='segmented'] …`),
    so the block either re-keys via `:is(ui-radio-group[variant=…], ui-segmented-control)` or moves to a new
    `segmented-control.css`; the token chain is *named* `--ui-radio-group-*` (`radio-group.css:59–82`) and the
    state seam is written by a **private** method with those names baked (`#writeIndexCount`,
    `radio-group.ts:202–205`) — renaming to the naming-law-correct `--ui-segmented-control-*` means refactoring
    the parent class's seam, not just CSS.
  - *Children:* keeping `ui-radio` children preserves `#radios()`'s `instanceof` walk and `radio.css`'s
    focus ring but leaks "radio" into every consumer's markup (halving the naming win); minting
    `ui-segment extends UIRadioElement` reads right but cascades — `radio.css`'s `@scope (ui-radio)` rules
    (including the ADR-0009 focus ring) don't match a new tag, so `radio.css` re-keys too.
  - *Fleet surface (the real bill):* a descriptor `.md` + doc page, a gallery member (derived from the
    descriptor, `component-gallery.ts:44–60`), a per-control `exports` entry + leave-one-out marginal pin
    (ADR-0080), both-engine browser suites, the `attributes[]`↔props trip-wire (ADR-0081).
  - *a2ui wire:* a `SegmentedControl` catalog type + factory + derived-prompt inventory + conformance, and
    the `RadioGroup.variant` enum member's retirement (`catalog.json:233`, `factories`/`index` tests).
  - *Migration:* `component-preview.ts:643–647` knob builder, `radio-group-segmented.browser.test.ts` +
    `component-preview-radio-segmented.browser.test.ts` re-keys, `radio-group.md` repairs,
    `dimensions.css:76` comment. **Hard cutover** (retire the variant; zero-survivor grep — the
    ADR-0074/0078 precedent) over dual-support, which is the drift ADR-0086 warned about made permanent.
  - *Size:* ~1.5–2 days across component-builder + a2ui-builder + site seats — buying the tag name only;
    behavior is byte-identical by construction. Rejected **now** because the naming gap has a ~half-day
    docs-layer fix and no trigger (T1–T3) has fired; preserved as the reopen design.
- **2 — An in-place `## Amendment` on ADR-0086** — rejected: the log's own three-way test
  (`README.md:33–66`) scopes amendments to branches the original *foresaw* (0086 booked per-`[size]`
  follow-ups — not naming/discoverability). A new decision that leaves 0086 standing is an **extension**:
  a separate ADR with the two-way `Extends`/`Extended by` link. This ADR is that record.
- **3 — Tag alias without retirement (ship `ui-segmented-control` AND keep `variant=segmented`)** —
  rejected outright: two public spellings of one control is the sync/drift failure 0086's Alternatives
  named, made permanent, plus a doubled a2ui vocabulary for one rendering. Worse than either clean branch.
- **4 — Do nothing (the variant is fine as-is)** — rejected: the discoverability gap is evidenced by the
  intake itself — the fleet's owner read the shipped surface as a control the fleet doesn't name. A pattern
  a consumer can't find by name is a real defect even when the architecture under it is right.
