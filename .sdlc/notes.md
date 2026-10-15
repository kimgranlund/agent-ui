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
- Rubric 3 closed 2026-10-13 by a batched verifier (T-0132): attempt 1 failed entry and atoms with three defects (sm avatar initials 8.4px, badge and icon demos overflowing at 400px, doubled search icon); T-0133 fixed them (#1950); attempt 2 passed both, with base-sha red controls. Supersedes the "accept sign-offs" line above. Reports: .sdlc/foundations-look-verify/verifier-L2.md and verifier-L2-2.md.

## 2026-10-13 21:40 PT: stopped on the monthly spend limit (weekly limit resets Oct 17, 2am PT)
- T-0134 (pill radius, worktree wave-pr, branch feat/pill-radius-fields-badges): tokens and control CSS done, probe --strict green; WIP committed. Left: npm run check, census, unit and browser re-pins, goldens, screenshots, ADR-0245 Amendment 5, review doc P13.
- T-0135 (date input, worktree wave-dt, branch feat/text-field-date-type): before shots taken; type=date already existed, gaps being closed (square round trigger, field anchor, month on open, keys, locale display); WIP committed. Left: those gaps, the BookingForm rebuild, gates, screenshots.
- T-0136 (dogfood lint) waits on both; the ui-designer dogfood review runs after T-0134 and T-0135 merge.
- Resume: SendMessage 0134-solo-L3 and 0135-solo-L3 by name ("resume from your WIP commit"), or a fresh solo on each worktree.
- Dogfood review nit: in an open select or menu panel, the first row's focus ring sits tight against the panel's top edge (T-0134 after shots).
- Renderer: bindProp in widget.ts re-applies the bound value over the guest's edit when a component reads its input there; wrap that call in untracked for all components (T-0135 worked around it in BookingForm only). Also: a hand-typed date reaches the form data one commit late, as numbers already do.
- Dogfood render lint covers only the default catalog's 77 widgets; persona catalog widgets (BookingForm, CardTable, QuestionCard, ContrastPair) are composition-lint only. Follow-up. Site shard grows by about 350 tests.
- OTP cells and textarea read faint at rest (no boundary); T-0140 gave text-field, select and combo-box a resting border; extend it to otp-field and textarea.
- Dogfood lint rules proposed by T-0138 (not yet added): glyph-to-label gap >= n; single-line controls in one row share radius h/2; board corner mark >= glyph box with no px inset; standalone icon >= 0.875 x row font-size; square entry cell radius < w/2; no demo card clipped by its scroller at 400px. Also OTP empty and disabled goldens still show old squares and pass only on tolerance: re-mint.
- Open for Kim (T-0138): sm glyph box is 6px (dot, more, info marks): floor it or never ship them at sm. Icons inside a data-tier region keep 2n (Scope reading, recorded in Amendment 6) versus 1em everywhere outside a control (Goal reading).
- Dogfood lint rules proposed by T-0139: disabled ink contrast below the same control enabled; disabled ghost button background transparent; disabled track, box or ring edge >= 1.3:1 against its surface; disabled unpressed toggle background equals enabled unpressed; ui-text inside a button takes the button's colour.
- ui-row align=center: Chromium maps it to a centred text-align every child inherits (zig-zag rows in badge and icon demos); fix in row.css or list.css. Lint rules still without a measure (need a colour-compositing helper): field boundary >= 3:1, avatar disc >= 1.3:1, disabled contrasts.
- Dogfood lint rules proposed by T-0142 (not added, budget): badge-overlay opaque fill; icon-identity (no button without icon and label); action-group share a top edge or wrap together; prose-after-box >= n. GH #727 superseded: Kim kept the uppercase provider headings (2026-10-14).
- conversation 'the rail is one continuous line' browser test red on main (connector off by 2px), app shard, since before T-0143. Follow-up.
- Dogfood lint violators allowlisted by T-0144 that need control CSS: game-hud stat glyph 4px from its label at n 6 (glyph-gap); avatar disc 1.27:1 on a raised list row; site/lib/layout-demo-knobs.ts justify buttons wrap beside the label (row, column, list demos).
- The mathematical-design-system skill's live scale.mjs moved again (sha 55e5bb..., after 3c319761, the vendored pin). Not adopted; review the diff before any re-vendor.
- Dogfood lint rules proposed by T-0147: settings-item heading ink and size >= its labels; a round icon button paints no box-shadow at rest; no placeholder ends in exactly two periods; no em dash in picker labels or UI copy. Also 'provider(s) available' remains in a2a-tic-tac-toe.ts, a2ui-live.ts and gen-ui-live.ts; two LLDs quote the old 'Ask anything..'; _page.css:391 h1 is a 1.55rem literal.
- Dogfood lint rules proposed by T-0150: no backtick pair in a text() string or page intro; no .demo-caption inside a specimen; sibling .demo-figure boxes share inline size and top edge within 1px; an overline sits closer to the next block than the previous; clustered avatars ring and overlap at most a quarter; a supporting line has lower ink contrast than its title; prose-gap covers any block under a specimen.
- BookingConfirmation prints the raw room value ('twin'): needs an optional row-level options key in personas/concierge/catalog.json (approved by Kim's conductor, K6 budget and no prompt recapture); T-0146 could not take it. Own ticket.
- ui-rating [size] has no effect once --md-sys-icon-box is defined (stars ~8px at root): same root cause as icons reading the root icon box; fix in rating.css.
- Resolved by T-0164 (rule now in geometry.md and tokens.md): ADR-0046 Amendment 7 has two stale clauses after T-0146: 'BoardGrid: the frame is the 6px inset' and 'the rating gap stays 4px'.
- Dogfood lint rules proposed by T-0146: compose rule against a run of U+2605 inside a ui-* host; glyph-gap covers [data-part=rating]; an unframed control's first painted box within 1px of the text edge; board letter cap height >= a third of the cell.
- Resolved by T-0164 (rule now in geometry.md and tokens.md): ADR-0059 line 39 stale after T-0148: the switch off track is now neutral-container with a neutral-field-outline edge.
- Dogfood lint rules proposed by T-0148: disabled-edge on text-field, textarea, otp cells, select trigger, combo-box editor; slider disabled fill vs rail >= 1.3:1 and thumb no higher than enabled; multi-select indicator equals the checkbox box and radius; compose: no setIcon(..., 'caret-*') in a control; select and combo-box paint a trailing caret; switch off fill below on fill with off edge >= 3:1.
- Resolved by T-0164 for the ADR clauses (rule now in geometry.md and tokens.md); still open: ADR-0105 Amendment 2 says the capped calendar panel is centred (now start-aligned); ADR-0228 cl.6 and ADR-0219 name the old 300-800 chart ramp. Bar-chart zero rule draws as per-row ticks, not one line. timeline-demo.ts:40 append button sits under the timeline.
- Dogfood lint rules proposed by T-0149: table-scroll-cue, ring-parity, legend-gap, series-separation (>= 1.5:1), chip-opaque, chart-empty-mark, diverging-zero.
- Thinking text never arrives: anthropic.ts buildRequestBody asks for adaptive thinking but never sets display; on Sonnet 5 and Haiku 5.5 add display: 'summarized' so 'Reasoned' shows content (T-0151 finding). Chat turns carry no agent name until the client sends one.
- claude-review action fails in ~0.5s with is_error true, no turns, zero cost, since 2026-10-14 ~12:50 UTC, with both the API key and the OAuth token; made advisory in the merge queue (Kim). Ticket claude-review-action-broken: suspects the code-review plugin from the marketplace, the --model claude-sonnet-5-5 arg, or settings effortLevel xhigh.
- Branch protection on main: required checks reduced to [check] on 2026-10-14 (Kim); restore claude-review as required when ticket claude-review-action-broken is fixed: gh api -X PATCH repos/kimgranlund/agent-ui/branches/main/protection/required_status_checks -f 'contexts[]=check' -f 'contexts[]=claude-review'
- 2026-10-14 Kim: with the page root at product / md, the A2UI canvas stays widget / md (20 / 24 / 28), deliberately denser than the page. Record in ADR-0245 Amendment 8 when T-0152 merges.
- Follow-up from T-0164: scripts/adr_ratify.py and its test are dead (nothing calls the script) and can be deleted.
- 2026-10-14 open-questions round: composer size feels right at product / md (closed); next batch after T-0159 and T-0167 is the correctness batch; claude-review gets fixed via T-0153 then restored as a required check; ServiceCard teaching added to the Concierge pack in T-0159.
- T-0174 follow-up: chat:probe runs only 3 render-lint rules (nested-card, type-floor, column); extracting the render-lint helpers from site/pages/dogfood-render.browser.test.ts would let it run all (fits T-0168).
- 2026-10-14 Kim: agent eval framework approved; live spend cap $5 per run; order scenarios + store (T-0176), report (T-0177), judged checks (T-0178), matrix and baselines (T-0179).
- 2026-10-14 Kim ruled the catalog architecture SPEC (T-0201) decisions: accepted all recommendations D1, D3 to D8; D2 multi-domain ids (<base>--<d1>+<d2>). W0 can start; T-0196 Amount picker is core; T-0199 splits (itinerary to hospitality, compare agentic).

- 2026-10-15 (Kim): every live test round keeps all traces, payloads and ledgers for later analysis. Per round folder: traces/ (the round's .agent-traces lines), runs/ (report.json, fixture.json, turn screenshots), and a spend ledger (runner log plus per-run cost). Worktrees get reaped, so the round folder in the main checkout is the durable home. Rounds 1 (T-0184), 2 (T-0225) and the T-0208 probe were backfilled the same day. Automation: T-0241.

- 2026-10-15 (Kim): test rounds live in .sdlc/evals/rounds/<date>-<slug>/ with a generated .sdlc/evals/README.md index (T-0241); the ticket store moves to the sdlc-lite topics layout (.sdlc/tickets/, notes/, work/) after the running lanes land, committed (T-0242).

- 2026-10-15 (Kim, /ask round): work items live in .sdlc/tickets/ (topics layout, T-0242); CHANGELOG.md becomes a pointer to merged PRs and releases; npm publish scope is @agent-ui-kit/* (renamed at publish time); all of .sdlc is tracked in git. Scrub tickets filed: T-0249 to T-0252.
