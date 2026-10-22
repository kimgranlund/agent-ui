---
id: T-0393
title: "OptionCompare: pick one of two to four options with aligned attribute rows"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0199]        # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
An agent asking the user to pick one of two to four options that differ on the same attributes (legs, rooms, plans, products) renders one OptionCompare whose rows align across options, instead of a Table with a Button per row or a ProductCard Grid.

## Intent
- Do: build `ui-option-compare` (`OptionCompare`), its agentic default-catalog row, sidecar and teaching, and adopt it, exactly as Kim answered T-0199 forks 10 to 16 (2026-10-21), all as recommended:
  - 10: a new type, not an OptionDeck mode; reuses OptionDeck's pick contract (bindable `value`, `actionName`, `select` then `action`, a listbox whose whole column is the `role="option"` target, no Button inside).
  - 11: type `OptionCompare`, tag `ui-option-compare`, class `UIOptionCompareElement`, folder `packages/agent-ui/components/src/controls/option-compare/`, base `UIElement`, tier `pattern`, agentic default-catalog row.
  - 12: props `options` (`[{value, title, subtitle?, values: {<rowKey>: string}}]`, two to four), `rows` (`[{key, label}]`), `best` (a "Best" text pill plus a ring, never color alone), `value`, `actionName`, `heading`, `inline`.
  - 13: Direction A, option columns beside a pinned label column; a fourth option at the 400px column scrolls inside the control.
  - 14: feed partition IN.
  - 15: rewrite `mini-skills/comparison-table.md` to teach OptionCompare for a pick, keeping Stat plus Table for facts only, with a deliberate prompt-equivalence recapture; the Table boundary lives in that mini-skill; `notFor` OptionDeck reciprocal.
  - 16: adopt in travel `trip-plan` (both the Table-with-Button and the ProductCard Grid become one OptionCompare) and a shopkeeper compare ask (`product-grid` stays for browsing).
- Non-goals: the Itinerary (T-0199); changing OptionDeck.
- Done when: a screenshot of the built control matches the approved mockup; the catalog, sidecar and feed gates, the prompt budgets and the prompt-equivalence baseline are green; travel and shopkeeper adopt it; `npm run check`, the touched folders' tests and the whole jsdom suite once exit 0.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
- Split from T-0199 by Kim's 2026-10-14 ruling (`.sdlc/notes/notes.md`, "T-0199 splits (itinerary to hospitality, compare agentic)"); spec `.claude/docs/spec/a2ui-catalog-architecture.spec.md` lists Compare as agentic.
- The approved design: `.sdlc/tickets/.0199-itinerary-compare/handoff.md` `## Decisions` `### Option compare` (precedent sweep, fork sheet) and the mockup `.sdlc/tickets/.0199-itinerary-compare/mockup/option-compare.html`, Direction A (both land when T-0199 merges; until then they are in the T-0199 lane).
- Precedents: T-0193 OptionDeck (control plus row plus mini-skill), T-0198 StepFlow (same shape, the plan and its review findings).
- Planner lessons: catalog `NOT_FOR_MAX` is 4 and edges are reciprocal (Table already holds four); a new default row needs the feed partition, a frontier seed, the actionEvent pin and a site tier row; re-measure the prompt and selection budgets; persona seedVersion bumps re-pin digests; the docs nav group holds at most 10 tags; the component-preview SAMPLE_TREES needs an entry; run the whole jsdom suite once before hand-back.

## Constraints
- grammar.md is byte-pinned; any grammar line goes through the debate rule. Model-read text (the mini-skill) gets a second voice.
- No native form elements beyond descriptor-documented internal activation buttons; ARIA via ElementInternals; the library ramp; no em dashes.
- Lane: full because size L3 decides before planning (steps.py lane)
- Kim 2026-10-21: step 1 OptionCompare render approved as rendered (light, dark, 400px goldens against mockup Direction A).

## Debate: OptionCompare teaching wording
Kim's fork 15 and 16 answers (T-0199, 2026-10-21, accepted as recommended) authorize the model-read changes; they go through the debate rule (Opus architect, then fable plan-reviewer) before step 3 applies them, with a deliberate prompt-equivalence recapture.

Ask (architect, debate rule): propose the exact text for the four model-read spans step 3 names (`.sdlc/runtime/tasks/0393-option-compare/step-3/handoff.md`): (1) the `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/comparison-table.md` body, teaching OptionCompare when the user picks one of two to four options and keeping Stat plus Table for a facts-only comparison, with the Table boundary stated there (Table holds the four-edge notFor cap); (2) the trip-plan WORKFLOW.md compare sentence(s), where both the Table-with-a-Button and the ProductCard Grid become one OptionCompare; (3) the travel persona's Surface style clause; (4) the shopkeeper Surface style addition for a compare ask, with product-grid kept for browsing. For each give the before text with line numbers, the after text and why; keep each file's register, no em dashes, re-measure the mini-skill and prompt budgets, and list every dependent (triggers, pins, seed digests, seedVersion bumps, baseline keys). Write no file except your result.

Ask (plan-reviewer, debate rule): review the architect's proposed wording in `.sdlc/runtime/tasks/0393-option-compare/architect-L1.md` as the second voice. Are spans A to D clear to a model and consistent with forks 15 and 16, the OptionCompare catalog row and sidecar, and the OptionDeck boundary? Is the deviation (persona surfaceStyle clauses describe the control in plain words because the P6 lint forbids catalog type names there; the changelog line names it) sound against prompt-lint.ts and agent-admin-presets.test.ts? Are the budgets, triggers, pins, digests, seedVersion bumps and baseline keys complete, with no added em dashes? Verdict pass or replan, with any exact wording fixes.
- Debate outcome 2026-10-21: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1-2.md, pass) agree. Spans A to D land as the architect wrote them, with the reviewer's three notes (persona style clauses in plain words with the type name only in the changelog line; the mini-skills.test.ts pin swap; travel tagline "comparison cards" to "a leg compare").

