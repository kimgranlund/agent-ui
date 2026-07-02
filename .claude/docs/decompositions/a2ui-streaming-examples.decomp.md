# Decomp — Streaming reconciliation · Streaming example page · example-payload seed shelf · region-less Card default

> NEXT.md items 1↔2 bridge (item 2's "reconcile before scoping" DONE in this intake; item 1 gains its seed
> shelf) + **item 4 folded in** (Kim's bare-Card diagnosis → the auto-wrap fork, §7). Manifest
> (coverage-checked `--strict`, exit 0): **`a2ui-streaming-examples.decomp-v2.json`** (v1 = the pre-item-4
> record; the v2 meta.diff states the delta). Decision records: **ADR-0055** (seed shelf) + **ADR-0056**
> (region-less card) — both PROPOSED, forks below await Kim. The streaming SPEC/LLD were repaired to
> **v0.2 in this intake** (design-lane doc edits; both were `proposed` docs, so no ADR was owed for the
> reconciliation itself). · proposed · 2026-07-02 · planner (design seat)

## 1 · The streaming reconciliation (deliverable 1 — DONE, recorded here)

### 1.1 Realized vs unrealized (the honest table)

| Behavior / module | Owning doc | State | Where |
|---|---|---|---|
| JSONL line decode + PARSE fault isolation | runtime SPEC-R1/N4 | **REALIZED** | `src/renderer/parser.ts` (returns `ParseError`, never throws) |
| `ingest(line)` / `ingestMessage` public host, arrival-order dispatch | runtime SPEC-R1 | **REALIZED** | `src/renderer/renderer.ts` |
| Envelope routing incl. `callFunction`, version rejection | runtime SPEC-R13/R14 | **REALIZED** | `src/renderer/dispatch.ts` |
| Progressive render-on-root · out-of-order refs held + patched | runtime SPEC-R3/R4/N1 | **REALIZED** | `src/renderer/tree.ts` (anchors) |
| Validate-at-finalize on the complete set | ADR-0002 | **REALIZED** | `renderer.ts#finalize` + shared `validate.ts` |
| LLD-C1 codec (encode + healing decode) | streaming SPEC-R1 | unbuilt | `src/stream/codec.ts` (planned) |
| LLD-C2 pipeline driver (generate→validate→self-correct) | SPEC-R2 | unbuilt · **blocked by** corpus retriever (corpus LLD-C9) + harness generate loop | `tools/pipeline/produce.ts` |
| LLD-C3 transport iface + stdio | SPEC-R3/R8 | unbuilt | `src/stream/transport.ts` + `tools/pipeline/stdio.ts` |
| LLD-C4/C5 AG-UI / A2A adapters | SPEC-R4/R5 | unbuilt | `tools/pipeline/transports/*` |
| LLD-C6 MCP server | SPEC-R6 | unbuilt · **blocked by** corpus store | `tools/pipeline/mcp-server.ts` |
| LLD-C7 conformance/negotiation | SPEC-R7 | unbuilt | `src/stream/conformance.ts` |

### 1.2 Drift repaired (v0.1 → v0.2, edited this intake)

1. **The `heal.ts` fabrication:** the LLD claimed "reuses the renderer's healer (`heal.ts`)" — no renderer
   healer exists or ever did; the renderer DELIBERATELY does not heal (parser fault-isolates, runtime
   SPEC-N4; healing client-side would mask invalidity against PRD-G4). Repaired in the LLD preamble, §2,
   §8 and sharpened in SPEC-R1: the ONE healer is corpus LLD-C7 (`src/corpus/heal.ts`, also unbuilt),
   shared by admission + the future codec.
2. **Realization boundary pinned** in both docs: consumer-side streaming behaviors are the RUNTIME SPEC's
   and are shipped; this SPEC/LLD own only producer/transport/MCP — all unbuilt (State column added).
3. **Discovered parity gap (recorded, scheduled, not papered over):** `renderer/validate.ts`
   `MESSAGE_KINDS` omits the `callFunction` envelope `dispatch.ts` routes (runtime SPEC-R14/ADR-0034
   shipped) — the shared validator calls a spec-legal stream SCHEMA-invalid. Small build slice (n3c); no
   ADR (it completes a ratified contract).

### 1.3 What must be BUILT for the streaming page? **Nothing.**

The page rides the shipped public host exactly as canvas/list/form do — `ingest(line)` per JSONL line,
paced by page chrome. No `src/stream/` module is needed; building LLD-C1 now would be speculative (its
substance is the healing decode, which a valid-by-construction demo must not exercise). The pipeline tail
stays parked behind the corpus store + harness (NEXT order holds).

## 2 · The Streaming example page (deliverable 2)

`site/a2ui-stream.html` + `site/pages/a2ui-stream.{ts,css}` — the a2ui-list `demoSection` two-pane format,
with the payload pane REBUILT as a feed log (the shown≡fed discipline under streaming: the pane **grows
with the feed** — a line appears exactly when it is ingested, rendered from the SAME object fed; a
`line k/N` counter shows queue progress).

- **Demo 1 — the agent composes a form while you watch.** Streams the SHARED `generative-form` seed
  (ADR-0055 re-slice: `createSurface` → `updateComponents(root card + provider)` → `updateDataModel` →
  one small `updateComponents` per field/control → finalize). Root arrives early ⇒ the surface paints at
  line 2-of-N and grows field by field. A **first-paint marker** (page chrome checks
  `surfaceEl.childElementCount` after each ingest) prints "first paint after line k of N" — the visible
  SPEC-N1 progressive proof.
- **Demo 2 — same payload, hostile order.** Feeds a root-LAST **permutation of the same seed objects**
  (page-derived reorder — NOT a second payload; the blurb says so). The surface stays blank while
  forward references accumulate as held anchors, then paints completely when root lands. Teaches: order
  is tolerated (runtime SPEC-R4), render begins at root (SPEC-R3), and root-early is what makes a stream
  *feel* progressive — the agent-author lesson.
- **Fault-injection affordance (not a demo payload):** an "Inject a malformed line" button feeds one
  page-local, clearly-labeled non-JSON line mid-stream → a `PARSE` error appears on the client channel
  and the stream CONTINUES to a clean finalize (runtime SPEC-N4 live). Deliberately outside the seed set
  (the seeds stay validator-clean; the gate never sees it).
- **Pacing:** auto-run ONCE on load (~300 ms/line, readable), **Replay** re-runs from scratch (fresh
  renderer, the canvas `run()` teardown pattern), **Step** pauses the feed and advances one line per
  click (the teaching mode). No autoplay loops.
- **What the page proves:** arrival-order application (R1) · render-on-root (R3) · forward-reference
  patch-in (R4) · progressive first paint as a metric (N1) · fault isolation (N4) · validate-at-finalize
  (ADR-0002 — finalize fires at stream end, log clean).

## 3 · The seed shelf + standing gate (deliverable 3 — ADR-0055)

Design pinned in the ADR; operational summary:

- **Home** `packages/agent-ui/a2ui/src/examples/` — `types.ts` (`ExampleSeed`: `name` · `description` ·
  `promptText` · `surfaceId` · `protocolVersion: 'v1.0'` · `catalogId: 'agent-ui'` ·
  `messages: readonly A2uiServerMessage[]`) + `canvas-button.ts` · `dynamic-lists.ts` (4 seeds) ·
  `generative-form.ts` (re-sliced fine-grained) · `patterns.ts` (5 seeds) · `index.ts`. **11 seeds.**
- **Corpus alignment** — the seed fields pre-align with `CorpusRecord` (corpus SPEC-R1/R9); seeds are the
  store's future AUTHORED candidates (`provenance.origin = src/examples/<name>.ts`), imported through
  `admit()` when the store lands. `corpus/**.jsonl` remains admission's single-writer data — the shelf is
  a lifecycle STAGE (authored source), not a rival store.
- **Exposure** — `package.json` gains `"./examples": "./src/examples/index.ts"`; the root barrel does NOT
  re-export (consumer-bundle hygiene; the `components/components` subpath precedent). Site resolves it
  through the workspace `exports` map — zero vite-config edits (vite.config.ts deliberately has no
  aliases). Caveat on record: a cross-PACKAGE test importing the subpath would need a more-specific
  vitest alias row first; package-internal tests import relatively and need nothing.
- **The gate** `src/examples/examples.test.ts` — per seed: shared-validator verdict valid + a jsdom
  real-host smoke (mount → `ingest` each message as a JSONL line → `finalize` → zero error messages).
  Inside the vitest include by construction; `npm test` now REDDENS on an invalid demo payload — the gap
  both page builders flagged, closed with zero config change. A non-exported broken fixture is the
  negative control.
- **Migration (4 pages):** replace payload consts with seed imports; page chrome/blurbs stay page-local.
  Canvas's `PING_CALL`/`REQUIRED_CALL` stay page-local (protocol probes; one EXPECTS rejection;
  validate.ts doesn't know the envelope yet). The form page inherits the re-sliced (longer) payload pane
  — accepted, more honest to what an agent streams.

## 4 · Forks for Kim (recommend, not settled)

- **F1 — the form-seed re-slice** (ADR-0055 cl.5): ONE canonical fine-grained stream serving both pages
  (recommended — single-owner, drift-free; the form page's payload pane grows) vs keeping the 3-message
  form payload and letting the streaming page derive its own split (two shapes of one payload — the drift
  seam returns).
- **F2 — the fault-injection affordance**: include the labeled malformed-line button (recommended — it is
  the only live N4 proof, and it stays outside the gated seed set) vs a strictly valid-only page.
- **F3 — the validate.ts `callFunction` widening (n3c)**: do it this wave (recommended — small,
  completes SPEC-R14 in the validator, adds a dispatch↔validator envelope-parity probe) vs defer to the
  corpus-store wave.
- **F4 — the region-less Card default (item 4, ADR-0056; the a/b/c/d fork)**: **recommended d+b** — a
  component-side `card.css` `:has()` fallback (region-equivalent padding on a card with NO region child;
  flips off automatically when a region arrives — streaming-safe; payload tree ≡ DOM tree) PLUS the
  pedagogy legs (seeds model regions from birth, SPEC §5.2 note, patterns-page teaching block). vs
  (a) factory always-wrap — double-wraps region-aware payloads; vs (c) factory wrap-when-no-region — the
  offered sweet spot, but streaming-safe detection degenerates to per-child routing through a new
  `childrenTarget` factory seam that must reroute list-template anchors (list.ts, the riskiest shipped
  path) to synthesize DOM the CSS gets free; vs (b) teach-only — bare Cards are the EXPECTED wild input
  (Basic's Card has no regions), and rendering the expected input worst is a product defect. Full
  analysis §7.

## 5 · Build sequence (waves ↔ manifest nodes; seats; file-disjoint)

**Wave 0 — ratification (Kim).** F1/F2/F3/**F4**; ADR-0055 + ADR-0056 flip accepted (separate ratifier).
n1 (the SPEC/LLD v0.2 repairs) is already landed by this intake — review it with the ADRs.

**Wave 1 — `a2ui-builder` (one seat): the package half.** n3a seeds + type + subpath export (every seed
Card composes regions) → n3b the standing gate (+ negative control) → n3c validate.ts widening + parity
probe → n10 the catalog SPEC §5.2 Card composition note (doc slice, same seat). Gate per slice:
`npm test` + `check`.

**Wave 1′ — `component-builder` (parallel to Wave 1, file-disjoint — components package): the card
fallback.** n9 `card.css` region-less fallback + `card.md` + the cross-engine browser probes (the
`:has()` flip is browser-only truth) + size check. Own gate: `check` + `test` + `test:browser` both
engines. The component-reviewer DoD applies (a control-wave commit).

**Wave 2 — `docs-writer` ×2 (file-disjoint, parallel): the site half.** Seat A: n4 migration of the four
pages + the patterns "composing containers" block (same file as the patterns migration; behavior-identical
otherwise, hand browser pass). Seat B: n5 the streaming page (this doc §2 is the spec). Vite MPA
auto-discovers the new .html.

**Wave 3 — integration (one seat, serial).** n6 TOC (`_page.ts` NAV + `main.ts` CARD_GROUPS — the only
shared-file edits) → n7 `npm run check && npm test` at the integration commit (the a2ui/site slices touch
no components source; n9 is the separately-gated exception).

## 6 · Open items / risks

- The n3b smoke imports the controls barrel per seed render (already true of catalog/renderer tests) —
  watch suite time; if it creeps, render-smoke only the largest seed per family and validator-check all.
- Demo 2's permutation must keep `createSurface` FIRST (a surface must exist before content routes);
  the permutation reorders only the post-create lines — the page derivation encodes that invariant.
- When the corpus store lands: the seed-import script (seeds → `admit()`) is the store wave's slice, not
  this one; ADR-0055 records the handshake so the two waves cannot fork the payloads.

## 7 · Item 4 — the region-less Card fork (ADR-0056; Kim's bare-Card diagnosis)

**The defect class:** all 8 example Cards composed bare children (`Card > form/column`); `ui-card` holds
zero padding BY LAW (ADR-0046 — `--ui-card-padding: 0`, spacing rides the region sub-elements), so no
payload ever engaged the box-model and every card rendered cramped. The pages are fixed in the working
tree (`Card > CardContent > …`); the seeds inherit the fixed idiom at migration (n3a accept).

**Why this generalizes:** A2UI Basic's `Card` has no region types — an LLM conditioned on Basic (or
nothing) emits bare-children Cards as its DEFAULT. The wild payload our catalog renders worst is the one
agents most likely produce. So the question is not only pedagogy.

**The fourth option the dispatch's a/b/c triad missed — (d) component-side CSS fallback:** `card.css`
already keys its grid template off `:has(> ui-card-header)`-class structures; one more leg —
`:not(:has(> ui-card-header, > ui-card-content, > ui-card-footer))` → region-equivalent padding + rhythm
on the card box itself — gives every bare card a humane default with: no synthetic DOM (payload tree ≡
component tree ≡ DOM tree — the shown≡fed tension of (a)/(c) never arises), automatic streaming safety
(a LATE-arriving region flips the fallback off via `:has()` re-evaluation — the exact case that breaks
(c)'s "detect at mount" rule, since out-of-order delivery is a shipped guarantee), no double-wrap case by
construction, plain-markup consumers included, and zero renderer/factory/list.ts changes. The mixed case
(a region plus loose siblings) gets NO fallback — regions present means the author owns the structure
(documented, not repaired). Costs, honestly: it changes the fleet-wide visual contract of a bare
`<ui-card>` (accepted — the shipped pages proved nobody composes one on purpose); the `:has()` flip is
browser-only truth (cross-engine probes, jsdom can't see it); the nested-radius chain needs re-proving
for direct `card > card` nesting; and it is a COMPONENTS-package slice (component-builder seat, own
gate) inside an otherwise a2ui/site wave.

**Why not (c), the offered sweet spot:** "wrap only when no region child is present" cannot be decided at
mount time under streaming (a region may arrive after loose children), so it degenerates to per-child
routing through a new `childrenTarget` factory seam that must also reroute list-template anchors
(list.ts — the riskiest shipped path), synthesizing catalog-visible DOM the agent never emitted (corpus
signal dilution: the rubric could no longer distinguish region-aware exemplars by their rendered
structure). All that machinery buys what one CSS rule already gives. Held in reserve only if evidence
shows CSS-insufficient wild cases.

**Capability boundary (kept honest):** sticky header/footer and `scrollable` content REQUIRE real
regions; the fallback is mercy, not parity. That boundary is exactly what the pedagogy legs teach: the
seeds model regions from birth (n3a), the catalog SPEC §5.2 Card row states the rule (n10), and the
patterns page carries the "composing containers" block — Card regions · Field wraps ONE control ·
Select > Option children (n4).

**Flagged, not settled here:** `ui-modal` composes the same container-box and the catalog `Modal` row has
no region types at all — whether Modal needs the same fallback or region types is a named follow-up
check in ADR-0056, deliberately out of this wave.
