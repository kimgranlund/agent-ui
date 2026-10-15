---
doc-type: ticket
id: tkt-0026
status: done
date: 2026-07-12
owner:
kind: bug
---
# TKT-0026 — ui-select never adopts an Option added after first connect

## Summary
Discovered during tkt-0024's intake (verified against `select.ts:470-503`): ui-select moves its
Option/group children into the listbox panel ONLY at first connect (a one-time idempotent guard)
— a later-added Option mounts as a light-DOM child but stays OUTSIDE the panel, invisible and
unselectable. This is why ADR-0053's first-connect limit is RETAINED by ADR-0128 rather than
lifted: even with the renderer's structural-resend reconciliation landed, a late catalog `Option`
would reach the DOM correctly and still not appear — the residual defect is ui-select's own.

## Acceptance
- An Option (or option group) appended to a connected ui-select is adopted into the panel and
  becomes selectable (the dynamic-options mechanism — likely the MutationObserver child-list
  precedent ui-split uses), for BOTH direct-DOM consumers and the A2UI catalog path.
- The select.md dynamic-options note and ADR-0053's teaching update to the new truth in the same
  change (the a2ui-compose "ship together" trap relaxes only when this is REAL end-to-end).
- Selection/active state survives an adoption; no double-move on reconnect (the relocation law);
  cross-engine legs.

## Repro
Connect a ui-select; `select.append(option)` — the option node exists in light DOM, never appears
in the panel.

## Expected vs actual
- **Expected:** late options adopt into the panel like first-connect ones.
- **Actual:** one-time child-move at first connect; later children ignored.

## Classification
Axis: **functional (dynamic content adoption)** — plane `controls/select/` (+ combo-box shares
the listbox lineage — verify at fix). Consumers: direct DOM, the catalog Select row, ADR-0053's
teaching.

## Severity
**minor** — today's producers obey the ship-together rule, so no shipped surface hits it; it
becomes MAJOR the moment ADR-0128's reconciliation teaches producers that late structure works.

## Links
- `packages/agent-ui/components/src/controls/select/select.ts:470-503` · ADR-0053 · ADR-0128
  (retains 0053 because of exactly this) · `.claude/docs/tickets/tkt-0024-renderer-structural-resend.md`
  (the discovering intake) · the ui-split MutationObserver precedent (dynamic panes).

## Findings

**2026-07-12 — mechanism + implementation (select + combo-box).** Fixed both `ui-select` and
`ui-combo-box` with the identical shape: a `MutationObserver({ childList: true })` on the HOST
(`this`, not the internal panel), armed fresh in `connected()` and disconnected in
`disconnected()`. A shared, idempotent `#syncOptions()` method walks the host's OWN direct
children (via `firstElementChild`/`nextElementSibling` for select, `firstChild`/`nextSibling` for
combo-box, which moves ALL node types) and adopts any `[role=option]`/`[role=group]` (select) or
any non-part node (combo-box) into the panel. `#syncOptions()` is called explicitly once at every
`connected()` (catches anything appended while disconnected, when no observer runs) AND by the
observer on every subsequent mutation. The group-header mint-once logic (select) is unchanged,
just extracted into a shared `#adoptChild` so first-connect and late-mutation adoption are ONE
code path, not two.

**Ordering — CORRECTED 2026-07-12 (component-reviewer NO-GO on scope, TKT-0031 minted): "fully
general" was FALSE as originally claimed.** The original claim was that no `insertBefore` call
could ever reference an already-adopted survivor, because its true parent is the panel, not the
host — true for a DIRECT-DOM AUTHOR (they have no reachable reference to reconstruct such a call:
`select.children`/`comboBox.children` no longer contains an adopted option, so a hand-authored
script cannot target a mid-position insert relative to one). It is **false for the A2UI renderer's
own `#reconcileChildren`** (`tree.ts:316-338`): that code is generic — it has no knowledge that
select/combo-box relocate children — and resolves a SURVIVOR's anchor as its bare widget node with
**no `parentNode === el` check**. When a resend inserts a new id BETWEEN two already-delivered
survivors (e.g. `[opt_a,opt_b]` → `[opt_a,opt_c,opt_b]`), the anchor for `opt_c` resolves to
`opt_b`'s widget — which by then lives inside the panel, not as a child of the select host
`el.insertBefore` is called on — and the call throws an uncaught `NotFoundError` out of `ingest()`.
This is **LATENT and PRE-EXISTING**, not introduced by this ticket: it reproduces identically
before TKT-0026's fix too, since ship-together's own first-connect move already relocates the
initial survivor set before any resend can reference it. TKT-0026 only ever makes the APPEND
(tail) position safe for a NEW id with nothing after it in the new order (`anchor === null`
degrades to a plain `appendChild`, which never references a relocated node) — it does not, and
was never going to, fix a generic renderer-side reconcile bug outside `controls/select`/
`controls/combo-box`. The tree.ts anchor gap is now **TKT-0031** (its own ticket, tree.ts's own
wave — not owned by this dispatch). A test pinning this boundary honestly (asserting the
mid-position resend THROWS today) is in `renderer.test.ts`, cited TKT-0031; it should be revised
the moment TKT-0031 lands.

