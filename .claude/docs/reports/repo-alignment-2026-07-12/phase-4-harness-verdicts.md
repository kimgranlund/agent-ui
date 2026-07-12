# Phase 4 — Harness lens verdicts (repo-alignment 2026-07-12)

> Verdicts only. No migrations, no repairs performed. Evidence rule: path-grep + real execution,
> never word-grep. Contract: `.claude/skills/agent-ui-doc-standards/SKILL.md` (Phase-3). Context:
> `phase-0-inventory.md`.

## Lens 1 — CLAUDE.md residency (69 lines)

| Section | Verdict | Evidence / landing |
|---|---|---|
| L1–9 (identity + plan/goals/process/references pointers) | **stays** | True always-on orientation; the four paths (`plan.md`, `goals.md`, `process.md`, `references/`) all resolve. |
| L11–18 Commands | **repair-in-place** | `package.json:12` — `"check": "tsc && npm run check:site && npm run check:tools"` — **three** steps. CLAUDE.md:13 documents only two (`tsc && check:site`). `tsconfig.tools.json` (a real, load-bearing config gating `packages/agent-ui/*/tools`) is entirely unmentioned. This is a factual drift in an always-on section, not a stale-but-harmless claim — a reader following CLAUDE.md today undercounts the standing gate by one step. Landing: stays resident, text needs the `check:tools` clause + one line on what it gates. |
| L20–45 Layout | **stays** | Verified against the tree: all 8 `packages/agent-ui/*` dirs (a2a, a2ui, app, code, components, icons, router, shared) match their package.json `name` fields exactly; the `.claude/docs/` line (plan/goals/process/references/adr/prd/spec/lld/decompositions/tickets/rubrics/archive) matches `ls .claude/docs/` exactly (the unification from Phase 1 already landed — old `specs/` tree confirmed dissolved, `docs/specs/` no longer exists). No drift. |
| L47–63 Conventions | **stays** | Spot-checked against `tsconfig.json`: `erasableSyntaxOnly` (L40), `verbatimModuleSyntax` (L13), `allowImportingTsExtensions` (L11) all present and true. `layering.test.ts` trip-wires confirmed in 5/8 packages (router, app, code, components, icons) — a2a/shared/a2ui don't carry their own, but a2a is zero-dep and shared is the DAG floor, so the claim ("enforced by the per-package trip-wires") holds without overclaiming; not a defect worth an eviction. |
| L65–67 Always | **stays** | `npm run check && npm test` is real and matches the two commands section above (modulo the check:tools gap noted there). Deliberately does NOT mention `test:browser` / the component-wave browser gate — correct scope: that gate is a per-control DoD item owned by `agent-ui-component-testing`, not a blanket every-commit rule; folding it in here would be scope creep into a subtree truth. |
| L69–70 HTML comments (gate location + doc pointers) | **stays** | Both pointers (`process.md` §1, `plan.md`/`goals.md`) resolve and are correctly scoped as "pointer not @-inline." |

**Projected line delta: ~+2 to +4** (the `check:tools` / `tsconfig.tools.json` clause). Everything else holds. This file earns its "deliberately thin" self-description — a "mostly stays" verdict is the honest read here, not under-scrutiny.

## Lens 2 — Skills species (15 repo-local, `.claude/skills/`)

All 15 carry `disable-model-invocation: false` (none in the "Command" species — none are slash-menu-only), so the species question reduces to knowledge (`user-invocable: false`) vs procedural (`user-invocable: true`), checked against each body's nature:

