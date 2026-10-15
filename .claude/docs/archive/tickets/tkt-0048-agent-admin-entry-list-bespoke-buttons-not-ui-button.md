---
doc-type: ticket
id: tkt-0048
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0048 — `ui-agent-admin`'s entry-list "+ Add section" (and sibling) buttons are bespoke native `<button>`s, not real `ui-button` instances

## Summary
The generic ordered-entry-list primitive (`entry-list.ts`, ADR-0132 `n1b`/`n1c`) builds its three action
buttons — `[data-part="entry-add-toggle"]` ("+ Add section"), `[data-part="entry-add-submit"]` ("Add"),
`[data-part="entry-delete"]` — as plain `document.createElement('button')` with a single flat text node
(e.g. `addToggle.textContent = addLabel` at `entry-list.ts:59`, giving literal text `"+ Add section"`).
Because the `+` is just the first character of one text string, not a real leading-icon adornment, there
is no spacing/anatomy control over it — it sits glued to the label with no gap, which is what the
reported screenshot shows.

The shipped `ui-button` component already solves exactly this: a `slot="leading"` adornment gets its own
icon-sized cell with a defined column-gap to the label (`button.css`'s host-as-grid anatomy, ADR-0006/
ADR-0012), so a `<ui-button><svg slot="leading" data-role="icon">…</svg>Add section</ui-button>` would get
correct, fleet-consistent spacing for free — plus the state styling (hover/active/focus/disabled) TKT-0046
just swept the rest of the fleet for, which these bespoke buttons currently opt out of entirely (they read
only `--ui-agent-admin-*` tokens via `agent-admin.css`'s own flat button rule, not the ADR-0008/0009/0010
recipe).