## Outcome

2026-10-21 · lane: full L3 · verdict: skipped (covered by the ticket verifier at step 3, which reran step 1's criteria) · verifier: verifier-L3 (fable) · base: bc76e32bfa0a
- Changed: ui-option-compare (OptionCompare) with its agentic catalog row; comparison-table teaches the pick; travel and shopkeeper adopt it (debated)
- Commits: none
- Check: step-3#1 (red) `grep -qF OptionCompare comparison-table.md && grep -qF OptionCompare node-idioms.md`: pass
- Check: step-3#2 (guard) triggers line byte-identical: pass
- Check: step-3#3 (red) WORKFLOW.md has OptionCompare, no ProductCard, no "Button per row": pass
- Check: step-3#4 (red) travel and shopkeeper name OptionCompare and T-0393: pass
- Check: step-3#5 (red) seedVersion raised over base for both manifests: pass
- Check: step-3#6 (red) travel.ts expects 'OptionCompare' and no 'ProductCard': pass
- Check: step-3#7 `grep -q "^## Debate" ticket handoff` exit 0 and the builder result records one gate_lock jsdom r...: pass
- Check: step-3#8 (guard) `generate-agent-content.mjs --check && generate-agent-assets.mjs --check`: pass
- Check: step-3#9 (guard) vitest agent-admin presets, app, seed-digests, prompt-budget, `site/lib/agent-manifest`, ...: pass
- Check: step-3#10 (guard) vitest `packages/agent-ui/a2ui packages/agent-ui/components/src packages/agent-ui/app/src...: pass
- Check: step-3#11 (guard) vitest `site/lib/sitemap.test.ts site/lib/llms.test.ts site/lib/a2ui-catalog-tiers.test.t...: pass
- Check: step-3#12 (guard) `env -u NODE_OPTIONS npm run check`: pass
- Check: step-3#13 Conductor: debate settled, architect spans and reviewer notes applied exactly, whole jsdom suite ...: pass
- Check: step-3#1 (red) jsdom `controls/option-compare`: pass
- Check: step-3#2 browser packages project `controls/option-compare` (chromium and webkit): pass
- Check: step-3#3 visual `option-compare.visual.browser.test.ts`: pass
- Check: step-3#4 (red) `__baselines__` dir, 400px scroll test name, descriptor parts: pass
- Check: step-3#5 (red) site doc and demo pages wired: pass
- Check: step-3#6 (red) `_page.ts` and `generate-sitemap.mjs` Form composition tags: pass
- Check: step-3#7 (red) registry.gen, dogfood-fleet.gen, capability-registry, llms.txt, sitemap.json: pass
- Check: step-3#8 (red) artboard.ts and artboard.test.ts: pass
- Check: step-3#9 `dogfood-render.browser.test.ts` (site project) and `_page.visual.browser.test.ts`: pass
- Check: step-3#10 (guard) vitest `components/src` + `artboard.test.ts`: pass
- Check: step-3#11 (guard) vitest `packages/agent-ui/a2ui`: pass
- Check: step-3#12 (guard) site/lib five tests, `generate-controls --check`, `codemod-uses --check`, `generate-agent...: pass
- Check: step-3#1 (red) catalog.json OptionCompare row shape: pass
- Check: step-3#2 (red) selection.json intents and the OptionDeck notFor pair: pass
- Check: step-3#3 (red) layers.ts, feed-catalog.ts, a2ui-catalog-tiers.ts: pass
- Check: step-3#4 (red) factories, index.test, catalog.ts, option-compare-action.test.ts: pass
- Check: step-3#5 (red) frontier seed, examples index, import-seeds, allowlist: pass
- Check: step-3#6 (red) component-preview.ts OptionCompare entries: pass
- Check: step-3#7 (red) spec "### 5.2 Agentic (7 default types)" and ui-option-compare: pass
- Check: step-3#8 (red) assets.gen.ts and selection-projection.gen.ts: pass
- Check: step-3#9 (guard) vitest `packages/agent-ui/a2ui`: pass
- Check: step-3#10 (guard) site/lib four tests + `generate-agent-assets --check` + `generate-controls --check`: pass
- Deviation: step 1 verifier skipped: covered by the ticket verifier at step 3, which reran step 1's criteria
- Deviation: step 2 verifier skipped: covered by the ticket verifier at step 3, which reran step 2's criteria
- Deviation: step-3: process deviation: red-checkpoint: missing: attempt 73d4277e4a3d4cb8bee4e59d39284222, handoff sha256 b18ba8dc274e, 5 of 5 (red) criteria without a pre-edit red control: `grep -qF OptionCompare packages/agent-ui/a2ui/src/agent/prompts/min...`; `grep -qF OptionCompare site/agent-content/workflows/trip-plan/WORKF...`; `for p in travel shopkeeper; do grep -qF OptionCompare "site/agent-c...`; `python3 -c "import json,os,subprocess,sys; ps=['site/lib/agent-mani...`; `grep -qF "'OptionCompare'" scripts/e2e-admin/probe/scenarios/travel...`
- Follow-up: decide: site/agent-content/personas/travel/agent.md:7 and :44: note: the... -> notes.md
- Follow-up: decide: scripts/e2e-admin/probe/replays/smoke-travel-compare-legs-haiku.jso... -> notes.md
- Follow-up: decide: /Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0393-s3-v... -> notes.md
