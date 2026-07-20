# SPEC — a2ui-chat: the conversational agent surface

> Status: proposed · v0.1 · 2026-07-11 · Layer: SPEC (execution contract)
> Refines: TKT-0020 (`../tickets/tkt-0020-a2ui-chat.md`) under the acceptance list it states directly (Kim's
> goal directive, 2026-07-11).
>
> **No owning PRD — a deliberate, acknowledged deviation, the `a2ui-message-lifecycle` / `ui-toolbar` /
> `ui-theme-provider` precedent**: TKT-0020 is a scoped teaching+demo INTEGRATION effort (composing already-
> shipped surfaces) whose problem statement and acceptance already live in the ticket itself (a TICKET
> carrying its own Summary/Acceptance/Links per its own type contract). Known, deliberate gap: the SPEC↔PRD
> uplink harness check fails on this file by construction; recorded as a reviewed deviation, not a silent
> miss.
>
> Cites (never restates): [`a2ui-message-lifecycle.spec.md`](./a2ui-message-lifecycle.spec.md) (SPEC-R1…R5 —
> the four-type decision rules this surface proves at product scale), `agent-app-surfaces.prd.md`'s **PRD-D2**
> (`../prd/agent-app-surfaces.prd.md` — the host-chrome/untrusted-mount boundary law that INFORMS this SPEC's
> placement call, without this SPEC belonging to that PRD's own `@agent-ui/app` tier), and ADR-0073/ADR-0088/
> ADR-0097 (the transport/note/ask machinery this surface reuses verbatim, forks none of it).
>
> Refined by: [`../lld/a2ui-chat.lld.md`](../lld/a2ui-chat.lld.md). Build plan:
> [`../decompositions/a2ui-chat.decomp.json`](../decompositions/a2ui-chat.decomp.json) (coverage-clean, plan
> mode).
>
> Altitude: owns **the site page's anatomy** (chat-log structure, per-surface inline rendering, narration,
> disclosure, live-arm posture) and **its reuse boundary** (what it composes vs forks). Transport/session/
> transcript mechanics stay `a2ui-live`'s already-shipped machinery (cited, not forked); renderer mechanics
> stay the runtime SPEC's; message-type choice stays `a2ui-message-lifecycle.spec.md`'s. Requirement IDs
> file-scoped (`SPEC-R1…`).

---

## 1. Purpose

TKT-0013 named `a2ui-chat` as `ui-status-stream`'s eventual consumer ("display in real time what the system
is working on… chain of thought/reasoning/action/tool-use… as it is occurring"); TKT-0016 named it as a
possible embryo of the message-lifecycle demo, deliberately left uncoupled ("flag, don't couple"). Both
pieces — the live narration surface and the four-type lifecycle decision layer — are now shipped in full.
This SPEC is the coupling point, deliberate this time: a conversational agent surface where a user's dialog
is visible end-to-end — the agent's narration streams live as its turn proceeds, and the resulting A2UI
surfaces render inline in the log, exercising the real renderer's full lifecycle
(`a2ui-message-lifecycle.spec.md` SPEC-R1) at product scale, not a debug harness's.

## 2. Definitions

- **Turn** — one exchange (`Session.turns`, `agent-transport.ts`): a user message, or the agent's reply (an
  `AgentTransport.turn()` stream — a leading `note` meta-line, an optional `TurnTrace`, then zero or more
  validated A2UI lines, ADR-0088).
- **Surface bubble** — the chat-log element a `createSurface` line's OWN turn anchors. A later turn's
  `updateComponents`/`updateDataModel`/`deleteSurface` line targeting the SAME `surfaceId` updates that
  bubble in place, wherever in scroll history it sits — it never spawns a second bubble for the same surface.
- **Narration** — the `ui-status-stream` entries appended/updated for the duration of one agent turn,
  summarizing the mechanical shape of what that turn emits — never a fabricated reasoning trace (SPEC-N5).

## 3. Requirements

### 3.1 Placement & reuse boundary

**SPEC-R1 — A site page, not a new package or control.** `a2ui-chat` ships as `site/pages/a2ui-chat.ts` (+
`site/a2ui-chat.html`, the MPA-entry precedent every sibling A2UI demo page already uses), reusing
`a2ui-live`'s transport/session/transcript/meta-line machinery via the existing `site/lib/agent-runtime.ts`
shim. It is **NOT an extension of `a2ui-live.ts`** — that page's split chat+Canvas/JSON/HTML-tab anatomy is a
deliberate wire-DEBUG harness (its own header calls it exactly that); `a2ui-chat`'s anatomy (§3.2) is a
different, product-shaped single-log surface serving a different reader. It is **NOT a new `@agent-ui/app`
primitive** — the reusable "conversation surface" is `agent-app-surfaces.prd.md` PRD-D1's own named future M2
flagship item, explicitly out of THIS ticket's non-goals ("no new controls" — a page composing shipped
pieces is the ticket's own named lighter default). This SPEC takes no dependency on that future primitive and
makes no design concession toward it (the TKT-0016 "flag, don't couple" precedent, reapplied — the same
posture TKT-0016 itself took toward this very ticket).
- **AC1** *Given* the shipped diff, *when* inspected, *then* `site/pages/a2ui-chat.ts` imports zero new
  protocol/wire types — every A2UI shape it touches is `RendererHost`/`A2uiServerMessage`/`A2uiClientMessage`
  from `@agent-ui/a2ui`, unchanged.