**Complication surfaced during triage, not yet resolved:** `slot="leading"` is anatomy-typed for a real
SVG icon (`button.css`'s cell comment: "the same square, icon-sized cell... adornments are decorative
(aria-hidden)"), and this repo's bundled Phosphor icon subset
(`packages/agent-ui/icons/src/phosphor/icons.gen.ts`) currently ships only 19 icons — **no `plus`/`add`
glyph exists**. `entry-delete` has an easy path (the existing `x` icon already covers "delete/remove"
semantically); `entry-add-toggle`'s `+` does not. This ticket does not decide in advance whether the fix
adds a new icon to `@agent-ui/icons` (its own small icon-pack-governance decision, ADR-0065/0066
precedent) or uses a plain `+` text character inside `slot="leading"` (deviates from the documented
SVG-icon anatomy, needs its own sign-off) — that's for the dispatched investigation to resolve with
evidence, not to guess here.

## Acceptance
- `[data-part="entry-add-toggle"]` ("+ Add section") is a real `<ui-button>` instance (or the bespoke
  button gets a documented reason it can't be, if one turns up) with a real, spaced leading adornment
  instead of a "+" glued to the label text — visually confirmed against the reported screenshot's gap
  complaint.
- The `plus`-glyph question (new icon-pack SVG vs. text-in-`slot="leading"`) is resolved with a stated
  reason, not left ambiguous — if a new icon is minted, it follows `@agent-ui/icons`'s existing
  contribution shape (`icons.gen.ts` + whatever generation step produces it — check for a generator
  script before hand-editing the `.gen.ts` file).
- `entry-add-submit` ("Add") and `entry-delete` are each independently evaluated for the same swap — per
  this repo's established "per-instance evidence, not a blanket fix" discipline (TKT-0042/ADR-0106
  precedent): fix what has evidence and a clean path (e.g. `entry-delete` can likely reuse the existing
  `x` icon immediately), and name what's deferred and why rather than silently skipping it.
- Existing `entry-list.ts`/`agent-admin.ts`/`agent-admin.browser.test.ts` behavior (click handlers, form
  toggle, focus-on-open, the ADR-0132 `EntryListHandlers` contract) is unchanged — this is an anatomy/
  presentation swap, not a behavior change. Existing tests still pass; a new test proves the leading
  adornment renders with real, measurable spacing (not zero-gap glued text).
- If this touches `packages/agent-ui/icons/**`, follow that package's own contribution discipline; if it
  touches `packages/agent-ui/app/src/controls/agent-admin/**`, dispatch `ui:component-reviewer` before
  calling it done (shipped `packages/**` code).
- `npm run check && npm test` green.

## Repro
Reported markup + screenshot: a pill-outlined button rendering `+ Add section` as one flush string with
no visible gap between the `+` and the label. Source: `entry-list.ts:56-60`
(`addToggle.textContent = addLabel`, where `addLabel` is passed in as the literal string `"+ Add section"`
from `agent-admin.ts`'s call sites) styled by `agent-admin.css`'s flat
`[data-part='entry-delete'], [data-part='entry-add-toggle'], [data-part='entry-add-submit']` rule (padding
+ border only, no icon/label anatomy at all).

## Expected vs actual
- **Expected:** a leading `+` glyph and the "Add section" label render with real, defined spacing between
  them — matching how every other icon+label button in the fleet (`ui-button` with a `slot="leading"`
  adornment) spaces its adornment from its label.
- **Actual:** `+ Add section` is one plain text node inside a bespoke native `<button>` with no icon/label
  anatomy — the "gap" is whatever a single space character renders as in the font, not a controlled,
  token-driven spacing value.

## Classification
Axis: **structural** (anatomy gap — a hand-rolled native button bypassing the shipped `ui-button`
component's already-solved icon/label spacing AND state-styling contract) with a **visual** symptom (no
gap affordance). Plane: `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts:56-84` (the three
bespoke button creation sites) × `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css`
(`[data-part='entry-delete'], [data-part='entry-add-toggle'], [data-part='entry-add-submit']`, the flat
styling rule these buttons currently read instead of `ui-button`'s anatomy) × possibly
`packages/agent-ui/icons/src/phosphor/icons.gen.ts` (no `plus` glyph currently exists, if that's the
resolved direction).

## Severity
**cosmetic** — no functional break (the button works, is focusable, and is labeled correctly for AT); a
spacing/anatomy-consistency gap, but it also means this control currently has NONE of the ADR-0008/0009/
0010 state-styling TKT-0046 just verified across the rest of the fleet (no hover repaint, no shared focus
ring, no `tabbable`/`ariaDisabled` contract) — worth noting in case that tips severity up once
investigated further.

## Links
- `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts:56-84` (the three bespoke buttons)
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (their current flat styling rule)
- `packages/agent-ui/components/src/controls/button/button.md:140-182` (the `slot="leading"` anatomy +
  usage examples this ticket wants these buttons to adopt)
- `packages/agent-ui/components/src/controls/button/button.css:113-135` (the icon-sized-cell mechanism)
- `packages/agent-ui/icons/src/phosphor/icons.gen.ts` (the current 19-icon subset — no `plus`/`add` glyph)
- [TKT-0046](tkt-0046-fleet-interaction-state-styling-consistency-audit.md) (the fleet state-styling
  sweep — these bespoke buttons were out of its scope since they're not a `ui-*` control, but they land in
  the exact gap that sweep was checking for)
- [TKT-0039](tkt-0039-agent-admin-ui.md) (the in-progress `ui-agent-admin` build this belongs to)

## Findings

### 2026-07-14 — icon-question checkpoint: minted a real `plus` icon via the existing vendor script

Resolved the `plus`/`add` glyph question the ticket deliberately left open. **Chosen path: mint a new
icon via the existing `@agent-ui/icons` contribution mechanism, not a text-character fallback.**

Verified before touching anything: `node_modules/@phosphor-icons/core/assets/regular/plus.svg` exists,
with `viewBox="0 0 256 256"` — the exact `EXPECTED_VIEW_BOX` `scripts/vendor-phosphor.mjs` requires, and
its Phosphor asset basename (`plus`) matches the canonical name identity every other curated icon uses.
This is the "run the existing script with one more icon name" case the dispatch treated as the
anatomy-correct default, not the bigger out-of-scope case that would have forced the text-fallback.

Mechanism used (ADR-0066's committed-vendoring shape, never hand-editing `icons.gen.ts`):
1. Added `plus: 'plus'` to `NAME_MAP` in `packages/agent-ui/icons/scripts/vendor-phosphor.mjs`.
2. Added `'plus'` to `ICON_NAMES` in `packages/agent-ui/icons/src/types.ts`.
3. Ran `node packages/agent-ui/icons/scripts/vendor-phosphor.mjs` — regenerated
   `packages/agent-ui/icons/src/phosphor/icons.gen.ts` mechanically (21 icons written, `plus` last).
4. Updated the two icon-package tests that hardcode the count/set:
   `packages/agent-ui/icons/src/types.test.ts` (20→21, curated-set list gains `'plus'`) and
   `packages/agent-ui/icons/src/phosphor/phosphor.test.ts` (test description only, `20`→`21`; the
   assertion itself already used `ICON_NAMES.length` dynamically so it needed no logic change).

No ADR update was needed — ADR-0066 governs the *mechanism* (vendor from the pinned `@phosphor-icons/core`
devDependency, curated allowlist, committed inert output), not a fixed icon census; adding one name through
the existing script is exactly what clause 2 anticipates. This also means the fallback path (a plain `+`
character inside `slot="leading"`) — which `button-geometry.browser.test.ts`'s own `ICON`/`ICON_ONLY`
fixtures prove works geometrically (`<span slot="leading" data-role="icon">●</span>` — the CSS only keys
off the `slot`/`data-role` attributes, not SVG-ness) — was not needed and was not taken.

### 2026-07-14 — build complete: entry-add-toggle + entry-delete converted; entry-add-submit deferred

**Converted to real `<ui-button>` instances** (`packages/agent-ui/app/src/controls/agent-admin/entry-list.ts`):
- `entry-add-toggle` (line ~62-76) — `<ui-button variant="soft" data-part="entry-add-toggle">` carrying a
  `<ui-icon slot="leading" data-role="icon" name="plus">` adornment + the bare label text (the `toast.ts`
  close-button shape, `slot="leading"`/`data-role="icon"` per `button.md`'s documented contract). The
  addLabel contract changed: the 5 call sites in `agent-admin.ts` (`CAPABILITY_KINDS` + the prompt-section
  site, ~line 70-73/166) dropped their literal `'+ '` prefix (`'+ Add skill'` → `'Add skill'`) since the
  icon now supplies the "+" visually — no test asserted the old literal text, so no test broke.
- `entry-delete` (line ~163-171) — `<ui-button variant="soft" data-part="entry-delete">Remove</ui-button>`.
  No leading icon: the current rendering was plain "Remove" text (never a glued glyph — the reported bug
  never applied here), so this conversion's actual fix is the shared ADR-0008/0009/0010 state-styling
  contract (hover/active/focus-ring) the bespoke native button opted out of entirely, per the ticket's own
  Severity note.

**Deferred: `entry-add-submit` stays a native `<button type="submit">`.** Reasoning: `ui-button` is NOT
form-associated (`button.md`'s frontmatter: `formAssociated: false`) and cannot become a form's "default
button." `addForm` (`entry-list.ts`) has THREE fields — two native text inputs + a `ui-textarea` — so per
the HTML implicit-submission algorithm, Enter-to-submit in the label field depends on a REAL native submit
control being present; there is no attribute that lets a custom element participate in that algorithm.
Converting `entry-add-submit` would silently regress Enter-to-submit UX, and no existing test would catch
it — every existing test exercises the form via `.requestSubmit()` or a dispatched `submit` Event, never a
click on this specific button (grep-verified). This is the TKT-0042/ADR-0106 per-instance-evidence
discipline the ticket asked for: no icon requirement, and a real behavioral cost to conversion, not just a
missed cosmetic. The durable fix — converting the whole add-form off native `<form>`/`<input>` (the
TKT-0041-adjacent track that already replaced `entry-content` with `ui-textarea`) — would let
`entry-add-submit` convert alongside it without this tradeoff; that's a separate ticket's scope, not this
one's.

**CSS**: `agent-admin.css`'s old flat bespoke-button rule (`[data-part='entry-delete'],
[data-part='entry-add-toggle'], [data-part='entry-add-submit']`) now covers ONLY `entry-add-submit` — the
two converted parts are real `ui-button`s styled entirely by `button.css`.

**New test**: `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts`, describe block
`"TKT-0048: entry-list action buttons are real ui-button instances"` (two `it`s) — proves a real, non-zero
`columnGap` AND non-overlapping icon/label bounding boxes (not a weaker "box has width" check), that a real
`<path>` renders (not just a correctly-sized empty cell — `ui-icon` silently no-ops an unregistered `name`,
so the test explicitly activates the Phosphor pack via `import '@agent-ui/icons/phosphor'`), and that
`entry-delete` on a real added entry is a genuine `ui-button` with a non-zero rendered box.

**Registration**: `agent-admin.ts` now side-effect-imports `@agent-ui/components/controls/button` and
`.../controls/icon` explicitly (alongside the existing `split`/`split-pane`/`switch` side-effect imports) —
previously these tags would have upgraded only via an incidental transitive path (agent-admin →
conversation → surface-host → the a2ui default catalog's `factories.ts`, which value-imports the whole
family) that a future tree-shaking change could sever. `vitest.config.ts` gained matching
`@agent-ui/components/controls/{button,icon}` aliases (the same subpath-ordering necessity as the existing
`controls/split`/`controls/split-pane` entries — the broad `@agent-ui/components` alias prefix-matches and
mangles any subpath without a more-specific entry first).

**Docs**: `agent-admin.md`'s `entry-add-toggle`/`entry-delete` part descriptions updated off the stale
`"+ Add ..."` bespoke-button wording to name the real `<ui-button>` shape.

**component-reviewer verdict**: 🟢 APPROVE with three MINOR correctives (undeclared registration
dependency, a browser-test assertion that proved the gap but not the glyph, two stale doc references) — all
three applied above. The `entry-add-submit` deferral reasoning was independently verified and judged sound.

**Final gates**: `npm run check` green (tsc + site + tools). jsdom (`npm test`): 6165 tests, all passing
except 2 pre-existing failures unrelated to this diff (`site/lib/sitemap.test.ts` and
`site/lib/theme-provider-build-fixture.test.ts` — drift-fixture gates stale relative to OTHER concurrent
agents' uncommitted work in this shared tree: a new ADR file and unrelated CSS edits visible in `git
status`, confirmed by file:line, not touched by this ticket). A pre-existing, unrelated jsdom noise signature
(`TypeError: this.internals.setFormValue is not a function`, jsdom's `ElementInternals` not implementing
`setFormValue`) fires ~680 times during `agent-admin.test.ts`'s teardown but fails zero assertions (confirmed
via isolated re-runs) — traced to `dom/form.ts`, a file this diff never touches; also flagged independently
by the component-reviewer as matching TKT-0040's signature under a `status: done` ticket, worth a
parent-level look but not this ticket's defect. Browser suite (`npx vitest run --config
vitest.browser.config.ts agent-admin button icon`): all pass, both Chromium + WebKit, including the two new
tests. `npm run size`: all families within budget, no regressions (manual check — not a required gate per
this repo's standing rule).


