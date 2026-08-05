# Intent record — agent-admin-library-kinds

Forged 2026-08-05 via `harness:make-skill` (dispatched harvest, human gate pre-passed with this
exact plan — no re-interview; the ADR-0132→0164→0170 lineage, third harvest after
agent-ui-integration-standards-adjacent waves).

## Slots

- **Trigger** (verbatim routes from the ruled plan): "add an entry kind" · "new library section
  in agent-admin" · "single-select kind" · "library pack" · "capability kind roster".
- **Behavior delta**: without this skill a fresh session designing a new agent-admin entry kind
  re-derives the architecture from three ADRs + ~2,000 lines of code — and predictably gets the
  single-select shape wrong (stores selection in per-entry `enabled` flags = the second-writer
  defect ADR-0170 cl.2 rejects; leans on `SettingsStore` same-value notification; misses the
  presets seed-completeness obligation and the additive-options-bag freeze).
- **Species + dials**: knowledge · `disable-model-invocation: false` · `user-invocable: false`.
- **Freedom**: high — declarative law catalog; the code cited is the exemplar, not a script.
- **Type**: encoded preference + ratified-decision capture (save-lessons harvest).
- **Fences**: NOT catalog-the-registry work (a2ui-multi-catalog) · NOT integrations
  (agent-ui-integration-standards).
- **Done-when**: lint clean · fresh-context audit triaged · behavior check beats baseline ·
  reciprocal fences landed · committed on `skill-library-kinds`.

## Deliverable gaps

None — no `references/` corpus needed; the four content areas fit one SKILL.md body, citing the
ADRs/LLD/code in-tree as the canonical substrate (reference, never restate).

## Gates

- **P0** PASS 2026-08-05 — primitive = skill: on-demand knowledge (not mechanically checkable →
  not a hook; not needed every turn → not entry-file/rule; no tool walls → not an agent).
- **P1** PASS 2026-08-05 — slots above; confirmation carried by the dispatching plan's passed
  human gate (explicit "do not re-interview").
- **P2** PASS-WITH-GAP 2026-08-05 — evals/evals.json (20 cases) + 4 behavioral assertions
  (below). Baseline probe OUTPUTS were never captured: both dispatched probe agents idled
  without returning inside the one-round budget (host-directed close). The gap + re-run recipe:
  evals/baseline/README.md.
- **P3** PASS 2026-08-05 — SKILL.md drafted; dials explicit; body ≪ 500 lines.
- **P4** PASS 2026-08-05 — language pass run (instantiation test per load-bearing line; 1 hard
  gate; numeric/file:line anchors; contracts head, example tail).
- **P5** PASS-WITH-GAP 2026-08-05 — skill_lint clean, exit 0, on all three touched skills ·
  skill-checker audit PASS (evals/audit-report.md), findings triaged below · behavior check:
  GAP — the live with/without comparison was not captured (evals/behavior-check.md records the
  state and the standing evidence) · fences reciprocated: no-trigger cases landed in
  a2ui-multi-catalog (x-libkinds-1/2) + agent-ui-integration-standards (x-libkinds-1)
  evals.json, and a reverse NOT-clause added to a2ui-multi-catalog's description (the
  auditor's R2b one-way-fence finding).

## Behavioral assertions (P2)

1. An answer about adding a kind names ALL FIVE join points: `ENTRY_KINDS`,
   `initialEntryValues()`, `CAPABILITY_KINDS`, the presets seed map, the library pack — and
   states the no-bespoke-code law (ADR-0132 cl.1).
2. An answer about single-select places selection truth OUTSIDE the entries store (a persisted
   key; switches derive) and rejects the radio-normalized store by name (second-writer defect).
3. An answer about extending `mountEntryList` keeps the signature frozen and adds capability via
   optional default-true `EntryListOptions` booleans (ADR-0164 cl.3 / ADR-0170 cl.8 precedent).
4. Answers cite file:line into the shipped code/ADRs, not paraphrase from memory.

## Audit triage (P5.2)

Report: evals/audit-report.md — verdict PASS, no blocking findings. Triage:

- **B1 (major, fixed)** — this record had pre-filled P2/P5 gate outcomes before their artifacts
  existed (plan-as-fact). Corrected: gate lines now state only what is on disk; this triage
  section rewritten from the real report.
- **R2b (major, fixed)** — one-way fence with a2ui-multi-catalog: reverse NOT-clause added to
  that sibling's description + reciprocal no-trigger evals in both siblings; all three skills
  re-linted clean.
- **R8b (minor, fixed)** — two drifted code anchors corrected (`A:771`→`A:767`, `A:659`→`A:661`);
  R5 note adopted — the body now assigns the path re-anchor debt to the ADR-0164 extraction PR.
- Dismissed by the auditor with evidence: `E:283-289` (the library-pack same-path law comment —
  the cited claim, not the function body).
