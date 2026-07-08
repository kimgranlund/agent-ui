# LLD — A2A Tic-Tac-Toe Arena (agent vs agent, provable isolation)

> Status: accepted · v0.1 · 2026-07-07 · Layer: LLD (implementation plan)
> Implements: [`../spec/a2a-foundations.spec.md`](../spec/a2a-foundations.spec.md) **SPEC-R9…R13** (+ consumes SPEC-R2/R3/R6/R8 from the B1 protocol core — referenced, not re-derived). PRD trace via the SPEC: PRD-G2 (flagship), PRD-G4 (the demo page).
> Altitude: adds the **how** for the arena only; the protocol core, corpus, and bridge get their own LLDs at B1/B4/B6 ([`../prd/a2a-section.prd.md`](../prd/a2a-section.prd.md) §6). Derived from the coverage-clean intake decomposition ([`../decompositions/a2a-section.decomp.json`](../decompositions/a2a-section.decomp.json), arena region).
> Reuse (no forks): the shared A2A validator (SPEC-R6) · the loopback channel (SPEC-R8) · the a2ui live-agent **provider seam** (`providers.json` registry + adapters + dev-proxy trust boundary, ADR-0069–0073) at dev scope — see §8 layering note.
> Every upstream-protocol shape here defers to the SPEC §2 HV ledger (task states HV-5, message parts HV-4) — **all rows RESOLVED at B0 (2026-07-07); the SPEC-R1 build block is lifted**. HV-5 confirmed the `input-required` arm §3 leans on; the family pins `protocolVersion: "0.3.0"` (PRD-D3, ratification pending).

---

## 1. Component map (traceability)

| ID | Component | Implements | File (under `packages/agent-ui/a2a/` unless noted) | Scope |
|---|---|---|---|---|
| **LLD-C1** | Board + rules engine (pure) | SPEC-R9 | `src/arena/board.ts` | runtime (zero-dep) |
| **LLD-C2** | Referee turn engine (pure reducer) | SPEC-R9, R11 | `src/arena/referee.ts` | runtime (zero-dep) |
| **LLD-C3** | Transcript schema + validator | SPEC-R12, R2 | `src/arena/transcript.ts` | runtime (zero-dep) |
| **LLD-C4** | Isolation checker (canary + wire audit, pure) | SPEC-R10 | `src/arena/isolation.ts` | runtime (zero-dep — the page reuses it in-browser) |
| **LLD-C5** | Seat seam + scripted seats | SPEC-R12 | `tools/arena/seat.ts` + `tools/arena/seats/scripted.ts` | dev/CI |
| **LLD-C6** | Model seat (bounded move loop) | SPEC-R10, R11 | `tools/arena/seats/model.ts` | dev (Node) |
| **LLD-C7** | Match runner (disjoint-context composer) | SPEC-R10, R12 | `tools/arena/match.ts` | dev/CI |
| **LLD-C8** | Recorder (runner events → transcript JSONL) | SPEC-R12 | `tools/arena/record.ts` | dev/CI |
| **LLD-C9** | Match fixtures (scripted · flagship · 2 contaminated controls) | SPEC-R12, R10 | `matches/{scripted,flagship,contaminated-control,contaminated-provider-control}.match.jsonl` | committed data |
| **LLD-C10** | Arena dev proxy (live match, keys server-side) | SPEC-R13 | `tools/arena/dev-proxy-plugin.ts` (mount `/__a2a/arena`) | dev-only (`apply:'serve'`) |
| **LLD-C11** | Demo page (replay · side-by-side inspector · verdict · dev live) | SPEC-R13 | `site/a2a-tic-tac-toe.html` + `site/pages/a2a-tic-tac-toe.{ts,css}` | site |

**Split rule (SPEC-N1/N2):** `src/arena/*` is pure + zero-dep (board, referee reducer, transcript schema, isolation checker) so tests, tools, and the browser page consume ONE implementation. Everything that does I/O or touches a model/key lives under `tools/` or the site page.

## 2. The isolation model (the centerpiece — SPEC-R10)

**Construction (LLD-C7).** The runner builds each seat from primitives only — no shared objects:

```ts
interface SeatContext {                      // one per seat; NEVER passed to the other seat or the referee
  seatId: 'X' | 'O'
  systemPrompt: string                       // buildSeatPrompt(mark, canary) — composed per seat
  canary: string                             // `A2A-ISOLATION-CANARY-${seatId}-${hex128()}`
  session: { turns: Turn[] }                 // the a2ui pure-session shape; seat-local, mutated by append only
  provider: AgentProvider; model: string     // per-seat provider + model (cross-model matches are one knob)
}
```
- The two `SeatContext`s are constructed from string/enum primitives; a structural test asserts the object graphs are disjoint (no shared references) and the canaries differ — `deriveCanaryPair` (§7) asserts this at construction, fail-fast (throws on collision; deterministic derivation means there is nothing a retry loop could change).
- The **only** channel between a seat and the world is the SPEC-R8 loopback channel to the **referee**. Seats have no reference to each other, to the other's channel, or to the runner's recording taps.
- The runner (deterministic code) is the one composer that sees both contexts — solely to *record* them (LLD-C8). It never forwards content between seats; the wire audit proves nothing crossed.

**Wire shapes (closed — SPEC-R9 AC1).** All ride A2A `Message`s (parts per HV-4) with per-seat `contextId`s (HV-10):

```ts
// referee → seat (the ONLY thing a seat ever receives)
type BoardMessage = { board: (null|'X'|'O')[]     /* 9 cells */,
  yourMark: 'X'|'O', lastOpponentMove: number|null, legalMoves: number[],
  status: 'your-turn'|'illegal-retry'|'won'|'lost'|'draw'|'forfeit-win'|'forfeit-loss',
  feedback?: { code: 'ILLEGAL'|'MALFORMED'; detail: string; retriesLeft: number } }
// seat → referee
type MoveMessage = { move: number, note?: string } // note = spectator-only; NEVER relayed to the opponent
```
The opponent's *reasoning never exists on the wire*: `lastOpponentMove` is a cell index — the game-theoretic minimum shared truth. `note` renders in the demo's spectator column only; the audit fails any referee→seat message containing a foreign `note`.

**The gate (LLD-C4, pure).** `checkIsolation(transcript): IsolationFailure[]` asserts, batch + total:
1. **Canary absence** — seat A's canary appears nowhere in (a) seat B's full recorded context, (b) any wire message addressed to B; and symmetrically.
2. **Wire origin** — every seat-inbound message has `from: 'referee'`; no `seat→seat` entry exists in either direction.
3. **Closed schema** — every referee→seat body validates as `BoardMessage` with **no extra keys**, top-level AND one level into the `feedback` field (an extra key is a leak vector, not a style issue). Where referee.ts fully determines a nested string deterministically (the ILLEGAL `feedback.detail` template), the exact form is pinned too.
4. **Context provenance** — every `system` entry sits at position 0; every `user` entry byte-identically frames a referee `BoardMessage`.

