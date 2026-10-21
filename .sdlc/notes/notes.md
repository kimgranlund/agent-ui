# Notes

`tickets.py close` appends follow-ups that did not become tickets.

## T-0003: Per-turn context budget, assembled-prompt trace and provider usage (GH #1809, #1797) (2026-10-05)

- fix-now: Run `doc_lint` with a working copy on the five touched `.claude/docs` files; the only copy found printed "not a functional document" and checked nothing.
- note: ADR-0234 is accepted (verified 2026-10-07); 233 is reserved in `KNOWN_GAPS` for the no-barrels lane.
- note: `anthropic.ts` emits zeros for `inputTokens` and `outputTokens` when upstream sends a `usage` object without them; real frames always carry `output_tokens`, so it was left as is.
- note: Steps 1 and 2 were committed as wip commit `dce7f6fe` and the lane was rebased onto origin/main (#1805, #1806, #1819 present); squash the wip commit when merging.

## T-0063: response-type override lexicon (2026-10-11)

- note: the Done-when line "doc_lint exits 0 on the SPEC and PRD" cannot go red for the response-type docs: they carry no doc-type front matter, so doc_lint prints "not a functional document" and exits 0. The check that covers them is `npx vitest run site/lib/docs-grammar.test.ts`; name it in future criteria for these docs.
- note: SPEC RTS-R6 says less than the code: the noun may also be followed by that, which, please, and, so, using, showing, and the modifier bar also covers some, my, your, our. No contradiction; widen the SPEC wording if the lexicon changes again.
- note: known limit left in PRD section 8: "show me a table of numbers in words" can still force a surface.
- Cut PR owes: the 6 site [scale]/[density] files (gallery.browser.test.ts, component-gallery.ts, component-preview.ts, bar-chart-demo.ts, segment-demo.ts, sizing.ts) deferred by lane a10 until the bridge and control lanes land (T-0103).
- Cut or follow-up: nav-rail chevron still the border trick; swapping to ui-glyph needs a region-gated variant (lane a07, T-0100).
- Cut owes (lane a04, T-0097): 7 axes ([scale]/[density]) entries in timeline-item css and test, tabs, list, grid, row, column; calendar/swiper/status-stream carets to ui-glyph; descriptor .md geometry prose repairs.
- Cut owes (lane a03, T-0096): 3 #axes browser tests (avatar, badge, text), icon.md and icon.test.ts glyph alias until W7; badge marks to ui-glyph; swatch box size ruling; body-small and label-small roles; space-* and file-drop chip radius wait for the bridge.
- Cut owes (lane a02, T-0095): gauge ring stroke 8px (no ADR rule), radio-group and slider-multi [density] test legs (need the space-alias bridge), ui-glyph swap for pseudo-element marks (needs mask tokens or a deliberate render change). Probe reports 12 mismatches for indicators by design (2n boxes vs the 4n frame): fix the probe to compare 2n box for indicator controls before the sweep.
- Follow-up (lane a06, T-0099): part-level token declarations so service-card action, product-card icon header and board-grid mark keep their own size step inside a region (service-card action goes 24 to 28 in a region today); unflagged px literals: board-grid cell-min 34px, result-card pad-block 2px and pad-end 10px, 84px stat-min floors.
- Cut owes (lane a01, T-0094): button-geometry, text-field-geometry and select browser tests still assert legacy [scale] px values (cut-time rewrite); control carets, clear, stepper and ticks to ui-glyph (changes default pixels, separate ticket); foundations-codemod takes one directory per run.

## 2026-10-13: found in the T-0120 parity review (not caused by it; open)
- playing-card corner suit is 8.78px (`playing-card.css:207`, `0.9em` bypasses the 9px floor). Goes in the post-shrink cleanup ticket.
- Four focus-timing tests red on main since the cut: editor ("outside any region" premise is stale, the root now defines `--md-sys-inset`), otp-field x2, textarea. Same ticket.
- ProductCard seed photos `/rooms/*.jpg` missing, alt text overlaps the badge.
- At 400px: button demo form-actions row, text-field demo fields, first card demo card and the API attributes table overflow the right edge; the table demo breaks words mid-cell.
- Vertical tabs: selected label touches its indicator.
- agent-admin: temperature renders "0.6000000000000001"; the Sonnet 5 row's off switch reads as a bare dot.
- Catalog AudioPlayer preview is a squashed native control.
- BookingForm calendar button is 12px tall with a very small icon (accepted with the shrink; revisit with T-0122).
- genui-dogfood-teaching.md:32-33 (byte-pinned prompt) still teaches [scale]/[density]; needs the a2ui-prompt-authoring recapture flow, its own ticket (found by T-0131).

## 2026-10-13: foundations campaign goal closed (ADR-0245)
- Done condition on main 2026-10-13 after #1949: `foundations-census.mjs --gate` exit 0 with allowlist `{}`; `foundations-probe.mjs --strict` exit 0 (48 rows, 16 controls, 0 mismatches); `npm run check` exit 0.
- Negative controls, scratch worktree of main: `padding: 13px` in badge.css -> gate exit 1; allowlisted -> 0; entry removed while still violating -> 1; stale entry -> 1; restored -> 0.
- Rubric 3 (look): the batched verifiers (T-0104 pass, T-0105 fail accepted as pass) did not compare screenshots to the step 0 mockup. Kim ruled 2026-10-13 to accept her own sign-offs of the shrink (#1942), shell (#1948) and control-rule (#1949) before and after sheets as the look evidence. Families outside those sheets (charts, timeline, calendar) had no second review.
- icon-demo "Sizing, the ambient font-size ramp" row: every icon paints the same size from 0.875rem to 3rem (icons are 2n under ADR-0245, so the demo's premise is stale); rewrite the row to the size axis. Found by T-0133. Also the badge-demo scroll frame at 400px is as tall as its tallest off-screen figure.
- Rubric 3 closed 2026-10-13 by a batched verifier (T-0132): attempt 1 failed entry and atoms with three defects (sm avatar initials 8.4px, badge and icon demos overflowing at 400px, doubled search icon); T-0133 fixed them (#1950); attempt 2 passed both, with base-sha red controls. Supersedes the "accept sign-offs" line above. Reports: .sdlc/tickets/.0132-foundations-look-verify/verifier-L2.md and verifier-L2-2.md.

## 2026-10-13 21:40 PT: stopped on the monthly spend limit (weekly limit resets Oct 17, 2am PT)
- T-0134 (pill radius, worktree wave-pr, branch feat/pill-radius-fields-badges): tokens and control CSS done, probe --strict green; WIP committed. Left: npm run check, census, unit and browser re-pins, goldens, screenshots, ADR-0245 Amendment 5, review doc P13.
- T-0135 (date input, worktree wave-dt, branch feat/text-field-date-type): before shots taken; type=date already existed, gaps being closed (square round trigger, field anchor, month on open, keys, locale display); WIP committed. Left: those gaps, the BookingForm rebuild, gates, screenshots.
- T-0136 (dogfood lint) waits on both; the ui-designer dogfood review runs after T-0134 and T-0135 merge.
- Resume: SendMessage 0134-solo-L3 and 0135-solo-L3 by name ("resume from your WIP commit"), or a fresh solo on each worktree.
- Dogfood review nit: in an open select or menu panel, the first row's focus ring sits tight against the panel's top edge (T-0134 after shots).
- Renderer: bindProp in widget.ts re-applies the bound value over the guest's edit when a component reads its input there; wrap that call in untracked for all components (T-0135 worked around it in BookingForm only). Also: a hand-typed date reaches the form data one commit late, as numbers already do.
- Dogfood render lint covers only the default catalog's 77 widgets; persona catalog widgets (BookingForm, CardTable, QuestionCard, ContrastPair) are composition-lint only. Follow-up. Site shard grows by about 350 tests.
- OTP cells and textarea read faint at rest (no boundary); T-0140 gave text-field, select and combo-box a resting border; extend it to otp-field and textarea.
- Resolved by T-0168 (dogfood-lint.md; the 0.875 floor is ruled out in favour of icon-box; the OTP goldens fresh-mint byte-identical, no tolerance pass): dogfood lint rules proposed by T-0138: glyph-to-label gap >= n; single-line controls in one row share radius h/2; board corner mark >= glyph box with no px inset; standalone icon >= 0.875 x row font-size; square entry cell radius < w/2; no demo card clipped by its scroller at 400px. Also OTP empty and disabled goldens still show old squares and pass only on tolerance: re-mint.
- Open for Kim (T-0138): sm glyph box is 6px (dot, more, info marks): floor it or never ship them at sm. Icons inside a data-tier region keep 2n (Scope reading, recorded in Amendment 6) versus 1em everywhere outside a control (Goal reading).
- Dogfood lint rules proposed by T-0139: disabled ink contrast below the same control enabled; disabled ghost button background transparent; disabled track, box or ring edge >= 1.3:1 against its surface; disabled unpressed toggle background equals enabled unpressed; ui-text inside a button takes the button's colour.
- ui-row align=center: Chromium maps it to a centred text-align every child inherits (zig-zag rows in badge and icon demos); fix in row.css or list.css. Lint rules still without a measure (need a colour-compositing helper): field boundary >= 3:1, avatar disc >= 1.3:1, disabled contrasts.
- Dogfood lint rules proposed by T-0142 (not added, budget): badge-overlay opaque fill; icon-identity (no button without icon and label); action-group share a top edge or wrap together; prose-after-box >= n. GH #727 superseded: Kim kept the uppercase provider headings (2026-10-14).
- conversation 'the rail is one continuous line' browser test red on main (connector off by 2px), app shard, since before T-0143. Follow-up.
- Dogfood lint violators allowlisted by T-0144 that need control CSS: game-hud stat glyph 4px from its label at n 6 (glyph-gap); avatar disc 1.27:1 on a raised list row; site/lib/layout-demo-knobs.ts justify buttons wrap beside the label (row, column, list demos).
- The mathematical-design-system skill's live scale.mjs moved again (after 3c319761, the repo's frozen `tokens/scale.mjs`). Adopted in T-0372: vendored untouched under `tokens/vendor/mathematical-design-system/` (sha 5b370bdd), read by the generator where it reproduces today's tokens byte for byte.
- Partly built by T-0168 (placeholder-dots, picker-dash): dogfood lint rules proposed by T-0147: settings-item heading ink and size >= its labels; a round icon button paints no box-shadow at rest; no placeholder ends in exactly two periods; no em dash in picker labels or UI copy. Also 'provider(s) available' remains in a2a-tic-tac-toe.ts, a2ui-live.ts and gen-ui-live.ts; two LLDs quote the old 'Ask anything..'; _page.css:391 h1 is a 1.55rem literal.
- Partly built by T-0168 (caption-in-specimen, figure-parity on the top edge, overline-gap, avatar-cluster, supporting-ink; the rest stays review, dogfood-lint.md): dogfood lint rules proposed by T-0150: no backtick pair in a text() string or page intro; no .demo-caption inside a specimen; sibling .demo-figure boxes share inline size and top edge within 1px; an overline sits closer to the next block than the previous; clustered avatars ring and overlap at most a quarter; a supporting line has lower ink contrast than its title; prose-gap covers any block under a specimen.
- BookingConfirmation prints the raw room value ('twin'): needs an optional row-level options key in personas/concierge/catalog.json (approved by Kim's conductor, K6 budget and no prompt recapture); T-0146 could not take it. Own ticket.
- ui-rating [size] has no effect once --md-sys-icon-box is defined (stars ~8px at root): same root cause as icons reading the root icon box; fix in rating.css.
- Resolved by T-0164 (rule now in geometry.md and tokens.md): ADR-0046 Amendment 7 has two stale clauses after T-0146: 'BoardGrid: the frame is the 6px inset' and 'the rating gap stays 4px'.
- Built by T-0168 (star-run, glyph-gap on the rating, unframed-inset on ui-board-grid, board-letter): dogfood lint rules proposed by T-0146: compose rule against a run of U+2605 inside a ui-* host; glyph-gap covers [data-part=rating]; an unframed control's first painted box within 1px of the text edge; board letter cap height >= a third of the cell.
- Resolved by T-0164 (rule now in geometry.md and tokens.md): ADR-0059 line 39 stale after T-0148: the switch off track is now neutral-container with a neutral-field-outline edge.
- Partly built by T-0168 (disabled-edge and disabled-ink on the fields, slider-disabled, caret-glyph, switch-off-edge): dogfood lint rules proposed by T-0148: disabled-edge on text-field, textarea, otp cells, select trigger, combo-box editor; slider disabled fill vs rail >= 1.3:1 and thumb no higher than enabled; multi-select indicator equals the checkbox box and radius; compose: no setIcon(..., 'caret-*') in a control; select and combo-box paint a trailing caret; switch off fill below on fill with off edge >= 3:1.
- Resolved by T-0164 for the ADR clauses (rule now in geometry.md and tokens.md); still open: ADR-0105 Amendment 2 says the capped calendar panel is centred (now start-aligned); ADR-0228 cl.6 and ADR-0219 name the old 300-800 chart ramp. Bar-chart zero rule draws as per-row ticks, not one line. timeline-demo.ts:40 append button sits under the timeline.
- Built by T-0168: dogfood lint rules proposed by T-0149: table-scroll-cue, ring-parity, legend-gap, series-separation (>= 1.5:1), chip-opaque, chart-empty-mark, diverging-zero.
- Thinking text never arrives: anthropic.ts buildRequestBody asks for adaptive thinking but never sets display; on Sonnet 5 and Haiku 5.5 add display: 'summarized' so 'Reasoned' shows content (T-0151 finding). Chat turns carry no agent name until the client sends one.
- claude-review action fails in ~0.5s with is_error true, no turns, zero cost, since 2026-10-14 ~12:50 UTC, with both the API key and the OAuth token; made advisory in the merge queue (Kim). Ticket claude-review-action-broken: suspects the code-review plugin from the marketplace, the --model claude-sonnet-5-5 arg, or settings effortLevel xhigh. (T-0255, 2026-10-15: the claude-review workflow is deleted; GitHub runs only ci.yml.)
- Branch protection on main: required checks reduced to [check] on 2026-10-14 (Kim). T-0255 (2026-10-15) deleted the claude-review workflow, so [check] stays the only required check; do not restore claude-review.
- 2026-10-14 Kim: with the page root at product / md, the A2UI canvas stays widget / md (20 / 24 / 28), deliberately denser than the page. Record in ADR-0245 Amendment 8 when T-0152 merges.
- Follow-up from T-0164: scripts/adr_ratify.py and its test are dead (nothing calls the script) and can be deleted.
- 2026-10-14 open-questions round: composer size feels right at product / md (closed); next batch after T-0159 and T-0167 is the correctness batch; claude-review gets fixed via T-0153 then restored as a required check; ServiceCard teaching added to the Concierge pack in T-0159.
- T-0174 follow-up: chat:probe runs only 3 render-lint rules (nested-card, type-floor, column); extracting the render-lint helpers from site/pages/dogfood-render.browser.test.ts would let it run all (fits T-0168).
- 2026-10-14 Kim: agent eval framework approved; live spend cap $5 per run; order scenarios + store (T-0176), report (T-0177), judged checks (T-0178), matrix and baselines (T-0179).
- 2026-10-14 Kim ruled the catalog architecture SPEC (T-0201) decisions: accepted all recommendations D1, D3 to D8; D2 multi-domain ids (<base>--<d1>+<d2>). W0 can start; T-0196 Amount picker is core; T-0199 splits (itinerary to hospitality, compare agentic).

- 2026-10-15 (Kim): every live test round keeps all traces, payloads and ledgers for later analysis. Per round folder: traces/ (the round's .agent-traces lines), runs/ (report.json, fixture.json, turn screenshots), and a spend ledger (runner log plus per-run cost). Worktrees get reaped, so the round folder in the main checkout is the durable home. Rounds 1 (T-0184), 2 (T-0225) and the T-0208 probe were backfilled the same day. Automation: T-0241.

- 2026-10-15 (Kim): test rounds live in .sdlc/evals/rounds/<date>-<slug>/ with a generated .sdlc/evals/README.md index (T-0241); the ticket store moves to the sdlc-lite topics layout (.sdlc/tickets/, notes/, work/) after the running lanes land, committed (T-0242).

- 2026-10-15 (Kim, /ask round): work items live in .sdlc/tickets/ (topics layout, T-0242); CHANGELOG.md becomes a pointer to merged PRs and releases; npm publish scope is @agent-ui-kit/* (renamed at publish time); all of .sdlc is tracked in git. Scrub tickets filed: T-0249 to T-0252.

- 2026-10-15 (Kim): the T-0242 migration path fixes inside frozen ADRs 0241, 0244 and 0245 stay (paths only, no decision text). Plugin follow-ups filed upstream by the sdlc-lite author: T-0576 (root AGENTS.md block reads the topics layout), T-0577 (--rewrite-refs skips Frozen paths).

- 2026-10-15 (Kim): booking asks with every detail show a pre-filled BookingForm, never a read-back Card (T-0266). Round 3 tickets T-0262 to T-0273 set ready.

- 2026-10-16 (Kim): a bookable services list uses one ProductCard per priced service, never a Table (T-0279).
- 2026-10-16 (Kim): a facility-hours answer is one compact info Card with a DescriptionList, not a ServiceCard per facility (T-0285).
- 2026-10-16 (Kim): priced add-on services are one ProductCard each (T-0292); grammar-driven Haiku refusals are fixed in persona and repair text, never the shared grammar (T-0289, T-0291).

## 2026-10-16: Admiral surrender (T-0294 round 6, cluster A)
- Kim: a battleship surrender ends like a normal game end: one ResultCard (the loss, shots, a Play again action) with the revealed board kept beside it. Teach it in the board-grid End state and add a check.

## 2026-10-16: context-fog-of-war skill upkeep (Kim)
- Apply skill gaps as they are learned (each round, field test or verifier note), not only log them in the skill's updates-log: back up, fix with a test, verify, changelog entry.
- Kim 2026-10-16: every proposed change to the skill and to the repo context routing architecture and model behavior design gets an adversarial review and a debate before it is applied: a reviewer on a different model family challenges it, the author answers, and unresolved points go to Kim.

## 2026-10-16: routing architecture review rulings (Kim, after the proposer, adversary and rebuttal debate)
- P4: drop the reference-Badge example from `grammar.md:92-98` and `site/pages/agent-admin-libraries.ts:242` (narrowed C), with a deliberate byte-pin recapture. The T-0289 "never the grammar" ruling stays for model-reading fixes; a grammar line that contradicts a shipped check may change by ruling.
- N1: the producer infers `flowEnd` when a turn declares no ask and no surface, tallied, instead of a FLOW_END_MISSING repair round.
- R8: force render_surface with thinking off on round 1 of Haiku turns triggered by a click (an experiment, measured live).
- P7: the dev trace may store prompt text in a local, git-ignored content-addressed store beside it (reverses `tools/agent/trace-log.ts:19`).
- P6: catalog type names in persona text are a modality leak; the lint flags them and the Croupier persona is reworded.
- L1 (T-0314, 2026-10-16): the turn-scoped invariant wins over the T-0172 design: a surface that existed in the turn is kept or explicitly deleted; a later round that omits it is sent back, or the earlier version ships. The property test is the gate.
- T-0323 (2026-10-16, after the proposer and adversary debate): poker stays on a Card frame; CardTable is the blackjack family's table. Scope the CardTable mini-skills and persona entries to the blackjack family, poker checks skip the blackjack strip rules and get DEALT_IN_BETTING, and the ACTION_NOT_APPLIED repair text gets a poker branch.
- T-0321 (2026-10-16): accepted that a turn with no clean round halts or degrades rather than shipping a check-failed surface; round 9 counts halts against round 8 and the choice is revisited if halts rise.
- Kim 2026-10-17: every lane gets a local Claude code review (/code-review medium on the lane branch against main) after its verifier passes and before it ships. Confirmed bugs go back to the solo once, then a reverify; low-severity items go to notes and never block.
- 2026-10-17: closed-loop-run skill upserted with the live series lessons (experiment-series, live-evaluation, diagnosis, records references; updates-log). Verifier fable L3 pass; fix-now applied. Record: .sdlc/runtime/tasks/closed-loop-run-series/.
- 2026-10-17: Kim: install sdlc-lite 0.24.3 after round 9 closes (then tickets.py roadmap once, drop the lane-open reset workaround).

## T-0247: validate-payload --catalog cannot load persona catalog ids (<base>--<persona>) (2026-10-17)

- note: redck.py deviations printed no process deviation lines.
- note: packages/agent-ui/a2ui/tools/catalog-files.test.ts the two-domain test calls heal and validateA2ui directly rather than the CLI, since no domain pair ships in the real tree; it mirrors the CLI path.
- 2026-10-17 Kim rulings (round 9): (1) T-0317 drop rule: a surface rebuilt under a new id within the same turn is not a drop; only shipped surfaces count (fixes cluster A). (2) Blackjack opening regression from T-0323 wording: debate a wording fix (Opus proposal, other-family challenge), Kim rules. (3) confirmation-view and backable-wizard corpus records get replaced like T-0318; grammar.md example stays for now.

## T-0326: Live round 9: full matrix after the round 8 fixes ($42 cap) (2026-10-17)

- decide: `.sdlc/tickets/0326-live-round-9/handoff.md` criterion 5 names plugin 0.24.0, whose `tickets.py check` now reports the roadmap stale against the 0.24.3 roadmap. Point it at the current plugin.

## T-0318: Replace two corpus records that teach what the rulings forbid (frontier-booking-receipt, frontier-greet-card) (2026-10-17)

- decide: `confirmation-view` and `backable-wizard` still read back a booking before confirming and still rank on booking confirm turns (builder's Open section); outside this ticket.
- note: `catalog-frontier.ts` receipt record name stays `frontier-booking-receipt` while its content is an expense claim; the builder keeps it because `--replace` keys on the name. The judge's low notes (description says "settled" while the Badge says "Submitted"; literal Badge label) are unfixed by design.
- note: pins in `retrieve-presets.test.ts` now compare only a defensible prefix for four rows, which weakens those pins to rank 1-2; the dropped ranks are named in comments.
- 2026-10-17 Kim ruling T-0329 (blackjack opening): wording keeps blackjack as the subject of the CardTable mandate (not a leading condition, not an unconditional head with a poker exception), within the 200-token budget, preserving the T-0323 scoping. Measurement relative and attribution first: OLD, NEW and MIX arms now (about $0.50), then the candidate; pass when CAND beats NEW by 3+ of 10 and is within 1 of OLD; a fail comes back to Kim.

## T-0209: One source per concept: layer membership, calibration bullets, persona list; mini-skill ranking stability test (2026-10-17)

- decide: `packages/agent-ui/a2ui/src/agent/mini-skills.ts:94-98,113-121` note: the four `calibration:` rejection paths (non-positive, non-agent-ui catalog, domain entry, duplicate) have no vitest coverage; they fire only at module load from a planted asset, confirmed here by planted runs.
- decide: `packages/agent-ui/a2ui/src/catalog/layers.test.ts:56-71` note: `CLASSIFIED_CORE` is a 75-name hand list kept test-side as the classification record (the review asked for a new default type to red); runtime core stays derived, so the ticket's one-source goal holds for production code.
- decide: `.claude/docs/lld/a2ui-live-agent.lld.md:98,475,692-696` and `.claude/docs/spec/a2ui-live-agent.spec.md:255-257` note: history and changelog passages still name `NEGOTIATE_BLUE_SKY`, `calibrationExampleBullet`, `BLUE_SKY_CALIBRATION_IDS` and `miniSkillsFor` with old line numbers; the current-mode passages (LLD-C4 row, SPEC-R13 and the function comment) were repaired.
- decide: `packages/agent-ui/a2ui/tools/agent/worker/index.ts:50,54` note: the worker still imports the two base `catalog.json` files without an import attribute; the bundle loads (`worker-bundle.test.ts` green), so this is a consistency point, not a defect.
- decide: `packages/agent-ui/a2ui/src/agent/assets.gen.ts:25,40` note: the two regenerated embed lines for `card-game-sheet.md` and `settings-screen.md` carry em dashes inherited from those bodies (unchanged since the merge base; only the `calibration:` key was added), so the ticket added no em dash of its own.

## T-0168: Lint rules for the 2026-10 rulings: disabled recipe fleet-wide, 3:1 field outline, icon vs glyph, calendar cap, table pager, pill coverage, round-3 proposals (2026-10-17)

- note: site/pages/dogfood-render.browser.test.ts:63 `SILHOUETTE_MIN = 1.3` is a single test constant that slider-disabled now shares with disabled-edge and avatar-disc; the slider-disabled row in scripts/dogfood-rules.json names 1.3:1 in prose only, unlike the new rows' named numbers.
- note: site/pages/radio-demo.ts:67,85 and site/pages/choice-card-demo.ts:60 keep pre-existing em dashes in visible UI copy outside the picker labels; picker-dash covers labels only (T-0147's "UI copy" half stays open, as dogfood-lint.md says).
- note: Intent item 7 (the OTP empty and disabled goldens): the builder reports a fresh mint byte-identical to the committed goldens and no golden changed in the diff; not a criterion, not re-minted here.

## T-0334: BANKROLL_MISMATCH and NATURAL_ACTIONS price a pontoon at 2:1 (round 9 cluster H) (2026-10-17)

- note: scripts/e2e-admin/probe/replays has no pontoon fixture, so a recorded r9 pontoon payload was not replayed. Pontoon behavior is covered only by unit tests.

## T-0328: A same-turn repair that rebuilds a flagged surface under a new id must not halt (round 9 cluster A) (2026-10-17)

- fix-now: packages/agent-ui/a2ui/src/live-agent/produce-forced-surface.test.ts:47 the comment "only a surface that would have shipped counts, so the round drops the clean ask-1, not the flagged ask-2" describes commit 1's rule, not the shipped one: a round 2 of `ask-1` alone builds no new id, so the flagged `ask-2` is still `SURFACE_DROPPED at ask-2` (the base scenario passes on HEAD). Restore the original scenario or reword.
- decide: packages/agent-ui/a2ui/src/agent/produce.ts:1864 a requested surface can be silently lost when it is flagged-only and an unrelated id appears: probe P1 (round 1 `ask-1` IDGRAPH plus clean `greet-1`; round 2 `greet-1` plus new `info-1`) ships `greet-1`, `info-1`, trace `failureCodes ["IDGRAPH"]`, no halt. By design under the one-per-new-id rule (replacement matching removed in review round 2); the persona semantic checks are the remaining net.
- decide: packages/agent-ui/a2ui/src/agent/produce.ts:1864 a retirement leaves no trace tally (P1's trace shows only `IDGRAPH`), so a retired surface is invisible to trace review; the solo report lists the missing `SURFACE_REPLACED` tally as open.
- decide: packages/agent-ui/a2ui/src/agent/produce.ts:1863 a failed rename followed by a return to the fixed original id halts: probe P4 (`ask-1` IDGRAPH; new `table-1` CATALOG; fixed `ask-1`) halts `SURFACE_DROPPED at table-1` because round 3 builds no new id. Rule-consistent, over-conservative for a live oscillation.
- note: packages/agent-ui/a2ui/src/agent/produce.ts:1284 identical defects in two surfaces are unattributable (P3b: `root->gone` in `ask-1` and `ask-2` names both, flags neither), so a double rename halts `SURFACE_DROPPED at ask-1, ask-2`; with distinct defects two new ids retire both (P3). The safe direction, as the spec REV states.
- note: packages/agent-ui/a2ui/src/live-agent/produce-loop-property.test.ts:19 the T-0328 shapes run in 2-round sequences only; the three-round chained rename is covered by produce-response-type.test.ts and by the oracle-only assertion at :243.

## T-0333: BOOKING_CONFIRMATION_MISSING fires on a confirm turn or a read-back, not caption words (round 9 cluster G) (2026-10-17)

- note: the handoff wording ":85 still fires" now means BOOKING_FORM_MISSING fires on :85, not BOOKING_CONFIRMATION_MISSING. This matches the lead's stated goal.
- note: redck.py deviations was run, and the output had no red-checkpoint line to act on.
- note: hand-built confirmations whose settled word sits only in body Text (no heading variant) no longer fire. The fixtures were updated to h4 to show this is deliberate.
- 2026-10-17 follow-ups from local code review (not ticketed): composite-moments submitsReadBack also treats a `confirm_cancellation` action or an "Add to calendar" `submit: true` Button as a read-back confirm; a "Confirm availability" label on an info CTA with a non-start_intent action still matches the label fallback; `bound()` in composite-moments duplicates croupier `resolveProp` with different semantics (relative template paths). Gauge: the render lint's legend-gap does not check which edge the rings sit on (only gauge.browser.test.ts guards the T-0339 anchor); a dir toggle with no resize re-anchors on the next resize.

## T-0330: Feed a dropped surface's bound composite finding with SURFACE_DROPPED (round 9 cluster C) (2026-10-17)

- note: `.sdlc/runtime/tasks/0330-r9-dropped-surface-finding/verifier-L2.running` marker and throwaway worktree were mine to clean; the base worktree was removed and the tmp prefix is empty.

## T-0337: Column-chart highlight callout ink meets 4.5:1 on its pill in dark mode (chip-opaque debt) (2026-10-17)

- decide: packages/agent-ui/components/src/controls/column-chart/column-chart.css:78 `black 25%` is a named-color operand under a "no literals" constraint; the alternative `--md-sys-color-primary-dim` is a token role but drops re-theme following. Pick one ruling for derived dim steps.
- note: packages/agent-ui/components/src/controls/column-chart/column-chart.css:77 `--ui-column-chart-highlight-ink-on` was renamed to `--ui-column-chart-callout-ink`; any external override of the old name silently stops applying (builder reports it was undocumented).

## T-0335: Replace confirmation-view and backable-wizard, which read back a booking before confirming (2026-10-17)

- decide: Goal check: confirmation-view (`composition-pack-a.ts`) is now a settled plan-change record with an "Active" success Badge in the header and no commit. Its follow-up Buttons (ghost "View invoice", soft "Add seats") carry action contexts bound to `/plan/invoiceId` and `/plan/id`. That is the T-0318 settled-record shape. backable-wizard is a time-off request: no booking, hotel or reservation vocabulary in either record.
- decide: Retrieval: the old records are what the T-0335 test fails on (10 of 10), and the new corpus passes it.
- note: the judge verdict files carry only `judgedBy: a2ui-review-agent`, so independence from the seed author rests on the solo report's claim of fresh judge runs (not observable from the artifacts).
- note: the solo report records that backable-wizard's final review scene still reads a summary back before "Submit request". That is the non-booking confirm step grammar.md teaches, and it is outside this goal.
- note: `composition-patterns.md` cites `grammar.md:138` for the card-anatomy clause, which is stale; the solo report says it was stale before this ticket.

## T-0332: NARRATION_HINT leaves the surface as it is when the reply needs no change (round 9 cluster E) (2026-10-17)

- decide: `packages/agent-ui/a2ui/src/agent/produce.ts:1907-1917` (note-only branch): a tool-mode say turn answered in prose that claims a change on an open surface and names its id, with no payload and no semantic finding, now ships with no surface change and a reworded reply that still claims it. Observed in a throwaway worktree at HEAD with the croupier checks on: intent "Rename the table to Kim's table and show my chips as euros.", round 1 `Done: table-3 is now titled Kim's table...` with no call; the repair call offered no tool (`round2 tools undefined`), the scripted model's updateComponents for table-3 could not land, wire `[]`, note `Done: the table is now titled Kim's table and your chips show as euros.`, trace `["NARRATED_MECHANICS"]`. Before this change the full repair offered `render_surface`. Typed moves, clicks and openings are caught first by `typedMoveFindings`/ACTION_NOT_APPLIED/SURFACE_MISSING, so this is the one path where a needed update is silently lost: a prose claim no persona check names. Either accept the trade (the :182 false creation was the worse failure) or add a check that a note-only narrated reply on a say turn with a `target`-less claim of change keeps the full repair.
- fix-now: `.claude/docs/spec/response-type-selection.spec.md:143` AC3e now lists "an unflagged `ask-1`" twice (the narrated `ask-1` item was replaced rather than removed); drop the second.
- note: `scripts/e2e-admin/probe/replays/croupier-haiku-surface-id-in-reply.json` turn 8 drops the live prose round, so the replay no longer exercises ACTION_NOT_APPLIED followed by the reply-only narration round; a fixture keeping round 1 prose, round 2 the live call, round 3 the cut reply could pin that interplay and stay closer to the record (not run here).
- note: `packages/agent-ui/a2ui/src/agent/produce.ts:683` "Send only your reply to the user again" reads as "repeat it" on first pass; "Write your reply to the user again" or "Send a new reply" is less ambiguous.
- note: `packages/agent-ui/a2ui/src/agent/produce.ts:1529-1554` `narrationReplyRound` yields `retry` and `sent` progress lines but does not thread provider events through `interleaveProgress`, so a `progress: 'full'` consumer sees no `started`/`reasoning` for the narration call.

## T-0339: ui-gauge in RTL keeps its rings on the left and its legend about 190px away (2026-10-17)

- note: packages/agent-ui/components/src/controls/gauge/gauge.ts: a direction flip with no box change does not re-anchor until the next ResizeObserver tick (the post-mount test changes inline-size to trigger it). In practice low impact: a dir change usually comes with a page/locale re-render or reflow that resizes, but a pure `dir` toggle on a fixed-width container leaves the rings on the wrong edge until something resizes.
- fix-now: packages/agent-ui/components/src/controls/gauge/gauge.ts:108 comment cites `#syncAnchor`, which does not exist (the logic is `#anchor()` plus `#syncScale`).
- decide: site/pages/dogfood-render.browser.test.ts: with the anchor reverted, the dogfood legend-gap sweep (`-t "legend-gap"` 4 passed; `-t "demo/gauge"` 2 passed) stayed green, so the sweep and the rtl clean twin do not catch this regression; only gauge.browser.test.ts bites. The `legend-gap, rtl` plant proves the rule reports a padded legend, not that it measures the rings' edge.

## T-0336: Site demos align captioned figures to a shared top edge (figure-parity allowlist debt) (2026-10-17)

- note: shots/after/button-chromium.png: captions are bottom-aligned (`margin-block-start:auto`), so when a caption wraps to two lines ("size=\"md\" (default)") the first lines are not level. Only the caption bottoms line up.
- decide: scripts/dogfood-render-allowlist.json:3: the icon-demo figure-parity entry is still owned by T-0336, which is closing. Re-own it to a standing ruling or a ticket so the owner reference does not go stale.
- 2026-10-17 Kim close-out rulings: round 10 is a targeted run (round 9 failures plus the runs each fix touches, 3 samples on unstable ones, about $10 cap), next full matrix after it; T-0340 darkens dark primary (around 600 to 650) with the same on-primary ink, before/after screenshots for Kim's approval; T-0338 product-card exhibit icon header is pictorial media, exempt at 48px with a reason; next wave: content-files chain (T-0160 to T-0163), T-0315 debate, eval framework re-scope (T-0176 to T-0179), T-0169.
- 2026-10-17 Kim ruling T-0315: scope retrieval by the persona's declared /secret hidden-state keys parsed from the persona text, with a coupling pin; a structured preset field is a later follow-up; exclusion only (no ranking boost).
- 2026-10-17 Kim ruling (round 10 cluster A): a PARSE failure on a string `messages` gets a repair that asks for `messages` as an array of objects; the producer never edits model output (no bracket repair).

## T-0341: Live round 10: targeted rerun of round 9 failures and the runs each fix touches ($10 cap) (2026-10-17)

- note: .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md (Comparison set and the mechanism section header) says "25 round 9 runs"; the set is 23 distinct round 9 runs (18 single plus 5 triple-sampled bases, 33 runs); the 170 round 9 turns figure does match the 23 runs.
- note: origin/main has moved to 3c9bac639 (#2102) since the merge base fb301c09d; the merge path rebases again.

## T-0160: Agent content as files: extract preset and pack seeds to .md manifests with a generated, drift-gated registry (2026-10-17)

- note: `scripts/generate-agent-content.mjs --check` does not cover a builtin `DEFAULT_PROMPT_SECTIONS` edit (it stays exit 0); that drift is gated by the manifest drift test and `agent-admin-seed-digests.test.ts`, both inside `check`'s sibling test set but not in `npm run check` itself.
- note: the handoff's Do names the pack as `pack.json` refs and the content root as a choice; the build chose `site/agent-content/`, and the criteria name that path, so it is consistent.

## T-0169: Remove dead lint plumbing: adr_ratify, docs-grammar S8, census lane code, ADR wording in gates, [scale]/[density] bridge (2026-10-17)

- decide: site/lib/docs-grammar.test.ts:201 note: the describe title still reads `S5-S9 (S5-S8 promoted at Phase 5 ...)` while S8 is now RETIRED in the header.
- decide: scripts/lib/foundations-rules.mjs:204 note: `ALIAS_MARKER` and the marker exemption at :214 keep working code for a `foundations-alias` marker nothing in packages or site carries any more (only the census selftests use it); the solo report flags the same.
- decide: scripts/lib/foundations-rules.mjs:31 decide: `DERIVED` stays a hand list guarded by a drift test in foundations.test.ts rather than derived from the generator's emitted tokens as Do item 3 asked; the builder's reason (foundations-rules.mjs must stay browser-safe) is sound, and the test makes drift red.
- decide: packages/agent-ui/components/src/controls/sizing-gates.test.ts:133 decide: `WHOLE_SHAPE_FLOORS` is still a hand table ("if practical" in Do item 4; the builder judged it needs a new descriptor field).
- decide: site/pages/theming.ts:1 note: 17 added lines across 10 files carry an em dash (theming.ts:1, sizing-gates.test.ts:116, theme-provider.md:11 among them; dogfood-fleet.gen.ts and dogfood-assets.ts are generated from descriptor prose). Most re-emit text already on the edited line; a one-line nit, not a rebuild.

## T-0342: Eval signals over the round archive: one command for pass rates, churn, check fires and spend, with --against (2026-10-17)

- note: `scripts/e2e-admin/probe/signals.ts:547` The gates default to `--min-samples 3`, and every real archived round has 1 sample per cell. So `--floor all=1 --max-drop 0.1` on r9 against r8 exits 0 with all 87 cells listed as "Not gated (too few samples)". That is declared, listed in the output and passes the criteria, but the gate bites on real rounds only when a caller passes `--min-samples 1`.
- note: The retry table differs from r9 `report.md` on IDGRAPH (signals 6 fires, report.md 13); the builder explains that report.md counted failure entries rather than failed rounds. I did not recompute the retry table independently.
- note: Scratch files remain in /Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0342-verifier-L2 (mk.py, recompute.py, rd/); `rm -rf` was denied in this session. The throwaway git worktree itself is removed.

## T-0315: Admiral and Lexicographer share the agent-ui catalog: 'New game' ranks the word board first on the Admiral's opening (2026-10-17)

- note: `packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts:46` reads the preset foundations from `site/agent-content/registry.gen.ts` while the shipped presets read `registry.runtime.gen.ts` (`site/agent-content/registry.ts:8`); both are held to the same `.md` source by `site/agent-content/registry-freshness.test.ts:32-33`, so they agree today, but a reword of one generated file alone reds only one of the two T-0315 pins.
- note: handoff `## Acceptance criteria` #6: the live-round count (every `regress-admiral-` "New game..." opening, 0 `/secret/word` records in `trace.exemplarIds`) is still to be measured on the next live round; the replay above is the pre-round evidence.
- note: `.sdlc/runtime/tasks/0315-shared-catalog-cross-game-retrieval/red-checkpoint.jsonl` records the three controls as `retrospective` at 985976d62 against the earlier criterion wording (before the hyphenated-key, opaque-key and Foundation-only additions); the controls in this report re-run the final spans at the merge base 0e70ecea1.

## T-0344: A PARSE failure on a string messages asks for an array of objects (round 10 cluster A) (2026-10-17)

- note: `packages/agent-ui/a2ui/src/agent/response-type.ts:102` the position-form `messagesParseNote` now fences the quoted text in backticks and ends with a period (pinned at `response-type.test.ts:74` and `produce-response-type.test.ts:930`, named in the spec REV); no criterion names it, it keeps the ask-then-note hint from running into the next sentence.
- decide: `.sdlc/evals/rounds/2026-10-17-r10-targeted/report.md:86` asks for a replay pinned from :193 under `scripts/e2e-admin/probe/replays/`; this ticket's criteria did not require one and none was added (criterion 3 runs the existing T-0304 replay).
- note: `.sdlc/runtime/tasks/0344-r10-parse-ask-array/red-checkpoint.jsonl` records the control as `retrospective` against the earlier, shorter criterion text (`criterion_sha256` differs from the final line); the throwaway red run above is the failing-first evidence.
- note: the solo report's Open item stands: whether Haiku and Sonnet switch to an array after the new ask is unmeasured until the next live round.
- note: the Done-when's "one short different-family challenge before build" is described in `solo-report.md` (Sonnet, two edits taken) with no artifact in the task dir; it sits outside `## Acceptance criteria`, so it is recorded as the builder's claim, not checked.

## T-0346: A poker showdown reveals the opponent hand and settles in the same turn (round 10 cluster C) (2026-10-17)

- note: the redck.py deviations run printed no process-deviation lines.

## T-0348: The surface override does not read a playing card as a UI card (round 10 cluster E) (2026-10-17)

- decide: side effects, from a probe that runs detectUserOverride per persona catalog in CATALOG_LAYER_MAP (default types plus each home's types). croupier (owns card, table) loses "show me a summary card", "show me the cards", "as a card", "as a table" and "show me a table of results" (surface to none), and "no card please" (text to none). quizmaster (QuestionCard, owns card) loses "show me a summary card", "show me the cards" and "as a card" (surface to none), and "no card please" (text to none). concierge (BookingForm, owns form) loses "build me a form" and "show me the form" (surface to none). default and stylist show no change. lexicographer and admiral have no CATALOG_LAYER_MAP home, so they own no nouns and keep the plain lexicon. The responsePreference toggle still forces a surface in all of these.
- note: the probe scratch dir /Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0348-verifier-L1 could not be fully removed (rm -rf was denied); the base worktree itself was removed with git worktree remove.

## T-0161: Agent content overlays: user edits as diffs over seeds, 3-way merge on seed update, one write path per kind (2026-10-17)

- decide: Kim, the old-version migration (ACS-R7) now keeps a user's old stored seed values under a `seedChanged` flag instead of wiping them. A user on Quizmaster v1 keeps `claude-haiku-4-5` (a retired model default) until T-0162 offers "take seed". The old behavior, which Kim chose in the Quizmaster v2 comment, is gone. Alternatives are to ship per-version field digests in the generator, or to accept the flag as is. The solo already listed the digest idea as undone.
- note: ACS-R8 per-op `source` provenance is not recorded yet. The solo flagged this and left it to T-0162. The Goal does not need it.
- note: `agent-roster-source.ts:4` is one line longer than the surrounding comment wrap. This is cosmetic.

## GitHub issue sweep (Kim, 2026-10-17)
- #1890, #1910, #1938, #1939 closed as done (evidence in each close comment).
- #1941: marks move to ui-glyph children, not mask tokens (T-0351).
- #1940: a part declares its own size step, not a per-part token (T-0352).
- #1937: keep the "one release" gate; T-0353 is blocked until the first published release.

## T-0340: Dark primary under on-primary is 3.25:1: buttons, calendar day, segmented control and checkbox text fail AA (2026-10-17)

- decide: packages/agent-ui/components/src/controls/radio/radio.browser.test.ts:274 the "default: one solid circle" test runs in the light scheme, where primary and primary-fill are both 550, so it would also pass against a ring-on-primary build; carried from verifier-L3.md.
- decide: packages/agent-ui/components/src/controls/switch/switch.css:72-75 and packages/agent-ui/components/src/controls/playing-card/playing-card.css:65-66 still put on-primary ink on plain `primary` (dark 450); builder's exemption, Kim to confirm; carried from verifier-L3.md.
- decide: ui-button light pressed 650 -> 750 not built (packages/agent-ui/components/src/controls/button/button.css:32-34 keeps the light hover/pressed collapse); carried from verifier-L3.md.
- note: before-themes.png was shot at 10:46, between the round 1 and round 2 commits; verifier-L3.md read it as the 450 legs for all ten packs, and its md5 differs from after-themes.png.

## T-0347: Scripted card scenarios skip the rest of a hand when a natural settles it (round 10 cluster D) (2026-10-17)

- note: the remaining :101 failure (settled pontoon natural on table-2 shipped no Deal again button, so the click hit table-1's history button) is an agent/check gap outside this ticket: the scenario's Deal again step is correct, and a settled table with no way forward is an agent output defect that a check should name. File a follow-up ticket.
- note: the replays did not exist at the base, so red-first for #1 was not shown in a base worktree; skip.test.mjs exercises the marked/unmarked split.

## T-0162: Settings pane forms generated from each content kind's schema, with provenance, diff and reset (2026-10-17)

- decide: packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:5216 `formatSeedValue` renders a switch the seed leaves unset as `Seed: unset` (seen on Skills and Planner in the after screenshots) rather than the switch's effective default; the criteria leave the wording open.
- decide: there is no in-app export-as-seed; the Builder export stays the persona JSON and the seed format is reached only through `node scripts/agent-content.mjs new <id> --from <file>` (scripts/agent-content.mjs:87, site/agent-content/seed-file.ts:45). The Intent's Do says the export writes the seed format; criterion 6 requires only `new --from`.
- decide: file validation is stricter than before: effort, thinking and cacheTtl are enums, maxTokens floor is 0 (was positive integer), and `order is required in the roster` is explicit (packages/agent-ui/app/src/controls/agent-admin/content-fields.ts:121-178, site/agent-content/schema.ts:365); all 78 records pass today, a future seed with a value outside the enums fails `validate` and the generator.
- note: scripts/agent-content.mjs is also edited by T-0163 (solo report); whichever lands second merges both.
- note: site/lib/theme-provider-build-fixture.test.ts:74 is red at the base sha and at HEAD (fixture regen-on-main class per its banner), outside this ticket.
- note: .sdlc/tickets/0162-agent-content-schema-forms/handoff.md: the `## Acceptance criteria` section was added after the base sha and committed with the build (diff vs 74fd3265a); the diff does not show who authored it; the criteria match the Done-when line for line.
- note: the solo's bankroll-row negative control (dropping its `data-field` reds both engines) is their claim, unverified here; the bite evidence recorded above (ADMISSION admit-all, maxTokens form hint removed, Edited label changed) is mine.

## T-0163: One agent compiler for Test Chat, proxy, Worker and CLI, with a resolution trace and bundle digest in every turn trace (2026-10-17)

- note: held per the handoff, outside its Acceptance criteria: `--affected` waits on T-0343 (`scripts/e2e-admin/probe/scenarios/plan.ts` does not exist); no `agent@digest` pin on the agent-behavior eval legs yet (only the e2e:admin `match.agent` pin ships, which is what criterion #6 names). Follow-up candidates.
- decide: the Worker's `x-agent-bundle-digest` header (`worker/index.ts:227-229`, `:396-399`) has no behavioral or structural test; the Worker is not importable under vitest, and a node/vite-runner import of it also fails on the Wrangler-only raw imports. Parity rests on the shared `bundleFromWire`/`bundleDigest` plus the code read above. A structural gate like `chat-route.test.ts:232` would pin it.
- note: `packages/agent-ui/app/src/controls/agent-admin/agent-admin-error-turn.test.ts:76-79` uses a fixed 40x5ms settle loop and flaked once under load average 10; not caused by this change.
- note: scratch under `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0163-verifier-L2` and the tmp prefix `0163-verifier-L2` could not be rm'd (denied in this session); the throwaway worktree itself was removed.

## T-0351: Badge intent marks and the setIcon carets, clear and stepper marks move to ui-glyph children (GH #1941) (2026-10-17)

- decide: `.sdlc/tickets/0351-glyph-marks/handoff.md:19` note: the Done-when `grep -rn clip-path badge.css` is a relative path that exits 2 from the repo root; criterion #1 is its runnable form (conductor-ruled, no plan-defect verdict).
- decide: `.sdlc/runtime/tasks/0351-glyph-marks/shots/after/text-field.png` decide: the clear x and the stepper minus/plus (and the tabs and breadcrumb `more` dots) now draw at the glyph box with the token stroke, visibly smaller and bolder than the old 2n Phosphor icons; the derived geometry the Goal asks for, but nobody has ruled on that look.
- decide: `packages/agent-ui/components/src/controls/styling-gates.test.ts` note: styling-gates, sizing-gates and naming-gates run green (3 files, 94 tests, exit 0); `node scripts/foundations-census.mjs --gate` exit 0, green with 0 allowlisted findings.
- decide: `.sdlc/runtime/tasks/0351-glyph-marks/solo-report.md:45` decide: select (which still sets a host `aria-hidden` on its caret), calendar, combo-box, disclosure, form-popover, status-stream and swiper-paddles build ui-glyph by hand; a follow-up could adopt `createGlyph`.
- decide: `packages/agent-ui/components/src/controls/tabs/tabs.ts` note: tabs, breadcrumb and text-field define `props` by hand and ship no `*.props.gen.ts`; my regen probe created three untracked files, which I removed, and the tree is clean (`git status --short` empty).
- decide: `/var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui-7439b17c/0351-verifier-L3` note: the scratch log folder stays (the rm was denied by the permission system); the throwaway worktree was removed. `redck.py deviations` printed no `process deviation:` lines (no `(red)` criteria in this handoff).

## T-0352: Card action parts declare their own size step inside a data-tier region (GH #1940) (2026-10-17)

- note: `git grep` finds no other reader of `--ui-service-card-action-*` or `--ui-product-card-action-*` outside these two folders and the regenerated artifacts, so no dependent was missed.

## Close-out rulings (Kim, 2026-10-17, long run)
- Long run scope: the keyless ready wave (T-0349, T-0203, T-0178), promote the pattern tickets T-0193 to T-0199, lint debt T-0187 to T-0190, and debates for T-0345 and T-0350.
- Live spend: round 11 (about $10) plus T-0343's capped Haiku smoke leg (about $5).
- Stop at close-out: when the chosen scope merges, one question round with every pending ruling, then stop.
- T-0348: keep the domain-noun rule, exempt explicit format asks (T-0354).
- T-0161 migration: per-version seed digests (T-0355).
- T-0352: both card actions are md; board-grid cells scale with the board (out of scope).
- T-0352 follow-up for T-0353: the `--ui-*-action-font-legacy` tokens retire with the legacy bridge.

## Debate rulings (Kim, 2026-10-18)
- T-0350: ship Part A only (DEAL_AGAIN_MISSING check); hold Part B (the NATURAL_ACTIONS wording at checks.ts:370) until a live natural shows the misread with A in play.
- T-0345: measure the Opus line change with the relative rule, ceiling fixed (+3 of 10, extend to +9 of 30; OLD >= 8 goes straight to N=30); the absolute "round 8 rate" bar is retired. Poker stake-ask check is the sibling T-0357.

## Overnight calls (conductor, delegated by Kim 2026-10-17 "you make the calls")
- T-0189: Kim confirmed directly: the playing-card corner index is card art, exempt from the 9px type floor (an earlier relay overstated the T-0338 ruling; corrected).
- T-0188: Kim ruled the non-scaling 3px 2px projected dash a screen-px exemption.
- T-0355: Kim ruled option C (untouchedWins rows citing a ruling); Quizmaster v1 dated Haiku 4.5 row marked.
- T-0203: shipped with both verifiers passing criteria 1 to 5 and the live web-search probe moved to an after-merge conductor step (skips.md). The probe and the surface arm's server-tool mix still need a keyed run.
- T-0357: accepted two widenings that reach blackjack (shared isDealPress incl. deal_<x>; "buy-in" as a bet word).
- T-0190: type sizes use --md-sys-type-* roles (never the retiring --md-sys-typescale-* aliases); specimen frames get named exemptions; pie-chart keeps em with an exemption; page readouts use field-label; in-control captions use supporting().
- T-0354 side effects for review: "show me a playing card" now forces a surface in croupier; "make me a form of payment" still does in concierge.
- T-0352 legacy-only `--ui-*-action-font-legacy` tokens retire with T-0353.
- Filed T-0360 (live round 11, cap $10) per Kim's approved spend.
- GameHud repair line (T-0358 follow-on): "with its title, status and stats (and progress when the game counts turns), beside the BoardGrid when the game has one, and drop the hand-built score text or stat badges."
- T-0365: one sibling-group stat rule (2 or more distinct stats among one parent's direct children, one single-child wrapper looked through); a counter alone never opens the game gate.
- T-0366: took the code review's altitude finding; the board-less move check keys on the say turn's declared meta-line target and an update to that exact surface id, sharing GAME_WORDS, deferring to the board, fleet and word checks (one finding per target).
- Round 11 clusters H to K filed as T-0368 to T-0371 (and T-0367) but not started: they follow the close-out round.
- Live spend for the long run: about $10 of the $15 cap; nothing further spent.

## Close-out rulings (Kim, 2026-10-18, round 11 wave)
- T-0345: ship the NEW opening line (30/30 vs 22/30; the +9 bar waived as a ceiling effect).
- T-0359: narrow the Swatch ask row to the first palette ask only.
- T-0363: option (b), persona skills place GameHud in a surface; grammar.md unchanged.
- T-0367 to T-0371: promoted to ready, keyless solo lanes in a fanout.
- T-0363 (Kim, after review): option (b) conflicted with grammar.md's ask-only rule; Kim ruled the grammar change "an ask may update one HUD". Debate ran (Opus architect revision 2 passed the fable second challenge). Conductor call: both skill descriptions trimmed to the SPEC-R14 200 B entry budget, the boundary-negotiation clause moved to the deal-sheet body. Needs a live re-record to measure on Haiku.
- T-0359 (Kim, after verifiers 4 and 5): Stylist-only gate, then judge the reply not the ask. Conductor call after verifier 6: criterion 2 pinned to five closed reply forms so the bar stops moving.
- decide: T-0369 left the root cause open: game-table-chrome.md teaches "CardFooter = Row of action Buttons" beside a one-button Deal again, against grammar.md:179. A prompt change under the debate rule.

## T-0178: Agent eval framework 3: judged checks with a pinned judge model, rubrics per persona, seeded known-bad transcripts (2026-10-18)

- note: `.sdlc/evals/rounds/2026-10-17-r10-targeted/runs/regress-croupier-blackjack-moves-haiku-1` (the good croupier case in `scripts/e2e-admin/probe/rubrics/calibration.json`) scores 3 on the live run, exactly at the croupier threshold, and the C4 reason still names the turn 4 chat-log fragment "100" as a slip. The margin is zero, so a rerun may flip it; recheck on any judge model, rubric or transcript change.
- note: I could not run a mutation check on the threshold or `wx` write guard (the throwaway-worktree command was denied by the permission system), so those two bite-checks rest on reading the tests' names and the code at judge.ts:303 and 331-337. A scratch probe file remains at `/var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui-7439b17c/0178-verifier-L2/probe.mts` (rm was denied); no worktree was created.

## T-0187: split-pane demo stacks or scrolls at 400px instead of overflowing the column (2026-10-18)

- note: the red-checkpoint deviations script printed nothing (no `(red)` criteria in this handoff).
- note: the throwaway worktrees were removed; two scratch log files under /var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui-7439b17c/ could not be deleted (rm was denied) and are harmless.

## T-0188: line-chart projected dash: user-unit dash or a ruled screen-px exemption (2026-10-18)

- note: scripts/dogfood-rules.json and .claude/docs/references/dogfood-lint.md still describe the dash-scale rule without a "ruled texture dash" carve-out (solo flagged it, optional).

## T-0189: playing-card corner index: a type floor or a ruled pictorial exemption (2026-10-18)

- note: .sdlc/notes/notes.md does not record the playing-card ruling (the solo report flags this). The conductor should add the line or confirm it with Kim.

## T-0190: site demos: inline type sizes and off-ramp spacing literals move to tokens (2026-10-18)

- note: .sdlc/runtime/tasks/0190-site-demo-inline-literals/solo-report.md "Open": audio, video, swiper-label and in-control captions moved from em to type roles; no exemption was needed and the render lint is green.

## T-0343: Smoke scenarios for every preset, planned from tags, replayed in CI (2026-10-18)

- note: `git status` in the tree was clean (build committed in 994464e97), so the diff above is `aa20d07c6..HEAD`.

## T-0349: eval:signals follow-ups from round 10: like-sample churn, halt and failureCode tallies, retrieval table (2026-10-18)

- note: report.md line 38 "Concierge confirm turns retrieving confirmation-view or backable-wizard: 0 of 9" is a turn-class count the command does not produce; it gives per-exemplar turn counts (confirmation-view 2 vs 5, backable-wizard 0 vs 3, frontier-booking-receipt 0 vs 1), and the 2 matches report.md's "two non-confirm turns". Solo reported this openly; the retrieval table reproduces the underlying counts.

## T-0350: A settled card table ships with no way forward (no Deal again), and no check names it (2026-10-18)

- decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:641-645 note: `namesOtherGame` and the `opened()` poker skip scan the full merged component map while the forward scan uses `reachable()`, so a poker-named component orphaned from an earlier turn exempts a surface the reachable graph no longer shows as poker; no recorded turn trips it (sweep above).

## T-0354: Explicit format asks ('as a card', 'as a table', 'build me a form') force a surface even where the catalog owns the noun (2026-10-18)

- decide: packages/agent-ui/a2ui/src/agent/response-type.ts:177 "show me a playing card" now forces a surface in croupier (base: none) because `domainLeadWords` turns "playing" from PlayingCard into a format modifier.
- decide: packages/agent-ui/a2ui/src/agent/response-type.ts:177 the solo reported that "show me a card table" forces a surface in croupier. My probe returned none in croupier (and `surface` in quizmaster, the same as base), so the solo's claim does not reproduce. Kim should still say which result is wanted.
- decide: packages/agent-ui/a2ui/src/agent/response-type.ts:224 "make me a form of payment" still forces a surface in concierge ("of" is in NOUN_END after a build verb plus "a").
- note: the default catalog also changed. "build me a deck of cards" and "I worked as a card dealer" were `surface` at base and are none now (the `of` non-modifier and the NOUN_END on the "as a" phrases).
- note: I could not remove the scratch probe dir /var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui-7439b17c/0354-verifier-L1 (rm was denied). The throwaway worktree was removed.

## T-0355: Per-version seed field digests so a migration tells an untouched old seed value from a user edit (2026-10-18)

- decide: site/agent-content/seed-history.ts:29-38: note: only Quizmaster v1 `model` is recorded; the v2 to v6 bumps moved entry lists, which the table and `diffOverlay` do not digest yet (spec ACS-R7 item 6 says so), so a pre-overlay store at v2 to v5 keeps every differing entry flagged, the T-0161 behaviour.
- decide: .claude/docs/spec/agent-content.spec.md:283-284: note: the sentence `Any other differing value is kept and` wraps mid-clause onto the next line; a cosmetic reflow.

## T-0356: The other seven controls build their glyphs through createGlyph, with no host aria-hidden (2026-10-18)

- note: packages/agent-ui/components/src/controls/swiper/swiper-paddles.ts:36-39: on a re-drive the glyph's `symbol` property is set but the initial `symbol` attribute stays (the prop does not reflect). The solo report states this too; no CSS or test reads that attribute.
- note: /Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/wave-w356/site/pages/glyph-doc.ts:28,62 still call `document.createElement('ui-glyph')`. This is outside the `packages/` criterion; it is a docs-site page that exercises label and symbol variants, not a control.
- note: the `npm run check` exit code was not captured directly (the pipe hid it); success rests on the && chain reaching its last line.

## T-0357: A poker opening that asks for the stake instead of dealing gets a deterministic check and repair (2026-10-18)

- decide: `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:541`: note: `isDealPress` now matches any `deal_<x>` action (`deal_again`, `deal_next`) on the blackjack arm, so a table-less settled summary Card whose new-round Button has a non-"Deal" label but a `deal_again` action would be BET_TABLE_MISSING; no recorded fixture does this (sweep, 0 new hits), so it is a watch item for the next live round, not a defect.
- decide: `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:578-585`: note: the hold'em arm reads only the surfaces the turn touches, so a mid-hand raise ask opened on a new surface while the dealt table sits untouched would fire; no recorded turn does this (:83 and :84 touch the dealt surface, :82 ships no payload), so it is a watch item, not a defect.

## T-0358: GameHud composite moment fires only beside a BoardGrid, so board-less game personas hand-build their score panels (2026-10-18)

- decide: .sdlc/tickets/0358-gamehud-moment-board-only/handoff.md:32: decide: the acceptance criteria were written by the builder (the base handoff ends at Constraints), so this verdict judges builder-authored criteria. Against the Goal: sentence one holds (GAME_HUD_MISSING fires on the three board-less strips and an authored compliant round ships a GameHud), sentence two ("the three pinned smoke replays flip to green") does not: Mentalist turn 0, Negotiator turn 1, Dungeon Master turn 1 and the run-level Timeline stay red, pinned to T-0362 and T-0361 with the trace evidence above. Per spec CL-R3 (`.claude/docs/spec/agent-closed-loop.spec.md:75`) the authored rounds prove the loop mechanics, not live compliance.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:161: note: false-positive sweep of the built GameHud check vs base over 588 recorded runs (`.sdlc/evals/rounds/*/runs/*/report.json`, all 15 personas) and 69 replay fixtures, 3409 turns, 4164 model rounds (2841 tool-call rounds) and the shipped lines, 6555 surfaces judged through `semanticSurfaceViews` with the session replayed: base 71 hits (admiral 65, lexicographer 4, croupier 2), built 103, NEW 32, LOST 0. All 32 new hits are the three smoke targets (mentalist 12 at `ask-1:progress`, negotiator 12 at `ask-1:badge`, dungeon-master 8 at `quest-log:hp`, each across the run and its replay, every round and the shipped lines): all true. Zero hits on quant (KPI dashboard), concierge (171 runs, membership and bookings), shopkeeper, travel, stylist, curator, quizmaster, alchemist, restaurant, or the 299 croupier CardTable games.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:158: note: `lacks: ['CardTable']` also feeds `compositeAnswered` (`produce.ts:1230`, `:1521`), so a CardTable now counts as answering a carried-over GAME_HUD_MISSING; consistent with the croupier `game-hud` skill ("never add a GameHud beside" a CardTable) and LOST 0 in the sweep.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts:400: decide: the "fires with the game gate or CardTable `lacks` removed" clause is proven only by a verifier-run mutation; `compositeMomentCheck` is exported, so an in-tree assertion over a mutated row would pin it.
- decide: .sdlc/tickets/.0363-gamehud-feed-scope/handoff.md:13: decide: the ruled repair names no surface, and GameHud is outside `FEED_SURFACE_TYPES`, so a live model that follows it on an ask surface gets FEED_SCOPE (the authored rounds sidestep this with a separate `hud-1`); with T-0362's open question (per-surface firing when another surface already holds a GameHud, Negotiator turn 1) the Goal's "the turn ships the GameHud" is unproven live until those land.
- decide: .sdlc/tickets/.0361-quest-log-timeline-unchecked/handoff.md:1: note: T-0361 to T-0364 exist, status ready, `depends: [T-0358]`, every section filled; `tickets.py check` prints `ok: 362 tickets, roadmap current` (its warnings on T-0189/0349/0350/0354 and old placeholder text predate this ticket).

## T-0203: Composer model controls: thinking off and show reasoning in the effort menu, web search and fetch toggles, server tools in requests, mid-conversation effort header (2026-10-18)

- note: packages/agent-ui/a2ui/src/agent/produce.ts the surface arm sends server tools beside `render_surface` with a forced `tool_choice`; whether the API accepts that mix and the `web_search_20260318` / `web_fetch_20260318` types is settled only by the conductor's live probe (carried from verifier-L3).
- note: the 4 conversation.browser.test.ts failures (GH #1221, TKT-0079) are pre-existing at base per verifier-L3; no criterion names the browser shard.
- note: scratch under /var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui-7439b17c/0203-verifier-L2 and 0203-verifier-L2-check.log not removed (cleanup command was denied); no throwaway worktree was created.

## T-0360: Live round 11: measure the round 10 fixes (PARSE array ask, showdown settles, natural skip, playing-card override, deal-again, poker deal) with fog analysis (2026-10-18)

- note: .sdlc/evals/rounds/2026-10-18-r11-targeted/report.md says "PARSE turns: 16"; the trace failure codes show 18 PARSE failing rounds (16 is string-messages rounds). Different units, not a contradiction, but the wording could confuse.
- note: `tickets.py check` warns that T-0189, T-0349, T-0350, T-0354 and T-0362 are open though delivered on main; not this ticket's scope.

## T-0361: A quest log with no Timeline gets no repair round (2026-10-18)

- note: sweep of every tracked .json/.jsonl (2594 files, 8923 distinct updateComponents, each run as one view through the GameHud, ResultCard and Timeline rows). HEAD vs main a8a84bcc5: 10 new hits, 0 lost: 4 TIMELINE_MISSING, all the target Dungeon Master quest log (`.sdlc/evals/rounds/2026-10-18-smoke/runs/smoke-dungeon-master-first-scene-haiku-1/{fixture,report}.json`, `traces/2026-10-18.jsonl`, the replay .json), and 6 RESULT_CARD_MISSING, T-0364's two lexicographer Sonnet runs (give-up, invalid-then-replay) in round 2026-10-15-r2-presets, "Game over" plus "The word was". HEAD vs the T-0364 tip 30a4fe483: 4 new (the TIMELINE_MISSING set), 0 lost. GAME_HUD_MISSING is 51 on all three trees, so the round/turn restore and the composite-props exclusion changed no recorded GameHud or ResultCard verdict.
- note: fresh probes against HEAD: 9 of 10 quest-log shapes fire (paren numbering, "Adventure log" over a List, Card titled Journal over Scene N, CardHeader Chronicle, headless two Scene N, Rows of number plus name, template Column, "Scenes so far" deep in CardContent, h4 before a List in a plain Column); all 11 non-log shapes stay quiet (order history with a board game, game-app changelog, lobby chat history, itinerary, current-scene narration, numbered choices, objectives, scene-picker Buttons, how-to-play rules, score history, a one-paragraph recap). The one miss, a List carrying its own `label: 'Quest log'` behind a stat Text, is unrealistic: the catalog's List and Column have no `label` property.
- decide: `packages/agent-ui/a2ui/src/catalog/composite-moments.ts:140` GAME_WORDS includes `adventure` (shared since T-0358), so a concierge "Your Iceland adventure" card with a "Travel journal" label over two plain entries yields TIMELINE_MISSING with the repair "one TimelineItem per scene in the order played"; a Timeline is a fair answer there, the wording is the Dungeon Master's.
- note: `composite-moments.ts:352-357` reads entries only as Texts or Rows of Texts: a quest log of Rows of Badge number plus Text name, a Column of Cards, or Texts separated by a Divider under a "Scenes" label stays quiet (probed). Narrow by design (`:1-10`); the recorded shape is covered.
- decide: `.sdlc/tickets/0362-*/handoff.md` Actual is stale (the solo flagged it): the authored round 2 drops the `scenes` Column that turn 1's recorded update appends `s2` to, so turn 1 now fails `action-updates-surface` as well as `expect-component`; both are pinned to T-0362 (the live re-record).
- note: `composite-moments.test.ts:787-796` opens both gates at once for order history and chat history (the changelog case isolates the heading gate). Probed the game gate alone against HEAD: a non-game "Reading notes" card with a "Journal" label over two numbered Texts yields `[]`, and the same card with "Quest" added to its title yields `['TIMELINE_MISSING']`, so the game gate bites on its own.
- note: repair wording (`composite-moments.ts:238`) follows the standard row pattern and matches `site/agent-content/skills/quest-log/SKILL.md:12` ("a Timeline quest log, append one item per scene"); the one prop it names, `label`, is Timeline's (`check-contracts.test.ts` ROW_PROPS). Judged against the other families it fires on (journal, chronicle, adventure log), "scene" and "order played" read as game terms, which the GAME_WORDS gate keeps it on apart from the `adventure` case above.
- note: `composite-moments.ts:366` reads a Card's own `title`/`label`/`text` as a heading, and the "Card title" test case (`composite-moments.test.ts:647`) ships `{ component: 'Card', title: ... }`, but the catalog's Card has no `title` property, so that branch is reached only by an invalid payload; harmless.

## T-0362: Re-record the board-less game smoke replays after T-0358 (2026-10-18)

- note: The `source` field in each fixture names `2026-10-18.jsonl:N` with no round path, so the round link lives only in the test header comments. This is the existing `--from-trace` format.
- note: T-0365 and T-0366 were stamped in this worktree and may need renumbering on landing (solo report).
- note: `.sdlc/tickets/.0366-boardless-move-prose-only/handoff.md` says ACTION_NOT_APPLIED exists "only for Battleship and the word game and the Concierge". `personas/croupier/checks.ts` also uses it.

## T-0364: ResultCard composite moment fires only beside a BoardGrid (2026-10-18)

- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:121: decide: the merged GameHud row's board-less gate is narrower than at T-0358. `GAME_WORDS` drops round, rounds, turn, turns, level and player, and the GameHud row now reads it, so a board-less strip of two stat Badges beside "Round 3 of 5", "Your turn" or "Player one to move" fires GAME_HUD_MISSING at base and stays quiet on the built tree (probe on both trees; "Level 2" and "Quest" still fire through hp and quest). Recorded impact is nil: the sweep below finds GameHud NEW 0 LOST 0 and the T-0358 tests pass. The brief said the GameHud behaviour must not change; this is a deliberate review item (solo report item 2) with an observable effect, for the conductor to accept or revert.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:349: decide: the `end` phrases that are not also in `words` (deal struck, final score, rematch, new game, new adventure, new quest) never fire on their own: line 349 returns `[]` unless `m.words` (game over, you win/won/lose/lost, the word was, play again) matches the surface, and line 375 reads `end` only after that. Persona-realistic endings that stay quiet on the built tree: Negotiator "Deal sheet: Brass lantern" + "Deal struck at 180 silver. Pleasure doing business." + a "New game" Button (alone and beside its GameHud); Dungeon Master "Your quest ends here, hero." + "New adventure"; a "Final score 9 / 10" Stat under "Trivia night" + "Rematch". With the skill-prescribed "Play again" label each fires (the Mentalist needs a game word on the surface too: "The answer was a cat" or its GameHud title; "Got it! It was a cat, in 12 questions." + "Play again" alone stays quiet). A Goal gap for the named personas, no criterion names it.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:198: decide: the gate is three word lists, so a stray "game" opens it: a receipt (h4 "Order #881 confirmed", a Total DescriptionList, caption "Thanks! Play again in our loyalty game next week.") and a podcast card (h4 "Podcast player", "Episode 42: the game show that changed TV. You win nothing, but you learn a lot.", "Play again") both yield RESULT_CARD_MISSING; the handoff's receipt and podcast negatives pass only because they hold no game word. The sweep shows no such misfire in any recorded surface.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:175: note: sweep of both rows, built tree against base 8421bba99, same scratch script importing each tree's `composite-moments.ts`: 728 eval-run reports (`.sdlc/evals/rounds/*/runs/*/report.json`) plus 69 replay fixtures, 3549 turns, 3080 tool-call rounds plus each turn's shipped lines, and 96 corpus records, 6562 surfaces judged through `semanticSurfaceViews` with the prior turns replayed. GameHud: base 97, built 97, NEW 0, LOST 0. ResultCard: base 2 (admiral-concede-sonnet-1 t3, kept), built 7, NEW 5, LOST 0. The five new hits are Lexicographer give-up turns in 2026-10-15-r2-presets (`lexicographer-give-up-sonnet-1` t3 r0, r1, shipped; `lexicographer-invalid-then-replay-sonnet-1` t4 r1, shipped): a "Game over" Badge plus "The word was SLAIN." / "The word was: night" with no board, each step `expect: ['ResultCard']`. All true positives; they overlap the hidden-state RESULT_CARD_MISSING, which `produce.ts:1230` dedups by code.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts:475: note: fresh probes on the built tree beyond the handoff's cases: 22 board-less endings, 17 fire (misses listed in the line-349 note plus "Color duel" + "Game over: a draw after five rounds." + "Rematch", where duel and rounds are no game words by design); 21 non-game or mid-game surfaces (KPI dashboard, receipts, bookings, loyalty tier, media player, quest progress, quiz mid-run, mid-haggle, twenty-questions mid-game, sports result, game store, settled CardTable, PlayingCard showdown, Toast beside a GameHud, fitness, newsletter, game-night booking, sports bar), 19 quiet, the two misfires above.
- decide: site/agent-content/personas/quizmaster/workflows/grand-reveal/WORKFLOW.md:12: note: the solo's item 6 claim holds: "the Modal holds ONE ResultCard ... whose child is a Play again Button", so a QuestionCard does not stand the row aside and the quizmaster final-round case belongs among the positives.
- decide: .sdlc/tickets/0364-resultcard-moment-board-only/handoff.md:31: decide: the acceptance criteria were written by the solo (the base handoff ends at Constraints), as in T-0358; this verdict judges builder-authored criteria against the Goal, and the Goal's three personas fire on the handoff's phrasings and on the skill-prescribed "Play again" ending, with the gaps noted above.
- decide: /var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui-7439b17c/0364-verifier-L3: note: the scratch probe files (sweep.ts, probe.ts, probe2.ts, probe3.ts, built.json, base.json, logs) stay in place; the `rm -rf` of that directory was denied by the permission system three times. The throwaway base worktree is removed.

## T-0365: Board-less GameHud check misses a stat strip of uncued Badges or Texts (2026-10-18)

- note: sweep of 1654 JSON/JSONL files (probe fixtures and replays, `.sdlc/evals/rounds`, a2ui corpus, examples, tools, live-agent, agent, site/agent-content), 14608 `updateComponents` batches, GAME_HUD_MISSING on built 155 vs base 133; the 22 new hits are all the T-0362 Mentalist ask-1/ask-2 and Dungeon Master ask-1 strips (round fixture.json, report.json, traces/2026-10-18.jsonl, the two replay JSONs); lost hits none. Matches the builder's claim.
- note: 12 fresh board-less positives all fire on built (4 fired at base): Badges "Question 3/20" + "Confidence: medium", "Guesses 2 of 6" + Stat Lives, Column of Texts HP/Gold/Lives, Stat Score + Text "Attempts: 2 of 5", bound Texts in a Row read from the data model, "Turn 4/10" + "Score: 120" under "Round 4", two Cards each wrapping one stat Text, "Q 2 / 20" + Badge "Confidence high", Texts "Hit points: 9" + "Gold: 2", plus the T-0358 Stat, DescriptionList and Progress shapes.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:158 decide: of 15 fresh non-game strips 11 stay quiet; three fire on built only because `HUD_GAME_WORDS` takes a bare "round": "Candidate: Jane Park" + Badge "Interview round 2" + Texts "Confidence: high", "Score: 4/5"; "Boxing workout, round 3" + Stat Score + Text "Attempts: 2"; "Funding round 2" + Texts "Confidence: medium", "Asking: $2M". The same three with Stats instead of Texts fire at base too (the T-0361-review round/turn gate), so the Text rule joins a pre-existing class rather than opening a new one; without the round word the hiring Texts stay quiet.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:358 decide: one new-class misfire, contrived: a Column of narration Texts "Gold 0 is what you have left after the toll." and "HP 4 remains, barely." under a "Dungeon" title fires on built (quiet at base) because `opens` accepts a sentence that starts with a stat word plus a digit. This is a different shape from criterion #1's narration control (gold and HP mid-sentence), which passes and goes red under the m1 mutation.
- decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:358 note: a miss at the edge: counter Badge "Q 2 / 20" beside a Text "Confidence high" (no colon, no digit) stays quiet, since `opens` needs `:`, a digit or end after the stat; "Confidence: low" and the recorded strips are covered.
- note: "Game studio KPIs" with Stats Score and Confidence fires on both trees (T-0358 behavior, unchanged).
- note: the two throwaway worktrees were removed; `rm` of the empty prefix `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0365-verifier-L3` and of the scratch scripts under `/var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui-7439b17c/0365-verifier-L3` was denied by the permission hook, so those two folders remain.

## T-0366: A board-less game turn answered in prose alone passes the producer (2026-10-18)

- decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:508: decide: greetings outside the SMALL_TALK list fire at an open game target with no update: "Good morning, shopkeeper.", "Greetings, merchant.", "Good evening, Dungeon Master.", and so do "Let me think about it.", "Hmm.", "Describe the room." and "Good game so far." (probe run; the classifier defaults to move). The repair then asks for a surface update the turn has no move for.
- decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:542: decide: a non-game surface whose text carries a GAME_WORDS word is gated in: a storefront with "Board games and puzzles, 20% off" and a settings page with "Game settings" both get ACTION_NOT_APPLIED on "Add that one to the cart." / "Turn it on." with a declared target and no update (the heuristic is shared with T-0358 and T-0364).
- decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:536: note: a greet card declared as target (`greet-1`, text "The dungeon awaits") on a turn that creates `quest-log` without retiring the greet card fires ACTION_NOT_APPLIED; retiring it in the same turn passes. Recorded smoke turn 0 declares no target, so the replays are unaffected.
- decide: scripts/e2e-admin/probe/replays/smoke-negotiator-first-offer-haiku.test.mjs:22: note: the replay still asserts two red probe checks but no longer carries an `// expectedFail:` comment (README "Fixtures and regressions" pairs a pinned-red list with one); seven other replays already do the same and no script reads the comment.

## T-0345: Haiku poker and blackjack openings deal on the first turn instead of asking for a stake (round 10 cluster B) (2026-10-18)

- note: the seed-digest and manifest updates follow the deliberate-seed-change flow. The persona-row digest `sha256:2cdf692d...` in `site/pages/agent-admin-seed-digests.test.ts` equals the manifest `seedDigest` and `seedVersion` 16. `PRESETS_DIGEST` moved with it, no other persona row changed, and the digest test is green. I did not independently recompute the NEW arm's trace digests against the compiled persona; I relied on the conductor's note that the code review confirmed they match.
- note: the throwaway worktree is removed. A refused `rm -rf` left `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0345-verifier-L2/.owner.json` only.

## T-0359: The Stylist answers a palette ask in prose with no token surface (2026-10-18)

- decide: `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/wave-w359/packages/agent-ui/a2ui/src/catalog/composite-moments.ts:668-679` decide: form (1) counts an all-digit code on a list line, so a list of references fires on the Stylist: `- Order #482913\n- Issue #969\n- Ticket #123` counts 3 (`#969` and `#123` read as 3-digit hex). Within the pinned form; the sentence form is pinned quiet.
- decide: `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/wave-w359/packages/agent-ui/a2ui/src/catalog/composite-moments.ts:663` note: `FOR_ROLE` also takes `as` (`Teal as the primary`), beyond form (4)'s "for"; a simile fires: `White as snow, red as blood and black as night.` counts 3.
- decide: `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/wave-w359/packages/agent-ui/a2ui/src/catalog/composite-moments.ts:663` decide: form (4) reads generic color advice as a palette: `Blue for banks, green for health and red for alerts are the clichés to avoid.` counts 3. Within the pinned form.
- decide: `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/wave-w359/packages/agent-ui/a2ui/src/catalog/composite-moments.ts:664-667` decide: form (5) counts any list line opening on a color, so a per-color contrast report fires: `- Navy fails AA on grey\n- Coral fails AA on white\n- Sand fails AA on cream` counts 3. Within the pinned form.
- decide: `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/wave-w359/packages/agent-ui/a2ui/src/catalog/composite-moments.ts:670` decide: `CODE` strips braces and fenced blocks only, so braceless CSS declarations with three lettered codes fire: `color: #1f3a5f; background: #f4efe6; border: #9cc3e0` counts 3. The criterion's negative names a CSS rule; the pinned quiet row is the braced form.
- decide: `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/wave-w359/packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts:1311-1351` decide: one verifier-6 phrase is not a `REPLIES` row: `Navy #1f3a5f for primary, coral #ff6f61 as accent, and a sand background.` counts 2 and stays quiet (two hex codes, one `PART_AFTER`); the conductor pinned the other decide rows and left this mixed shape.
- decide: `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0306-verifier-L3/base` note: a stray throwaway worktree from another ticket's verifier still sits under the tmp root (`git worktree list`); not touched here.

## T-0363: GameHud is outside the feed scope, so an ask-surface game cannot answer GAME_HUD_MISSING in place (2026-10-18)

- decide: `scripts/e2e-admin/probe/replays/mentalist-ask-hud-beside.test.mjs` decide: green at 570b7835f too (the producer already ships an ask plus another surface, and its FEED_SCOPE is `ask-1:Progress`, no GameHud), so it does not discriminate the grammar or hint change; the negotiator replay bites only through the probe's target-settle branch. FEED_SCOPE_HUD_HINT is observed by produce-loop case 3 alone; a GameHud-on-ask replay would be the live-shape pin once a re-record shows one.
- decide: `packages/agent-ui/a2ui/src/agent/prompt-budget.ts:31` note: the comment's worst case `141 949` measures 141 948 on the shipped grammar (the `:58` em-dash removal took one char after the measurement); the budget 142 300 holds either way.
- decide: `.sdlc/runtime/tasks/0363-gamehud-feed-scope/architect-L1-2.md:114` note: the premise "that round draws GAME_HUD_MISSING in replay" is off by a round: the recorded round 0 draws `FEED_SCOPE` (observed), and the smoke test's `['GAME_HUD_MISSING']` is the code fed back into its final round (`produce.ts:1962` reports `failuresFedBack` of the last round only). The builder's Open item states this correctly and the fixture header says FEED_SCOPE.
- decide: `scripts/e2e-admin/probe/replays/mentalist-ask-hud-beside.json` note: carries one em dash inside the quoted twenty-questions workflow description copied from the recorded request text, not authored prose.
- decide: `.sdlc/runtime/tasks/0363-gamehud-feed-scope/solo-report.md:28` note: says `skips.md` is untracked; it is committed in 0ee8dfffe.

## T-0367: The guidance-conflict hole-card step expects a table update a correct refusal never sends (round 11 cluster G) (2026-10-18)

- note: the ticket Repro command (`npm run chat:probe -- --replay .../routing-guidance-conflict-haiku-1/fixture.json`) still prints `FAIL expect-component turn 3`, because the archived fixture embeds the old step expectations; the fix is proven through the scenario steps in `routing.test.mjs`, not by that replay, and archives must stay untouched.
- note: stated limit, a refusal that replaces the table in place with non-table components on the hole-card turn is not judged on that turn; it is caught only if Stand then updates no surface holding CardTable (`routing.ts:14-16`).

## T-0368: POKER_DEAL_MISSING judges a PlayingCard template over an empty hand as undealt (round 11 cluster H) (2026-10-18)

- decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:574-586 decide: the hold'em route reads only the current turn's words (`betStepTurn`), so a later turn on an unnamed, undealt stake-first table can read as blackjack; a client Deal press answered with `/bet` alone on such a table probed `[]` here, and no recorded capture flips (0 of 2444).
- decide: .sdlc/evals/rounds/2026-10-18-r11-targeted/runs/regress-croupier-texas-holdem-haiku-3/fixture.json note: its last turn has no rounds, so the `produce()` replay skips it (one of the 45 non-derivable fixtures); criterion 2's recorded replays never exercise the :222 round, only the inlined test and the direct capture judgment do.
- decide: .sdlc/tickets/0368-r11-poker-deal-template/handoff.md:36 decide: the builder edited the acceptance criterion in the fix commit e50ac7e90 (a tightening); a criterion change by the lane that builds against it is worth a ruling on who may edit the handoff mid-lane.

## T-0369: LONE_BUTTON_FRAME sees through a one-child Row as the probe render lint does (round 11 cluster I) (2026-10-18)

- note: scripts/dogfood-compose.mjs:257 scoping by innermost array means a Button defined in a spread or a separate array no longer resolves; no current source loses a hit (the gate is green, and the allowlists have had no lone-button entries before or after), so this is not a real loss today.

## T-0370: The pontoon scenario does not stick under 15 (round 11 cluster J) (2026-10-18)

- note: the handoff has no `## Acceptance criteria` section; criteria above were taken from Goal, Repro, Expected and Constraints plus the conductor brief.
- note: round 1's Stick (after Twist) has no follow-up step (solo-report.md Open), so a refused stick there could still strand Deal again.

## T-0371: A Croupier check reads poker pot and bankroll arithmetic (round 11 cluster K) (2026-10-18)

- decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:1311 decide: a deal_again turn that opens the next hand on a fresh surface and also touches the pressed table with an updateComponents alone judges the pressed table as "reset in place" on its unchanged click-time chips: probe E1 (table-1 at click time bankroll 960 pot 120 unsettled, table-3 opened right at 950 with 20 in the pot, table-1 gets a status "Hand over") fires POKER_CHIPS_MISMATCH on `table-1:/bankroll` saying it "opens with 120 in the pot". No recorded round hits it (0 of 3258 replayed rounds). A guard that skips the pressed surface when the turn creates a fresh surface (the `fresh` rule `newRoundFindings` uses at :736) or when its data model equals the click-time one would close it.
- decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:767 note: the `!isPokerTable(view)` gate leaves a hold'em CardTable whose only poker signal is its title (empty hands, no pot key, bet bound to `/bet`) under the blackjack carry-over: probe B7 (opens 950 after settling at 960) still gets BANKROLL_MISMATCH asking to write 960. Same as base; no recorded round hits it (BANKROLL_MISMATCH count identical base vs built).
- decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:1335 note: two misses by design, not misfires: a partial debit (typed "Bet 40.", pot 20 to 100, bankroll 960 to 940) stays quiet because the move branch requires `bankroll === prior.bankroll`, and a typed "Deal again." that opens the next hand at the settled bankroll with the blind in the pot stays quiet because the new-hand branch at :1311 runs only on an action turn.
- decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:1216 note: merge with T-0368 (wave-w368, e50ac7e90): `git merge-tree --write-tree fix/0371-poker-chip-check fix/0368-poker-deal-template` is conflict-free (T-0368 hunks at checks.ts 515-620, 704-713, 985-1000 and checks.test.ts 882; T-0371 hunks at checks.ts 38, 763-766, 1213-1352 and checks.test.ts 8, 1430, 1552); no symbol is changed on both sides; in a throwaway worktree of the merged tree the croupier tests pass (6 files, 183 tests, exit 0) and the root `npx tsc --noEmit` exits 0.
- decide: .sdlc/evals/rounds note: sweep of every recorded croupier round (20 trace files plus the say-turn prefixes of the croupier replay fixtures, 3258 rounds) through `croupierSemanticChecks`, base vs built: +27 POKER_CHIPS_MISMATCH (12 "Bet the pot." or blind-opening hits across r2, r4, r5, r6, r8, r9 and 4 in r11; all heads-up Omaha, hold'em or five-card draw tables; 26 shipped live as passed, the r8 :65 one already failed on NEW_ROUND_NOT_BETTING), 0 findings lost, every other code count identical. Fresh probes on the built tree: 15 drift hands fire (typed bet, call and raise; pressed bet, call and raise with priced amounts; typed and pressed fold that raises the bankroll; heads-up, named-blind and "you posted" new hands; CardTable-bound `/stack/chips`; string chips; a hold'em Card with Call and Fold Buttons), 20 correct or ambiguous turns stay quiet (showdown win, all-in run-out, opponent-only bet, opponent-only blinds 3-handed, stud bring-in, a check, a recap, a bust, string chips conserved, a bound stack debited beside a stale `/bankroll`, a conditional and a two-move typed turn, a fold that lowers the bankroll, a bet the opponent folds to, a correct debit, a correctly posted new hand, blackjack with a `/pot` key, the opening say turn, baccarat with a pot, a partial debit); BANKROLL_MISMATCH still fires on blackjack, baccarat and roulette and skips a hold'em table with a pot and an Omaha CardTable dealt with a pot (the :65 shape gets POKER_CHIPS_MISMATCH instead). The probe script at base leaves all 15 drift hands and the :65 shape unfired (18 BAD lines), so the probes bite.

## T-0372: Re-vendor the geometry resolver from the mathematical-design-system skill, no visual change (2026-10-18)

- decide: scripts/foundations-census.mjs:34 fix-now: `SKIP_FILE`'s `(?:^|\/)vendor\/` runs on the absolute path and exempts every file under any `vendor/` segment, not only the two byte copies; a repo-authored `.ts` with `style.height = "13px"` planted inside `tokens/vendor/mathematical-design-system/` left the gate green (exit 0) while the same literal beside the folder reds it, and the repo-authored `scale.d.mts` and `curvature.d.mts` there are unscanned (no findings today when the rules run on them directly, so the fix keeps the gate green). Replacement: match `(?:^|\/)tokens\/vendor\/mathematical-design-system\/(?:scale|curvature)\.mjs$` against `relative(root, full)` in `walk()`, and extend the selftest case so a `.d.mts` beside the two copies is scanned.
- decide: .claude/docs/references/geometry-sizing-spec.md:13 fix-now: still says the skill's `scale.mjs` is "vendored to `@agent-ui/shared/src/tokens/scale.mjs`"; since T-0372 that file is the frozen former revision and the skill's current file sits under `tokens/vendor/mathematical-design-system/`.
- decide: .claude/docs/references/geometry.md:9 note: with tokens.md:6, says the sheets are generated from `scale.mjs` alone; two resolvers feed them now (AGENTS.md:59 has the current wording).
- decide: packages/agent-ui/shared/src/tokens/foundations.gen.css:1 note: header still reads "from scale.mjs", kept for byte parity; the builder defers the wording to T-0373.
- decide: .sdlc/tickets/0372-foundations-geometry-revendor/handoff.md:17 note: the Do says "keeping the current one as `legacy-scale.mjs`" while Non-goals exclude renames and criterion 1 pins `tokens/scale.mjs` unchanged; the build followed the criteria, so the Do line is the stale one.
- decide: packages/agent-ui/shared/src/tokens/foundations.test.ts:57-70 note: the nudge table omits `titleBump.sm` and `titleBump.lg`; both move the sheet (observed), so adding them is one line each.

## T-0373: Adopt the skill's geometry structure: type roles, control surface anatomy, spacing roles, emit-time rounding (2026-10-18)

- decide: `.sdlc/runtime/tasks/0373-foundations-geometry-structure/screens/` holds a `main2` capture for table-demo and command-modal-demo tall only; the main-against-main button-demo 1280x900 capture the #7 exemption cites is not archived. My diff shows 29 pixels at max channel delta 1 on rounded control edges and the 1280x2400 capture of the same page is 0-pixel identical, so I passed it; archive a `button-demo.main2.png` if the exemption is to stay citable.
- note: `packages/agent-ui/shared/src/tokens/foundations-bridge.gen.css:94,118-119`: the legacy block's `initial` lines for the kickers and the old labels are belt and braces; removing `--md-sys-type-group-kicker: initial;` in the throwaway worktree kept the browser test green because `--md-sys-n: initial;` (line 74) already invalidates every derived role there. Harmless, not a defect.

## T-0375: game-table-chrome teaches a Row around a lone Deal again Button, against grammar.md:188 (2026-10-18)

- note: site/agent-content/personas/croupier/agent.md:60 the persona line still says "actions row a lone Deal again button"; a deliberate follow-up per architect-L1-3.md:74 and :93, outside T-0375.
- note: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:370 the NATURAL_ACTIONS repair string still says "leave only the Deal again Button in the actions row"; the same deliberate follow-up, outside T-0375.
- note: packages/agent-ui/a2ui/src/agent/prompts/mini-skills/game-table-chrome.md:8 the body sits at 799 of 800 chars, so its next edit must cut text (architect-L1-3.md:80).
- note: .claude/docs/adr/0172-persona-catalog-composition-intake.md:110 quotes the old "action bar = a Row of Buttons" clause; frozen ADR history, left as is by the ADR rule.

## T-0376: Live round 12: measure the round 11 wave (T-0345, T-0359, T-0363, T-0367 to T-0371) (2026-10-18)

- fix-now: `.sdlc/evals/rounds/2026-10-19-r12-targeted/report.md:39` "r11 14 of 53": the r11 denominator counts 8 plain opening "Deal" Buttons (r11 lines 21, 92, 101, 173, 177, 184, 252, 260, blackjack bet strips) that are not Deal again Buttons; under the same definition as the r12 44 it is 14 of 45. The 12 and 14 lone-Row counts are unchanged, as is the verdict.
- fix-now: `report.md:33` "No earlier live baseline" for T-0363 is stale: `2026-10-18-t0362-smoke` (commit 1f6873fcae, before T-0363 merged in 6e347b8c2) ran mentalist and negotiator once each, both failing `no surface this turn updated holds GameHud` / `missing GameHud`, a 0 of 2 pre-fix baseline that strengthens "holds".
- fix-now: `report.md:33` names `ask-1` for all six openings; :200 (`smoke-negotiator-first-offer-haiku-3`) pairs `hud-1` with `ask-2`.
- decide: `.sdlc/evals/README.md:31` attributes r12 to T-0343: `run-capped.ts:526` `roundTicket` takes the first ticket id the round names and finds plan.ts's "(T-0343)" attribution in the generated `live-commands.sh` header (round.json names none). The fog record says T-0376. Same for the t0362-smoke row.
- note: `report.md:5` "$0.58" is the judge log total; the 36 judged files sum to $0.5485, the rest is the two unparsed judge replies that no file records.
- note (T-0374 step 6): ui-suggestions.css:38 hard-codes the chip radius at h/2, so suggestion chips ignore data-radius. Kim 2026-10-19: note for later.

## T-0382: Blackjack: A2UI update renders before the turn summary (2026-10-19)

- note: conversation.browser.test.ts was not run (not a named criterion); it has no textDelta use.

## T-0374: Visible geometry changes from the skill model: glyph, field label, tiers, density heights, curvature presets (2026-10-20)

- note: `status-stream.css:54` and `status-stream.md:374` still describe the label column as "2n + n"; it is mark-box + n, which differs only at n 4 and 5 (carried from the first verifier run).
- note: the new glyph test pins only the minus symbol in a 16px cell; the dogfood lint carries the broader coverage.
- note: `scripts/lib/foundations-model.mjs:17-22`: the LEGACY_PATH comment is restated and accurate; `groupKicker` correctly stays on the legacy path per the handoff.
- note: Kim's mockup-approval gate (b) on screens/step-3/side-by-side.png stays open and is not a criterion here.
- note: PARITY_SHA.bridge did not move. The handoff said to move both, but the bridge sheet reads no tier row and generate --check is green, so only the foundations sha moved, as the builder reported.
- note: `.claude/docs/references/foundations-derivation/derive.out.md` still quotes 10/2/2/1. It is the byte-pinned history output and the handoff keeps it frozen.
- decide: site/pages/sizing.ts:25 fix-now: still says `data-density (compact, default, spacious) moves container spacing only`; `site/pages/sizing.ts:185` says `[density] ... moves only container margins and gutters`. Outside criterion 5's path list; the builder flagged it too.
- decide: packages/agent-ui/components/src/controls/button/button.css decide: the builder's gate (b) observation stands for Kim's mockup review: ui-button's radius is `2 * --md-sys-radius` (2n), not `--md-sys-control-radius` (h/2), so at spacious (4.5n) and loose (5n) the corner is no longer a full pill while combo-box and menu stay pills.
- decide: scripts/lib/foundations-model.d.mts:1 note: the header still reads `(T-0372, T-0373)` after this step added `controlMargin`, `marginPerNAt`, `containerUnit` and `widgetOverGroup`.
- decide: scripts/generate-llms-full.mjs note: it ignores `--check` and writes the file (the tree stayed clean because the bytes matched); `site/lib/llms.test.ts` is its gate.
- note: packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md:34-36 uses the debate wording, not the Do's planner clause, as the handoff Notes direct.
- fix-now: `packages/agent-ui/components/src/controls/combo-box/combo-box.css:119`, `select/select.css:72`, `menu/menu.css:34` and `:116`, `multi-select/multi-select.css:44` and `:86` still say "the pill h/2 = 2n" / "the row's 2n" beside a `--md-sys-control-radius` read that is now A x h/2 (n under balanced); stale comments only, the values follow the preset.
- fix-now: `packages/agent-ui/code/src/editor/editor.css:60` comment "the single-line control radius 2n (ADR-0245 Amendment 5)", `components/src/controls/column-chart/column-chart.css:60` "the group radius n + c" and `card/card.css:98` "derived: 3n" predate the amounts (now A x (n + c) and A x 3m).
- decide: `packages/agent-ui/components/src/controls/suggestions/suggestions.css:38` hard-codes the chip radius at h/2, so `ui-suggestions` chips ignore `data-radius`; `pill-radius` is now a lower bound and passes them (builder flagged it too).
- note: `packages/agent-ui/shared/src/tokens/foundations-bridge.gen.css:27` aliases `--md-sys-shape-corner-base` to `--md-sys-card-radius`, so every corner-base consumer (code, row, choice-card, calendar panel, nav-rail flyout, agent-admin entries) halves from 24 to 12 at the root; step 8's `npm run test:visual` owns the remaining baselines.
- note: the frames in `after.png` that look rounder than the card are site demo chrome by construction: `site/pages/containers.css:121` (`.event-log`, card radius + card margin) and `:54` (`.demo-figure`, card radius + its pad), both concentric reads of the token, not a card defect.
- fix-now: `packages/agent-ui/components/src/controls/__screenshots__/control-rule.browser.test.ts/` (git-ignored, 20:06, from a failing chip-level run) reds `site/lib/controls-coverage.test.ts` ("has a matching site page"); `npx vitest run site/pages/tokens-doc.test.ts site/lib packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets-freshness.test.ts` is `1 failed | 1059 passed` on that alone. Delete the ignored folder (rm is refused for the verifier).
- fix-now: `.claude/docs/references/tokens.md:86` still states the pre-ruling rule ("on a side no adornment occupies"), as do the comments at `packages/agent-ui/components/src/controls/button/button.css:49`, `button-geometry.browser.test.ts:51` and `button-geometry.test.ts:91`; under Kim's ruling a label between two adornments pads W + C on both sides, so the wording is stale (`geometry.md:100`, `button.md:67,93` and `button.css:171,198` carry the ruled wording).
- note: `packages/agent-ui/components/src/controls/button/button.css:242-244` the em-dash removal left stray punctuation: `• icon , a content icon` and a line opening with `, never the icon size`.
- note: the evidence PNGs (19:03) predate the ruling commits `3d33eee87` and `985016e93`, and button-demo has no icon + label + glyph specimen, so the ruled between case is proven by `button-geometry.browser.test.ts:200-204` and `control-rule.browser.test.ts:268-271`, not by the screens.
- decide: `packages/agent-ui/components/src/controls/button/button.css:42` keeps `--ui-button-gap` at c, not the contract's E = m/2 (equal only at product md regular); `button.css:232-238` gives a role-less adornment the icon centring padding, which the Do did not name.
- note: the 4 conversation.browser reds are filed as ticket 0383 (`.sdlc/tickets/.../0383-conversation-browser-reds/handoff.md`); the first run of that file leaves a git-ignored `packages/agent-ui/app/src/controls/conversation/__screenshots__/` folder. I deleted it before `test:visual`, and the tree is clean now.
- note: `NODE_OPTIONS` in this host points at a missing cmux `restore-node-options.cjs`, so every Node gate needs `unset NODE_OPTIONS`.
- note: the builder's recaptured PNGs only move button label positions (step 7 compensation); a glance by Kim is optional.

## T-0195: Confirm and receipt pattern: promote BookingConfirmation to the default catalog with total, actions and a settled state (2026-10-20)

- note: `packages/agent-ui/a2ui/tools/registry/generate.test.ts` is green at bd97fbbcd (10 passed) and red on the built tree (2 failed: `ui-confirm-receipt` is `uncatalogued`; `site/capability-registry.json` and `site/public/capability-registry.json` stale, "Regenerate with `npm run generate:registry`"). Not filed as a plan defect: the uncatalogued leg is the missing catalog row the handoff declares red by design until step 3 (lines 62-63), so no regen in step 2 can turn the file green, and step 3 already names `npm run generate:registry` (`step-3/handoff.md:52`) and this test in its validation scope (`:66`).
- decide: `.claude/docs/spec/genui-surface.spec.md:5` and `:794`, `.claude/docs/lld/genui-dogfood.lld.md:185` still say 30 100 while `packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts:98` is 30 500; the builder left them for the step that re-measures last (step 3 moves the budgets again).
- decide: `packages/agent-ui/components/src/controls/confirm-receipt/confirm-receipt.ts:268` removes the actions row on Confirm while the Confirm button holds focus, so focus drops to the body (builder-flagged gap; no criterion names it).
- decide: `confirm-receipt.ts:226` fixes the record order at items, rows, total, ref, so a delivery row above an order's items (as the mockup draws it) cannot be expressed; a design call for Kim the builder flagged.
- note: `site/pages/__baselines__/_page.visual.browser.test.ts/docs-chrome-narrow-open-chromium-darwin.png` is unchanged from base and the capture shows Feed & status through Data & reporting; the 'Form composition' group is outside the captured viewport, so the new row needed no re-mint.
- decide: `site/lib/component-preview.ts:377` fix-now: the comment says rows, items, total, data and the two actions "ride SAMPLE_TREES", but no SAMPLE_TREES entry for ConfirmReceipt exists (only lines 377-378 name it); the preview gate did not require one, so reword the comment or add the entry.
- decide: `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/confirm-receipt.md:6` decide: the module teaches the right shape (totalLabel plus totalPath, status bound to a path holding pending, no Button), but `grammar.md:82-85` still teaches the confirm-step receipt as ONE DescriptionList inside an ORDINARY ask with a single commit Button (`grammar.md:76-78`), and `grammar.md:97-103` describes the closing-turn settle as strip Back/Confirm buttons and add a Badge; on a confirm turn the model holds both. ConfirmReceipt is also FEED_EXCLUDED, and the module does not say it lives on a canvas surface, never a feed ask. Grammar is byte-pinned, so reconciling it is a deliberate recapture edit.
- decide: `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/confirm-receipt.md:6` note: "rows [...] and totalPath (with totalLabel) name keys in data" reads as if totalLabel also names a data key; it is the displayed label.
- decide: `packages/agent-ui/a2ui/src/catalog/default/selection.json:1222-1236` decide: the builder dropped the Card edge in both directions, where Kim's ruling kept ConfirmReceipt -> Card one-way. The deviation is forced: `selection-guidance.test.ts:105-107` holds every base edge reciprocal with an empty exemption set (negative control at `:208-213`), and the seeded games fixture at `:239-247` appends Card -> Dice onto the real base, so a fourth base Card edge composes to 5 and trips `selection-guidance.ts:231` (NOT_FOR_MAX 4 at `:67`). Kim confirms the no-Card outcome, or retires one of Card's Column, ServiceCard or ProductCard edges to make room for the pair.
- decide: `.claude/docs/spec/a2ui-catalog.spec.md:263` note: "the games domain's appended one" is the seeded test fixture above; no shipped games domain sidecar exists (`catalog/domains/index.ts:4`, empty in W0).
- decide: `packages/agent-ui/a2ui/src/catalog/default/selection.json:807` note: DescriptionList's intent "a receipt or record summary" still overlaps ConfirmReceipt's; the new reverse edge is what disambiguates them.
- decide: `packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts:149` keeps `['BookingForm', 'BookingConfirmation']` although the Do asks to add ConfirmReceipt. The builder's reason holds: `surfaceRequired(id, requires, moments)` at :125-128 passes that list as `requires`, and `semantic-check.ts:139-141` `gateChecksOnCatalog` drops a check whose types the catalog lacks; `grep ConfirmReceipt` on `catalog/a2ui-basic/catalog.json` and `personas/concierge/catalog.json` finds nothing, so the edit would silently stop `concierge-surface-required` on a2ui-basic--concierge. Any surface already satisfies the check (:131 `surfaces.length > 0`), so the Do's "accept ConfirmReceipt" intent is met with no edit.
- decide: `packages/agent-ui/a2ui/src/catalog/composite-moments.ts:364` `isSettledSignal` knows Badge, Card, CardHeader and heading Text only, so a settled ConfirmReceipt does not stand aside the way a Badge does; the Do does not name it. Candidate for the BookingConfirmation retirement follow-up.
- note: em dashes kept in edited lines, all in pre-existing text: `packages/agent-ui/a2ui/src/agent/prompts/grammar.md:91`, `site/agent-content/workflows/booking-flow/WORKFLOW.md:4` and `:12`, `packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts:122` (the retitled `it`).
- note: `site/agent-content/skills/cart-summary/SKILL.md:12` "on the same surface" and `site/agent-content/workflows/trip-plan/WORKFLOW.md:12` "on that surface" do not restate grammar's "a surface the turn's meta-line does not name as "ask""; the cart and itinerary surfaces are not asks, so they agree, but the link is unsaid.
## T-0196: Amount picker pattern (the missing Stepper): one bound number with chips, +/- or slider, bounds, step and one commit (2026-10-20)

- note: `.sdlc/tickets/0196-amount-picker/mockup/widget-{light,dark,400}.png` capture the demo page (two of the mockup's six tiles: shopkeeper chips, negotiator currency slider); the unit, no-commit, at-min and at-max states are covered only by the visual goldens `amount-picker-states-{light,dark}`, not by a parity capture.
- note: `packages/agent-ui/components/src/controls/amount-picker/amount-picker-model.ts:14` formats currency with the currency's own fraction digits (a bet reads "$250.00"), where `mockup-light.png` draws the bet tile as "$250"; the Design's Formatting codec rules, so the mockup is the one that differs.
- note: `packages/agent-ui/components/src/controls/amount-picker/__screenshots__/` is a gitignored leftover from the builder's failed WebKit run (outside my rm prefix); harmless to the tree.
- note: the two visual runs (#3, #11) end with vitest's "Tests closed successfully but something prevents the main process from exiting" after exit 0; pre-existing browser-runner behaviour, not this step.
- decide: packages/agent-ui/a2ui/src/examples/commerce-hospitality.ts:140-142 (`product-options-quantity`, a judged exemplar in packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl) still models the quantity as Field plus TextField `type:'number'` `min:'1'`; a quantity turn can retrieve it beside the new mini-skill.
- note: site/agent-content/personas/negotiator/agent.md:20-23 runs its changelog oldest first against the "newest first" rule in site/agent-content/AGENTS.md:35; pre-existing order, the new line follows it.
- note: site/agent-content/skills/cart-summary/SKILL.md:12 nests parentheses (`(name, an AmountPicker for the quantity (min 1, ...) bound to ..., line price)`); readable, verbatim from the handoff.
- note: the builder report gives crud-entry-list as 799 chars; measured 791 (body without the trailing newline, 790). Immaterial to the budget matrix.

## T-0193: OptionDeck: a general-purpose 'pick one to start' catalog pattern where each option is a selectable card (2026-10-20)

- decide: `scripts/dogfood-render-allowlist.json:4` the `demo/option-deck-demo#icon-box` entry rests on the 2026-10-20 mockup approval, not a recorded ruling (its ProductCard twin cites Kim's T-0338 ruling); the conductor confirms the 5n / 4n disc icon as pictorial art or the icon shrinks to the 2n icon box.
- decide: `packages/agent-ui/components/src/controls/option-deck/option-deck-model.ts:77` drops an authored option whose `value` is `"random"`, a fourth codec rule beyond the handoff's three; `option-deck.md:19-20` does not state it. Step 3's catalog row, semantic check and mini-skill need to treat `random` as reserved.
- note: `packages/agent-ui/components/src/controls/option-deck/option-deck.css:284` the row form fires under a 30rem container, while the grid's one-track threshold at widget / md is 2 x 240px + 12px = 492px, so a 480px to 492px container shows one column of stacked band-over-body cards; the mockup's 25rem would have missed the 400px column, as the builder notes.
- note: `site/public/llms.txt:92` is hand-written; `scripts/generate-sitemap.mjs` never writes `llms.txt` (grep finds no mention), and `site/lib/llms.test.ts` is green.
- note: `/Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0193-s2-verifier-L3` and the scratch dir `/var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui-7439b17c/0193-s2-verifier-L3` are left in place: both throwaway worktrees were removed with `git worktree remove --force` (none registered, `git worktree list` clean), but the `rm` of the leftover entries was denied by the permission system, the same refusal the builder reports.
- note: `packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl` `frontier-greet-card` (greetCardSeed, left unchanged per the handoff) still exemplifies the Row-of-Buttons greet the mini-skill now forbids, so a greet turn can retrieve an exemplar that contradicts its module until the judged `import-seeds --replace` follow-up lands.
- note: `site/pages/dogfood-render.browser.test.ts` (the nested-card walk over every catalog widget preview, now including the OptionDeck sample in `site/lib/component-preview.ts:946-958`) is browser-only and outside the criteria; not run here.
- decide: site/agent-content/personas/croupier/agent.md:35: criterion 1's `grep -q "OptionDeck"` is satisfied by the changelog line alone, so it can stay green with no picker in the prompt body. The body does carry the picker (verified by reading the diff); a future guard should grep the body for "pick_game" after the frontmatter.
- decide: the seed has no `PERSONA_SEEDS_BY_MODULE` entry and no disposition entry, departing from the handoff Do and its notes-fix. I verified the builder's reason: examples/index.ts:219-222 says persona-exemplars seeds are "page and gate fixtures only, never corpus candidates", `PERSONA_SEEDS_BY_MODULE` mirrors `allPersonaCorpusSeeds` (domain-seeds only), and `corpus/disposition-allowlist.ts` holds no persona-exemplars entries. Adding either would red the shelf-drift gate or be dead. tools/corpus passes without them.
- decide: agent.md line 57 foundation paragraph still says to pick a game at random when the player names none; the new sentence keeps random as the Surprise me card, so the two coexist, but the planner may want it reworded.
- note: the manual chat:probe on Haiku 5.5 and Sonnet 5.5 was not run (no key); the handoff folds it into the round 13 live run, so it is not a gate.
- note: Gates #3 and #5 passed on the first run. I did not run a negative control on the visual baselines; the visual gate bit in no run I saw red, so its discrimination rests on the vitest `toMatchScreenshot` harness. I viewed the baselines directly instead.
- note: The builder's scratch folder was already gone; my own scratch captures under the tmp prefix remain because the `rm` was denied by the permission system.
- decide: `packages/agent-ui/a2ui/src/agent/prompts/grammar.md:234` the stale-affordance rule still says "remove its action Buttons (or the row holding them)", while `grammar.md:51` and `greeting-card.md` now retire "greet cards" per that rule; a model retiring a greet deck has to infer that the OptionDeck is the affordance to strip. Not a wrong shape; a few words there would close the gap.
- note: `packages/agent-ui/a2ui/src/catalog/default/selection.json:1219-1222` the OptionDeck intents drop "template" from the handoff's sentence (the `INTENT_CHARS_MAX` 60 split); the mini-skill trigger list keeps it.

## T-0387: Croupier greet OptionDeck renders as a one-character-wide column with no cards (2026-10-20)

- note: surface-host.browser.test.ts (new T-0387 test) asserts the deck width, a one-line heading and four cards with width over 100px. Only the width assertion was seen to go red at base; the heading and card assertions were not independently shown to fail without the fix, though they sit behind the width check.

## T-0197: BookingForm field kinds (dateRange, radio, time, stepper) and sharing it with the Maitre d' (2026-10-21)

- note: dogfood-render was not run here; the handoff assigns it to step 3.
- decide: `.sdlc/tickets/0197-bookingform-kinds/render/widget-{light,dark,400}.png` are git-ignored (`.gitignore:65`) and exist only in this lane tree; the committed chromium baselines are byte-identical, so Kim's render evidence for step 4 is the three baselines unless the ignore is widened.
- note: `concierge.browser.test.ts:429-431` pins the radio and checkbox rows at 12px (`scale.mjs:33` `parts.radio = 2n` at widget md), not the "24px control rows" the Do names for every new kind; a choice row is the radio part's height by design and the goldens show the option text unclipped at the field size.
- note: `factories.test.ts:389-396` proves the "one scalar per path, two for a dateRange" aggregate structurally only (one named control per path; detached `values()` is `{}`), and the browser aggregate is observed for `covers` and `seating` only; no observed run reads `values()` for a `dateRange`'s two paths.
- note: `catalog.json:9` puts the `fields` description inside the `type` JSON-schema object; `PropDef` has no `description` key and no generator reads it (`generate-agent-assets.mjs`, `generate:registry` left their outputs unchanged), so it is a record only until step 4's `selection.json` teaching.
- decide: scripts/e2e-admin/probe/scenarios/routing.ts:39: decide: the concierge routing expectations (also round3.ts to round5.ts) still say `domains: ['concierge']` while a hospitality turn's trace now labels `agent: 'hospitality'` and `routingSeen().domains` is `['hospitality']`; the keyless replays are green, a live re-run or round 13 misses `routing-expect` for the concierge unless the expectations change or the probe sends `agent`.
- decide: site/agent-content/skills/hotel-booking-form/SKILL.md:12: decide: the library skill still teaches "ONE Card: a short form (a TextField type date ..., Select, Slider, Checkbox)" and `site/agent-content/packs/hospitality/pack.json:10` offers it to hospitality presets; a user adding it beside the domain gets teaching that contradicts "Never rebuild a booking form from primitives".
- decide: site/agent-content/seed-history.ts:29: decide: no concierge row for `a2uiLocalPatterns: 'concierge'` (seeded v5 to v19), so a pre-overlay store keeps that value flagged as a user edit after the v20 move to `a2uiDomains` (the builder reports `sanitizeLocalPatterns` plus `resolveEffectiveCatalogId` make the effective catalog correct; the flag is cosmetic). `site/agent-content/AGENTS.md` "Change seed text" asks for a history row when a bump moves a scalar store value.
- decide: .claude/docs/spec/a2ui-catalog-architecture.spec.md:68: note: still says "a BookingForm for `agent-ui--concierge`"; also `persona-catalog-composition.spec.md:163,459`, `.claude/docs/rubrics/a2ui-skill-pattern.md:38` and `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:55` name `agent-ui--concierge` / `personas/concierge`, ids and a path that no longer exist (specs and rubrics are not frozen; only ADRs are).
- packages/agent-ui/a2ui/src/catalog/domains/hospitality/selection.json:5: note: the Do's three new intents became two because `INTENTS_MAX = 3`; "reserve a table, spa slot, tour or room" and "date, time, choice and party-size fields in one form" were dropped.
- packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts:65: note: the restaurant's "What is on the menu tonight" now pins `frontier-service-gateway` and `domain-concierge-booking-request` first (T-0238 ranks the hospitality domain's own records first), marked "Known poor (T-0197)".
- packages/agent-ui/a2ui/src/catalog/domains/hospitality/checks.ts: note: the check ids keep their `concierge-` prefix under the hospitality domain.
- site/agent-content/workflows/booking-flow/WORKFLOW.md:12: note: wording judged as the conductor asked; every kind the two playbooks name (dateRange, dateSingle, time, radio, select, stepper, text, checkbox) is in the BookingForm `fields[].kind` enum of `domains/hospitality/catalog.json`, the sentence "The scenes (1) to (4) each ask ONE thing on the room arc; a form that collects several booking details at once is always that ONE BookingForm" keeps the rule from contradicting the Calendar, AmountPicker, RadioGroup and Checkbox scenes, and the prompt stack (`grammar.md`, mini-skills) names none of the old field list, so nothing byte-pinned contradicts it.

## T-0391: Agent tab: open fields, drawers for model roster and server tools, danger zone (2026-10-21)

- note: packages/agent-ui/app/src/controls/agent-admin/provenance.browser.test.ts:90-97 re-derives the expected drawer label with the same prefix-strip-and-capitalize transform as `drawerFieldLabel` (agent-admin.ts:5725-5731) instead of pinning a literal such as "Max uses"; the old assertion reds on the built code in both engines (see #5), so the loop demonstrably reaches the drawer fields and the change stands, but a literal pin would be the stronger shape.
- note: packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:3901 also shortens the `domain-list-label` headings ("Allowed domains", "Blocked domains"); no test asserts that text (the ACS-R10 loop covers `ui-field` only). The tool-drawer capture shows the short headings.
- note: .sdlc/tickets/0391-agent-tab-drawers/screens/built-agent-tab.png is an element capture of the Settings pane (856x3672) while the other three are full-page 1280x900 at DPR 2 (2560x1800). Observed in the four captures, for Kim's match verdict: the open Agent tab with the switch, Name, Tagline and Category disabled on the shipped preset (fork 1), the Default model select, Effort and Thinking, an inline "Manage models" with icon and label, Web search and Web fetch rows with Configure, Advanced and Danger zone closed; the Manage models drawer with the provider-grouped roster, On switches and the default row locked; the Web search drawer with Max uses, City, Region, Country, Timezone and the two domain lists with an inline "+ Add domain"; the Reset Agent confirm inset with a soft Cancel and a solid red "Reset Agent". Kim's three 2026-10-21 rulings are visible in them.
- note: em dashes in added lines of the ticket diff, for example packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:871 (the bankroll row comment), packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts:1733 (a describe title) and the moved `bankroll-row` and `settings-item` descriptions in agent-admin.md; most are moved or re-wrapped pre-existing prose.
- note: the two `vitest list | grep -q` red controls were not replayed in a vitest process at cfe2b5291 (no install in the throwaway worktree); the `git grep` at that commit finds no test titled "T-0391 layout" or "T-0391 drawer", which is what the grep would see.

## T-0198: Step flow pattern: step n of m, Back and Next, shared /draft data (2026-10-21)

- decide: the `backable-wizard` exemplar (`corpus/exemplar/v1_0/agent-ui.jsonl`) is still retrievable on concierge turns; the manual `chat:probe` should watch for a StepFlow mixed with scene resends.
- note: site/agent-content/workflows/booking-flow/WORKFLOW.md:4 keeps the pre-existing "Hotel domain" em dash in the rewritten description; the new body text has none (digest-bearing). (Appended by the conductor: tickets.py 0.25.1 dropped it as a path-prefix duplicate.)
- note: packages/agent-ui/a2ui/src/agent/prompts/grammar.md:66 and :234 keep pre-existing em dashes on modified lines; no added grammar text holds one. (Appended by the conductor, same reason.)

## T-0392: Composer effort menu: one selection idiom, aligned rows, glyph check, separator, contained focus ring (2026-10-21)

- note: `.sdlc/tickets/0392-composer-effort-menu/handoff.md` Title/Intent still say "Phosphor check" while criterion 1 and the conductor note settle on the `ui-glyph` check; the Outcome should carry the settled wording.

## T-0389: Stylist ContrastPair browser test: the verdict pill glyph is clipped (red at base) (2026-10-21)

- note: there is no recorded pre-edit red run in the artifacts dir. Red at base rests on the ticket's Actual line (17da4bcbe) and the T-0351 history.
