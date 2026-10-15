## Task goal
Design how agent-ui stops relying on barrels (the `src/controls/index.ts` family barrel and the `component-styles.css` CSS barrel, plus the other package barrels where the same problem applies) so that consumers load only the controls they use, tree-shaking works, and adding a control no longer means hand-editing shared lists. Design only: no code, no edits.

## Step 9: Loose ends
level: L2
guard timeout: 420
### Read first
- `packages/agent-ui/components/AGENTS.md`
### Do
1. Rewrite the roughly 80 comments that still say "component-styles barrel" (control-sheet banners in `packages/agent-ui/components/src/controls/*/*.css` and headers in `*.browser.test.ts`, for example `super-shell.browser.test.ts:10`) to the ADR-0233 wording: the sheet is linked per control (or via `shared-styles.css`), there is no barrel. Comment text only: no selector, rule, import or code line changes.
### Acceptance criteria
- `! git grep -nE "component-styles barrel" -- packages site`
- (guard) `d=$(printf "\342\200\224"); for f in $(git diff --name-only HEAD -- . ":(exclude).sdlc"); do a=$(git show "HEAD:$f" 2>/dev/null | grep -o "$d" | wc -l); b=$(grep -o "$d" "$f" | wc -l); test "$b" -le "$a" || exit 1; done`
- (guard) `npm run check`
