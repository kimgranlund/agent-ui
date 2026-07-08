# LLD — A2UI Streaming Pipeline (codec · transports · MCP)

> Status: proposed · v0.2 · 2026-07-02 (v0.1 2026-06-26) · Layer: LLD (implementation plan)
> Implements: [`../specs/a2ui-streaming-pipeline.spec.md`](../specs/a2ui-streaming-pipeline.spec.md) (SPEC-R1..R8, SPEC-N1..N4), targeting A2UI **v1.0**. Consolidates the previously-planned `a2ui-stream-codec` + `a2ui-mcp` LLDs.
> Altitude: adds the **how**; cites `SPEC-R*`. Reuses the shared validator (`renderer/validate.ts`) and the corpus store's healer (`corpus/heal.ts`, corpus-store LLD-C7 — unbuilt) + retriever/exporters — no forks (parity).
> **v0.2 reconciliation (2026-07-02):** realized/unrealized column added; the v0.1 "renderer healer `heal.ts`" citations repaired — no renderer healer exists or ever did. The RENDERER deliberately does not heal: its shipped parser (`src/renderer/parser.ts`) fault-isolates a malformed line as a `PARSE` error and continues (runtime SPEC-N4), so client-side provable validity (PRD-G4) is never masked. Healing is producer/admission-side ONLY — the ONE healer is the corpus store's LLD-C7, shared by admission and this codec when built.

---

## 1. Component map (traceability · realized-state 2026-07-02)

**Every LLD-C\* module below is UNBUILT as a `src/stream/`/`tools/pipeline/` module — with two
pointer-recorded exceptions: LLD-C2's driver is REALIZED off-family by `a2ui/tools/agent/produce.ts` (see
its row, re-synced 2026-07-08), and LLD-C5 is now REALIZED at its planned path by the A2A family's B6
bridge build (see its row, re-synced 2026-07-08).** The consumer-side
streaming *behaviors* are already REALIZED — but they live in the RENDERER under the runtime SPEC's
ownership, not here: JSONL line decode + fault isolation (`renderer/parser.ts`, runtime SPEC-R1/N4), the
`ingest(line)` public host + arrival-order dispatch (`renderer/renderer.ts`), progressive render-on-root +
out-of-order tolerance (`renderer/tree.ts`, runtime SPEC-R3/R4/N1), validate-at-finalize (ADR-0002), and
`capabilities()` (runtime SPEC-R12). This LLD owns only the PRODUCER/TRANSPORT/MCP half.

| ID | Component | Implements | File (under `packages/agent-ui/a2ui/`) | Scope | State |
|---|---|---|---|---|---|
| **LLD-C1** | JSONL codec | SPEC-R1 | `src/stream/codec.ts` | runtime | unbuilt |
| **LLD-C2** | Generation pipeline driver | SPEC-R2 | `tools/pipeline/produce.ts` | dev/CI | **REALIZED (2026-07-08 re-sync)** — by the live-agent wave's `tools/agent/produce.ts` (its header: "streaming LLD-C2 realized"): generate→validate→self-correct, bounded, validate-then-stream. The planned `tools/pipeline/produce.ts` module is superseded by that realization; no second driver gets built |
| **LLD-C3** | Transport abstraction + stdio | SPEC-R3, R8 | `src/stream/transport.ts` + `tools/pipeline/stdio.ts` | runtime (iface) / dev (stdio) | unbuilt |
| **LLD-C4** | AG-UI adapter | SPEC-R4 | `tools/pipeline/transports/ag-ui.ts` | dev/server | unbuilt |
| **LLD-C5** | A2A adapter | SPEC-R5 | `tools/pipeline/transports/a2a.ts` | dev/server | **REALIZED (2026-07-08, B6)** — by the A2A family's bridge build ([`../../lld/a2a-a2ui-bridge.lld.md`](../../lld/a2a-a2ui-bridge.lld.md), its LLD-C1/C2), at the exact planned path, on the `@agent-ui/a2a` substrate: `envelopeToPart`/`partToEnvelope`/`wrapServerTurn`/`unwrapTurn`/`wrapClientTurn`, one envelope per tagged DataPart, `a2uiClientCapabilities` on every client→server message (HV-8). SPEC-R5 stays this family's contract; acceptance is proven by that build's `bridge.test.ts` (SPEC-R16 AC1) |
| **LLD-C6** | MCP server | SPEC-R6 | `tools/pipeline/mcp-server.ts` | dev/CLI | unbuilt · blocked by corpus store (retrieve/admit) |
| **LLD-C7** | Conformance/negotiation | SPEC-R7, N3 | `src/stream/conformance.ts` | runtime | unbuilt |

