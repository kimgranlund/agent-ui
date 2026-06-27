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
- **superseded / deprecated** — a later ADR replaced it (link forward), or the decision no longer applies. ADRs are append-only history; never edit an accepted decision's substance — write a new ADR that supersedes it.

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
| [0008](./0008-interaction-state-styling-standard.md) | Control interaction-state styling standard (per-variant hover/active via role ladders) | proposed | goals §G5 · references/tokens.md · NEW references/interaction-states.md · button.css |
| [0009](./0009-focus-ring-token-standard.md) | The shared focus-ring standard (`--c-focus-ring` + `:focus-visible` outline) | proposed | NEW shared tokens.css `--c-focus-ring` · shared dimensions.css `--ui-focus-ring-*` · button.css · goals §G5 |
| [0010](./0010-tabbable-trait-aria-disabled.md) | Interactive-control focus + disabled a11y standard (the `tabbable` trait + `internals.ariaDisabled`) | proposed | NEW traits/tabbable.ts · button.ts · button.md · authoring-components · goals §G5 |
| [0011](./0011-canonical-action-prop-shape.md) | Canonical inbound `action`-prop shape (`{ action, context?, wantResponse? }`) | proposed | a2ui-catalog SPEC §5.1/§5.2 · catalog/default/catalog.json · renderer `readActionSpec` (LLD-C13) |
| [0012](./0012-button-anatomy-trailing-adornment-slot.md) | Button anatomy: position slots × `data-role` roles (the family adornment standard) | accepted | goals §G5 · button.css (role-driven sizing, `caret=font`) · button.md · button-doc.ts · authoring-components · sizing authority `geometry-sizing-spec.md` · **extends ADR-0006** |
