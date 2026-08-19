# ADR-0211 — Drill/DrillPanel catalog wire-mark shape: forward-only bindable `path`, no `value` mark (no readback accessor exists), panel identity via structural `key`/`parent`, drill-forward triggers not catalog-reachable this pass (GH #1353)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-19 |
> | **Proposed by** | build seat (shape-(iii) mint of GH [#1353](https://github.com/kimgranlund/agent-ui/issues/1353), under Kim's mint ruling recorded on that issue 2026-08-19: "Drill is agent-emittable — mint the catalog row. The wire-mark shape … is the build's design work — an ADR for the shape rides the mint per rubric a2ui-catalog.md D6"); lane completed in-host after the dispatched seat died to host sleep (the 2026-08-18 overnight-run mitigation) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-19, via the [`ratify ADR-0211` utterance](https://github.com/kimgranlund/agent-ui/issues/1353#issuecomment-5343985209) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification (this ADR ships in the SAME PR as the mint, so build repairs land together): none beyond the mint itself · on a FUTURE Layer-0 readback accessor (Alternatives B's re-entry condition): revisit clause 2 — widen the row with a real `value` mark and amend this ADR |
> | **Supersedes / Superseded by** | **Extends** [ADR-0195](./0195-ui-drill-drill-down-panel-container.md) (the control this row binds; its TEMPORARY `EXCLUSION_ALLOWLIST` seat drains in this mint, per its own drain clause) · **Relates** the Toggle mint's Fork T1 (PR #1363 / GH #1352 — the sibling no-value-mark precedent, DIFFERENT root cause: pre-commit event ordering there, no readback accessor here) · [ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md)/[ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) (the value-mark vocabulary this record deliberately does NOT use for `path`) · [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (Drill/DrillPanel dispositioned EXCLUDE from the feed sub-catalog in this mint — a container chrome shape, not a commit-gated ask) |

## Context

ADR-0195 shipped `ui-drill`/`ui-drill-panel` (the N-level drill-down panel container) ahead of any
catalog row, with a TEMPORARY exclusion whose own text invites exactly this decision. Kim ruled the
type agent-emittable (GH #1353, 2026-08-19). What the ruling left to the build — deliberately — is
the WIRE-MARK SHAPE: which props ride the catalog, which are bindable, and whether `path` earns a
two-way `value` mark.

## Decision

1. **`Drill` row**: one property, `path` (`string[]` — the full chain from the root panel's key to
   the active leaf), `bindable: true`, `mapsTo: "path"`, `children: "ChildList"`. Structural
   `elevation`/`brightness`/`viewTransitions` stay uncatalogued this pass (curated subset,
   descriptor-agreement cl.5 — a later widening is one PropDef each).
2. **NO `value` mark for `path` — forward-only (data→control).** Empirically verified (jsdom probe
   against the real `UIDrillElement`, 3/3 assertions, methodology = the Toggle mint's Fork T1):
   `drill.ts#commit(next, direction)` never writes the resolved position onto the `path` accessor in
   EITHER mode — uncontrolled updates only the private `#internalPath` signal (`el.path` stays
   `undefined` forever); controlled `path` never self-mutates by ADR-0195 cl.3's own
   prop-as-source-of-truth law — the proposed position rides ONLY `change.detail`. The renderer's
   generic two-way controller reads `el[slot.prop]` synchronously at the commit event, so a
   `{prop:'path',event:'change'}` mark would write `undefined` (uncontrolled) or the STALE pre-drill
   array (controlled) into the data model on every navigation. An agent drives navigation by writing
   the bound `/path` pointer via `updateDataModel` on its own turn.
3. **`DrillPanel` row**: `key` (structural identity, non-bindable), `parent` (back-chain, non-
   bindable), `heading` (display text, bindable), `children: "ChildList"`. Ships no descriptor of
   its own (the `SplitPane`/`TabPanel` compound-file precedent, folded into `drill.md`); plain
   `accessorFactory` — all three props are 1:1 reflecting accessors.
4. **Drill-FORWARD triggers are not catalog-reachable this pass (named scope cut).** The control's
   forward-navigation convention is a light-DOM authoring idiom (`data-role="drill-trigger"` +
   `data-drill-key` on any descendant, drill.md) — no catalog type exposes a `mapsTo` for those data
   attributes, and widening one (e.g. `Button`) is a separate wire-vocabulary decision this mint is
   not authorized to freelance. The control's own Back button remains the one interactive
   navigation affordance inside an emitted Drill.
5. **Feed disposition: EXCLUDE** (ADR-0097 total partition) — a container chrome shape, failing the
   commit-gated-ask contract the way `Switch` already does.

## Alternatives

- **A. Two-way `{prop:'path',event:'change'}` mark** — killed by the probe in clause 2: both modes
  deliver a wrong value at the only moment the controller reads. Not a style choice; a data-
  corruption class.
- **B. Add a Layer-0 readback accessor first (e.g. `resolvedPath`), then mint with a real mark** —
  the eventual right shape, deferred: a component-contract change is `component-build-agent`
  territory (the a2ui package never crosses that boundary), and the mint is useful without it.
  RE-ENTRY CONDITION: when `ui-drill` gains a public resolved-position accessor, revisit clause 2
  via amendment (Repairs cell).
- **C. Catalog a `DrillTrigger` type now** — rejected: it would mint wire vocabulary for a control
  idiom ADR-0195 deliberately kept as data attributes; needs its own intake if demand appears.
- **D. Keep the exclusion PERMANENT** — rejected by Kim's ruling itself.

## Consequences (falsifiable)

- `eval-a2ui-catalog` gates green for the Drill card (B2's forward reflection: setting the `path`
  knob re-renders the active panel; no C2 impurity since no readback exists).
- A payload binding `path` and later writing `['root','appearance']` to the pointer re-renders the
  leaf panel — assertable in the row's conformance block.
- The residue guard proves the ADR-0195 allowlist seed drained in this same commit.
- If clause 2's probe claim is ever falsified (a mode that DOES write back), this ADR is wrong and
  the mark decision reopens — the probe is committed in the row's test block as the standing guard.
