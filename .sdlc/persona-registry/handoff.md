---
id: T-0013
title: "Generated per-persona capability registry (GH #1807)"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: M              # S | M | L | XL
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Inventory is scattered: 87 control descriptors, five catalog.json files, selection.json sidecars, persona catalog fragments, the ADR index, skills, agents and fs-shim-content.ts. Nothing is one queryable index, so the prompt sends the whole catalog every turn. Generate a registry (id, kind, source, status, consumers) as a base registry plus persona fragments composed at runtime (The Croupier, The 

## Intent
- Do: design only in this lane (architect then plan); no build until the no-barrels wave (#1814) has merged, because it edits the same generated surface.
- Non-goals: any build or merge before the design is reviewed.
- Done when: an architect result and a reviewed plan exist, or the first design fork is recorded for Kim.

## Context
GH #1807: full text via `gh issue view 1807`. Origin: the 2026-10-05 generative-systems review of agent-ui. Epic: GH #1817. Read `.sdlc/rollout-2026-10-05.md` and `.claude/docs/references/agent-model.md` first. Evidence in the issue is from a review: verify before building. Related designs: ADR-0232 (selection sidecars), ADR-0233 (no barrels, ratified), `.sdlc/no-barrels/`.

## Constraints
No key reaches a headless run (ADR-0073); no em dashes; ADRs never self-ratified; accepted ADRs and dated reports are historical.

## Rulings
- Kim ruled 2026-10-05: fork 1 (per-turn prompt-inventory pruning) deferred until T-0003 sections and T-0005 evals exist; fork 2 (widen base mini-skill retrieval for derived catalogs) NO. Registry stays a derived index; no prompt change.

## Acceptance criteria
Built and committed by the solo lane at commit `76dc8c82` on branch `feat/persona-registry`, worktree `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-registry`. Verify in that worktree (it holds the commit; the main checkout does not). Every command runs from the worktree root.
- AC1 Pure subpath: `src/registry/` (types, compose, select, index) imports no `node:*` and nothing from `src/agent/`; `packages/agent-ui/a2ui/package.json` exports `./registry`; the root barrel `src/index.ts` exposes no registry symbol. Observable: `npx vitest run --project packages packages/agent-ui/a2ui/src/registry` exits 0 (its `opt-in` legs), and `npx vitest run --project packages packages/agent-ui/a2ui/src/agent/gates.test.ts packages/agent-ui/a2ui/src/layering.test.ts packages/agent-ui/a2ui/src/corpus/index.test.ts` exits 0.
- AC2 Composition and views: `registryViewFor(registry, 'agent-ui--croupier')` holds every default type plus `PlayingCard` with base and persona guidance and `personaOnlyTypes` equals `['PlayingCard']`; `agent-ui--nobody` has the base view's types; an unknown base is empty; a runtime-tier-only source set composes. Observable: `src/registry/compose.test.ts` and the persona legs of `registry-wiring.test.ts` pass.
- AC3 Ranking: `selectCapabilities('show one playing card', croupierView, 3)[0]` is `PlayingCard`, never returns a row outside the view, never pads a zero score, honours the cap. Observable: `src/registry/select.test.ts` passes.
- AC4 Tag rule scope: default-catalog types follow `tagForType` and equal every default `WidgetFactory.tag`; a persona type carries a `tag` only when that tag is a fleet control (`PlayingCard`; `BookingForm`, `BookingConfirmation`, `FixtureBanner` carry none); `a2ui-basic` types carry none. Observable: the `tag parity` legs of `registry-wiring.test.ts` pass, each with a negative control.
- AC5 Wiring gates over the joins, each with a negative control: fleet join to `@agent-ui/components/registry` (tags and `uses` equal), every mini-skill and corpus shard names a registered catalog id, exclusion single source (`EXCLUSION_ALLOWLIST` lives only in `catalog/default/exclusions.ts`, `default/index.test.ts` imports it and defines no second map), the loader's hard-coded persona list equals `SHIPPED_PERSONA_CATALOG_MANIFESTS`, and the derived ids equal `derivedCatalogIdsFor(SHIPPED_PERSONA_CATALOGS)`. Observable: `registry-wiring.test.ts` passes; `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/default/index.test.ts` passes.
- AC6 Plain-Node loader and projection: `node --experimental-strip-types packages/agent-ui/a2ui/tools/registry/generate.ts --dry` exits 0 with no DOM and no vite; `npm run generate:registry` twice leaves `git status` clean; `site/capability-registry.json` and `site/public/capability-registry.json` are byte-identical, hold 94 `type` rows in `.base` (80 `agent-ui` plus 14 `a2ui-basic`) and 3 entries in `.personas`, and carry no timestamp key. Observable: `jq '[.base[] | select(.kind=="type")] | length' site/public/capability-registry.json` prints `94`.
- AC7 Drift gate: `npx vitest run --project tools packages/agent-ui/a2ui/tools/registry` exits 0 on the clean tree, and exits non-zero with a message naming `npm run generate:registry` after either one planted trailing byte in a copy or one edited descriptor `description:` line (revert it after).
- AC8 Preset leg: every `AGENT_PRESETS[].localPatterns` names a shipped persona and resolves to a registered derived id; a planted preset naming `nobody` is reported. Observable: `npx vitest run --project site site/lib/capability-registry.test.ts` exits 0.
- AC9 Page: `site/capability-registry.html`, `site/pages/capability-registry.ts`, a `site-manifest.json` row (section A2UI), a `_page.ts` nav link, an `llms.txt` entry, sitemap regenerated. Observable: `npx vitest run --project site site/pages/capability-registry.test.ts` exits 0 (the page mounts a defined `ui-select`, selecting `agent-ui--croupier` adds a persona-only `PlayingCard` row, selecting `agent-ui` removes it), and `npx vitest run --project site site/lib/sitemap.test.ts site/lib/llms.test.ts site/lib/docs-grammar.test.ts` exits 0.
- AC10 No prompt change and no SPEC-R6 amendment: `git diff HEAD~1 HEAD -- packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent .claude/docs/spec` is empty (the base is `ecd7d594`; `origin/main` may have moved since); `prompt-equivalence.test.ts` passes with the baseline unrecaptured; `retrievalScopeFor` is not shipped; a derived id's view `retrievable` is empty (exact `catalogId` filter).
- AC11 Records: ADR-0237 exists with Status `proposed` and Ratified-by `pending Kim`, relates ADR-0071, 0087, 0172 SPEC-R6, 0173 cl.5, 0232, 0233, 0234, and numbers past the reserved 0235 and 0236 (listed in `docs-grammar.test.ts` S8 KNOWN_GAPS). `agent-model.md` section 3 has the `capability registry` glossary entry; `packages/agent-ui/a2ui/AGENTS.md`, skills `a2ui-multi-catalog` and `a2ui-prompt-authoring` name the registry and `npm run generate:registry`. Observable: `grep -c "capability registry" .claude/docs/references/agent-model.md packages/agent-ui/a2ui/AGENTS.md .claude/skills/a2ui-multi-catalog/SKILL.md` each prints at least 1, and `python3 -I /Users/kimgranlund/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py .claude/docs/adr/0237-capability-registry-derived-index.md` exits 0.
- AC12 Standing gates: `npm run check` exits 0; `npm test` exits 0 (653 files, 13453 tests at build time).
- Known and accepted deviations from `architect-L1.md`: the tag rule is scoped (it over-claimed on persona compositions and `a2ui-basic`); the `persona` and `prompt-asset` kinds are not shipped (T-0012 manifest not on main; `fs-shim.test.ts` already gates the embedded assets); the persona list is hard-coded and gated pending T-0012; `retrievalScopeFor` is not shipped (Kim ruled widening NO); the drift gate lives in `tools/registry/generate.test.ts`. The `## Intent` section above still reads "design only"; the build brief superseded it.

## Closed

2026-10-06: Merged to main in #1831