**Split (SPEC-N2):** `src/stream/{codec,transport,conformance}.ts` are zero-dep runtime; the pipeline driver + concrete transports + MCP are dev/server-scoped (they orchestrate agents/IO) and never enter the renderer's consumer bundle.

## 2. Codec — LLD-C1 (SPEC-R1)

```ts
function encode(messages: A2uiServerMessage[]): string =
  messages.map(m => JSON.stringify(m)).join("\n") + "\n";

async function* decode(src: string | AsyncIterable<string>): AsyncIterable<A2uiServerMessage> {
  for await (const line of lines(src)) {                 // line splitter tolerant of chunk boundaries
    const trimmed = line.trim(); if (!trimmed) continue;
    const healed = heal(trimmed);                        // corpus heal.ts (corpus LLD-C7) — the ONE healer, shared with admission (SPEC-R1 AC2)
    if (!healed.ok) { yield errorMessage("PARSE", trimmed); continue; }  // one bad line ≠ stream abort
    yield healed.value;
  }
}
```
**Invariant:** order is preserved (sequential yield); a partial trailing line is buffered until its newline (streaming-safe, SPEC-N1). **Edge:** an unparseable line emits a `PARSE` error message and continues (matches renderer fault isolation).

## 3. Pipeline driver — LLD-C2 (SPEC-R2)

Reuses the harness loop CONTRACT (harness SPEC-R6: gates-first, bounded, halt-and-report) specialized to stream production — its programmatic realization arrives with the live-agent wave's driver (harness LLD v0.2 §6; the harness itself realizes the loop procedurally):
```ts
async function* produce(task, opts) {
  const exemplars = retrieveCorpus(task.intent, task.catalogId, K);   // corpus store retriever
  let stream = await generateA2ui(task, exemplars);                   // agent, corpus-conditioned
  for (let r = 0; r < opts.maxRounds; r++) {
    const v = validateStream(stream, catalogOf(task.catalogId));      // shared validator (N3)
    if (v.valid) { yield* stream; return; }                           // emit only when valid (SPEC-R2 AC1)
    stream = await generateA2ui(task, exemplars, v.failures);         // self-correct from verdict
  }
  throw new PipelineHalt(/* last failures */);                        // bounded; emit nothing invalid
}
```
**Edge:** non-recoverable generation halts at `maxRounds` and emits nothing (no partial invalid stream leaks).

## 4. Transports — LLD-C3, LLD-C4, LLD-C5

**LLD-C3 abstraction + stdio (SPEC-R3, default).** `Transport` (SPEC §5) with `send`/`receive`. The stdio transport writes `encode()` to stdout and `decode()`s stdin — the reference implementation a renderer consumes directly. **Transport-invariance (SPEC-R3 AC2):** all transports carry the *same* `A2uiServerMessage[]`; only framing differs.

**LLD-C4 AG-UI.** Map each A2UI message to an AG-UI event over SSE/HTTP/WS; preserve order via the event sequence. Conformance smoke (SPEC-R4 AC1) reconstructs the stream from the AG-UI event log.

**LLD-C5 A2A — REALIZED (2026-07-08, B6).** Carry messages as A2A `Message`s; place `a2uiClientCapabilities` in the A2A `Message.metadata` (SPEC-R5 AC1). Surface creation handshakes capabilities before content. Built exactly this way by the A2A family's bridge LLD (`../../lld/a2a-a2ui-bridge.lld.md`, its §3): `wrapServerTurn` carries one A2UI envelope per tagged `DataPart`; `wrapClientTurn` is the sole client-message composer and places the caps object on every call by construction (no caps-less code path) — the "before content" ordering is structural (caps ride the message's own `metadata`, not a leading part).

**Ordering (SPEC-R8/N4):** each transport guarantees in-order delivery; a sequence test tags messages with an index and asserts monotonic receipt across all three. Backpressure: `send` awaits the consumer's drain (async iterable pull) — a slow consumer throttles production without loss.

## 5. MCP server — LLD-C6 (SPEC-R6, PRD-D5)

A CLI-launchable MCP server exposing three scoped, described tools:

