# Synthesis — candidate milestones (2026-08-05)

Three genuinely different strategic bets, each grounded only in gaps the six 2026-08-05
inventories actually found (every scope line cites its inventory + finding). This wave mints NO
milestone — Kim rules the order, same as 2026-07-28. In-flight designed work absorbed: none —
unlike 07-28, no proposed ADR is currently sitting mid-design; all of ADR-0161/0162/0163/0164/0168/
0169/0170 are already `accepted` and built. These three candidates start from a clean ADR
ratification slate (PR #453's SPEC and GenUI's own PRD/SPEC remain `proposed`, per inv-6 §1e and
inv-3 §4.9 — that's a separate housekeeping note, not a fork blocking any of M-D/M-E/M-F).

---

## M-D · "Personas that speak differently" — per-persona A2UI catalog composition

**Outcome:** two personas in the same agent-admin roster compose visibly different UI idioms from
one turn on — the Maître d' renders hospitality-shaped surfaces, the Croupier renders game-shaped
surfaces — from a catalog model of `shared primitives + shared system + local patterns` instead of
today's one-flat-catalog-per-persona pick.

**Scope sketch (per-system increments)**

- **agent-admin**: design-intake GH #421 itself before building — the issue names three open
  architectural questions (where a local pattern layer lives; its relationship to the two-catalog
  `catalogId` model; whether "system patterns" is an existing layer or needs carving out) — inv-1
  §3.1 names this "the one visible feature-shaped opportunity actually sitting on agent-admin's own
  backlog today." inv-1 §4 confirms the prerequisite (ADR-0169/0170's `catalogId` threading) is
  fully shipped, so agent-admin would be the feature's first and defining consumer.
- **a2ui**: extend the catalog registration seam so a persona can layer a local pattern fragment
  on top of a shared base catalog — inv-2 §3.4 confirms "now that catalog selection is a proven,
  threaded seam end-to-end, this is architecturally closer... the prerequisite it names is done."
  inv-2 §1 names the two catalogs (`default`, `a2ui-basic`) as the base layer this composes
  over.
- **GenUI** (precedent only, no GenUI build): inv-3 §4.2/§6 names GenUI's own per-agent
  pattern-source packs (PRD-G2/SPEC-R11) as the explicit design template GH #421 cites — "the
  A2UI-side analogue of GenUI's per-agent pattern sources." A design intake for M-D should read
  that mechanism before inventing a new one.

**Seam contract to freeze first**

1. Where a persona's "local pattern" layer lives — a catalog fragment shipped with the preset, an
   admin-authored entry kind (GenUI-pattern-source-style), or a package-level per-persona catalog
   module. GH #421's own body leaves this open (inv-1 §2); the design intake is the freeze.

**DoD shape:** two named personas (one hospitality-shaped, one game-shaped) produce visibly
distinct component idioms from the same live turn loop, provable in one dogfood session the same
way M-B's Hotel Concierge / quiz runs were proven; the design intake's three open questions (inv-1
§3.1) are each answered in the intake doc before any code lands.

**Rough size:** medium — one design intake (comparable to M-A's table-fork-or-mint decision sheet)
plus a catalog-registration extension and an agent-admin consumption slice; smaller than M-A
(no new component, no new page) but bigger than a single-ADR repair.

**What this does NOT include**

- Building a third first-party catalog beyond `default`/`a2ui-basic` (out of scope; this composes
  patterns ON TOP of the existing two, per inv-2 §3.4).
- GH #438's MCP client work — unrelated deferred item, explicitly fenced by ADR-0168's own
  Non-goals (inv-1 §2, inv-6 §2d).
- Draining the ADR-0169 exclusion table (E1–E6: Tabs/Modal/media/multi-select) — a separate,
  independently scoped set of intakes per inv-2 §3.3, not a prerequisite for M-D.
- Kim's 2026-08-05 triage comment on #421 already calls this a "PARKED IDEA... no ruled intake"
  (inv-3 §4.2) — this candidate does not override that ruling, it names the intake that would
  formally re-open it.

---

## M-E · "Ecosystem alignment, closed" — ratify + drain the a2ui interop survey

**Outcome:** the draft a2ui-ecosystem-alignment SPEC (PR #453) is ratified, its verified drift is
fixed, and its cheapest, evidence-backed requirements are filed as real GitHub Issues and closed —
so the fleet's wire types stop silently diverging from the upstream spec it claims to track.

**Scope sketch (per-system increments)**

- **process**: ratify PR #453 itself — inv-6 §3 candidate #1 names this "zero-cost (Kim's read
  only), unblocks filing SPEC-R1–R7 as real GitHub Issues per its own §5 routing table." inv-6 §1e
  confirms the SPEC is `proposed`, one file, 263 additions, blocking nothing on `main`.
- **a2ui**: fix the one CONFIRMED repo-local drift — `protocol.ts:120`'s `surfaceProperties?:
  object`, a field the upstream v1.0 RC removed entirely ("Decoupled Branding") — inv-2 §2/§3.1 and
  inv-6 §1e/§2e both independently cite this as the survey's headline verified finding (SPEC-R6b).
- **a2ui**: add the render-depth guard (SPEC-R2) — inv-6 §3 candidate #5 names this "a real
  fault-isolation gap (stack-overflow risk on pathological payloads)" with "a clear route" already
  named in `a2ui-runtime.spec.md`'s existing SPEC-N4 family.
- **a2ui**: seed the `a2ui-basic` corpus shard — inv-2 §3.2 names this the "named follow-up
  recorded at ADR-0169 ratification," a small shard mirroring the `agent-ui` shard's shape, closing
  the "zero exemplars for Basic turns" gap this wave's spine also names as a cross-cutting finding.
- **a2ui**: file design intakes for the two most architecturally-concrete rows of the ADR-0169 §12
  exclusion table — Tabs (E3, "needs a reference-typed-prop mount seam") and Modal (E4, "needs
  named-slot children grammar + a trigger-entry mechanism") — inv-2 §3.3 names these as the two
  rows that "name concrete architectural blockers a design intake could take on," distinct from
  the media-control and multi-select rows (E1/E2/E6) that depend on primitives this milestone does
  not build. These are ADR-0169's own exclusion rows, not #453's SPEC-R routing table.

**Seam contracts to freeze first**

1. SPEC-R6(b)'s ruling: keep `surfaceProperties` as a tolerated Postel extension, or drop it —
   inv-6 §1e names this as the open ruling the SPEC itself defers.
2. The filing pass for the repo-routable rows of SPEC-R1–R7 (SPEC-R2, R4, R6 — the `size:small`
   rows #453's own §5 table routes to a same-wave issue) must happen in the SAME wave the SPEC
   ratifies — inv-6 §2e/§5 names the risk of requirements that "never even became issues" if the
   filing pass is skipped or delayed. SPEC-R1 and SPEC-R7 are explicitly excluded from this
   contract (see "What this does NOT include," below) and SPEC-R3/R5 are deferred by #453's own
   text.

**DoD shape:** PR #453 ratified `accepted`; `protocol.ts:120` either drops `surfaceProperties` or
carries a recorded Postel-tolerance rationale; a render-depth guard test exists and is gate-green;
an `a2ui-basic` corpus shard exists with the same shape as the `agent-ui` shard; SPEC-R2/R4/R6 are
each filed as real GitHub Issues per #453's §5 routing table; Tabs and Modal each have their own
filed, scoped design-intake issue per ADR-0169 §12's exclusion table (not necessarily built).

**Rough size:** small-to-medium — one ratification, one drift fix, one new gate, one corpus shard,
two filed (not necessarily built) design intakes. No new component, no new page, no cross-package
layering change.

**What this does NOT include**

- SPEC-R1 (AG-UI transport-binding priority) — inv-6 §4 names this as depending on first
  un-parking `a2ui-streaming-pipeline.spec.md`, a separate parked spec; building it here "would
  create an orphaned amendment."
- SPEC-R3 (deceptive-composition eval lane) and SPEC-R5 (conformance-suite packaging) — inv-6 §3
  candidate #6 explicitly says these `size:big` items "should wait until the smaller SPEC-R2/R4/R6
  rows prove the filing pattern works cleanly."
- SPEC-R7 (the `a2ui-protocol-facts` pack re-sync) — inv-6 §4 names this a user-scope `/make-pack`
  action, "NOT a repo file," outside this repo's own milestone tracking.
- Building the E1/E2/E6 exclusion rows (Video/AudioPlayer/multi-select `ChoicePicker`) — these
  depend on fleet primitives (a media control, a multi-select control) this milestone does not mint
  (inv-2 §3.3).
- #438 (MCP client) and SPEC-R8 (MCP Apps) — inv-6 §3 candidate #7 names both as correctly parked
  until a real external trigger; "re-litigating either without a trigger would violate ADR-0168's
  own Non-goals ruling."

---

## M-F · "The workbench proves out" — SaaS dashboard composition + the association-field intake

**Outcome:** a second SaaS composition (a dashboard page: stat cards + chart + table + agent
summary) ships from already-published primitives, proving the fleet's data-app posture generalizes
beyond one page shape — and the fleet's most-cited missing primitive (multi-select/association
fields) finally gets a tracked, re-discoverable intake instead of living only in ratified-doc prose.

**Scope sketch (per-system increments)**

- **SaaS patterns / site**: build the dashboard-page composition — inv-5 §3.7/§4 candidate #3 names
  this as "the 2026-07-28 inv-6 candidate-slice #2 that M-A did not build. All the primitives it
  needs already ship (`ui-stat`, `ui-bar-chart`/`ui-sparkline`, `ui-table`, the A2UI agent-summary
  seam M-A just proved) — this would be a composition-tier effort in the same shape as MA-3, not a
  new component build."
- **components / process**: FILE (not build) the association/multi-select re-entry intake as a
  real GitHub Issue — inv-5 §3.1/§4/§6 names this "the single most-cited recurring gap... four
  independent citations across two inventory waves," with "no separate GitHub Issue or PRD filed
  for it as its own re-entry intake as of this sweep." Filing "does not commit to building it; it
  converts a fence-with-a-named-trigger into a tracked, re-discoverable item."
- **components**: close the zero-result `aria-live` gap on the existing workbench toolbar — inv-5
  §3.3/§4 candidate #2 names this "small, additive, doesn't touch the ratified fence line, and the
  workbench is now the first real surface where the silence is user-visible."
- **a2ui / SaaS patterns** (stretch, only if the association intake above is fast-tracked): scope,
  but do not build, a CSS-less-consumer-safe facet picker — inv-5 §3.2/§4.6 names this as sharing
  the same association/multi-select fence and needing "its own intake and its own ADR" per PRD-D3's
  own text; named here only as a named future extension of the same filed intake, not separate
  scope.

**Seam contracts to freeze first**

1. Whether the dashboard page reuses `ui-workspace-shell`'s content-region convention MA-3 already
   proved for the table+toolbar shape, or needs its own layout — a small composition decision, not
   an ADR (inv-5 §4.3 confirms no new primitive needed).
2. The association/multi-select intake's own scope boundary — PRD §4's own text (inv-5 §3.1)
   already rules "a new primitive earns its own ADR, not a rider on a demo," so M-F's filed
   issue must explicitly NOT pre-commit to a design (that's the intake's own first future step, not
   this milestone's).

**DoD shape:** the dashboard page ships at `site/pages/` composed entirely from published fleet
primitives (no new component), proven by the same probe discipline MA-3 used (zero-network,
seeded-fixture, AC19-joined sheet); the workbench's zero-result state announces via `aria-live`;
the association/multi-select gap has a real, filed GitHub Issue citing all four prior sightings
(this wave's inv-5 plus 07-28's inv-6 §1d/§2d) so a fifth wave never re-derives it from scratch.

**Rough size:** medium — comparable to M-A's P3 phase alone (one composition-tier page, no new
component contract to freeze) plus two small, cheap closes (aria-live, one filed intake). Smaller
than M-A as a whole because the hard primitive work (`ui-table` widening, entry-list extraction)
that M-A already paid for is reused here, not repeated.

**What this does NOT include**

- Building the multi-select/association primitive itself — explicitly fenced by the workbench's
  own ratified PRD/SPEC (inv-5 §3.1: "that earns its own intake and its own ADR; it does not ride
  this wave") — M-F files the intake, it does not build to it.
- Building the CSS-less-consumer-safe facet picker — named only as a future extension of the same
  filed intake (inv-5 §3.2/§4.6), not this milestone's own deliverable.
- Line/area/pie/donut/combo chart types — inv-4 §3.2 confirms the chart family is still
  `bar-chart` + `sparkline` only; the dashboard composes with what already ships, it does not widen
  the chart roster.
- A bulk-action bar on the workbench's existing selection — inv-5 §3.4 names this explicitly fenced
  ("a destructive-affordance design problem... a product decision, not a demo rider"), unrelated to
  the new dashboard page.
- A router-integrated multi-view shell — inv-5 §3.9/§4.4 names this the first `app`→`router`
  layering crossing, a separate and larger design question this milestone does not take on.

---

## Cross-milestone notes

- All three candidates are independent (different files, no shared seam contract) and can run in
  any order or in parallel, unlike 07-28's M-A (which had two prerequisite design forks feeding it).
- M-E is smaller than M-F ("small-to-medium" vs. "medium"); M-D is also rated "medium" — the three
  are not a strict size ladder, but M-F is the only bet that ships a new user-visible page.
- M-D is the only bet with an unresolved human ruling already on record: Kim's 2026-08-05 triage
  comment on GH #421 calls it a "PARKED IDEA... no ruled intake" (inv-3 §4.2) — choosing M-D would
  be Kim reopening that ruling, not this wave overriding it.
- M-E is the only bet with zero design-intake risk — every scope line is either a ratification, a
  confirmed drift fix, a small filed issue, or a small build (the render-depth guard, the
  `a2ui-basic` corpus shard) with an already-named implementation route; it carries no open
  architectural fork, unlike M-D. It is the safest bet to run alongside either of the other two.
- None of the three touches GenUI's own B3 judged eval (still gated behind its unmeasured "quality
  floor" trigger, spine finding) or the production non-DEV `agentTurn` path (still nobody's named
  arc) — both remain standing candidates for a future wave, not folded into any of M-D/M-E/M-F.
