# Calibration log — repo-alignment 2026-07-12

Deviations, false premises, guesses, corrections — appended continuously (an empty log = a finding).

- **Premise check (Phase 0 start):** working tree clean ✓. Report-root convention did not exist;
  established `.claude/docs/reports/<campaign>-<date>/` (the repo keeps agent-scoped docs under
  `.claude/docs/` — a repo-root `reports/` would violate its own root discipline).
- **Template premise FALSE — CI workflows:** `.github/workflows` does not exist. The CI-liveness
  lens (Phase 4 wiring) is N/A for this repo; gates run via npm scripts + the vitest/tsc
  harness invoked locally and by seats.
- **Template premise FALSE — duplicate harness trees:** one entry file (CLAUDE.md, no AGENTS.md
  twin), one skills dir, one agents dir. The "duplicate tree reconciliation" phase reshapes to
  the DOC-CORPUS generation split instead (spec/ vs specs/, lld/ vs llds/ — both LIVE, see
  FINDINGS).
- **Guess:** `undefined/dist-shared-build-cache/` (empty, untracked, mtime 2026-07-10 14:02) is
  a bad-interpolation artifact — something invoked the site CSS build with an undefined root/
  scratch var. To verify against scripts before delete-classing.
- **Phase 0 checkpoint (2026-07-12):** all four rulings ratified as recommended. Note on the
  llds/ relocation: the Phase-0 table had flagged the 7 component LLDs "may class as reference
  (Phase 4)" — the ratified unification moves them into `lld/` NOW (one placement home) with
  their liveness class still a Phase-4 verdict; placement and liveness deliberately decoupled.
- **NEXT.md + the old tree's README:** the ratified dissolution needs a placement for the two
  charter files; plan = supersession-marked archive (the ticket spine carries the frontier since
  2026-07-10) — establishing `.claude/docs/archive/` as the archive convention (none existed;
  the corpus `archive` disposition sanctions this). To verify NEXT.md's items all shipped before
  marking (read-before-archive), else it stays live and relocates instead.
- **Phase 1 WP3 execution notes:** (a) my inbound-repair map missed the RELATIVE `../specs/llds/`
  form (rubrics + a2a-section PRD) — caught by the post-move dangling-link sweep, which is the
  real gate; lesson: sweep-verify beats replacement-list completeness. (b) The moved docs' link
  DISPLAY TEXT (backticked path literals) needed repair separately from targets. (c) The sweep
  caught FOUR pre-existing dangling refs unrelated to the move (ADR-0066 cited under a wrong
  filename twice; chart-family.lld's wrong-depth ../../ links; anatomy.md citing the long-renamed
  component-author skill) — repaired in the same package, recorded as incidental findings.
  (d) Executed decompositions' context strings keep old-path snapshots BY DESIGN (historical
  records, sanctioned) — the Phase-5 corpus-tier gate must scope to .md links, not .json strings.
  (e) prd/a2ui-expert-system.prd.md carried a pre-existing dangling `.claude/CLAUDE.md` link
  (never existed) — repointed to the repo-root entry file.
- **Phase 3 execution:** the survey's key reversal — the template expected "extract a hardcoded
  schema"; the reality was THREE deliberate dialects + a deliberate proposed-forever SPEC/LLD
  convention, so the standards skill CODIFIES observed practice rather than normalizing it. The
  new S1 gate bit on its FIRST run (tkt-0003 predates the `kind` field — backfilled) — the
  check-catches-your-own-mistakes property working as the playbook predicts. The adr-status-guard
  registration changes MY OWN workflow: agents can no longer flip proposed→accepted even at a
  prompt-confirmed ratification — Kim hand-flips in-tree (his existing pattern), agents do the
  surrounding housekeeping only. S4 makes the orphaned-guard class structurally impossible.
- **Phase 3 scope note:** the component-NAMING master plan (tags/tokens/events/parts — Kim's
  separate exploration) is NOT folded into this phase's doc-grammar skill; it needs its own
  exception-count inventory and lands as `references/naming.md` — queued in the Phase-6 follow-up
  work queue as a decisions+mechanical item.
