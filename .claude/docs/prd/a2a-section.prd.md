# PRD — A2A (Agent2Agent) Section

> Status: **accepted · v0.2 · 2026-07-08 · Owner: agent-ui** — awaiting Kim's ratification of the five forks (§5). Authored by the system-planner seat; independent doc-review requested before ratification. (v0.2: §6 B0-gate wording re-synced to the fully verified HV-1…HV-12 ledger.)
> Altitude: this document owns **why + what-should-exist** for the A2A work area. Behavior contracts live in the SPEC ([`../spec/a2a-foundations.spec.md`](../spec/a2a-foundations.spec.md)); implementation in the LLDs (first: [`../lld/a2a-tic-tac-toe.lld.md`](../lld/a2a-tic-tac-toe.lld.md)). Lower documents reference these goal IDs; they never restate them.
> Location note: filed under `.claude/docs/prd/` per the ratified location charter (agent-app-surfaces PRD-D6); the legacy A2UI family stays under `.claude/docs/specs/`.
> Grounding: Kim's verbatim goal (2026-07-07): *"create a A2A section that is on par of excellence with A2UI work — I want demos where one agent can play another agent in tic tac toe, under purely separate contexts and no cross contamination — I want a well documented corpus of A2A concepts and demos."* · The one A2A seam already spec'd: [`../specs/specs/a2ui-streaming-pipeline.spec.md`](../specs/specs/a2ui-streaming-pipeline.spec.md) **SPEC-R5** (carry A2UI over A2A; capabilities in A2A `Message.metadata`) + [`../specs/llds/a2ui-streaming-pipeline.lld.md`](../specs/llds/a2ui-streaming-pipeline.lld.md) **LLD-C5** (`tools/pipeline/transports/a2a.ts`, dev/server-scoped, **unbuilt**) · Reuse substrate: the a2ui live-agent stack (provider seam, bounded produce loop, recorded-default + dev-proxy security posture — ADR-0069–0073) and the a2ui corpus discipline (facets · admission · pins · standing data gate).
> Intake decomposition: [`../decompositions/a2a-section.decomp.json`](../decompositions/a2a-section.decomp.json) — **coverage-clean (strict, plan mode)**, 2026-07-07.
> ⚠ **Host-verification rule (repo-absence ≠ spec-absence):** this repo cites almost nothing about the external A2A protocol. Every claim about upstream A2A in this family is tagged **HV-#** and enumerated in the SPEC's grounding ledger; the host fetches the authoritative sources (the A2A project spec) and resolves each row **before any build dispatch that depends on it**. No design seat here has fetch access; nothing below asserts an upstream fact as settled.

## 1. Problem

The repo has a complete, excellence-graded **A2UI** work area: an agent drives *UI* through a validated, streamed protocol, with a zero-dep runtime, a judged corpus, an expert harness, and live demos. It has **nothing** for the sibling protocol family: **A2A (Agent2Agent)** — the open protocol (Google-originated, now foundation-governed ⚠HV-1) by which one agent discovers, addresses, and exchanges tasks/messages with *another agent*.

The gap is threefold:

