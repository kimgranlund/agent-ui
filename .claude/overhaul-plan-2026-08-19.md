# Overhaul plan — agent-ui `.claude/` estate — 2026-08-19

Owner: Kim · status: draft (awaiting Gate A) · review-cadence: per-wave
(Authored directly at the fallback path; `docs:make-doc` not invoked this run — deviation recorded in the run ledger.)

## Steps

### Phase 0 — Measurements

| Instrument | Available? | Finding summary |
|---|---|---|
| naming-audit | yes | 5 errors, 0 exemptions (3 = empty stub dirs; 'rendering' + 'due' unresolvable tokens) |
| bloat-audit | yes | 24/35 flagged: 12 long-body skills, 6/6 agents + 12 skills dense-description; 0 duplicate pairs |
| attention-audit | yes | rent 21,504 skill chars + 7,355 agent chars; 119 collision pairs, none fenced; 13 zero-evidence members |
| check-routing (harness) | not run | routing-report.json absent; stolen/leaked/dead unmeasured this run |
| plan-plugin-split surface_map | not run | dependency-closure evidence unavailable — blast-radius rows below are enumerated by hand, unverified by closure |
| doctrine-audit | absent | no doctrine.manifest.json |
| pattern-audit | absent | no charter pattern named |

### Phase 1 — Per-member kill-switch

Members with findings (all five questions answered; members not listed in the two tables below are covered by the last row):

| Member | Where it lives | Species | Blast radius | Merge/Split? | Knowledge tier | Verdict |
|---|---|---|---|---|---|---|
| a2ui-compose (stub) | nowhere — empty dir, .DS_Store only (2026-08-14 rename husk) | none | zero — no content, no consumers | NO — nothing to merge | n/a | MOVE (delete dir) |
| a2ui-corpus-curate (stub) | same | none | zero | NO | n/a | MOVE (delete dir) |
| docs-author (stub) | same | none | zero | NO | n/a | MOVE (delete dir) |
| a2ui-catalog-rendering-review | correct home (a2ui family) | skill | rename would touch memory notes, PR #1302 pipeline refs, catalog-eval wiring | NO — distinct job (catalog PAGE card review) | PROCEDURE — keep-inline (8,920 chars trips long-body, but body is the review pipeline itself) | NO MOVE on name — register 'rendering' in ObjectVocab instead (cheaper than rename, zero consumer breakage) |
| due-process | correct home | skill | name cited by CLAUDE.md + GH #969 | NO | PROCEDURE — keep-inline | NO MOVE — deliberate name (GH #969); grandfather via exemption entry (ADR-0011 D8 ratchet) |
| composition-patterns | contested — three siblings share the composition territory | skill | low: no agent preloads; 0 usage all three | **MERGE nomination**: {composition-patterns, layout-composition, ui-composition} → `harness:plan-skill-merge`. Evidence: collide 51.9/48.6 unfenced, composition-patterns thin (2,059 chars) + dense-description 1,064, usage 0/0/0 | KNOWLEDGE — verdict deferred to merge analysis | NOMINATED (Wave 0) |
| layout-composition | (same nomination) | skill | low | see above | KNOWLEDGE — deferred | NOMINATED (Wave 0) |
| ui-composition | (same nomination) | skill | low | see above | KNOWLEDGE — deferred | NOMINATED (Wave 0) |
| a2ui-review · component-build · seat-map | correct homes | skills, preload-dominant (0 typed uses, each preloaded by its agent) | description-only edit; agents unaffected | NO — jobs distinct | PROCEDURE — keep-inline | MOVE (Wave 2): **demote-to-wiring** — narrow descriptions to wiring stubs; cuts rent + kills their agent↔skill collision pairs (top pair score 292.4, headroom −292) |
| 6 agents (all) | correct homes | agents | description-only edits | NO | n/a | MOVE (Wave 2): description diet — all 6 trip dense-description (883–1,735 chars); agent chars bill in full |
| 12 long-body skills (site-authoring 13.7k, a2ui-payload-authoring 11.9k, a2ui-corpus-curation 11.7k, component-design 9.8k, package-release 8.8k, component-build 7.6k, component-patterns 7.5k, seat-map 6.5k, fleet-review 6.2k, repo-hygiene 6.2k, example-authoring 6.2k, a2ui-catalog-rendering-review 8.9k) | correct homes | skills | body-only edits | NO | mixed — per-member PROCEDURE-vs-KNOWLEDGE call at build time; KNOWLEDGE members → move-to-references (each trips long-body >6,000) | MOVE (Wave 2, batch): long-body diet sweep |
| all remaining members (~14) | correct homes | as-is | n/a | NO — no Phase-0 evidence against any | keep-inline (no flags) | NO MOVE |