| Tool | Backed by | Returns |
|---|---|---|
| `serve-catalog` | catalog registry (`a2ui-catalog` LLD) | the registered `Catalog` |
| `validate-payload` | shared validator (`validate.ts`) | `ValidationVerdict` (parity, N3) |
| `retrieve-corpus` | corpus retriever (`a2ui-corpus-store` LLD) | ≤k pinned exemplars |

Default delivery is CLI (`npx a2ui-mcp` / stdio MCP), self-hosted HTTP optional. Tool descriptions are written for agent selection (inversion-first: each tool says when to call it).

## 6. Conformance/negotiation — LLD-C7 (SPEC-R7)

`negotiate(consumerCaps): { version } | VersionError`: intersect producer-supported {v1.0, v0.9.1} with the consumer's advertised versions; pick the highest common (default v1.0); if none → decline with a version error (never stream unsupported, SPEC-R7 AC1). Payloads are tagged `application/a2ui+json`. Capabilities exchange precedes surface content.

## 7. Error & edge-case handling

| Code / edge | Stage | Handling |
|---|---|---|
| `PARSE` (bad line) | LLD-C1 | heal-then-error message; stream continues (SPEC-R1 AC2) |
| partial trailing line | LLD-C1 | buffer until newline; never yield a truncated message |
| pipeline non-recovery | LLD-C2 | `PipelineHalt` at `maxRounds`; emit nothing invalid (SPEC-R2) |
| transport reorder/loss | LLD-C3/C4/C5 | sequence-index assertion fails the conformance test (N4) |
| slow consumer | LLD-C3 | async-pull backpressure; no drop |
| version mismatch | LLD-C7 | decline with version error; do not stream (SPEC-R7) |
| MCP tool misuse | LLD-C6 | unknown `catalogId` → `CATALOG_UNKNOWN`; invalid payload → verdict with codes (not an exception) |
| validator fork | LLD-C2/C6 | any local re-impl of validation → parity test fails (N3) |

## 8. File & integration plan

```
packages/agent-ui/a2ui/
  src/stream/      codec.ts transport.ts conformance.ts index.ts          # zero-dep runtime
  tools/pipeline/  produce.ts stdio.ts mcp-server.ts  transports/{ag-ui,a2a}.ts
```

**Integration:** `codec.decode` reuses the corpus healer (`corpus/heal.ts`, corpus LLD-C7 — the renderer has NO healer by design; its parser fault-isolates, runtime SPEC-N4); `produce`/`mcp-server` reuse the shared `validate.ts` (renderer LLD) + the corpus retriever/exporters (`a2ui-corpus-store` LLD) + the catalog registry (`a2ui-catalog` LLD); `a2a.ts` reuses the renderer's `capabilities()` (renderer LLD-C12). The stdio transport's output is exactly what the renderer host's `ingest(line)` consumes — closing the produce→render loop (the A1/A3 integration proof; the consumer side of this loop is SHIPPED — the `/site` example pages already drive `ingest` line-by-line through the public host).

## 9. Build sequence (dependency-ordered; each step verifiable)

1. **LLD-C1 codec** — encode/decode round-trip + healing of a fenced/trailing-comma line. *(checkpoint: SPEC-R1 AC1/AC2)*
2. **LLD-C3 transport + stdio** — stdio send/receive; transport-invariance harness. *(checkpoint: renderer ingests stdio output unchanged — SPEC-R3 AC1)*
3. **LLD-C7 conformance** — version negotiation + MIME + capabilities-before-content. *(checkpoint: unsupported version declined, SPEC-R7)*
4. **LLD-C2 pipeline driver** — corpus-conditioned generate→validate→self-correct; emit-only-valid. *(checkpoint: invalid never emitted, SPEC-R2 AC1)*
5. **LLD-C6 MCP server** — serve-catalog/validate/retrieve over CLI MCP. *(checkpoint: retrieve-corpus returns ≤k pinned exemplars — SPEC-R6 AC1)*
6. **LLD-C4 AG-UI** + **LLD-C5 A2A** — adapters + conformance smokes. *(checkpoint: each carries the stream in order, capabilities in A2A metadata — SPEC-R4/R5)*
7. **End-to-end** — produce → stdio → `A2uiRenderer.ingest` renders interactive controls (PRD-G1/G7 proof).

**Discovered-reality note:** if a transport cannot preserve strict order without buffering (e.g. an SSE reconnect), that pressures SPEC-R8 — fix `a2ui-streaming-pipeline.spec.md` §3.3 (define the reconnect/resume semantics) rather than silently buffering in the adapter.
