---
doc-type: ticket
id: tkt-0021
status: done
date: 2026-07-11
owner:
kind: feature
size: small
---
# TKT-0021 — ui-settings wires store.subscribe: external writes reflect into live controls

## Summary
Kim's goal directive (2026-07-11): complete the ui-settings external-sync leg. The `SettingsStore`
interface already carries the F7-resolved optional `subscribe` (store.ts:34 — "changes from
OUTSIDE ui-settings (another tab, a remote push)"), but `ui-settings` never wires it: an external
`store.set` today does not reflect into a rendered control. The M4 Phase 3 review recorded TWO
seams the build inherits: (1) the unwired subscribe itself; (2) the setValue-after-connect codec
wall (schema.test.ts:127 documents that a programmatic setValue doesn't reach a text-field
codec's canonical without a real blur).

## Acceptance
- With a store exposing `subscribe`, an external `set(key, value)` reflects into the rendered
  control for every registry field type (text/number/date via the codec seam, boolean→switch,
  select, slider) — including the codec-wall types (the fix must land wherever the wall really
  is: the RegisteredControl bridge or the control's own value seam; root cause, not a blur hack).
- NO echo loop: an external set reflecting into a control MUST NOT re-emit as a user commit back
  into `store.set` (assert exactly zero store writes per external set); a USER edit still
  commits exactly once (unchanged).
- Stores WITHOUT subscribe: behavior byte-identical (the optional seam stays optional).
- The subscription honors the reconnect law (the M4 relocation class): unsubscribed on
  disconnect, re-subscribed on reconnect (a leak test across repeated relocations).
- The memory-store reference adapter implements subscribe (it's the test vehicle).
- Descriptor/docs truthful; the m4 SPEC/LLD gain REV rows annotated as REALIZING ADR-0120 F7's
  already-accepted optional-subscribe arm (not a contract change — no new ADR unless a genuine
  fork emerges).
- Cross-engine legs for at least the codec-wall type + switch; existing 151 app jsdom + browser
  suites untouched-green.

## Links
- `packages/agent-ui/app/src/controls/settings/{store.ts,memory-store.ts,settings.ts,generate.ts,schema.test.ts}`.
- `.claude/docs/lld/app-surfaces-m4.lld.md` §4 + `spec/app-surfaces-m4.spec.md` (REV rows land
  here) · ADR-0120 F7 (accepted — the authority).
- The M4 Phase 3 review record (the two seams) — `.claude/docs/tickets/`/CHANGELOG 2026-07-11.

## Scope / Open
- The echo-suppression mechanism (a reflecting-write guard vs value-equality cutoff) — builder
  decides from the kernel's Object.is precedent, flags if contested.
- **Non-goals:** async/remote store transport (PRD fence); batched conflict resolution.

## Findings

**2026-07-11 — build complete.**

- **Root cause of the codec wall (verified, not assumed):** `ui-text-field`'s display↔canonical split
  (`traits/value-codec.ts`) only ever updates `canonical` from three places, ALL internal to
  `text-field.ts`/`value-codec.ts`: the codec's own `blur` listener (`onBlur`), and the four internal
  affordance call-sites that call the controller's `setCanonical` directly (clear button, steppers,
  calendar `select`, color-picker `change`). `#codec` is a private field; `ValueCodecController.setCanonical`
  is never exposed through `FormConnectDetail` or any other public seam. So a programmatic `el.value = …`
  write from OUTSIDE the control (exactly what an external `store.set` reflection does via
  `applyControlValue`) updates the DISPLAY immediately (the model→surface caret-guard effect) but leaves
  `canonical` — and therefore `formValue()`/`getValue()` — stale until a REAL blur occurs. There is no
  public components-tier seam to force a resync short of that blur, and dispatching a synthetic blur was
  ruled out as a disallowed hack. **Per the constraint, this was NOT fixed locally** (`packages/agent-ui/
  components/**` untouched) — it is reported here as a components-tier gap: closing it would need a new
  public seam on `UITextFieldElement` (e.g. exposing `setCanonical` through `FormConnectDetail`, or a
  general "resync canonical from current value" method), which is its own review scope.
  Consequence for THIS ticket: external sync reflects the RAW value into `number`/`date` fields (visible
  immediately, same as any other type) — only their internal canonical stays wall-gated, matching the
  pre-existing, documented (`schema.test.ts:127`) limitation. Every other v1 type (text/boolean/select/
  slider) has no such split and reflects fully, `getValue()` included.
- **Echo-suppression mechanism decided: the Object.is value-equality cutoff** (not a reflecting-write
  flag). `generate.ts`'s new `subscribeExternalSync` skips `registered.setValue(value)` whenever
  `Object.is(value, registered.getValue())` already holds. This one line covers both the "genuinely
  redundant external set" case and the load-bearing one — `memory-store.ts`'s `set()` notifies EVERY
  listener including the field's own subscription for a commit that field just made (deferred one
  microtask); by the time that self-notification arrives, `getValue()` already reads the just-committed
  value back, so the cutoff fires and nothing re-writes the control mid-commit. No flag, no re-entrancy
  tracking. Verified none of the six registry controls dispatch a commit event (`change`/`select`) as a
  side effect of a plain property write (only from a user gesture — click/keydown/blur-with-change) — so
  a reflection can never itself call back into `store.set`, confirmed by grep + read of `checkbox`/
  `switch`'s shared `indicator-element.ts`, `slider`'s `range-element.ts`, and `select.ts` (which, notably,
  never emits `change` at all — only `select` — an existing, out-of-scope gap noted below).
- **Adjacent gap noticed in this pass, FIXED in the follow-up pass below:** `ui-select` never emits a
  native `change` event (only `select`, per its own code comment at `select.ts:211-212`) — `generate.ts`'s
  per-field `change` listener (pre-existing) therefore never committed a `select`-type field's user edit
  to the store. See the 2026-07-11 (pass 2) entry below.
- **Files touched:** `packages/agent-ui/app/src/controls/settings/{generate.ts, settings.ts, store.ts,
  settings.md}` (+ tests: `generate.test.ts`, `settings.test.ts`, `settings.browser.test.ts`) +
  `.claude/docs/{spec/app-surfaces-m4.spec.md, lld/app-surfaces-m4.lld.md}` REV rows. `memory-store.ts`
  and `schema.ts` needed NO changes (subscribe already implemented; the registry's `RegisteredControl`
  bridge already had everything `subscribeExternalSync` needed).
- **Reconnect law:** `GeneratedSection` grew `resubscribe()` (mirrors `reapplyValidation()` exactly);
  `settings.ts`'s reconnect branch calls both. Leak-tested across 5 repeated relocations with a hand-rolled
  store exposing its live listener-Set size — count never exceeds the schema's field count (2) at rest,
  never grows.
- **Gates:** `npm run check` (tsc + check:site + check:tools) green. `npx vitest run packages/agent-ui/app`
  — 164 passed (0 failed; 14 new: 11 in `generate.test.ts`, 3 in `settings.test.ts`), all 151 pre-existing
  untouched (only additions, `git diff --stat` confirms zero lines changed in any pre-existing test body).
  `npm run test:browser` app project — 20 passed (10 legs × Chromium + WebKit), incl. 2 new cross-engine
  legs (switch + the `number` codec-wall type). Full repo `npm test` — 1 unrelated pre-existing failure in
  `packages/agent-ui/a2ui/src/corpus/admission-coverage.test.ts` (TKT-0022, a different in-flight ticket;
  confirmed failing identically with this ticket's changes stashed out — not this build's regression).
  `npm run size` — `@agent-ui/app` marginal 24706 B gz, within the 26624 B gz budget (was 24604 B gz per
  the M4 Phase 3 review; **+102 B gz** for `subscribeExternalSync` + `resubscribe` + the `synced` array —
  headroom now 1918 B gz, ~7.2% (was ~7.6%)).
- **Deviations:** none from the ticket's contract. `packages/agent-ui/components/**` was NOT touched (the
  codec wall, verified above, genuinely lives there — reported per the ticket's explicit STOP instruction
  rather than worked around locally).

**2026-07-11 (pass 2) — the select commit-event gap, fixed (team-lead dispatch: the codec wall is now
tkt-0023, components-tier, separate; this gap is app-tier and rides this wave).**

- **Root cause:** `generate.ts` wired a single, universal `change` listener for every field's per-field
  commit. `ui-select`'s own `selectionCommit` trait (`traits/selection-commit.ts`) only ever emits `select`
  — confirmed by the control's own code comment ("select never emits a native change event... BLUR is the
  sole interaction signal", `select.ts:211-212`) and by `select.md`'s `events:` block (`select`/`toggle`/
  `close` — no `change` entry at all). Consequence: a user's `select`-type commit (choosing an option)
  NEVER reached `store.set` in the shipped Phase 3 build — a genuine functional bug in the feature this
  ticket extends, not a hypothetical.
