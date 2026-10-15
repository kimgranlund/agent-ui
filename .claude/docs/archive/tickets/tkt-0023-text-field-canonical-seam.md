---
doc-type: ticket
id: tkt-0023
status: done
date: 2026-07-11
owner:
kind: bug
---
# TKT-0023 — ui-text-field: a programmatic `value` write leaves canonical stale until a real blur

## Summary
Found root-caused during TKT-0021 (the builder verified from source, correctly stopping at the
components boundary): `ui-text-field`'s display↔canonical split (`traits/value-codec.ts`) only
updates `canonical` from internal call-sites — the codec's own `blur` listener plus four internal
affordances (clear/steppers/calendar-select/color-picker-change) calling the private controller's
`setCanonical`. A programmatic `el.value = …` write from OUTSIDE (a form generator, an A2UI
two-way binding, the settings external sync) updates the DISPLAY immediately but leaves
`canonical` — and therefore `formValue()`/`getValue()` — stale until a REAL blur. No public seam
exists to resync; a synthetic blur is a disallowed hack. First documented at
`packages/agent-ui/app/src/controls/settings/schema.test.ts:127`; consumers currently absorb it
as "the codec wall".

## Acceptance
- A programmatic `value` write on a codec-carrying type (number/currency/unit/percent/date/time/
  color) reaches `canonical` — `formValue()` and the FACE form value reflect it — WITHOUT a blur,
  when the editor is NOT focused (the sane default: an unfocused control has no in-flight user
  edit to protect).
- The mid-edit conflict case (a programmatic write while the editor IS focused) gets an EXPLICIT,
  documented semantic — decided from the codec's own display-is-source-while-typing contract
  (likely: the caret-guard display behavior today, canonical syncs on the existing blur path) —
  never an accident.
