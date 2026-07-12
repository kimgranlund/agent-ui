# SPEC — A2UI Streaming Pipeline (production · transport · MCP)

> Status: proposed · v0.2 · 2026-07-02 (v0.1 2026-06-26) · Layer: SPEC (execution contract)
> **v0.2 reconciliation (2026-07-02):** realization boundary pinned — the CONSUMER-side streaming behaviors
> (line ingestion, arrival-order dispatch, progressive render-on-root, out-of-order tolerance, fault
> isolation, validate-at-finalize) are owned by the runtime SPEC and are REALIZED in the renderer
> (`renderer/{parser,renderer,tree}.ts`, ADR-0002). THIS SPEC's own scope — producer, codec, transports,
> MCP — is entirely unrealized. SPEC-R1's healing note sharpened (below): healing is producer/admission-side
> only; the renderer never heals.
> Refines: [`../a2ui-expert-system.prd.md`](../prd/a2ui-expert-system.prd.md) — primarily **PRD-G1, PRD-G7**; closes **PRD-D2** (transport) and contributes to **PRD-D5** (MCP). Target protocol: **A2UI v1.0**.
> Refined by: [`../lld/a2ui-streaming-pipeline.lld.md`](../lld/a2ui-streaming-pipeline.lld.md). Produces the message stream the renderer ([`./a2ui-runtime.spec.md`](./a2ui-runtime.spec.md)) consumes; conditioned by the corpus ([`./a2ui-training-corpus.spec.md`](./a2ui-training-corpus.spec.md)).
> Altitude: owns the **producer + transport behavior + message codec contract**. Wiring internals are the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Define how A2UI is **produced and moved**: the generation pipeline that turns an intent into a validated, ordered A2UI message stream (PRD-G1), and the transports that carry it to a renderer (PRD-G7) — raw JSONL/stdio (the first-class default, resolving **PRD-D2**), AG-UI, and A2A — plus an MCP surface for serving catalogs, validating payloads, and retrieving corpus exemplars. This is the "streaming A2UI systems, pipelines, and workflows" of the system goal.

A2UI facts conformed to (Constraint C1): the ordered server→client envelope, MIME `application/a2ui+json`, the client capabilities exchange (and A2A metadata placement), and the generate→validate→self-correct loop with `parse_response`/`payload_fixer` healing.

## 2. Definitions

- **Pipeline** — the producer: intent → conditioned generation → validation → emitted stream.
- **Codec** — encode/decode of A2UI messages as line-delimited JSON (JSONL).
- **Transport** — a channel carrying the message stream (stdio, AG-UI, A2A).
- **MCP surface** — Model-Context-Protocol tools exposing serve-catalog / validate / retrieve-corpus to a generating agent.

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 Codec & production

**SPEC-R1 — JSONL message codec.** The system MUST encode an ordered A2UI message sequence as line-delimited JSON (one envelope message per line) and decode the same, preserving order. The decoder MUST tolerate partial/streamed input and apply healing parity (`parse_response`/`payload_fixer`) so a model's formatting noise does not break a semantically valid stream. **Healing ownership:** healing lives in THIS codec and in corpus admission (the ONE shared healer, corpus LLD-C7) — the renderer's parser deliberately does NOT heal: a malformed line is a `PARSE` error + stream-continue (runtime SPEC-N4), so client-side provable validity (PRD-G4) is never masked by silent repair. *(→ PRD-G1)*
- **AC1** *Given* an ordered message sequence, *when* encoded then decoded, *then* the sequence round-trips identically and in order.
- **AC2** *Given* a streamed input with a markdown-fenced or trailing-comma message, *when* decoded, *then* healing recovers it and the message is delivered (no stream abort).

**SPEC-R2 — Generation pipeline (bounded generate→validate→self-correct).** The system MUST produce an A2UI stream from an intent by: conditioning a generating agent with corpus exemplars (few-shot/retrieval), validating output with the shared validator + the relevant rubric, and self-correcting on failure within a bound. An invalid stream MUST NOT be emitted to a consumer. *(→ PRD-G1)*
- **AC1** *Given* an intent + catalog, *when* the pipeline runs, *then* it emits only a stream that passes the shared validator; a non-recoverable generation halts at the bound and reports, emitting nothing invalid.

### 3.2 Transport

**SPEC-R3 — Transport-agnostic channel; stdio default (resolves PRD-D2).** The pipeline MUST expose a transport-agnostic message channel, with **raw JSONL over stdio as the first-class default transport** and additional transports as pluggable adapters. Switching transport MUST NOT change the message semantics. *(→ PRD-G7, PRD-D2)*
- **AC1** *Given* the stdio transport, *when* a stream is produced, *then* a consumer reading stdin receives the identical ordered messages a renderer can ingest.
- **AC2** *Given* the same pipeline output over two transports, *when* both are decoded, *then* the message sequences are identical (transport-invariance).

**SPEC-R4 — AG-UI adapter.** The system MUST be able to carry the A2UI stream over AG-UI's event stream (HTTP/SSE/WebSocket), mapping each A2UI message to an AG-UI event. *(→ PRD-G7)*
- **AC1** *Given* the AG-UI adapter, *when* a stream is produced, *then* a conformance smoke confirms each A2UI message arrives as an ordered AG-UI event a renderer reconstructs.

