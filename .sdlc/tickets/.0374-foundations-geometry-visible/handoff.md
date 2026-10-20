---
id: T-0374
title: "Visible geometry changes from the skill model: glyph, field label, tiers, density heights, curvature presets"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L4             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0373]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The visible parts of the skill's model reach the library, each behind Kim's mockup approval.

## Intent
- Do: glyph n+6; fieldLabel 10 and smallControl; the new content and brand tier rows; five densities that change control height; curvature presets in place of radius = margin; label-edge radius compensation on buttons. One step per change, each with a screenshot against an approved mockup.
- Non-goals: re-vendoring or renames (T-0372, T-0373).
- Done when: each step's screenshot is approved by Kim and the gates above stay green.
- Kim ruled 2026-10-19: density changes control height (tight 3n to loose 5n); 24/32/40 holds at regular density, and the no-one-off-heights rule is restated as "at regular density".
- Kim ruled 2026-10-19: fractional px, the model's floats ship; the T-0373 emit-time whole-px gate is relaxed to finite and monotonic, with a sub-pixel border check.
- Kim ruled 2026-10-19: balanced (50%) is the default radius preset; pill stays opt-in.

## Context
Source of truth: the skill at `~/.claude/skills/mathematical-design-system` (`scripts/lib/scale.mjs`, `scripts/lib/curvature.mjs`, `references/geometry-contract.md`, checks `scripts/check-geometry.mjs` and `scripts/check-curvature.mjs`). The repo's vendored resolver is `packages/agent-ui/shared/src/tokens/scale.mjs` (an older snapshot), emitted by `node scripts/generate-foundations.mjs` into `foundations.gen.css` and `foundations-bridge.gen.css` (ADR-0245, frozen; decisions now live in tickets and `.claude/docs/references/`). Gates: `foundations.test.ts`, the foundations census (`node scripts/foundations-census.mjs --gate`), `sizing-gates.test.ts`, `npm run check`.
Differences found 2026-10-18: content/brand tier rows; control height 3n + 2 margin with 5 densities (regular = 4n); spacing as container factors and role percentages of one margin reference; icon 2n and glyph n+6 in a square 3n wrapper; floats kept until presentation; type roles renamed (sectionKicker, groupKicker), fieldLabel 10, smallControl added; percentage curvature presets with concentric nesting and a pill cap; label-edge radius compensation on buttons; table row 2n + 2.5d.

## Constraints
Kim approves each mockup before its step builds. The three rulings are recorded above.

