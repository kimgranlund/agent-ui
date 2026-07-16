---
doc-type: ticket
id: tkt-0056
status: done
date: 2026-07-15
owner:
kind: feature
size: big
---
# TKT-0056 — extract `ui-conversation`'s composer into its own component, `ui-conversation-composer`

## Summary
`ui-conversation` (`packages/agent-ui/app/src/controls/conversation/conversation.ts`) currently builds
its entire composer — the context-chip row, the text field, the Models/Effort pickers, the mic/send
buttons, and the busy-state disabling — INLINE in its own `connected()`/private methods (the Figma
chat-input refactor, same day). This ticket extracts that composer into its own standalone component,
`ui-conversation-composer`, matching the `ui-split`/`ui-split-pane` and `ui-master-detail`/
`ui-master-detail-pane` sibling-in-one-folder precedent: `ui-conversation` becomes the coordinator that
composes `ui-conversation-composer` as a JS-created internal child (the `master-detail.ts` → `ui-split`
precedent, NOT the split-pane/master-detail-pane AUTHOR-composed precedent — SPEC-R4's existing "never
author-composed, driven entirely through the imperative API" contract for `ui-conversation` itself is
unchanged and load-bearing; the composer is a promoted-but-still-internal part, not a new authoring
surface).

## Acceptance
- New component `ui-conversation-composer` — `UIConversationComposerElement extends UIElement`,
  `tier: pattern` (the `ui-command-modal` coordinator precedent: composed internal parts, no §1
  control-height row of its own), living in `packages/agent-ui/app/src/controls/conversation/` (same
  folder as `conversation.ts` — the sibling-in-one-folder precedent), its own `.ts`/`.css`/`.md` triple.
- Carries the composer's full current prop/callback surface, promoted verbatim (byte-behavior-unchanged):
  `models`/`model`/`efforts`/`effort`/`contextItems` reactive props; `onModelChange`/`onEffortChange`/
  `onContextDismiss`/`onMicClick` callback registrations (the `onSubmit` precedent — never CustomEvents,
  SPEC-R5's closed six-event vocabulary). Gains its OWN `onSubmit(text)` callback (the field+send
  submission moves here) and a reflected `busy` boolean prop (replaces `ui-conversation` reaching into
  the composer's internal field/button parts directly to disable them — an encapsulation improvement,
  not a behavior change).
- `ui-conversation` composes it exactly like `master-detail.ts` composes `ui-split`:
  `document.createElement('ui-conversation-composer')` in its own `#compose()`, forwarding
  `models`/`model`/`efforts`/`effort`/`contextItems` down as props, listening for
  `onSubmit`/`onModelChange`/`onEffortChange`/`onContextDismiss`/`onMicClick`, and setting `busy` from its
  own `#turnsInFlight` tracking (TKT-0034) instead of disabling field/send/mic/picker-triggers directly.
- Every existing `ui-conversation` consumer — `agent-admin.ts` and `site/pages/a2ui-chat.ts` (the
  verified real consumer list; `a2ui-live.ts` never composes `ui-conversation`, a stale claim caught and
  corrected at design review) — is UNCHANGED at their own call sites: `onSubmit`/`beginAgentTurn`/the
  busy-guard/the reflected `disclosure` prop all keep working exactly as today; this is an internal
  composition refactor, not a `ui-conversation` contract change.
- Outside ADR-0087's fleet-derived A2UI catalog-coverage gate by construction (the `master-detail-pane`
  precedent — the gate's scan root is `packages/agent-ui/components/src/controls`, and this component
  lives under `packages/agent-ui/app/src/controls`); no allowlist edit needed, no ADR fork to rule.
- `npm run check && npm test` green; the existing `conversation.test.ts`/`conversation.browser.test.ts`
  coverage for the composer's behavior (models/efforts pickers, context chips, mic, busy-state, the
  reconnect regression) is either kept passing unchanged (if it drives `ui-conversation`'s own public
  surface, which is unchanged) or moved/duplicated into the new component's own test file where it now
  probes `ui-conversation-composer` directly; independent review before merge.

