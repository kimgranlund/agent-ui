# LLD — `ui-agent-admin`'s DEV-only live-model overlay (TKT-0052)

> Status: proposed · v0.1 · 2026-07-15 · Layer: LLD (implementation plan)
> Implements: [ADR-0136](../adr/0136-agent-admin-dev-only-live-model-overlay.md) (accepted) ·
> [TKT-0052](../tickets/tkt-0052-agent-admin-live-model-overlay.md) (open). Decomposition:
> [`../decompositions/agent-admin-live-model-overlay.decomp.json`](../decompositions/agent-admin-live-model-overlay.decomp.json)
> (coverage_check clean, `--strict` clean, 2026-07-15).
> Composes on: [`./a2ui-live-agent.lld.md`](./a2ui-live-agent.lld.md) LLD-C6 (`dev-proxy-plugin.ts`, the
> trust boundary this rides) / LLD-C7 (`live-proxy-transport.ts`, the overlay-module precedent) /
> LLD-C10 (the `AgentProvider` adapters); [`./app-surfaces-m2.lld.md`](./app-surfaces-m2.lld.md)
> (`ui-conversation`'s `AgentTurnHandle`, whose frozen four-method contract this deliberately does NOT widen);
> ADR-0131/0132/0135 (the config pieces being projected). **This LLD's components are numbered `ALM-C#`**
> (the renderer-structural-resend precedent: never reuse a sibling LLD's `LLD-C#` numbers in a doc that cites
> them side by side).
> Altitude: the **how** of one construction-site swap. ADR-0136 rules the *whether* (dev-only, reuse-not-invent);
> this document resolves the five build-time questions the ADR/ticket left explicitly open, each with its
> rationale, and pins the units, wire shapes, and gates.

---

## 0. The one framing correction discovered against the real mechanism

ADR-0136 Fork 2 reads "reuse `AgentTransport`/`dev-proxy-plugin.ts`/`produce()`". Reading the shipped
mechanism shows `produce()` is **not reusable for this surface, and reusing it would be wrong**:

- `produce()` (`a2ui/tools/agent/produce.ts`) is the **A2UI-generation loop** — it retrieves corpus
  exemplars, builds its own catalog-derived system prompt (`buildSystemPrompt`, with **no injection point
  for a caller-supplied system prompt**), then heals/validates the output as **A2UI JSONL**, self-correcting
  or halting on anything that isn't a valid surface payload.
- `agent-admin`'s live turn is the opposite shape: the **user-composed** system prompt
  (`composeSystemPrompt`, ADR-0132) must BE the system prompt, and the reply is **prose** rendered via
  `AgentTurnHandle.setNote()` — which `produce()` would reject as invalid A2UI and burn self-correct rounds
  on.

What IS reused verbatim — the actual mechanism ADR-0136's Fork 2 protects — is everything below
`produce()`: the **same plugin mount** (`/__a2ui/agent`, already in `vite.config.ts:46`), the same
`providers.json` pair-allowlist (`resolvePair`), the same server-side env-key handling, the same
`providerFor` dispatch, and the same `AgentProvider.stream({model, system, messages, signal})` seam —
which takes a caller system prompt and yields raw prose fragments, i.e. **exactly this surface's need**.
The chat route is a second *branch on the same mount* calling one level below `produce()`; it duplicates
zero key-holding, zero allowlisting, zero proxy infrastructure (ADR-0073 held; ADR-0136 cl.2's "rides the
same mount" honored literally).

## 1. Component map (traceability)

| ID | Component | Decomp node | File |
|---|---|---|---|
| **ALM-C1** | `composeLiveSystemPrompt` — capability projection (Fork 3) | n1 | `packages/agent-ui/app/src/controls/agent-admin/entries.ts` |
| **ALM-C2** | The injectable turn-runner seam types | n2 | `agent-admin-schema.ts` (same folder) |
| **ALM-C3** | `agentTurn` prop + `#handleSubmit` live fork + `#history` | n3–n5 | `agent-admin.ts` |
| **ALM-C4** | Descriptor row for the new prop | n6 | `agent-admin.md` |
| **ALM-C5** | `providerForModel` — server-side pair derivation | n7 | `a2ui/tools/agent/providers-config.ts` |
| **ALM-C6** | The `/chat` branch on the existing proxy mount | n8 | `a2ui/tools/agent/dev-proxy-plugin.ts` |
| **ALM-C7** | The site-side live runner module | n9 | `site/lib/admin-live-runner.ts` (new) |
| **ALM-C8** | The page's DEV-gated overlay wiring | n10 | `site/pages/agent-admin.ts` |
| **ALM-C9** | Gates: package · site · tools | n11–n13 | `entries.test.ts` / `agent-admin.test.ts` (package) · `site/pages/agent-admin.test.ts` (new) · `providers-config.test.ts` |

## 2. The five open questions, resolved

### Q1 — config → request mapping: `agent-admin` gets its **own small resolver**; `resolveProduceOptions` is NOT reused

**Ruling.** The component's existing `#handleSubmit` snapshot assembly (already fail-closed via the shared
`sanitizeSelect`/`sanitizeNumber` guards, ADR-0135 Piece A) **is** the resolver, extended one step: snapshot →
`AdminTurnRequest`.

```ts
// agent-admin-schema.ts (ALM-C2) — app-local; a2ui's tools-internal Turn type is never imported
// (it is deliberately not a package export, SPEC-N1); the site layer matches it structurally.
export interface AdminTurn { role: 'user' | 'assistant'; content: string }
export interface AdminTurnRequest {
  text: string            // the user's message, verbatim
  system: string          // composeLiveSystemPrompt(...) output — fresh-read at turn time
  model: string           // the sanitized SUPPORTED_MODELS id (sanitizeSelect, DEFAULT_MODEL_ID fallback)
  history: readonly AdminTurn[]  // prior completed turns (Q4), NOT including `text`
}
export type AdminAgentTurn = (req: AdminTurnRequest) => Promise<string>
```

**Why not `resolveProduceOptions` (ADR-0135)?** It resolves into `ProduceOptions` — `mode`/`k`/`maxRounds`/
`miniSkillCap` are tuning knobs of the `produce()` loop this surface doesn't run (§0), and its `model`
options project from `ProvidersConfig`, a Node-side registry the browser component can't (and shouldn't)
read. Adapting it would mean carrying four dead knobs and a Node dependency to avoid ~10 lines of mapping
that `#handleSubmit` already half-owns. Not a drop-in fit, exactly as TKT-0052 suspected — so: own resolver,
minimal, app-local.