## Plan review
- plan review: replan: specgate refused the plan (8 duplicate spans): each step repeats `npm run test:visual` and the foundations browser command verbatim from an earlier step. Give each step criteria that name only what that step moves (its own -t filter, test file or token assertion); run the shared whole-suite gates once, in the final gates step.
- plan review: replan: step 3: interfaces: the Do asserts "No page or control sets `data-tier="content"` or `"brand"` today, so no consumer test or visual baseline moves", but five browser suites set `data-tier` content by `setAttribute` (the Do's markup-only grep misses them) and pin the legacy resolver's content row, which stays 10/2/2/1 after the sheet moves to 11/3/2/1; step 3 runs none of them, so they red on merge and step 7 inherits them. Evidence: `packages/agent-ui/components/src/controls/select/select.browser.test.ts:2,678,697` (`resolve('content', 'lg', 'md').h` from `scale.mjs`), `tabs/tabs.browser.test.
- plan review: replan: ep 1: interfaces: the Do leaves ui-glyph's slot at 2n ("the glyph slot is not widened here ... adopted in step 6") while step 6's Do never widens it ("icon and glyph slots keep W"), so after n + 6 the glyph box exceeds its slot at n 4 and 5 (10 in 8, 11 in 10) with no step owning that decision; the dogfood render lint measures the svg at `glyphBox(r)` and plants the n 5 case, and only step 7 runs it under "No new geometry changes here". Evidence: `packages/agent-ui/components/src/controls/glyph/glyph.css:17-20` (`--ui-glyph-slot: var(--md-sys-icon-box)`, inset `(icon-box - glyph-box) / 2`); `s
- plan review: replan: ep 1: acceptance criteria: the (red) `! git grep -q GLYPH_FLOOR -- scripts packages site` forces an edit of `site/pages/dogfood-render.browser.test.ts` (the comment at :461 names `GLYPH_FLOOR`), yet no step 1 criterion runs that file; its glyph rule and n 5 plant move with this step. Evidence: `git grep -l "GLYPH_FLOOR\|glyphBox(" -- scripts packages site` lists `site/pages/dogfood-render.browser.test.ts`; plan lines 29-41 name no site run.
- plan review: replan: ep 4: notes-fix: the E1 monotonic form compares n-only quantities (the legacy M14 `nOnly` rule), excluding `type.title` and any other size-bumped value, otherwise a smaller-size cell at a higher n refuses falsely. Evidence: `packages/agent-ui/shared/src/tokens/scale.mjs:71` (`nOnly(v)`); `node -e` on the model printed `widget lg/lg n 8 title 17` while vendored content md/sm is n 9, body 16, bump 0, title 16.
- plan review: replan: ep 4: scope: the Do names `dogfood-render.browser.test.ts:1380` only, but that file's register resolution reads the legacy density axis (`DENSITIES = new Set(Object.keys(CFG.density))`, `resolve(..., density ?? 'default')`), so every `data-density` cell it measures resolves on the old m after this step; and the stale-doc list omits the files that state `--md-sys-density-d` or "container spacing only / compact, default, spacious": `.claude/docs/references/geometry-sizing-spec.md:58-59,88,129`, `.claude/docs/references/naming.md:133`, `.claude/docs/plan.md:283`, `.claude/skills/component-standar
- plan review: replan: an: goal coverage: the handoff's Done-when ("each step's screenshot is approved by Kim") has no home: each step ends at `test -s .../after.png` and the conductor gate the plan states is the pre-build mockup only; cosmetic, the conductor gate needs stating once. Evidence: handoff line 19; plan lines 10, 227.
- Kim 2026-10-19: approved one more replan past the cap; the glyph slot follows the skill's square 3n wrapper.
- criterion-only amend: plan-reviewer-L1-2.md: step 1: old `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/badge/badge-foundations.browser.test.ts packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts packages/agent-ui/components/src/controls/button/button-geometry.browser.test.ts packages/agent-ui/components/src/controls/button/button-states.browser.test.ts packages/agent-ui/components/src/controls/checkbox/checkbox.browser.test.ts packages/agent-ui/components/src/controls/choice-card/choice-card.browser.test.ts packages/agent-ui/components/src/controls/control-rule.browser.test.ts packages/agent-ui/components/src/controls/game-hud/game-hud.browser.test.ts packages/agent-ui/components/src/controls/glyph/glyph.browser.test.ts packages/agent-ui/components/src/controls/result-card/result-card.browser.test.ts packages/agent-ui/components/src/controls/text-field/text-field-geometry.browser.test.ts packages/agent-ui/components/src/controls/timeline-item/ packages/agent-ui/components/src/controls/select/ packages/agent-ui/components/src/controls/combo-box/ packages/agent-ui/components/src/controls/multi-select/ packages/agent-ui/components/src/controls/form-popover/ packages/agent-ui/components/src/controls/breadcrumb/ packages/agent-ui/components/src/controls/tabs/ packages/agent-ui/components/src/controls/calendar/ packages/agent-ui/components/src/controls/disclosure/ packages/agent-ui/components/src/controls/status-stream/ packages/agent-ui/components/src/controls/swiper/ packages/agent-ui/app/src/controls/nav-rail/` -> new `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/badge/badge-foundations.browser.test.ts packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts packages/agent-ui/components/src/controls/button/button-geometry.browser.test.ts packages/agent-ui/components/src/controls/button/button-states.browser.test.ts packages/agent-ui/components/src/controls/checkbox/checkbox.browser.test.ts packages/agent-ui/components/src/controls/choice-card/choice-card.browser.test.ts packages/agent-ui/components/src/controls/control-rule.browser.test.ts packages/agent-ui/components/src/controls/game-hud/game-hud.browser.test.ts packages/agent-ui/components/src/controls/glyph/glyph.browser.test.ts packages/agent-ui/components/src/controls/result-card/result-card.browser.test.ts packages/agent-ui/components/src/controls/text-field/text-field-geometry.browser.test.ts packages/agent-ui/components/src/controls/timeline-item/ packages/agent-ui/components/src/controls/select/ packages/agent-ui/components/src/controls/combo-box/ packages/agent-ui/components/src/controls/multi-select/ packages/agent-ui/components/src/controls/form-popover/ packages/agent-ui/components/src/controls/breadcrumb/ packages/agent-ui/components/src/controls/tabs/ packages/agent-ui/components/src/controls/calendar/ packages/agent-ui/components/src/controls/disclosure/ packages/agent-ui/components/src/controls/status-stream/ packages/agent-ui/components/src/controls/swiper/ packages/agent-ui/app/src/controls/nav-rail/ packages/agent-ui/components/src/controls/card/containers-foundations.browser.test.ts` exits 0
- Kim 2026-10-19: approved the Proportion lab capture (product md/md regular, screens/step1-mockup-proportion-lab.png) as the mockup for steps 1 to 4, 6 and 7; each step still brings its side-by-side to Kim before merge.
- plan review: replan: step 1: plan defect (verifier step-1/verifier-L3.md): n + 6 glyph-box is read into a 2n box with no cell guard by checkbox (checkbox.css:41, tick overhangs its 12px box by 2px at widget n 6), choice-card (choice-card.css:47,130), timeline-item (timeline-item.css:63,171) and status-stream (status-stream.css:44,308); no step owns them. Give these four a cell rule that keeps the n + 6 mark inside its box on every cell, plus a browser assertion that the mark edges stay inside the box. Step 1's build (commit ae52ce856 on this branch) passed every other criterion and stays: plan the four as the new step 1 work on top of it, not a rebuild of the glyph slot.
- Kim 2026-10-19: approved a 4th planner run past the replan cap for the step 1 plan defect.
- Kim 2026-10-19: approved step 1 side-by-side.png and marks-side-by-side.png for merge (gate b).
- Kim 2026-10-19: approved step 2 side-by-side.png for merge (gate b).
- Kim 2026-10-19: approved step 3 side-by-side.png for merge (gate b).
- Kim 2026-10-19: approved step 4 side-by-side.png for merge (gate b); button radius at spacious and loose left to step 6.
- Kim 2026-10-19: approved step 6 side-by-side.png for merge (gate b); ui-suggestions chips stay h/2 for now (note for later).
- Kim 2026-10-19: approved step 7 side-by-side.png for merge (gate b). Ruling: a label between two adornments pads W + C on both sides (the step text), not W only as the resolver gives; the fix rides step 7 before merge.
- Kim 2026-10-20: step 8 inherited red (4 conversation.browser tests, red before step 1 at 819418d62): verify and ship step 8, the reds filed as 0383-conversation-browser-reds.

## Debate: step 5 wording
Debate rule (Kim 2026-10-16): the Opus architect authors or defends the model-read wording, the fable plan-reviewer challenges it, unresolved points go to Kim. Scope is only the density clause of `packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md:31-36` (the "Size and density are attributes, not styles." bullet); step 4 has merged, so the five densities and height = 3n + 2 x (q - 2)n/4 are live on main.
- Current: "an ancestor `data-density` (`compact` / `default` / `spacious`) moves rhythm only: the icon↔label gaps, never the frame."
- Proposed (planner-L3-4.md step 5): "an ancestor `data-density` (`tight` / `compact` / `regular` / `spacious` / `loose`, `regular` when absent) sets the control height and the spacing around it, never n or the type."
- Questions: is it true against `scripts/lib/foundations-model.mjs` and `foundations.gen.css` on main; does it contradict the same bullet's "data-tier and data-scale set the frame every descendant control derives (height, icon size, padding)"; will a producer model read it as permission to set density per control or to hand-size; is it the shortest wording that stays true.
- Architect: write the final wording (kept or revised) with reasons as `## Recommendation`. Plan-reviewer: challenge that recommendation, not the plan; pass, replan (with the wording you would ship instead), or blocked (a point only Kim can decide).
- Architect recommendation: `.sdlc/runtime/tasks/0374-foundations-geometry-visible/architect-L1.md` (`### Recommendation`). Plan-reviewer: review that file.
- Debate outcome 2026-10-19: plan-reviewer-L1-4.md passed the architect's revision, nothing unresolved for Kim. Recorded wording (step 5 builder uses it): lines 34-36 of genui-dogfood-teaching.md become the four lines in architect-L1.md `### Recommendation` code block; the clause reads "an ancestor `data-density` (`tight` / `compact` / `regular` / `spacious` / `loose`, `regular` when absent) moves that frame's height and the card and panel spacing, never the type or icon size." (Reviewer note: lg/xl/2xl layout gaps also move with density; the clause stays true because it does not say "only".)

## Outcome

2026-10-20 · lane: full L4 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 861956896026
- Changed: glyph n+6 in a 3n slot, field label and smallControl type, content and brand tiers, five densities, radius presets (balanced default, pill opt-in), button label-edge compensation; gates green
- Commits: none
- Check: step-1#1 (red) max-form grep in the four CSS files: pass
- Check: step-1#2 (red) checkbox inset grep: pass
- Check: step-1#3 (red) stale-comment absence: pass
- Check: step-1#4 (red) four test titles: pass
- Check: step-1#5 (guard) model 14 24, slot token, glyph.css, no GLYPH_FLOOR, no stale 2n-2c: pass
- Check: step-1#6 (guard) generate-foundations --check, census gate, foundations.test.ts: pass
- Check: step-1#7 jsdom set: pass
- Check: step-1#8 `-t "the n plus 6 mark stays inside its box on every cell"` on the four browser files, `--project...: pass
- Check: step-1#9 browser folders (checkbox, choice-card, timeline-item, status-stream, timeline, plus glyph added ...: pass
- Check: step-1#10 visual (checkbox, table, form-popover): pass
- Check: step-1#11 (red) screens: pass
- Check: step-1#12 Reverify add-on, whole dogfood render lint: pass
- Check: step-1#13 Reverify add-on, the fix's test bites: pass
- Check: step-2#1 (red) model reads "13 12" at product md/md: pass
- Check: step-2#2 (red) `--md-sys-type-small-control:` in foundations.gen.css: pass
- Check: step-2#3 (red) both docs name the role: pass
- Check: step-2#4 (red) browser test title present: pass
- Check: step-2#5 (guard) generate --check, census gate and foundations.test.ts: pass
- Check: step-2#6 text-field-css.test.ts: pass
- Check: step-2#7 foundations.browser.test.ts `-t "field label 10 and the small control role"`, project packages-rest: pass
- Check: step-2#8 component browser tests, project packages (text-field, textarea, field, otp-field, stat, attachme...: pass
- Check: step-2#9 visual project on the 6 folders: pass
- Check: step-2#10 (red) side-by-side.png non-empty: pass
- Check: step-2#11 Conductor note: whole `site/pages/dogfood-render.browser.test.ts`, project site: pass
- Check: step-3#1 (red) resolve content/brand md/md is "11 15": pass
- Check: step-3#2 (red) foundations.gen.css content input row: pass
- Check: step-3#3 (red) no `tiers: LEGACY_CFG.tiers` and no `10/2/2/1` in geometry.md: pass
- Check: step-3#4 (red) no `tokens/scale.mjs'` import in the nine files: pass
- Check: step-3#5 `'content', 'brand'] as const` in foundations.browser.test.ts: pass
- Check: step-3#6 (guard) generate --check, census --gate, foundations.test.ts: pass
- Check: step-3#7 foundations.browser.test.ts content/brand cells: pass
- Check: step-3#8 seven component browser files, --project packages: pass
- Check: step-3#9 site/gallery.browser.test.ts: pass
- Check: step-3#10 dogfood-render `-t "register walker|root register the cascade"`: pass
- Check: step-3#11 (red) side-by-side.png non-empty: pass
- Check: step-4#1 (red) `test "$(node -e "... resolve('product','md','md','tight').height ...")" = 24`: pass
- Check: step-4#2 (guard) `test "$(node -e "... 'regular').height ...")" = 32`: pass
- Check: step-4#3 (red) `grep -qF "[data-density='loose']" packages/agent-ui/shared/src/tokens/foundations.gen.css`: pass
- Check: step-4#4 (red) `grep -qF "no one-off heights at regular density" AGENTS.md && grep -qF -- "--md-sys-contro...: pass
- Check: step-4#5 (red) `! git grep -qF -- "--md-sys-density-d" -- geometry-sizing-spec.md naming.md && ! git grep ...: pass
- Check: step-4#6 (red) `grep -qE "it\('[^']*sub-pixel border" packages/agent-ui/shared/src/tokens/foundations.brow...: pass
- Check: step-4#7 (red) `grep -qF "it('T-0374 emit-time finite and monotonic" packages/agent-ui/shared/src/tokens/f...: pass
- Check: step-4#8 (guard) `node scripts/generate-foundations.mjs --check && node scripts/foundations-census.mjs --g...: pass
- Check: step-4#9 `npx vitest run --config vitest.browser.config.ts --project packages-rest foundations.browser.tes...: pass
- Check: step-4#10 (red) `grep -qF 'data-density="tight"' site/pages/dogfood-render.browser.test.ts && npx vitest ru...: pass
- Check: step-4#11 (red) `test -s .sdlc/runtime/tasks/0374-foundations-geometry-visible/screens/step-4/side-by-side....: pass
- Check: step-5#1 (red) five-density list in genui-dogfood-teaching.md and no "moves rhythm only": pass
- Check: step-5#2 (red) five-density list in prompt-equivalence.baseline.json: pass
- Check: step-5#3 (guard) `node scripts/generate-agent-assets.mjs --check`: pass
- Check: step-5#4 (guard) the four prompt gates vitest run: pass
- Check: step-6#1 (red) `test "$(node -e "import('./scripts/lib/foundations-model.mjs').then(m=>{const r=m.resolve(...: pass
- Check: step-6#2 (red) `grep -qF "[data-radius='pill']" packages/agent-ui/shared/src/tokens/foundations.gen.css`: pass
- Check: step-6#3 (red) `! grep -qF "2 * var(--md-sys-radius" packages/agent-ui/components/src/controls/button/butt...: pass
- Check: step-6#4 (red) `grep -qF "data-radius" .claude/docs/references/geometry.md && ! grep -qF "radius of every ...: pass
- Check: step-6#5 (red) `grep -qF "it('data-radius presets" packages/agent-ui/shared/src/tokens/foundations.browser...: pass
- Check: step-6#6 (guard) `node scripts/generate-foundations.mjs --check && node scripts/foundations-census.mjs --g...: pass
- Check: step-6#7 `npx vitest run packages/agent-ui/components/src/controls/button packages/agent-ui/components/src...: pass
- Check: step-6#8 `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/share...: pass
- Check: step-6#9 `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components...: pass
- Check: step-6#10 `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browse...: pass
- Check: step-6#11 `npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/components/s...: pass
- Check: step-6#12 (red) `test -s .sdlc/runtime/tasks/0374-foundations-geometry-visible/screens/step-6/side-by-side....: pass
- Check: step-7#1 (red) `test "$(node -e "import('./scripts/lib/foundations-model.mjs').then(m=>console.log(m.resol...: pass
- Check: step-7#2 (red) `grep -qF -- "--md-sys-label-compensation:" packages/agent-ui/shared/src/tokens/foundations...: pass
- Check: step-7#3 (red) `grep -qF "var(--md-sys-label-compensation" ... && grep -qF "var(--md-sys-glyph-slot" ... b...: pass
- Check: step-7#4 (red) `grep -qF -- "--md-sys-label-compensation" .claude/docs/references/tokens.md && ... geometr...: pass
- Check: step-7#5 (red) `grep -qF "it('label compensation" packages/agent-ui/shared/src/tokens/foundations.browser....: pass
- Check: step-7#6 (guard) `node scripts/generate-foundations.mjs --check && node scripts/foundations-census.mjs --g...: pass
- Check: step-7#7 `npx vitest run packages/agent-ui/components/src/controls/button` exits 0: pass
- Check: step-7#8 `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/share...: pass
- Check: step-7#9 `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components...: pass
- Check: step-7#10 `npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/components/s...: pass
- Check: step-7#11 (red) `test -s .sdlc/runtime/tasks/0374-foundations-geometry-visible/screens/step-7/side-by-side....: pass
- Check: step-8#1 (guard) `npm run check`: pass
- Check: step-8#2 (guard) `node scripts/generate-foundations.mjs --check && node scripts/foundations-census.mjs --g...: pass
- Check: step-8#3 `npx vitest run packages/agent-ui/shared packages/agent-ui/components`: pass
- Check: step-8#4 foundations.browser.test.ts (`--project packages-rest`): pass
- Check: step-8#5 dogfood-render.browser.test.ts (`--project site`): pass
- Check: step-8#6 `npm run test:browser:packages:components`: pass
- Check: step-8#8 `npm run test:visual`: pass
- Deviation: step-5: process deviation: red-checkpoint: retrospective: attempt c3e3623567ef4523be14218ada4be46d, handoff sha256 1c1057885fef, 2 of 2 (red) criteria without a pre-edit red control: `grep -qE "tight. / .compact. / .regular. / .spacious. / .loose" pac...`; `grep -qE "tight. / .compact. / .regular. / .spacious. / .loose" pac...`
- Follow-up: note: status-stream.css:54 and status-stream.md:374 still describe the... -> notes.md
- Follow-up: note: the new glyph test pins only the minus symbol in a 16px cell; the... -> notes.md
- Follow-up: note: scripts/lib/foundations-model.mjs:17-22: the LEGACY_PATH comment is... -> notes.md
- Follow-up: note: Kim's mockup-approval gate b on screens/step-3/side-by-side.png... -> notes.md
- Follow-up: note: PARITY_SHA.bridge did not move -> notes.md
- Follow-up: note: .claude/docs/references/foundations-derivation/derive.out.md still... -> notes.md
- Follow-up: decide: site/pages/sizing.ts:25 fix-now: still says data-density compact... -> notes.md
- Follow-up: decide: packages/agent-ui/components/src/controls/button/button.css decide... -> notes.md
- Follow-up: decide: scripts/lib/foundations-model.d.mts:1 note: the header still reads... -> notes.md
- Follow-up: decide: scripts/generate-llms-full.mjs note: it ignores --check and writes... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md:... -> notes.md
- Follow-up: fix-now: packages/agent-ui/components/src/controls/combo-box/combo-box.css:1... -> notes.md
- Follow-up: fix-now: packages/agent-ui/code/src/editor/editor.css:60 comment "the... -> notes.md
- Follow-up: decide: packages/agent-ui/components/src/controls/suggestions/suggestions.c... -> notes.md
- Follow-up: note: packages/agent-ui/shared/src/tokens/foundations-bridge.gen.css:27... -> notes.md
- Follow-up: note: the frames in after.png that look rounder than the card are site... -> notes.md
- Follow-up: fix-now: packages/agent-ui/components/src/controls/screenshots/control-rule.... -> notes.md
- Follow-up: fix-now: .claude/docs/references/tokens.md:86 still states the pre-ruling... -> notes.md
- Follow-up: note: packages/agent-ui/components/src/controls/button/button.css:242-244... -> notes.md
- Follow-up: note: the evidence PNGs 19:03 predate the ruling commits 3d33eee87 and... -> notes.md
- Follow-up: decide: packages/agent-ui/components/src/controls/button/button.css:42... -> notes.md
- Follow-up: note: the 4 conversation.browser reds are filed as ticket 0383... -> notes.md
- Follow-up: note: NODE_OPTIONS in this host points at a missing cmux... -> notes.md
- Follow-up: note: the builder's recaptured PNGs only move button label positions step... -> notes.md
