---
id: T-0198
title: "Step flow pattern: step n of m, Back and Next, shared /draft data"
type: feature         # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: [T-0197]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
The concierge `booking-flow` playbook spends about 2,000 characters of prose describing one wizard pattern (five scenes, Back on every scene, draft under `/draft/*`); the model re-derives it each time.

## Intent
- Do: a composite that holds scene children with a step indicator (n of m, labels), Back and Next owned by the composite, a shared draft data prefix, validation gating Next, and a final step that hands off to the Confirm and receipt pattern (T-0195). BookingForm may embed it.
- Evidence: concierge `booking-flow` (`agent-admin-libraries.ts` about :211), corpus `backable-wizard`, `pattern-wizard` (Tabs misused as steps), `plan-and-execute-plan`.
- Done when: the common process below is complete.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.
- Lane: full because size L3 decides before planning (steps.py lane)

## Decisions
Design intake, step 1 (component-design, 2026-10-21). Provisional until Kim approves a mockup direction; steps 2 to 4 wait on that approval.

Job: one composite that walks a producer's scenes one at a time on the client (step n of m, Back and Next, validation before Next), keeps every scene's answers in one shared `/draft/*` prefix, and hands the last scene to a commit, so the model stops re-deriving a five-scene wizard from prose each turn.

Precedent sweep:
- `ui-tabs`: ChildList panels with a bindable `selected`; FEED-excluded for "hides half the ask" (`agent/feed-catalog.ts:193`). StepFlow hides more than half (all but one scene), so it inherits the OUT ruling. The corpus `pattern-wizard` (`examples/patterns.ts:120`) misuses Tabs as steps (a bindable `Tabs.selected` plus a FormProvider), which is the shape StepFlow replaces: Tabs lets the user skip ahead and has no validation gate.
- `ui-result-card`: draws its own parts beside producer children and recounts them with a childList `MutationObserver` (`result-card.ts:101`). StepFlow reuses that observer to recount scenes.
- `ui-confirm-receipt`: action-object props (`confirmAction`, `backAction`) reaching the action pipeline with `actionEvent: 'action'`, a bindable `data` aggregate, the actions row outside the card surface, `lg` actions at widget / md (28px), focus moved to the Confirmed mark after the settle. StepFlow reuses the action-object prop, the aggregate, the actions row and the focus move.
- `ui-form-provider`: `submit()` refuses when invalid and calls `reportValidity()` on the first invalid member (`form-provider.ts:83-95`). StepFlow's Next gate is the same law scoped to the active scene's descendants.
- Concierge `booking-flow` (`site/agent-content/workflows/booking-flow/WORKFLOW.md`, 3,372 bytes): five scenes on one surface (Calendar range, AmountPicker guests with its own `actionName`, RadioGroup room, Checkbox extras, a pre-filled BookingForm), a Back Button on every scene after the first, the `/draft/*` prefix, a ConfirmReceipt settle. Each scene today costs an agent turn per Next and per Back.
- grammar.md lines 83-86 (the confirm step: a ConfirmReceipt may take "a wizard's last scene" on the still-open ask) and 242-256 (`Backable multi-step, worked`: ask declared once, root once, a `scene` container resent per step, nav Buttons in a CardFooter, the `/draft/*` prefix). Both teach a server-driven wizard that StepFlow makes client-side.
- Corpus `backable-wizard` (real-renderer Back round-trip, `backable-wizard.test.ts`), `pattern-wizard` (Tabs as steps), `plan-and-execute-plan` (a Timeline of plan steps; a progress record, not a wizard, so it is a confusable sibling for `notFor`, not a precedent).
- The renderer appends and reconciles ChildList children in the host (`renderer/tree.ts:311`, `#reconcileChildren` at 478-506, which skips a relocated survivor as an anchor). So scenes must stay direct host children: relocating them would break resend positioning.
- The forwarded action channel passes the event detail's `context` through unchanged when it is a plain object (`renderer/renderer.ts:714-731`), so a `draft` aggregate folded into the context reaches the agent as-is.
- The feed check (`agent/produce.ts:1090-1100`) tests FEED_SURFACE_TYPE_SET only on the declared ask surface, so an OUT type is legal on a canvas surface the meta-line does not name as `ask`.

Classification: base `UIElement` (not form-associated; its fields are their own FACE members, the ConfirmReceipt precedent); size-class `pattern`; A2UI-emittable, an agentic default-catalog row with `selection.json` intents and `notFor` (Tabs, Timeline, Progress, FormProvider).

