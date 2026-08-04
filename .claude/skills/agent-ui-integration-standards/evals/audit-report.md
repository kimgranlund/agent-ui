# FLOOR audit — agent-ui-integration-standards

Skill: .claude/skills/agent-ui-integration-standards/SKILL.md · Standards: skill-writing-rules · Lint: clean
Verdict: PASS

Audited 2026-08-04 by skill-checker (fresh context). Repo root for all relative paths:
`.claude/worktrees/agent-a158bce8308716653`.

| ID | Verdict | Severity | Evidence (file:line) | Fix |
|----|---------|----------|----------------------|-----|
| Lint | clean | — | `skill_lint.py` → `skill-postwrite-invocation-lint · clean` (exit 0, run for real) | — |
| R1 | PASS | — | 3 sampled lines all fail the deletion test: SKILL.md:29 (dup-id/dup-wire boot-fail-fast), SKILL.md:55-56 (unprovisioned keyed manifest EXCLUDED — answers the "why isn't my tool offered" trigger), SKILL.md:64-66 (shared-builder law vs the GH #402 fork class). None is model knowledge; all are repo-ratified law | — |
| R2 | PASS | — | Description (SKILL.md:3-11) front-loads verbatim asks ("add an integration", "how do integration keys work", "why isn't my tool offered"); 3 parseable `NOT for <x> (<owner>)` fences; corpus of record in-tree at evals/evals.json (14 trigger + 6 no-trigger, each negative carrying its owner) | — |
| R3 | PASS | — | Knowledge species · `disable-model-invocation: false` + `user-invocable: false` both explicit (SKILL.md:12-13) · noun-head name `-standards` matches siblings agent-ui-component-standards / agent-ui-doc-standards; intent.md:14-15 declares the same story | — |
| R4 | PASS | — | Declarative register throughout (laws stated as standing fact); zero uppercase NEVER/MUST-NOT hard gates — caps spent on emphasis (THREE :28, ONE :40, BOTH :54, EXCLUDED :55), inside the ≤3 budget | — |
| R5 | nit | nit | SKILL.md:69-75 (law 5) is a drift pair with project CLAUDE.md's ADR-0137 line ("registry shell stays site-internal in tools/agent/"). Acceptable division — the skill adds the copy-anchor (`registry.ts`) and the ToolDef/ExecuteTool seam detail — but the partner is now named per R5 | Optional: none required; if either text moves, repair both in the same change |
| R6 | PASS | — | 83-line body, entirely inside the 5,000-token head; authority/re-derivation rule at SKILL.md:18-21 (head), Routing out at :77-82 (tail); no references/ needed at this size | — |
| R7 | N/A | — | Knowledge species — output contract / failure branches not applicable | — |
| R8 | PASS | — | Numeric anchors throughout: five laws (:18), THREE facts (:28), ONE checker (:40-41), ONE dispatch (:63), exact file:line on every law | — |
| A-cite | PASS | — | Citation spot-verify (well past the dispatched 4): ADR-0168 cl.1 :52-58 ✓ cl.2 :60-65 ✓ cl.3 :67-75 ✓ cl.4 :77-84 ✓ cl.5 :86-97 ✓ Context §1 :22-27 ✓ preamble :48-50 ✓ Non-goals :109-110 ✓ (Read of the full ADR) · SPEC-R16 :692 ✓ R17 :708 ✓ R18 :725 ✓ R19 :742 ✓ N1 :763 ✓ (grep -n) · code: `IntegrationManifest` registry.ts:34 ✓ `registerIntegration` :65 ✓ `ExecuteContext` :27 ✓ `resolveIntegrations` :103 ✓ `validateToolInput` validate-input.ts:61 ✓ `assertSupportedSchema` :97 ✓ `buildToolDispatch` tool-dispatch.ts:50 ✓ callers dev-proxy-plugin.ts:191,260 ✓ worker/index.ts:180,253 ✓ · routing-out targets exist: agent-ui-catalog ✓ a2ui-compose ✓ agent-protocols:a2ui-chat-agent-facts ✓ (plugin cache 1.0.3/1.0.4) | — |
| F1 | FAIL | **major** | intent.md:33-36 records "**P5 PASS 2026-08-04** — … skill-checker audit: findings triaged (see evals/audit-report.md; accepted-with-note items below)" — but at audit time `evals/` held only `evals.json` + `baseline/` (ls verified); intent.md:51 is still the placeholder "(filled at P5 triage)". A gate recorded PASS ahead of its own runtime check — the exact stale-record class the repo's own contract ranks with bugs | Flip P5 to pending/in-flight until this report is triaged; fill §Accepted-with-note and re-date the PASS in the same edit |
| F2 | FAIL | minor | SKILL.md:35-36 Good example `{id: 'wiki-search', tool: {name: 'search_wikipedia'}, label: 'Wikipedia Search'}` reads as the shipped Wikipedia manifest but matches none of its three fields — wikipedia-search.ts:13/:18/:15 is `id: 'wikipedia-search'` / `tool.name: 'wikipedia-search'` / `label: 'Wikipedia search'`, where id EQUALS tool.name (legal per ADR-0168 cl.2 :63). Unlabeled, the invented trio becomes a de-facto contract and contradicts the shipped code | Label it "(illustrative — invented trio; the shipped wikipedia-search manifest has id = tool.name, which cl.2 permits)" or swap in the real trio |
| F3 | open | minor | Code line-number anchors (registry.ts:34/:65/:27/:103 · validate-input.ts:61/:97 · tool-dispatch.ts:50 · dev-proxy-plugin.ts:191,260 · worker/index.ts:180,253) are ALL true today (verified above) but cite living source with no gate re-pinning them — the first refactor silently falsifies them. The ADR/SPEC line cites are fine (frozen records) | For the code tier, lean on the symbol names alone (already present); keep line numbers for the frozen doc tier only, or add "line numbers as of 2026-08-04" |

## Dismissals (checks named, per checking-rules)

- **"Laws 2–5 lack the knowledge-skeleton contrastive pair"** — dismissed. Read each law: the
  contrast function is served inline without the Bad/Good scaffold — SKILL.md:46-47 ("Per-executor
  guards are defense-in-depth only, never the first line"), :52 ("a NAME, never a value"),
  :64-65 ("Per-route or per-host dispatch forks are the GH #402 defect class"). Deleting the
  scaffold would not change which anti-patterns get named.
- **Steelman on F1** — drafted the maker's rebuttal ("the placeholder at intent.md:51 shows P5
  triage was always planned to complete after this audit"). It does not survive: the line asserts
  "findings triaged" in the past tense with a PASS marker and a date. Finding confirmed at major
  (not blocking — the SKILL.md itself ships correct, verified behavior; the defect is in the
  bundle's build record).
- **Steelman on F2** — rebuttal ("it's obviously a schematic example"): does not survive —
  skill-writing-rules' knowledge rule is explicit that unlabeled examples are read as contracts,
  and this one names a real shipped integration by near-identical strings.

## Top 3

1. (major, F1) intent.md pre-claims the P5 audit as triaged before this report existed — repair the
   record at triage time, same edit as the Accepted-with-note fill.
2. (minor, F2) Law 1's Good example contradicts the shipped wikipedia-search manifest — relabel
   illustrative or use the real trio.
3. (minor, F3) Living-code line anchors will drift silently — anchor code by symbol, keep line
   numbers for the frozen ADR/SPEC tier.