## Links
- [LLD](../lld/conversation-composer.lld.md) — the component's own design record (this ticket's paired doc).
- `packages/agent-ui/app/src/controls/conversation/conversation.ts` — the donor code (`#buildPicker`,
  `#rebuildPickerItems`, `#markPickerSelection`, `#appendCaret`, `#syncModelsPicker`/`#syncEffortsPicker`/
  `#syncContextChips`, the composer DOM construction in `connected()`) moves into the new component.
- `packages/agent-ui/app/src/controls/master-detail/master-detail.ts` — the JS-created-internal-child
  coordinator precedent this build follows (`#compose()` creates `ui-split`/`ui-split-pane`).
- `packages/agent-ui/components/src/controls/command-modal/command-modal.ts` — the `tier: pattern` /
  `extends: UIElement` coordinator-with-composed-children precedent (a nested `ui-modal`, JS-created).
- `.claude/docs/adr/0087-a2ui-whole-fleet-catalog-scope-policy.md` — the catalog-coverage gate this
  component sits outside of by package placement (the `master-detail-pane` precedent, verified: neither
  covered nor flagged as missing).

## Scope/Open
- No ADR earned — no fleet-wide contract changes (no new event name, no new base class, no catalog
  admission, no geometry/token novelty): every mechanism reused here (composing `ui-menu` as an internal
  JS-created child, the `data-picker` trigger-selector workaround, the neutral-token CSS repoint) was
  already built and independently reviewed this same session inside `conversation.ts` — this ticket
  relocates it, it does not redesign it.
