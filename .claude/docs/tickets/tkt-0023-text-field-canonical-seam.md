---
doc-type: ticket
id: tkt-0023
status: open
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
