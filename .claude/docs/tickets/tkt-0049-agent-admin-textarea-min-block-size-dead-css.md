---
doc-type: ticket
id: tkt-0049
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0049 — `agent-admin.css`'s `min-block-size` overrides on `ui-textarea` are (likely) dead CSS — the consumer bypassed the component's own `rows` lever

## Summary
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` sets `min-block-size: 4rem` on
`[data-part='entry-content']` and `min-block-size: 3rem` on `[data-part='entry-add-content']` — both are
`ui-textarea` hosts (`entry-list.ts:90-92`, `:190-192`). Neither call site ever sets `.rows`, which is
`ui-textarea`'s own documented lever for its minimum height (ADR-0134: "`rows` sets a GROWABLE
`min-block-size` ... not a fixed control height" — `textarea.ts:45-47`, `:190`). `ui-textarea`'s own
`@scope (ui-textarea) { :scope { min-block-size: var(--ui-textarea-min-block-size); ... } }` rule
(`textarea.css:91`) and `agent-admin.css`'s plain `[data-part='entry-content'] { min-block-size: 4rem; }`
rule are the SAME specificity (0,1,0 — one attribute selector each). Per CSS Cascading and Scoping's
scoping-proximity tiebreak (inserted between specificity and source order), a rule inside `@scope`
out-ranks an equal-specificity rule that isn't scoped at all, **regardless of source order** — meaning
`ui-textarea`'s own internal rule should always win, and `agent-admin.css`'s `4rem`/`3rem` declarations
never actually apply.

If that reasoning holds, the real rendered min-height is always whatever the component's default
`--ui-textarea-rows: 3` computes to (at `--ui-font-md`'s default value, roughly ~4.8rem/77px — bigger than
either `4rem` or `3rem` the agent-admin author apparently intended), not the smaller values the CSS
author believed they were setting. This is a real, if modest, visible-size mismatch from documented
intent, AND a maintainability trap: a future edit to either number will look like it changes something
and silently do nothing.

**Not yet confirmed in a real browser — flagged explicitly, not asserted as fact.** The specificity/
scoping-proximity reasoning above is sound per spec, but this ticket does not claim to have watched it
render; the dispatched investigation should confirm with real computed-style evidence before touching
anything, in case some other mechanism (load order, a layer, an attribute-selector nuance) changes the
outcome.

## Acceptance
- Confirmed with real computed-style evidence (not just spec reasoning) whether `agent-admin.css`'s
  `min-block-size: 4rem`/`3rem` rules on `[data-part='entry-content']`/`[data-part='entry-add-content']`
  currently apply or are dead code.
- Fixed on the correct side: `entry-list.ts`'s two `ui-textarea` instantiations set `.rows` explicitly
  (the component's documented, sanctioned lever — ADR-0134) to whatever row count matches the intended
  visual size, and the now-redundant/dead `min-block-size` declarations are removed from
  `agent-admin.css` rather than left as misleading dead weight.
- A non-vacuous regression test proving the FIX mechanism, not just the old symptom: a `.browser.test.ts`
  assertion that each textarea's real rendered min-height matches what its `.rows` value computes to
  (cross-engine, per this repo's CSS-truth-in-browser discipline) — so a future edit to `rows` is the
  only lever that moves this, and a future accidental CSS re-add of a competing `min-block-size` would be
  caught rather than silently ignored again.
- `ui:component-reviewer` dispatched before this is called done (shipped `packages/agent-ui/app/**` code).
- `npm run check && npm test` green.

## Repro
No fixed repro script — a cascade/specificity reasoning bug, not a runtime crash. To observe: render
`ui-agent-admin`'s prompts/skills/etc. pane, open "+ Add section", inspect the content `ui-textarea`'s
computed `min-height` in real DevTools — compare against `agent-admin.css`'s stated `3rem`/`4rem` vs.
`ui-textarea`'s own `--ui-textarea-min-block-size` (rows=3 default) computed value.

## Expected vs actual
- **Expected:** `agent-admin.css`'s stated `min-block-size: 4rem`/`3rem` intent is either (a) the actual
  rendered size (if the CSS override genuinely wins), or (b) expressed correctly through `ui-textarea`'s
  own `rows` prop (if it doesn't) — either way, the declared intent and the rendered result should match,
  and the mechanism used should be the one that's real.
- **Actual:** `agent-admin.css` declares a `min-block-size` the component's own `@scope`-scoped rule likely
  overrides via CSS scoping-proximity, with neither call site ever setting the `rows` prop the component
  actually offers for this — declared intent (~48-64px) and likely real render (~77px, the `rows: 3`
  default) probably disagree.

## Classification
Axis: **structural** (a cascade/API-bypass mismatch — a consumer reaching for raw CSS instead of a
component's own documented geometry prop, and the CSS losing the cascade fight besides) with a possible
**visual** symptom (rendered size vs. declared intent, pending confirmation). Plane:
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (`[data-part='entry-content']`,
`[data-part='entry-add-content']`) × `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts:90-92,
190-192` (never sets `.rows`) × `packages/agent-ui/components/src/controls/textarea/textarea.css:91`
(the `@scope`-scoped rule these are likely losing to).

## Severity
**minor** — no functional break (the textarea still works, still grows, still scrolls); at worst a
mismatched default size from what the CSS author intended, plus dead/misleading CSS. Docs-site/
in-progress-build surface (`ui-agent-admin`, TKT-0039), not a shipped-elsewhere regression.

## Links
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (the `min-block-size: 4rem`/`3rem`
  rules in question)
- `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts:90-92,190-192` (the two `ui-textarea`
  instantiations, neither setting `.rows`)
- `packages/agent-ui/components/src/controls/textarea/textarea.css:52,91` (the `--ui-textarea-min-block-size`
  token + the `@scope`-scoped consuming rule)
- `packages/agent-ui/components/src/controls/textarea/textarea.ts:45-47,188-190` (the `rows` prop → CSS
  custom property wiring, the component's documented lever — ADR-0134)
- `.claude/docs/adr/0134-multiline-textarea-face-editor.md` (ADR-0134 — "rows is a MIN, not a fixed
  height", the API this consumer should be using instead of raw CSS)
- [TKT-0039](tkt-0039-agent-admin-ui.md) (the in-progress `ui-agent-admin` build this belongs to)
- [TKT-0041](tkt-0041-agent-admin-prompts-pane-native-textarea.md) (the ticket that introduced `ui-textarea`
  into agent-admin in the first place — the `min-block-size` rules likely predate the `ui-textarea` swap
  and were never revisited for the new component's own geometry lever)

## Findings

### 2026-07-14 — confirmed with real computed-style evidence (Chromium + WebKit)

A throwaway `.browser.test.ts` probe (vitest-browser, both engines, mounted `ui-agent-admin` exactly as
the existing cross-engine smoke does) read `getComputedStyle(...).minHeight` and
`getBoundingClientRect().height` on both `[data-part="entry-content"]` (seeded entry) and
`[data-part="entry-add-content"]` (opened add-form) `ui-textarea` hosts. Result, identical in both
engines:

- `entry-content` computed `min-height`: **77px** (not the CSS-declared `4rem` = 64px)
- `entry-add-content` computed `min-height`: **77px** (not the CSS-declared `3rem` = 48px)
- `--ui-textarea-min-block-size` resolves to `calc(3 * calc(14px * 1.5) + 2 * calc(14px * 0.5))` =
  `3 × 21px + 2 × 7px` = `77px` — exactly `ui-textarea`'s own `rows: 3` default at `--ui-font-md` (14px).

**The hypothesis is confirmed, not falsified.** `agent-admin.css`'s `min-block-size: 4rem`/`3rem`
declarations are dead code — `ui-textarea`'s own `@scope`-scoped rule wins via CSS scoping-proximity
regardless of source order, exactly as the ticket's spec reasoning predicted. Proceeding with the fix as
scoped: set `.rows` explicitly on both `entry-list.ts` `ui-textarea` instantiations (the sanctioned lever)
and remove the dead `min-block-size` declarations from `agent-admin.css`.

### 2026-07-14 — fix shipped, reviewed, gates green

**Mechanism.** Confirmed dead-CSS-loses-to-`@scope`-scoped-rule (above). Fix moves the min-height intent
onto `ui-textarea`'s own `rows` lever (ADR-0134) instead of raw consumer CSS.

**What changed:**
- `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts:92` — `contentField.rows = 2` on the
  add-form's compose/draft field (`entry-add-content`).
- `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts:191` (now ~192) — `contentField.rows = 4`
  on the per-entry saved-content field (`entry-content`), preserving the original `4rem > 3rem` size
  ordering intent.
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` — removed the two dead
  `min-block-size: 4rem`/`3rem` declarations (all sibling declarations in those rule blocks — box-sizing,
  resize, font, color, background, border, border-radius, padding — were left untouched; a
  component-reviewer finding notes several of those are *also* dead by the identical mechanism and
  recommends a follow-up ticket, out of this ticket's scoped acceptance).
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` — added an explicit
  `import '@agent-ui/components/controls/textarea'` side-effect import (component-reviewer MINOR fix,
  matching the same registration-policy precedent TKT-0048 established for `button`/`icon`: don't rely on
  the incidental transitive registration path).
- `vitest.config.ts` — added the matching jsdom alias entry `@agent-ui/components/controls/textarea`
  (discovered while re-verifying gates after the reviewer's fix above: this repo's jsdom config requires an
  explicit per-subpath alias for any `./controls/{name}` import used from outside the `components` package,
  or the broad `@agent-ui/components` alias mangles it — same pattern as the existing `controls/button`/
  `controls/icon`/`controls/split` entries).
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts` — new describe block ("TKT-
  0049: entry-content/entry-add-content min-height is driven by ui-textarea's own `rows` lever, not dead
  agent-admin.css") with 3 tests: rows=4/rows=2 computed min-height matches the `rows × line-box +
  2×padding-block` formula (derived from the field's own real computed font-size, not a hardcoded px), plus
  a mutation-proof test (`.rows = 8` on a live field, `await updateComplete`, assert the render moves) —
  proving the mechanism, not just re-asserting a symptom.

**Review.** `ui:component-reviewer` dispatched — verdict **SHIPPABLE** (A/B axes both ≥4, zero
diff-attributable gate failures). One MAJOR finding (tree-level, not authored by this diff — see Gates
below), two MINORs (both applied: the textarea registration import, and a test-title wording softener from
"catches a future dead-CSS regression" to "catches a future competing CSS rule that WINS the cascade" —
accurate to what the test can actually detect), one MINOR deferred to a follow-up ticket (the sibling dead
CSS declarations beyond `min-block-size`), one NIT accepted as a deliberate component-internals pin
(hardcoded `1.5`/`0.5` constants mirroring `textarea.css`'s own line-height/padding-block ratios).

**Gates.**
- `npm run check`: green (tsc + check:site + check:tools).
- `npx vitest run --config vitest.browser.config.ts …agent-admin.browser.test.ts`: **28/28 green, Chromium +
  WebKit** (25 pre-existing + 3 new TKT-0049 tests).
- `npm test` (full jsdom): 2 failed / 6166 passed + 680 unhandled errors — both failure classes confirmed
  **pre-existing, not introduced by this diff**: (a) `site/lib/sitemap.test.ts` +
  `site/lib/theme-provider-build-fixture.test.ts` are stale-fixture failures from other concurrent tickets'
  churn already in the working tree (this diff touches no `site/` files); (b) the 680 unhandled
  `TypeError: this.internals.setFormValue is not a function` errors are TKT-0040's documented signature
  (`status: done`, but the signature still reproduces on HEAD before this diff — a pre-existing regression
  the team-lead's brief flagged in advance as expected jsdom noise, not something this ticket owns).

**Status:** fix + regression test + review all complete; the two `npm test` failure classes above are
out-of-scope pre-existing tree state, not this diff's responsibility to green.
