---
doc-type: ticket
id: tkt-0050
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0050 — `agent-admin.css`'s entire `[data-part='entry-content']`/`[data-part='entry-add-content']` rule blocks are likely dead, not just the `min-block-size` line TKT-0049 fixed

## Summary
TKT-0049 confirmed (real Chromium + WebKit computed-style evidence) that `agent-admin.css`'s
`min-block-size: 4rem`/`3rem` declarations on `[data-part='entry-content']`/`[data-part='entry-add-content']`
were dead code — `ui-textarea`'s own `@scope (ui-textarea) { :scope { ... } }` rule wins the cascade via
CSS's scoping-proximity tiebreak at equal specificity, regardless of source order. TKT-0049's fix and
`ui:component-reviewer`'s review were deliberately scoped to `min-block-size` only; the reviewer flagged
(MINOR, deferred) that the SAME mechanism likely makes the rest of both rule blocks dead too — this
ticket exists to check the rest, not assume it.

Both blocks (`agent-admin.css`, current lines ~122-130 and ~179-187) declare `box-sizing`, `resize`,
`font`, `color`, `background`, `border`, `border-radius`, `padding` — every one of these properties is
ALSO set by `ui-textarea`'s own `@scope`-scoped `:scope { ... }` rule (`textarea.css:86-106`), at the same
equal-specificity-loses-to-scoping-proximity mechanism TKT-0049 already proved for `min-block-size`. If
that holds for these too, `entry-content`/`entry-add-content` may be rendering ENTIRELY off
`ui-textarea`'s own default token chain (`--ui-textarea-border`/`-bg`/`-ink`, the `--md-sys-color-neutral-*`
family) rather than the `--ui-agent-admin-ink`/`-surface`/`-border` tokens the author apparently intended
— which would likely look similar by coincidence (both ultimately resolve to neutral-family roles), which
may be exactly why this has gone unnoticed visually.

The one exception needing separate checking, not assumed to be dead by the same logic: the adjacent
`[data-part='entry-content']:focus-visible, ...` rule (`agent-admin.css` ~lines 134+) is a HIGHER
specificity selector (attribute + pseudo-class, `(0,2,0)`) than `ui-textarea`'s own `:scope:focus-within`
rule — it may genuinely win regardless of scoping proximity. Don't assume it's dead without checking.