**No double-move on reconnect.** No re-entrancy guard was needed (unlike `ui-split`'s pane-count
check): an already-adopted node lives inside the panel, not as a direct child of the host, so the
scan is self-terminating by construction — it simply never revisits it.

**Removal — decided, not built.** An already-adopted option's true parent is the panel, so
`optionEl.remove()` (called by the author on their own reference) removes it from the panel
immediately with zero code from this fix — no observer needed for the removal direction itself.
Deliberately did NOT auto-clear `value`/committed selection when the removed option was the
current selection (native `<select>` reassigns to a different option on removal; this is a
JS-authored control, and auto-clearing felt like a second, unrequested behavior change) — left as
the author's own call, matching the latitude the ticket itself grants ("decide and name the
call").

**Scope boundary named, not fixed:** a `value`/committed selection set BEFORE its matching Option
arrives (a legitimate A2UI out-of-order scenario) does not retroactively refresh the trigger
label (select) or `aria-selected` reflection once the late Option shows up — the label effect
only reruns on `value`/`placeholder` signal changes, not on DOM adoption. `rovingFocus` and
`selectionCommit` were ALREADY dynamic-option-safe by design (select.ts's own pre-existing "Live
option accessor — re-reads the DOM on each event" comment) — a late option is immediately
selectable via click/Enter/Arrow with zero changes to those traits. This label-staleness gap is a
distinct, pre-existing root cause (not created by this fix) and is named here rather than folded
into this change, per the one-component-per-dispatch discipline.

**Second named gap (combo-box only, minor):** `#syncOptions` re-runs `#filterOptions` on every
late adoption (so a freshly-arrived option obeys whatever the user has already typed) — but
`#filterOptions` unconditionally resets the active-descendant to -1 (the existing "visible set
changed" contract). A late adoption therefore clears an in-progress Arrow-key highlight even when
the highlighted option is wholly unrelated to the new arrival. Pinned with a test
(`combo-box.test.ts`) rather than fixed — a future pass could preserve the active option's
identity across the reset if this proves user-visible in practice.

**combo-box shares the lineage — same fix, one combo-box-specific wrinkle.** `combo-box.ts`'s
`#ensureParts()` had the byte-identical one-time move loop (moves ALL child nodes, not just
`[role=option]`, since combo-box never filtered by role). One wrinkle `select.ts` doesn't have:
the control-created `#emptyRow` ("No matches") row must stay the panel's LAST child at all
times — so combo-box's adopt step uses `listbox.insertBefore(node, emptyRow)` instead of a plain
`appendChild` (degrades to a plain append when `emptyRow` doesn't exist yet, i.e. the very first
call from inside `#ensureParts()`, before it's built). Also added: a late adoption re-runs
`#filterOptions()` against the CURRENTLY-typed text, so a freshly-adopted option obeys whatever
filter is already in effect rather than bypassing it by arriving late. Stable per-option ids for
`aria-activedescendant` were ALREADY assigned lazily by `#setActive()` (pre-existing code, not
part of this fix) — a late option gets one the moment it becomes the active-descendant.

**Tests (all additive — existing suites untouched):**
- jsdom: 9 new `select-dynamic-options` legs (`select.test.ts`) — late append adopts; multi-append
  order preserved; late option selectable via click; late `[role=group]` adopts with header;
  removing an adopted option leaves the panel cleanly; a late option never disturbs an existing
  committed selection; no double-move on reconnect; an option appended WHILE DISCONNECTED adopts
  on the next reconnect.
- jsdom: 12 new `combo-dynamic-options` legs (`combo-box.test.ts`) — the same shape plus: the late
  option lands BEFORE the "no matches" row; a late option gets a stable id lazily on
  active-descendant move; a late option obeys the currently-typed filter.
- a2ui integration (`renderer.test.ts`): one new describe block proving the FULL TKT-0024 ×
  TKT-0026 synergy end-to-end through `createRenderer` + the REAL default catalog — a structural
  resend adding a new Option id to an already-mounted `Select` (wrapped one level below a stable,
  never-resent `root`, per the "never resend root" precedent) is adopted into the real `ui-select`
  panel and is genuinely clickable/selectable. (Required a local `ElementInternals.setFormValue`/
  `setValidity` prototype stub, scoped to this describe's `beforeAll`/`afterAll` — the
  `catalog/default/index.test.ts` precedent — since the real `selectFactory` builds via a plain
  `document.createElement`, with no per-instance stub hook.)
- Browser (both engines, `select.browser.test.ts` + `combo-box.browser.test.ts`): a late option
  appended WHILE CLOSED (adopts, renders a real box once opened, clickable) and WHILE OPEN (the
  live top-layer panel updates in place without closing/reopening, still clickable) — proves the
  ticket's explicit "does the panel update live?" question. combo-box's version additionally
  asserts the emptyRow-stays-last invariant live in a real engine.

**Gates:** `npm run check` green (tsc + check:site + check:tools). jsdom:
`select`+`combo-box`+`a2ui` targeted run 461/461 green; full `packages` project 5481/5481 green
(one pre-existing, UNRELATED failure in `packages/agent-ui/shared/src/tokens/tokens.test.ts` —
Kim's own live tokens.css rework already in the tree before this ticket started, per the
constraint not to touch it). Browser: 138/138 green across Chromium + WebKit (includes 4 new
TKT-0026 legs). Size: `select` marginal 1202→1247 B gz (+45 B), `combo-box` marginal 869→967 B gz
(+98 B) — both still comfortably within their 2048 B gz per-control budget.

**Teaching updated in this change:** `select.md` (the `options` slot description + the Anatomy
prose + the frontmatter `listbox` part) and `combo-box.md` (the `options` slot + `listbox` part +
prose) now describe adoption as ongoing, not first-connect-only. `select.ts`/`combo-box.ts`'s own
module-header doc comments updated to match. The `a2ui-compose` skill's ship-together trap is
relaxed in BOTH `SKILL.md` (the validation checklist bullet + the "Common traps" entry) and its
`references/node-idioms.md` Select/Option section — Select/Option no longer requires
ship-together; Tabs/Tab/TabPanel's OWN ship-together requirement (a SEPARATE, unverified-by-this-
ticket claim about a different control) is left untouched in the checklist.

**ADR-0053 is accepted + append-only — NOT edited here**, per the dispatch's explicit
instruction. The host should add an `## Amendment` section to ADR-0053 citing TKT-0026: the
first-connect-only Option adoption it documented as the control's shape is superseded by a
MutationObserver-based ongoing adoption; the ADR's own Consequences/rationale prose (wherever it
frames "Options must ship with their Select") should be corrected in the same pass. A repo-wide
`grep` for `ADR-0053` cross-referenced against "moved into"/"first connect"/"ship-together"/"never
appear"/"never reach" surfaced these additional sites outside this ticket's ownership
(`controls/select` + `controls/combo-box` + the `a2ui-compose` skill + this ticket) that still
carry the OLD ship-together teaching and need the host (or a docs/a2ui-owning seat) to correct:
- `.claude/docs/spec/a2ui-catalog.spec.md:146` — the `Option` catalog row's own "**Known
  limitation:**" clause states "Options reach the panel only at FIRST connect — a later
  `updateComponents` adding Options to an already-connected `Select` does not reach the moved
  panel (the Tab/TabPanel class of limitation)." This is the catalog SPEC's normative row-by-row
  table and is the most load-bearing of the stale sites — it should drop the Known-limitation
  clause for `Option` (Tab/TabPanel's own limitation is unaffected and unverified by this ticket).
- `packages/agent-ui/a2ui/src/catalog/default/factories.ts:291-297` — the `optionFactory`'s own
  doc comment: "`ui-select` moves author `[role=option]` light-DOM children into its listbox panel
  at first connect" — true but now incomplete (first-connect-only framing).
- `packages/agent-ui/a2ui/src/examples/generative-form.ts:11-13` — a code comment in the flagship
  example seed asserting the ADR-0053 limitation as the reason its 9-message sequence ships the
  Select and its three Options in one line; the SHAPE of the example (ship together) is still fine
  as a teaching default, but the comment's stated REASON ("Options added to an already-connected
  Select never reach the panel") is now false and should be corrected or removed.
- **`.claude/docs/adr/0128-renderer-structural-resend-reconciliation.md` (an ACCEPTED, ratified
  ADR) lines 12, 56, 122-124** — its own `Supersedes/Superseded by` row, Alternatives table, and
  Consequences prose explicitly rule "ADR-0053's first-connect limitation is RETAINED, with a
  corrected precision, not lifted," citing `select.ts:470-503` by exact line number (now stale —
  this fix moved that code) as the verification. This is the MOST load-bearing of the stale sites:
  a second, ratified ADR now affirmatively documents the bug as permanent, intentional design. It
  needs its own amendment, not just ADR-0053's.
- **`.claude/docs/spec/renderer-structural-resend.spec.md` lines 160-167, 218** — the SPEC-R5
  Alternatives/Known-gaps section and the "Prior decision → Disposition" table both restate the
  same "NOT resolved by this SPEC … retained" verdict, also citing `select.ts:470-503`, and flag it
  as "a new follow-up ticket against `ui-select`, out of this SPEC's scope" — that follow-up ticket
  is this one (TKT-0026); the SPEC should be updated to point at TKT-0026 as CLOSED, not an open
  follow-up.
- `.claude/docs/tickets/tkt-0024-renderer-structural-resend.md` lines 33, 45, 71-73, 116-118,
  140 — the sibling ticket that DISCOVERED this bug repeatedly cites the same `select.ts:470-503`
  line range and its own "RETAINED, not lifted — verified, not assumed" framing; since TKT-0024 is
  itself closed/shipped work (not something I own or should reopen), the host should add a short
  closing note there pointing at TKT-0026's resolution rather than editing its substance.