- The fix lands at the ROOT (the value prop's model→surface path / the codec controller), not a
  new public method consumers must remember to call — unless the root genuinely can't carry it,
  in which case the seam is exposed through `FormConnectDetail` (the ADR-0050 registration
  detail) and the choice argued.
- type=text (no codec) byte-identical; the 13 types' existing suites untouched-green; new legs
  per codec type for the unfocused-write path; the TKT-0021 settings limitation note + the
  `schema.test.ts:127` documentation updated to the new truth (the app-tier consumer test that
  documented the wall flips to proving the fix).
- Cross-engine browser legs (focus states are engine-sensitive); the component review gate before
  commit.

## Repro
`el = <ui-text-field type=number>` connected, not focused; `el.value = '42'`; read `formValue()`
/ FormData — stale until the editor receives focus+blur.

## Expected vs actual
- **Expected:** an unfocused programmatic write is authoritative — canonical + form value update.
- **Actual:** display updates; canonical/form value stale until a real blur.

## Classification
Axis: **functional (form-value integrity)** — plane `controls/text-field/` + `traits/value-codec.ts`
(components tier). Consumers: settings external sync (tkt-0021), any programmatic form fill, A2UI
TextField two-way bindings (verify whether the renderer's write path hits the same wall — the
input controller writes the prop programmatically).

## Severity
**major** — silent form-value staleness on programmatic writes across seven typed variants.

## Links
- `packages/agent-ui/components/src/{controls/text-field/text-field.ts,traits/value-codec.ts}` ·
  ADR-0044/0047 (the codec design) · ADR-0050 (FormConnectDetail, the fallback seam's home).
- `.claude/docs/tickets/tkt-0021-settings-external-sync.md` — the discovering Findings entry.
- `packages/agent-ui/app/src/controls/settings/schema.test.ts:127` — the documented wall.

## Findings

**2026-07-11 — build complete.**

- **Root cause fix (root-level, not a consumer-facing method):** `traits/value-codec.ts`'s `valueCodec()`
  gains a THIRD reactive path alongside focus/blur — an independent `effect()` that tracks `host.value`
  directly. It is created as its OWN graph node (not nested lexically inside the control's type-effect,
  though it IS called from inside that effect's body) so its tracked read of `host.value` never becomes a
  dependency of the caller's outer effect — same discipline the existing `untracked()` seed line already
  protects (verified against the kernel: `activeConsumer` is swapped per-effect-node during `e.run()`, so a
  nested `effect()` call does not pollute the enclosing effect's dependency set — confirmed by the
  pre-existing `NC — untracked() codec seed` test in `text-field.test.ts` staying green, unmodified).
  - Skips its own FIRST run (the `untracked()` seed already covers the value at attach/type-switch time) —
    this avoids flipping `hasError` on a bad *seeded* value the pre-fix code never flagged before an
    interaction (out of this ticket's scope; a defensible, deliberately conservative choice).
  - While the codec's own `focused` flag (driven by the SAME onFocus/onBlur pair — NOT
    `document.activeElement`, since this control is exercised throughout the suite via synthetic
    focus/blur dispatch, never real DOM focus) is true: SKIPPED. This is the documented mid-edit
    semantic (see Acceptance bullet 2) — canonical still resyncs on the NEXT blur, same as any typed edit.
  - While unfocused: mirrors `onBlur`'s own parse/hasError contract exactly — `''` short-circuits to
    `canonical=''/hasError=false` (the same known-good-empty precedent `setCanonical`'s internal callers
    already rely on, e.g. the clear button); non-empty parses through `opts.parse` (success → canonical set,
    hasError cleared; failure → hasError set, canonical left untouched — never a silently wrong canonical).
  - Never rewrites `host.value`/the display — the existing model→surface caret-guard effect already
    reflects the raw written value; reformatting-on-write was deliberately kept OUT of this fix's contract
    (only a real blur reformats), keeping the diff minimal and the display behavior unchanged.
  - Disposed by the SAME `release()` call the type-effect's cleanup already invokes on both type-switch and
    disconnect — no new cleanup wiring needed in `text-field.ts`. A defense-in-depth `host.isConnected`
    guard (added because `host.connectionSignal` is `protected` — a trait cannot reach it) additionally
    covers the trait-level unit test's no-typeSignal fallback path, where `release()` is deliberately never
    called (proves listener-style zero-residue via a different, but observably equivalent, mechanism).
- **The focused mid-edit semantic (Acceptance bullet 2), decided:** display-is-source-of-truth while
  mid-edit (the codec's existing contract) — a programmatic write that arrives while the editor is
  focused updates the surface (unchanged, pre-existing model→surface effect) but does NOT resync
  canonical; canonical catches up on the NEXT real blur, exactly as if the programmatic value had been
  typed. Documented in `value-codec.ts`'s header and `text-field.md`'s Form participation section. No
  double-commit: the resync is silent (touches only `canonical`/`hasError`, never emits an event) — only
  the control's own blur/Enter commit logic emits `change`, verified by a dedicated test (mid-edit write +
  one real blur → exactly one `change`).
- **A2UI renderer finding (verified, not assumed):** the renderer's data→control write path
  (`a2ui/src/renderer/widget.ts`'s `bindProp` effect → `factory.applyProp` → `catalog/default/factories.ts`'s
  `setProp`, i.e. `(el as unknown as Record<string, unknown>)[prop] = value`) hits the EXACT SAME wall
  pre-fix — confirmed by a throwaway scratch test (built, run, and deleted before this report; never
  committed) that called the identical `el.value = '42'` shape on a real `type=number` `ui-text-field` and
  read the result back via `formValue()`: failed pre-fix (`''`), passed post-fix (`'42'`), with the a2ui
  package's own source left byte-for-byte untouched (`git status -- packages/agent-ui/a2ui/` confirmed
  clean of any edit from this ticket). The renderer needs NO code change — the fix is entirely in the
  shared `ui-text-field`/`value-codec.ts` layer both the components-tier and the A2UI-tier TextField factory
  bind to.
- **TKT-0021 Findings superseded:** its "Root cause of the codec wall" entry (2026-07-11) describing the
  wall as unfixed at the components tier is now resolved by this ticket — the wall it documented no longer
  exists; `schema.test.ts:127`'s test (flipped below) now proves the fix instead of documenting the limit.
- **Files touched:** `packages/agent-ui/components/src/traits/{value-codec.ts,value-codec.test.ts}` ·
  `packages/agent-ui/components/src/controls/text-field/{text-field.test.ts,text-field.md,
  text-field-states.browser.test.ts}` · `packages/agent-ui/app/src/controls/settings/schema.test.ts`
  (the one sanctioned app-tier edit — the `number: setValue AFTER connect` test flipped to prove the fix,
  `whenFlushed()` awaited) · this ticket. `text-field.ts` itself is UNCHANGED — the fix landed entirely in
  the shared trait, so all 13 types pick it up for free with zero per-type code.
- **Tests added:** `value-codec.test.ts` +16 (unfocused-write resync per codec family — number/currency/
  date/time — plus the empty-write precedent, the parse-failure-untouched-canonical case, the focused
  mid-edit deferral, a post-mid-edit real-blur idempotency check, and the disconnected-host zero-residue
  case). `text-field.test.ts` +7 (the FACE `formValue()`/`calls.formValues` proof per codec shape —
  number/currency/date/color — the focused mid-edit case, and the no-double-`change` guard).
  `text-field-states.browser.test.ts` +2, both engines (a real `userEvent.click()`-focus mid-edit deferral
  proof + an unfocused real-`<form>`/FormData round-trip, no synthetic dispatch). `schema.test.ts`: 1 test
  flipped (not net-new). All 13 existing type suites and all pre-existing value-codec/text-field/app tests
  are untouched-green (additive only — `git diff` on every pre-existing test body is empty).
- **Gates:** `npm run check` green (tsc + check:site + check:tools). jsdom:
  `npx vitest run packages/agent-ui/components/src/controls/text-field packages/agent-ui/components/src/
  traits packages/agent-ui/app` — 24 files, 529 passed, 0 failed. Browser (both Chromium + WebKit):
  `npx vitest run --config vitest.browser.config.ts packages/agent-ui/components/src/controls/text-field`
  — 4 files, 80 passed (0 failed), including the 2 new TKT-0023 legs on both engines. Full-repo
  `npx vitest run` — 6 pre-existing failures, all in `site/` (`a2ui-chat.test.ts` ×3,
  `theme-provider-build-fixture.test.ts`, `site-canon.test.ts`) plus none in this ticket's scope; confirmed
  identical with this ticket's changes stashed out (concurrent in-flight a2ui-chat work, not this build's
  regression). `npm run size`: `text-field` marginal 0 B gz (within the 4352 B gz budget, unchanged from
  pre-fix), `@agent-ui/app` marginal 24829 B gz (within 26624 B gz, unchanged) — the fix added no
  measurable bundle weight.
- **Deviations:** none from the ticket's contract. `packages/agent-ui/a2ui/**` left untouched (verified
  clean via `git status`) per the read-only instruction — reported above instead of fixed there, since no
  fix was needed there at all.
