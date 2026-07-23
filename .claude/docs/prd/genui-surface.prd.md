# PRD — GenUI (sandboxed free-form generative UI) for the agent-admin surface

> Status: **proposed · v0.2 · 2026-07-23 · Owner: agent-ui** — identity re-cut per Kim's 2026-07-23
> rulings (§4); the residual forks (§5) carry firm recommendations and await ratification. No build
> exists or is scheduled until §5 resolves and a SPEC lands.
> Altitude: this document owns **why + what-should-exist** for GenUI — the third Surface Options
> modality. Behavior contracts (wire shape, sandbox/CSP matrix, envelope validation) land in a future
> SPEC; nothing below is a design commitment beyond the §4 ruled record.
> Grounding: Kim's Surface Options list (Figma frame `33:1693`, node `34:1312`): *"Markdown (rendered
> as Rich-text. Simple text is fallback) · A2UI (catalog picker) · GenUI (pattern source picker)"* —
> the 2026-07-19 ruling *"Yes we need a PRD for GenUI work"* — and Kim's **2026-07-23 in-session
> AskUserQuestion rulings (host-witnessed)** recorded verbatim in §4. Version history: v0.1
> (2026-07-19) framed GenUI as pattern-sourced A2UI composition; v0.2 replaces that identity per §4.

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
| **PRD-G2** | must | A first-class **pattern source** model: named, versionable exemplar packs of curated HTML/CSS idioms feeding the code-generating prompt, enumerable by the picker via the existing `EntryLibraryPack` mechanism + "From library" affordance (§4 D4 — no distinct registry type). |
| **PRD-G3** | must | **Contained, not forbidden** (amended per §4 D1): model-authored script executes ONLY inside the sandbox boundary — no same-origin reach, no top navigation, strict CSP. Anything that cannot be proven contained (oversize payload, malformed envelope, an environment where the sandbox posture cannot be established) never paints — the fail-closed law re-cut around containment instead of prohibition. |
| **PRD-G4** | must | Layering holds: the DAG (`shared ← components ← a2ui ← app`, `router`/`code` catalog-invisible) gains no upward import and no new default-barrel dependency; the sandbox host element is catalog-invisible (an agent cannot compose it via A2UI). |
| **PRD-G5** | must | **Token bridge in v1** (§4, ruled): the iframe srcdoc gets the `--md-sys-*` custom properties + `color-scheme` injected, so generated UI matches the app theme from day one. |
| **PRD-G6** | should | A judged GenUI corpus shard + a docs page, matching the A2UI corpus discipline (facets · admission · pins). |
| **PRD-G7** | could | Pattern sources are shareable/exportable (an admin hands a source to another workspace). |

## 3. Non-goals

- **Not** a replacement for A2UI. The modalities coexist: A2UI stays the validated, catalog-typed,
  data-bound path; GenUI is the free-form escape hatch. Neither renders through the other.
- **Not** trusted DOM. Generated markup never enters the app's own document, never gains
  `allow-same-origin`, and v1 defines **no parent↔frame messaging bridge** — a GenUI surface is
  display-plus-self-contained-interactivity only; wiring frame events back into the agent loop is a
  future, separately-ruled extension.
- **Not** per-pattern multi-select — the picker picks at source (pack) level for v1 (§4 D3).
- **Not** built yet: the admin's GenUI row stays visible-but-disabled, pointing at this PRD, until
  §5 resolves and the SPEC tier lands.

*(Removed from v0.1: "not arbitrary generated HTML/JS, permanently out of scope" — per §4 D1 that is
now the definition of the feature, not its exclusion.)*

## 4. Ruled record — 2026-07-23 (Kim, in-session AskUserQuestion rulings, host-witnessed)

