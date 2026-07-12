# Phase 4 — Corpus liveness verdicts

> Repo-alignment Phase 4, CORPUS-LIVENESS lens. Verdicts only — no migrations, no edits to any
> other doc. Scope: `.claude/docs/{adr,prd,spec,lld,tickets,rubrics}` + `goals.md`/`plan.md`/
> `process.md` + `drafts/`. The proposed-forever SPEC/LLD convention (agent-ui-doc-standards §2)
> is NOT drift and is excluded throughout — only real drift is verdicted below.

## Method

- Sampled 20 accepted ADRs spread across the full 0007–0127 range (weighted toward ones whose
  subjects the CHANGELOG/ledger says were superseded or replaced) and confirmed each cited
  mechanism still exists in the tree: ADR-0022 moveBefore seam (`repeat.ts`), ADR-0032/0038
  `[scale]` row system (`dimensions.css`), ADR-0060 corpus judge seam (`corpus/judge.ts`),
  ADR-0009 focus-ring tokens, ADR-0046 container box-model (`ui-card`/`ui-modal`), ADR-0095
  standalone `ui-segmented-control`, ADR-0065 icon-adapter, ADR-0102 CSS-less-consumer law,
  ADR-0110 pixel-diff harness, ADR-0119 `@agent-ui/code`, ADR-0127 command-modal regex mode, and
  others — all confirmed live and matching their described mechanism. Zero subject-deletion drift
  found in the sample.
- Ran `site/lib/docs-grammar.test.ts` (the mechanical dangling-relative-link sweep) — green,
  100/100. Reference-integrity findings below are therefore all in the class the mechanical gate
  cannot see: bare-ID citations, and "does this active doc's traceability pointer still make
  sense," not broken markdown links.
- Grepped all 128 ADRs for residue phrases (`awaiting Kim`, `pending Kim`, `F# open`, `not yet
  ratified`) and manually triaged every hit against the ADR's own header Status/Ratified-by cells.
- Traced every "follow-up recorded" promise found in `done` tickets and self-flagged "not repaired
  here" ADR notes to see whether each resolved to a real home.

## Findings

### 1 — Two active SPECs-family docs still point readers at the ARCHIVED charter as live authority

`prd/a2ui-expert-system.prd.md` (lines 4, 129) and six sibling SPECs — `spec/a2ui-runtime.spec.md`
(L205), `spec/a2ui-streaming-pipeline.spec.md`, `spec/a2ui-expert-harness.spec.md`,
`spec/a2ui-catalog.spec.md`, `spec/a2ui-live-agent.spec.md`, `spec/a2ui-training-corpus.spec.md` —
all say "status and traceability are tracked in `README.md`" / "see `README.md` for the map +
traceability matrix," pointing at `../archive/a2ui-expert-system/README.md`. That README carries
the correct archival banner: **"SUPERSEDED 2026-07-12 (repo-alignment Phase 1)... kept as the
family's historical charter; the status table below reflects 2026-07-08."** Four days and
ADRs 0113–0127 have shipped since that snapshot froze. Seven live, present-tense-authority
documents are directing readers to a table that has not moved since and, by its own banner,
never will again.

- **Disposition: update-in-place** (7 files). Stale content: the "traceability tracked in
  `archive/.../README.md`" sentence in each of the 7 files above.
- **Referrer repair:** none inbound to fix — these are the referrers. Replace the pointer with
  each doc's own status line + the ADR log as the live traceability surface (the archive banner's
  own stated intent — "dissolved into the unified doc map"), or drop the sentence outright since
  no single replacement traceability matrix was ever authored to take the README's place.

### 2 — Five accepted ADRs carry a stale "pending Kim" Ratified-by placeholder

`adr/0088-a2ui-live-conversational-channel.md`, `0089-a2ui-live-clarify-and-catalog-boundary-negotiation.md`,
`0090-a2ui-gen-ui-mode-axis.md`, `0097-a2ui-feed-embedded-asks.md`, and
`0098-validator-enum-membership-enforcement.md` all read `**Status** | accepted` in their header
table, but the very next row still reads the unfilled authoring-time placeholder: `**Ratified by**
| — *(pending Kim; a hook enforces proposed→accepted is Kim's, never the author's)*`. That is an
internal contradiction within the same six-row table — the one field whose entire job is to
record who flipped Status to `accepted` was never actually filled in when it happened. Contrast
with `0107`/`0111`/`0112`/`0113`/`0118`/`0123`, which all show real ratifier/date prose in that
cell.

