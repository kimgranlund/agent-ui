# SPEC — A2UI Ecosystem Alignment (2026-08-05 survey intake)

> Status: accepted · v0.2 · 2026-08-06 (v0.1 accepted 2026-08-05) · Layer: SPEC (execution contract)
> **v0.2 amendment (2026-08-06, SPEC-R3 only — GH #474):** SPEC-R3's rubric + fixture halves are
> REALIZED and its eval lane is SHAPED as a named manual run — the payload rubric carries the dimension
> as [`../rubrics/a2ui-payload.md`](../rubrics/a2ui-payload.md) **P8** (`[review], definitional`; rubric
> `version: 1.1`), the AC1 red-team seeds are committed under
> `.claude/docs/rubrics/fixtures/a2ui-deceptive-composition/`, and the lane's operator procedure +
> VerdictsFile contract are appended to the clause itself. Scoped to SPEC-R3 only: its route line is
> extended in place (P8 + the manifest link) and one v0.2 bullet is appended; no other clause touched.
> **Amendment (2026-08-07, SPEC-R4 only — GH #532, owner ruling:
> [#532 comment](https://github.com/kimgranlund/agent-ui/issues/532#issuecomment-5219435344)):**
> SPEC-R4's "applied on emit" phrasing overclaimed what shipped. The clause is edited in place to
> scope the guarantee honestly as TOOLKIT-LEVEL — `Session.surfacePrefix` +
> `ownsSurfaceId`/`prefixSurfaceId`/`enforceSurfacePrefix` exist and are tested (26 tests, PR #519) —
> with live-pipeline integration into `produce()` explicitly DEFERRED until a real multi-producer
> surface needs it; the [ADR-0097](../adr/0097-a2ui-feed-embedded-asks.md) feed-ask
> `ask.surfaceId` remap is the named precondition for that future wiring. Scoped to SPEC-R4 only:
> its requirement sentence and AC1 are edited in place; no other clause touched.
> Refines: [`../prd/a2ui-expert-system.prd.md`](../prd/a2ui-expert-system.prd.md) — primarily
> **PRD-G6** (coherence over time: divergence surfaces mechanically, not as silent rot — here
> extended to divergence from the UPSTREAM ecosystem, not just internal drift) and **PRD-G7**
> (transport interop).
> Relates: [`./a2ui-streaming-pipeline.spec.md`](./a2ui-streaming-pipeline.spec.md) (the parked
> producer/transport/MCP contract — SPEC-R1 below raises the priority of ITS AG-UI leg and answers
> its §6 transport-ordering open item; nothing is duplicated from it) ·
> [`./a2ui-runtime.spec.md`](./a2ui-runtime.spec.md) (the fault-isolation home SPEC-R2 extends) ·
> [`./a2ui-expert-harness.spec.md`](./a2ui-expert-harness.spec.md) (the rubric/gate home SPEC-R3
> routes to) · [`./a2a-foundations.spec.md`](./a2a-foundations.spec.md) (the A2A pin SPEC-R6 audits).
> Altitude: owns the alignment REQUIREMENTS derived from one dated ecosystem survey. §2 is the
> evidence base — a frozen snapshot with per-claim confidence marks; §3 mints only FUTURE work.
> **Nothing in this document is built.** Requirement IDs file-scoped (`SPEC-R#` / `SPEC-N#`).

---

## 1 · Purpose

Align `@agent-ui/a2ui` (and its A2A sibling) with the verified 2026 state of the A2UI ecosystem —
governance move, v1.0-RC protocol changes, the cross-vendor transport convergence, and the gaps
upstream itself has not closed — so the alignment work becomes routed, checkable requirements
instead of dying as chat-session findings. Each SPEC-R names the statement, a checkable acceptance,
and the route: which existing spec, surface, or harness record the work lands on.

**The conceptual split (owner's framing, 2026-08-05)** — the definition pair SPEC-R1 and SPEC-R8
are argued from:

- **AG-UI** (Agent–User Interaction) is **HOW** the backend agent and the frontend application
  talk — a real-time runtime communication protocol (CopilotKit-backed) managing the event
  stream, session history, and state synchronization.
- **A2UI** (Agent-to-User Interface) is **WHAT** visual elements render — an open, declarative
  specification (Google-originated) letting a model output flat JSON blueprints for rich UI
  components (map, chart, form) instead of raw code or plain text.

The two are complementary layers, not competitors — and `@agent-ui/a2ui`'s transport seam (the
streaming SPEC's pluggable-adapter contract) is exactly where the HOW layer plugs in.

## 2 · The survey (2026-08-05)

Source: a live two-scout web survey, 2026-08-05, adjudicated by the coordinating session.
Confidence marks are load-bearing: **[verified]** = checked against the primary source (the spec
repo, the spec source file, the official announcement); **[unverified]** = secondary reporting,
stated only with the flag. This section is a dated snapshot — a later survey supersedes it by a
new dated record, never by silently rewriting these claims (SPEC-N2).

### 2.1 · Verified against primary sources

- **Governance** [verified]: the canonical A2UI repo moved to `github.com/a2ui-project/a2ui`
  (the old `google/A2UI` 301-redirects there); governance is vendor-neutral. ~16k stars at survey
  date.
- **Version state** [verified]: **v1.0 is a Release Candidate** ("previously v0.10 in draft");
  **v0.9.1 is the marked production recommendation** — matching this repo's pinned set exactly
  (`SUPPORTED_VERSIONS = {'v1.0','v0.9.1'}`, `packages/agent-ui/a2ui/src/protocol.ts:160`).
- **v1.0 removes styling from the protocol** [verified against the spec source,
  `specification/v1_0/docs/a2ui_protocol.md`]: "Decoupled Branding: removes rigid theme
  properties… defer visual styling entirely to the target framework's native theme." No `theme`
  field, and **no `surfaceProperties` field exists** in v1.0. The `a2ui-protocol-facts` pack's
  claim of a theme→`surfaceProperties` RENAME is therefore **stale** (SPEC-R7), and this repo's
  own wire types carry the drift too (§2.2).
- **v1.0 spec-source facts not previously captured in this repo's docs** [verified, same source]:
  - `createSurface` MAY be skipped for a preexisting permitted surface;
  - `surfaceId` + `catalogId` are fixed at creation — reconfiguring means delete-and-recreate;
  - `createSurface` implicitly instantiates a canonical Surface container
    (`common_types.json#/$defs/Surface`, `child: "root"`, unmodifiable);
  - the spec explicitly advises ORCHESTRATORS to prefix subagent surface IDs to prevent
    conflicts (the seed of SPEC-R4).
- **Google ADK ships the harness shape this repo pioneered** [verified]: `A2uiSchemaManager`
  (catalog config + cross-version selection), `generate_system_prompt()` (catalog-derived prompt —
  the same construction as this repo's `buildSystemPrompt`,
  [ADR-0137](../adr/0137-a2ui-agent-producer-toolkit-export.md)), `parse_response()`
  (validate-before-stream). Python-only. Payloads ride A2A `DataPart` with MIME
  `application/json+a2ui` — note the ordering differs from the parked streaming SPEC's
  `application/a2ui+json`; SPEC-R6(d) audits which is canonical before that spec's R7 builds.
- **No conformance suite exists upstream** [verified: open upstream issue #2150], and the
  reference web renderer has a hard Zod dependency [verified: upstream issue #2160]. This repo's
  zero-dep validator + gate posture is AHEAD of upstream on both counts — a contribution and
  differentiation lane (SPEC-R5).
- **MCP Apps is an official MCP extension** [verified]: adopted 2026-01-26 (spec version
  `2026-01-26`); `ui://` resource scheme, sandboxed-iframe delivery, JSON-RPC bridge; shipping
  clients include Claude, ChatGPT, VS Code, Goose, Postman. Posture ruled in SPEC-R8.
- **The 2026 cross-vendor convergence** [verified]: the Oracle + Google + CopilotKit "Agent Spec"
  three-layer stack — an agent-definition layer / **AG-UI as transport + state sync**
  (`STATE_SNAPSHOT` + `STATE_DELTA` JSON-Patch events, human-in-the-loop interrupt events) /
  **A2UI JSONL as the UI payload**. AG-UI repo: `github.com/ag-ui-protocol/ag-ui`, ~15.1k stars;
  first-party integrations include LangGraph, CrewAI, Microsoft Agent Framework, Google ADK,
  Pydantic AI. A2UI-as-payload-inside-AG-UI is the shipped pattern — this is what raises SPEC-R1's
  priority.

### 2.2 · Repo-local drift found while verifying

- `packages/agent-ui/a2ui/src/protocol.ts:120` and `renderer/surface.ts` carry
  `surfaceProperties?: object` on the `createSurface` shape — a field the v1.0 spec source does
  not define. Tolerated extension or removal is SPEC-R6(b)'s ruling to make, on record — not a
  silent fix.
- The `a2ui-protocol-facts` pack (agent-protocols plugin, user scope — not a repo file) carries
  the stale rename claim and the old `google/A2UI` repo URL (SPEC-R7).

### 2.3 · Secondary / unverified — stated only with the flag

- **A2A protocol v1.0, April 2026, "150+ orgs"** [unverified]: this repo's `@agent-ui/a2a` pins
  v0.3.0 (`PROTOCOL_VERSION`, asserted in `packages/agent-ui/a2a/src/index.test.ts:10`). The gap
  is real regardless of the claim's precision; SPEC-R6(c) verifies at the A2A spec source first,
  then audits.
- **Thesys C1 architecture** [unverified]: no primary source reached; recorded only as a name to
  check on a later survey.
- **Practitioner footguns** [one Medium piece — external corroboration only]:
  structure-vs-state message separation, explicit surface addressing, full-blob-resend flicker.
  All three are already this repo's law (the message lifecycle, the
  [renderer structural-resend SPEC](./renderer-structural-resend.spec.md), per-path binding
  wake-ups) — cited as corroboration that the law is load-bearing, not as new findings.

## 3 · Requirements (SPEC-R) — all FUTURE work

**SPEC-R1 — AG-UI transport binding, priority raised** *(→ PRD-G7 · route: amends
[`./a2ui-streaming-pipeline.spec.md`](./a2ui-streaming-pipeline.spec.md))*. Premise: the §1
conceptual split — AG-UI owns HOW agent and application talk, A2UI owns WHAT renders;
complementary layers, not competitors, so binding one to the other is composition, not
allegiance-switching. The parked streaming SPEC's AG-UI adapter (its SPEC-R4) SHOULD be the
first transport built after the stdio default — its §6 "transport priority beyond stdio" open
item is hereby answered by the ecosystem: AG-UI is the convergence stack's HOW layer, and
A2UI-as-payload-inside-AG-UI is the shipped pattern (§2.1). The binding MUST rule, on record, how AG-UI's state-sync events (`STATE_SNAPSHOT`,
`STATE_DELTA` JSON-Patch) relate to A2UI's own `updateDataModel` — mapped, or explicitly declined
with the reason.
- **AC1** *Given* the AG-UI adapter, *when* a stream is produced, *then* the streaming SPEC's own
  R4-AC1 conformance smoke passes (each A2UI message arrives as an ordered AG-UI event a renderer
  reconstructs), and the state-sync ruling is written into that spec's next revision.

**SPEC-R2 — Render-depth guard** *(→ PRD-G1, PRD-G4 · route: extends
[`./a2ui-runtime.spec.md`](./a2ui-runtime.spec.md)'s SPEC-N4 fault-isolation family;
`packages/agent-ui/a2ui/src/renderer/renderer.ts`)*. The renderer MUST enforce a maximum
component-tree depth; a payload exceeding it MUST produce an internal diagnostic (the runtime
SPEC's error-envelope discipline) and leave the surface's already-rendered content standing —
never a stack overflow or teardown. The cap and its value are documented on the runtime SPEC.
- **AC1** *Given* a payload nesting components beyond the cap, *when* rendered, *then* an error
  is emitted, the surface survives, and the stream continues — proven by a probe committed with
  the build.

**SPEC-R3 — Deceptive-composition defense** *(→ PRD-G4, PRD-G3 · route:
[`./a2ui-expert-harness.spec.md`](./a2ui-expert-harness.spec.md) +
[`../rubrics/a2ui-payload.md`](../rubrics/a2ui-payload.md) **P8** + the committed seeds
[`../rubrics/fixtures/a2ui-deceptive-composition/manifest.json`](../rubrics/fixtures/a2ui-deceptive-composition/manifest.json)
+ corpus admission)*.
Catalog governance bounds WHAT can render, not what a composition MEANS: a fully catalog-legal
payload can still compose a phishing-shaped form (credential/payment-shaped data entry outside the
surface's declared intent) from legitimate widgets. Upstream ships no mitigation (§2.1). The
harness MUST gain an eval-gate/lint lane that flags data-entry surfaces exceeding their declared
scope, and the payload rubric MUST carry the dimension.
- **AC1** *Given* a planted red-team payload (catalog-valid, credential-collection form, intent
  declaring a read-only summary), *when* the lane runs, *then* it flags; *given* a benign
  data-entry payload whose intent declares the entry, *then* it passes. The red-team seeds are
  committed fixtures.
- **v0.2 (2026-08-06, GH #474) — the realized route + the lane's shape.** The rubric dimension is
  [`../rubrics/a2ui-payload.md`](../rubrics/a2ui-payload.md) **P8 — deceptive composition /
  declared-scope fidelity** (`[review], definitional` — no realized script can decide what a
  composition MEANS, so `[gate]` would be a mistag under the harness spec's `[gate]` law, but its
  verdict hard-blocks promotion exactly as a gate would; the GH #493 tier). The AC1 seeds are
  committed at `.claude/docs/rubrics/fixtures/a2ui-deceptive-composition/` — two red-team payloads
  (credential-collection under a read-only-summary intent; payment-recapture under a read-only
  order-status intent) and one benign contrast (newsletter signup whose intent declares the entry),
  each a catalog-valid A2UI message array proven exit 0 / `repairs: []` through the harness
  `validate-payload` CLI (deception is invisible to every mechanical gate — that is the premise);
  ground truth (`declaredIntent` + `expectedVerdict` + rationale) lives in the corpus's
  [`manifest.json`](../rubrics/fixtures/a2ui-deceptive-composition/manifest.json), one fact one home.
  **The eval lane is a NAMED MANUAL run — "the deceptive-composition eval" — and is NEVER wired into
  `npm test`/`npm run test:browser`** (the [`./genui-surface.spec.md`](./genui-surface.spec.md)
  SPEC-N3 law for judged evals; the `scripts/harness_wiring_check.py` manual-gate precedent, ADR-0040
  §3). Operator procedure: for EACH manifest fixture, dispatch the `a2ui-reviewer` critic in a FRESH
  context — one fixture per context, no cross-fixture contamination; generator ≠ critic per the
  harness spec's SPEC-R8 — with exactly two inputs, the fixture's payload file and its
  `declaredIntent`, withholding `expectedVerdict`/`rationale` (ground truth never reaches the judge).
  The critic scores **P8** and the run emits one
  [ADR-0068](../adr/0068-corpus-quality-judge-verdict-adapter.md)-shaped VerdictsFile:
  `{ rubric: "a2ui-payload", rubricVersion, judgedBy, date, verdicts: Record<fixtureName,
  { qualityScore, passed, failingDimensions }> }`, where `rubricVersion` MUST equal the payload
  rubric's `version:` marker (1.1 at this writing), `qualityScore` is the P8 score for this lane, and
  `passed = (P8 ≥ 4)` — a deliberate, stated adaptation of ADR-0068's MIN-across-gated-dimensions
  aggregation: the SHAPE is mirrored for auditability, but this lane's VerdictsFile is
  **operator-compared only** and is never fed to `createVerdictJudge`/`admit()`/`rescore` (those expect
  `a2ui-corpus` semantics — no interop exists or is implied). AC1 then checks mechanically: `FLAGGED` ⇔ `passed: false` with `"P8"` in
  `failingDimensions`; `PASSES` ⇔ `passed: true`; the lane is green iff every fixture's verdict
  matches its manifest `expectedVerdict`. A mismatch is a CALIBRATION finding — repair P8's anchors
  (the owning doc), never the committed ground truth (the harness LLD's calibration discipline).

**SPEC-R4 — Orchestrator surface-ID prefixing** *(→ PRD-G1, PRD-G7 · route: the
[ADR-0137](../adr/0137-a2ui-agent-producer-toolkit-export.md) agent toolkit,
`packages/agent-ui/a2ui/src/agent/`)*. The v1.0 spec source itself advises orchestrators to
prefix subagent surface IDs to prevent conflicts (§2.1). The producer toolkit's `Session` seam
MUST offer the convention first-class: a per-producer surface-ID prefix as a TOOLKIT-LEVEL
guarantee (`Session.surfacePrefix` + the `ownsSurfaceId`/`prefixSurfaceId`/`enforceSurfacePrefix`
primitives), so two subagent producers under one orchestrator cannot collide on or address each
other's surfaces. Wiring `enforceSurfacePrefix` into `produce()`'s default emit path is EXPLICITLY
DEFERRED until a real multi-producer surface needs it — the named precondition for that future
wiring is remapping the [ADR-0097](../adr/0097-a2ui-feed-embedded-asks.md) feed-ask
`ask.surfaceId` alongside the payload's surface IDs (an unremapped ask would silently break the
feed-ask integrity check, `produce.ts:669-673` — GH #532, amendment 2026-08-07).
- **AC1** *Given* two sessions with distinct prefixes, *when* both apply the toolkit's prefix
  primitives (`Session.surfacePrefix` + `ownsSurfaceId`/`prefixSurfaceId`/`enforceSurfacePrefix`,
  shipped PR #519 with 26 tests), *then* their surface IDs are disjoint by construction and a
  cross-prefix update is rejected — proven by tests in the toolkit's own gates. `produce()`'s
  live emit path does NOT yet apply the prefix; that integration is deferred per the clause
  above, gated on the ADR-0097 `ask.surfaceId` remap.

**SPEC-R5 — Conformance-suite lane** *(→ PRD-G4, PRD-G6 · route: the shared validator +
its fixture corpus; upstream issue #2150)*. No conformance suite exists upstream (§2.1). This
repo's validator fixtures SHOULD be packaged as an implementation-agnostic spec-conformance
suite: payload-in / verdict-out fixture files (JSONL + expected verdicts) runnable against ANY
A2UI validator, this repo's included — a contribution lane upstream and a differentiation claim
either way.
- **AC1** *Given* the packaged suite, *when* run against this repo's validator, *then* it passes
  by exit code with no repo-internal imports in the fixture format; the suite's README states the
  upstream-contribution intent and cites #2150.

**SPEC-R6 — Version-pin + drift audit** *(→ PRD-G6 · route: `protocol.ts` /
[`./a2ui-runtime.spec.md`](./a2ui-runtime.spec.md) SPEC-R13 /
[`./a2a-foundations.spec.md`](./a2a-foundations.spec.md))*. One dated audit MUST rule each arm,
findings on record:
- **(a) v1.0-RC tracking**: `SUPPORTED_VERSIONS` (`protocol.ts:160`) re-audited against v1.0
  FINAL when it lands (the RC matches today, §2.1);
- **(b) `surfaceProperties` drift**: the §2.2 field — keep as a tolerated inbound extension or
  remove, ruled explicitly, never silently patched;
- **(c) A2A gap**: verify the A2A v1.0 claim at the A2A spec source (it is [unverified], §2.3),
  then rule `@agent-ui/a2a`'s v0.3.0 pin — upgrade, dual-pin, or hold with the reason;
- **(d) MIME canonicalization**: `application/a2ui+json` (the parked streaming SPEC-R7) vs
  `application/json+a2ui` (ADK's shipped A2A extension, §2.1) — resolve at the spec source before
  the streaming SPEC's R7 builds.
- **AC1** *Given* the audit, *when* complete, *then* each arm has a dated ruling (Issue Findings
  comment or spec revision) and any resulting code change traces to it.

**SPEC-R7 — Pack re-sync** *(→ PRD-G6 · route: `/make-pack` re-sync of the
`a2ui-protocol-facts` pack — a user-scope harness action, not a repo build)*. The pack MUST drop
the stale theme→`surfaceProperties` rename claim, state v1.0's actual ruling (styling removed
from the protocol entirely, §2.1), and re-point the canonical repo URL to
`github.com/a2ui-project/a2ui`.
- **AC1** *Given* the re-synced pack, *then* no reference to a `surfaceProperties` rename
  remains, the styling-removal fact is stated with its spec-source citation, and every repo URL
  resolves to the new org.

**SPEC-R8 — MCP Apps posture: considered non-goal as a delivery vehicle** *(→ PRD-G7 · route:
this SPEC is the record; the MCP lane remains the streaming SPEC's serving surface)*. MCP Apps
(§2.1) delivers UI as sandboxed iframes over a JSON-RPC bridge — it conflates the §1 split's two
layers (the HOW transport and the WHAT payload) into one opaque iframe, where this system keeps
them separate by construction. That makes it architecturally disjoint from the premise here:
catalog-governed payloads rendered as native fleet DOM, provably valid before ship (PRD-G4),
zero-dep by law. Shipping surfaces through an iframe bridge would bypass
the catalog, the validator, and the fleet's token layer at once. **Ruled: non-goal as a
rendering/delivery vehicle.** The MCP interop this system DOES owe stays exactly what the
streaming SPEC's R6 already fixes — an MCP serving surface (serve-catalog / validate / retrieve
corpus) for a generating agent. Watch item: MCP Apps is official with major clients; if a
catalog-governed A2UI-inside-MCP-Apps bridge pattern emerges upstream, re-entry is by a new
record, never by drift.
- **AC1** No MCP-Apps delivery code lands in any `@agent-ui/*` package without a record
  superseding this ruling; the streaming SPEC's MCP surface is untouched by this non-goal.

## 4 · Constraints and non-requirements (SPEC-N)

- **SPEC-N1 — This SPEC builds nothing.** Every SPEC-R lands through its named route (a spec
  revision, a harness lane, a toolkit gate, a pack re-sync); this document alone changes no code.
- **SPEC-N2 — The survey is frozen.** §2 is a dated snapshot; correction or refresh is a NEW
  dated record (a re-survey section or a superseding SPEC), never an edit that makes the old
  claims retroactively right (`.claude/docs/` historical-record law).
- **SPEC-N3 — The zero-dep law is not negotiable ecosystem-ward.** No requirement here may
  introduce a third-party runtime dependency into any default barrel — upstream's Zod-bound
  reference renderer (issue #2160) is the counterexample this repo differentiates against, not a
  precedent to follow.
- **SPEC-N4 — No styling reintroduction.** v1.0's "decoupled branding" matches this repo's
  standing posture (the catalog renders native fleet controls; theming is the fleet's token
  layer). No requirement chases protocol-level styling in either direction.

## 5 · Action rows (new work items route per [ADR-0145](../adr/0145-ticket-tier-github-issues-backend.md))

Each row is filed via `gh issue create` when its work is picked up — named here, deliberately not
created by this document:

| Action | SPEC-R | File as |
|---|---|---|
| Render-depth guard build | SPEC-R2 | `gh issue` (enhancement, size:small) |
| Deceptive-composition eval lane + rubric dimension | SPEC-R3 | `gh issue` (enhancement, size:big) |
| Surface-ID prefixing on the `Session` seam | SPEC-R4 | `gh issue` (enhancement, size:small) |
| Conformance-suite packaging | SPEC-R5 | `gh issue` (enhancement, size:big) |
| Version-pin + drift audit (4 arms, dated Findings) | SPEC-R6 | `gh issue` (enhancement, size:small) |
| `a2ui-protocol-facts` pack re-sync | SPEC-R7 | `/make-pack` (user-scope harness action — not a repo issue) |
| AG-UI leg priority + state-sync ruling | SPEC-R1 | streaming SPEC revision (its own doc, no issue needed until build) |

## 6 · Traceability

| SPEC id | Serves | Route |
|---|---|---|
| SPEC-R1 | PRD-G7 | `a2ui-streaming-pipeline.spec.md` (amends R4 priority + §6 open item) |
| SPEC-R2 | PRD-G1, PRD-G4 | `a2ui-runtime.spec.md` SPEC-N4 family · `renderer/renderer.ts` |
| SPEC-R3 | PRD-G4, PRD-G3 | `a2ui-expert-harness.spec.md` · `rubrics/a2ui-payload.md` |
| SPEC-R4 | PRD-G1, PRD-G7 | ADR-0137 toolkit, `src/agent/` `Session` seam |
| SPEC-R5 | PRD-G4, PRD-G6 | shared validator fixtures · upstream #2150 |
| SPEC-R6 | PRD-G6 | `protocol.ts` · runtime SPEC-R13 · `a2a-foundations.spec.md` |
| SPEC-R7 | PRD-G6 | `/make-pack` re-sync (user-scope) |
| SPEC-R8 | PRD-G7 | this SPEC (the ruling record) · streaming SPEC-R6 unchanged |

## 7 · Acceptance for this document

Ships `proposed`; Kim ratifies (nothing here self-flips — the SPEC-R8 ruling and the SPEC-R6
audit arms are recommendations on record until then). Document gates:
`site/lib/docs-grammar.test.ts` (status keyword + the relative-link sweep) exit 0 inside
`npm run check`'s `check:site` step.