- **No protocol substrate.** The only A2A artifact in the repo is one unbuilt adapter stub in the A2UI family (pipeline SPEC-R5 / LLD-C5: "carry A2UI over A2A"). There are no A2A types, no task-lifecycle model, no agent card, no transport, no validator — the adapter has nothing to stand on, which is exactly why it has stayed unbuilt.
- **No proof artifact for the protocol's core promise.** A2A's whole point is that two agents interoperate **without sharing internals** — separate contexts, opaque peers, structured messages only. Nothing in the repo demonstrates that, let alone *proves* it. "Two agents talked" is easy to fake with one context wearing two hats; the valuable demo is one where cross-contamination is **mechanically impossible to hide on any recorded channel** — inspectable, gated, with a negative control per leak class (in-transcript and out-of-transcript; the LLD's recording-boundary invariant is what makes the second class recorded).
- **No teaching corpus.** The A2UI corpus taught the repo's agents to emit correct A2UI and measurably lifted reliability. A2A has the same failure modes (wrong lifecycle transitions, malformed parts, hand-rolled cards) and no documented, validated concept/demo corpus to learn from — for humans or agents.

**Who has the problem.** (1) *The repo itself* — pipeline SPEC-R5/LLD-C5 is a standing commitment with no substrate. (2) *Agent/app builders on this stack* who will need agent-to-agent interop the moment two agent-ui apps must cooperate. (3) *Authors* (human + agent) who need A2A idioms with the same guided-and-graded discipline the A2UI harness proved.

**Evidence it matters.** Kim's directive is explicit (verbatim above): an A2A section on par with the A2UI work, an agent-vs-agent tic-tac-toe demo under purely separate contexts, and a well-documented corpus of A2A concepts and demos. The A2UI precedent is the evidence for the method: the corpus + gates + demo ladder took generation from unconditioned to ≥ judged-4/5 artifacts with standing drift gates.

## 2. Goals & success metrics

Stable IDs; priority tiers (**must/should/could**); metrics baselined at **0 / not-possible-today** (nothing exists). Targets are stated against milestones **B0–B6** (§6). SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must | A first-party, typed, provably validated A2A protocol core — zero-dep |
| **PRD-G2** | must (flagship) | Agent-vs-agent tic-tac-toe with **provable** context isolation |
| **PRD-G3** | must | A documented, validated corpus of A2A concepts + demos |
| **PRD-G4** | must | A docs-site A2A section derived from validated artifacts, drift-gated |
| **PRD-G5** | should | The A2UI-over-A2A bridge — realize pipeline SPEC-R5/LLD-C5 on this substrate |
| **PRD-G6** | must (cross-cutting) | Host-verified grounding + version pinning — no unverified upstream claim reaches build |

**PRD-G1 — Protocol core.** `@agent-ui/a2a` (home per **PRD-D2**) ships the message/part/task/agent-card model, a total validator with coded failures, a deterministic task-lifecycle state machine, RPC framing, and an in-proc + HTTP transport pair — every external shape backed by a resolved HV row.
- *Metric*: (a) count of unresolved HV rows referenced by shipped code (must be 0); (b) validator totality (0 throws over a malformed-input corpus); (c) transition-table coverage of every legal/illegal lifecycle pair.
- *Baseline*: 0 — nothing exists. · *Target*: all three green in `npm run check && npm test`. · *Timeframe*: **B1**.

**PRD-G2 — Tic-tac-toe under provable isolation (flagship).** Two model agents play a complete game. Each seat is a fully separate context — own system prompt, own history, own provider call — communicating **only** via A2A messages with a deterministic referee that owns the board (the only shared truth, and it is not a model). Isolation is a **gate**, not a claim.
- *Metric*: (a) a complete match runs model-free in CI, deterministic and byte-stable; (b) the isolation gate (per-seat canary tokens absent from the other seat's full context + wire-origin audit) is green over the flagship recorded real-model match **and** red over a committed contaminated negative-control fixture; (c) both seats' full contexts are inspectable side-by-side in the demo.
- *Baseline*: not possible. · *Target*: all three. · *Timeframe*: harness by **B3**, demo page by **B5**.

**PRD-G3 — Concepts + demos corpus.** A curated, versioned corpus of A2A records — `concept` records (a protocol concept explained, with a validated wire example) and `demo` records (worked, replayable flows, the tic-tac-toe match among them) — admitted through deterministic gates, mirroring the a2ui corpus discipline (substrate per **PRD-D5**).
- *Metric*: (a) admitted record count; (b) share of records whose wire artifacts replay clean through the shared validator; (c) records silently stale after a protocol-version bump.
- *Baseline*: 0. · *Target*: ≥ 6 concept + ≥ 1 demo records, 100 % replay-clean, 100 % version-pinned, 0 silent staleness (standing gate). · *Timeframe*: **B4**.

**PRD-G4 — Docs-site section.** The site gains an A2A section: the tic-tac-toe demo page (static replay + side-by-side context inspector + dev-only live mode) and a concepts page **derived from the corpus** (the seed-shelf → gallery derivation precedent), both wired into nav with standing drift gates.
- *Metric*: (a) derivation drift gate (page concept set ≡ admitted shard set); (b) hand-authored concept prose duplicating a record (must be 0); (c) static build carries zero network/key path.
- *Baseline*: no section. · *Target*: two pages live, gates standing. · *Timeframe*: **B5**.

**PRD-G5 — A2UI-over-A2A bridge.** The unbuilt pipeline LLD-C5 adapter is realized on this substrate: an A2UI stream carried over A2A with `a2uiClientCapabilities` in `Message.metadata` (a2ui SPEC-R5 — that family keeps ownership of the adapter's contract; this section supplies the substrate and the working realization).
- *Metric*: a2ui pipeline SPEC-R5 AC1 + transport-invariance smoke.
- *Baseline*: LLD-C5 unbuilt. · *Target*: smoke green. · *Timeframe*: **B6** *(cross-family dependency: a2ui pipeline LLD-C1 codec + LLD-C3 transport abstraction are also unbuilt — named in §4 A-3)*.

**PRD-G6 — Grounding + coherence (cross-cutting).** Every upstream-protocol claim is host-verified before it is built against; every artifact pins a protocol version; the doc family stays trace-coherent.
- *Metric*: (a) unresolved HV rows at each build dispatch (0); (b) artifacts (types fixtures, records, transcripts) pinning a version (100 %); (c) `trace_check` orphans/gaps as LLDs land (0).
- *Baseline*: n/a. · *Target*: continuous from **B0**.

## 3. Scope

### In scope
- **`@agent-ui/a2a` protocol core** (per PRD-D2): typed message/part/task/card model, total validator, task-lifecycle state machine, RPC framing, in-proc loopback + dev HTTP transports, agent-card serving/discovery. *(PRD-G1)*
- **The tic-tac-toe arena** (harness-first): deterministic referee/board owner, player-seat seam (scripted + model players), match runner, schema'd transcript (wire + both full contexts), the isolation gate family with its negative control, the recorded flagship match. *(PRD-G2)*
- **The A2A corpus subsystem**: record model (concept/demo facets), admission gating, byte-stable storage with a standing data gate, seed records. *(PRD-G3)*
- **The docs-site A2A section**: demo page + corpus-derived concepts page + nav wiring. *(PRD-G4)*
- **The A2UI-over-A2A bridge realization** of a2ui pipeline SPEC-R5/LLD-C5. *(PRD-G5)*
- **The host-verification ledger** and its resolution workflow. *(PRD-G6)*

### Out of scope (with rationale)
- **Authoring or forking the A2A standard.** We conform to the upstream spec at the pinned version (⚠HV-1); owning the protocol is not our job — the a2ui C1 precedent.
- **A production A2A server SDK.** Transports beyond the demos' needs — authentication schemes, push notifications, resubscription, deployment hardening — are staged behind HV resolution and a real consumer; the HTTP transport here is dev/server-scoped like every a2ui tool. *(Unbounded surface; no evidenced consumer today.)*
- **Building a general agent framework/runtime.** Inherited verbatim from the a2ui PRD's out-of-scope list — we interoperate; we do not build ADK/LangGraph/CrewAI competitors.
- **Owning the a2ui streaming-pipeline contracts.** Pipeline SPEC-R5/LLD-C5 stay owned by that family; this section realizes them and references by ID — one fact, one home.
- **A second game or a general game framework.** The arena's seams (referee/seat/transcript) are deliberately game-agnostic in shape, but only tic-tac-toe ships; more games are corpus demo material later, not scope now.
- **Model fine-tuning / training ops.** Same boundary as the a2ui corpus: we own format + consumption hooks only.

## 4. Constraints & assumptions

**Constraints** (as of 2026-07-07):
- **C1 — Conform to upstream A2A at a pinned version.** The pin is resolved at **B0** by the host-verification ledger (PRD-D3); every artifact carries it; nothing normative is built from an unresolved HV row.
- **C2 — Zero runtime dependencies.** `@agent-ui/a2a`'s `src/` imports nothing third-party (strict decorator-free TS per `CLAUDE.md`); transports/servers/proxies are `tools/`-scoped (Node, dev/server) and never enter a consumer bundle — the a2ui src/tools split, repeated.
- **C3 — Isolation is a gate, not a claim.** The no-cross-contamination property is enforced by deterministic checks (canary absence + wire-origin audit) with a committed negative control proving the gate bites. A demo that merely *asserts* isolation fails this PRD.
- **C4 — Recorded-default demo posture.** The static build ships a recorded, replayable match — zero network, zero keys; live model-vs-model runs are dev-only behind a server-side-key proxy (the a2ui ADR-0073 trust-boundary posture, reused).
- **C5 — Governance via the existing harness.** Docs via the prd/spec/lld family + decomposition gates; deterministic checks over judgment; generator ≠ critic (independent doc-review before ratification; independent build review before each wave commit).

**Assumptions**:
- **A-1** — Upstream A2A is stable enough at its current release to pin and build against; churn is absorbed by the pin + the corpus staleness gate. *⚠HV-1 verifies this at B0.*
- **A-2** — The a2ui live-agent provider seam (providers.json registry + adapters + dev-proxy pattern) is reusable at dev scope for the arena's model players without violating package layering. *The LLD names the import direction and the extraction trigger; flagged for review.*
- **A-3** — The bridge (PRD-G5) additionally depends on a2ui pipeline LLD-C1 (codec) + LLD-C3 (transport abstraction), both unbuilt and owned by that family. B6 is blocked until they land or are explicitly co-scheduled. *Cross-family dependency, named.*

## 5. Open decisions (the forks — each with a firm recommendation, awaiting Kim)

| ID | Fork | Recommendation | Why |
|---|---|---|---|
| **PRD-D1** | Sibling PRD vs extending the A2UI PRD | **Sibling (this document)** | Different problem space (agent↔agent vs agent→UI); the a2ui PRD explicitly out-scopes agent frameworks; the only shared seam (pipeline SPEC-R5) stays a2ui-owned and is *referenced*, not absorbed; "on par with A2UI" names a peer-scale effort, not a G8th goal. |
| **PRD-D2** | Package home: new `packages/agent-ui/a2a` (`@agent-ui/a2a`) vs `a2ui/src/a2a/` | **New sibling package** | The A2A core must not depend on `@agent-ui/components` — an agent-interop core with a UI dependency inverts the layering law; a2ui's own PRD scope excludes agent runtimes; the proven src(zero-dep)/tools(dev) split carries over cleanly. Cross-package edge added: a2ui `tools/pipeline/transports/a2a.ts` (dev-scoped) → `@agent-ui/a2a` at B6. |
| **PRD-D3** | Protocol version pin | **Pin `protocolVersion: "0.3.0"`** — ratified *knowingly one major behind*: B0 (HV-1) resolved upstream stable as **v1.0.1** (2026-05-28), with `v0.3.0` (2025-07-30) the prior lineage. The **1.x migration is a named future fork**, deliberately NOT part of this ratification — trigger: a real 1.x-interop consumer or upstream 0.3 end-of-life; it lands via its own ADR + a fresh HV pass over the version-sensitive rows (HV-3/HV-9 name the deltas). | Pinning head buys churn, not capability: v1.0 renamed every JSON-RPC method to PascalCase and restructured the error set (HV-3/HV-9 version notes), invalidating the SPEC's verified shapes for zero demo gain; `"0.3.0"` is the protocol's own assumed default ("Agents MUST interpret empty value as 0.3 version" — HV-1 resolution), and every SPEC §6 sketch matches it as-verified. Same pin + staleness-gate shape as a2ui C1: pin beats chasing head. |
| **PRD-D4** | Match topology: referee-mediated star vs peer-to-peer with a validating observer | **Referee-mediated star** — both agents talk only to the deterministic referee; the board is the only shared truth and is not a model | Legality/turn-order/game-end must be deterministic; the isolation proof becomes tractable (every line inbound to a seat has referee origin and a closed schema); peer-to-peer is a fine *later corpus demo*, not the centerpiece. This also matches the dispatch's architectural constraint verbatim. |
| **PRD-D5** | Corpus substrate: mirror the a2ui corpus **discipline** with an A2A-native schema/store vs generalize the shipped a2ui store into shared infra | **Mirror, don't generalize** | The a2ui store is deeply a2ui-shaped (its healer repairs A2UI forms; its canonicalizer folds surfaces; the single-surface rule). Generalizing a shipped store carrying a judged shard + standing gates is real blast radius for zero current gain. Extraction trigger: both stores stable **and** a third consumer appears. |

## 6. Milestones (the build-wave plan; each gates the next)

Sequencing rationale only — the SPEC owns behavior, the LLDs own build order within a wave. Review gates: independent doc-review before ratification (now); an independent build review before each wave's commit (the a2ui component-reviewer precedent).

- **B0 — Protocol grounding (host seat).** The host fetches the authoritative A2A sources and resolves every HV row in the SPEC ledger (verbatim citations); PRD-D3's pin lands. *Gate: zero unresolved HV rows referenced by B1 — **met** (resolved 2026-07-07/08): the ledger stands fully verified HV-1…HV-12, including the late-intake residuals HV-11/HV-12 that the protocol-core decomposition surfaced after the initial B0 pass — held to the same gate and resolved before any B1 slice dispatched.* **Nothing else starts.**
- **B1 — Protocol core.** Types → validator → task machine → RPC framing → loopback transport → agent card (+ HTTP transport + well-known serving, dev-scoped). *Gate: `check`+`test` green; totality + transition-table + transport-invariance tests.* *(PRD-G1)*
- **B2 — Arena, model-free.** Board/rules → referee → seat seam + scripted players → runner → transcript schema → isolation gate **with its negative control**. *Gate: scripted match byte-stable in CI; contaminated fixture fails the gate.* *(PRD-G2 harness)*
- **B3 — Live players.** Model player (bounded move loop over the provider seam) → arena dev proxy → the flagship recorded real-model match committed. *Gate: isolation gate green over the real fixture; `vite build` greps clean of key/proxy paths.* *(PRD-G2)*
- **B4 — Corpus.** Record model + admission → store + standing data gate → seed records (≥ 6 concepts + the match demo). *Gate: admission matrix green; standing gate over the committed shard.* *(PRD-G3)*
- **B5 — Site section.** `a2a-tic-tac-toe` page (replay + inspector + dev live) → `a2a-concepts` page (corpus-derived) → nav/TOC wiring. *Gate: derivation drift gate; static-build zero-network proof; browser legs green.* *(PRD-G4)*
- **B6 — Bridge.** A2UI-over-A2A realization of pipeline LLD-C5 (blocked on a2ui LLD-C1/C3 per A-3). *Gate: a2ui SPEC-R5 AC1 smoke.* *(PRD-G5)*

## 7. Downstream documents

- [`../spec/a2a-foundations.spec.md`](../spec/a2a-foundations.spec.md) — the first SPEC: grounding ledger, protocol core model, arena/demo requirements, corpus requirements, bridge relationship. *(drafted with this PRD)*
- [`../lld/a2a-tic-tac-toe.lld.md`](../lld/a2a-tic-tac-toe.lld.md) — the centerpiece LLD: arena modules, the isolation mechanism, error/edge enumeration, build sequence. *(drafted with this PRD)*
- [`../lld/a2a-protocol-core.lld.md`](../lld/a2a-protocol-core.lld.md) — the B1 protocol-core LLD: `@agent-ui/a2a` package layout, typed wire model, total validator, lifecycle table, RPC framing, loopback/HTTP transports, build slices. *(landed 2026-07-07; its S2/S5 slices gate on the SPEC §2 HV-11/HV-12 residuals)*
- [`../lld/a2a-corpus-docs.lld.md`](../lld/a2a-corpus-docs.lld.md) — the B4+B5 LLD: the concepts/demos corpus (record model, admission, byte-stable shards, seed set) + the corpus-derived docs-site section. *(landed 2026-07-08; ONE document for both waves — its scoping ruling records why the R15 page is designed with the R14 shard it derives from)*
- Later waves (not yet specced, per milestone): the bridge realization note on a2ui LLD-C5 (B6).
