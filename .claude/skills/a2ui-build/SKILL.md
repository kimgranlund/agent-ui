---
name: a2ui-build
description: >-
  The build METHOD for @agent-ui/a2ui package units — the canonical sources to read, the ground
  rules, the implement→probe procedure, and the validation loop for building or upgrading ONE unit
  of the A2UI protocol layer (the zero-dep renderer, the default catalog + conformance, protocol.ts
  wire types, the validation spine, the corpus store, A2UI/A2A conformance) to the SPEC/LLD standard.
  Model-only knowledge preloaded by the a2ui-builder seat; not a user-facing action. NOT for A2UI
  PAYLOAD composition (a2ui-compose), corpus curation (a2ui-corpus-curate), or ui-* control source
  (agent-ui-component-create).
user-invocable: false
disable-model-invocation: false
---

# a2ui-builder method — build one @agent-ui/a2ui unit to the SPEC/LLD standard

The a2ui-builder seat implements ONE unit per dispatch, **spec-faithful by construction**: protocol
behavior comes from the canonical records it CITES, never copies — and never from inference. It
builds; it never grades its own output (the `a2ui-reviewer` critic does — generator ≠ critic).

## Canonical sources (read before starting; single-owner, cite by id/mechanism — never a copied line)

- **Why/what** — the product frame + goals: `.claude/docs/prd/a2ui-expert-system.prd.md` (PRD-G#).
- **Wire truth** — the discriminated unions the protocol IS: `packages/agent-ui/a2ui/src/protocol.ts`.
- **Requirements** — `.claude/docs/spec/a2ui-runtime.spec.md` (SPEC-R#/SPEC-N#; N5 zero-dep,
  N6 validator parity) · `a2ui-catalog.spec.md` (the two-tier catalog model, PropDef shapes) ·
  `a2ui-streaming-pipeline.spec.md` · `a2ui-training-corpus.spec.md` · `a2ui-expert-harness.spec.md`.
- **Design** — `.claude/docs/lld/a2ui-renderer.lld.md` (LLD-C1..C14 + the build sequence) ·
  `a2ui-catalog.lld.md` · `a2ui-streaming-pipeline.lld.md` · `a2ui-corpus-store.lld.md` ·
  `a2ui-harness-wiring.lld.md`.
- **Decided history** — the A2UI ADR line in `.claude/docs/adr/`: 0011 (action shape) · 0024
  (v1.0 lists are POSITIONAL — the index IS the key) · 0026/0027/0028 (function calls · `${…}`
  interpolation · fn-expression grammar) · 0029 (`checks` → setCustomValidity) · 0031 (rich internal
  errors → the TWO-code wire vocab at `#emit`) · 0034 (`callFunction`/`callableFrom`,
  most-restrictive-wins) · 0023 (kernel reuse ONLY via the public seams: `mount` + the directive
  trio — never the private `html``` entry).
- **Conventions** — `CLAUDE.md` (strict TS, `.ts` imports, layering: a2ui depends on
  `@agent-ui/components`, nothing imports upward).

## Ground rules (the judgment layer)

1. **The spec is upstream of the build.** Every unit traces to `SPEC-R#`/`LLD-C#` IDs — no orphans,
   no gold-plating. When implementation reveals the spec can't hold, STOP and escalate for an
   owning-doc repair + ADR; never patch the symptom locally.
2. **Repo-absence ≠ spec-absence.** When the SPEC/LLD seems silent on external protocol behavior
   (A2UI v1.0, A2A), do NOT infer or defer — report the exact gap and ask the host to fetch the
   authoritative source (the host verifies with quoted evidence; the seat builds from the verbatim
   facts handed back). This seat has no fetch tool by design.
3. **The state of the build is `git log` + the realized code — never a session-note file.** Before
   claiming a unit is missing or pending, check the tree: the module inventory and its co-located
   probes are the ground truth; planning notes rot.
4. **Zero-dep is a hard invariant (SPEC-N5)** — no new dependencies, ever; the renderer's only
   platform is the components package's public seams + the browser.
5. **Validator parity (SPEC-N6)** — the validation spine is shared by the renderer
   (`renderer/validate.ts`), corpus admission (`corpus/validate.ts`), and CI; a behavior change in
   one leg without the others is a defect.
6. **A2A alignment rides the wire types** — A2UI is the generative-UI payload standard in the
   Agent2Agent ecosystem; anything crossing the wire (messages, errors, callFunction,
   functionResponse) keeps `protocol.ts` as the single source and the ADR-0031 two-code error
   contract at the boundary.
7. **Binding performance is a law, not a preference** — fine-grained waking rides the kernel's
   Object.is cutoff + structural-sharing pointer writes (per-path waking yes; per-path
   invalidation no). Don't add caching or diffing the kernel already provides.

## Procedure

1. **Locate the unit** on the owning LLD's build sequence; read its SPEC-R#/LLD-C# rows + any ADR
   that touched it. Read the REALIZED neighbors (`renderer/*.ts` co-located tests show the house
   probe voice).
2. **Implement** to the frozen interfaces; catalog entries bind DIRECTLY to `ui-*` factories
   (catalog SPEC-R8, no adapter — IDs are file-scoped; qualify cross-doc references). If the unit
   needs a component-side change — a new prop/event/two-way bind — that is component-builder
   territory: escalate the exact interface need, don't cross the package boundary.
3. **Probe** — co-located `*.test.ts` (jsdom) with negative controls; conformance fixtures where the
   catalog/validator is touched; browser smoke when the unit drives rendered controls
   (jsdom-green ≠ done).

## Validation loop (finalize only when clean)

`npm run check` and `npm test` green — run and read them by exit code, separately. The
validator-parity leg (N6) is re-proven when the spine is touched. The reviewer seat the host names
grades against the owning SPEC/LLD acceptance rows (the a2ui-specific rubrics have LANDED —
`.claude/docs/rubrics/a2ui-{payload,catalog,corpus}.md` — grading a2ui ARTIFACTS: payloads ·
catalog rows · corpus records via the `a2ui-reviewer` critic; this seat's package units still trace
to the SPEC/LLD acceptance rows, and `a2ui-harness-wiring.lld.md` §9 keeps `a2ui-builder` out of the
maker→rubric wiring check) — fix the unit, not the check.

`renderer/binding.ts` + `renderer/list.ts` are realized references — read one end-to-end before a
first build. Escalate design conflicts to the coordinator or host; never edit a SPEC, LLD, or ADR
to fit the build.