## Acceptance
- Real computed-style evidence (matching TKT-0049's method — a real Chromium+WebKit probe, not spec
  reasoning alone) on whether each of `box-sizing`/`resize`/`font`/`color`/`background`/`border`/
  `border-radius`/`padding` in both rule blocks currently applies or is dead, property by property (some
  may differ from others — don't assume uniform).
- The `:focus-visible` rule is checked independently — confirm whether it wins or loses, since its higher
  specificity changes the analysis.
- Whatever is confirmed dead is removed from `agent-admin.css` (dead CSS is a maintainability trap — a
  future edit to a dead line looks like it does something and doesn't); whatever is confirmed live stays,
  and if it's overriding `ui-textarea`'s own token intent in a way that's actually WRONG (e.g. `entry-content`
  should visually read as an `--ui-agent-admin-*`-themed surface but is silently using
  `--ui-textarea-*`'s own defaults instead), that mismatch gets its own fix or a documented "this is fine,
  they resolve to the same thing" note — not silently left ambiguous.
- `ui:component-reviewer` dispatched before this is called done (shipped `packages/agent-ui/app/**` code).
- `npm run check && npm test` green.

## Repro
No fixed repro script — a cascade/specificity check, following TKT-0049's exact method: render
`ui-agent-admin`, inspect `[data-part="entry-content"]`/`[data-part="entry-add-content"]` `ui-textarea`
hosts' computed `background-color`/`color`/`border-color`/`padding`/`box-sizing` in real DevTools, compare
against `agent-admin.css`'s declared values vs. `ui-textarea`'s own token defaults.

## Expected vs actual
- **Expected:** every declaration in `agent-admin.css`'s two rule blocks either genuinely applies, or has
  been removed as dead weight — no declaration silently does nothing while looking like it does something.
- **Actual:** unconfirmed — `ui:component-reviewer` flagged this as likely (same mechanism as the already-
  proven `min-block-size` case) but did not verify it property-by-property; that verification is this
  ticket's job.

## Classification
Axis: **structural** (the same CSS scoping-proximity cascade mismatch TKT-0049 already root-caused,
suspected to extend further than that ticket's scoped fix covered). Plane:
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (`[data-part='entry-content']`,
`[data-part='entry-add-content']`, and their `:focus-visible` siblings) ×
`packages/agent-ui/components/src/controls/textarea/textarea.css:86-106` (the `@scope`-scoped rule these
compete against).

## Severity
**cosmetic** — no functional break; at worst dead/misleading CSS and a possible unintended token-source
mismatch that likely resolves to the same visual result today (both chains land on neutral-family roles).

## Links
- [TKT-0049](tkt-0049-agent-admin-textarea-min-block-size-dead-css.md) (the sibling ticket that proved the
  mechanism for `min-block-size` specifically — this ticket extends that proof to the rest of the rule
  block)
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (the two rule blocks in question)
- `packages/agent-ui/components/src/controls/textarea/textarea.css:86-106` (the `@scope`-scoped rule these
  are competing against)
- [TKT-0039](tkt-0039-agent-admin-ui.md) (the in-progress `ui-agent-admin` build this belongs to)

## Findings

### 2026-07-15 — real Chromium+WebKit computed-style evidence (dispatched jointly with TKT-0059)

Method: mounted `ui-agent-admin` in a real browser (`npx vitest run --config vitest.browser.config.ts
--project packages`, both Chromium and WebKit), read `getComputedStyle()` on the seeded `foundation`
entry's `[data-part="entry-content"]` and a `tool`-section `[data-part="entry-add-content"]` after opening
the add-form — the SAME method TKT-0049 used.

Property-by-property verdict for BOTH `[data-part='entry-content']` and `[data-part='entry-add-content']`:

- **box-sizing** — DEAD (loses to `ui-textarea`'s own `:scope { box-sizing: border-box }`,
  textarea.css:88), but agent-admin.css declared the SAME value (`border-box`) — the loss is real
  (proximity mechanism) but coincidentally unobservable in computed output.
- **resize** — DEAD (loses to `:scope { resize: vertical }`, textarea.css:96), same-value coincidence as
  above (both `vertical`).
- **font** (`font: inherit` shorthand) — DEAD, and OBSERVABLY so: computed `font-size` on both fields is
  `14px`, matching `--ui-textarea-font`/`--ui-font-md` (textarea.css:46, dimensions.css:52), not whatever
  `font: inherit` would have resolved to from ambient page context.
- **color** — DEAD, but agent-admin's `--ui-agent-admin-ink` and textarea's `--ui-textarea-ink` both
  resolve to `--md-sys-color-neutral-on-surface` — same-value coincidence.
- **background** — DEAD, same-value coincidence (`--md-sys-color-neutral-surface` either way).
- **border** — DEAD, and OBSERVABLY so: computed `border-color` on both fields is `oklch(0.5586 0.0155
  93.1)`, which is exactly `--md-sys-color-neutral-550` (`--ui-textarea-border`'s idle value,
  textarea.css:34, tokens.css:17/43) — NOT `--md-sys-color-neutral-outline-variant`
  (`--ui-agent-admin-border`, agent-admin.css:19), which is a 30%-alpha value (tokens.css:34/63) and would
  render visibly differently.
- **border-radius** — DEAD, but both sides resolve through `--ui-radius-base` (12px) — same-value
  coincidence.
- **padding** — DEAD, and DECISIVELY so: `entry-content` (agent-admin.css declared `0.5rem 0.75rem` =
  8px/12px) and `entry-add-content` (agent-admin.css declared `0.375rem 0.625rem` = 6px/10px) render
  IDENTICALLY at `7px 10.5px` in both engines — `ui-textarea`'s own font-derived formula
  (`font-size × 0.5` / `font-size × 0.75`, textarea.css:49-50), proving agent-admin.css's PER-BLOCK literal
  values never apply regardless of which literal was declared.

**`:focus-visible` — checked independently, a DIFFERENT mechanism, not the scoping-proximity tiebreak:**
programmatically focusing `entry-content` lands focus on `ui-textarea`'s internal `[data-part="editor"]`
child (`entryContent.matches(':focus-within')` → `true`), but the HOST itself never becomes the
`:focus-visible` target (`entryContent.matches(':focus-visible')` → `false`, both engines) — the pseudo-
class only matches the actually-focused element, and that's the child editor, not the host the selector
names. So `[data-part='entry-content']:focus-visible`/`[data-part='entry-add-content']:focus-visible` are
UNREACHABLE, independent of cascade proximity. By contrast, `entry-add-label`/`entry-add-description` are
real native `<input>`s: focusing them directly DOES match `:focus-visible` (`true`, both engines) and the
rule paints (`outline-style: solid`, `outline-width: 2px`, `outline-color` = `--md-sys-color-primary`) —
that half of the combined rule is genuinely live.

**Verdict:** every declared property in both rule blocks is dead. Removed both rule blocks entirely
(`agent-admin.css`); trimmed the `:focus-visible` combined selector to drop `entry-content`/
`entry-add-content` (unreachable) while keeping `entry-add-label`/`entry-add-description` (live).
`ui-textarea` was already rendering entirely off its own `--ui-textarea-*` token chain, and (per TKT-0059)
that chain already matches `ui-text-field`'s — no visual regression from the removal.

### 2026-07-15 — fix + gates (closes with TKT-0059)

Fix: `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` — removed the `[data-part='entry-
content']` and `[data-part='entry-add-content']` rule blocks entirely (dead-code removal, no behavior
change — confirmed by the evidence above); trimmed `[data-part='entry-content']:focus-visible,
[data-part='entry-add-content']:focus-visible, ...` to just the two live native-input selectors.

Regression test: `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts:319` — new
describe block `'ui-agent-admin cross-engine smoke — TKT-0050/TKT-0059: entry-content/entry-add-content
render off ui-textarea's OWN tokens, not agent-admin.css's dead competing declarations'` (5 `it`s): padding
formula parity (both fields, proving the per-block literal removal is safe), border-color resolved-probe
comparison against `--ui-textarea-border` vs `--ui-agent-admin-border` (component-reviewer MINOR fix — the
first draft compared an unresolved `light-dark()` custom-property string against a resolved computed
value, which can never match either way; fixed to resolve both tokens via a real scratch-element probe),
the TKT-0059 font/border/radius parity check against `ui-text-field`, and the two `:focus-visible`
liveness/deadness proofs. All 5 pass in both Chromium and WebKit.

Reviewer: `ui:component-reviewer` dispatched, scoped to `agent-admin.css`'s diff and the new test block
(ambient concurrent-ticket changes in the same files/describe-blocks were explicitly excluded from scope).
Verdict: **GO**. One MINOR finding (the vacuous border-color comparison, above) — fixed before closing.

Gates: `npm run check` green (tsc + check:site + check:tools). `npm test` green (6251/6251, jsdom — includes
a regenerated `site/lib/__fixtures__/theme-provider-built.css` fixture, byte-for-byte stale against the CSS
edit; the test file's own banner names this as expected process, not a defect). Isolated cross-engine run
of `agent-admin.browser.test.ts`: 38/38 passed in both Chromium and WebKit (run twice). A full-repo `npm run
test:browser` hit a Node OOM crash parsing an oversized Playwright websocket JSON blob — a resource-
contention crash from concurrent agents sharing this machine (per the dispatch brief's own warning), not a
real failure; the isolated single-file run is the binding cross-engine evidence for this change.