- **Disposition: update-in-place** (5 files). Stale content: the `Ratified by` cell in each.
- **Referrer repair:** none — no other doc cites these cells.

### 3 — `drafts/container-family-design.md` is an orphan whose entire subject has shipped

Parked 2026-06-28 with a header banner: "handed to planning-lead for the PRD → coverage-clean
decomp → ADRs (the gate before any build)." Zero inbound references from any active doc (checked
every `adr/`, `spec/`, `lld/`, `prd/`, `tickets/`, `goals.md`/`plan.md`/`process.md`). Its full
scope — `ui-row`, `ui-column`, `ui-card` (+ header/content/footer), `ui-tabs`, `ui-modal`, and the
nested-radius law — has since shipped: all five controls exist under
`packages/agent-ui/components/src/controls/`, and the nested-radius law is realized in
`card.ts`/`card.md` (and consumed by `menu`/`select`/`combo-box` CSS) under **ADR-0046**
(`container-box-model`, accepted, ratified by orchestration-lead), which the draft never mentions
and which never cites the draft back. The draft was never the design that shipped; it was
superseded in substance without a formal supersession record because it never graduated past
`drafts/`.

- **Disposition: archive.** The design decisions the draft actually got right are now redundantly
  and more authoritatively recorded in ADR-0046 + the shipped code; the parked "card-centric
  exploration" alternative (the JS nested-radius controller) it explicitly rejected has zero
  remaining value.
- **Referrer repair:** none — nothing points to it today, so nothing needs re-pointing.

### 4 — `component-reviewer` gate: named constantly, agent file absent — verify, don't assume

`.claude/agents/component-builder.md` (edited 2026-07-09) states twice that component work is
"scored by the `component-reviewer` agent" against `.claude/docs/rubrics/component.md`, and an
unbroken run of accepted ADRs through **0125** (2026-07-11) — 0057, 0067, 0078, 0079, 0081, 0111,
0115, 0117, 0121, 0122, 0125 — all gate on "independent `component-reviewer` GO before commit."
But no `.claude/agents/component-reviewer.md` exists in this repo; `git log` shows it was deleted
at `80a2d37` (2026-07-02, the docs/ → .claude/docs/ move) and never restored. The only
`component-reviewer` that resolves today is the global/plugin `ui:component-reviewer` agent, whose
own routing description names a *different* bundled rubric ("component-forge's Compose × Realize
... method") rather than this repo's `.claude/docs/rubrics/component.md` (the ui-button/G5-anchored
standard, mirrored by `element.md`/`kernel.md`/`template.md` — those three are fine: they're
explicitly gate-heavy/self-graded by design and were never meant to have a dedicated reviewer
agent, so they carry no equivalent risk).

Given real GOs keep landing through 0125, this is very likely working as intended — the global
agent probably still reads whatever rubric a repo hands it at dispatch time — but that cannot be
confirmed from documentation alone, since both rubrics independently converged on the same
COMPOSE/REALIZE vocabulary. This is a wiring-verification gap, not a content edit.

- **Disposition: none of the five typed buckets fit cleanly** — flagging for an
  orchestration-reviewer pass (confirm the global `ui:component-reviewer` agent is in fact scored
  against `.claude/docs/rubrics/component.md`, not a same-named generic substitute) rather than a
  doc rewrite.

### Clean — sampled and confirmed, no drift

- **Superseded-ADR pointers (all 3 in the repo):** `0037→0038`, `0086→0095`, `0092→0095` all
  resolve bidirectionally — `0095`'s Supersedes row names both, and both back-link to `0095`.
