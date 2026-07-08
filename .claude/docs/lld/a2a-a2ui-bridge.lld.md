# LLD — A2UI-over-A2A Bridge + Artifact-Feed Demo (B6)

> Status: proposed · v0.1 · 2026-07-08 · Layer: LLD (implementation plan) · doc-review requested before ratification
> Implements: [`../spec/a2a-foundations.spec.md`](../spec/a2a-foundations.spec.md) **SPEC-R16** (+ consumes SPEC-R2 pin · SPEC-R6/N4 shared validator · SPEC-R8 `A2aChannel` loopback · SPEC-N1/N2 split/hygiene — referenced, not re-derived). PRD trace via the SPEC: **PRD-G5** (bridge); the demo surface also serves **PRD-G4**'s posture (drift-gated site section). Contract ownership: the adapter's *contract* stays the a2ui family's ([`../specs/specs/a2ui-streaming-pipeline.spec.md`](../specs/specs/a2ui-streaming-pipeline.spec.md) **SPEC-R5**) — this LLD realizes it, adds no second contract (acceptance defers to a2ui SPEC-R5 AC1, per SPEC-R16).
> Altitude: adds the **how** only. Derived from the coverage-clean decomposition ([`../decompositions/a2a-a2ui-bridge.decomp.json`](../decompositions/a2a-a2ui-bridge.decomp.json) — strict + plan mode, exit 0, 2026-07-08).
> Protocol ground truth: **SPEC §2 HV-8 (RESOLVED)** — every wire shape below cites that row; nothing is re-derived from upstream. Demo shape ratified by Kim (2026-07-08): *"a feed type of UI where we can see the messages, and some messages are A2UI artifacts (like a report as a chart or graph, etc.)."*

---

## 1. Component map (traceability)

| ID | Component | Implements | File | Scope |
|---|---|---|---|---|
| **LLD-C1** | Bridge mapping — envelope ↔ DataPart | SPEC-R16 (a2ui SPEC-R5) | `packages/agent-ui/a2ui/tools/pipeline/transports/a2a.ts` | pure, browser-safe (see §3 split note) |
| **LLD-C2** | Capabilities + extension injection | SPEC-R16 (HV-8) | same module as C1 (one file, one writer) | pure, browser-safe |
| **LLD-C3** | Bridge round-trip smoke | SPEC-R16 AC1 | `packages/agent-ui/a2ui/src/bridge/bridge.test.ts` | test (jsdom `packages` project) |
| **LLD-C4** | Recorded artifact-feed fixture | SPEC-R16 AC2 · SPEC-R2 | `packages/agent-ui/a2ui/tools/pipeline/fixtures/artifact-feed.a2a.jsonl` | committed data |
| **LLD-C5** | Standing fixture gate + negative controls | SPEC-R16 AC2 | `packages/agent-ui/a2ui/src/bridge/feed-fixture.test.ts` | test (Node fs, test-only) |
| **LLD-C6** | Feed derivation lib (no DOM) | SPEC-R16 AC2 | `site/lib/artifact-feed.ts` (+ `site/lib/artifact-feed.test.ts`) | site |
| **LLD-C7** | Artifact-feed page | SPEC-R16 AC2 | `site/a2a-artifact-feed.html` + `site/pages/a2a-artifact-feed.{ts,css}` (+ `.browser.test.ts`) | site |
| **LLD-C8** | Integration + doc re-sync (serial) | SPEC-N1/N2 posture · context-is-memory | `site/main.ts` · `site/pages/_page.ts` · `packages/agent-ui/a2ui/package.json` · a2ui streaming-pipeline LLD rows | shared files — one serial slice |

## 2. The blocker re-judgment (PRD §4 A-3 — resolved: the double block has dissolved)

PRD A-3 recorded B6 as blocked on a2ui streaming-pipeline **LLD-C1 (JSONL codec)** and **LLD-C3 (transport abstraction)**, both unbuilt. Re-examined at B6 intake against the shipped tree:

