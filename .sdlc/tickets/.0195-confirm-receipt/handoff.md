---
id: T-0195
title: "Confirm and receipt pattern: promote BookingConfirmation to the default catalog with total, actions and a settled state"
type: feature         # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The read-back, confirm and receipt moment is hand-built in at least four presets and four corpus exemplars. A bound composite cannot misstate a value or re-ask.

## Intent
- Do: promote `BookingConfirmation` (today in `packages/agent-ui/a2ui/src/catalog/personas/concierge/catalog.json`, rows `{label, path}` with the T-0172 `options` key) to the default catalog, or a successor composite, adding: a total row, Back and Confirm actions owned by the composite, a settled receipt state (actions retire, a confirmed mark appears), and line items for orders.
- Evidence: concierge `booking-flow` (`site/pages/agent-admin-libraries.ts` about :211), restaurant `table-reservation` (about :235), shopkeeper `cart-summary` (about :169), travel `trip-plan` close; corpus `receipt-order-summary`, `confirmation-view`, `structured-container-trip-summary`, `frontier-booking-receipt`.
- Adopt in Concierge, Maitre d', Shopkeeper, Travel.
- Done when: the common process below is complete.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.

## Decisions
Design intake, step 1 (component-design, 2026-10-20). Provisional until Kim approves a mockup direction; steps 2 and 3 wait on that approval.