| Skill | user-invocable | Species fit | Lines | Verdict |
|---|---|---|---|---|
| a2ui-compose | true | procedural (compose a payload) — correct | 154 | **stays**, oversize flag (>150; a references/ split is worth considering, not prescribed) |
| a2ui-corpus-curate | true | procedural (curate corpus) — correct | 123 | stays |
| agent-ui-catalog | false | knowledge (fleet map) — correct | 59 | stays |
| agent-ui-component-create | true | procedural (build procedure) — correct | 108 | stays |
| agent-ui-component-design | true | procedural (design intake) — correct | 137 | stays |
| agent-ui-component-packaging | false | knowledge (packaging law) — correct | 50 | stays |
| agent-ui-component-patterns | false | knowledge (prior-art map) — correct | 54 | stays |
| agent-ui-component-standards | false | knowledge (normative law) — correct | 57 | stays |
| agent-ui-component-testing | false | knowledge (test-bar map) — correct | 67 | stays |
| agent-ui-compose-app | true | procedural — correct | 72 | stays |
| agent-ui-compose-layout | true | procedural — correct | 67 | stays |
| agent-ui-compose-ui | true | procedural — correct | 64 | stays |
| agent-ui-composition-patterns | false | knowledge (consumer patterns) — correct | 50 | stays |
| agent-ui-doc-standards | false | knowledge (doc grammar) — correct | 79 | stays |
| docs-author | true | procedural (author a page) — correct | 165 | **stays**, oversize flag (>150) |

No species/invocation-dial mismatches found across all 15 — every knowledge skill is model-only-routed, every procedural skill is user-invocable, matching the corrected species table in `forge:skill-authoring-standards` (verified against the live installed copy, `forge@nonoun-plugins` 1.21.0).

**Dependency/path check:** none of the 15 bodies cite the dissolved old doc-map (`docs/specs/specs`, `docs/specs/llds`, `docs/specs/decompositions`) — clean grep, zero hits. All `.claude/docs/references/*.md` and `.claude/docs/{adr,lld,rubrics,process}` paths cited resolve to real files. `TKT-0005`/`TKT-0006` (the agent-ui-* suite's charter tickets, per Phase-0) both exist.

**Liveness (consumer evidence, not self-reference):** every one of the 15 is referenced by name from at least one other live file (a sibling skill's `[[wikilink]]`/prose routing, an agent's `skills:` preload, or CLAUDE.md itself). Two looked thin at first pass — `agent-ui-doc-standards` (1 external referrer) and `agent-ui-catalog` (3) — both confirmed real: `agent-ui-doc-standards` is the live target of `CLAUDE.md:45`'s own doc-grammar pointer; `agent-ui-catalog` is routed to from `agent-ui-compose-ui`, `agent-ui-compose-layout`, and `agent-ui-composition-patterns`. **No zombie skills found.**

**Dual-home check:** no repo skill shadows a forge/scribe/ui plugin skill by name. `agent-ui-doc-standards` explicitly declares its divergence from `scribe:doc-authoring-standards`/`doc_lint` in its own body (mirrors-by-design, not accidental duplication) — correctly self-documented, not silent drift.

**Deprecated zombies:** none found — no banner/retirement-plan skills in the 15.

## Lens 3 — Wiring residue

| Item | Verdict | Evidence |
|---|---|---|
| `scripts/harness_wiring_check.py` | **repair-in-place** (broken, not a zombie — actively cited as the wave-close governance proof by ADR-0067, `a2ui-harness-wiring.lld.md`, `a2ui-expert-harness.spec.md`) | **Confirmed by real execution**: `python3 scripts/harness_wiring_check.py` exits 1 with `FATAL: harness_checks.py not found under ~/.claude/skills/{skill-author,agent-author}/scripts/`. Root cause: `skill-author`/`agent-author` no longer exist as standalone `~/.claude/skills/` dirs — they were renamed to the domain-verb family in the 2026-07-01 wave and now live only as **plugin** skills (`forge:skill-authoring-standards`, `forge:agent-authoring-standards`), which this script's `find_harness_checks()` never looks under. The gate has been non-functional since before this campaign started — this predates Phase 0. Independently, its docstring (L4–5) still cites the dissolved `.claude/docs/specs/llds/…` / `.claude/docs/specs/specs/…` paths instead of the current `.claude/docs/lld/…` / `.claude/docs/spec/…` — a second, separate staleness from the Phase-1 unify. Referrer-repair note: re-point `find_harness_checks()` at wherever `harness_checks.py` now actually resides (verify it still exists at all under the renamed plugin family before assuming a simple path swap fixes it), and correct the two docstring path citations. |
| Agents' `skills:` preloads (5 agents) | **keep (suspicion overturned)** | Initial read suspected two problems, both fell on closer check: (1) 4/5 agents preload bare `handoff-compose` (a plugin skill, `forge@nonoun-plugins`) without a `forge:` prefix — `forge:plugin-authoring-standards` states "unqualified names keep working where unambiguous," and no other installed source provides `handoff-compose`, so this resolves fine. (2) The preloaded skills (`handoff-compose`, `a2ui-compose`, `agent-ui-component-create`) are all `user-invocable: true` ("procedural" species) — an earlier-vintage internal doc (`forge:agent-authoring-standards`) reads as if only `user-invocable: false` skills are preloadable, but the corrected species table in `forge:skill-authoring-standards` (dated 2026-07, explicitly supersedes the older phrasing) confirms **both** Procedural and Knowledge species are preloadable into agents; only the disable-model-invocation:true "Command" species is not. All 5 agents' preloads resolve. |
| `a2ui-builder.md` old-tree path citations | **keep (suspicion overturned)** | Phase-0 flagged this file as citing `docs/specs/…`. Full read of the current body: every cited path is the new unified map (`.claude/docs/prd/`, `.claude/docs/spec/`, `.claude/docs/lld/`, `.claude/docs/adr/`, `.claude/docs/rubrics/`) — already repaired, presumably in the Phase-1 unify wave. Stale flag, not a live defect. |
| `scripts/measure-size.mjs` | stays | Wired: `package.json` `"size"` script. |
| `scripts/generate-llms-full.mjs`, `generate-sitemap.mjs`, `slug.mjs` | stays | Not npm-scripted, but a deliberate, documented manual-regen pattern (same class as `npm run size`, ADR-0040 §3 precedent) — real callers exist: `site/lib/llms.test.ts` and `site/lib/sitemap.test.ts` check the generated output; multiple done tickets/ADRs cite `node scripts/generate-llms-full.mjs` as the regen step. Not orphaned. |
| `.claude/hooks/*` × 3 vs `settings.json` | stays | All 3 registrations (PreToolUse `adr-status-guard.py`; PostToolUse `bundle-size-reminder.sh` + `css-comment-guard.py`) resolve to real files both directions; no orphan hook, no unregistered script. |
| `settings.json` vs `settings.local.json` | stays | No overlap — `settings.local.json` carries only `env` (agent-teams flag, stop-hook-block-cap) + an `Agent` permission allow; zero hook duplication. |
| `.claude/scheduled_tasks.lock` | **keep (suspicion overturned)** | Phase-0 called this "vestigial." It is not: the file's `sessionId` matches the currently-running session exactly, and its `pid` (2844) is confirmed live via `ps`. It is untracked and excluded only via local `.git/info/exclude` (not the repo's own `.gitignore`, never committed) — a personal, correctly-scoped exclude for a session-local lock, not repo residue. |

