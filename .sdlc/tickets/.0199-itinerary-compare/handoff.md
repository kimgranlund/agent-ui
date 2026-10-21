---
id: T-0199
title: "Itinerary and Option compare patterns for Travel, Curator, Concierge and Shopkeeper"
type: feature         # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: [T-0193]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
Two recurring moments with divergent hand-built shapes.

## Intent
- Do (two composites, one intake; split into two tickets if intake says so):
  1. Itinerary or day plan: day headers, stops with time and status, optional per-day weather or FX slot. Evidence: travel `itinerary-timeline` (Timeline), curator `itinerary-tabs` (Tabs per day, `agent-admin-presets.ts` about :453), concierge itinerary; corpus `frontier-trip-card`, `travel-itinerary`.
  2. Option compare: columns of options by attribute rows, a best highlight, one pick per column (the column is the target, no Button in a table row). Evidence: travel `trip-plan` (Table with a Button per row for 4+ legs, ProductCard Row for 2-3), `mini-skills/comparison-table.md`, shopkeeper `product-grid`; corpus `comparison-pricing-table`, `frontier-card-anatomy-ask`, `frontier-choice-group-rooms`. Check convergence with OptionDeck (T-0193) first.
- Done when: the common process below is complete for each composite built.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.
- Lane: full because size L3 decides before planning (steps.py lane)

## Decisions
Design intake, step 1 (component-design, 2026-10-21), two composites in one intake. Provisional until Kim approves a mockup direction for each; steps 2 and 3 are written against the Itinerary recommendations and wait on that approval.

The split is settled, not a fork: Kim ruled on 2026-10-14 that "T-0199 splits (itinerary to hospitality, compare agentic)" (`.sdlc/notes/notes.md:78`), and `.claude/docs/spec/a2ui-catalog-architecture.spec.md` lists Compare as agentic (line 284) and Itinerary as hospitality (line 300). This ticket builds the Itinerary. After Kim answers, the conductor files the Option compare half as a new ticket that cites the compare forks and answers below.

### Itinerary
Job: one hospitality domain composite that lays a trip or day plan out as days of timed stops, each stop with its status, with an optional short per-day aside (weather or FX), so travel and concierge stop hand-building a Timeline per day and re-deriving the day headers each turn.

Precedent sweep:
- Travel and concierge `itinerary-timeline` (`site/agent-content/skills/itinerary-timeline/SKILL.md`): one Timeline over a `{path:"/stops"}` template, a TimelineItem per stop (label, description, timestamp, status done/active/pending), about six stops a surface, a follow-up Button ("Evening plan") instead of sprawl. It has no day level: a multi-day trip is either one long run or several hand-built Timelines.
- Travel `trip-plan` (`site/agent-content/workflows/trip-plan/WORKFLOW.md`): chosen legs accumulate into one itinerary surface updated in place, then one ConfirmReceipt reads the trip back. The in-place update is the law the Itinerary keeps (one bound `days` path).
- Curator `itinerary-tabs` (`site/agent-content/personas/curator/workflows/itinerary-tabs/WORKFLOW.md`): Tabs, one day per tab, a short list of stops with times. Tabs is FEED-excluded for "hides half the ask" (`packages/agent-ui/a2ui/src/agent/feed-catalog.ts:193`); the same reasoning weighs against a day strip (fork 4).
- Concierge persona (`site/agent-content/personas/concierge/agent.md:63`): "day plans, an itinerary laid out in order"; "Weather for itineraries and FX for international guests come from your integrations, surface the results INSIDE the relevant panel". That sentence is the source of the per-day aside (fork 3).
- `ui-timeline` and `ui-timeline-item`: TimelineItem is a leaf with `status` in `"", pending, active, done, error, warning`, `label`, `description`, `timestamp`, `icon`; each status is a distinct marker SHAPE (hollow ring, ring holding a dot, check disc), never hue alone (`timeline-item.md` Props). The Itinerary reuses these marks unchanged (fork 5).
- BookingForm, the one shipped hospitality domain composite: a factory over existing controls in `packages/agent-ui/a2ui/src/catalog/domains/hospitality/factories.ts`, its row in that folder's `catalog.json`, sidecar `selection.json` (intents plus notFor onto base types), `factories.test.ts`, `hospitality.browser.test.ts` and the `booking-form.visual.browser.test.ts` golden (commit `cfe2b5291`). The Itinerary takes the same home and the same set of files (fork 1).
- Corpus `travel-itinerary` (`packages/agent-ui/a2ui/src/examples/composition-pack-b.ts:183`) and `frontier-trip-card` (`catalog-frontier.ts:65`): both hand-build the shape from base types; they stay as they are (fork 8).
- Sidecar law: intents are 1 to 3 of 1 to 60 characters, notFor 0 to 4 each with a `why` of 1 to 90 characters (`packages/agent-ui/a2ui/src/agent/selection-guidance.ts:48`); domain-to-base edges are exempt from reciprocity (`packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts:17-19`).

