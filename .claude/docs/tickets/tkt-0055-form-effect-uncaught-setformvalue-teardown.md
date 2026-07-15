---
doc-type: ticket
id: tkt-0055
status: open
date: 2026-07-15
owner:
kind: bug
---
# TKT-0055 — a fleet-wide `dom/form.ts` reactive effect throws `setFormValue is not a function` hundreds of times during jsdom test teardown

## Summary
Surfaced while independently re-verifying TKT-0052's gates against the FULL `npm test` run (a narrower
suite selection had been used for TKT-0052's own review). `packages/agent-ui/app/src/controls/
agent-admin/agent-admin.test.ts` alone produces 660–840 uncaught exceptions:

```
TypeError: this.internals.setFormValue is not a function
 ❯ EffectNode.#fn packages/agent-ui/components/src/dom/form.ts:174:22
 ❯ ... UISwitchElement/UITextareaElement.connectedCallback packages/agent-ui/components/src/dom/form.ts:173:10
 ❯ invokeCEReactions node_modules/jsdom/lib/jsdom/living/helpers/custom-elements.js:190:31
```

Every individual test assertion in the file still passes (confirmed 37/37 and 45/45 across two runs),
but the uncaught exceptions make vitest's own process exit non-zero for that file, and — run inside the
full suite — flood the console with hundreds of repeated stack traces.

## Acceptance
- Root-caused: name whether this is an effect-graph lifecycle bug (a stale host reference kept alive past
  disconnect) or a jsdom `ElementInternals` polyfill gap, with the specific `dom/form.ts` line(s) at
  fault.
- `npx vitest run packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts` (and any other
  affected file) exits 0 with zero uncaught exceptions.
- Fixed with an independent review before merge, given `dom/form.ts` is shared kernel code every FACE
  form control depends on (the TKT-0051 cross-cutting-fix precedent — real regression surface, review
  required in real time).
- `npm run check && npm test` green fleet-wide, with no new uncaught-exception noise introduced elsewhere.

## Repro
```
npx vitest run packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts
```
All tests pass; the run still ends with `Errors  N errors` (N in the several-hundreds) and a non-zero
exit code.

## Expected vs actual
- **Expected:** a passing test file exits 0 with no uncaught exceptions.
- **Actual:** hundreds of uncaught `TypeError`s fire during/after teardown, from `dom/form.ts:174`'s
  reactive effect calling `this.internals.setFormValue(...)` on a `UISwitchElement`/`UITextareaElement`
  whose `ElementInternals` (jsdom's) apparently no longer exposes `setFormValue` at the point the effect
  re-runs — most likely an element disconnect/GC-timing race where the effect graph keeps a stale
  reference alive past its host's real lifetime, or a jsdom `ElementInternals` polyfill gap under repeated
  connect/disconnect cycles across many tests in one file.

## Classification
Axis: **structural** — a reactive-effect/host-lifecycle mismatch in the kernel layer (`dom/form.ts:174`),
not a defect in any one control or test. Plane: `packages/agent-ui/components/src/dom/form.ts` (the
`effectiveDisabled`/form-value-sync effect) × jsdom's `ElementInternals` under `UISwitchElement`/
`UITextareaElement` specifically (other controls using the same effect were not yet confirmed to hit or
not hit this, per Scope/Open below).

## Severity
**minor** — no observed test-assertion failures, no confirmed production-runtime impact (this is a
jsdom-only teardown artifact so far, not confirmed in a real browser); but it pollutes CI output at scale
(hundreds of stack traces per run) and flips vitest's own exit code for an otherwise fully-passing file,
which could mask a REAL regression's exit-code signal in the same run.

## Links
- `packages/agent-ui/components/src/dom/form.ts:174` (`EffectNode.#fn` — the effect calling
  `this.internals.setFormValue`)
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts` (where this reproduces at scale —
  confirmed present in this file's tests at both the current uncommitted working tree AND a clean
  `git worktree` checkout of committed `HEAD` — the last agent-admin.test.ts commit was `b8ed741`, well
  before TKT-0052; this is NOT something TKT-0052 or any currently-uncommitted work introduced)
- [TKT-0052](tkt-0052-agent-admin-live-model-overlay.md) — the ticket whose full-suite gate re-run
  surfaced this

## Scope/Open
- Not yet confirmed whether this reproduces in OTHER control test files that use `UISwitchElement`/
  `UITextareaElement` inside a form context, or is specific to `agent-admin.test.ts`'s particular
  mount/unmount pattern (it composes many form controls inside `entry-list.ts`-rendered rows, repeatedly
  connected/disconnected across many tests — a plausible aggravating factor, not confirmed as the root
  cause).
- Root cause not yet isolated — candidates named above (effect-graph stale-reference vs. jsdom
  `ElementInternals` gap) are hypotheses from the stack trace alone, not verified against `dom/form.ts`'s
  actual effect-cleanup logic.
- Deliberately NOT fixed as part of TKT-0052: `dom/form.ts` is shared kernel code every FACE form control
  depends on — a cross-cutting fix here carries real regression surface, and per this session's own
  TKT-0051 precedent, that class of fix should land with a reviewer available in real time, not
  unsupervised. Confirmed live concurrent activity on this repo (a running `vite` dev process) at
  discovery time was a second, independent reason to not touch shared kernel files right now.

## Findings
