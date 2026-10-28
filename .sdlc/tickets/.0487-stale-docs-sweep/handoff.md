---
id: T-0487
title: "Stale-docs sweep: specs, LLDs, references and READMEs checked against the code"
type: spike           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A findings list of records that no longer match the code, each with file:line evidence, written into this file under `## Findings`, so the conductor can file one fix ticket per group.

## Context
Stale context is a defect equal to a bug. Records to check: `.claude/docs/spec/`, `.claude/docs/lld/`, `.claude/docs/references/` (commands.md, agent-model.md, state-and-persistence.md, dogfood-lint.md), package READMEs under `packages/agent-ui/*/README.md`, the root README and AGENTS.md (package table, commands, gates, never-hand-edit list), and the skills under `.claude/skills/`. Check claims that name files, functions, scripts, commands, counts, exports and package edges against the tree. ADRs and `.claude/docs/tickets/` are frozen history: skip them. Changelog and history passages are history: skip them too.

## Constraints
Read-only spike: edit nothing but this handoff. No fixes land here. Group findings by record family, mark each High (a reader would run a wrong command or edit a wrong file), Medium (wrong fact) or Low (wording), and propose one fix ticket per group. No em dashes.

## Done when
- `## Findings` in this handoff lists each stale claim with record file:line, the code evidence, a severity, and a proposed ticket group.

## Acceptance criteria
- `## Findings` exists in `.sdlc/tickets/0487-stale-docs-sweep/handoff.md` and every finding cites a record path:line and a code path or command output that contradicts it.
- A spot check of three High findings reproduces.
- `git diff --name-only HEAD` lists only this handoff.
- No em dash in the added text.
- Lane: solo because size L2 (steps.py lane)

## Findings

Swept at base eb742cd01. Method: every backticked repo path, `npm run` script, `@agent-ui/*` subpath, test file
name and camelCase symbol in `.claude/docs/spec/`, `.claude/docs/lld/`, `.claude/docs/references/`, the package
READMEs, the root README, AGENTS.md and `.claude/skills/` was resolved against `git ls-files`, `package.json`
scripts and each package's `exports`; relative markdown links were resolved too (all resolve). Every hit was then
read in context. Dropped as not stale: MCP method names (`tools/list`, `tools/call`), template paths, rows marked
unbuilt or deferred, skill `evals/` transcripts, the banner-superseded agent-app-shell SPEC and LLD, provenance
notes naming the retired `scripts/adr_ratify.py`, and gitignored runtime dirs (`.claude/worktrees`, `.sdlc/messages`).
All `npm run` names in the swept records exist.

### Group A: ADR-0245 foundations sheets missing from consumer recipes (proposed ticket: "Consumer CSS recipes load foundations.css and foundations-bridge.css")

Code evidence for the whole group: `packages/agent-ui/components/src/foundation-styles.css` imports four sheets
(`tokens.css`, `dimensions.css`, `foundations.css`, `foundations-bridge.css`). The control geometry lives only in
the two generated sheets: `grep -c -- '--md-sys-height:'` gives 0 for `tokens.css` and `dimensions.css`, 1 for
`foundations.gen.css` and 1 for `foundations-bridge.gen.css` (all under `packages/agent-ui/shared/src/tokens/`);
`ui-button`'s sheet reads `var(--md-sys-height` 3 times and `var(--md-sys-icon-box` 3 times.

- A1 High. `packages/agent-ui/components/README.md:37-41`: the CDN recipe links only shared's `tokens.css` and
  `dimensions.css` before the seam sheet, so a CDN consumer gets controls with no `--md-sys-height` or
  `--md-sys-icon-box`. Fix: add `foundations.css` and `foundations-bridge.css` links.