**Named exclusions (deliberate, not oversights):** `temperature` and `name` do NOT reach the wire this
build. `AgentProvider.stream`'s request is `{model, system, messages, signal}` — no temperature parameter
exists on the seam or the Anthropic adapter body, and widening the shared adapter seam (used by
`a2ui-live`/`produce()`) for a preview knob exceeds this ticket's mandate. `temperature` remains a
stub-affecting display knob; a one-line seam widening is a separately-dispatchable follow-up if Kim wants
it. (`toolsEnabled` DOES get a live meaning — Q2.)

### Q2 — ADR-0136 Fork 3: capability entries get **real wire representation via system-prompt projection** — not API `tools` declarations, not display-only

**Ruling.** `composeLiveSystemPrompt` (ALM-C1, a pure sibling of `composeSystemPrompt` in `entries.ts`)
projects every **enabled** entry of the four capability kinds into labeled blocks appended after the
composed prompt sections:

```
{composeSystemPrompt(sections)}

## Skills available to you
### {entry.label}
{entry.description}

{entry.content}
…(one block per enabled entry, in `order`; one `##` group per kind with ≥1 enabled entry)
```

- A kind with zero enabled entries contributes **nothing** (no empty headers).
- `toolsEnabled === false` gates the **tools** kind's group out entirely — the flat boolean finally gets a
  live meaning consistent with its label; the master switch wins over per-entry toggles.
- **Equivalence property (gated):** with no enabled capability entries (and `toolsEnabled` false), the
  output is byte-identical to `composeSystemPrompt(sections)` — the live prompt degrades exactly to
  today's composed prompt.

**Why projection and not `tools` on the API call?** ADR-0132 Fork 3 deliberately made entries generic
prose — label + description + free-text content, **no parameter schema**. There is nothing machine-callable
to declare: a `tools` API parameter without input schemas and without a tool_use/tool_result execution loop
would be fabricated structure. Projection is the *maximal faithful* wire representation of what the user
actually authored — the model genuinely receives and acts on every enabled entry, so a capability edit
visibly changes the very next live reply (the TKT-0052 fresh-read acceptance, extended to capabilities).
**Why not display-only?** Then "live" would silently drop the pane the user just authored in — the
silent-swallow failure mode the ticket exists to prevent. A real tool-execution loop stays a future,
separately-decomposed feature (it needs parameter schemas first — ADR-0132's own named deferral).

### Q3 — streaming vs single-shot: **single-shot** (`setNote` + `finalize`), with stream-shaped internals

**Ruling.** The runner resolves to ONE full reply string; the fork calls `handle.setNote(reply)` then
`handle.finalize()`.

**Why.** `AgentTurnHandle` (conversation.ts, SPEC §4's ratified four-method contract:
`ingestLine`/`setNote`/`finalize`/`fail`) has **no incremental-prose method** — `setNote` stashes and
renders once at `finalize()`. Token-streaming would require widening a shipped M2 primitive's public API —
precisely what `conversation.ts` itself refused to do unilaterally (its documented `narrateTrace` NAMED LLD
GAP precedent). `ingestLine` is for A2UI wire JSONL, not prose. So single-shot is the only shape the frozen
contract hosts; the proxy route buffers server-side and answers one JSON `{text}` (which also kills the
mid-stream-truncation ambiguity a chunked prose stream would create on an upstream error). **Flag for the
design seat** (also in the hand-off): if token-streaming is ever wanted here, `ui-conversation` needs its
own contract change first (e.g. an incremental note method) — that is its own ticket, not this one.

### Q4 — session history: **multi-turn — prior turns replay into the live request**

**Ruling.** `#history: AdminTurn[]` (private, element-lifetime): after each completed turn (both paths),
append `{role:'user', content: text}` + `{role:'assistant', content: reply}`. The live request carries
`history` (prior turns only); the system prompt is **rebuilt fresh every turn and never stored in
history** — so a model/prompt/capability switch mid-conversation applies to the NEXT turn only, and prior
turns are never rewritten (the TKT-0052 acceptance criterion falls out by construction).

