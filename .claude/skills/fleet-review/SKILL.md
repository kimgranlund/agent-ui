---
name: fleet-review
description: >-
  Run a LATERAL review of the ui-* fleet — all components by ONE pattern axis (construction,
  styling, attributes-as-API, traits) — catching cross-component drift, canon gaps, and missed
  trait reuse. Use for "review all components' X consistency", "sweep the fleet for pattern
  drift", "re-audit axis Y after a law change", or after any multi-component build wave. Produces
  a findings table + routed fixes/tickets/law-amendments, never a blanket patch. NOT for one
  component's definition-of-done (component-checker + rubrics/component.md own that, vertically);
  NOT for designing a new component (component-design).
user-invocable: true
disable-model-invocation: false
---

# Lateral fleet review — the by-axis sweep

Vertical review (one component vs the law, at its DoD) cannot see BETWEEN components. This workflow
slices the other way: one context holds every component's treatment of ONE concern, so drift becomes
visible. Worked precedent: TKT-0046 (styling axis, manual — findings table, 1 mechanical fix, 3 routed
clusters). Motivating incident: TKT-0062 (four cross-component defects among five same-day,
individually-green components). Design record: TKT-0064.

## The five phases

1. **Census (deterministic — never hand-list).** Derive the work-list from the descriptor corpus:
   `grep -h "^tier:\|^extends:" packages/agent-ui/{components,app,router}/src/controls/*/*.md`
   (GH #761 widened the glob: router's outlet/link are fleet controls too). `code/` is EXCLUDED
   by layout, recorded not silent: its descriptors sit per-pack (`src/{markdown,editor}/*.md`),
   not under a `controls/` dir — a code-family sweep names those two paths explicitly. Per-axis
   exclusions come from the tier — Display/Container/Layout skip interaction-state checks;
   non-`UIFormElement` skip form-participation checks. Record the census IN the run's findings (the
   fleet grows; a re-run must show what it covered).
2. **Canon pack (per axis — pre-arm the reviewer).** Each axis reviewer receives: the axis's LAW docs,
   the gold exemplar(s), and the **ratified-deviations ledger** (`references/axis-packs.md`, per
   axis). A reviewer who
   re-flags a ledgered deviation is producing noise; a reviewer without the canon invents their own
   standard and produces pairwise "A differs from B" findings that never say which side is right.
3. **Sweep (axis-sliced fan-out).** One reviewer context per axis, reading that axis's SLICE of every
   in-scope control (the slices are small — never whole files). Every finding gets `file:line` evidence
   (the TKT-0042/0046 bar) and ONE of the four routes:
   - **DRIFT** — an outlier vs explicit canon → fix the outlier.
   - **GAP** — canon is silent and builders diverged → a ruling or `proposed` ADR fork (the reviewer
     NEVER invents the rule; the gap itself is the finding).
   - **UNRECORDED-DEVIATION** — looks deliberate but no ADR/ticket/comment records it → a ratify-or-fix
     decision (TKT-0062's select `:focus-visible` was exactly this, ratified retroactively).
   - **MISSED-REUSE** — hand-rolled behavior a trait/base already owns (traits axis).
4. **Verify (adversarial, BEFORE routing).** Open every cited law clause and confirm it says what the
   finding claims (verify-cited-authorities). Every BEHAVIORAL claim gets a real-browser probe on the
   element that renders the visible result — never accepted from a structural read (the TKT-0062
   ink-repaint bug passed every structural review and every builder-written test; only an engine probe
   of the EDITOR's computed color caught it). Findings that fail verification are dropped, not softened.
   Any TEXT-level scan feeding a census or a finding count STRIPS COMMENTS first (newline-preserving) —
   a banner comment quoting `@scope`/`var(--token)` matches a naive regex; campaign 1's follow-up
   census read 44 files raw vs 9 comment-stripped (the `stripComments` shape in
   `controls/styling-gates.test.ts`).
5. **Consolidate → route.** Dedup across axes (one root cause can surface on two). Then TKT-0046's
   routing discipline verbatim: mechanical/low-risk fixes inline with dated Findings entries; clusters
   needing design judgment → scoped follow-up tickets; GAPs → law-doc amendments or `proposed` ADRs
   (never self-ratified). One campaign ticket anchors the run; the findings TABLE (control × checks ×
   verdict) is the deliverable shape. **Run every specified probe BEFORE bundling rulings to Kim** — a
   finding routed as "needs a ruling" can dissolve under a cheap mutation probe (TKT-0068 item 3:
   "stale correction, delete or re-document?" resolved by MEASUREMENT — disable the code, run the
   suites, write the missing pin for whatever case fails — and left the bundle; only genuine judgment
   forks should spend a ruling slot). A ruled GAP should also leave a standing gate behind where the
   rule is text-checkable (`styling-gates.test.ts` is the worked shape: fs-walk + comment-strip + a
   synthetic negative control).

**Repeat triggers:** after each control wave · after any law change (the change names the axis it
invalidates — TKT-0062 made the styling axis due for entry controls the day after TKT-0046 swept it) ·
axes run independently. The execution vehicle is per-run (parallel agent fan-out for multi-axis;
TKT-0046 proved single-context works for one axis) — the phases are vehicle-neutral.

## Output contract (per run)

```
Campaign: <ticket id> · axes: <list> · census: <N controls, M excluded per axis + why>
Per axis: findings table (control × checks × verdict) · route counts (DRIFT/GAP/UNRECORDED/MISSED-REUSE)
Verified: <behavioral probes run + results> · Dropped in verification: <count>
Routed: <inline fixes w/ Findings entries> · <tickets filed> · <law amendments / proposed ADRs>
Ledger updates: <deviations ratified this run — append them to that axis's ledger in
`references/axis-packs.md`>
```

A run is **done** when every surviving finding is routed and the ledger is updated; **NOT done** when a
behavioral claim shipped unverified, a ledgered deviation was re-flagged as a finding, or findings were
"fixed" in bulk without the per-control evidence trail.

## Axis packs

Each axis (construction · styling · attributes-as-API · traits) carries its own canon docs, gold
exemplars, checklist, and ratified-deviations ledger — a reviewer who re-flags a ledgered
deviation is producing noise, so Phase 2's canon pack ALWAYS includes it. Full text, unabridged:
`references/axis-packs.md`. Load only the axis a run's own dispatch scopes to (the axis packs are
per-reviewer-context canon, never all four at once).

## Cross-links

Vertical DoD rubric → `rubrics/component.md` (this workflow complements, never replaces it) · design-time
law → [[component-standards]] · prior art → [[component-patterns]] · the test bar
findings cite → [[component-testing]] · new-component intake → [[component-design]].
