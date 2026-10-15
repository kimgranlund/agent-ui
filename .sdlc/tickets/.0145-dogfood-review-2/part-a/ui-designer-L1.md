<!-- role=ui-designer level=L1 model=opus effort=high -->
## Mode
review

## Decisions
None

## Findings
Status of each pass-1 finding, in pass-1 order. Shots are under .sdlc/0145-dogfood-review-2/shots/.
- conversation-composer.ts:859 (blank Provider and Mode pickers at 400px): fixed. All four compact pickers paint a glyph (shell__a2ui-chat__400__dark.png).
- a2ui-basic/factories.ts:198 (stacked cards touch): fixed. The two BookingForm cards now sit about 9px apart (a2ui__BookingForm__1000__light.png, __400__dark.png).
- croupier/factories.ts:310 (CardTable action row splits): fixed. Hit, Stand and Double wrap together below the readout (a2ui__CardTable__400__dark.png).
- button.css:88 (disabled button reads as enabled): fixed. "Check answer" and the doc's "Disabled" both read faded (a2ui__QuestionCard__1000__light.png, shell__button-doc__1000__light.png).
- product-card.css:232 ("Best rate" badge loses its pill): fixed. The badge is an opaque pill over the image (a2ui__product-card-demo__1000__light.png).
- site/pages/containers.css:44 (demo frame corner tighter than the card inside it): fixed. .demo-figure now derives its padding and its concentric radius (containers.css:52-67; a2ui__product-card-demo__1000__light.png).
- site/pages/containers.css:20 (notes touch the specimen above): fixed. containers.css:27-29 adds the widget margin above them (a2ui__game-hud-demo__1000__light.png, a2ui__result-card-demo__1000__light.png).
- agent-admin.css:663 (switch and radio columns have no labels): partly fixed. The model grid now has an "On / Default" header. The default row's switch is still pale, but it now uses the fleet disabled recipe, so I am not raising it again (shell__agent-admin-app__1000__light.png).
- agent-admin.css:651 (provider headings): fixed by ruling. They are uppercase and tracked, and the handoff says they stay (shell__agent-admin-app__1000__light.png).
- site/pages/game-hud-demo.ts:48 (Croupier HUD hugs its content): fixed. All three HUDs share one width (a2ui__game-hud-demo__1000__light.png).
- game-hud.css:154 (glyph touches its label): fixed. "✓ CHIPS", "✕ GOLD" and "✕ HITS" now have a gap (a2ui__game-hud-demo__1000__light.png, a2ui__result-card-demo__1000__light.png).
- site/pages/a2ui-chat.css:13 (empty conversation logs): still there (shell__a2ui-chat__1000__light.png, shell__agent-admin-app__1000__light.png). Kim has already ruled on the admin half: agent-admin.css:586-590 records the GH #684 ruling that the log stays empty until the first turn. Only the site a2ui-chat page is still open, and that is a question for Kim, not a defect.
- segmented-control.css:48 (group radius beside pills): fixed. The admin view switcher is a pill track with a pill segment (shell__agent-admin-app__400__dark.png).
- product-card.css:35 (exhibit icon reads as a speck): fixed. It is now a tinted media tile of about 36px (a2ui__product-card-demo__1000__light.png).
- board-grid.css:56 (tiny corner glyphs, 3px inset): fixed. The glyphs sit on the glyph box with the 8px floor, and the inset comes from c. board-grid.css:60 keeps 3px only as a var fallback (a2ui__board-grid-demo__1000__light.png).
- site/pages/a2ui-chat.css:41 (hand-sized chat header): partly fixed. The title now reads at the doc h1 size and a canvas gap sits above the card, but the header still uses rem literals (a2ui-chat.css:31,33,47,63) (shell__a2ui-chat__1000__light.png).
- BookingForm calendar glyph: fixed. text-field.css:546-549 sizes it at half the side of the round sm trigger (a2ui__BookingForm__1000__light.png).
- site/pages/containers.css:86 (hand-tabled event log): fixed. It uses the .demo-figure level tokens (a2ui__product-card-demo__1000__light.png).