### Phase 2 — Waved ticket seeds (not yet minted)

#### Wave 0 — merge/split nominations
- [ ] W0-1 MERGE: {composition-patterns, layout-composition, ui-composition} → seed for `harness:plan-skill-merge` (executed later via `/reshape-skill`) (Blocked-by: none) — status: todo — done-when: merge analysis returns a recorded verdict

#### Wave 1 — mechanically-clean moves
- [ ] W1-1 Delete the three empty stub dirs (`a2ui-compose`, `a2ui-corpus-curate`, `docs-author`) (Blocked-by: none) — status: todo — done-when: dirs gone, naming-audit −3 errors
- [ ] W1-2 Register `rendering` in ObjectVocab via `manifest-authoring` (Blocked-by: none) — status: todo — done-when: naming-audit −1 error, anti-ambiguity gate passed
- [ ] W1-3 Add `due-process` exemption entry via `manifest-authoring` (ratchet, shrink-only) (Blocked-by: none) — status: todo — done-when: naming-audit −1 error, +1 exemption

#### Wave 2 — species/semantic changes
- [ ] W2-1 Agent description diet — all 6 agents to ≤700 chars keeping NOT-fences (Blocked-by: none) — status: todo — done-when: bloat-audit agent flags 0, routing behavior spot-checked
- [ ] W2-2 Demote-to-wiring: a2ui-review, component-build, seat-map descriptions → wiring stubs (Blocked-by: none) — status: todo — done-when: rent drop recorded, agents still preload them
- [ ] W2-3 Long-body diet sweep over the 12 long-body skills — per-member keep-inline (PROCEDURE) vs move-to-references (KNOWLEDGE), citing each member's measured chars (Blocked-by: W0-1 for composition-patterns only) — status: todo — done-when: long-body flags reduced, no load-bearing instruction lost (bloat-audit CALIBRATION test per cut)

#### Wave 3 — contested
(none)

#### Grandfathered (ADR-0011 D8 ratchet)
- due-process — exemption retained; deliberate name ruled at GH #969; no wave renames it

### Phase 3 — Execution contract (per ticket, once approved)

claim → worktree → `git mv` (history preserved) → supersession note or `renames.json` entry → gates + critics → PR → human merge → verified close. Serial through shared ledgers (`naming.manifest.json`, `renames.json`).

## Validation

- [ ] `/check-routing` (estate mode) after description-touching waves
- [ ] `fix-old-names` sweep after any rename/delete wave
- [ ] naming-audit re-run: 5 → 0 errors (1 exemption)
- [ ] attention-audit trend row appended: rent baseline 21,504 + 7,355 → now

## Rollback

- Landed `git mv`/delete → `git revert` the merge commit (history preserved).
- Ledger entry (`naming.manifest.json`) → re-add verbatim from git history; exemptions shrink-only, but restoring a wrongly-retired entry is a correction.
- Supersession notes → append-only; reverse with a new dated note.
- `/reshape-skill` merge → revert the reshape PR's merge commit; re-open W0-1 if retrying differently.
- Minted-then-abandoned seed → claim release per ADR-0005; flip seed back to `todo`.

## The five respect invariants

1. Evidence can veto the plan.
2. History preserved, never replaced.
3. Consumers degrade gracefully.
4. The old design's intent is read before it is judged.
5. Nothing semantic rides hidden in a move.

## Next step

Generated only — nothing executed. Gate A (overhaul-execute) reviews the seed list; approved rows are minted through `file-task`/`file-feature`, never auto-created here.
