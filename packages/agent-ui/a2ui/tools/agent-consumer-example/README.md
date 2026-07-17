# Consumer example — driving `@agent-ui/a2ui/agent` into `ui-conversation`

A minimal, runnable **server-side** example of the loop TKT-0072 exists to close: a consumer app's own
agent reliably **emits real A2UI** wire messages (not markdown box-art), which render inline in chat.

This is the PRODUCER half. The RENDER half (`ui-surface-host` inside `ui-conversation`) already shipped
(app-surfaces-m2, SPEC-R7) and is transport-agnostic by design (ADR-0129 F1) — it takes whatever validated
JSONL you feed its `ingestLine()`. This example produces exactly that JSONL.

## Why server-side (not a browser dev-proxy)

The producer calls a model, so it needs an API key, and **a browser cannot hold a secret** (ADR-0069). So
the producer runs where the key lives — your server. This example holds its OWN key in its OWN env; it is
NOT a second dev-proxy (that key-holding shell stays site-internal, ADR-0137 clause 3). The exported
`@agent-ui/a2ui/agent` toolkit is therefore **Node-first** (ADR-0137 clause 4): `buildSystemPrompt` and the
mini-skill registry `readFileSync` their prompt files at load. A browser consumer imports only the
browser-safe seam modules (transport/session/meta-line/feed-catalog) — never the whole barrel.

## Run it

```sh
# from the repo root, with a real key (this file needs one by design — it is never a CI gate):
ANTHROPIC_API_KEY=sk-ant-... node --experimental-strip-types \
  packages/agent-ui/a2ui/tools/agent-consumer-example/produce-to-conversation.ts \
  "Build me a login form"
```

It prints the agent's prose `note`, then the validated A2UI JSONL. `npm run check` typechecks it;
`npm test` never runs it (no key in CI).

## The three injected surfaces (`ProduceDeps`)

| dep | this example | a richer consumer |
|---|---|---|
| `provider` | the exported hand-rolled `anthropicProvider({ apiKey })` (plain `fetch`, SDK-free) | any impl of the `AgentProvider` seam — bring-your-own-`fetch` for another model (F4) |
| `retrieve` | `() => []` — **exemplar-less** (ADR-0137 clause 5): `fewShot` degrades to `''` by contract; the mini-skill registry still ships the catalog-idiom knowledge | load your own corpus via `@agent-ui/a2ui/corpus`'s `createStore` + your own IO, return real `CorpusRecord[]` |
| `catalog` | `defaultCatalog` (root `.` barrel) — the sole component authority | the same; a custom catalog is its own concern |

## Wiring the output into `ui-conversation` (browser side)

`produce()` yields, in order: the leading meta-line (peel it with `readMetaLine` — it carries the agent's
prose `note`, and rides BESIDE the payload, never into the renderer), then the FULLY-VALIDATED A2UI JSONL
lines (validate-then-stream, SPEC-R5 — nothing invalid is ever emitted). Your transport ships those lines
to the client, which hands each straight to the render side — no re-validation:

```ts
// ui-surface-host:
host.ingestLine(line)
// or ui-conversation's per-turn handle:
const handle = conv.beginAgentTurn()
handle.setNote(note)          // the peeled prose
handle.ingestLine(line)       // each validated A2UI line
handle.finalize()
```

Interacting with the rendered surface round-trips a client message back through the session reducer
(`nextTurn`) into the next `produce()` turn — "the agent continues" (SPEC-R8).