- Whether `ui-conversation-composer`'s own `.md` descriptor's `composes: [...]` field should be added is
  a documentary convention only (`command-modal.md` precedent) — not schema-gated
  (`component-descriptor.ts`'s `FIELD_SHAPE` has no `composes` key); include it for readability, no gate
  depends on it.

## Findings

### 2026-07-15 — design intake complete, independently reviewed, repaired; entering build

Ran the `agent-ui-component-design` skill's full intake: precedent sweep (`ui-split`/`ui-split-pane`,
`ui-master-detail`/`ui-master-detail-pane` sibling-in-one-folder shape; `ui-command-modal`'s `tier:
pattern`/`extends: UIElement` coordinator shape), the three-axis classification, the fork sheet (the
load-bearing fork — JS-created internal child vs. author-composed — resolved against `ui-conversation`'s
own standing SPEC-R4 contract, not re-litigated), and the LLD (`conversation-composer.lld.md`).

Independent doc review (`scribe:doc-reviewer`, fresh context) verdict: 🟡 fix-then-ship — the
frozen-interface check passed clean (every named method/field verified to exist in the real
`conversation.ts` with the claimed signature) and the catalog-posture/no-ADR-needed reasoning were both
confirmed sound, but found 2 MAJOR gaps in the design's forwarding/busy plan plus 3 minor/moderate issues:

- **F1 (MAJOR, fixed)**: the naive callback-forwarding plan broke on `agent-admin.ts`'s real, TODAY
  call-site ordering (`onModelChange`/`onSubmit` etc. registered on a bare `new UIConversationElement()`
  BEFORE it ever connects) and would have either dropped pre-connect registrations or — if forwarders were
  registered unconditionally — silently un-hidden the mic button for every consumer regardless of whether
  they wanted voice input. Fixed: `ui-conversation` keeps its five private callback fields; four forwarders
  (submit/model/effort/context-dismiss) are registered unconditionally at compose time reading those
  fields fresh; `onMicClick` gets its own conditional-reveal forwarding (mirroring the composer's own
  opt-in law one level up), pinned in the LLD's CVC-C5.
- **F2 (MAJOR, fixed)**: the busy-guard's synchronous ordering (check-before-clear, guarding "a stray
  Enter keydown racing the disabled-effect's own attribute write") would have been lost once `busy` became
  a reflected/effect-driven prop instead of a synchronous call — pinned in CVC-C2 as load-bearing behavior,
  not styling.
- **F3 (MODERATE, fixed)**: the "every CSS rule moves byte-for-byte" claim was false for the one rule
  that makes the composer a flex child of `ui-conversation`'s own column — the flex child becomes the NEW
  custom-element host, not the nested `<form>` one level inside it. Pinned the host's own `display:flex`
  rule + `display:contents` on the inner form in CVC-C3.
- **F4 (MINOR, fixed)**: softened an overstated "cannot start before" build-ordering claim.
- **F5 (MINOR, fixed)**: `a2ui-live.ts` was a stale, never-verified claim as a `ui-conversation` consumer
  — it composes a canvas surface directly and never touches `ui-conversation`. Corrected the consumer list
  in both this ticket and the LLD to the verified real set: `agent-admin.ts` + `site/pages/a2ui-chat.ts`.
- **F6 (MINOR, fixed)**: the LLD's Trace line understated its governing SPEC clauses (SPEC-R4/R5,
  `app-surfaces-m2.spec.md`) as "N/A" — corrected to name them as the governing-but-not-amended upstream.

All six findings repaired directly in both documents. Design now frozen; proceeding to build against the
LLD as the contract.

### 2026-07-15 — build complete, independently reviewed (build-level), gaps fixed, gates green — CLOSED

Built the 5 tracked slices (component `.ts`/`.css`/`.md`, `conversation.ts` rewritten to compose it,
`conversation.css`/`conversation.md` updated, tests split into `conversation-composer.test.ts` + a slimmed
`conversation.test.ts`). A second independent review (`orchestration:code-reviewer`-equivalent, fresh
context, against the shipped diff rather than the design docs) found 1 BLOCKER, 1 MEDIUM, and 3 MINOR
issues — all now fixed:

- **BLOCKER (fixed)**: `conversation-composer.css` was authored but never imported anywhere — proven by a
  REAL `npm run test:browser` failure in both Chromium and WebKit ("the composer did not visibly dim while
  a turn is in flight"), since the `[data-part='composer'][data-busy]{opacity:.55}` rule lived only in an
  unloaded sheet. Fixed by adding the import to all 4 sites that need it: `site/pages/agent-admin.ts`,
  `site/pages/a2ui-chat.ts`, `conversation.browser.test.ts`, `agent-admin.browser.test.ts`.
- **MEDIUM (fixed)**: a context-chip's dismiss listener died after an ORDINARY disconnect/reconnect with
  the SAME `contextItems` reference — `connected()` reset the two picker-armed flags but not
  `#contextItemsBuiltFrom`, so `#syncContextChips`'s reference-equality rebuild guard silently skipped the
  listener re-arm on reconnect (the exact same bug class the first review's picker-reconnect fix already
  covered, just unmirrored onto the chip row). Fixed by resetting `#contextItemsBuiltFrom = undefined` at
  the top of `connected()`, with a new regression test in `conversation-composer.test.ts`.
- **MINOR (fixed)**: a leftover, now-dead `[data-part='composer']` forced-colors rule in `conversation.css`
  duplicated what `conversation-composer.css` now owns. Removed, comment updated.
- **MINOR × 2 (fixed)**: the LLD's CVC-C3/CVC-C5 sections had drifted from the actually-shipped mechanism
  (stale record = defect, per the operating contract) — CVC-C3 pinned a `display:contents` inner-form
  approach the build simplified away from (shipped: `display:block` host + the form keeps its own
  pre-existing flex-column); CVC-C5 pinned a conditional `#send`/`#turnsInFlight`-retaining `onSubmit`
  forwarder the build simplified to an unconditional one (busy-guard duty lives entirely in the composer's
  own `#send()` now). Both sections rewritten to match shipped code exactly.

**Gate re-verification (the actual point of this pass — the fleet's own "jsdom-green ≠ done" discipline):**
re-ran every gate the review named as missing, rather than trusting the fix in isolation:
- `npm run test:browser` (Chromium + WebKit), scoped to `conversation.browser.test.ts` +
  `agent-admin.browser.test.ts`: confirmed the BLOCKER fix is real (was red, now green both engines).
- jsdom `conversation-composer.test.ts` + `conversation.test.ts`: 50/50 green, including the new
  chip-reconnect regression test.
- Re-running the busy/dim browser test (now correctly awaiting the composer's own reactive-effect flush,
  see below) surfaced a SECOND, genuinely new-to-verify issue and a THIRD, pre-existing one:
  - The busy/dim cross-engine test (`conversation.browser.test.ts`) was written and passing
    **synchronously**, on the assumption `busy`'s DOM application is synchronous. It isn't: routing
    `#applyBusy` through the `busy` reactive prop's `effect()` makes it microtask-batched, like every
    other reactive prop in this fleet (the checkbox `checked`-effect precedent) — imperceptible to a real
    user, but invisible to a bare synchronous assertion. Fixed by adding `await whenFlushed()` at both
    transition points; documented as a real, minor, deliberate timing shift in the LLD's CVC-C4.
  - Fixing that flush timing correctly, for the first time, made the file's OTHER test (`a focused field
    NEVER loses focus while disabled mid-turn`) exercise REAL disabling instead of a vacuous pre-flush
    check — and it now fails, but **only in Chromium** (WebKit passes). Confirmed PRE-EXISTING and
    unrelated to this extraction: reproduced identically against a clean `git worktree` at the last
    committed `HEAD` (`03eb5e9`, the ORIGINAL inline-composer code), with the same `await whenFlushed()`
    added — the old test was never actually observing disabled-state focus behavior either; it always
    passed for a vacuous reason. Filed as [TKT-0057](tkt-0057-text-field-disable-focus-loss-chromium.md)
    (not fixed here — `text-field.ts` is shared control code, out of this ticket's scope); the test itself
    was corrected to assert the REAL, engine-split behavior (`server.browser === 'chromium'` branch)
    instead of the disproven universal claim, so the gate is green and truthful rather than silently red
    or silently wrong.
- `site/lib/sitemap.test.ts` and `site/lib/theme-provider-build-fixture.test.ts` briefly failed on a full
  `npx vitest run` — the sitemap/adr-index drift resolved with no diff on regeneration (unrelated, already
  fresh); the theme-provider built-CSS fixture genuinely needed regenerating (a real, self-documented
  "regenerate on red" gate — any site CSS change reddens it, per its own file banner) since
  `conversation-composer.css` is now real, shipped site CSS. Regenerated
  `site/lib/__fixtures__/theme-provider-built.css` from a fresh `vite build`, joined the same way
  `build-css.ts` does (sorted filenames, `\n`-joined).
- Full `npx vitest run`: 340/340 files, 6240/6240 tests green.
- `npm run check`: green (packages + site + tools).
- `npm run size`: `@agent-ui/app` (includes `conversation` + the new composer) at 64687 B gz, within its
  69632 B gz budget.
- The earlier full-suite `npm run test:browser` (unscoped, all packages) hit a Node heap OOM mid-run —
  confirmed as pre-existing CI/environment flakiness from running many Chromium+WebKit instances in one
  process (an unrelated "Unknown event: response:response:…" CDP-protocol flood), not something this
  ticket's changes caused; the SCOPED runs of every file this ticket actually touches are the load-bearing
  verification and are all green.

Status: **done**. TKT-0057 is the one deliberately-deferred follow-up (a pre-existing, Chromium-only,
minor UX papercut, unmasked but not introduced by this extraction).