Precedent sweep: `BookingConfirmation` (concierge `factories.ts` header, rows `{label, path, options?}` read from a bindable `data` aggregate, display-only, no actions, no settle); `ResultCard` (`result-card.md`, the settled-outcome control: an outcome pill with glyph and word, buttons are the producer's own children); the `Suggestions` default row (`action` object prop plus `value: {prop:'selected', event:'select'}`, a control-owned press reaching the action pipeline); the four preset idioms (booking-flow settles with a BookingConfirmation over the `/draft` data; table-reservation restates table details and echoes dish interests as text; cart-summary is a Card with a List of items, a bound total Stat and one commit Button; trip-plan closes with a ResultCard whose stats carry nights and total); the corpus records (`receipt-order-summary`: templated `qty x name ... amount` rows then subtotal, tax and total as bound strings; `confirmation-view` and `frontier-booking-receipt`: a settled record carries a success status Badge beside the title and no commit; `structured-container-trip-summary`: label/value rows with a status Badge in the header). The sweep gives no evidence against the planner's provisional answers; each bullet below says what it adds.

- Name: `ConfirmReceipt`, tag `ui-confirm-receipt`, class `UIConfirmReceiptElement` (provisional; Kim settles it at mockup approval, and a rename means a replan of steps 2 and 3). Classification: base `UIElement` (no form value; the settle rides a bindable `status` value slot, not FACE), tier `pattern` (the ResultCard size-class), A2UI-emittable as a default-catalog row marked agentic (`layers.ts`, spec section 6 W3) with `selection.json` intents and `notFor` (BookingConfirmation, ResultCard, Card, DescriptionList).
- Shape: one leaf control, not a persona-style multi-element factory (SPEC-R3 AC1, the ResultCard precedent). Props: `title` (bindable string), `rows` (literal `{label, path, options?}[]`, the BookingConfirmation law including the T-0172 `options` key), `data` (bindable aggregate object; every displayed value is `data[path]`, so a row value is never a producer literal), `items` and `total` (next bullet), `status` (bindable `pending | confirmed`), `confirmAction` and `backAction` (action objects), `inline` (the ADR-0223 opt-out). Anatomy parts: `header`, `title`, `status`/`mark`, `rows`, `row`, `label`, `value`, `items`, `item`, `total`, `ref`, `actions`, `back`, `confirm`.
- Actions: Back and Confirm are the control's own descriptor-documented internal `<button data-part="back|confirm">` activations (the AGENTS.md sanctioned class), laid out in an `actions` row OUTSIDE the record card surface, so no Button sits inside a card container (Kim 2026-10-14). The Suggestions precedent carries a press to the action pipeline: `confirmAction` and the optional `backAction` are action-object props (Back renders only when `backAction` is set), the catalog row declares `value: {prop:'status', event:'change'}`, and events stay in the closed set (`change`, `action`). The actions are `lg` at widget / md (28px, ADR-0245 Amendment 2).
- Settled state: a bindable two-way `status` enum (`pending | confirmed`). A Confirm press emits `confirmAction` and writes `confirmed` back through the value slot, so the data model records the settle and a re-render on the same data cannot re-ask. Once `confirmed`: the `actions` row is removed from the DOM (not hidden), a Confirmed mark (check glyph plus the word, success tint, never color alone; the ResultCard outcome-pill look) takes the header's status slot, and an optional bound reference line (`refPath`) appears. The corpus settles (`confirmation-view`, `frontier-booking-receipt`: success Badge, no commit) agree with this.
- Line items and total: `items` is a bindable array of `{label, quantity?, amount}` read from the data model (the `receipt-order-summary` templated rows: `qty x name` start, amount end, tabular numerals); optional subtotal-style rows reuse `rows`; `total` is one `{label, path}` row drawn below a strong rule in title weight. The control never computes arithmetic: every amount and the total are bound strings, so it cannot misstate a sum it does not own (`receipt-order-summary` binds subtotal, tax and total the same way). A booking with no line items omits the `items` part (the empty-box law).
- BookingConfirmation: stays declared in the concierge fragment for this ticket; step 3 moves booking-flow's settle to ConfirmReceipt. Its retirement (about 50 files pin it, mostly recorded probe replays and scenarios) is a follow-up ticket after adoption, per spec section 6 W3.
- Mockup: `.sdlc/runtime/tasks/0195-confirm-receipt/mockup/confirm-receipt.html` shows three directions, each with the read-back and settled states for a booking (Concierge rows) and an order (Shopkeeper line items, subtotals and total), in light and dark and a 400px column, at `data-tier="widget" data-scale="md"` with the repo tokens inlined. A: record card with the action bar outside it (recommended; reads the same for a booking and an order and stays closest to BookingConfirmation and ResultCard). B: flat ledger with no card. C: total-led card with the action bar outside. Awaiting Kim's pick.

## Plan review
- Kim 2026-10-20: approved mockup Direction A (record card, action bar outside) and the name ConfirmReceipt (ui-confirm-receipt). This settles the planner's unresolved assumption; steps 2 and 3 may build.
- plan review: replan: step 2: interfaces: the Do names only `site/pages/confirm-receipt-doc.ts` and `-demo.ts` "so site-coverage.test.ts stays green", but that gate requires the MPA shells `site/confirm-receipt-doc.html` and `site/confirm-receipt-demo.html` (tier `pattern` needs doc plus demo), and a new control's other site dependents are unnamed: nav rows in `site/main.ts` and `site/pages/_page.ts`, a `TIER_OF` row in `site/lib/a2ui-catalog-tiers.ts`, `node scripts/generate-sitemap.mjs`, `node scripts/generate-llms-full.mjs` plus the `site/public/llms.txt` index line. No step runs the gates that pin them (`site/lib/sitemap.test.ts`, `site/lib/llms.test.ts`, `site/lib/a2ui-catalog-tiers.test.ts`, `site/lib/capability-registry.test.ts`), and step 3's `npm run check` is tsc only, so the red lands in CI after the lane merges. Evidence: `packages/agent-ui/components/src/descriptor/site-coverage.test.ts:101-103` (`${name}-${type}.html`) and `:166` (walks `site/*.html`); `site/lib/sitemap.test.ts:4-9` (G1 byte-identical regeneration from descriptors, G2 every `{name}-doc.html` resolves); `site/lib/llms.test.ts:6-11` (G1 regen, G2 every `site/*.html` linked from llms.txt); `site/lib/a2ui-catalog-tiers.test.ts:17` ("every browsable name is present in TIER_OF"); `site/main.ts:1194` and `site/pages/_page.ts:587` carry the ResultCard rows; precedent `git show --stat bfaaa9f86` (ResultCard landing) touched `site/result-card-doc.html`, `site/result-card-demo.html`, `site/lib/a2ui-catalog-tiers.ts`, `site/sitemap.json`, `site/public/sitemap.json`, `site/public/llms.txt`, `site/public/llms-full.txt`; `package.json:12-14` (`check` = tsc runs only). Replay on main: `env -u NODE_OPTIONS npx vitest run site/lib/sitemap.test.ts site/lib/llms.test.ts site/lib/a2ui-catalog-tiers.test.ts site/lib/capability-registry.test.ts` → 4 files, 51 tests passed, exit 0, so it is a valid guard for the step that adds the control.
- plan review: replan: step 2: builder readiness: a new default-catalog type must appear in an `src/examples` seed or be listed in `CATALOG_COVERAGE_EXEMPT`; the Do names neither, and step 3 declares the corpus exemplars untouched, so step 3's `npx vitest run packages/agent-ui/a2ui` gate reds and leaves the builder to choose seed or exemption (and which seed file). Evidence: `packages/agent-ui/a2ui/src/examples/examples.test.ts:440-441` ("catalog component(s) with NO example anywhere — add a seed", over `allSeeds` plus the exemplar shard); `packages/agent-ui/a2ui/src/examples/every-catalog-coverage.test.ts:105-106` ("catalog type(s) with no seed, add one or exempt it", source `seedsForCatalog` only, `:8-9`); precedent `bfaaa9f86` added `packages/agent-ui/a2ui/src/examples/catalog-frontier.ts` rows for ResultCard.
- plan review: replan: step 2: notes-fix: the catalog row carries `confirmAction` and the optional `backAction` as action-object props and `value: {prop:'status', event:'change'}`, per the handoff Decisions `- Actions:` and `- Settled state:` bullets, not a single `action` prop. Evidence: planner-L2.md step 2 Catalog bullet ("there is an `action` object prop, following the Suggestions row") against `.sdlc/tickets/0195-confirm-receipt/handoff.md` Decisions `- Actions:` ("`confirmAction` and the optional `backAction` are action-object props", "the catalog row declares `value: {prop:'status', event:'change'}`"); the Do's first line defers to Decisions.
- plan review: replan: plan: assumptions: the three `unresolved:` items (mockup direction, type name, settled-state mechanism) are decided in the handoff `## Plan review` (Kim 2026-10-20: Direction A, ConfirmReceipt; the Decisions section says it is provisional only until that approval), but the plan still carries the labels and the chain tooling halts on them. Evidence: `python3 .../steps.py review .sdlc/runtime/tasks/0195-confirm-receipt` → `stop`, `reason: planner-L2.md lists an unresolved assumption: "unresolved: Kim's approval of one mockup direction ..."`. The replan should drop the labels and cite the Plan review line.
- plan review: replan: step 2: notes-fix: the spec heading `### 5.2 Agentic (3 default types)` takes the new count when the row is added. Evidence: `.claude/docs/spec/a2ui-catalog-architecture.spec.md:185-187`. Cosmetic.
- plan review: replan: plan: acceptance criteria: on this host `NODE_OPTIONS` names a missing preload, so every node, npx and npm criterion fails until it is cleared; the plan records it under Assumptions but no step Notes carries the `env -u NODE_OPTIONS` prefix the builder and verifier need. Evidence: `echo $NODE_OPTIONS` → `--require=/var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/cmux-claude-node-options/restore-node-options.cjs ...`; `ls` of that file → "No such file or directory". Guards replayed with the prefix: step 2 vitest guard 12 files / 760 tests exit 0, `generate-agent-assets.mjs --check` exit 0, step 3 site guard 94 tests exit 0, `generate-agent-content.mjs --check` exit 0, `npm run check` exit 0; every (red) criterion of steps 2 and 3 exits 1 on main.
- Conductor 2026-10-20: step 1 is built and committed (bd97fbbcd); the replan keeps it as done and replans steps 2 and 3 only. Kim's Direction A and ConfirmReceipt approval settles the unresolved assumptions; drop those labels.
- Kim 2026-10-20: step 2's only block (the 'Data & reporting' nav group would hold 11 tags, over the ceiling of 10) is settled by moving ui-confirm-receipt to 'Form composition'. The conductor applied it in _page.ts and generate-sitemap.mjs, regenerated the sitemap and checked the narrow nav golden. This is not a replan.
- Kim 2026-10-20: approved the step 2 render (gate b). Focus after Confirm moves to the Confirmed mark (programmatic focus), fixed in step 3. The record order stays as built: items, rows, total, ref.
- Kim 2026-10-20: step 3's block is settled. The total goes on the wire as `totalLabel` + `totalPath` (a literal `{label, path}` is swallowed as a binding), and step 3 criterion 1 was amended to match. Card does not take the ConfirmReceipt back-link (games domain cap). The builder resumes; this is not a replan.
- Kim 2026-10-20: amend grammar.md so the confirm step and the closing-turn settle teach ConfirmReceipt instead of DescriptionList + Button + Badge. The wording goes through the debate rule (Opus architect, then fable plan-reviewer) and lands in step 4 with a deliberate prompt-equivalence recapture. This ruling authorizes the byte-pinned grammar edit.

## Debate: grammar.md confirm and settle wording
Ask (architect): propose the exact replacement text for `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` lines 76-78, 82-85 and 97-103 (the confirm-step receipt taught as one DescriptionList inside an ordinary ask with one commit Button, and the closing-turn settle taught as stripping Back/Confirm and adding a Badge), so that grammar teaches ConfirmReceipt for the read-back and its bound `status` for the settle, consistent with `prompts/mini-skills/confirm-receipt.md`. Also state that ConfirmReceipt is FEED_EXCLUDED and lives on a canvas surface, never a feed ask. Fix the mini-skill line 6 ambiguity: totalLabel is the shown label, not a data key. Keep the edit minimal: no new rule beyond what the control needs, the same register and terms as the surrounding grammar, no em dashes. Name every test that pins those grammar bytes (system-prompt-grammar.test.ts, prompt-equivalence baseline, budgets) and the expected budget delta. Output: the before and after text for each span, plus the dependents.

Ask (plan-reviewer, debate rule): review the architect's proposed wording in `.sdlc/runtime/tasks/0195-confirm-receipt/architect-L1.md` as the second voice. Is the scoped split (a booking or order uses ConfirmReceipt on its own surface; any other confirm keeps the in-ask DescriptionList) clear to a model? Is each after-span unambiguous and in the grammar's register, with no em dashes? Does the settle arm via `updateDataModel` contradict the output rules or any other grammar line? Are the dependents listed complete? Verdict pass or replan, with any exact wording fixes.
- Debate outcome 2026-10-20: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1-3.md, pass) agree. The architect's spans land in step 4 with the reviewer's replacement for Span B lines 2-3 and its pin.