New findings, most visible first:
- packages/agent-ui/components/src/controls/product-card/product-card.ts:31-33,184-185 and product-card.css:208-211: the offer tile's rating is five hand-set "★" text spans with a clipped half star. It stands in for the fleet's ui-rating, which has a `readonly` display mode (rating/rating.md:58-65). The number also touches the stars ("★★★★★4.8") because product-card.css:69 sets the gap between stars and number to `--md-sys-space-xs` (c, 2px). That is the same defect glyph-gap fixed in the HUD (a2ui__product-card-demo__1000__light.png, __400__dark.png). Fix: compose a readonly ui-rating at size sm and put n between the stars and the value. Measurable: a compose rule (a run of U+2605 text inside a ui-* host where ui-rating exists), plus widening `glyph-gap` to `[data-part=rating]` (gap at least n; it is c now).
- site/pages/containers.css:52-67 with site/pages/product-card-demo.ts:47: the three product-card specimen frames come out at three widths (about 361, 346 and 354px at 1000). Each frame is max-content, so it hugs its mono caption instead of the card. At 400 the frame fills the column while the card stays at the `applyDemoWidth` 18rem. The card then ends about 26px short of the frame's content edge, so it sits off-centre in a frame too big for it (a2ui__product-card-demo__1000__light.png, __400__dark.png). Fix: size each frame to its specimen (`inline-size: fit-content`, with the caption wrapping inside), or give sibling frames one shared track width. Measurable: sibling .demo-figure boxes on one page share one inline size, and a specimen's inline-end inset equals its inline-start inset within 1px.
- packages/agent-ui/app/src/controls/agent-admin/agent-admin.css:949-954 vs :1019-1022 (and the reset-agent-row label): the section headings "Agent", "Model" and "Bankroll" are weight 600 in the label ink (`neutral-on-surface-variant`, :64). The row labels inside them, "Agent configuration" and "Stored bankroll", are weight 600 in full ink, so each row label outranks its own heading (shell__agent-admin-app__1000__light.png). Fix: give the heading the full ink (or the title type role) and give row labels the body weight. Measurable: inside one settings-item, the heading's ink contrast and font-size are at least those of any label inside it.
- packages/agent-ui/a2ui/src/catalog/personas/concierge/factories.ts:461-477 (BookingConfirmation rows) with a2ui/src/examples/persona-exemplars.ts:86,150: the confirmation card prints the raw value "twin" in bold, while the form above it says "Twin room", so the receipt looks like a debug dump (a2ui__BookingForm__1000__light.png). Fix: look the row value up in the form's option labels, or have the exemplar bind a label path. Measurable: a BookingConfirmation value equal to a BookingForm option `value` renders that option's `label`.
- packages/agent-ui/app/src/controls/agent-admin/agent-admin.css:582-584: the settings tab strip's "…" overflow trigger is now a round icon button. Its `box-shadow: 0 1px 0 0` was written to carry the divider line under a square trigger, and now it paints a grey crescent under the circle. The button looks raised and sits on the tab line (shell__agent-admin-app__1000__light.png). Fix: drop the trigger's shadow and paint the line once on the ui-tabs shell, as a `border-block-end` across both grid columns. Measurable: a round icon button paints no box-shadow at rest.
- packages/agent-ui/components/src/controls/board-grid/board-grid.css:32,96: the board pads itself by the 6px box inset but paints no frame, border or fill. So every board starts 6px to the right of its heading and prose: heading at x=294 and first cell at x=300 at 1000, 24 vs 30 at 400 (a2ui__board-grid-demo__1000__light.png, __400__dark.png). Fix: keep the inset only when the board paints a frame, or move it onto a frame that is visible. Measurable: an unframed control's first painted box lines up with the section's text edge within 1px.
- packages/agent-ui/components/src/controls/playing-card/playing-card.css:167-182: the card back's lattice is two 1px lines at 45deg. At the CardTable size they alias into a broken, dotted mesh, and the inset-shadow frame does not show. The pattern seems to run into a ragged edge next to the crisp face card (a2ui__CardTable__1000__light.png). Fix: draw the lattice with 2px lines or a small SVG tile, and make the frame margin real padding with `background-clip: content-box`. Measurable: no; this is a raster look that a rule cannot check.
- packages/agent-ui/components/src/controls/board-grid/board-grid.css:56: nit. Word-board letters use the control type size (about 13px bold) in a 36px square, so "SLATE" and "CRANE" read small for a letter board (a2ui__board-grid-demo__1000__light.png). Fix: size the letter from the cell, about half the cell side. Measurable: the letter's cap height is at least a third of the cell side.
- packages/agent-ui/app/src/controls/conversation/conversation-composer.ts:142: nit. The placeholder reads "Ask anything.." with two dots on every composer (shell__a2ui-chat__1000__light.png, shell__agent-admin-app__1000__light.png). Fix: "Ask anything". Measurable: no placeholder ends in exactly two periods.
- site/lib/provider-mode-selection.ts:107: nit. The Mode picker label is "Default", an em dash (U+2014), then "balanced", so the UI copy carries an em dash (shell__a2ui-chat__1000__light.png). Fix: "Default (balanced)" or "Balanced". Measurable: no U+2014 in a picker label.
- site/pages/a2ui-chat.ts:331: nit. Under the conversation, the status line is centred and says "(1 provider(s) available)". "Reset" sits alone at the far right, and the header is left-aligned, so three alignments stack within 60px (shell__a2ui-chat__1000__light.png). Fix: left-align the status with the header, write "1 provider", and put Reset at the end of the status line. Measurable: no; a rule cannot check this.

