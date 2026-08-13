# LLD — a2ui validator finalize signal: the abandoned-createSurface fork (GH #829)

> Status: proposed · v1 · 2026-08-13 · Layer: a2ui (`a2ui/src/renderer/validate.ts` + call sites) ·
> planner (design seat)
>
> Refines: [ADR-0187](../adr/0187-validator-finalize-signal.md) (proposed — **build BLOCKED on
> Kim's ratification**; this LLD exists so the builder starts the moment the flip lands, not
> sooner) · [`a2ui-runtime.spec.md`](../spec/a2ui-runtime.spec.md) SPEC-R11/N6 (the shared
> validator) · [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) SPEC-R4/R5 (self-correct
> + validate-then-stream). Composes on: [`a2ui-renderer.lld.md`](a2ui-renderer.lld.md) §8 LLD-C11 /
> §9 error table · TKT-0081's `SurfaceSeed` merge (`validate.ts:99-118`, `produce.ts
> sessionSurfaceSeeds`) · GH [#829](https://github.com/kimgranlund/agent-ui/issues/829)'s two dated
> Findings (2026-08-13 — the diagnosis this designs against, incl. the attempted-and-reverted
> naive fix and its 5 red suites).

## 1. Problem, one paragraph

`validateA2ui`'s `createSurface` case never registers the surfaceId into the `surfaces` map, so a
createSurface with zero `updateComponents` is invisible to the id-graph stage — it validates clean
end-to-end and the client mounts a permanently-empty `ui-surface-host` beside the working card
(GH #802's screenshots, root-caused in #829). The naive fix (register + drop `checkIdGraph`'s
`byId.size === 0` exemption) is **proven wrong**: a mid-stream prefix and an abandoned surface are
byte-identical wire shapes, and the ratified prefix laws (message-lifecycle SPEC-R4 AC1,
live-agent's round-trip prefix suite) require every prefix to validate 0-failure. The missing fact
is *whether more content is still coming* — a fact only the CALLER holds. This LLD threads it
through as an explicit opt-in finalize signal, defaulting to today's lenient behavior.

## 2. Components

| # | Component | File | Change |
|---|---|---|---|
| C1 | Validator core | `a2ui/src/renderer/validate.ts` | `atFinalize` option + createSurface registration + the finalize-mode empty-surface judgment |
| C2 | Server opt-in | `a2ui/src/agent/produce.ts` (per-round verdict, ~:995) | passes `{ atFinalize: true }`; hint prose extension |
| C3 | Client opt-in | `a2ui/src/renderer/renderer.ts#finalizeSurface` | passes `{ atFinalize: true }` |
| C4 | Admission opt-ins | `a2ui/src/corpus/admit.ts` stage 5 · `a2ui/tools/harness/validate-payload.ts` | pass `{ atFinalize: true }` (a record/pasted payload IS a complete set) |
| C5 | Holds (no change to verdicts) | `a2ui/tools/conformance/run.ts` (runner default) · `site/lib/artifact-feed.ts` · `site/pages/workbench-summary.ts` | stay default-lenient; see §4 rulings |
| C6 | Conformance extension | `a2ui/conformance/fixtures.jsonl` (+ `tools/conformance/{run,generate-suites}.ts`) | additive per-fixture `atFinalize?: boolean` + a negative/positive fixture pair |
| C7 | Client presentation | `app/src/controls/surface-host/surface-host.ts` (+ css) | terminal-empty state at finalize — presentation of the verdict, never a second judgment |
| C8 | Doc amendments | spec/LLD clauses named in ADR-0187 Consequences | REV blocks, post-ratification, with the build PR |

## 3. Interfaces (C1 — the whole contract change)

```ts
export interface ValidateA2uiOptions {
  /** TRUE = the caller asserts this payload is COMPLETE — nothing more is coming for it.
   *  Unlocks the finalize-only judgment: a surface created (or touched) with an EMPTY merged
   *  component set fails IDGRAPH `${sid}:root-missing`. Absent/false = byte-identical to today. */
  atFinalize?: boolean
}

export function validateA2ui(
  msgOrOutput: unknown,
  catalog: Catalog,
  sessionSeed?: ReadonlyMap<string, SurfaceSeed>,
  opts?: ValidateA2uiOptions,
): ValidationVerdict
```

