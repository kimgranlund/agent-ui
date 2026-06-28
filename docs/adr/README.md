# agent-ui — Architecture Decision Records (ADR log)

> The log of ratified design changes. An ADR is the **record produced when the discovered-reality up-loop repairs an owning document** (a PRD goal, SPEC requirement, or LLD component). The loop itself is owned by [`../../.claude/agents/README.md`](../../.claude/agents/README.md) and the spec family's change-propagation rule; this log owns the ADR *format, lifecycle, and index*. · 2026-06-26

## When an ADR is written

When `execution-lead` (or anyone) hits a constraint that the design can't satisfy, or a global pattern must change, the change is not patched at the symptom — the **owning** document is repaired and the decision is recorded here. One ADR per ratified change.

- **Trigger:** an escalation up the loop (typically from `execution-lead`).
- **Author:** `planning-lead` (ADRs are planning-owned, alongside PRD/SPEC/LLD).
- **Ratifier:** `orchestration-lead` (moves the ADR `proposed → accepted`).

## Numbering & files

- One file per ADR: `NNNN-short-kebab-title.md` (e.g. `0001-default-catalog-not-adapter.md`).
- `NNNN` is a zero-padded sequential integer, never reused. `0000-template.md` is the template — copy it.
- The decision's `Repairs:` field links the owning-doc IDs it changed (`PRD-G#` / `SPEC-R#` / `LLD-C#`), reference-by-ID — the ADR records *why*; the owning doc still holds the *fact*.

## Status lifecycle

`proposed` → `accepted` → (`superseded by ADR-NNNN` | `deprecated`)

- **proposed** — authored, not yet ratified.
- **accepted** — ratified by `orchestration-lead`; the repair propagates and dependents regenerate.
- **superseded / deprecated** — a later ADR replaced it (link forward), or the decision no longer applies. ADRs are append-only history; never edit an accepted decision's substance — write a new ADR that supersedes it. The one append-only exception is a **foreseen amendment** (see *[Amendment vs supersession](#amendment-vs-supersession)*): it *adds* a follow-through the decision already anticipated, without editing the original.

## Amendment vs supersession

A later decision can touch an earlier accepted ADR in two non-interchangeable ways. The test is whether the
original **Decision still stands**:

- **Foreseen amendment — amend in place.** The decision **stands**, and an extension it **already anticipated**
  lands. Record it as an append-only **`## Amendment`** section at the foot of the *same* ADR — never a new file.
  Example: **ADR-0008** booked, in its *Resolved on ratification* note, that "*only* if a ladder step collapses
  do we add token-layer dedicated `--c-{f}-hover/-active` roles (a separate `tok-states` slice + **an amendment
  to this ADR**)". When the wave-2 smoke confirmed the collapse, the follow-through was appended as
  `## Amendment — dedicated primary hover/active roles`, **not** opened as a new ADR. The decision did not change;
  its anticipated branch resolved.
- **Supersession — a new ADR.** The decision **changes** — a reversal, a different choice, or a no-longer-applicable
  call. Write a **new** ADR that supersedes it (`Status: superseded by ADR-NNNN`, link forward); the old ADR's
  Decision is left intact as history. This is the existing lifecycle arrow.

**The append-only rule holds for both.** A `## Amendment` **adds** the foreseen follow-through; it does **not**
edit the original Context / Decision / Consequences — so it does not breach *never edit an accepted decision's
substance*. If you find yourself wanting to *change* a sentence inside the accepted Decision, that is a
supersession, not an amendment: open a new ADR.

| | the original Decision … | record as |
|---|---|---|
| **Foreseen amendment** | stands; an anticipated extension lands | append-only `## Amendment` in the same ADR |
| **Supersession** | is reversed / replaced | a new ADR, `superseded by` link forward |
| **Extension** | stands; a *separate, new* decision builds on it | a new ADR, `Extends` ↔ `extended by` cross-reference |