- **The 5 zero-inbound-reference "component-tier" LLDs** (`field-form-provider`,
  `indicator-element`, `listbox-roving`, `overlay-controller`, `range-element`) correctly carry no
  cross-doc citations by the house convention stated in their own headers ("the components layer
  has no SPEC family... `SPEC-R# N/A by design`") — verdict **reference-class**, not drift. Every
  described mechanism (`traits/roving-focus.ts`, `traits/overlay.ts`, `traits/value-drag.ts`,
  `controls/_base/*`) is live and matches.
- **`a2ui-catalog.spec.md` §5.2 / `a2ui-message-lifecycle.spec.md` boundary**: deliberately
  reconciled and still agrees — the lifecycle SPEC states outright that catalog/runtime SPECs are
  "cited, not edited, by this wave."
- **`plan.md` §12** ("Open decisions & risks"): banner confirms all items were dispositioned at G8
  (2026-07-05) as RESOLVED or DEFERRED-with-reason; still true, nothing reopened since.
- **Orphaned-promise trace, all resolved:** TKT-0016's "corpus-admission follow-up" → closed by
  TKT-0022 (verbatim language match). TKT-0018's "site-manifest gap, out of scope for this seat" →
  picked up in TKT-0020's build (site-manifest.json + sitemap.json + llms.txt entries all landed).
  TKT-0020's own self-flagged "the LLD's §4 table needs a follow-up correction pass" → already
  REV-corrected in `a2ui-message-lifecycle.lld.md` (2026-07-11, same day, verified against the
  live table). ADR-0113 cl.2's named "escape hatch (b), its own intake" → answered by ADR-0119
  (accepted, `@agent-ui/code` shipped). ADR-0112's self-flagged "flag, not repaired here:
  `geometry.md:101` still cites `--ui-ind`" → already fixed (`geometry.md:101` now reads "`--ui-ind`
  never shipped; ADR-0112 cl.8 Repairs"). Zero orphaned promises found among the sampled set — the
  follow-up-tracking discipline is working.
- **`docs-grammar.test.ts`** (the mechanical dangling-relative-link sweep over all active docs):
  green, 100/100.

## Summary table

| Disposition | Count | Items |
|---|---|---|
| current (sampled, confirmed clean) | 20 ADRs + 5 LLDs + 2 SPEC boundary pairs + plan.md §12 + 5 orphaned-promise threads | see "Clean" above |
| update-in-place | 12 files (2 groups) | 7 SPEC-family docs citing the archived charter (Finding 1); 5 ADRs with stale Ratified-by placeholder (Finding 2) |
| mark-superseded (with pointer) | 0 new (3 pre-existing, verified correct) | 0037, 0086, 0092 |
| archive | 1 | `drafts/container-family-design.md` (Finding 3) |
| merge | 0 | — |
| unclassified — verify wiring | 1 | `component-reviewer` agent-file absence vs. active gate reliance (Finding 4) |

**Top 5 findings**, in priority order:

1. Seven live A2UI-family docs (1 PRD + 6 SPECs) point their traceability authority at the
   archived `a2ui-expert-system/README.md`, which is 4+ days stale by its own admission and will
   never move again — the archive convention is being honored on the archived side but not
   unwound on the citing side.
2. Five accepted ADRs (0088/0089/0090/0097/0098) never got their `Ratified by` cell filled in
   despite `Status: accepted` — an internal self-contradiction in the ADR's own six-row table.
3. `drafts/container-family-design.md` is a dead orphan: zero inbound references, and its entire
   scope shipped through ADR-0046 + later waves without ever citing it back.
4. The `component-reviewer` agent file was deleted from `.claude/agents/` on 2026-07-02, yet
   ~11 accepted ADRs since (through 0125, 2026-07-11) keep gating on its GO, and the builder agent
   still names a specific repo rubric for it to grade against — almost certainly fine in practice,
   but unverifiable from docs alone and worth a direct wiring check.
5. Everything else sampled — 20 spread-out accepted ADRs, all 3 superseded-ADR pointer chains, the
   5 zero-SPEC-family component LLDs, the reconciled catalog/lifecycle SPEC boundary, plan.md §12,
   and 5 independent "follow-up promised" threads pulled from done tickets and self-flagged ADR
   notes — traced clean to a real, current home.