## Summary

| Disposition | Count | Items |
|---|---|---|
| stays | 6 | CLAUDE.md L1-9/Layout/Conventions/Always/footer-comments; measure-size.mjs; generate-llms-full/sitemap/slug.mjs; hooks↔settings.json; settings.json vs settings.local.json; 13 of 15 skills (no oversize flag) |
| repair-in-place | 2 | CLAUDE.md Commands section (check:tools + tsconfig.tools.json gap); `scripts/harness_wiring_check.py` (dangling `harness_checks.py` dependency + stale docstring paths) |
| evict→named landing | 0 | none — CLAUDE.md's thinness holds up under scrutiny |
| zombie→retire | 0 | none found among the 15 skills or the scripts/ dir |
| keep (suspicion overturned) | 3 | agents' `skills:` preloads; `a2ui-builder.md` path citations; `.claude/scheduled_tasks.lock` |
| oversize-flag (informational, not a disposition) | 2 | `a2ui-compose` (154 lines), `docs-author` (165 lines) — both otherwise `stays` |

No CI to reconcile (confirmed absent, per Phase 0). No skill/agent zombies. The harness surface is materially cleaner than Phase 0's flags suggested — three of Phase 0's four suspicion items overturned on inspection, and the one real, confirmed-broken item (`harness_wiring_check.py`) was not on Phase 0's radar at all; it surfaced only from actually running the script.