An options bag, not a bare boolean 4th param — future finalize-adjacent knobs extend the bag, never
mint param #5. Threading: `run(input, catalog, sessionSeed, atFinalize)` →
`checkIdGraph(sid, g, failures, atFinalize && !deletedHere.has(sid))`.

**C1 mechanics, in stage order (all four moves required):**

1. **Registration (unconditional, behavior-neutral alone).** `validateMessage`'s `createSurface`
   case calls `surfaceOf(surfaces, body.surfaceId)` when `surfaceId` is a string (mirroring the
   reverted attempt's gate so a SCHEMA-invalid createSurface isn't double-flagged). With the
   `byId.size === 0` early returns intact in lenient mode, registration alone changes NO verdict —
   `checkIdGraph` and `checkContainment` still skip an empty graph. (This is the half the naive fix
   got right; dropping the exemption unconditionally is the half it got wrong.)
2. **Seed-merge composes unchanged (TKT-0081).** The seed loop already runs BEFORE the id-graph
   stage and already skips `createdHere` sids (GH #307 F2). Consequence — **no new carve-out is
   needed** (#829's open question 3): a session-known surface this payload touched gets its prior
   graph merged, so it cannot be judged empty; a `createdHere` surface is judged standalone, and a
   standalone-empty created surface at finalize is EXACTLY the defect. An untouched seeded surface
   never enters `surfaces` at all (nothing to judge — data-only rounds stay clean).
3. **The finalize arm.** `checkIdGraph` keeps `if (g.byId.size === 0) return` for lenient mode; in
   finalize mode an empty graph instead falls through to the existing `rootCount === 0` judgment —
   emitting the EXISTING `IDGRAPH` + `${sid}:root-missing` (no new code; §5). `checkContainment`'s
   empty-set guard stays unconditional (containment over nothing is vacuous either way).
4. **Same-payload delete exclusion (the one NEW edge).** A payload that createSurface's and then
   `deleteSurface`'s the same sid leaves nothing mounted — not abandoned. Build a `deletedHere`
   set beside `createdHere` (same construction, `deleteSurface.surfaceId`); the finalize emptiness
   judgment skips members. Lenient-mode verdicts are untouched (a dangling-ref set followed by
   delete still fails today's checks — only the finalize-only emptiness arm consults the set).

## 4. Call-site rulings (#829 open question 1 — every `validateA2ui` caller, with reasons)

| Caller | Ruling | Reason |
|---|---|---|
| `renderer.ts#finalizeSurface` | **OPT IN** | The client half of the bug. It already exists to judge the COMPLETE set at finalize (LLD-C11 §8); a createSurface-only surface re-frames as `updateComponents { components: [] }`, which now fails `sid:root-missing` → the existing IDGRAPH-only filter passes it → `VALIDATION_FAILED` on the wire. Zero filter change (§5). |
| `produce.ts` per-round verdict | **OPT IN** | The server half. A round's assembled output is that turn's final wire payload (validate-then-stream, live-agent SPEC-R5) — "the model stopped" IS the finalize signal. An abandoned createSurface becomes a pre-wire self-correct round (live-agent SPEC-R4), never reaching the browser. |
| `corpus/admit.ts` stage 5 | **OPT IN** (#829 open question 2: **yes**) | An admitted record IS a complete set — renderer LLD §8's parity prose already says the corpus judges complete `a2uiOutput`s; finalize granularity makes the claim true for the empty-surface case too. **Nothing reds:** the 29-record exemplar shard scanned clean (zero createSurface-only sids, 2026-08-13); the reverted attempt's `examples.test.ts` failure was the per-PREFIX test (which keeps calling default-lenient by definition), never admission. AC: a full re-admission sweep in the slice. |
| `tools/harness/validate-payload.ts` | **OPT IN** | It mirrors admission (imports via `corpus/validate.ts`, pre-checks payloads destined for admission) — diverging verdicts here re-opens the exact parity gap SPEC-N6 exists to close. A pasted payload is complete by construction. |
| `tools/conformance/run.ts` | **DEFAULT** (runner) + **per-fixture opt-in** (C6) | Two committed fixtures (`unsupported-version`, `bad-pointer-datamodel`) deliberately carry createSurface-only sids to isolate ONE failure each — a blanket flip destroys their isolation (the reverted attempt proved it). The fixture schema gains an additive `atFinalize?: boolean` the runner forwards; absent = today, byte-identical. New fixture pair rides C6. |
| `site/lib/artifact-feed.ts` | **DEFAULT** | It judges per-artifact envelope chunks of a recorded A2A feed; an artifact MAY be a partial delivery completed by a later artifact — a chunk boundary is not a finalize boundary. |
| `site/pages/workbench-summary.ts` (via its test gate) | **DEFAULT now, MAY opt in later** | Authored-complete demo sets would benefit, but the gate is not on the bug's path; flipping it is a one-line follow-up once C1 ships, not required scope. Named here so the hold is a decision, not an omission. |

## 5. Failure shape (#829 open question 4): REUSE `IDGRAPH` + `${sid}:root-missing`

**No new code.** SPEC-R6's `CONTAINMENT` precedent minted a code because parent-typing was a
genuinely NEW structural relation the id-graph never expressed. Here the defect IS the id-graph's
existing missing-root class — the novelty is *when* it is judged (finalize granularity), not *what*
is wrong (no `root` was ever delivered for the surface). Reuse buys, concretely:

- `renderer.ts#finalizeSurface`'s `failure.code !== 'IDGRAPH'` filter passes it unmodified.
- The §9 error-table mapping (`IDGRAPH` → `VALIDATION_FAILED` + surfaceId) and the wire union
  (`A2uiWireError`) are untouched — **zero wire widening**.
- `produce`'s self-correct feedback already teaches root-missing; C2 extends the hint PROSE
  (deliver `root` for the surface **or drop the unused `createSurface` line`) — additive text,
  no new hint key required by this design (builder's judgment whether a dedicated
  `IDGRAPH_HINTS` entry keyed off the empty-set case reads better; either satisfies the AC).
- Conformance needs only fixtures (C6), never a code-table/manifest extension.

`ABANDONED_SURFACE`/`EMPTY_SURFACE` is recorded as the rejected alternative in ADR-0187; if
telemetry ever needs the distinction, a code split stays additive later.

## 6. Client presentation (#829 open question 5): single-owner, one presentational brace

**The validator is the sole JUDGE** — `conversation.ts` must NOT re-implement emptiness judgment
(a second judge is the SPEC-N6 fork the one-implementation law forbids). But the SYMPTOM is
presentational, and the server opt-in (C2) only protects produce-driven streams — a recorded
transcript, the A2A bridge, or any third-party producer still reaches `conversation.ts` raw. So:

- **Rejected — defer mount until content:** kills the streaming placeholder affordance
  ("appears here" during a legitimate in-flight stream) and changes every legit stream's
  first-paint sequencing for a defect case.
- **Rejected — unmount the empty host at finalize:** a later turn legitimately targets a known
  surfaceId through `routeLine`'s known branch (SPEC-R7 — routes to the ORIGINAL host); unmounting
  breaks that route and hides the evidence.
- **Ruled — terminal-empty state on `ui-surface-host` (C7):** at `finalize()`, a host whose surface
  never attached a root flips a host-owned data-state (e.g. `data-empty-final`); CSS swaps the
  anticipatory `:empty` placeholder for a terminal message ("Nothing was rendered for this
  surface."). Driven by the host's OWN already-held facts (finalize happened + no root attached) —
  a state read, not a re-validation; the renderer's opted-in finalize (C3) emits the wire error
  through the same `onClientMessage` path as every IDGRAPH failure. The host stays mounted and
  addressable for follow-up turns; a later real update clears the state (the existing
  re-enable-on-ingest arm).

## 7. Data / fixtures touched by the build

- `a2ui/conformance/fixtures.jsonl`: +2 fixtures — `abandoned-surface-at-finalize`
  (createSurface, no updateComponents, `atFinalize: true` → expected
  `{ code: 'IDGRAPH', path: 's:root-missing' }`) and its lenient positive twin (same payload, no
  flag → clean). `generate-suites.ts` regen + `suites-driftwire` stay green.
- `a2ui/src/live-agent/a2ui-surface-toggle.test.ts`: the stub round that is literally
  `note + bare createSurface` is now (correctly) an invalid round under C2 — the stub gains a
  minimal `root` Text delivery. The test's SUBJECT (surface toggling) is unchanged.
- `app/src/controls/conversation/conversation.test.ts`: the composition-parity trace gains the
  finalize-emitted `'client'` entry under C3 — expectation extended (or the stub stream completed);
  the delta is the DESIGNED behavior, not collateral.
- Both prefix suites (`examples.test.ts` SPEC-R4 AC1, `round-trip.test.ts` prefix test) call
  default-lenient and MUST stay byte-identical green — they are the design's own regression proof.

## 8. Decomposition + slice plan (two-plane, coverage-checked inline)

Outside-in parts = C1–C8 (§2). Inside-out actions: register created sids (→C1) · judge
empty-at-finalize (→C1) · keep default verdicts byte-identical (→C1) · exclude same-payload
deletes (→C1) · compose with the TKT-0081 seed skip (→C1, ordering already right) · self-correct
pre-wire (→C2) · emit the client wire error (→C3) · reject at admission + harness parity (→C4) ·
preserve fixture isolation (→C5/C6) · prove the finalize arm in conformance (→C6) · no silent
empty host (→C7) · repair the two legitimately-changed stubs (→S2/S3 below) · amend owning
clauses (→C8). Every action lands in exactly one part; every part carries ≥1 action — covered.

| Slice | Contents | Depends | Gate |
|---|---|---|---|
| S1 | C1 + `validate.test.ts` probes (finalize positive/negative, delete exclusion, seed composition, createdHere re-create) | ratification | whole suite green UNFLAGGED = the byte-identical proof; the #829 repro fails `s2:root-missing` under `atFinalize` |
| S2 | C2 + the toggle-stub repair + hint prose | S1 | `produce` probes: abandoned round self-corrects; `a2ui-surface-toggle.test.ts` green |
| S3 | C3 + the parity-trace repair | S1 | `renderer.test.ts` finalize probe; `conversation.test.ts` green |
| S4 | C4 + full-corpus re-admission sweep | S1 | admission suite + the sweep (29/29 exemplar records still admit) |
| S5 | C6 fixture pair + schema field + suites regen | S1 | conformance CLI exit-code gate + `suites-driftwire` |
| S6 | C7 terminal-empty state | S3 | surface-host test: finalize on a rootless host flips the state; a later ingest clears it |
| S7 | C8 doc REVs (clauses per ADR-0187) | ratification | doc link sweep; `npm run check` |

One PR is fine (the slices are checkpoints, not shipping units); S1 must land before any opt-in.

**Acceptance (checkable, before build dispatch):** `npm run check` + `npm test` green by exit
code · the #829 headless repro returns `valid: false` with exactly `IDGRAPH s2:root-missing` under
`{ atFinalize: true }` at C2/C3/C4 and `valid: true` default · both prefix suites byte-identical ·
conformance runner green including the new pair · live shape: a stream ending in an abandoned
createSurface shows no silent `:empty` host (terminal state or no second host).

## 9. Risks

- **Live-model round inflation (C2).** Models that habitually open a second surface and abandon it
  now eat a self-correct round. Mitigation: the hint prose names the exact repair; the trace's
  fed-back codes make frequency observable (SPEC-N4). If measured hot, prompt-grammar teaching is
  the lever — never loosening the validator.
- **Latent recorded transcripts.** Any committed transcript/fixture with an abandoned createSurface
  reds at its first finalize-mode judgment. The corpus scanned clean (§4); the build's full-suite
  gate is the sweep for everything else — a red HERE is the bug surfacing, fix the fixture.
- **Non-decision noted (charter):** no SPEC doc is minted for this change — the finalize semantics
  amend existing clauses (ADR-0187 Consequences names them); acceptance criteria live here. A
  standalone SPEC nobody was unsure about would be manufactured process.
