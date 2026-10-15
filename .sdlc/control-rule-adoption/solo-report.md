T-0122 Adopt the skill's control rule: built, gates green, re-pin list written, not pushed.
Branch feat/control-rule-adoption in .claude/worktrees/wave-cr, rebased onto origin/main 38ccc1d3. 42 files changed. Commits 22bf22ad, 4839e6d1, f82fcd1c, 290f70f0.
Change: box margin n, gutter c, label inset n - c on the text slot (new --md-sys-label-inset), text edge 2n - c (8 / 10 / 12 at the root); chip tokens, badge 2n + 2c, checkbox and badge radius ceil(n/2); ADR-0245 Amendment 4; px per control in derive.out.md section 18.
Criteria:
`node scripts/generate-foundations.mjs --check` exit 0
`npx vitest run packages/agent-ui/shared/src/tokens/foundations.test.ts` exit 0
`npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/control-rule.browser.test.ts packages/agent-ui/shared/src/tokens/foundations.browser.test.ts` exit 0
`node scripts/foundations-probe.mjs --strict` exit 0
`node scripts/foundations-census.mjs --gate` exit 0
`npm run check` exit 0
`test -s .sdlc/control-rule-adoption/repin-list.md` exit 0
Suites, each once: unit 1, components 1, app 1, packages-rest 0, site 0, focus-timing 0, visual 1. 54 failing tests in 26 files, the expected reds, listed by census lane in .sdlc/control-rule-adoption/repin-list.md (14 goldens).
Law checks that need a ruling, not a re-pin: tabs (GH #536 zero padding superseded; strip gap is c), select and combo-box alignment law (option text now sits c inside the trigger text), menu check inset, button asymmetry premise, text-field-css bans the 4n floor on the base :scope (ADR-0223 cl.3(b)), super-shell pane strip.
Open: the admin pane strip needs 259px in its 252px pane, so it scrolls 6px (shell lane's call). ui-toggle keeps its centered label (no label element; recorded deviation). Toggle and segment take no explicit 4n floor (it would let a nowrap label spill in a tight row). The fleet still draws its 1px border outside the padding.
One dependent outside components: conversation-composer.css, padding-inline 0 on the collapsed picker label.
Screenshots: scratchpad t0122/shots2, sheet-light.png and sheet-dark.png, before from origin/main 38ccc1d3, both viewed, not committed.
verify_scope printed derive.mjs (code beside the docs), so verify: needed