- A2 High. `packages/agent-ui/shared/README.md:18-20` ("The foundation, in order: color tokens, then the
  dimensional ramp") and `:34-38` (CDN, "These two sheets are fully self-contained"): same two-sheet foundation.
  `packages/agent-ui/shared/package.json` exports `./foundations.css` and `./foundations-bridge.css`, which the
  README never names.
- A3 Medium. `.claude/docs/references/component-packaging.md:106`, `:110-111` and `:144`: the foundation barrel is
  described as `tokens.css` then `dimensions.css` (two imports); the file has four.
- A4 Medium. `AGENTS.md:23` (shared row: `src/tokens/{tokens,dimensions}.css -> @agent-ui/shared/tokens.css`)
  omits `foundations.css` and `foundations-bridge.css`, two of the package's eight `exports` keys.
- A5 Low. `AGENTS.md:59` names the foundations generator inputs as `scale.mjs` and the vendored resolver;
  `scripts/generate-foundations.mjs:38,40` also imports `scripts/lib/foundations-rules.mjs` and
  `scripts/lib/foundations-model.mjs`, and `foundations.gen.css:1` says it is generated "from
  scripts/lib/foundations-model.mjs".

### Group B: the retired `component-styles.css` barrel as a build step in component LLDs (proposed ticket: "Component LLDs drop the component-styles.css @import step")

Code evidence: `ls packages/agent-ui/components/src/component-styles.css` fails; the barrel was deleted in
4d90e8265 ("Retire the component barrels", ADR-0233); the components `package.json` `exports` has no
`./component-styles.css`, and the per-control `exports` keys are generated (`scripts/generate-controls.mjs`, AGENTS.md
Never hand-edit). Each LLD below was half-updated (its `registry.gen.ts` text is current), so a builder reading it
would still add an `@import` to a file that does not exist and hand-add a generated `exports` key.

- B1 High. `.claude/docs/lld/code-entry-control.lld.md:138` (LLD-C7: "`component-styles.css` `@import`,
  `package.json` exports subpath").
- B2 High. `.claude/docs/lld/multi-select-field.lld.md:190` (step 3: "`component-styles.css` `@import`, and the
  `package.json` `exports` subpath").
- B3 Medium. `.claude/docs/lld/field-form-provider.lld.md:650` (s12: "`component-styles.css` @imports").
- B4 Medium. `.claude/docs/lld/swiper-family.lld.md:63` ("`component-styles.css` imports all five sheets").
  The current procedure is `.claude/skills/component-build/SKILL.md` step 8 (generated entries, `codemod-uses.mjs`).

### Group C: site-authoring skill states the inverted sitemap rule (proposed ticket: "site-authoring content-types: demo pages are the canonical sitemap entry")

- C1 High. `.claude/skills/site-authoring/references/content-types.md:190-191`: "the sitemap EXCLUDES demo pages
  BY DESIGN (`EXCLUDED_SUFFIX` in `site/lib/sitemap.test.ts`), their absence there is not a defect."
  Evidence: `grep -n EXCLUDED_SUFFIX site/lib/sitemap.test.ts` prints nothing; `site/lib/sitemap.test.ts:161-170`
  (`canonicalPageFor`) makes `{slug}-demo.html` the preferred sitemap entry, mirroring
  `generate-sitemap.mjs`'s demo-preferred rule (GH #1619, f181f8b66). A demo missing from the sitemap is now a
  G2 failure, not by design.

### Group D: A2UI and app LLD file maps naming retired files or stale blockers (proposed ticket: "A2UI and app LLD file maps re-synced to the tree")

- D1 Medium. `.claude/docs/lld/a2ui-live-agent.lld.md:110` (LLD-C12): the provider switcher is "built" at
  `site/lib/provider-switcher.ts`; the file is gone, retired by f47bbd47f (provider and Gen-UI pickers moved into
  `ui-conversation-composer`, GH #257).
- D2 Medium. `.claude/docs/lld/a2ui-streaming-pipeline.lld.md:29` (LLD-C6): "unbuilt · blocked by corpus store
  (retrieve/admit)". The blocker is gone: `packages/agent-ui/a2ui/src/corpus/retrieve.ts` and `admit.ts` exist and
  `.claude/docs/lld/a2ui-corpus-store.lld.md:111,115` mark both REALIZED. The row should say unbuilt by choice
  (the trigger-deferred scope `a2ui-harness-wiring.lld.md:52` names), not blocked.
- D3 Medium. `.claude/docs/lld/a2ui-chat.lld.md:27` (LLD-C2): `SurfaceRegistry` in `site/lib/surface-registry.ts
  (new)`; the file was retired in ec78f71d5 ("surface-registry retires (M2 Phase 2)"), which `:33` of the same
  table and `.claude/docs/spec/app-surfaces-m2.spec.md:52` already record. The C2 row has no retired note.
- D4 Low. `.claude/docs/lld/shell-archetypes-m5.lld.md:104` enumerates `ui-app-shell`'s consumers
  (`a2ui-live.ts`, `site/pages/app-shell.ts`, `site/app-shell.html`) as present tense; `ui-app-shell` was removed in
  8492d66c1 (GH #249, ADR-0156), `site/pages/app-shell.ts` and `site/app-shell.html` do not exist, and the LLD
  carries no superseded-in-part banner (unlike `nav-rail-family.lld.md:4`).

### Group E: package README exports and versions (proposed ticket: "Package READMEs: current CDN version pin and complete exports table")

- E1 Medium. CDN snippets pin `@0.0.5` while every README states "The latest release is 0.2.0 (tag `v0.2.0`)":
  `packages/agent-ui/a2a/README.md:27`, `a2ui/README.md:38`, `code/README.md:33-39`, `components/README.md:39-45`,
  `icons/README.md:33`, `router/README.md:29-33`, `shared/README.md:34-35`. A 0.0.5 copy also predates the
  ADR-0245 foundations sheets (Group A).
- E2 Medium. `.claude/docs/references/component-packaging.md:94-108` says the exports table is "Verified against
  `packages/agent-ui/components/package.json`" but omits five hand-owned keys that file exports: `./loader`,
  `./dogfood-frame`, `./traits/list-reorder`, `./traits/overlay`, `./traits/scroll-spy`.

### Group F: wording and shorthand paths (proposed ticket: "Low-severity doc path and rename tidy")

- F1 Low. `.claude/docs/references/component-authoring-foundations.md:5,11,17,24,31,38,43,49`,
  `.claude/docs/references/component-authoring-best-practices.md:22`,
  `.claude/skills/site-authoring/references/best-practices.md:21`,
  `.claude/skills/site-authoring/references/content-types.md:115` and
  `.claude/skills/admin-library-kinds/references/single-select-catalog.md:26` cite `docs/plan.md`,
  `docs/process.md`, `docs/references/{geometry,tokens}.md` and `docs/lld/...`; there is no `docs/plan.md` or
  `docs/references/` (`ls docs/` holds only `AGENTS.md`, `CLAUDE.md` and `layout.md`); the files live under `.claude/docs/`.
- F2 Low. `.claude/docs/references/state-and-persistence.md:78,110` name `persona-roster-source.ts` and
  `createPersonaRosterSource<P>()`; the code is `packages/agent-ui/app/src/controls/agent-admin/agent-roster-source.ts`
  with `createAgentRosterSource`, `AgentRosterView`. An append-only rename note at `:186-190` asks the reader to
  translate; the body was never updated.

### Out of scope (code, not records)

- `packages/agent-ui/app/package.json` depends on `@agent-ui/data`, and three non-test app modules import it
  (`agent-roster-source.ts`, `agent-team.ts`, `skill-pack-store.ts`), but `scripts/publish/publish-packages.mjs:72`
  `PACKAGE_ORDER` excludes `data` and `README.md:15-16` says `data` was never published. The publish rewrite turns
  the dependency into `@agent-ui-kit/data`, which does not exist on npm. Worth its own bug ticket.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L1 (sonnet) · base: eb742cd01a35
- Changed: A stale-docs sweep finds 20 stale claims in six groups, plus app depending on the never-published data package
- Commits: none
- Check: 1 Findings section exists, each finding cites record path:line and contradicting code evidence: pass
- Check: 2 Spot check of three High findings reproduces: pass
- Check: 4 No em dash in the added text: pass
- Follow-up: note: .sdlc/AGENTS.md and .sdlc/tickets/roadmap.md carry uncommitted... -> notes.md