Fork sheet (each row is this step's recommendation, numbered as in the Forks list below):
- Tag and names: `ui-step-flow`, `UIStepFlowElement`, type `StepFlow`, folder `packages/agent-ui/components/src/controls/step-flow/` (fork 1). "Stepper" is avoided: it collides with the AmountPicker stepper part and the BookingForm `stepper` field kind.
- Anatomy: producer scenes as direct children (one element per scene); control-owned parts `header` (holding `indicator`, `position`, `label`, `bar`, `segment`) and `actions` (holding `back`, `next`, `finish`), placed with CSS `order` on a host grid, never by moving children (fork 2). Inactive scenes carry `hidden` and `inert`.
- Props: `steps` (literal string array, labels by index, "Step n" fallback), `step` (bindable 1-based number, clamped, value mark `{prop: 'step', event: 'change'}`), `finishAction` (`{action, context?}` object), `finishLabel` (string, default "Continue"), `draft` (bindable object aggregate), `inline` (the ADR-0223 opt-out) (forks 3, 6, 7).
- Events: `change` on every Back and Next move, `action` on Finish. Both are in the closed set.
- Geometry: actions at `lg` (28px at widget / md); the indicator bar is a hairline track at `--md-sys-c`; no new geometry row.
- Tokens: `--ui-step-flow-*` roles for the bar track and fill (`neutral-outline-variant`, `primary`), the position ink (`neutral-on-surface-variant`), the label ink (`neutral-on-surface`), and the Back and Next fills (the ConfirmReceipt `back` and `confirm` roles). The current segment differs by fill and by the "Step n of m" text, never color alone.
- A11y: the host is `role="group"` labelled by the current label through `internals`; the indicator's current label takes `tabindex="-1"` and receives focus after each move, so a screen reader reads "Step n of m, label" (fork 10). Back and Next are buttons in tab order; Enter in a scene field does not advance.
- Interaction states: no deviation from the four-state standard. Next is never disabled (fork 5).
- Form participation: none on the host. The Next gate walks the active scene's form-associated descendants with `checkValidity()` and calls `reportValidity()` on the first that fails.
- Site surfaces: descriptor `step-flow.md`, the docs page and demo, a gallery specimen, a visual golden, and the default-catalog row; these drag the fleet gates step 2 names.

Mint vs compose: StepFlow is a new catalog type, not a teaching gap. Its behavior (client-side scene paging with a validation gate and no agent turn per step) cannot be expressed by Tabs plus Buttons plus FormProvider without a turn per move or a skippable tab strip, which the `pattern-wizard` record shows.

Mockup: `.sdlc/tickets/0198-step-flow/mockup/step-flow.html` draws directions A (labeled rail) and B (compact "Step n of m" plus a segmented bar), each at widget / md with scene 2 (guests), scene 4 (extras), Next refused on an invalid field, and the last scene holding a BookingForm with Back only, in light, dark and the 400px column.

### Forks for Kim
Each fork has a firm recommendation. Kim's answer goes on the `Answer:` line.
1. Name and class: type `StepFlow`, tag `ui-step-flow`, class `UIStepFlowElement`, base `UIElement` (not form-associated), tier `pattern`, an agentic default-catalog row. Recommendation: as named. Answer: Kim 2026-10-21: accepted as recommended.
2. Scenes: `children: "ChildList"`, one direct element child per scene, kept in the host (the renderer reconciles them there); the control's `header` and `actions` parts are placed with CSS `order`; inactive scenes stay mounted with `hidden` and `inert` so values and validity survive Back; a childList `MutationObserver` recounts scenes. Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
3. Labels and position: `steps` is a literal string array aligned by index ("Step n" when unlabeled); `step` is a bindable 1-based number clamped to 1..m with value mark `{prop: 'step', event: 'change'}`. Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
4. Back and Next run on the client with no agent turn per step, as the control's own `<button data-part="back">` and `<button data-part="next">`, in an `actions` row outside any card, `lg` (28px at widget / md); Back absent on step 1; each move fires `change`. Recommendation: client-side. Answer: Kim 2026-10-21: accepted as recommended.
5. Validation gating Next: Next runs `checkValidity()` over the active scene's form-associated descendants and, on a failure, `reportValidity()` on the first and stays; Next is never disabled. Recommendation: gate on press, never disable. Answer: Kim 2026-10-21: accepted as recommended.
6. Finish: with `finishAction` set, the last scene shows a forward button labeled `finishLabel` (default "Continue") that emits `action` with `{action, context: {...context, draft}}`; with it unset, the last scene's own composite commits (a BookingForm and its submit Button) and StepFlow shows Back only. Recommendation: both modes. Answer: Kim 2026-10-21: accepted as recommended.
7. Draft prefix: a taught convention, not a prop; every scene field binds under `/draft/<key>`, and `draft` only carries the aggregate on finish. Recommendation: convention. Answer: Kim 2026-10-21: accepted as recommended.
8. Feed partition: OUT, because it hides all but one scene behind navigation (the Tabs reasoning) and its commit is a control-owned action (the ConfirmReceipt reason); a StepFlow lives on a canvas surface the meta-line does not name as `ask`. Recommendation: OUT. Answer: Kim 2026-10-21: accepted as recommended.
9. Step indicator: A, a labeled rail with a numbered mark per step; B, compact "Step 2 of 5" plus the current label over a segmented bar. Recommendation: B, because five labels do not fit the 400px column on one line. Answer: Kim 2026-10-21: B, the compact bar.
10. Focus: after Back or Next, focus moves to the indicator's current label (`tabindex="-1"`), announcing "Step n of m, label". Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
11. Booking-flow adoption: one StepFlow carries scenes 1 to 4 plus the pre-filled BookingForm as the last scene, on one fresh canvas surface in one payload; the scene-2 AmountPicker drops its own `actionName` in-flow; the ConfirmReceipt settle is unchanged; "BookingForm may embed it" reads as "a StepFlow scene may be a BookingForm". Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
12. grammar.md: rewrite the `Backable multi-step, worked` clause (lines 242-256) and the confirm-step wizard mention (lines 84-86) to teach StepFlow, through the debate rule (`.sdlc/notes/notes.md:99`) before step 4 builds, with a deliberate prompt-equivalence recapture. Recommendation: yes. Answer: Kim 2026-10-21: accepted as recommended.
13. Corpus: `backable-wizard`, `pattern-wizard` and `plan-and-execute-plan` stay as they are; step 3 adds one coverage seed; re-curating them for StepFlow is a follow-up ticket. Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.

## Plan review
- Kim 2026-10-21: step 1 mockup approved in Direction B (compact "Step n of m" bar). All 13 forks accepted as recommended (fork 9 answered B). One change to the drawing: on a last scene with no finishAction, Back sits on the same actions row as the BookingForm's commit Button (Back leading, the commit trailing), not alone below the form; steps 2 and 4 must deliver that row.
- plan review: replan: fold Kim's 2026-10-21 answers in (Direction B; all 13 forks as recommended) so no unresolved assumption remains, and add the one drawing change: on a last scene with no finishAction, Back shares one actions row with the BookingForm's commit Button (Back leading, commit trailing). Step 1 is done (mockup and forks in this handoff); keep it as written. Change steps 2 to 4 only where this row needs it.

## Debate: grammar.md StepFlow wording
Kim's fork 12 answer (2026-10-21, accepted as recommended) authorizes the byte-pinned grammar.md edit through the debate rule (Opus architect, then fable plan-reviewer), landing in step 4 with a deliberate prompt-equivalence recapture.

Ask (architect, debate rule): propose the exact replacement text for each grammar.md span that teaches the backable wizard so it teaches one StepFlow instead: lines 58-62 (the flow-end freeze paragraph and its pointer to the worked backable case), lines 84-86 (the confirm-step wizard mention) and lines 242-256 (the `Backable multi-step, worked` clause). Fit the forks as answered: StepFlow is OUT of the feed and lives on its own canvas surface, Back and Next run on the client with no agent turn, Next gates on the active scene's validity, fields bind under `/draft/<key>`, the last scene is a BookingForm (or `finishAction` set), and the ConfirmReceipt settle is unchanged. For each span give the before text with line numbers, the after text, and why. Keep the grammar's register, no em dashes, measure the byte delta against the prompt budget, and list every dependent (tests, pins, mini-skills, booking-flow WORKFLOW.md, corpus) the change touches. Write no file except your result.

Ask (plan-reviewer, debate rule): review the architect's proposed wording in `.sdlc/runtime/tasks/0198-step-flow/architect-L1.md` as the second voice. Is each after-span unambiguous to a model and in the grammar's register, with no added em dashes? Does span A's kept general scope (one surface across a flow, the Lexicographer case) still read right once span C stops teaching turn-driven scene swaps? Does span C teach StepFlow consistently with the answered forks (OUT of the feed, client Back and Next, /draft binding, both finish modes) and with span B's ConfirmReceipt hand-off? Are the dependents complete and the byte delta right? Verdict pass or replan, with any exact wording fixes.
- Debate outcome 2026-10-21: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1-2.md, pass) agree. Spans A, B, C and D land in step 4 as the architect wrote them, plus the reviewer's span E (grammar.md:66 "multi-step ask flow" -> "multi-step flow", with its pin at system-prompt-grammar.test.ts:55), with a deliberate prompt-equivalence recapture.