Classification: a hospitality domain factory composite (the BookingForm precedent), not a `ui-*` control; it owns all its DOM, composed from `ui-text`, `ui-timeline` and `ui-timeline-item`. No descriptor, no site pages, no new geometry row. Display only: no value, no events, no form participation.

Fork sheet (each row is this step's recommendation, numbered as in the Forks list below):
- Home and shape: type `Itinerary` in `packages/agent-ui/a2ui/src/catalog/domains/hospitality/`, a factory composite (fork 1).
- Props: `title` (bindable string), `days` (bindable array of `{label, aside?, stops: [{time, label, detail?, status?}]}`), `status` taking the TimelineItem enum; no children; emits nothing (fork 2).
- Anatomy: a `title` text, then per day a `day` part holding a `day-header` (the `day-label` plus the optional `aside`) over one `ui-timeline` of `ui-timeline-item` stops (time to `timestamp`, label to `label`, detail to `description`, status to `status`). Days are separated by a hairline.
- Aside: per-day short text drawn at the end of the day header as a quiet pill, never a producer child slot, so the ChildList reconcile limits of `renderer/tree.ts` do not apply (fork 3).
- Days layout: every day stacked (fork 4, direction A).
- Status marks: TimelineItem's own shapes (fork 5).
- A11y: the host is a group named by the title; each day is a section named by its label; stop status is carried by TimelineItem's own marker semantics, not color.
- Tokens: none new beyond the day header and aside inks (`neutral-on-surface`, `neutral-on-surface-variant`, `neutral-container-low`); the timeline keeps its own `--ui-timeline-item-*` roles.
- Sidecar, adoption, corpus and composite moment: forks 6 to 9.

Mint vs compose: a new domain type, because days of timed stops with a per-day aside cannot be expressed by one Timeline (no day level) and several Timelines under hand-built headers is the divergent shape the sweep found; Tabs per day hides the trip.

Mockup: `.sdlc/tickets/0199-itinerary-compare/mockup/itinerary.html` draws direction A (every day stacked) and direction B (a day strip, one day shown), a three-day Lisbon trip with done, active and pending stops, a weather aside on day 2 and an FX aside on day 3, at widget / md in light, dark and the 400px column.

### Option compare
Job: one agentic control that sets two to four options side by side as columns over aligned attribute rows, marks a best option, and lets the user pick one by pressing its whole column, so the travel, comparison and shopkeeper asks stop hand-building a Table with a Button per row or a ProductCard grid.

Precedent sweep:
- `ui-option-deck` (`packages/agent-ui/components/src/controls/option-deck/option-deck.md`): "picking one of a few things to start", the whole card is the choice, `meta` holds at most three unlabeled chips, no shared attribute rows and no best mark. This is the convergence check the ticket asks for: OptionDeck's job (start something) and its cards (no aligned rows) differ, so compare is a new type that reuses OptionDeck's pick contract (bindable `value`, `actionName`, `select` then `action`, a listbox whose option is the whole target, a "Your pick" pill) (fork 10).
- `ui-table`: its sidecar already holds four `notFor` edges, the cap, so the Table boundary is taught in the mini-skill, not a new edge (fork 15). A Table with a Button per row breaks the "no Button in a table row" ruling (Kim 2026-10-14).
- `mini-skills/comparison-table.md` (`packages/agent-ui/a2ui/src/agent/prompts/mini-skills/`): Stat tiles above one Table; its triggers hold compare, comparison, versus, side-by-side and which. It teaches facts-only scanning with no pick; a second module with overlapping triggers would split the router, so it is rewritten rather than joined (fork 15).
- Travel `trip-plan`: a Table with a choose Button per row for 4+ legs, a ProductCard Grid for 2 to 3; both become one OptionCompare (fork 16).
- Shopkeeper `site/agent-content/skills/product-grid/SKILL.md`: browsing stays a ProductCard grid; a compare-then-pick ask moves to OptionCompare (fork 16).
- Corpus `comparison-pricing-table`, `frontier-card-anatomy-ask` (`catalog-frontier.ts:453`) and `frontier-choice-group-rooms` (`catalog-frontier.ts:1071`): pricing tiers, a card-anatomy pick and a ChoiceGroup of rooms, each a pick among a few options with shared attributes.
- Feed partition: OptionDeck is IN because a pick is the canonical ask (`packages/agent-ui/a2ui/src/agent/feed-catalog.ts:122`); OptionCompare carries the same argument (fork 14).

Classification: base `UIElement` (not form-associated, the OptionDeck precedent); size-class `pattern`; A2UI-emittable, an agentic default-catalog row with `selection.json` intents and `notFor` (OptionDeck reciprocal, Table taught in the mini-skill).

Fork sheet (each row is this step's recommendation, numbered as in the Forks list below):
- Names: `OptionCompare`, `ui-option-compare`, `UIOptionCompareElement`, folder `packages/agent-ui/components/src/controls/option-compare/` (fork 11).
- Props: `options`, `rows`, `best`, `value`, `actionName`, `heading`, `inline` (fork 12).
- Anatomy: `heading`, a `scroller` holding a `grid` listbox; a pinned `labels` column; one `option` per column spanning every row through subgrid, holding the `pill` (Best or Your pick), `title`, `subtitle` and one cell per row (fork 13, direction A).
- Events: `select` on pick, then `action` with the picked value when `actionName` is set; both in the closed set.
- Best and picked: Best is a text pill with a star plus a ring; picked is a "Your pick" pill with a check plus a fill and a ring; never color alone.
- A11y: listbox with `role="option"` columns through `internals`, arrow keys move between columns, Enter or Space picks; no Button inside a column.
- Tokens: `--ui-option-compare-*` roles mapped from the OptionDeck roles (option fill, label ink, best ring, pill, selected fill and ring).
- Geometry: no new row; the fourth option at 400px scrolls inside the control with the label column sticky.

Mockup: `.sdlc/tickets/0199-itinerary-compare/mockup/option-compare.html` draws direction A (columns beside a label column) and direction B (cards whose rows align, each repeating its labels), with three options and a best mark, the picked state, and four options at the 400px column, in light and dark.

### Forks for Kim
Each fork has a firm recommendation. Kim's answer goes on the `Answer:` line.

Itinerary (built in this ticket):
1. Home and shape: a hospitality domain type `Itinerary`, a factory composite in `packages/agent-ui/a2ui/src/catalog/domains/hospitality/` built from `ui-text`, `ui-timeline` and `ui-timeline-item`, the BookingForm precedent. No new `ui-*` control, no descriptor, no site pages. Recommendation: factory composite. Answer: Kim 2026-10-21: accepted as recommended.
2. Props: `title` (bindable string) and `days` (bindable array of `{label, aside?, stops: [{time, label, detail?, status?}]}`), `status` taking the TimelineItem enum. No children. It emits nothing: an itinerary is read, and a follow-up ask ("Evening plan") stays a Button outside it. One bound `days` path is updated in place as legs accumulate (the trip-plan law). Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
3. Weather or FX slot: a per-day `aside` short text the producer fills from its integrations ("18°C, sun", "1 EUR = 1.08 USD"), drawn at the end of the day header. Not a producer child slot, so the factory owns all its DOM. Recommendation: per-day `aside`. Answer: Kim 2026-10-21: accepted as recommended.
4. Days layout: A, every day stacked, a day header then that day's timeline; B, one day at a time behind a day strip. Recommendation: A, because an itinerary reads top to bottom and a strip hides days (the Tabs "hides half the ask" reasoning); at the 400px column A needs no extra control. Answer: Kim 2026-10-21: A, days stacked.
5. Status marks: done, active and pending use TimelineItem's own marks (shape and text, never color alone). Recommendation: reuse. Answer: Kim 2026-10-21: accepted as recommended.
6. Sidecar: intents within the 60-character cap, for example "a trip or day plan as days of timed stops"; `notFor` Timeline ("one run of events with no days") and Tabs ("switch between labeled panels"). Domain-to-base edges are exempt from reciprocity. Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
7. Adoption: rewrite the shared `itinerary-timeline` skill (travel and concierge) to teach one Itinerary, keeping its id; travel gains `"domains": ["hospitality"]` and goes to version 7; concierge goes to version 22; the trip-plan accumulate sentence names the Itinerary while its compare sentences wait for the compare ticket. Curator keeps its persona-local Tabs workflow, because spec section 4 gives curator no domain until D7. Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
8. Corpus: `travel-itinerary` and `frontier-trip-card` stay as they are; step 2 adds one hospitality domain seed; re-curating them is a follow-up. Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
9. Composite moment: no repair row for a hand-built day plan in this ticket; a follow-up if the live probe shows one. Recommendation: none now. Answer: Kim 2026-10-21: accepted as recommended.

Option compare (answered here, built in its own ticket):
10. Convergence: a new type, not an OptionDeck mode, because OptionDeck's job is to start something and its cards carry no aligned attribute rows or best mark. It reuses OptionDeck's pick contract: bindable `value`, `actionName`, `select` then `action`, a listbox whose whole column is the `role="option"` target, with no Button inside it. Recommendation: new type. Answer: Kim 2026-10-21: accepted as recommended.
11. Names: type `OptionCompare`, tag `ui-option-compare`, class `UIOptionCompareElement`, folder `packages/agent-ui/components/src/controls/option-compare/`, base `UIElement`, tier `pattern`, an agentic default-catalog row. Recommendation: as named. Answer: Kim 2026-10-21: accepted as recommended.
12. Props: `options` (`[{value, title, subtitle?, values: {<rowKey>: string}}]`, two to four), `rows` (`[{key, label}]`), `best` (an option value, shown by a "Best" text pill plus a ring, never color alone), `value`, `actionName`, `heading`, `inline`. Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
13. Layout: A, option columns beside a leading label column, a fourth option at the 400px column scrolling inside the control with the label column pinned; B, option cards whose attribute rows align, each card repeating its row labels. Recommendation: A, because rows align by construction and a value reads across options in one line. Answer: Kim 2026-10-21: A, option columns.
14. Feed partition: IN, because a pick is the canonical ask (the OptionDeck argument). Recommendation: IN. Answer: Kim 2026-10-21: accepted as recommended.
15. Teaching: rewrite `mini-skills/comparison-table.md` to teach OptionCompare when the user picks one, keeping Stat plus Table for a facts-only comparison, with a deliberate prompt-equivalence recapture; no second module with overlapping triggers. The Table boundary goes in that mini-skill, because Table holds the four-edge cap; `notFor` OptionDeck is reciprocal. Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.
16. Adoption in that ticket: travel `trip-plan` (both the Table with a Button per row and the ProductCard Grid become one OptionCompare) and a shopkeeper compare ask (`product-grid` stays for browsing). Recommendation: as described. Answer: Kim 2026-10-21: accepted as recommended.

## Plan review
- Kim 2026-10-21: step 1 mockups approved. Itinerary Direction A (days stacked); Option compare Direction A (option columns, for its own ticket). All 16 forks accepted as recommended, so steps 2 and 3 stand as planned.
- Kim 2026-10-21 (after step 2 blocked): fork 6 changes to no notFor edges for Itinerary (hospitality also targets a2ui-basic, which has neither Timeline nor Tabs); the Timeline boundary goes into step 3's itinerary-timeline skill prose. Stop times stay at the row's end edge (TimelineItem's own layout, fork 5).

## Outcome

2026-10-21 · lane: full L3 · verdict: skipped (design intake and mockups whose gate is Kim's approval (2026-10-21)) · verifier: verifier-L3 (fable) · base: af100381a8aa
- Changed: Itinerary hospitality type (days of timed stops, per-day aside) adopted by travel and concierge; Option compare designed and split to T-0393
- Commits: none
- Check: step-3#1 `(red) grep -qF Itinerary site/agent-content/skills/itinerary-timeline/SKILL.md`: pass
- Check: step-3#2 `(red) ! grep -qF TimelineItem site/agent-content/skills/itinerary-timeline/SKILL.md`: pass
- Check: step-3#3 `(red) grep -qF Itinerary site/agent-content/workflows/trip-plan/WORKFLOW.md`: pass
- Check: step-3#4 `(red) python3 -c "... 'hospitality' in json.loads(t).get('domains',[]) ..."`: pass
- Check: step-3#5 `(red) python3 -c "... seedVersion > base ..."`: pass
- Check: step-3#6 `(red) grep -qF "T-0199" site/agent-content/personas/travel/agent.md && grep -qF "T-0199" site/ag...: pass
- Check: step-3#7 `(guard) env -u NODE_OPTIONS node scripts/generate-agent-content.mjs --check && env -u NODE_OPTIO...: pass
- Check: step-3#8 `(guard) env -u NODE_OPTIONS npx vitest run site/pages/agent-admin-presets.test.ts site/pages/age...: pass
- Check: step-3#9 `(guard) env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui packages/agent-ui/components/src`: pass
- Check: step-3#10 `(guard) env -u NODE_OPTIONS npx vitest run site/lib/sitemap.test.ts site/lib/llms.test.ts site/l...: pass
- Check: step-3#11 `(guard) env -u NODE_OPTIONS npm run check`: pass
- Check: step-3#12 Conductor: Kim ruled 2026-10-21 (no notFor edges, stop times at the end edge, the Timeline bounda...: pass
- Check: step-3#1 `(red) python3 -c "... catalog.json ... Itinerary ... days bindable ... title ..."`: pass
- Check: step-3#2 `(red) python3 -c "... selection.json ... intents <= 60 ... not t ..."` (amended: no notFor edges): pass
- Check: step-3#3 `(red) grep -qF "Itinerary: domain('hospitality'" layers.ts && grep -qF itineraryFactory factorie...: pass
- Check: step-3#4 `(red) grep -qF "Itinerary (T-0199)" factories.test.ts && grep -qF "Itinerary (T-0199)" hospitali...: pass
- Check: step-3#5 `(red) test -f itinerary.visual.browser.test.ts && test -d __baselines__/itinerary.visual.browser...: pass
- Check: step-3#6 `(red) grep -qF "component: 'Itinerary'" domain-seeds.ts && grep -qF Itinerary selection-projecti...: pass
- Check: step-3#7 `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages packages...: pass
- Check: step-3#8 `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project visual packages/a...: pass
- Check: step-3#9 `(guard) env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui`: pass
- Check: step-3#10 `(guard) env -u NODE_OPTIONS npx vitest run site/lib/sitemap.test.ts site/lib/llms.test.ts site/l...: pass
- Check: step-3#11 `(guard) env -u NODE_OPTIONS node scripts/generate-agent-assets.mjs --check && env -u NODE_OPTION...: pass
- Deviation: step 1 verifier skipped: design intake and mockups whose gate is Kim's approval (2026-10-21)
- Deviation: step 2 verifier skipped: covered by the ticket verifier at step 3, which reran step 2's criteria
- Follow-up: decide: site/pages/dogfood-render.browser.test.ts:1104 PERSONA_TYPES does... -> notes.md
- Follow-up: decide: .claude/docs/spec/a2ui-catalog-architecture.spec.md:79 the "Persona... -> notes.md
