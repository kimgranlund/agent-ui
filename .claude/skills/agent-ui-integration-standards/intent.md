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

## Amendment — 2026-08-08 (GH #567 S-SKILL, the MCP manifest-registry arc's final slice)

ADR-0177 (ratified 2026-08-06) un-defers ADR-0168's MCP Non-goals; S1–S6 shipped the connector
(PRs #583/#584/#585/#587/#590/#598). This pass adds **law 6** (MCP servers are a manifest
PRODUCER, symbol-first cited into `mcp/servers-config.ts`/`client.ts`/`map-tool.ts`/`discover.ts`
+ `dev-proxy-plugin.ts`, verified 2026-08-08), repoints the Routing-out MCP line from
"DESIGNED, not built" to built-reality, and flips the frontmatter's stale
`NOT for MCP servers (deferred, ADR-0168 Non-goals)` fence to a positive in-scope statement — a
NEW fence distinguishes Claude Code's own MCP config (update-config), which stays out.
Two new trigger cases (t15/t16) + n06's owner note corrected (evals/evals.json). Drift found and
repaired in the SAME change (the header's own "repair the line number here" law): law 4's
`dev-proxy-plugin.ts:191,260` → `:262,331` and `worker/index.ts:180,253` → `:182,255`, both shifted
by unrelated intervening edits. Laws 1–5's SPEC-R16–R19 line cites (`:692-699` etc.) were found
ALSO stale against the current v0.13 SPEC (SPEC-R16 now at line 1024, not 692) — the SPEC grew
v0.9→v0.13 across five intervening amendment waves. Out of this slice's named scope (3 items:
law 6, the Routing-out repoint, the frontmatter fence); flagged for a follow-up citation-repair
pass rather than fixed here.

**skill-checker round 2 (2026-08-08, verdict PASS on 4fb28cf) — two folds:**
1. MAJOR: the header's "ADR/SPEC line numbers are frozen records" claim was itself falsified by
   the stale-cite finding above (SPEC drifts, ADR doesn't) — reworded to split ADR (frozen) from
   SPEC (symbol-first, same discipline as code) and added an in-body "Known pending" one-liner so
   the flag is visible at skill-USE time, not only buried in this log.
2. MINOR: all three Claude-Code-MCP-config redirects pointed at `harness:adopt-plugin`, which
   never mentions MCP — a dead pointer. Repointed to `update-config` (its own NOT-for fence names
   "settings.json edits with no plugin object" as its charter — the real home for a bare MCP
   server entry in Claude Code's own settings.json) in the description, Routing-out, and n06.

Left as directed, per the skill-checker's own call: the description length WARN (833 chars vs the
700 soft cap — accepted, the cost of legitimately widening scope); a `client.ts` citation nit the
skill-checker scoped as record-vs-artifact only (no skill-file change owed here — worth a line in
the PR body instead, see the builder's handback); the SPEC-R16–R19 re-pin itself (the follow-up
pass, already logged above).

## Amendment — 2026-08-08 (GH #609, the SPEC-R16–R19 re-pin follow-up)

The citation-repair pass flagged above is DONE. Laws 1–5's SPEC cites re-derived against the
current v0.13 spec, each Grep-verified by requirement id and re-pinned symbol-first (id + §3.6/§4
anchor) with corrected line ranges: SPEC-R16 `:692-699` → `§3.6 :1024-1038` · SPEC-R17 `:708-716`
→ `§3.6 :1040-1055` · SPEC-R18 `:725-732` → `§3.6 :1057-1072` · SPEC-R19 `:742-748` →
`§3.6 :1074-1087` · SPEC-N1 `:763` → `§4 :1256` (the non-functional table row). The at-use-time
"Known pending" caveat header (added by PR #600) is removed — obsolete once the re-pin landed —
and the header's verification note now reads laws 1–6 verified 2026-08-08 against v0.13.
