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
- The mathematical-design-system skill's live scale.mjs moved again (sha 55e5bb..., after 3c319761, the vendored pin). Not adopted; review the diff before any re-vendor.
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
