# Synthesis — the 6-system dependency spine (2026-08-05)

Sources: inv-1..6 (this directory), roadmap.md §2-4, ADR-0163/0164/0168/0169/0170 (all accepted),
PR #453 (draft, awaiting Kim).

## The DAG (provider → consumer)

```
components ──┬──> a2ui ─────┬──> agent-admin ──> SaaS patterns (workbench, shipped)
             ├──> genui ────┤         ▲    ▲              ▲
             ├──> shells(app) ────────┘    │              │
             ├──> app/entry-list ──────────┴──────────────┘  (NEW: shared home, was agent-admin-local)
             └──────────────────────> SaaS patterns
   (router, code, icons, a2a, process/gates: sibling/cross-cutting, no new open edges this pass)
```

Consumer-most layer is still SaaS patterns (inv-5), now with a real, shipped exemplar
(the Data Workbench, `site/pages/workbench.ts`) instead of a greenfield gap. agent-admin is no
longer the sole owner of the entry-list primitive — MA-2's extraction (ADR-0164) flipped that
edge: agent-admin and the workbench are now co-equal CONSUMERS of `@agent-ui/app/entry-list`.

## What's now UNBLOCKED since 07-28

- **The components → SaaS "mismatch edge" from 07-28 is CLOSED.** `ui-table` was display-only by
  contract; ADR-0163 widened it in place (selection/sort/filter/pagination), `ui-pagination` was
  minted, and MA-3 proved the whole chain live in the workbench page (inv-4 §1, inv-5 §1). This
  was the single largest edge named in the 07-28 spine; it no longer exists as a gap.
- **`catalogId` went from dead weight to a proven, threaded seam.** 07-28 flagged "one catalog by
  construction, `catalogId` is dead weight" (inv-1 §3.4/6 then). ADR-0169/0170 shipped a second
  real catalog (`a2ui-basic`) end-to-end through agent-admin's Catalogs library section (inv-1 §1,
  inv-2 §1). This directly unblocks **GH #421** (per-persona catalog composition): both inv-1 §3.1
  and inv-2 §3.4 now describe it as "architecturally closer... the prerequisite it names is done,"
  where 07-28 could only gesture at it as a future idea.
- **The entry-list extraction (07-28's "named prerequisite for any reuse without copy-paste",
  inv-6 §4/§5 then) is done.** ADR-0164 moved the generic half to `@agent-ui/app/entry-list` with
  its own zero-agent-admin-coupling browser smoke; M-A's workbench is the proof second consumer
  (inv-1 §1, inv-5 §1). This closes a name on the 07-28 cross-cutting list.