## Outcome

2026-10-21 · lane: full L3 · verdict: skipped (design intake and mockup whose gate is Kim's approval (Direction B, 2026-10-21)) · verifier: verifier-L2 (sonnet) · base: 092d60e250a2
- Changed: ui-step-flow (StepFlow) with client Back and Next and validity-gated Next, its catalog row and mini-skill; concierge booking-flow adopts it; grammar.md teaches it (debated)
- Commits: b921c9f T-0198: StepFlow preview sample tree; mini-skill scopes the BookingForm last scene
- Check: step-4#1 (red) `grep -qF StepFlow .../booking-flow/WORKFLOW.md`: pass
- Check: step-4#2 (red) WORKFLOW.md shrinks by more than 500 bytes vs `$SDLC_BASE_SHA`: pass
- Check: step-4#3 (red) `! grep -qF "Back Button" WORKFLOW.md`: pass
- Check: step-4#4 (red) concierge seedVersion above base and `T-0198` in concierge/agent.md: pass
- Check: step-4#5 (red) `grep -qF StepFlow .../prompts/grammar.md`: pass
- Check: step-4#6 (red) `grep -qF "StepFlow last scene with a BookingForm (T-0198)" hospitality.browser.test.ts`: pass
- Check: step-4#7 hospitality browser test && dogfood-render browser test exits 0: pass
- Check: step-4#8 (guard) `generate-agent-content.mjs --check` exits 0: pass
- Check: step-4#9 (guard) agent-admin presets/app/seed-digests, agent-manifest, agent-content vitest: pass
- Check: step-4#10 (guard) `vitest run packages/agent-ui/a2ui packages/agent-ui/components/src`: pass
- Check: step-4#11 (guard) sitemap, llms, a2ui-catalog-tiers, capability-registry vitest: pass
- Check: step-4#12 (guard) `npm run check` exits 0: pass
- Check: step-4#13 conductor rule 2 (whole jsdom suite): pass
- Check: step-4#14 conductor rebuild note (step-flow.md BookingForm scope): pass
- Check: step-4#1 vitest step-flow jsdom: pass
- Check: step-4#2 browser step-flow (chromium and webkit): pass
- Check: step-4#3 visual step-flow: pass
- Check: step-4#4 baselines dir, two browser test titles, nine descriptor parts: pass
- Check: step-4#5 four site files exist: pass
- Check: step-4#6 ui-step-flow wired in main.ts, _page.ts, frontmatter.ts, component-preview.ts: pass
- Check: step-4#7 dogfood-fleet.gen.ts, capability-registry.json, llms.txt, sitemap.json: pass
- Check: step-4#8 dogfood-render browser && `_page.visual.browser.test.ts`: pass
- Check: step-4#23 #step-2#9, #step-2#10, #step-2#11 guards: pass
- Check: step-4#12 (guard) generate-controls, codemod-uses, generate-agent-assets `--check`, foundations-census and ...: pass
- Check: step-4#1 to #step-3#7 and #step-3#9 (red greps and python checks): pass
- Check: step-4#8 (red) `### 5.2 Agentic (6 default types)` and `ui-step-flow` in the catalog spec: pass
- Check: step-4#27 #step-3#10, #step-3#11, #step-3#12 guards: pass
- Deviation: step 1 verifier skipped: design intake and mockup whose gate is Kim's approval (Direction B, 2026-10-21)
- Deviation: step 2 verifier skipped: covered by the ticket verifiers at step 4 (verifier-L3 then verifier-L2), which reran step 2's criteria
- Deviation: step 3 verifier skipped: covered by the ticket verifiers at step 4, which reran step 3's criteria
- Follow-up: decide: the backable-wizard exemplar corpus/exemplar/v1_0/agent-ui.jsonl is... -> notes.md