**Why not stateless-matching-the-stub?** Verified: `runStubAgentTurn(text, config)` is stateless — but as
an artifact of being a deterministic stub, not as a contract anyone ratified. A live chat preview with
per-turn amnesia cannot answer "and what did I just tell you?" — it would misrepresent the configured
agent, which is the one thing this preview exists to represent. Stub turns recorded into history are a
truthful record ("[stub preview…]" prefixed) if a user sends before the async probe resolves — acceptable
dev-only noise. The stub path itself keeps ignoring history (byte-unchanged reply). `history` rides within
the proxy's existing 1 MiB body cap (`MAX_BODY`) — a documented dev-only bound, no trimming built.

### Q5 — error/loading UX: the **already-shipped `ui-conversation` affordances**, nothing new invented

**Ruling.**
- **Loading:** `beginAgentTurn()`'s in-flight counter (TKT-0034) already disables the composer +
  `aria-busy` until `finalize()`/`fail()` — zero new code. The narration strip renders no category entries
  for a prose turn (no A2UI lines) and finalizes cleanly — verified against `narrateCategories`' shape.
- **Error:** a thrown runner (network fault, `!res.ok`, timeout) → `handle.fail(err.message)` — the shipped
  SPEC-R6 AC3 path: an error narration entry + a "⚠ …" system bubble, composer re-enabled, never a crash.
  This is byte-for-byte the "visible, non-crashing degradation" the ticket's acceptance asks for, already
  independently reviewed once when M2 shipped. The runner maps proxy errors to thrown `Error`s carrying the
  proxy's `{error}` string + status (the `live-proxy-transport.ts` precedent), plus an
  `AbortSignal.timeout(120_000)` so a hung request cannot busy-lock the composer forever.
