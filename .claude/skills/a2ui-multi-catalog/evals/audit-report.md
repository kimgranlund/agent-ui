# Audit report — a2ui-multi-catalog (FLOOR)

Skill: `.claude/skills/a2ui-multi-catalog` · Standards: skill-writing-rules · Lint: clean
(`skill_lint.py` exit 0 on `SKILL.md`; note: the linter errors on a bare directory path — pass the file)
Verdict: **PASS** (no blocking findings; 2 major to fix before merge)

Audited 2026-08-04 by harness:skill-checker (fresh context). Depth: FLOOR, plus the
dispatch-specific citation sweep — every `0169:N` range in SKILL.md opened against
`.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md` as ratified.

## Criteria

| ID | Verdict | Severity | Evidence (file:line) | Fix |
|----|---------|----------|----------------------|-----|
| R1 | PASS | — | Deletion test on 3 load-bearing lines: constructor pre-registration vs the rejected page-bootstrap shape (SKILL.md:33-37); machine schema supersedes prose guide — the rev.1 defect the ADR itself closed (SKILL.md:47-53); the `produce.ts:81` authority-stamp pattern (SKILL.md:88-91). Each names a mistake the model demonstrably makes without it (intent.md:23-28 records the baseline failure modes). | — |
| R2 | PASS | — | Description phrasings ("add another catalog", "register a second catalog", "upstream A2UI interop", "a2ui-basic", "catalog schema ground truth", widening wire tolerances, per-catalog functions, catalogId threading — SKILL.md:4-9) cover all 12 trigger evals verbatim-adjacent; both fences (a2ui-compose, agent-ui-catalog — SKILL.md:9-10) repel n01-n04/n07. Suite is 12+9, boundary cases in both directions. | — |
| R3 | PASS | — | Knowledge species, `user-invocable: false` + `disable-model-invocation: false` (SKILL.md:11-12) — model-only router, matching the stated intent (intent.md:29-31) and the `agent-ui-catalog` sibling's posture. Name is a domain noun beside its siblings. | — |
| R4 | PASS | — | Load-bearing lines commit/presuppose ("The pinned upstream MACHINE schema … is the authority", SKILL.md:47-49; "A new catalog is a sibling package folder", SKILL.md:31). One labeled Good/Bad pair (SKILL.md:55-57). Hard gates ≤ 3 (the two NOT-fences + the routing boundary). | — |
| R5 | **FAIL** | **major** | SKILL.md:74-75 — "Arms the renderer cannot honestly serve are EXCLUDED loudly … e.g. `{functionCall}` (E7 at `0169:477`)". The ADR's own build-verified E7 row (0169:477) and Consequences (0169:552-555) say the OPPOSITE: `{functionCall}` **validates** and the exclusion lands at **render time only** — the Button renders, the click dispatches nothing; the loud validate-time gate is the GH #429 follow-up. The skill follows cl.10's earlier "loud at conformance" sentence (0169:416-417), which the E7 row's build verification retracted. A reader debugging "Basic button does nothing" gets sent the wrong way. | Reword: `{functionCall}` is the ONE exception to loud exclusion — excluded at render time (validates, click no-ops); the validate-time gate is GH #429 (E7 at 0169:477). |
| R5 | FAIL | minor | SKILL.md:42-43 — "the registry's FACTORY_MISSING gate enforces exclusion for free (`0169:45-49`)". Mis-attribution: FACTORY_MISSING guards a *declared* type without a factory (0169:47). Exclusion of an *undeclared* type is enforced by the CATALOG allowlist at validate (E1 row, 0169:471: "an emitted Video fails CATALOG at validate"). | Attribute exclusion enforcement to non-declaration → CATALOG validate failure; keep FACTORY_MISSING for declared-without-factory. |
| R6 | PASS | — | ~100-line body; routing boundary + fences in the head (SKILL.md:22-27); the Good/Bad example mid-body; citation key in the tail (SKILL.md:96-100). Zero references/ — the ADR is the corpus, cited not restated (tables stay in the ADR, as claimed). | — |
| R7 | N/A | — | Knowledge species — no procedure, no stopping predicate required. The citation key's drift clause (SKILL.md:99-100) serves as the staleness contract. | — |
| R8 | PASS | — | Numeric anchors throughout: 4 patterns, 59-value Icon enum, dated ratification (2026-08-04), every claim pinned to a `0169:N-M` range. | — |

## Dispatch-specific: citation sweep

All 22 `0169:N` ranges in SKILL.md were opened against the ratified ADR. **Every range
resolves to the claimed content**: 98-110 (Non-collision), 114-131/133-154/147-150 (cl.1/cl.2/
rejected shapes), 467-477 + 477-E7 (cl.12), 501-525 (cl.14), 45-49 (registry facts), 21-38/40-41
(schema authority / prose scope), 286-288 + 565-567 (rev.2 provenance / F1), 233-260 (cl.7),
71-79 (input.ts closing law), 397-417 + 412-417 (cl.10), 262-281 (cl.8), 211-216/218-231/
156-184/186-209 (cl.5/6/3/4), 479-499 (cl.13). No fabricated or drifted citation found — the
one defect (major R5 above) is a wrong *characterization* of correctly-cited lines, not a bad
pointer.

## Record integrity (outside the criteria table)

- **major** — intent.md:57-58, 80-82 claim baseline evidence that does not exist: `evals/baseline/`
  is an **empty directory** (verified 2026-08-04); there are no "2 representative prompts" and no
  `evals/baseline/*-with-skill.md`, yet Phase 2 and Phase 5 are recorded PASS on that evidence.
  Phase 6 (intent.md:94-95) also lists `evals/baseline/` among deliverables "on disk". Per the
  repo's own standing law, a gate recorded green on absent evidence is laundering. Fix: either run
  and commit the baseline transcripts, or amend intent.md to state the baseline was not captured.
- nit — `skill_lint.py` exits 1 ("missing file") when given the skill *directory*; the clean verdict
  above is from the `SKILL.md` path. Tooling note only.

## Top 3

1. Fix the E7 mischaracterization (SKILL.md:74-75) — "excluded loudly" → excluded at render time,
   validate passes, gate is GH #429. This is the only finding that ships wrong knowledge.
2. Make intent.md honest about the baseline: produce `evals/baseline/` contents or amend
   Phases 2/5/6 to record the gap.
3. Correct the FACTORY_MISSING attribution (SKILL.md:42-43) — exclusion is enforced by the CATALOG
   allowlist at validate, not by FACTORY_MISSING.
