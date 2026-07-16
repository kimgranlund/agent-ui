---
doc-type: ticket
id: tkt-0065
status: done
date: 2026-07-15
owner:
kind: feature
size: big
---
# TKT-0065 — lateral fleet review, campaign 1: all four axes

## Summary
The first run of the `agent-ui-lateral-review` workflow ([TKT-0064](tkt-0064-lateral-fleet-review-workflow.md)),
Kim-dispatched at full scope: all four axes (construction · styling · attributes-as-API · traits) over the
whole fleet. Census: **69 components** (24 pattern · 14 display · 13 layout · 8 container · 6 indicator ·
3 control · 1 range), machine-derived from descriptor frontmatter. The attributes-axis pre-pass (the
cross-control attribute matrix) was built this run per the workflow's build-on-first-use rule: **39
attributes shared by 2+ controls, 11 carrying mechanical type/reflect/enum-vocab divergence flags**
entering the sweep as candidate findings.

Run context: the working tree carries substantial uncommitted work (TKT-0056/0058/0062/0063 + a
concurrent session's edits); reviewers are instructed to review the WORKING-TREE state as the truth.

## Acceptance
- Per the workflow's output contract: a per-axis findings table (control × checks × verdict), every
  finding routed DRIFT / GAP / UNRECORDED-DEVIATION / MISSED-REUSE with `file:line` evidence.
- Phase 3 verification done by the host before routing: every canon citation opened; every behavioral
  claim probed in a real engine or explicitly marked unverified-and-dropped.
- Phase 4 routing per TKT-0046's discipline: mechanical fixes inline with dated Findings entries;
  judgment clusters → scoped tickets; GAPs → law amendments or `proposed` ADRs.
- The skill's per-axis ratified-deviations ledgers updated with anything ratified this run.

## Links
- `.claude/skills/agent-ui-lateral-review/SKILL.md` — the workflow (axis packs = the reviewers' canon).
- [TKT-0064](tkt-0064-lateral-fleet-review-workflow.md) — the design record.
- [TKT-0046](tkt-0046-fleet-interaction-state-styling-consistency-audit.md) — the styling axis's prior
  (pre-TKT-0062-law) sweep; this run supersedes its entry-control verdicts.

## Findings

### 2026-07-15 — all four axes swept in parallel, verified, routed — CLOSED

**Campaign:** TKT-0065 · axes: construction · styling · attributes-as-API · traits · census: 69
components (per-axis exclusions recorded in each axis report, archived in the session scratchpad).
Four parallel reviewer agents, each pre-armed with the skill's canon pack; every report returned the
full coverage table, not just defects.

**Route counts (post-verification):** DRIFT 20 (6 low) · GAP 7 · UNRECORDED-DEVIATION 4 · MISSED-REUSE
0 · PASS the rest of the swept surface. Dropped in verification: 0 — every structural claim
grep-confirmed; the one behavioral claim needing an engine (styling F13) was probed, CONFIRMED, and is
the campaign's headline catch.

**The headline (styling F13, fixed + pinned):** an EMPTY `ui-combo-box`'s placeholder never repainted
on hover/focus — the TKT-0062 mechanic-[b] bug shape ONE consumer over, which TKT-0062's own review had
explicitly cleared for the typed text but never checked for the placeholder. Confirmed frozen in a real
Chromium+WebKit probe. The fix took TWO passes, and the second is a genuinely new CSS lesson now in the
law doc's orbit: repointing `--ui-combo-box-ink` on the EDITOR was still not enough, because the
placeholder alias (`--ui-combo-box-placeholder: var(--ui-combo-box-ink)`) was declared on the HOST —
a custom property resolves at computed-value time ON THE ELEMENT THAT DECLARES IT, so the host-level
alias locked in the host's ink and inherited down as a resolved value. The alias had to be re-declared
AT THE EDITOR (where the state rules live) to re-resolve against the repointed ink. text-field never
hit this only because its state rules live on the host itself. A permanent regression test (reading the
::before — the element that renders the visible placeholder) now pins it; it FAILED against the first,
incomplete fix, which is exactly the Phase-3 discipline earning its keep.

**Mechanical fixes applied inline (all gated green):**
- `combo-box.css` — the F13 token-repoint + editor-level alias re-declaration (+ the regression test in
  `combo-box.browser.test.ts`).
- `agent-admin.css:21` — the error ink read `--md-sys-color-error-on-surface`, a family that has NEVER
  existed (0 hits in tokens.css; the fleet family is `danger`) — the var() fallback always won and
  validation errors rendered in plain neutral ink. Repointed to `--md-sys-color-danger-on-surface-variant`.
- `nav-rail.css` — the group chevron transitioned with NO `prefers-reduced-motion` zero anywhere in the
  file (§4c non-negotiable). Zero added.
- `select.css` — `--ui-select-placeholder-ink` declared twice, consumed nowhere. Deleted.
- 6 descriptor files (radio/radio-group/segment/segmented-control/slider-multi/switch) — 19 quoted YAML
  scalar defaults (`'false'`/`'on'`/`'0'`/…) unquoted to typed scalars, matching the gold; the count
  matched the attributes agent's finding exactly.
- `traits/index.ts` — the barrel exported 10 of 12 traits (pressActivation/areaDrag missing) and still
  carried a "Wave 0 PREP stubs" label on four long-shipped traits. Completed + label deleted.
- `roving-focus.ts` + `selection-commit.ts` headers TRUED to shipped reality (each claimed a consumer
  mode its own mechanics make impossible — active-descendant / menu·tabs hosts); `menu.ts` gained the
  ratify comment for its deliberate selectionCommit bypass; `color-picker.ts:382`'s node-lifetime
  listener gained its tier-(c) rationale comment. One root cause (trait headers written ahead of hosts,
  never trued) closed three findings.

**Routed to scoped tickets:** [TKT-0066](tkt-0066-styling-hygiene-cluster.md) (5 direct role reads +
literals + 2 dialect forks + THE dimensional-constants ruling) · [TKT-0067](tkt-0067-table-badge-parts-guards.md)
(the fleet's only two parts-rebuilt-every-connect outliers, ui-table/ui-badge, with the reconnect
probe) · [TKT-0068](tkt-0068-lateral-review-rulings-bundle.md) (four canon GAPs needing rulings:
slider-release discipline, part-disabled tabindex dialect, radio's stale correction, §1b vs
command-modal's search) · [TKT-0069](tkt-0069-attribute-api-rulings.md) (naming.md reserved-word scope
+ label-reflect + scheme-sentinel + duration-type rulings, routed to the TKT-0025 owner; also carries
the String(default) trip-wire gate hole).

**Ledger updates:** all four axis packs in `agent-ui-lateral-review/SKILL.md` extended with this run's
~15 ratified entries (construction seeded from empty; the next run inherits them). The attributes
pre-pass matrix script's improvement list (suppress the variant flag, set-compare enums, add an
`attribute:` column, keep quoted-scalar detection as a deliberate flag) is recorded in the axis report.

**Positive findings worth naming:** zero MISSED-REUSE fleet-wide (the trait-composition discipline
held); zero out-of-vocabulary events across all 69 descriptors; the composer's reconnect-hardening
pattern has propagated cleanly; the fleet documents its deviations unusually well (styling found ZERO
unrecorded deviations — every suspect carried a record).

**Gates at close:** `npm run check` green · full jsdom 340 files green (the two apparent failures in
the final background sweep were this campaign's own just-fixed ticket-grammar issue + a perf-bound
flake under parallel load — both confirmed green in isolation) · scoped browser gates for every touched
component green in Chromium + WebKit (combo-box 124, select/agent-admin/menu/color-picker 174) ·
docs-grammar 157/157 · theme-provider fixture regenerated.