**SPEC-R5 — A2A adapter.** The system MUST be able to carry A2UI over A2A, placing the client capabilities (`a2uiClientCapabilities`) in the A2A `Message` metadata per the protocol. *(→ PRD-G7)*
- **AC1** *Given* the A2A adapter, *when* a surface is created, *then* the client's `a2uiClientCapabilities` (including supported `protocolVersion`) appear in the A2A message metadata.

**SPEC-R6 — MCP serving surface.** The system MUST provide an MCP server (self-hosted or **CLI-based by default**, contributing to PRD-D5) exposing tools to: serve a catalog by id, validate an A2UI payload (shared validator), and retrieve top-k corpus exemplars for an intent/catalog. Tools MUST be scoped and described for agent selection. *(→ PRD-G7, PRD-D5)*
- **AC1** *Given* the MCP server, *when* an agent calls `retrieve-corpus(intent,catalogId,k)`, *then* it returns ≤k pinned exemplars (corpus SPEC §4.4); `validate-payload` returns the shared validator's verdict; `serve-catalog` returns the registered catalog.

### 3.3 Conformance & ordering

**SPEC-R7 — End-to-end conformance.** The pipeline MUST tag payloads `application/a2ui+json`, negotiate protocol version with the consumer (default v1.0; v0.9.1 supported), and complete the capabilities exchange before streaming surface content. *(→ PRD-G1, PRD-G6)*
- **AC1** *Given* a consumer advertising only v1.0, *when* the pipeline negotiates, *then* it streams v1.0 messages or declines with a version error — never streams an unsupported version.

**SPEC-R8 — Ordering & progressive delivery.** Messages MUST be delivered in production order, progressively (a consumer can render before stream end), with backpressure handling for a slow consumer; the transport MUST NOT reorder messages. *(→ PRD-G1)*
- **AC1** *Given* a slow consumer, *when* the stream is produced, *then* messages still arrive in order with no loss; *given* `createSurface`+`updateComponents(root)` early, *then* the consumer renders before `updateDataModel` arrives (progressive).

---

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Time-to-first-message | The pipeline streams (emits the first valid message as soon as produced); it MUST NOT buffer the whole UI before sending (progressive, PRD-G1). |
| **SPEC-N2** | Zero-dep core | The codec + stdio transport add no third-party runtime dependency (Constraint C2). AG-UI/A2A/MCP adapters MAY be tooling-scoped (dev/server), never in the renderer's consumer bundle. |
| **SPEC-N3** | Validator parity | The pipeline's pre-emit validation and the MCP `validate-payload` tool use the shared validator — identical verdict to renderer + corpus admission. |
| **SPEC-N4** | Ordering guarantee | No transport reorders or drops messages; a sequence test asserts order preservation across every transport. |

## 5. Typed contracts

```ts
// Codec (SPEC-R1)
interface A2uiCodec {
  encode(messages: A2uiServerMessage[]): string;            // JSONL
  decode(jsonl: string | AsyncIterable<string>): AsyncIterable<A2uiServerMessage>;  // healing-parity decode
}

// Pipeline (SPEC-R2)
interface A2uiPipeline {
  produce(task: { intent: string; catalogId: string; protocolVersion?: string },
          opts: { maxRounds: number }): AsyncIterable<A2uiServerMessage>;   // validated, ordered
}

// Transport (SPEC-R3..R5) — transport-agnostic channel
interface Transport {
  name: "stdio" | "ag-ui" | "a2a";
  send(messages: AsyncIterable<A2uiServerMessage>): Promise<void>;
  receive(): AsyncIterable<A2uiServerMessage>;
  capabilities?(): A2uiClientCapabilities;                  // A2A places these in Message metadata (SPEC-R5)
}

// MCP surface (SPEC-R6)
interface A2uiMcpTools {
  "serve-catalog":     (a: { catalogId: string }) => Catalog;
  "validate-payload":  (a: { payload: unknown; catalogId: string }) => ValidationVerdict;   // shared validator
  "retrieve-corpus":   (a: { intent: string; catalogId: string; k: number }) => CorpusRecord[];
}
```

## 6. Open items (non-normative)

- **PRD-D5 (MCP delivery)** — this SPEC sets CLI-based MCP as the *default* (SPEC-R6); a self-hosted server is a deployment option the LLD details.
- **Transport priority beyond stdio** — AG-UI vs A2A ordering of implementation is an LLD sequencing call; SPEC-R4/R5 fix the behavior, not the order built.

## 7. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1, R2, R8, N1, N4 | PRD-G1 (streamed generation renders) |
| SPEC-R3 | PRD-G7, PRD-D2 (transport; stdio default) |
| SPEC-R4, R5, R6 | PRD-G7 (AG-UI / A2A / MCP interop) · PRD-D5 |
| SPEC-R7, N3 | PRD-G1, PRD-G6 (conformance/version coherence) |

_Co-serves PRD-G1 with runtime/catalog and completes PRD-G7. Status: each doc's own header (the tree wins); the original charter table is archived (frozen 2026-07-08)._
