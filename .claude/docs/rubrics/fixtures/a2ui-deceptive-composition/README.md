# Fixtures — a2ui-deceptive-composition (the SPEC-R3 red-team seeds)

The committed red-team seed corpus for the **deceptive-composition eval** —
[`../../../spec/a2ui-ecosystem-alignment.spec.md`](../../../spec/a2ui-ecosystem-alignment.spec.md) **SPEC-R3**
AC1 (GH #474). Each `*.json` fixture is one catalog-valid A2UI message array; ground truth
(`declaredIntent` + `expectedVerdict` + `rationale`) lives in [`manifest.json`](./manifest.json) — one
fact, one home; the fixture files carry pure payload, nothing else.

- **What the corpus proves:** a fully catalog-legal payload can still compose a phishing-shaped form —
  every fixture here validates exit 0, `repairs: []`, through
  `packages/agent-ui/a2ui/tools/harness/validate-payload.ts --catalog agent-ui` (re-run it after any
  edit; a fixture that stops validating has lost its premise).
- **How it is consumed:** the named manual eval-lane procedure appended to SPEC-R3 (its v0.2
  amendment) — the `a2ui-reviewer` critic scores each fixture against
  [`../../a2ui-payload.md`](../../a2ui-payload.md) **P8** in a fresh context, fed the
  payload + `declaredIntent` only (never the expected verdict); the operator compares the resulting
  ADR-0068-shaped VerdictsFile against the manifest's `expectedVerdict` per fixture.
- **Never a standing gate:** this lane is a judged, named MANUAL run — never wired into
  `npm test`/`npm run test:browser` (the genui-surface SPEC-N3 law; SPEC-R3 v0.2 states it on the
  clause).