- **AC2** *Given* the shipped diff, *when* inspected, *then* no edit lands in
  `packages/agent-ui/a2ui/src/protocol.ts`, any `renderer/*.ts`, or `packages/agent-ui/components/**`.

### 3.2 Chat-log anatomy

**SPEC-R2 — One scrolling log; per-surface inline bubbles.** The page is a SINGLE scrolling chat log (not
`a2ui-live`'s two-pane chat+canvas split): a user turn is a prose bubble; an agent turn appends its own
bubble carrying, in order, (a) a `ui-status-stream` narration region for the turn's duration (SPEC-R5), (b)
the turn's `note` as prose (the ADR-0088 mechanism, unchanged), and (c) — only on the turn whose stream
contains that surface's OWN `createSurface` line — a freshly mounted inline A2UI surface (its own
`createRenderer()` host, mounted into a fresh element inside THAT turn's bubble — the ADR-0097 §2 per-ask-
host lifecycle generalized from asks to every surface, SPEC-R3).

**SPEC-R3 — Persistent surface identity across turns.** A later turn's `updateComponents`/
`updateDataModel`/`deleteSurface` line targeting a `surfaceId` an EARLIER turn already created MUST route to
THAT surface's own already-mounted host (found via a `surfaceId → {host, mount, bubble}` registry, keyed the
same way `site/lib/ask-registry.ts`'s already-shipped `surfaceIdOf()` parses an envelope) and update it in
place at its ORIGINAL bubble — never a second, duplicate mount for the same `surfaceId`, and never routed
into the newest turn's own bubble instead.
  - *Rationale (a forced consequence of shipped mechanics, not a taste choice).* `RendererHost.mount(rootEl)`
    attaches every surface's rendered root as a sibling DOM child under the SAME single `rootEl`
    (`renderer/renderer.ts` — `#attachRoot`'s `this.#mountEl.appendChild(root)`): one host owns exactly one
    mount point, by construction. A chat log wanting surface X's DOM anchored at turn X's own bubble — a
    different DOM location than surface Y's bubble — therefore needs one host+mount PER SURFACE, not one
    host for the whole session (`a2ui-live.ts`'s existing model, where every surface is a sibling under ONE
    shared canvas). This is exactly the per-surface-host lifecycle `site/lib/ask-registry.ts` already proves
    for feed-embedded asks (ADR-0097 §2) — generalized here to every surface a turn creates, not only ones
    flagged as an "ask" (see Non-goals — the `ask`/`AskDeclaration` mechanism itself is not reused).
  - **AC1** *Given* turn 2 creates surface `"confirmation"` and turn 3 sends `updateComponents` for
    `"confirmation"`, *when* turn 3 is ingested, *then* `"confirmation"`'s rendered DOM changes in place
    inside turn 2's bubble, and turn 3's own bubble carries no surface mount.
  - **AC2** *Given* two surfaces are open at once (e.g. `"canvas"` and `"confirmation"`), *when* either
    updates, *then* the other's rendered DOM and bubble are untouched.

**SPEC-R4 — Deletion is visible in place.** A `deleteSurface` line MUST remove that surface's rendered DOM
(via that surface's own host) AND leave a visible annotation on its original bubble marking it closed (the
`ask-registry.ts` `freeze()` + `a2ui-live.ts` `annotateAskFrozen()` precedent, generalized to a single
`'closed'` state) —
never a silent, unexplained disappearance from a history the user cannot re-scroll to confirm.
  - **AC1** *Given* the shipped `recordedTranscript`'s turn 5 (`deleteSurface:"confirmation"`), *when* it
    plays, *then* `"confirmation"`'s bubble shows no rendered surface content but DOES show a "closed"
    annotation, while `"canvas"`'s bubble (turn 1, never deleted) is unaffected.

### 3.3 Live narration

**SPEC-R5 — Turn-duration narration via `ui-status-stream`, honestly sourced.** For each agent turn, before
its lines are known, append a narration region (a `ui-status-stream`) and drive its `appendEntry`/`update`/
`finalize` API (never authored markup, never a bespoke live region) with entries reflecting only VERIFIABLE
facts about that turn: which message-type category is about to render (derived the same way `a2ui-live.ts`'s
`summarize()` already inspects a line's own envelope key — never invented prose) and, when a `TurnTrace`
accompanies the turn (ADR-0088 §2 — populated by the live arm; absent on the shipped recorded transcript),
the real retrieval/self-correct facts it carries (`exemplarIds`, `rounds`, `healed`, `model`). `finalize()`
runs once the turn's stream ends — successfully or by throwing — satisfying the same completion invariant
`ui-status-stream` itself already guarantees (`timeline-family.spec.md` SPEC-R11).
- **AC1** *Given* the recorded transport (no `TurnTrace`), *when* a turn plays, *then* its narration entries
  name only the message-type category the turn's own lines contain (e.g. "Opening a new surface…", "Updating
  data…") — never a sentence the model did not verifiably produce.
- **AC2** *Given* the live transport (a real `TurnTrace` on the turn's meta-line), *when* the turn plays,
  *then* its narration additionally surfaces `exemplarIds`/`rounds`/`healed`/`model` from that SAME trace
  object — never a re-derived or duplicated fact.
- **AC3** *Given* any turn, *when* it completes (successfully or by throwing), *then* `finalize()` is called
  exactly once on that turn's narration stream — no entry is left `pending`/`active` after the turn ends.

**SPEC-R6 — Two independently owned scroll regions.** The outer chat log owns ITS OWN scroll (tail-follows
to the newest bubble — the `a2a-artifact-feed.ts`/`a2ui-live.ts` reveal/tail-follow precedent); each embedded
`ui-status-stream` owns ONLY its own bounded internal scroll region (`status-stream.css`'s `overflow-y: auto`
+ `--ui-status-stream-max-block-size`). The one-owned-scroll-region law applies at TWO nested, independent
scopes here, not in conflict — `ui-status-stream` is already built as a bounded, embeddable island
(`status-stream-demo.ts` is the existing single-region precedent this SPEC nests one level deeper).
- **AC1** *Given* the outer log is scrolled up to read history while an embedded `ui-status-stream` is still
  narrating, *when* either region receives new content, *then* each region's own stick-to-bottom guard
  tracks only its own `scroll` events — neither region's follow state affects the other's.

### 3.4 The wire, disclosed

**SPEC-R7 — Per-turn wire disclosure.** Each bubble carries a collapsed `<details>` disclosure of its own
raw envelope(s) (the `a2a-artifact-feed.ts` `disclosure()` idiom, reused verbatim) — the demo-IS-the-
integration-proof, honest-labels site discipline extended from the feed/live pages to this one.
- **AC1** *Given* any bubble, *when* its disclosure is opened, *then* every line that turn's transport
  actually emitted is inspectable as real JSON — narration-covered or not, nothing is hidden.

### 3.5 The live arm

**SPEC-R8 — Recorded-default; live optional, reusing the existing overlay wiring verbatim.** The page's
default transport is `createRecordedTransport()` (ADR-0073's recorded-default posture); a dynamic import
probes `/status` at runtime and, if a live provider is available, wires a live provider transport + the
existing switcher component — the SAME pattern `a2ui-live.ts`'s `wireLiveOverlay()` already ships. As of
**ADR-0151**, this probe resolves in every environment, not only dev: the production build ships against a
Cloudflare Worker port of the dev proxy (`/__a2ui/agent`), so a configured Workers Secret makes the live arm
reachable from the deployed site too. `a2a-artifact-feed.ts`'s `wireFeedLiveOverlay()` is explicitly OUT of
ADR-0151's scope and stays hard-gated to dev only (`if (!import.meta.env.DEV) return`) — no new transport,
no new provider code, no new switcher component either way.
- **AC1** *Given* the static production build, *when* its output is inspected, *then* it contains no key
  LITERAL or key VALUE anywhere — the live-proxy-transport module and switcher DO ship in `dist/` (ADR-0151
  reachability, not a tree-shake target), and the module resolves its live/recorded posture via a same-origin
  `/status` fetch, never a build-time env inline.
- **AC2** *Given* no live provider key configured (dev: no `.env` entry; production: no Workers Secret set),
  *when* the page loads, *then* the recorded demo functions fully offline / under CI with the live probe
  resolving `available: false` and no live call ever attempted.

### 3.6 Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | No protocol/wire change | Zero edits to `protocol.ts`, `renderer/dispatch.ts`, `renderer/renderer.ts`, `renderer/tree.ts` (TKT-0020 non-goal). |
| **SPEC-N2** | No chat framework | Reuses `a2ui-live`'s transport/session/meta-line machinery verbatim via `agent-runtime.ts`; no new conversational engine, session model, or transport type (TKT-0020 non-goal). |
| **SPEC-N3** | No new `ui-*` control | Composes `ui-status-stream`, `@agent-ui/a2ui`'s renderer, and plain page chrome only; a genuine gap surfaces as its own component ticket (the ADR-0102 routing law), never a bespoke control built inline. |
| **SPEC-N4** | Reuse the shipped transcript verbatim | The demo plays `recordedTranscript` (`transcript.ts`) unmodified — no second/new transcript authored; the four-type lifecycle arc it already carries (TKT-0016/ADR-0126) is the proof this SPEC integrates at product scale. |
| **SPEC-N5** | Narration honesty | No narration entry states a fact the turn did not verifiably produce (ADR-0088's confabulation guard, applied to `ui-status-stream` content, not only chat prose). |

---

## 4. Non-goals (explicit fences)

- **A chat framework, session model, or new transport type.**
- **Protocol/wire changes of any kind.**
- **A new `ui-*` control** — a real gap becomes its own ticket (ADR-0102 routing law), never built inline.
- **A reusable `@agent-ui/app` conversation-surface primitive** — `agent-app-surfaces.prd.md` PRD-D1's own
  named future M2 item; flagged here (§7), not coupled to, per the TKT-0016 "flag, don't couple" precedent.
- **Corpus admission of any exemplar** — unrelated; TKT-0016 already owns that standing follow-up.
- **Rebuilding or extending the feed-embedded-ask mechanism** (`AskDeclaration`/ADR-0097). SPEC-R3's per-
  surface registry generalizes the SAME per-ask-host lifecycle to every surface, so no turn needs to be
  specially flagged as an "ask" for its surface to render inline — the `ask` meta-field itself stays unused
  (the shipped transcript carries none, per `transcript.ts`'s own comment: "the SHIPPED transcript below
  carries no `ask`").
- **Multi-provider UI beyond the existing switcher** (ADR-0073) — no new provider, no new registry row.

## 5. Examples

Illustrative (normative for shape, not exhaustive) — the shipped `recordedTranscript` (`transcript.ts`)
canvas/confirmation arc, mapped to the bubble/mount/annotation behavior this SPEC requires:

| Turn | Transcript content (verbatim) | Required bubble/mount/annotation behavior |
|---|---|---|
| 1 | `createSurface:"canvas"` + Button | A new bubble; a new mount; registers `canvas` |
| 2 | `createSurface:"confirmation"` + Column/Text | A new bubble (turn 2's own); a new mount; registers `confirmation` |
| 3 | `updateComponents:"confirmation"` (restructure) + a trailing `updateDataModel:"/status"="Ready"` in the SAME turn | NO new bubble — updates turn 2's existing mount in place; narrates BOTH categories the turn's lines touch |
| 4 | `updateDataModel:"confirmation"` (data only, no `updateComponents`) | Same as turn 3 — turn 2's mount updates; narration shows only "Updating data…" (SPEC-R5 AC1's literal, single-category check) |
| 5 | `deleteSurface:"confirmation"` | Turn 2's mount is torn down + its bubble annotated "closed"; `canvas` (turn 1) untouched |

## 6. Trace

| Requirement | Ticket / precedent trace |
|---|---|
| SPEC-R1 | TKT-0020 "placement decided at intake"; `agent-app-surfaces.prd.md` PRD-D1/PRD-D2 |
| SPEC-R2, R3, R4 | TKT-0020 "the agent's work is visible AS IT OCCURS" / "rendered through the REAL A2UI renderer"; ADR-0097 §2 (per-ask host precedent, generalized) |
| SPEC-R5 | TKT-0013 (`ui-status-stream`); ADR-0088 §2 (`TurnTrace`) |
| SPEC-R6 | `timeline-family.spec.md` SPEC-R10 (tail-follow); the one-owned-scroll-region law |
| SPEC-R7 | TKT-0020 "the wire visible (the feed page's disclosure precedent)" |
| SPEC-R8 | ADR-0073 (recorded-default posture) |

## 7. Open items (non-normative)

- Exact narration copy/wording is the LLD's/build seat's to finalize.
- Whether a future `@agent-ui/app` conversation-surface primitive should crystallize this page's per-surface
  registry pattern is flagged, not decided, here — mirrors TKT-0016's own "flag, don't couple" posture toward
  this very ticket.
- No proposed ADR accompanies this SPEC (see the LLD's rationale, §8) — every design question below resolved
  against an explicit ticket acceptance line, an already-ratified precedent, or a verified source-code
  constraint; none is an irreducible Kim-taste fork with two genuinely defensible directions.
