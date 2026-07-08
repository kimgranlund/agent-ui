# ADR-0099 — `updateDataModel` `path:"/"` is the protocol's root alias: whole-model replace at every apply-site

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 |
> | **Proposed by** | system-planner — encoding the host-verified upstream conformance ruling behind the reproduced live-agent "empty hand" defect |
> | **Ratified by** | *(pending — orchestration-coordinator, after doc-reviewer)* |
> | **Repairs** | runtime `SPEC-R5` (+ AC2) · renderer LLD §5 whole-model apply note (`LLD-C13` host semantics, `LLD-C5` layering) · corpus-store LLD §canonicalize step 1 — **docs edited in-change**. Code repairs (build, gated on ratification): `renderer.ts:273` · `corpus/canonical.ts:104` · `corpus/admit.ts:286` · `tools/agent/system-prompt.ts:124–126` (GRAMMAR) · `renderer/renderer.test.ts:948–1030` (the regression pair's expectations flip) |
> | **Supersedes / Superseded by** | *(none)* — relates ADR-0002 (its clause-3 *validator pointer is syntax-only* ruling stands untouched) |

## Context

The upstream A2UI protocol defines `/` in `updateDataModel.path` as **root-equivalent** — whole-model
replacement — in **both** published versions. Host-verified by live fetch 2026-07-07, character-exact
against the raw pinned files:

> "The `updateDataModel` message replaces the value at the specified `path` with the new content. If `path` is omitted (or is `/`), the entire data model for the surface is replaced."
>
> "`path` (string, optional): A JSON Pointer to the location in the data model to update. Defaults to `/`."

Sources: `a2ui-project/a2ui` `specification/v1_0/docs/a2ui_protocol.md` §updateDataModel (lines 260–265)
and `specification/v0_9/docs/a2ui_protocol.md` (lines 859–864) — the identical ruling in both; the upstream
default for an *omitted* `path` is literally `/`.

Our renderer applies strict RFC-6901 semantics instead: the whole-model branch is
`path === undefined || path === ''` (`renderer.ts:273` `#onUpdateDataModel`), so `"/"` falls through to
`setPointer` (`binding.ts:67`), which — RFC-correctly — reads `/` as one token, the **empty-string key**,
and nests the entire payload under a spurious `{"": {...}}`. **We are the non-conformant party.** The live
impact is already measured: a real model emitted `path:"/"` (spec-conformant) and every binding on the
surface silently resolved `undefined` — silent because an unresolved path is a legal render-time
placeholder (SPEC-R4 AC2), not an error. Reproduced and pinned by two regression tests
(`renderer/renderer.test.ts:963–1030`) which currently assert the wrong, RFC-strict behavior and
mis-attribute the root cause ("NOT a renderer defect … a system-prompt/exemplar gap", lines 950–962); a
GRAMMAR line just added to `tools/agent/system-prompt.ts:124–126` ("never `path:"/"` … will silently nest
your data") fences the symptom at the prompt layer — true today, false after this fix, and no fence at all
for any conformant third-party producer.

The same `undefined || ''` check is mirrored at the corpus's two stream-fold apply-sites
(`corpus/canonical.ts:104`, `corpus/admit.ts:286` — both documented as mirrors of the renderer's
`#onUpdateDataModel`), so a `path:"/"` record would also canonicalize to the nested-under-`""` model.

**Classification (README three-way test):** a **new** ADR. No prior ADR ratified the strict reading — it
emerged from an RFC-6901-correct implementation of an under-specified `SPEC-R5` clause ("whole-model when
`path` omitted", silent on `"/"`); the owning doc is the runtime SPEC, repaired here. ADR-0002 clause 3
(the shared validator checks pointer *syntax* only) is unaffected: `"/"` is valid RFC-6901 syntax and
already passes `isValidPointer` (`validate.ts:236–240`) — no validator change, no parity break.

## Decision

We will treat `"/"` as the protocol's **root alias**: `updateDataModel` performs whole-model replacement
when `path` is omitted, `""`, or `"/"` — normalized at **every apply-site's existing whole-model branch**
(`renderer.ts` `#onUpdateDataModel:273` · `corpus/canonical.ts:104` · `corpus/admit.ts:286`), **not**
inside `setPointer`/`setAtPointer`, which stay RFC-6901-pure for every other pointer. The aliasing is a
protocol-layer message-semantics rule, not pointer arithmetic: under RFC-6901, `""` is the document root
and `/` is the empty-string-key token — the alias belongs to `updateDataModel`'s contract (where upstream
defines it), while the shared write primitive must keep resolving deeper empty keys (e.g. `"/a/"`)
correctly. Owning docs repaired: runtime `SPEC-R5` + AC2 now name the three equivalent spellings; renderer
LLD §5 records the alias + its layering; corpus-store LLD §canonicalize step 1 records the fold mirror.

**Scope: `updateDataModel` only.** The verified upstream quotes cover `updateDataModel.path` alone.
Component-binding `{path:"/"}` semantics are unverified upstream and unchanged here (`resolvePointer`
untouched) — booked as the open question below, not over-generalized.

## Consequences

- Conformance with both upstream versions: a producer emitting the spec's own documented default no longer
  silently breaks its surface. The reproduced "empty hand" class of failure is closed at the root.
- Renderer/corpus parity holds because all **three** apply-sites change together — a replayed record
  canonicalizes to the same data model the renderer renders.
- **Negative — a top-level key literally named `""` becomes unaddressable** via a single-token
  `updateDataModel{path:"/"}` write (deeper `""` keys remain addressable). Upstream made that trade; the
  2026-07-07 sweep confirms zero in-repo reliance (the only `path:"/"` references are the GRAMMAR "never"
  teaching and the two regression tests).
- **Negative — the regression pair flips.** `renderer.test.ts:963–1030` must invert expectations (the
  `path:"/"` leg now renders identically to the omitted-path control) and its root-cause narration
  (lines 950–962, "NOT a renderer defect") must be rewritten — the defect *was* the renderer's.
- **Negative — the GRAMMAR line must be revised, not deleted:** keep teaching omit-path as the idiom
  (fewest tokens, version-proof), but correct the claim — e.g. *"To replace the WHOLE data model, OMIT
  "path" (or use "path":"" or "path":"/" — the spec defines "/" as the root default)."* The current
  wording becomes a lie the drift-gated prompt would then teach.
- Until the build lands, the repaired `SPEC-R5` describes behavior the shipped renderer does not have; the
  flipped tests are the gate that closes that window.

## Alternatives considered

- **Alias inside `setPointer`/`setAtPointer`** — rejected: it would make a protocol message convention a
  property of pointer arithmetic. RFC-6901 defines `/` as the empty-key token; the primitive must stay
  correct for nested empty keys, and the corpus folds deliberately keep kernel-decoupled mirrors — the
  one-token condition at three whole-model branches is the minimal, correctly-layered change.
- **Keep RFC-strict and fence at the prompt** (the current GRAMMAR "never `path:"/"`" line) — rejected:
  our renderer is the non-conformant party; a prompt fence covers only our own producer, not any
  conformant model, server, or recorded transcript.
- **Reject `path:"/"` with a `POINTER` error (fail loudly)** — rejected: upstream defines it as legal and
  meaningful; erroring on the spec's documented default is still non-conformance, merely audible — and it
  would breach ADR-0002's syntax-only validator ruling (`"/"` *is* valid syntax).
- **Generalize the alias to component-binding `{path:"/"}`** — rejected for now: unverified upstream (the
  quotes cover `updateDataModel` only); over-generalizing past verified authority risks the opposite
  conformance defect. **Open question** for the host: does upstream define `/` root-aliasing for binding
  paths anywhere? Verify before extending.

## Acceptance

- `renderer.test.ts` regression pair flipped: the `path:"/"` leg renders both `/hand` items,
  byte-equivalent to the omitted-path control; the narration comment rewritten.
- New fold legs: `canonical.ts` and `admit.ts` treat `path:"/"` as whole-model (renderer/corpus parity on
  a `path:"/"` record).
- `system-prompt.ts` GRAMMAR revised per above; the grammar-slice drift tests stay green.
- `npm run check && npm test` green.
