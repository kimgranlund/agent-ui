<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `packages/agent-ui/app/src/controls/super-shell/super-shell.browser.test.ts`: header comment reworded.
- `packages/agent-ui/components/src/controls/*/*.css` (about 45 sheets): banner comments reworded.
- `packages/agent-ui/components/src/controls/*/*.browser.test.ts` (about 20 files): header comments reworded.

## Checks
- `! git grep -nE "component-styles barrel" -- packages site`: exit 0, no matches left.
- Em-dash guard loop: exit 0. Grep printed "No such file" for the two barrel files that earlier steps deleted, which is harmless.
- `npm run check`: exit 0.

## Notes
- I made the edit with one perl substitution, applied in this order:
  1. "the host page / component-styles barrel" became "the host page per control or via shared-styles.css (ADR-0233, no barrel)".
  2. "via the component-styles barrel" became "per control or via shared-styles.css (ADR-0233, no barrel)".
  3. "no component-styles barrel yet" became "no CSS barrel (ADR-0233)".
  4. Any other "(the) component-styles barrel" became "the retired component-styles CSS barrel (ADR-0233)". These are the historical lines like "the barrel does NOT yet @import X".
- Every match sat inside a `//` or `*` comment, so no code, selector or import line changed.
- Lines that read "the barrel @imports foundation roles FIRST" are still there. They contain no match for the criterion, and this step was limited to that phrase.
- The non-comment diffs in the working tree, such as `@agent-ui/components/all` imports, were already there from earlier steps. I did not make them.
