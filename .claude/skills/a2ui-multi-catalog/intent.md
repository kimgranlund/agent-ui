# Intent record — a2ui-multi-catalog

Forged 2026-08-04 via `/make-skill`, from the confirmed `save-lessons` harvest of ratified
ADR-0169 (`.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md`, status: accepted,
ratified by kimgranlund 2026-08-04). The human gate passed before dispatch — the interview
slots below are filled from the ratified decision, not re-asked.

## Phase 0 — Route

Primitive = **skill**. Not a hook (nothing mechanically pass/fail — it's routing + patterns);
not an entry-file fact (needed only when someone touches catalog interop, not every turn);
not an agent (no tool walls needed — the build seat `a2ui-builder` already exists; this is
the knowledge it consults). Knowledge needed on demand → skill.

**Gate P0: PASS** (2026-08-04).

## Phase 1 — Interview slots (from the ratified ADR + harvest brief)

- **Trigger** (verbatim phrasings): "add another catalog", "register a second catalog",
  "upstream A2UI interop", "a2ui-basic", "register a catalog", "catalog schema ground truth",
  "widen the wire tolerance for an upstream shape", "per-catalog function implementations",
  "thread catalogId to the producer/proxy/worker".
- **Behavior delta**: without this skill, a "add a third catalog" ask gets improvised —
  the model rebuilds registration from renderer source, trusts prose guides over machine
  schemas, forks the renderer for foreign wire shapes instead of using the closed widening
  seams (readProp/marshal, the Postel arm at `readActionSpec`), and misses the catalogId
  threading (the exact live mis-stamp ADR-0169 cl.4 found at `produce.ts:81`). With it, the
  four ratified patterns route the work.
- **Species**: knowledge (pattern catalog citing the ADR — declarative, no procedure).
- **Dials**: `user-invocable: false` · `disable-model-invocation: false` (model-only router,
  the `agent-ui-catalog` sibling's posture).
- **Freedom**: high — prose patterns citing the ADR; the ADR is the contract, the skill routes.
- **Type**: encoded preference + routing (the ADR holds the detail; the skill carries the map).
- **Fences**: NOT payload composing (`a2ui-compose`); NOT the ui-* fleet map
  (`agent-ui-catalog`); NOT renderer/catalog build execution (`a2ui-builder` agent, which
  consults this).
- **Done-when**: a catalog-interop ask reaches the four patterns + the ADR clauses by
  citation instead of improvisation.

**Gate P1: PASS** (2026-08-04 — slots confirmed by the dispatch brief's pre-passed human gate).

## Phase 2 — Evals

- Trigger evals: `evals/evals.json` — 21 cases (12 should-trigger, 9 should-not near-misses).
- Behavioral assertions:
  1. An answer about adding a catalog names the multi-catalog registry
     (`Registry.register` / renderer-constructor pre-registration) and the partition
     coverage-gate discipline, citing ADR-0169 cl.1/cl.2/cl.14.
  2. An answer about upstream wire shapes names the pinned MACHINE schema as ground truth
     over any prose guide (ADR-0169 Context §Upstream authority).
  3. An answer about foreign commit/action shapes routes to the closed widening seams —
     ValueSlot `readProp`+`marshal` and `readActionSpec`'s third Postel arm — never a
     renderer fork (ADR-0169 cl.7/cl.10).
  4. An answer about catalog selection names the end-to-end `catalogId` threading
     (request body → selectCatalog → deps.catalog → authority stamp) and the per-catalog
     functions override (ADR-0169 cl.3/cl.4/cl.8).
- Baseline: `evals/baseline/prompt-1-register-catalog.md` — fresh agent context without the
  skill (2026-08-04). GAP, recorded honestly: the second baseline runner (the widening/schema
  prompt) went idle without delivering; its capture is absent, not skipped-as-pass. Capture
  note on baseline 1: the runner surfaced ADR-0169 clauses via code/spec cross-references
  despite the no-ADR instruction — the baseline therefore measures routing-without-the-skill,
  not ignorance of the ADR.

**Gate P2: PASS with one recorded gap** (2026-08-04 — evals + assertions + 1 of 2 baselines).

## Phase 3 — Draft

SKILL.md authored; both dials explicit; body well under 500 lines; no references/ split
needed (the ADR itself is the corpus — the skill cites, never restates).

**Gate P3: PASS** (2026-08-04).

## Phase 4 — Language pass

prompt-wording-rules audit applied: describer lines rewritten to instantiating register;
contracts/fences in the head; ≤3 hard gates; examples (the citation table) in the tail.

**Gate P4: PASS** (2026-08-04).

## Phase 5 — Validate

- Lint: `skill_lint.py` clean (exit 0), 2026-08-04.
- Fresh-context audit: `harness:skill-checker` report at `evals/audit-report.md` — findings
  triaged below.
- Behavior check: baseline-1's assertion check (in its transcript file) shows the
  without-skill gaps on assertions 1 and 4 (constructor pre-registration, cl.14 coverage
  gate, cl.3 fail-closed server selection all absent). GAP, recorded honestly: the two
  with-skill re-runs were dispatched but had not returned at record close — no
  `*-with-skill.md` transcripts exist; assertions 2 and 3 are demonstrated only by the
  audit's citation sweep (every cited clause resolves), not by a live re-run.
- Fence closure: siblings `a2ui-compose` / `agent-ui-catalog` carry no `evals/evals.json`
  (they pre-date the eval convention; verified 2026-08-04) — reciprocal no-trigger cases
  cannot land in suites that do not exist. Accepted-with-note: this skill's own evals carry
  the boundary cases in both directions; sibling suites inherit the reciprocal case when
  they are minted.

**Gate P5: PASS with the recorded evidence gaps above** (2026-08-04) — audit findings triaged:
- MAJOR (E7 mischaracterization, SKILL.md pattern 3): FIXED — `{functionCall}` now recorded
  as the one render-time-only exclusion (validates, click no-ops, gate = GH #429), per the
  ADR's E7 row (0169:477) + Consequences (0169:552-555), which retract cl.10's earlier
  "loud at conformance" sentence.
- MAJOR (intent.md claimed baseline evidence that did not exist): FIXED by honesty — Phases
  2/5 now record exactly the evidence on disk (1 of 2 baselines; no with-skill transcripts).
- MINOR (FACTORY_MISSING mis-attribution): FIXED — exclusion enforcement attributed to the
  CATALOG allowlist at validate (0169:471, E1); FACTORY_MISSING kept for declared-without-
  factory (0169:45-49).
- NIT (skill_lint errors on a bare directory path): tooling note, no action.
- Audit citation sweep: all 22 `0169:N` ranges independently verified to resolve to the
  claimed content; the 3 anchors added by the fixes (0169:471, 0169:477, 0169:552-555)
  re-verified by the author against the ADR after editing.

## Phase 6 — Ship

Deliverables on disk: SKILL.md · intent.md · evals/evals.json ·
evals/baseline/prompt-1-register-catalog.md (baseline 2 absent — recorded gap) ·
evals/audit-report.md. Committed on branch `skill-a2ui-multi-catalog`.