**Cross-reference convention.** A new ADR that builds on an earlier one **without reversing it** records the
link in its *Supersedes / Superseded by* field as **`Extends ADR-NNNN`**, and the earlier ADR is marked
**`Extended by ADR-NNNN`** (a two-way link) — e.g. **ADR-0012** *extends* **ADR-0006** (leading-icon anatomy →
the position×role family standard; ADR-0006's host-as-grid mechanism stays in force). An extension differs from
both neighbours: unlike an in-place amendment it is a *separate* ADR (a genuinely new decision, not a foreseen
branch of the old one), and unlike a supersession it leaves the earlier decision **standing**.

## How to add one

1. Copy [`0000-template.md`](./0000-template.md) to `NNNN-<title>.md` with the next number.
2. Fill Context · Decision · Consequences · Alternatives; set `Repairs:` to the owning-doc IDs.
3. Leave `Status: proposed` until ratified; on ratify, set `accepted` + the ratifier/date.
4. Add a row to the index below.

## Index

| ADR | Title | Status | Repairs |
|---|---|---|---|
| [0001](./0001-start-a1-validation-spine-ahead-of-g7.md) | Start A1 with the control-free validation spine ahead of G7 | accepted | (none — sequencing) |
| [0002](./0002-validator-parity-reconciliation.md) | Validator parity: missing-root, finalize granularity, syntactic-only pointer | accepted | renderer LLD-C11/C13 · corpus LLD-C5/C6 |
| [0003](./0003-single-file-component-css-barrels-host-page.md) | Single-file component CSS + barrels + host-page packaging | accepted | plan §8 · goals §G5 · process §1 · authoring-components |
| [0004](./0004-component-descriptor-md-frontmatter.md) | Component descriptor: `{name}.md` frontmatter replaces `{name}.api.json` | accepted | plan §10 · process §1/§4 · goals §G5 · authoring-components |
| [0005](./0005-lazy-upgrade-property-wins.md) | Lazy-property upgrade precedence: property-wins | accepted | goals §G2 · plan §5 |
| [0006](./0006-button-anatomy-optional-icon-slot-density-acceptance.md) | Button anatomy: optional leading icon slot + law-true `[density]` acceptance | accepted | goals §G5 |
| [0007](./0007-universal-selector-ramp-tokens.md) | Universal-selector ramp tokens: derived dimensions on `*` for subtree scale/density | accepted | shared `dimensions.css` (s6) · delivers ADR-0006 subtree `[density]` |
| [0008](./0008-interaction-state-styling-standard.md) | Control interaction-state styling standard (per-variant hover/active via role ladders) | accepted | goals §G5 · references/tokens.md · NEW references/interaction-states.md · button.css |
| [0009](./0009-focus-ring-token-standard.md) | The shared focus-ring standard (`--c-focus-ring` + `:focus-visible` outline) | accepted *(amended by 0014: `:focus-within` text-entry variant)* | NEW shared tokens.css `--c-focus-ring` · shared dimensions.css `--ui-focus-ring-*` · button.css · goals §G5 |
| [0010](./0010-tabbable-trait-aria-disabled.md) | Interactive-control focus + disabled a11y standard (the `tabbable` trait + `internals.ariaDisabled`) | accepted | NEW traits/tabbable.ts · button.ts · button.md · authoring-components · goals §G5 |
| [0011](./0011-canonical-action-prop-shape.md) | Canonical inbound `action`-prop shape (`{ action, context?, wantResponse? }`) | accepted | a2ui-catalog SPEC §5.1/§5.2 · catalog/default/catalog.json · renderer `readActionSpec` (LLD-C13) |
| [0012](./0012-button-anatomy-trailing-adornment-slot.md) | Button anatomy: position slots × `data-role` roles (the family adornment standard) | accepted | goals §G5 · button.css (role-driven sizing, `caret=font`) · button.md · button-doc.ts · authoring-components · sizing authority `geometry-sizing-spec.md` · **extends ADR-0006** |
| [0013](./0013-uiformelement-face-form-base.md) | UIFormElement, the FACE form base (form-associated participation over UIElement) | proposed | plan §5 · goals §G4 · NEW dom/form.ts · references/interaction-states.md · **extended by ADR-0014** |
| [0014](./0014-text-field-contenteditable-surface.md) | ui-text-field: the contenteditable editable surface + form-control interaction deviations | proposed | goals §G6 · NEW controls/text-field/* · NEW traits/track-user-invalid.ts · references/interaction-states.md · **extends ADR-0013/0006/0012** · **amends ADR-0009** |
| [0015](./0015-container-surface-space-token-model.md) | Container surface model (elevation × brightness) + `--ui-space` / `--ui-radius-base` tokens | proposed | goals §G9 · references/tokens.md · references/geometry.md · NEW shared dimensions.css/tokens.css |
| [0016](./0016-a2ui-faithful-flex-layout-container-queries.md) | A2UI-faithful flex layout (Row/Column/List/Grid) + container-query responsiveness | proposed | goals §G9 · a2ui-catalog SPEC §5.2 · references/geometry.md · NEW controls/{row,column,list,grid}/* |
| [0017](./0017-native-dialog-modal.md) | ui-modal on native `<dialog>` showModal() (top-layer, not a form widget) | proposed | goals §G9 · a2ui-catalog SPEC §5.2 · plan §2 · NEW controls/modal/* |
| [0018](./0018-css-one-level-nested-radius.md) | CSS one-level nested radius (`--ui-card-child-radius`), JS controller rejected | proposed | goals §G9 · references/geometry.md · NEW controls/card/* |
| [0019](./0019-pull-renderer-lld-c8-two-way-binding.md) | Pull renderer LLD-C8 (two-way input binding) into the G9 milestone | proposed | goals §G9 · a2ui-renderer LLD-C8 · a2ui-catalog SPEC-R4/R7 · NEW a2ui renderer/input.ts |