1. **The producer exists.** The streaming family's LLD-C2 (generation pipeline driver) was realized by the live-agent wave: `packages/agent-ui/a2ui/tools/agent/produce.ts` — its own header reads *"the bounded runtime loop (streaming LLD-C2 realized)"* — generate → validate → self-correct, bounded, validate-then-stream. The bridge carries what this loop (or a recording of it) emits.
2. **The JSONL codec is not on the bridge's path.** HV-8's resolution pins the carriage: *"Each A2UI envelope (e.g., `updateComponents`) corresponds to the payload of a single A2A message Part."* One envelope per `DataPart`, as **structured JSON** — no line framing exists on the A2A wire, so a JSONL codec module has nothing to do here. Consumer-side, the shipped renderer host already ingests per-line (`host.ingest(line)`): unwrapping a DataPart is `JSON.stringify(part.data)` at the seam — a serialization call, not a codec. Producer-side healing already happened inside `produce()` before anything streamed; DataParts carry post-validation structured data, never raw model text.
3. **The transport abstraction is not on the bridge's path.** The carrier is `@agent-ui/a2a`'s own shipped channel contract (SPEC-R8: loopback in `src/channel/loopback.ts`, HTTP under `tools/http/`), order-gated by SPEC-N5. The a2ui `Transport` interface (streaming LLD-C3) was that family's plug-adapter seam; a2ui SPEC-R5's *observable* contract — capabilities in `Message.metadata`, order preserved — is checkable without it. If the a2ui family later builds LLD-C3, this module already has the right shape to slot behind it (§3's `wrap`/`unwrap` are exactly a `Transport.send`/`receive` core).

**Consequences:** B6 proceeds on shipped surfaces. PRD A-3 + §6 B6 + the PRD-G5 metric note are repaired in this change (same-commit doc repair); the a2ui streaming-pipeline LLD's C2/C5 rows are re-synced (C2 → realized-by pointer; C5 → "design landed here, build at B6"). What would RE-block B6: nothing currently named — the remaining dependencies (a2a channel, `validateA2ui`, `createRenderer`, the default catalog) are all committed and gated.

## 3. Bridge mapping — LLD-C1/C2 (the SPEC-R16 realization; every shape cites HV-8)

**Home (PRD-D2, ratified):** `a2ui/tools/pipeline/transports/a2a.ts` — the exact path the a2ui streaming LLD-C5 planned, with the ratified cross-package edge a2ui-tools → `@agent-ui/a2a`. **Split note (SPEC-N1/N2):** the module is pure and browser-safe — type-only imports from `@agent-ui/a2a`, zero runtime imports, no Node builtins — because the static-built feed page consumes it (the `tools/agent/recorded-transport.ts` precedent: tools modules that are pure data/logic ARE site-bundleable; the never-in-a-consumer-bundle rule guards the package *barrel*, which does not export this). It never enters `@agent-ui/a2ui`'s `src/index.ts`.

```ts
// tools/pipeline/transports/a2a.ts — type-only imports both ways; zero runtime deps
import type { A2uiServerMessage } from '../../../src/protocol.ts'
import type { A2uiClientMessage } from '../../../src/renderer/renderer.ts' // lives in renderer.ts (:79), NOT protocol.ts — review-verified split import
import type { A2aMessage, A2aDataPart, A2aPart } from '@agent-ui/a2a'

/** HV-8 (v1.0 extension): the DataPart tag + the extension URI — cited constants, never re-derived. */
export const A2UI_MIME = 'application/a2ui+json'
export const A2UI_A2A_EXTENSION_URI = 'https://a2ui.org/a2a-extension/a2ui/v1.0'

/** HV-8: the capabilities value is VERSION-KEYED; this family speaks A2UI v1.0 (catalog.json pin), so the
 *  key is "v1.0" with required supportedCatalogIds. Default catalog id: 'agent-ui'. */
export interface A2uiClientCapabilities {
  'v1.0': { supportedCatalogIds: string[] }
}

// — carriage (LLD-C1): one envelope per Part, tagged —
export function envelopeToPart(msg: A2uiServerMessage | A2uiClientMessage): A2aDataPart
  // { kind: 'data', data: msg, metadata: { mimeType: A2UI_MIME } }
export function partToEnvelope(part: A2aPart): A2uiServerMessage | A2uiClientMessage | undefined
  // undefined for any part not kind:'data' or not mimeType-tagged (foreign parts tolerated, never thrown)

/** Wrap an ordered server→client A2UI sequence as ONE A2A agent message (one DataPart per envelope,
 *  order = parts order) with the extension URI declared. Optional prose rides as a leading TextPart. */
export function wrapServerTurn(msgs: A2uiServerMessage[], opts: { messageId: string; taskId?: string; contextId?: string; prose?: string }): A2aMessage

/** Unwrap an A2A message back to its ordered envelopes (tagged DataParts only, parts order preserved). */
export function unwrapTurn(msg: A2aMessage): { envelopes: (A2uiServerMessage | A2uiClientMessage)[]; prose: string[]; foreignParts: number }

// — capabilities (LLD-C2): HV-8 — "placed in the metadata field of EVERY A2A Message sent from the
//   client to the server". The builder is the ONLY way bridge code composes a client→server message.
export function wrapClientTurn(payload: { text?: string; message?: A2uiClientMessage },
  opts: { messageId: string; taskId?: string; contextId?: string; caps?: A2uiClientCapabilities }): A2aMessage
  // role:'user' · kind:'message' · metadata: { a2uiClientCapabilities: caps ?? DEFAULT_CAPS } ·
  // extensions: [A2UI_A2A_EXTENSION_URI] · parts: TextPart (text) and/or tagged DataPart (message)
export const DEFAULT_CAPS: A2uiClientCapabilities // { 'v1.0': { supportedCatalogIds: ['agent-ui'] } }
```

Invariants: `unwrapTurn(wrapServerTurn(msgs, o)).envelopes` deep-equals `msgs` in order (round-trip); `wrapClientTurn` output always carries the caps key (there is no caps-less code path — the HV-8 "every message" clause is enforced by construction, not by call-site discipline).

## 4. Round-trip smoke — LLD-C3 (SPEC-R16 AC1; defers to a2ui SPEC-R5 AC1)

`src/bridge/bridge.test.ts` (tests live under `src/` — the vitest `packages` include is `src/**/*.test.ts`; the live-agent family's `src/live-agent/*.test.ts`-over-`tools/agent/*` precedent):

1. **Baseline:** take a committed A2UI sequence (an `@agent-ui/a2ui/examples` seed — already validator-clean by its own gate).
2. **Carry:** `wrapServerTurn` → send over a `createLoopbackPair()` pair (`@agent-ui/a2a`, SPEC-R8 — the shipped export returns `[A2aChannel, A2aChannel]`: send on one end, receive on the other; no bare `createLoopback` exists) → `unwrapTurn`.
3. **Assert:** decoded sequence deep-equals the baseline in order (SPEC-R16 AC1's "identical to the loopback baseline"); `validateA2ui(decoded, catalog)` is clean; every `wrapClientTurn` message carries `metadata.a2uiClientCapabilities` keyed `'v1.0'` with `supportedCatalogIds` including `'agent-ui'` (a2ui SPEC-R5 AC1) and the extension URI in `extensions` (HV-8).
4. **Negative legs:** a hand-built client message WITHOUT the caps key fails the same assertion helper (proves the check bites); a foreign part (plain TextPart, untagged DataPart) is skipped with `foreignParts` counted — never a throw (SPEC-R6's total-validator posture applied to the seam).

## 5. Recorded artifact-feed fixture — LLD-C4 (the demo's substrate; SPEC-R2 pin)

**File shape** (`artifact-feed.a2a.jsonl`, byte-stable JSONL — the `matches/*.jsonl` discipline):

```
line 1   {"a2aFeed":{"protocolVersion":"0.3.0","a2ui":"v1.0","provenance":{"source":"authored","date":"…"}}}
line 2+  one A2A Message per line (kind:'message'; role 'user' | 'agent'; contextId constant across the feed)
```

**Conversation content — composed ONLY from the existing catalog (vocabulary honesty):** the catalog has **no Chart type** (members: Text · Button · TextField · … · List · Grid; see `catalog.json`). Kim's "report as a chart or graph" is realized with what exists; the Chart gap is **named, not designed** (§10). Three exchanges, two artifact classes:

1. *user:* "Show me the Q2 revenue report." (`wrapClientTurn` — caps metadata visible) → *agent:* TextPart prose + DataParts for a **metric-tile report**: `Card`/`CardHeader`/`CardContent` + `Grid` of metric tiles with `Text` deltas — the shipped `stats-grid-dashboard` seed idiom (`src/examples/catalog-coverage.ts`), plus a `Button` ("Refresh data", `action`) so §7's interaction teaching has a live control.
2. *user:* "Break revenue down by region." → *agent:* prose + a **List-templated report table** over `updateDataModel` rows (the `dynamic-lists` seed idiom) — the "report table" artifact class.
3. *user/agent:* one prose-only exchange (no DataPart) — proves the feed renders MIXED messages, not artifact-only.

Every artifact message: one envelope per tagged DataPart (HV-8 carriage), unique `surfaceId` per artifact message (one renderer host each, §7). The fixture is hand-authored via the C1 builders inside a generation script or directly as JSONL — either way the standing gate (§6), not authorship, is the correctness authority.

## 6. Standing fixture gate — LLD-C5 (the gate that keeps the fixture true)

`src/bridge/feed-fixture.test.ts` (fs read of the committed fixture — test-only Node use, the `corpus-data.test.ts` precedent). Assertions per run:

| # | Assertion | Reuses |
|---|---|---|
| 1 | header pins `0.3.0` + `v1.0`; unsupported pin → the loader's coded failure, not a throw | SPEC-R2 |
| 2 | every line `validateA2a(msg, { protocolVersion: '0.3.0' })` clean | SPEC-R6 (no fork) |
| 3 | every `kind:'data'` a2ui part carries `metadata.mimeType === A2UI_MIME` | HV-8 via C1 constants |
| 4 | per artifact surface: unwrapped envelope sequence `validateA2ui`-clean against the default catalog | a2ui shared validator (SPEC-N3 parity posture) |
| 5 | every `role:'user'` message carries the HV-8 caps key, `'v1.0'`-keyed, `supportedCatalogIds ⊇ ['agent-ui']` | C2 |
| 6 | byte-stability: `JSON.stringify(JSON.parse(line)) === line` for every line | house JSONL discipline |
| 7 | **negative controls (test-local mutations, one per failure class):** untagged a2ui DataPart · invalid a2ui payload (unknown component type) · caps-less user message · wrong pin — each MUST fail its assertion | gate-bites doctrine |

## 7. Feed derivation + page — LLD-C6/C7 (the centerpiece: the artifact feed)

**LLD-C6 derivation lib** (`site/lib/artifact-feed.ts` — no DOM; the `arena-replay.ts` derivation-vs-page split, so the drift tests assert it directly):

```ts
export type LoadedFeed = { ok: true; entries: FeedEntry[]; verdict: FeedVerdict } | { ok: false; reasons: string[] }
export interface FeedEntry {
  readonly index: number
  readonly role: 'user' | 'agent'
  readonly prose: string[]                          // TextParts
  readonly artifact?: { surfaceId: string; lines: string[] }   // unwrapped envelopes, re-serialized for host.ingest()
  readonly handshake?: Record<string, unknown>      // metadata.a2uiClientCapabilities, when present (user turns)
  readonly wire: string                             // the raw line — the inspector's source of truth
}
export interface FeedVerdict { clean: boolean; checks: { name: string; failures: string[] }[] }
export function loadFeed(raw: string): LoadedFeed   // pin + validateA2a + unwrap-via-C1 + validateA2ui — the SAME
                                                    // checks §6 runs, computed IN-PAGE (never a hardcoded badge)
```

**LLD-C7 page** (`a2a-artifact-feed.{html,ts,css}` + browser leg) — a **separate page**, not an arena section (§10 fork 1): the arena's centerpiece is the isolation proof; this page's is the bridge. Anatomy:

- **Timeline** of `.msg` bubbles (the `a2ui-live.ts` chat-log idiom): `prose` → text bubbles; `artifact` → an agent bubble whose body is a live mount — **one `createRenderer()` host per artifact message** (the ADR-0097 per-message-host lifecycle precedent: create → `ingest(line)` per envelope → `finalize()` → `dispose()` on reset). `applyRootStretch` on the mount so a root layout fills the bubble.
- **Handshake chip** on user bubbles carrying `handshake`: a small "capabilities ▸" disclosure expanding to the wire JSON — the HV-8 teaching surface, visible on EVERY client→server message because the fixture was composed through C2.
- **Wire inspector:** each bubble's "wire ▸" disclosure shows `entry.wire` pretty-printed (the JSON-tab idiom, per-message).
- **Verdict line** above the timeline, driven by `loadFeed(...).verdict` — the same-gate-in-page posture (SPEC-R13's discipline, reused not re-owned).
- **Stepping:** Prev/Next cursor over entries (arena scrubber idiom). Entries ≤ cursor are visible; an artifact host is created **once**, on first reveal, then kept (hidden via `[hidden]` when stepping back) — never re-ingested (§8 edge).
- **Interaction (compose, don't send):** an artifact control's `onClientMessage` → `wrapClientTurn` (C2) → appended as a user bubble labeled *"composed locally — not sent (recorded demo)"*, handshake chip included. The round-trip made visible with zero network: what WOULD go on the wire, capabilities and all.
- **Live-arm seam (structure only, this wave ships none of it):** the page consumes `loadFeed(raw)` where `raw` is a Vite `?raw` static import of LLD-C4. A future live arm replaces `raw` with a dev-proxy response (`probeLive()` + dynamic `import()` under `import.meta.env.DEV` — the a2ui-live/arena overlay pattern, named here so the build wave doesn't invent a second posture). Nothing else in the page changes — that is the whole seam.

**Artifact vocabulary ruling (recorded, review-flagged):** artifact bubbles render the **full default catalog** under the renderer's own security allowlist (a2ui runtime SPEC-R9) — the ADR-0097 `FEED_SURFACE_TYPES` policy is **not** adopted here. That partition governs feed-embedded **asks** (commit-gated questions; its `Grid`/`List` exclusions exist precisely to keep dashboards out of ask bubbles). This feed's artifacts ARE the reports/dashboards Kim asked for — adopting the ask policy would exclude the demo's centerpiece. The two policies stay distinct because the two surfaces answer different questions (§10 fork 3 records the recommendation).

## 8. Error & edge-case handling

| Edge / failure | Stage | Handling |
|---|---|---|
| foreign part (untagged data / text / file) in a turn | C1 `unwrapTurn` | skipped + counted (`foreignParts`); prose TextParts routed to `prose`; never a throw |
| client→server message without caps | C2/C3/C5 | unbuildable via `wrapClientTurn` (by construction); hand-built one fails the smoke + gate negative legs |
| fixture pin unsupported | C5/C6 | coded failure surfaces as gate fail / page error panel (SPEC-R2's never-silently-proceed) |
| invalid a2ui payload inside a DataPart | C5/C6 | `validateA2ui` failures → gate red; in-page → `ok:false` reasons → error panel (arena `loadTranscript` precedent), no partial render |
| a2ui-invalid line mid-feed vs whole-feed | C6 | whole-feed fail-closed: `loadFeed` returns `ok:false` — a curated fixture is either presentable or not (no half-trusted demo); the renderer's own per-line fault isolation is for LIVE streams, not curated replays |
| artifact `surfaceId` reused across messages | C5 | gate assertion (unique per artifact message) — one host per bubble stays well-defined |
| stepping back then forward | C7 | hosts persist, toggled `[hidden]`; ingest happens exactly once per artifact (guard: host map keyed by entry index) |
| reset / re-load | C7 | every host `dispose()`d before the map clears (the a2ui-live reset discipline — no leak) |
| interaction on a recorded feed | C7 | composed message displayed, never transported; no network path exists in the built page |
| empty feed / header-only fixture | C6/C7 | `ok:true` with zero entries renders the empty-state line, not a crash |
| `dist/` hygiene | C8 | grep for proxy mounts/key names stays clean (SPEC-N2); the live seam is dynamic-import + DEV-guarded only |

## 9. Build sequence (fan-out-sliced; each step verifiable)

One writer per file; shared files (`main.ts`, `_page.ts`, `package.json`) deferred to the serial integration slice; every new gate lands WITH its firing negative control.

1. **S0 — PREP (serial):** LLD-C1/C2 mapping module + the `@agent-ui/a2a` devDependency line in a2ui's `package.json`. *(checkpoint: `npm run check` green over the new edge — decomp n1a/n1b/n5-a20)*
2. **S1 — fan-out (3 writers, no shared files):** LLD-C3 smoke ‖ LLD-C4+C5 fixture + standing gate ‖ LLD-C6 derivation lib + jsdom tests. *(checkpoints: SPEC-R16 AC1 leg green; gate green over the fixture AND red over each negative control; lib tests green — n2 · n3a/n3b · n4a/n4b)*
3. **S2 —** LLD-C7 page (+css/html). *(checkpoint: recorded replay renders under `vite dev` with network disabled — n4c)*
4. **S3 —** browser leg. *(checkpoint: `npm run test:browser` green on the new file — n4d)*
5. **S4 — INTEGRATION (serial):** nav card (`main.ts` A2A cluster) + `_page.ts` link + site canon/TOC gate re-sync + `vite build` && dist grep + full `npm run check && npm test` + `test:browser` + the a2ui streaming-pipeline LLD row flips (C2 → realized-by `tools/agent/produce.ts`; C5 → realized-by this wave's module). *(checkpoint: all gates green repo-wide — n5/n6)*

## 10. Open forks (awaiting Kim — firm recommendations; none blocks S0–S1)

| # | Fork | Recommendation | Why |
|---|---|---|---|
| 1 | Separate `a2a-artifact-feed` page vs a section on the arena page | **Separate page** | One proof per page (arena = isolation, feed = bridge); the A2A nav cluster takes a third card; the arena page's fixture discipline (match transcripts) and this one's (A2A message feed) don't share a loader. |
| 2 | The Chart gap | **Ship with existing vocabulary now; open a `Chart`/`Sparkline` follow-up intake** (components fleet + catalog + corpus + feed-policy disposition — its own PRD-level intake, not a rider on B6) | The catalog has no Chart type; metric-tile Grid reports + List tables honestly cover "report" today; designing a chart component inside a bridge wave would be scope theft from a real component-family effort. |
| 3 | Artifact-bubble vocabulary: full catalog (renderer allowlist) vs the ADR-0097 ask-feed subset | **Full catalog** | The ask partition's exclusions (Grid/List = "dashboards out of the feed") are ask-specific; this feed's artifacts ARE the dashboards. Asks stay governed by ADR-0097 unchanged. |

## 11. Verification summary

Done when: `coverage_check` clean (it is — strict/plan, exit 0) · S0–S4 checkpoints green · SPEC-R16 AC1 (smoke) + AC2 (feed surface, pending the widening's doc-review) hold · `trace_check` over the family reports zero UNIMPLEMENTED SPEC rows · the §2 repairs landed in the owning docs. NOT done if: the fixture gate ships without its firing negative controls, the page hardcodes a verdict, or any doc row still calls a shipped module "unbuilt".