| Old fork | Ruling |
|---|---|
| **PRD-D1** | **RULED — "Iframe sandbox IS GenUI."** GenUI is free-form HTML/CSS/JS authored by the agent, rendered in a sandboxed `<iframe>`. PRD-G3's fail-closed law AMENDS from "no script execution, permanently out of scope" to **contained, not forbidden** — model-authored script executes ONLY inside the sandbox boundary (no same-origin, no top navigation, strict CSP; the exact posture is §5 D7, SPEC-tier). "Pattern sources" become prompt-side exemplar packs of curated HTML/CSS idioms feeding the code-generating prompt. v0.1's option (a) (pattern-sourced A2UI composition) is **not** the feature and records as **rejected-for-this-surface**; §1's problem statement is rewritten accordingly (the gap is "no free-form generative surface", not "no novel catalog compositions"). |
| **PRD-D3** | **RULED — source-level pick for v1**; per-pattern multi-select deferred. |
| **PRD-D4** | **RULED — reuse `EntryLibraryPack`** (the GH #47/#48 shape) + the "From library" affordance; no distinct registry type. |
| *(new)* | **RULED — token bridge in v1**: the iframe srcdoc gets the `--md-sys-*` custom properties + `color-scheme` injected so generated UI matches the app theme from day one (→ PRD-G5). |
| **PRD-D2** | Superseded as posed (its options were payload-shaped, per the v0.1 identity); re-derived for the iframe model as §5 D8. |
| **PRD-D5** | **Moot.** "Is GenUI A2UI on the wire?" dissolved with D1 — it is not A2UI at all; the real question is the wire path, re-derived as §5 D6. |

## 5. Open forks — residual, all Kim's; each carries a firm recommendation

| ID | Fork | Recommendation (firm) + alternatives |
|---|---|---|
| **PRD-D6** | **Wire path** — how does generated HTML travel producer → client? | **Recommend: a third reserved JSONL line kind on the existing turn stream** — a `genui` envelope (`{"genui":{surfaceId, html}}`, exact shape SPEC-tier) riding the same `AsyncIterable<string>` the transport already returns, disjoint from both `A2uiServerMessage` (no `version` key — the same proof `meta-line.ts` documents) and the `a2uiMeta` envelope (which is framing, never content, and must stay so). One whole HTML document per surface per turn — srcdoc replacement is atomic, so v1 does not stream partial HTML progressively. **Honesty about SPEC-R5** (validate-then-stream, [a2ui-live-agent](../spec/a2ui-live-agent.spec.md)): `validateA2ui` parity does NOT extend to an opaque HTML payload. Validation for GenUI narrows to the structural envelope — well-formed line, string payload, a hard size cap — while the *semantic* fail-closed leg moves to render time: containment (PRD-G3's sandbox + CSP posture) is what precedes paint, not schema validity. The SPEC must amend SPEC-R5's scope statement rather than pretend the healer/validator covers HTML. Alternatives rejected: a fenced block in the prose channel (conflates the conversational channel with a renderable payload; markdown pipeline would need un-sanitizing carve-outs); a new `a2uiMeta` field (meta-lines are routing/telemetry framing — putting content bytes there breaks their "never content" law). |
| **PRD-D7** | **Sandbox/CSP posture** — the containment envelope's exact shape. | **Recommend for v1:** `<iframe sandbox="allow-scripts">` and nothing else — critically NO `allow-same-origin` (srcdoc + `allow-scripts` alone yields an opaque origin: script runs, but parent DOM/storage/cookies are unreachable), no `allow-top-navigation*`, no `allow-popups`, no `allow-forms`, no `allow-modals`. Plus a CSP injected into the srcdoc head: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:` — inline code and style are the feature; ALL network is off (no external fetch/img/font/frame). **Kim rules** the product-taste slice: external images/fonts (recommend NO for v1 — `data:` URIs suffice and keep turns self-contained) and whether any v1 interactivity reaches back to the agent (recommend NO — see §3). **SPEC tier owns** the exact directive matrix, the fail-closed probe (what happens where `sandbox`/CSP support cannot be established), and the size cap. |
| **PRD-D8** | **Exemplar-pack home** (old D2, re-derived) — where do the HTML/CSS idiom packs live? | **Recommend: the producer layer** — typed, byte-pinned prompt-asset modules under the a2ui package's agent surface (`src/agent/`, exported via the existing `./agent` subpath alongside its prompt texts), NOT the `@agent-ui/a2ui/examples` seed shelf: that shelf's `ExampleSeed` is A2UI-message-shaped (`messages: A2uiServerMessage[]`, pinned `catalogId`/`protocolVersion`) — the wrong shape for HTML idiom exemplars, and bending it would blur the corpus pre-alignment it exists for. Admin-side, the packs surface through `EntryLibraryPack` per §4 D4 — the pack module is the source of truth; the library affordance is its projection. Root-barrel purity holds: zero pack bytes in `.` (the ADR-0137 discipline). |
| **PRD-D9** | **Iframe host home** — which package owns the sandboxed-surface host element? | **Recommend: a new control in `@agent-ui/components`** (working name `ui-sandbox-frame` — Fisher-Price: it is a frame that sandboxes), a light-DOM FACE host wrapping the one native `<iframe>`, owning the sandbox attribute set, the CSP + token-bridge injection into srcdoc, and the fail-closed never-paint path. Catalog-invisible by construction: the a2ui catalog never maps it, so no agent can compose it via A2UI (PRD-G4); `app` composes it into the conversation feed. Alternatives: app-tier-only (rejected — PRD-G6's docs page and any future non-admin consumer would have to reach into app; components is the fleet's control home and the control has no upward dependency), the `code` family (rejected — that family is code-as-*text*: tokenizers/markdown/editor, not an execution surface). |

## 6. Deliverable ladder (sketch — real milestones land in the SPEC)

B0 residual-fork resolution (§5, Kim) → B1 the sandbox host control + token bridge (PRD-G3/G4/G5) →
B2 wire path + producer integration (exemplar packs conditioning the code-generating prompt, the
picker live — PRD-G1/G2) → B3 corpus + docs (PRD-G6).

## 7. Success metrics

Baseline today: 0 (the modality does not exist). At B2, a turn with GenUI enabled and a source
picked yields generated HTML that:

- (m1) **contains**: an adversarial payload (top-navigation attempt, parent-DOM/storage probe,
  external fetch, oversize document) is provably inert or never paints — asserted in the real-engine
  browser gate, not jsdom;
- (m2) **themes**: the rendered frame reflects the active app theme via the injected `--md-sys-*`
  bridge, and follows a live theme flip (PRD-G5) — noting that under §3's no-messaging-bridge law
  the only v1-compliant flip mechanism is full srcdoc re-injection, which destroys frame-internal
  state (the mechanism, and whether that trade holds, is SPEC-tier);
- (m3) **uses the source**: judge-scored ≥ 4/5 against the corpus rubric for demonstrable use of the
  picked pack's idioms;
- (m4) **degrades**: with GenUI off, or the envelope failing its structural gate, the turn degrades
  to the markdown/A2UI modalities with zero regressions in the existing A2UI conformance suite.

## 8. Risks / notes

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