- **Fix:** `generate.ts` gained `COMMIT_EVENT`, a `Record<SettingsFieldType, string>` (exhaustive by
  TypeScript construction — a future registry type must name its commit event here or the type check
  fails) naming each of the six v1 types' own documented commit event, verified per-control against its
  `.md` descriptor: `text`/`number`/`date` (`ui-text-field`) → `change`; `boolean` (`ui-switch`) →
  `change`; `select` (`ui-select`) → `select`; `slider` (`ui-slider`) → `change`. The per-field listener
  now reads `COMMIT_EVENT[field.type]` instead of a hardcoded `'change'`.
- **Guarantees held across the fix:** exactly-once commit (unchanged — one listener per field, same as
  before, just the right event name) and the zero-echo Object.is cutoff (verified: writing `.value`
  programmatically on `ui-select`, same as every other type, does not itself dispatch `select` — confirmed
  by reading every reactive effect in `select.ts`; only `selectionCommit`'s user-gesture path emits it).
- **Tests added** (`generate.test.ts`, new describe `generateSection — per-field commit event (the select
  gap fix)`): (1) a real `select`-type user commit (dispatching the control's OWN `select` event) persists
  to the store — **verified to FAIL pre-fix** by temporarily reverting `COMMIT_EVENT[field.type]` to the
  literal `'change'` and re-running (3 of 5 new tests failed exactly as expected, the other 2 passed
  unaffected — confirming they test the right thing before restoring the fix); (2) a negative control —
  dispatching `change` (the pre-fix wiring) on a `select` control commits NOTHING; (3) the other five v1
  types still commit correctly (unregressed by introducing the per-type table); (4) external-set reflection
  on `select` stays zero-echo across the `select` commit-event path; (5) a `select` user commit still
  commits exactly once. Also added to `settings.test.ts`: one full-stack (`UISettingsElement` → `generate.ts`
  → real `ui-select`) end-to-end commit test.
- **Docs corrected for truthfulness:** `settings.md`'s "Persistence" prose no longer claims a universal
  `change` commit event — now names the per-type table + the `select` exception. New REV notes in both
  `spec/app-surfaces-m4.spec.md` (SPEC-R12, framed as an AC1 defect fix, not merely additive — AC1 was
  silently false for `select` fields) and `lld/app-surfaces-m4.lld.md` (LLD-C13 failure/edge section).
- **Gates:** `npm run check` green. `npx vitest run packages/agent-ui/app` — 170 passed (6 more than pass
  1's 164: 5 in `generate.test.ts`, 1 in `settings.test.ts`), 0 failed, no pre-existing test bodies
  touched. `npm run test:browser` app project unaffected by this pass (no new browser leg added — the fix
  is a jsdom-provable event-name correction, not a geometry/cross-engine concern; the existing 20 browser
  tests still pass — re-run, all 82 assertions (browser test count × 2 engines) green). `npm run size` —
  `@agent-ui/app` marginal now 24740 B gz (was 24706 after pass 1), **+34 B gz** for `COMMIT_EVENT` — still
  within the 26624 B gz budget, headroom ~7.1%.
- **Deviations:** none. No components-tier code touched (the fix is entirely `generate.ts`'s own event-name
  table). No commits made.
