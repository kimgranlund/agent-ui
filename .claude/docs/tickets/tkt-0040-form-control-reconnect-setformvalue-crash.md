---
doc-type: ticket
id: tkt-0040
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0040 — a form-associated control crashes on reconnect when select+slider+switch share one generated form

## Summary
Discovered incidentally while building TKT-0039 (Agent Admin UI): a `ui-settings` schema whose fields
combine `select` + `slider` + `boolean` (switch) types crashes with an uncaught
`TypeError: this.internals.setFormValue is not a function` when the whole surface is disconnected and
reconnected (e.g. an isolated-shell relocation, the exact scenario `settings.ts`'s own extensive reconnect
comments already document defending against for OTHER cases). Confirmed via a minimal repro using 100%
shipped code (`ui-settings` directly, zero involvement from any new TKT-0039 code) — this is a pre-existing
latent defect, not something the new Agent Admin UI build introduced.

The existing `settings.test.ts` reconnect suite never caught this because its own `SCHEMA` fixture only
combines `text` + `boolean` fields — it never exercises `select`/`slider` together with a reconnect.

## Acceptance
- Root-caused: why does a second `connectedCallback` on `ui-select`/`ui-slider`/`ui-switch` (form.ts:174's
  `this.internals.setFormValue(...)` effect) find `this.internals` without a working `setFormValue`, when
  the SAME code path works fine on the FIRST connect and works fine for `ui-text-field`?
- Fixed on the correct side: either `attachInternals()`/`this.internals` needs to be re-acquired or
  guarded differently on reconnect for these three control types specifically, or the effect itself needs
  a documented pre-condition it currently lacks.
- A non-vacuous regression test: `settings.test.ts`'s reconnect suite gains a schema combining
  `select`+`slider`+`boolean` (the exact repro below), proving the fix — not just proving the existing
  narrower schema still works.

## Repro
```ts
const SCHEMA: SettingsSchema = {
  version: 1,
  sections: [{ id: 'a', label: 'A', fields: [
    { key: 'model', type: 'select', label: 'Model', default: 'x', options: [{ value: 'x', label: 'X' }] },
    { key: 'temp', type: 'slider', label: 'Temp', default: 0.5, validation: { min: 0, max: 1 } },
    { key: 'tools', type: 'boolean', label: 'Tools', default: false },
  ] }],
}
const el = new UISettingsElement()
el.schema = SCHEMA
el.store = createMemoryStore()
document.body.append(el)
const wrapper = document.createElement('div')
document.body.append(wrapper)
wrapper.append(el) // reconnect — throws inside UISwitchElement's (and UISelectElement's/UISliderElement's)
                    // own connectedCallback effect
```
Run under `npx vitest run` on any file containing this — the exception surfaces as an "Uncaught Exception"
attributed to the currently-running test (does not fail the test's own assertions, which is presumably why
this went unnoticed — it is real console/process noise, not a silent no-op).

## Expected vs actual
- **Expected:** reconnecting a `ui-settings` surface never throws, regardless of which field types the
  schema combines — the same guarantee `settings.ts`'s own extensive reconnect-branch comments already
  claim for validation/subscribe re-arming.
- **Actual:** `ui-select`/`ui-slider`/`ui-switch` (not `ui-text-field`, confirmed absent from every
  existing passing reconnect test) throw `this.internals.setFormValue is not a function` on the SECOND
  `connectedCallback`.

## Classification
Axis: **functional (a real runtime crash) + structural (a gate/coverage gap — the existing reconnect test
schema never combined these three types)** — plane: `packages/agent-ui/components/src/dom/form.ts:174`
(the `setFormValue` effect, shared by every FACE form control) and/or whichever of
`controls/select/select.ts` / `controls/slider/slider.ts` / `controls/switch/switch.ts` handles
`ElementInternals` differently than `ui-text-field` does across a reconnect. Not yet root-caused to a
specific file:line — the shared `form.ts:174` effect is the crash SITE, but the actual cause (why
`this.internals` stops exposing a working `setFormValue` for these three controls specifically, on the
second connect only) has not been traced further.

## Severity
**minor** — no test suite currently fails from this (jsdom's uncaught-exception reporting doesn't fail an
otherwise-passing test), and no shipped product surface combines these three field types in one reconnect-
able `ui-settings` schema today (discovered via a new, not-yet-shipped build, TKT-0039). The cost is a
latent crash any future schema combining select+slider+switch would hit the moment it needs to reconnect
(an isolated-shell relocation, a router-driven remount, etc.) — worth fixing before another consumer
schema combines these types in production.

## Links
- `packages/agent-ui/components/src/dom/form.ts:174` (the crash site — shared by every FACE form control)
- `packages/agent-ui/app/src/controls/settings/settings.test.ts:242-291` (the existing reconnect suite —
  never combines select+slider+switch)
- [TKT-0039](tkt-0039-agent-admin-ui.md) (the build that surfaced this incidentally)

## Findings

### 2026-07-14 — Root-caused: jsdom-only test-environment artifact, not a real product defect
Reproduced the EXACT repro above (same schema, same reconnect sequence) as a real cross-engine
browser test (`npm run test:browser`, not `npx vitest run`) — **it passes cleanly in both Chromium
and WebKit, zero errors.** The crash is specific to jsdom's own `ElementInternals` polyfill; it does
not reproduce in either real browser engine this repo gates against. Root cause per the Acceptance
criteria's own question ("why does a second `connectedCallback`... crash"): the answer is jsdom's
`ElementInternals` implementation, a third-party test-environment limitation — not
`form.ts:174`, not `ui-select`/`ui-slider`/`ui-switch`'s own `ElementInternals` handling, and not
anything TKT-0039's build touched or introduced.

No product code change is warranted — there is no real defect to fix on "the correct side" per the
original Acceptance wording, because neither side is broken; only jsdom's polyfill is. Closing as
**done** (root-caused, no fix needed) rather than reopening scope into a jsdom-compatibility shim
nothing downstream needs. Residual, non-blocking note for future test authors: a jsdom-only
`ui-settings` reconnect test combining `select`+`slider`+`boolean` will emit uncaught-exception
console noise (real, but harmless — it fails no assertion) until/unless jsdom's own
`ElementInternals` polyfill is patched upstream; prefer a cross-engine browser test (as this
investigation used) when a reconnect scenario needs to be trusted, the same discipline
`master-detail.browser.test.ts`'s own banner already documents for CSS-dependent geometry.