**Completeness scope (review finding 1 — narrowed from the original "no extra keys"/"is its own output" wording, which read as exhaustive but wasn't):** checks 3–4 validate top-level keys plus the referee-form-pinned nested strings cheaply available from `src/arena/*` alone (the `feedback` shape + its ILLEGAL template). They do **not** content-validate free-text nested fields the referee merely relays (a MALFORMED `feedback.detail` — the seat's own unbounded raw reply, or a runner timeout message) or `assistant`-role context entries (the seat's own free-form output, which has no referee-authored form to check against). That free-text surface rides on check 1 (canary absence) only: a genuine cross-seat leak necessarily either carries a foreign canary token or deviates from a pinned form. `isolation.test.ts` carries a negative control for the nested-field leak class (a hand-edited fixture hiding opponent content in `feedback.detail`, no canary, now fails check 3).

**The recording boundary (LLD-C8 — closing the out-of-transcript class).** The four gate checks operate over the *transcript*; their soundness rests on the transcript being the whole truth about each seat's context. Two additions make that checked, not assumed:

- **Checked invariant — byte-complete recording.** A seat's recorded context is **byte-complete with respect to its actual provider request**: recording happens **at the adapter boundary** — the LLD-C8 tap wraps the provider call and records the exact request payload sent and response received — never reconstructed from the seat's session object. A standing test drives a match through a capturing provider stub and asserts recorded context ≡ the bytes the adapter actually sent; any divergence fails. Under this invariant, context injected *below* the seat seam — a hidden system preamble, shared client memory, a co-mingling logger — lands in the recorded context, where provenance check 4 (and canary check 1) fails it. The comparison covers the **full** `messages` array every call (review finding 2 — not only the current turn's last entry), so a mutation to a HISTORICAL message escapes neither the divergence check nor the transcript; the seat hands the provider a fresh per-message CLONE of its own turn history (never the live array/objects) so an in-place below-seam mutation lands on the clone, not on the seat's own ground truth.
- **Named PRECONDITION — reused-adapter statelessness.** The reused a2ui provider adapter (§8) MUST be stateless across calls: no shared mutable state, no cross-call memory, no ambient channel that re-enters a request. The disjoint-graph structural test checks the two `SeatContext` object graphs only — it says nothing about the *imported adapter module*; this precondition names that gap, and the byte-complete invariant plus negative control 2 (below) are what discharge it mechanically. If a future adapter revision grows state, those tests — not an assumption — are the trip-wire.

**The negative controls (LLD-C9 — one per leak class).**
1. **In-transcript:** `contaminated-control.match.jsonl` is the scripted fixture with one injected leak (seat X's note + canary copied into a referee→O message). The standing test asserts the gate **exits non-zero at that line** — the gate is proven to bite, not assumed (constraint C3).
2. **Out-of-transcript:** `contaminated-provider-control.match.jsonl` is a deterministic match driven through a **deliberately leaky shared provider stub** — one provider object serving both seats that co-mingles context below the seat seam (it injects seat X's canary line into seat O's outgoing request). Because recording is byte-complete at the adapter boundary, the injection surfaces in O's recorded context. The standing test **re-runs this match in-process** (offline, deterministic), asserts the freshly recorded transcript is byte-identical to the committed control, and asserts the gate exits non-zero on it — proving the out-of-transcript class is **caught, not assumed-absent**. A second, in-memory-only variant (`model-seat.test.ts`, review finding 2) exercises a leaky provider stub that mutates a HISTORICAL (non-last) request message instead of `system` — proving the full-array divergence check catches that class too, not only a system-level co-mingle.

**In-page proof (LLD-C11).** The page runs the *same* `checkIsolation` over the loaded transcript in the browser and renders the verdict badge from its result — three columns: `[ seat X full context | wire + board timeline | seat O full context ]`, every message inspectable. A viewer can falsify the claim by reading; the checker already did mechanically.

## 3. Referee turn engine (LLD-C2 — pure reducer over the task lifecycle)

State per game: `{ board, toMove, retriesLeft, phase }`; each move exchange rides the task lifecycle (HV-5): referee emits `BoardMessage` (task `input-required` toward the seat), seat answers, referee reduces:

```
awaiting(seat) --legal move--> apply → win? end(won/lost) · draw? end(draw) · else awaiting(other seat), retries reset
awaiting(seat) --illegal/malformed--> retriesLeft-- → >0: feedback BoardMessage(status:'illegal-retry') same seat
                                                      → 0: end(forfeit → opponent wins)
end(*) --> notify BOTH seats (status won/lost/draw/forfeit-*) → tasks completed (terminal, SPEC-R4)
```
Deterministic by construction: no clocks, no randomness (timeouts are the *runner's* concern — LLD-C7 maps a timeout to a `MALFORMED` reduction, so the reducer stays pure and CI-stable). Win detection: the 8 lines checked on apply; a completing move ends the game immediately (no post-win turns).

## 4. Model seat (LLD-C6 — the bounded move loop)

Mirrors `produce.ts`'s discipline without its A2UI machinery: system prompt built ONCE per match (`buildSeatPrompt(mark, canary)` — rules of the game, the exact reply grammar `{"move": n}` + optional one-line `note`, and the canary line); per `BoardMessage`: frame the board as the next user turn → ONE provider call → strip fence → parse. Parse success ⇒ `MoveMessage`; parse failure ⇒ return `{kind:'malformed', raw}` — **the referee owns the single retry bound** (SPEC-R11); there is deliberately NO nested seat-level self-correct loop (two bounds would double-count feedback and blur the transcript). Every provider in/out line is appended to the seat's own session only — recorded at the adapter boundary from the actual request/response payloads (the §2 byte-complete invariant), never reconstructed after the fact.

## 5. Transcript (LLD-C3/C8) & fixtures (LLD-C9)

JSONL: line 1 = header `{ matchId, protocolVersion (SPEC-R2 pin), seats: {X:{provider,model},O:{…}}, date, scripted: boolean }`; then ordered events: `{wire: {from,to,message}}` · `{context: {seat, entry}}` · `{game: {…}}` (applied move / feedback / end). `validateTranscript` (pure) checks shape + pin + event ordering (a `game` apply must follow the wire move it names). **Reconciled (was: "the runner never buffers the whole match"):** the runner (`match.ts`) collects the full event list in memory and `serializeTranscript`s it ONCE, after `runMatch()` resolves — the reviewer-accepted rationale is scale (a full tic-tac-toe transcript runs ~50 lines; buffering it is cheap, and both the dev proxy and the fixture generators need the complete, gate-checked transcript before they'll write or stream anything — LLD §6's "fixtures land only gate-green" posture depends on seeing the whole match first). The C10 slice is adding an `onEvent` callback hook to `match.ts` so a caller (the dev proxy) can observe events as they occur without changing this buffer-then-serialize shape; its provider `context` entries are still captured at the adapter boundary from the actual payloads (§2 byte-complete invariant) regardless of whether a caller also taps `onEvent`. Fixtures: `scripted` (CI backbone, byte-stable — two-run identity test) · `flagship` (recorded real-model match; provenance in header; isolation-gate-green required to commit) · `contaminated-control` (must-fail, in-transcript) · `contaminated-provider-control` (must-fail, out-of-transcript; regenerated in-process by its standing test — §2 recording boundary).

## 6. Dev proxy + page (LLD-C10/C11)

**Proxy** (`/__a2a/arena`, `apply:'serve'`): POST `{seats: {X:{provider,model}, O:{…}}}` → runs LLD-C7 with model seats server-side (keys via the same `loadEnv` + `providers.json` allowlist pattern as `a2ui/tools/agent/dev-proxy-plugin.ts`; the `{provider,model}` pair is allowlist-validated per seat — a crafted body cannot escape it), streams transcript events as they occur; `GET /status` = availability boolean. **Page**: static build fetches the committed flagship fixture (a plain asset — zero network beyond the site's own origin, zero keys); dev adds a "run live" control behind a `probeLive()`-style status check + `import.meta.env.DEV`-guarded dynamic import so `vite build` tree-shakes the live arm (the `live-proxy-transport.ts` pattern verbatim). Replay is a paced scrubber over transcript events; the board renders via `ui-*` controls; the three-column inspector + verdict per §2.

## 7. Error & edge handling (enumerated per case)

| Case | Stage | Handling |
|---|---|---|
| Illegal move (occupied / out-of-range) | LLD-C2 | `feedback {code:'ILLEGAL', retriesLeft}` to the SAME seat; bound default 2 (SPEC-R11) |
| Malformed model output (unparseable / missing `move`) | LLD-C6 → C2 | seat returns `malformed`; referee reduces as `MALFORMED` feedback — same single bound |
| Per-move timeout / provider error / abort | LLD-C7 | runner maps to `MALFORMED` (timeout) or forfeit-with-reason (provider hard-fail/abort); reducer stays pure |
| Retry bound exhausted | LLD-C2 | forfeit → opponent wins; both seats notified; transcript records the reason |
| Canary collision (both seats equal) | LLD-C6 (`canary.ts`) | **Reconciled (review finding 3 — the "regenerate (guard loop)" wording was stale):** `deriveCanary` is a deterministic FNV-1a derivation (SPEC-N3), not random — the SAME matchId always re-derives the SAME pair, so a regenerate loop could never converge on an actual collision. `deriveCanaryPair(matchId)` derives both and asserts `X !== O` at construction, fail-fast (throws, never silently retries); collision is fail-safe by construction — it can only ever make the isolation gate's canary check throw a FALSE-POSITIVE (a spurious "leak" when it's really the same value), never hide a real leak, so failing loudly here is strictly the safer of the two outcomes. Mixing `mark` into the seed already keeps X/O apart for any real matchId; unreachable-in-practice, but guarded, not assumed (`canary.test.ts` exercises the throw branch via an injectable test seam) |
| Transcript write failure | LLD-C8 | match aborts with an error; NO partial fixture is ever committed (fixtures land only gate-green) |
| Contaminated fixture passes the gate | LLD-C4 test | impossible-by-test: BOTH negative controls (in-transcript + out-of-transcript, §2) assert non-zero exit — a green run over either FAILS the suite |
| Out-of-transcript injection (shared provider object / hidden preamble / co-mingling logger) | LLD-C8 → C4 | byte-complete adapter-boundary recording surfaces the injection in the recorded context; provenance check 4 + canary check 1 fail it; the shared-provider negative control proves the catch |
| Recorded context diverges from the actual provider request | LLD-C8 test | the byte-complete recording assertion (capturing-stub comparison, §2) fails; divergence is a suite failure, never a warning |
| Stale/hand-edited committed fixture | LLD-C9 | standing gate re-runs `validateTranscript` + `checkIsolation` over every committed fixture at test time |
| Page fixture missing / schema-invalid | LLD-C11 | error panel ("match unavailable"), never a broken render — the a2ui `ProduceHalt` page posture |
| Draw / simultaneous-looking end | LLD-C1 | win checked before draw on the applying move; a full board with a completing move is a win, not a draw |
| Illegal task-lifecycle transition | LLD-C2 | unreachable by construction (reducer emits only table-legal transitions); asserted by the SPEC-R4 table test |

## 8. Integration & layering note (flagged for review — PRD A-2)

The model seat reuses the a2ui live-agent **provider adapters** (`packages/agent-ui/a2ui/tools/agent/providers/*` + `providers.json`) by direct import from `@agent-ui/a2a`'s `tools/` — a **dev-graph-only** cross-package edge (never `src/`, never a consumer bundle; the import-layering trip-wire governs `src` layers only). Extraction of the provider seam into a shared tools home is deliberately deferred; **trigger**: a third consumer, or the first need to ship either tools directory. If review rejects even the dev-graph edge, the fallback is mirroring the ~1-adapter surface (`AgentProvider` + `anthropic.ts`) into `a2a/tools/` — a copy with a named drift risk, which is why it is the fallback and not the recommendation.

## 9. Build sequence (dependency-ordered; each step verifiable)

1. **LLD-C1 board** — rules table complete (8 win lines, draw, illegal classes). *(checkpoint: rules unit tests exit 0)*
2. **LLD-C2 referee** — reducer over C1 + the SPEC-R4 lifecycle. *(checkpoint: alternation · feedback · forfeit · end-notification tests — SPEC-R11 AC1)*
3. **LLD-C3 transcript + LLD-C5 seats + LLD-C7 runner** — scripted match end-to-end. *(checkpoint: byte-stable two-run identity — SPEC-R12 AC1)*
4. **LLD-C4 isolation checker + LLD-C9 scripted/contaminated fixtures** — the gate + its in-transcript negative control. *(checkpoint: green on scripted, non-zero on contaminated — SPEC-R10 AC1)*
5. **LLD-C6 model seat + the §2 recording boundary** — stub-provider tests (legal / illegal-correct / forfeit / abort), the byte-complete recording assertion (capturing stub), and the out-of-transcript negative control (`contaminated-provider-control` recorded + committed, standing test red-on-it). *(checkpoint: SPEC-R11 AC1 stubbed; recorded-context ≡ actual-request assertion green; shared-provider control non-zero — SPEC-R10)*
6. **LLD-C10 proxy + LLD-C9 flagship fixture** — one real match recorded, gate-green, committed. *(checkpoint: SPEC-R12/R13; `dist/` grep clean — SPEC-N2)*
7. **LLD-C11 page** — replay + inspector + in-page verdict + dev live. *(checkpoint: SPEC-R13 AC1; browser legs green; nav drift gates green)*

**Discovered-reality rule:** if the HV-5 lifecycle or HV-4 part shapes resolve differently than §2's sketch (e.g. no `input-required` arm), repair `a2a-foundations.spec.md` §4.3 first and re-derive this file — never patch the arena around a stale SPEC.
