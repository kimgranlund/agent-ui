# Intent record — agent-ui-integration-standards

Confirmed save-lessons harvest from ratified ADR-0168 (2026-08-04); the human gate passed with
this exact plan — interview slots filled from the ratified record, not re-asked.

## Slots

- **Trigger**: "adding an integration", "new tool for the agent", "integration keys/auth",
  "tool input validation", "why isn't my tool offered", "the model sent bad tool input".
- **Behavior delta**: without this skill, an integration author reuses one string for
  id/tool.name/label (the retired pre-0168 failure), hand-rolls per-executor validation,
  forwards keys or forks per-route dispatch, and puts the registry in the portable core.
  With it, all five ADR-0168 laws bind, each citable to its source line.
- **Species + dials**: knowledge · `disable-model-invocation: false` · `user-invocable: false`
  (sibling family style: agent-ui-component-standards, agent-ui-doc-standards).
- **Freedom**: high (declarative law catalog; the code anchor shows the one shipped pattern).
- **Type**: encoded repo law (ratified decisions), not capability uplift — brevity earned.
- **Fences**: NOT catalog work (agent-ui-catalog) · NOT A2UI payload composition (a2ui-compose).
- **Done-when**: skill on disk, lint clean, fresh-context audit triaged, citations re-derived
  file:line from the sources, evals present, gates green by exit code, committed on branch.

## Gates

- **P0 PASS 2026-08-04** — primitive = skill: on-demand domain law, not per-turn fact, not
  mechanically checkable as one hook, no tool walls needed.
- **P1 PASS 2026-08-04** — slots above; confirmation carried by the dispatch (confirmed harvest).
- **P2 PASS 2026-08-04** — evals/evals.json (20 cases) + assertions below + evals/baseline/.
- **P3 PASS 2026-08-04** — SKILL.md authored; both dials explicit; body ≪ 500 lines.
- **P4 PASS 2026-08-04** — language pass applied: laws stated declaratively as standing facts,
  numeric/named anchors (three facts, ONE checker, ONE dispatch), one labeled bad/good pair.
- **P5 PASS 2026-08-04** — skill_lint.py clean (exit 0) · skill-checker audit: findings triaged
  (see evals/audit-report.md; accepted-with-note items below) · behavior check: with-skill
  answers satisfy all 4 assertions vs baseline (evals/baseline/ shows the misses) · fences:
  reciprocal no-trigger cases not added to sibling suites — agent-ui-catalog and a2ui-compose
  carry no evals/evals.json in this repo (repo-local skills, no routing suites); recorded as
  the fence-closure disposition rather than silently skipped.

## Behavioral assertions (Phase 2)

1. An "add an integration" answer names `IntegrationManifest` + `registerIntegration()` and
   states id / tool.name / label as three separate facts.
2. A validation answer places `validateToolInput` BEFORE the executor and names the
   `is_error` tool_result degrade path (never a thrown turn).
3. A keys answer says `auth:'serverKey'` + `envKey` (a NAME), server-side resolution in BOTH
   hosts, and that an unprovisioned keyed integration is never offered.
4. Any wiring answer routes new code to `tools/agent/integrations/` (site-internal), never the
   portable `src/agent/` core, and reuses the ONE shared `buildToolDispatch`.

## Accepted-with-note (P5 triage, 2026-08-04 — audit verdict PASS, 0 blocking)

- F1 (major) FIXED — P5 had been marked PASS before the audit report existed; this triage is the
  completion of that gate, recorded here in the same change.
- F2 (minor) FIXED — the Good manifest trio is now labeled illustrative and states that
  `tool.name` MAY equal `id` (the shipped v1 manifests do).
- F3 (minor) FIXED — code cites are symbol-first with a dated verification + repair rule in the
  SKILL.md head; ADR/SPEC line cites stay frozen-record.
- R5 (nit) ACCEPTED — law 5 deliberately carries the detail behind CLAUDE.md's one-line ADR-0137
  shell-law mention; the partner is named in the audit report.
- Auditor verified ALL cites (8 ADR, 5 SPEC, 11 code symbol+line) true against the tree.
