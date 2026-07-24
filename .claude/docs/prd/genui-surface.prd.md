# PRD — GenUI (sandboxed free-form generative UI) for the agent-admin surface

> Status: **proposed · v0.3 · 2026-07-23 · Owner: agent-ui** — the residual forks D7/D8/D9 are now
> RULED (§4, Kim's 2026-07-23 in-session rulings, host-witnessed); **one fork remains** — §5 D6
> (wire path), carrying a research-backed recommendation that **awaits Kim's adoption**. No build
> exists or is scheduled until D6 resolves and a SPEC lands.
> Altitude: this document owns **why + what-should-exist** for GenUI — the third Surface Options
> modality. Behavior contracts (wire shape, sandbox/CSP directive matrix, bridge vocabulary,
> envelope validation) land in a future SPEC; nothing below is a design commitment beyond the §4
> ruled record.
> Grounding: Kim's Surface Options list (Figma frame `33:1693`, node `34:1312`): *"Markdown (rendered
> as Rich-text. Simple text is fallback) · A2UI (catalog picker) · GenUI (pattern source picker)"* —
> the 2026-07-19 ruling *"Yes we need a PRD for GenUI work"* — Kim's **2026-07-23 in-session
> AskUserQuestion rulings (host-witnessed)** recorded in §4 (two sittings, same date: the identity
> re-cut D1/D3/D4 + token bridge, then the residual-fork rulings D7/D8/D9) — and the completed
> **2026-07-23 D6 ecosystem survey** (§5.1). Version history: v0.1 (2026-07-19) framed GenUI as
> pattern-sourced A2UI composition; v0.2 (2026-07-23) replaced that identity per §4; v0.3
> (2026-07-23) folds the D7/D8/D9 rulings and the D6 wire-path research, plus mechanical §4 D1/D2
> pointer touch-ups (their "§5 D7"/"§5 D8" references re-aimed at the now-ruled rows).

## 1. Problem

The agent-admin surface gives an agent exactly two output modalities: **prose** (markdown-rendered)
and **A2UI** — structured UI constrained to a *fixed catalog* of component types, every payload
validated against it. Both are closed worlds: the agent can say anything, and it can compose any
shape the catalog enumerates — but it cannot *author UI as code*. There is **no free-form generative
surface**: no way for the model to produce a bespoke visualization, a one-off layout, an animated
explainer, or any rendering the catalog's type system never anticipated. That is the gap GenUI
names: **free-form HTML/CSS/JS authored by the agent, rendered inside a sandboxed `<iframe>`** —
generative capability bounded by containment, not by a catalog.

Who has the problem: (1) agent-admin authors configuring richer demo agents; (2) the producer stack,
whose code-generating prompt needs a first-class **pattern source** abstraction — curated exemplar
packs of HTML/CSS idioms that condition what the model writes; (3) the docs story — "what can an
agent render" currently ends at the catalog boundary.