- **The two flagship persona bugs (#314, #307) are both closed** (ADR-0161 shipped, round-budget
  policy ruled) — the "same product wound, two layers" cross-cutting finding from 07-28 (#4) no
  longer holds; M-B's DoD proved both live.
- **GenUI dogfood (ADR-0162) shipped and is live in agent-admin's real turn loop** — the
  components→genui edge that 07-28 gated "solely on Kim's ratification" is now built, tested, and
  closed (inv-3 §1, inv-1 §1).
- **The ratification backlog named in 07-28's cross-cutting #1 is drained.** ADR-0160/0161/0162
  are all `accepted`; the wave added three more (ADR-0163/0164/0168) plus ADR-0169/0170, all
  `accepted` — no ratification-lag items surfaced this pass (inv-6 §1b).
- **The 5-uncataloged-controls drift named in 07-28's cross-cutting #2 is resolved in-tree**, per
  inv-2 §3 (`ui-command-modal`/`ui-toast`/`ui-status-stream`/`ui-theme-provider` are PERMANENT
  allowlist exclusions with cited ADRs; `ui-textarea` is a catalog row) — though inv-2 flags that
  roadmap.md §3 still lists this as open, a doc-drift worth a small repair independent of any
  milestone.
- **The corpus-is-1-file gap (07-28 cross-cutting #3) partially closed**: 24 exemplars now exist
  for the `agent-ui` catalog dialect (inv-2 §1) — but the NEW second catalog immediately reopened
  the same shape of gap one layer over: `a2ui-basic` has zero exemplars (inv-2 §1/§3.2), an
  explicit accepted-degrade, not an oversight.

## What's STILL BLOCKED, and by what

- **GH #438 (MCP client integration)** — blocked by ADR-0168's own Non-goals clause: "changes the
  shell's dependency posture, not prejudged here." Explicit trigger condition (a real external
  integration need, e.g. the hotel/PMS work) has not fired (inv-1 §2, inv-2 §3.5, inv-6 §2d). Not
  actionable without a fresh design intake even if the trigger fires.
- **Production (non-DEV) `agentTurn` path** — unchanged from 07-28 (inv-1 §3 candidate 4): every
  live capability, including the now-real tool-manifest dispatch, is still DEV-only via
  `dev-proxy-plugin.ts`. ADR-0152's Worker exists for the produce route but agent-admin's own
  docs-site mount still gates all live calls behind `import.meta.env.DEV`. Blocked on nobody
  scoping it as its own arc — no ADR, no ticket.
- **GenUI B3 (judged pack-idiom eval)** — blocked on its own named, unmeasured trigger ("when the
  producer's output quality needs a measured floor," roadmap §4) with no instrumented signal
  attached (inv-3 §2/§7). Structurally cannot be scheduled until someone asserts the trigger has
  fired, which is a judgment call, not a metric.
- **The association/multi-select field** — blocked by its own ratified fence (PRD §4/§9, SPEC-N3
  of the workbench contract): "a new primitive earns its own ADR, not a rider on a demo." Now cited
  FOUR times across two inventory waves (inv-5 §3.1/§6) with still no GitHub Issue filed as its own
  re-entry intake — the fence names the unblock path (file the intake) but nobody has walked it.
- **A CSS-less-consumer-safe facet picker** — blocked on the same association/multi-select fence;
  PRD-D3's own residual (inv-5 §3.2) names it as needing "its own intake and its own ADR" if it
  becomes a real ask.
- **A router-integrated multi-view SaaS shape** — blocked on a deliberate, not-yet-crossed layering
  line: `app` never imports `router` (ADR-0115, SPEC-N9). Both this wave's inv-5 and the 07-28
  shells inventory name the same edge; crossing it is a design decision, not a bug (inv-5 §3.9/§5).
- **The ADR-0169 exclusion table's six live rows (E1-E6)** — each blocked on a distinct missing
  fleet mechanism: no media control (`Video`/`AudioPlayer`, E1/E2), no reference-typed-prop mount
  seam (`Tabs`, E3), no named-slot children grammar + trigger-entry mechanism (`Modal`, E4), the
  `{svgPath}` object arm (`Icon.name`, E5), no multi-select control (`ChoicePicker`, E6 — the same
  primitive gap as the association/multi-select fence above). Each is its own scoped intake per the
  ADR's own text (inv-2 §3.3).
- **GH #453's SPEC-R1–R7 (a2ui-ecosystem alignment)** — blocked on Kim's ratification read of the
  draft PR; nothing in it is built by design (SPEC-N1), and its own §5 explicitly defers filing
  real GitHub Issues until each row is picked up (inv-2 §2, inv-6 §1e/§3).
- **`@agent-ui/app`'s size budget (GH #468)** — blocked on a lazy-split of agent-admin's rarely-hit
  arms, following the dogfood-lazy precedent that already exists for exactly one feature; not yet
  applied to the Tools/Catalogs/Context panes (inv-1 §2/§3.2).
- **The dashboard-page composition** (the one 07-28 inv-6 candidate M-A explicitly did NOT build,
  carried forward unchanged) — blocked on nothing architectural; every primitive it needs already
  ships (`ui-stat`, `ui-bar-chart`/`ui-sparkline`, `ui-table`, the agent-summary seam). This is a
  composition-tier gap, not a component gap (inv-5 §3.7/§4).

## Cross-cutting findings (surfaced independently by ≥2 inventories)

1. **Per-persona catalog composition (GH #421) is now the most-corroborated live candidate.**
   Named as the standing candidate by inv-1 (§3.1, "the one visible feature-shaped opportunity
   actually sitting on agent-admin's own backlog"), inv-2 (§3.4, "architecturally closer... the
   prerequisite it names is done"), AND inv-3 (§4.2, cited as GenUI's own pattern-source precedent,
   though Kim triaged it 2026-08-05 as "PARKED IDEA... no ruled intake"). Three inventories, one
   idea, one explicit "not yet" from Kim on record.
2. **The association/multi-select gap is the most-corroborated STILL-MISSING primitive**, now cited
   four times across two full inventory waves (inv-5 §3.1/§6, and the 07-28 inv-6 twice) with zero
   tracked re-entry intake filed. The risk named in inv-5 §6 — "a fifth wave re-deriving the same
   finding from scratch" — is a real, compounding cost of not filing it.
3. **Both a2ui catalogs now share the same corpus-thinness pattern one layer apart.** `agent-ui`
   went from 1 file (07-28) to 24 records (now); `a2ui-basic` is at zero, an explicit accepted
   degrade of the same shape 07-28 flagged for the whole layer (inv-2 §1/§3.2/§3.6).
4. **Size-diet discipline is now a standing, repeating pattern, not a one-off.** GH #455 (table)
   and the `@agent-ui/app` re-base (#454/#468) both ran the identical playbook — ship a widening,
   measure real bytes, open a same-day non-blocking diet issue, close it with a real shrink — named
   independently by inv-1 §3.2/§4, inv-4 §3.9/§4, and inv-5 §1/§6 as a process worth codifying
   before the third recurrence (it has already happened at least twice on `split`/`swiper` too).
5. **The roadmap's own issue-number prose goes stale within hours, proven again this wave.**
   roadmap.md §2's 2026-08-05 line still named #457/#455/#454 as open; inv-5 §6 and inv-6 §1a both
   independently verified all three CLOSED via live `gh issue view` at inventory time — not a doc
   defect (the doc's own §1 law says never track issues by number here) but a trap for any reader
   trusting the roadmap's issue list without re-checking `gh`.
6. **The `app` ↛ `router` layering line is now named by three independent sources across two
   waves** (07-28 inv-5-shells, this wave's inv-5 §3.9/§5, and inv-6's absence of any signal
   otherwise) as the first-crossing question a real multi-page SaaS shape would force — still
   untested, still deliberate, not a bug.