## Outcome

2026-10-20 · lane: full L3 · verdict: skipped (design intake and mockup only (no code), Kim approved Direction A and the step 2 render (gate b)) · verifier: verifier-L3 (fable) · base: 93c14adb1861
- Changed: ui-confirm-receipt and its ConfirmReceipt catalog row (totalLabel/totalPath, bound status), taught in a mini-skill and grammar.md (debated), adopted by Concierge, Maitre d', Shopkeeper and Travel
- Commits: 6f698e3 T-0195: debate rule settled for the grammar.md wording; d181d4b T-0195: architect wording for grammar.md (debate rule); a5cec2a T-0195: Kim rules grammar.md reconcile via the debate rule
- Check: step-2#1 (red) `env -u NODE_OPTIONS npx vitest run packages/agent-ui/components/src/controls/confirm-recei...: pass
- Check: step-2#2 `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages packages...: pass
- Check: step-2#3 `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project visual packages/a...: pass
- Check: step-2#4 (red) `test -d packages/agent-ui/components/src/controls/confirm-receipt/__baselines__`: pass
- Check: step-2#5 (red) `for f in site/confirm-receipt-doc.html site/confirm-receipt-demo.html site/pages/confirm-r...: pass
- Check: step-2#6 (red) `grep -qF ui-confirm-receipt site/main.ts && ... && grep -qF ui-confirm-receipt site/lib/co...: pass
- Check: step-2#7 (red) `grep -qF ui-confirm-receipt packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts && grep ...: pass
- Check: step-2#8 (guard) `env -u NODE_OPTIONS npx vitest run packages/agent-ui/components/src` exits 0: pass
- Check: step-2#9 (guard) `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2...: pass
- Check: step-2#10 (guard) `env -u NODE_OPTIONS npx vitest run site/lib/sitemap.test.ts site/lib/llms.test.ts site/l...: pass
- Check: step-2#11 (guard) `env -u NODE_OPTIONS node scripts/generate-controls.mjs --check && env -u NODE_OPTIONS no...: pass
- Check: step-2#12 `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project visual site/pages...: pass
- Check: step-3#1 (red) catalog row python check (as amended: totalLabel and totalPath, value status/change, confir...: pass
- Check: step-3#2 (red) selection.json ConfirmReceipt entry with intents and notFor: pass
- Check: step-3#3 (red) `grep -qF "ConfirmReceipt: agentic" layers.ts`: pass
- Check: step-3#4 (red) feed-catalog OUT entry and tiers COMPOUND: pass
- Check: step-3#5 (red) seed in catalog-frontier.ts, allowlist entry, import-seeds row: pass
- Check: step-3#6 (red) mini-skill exists and names ConfirmReceipt; factories.test.ts and admit.test.ts name it: pass
- Check: step-3#7 (red) specs name ConfirmReceipt and ui-confirm-receipt: pass
- Check: step-3#8 (guard) `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui` exits 0: pass
- Check: step-3#9 (guard) the nine site lib and pages files exit 0: pass
- Check: step-3#10 (guard) `env -u NODE_OPTIONS node scripts/generate-agent-assets.mjs --check` exits 0: pass
- Check: step-4#1 (red) `for f in ...booking-flow/WORKFLOW.md ...table-reservation/WORKFLOW.md ...cart-summary/SKIL...: pass
- Check: step-4#2 (red) `! grep -qF BookingConfirmation site/agent-content/workflows/booking-flow/WORKFLOW.md`: pass
- Check: step-4#3 (red) `python3 -c "...seedVersion <= base seedVersion..."`: pass
- Check: step-4#4 (red) `grep -qF ConfirmReceipt .../concierge/checks.ts && grep -qF ConfirmReceipt .../concierge/c...: pass
- Check: step-4#5 (guard) `env -u NODE_OPTIONS node scripts/generate-agent-content.mjs --check` exits 0: pass
- Check: step-4#6 (guard) `env -u NODE_OPTIONS npx vitest run --project site site/pages/agent-admin-presets.test.ts...: pass
- Check: step-4#7 (guard) `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui packages/agent-ui/components/s...: pass
- Check: step-4#8 (guard) `env -u NODE_OPTIONS npx vitest run site/lib/sitemap.test.ts site/lib/llms.test.ts site/l...: pass
- Check: step-4#9 `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project site site/pages/d...: pass
- Check: step-4#10 (guard) `env -u NODE_OPTIONS npm run check` exits 0: pass
- Deviation: step 1 verifier skipped: design intake and mockup only (no code), Kim approved Direction A and the step 2 render (gate b)
- Follow-up: note: packages/agent-ui/a2ui/tools/registry/generate.test.ts is green at... -> notes.md
- Follow-up: decide: .claude/docs/spec/genui-surface.spec.md:5 and :794... -> notes.md
- Follow-up: decide: packages/agent-ui/components/src/controls/confirm-receipt/confirm-r... -> notes.md
- Follow-up: decide: confirm-receipt.ts:226 fixes the record order at items, rows... -> notes.md
- Follow-up: note: site/pages/baselines/_page.visual.browser.test.ts/docs-chrome-narro... -> notes.md
- Follow-up: decide: site/lib/component-preview.ts:377 fix-now: the comment says rows... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/prompts/mini-skills/confirm-receip... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/prompts/mini-skills/confirm-receip... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/default/selection.json:1222-1236... -> notes.md
- Follow-up: decide: .claude/docs/spec/a2ui-catalog.spec.md:263 note: "the games... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/default/selection.json:807 note... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts:149... -> notes.md
- Follow-up: decide: site/agent-content/workflows/booking-flow/WORKFLOW.md:12 settles... -> T-0385
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:364... -> notes.md
- Follow-up: note: em dashes kept in edited lines, all in pre-existing text... -> notes.md
- Follow-up: note: site/agent-content/skills/cart-summary/SKILL.md:12 "on the same... -> notes.md