- **Probe/overlay unavailability** (no key, prod build): the page simply never assigns `agentTurn` — stub
  continues — and a one-line status caption under the demo frame states which arm is active (page chrome;
  the `a2ui-live.ts` system-message precedent, adapted to this page's shape).

## 3. The construction-site swap (ALM-C3 + ALM-C8) — where the DEV gate lives

The a2ui-live precedent puts the `import.meta.env.DEV` gate in the **site page**, never the package — held
here for the same three reasons: the packaged component must stay fetch/env/proxy-URL-free (the SPEC-R1 AC1
discipline, and `import.meta.env` is Vite-vocabulary a bare `tsc` package shouldn't speak); the tree-shake
proof is a site-bundle property; and the package's default behavior (stub) must hold in every context —
package tests, the static site, any future consumer — with zero configuration.

- **ALM-C3:** `agentTurn` joins `schema`/`store` as a third non-reflected prop
  (`{ ...prop.json<AdminAgentTurn | undefined>(undefined), attribute: false }`), default `undefined` ⇒ the
  stub branch. `#handleSubmit` becomes async-tolerant: the live branch `await`s inside a `try/catch`
  closing over the handle (`fail` in `catch`); the stub branch stays the existing three synchronous lines.
- **ALM-C8:** `wireLiveOverlay()` in `site/pages/agent-admin.ts` — `if (!import.meta.env.DEV) { caption('stub'); return }`,
  then `void import('../lib/admin-live-runner.ts')` → `probeLive()` → on `available`,
  `admin.agentTurn = createAdminAgentTurn()` + caption('live', provider count); on failure/catch,
  caption('stub — no live key'). Guard-before-import ordering is what the source gate asserts (§5).

## 4. The proxy `/chat` branch (ALM-C5 + ALM-C6) — wire contract

```
POST /__a2ui/agent/chat
  → { system: string, model: string, messages: AdminTurn[] }   // messages = history + {role:'user', content:text}
  ← 200 { text: string }                                        // the full reply, buffered server-side
  ← 400 { error }  — model not owned by any implemented provider / pair rejected (resolvePair)
  ← 503 { error }  — no key configured / provider dispatch unavailable
  ← 500 { error }  — upstream/provider fault (message only, never a key)
```

- The branch is inserted **before** the existing generic `POST` branch (which currently claims every POST
  regardless of sub-path) via `url.startsWith('/chat')`; the existing produce-route code is byte-unchanged.
- `providerForModel(config, model)` (ALM-C5, pure, in `providers-config.ts`): scan `config.providers` for
  the implemented provider whose `models` contain the id — the browser never names a provider, so
  `providers.json` stays the single source (a second implemented provider later needs zero client change).
  Its result still goes through `resolvePair` (belt-and-braces, same as the produce route).
- Everything else is the existing helpers verbatim: `loadConfig()` per request, `env[pair.envKey]`,
  `providerFor(provider, {apiKey, endpoint})`, then `provider.stream({model, system, messages})` fragments
  accumulated server-side into one string. `apply: 'serve'` already guarantees the whole plugin never
  exists in a build.

## 5. Gates (ALM-C9) — all deterministic, no live key in CI

| Gate | Where | Asserts |
|---|---|---|
| Projection unit | `entries.test.ts` | ALM-C1's block shape · enabled/disabled/`toolsEnabled` gating · the **empty-capability byte-equivalence** property |
| Live-fork behavior | `agent-admin.test.ts` (package, jsdom) | injected resolving runner → note text rendered at finalize · injected **throwing** runner → `fail` path (system bubble, composer re-enabled) · **fresh-read:** store edit between two turns changes the 2nd request's `system`+`model` · history accumulates and prior requests' shapes are never rewritten · `agentTurn` undefined ⇒ stub reply byte-identical to today |
| Tree-shake source gate | `site/pages/agent-admin.test.ts` (new) | the `a2ui-chat.test.ts:218` gate verbatim: no static module-scope import of `admin-live-runner`/`live-proxy-transport`; `import.meta.env.DEV` index-precedes the dynamic import inside `wireLiveOverlay` |
| Model-registry lockstep | same file | every `SUPPORTED_MODELS` id ∈ some **implemented** `providers.json` provider's models (a drift here is a live-only 400 no jsdom test would ever see) |
| Pair derivation | `providers-config.test.ts` | `providerForModel`: hit · unknown id · id owned only by an `implemented:false` provider |
| Route validation | tools test | the `/chat` branch's 400/503 arms with a stub provider; the impure fetch path stays **manual live acceptance** (the SPEC-R3 adapter precedent) |
| Standing gates | repo | `npm run check && npm test` green; descriptor trip-wire covers ALM-C4's new prop row |

**Negative control** (per the decomposition best-practice): the tree-shake gate must FAIL when the dynamic
import is hoisted to a static one — prove once by mutation during the build, don't just trust the regex.

## 6. Build sequence (the decomp's edge order)

1. ALM-C2 types → ALM-C1 projection (+ its unit gate) — pure, package-local, no behavior change.
2. ALM-C3 prop + fork + history (+ package behavior gates) → ALM-C4 descriptor row.
3. ALM-C5 `providerForModel` (+ unit gate) → ALM-C6 `/chat` branch (+ validation gate).
4. ALM-C7 runner → ALM-C8 page wiring → the site source gate + lockstep trip-wire.
5. Manual live acceptance (a real key, `npm run dev`): one live turn; a model switch mid-conversation; a
   prompt-section edit reaching the next turn; a killed network reaching the `fail` bubble.
6. Independent review (generator ≠ critic — the ADR-0131 precedent) before merge.

## 7. Out of scope (named, not silently dropped)

- Token-streaming into the note — blocked on a `ui-conversation` contract change (Q3's flag).
- `temperature`/`name` on the wire — seam widening deferred (Q1's named exclusion).
- A real tool-execution loop for Tool entries — needs parameter schemas first (ADR-0132's own deferral).
- Any `ui-settings`-to-`liveAgentConfigSchema` wiring for A2UI Chat's own surface (ADR-0135 cl.7 —
  a different surface, explicitly not this ticket).
- History trimming/summarization — dev-only, bounded by the proxy's existing `MAX_BODY`.