## 2. Goals

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must | The Surface Options card offers **GenUI** with a working **pattern source picker** — a source-level pick (§4 D3) that changes what the agent actually authors on the next turn (live-apply law). |
| **PRD-G2** | must | A first-class **pattern source** model: named, versionable exemplar packs of curated HTML/CSS idioms feeding the code-generating prompt, homed in the producer layer (§4 D8) and enumerable by the picker via the existing `EntryLibraryPack` mechanism + "From library" affordance (§4 D4 — no distinct registry type). |
| **PRD-G3** | must | **Contained, not forbidden** (§4 D1): model-authored script executes ONLY inside the sandbox boundary — no same-origin reach, no top navigation, strict CSP. External reach is **allow-listed, never open** (§4 D7 rules images/fonts in; the allow-list shape is §5 D6's recommendation, the exact matrix SPEC-tier). Anything that cannot be proven contained (oversize payload, malformed envelope, an environment where the sandbox posture cannot be established) never paints — the fail-closed law cut around containment instead of prohibition. |
| **PRD-G4** | must | Layering holds: the DAG (`shared ← components ← a2ui ← app`, `router`/`code` catalog-invisible) gains no upward import and no new default-barrel dependency; the sandbox host element (§4 D9) is catalog-invisible (an agent cannot compose it via A2UI). |
| **PRD-G5** | must | **Token bridge in v1** (§4, ruled): the iframe srcdoc gets the `--md-sys-*` custom properties + `color-scheme` injected, so generated UI matches the app theme from day one; live theme flips ride the §4 D7 bridge (recommended shape §5 D6; mechanics SPEC-tier). |
| **PRD-G6** | should | A judged GenUI corpus shard + a docs page, matching the A2UI corpus discipline (facets · admission · pins). |
| **PRD-G7** | could | Pattern sources are shareable/exportable (an admin hands a source to another workspace). |
| **PRD-G8** | must | **Interactive GenUI in v1** (§4 D7): an agent↔frame postMessage bridge with a small **CLOSED** vocabulary — never an open message bus, no generic tool-call channel in v1. The recommended vocabulary shape (lifecycle handshake · size/theme inward · the fleet's own `action` event outward, ADR-0153) is §5 D6's, awaiting adoption; the exact message contract is SPEC-tier. |

## 3. Non-goals

- **Not** a replacement for A2UI. The modalities coexist (§6): A2UI stays the validated,
  catalog-typed, data-bound path; GenUI is the free-form escape hatch. Neither renders through the
  other.
- **Not** trusted DOM. Generated markup never enters the app's own document and never gains
  `allow-same-origin`. The v1 bridge (§4 D7) is a **closed** postMessage vocabulary, not an open
  message bus: no arbitrary parent reach, no generic `tools/call`-equivalent. *(v0.2's
  "no parent↔frame messaging bridge in v1" non-goal is removed — D7 ruled the bridge in.)*
- **Not** per-pattern multi-select — the picker picks at source (pack) level for v1 (§4 D3).
- **Not** built yet: the admin's GenUI row stays visible-but-disabled, pointing at this PRD, until
  §5 D6 is adopted and the SPEC tier lands.

*(Removed from v0.1: "not arbitrary generated HTML/JS, permanently out of scope" — per §4 D1 that is
now the definition of the feature, not its exclusion.)*

## 4. Ruled record — 2026-07-23 (Kim, in-session AskUserQuestion rulings, host-witnessed; two sittings, same date)

| Old fork | Ruling |
|---|---|
| **PRD-D1** | **RULED — "Iframe sandbox IS GenUI."** GenUI is free-form HTML/CSS/JS authored by the agent, rendered in a sandboxed `<iframe>`. PRD-G3's fail-closed law AMENDS from "no script execution, permanently out of scope" to **contained, not forbidden** — model-authored script executes ONLY inside the sandbox boundary (no same-origin, no top navigation, strict CSP; the exact posture is SPEC-tier, its product-taste slice ruled as D7). "Pattern sources" become prompt-side exemplar packs of curated HTML/CSS idioms feeding the code-generating prompt. v0.1's option (a) (pattern-sourced A2UI composition) is **not** the feature and records as **rejected-for-this-surface**; §1's problem statement is rewritten accordingly (the gap is "no free-form generative surface", not "no novel catalog compositions"). |
| **PRD-D3** | **RULED — source-level pick for v1**; per-pattern multi-select deferred. |
| **PRD-D4** | **RULED — reuse `EntryLibraryPack`** (the GH #47/#48 shape) + the "From library" affordance; no distinct registry type. |
| *(new)* | **RULED — token bridge in v1**: the iframe srcdoc gets the `--md-sys-*` custom properties + `color-scheme` injected so generated UI matches the app theme from day one (→ PRD-G5). |
| **PRD-D2** | Superseded as posed (its options were payload-shaped, per the v0.1 identity); re-derived for the iframe model as D8, since ruled. |
| **PRD-D5** | **Moot.** "Is GenUI A2UI on the wire?" dissolved with D1 — it is not A2UI at all; the real question is the wire path, re-derived as §5 D6. |
| **PRD-D7** | **RULED — both loosenings** (overturning v0.2's twin "recommend NO" leans): external **images/fonts are allowed** in v1, AND v1 **ships a postMessage agent↔frame bridge** — interactive GenUI (→ PRD-G8). The containment law (PRD-G3) is unchanged: no `allow-same-origin`, no top navigation; external reach is allow-listed, never open (the §5 D6 survey's four-category CSP shape is the recommended pattern — images/fonts land as `resourceDomains`), and the bridge carries a small CLOSED vocabulary, not an open message bus. The exact sandbox/CSP directive matrix, allow-list defaults, and bridge message shapes stay **SPEC-tier**. |
| **PRD-D8** | **RULED — the producer layer, as recommended**: typed, byte-pinned prompt-asset modules under the a2ui package's agent surface (`src/agent/`), exported via the existing `./agent` subpath alongside its prompt texts — NOT the `@agent-ui/a2ui/examples` seed shelf (its `ExampleSeed` is A2UI-message-shaped, the wrong shape for HTML idiom exemplars). Admin-side, packs surface through `EntryLibraryPack` per D4 — the pack module is the source of truth; the library affordance is its projection. Root-barrel purity holds: zero pack bytes in `.` (the ADR-0137 discipline). |
| **PRD-D9** | **RULED — `ui-sandbox-frame` in `@agent-ui/components`, as recommended**: a new light-DOM FACE control (Fisher-Price: a frame that sandboxes) wrapping the one native `<iframe>`, owning the sandbox attribute set, the CSP + token-bridge injection into srcdoc, and the fail-closed never-paint path. Catalog-invisible by construction: the a2ui catalog never maps it, so no agent can compose it via A2UI (PRD-G4); `app` composes it into the conversation feed. |

## 5. Open fork — one residual (D6), research-backed recommendation **awaiting Kim's adoption**

Kim redirected D6 to research (2026-07-23); the survey is complete (§5.1). Its recommendation
stands below as a **research-backed recommendation — NOT ruled**; it becomes the contract only when
Kim adopts it.

**PRD-D6 — wire path** (how does generated HTML travel producer → client?). **Recommend: keep the
in-house third reserved JSONL line kind, align the safety-model SHAPE with MCP Apps, keep the HTML
payload atomic per surface.** Concretely:

- **The wire stays in-house**: a `genui` envelope (`{"genui":{surfaceId, html}}`, exact shape
  SPEC-tier) riding the same `AsyncIterable<string>` turn stream the transport already returns,
  disjoint from both `A2uiServerMessage` (no `version` key — the same proof `meta-line.ts`
  documents) and the `a2uiMeta` envelope (framing, never content, and it must stay so). MCP Apps
  is **not adoptable as the wire** — it presumes a real MCP session (initialize negotiation,
  `resources/read`, a tool registry) this stack does not have. The survey found NO dominant open
  JSON-for-streaming-GenUI standard to align with instead (§5.1), and the layer below (AG-UI)
  independently converges on exactly our "one stream, disjoint typed payload kinds" architecture
  (ADR-0088).
- **The safety SHAPE is borrowed from MCP Apps**: (a) its four CSP allow-list categories verbatim
  as a pattern — `connectDomains` / `resourceDomains` / `frameDomains` / `baseUriDomains`,
  default-deny when absent — with §4 D7's images/fonts ruling landing as `resourceDomains`;
  (b) a small **closed** bridge vocabulary (lifecycle handshake · size-changed ·
  host-context-changed, the latter carrying PRD-G5's token bridge / live theme flips);
  (c) the frame's **outward action channel reuses the fleet's own `action` event** (ADR-0153's
  seventh member), not a new taxonomy; (d) NO generic `tools/call`-equivalent in v1.
- **Atomic, never chunked**: one whole HTML document per surface per turn — srcdoc replacement is
  atomic, and sanitizing/CSP-validating a *partial* HTML document mid-parse has no safe precedent
  anywhere surveyed (MCP Apps likewise ships whole HTML5 documents, never token-streamed).
  Progressive UX comes from the existing turn-progress meta-lines ("genui pending"), never from
  incrementally streaming the HTML.
- **Honesty about SPEC-R5** (validate-then-stream,
  [a2ui-live-agent](../spec/a2ui-live-agent.spec.md)): `validateA2ui` parity does NOT extend to an
  opaque HTML payload. Validation for GenUI narrows to the structural envelope — well-formed line,
  string payload, a hard size cap — while the *semantic* fail-closed leg moves to render time:
  containment (PRD-G3's sandbox + CSP posture) is what precedes paint, not schema validity. The
  SPEC must amend SPEC-R5's scope statement rather than pretend the healer/validator covers HTML.
- **Alternatives rejected**: a fenced block in the prose channel (conflates the conversational
  channel with a renderable payload; the markdown pipeline would need un-sanitizing carve-outs);
  a new `a2uiMeta` field (meta-lines are routing/telemetry framing — content bytes there break
  their "never content" law); adopting MCP Apps' wire wholesale (above — session machinery we
  don't have).

### 5.1 Grounding — the 2026-07-23 ecosystem survey

Conducted in-session 2026-07-23 (host-coordinated web research); **this compact record is the
survey's durable form** — there is no separate survey artifact.

| Surveyed | What it is | Bearing on D6 |
|---|---|---|
| **MCP Apps** — the unified MCP-UI + OpenAI Apps SDK extension; spec dated 2026-01-26, marked "Stable"; jointly authored Anthropic / OpenAI / MCP-UI WG; shipped in Claude web+desktop, ChatGPT, VS Code Insiders, Goose | Whole HTML5 documents delivered via `ui://` resources (never token-streamed); sandboxed iframe; CSP built from four allow-list categories, default-deny absent; closed JSON-RPC-over-postMessage bridge (lifecycle handshake, size-changed, host-context-changed for theme, open-link, tool bridging). Sources: [MCP blog 2026-01-26](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps) · [ext-apps spec `specification/2026-01-26/apps.mdx`](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) · [OpenAI Apps SDK, build/mcp-server](https://developers.openai.com/apps-sdk/build/mcp-server) | The safety-model donor (§5's SHAPE borrow). NOT the wire — presumes a real MCP session. |
| **A2UI v0.9.1/v1.0** — Google, open-sourced 2026; the repo's own pin posture is [a2ui-expert-system](a2ui-expert-system.prd.md) C1 (v1.0 RC target, v0.9.1 production fallback) | Structured catalog JSON, transport-agnostic, resilient streaming of structured deltas | The sibling lane this repo already ships; see §6 for the deliberate two-lane split. |
| **AG-UI** — ~14.9k stars | The event-protocol layer BELOW GenUI — no dedicated generative-UI event exists in it | Independently validates "one stream, disjoint typed payload kinds" (ADR-0088) as the ecosystem's converged shape. |
| **Vercel AI SDK** · **Thesys C1** | Proprietary SSE parts rendering to React, `streamUI` experimental · closed commercial DSL | Neither is an open portable standard — together they evidence that NO dominant open JSON-for-streaming-GenUI standard exists to align with. |
| **W3C Generative UI CG** | Proposed 2026-01-30, **not yet chartered** | Record as **watch**; freshness caveat below. |

**Uncertainty flags (carried honestly):** the Vercel/Thesys governance conclusions rest on
absence-of-spec-repo, not confirmed negatives; AG-UI's exact event shapes came from a secondary
source — pull `packages/core/src/events.ts` from
[ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui) before citing exact shapes in any
later doc; the W3C CG status may have moved — re-check before citing it again.

## 6. A2UI vs GenUI — how, why, where they differ

Both modalities validate before anything reaches the DOM — **at different tiers**. **A2UI validates
the PAYLOAD**: every node is catalog-checked, portable, accessible by construction; it wins whenever
the desired shape is enumerable by the catalog's type system. **GenUI validates the BOUNDARY**: the
HTML is opaque and never inspected semantically; safety is containment — sandbox + CSP + the closed
bridge; it wins for genuinely novel compositions the catalog never anticipated. Where they meet:
**one shared turn stream with disjoint wire markers** (extending ADR-0088's law — the §5 D6
recommended shape, awaiting adoption), deliberately supporting both lanes side by side — the
modality is picked per turn, and neither lane renders through the other (§3).

## 7. Deliverable ladder (sketch — real milestones land in the SPEC)

B0 D6 adoption (§5, Kim) → B1 the sandbox host control `ui-sandbox-frame` + token bridge (PRD-G3/
G4/G5, §4 D9) → B2 wire path + producer integration + bridge interactivity (exemplar packs
conditioning the code-generating prompt, the picker live — PRD-G1/G2/G8) → B3 corpus + docs
(PRD-G6).

## 8. Success metrics

Baseline today: 0 (the modality does not exist). At B2, a turn with GenUI enabled and a source
picked yields generated HTML that:

- (m1) **contains**: an adversarial payload (top-navigation attempt, parent-DOM/storage probe,
  network reach outside the allow-listed categories, oversize document, a bridge message outside
  the closed vocabulary) is provably inert or never paints — asserted in the real-engine browser
  gate, not jsdom;
- (m2) **themes**: the rendered frame reflects the active app theme via the injected `--md-sys-*`
  bridge, and follows a live theme flip (PRD-G5) — with §4 D7's bridge in v1 the flip can travel a
  host-context-changed-shaped message instead of full srcdoc re-injection (which destroys
  frame-internal state); the mechanism, and whether re-injection remains the fallback, is
  SPEC-tier;
- (m3) **uses the source**: judge-scored ≥ 4/5 against the corpus rubric for demonstrable use of the
  picked pack's idioms;
- (m4) **degrades**: with GenUI off, or the envelope failing its structural gate, the turn degrades
  to the markdown/A2UI modalities with zero regressions in the existing A2UI conformance suite.

## 9. Risks / notes

- **Naming collision (flagged for the SPEC):** the producer already ships `GenUiMode` /
  `gen-ui-mode.ts` (ADR-0090) — a per-turn *prompt-disposition* axis (`default · specific ·
  blue-sky`) unrelated to this surface. The SPEC must name this feature's machinery so the two
  never blur (e.g. `genui` as the surface/envelope key vs. the untouched `GenUiMode` type), or
  propose the ADR-0090 axis a clarifying rename in its own record.
- **SPEC-R5 amendment is real scope** (§5 D6): the validator-parity law
  ([a2ui-live-agent](../spec/a2ui-live-agent.spec.md) SPEC-R4 AC2 — driver, renderer, and corpus
  admission all use the same `validateA2ui`/`heal`) gains a deliberate, documented exception —
  worth an explicit SPEC clause, not a footnote.
- The admin's disabled GenUI row and its "PRD pending" note stay accurate until B1 ships; the
  live-apply law (PRD-G1) inherits the Surface Options card's existing store discipline.