## Changes
None

## Context used
- .sdlc/0145-dogfood-review-2/part-a/handoff.md and ../handoff.md: the scope (a2ui and shell families), the standing rulings and the pass-2 output shape.
- .sdlc/tickets/.0137-dogfood-design-review/part-a/ui-designer-L1.md: the 18 pass-1 findings judged above.
- .claude/docs/references/dogfood-lint.md:27-71: the rules already enforced, so none is reported again.
- site/pages/containers.css:20-67: the T-0142 prose-gap rule and the derived .demo-figure geometry.
- site/pages/product-card-demo.ts:47: the 18rem specimen width.
- packages/agent-ui/components/src/controls/product-card/product-card.css:46-69,196-225 and product-card.ts:31-33,120-134,184: the hand-built star rating and its c gap.
- packages/agent-ui/components/src/controls/rating/rating.css:1-61 and rating.md:58-65: ui-rating's readonly mode.
- packages/agent-ui/components/src/controls/playing-card/playing-card.css:43-70,144-182: the back lattice and the inset frame.
- packages/agent-ui/components/src/controls/text-field/text-field.css:95-103,470-549: the date trigger and its half-side glyph.
- packages/agent-ui/components/src/controls/board-grid/board-grid.css:20-60,93-146: the invisible frame inset, the letter size and the corner inset.
- packages/agent-ui/app/src/controls/agent-admin/agent-admin.css:64,548-590,945-975,1005-1045 and agent-admin.ts:1135-1160,1421-1472: the tab-strip line shadow, the GH #684 empty-log ruling, the section heading ink, the row labels and the ruled Agent master switch.
- packages/agent-ui/app/src/controls/conversation/conversation-composer.ts:142; site/lib/provider-mode-selection.ts:107; site/pages/a2ui-chat.css:13-63 and a2ui-chat.ts:331: the composer copy and the chat page's header and status line.
- packages/agent-ui/a2ui/src/examples/persona-exemplars.ts:86,150 and a2ui/src/catalog/personas/concierge/factories.ts:461-477: the room-type value and the confirmation rows.

## Carry forward
- Pass-1 measurables that are not lint rules yet (pass-1 file .sdlc/tickets/.0137-dogfood-design-review/part-a/ui-designer-L1.md): a gap of at least n between bordered siblings (finding 2), width parity for same-tag siblings (finding 10), media icon size (finding 14), kicker parity (finding 9), concentric nesting (finding 6), empty conversation log (finding 12).
- New measurables proposed here: .demo-figure width parity; a section heading's ink and size at least those of its row labels; an unframed control lined up with the text edge; no resting box-shadow on a round icon button; a readonly ui-rating instead of U+2605 text.
- glyph-gap only covers the game-hud and result-card stat glyphs (dogfood-lint.md:57), so product-card.css:69 (rating gap c) escapes it.
- Kim's GH #684 ruling keeps the admin log empty until the first turn: agent-admin.css:586-590. The site a2ui-chat empty log is an open question for Kim.
- The Agent section's master switch on its heading row is Kim's ruling: agent-admin.ts:1136-1140.
- The admin "…" trigger's line-carrying box-shadow predates the round icon-button ruling: agent-admin.css:562-584.
- board-grid pads by 6px with no painted frame: board-grid.css:32,96.
- Product-card specimen width: site/pages/product-card-demo.ts:47 (18rem) inside the max-content .demo-figure (site/pages/containers.css:52-67).
- The confirmation shows the raw room value: persona-exemplars.ts:86,150; concierge/factories.ts:461-477.
