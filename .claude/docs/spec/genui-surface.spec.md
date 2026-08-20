# SPEC — GenUI surface (sandboxed free-form generative UI): wire · frame · bridge · producer

> Status: proposed · v0.9 · 2026-08-19 · Layer: SPEC (execution contract)
> **v0.9 amendment (docs-only, 2026-08-19):** SPEC-R13(b)'s inventory budget revised ≤ 18 600 → ≤ 19 000
> chars on real corpus evidence — the ruled §8 path ("tightening or loosening on real corpus data is a
> SPEC version bump, not silent drift"): ADR-0225/GH #1478's `ui-playing-card` control mint (rank/suit/
> faceDown/size, four attributes) adds its descriptor to the fleet, growing the descriptor-derived
> inventory to a measured 18 706 chars (combined measured value enforced by the standing test). No
> other clause changes.
> **v0.8 amendment (docs-only, 2026-08-19):** SPEC-R13(b)'s inventory budget revised ≤ 18 100 → ≤ 18 600
> chars on real corpus evidence — the ruled §8 path ("tightening or loosening on real corpus data is a
> SPEC version bump, not silent drift"): ADR-0223's Fill-by-Default wave (slices 0–2) adds an `inline`
> sizing-opt-out attribute row to thirteen flipped controls' descriptors (measured 18 179), and
> ADR-0224/GH #1429's `ui-service-card` control mint adds its descriptor on top (measured 18 296
> pre-S2; combined measured value enforced by the standing test). No other clause changes.
> **v0.7 amendment (docs-only, 2026-08-19):** SPEC-R13(b)'s inventory budget revised ≤ 16 000 → ≤ 18 100
> chars on real corpus evidence — the ruled §8 path ("tightening or loosening on real corpus data is a
> SPEC version bump, not silent drift"): six control mints (ADR-0210/0213/0214/0216/0219/0220, the
> 2026-08-19 campaign) grew the descriptor-derived inventory to a measured 17 958 chars. No other clause
> changes.
> **v0.6 amendment (docs-only, §12 below — GH #342 + GH #346, Kim's 2026-07-28 rulings):** SPEC-R13(b)'s
> derivation clause is corrected on two counts, as ONE slice (the #346 code change is what makes the #342
> wording true). #342: "via the ONE ADR-0004 parser" is UNSATISFIABLE — ADR-0137/ADR-0107's zero-dep fence
> bars `src/agent/` from importing `@agent-ui/components/descriptor` at all — so the clause now requires a
> reader PROVEN EQUIVALENT to that parser by a standing parity gate, naming
> `dogfood-inventory-parity.test.ts` as that gate; the fence is UNCHANGED, no exception carved. #346:
> "descriptor-derived" is EXTENDED to include a compound family's sibling tags, scanned from that family's
> own `.define('ui-x'` call sites (the bundle generator's own technique, reused) and attached to the parent
> descriptor's entry; ADR-0004's schema is UNCHANGED, and SPEC-R13 AC2's set-equality gate is restored to
> TRUE three-way equality with the interim allowlist deleted. Append-only: no other clause changes.
> **v0.5 amendment (docs-only, §11 below — ADR-0162, GH #316):** the agent-ui DOGFOOD mode, Kim's
> 2026-07-28 ruling: `GenuiSurfaceConfig` gains an additive `dogfood?: boolean`; mode-on loads the
> fleet's docs-like asset pair (flattened CSS + the self-defining component IIFE bundle) into the
> frame INLINE — under the UNCHANGED SPEC-R3 sandbox posture and SPEC-R4 CSP (inline style/script are
> already the ruled floor; no directive widens) — and composes a dogfood prompt segment (hand-authored
> teaching, byte-pinned + a descriptor-DERIVED fleet inventory, drift-gated) into SPEC-R10's genui
> block. Absent/`false` is byte-identical on every surface (the `exclusive` degradation precedent).
> New requirements: SPEC-R12 (frame assets) · SPEC-R13 (dogfood prompt modules); SPEC-R5's build
> ordering and SPEC-R10's block composition gain dogfood clauses stated in §11, superseding nothing.
> **v0.4 amendment (docs-only, §10 below):** `GenuiSurfaceConfig` (SPEC-R10) gains a new, additive
> `exclusive?: boolean` field — the per-turn "this caller has no A2UI catalog renderer at all" signal a
> real live defect (`gen-ui-live.ts`'s render pane staying empty despite a genuine agent note, on a real
> "make a card game" prompt) traced back to; independent review: SHIP. §10 documents the field, its
> `genuiBlock`/`validateGenuiSurface` wiring, and the degradation law it follows (byte-identical when
> absent/false — every existing coexistence caller, e.g. agent-admin, unaffected). Append-only: no other
> clause in this document changes.
> **v0.3 amendment (docs-only, §9 below):** SPEC-R9's prompt-loading parenthetical is corrected to
> match the ALREADY-ESTABLISHED ADR-0135 mechanics (`process.cwd()`-relative `readFileSync`, not
> `import.meta.url`) — an independent B2-build review verified the literal parenthetical would have
> reintroduced the exact TKT-0044 Vite-dev bug `mini-skills.ts`/`system-prompt.ts` already fixed.
> Append-only: no other clause in this document changes.
> Refines: [`../prd/genui-surface.prd.md`](../prd/genui-surface.prd.md) — PRD-G1 (working pattern-source
> picker, live-apply), PRD-G2 (first-class pattern sources), PRD-G3 (contained, not forbidden), PRD-G4
> (layering + catalog-invisibility), PRD-G5 (token bridge in v1), PRD-G8 (interactive GenUI, closed
> bridge). The PRD §4 ruled record is LAW here: D1 (iframe identity) · D3 (source-level pick) · D4
> (`EntryLibraryPack` reuse) · D7 (images/fonts in + the bridge in) · D8 (producer-layer packs) · D9
> (`ui-sandbox-frame` in `@agent-ui/components`) · the token-bridge ruling.
> **D6 — RESOLVED, 2026-07-24.** Kim adopted the wire recommendation as researched (PRD §4 D6, PRD
> §5.1): *"proceed. align with best practices of claude.ai and chatgpt canvas artifacts and
> streaming json standards"* — confirming the MCP-Apps-shape safety model this SPEC was already
> written to. Every wire rule below (SPEC-R1/R2 and every clause deriving from the `{"genui":…}`
> envelope, including SPEC-R4's four-category CSP config and SPEC-R7's bridge vocabulary) is now
> **settled contract, not a conditional draft**. PRD §7's B0 gate is satisfied — **B1 is buildable.**
> The §3.1 amendment to the sibling SPEC is applied for real as of this ruling (no longer a draft
> awaiting adoption).
> Realizes/decides against: [`./a2ui-live-agent.spec.md`](./a2ui-live-agent.spec.md) (the sibling
> stream this kind rides beside; its SPEC-R5 validate-then-stream law is honestly NARROWED for this one
> kind — §3.1 carries the amendment, applied to that file 2026-07-24) ·
> [`../adr/0153-status-stream-elapsed-timer-retry-action-planned-glyph.md`](../adr/0153-status-stream-elapsed-timer-retry-action-planned-glyph.md)
> (the fleet `action` event this bridge's one outward channel reuses) ·
> [`../adr/0135-agent-harness-config-schema-and-prompt-files.md`](../adr/0135-agent-harness-config-schema-and-prompt-files.md)
> (the prompt-file mechanics packs follow) ·
> [`../adr/0137-a2ui-agent-producer-toolkit-export.md`](../adr/0137-a2ui-agent-producer-toolkit-export.md)
> (root-barrel purity) · [`../adr/0090-a2ui-gen-ui-mode-axis.md`](../adr/0090-a2ui-gen-ui-mode-axis.md)
> (`GenUiMode`, which this SPEC deliberately does NOT touch — §4 N2 is the naming law).
> Refined by: none yet — an LLD lands with the build wave if the component slice earns one.
> Altitude: owns the GenUI surface's BEHAVIOR + ACCEPTANCE — the wire envelope, the sandbox/CSP posture,
> the bridge vocabulary, the producer/pack/picker contract, and the checkable predicates for each.
> Implementation wiring is LLD/build-tier. Requirement IDs file-scoped (`SPEC-R1…`); the sibling SPEC's
> identically-numbered IDs are always cited as "live-agent SPEC-R#".

---

## 1. Purpose

Give the agent-admin surface its third output modality: **free-form HTML/CSS/JS authored by the agent,
rendered inside a sandboxed `<iframe>`** — generative capability bounded by containment, not by a
catalog (PRD §1, D1). A2UI validates the PAYLOAD; GenUI validates the BOUNDARY (PRD §6). This SPEC is
the behavior contract between four surfaces: the **wire** (one new reserved JSONL line kind on the
existing turn stream), the **frame** (`ui-sandbox-frame`, the containment owner), the **bridge** (a
closed six-member postMessage vocabulary), and the **producer** (pattern-source packs conditioning the
code-generating prompt, picked source-level in the admin).

## 2. Definitions

- **genui line** — the reserved JSONL line kind `{"genui":{surfaceId, html}}` riding the SAME
  `AsyncIterable<string>` stream `AgentTransport.turn()` already returns. Carries NO `version` key and
  NO `a2uiMeta` key — provably neither an `A2uiServerMessage` nor a meta-line (the `meta-line.ts`
  disjointness proof, mirrored).
- **GenUI surface** — one rendered sandboxed frame, identified by `surfaceId`, holding exactly one
  whole HTML document at a time.
- **Pattern source / pack** — a named, curated exemplar pack of HTML/CSS idioms conditioning what the
  model authors (PRD-G2). The committed form is a `GenuiPatternPack` module (D8); the admin-visible
  form is its `EntryLibraryPack` projection (D4) plus hand-authored custom sources.
- **The bridge** — the closed agent↔frame postMessage vocabulary (D7):
  `initialize · initialized · teardown · size-changed · host-context-changed · action`. Never an open
  message bus; no generic `tools/call`-equivalent (PRD §3).
- **Bootstrap** — the small HOST-owned script the srcdoc build injects ahead of any model byte. It owns
  the frame side of the bridge (handshake, `ResizeObserver`→`size-changed`, token application on
  `host-context-changed`) and exposes the one model-facing API, `genui.action(name, payload)`. Model
  code never speaks raw postMessage shapes; the bootstrap is the vocabulary's single frame-side home.
- **Opaque origin** — the unique origin a sandboxed srcdoc frame gets when `allow-same-origin` is
  ABSENT: every same-origin check against the host fails by construction; storage APIs deny.
- **Fail-closed / never-paint** — anything that cannot be proven contained (oversize payload, malformed
  envelope, an environment where the sandbox posture cannot be established) never paints (PRD-G3). The
  turn's prose/progress channels are unaffected — degrade, never a protocol break.

## 3. Requirements

Normative per RFC 2119; each carries an ID, an upstream trace, and acceptance criteria. Acceptance
criteria are checkable predicates — a command, a standing test, a grep, or a named manual run.

### 3.1 The wire kind (D6, ruled)

**SPEC-R1 — The reserved `genui` line: shape, disjointness, whole-line rejection.** The wire kind MUST
be a single JSON line `{"genui":{"surfaceId": string, "html": string}}` on the SAME turn stream the
transport already returns — a THIRD reserved kind beside `A2uiServerMessage` lines and `a2uiMeta`
lines. It MUST carry NO `version` key and NO `a2uiMeta` key, and the reader MUST reject any line
carrying either (the `meta-line.ts` disjointness proof, mirrored — `dispatch()`'s version gate keeps
the defense-in-depth: a genui line leaking to the renderer routes to `VERSION_UNSUPPORTED`, returned
not thrown). A pure, zero-dep `readGenuiLine(line)` / `isGenuiLine(line)` pair (the `readMetaLine`
shape) MUST be the ONE implementation both producer and client use; it never throws. Validation is
STRUCTURAL ONLY: well-formed JSON object · `genui` key an object · `surfaceId` a non-empty string ·
`html` a string · `html` within the SPEC-R2 byte cap. A line carrying the `genui` key that fails ANY
check MUST be rejected WHOLE — never partially honored, never fed to `validateA2ui`, never a crash.
Producer-side, `produce()` MUST peel genui candidate lines from raw model output BEFORE
`heal`/`validateA2ui` (the meta-line peel precedent); a structural failure MAY feed back ONE bounded
self-correct round naming a produce-layer failure code (`GENUI_ENVELOPE` / `GENUI_SIZE` — carried on
`TurnTrace.failureCodes`, NEVER joining the protocol's closed `ErrorCode` union; the `FEED_SCOPE`
precedent), and on exhaustion the genui line is DROPPED while the turn's note/A2UI lines stand —
degrade, never halt. A turn MUST carry AT MOST ONE genui line; subsequent ones in the same turn are
dropped + counted (`GENUI_MULTIPLICITY`). Client-side (defense-in-depth) the identical structural
checks reject-whole + count, with no self-correct machinery. *(→ PRD-G3; PRD §4 D6; ADR-0088's
one-stream/disjoint-kinds law)*
- **AC1** *Given* `readGenuiLine`, *when* fed a well-formed envelope, *then* it round-trips
  `{surfaceId, html}`; *given* a line with a `version` key, an `a2uiMeta` key, a non-object `genui`, an
  empty/missing `surfaceId`, a non-string `html`, or an over-cap `html`, *then* it returns `undefined`
  (whole-line rejection, never throws) — a deterministic unit test, `npm test` green.
- **AC2** *Given* a stub `produce()` run whose raw output carries meta-line + genui line + A2UI lines,
  *when* it completes, *then* the genui line is peeled before `heal`/`validateA2ui`, ships intact, and
  the A2UI lines validate exactly as before; *given* a malformed genui candidate, *then* one bounded
  feedback round runs and exhaustion drops ONLY the genui line (note + A2UI lines ship; no
  `ProduceHalt`); *given* two genui lines in one raw turn, *then* only the first ships and
  `GENUI_MULTIPLICITY` lands on the trace — `npm test` green, no live model.
- **AC3** *Given* a genui line fed directly to the renderer's `dispatch()` (defense-in-depth), *then*
  its missing `version` key routes it to `VERSION_UNSUPPORTED`, returned not thrown — fault-isolated,
  never a crash (the existing sibling-SPEC guarantee, asserted for this kind).

**SPEC-R2 — Atomic, size-capped, validation honestly narrowed.** A GenUI payload MUST be ONE whole
HTML document per surface per turn, delivered ATOMICALLY on a single line — NEVER chunked, streamed,
or incrementally applied (sanitizing/CSP-validating a partial HTML document mid-parse has no safe
precedent — PRD §4 D6; srcdoc replacement is atomic by construction). Progressive UX MUST come from the
existing turn-progress meta-lines (a `content`/pending stage while the document is authored), never
from partial HTML. The size cap is **`GENUI_MAX_HTML_BYTES = 524_288`** (512 KiB, measured on the
UTF-8 byte length of the `html` string). Rationale, stated so the number is revisable on evidence
rather than folklore: (a) ≈128k tokens of raw output at ~4 bytes/token — above any single-turn output
budget the provider registry ships, so the cap never truncates a legitimate turn; (b) an order of
magnitude above what any curated exemplar produces, so headroom is real; (c) small enough that a
session holding several surfaces stays trivially bounded and an adversarial/runaway payload cannot
balloon memory. An over-cap payload is rejected WHOLE (SPEC-R1), never truncated-and-rendered.
*(→ PRD-G3; PRD §4 D6)*

**The honest narrowing of live-agent SPEC-R5 (validate-then-stream).** `validateA2ui` parity does NOT
extend to an opaque HTML payload, and this SPEC MUST NOT pretend it does. For the genui kind ONLY:
wire-time validation narrows to the STRUCTURAL envelope (SPEC-R1's checks + the byte cap), and the
SEMANTIC fail-closed leg moves to RENDER time — containment (SPEC-R3/R4's sandbox + CSP posture) is
what precedes paint, not schema validity. The A2UI kinds are UNTOUCHED: their lines still fully
validate before any of them streams. **Applied to
[`./a2ui-live-agent.spec.md`](./a2ui-live-agent.spec.md)'s header as a real dated amendment
(2026-07-24, upon Kim's D6 adoption — that file's own versioned-amendment pattern, v0.7→v0.8),
verbatim:**

> **Amendment (GenUI, ADR-pending — docs-only on this file):** the turn stream gains a THIRD reserved
> line kind, `{"genui":{surfaceId, html}}` (genui-surface SPEC-R1/R2). SPEC-R5's validate-then-stream
> law is UNCHANGED for every A2UI content line, and SPEC-N4's filter-before-ingest rule covers the new
> kind identically (no `version` key ⇒ `VERSION_UNSUPPORTED` fault isolation holds). SPEC-R5's SCOPE
> statement narrows honestly for the genui kind ONLY: its payload is opaque HTML — `validateA2ui`
> parity does not apply; wire-time validation is the structural envelope + byte cap, and the semantic
> fail-closed leg (containment before paint) lives at render time per genui-surface SPEC-R3/R4. The
> genui kind never enters `heal`/`validateA2ui`, the corpus, or the `allLines` path.

- **AC1** *Given* a genui envelope split across two lines, a truncated line, or any partial form,
  *when* the client filter processes the stream, *then* NOTHING paints for that surface, the fragment
  is rejected whole + counted, and the turn's note/progress render unaffected — a deterministic test,
  `npm test` green.
- **AC2** *Given* an `html` payload of exactly `GENUI_MAX_HTML_BYTES` bytes, *then* it is accepted;
  *given* one byte more, *then* it is rejected whole and never paints — a boundary unit test,
  `npm test` green.
- **AC3** *Given* the sibling SPEC after D6 adoption, *when* read, *then* it carries the drafted
  amendment above verbatim (a docs-only edit in the adoption-wave change) — until then this clause is
  the amendment's single home and the sibling file is UNTOUCHED.

### 3.2 `ui-sandbox-frame` (D9)

**SPEC-R3 — The sandbox posture: `allow-scripts` alone, opaque origin, every exclusion named.**
`ui-sandbox-frame` MUST be a new light-DOM FACE control in `@agent-ui/components` wrapping the ONE
native `<iframe srcdoc>`, and the sandbox attribute set MUST be exactly **`sandbox="allow-scripts"`**.
With `allow-same-origin` absent, the srcdoc document gets a unique OPAQUE origin: every same-origin
check against the host fails by construction and storage APIs (`localStorage`, cookies, IndexedDB)
deny — the load-bearing containment fact. The full matrix — every excluded token stays excluded, each
for a stated mechanical reason, and widening ANY row is a SPEC amendment + a Kim ruling, never a build
convenience:

| Token | v1 | Why it stays excluded |
|---|---|---|
| `allow-scripts` | **IN** | D1: model-authored script executing inside the boundary IS the feature. |
| `allow-same-origin` | OUT | With scripts enabled it would collapse the boundary — same-origin reach to the host document/storage is the exact escape PRD-G3 forbids. The one permanently-closed row (PRD §3 "not trusted DOM"). |
| `allow-top-navigation` (+ `-by-user-activation`, `-to-custom-protocols`) | OUT | Top navigation is the classic hijack; no GenUI need — the bridge `action` is the sanctioned outward channel. |
| `allow-popups` (+ `allow-popups-to-escape-sandbox`) | OUT | A popup exits the visual containment story and (escape variant) sheds the sandbox entirely. A future link-out is a bridge-vocabulary question, not a popup. |
| `allow-forms` | OUT | Form submission is navigation by another door; generated UI commits through `action` instead. |
| `allow-modals` | OUT | `alert`/`confirm`/`prompt` block the HOST's event loop in some engines — a containment-UX break; generated UI owns its own DOM. |
| `allow-downloads` | OUT | Generated content writing files to the user's disk is unearned reach. |
| `allow-pointer-lock` / `allow-orientation-lock` / `allow-presentation` | OUT | Device/display capture — no v1 need; default-deny. |
| `allow-storage-access-by-user-activation` | OUT | Same-origin storage machinery; moot under an opaque origin, kept explicitly OUT so the moot-ness is recorded, not accidental. |

If the environment cannot establish this posture (no `sandbox` support, srcdoc unavailable), the
control MUST take the never-paint path (SPEC-R5). *(→ PRD-G3/G4; D9)*
- **AC1 (containment probe — the real-engine browser gate, every engine the standing browser config
  runs; never jsdom).** *Given* a mounted `ui-sandbox-frame` whose document attempts, from script:
  (a) `window.top.location` assignment, (b) `window.parent.document` access, (c) `localStorage` /
  `document.cookie` access, (d) a `<form>` submit, (e) `window.open`, *then* every attempt provably
  fails (throws or is inert — each probe reports its own outcome via the bridge `action` channel or a
  postMessage the test observes), the HOST page's URL/DOM/storage are byte-unchanged, and the host
  test continues — `npm run test:browser` green.
- **AC2** *Given* the rendered control, *when* inspected, *then* the iframe's `sandbox` attribute
  equals `allow-scripts` exactly (a literal assertion — any token drift is a red gate) and the
  descriptor/naming gates pass with the new control registered — `npm test` green.

**SPEC-R4 — CSP: the four MCP-Apps-shaped categories, default-deny absent, v1 defaults closed.** The
srcdoc build MUST inject a `<meta http-equiv="Content-Security-Policy">` policy composed from a
`SandboxFrameCspConfig` carrying the four categories (the PRD §4 D6 SHAPE borrow):
`connectDomains` → `connect-src` · `resourceDomains` → `img-src`/`font-src` · `frameDomains` →
`frame-src` · `baseUriDomains` → `base-uri`. An ABSENT category is DEFAULT-DENY. The composed v1
policy floor:

| Directive | v1 default | Notes |
|---|---|---|
| `default-src` | `'none'` | The floor everything else opts out of. |
| `script-src` | `'unsafe-inline'` | The whole document is model-authored — inline script IS the payload; CSP here bounds NETWORK reach and embedding, not XSS-within-the-payload (the sandbox + opaque origin own that boundary). |
| `style-src` | `'unsafe-inline'` | Same reasoning for generated CSS. |
| `img-src` | `data: blob:` + `resourceDomains` (https-only) | D7 ruled images in — self-contained images always work; EXTERNAL reach only via the allow-list. |
| `font-src` | `data:` + `resourceDomains` (https-only) | D7 ruled fonts in — same posture. |
| `connect-src` | `'none'` | **v1 default CLOSED** (recommended posture, PRD-G3 "allow-listed, never open"): no fetch/XHR/WebSocket until a ruled need opens named origins. |
| `frame-src` / `child-src` | `'none'` | **v1 default CLOSED**: no nested external frames. |
| `base-uri` | `'none'` | No `<base>` retargeting. |
| `form-action` | `'none'` | Belt beside SPEC-R3's `allow-forms` exclusion. |

Allow-listed entries MUST be https origins (scheme-pinned; no wildcards broader than a single
`*.example.com` label). Recorded meta-CSP limits (so nobody "fixes" them later): `frame-ancestors` and
the `sandbox` CSP directive are IGNORED in meta CSP — the iframe `sandbox` ATTRIBUTE (SPEC-R3) owns
sandboxing; reporting directives are unavailable — the drop counters (SPEC-R7) are the observability
substitute. *(→ PRD-G3; D7; PRD §4 D6)*
- **AC1** *Given* the CSP builder as a pure function, *when* fed an empty config, *then* the composed
  policy string carries every default row above verbatim; *given* `resourceDomains:
  ['https://img.example']`, *then* ONLY `img-src`/`font-src` gain it; *given* an `http:` or bare-host
  entry, *then* the builder rejects it (fail-closed) — deterministic unit tests, `npm test` green.
- **AC2 (network containment — browser gate).** *Given* a mounted frame whose script `fetch()`es a
  non-allow-listed https origin, *then* the fetch REJECTS (connect-src `'none'`), observed via the
  probe's own bridge report — `npm run test:browser` green, no real network dependency (the target
  never being contacted is the pass).

**SPEC-R5 — srcdoc lifecycle: build / replace / teardown, fail-closed never-paint.** The control's
document lifecycle MUST be: **build** — compose the srcdoc so that (a) the SPEC-R4 CSP is active
before any model byte evaluates, (b) the SPEC-R6 token bridge (custom properties + `color-scheme`) is
available to the first model style resolution, and (c) the bootstrap is installed before model script
runs (composition mechanics are LLD-tier; the ORDERING guarantees are the contract). **Replace** — a
new envelope for an ALREADY-RENDERED `surfaceId` rebuilds the whole srcdoc atomically; frame-internal
state is lost BY DESIGN (the atomicity law — one document per surface at a time); a best-effort
`teardown` bridge message precedes the swap. **Teardown** — disposal removes the iframe, unhooks every
listener/observer, and sends the advisory `teardown`; counters (SPEC-R7) survive for the test's read.
**Never-paint** — a rejected envelope (SPEC-R1/R2), an unestablishable posture (SPEC-R3), or a CSP
build failure (SPEC-R4 AC1) MUST render NO frame document; the control shows its inert fail-closed
state (a visible "not rendered" affordance, LLD-tier styling) and the turn's other channels proceed.
*(→ PRD-G3; D9)*
- **AC1** *Given* a second envelope for the same `surfaceId`, *when* applied, *then* the frame's
  document is the new payload, a frame-internal state marker set by the first document is GONE
  (replacement is a rebuild, proven not assumed), and exactly one `teardown` message preceded the swap
  — browser gate, `npm run test:browser` green.
- **AC2** *Given* each never-paint trigger (oversize, malformed, posture-unavailable stub), *then* no
  iframe document exists in the DOM, the fail-closed state is visible, and no error escapes to the
  page — `npm test` + browser gate green.

**SPEC-R6 — The token bridge + live theme.** At build, the srcdoc MUST expose the host's active
`--md-sys-*` custom-property values and `color-scheme` to the document root, so generated UI matches
the app theme from first paint (the PRD §4 token-bridge ruling; PRD-G5). On a live host theme change:
a frame that COMPLETED the SPEC-R7 handshake MUST receive `host-context-changed` carrying the fresh
token map + `color-scheme`, applied by the bootstrap WITHOUT a rebuild — frame-internal state
SURVIVES a theme flip. A frame that never completed the handshake (a document that broke the
bootstrap, or pre-handshake timing) falls back to a full srcdoc REBUILD — themed correctly, with the
stated, accepted consequence that frame-internal state is lost (the no-bridge fallback's honest cost,
PRD §8 m2). *(→ PRD-G5/G8)*
- **AC1 (theme-flip — browser gate).** *Given* a handshaken frame whose script wrote a state marker
  and painted with `var(--md-sys-color-primary)`, *when* the host theme flips, *then* the frame
  repaints with the new value, `color-scheme` follows, and the state marker SURVIVES; *given* a
  non-handshaken frame, *then* the rebuild fallback fires and the new document carries the new tokens
  — `npm run test:browser` green.

### 3.3 The bridge (D7 — closed vocabulary)

**SPEC-R7 — Six members, closed; out-of-vocabulary dropped + counted.** The bridge vocabulary is
CLOSED at exactly six members; growth is a SPEC amendment + a Kim ruling (the closed-table law,
ADR-0146's precedent):

| Member | Direction | Payload | Law |
|---|---|---|---|
| `initialize` | frame → host | `{}` | Sent by the bootstrap when the document is ready; opens the handshake. |
| `initialized` | host → frame | `{ tokens, colorScheme }` | The host's ack + initial context snapshot; completes the handshake. |
| `teardown` | host → frame | `{}` | Best-effort advisory before dispose/replace (SPEC-R5). |
| `size-changed` | frame → host | `{ height: number }` | The auto-height law: the host sets the frame's block-size to the reported content height, CLAMPED to the control's min/max size tokens (`--ui-sandbox-frame-{min,max}-block-size`; defaults LLD-tier) — an out-of-range or non-finite value is clamped/dropped, never trusted raw. Emitted by the bootstrap's `ResizeObserver`; no model cooperation required. |
| `host-context-changed` | host → frame | `{ tokens, colorScheme }` | Theme inward (SPEC-R6). |
| `action` | frame → host | `{ name, payload? }` | The ONE outward semantic channel (SPEC-R8). |

Transport mechanics: JSON messages over `postMessage`; the host MUST accept a frame message ONLY when
`event.source` is its own frame's `contentWindow` (identity check — the opaque origin reports `null`,
so origin comparison cannot authenticate; recorded so nobody "tightens" it into breakage) and MUST
post to the frame with `targetOrigin: '*'` (the only legal target for an opaque origin — same
recording). ANY frame message outside the six members, with a malformed payload, or from a foreign
source MUST be DROPPED + COUNTED on an observable per-control counter (`droppedMessages`), NEVER
surfaced as an event, NEVER a throw. There is explicitly NO generic `tools/call`-equivalent, NO eval
channel, NO host-DOM reach — the PRD §3 non-goal, enforced here. *(→ PRD-G8; D7; PRD §4 D6)*
- **AC1 (out-of-vocabulary probe — browser gate).** *Given* a mounted frame whose script posts
  `{type:'tools/call', …}`, a malformed `size-changed` (`height:'lol'`), a well-formed member from a
  crafted foreign `MessageEvent`, and raw garbage, *then* `droppedMessages` increments once per drop,
  NO DOM event is emitted for any of them, and the host page throws nothing — `npm run test:browser`
  green.
- **AC2** *Given* the vocabulary table, *when* the message-guard module's closed member set is
  compared against it, *then* they are SET-EQUAL (a planted seventh member fails — negative control)
  — `npm test` green.

**SPEC-R8 — `action` outward: the fleet's seventh event, routed to the turn loop.** The bootstrap
MUST expose exactly one model-facing outward API, `genui.action(name, payload?)`. On a valid `action`
message (`name` a non-empty string ≤ 128 chars; `payload` absent or JSON-serializable ≤ 16 KiB
serialized — an order of magnitude above any observed fleet event detail while keeping a hostile
frame from flooding the turn loop; evidence-revisable per §8 — else dropped + counted per SPEC-R7), `ui-sandbox-frame` MUST emit the fleet's **`action`**
CustomEvent (ADR-0153's seventh closed-vocabulary member — reused, never a new event name) with detail
`{ surfaceId: string, name: string, payload?: unknown }`; the control's descriptor declares
`events: [action]` and both fleet gates (`naming-gates` / `family-coherence`) already allowlist the
name. Routing: agent-admin's listener MUST frame the event as the NEXT USER TURN — a framed client
message carrying `surfaceId`, `name`, and the payload JSON verbatim (framing wording LLD-tier; the
three facts and their verbatim-ness are the contract) — dispatched through its EXISTING bounded
client-turn loop (the ERROR_TURN_BUDGET law): a GenUI action can never open an unbounded turn loop.
`size-changed`/`initialize`/handshake traffic MUST NOT reach the turn loop — only `action` is
semantic. *(→ PRD-G8; ADR-0153; the GH #63 bounded-loop law)*
- **AC1** *Given* a frame script calling `genui.action('choose', {id: 3})`, *then* the host emits ONE
  `action` CustomEvent with detail `{surfaceId, name:'choose', payload:{id:3}}` — browser gate green;
  *given* a 16 KiB+1 payload or a 129-char name, *then* no event, counter +1.
- **AC2** *Given* agent-admin with a stub transport, *when* an `action` event arrives, *then* the next
  dispatched turn's user content carries `surfaceId`/`name`/payload verbatim and the turn rides the
  existing bounded loop (budget observed) — `npm test` green, no live model.

### 3.4 Producer + packs (D8)

**SPEC-R9 — Pattern-source packs: typed, byte-pinned prompt-asset modules.** Pattern sources MUST live
in the producer layer as `GenuiPatternPack { id, label, description, body }` modules under
`packages/agent-ui/a2ui/src/agent/prompts/genui-packs/*.md` — frontmatter files (`id`/`label`/
`description` single-line + markdown `body`) loaded via the EXISTING ADR-0135 mechanics: the shared
`frontmatter.ts` parser and `readFileSync(new URL(…, import.meta.url))` at module load (Node-only,
never a browser bundle). A registry module (`genui-packs.ts`) exports the loaded `GENUI_PACKS`. The
prompt-asset discipline applies: each pack body is byte-pinned by an equivalence gate (edit ⇒
re-capture, the ADR-0135 verification shape) and budget-capped at **≤ 8 000 chars (~2 000 tokens,
`chars/4`)** — packs are exemplar-heavy (bigger than mini-skills' per-module budget) but exactly ONE
pack conditions a turn (D3 source-level pick), so the prompt grows by at most one budget regardless of
registry size. Root-barrel purity holds: the `@agent-ui/a2ui` `.` barrel carries ZERO pack bytes
(ADR-0137; packs ride the `./agent` surface only). *(→ PRD-G2; D8)*
- **AC1** *Given* every committed pack, *when* the standing gate runs, *then* frontmatter parses
  (`id`/`label`/`description` present, `id` kebab + unique), each body is ≤ the budget, and no body
  embeds an A2UI message marker (`"version":"v1.0"` never appears — a pack is HTML/CSS idiom prose,
  never an A2UI worked example) — `npm test` green.
- **AC2** *Given* the built `.` barrel, *when* grepped/traced, *then* zero pack bytes are reachable
  from it (the ADR-0137 gate pattern) — `npm test` green.

**SPEC-R10 — Prompt injection + the degradation law.** When (and only when) the admin's GenUI modality
is ENABLED, the system prompt MUST gain ONE composed genui block (the `miniSkillsBlock` structural
precedent): (a) the WIRE teaching — the exact envelope shape, one-whole-document atomicity, and the
byte cap; (b) the SANDBOX-REALITY teaching — opaque origin, no network beyond the allow-listed
categories, the `--md-sys-*` tokens available for theming, and `genui.action(name, payload)` as the
only outward channel; (c) the picked source's `body`, when one is picked. Modality OFF ⇒ the block
renders ZERO bytes and the composed prompt is byte-identical to today's (the zero-regression
discipline `mode`/`miniSkills` already prove). **Degradation law:** no source picked ⇒ the base block
alone — the MODALITY STILL WORKS on the base prompt (PRD §8 m4's cousin: a missing source degrades
capability quality, never availability). `GenUiMode` (ADR-0090) is NOT consulted, widened, or renamed
by any of this (§4 N2). *(→ PRD-G1/G2; D8)*
- **AC1** *Given* the prompt composer with the modality off, *then* the output is byte-identical to
  the pre-GenUI composition (across every `GenUiMode` value); *given* modality on + no source, *then*
  the base block (wire + sandbox teaching) composes with zero pack bytes; *given* a picked source,
  *then* the block additionally carries exactly that pack's `body` — a standing grammar-style test,
  `npm test` green, no live model.

**SPEC-R11 — The admin picker: source-level, `EntryLibraryPack`-projected, live-apply.** The Surface
Options GenUI row MUST gain a working pattern-source picker that picks at SOURCE level (D3 — no
per-pattern multi-select). Sources are entries of a new data-level kind `pattern-source` (the
`ENTRY_KINDS` extensible-by-data law — no new list/toggle/author code): committed packs project via a
pure `genuiPackLibrary(packs): EntryLibraryPack[]` into the EXISTING "From library" affordance (D4 — no
distinct registry type; a library add commits through the SAME `validateNewEntry` path), and
hand-authored custom sources (free-text `content` = the exemplar body) are equally legal — degradation
(SPEC-R10) covers the none-picked state either way. The pick and the modality toggle persist through
the Surface Options card's existing store discipline and LIVE-APPLY: the NEXT turn's prompt reflects
them, no reload (PRD-G1). The row's current disabled/"PRD pending" state stands until the B2 slice
ships. *(→ PRD-G1; D3/D4)*
- **AC1** *Given* the projection fn, *when* fed `GENUI_PACKS`, *then* each pack yields one
  `EntryLibraryPack` whose entries commit through `validateNewEntry` unchanged — `npm test` green.
- **AC2** *Given* agent-admin with the modality on and a source picked, *when* the next stub turn
  dispatches, *then* the composed system prompt carries that source's body; *when* the pick changes,
  *then* the following turn reflects it without reload (live-apply) — `npm test` green, no live model.

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Layering + catalog-invisibility + zero-dep | `ui-sandbox-frame` lives in `@agent-ui/components` (no new dependency, default barrels dependency-free); the a2ui catalog NEVER maps it — no agent can compose it via A2UI (PRD-G4; a standing check asserts no catalog entry resolves to it); `app` composes it into the conversation feed; the DAG gains no upward import (`layering.test.ts` trip-wires stand); the genui wire module is zero-dep pure in `a2ui/src/agent/`. |
| **SPEC-N2** | The naming law (the PRD §9 collision, resolved) | The wire/store/prose name is lowercase **`genui`**; NEW machinery types use the **`Genui*`** prefix (`GenuiEnvelope`, `GenuiPatternPack`); **`GenUiMode` keeps its name UNTOUCHED** — it is ADR-0090's per-turn prompt-DISPOSITION axis, shipped on the ratified `./agent` surface and riding `ProduceOptions.mode` through the proxy wire, so a rename is churn with no safety gain (rejected); its doc comment gains one clarifying line ("NOT the GenUI surface — see genui-surface SPEC"). Gate: a grep AC — no NEW exported symbol matches `GenUi[A-Z]` beyond the existing ADR-0090 family (today only `GenUiMode` matches the pattern; the family's `GEN_UI_MODES`/`DEFAULT_GEN_UI_MODE` sit outside it by case). |
| **SPEC-N3** | No live-model standing gate | Every AC above is deterministic (stub transports, committed packs, real-engine probes). PRD §8 **m3** (judge-scored ≥ 4/5 pack-idiom use) is a LIVE-MODEL judgment: it is realized as a judged corpus-rubric eval in the B3 wave (PRD-G6), a NAMED MANUAL run — never `npm test`/`test:browser` (the live-agent SPEC-R3 law). |
| **SPEC-N4** | Fail-closed observability | Every drop/rejection path increments an observable counter (`droppedMessages` on the control; `TurnTrace.failureCodes` producer-side) and NEVER throws across the page — silence is the failure mode this row forbids, crashing is the one PRD-G3 forbids. |

## 5. Typed contracts

```ts
// The wire (SPEC-R1/R2) — zero-dep, pure; the ONE reader both producer and client use.
interface GenuiEnvelope { genui: { surfaceId: string; html: string } }
const GENUI_MAX_HTML_BYTES: number; // 524_288 — UTF-8 bytes of `html` (SPEC-R2's stated rationale)
function readGenuiLine(line: string): GenuiEnvelope | undefined; // whole-line reject; never throws
function isGenuiLine(line: string): boolean;

// The CSP config (SPEC-R4) — the four MCP-Apps-shaped categories; absent ⇒ default-deny.
interface SandboxFrameCspConfig {
  connectDomains?: readonly string[];   // v1 default CLOSED ('none')
  resourceDomains?: readonly string[];  // D7: images/fonts — joins img-src/font-src
  frameDomains?: readonly string[];     // v1 default CLOSED ('none')
  baseUriDomains?: readonly string[];   // v1 default CLOSED ('none')
}

// The bridge (SPEC-R7/R8) — a CLOSED six-member vocabulary; growth = SPEC amendment + Kim.
type FrameToHost =
  | { type: 'initialize' }
  | { type: 'size-changed'; height: number }
  | { type: 'action'; name: string; payload?: unknown };
type HostToFrame =
  | { type: 'initialized'; tokens: Record<string, string>; colorScheme: string }
  | { type: 'host-context-changed'; tokens: Record<string, string>; colorScheme: string }
  | { type: 'teardown' };
// The fleet event (ADR-0153's `action`, reused): detail shape on ui-sandbox-frame.
interface GenuiActionDetail { surfaceId: string; name: string; payload?: unknown }

// Packs (SPEC-R9/R11) — ADR-0135 prompt-file mechanics; ./agent surface only (ADR-0137 purity).
interface GenuiPatternPack { id: string; label: string; description: string; body: string }
const GENUI_PACKS: readonly GenuiPatternPack[];
function genuiPackLibrary(packs: readonly GenuiPatternPack[]): EntryLibraryPack[]; // D4 projection
```

## 6. Build plan (the B1/B2 slice cut — for the build seat; B0 = D6 adoption, Kim)

- **B1 — the component (containment first).** `ui-sandbox-frame` in `@agent-ui/components`: SPEC-R3
  sandbox matrix · SPEC-R4 CSP builder · SPEC-R5 lifecycle + never-paint · SPEC-R6 token bridge ·
  SPEC-R7 bridge host-side + bootstrap + counters · SPEC-R8's event emission (routing stubbed).
  **Gates:** `npm run check` · `npm test` · `npm run test:browser` (the components shard; the
  containment/theme/out-of-vocabulary/lifecycle ACs land here, cross-engine) · descriptor/naming/
  family-coherence gates extended, never bypassed. B1 ships with the component catalog-invisible and
  UNREACHED by any wire — independently provable.
- **B2 — wire + producer + admin (capability second).** `genui-line.ts` + the `produce()` peel +
  at-most-one law (SPEC-R1/R2) · packs + budget/purity gates (SPEC-R9) · the prompt block +
  degradation (SPEC-R10) · the picker + projection + live-apply (SPEC-R11) · agent-admin's
  action→turn routing (SPEC-R8 AC2) · the sibling-SPEC amendment applied (SPEC-R2 AC3) · the SPEC-N2
  naming grep. **Gates:** `npm run check` · `npm test` · `npm run test:browser` (app + rest shards) ·
  the existing A2UI conformance suite ZERO regressions (PRD §8 m4).
- **B3 (out of this SPEC's contract):** judged corpus shard + docs page (PRD-G6; SPEC-N3's m3 home).

## 7. Traceability

| Requirement | Upstream |
|---|---|
| SPEC-R1, R2 | PRD-G3; PRD §4 D6 (ruled 2026-07-24); ADR-0088's one-stream law; live-agent SPEC-R5 (narrowed honestly) |
| SPEC-R3, R4, R5 | PRD-G3/G4; §4 D1/D7/D9 |
| SPEC-R6 | PRD-G5; the §4 token-bridge ruling; PRD §8 m2 |
| SPEC-R7, R8 | PRD-G8; §4 D7; ADR-0153; the bounded client-turn-loop law |
| SPEC-R9, R10 | PRD-G2; §4 D8; ADR-0135/0137; PRD §8 m4 (degradation) |
| SPEC-R11 | PRD-G1; §4 D3/D4 |
| SPEC-N1 | PRD-G4 |
| SPEC-N2 | PRD §9 (the naming collision, resolved here) |
| SPEC-N3 | PRD §8 m3; the sibling secret-free/deterministic-CI law |
| SPEC-N4 | PRD-G3 (fail-closed, observable) |

## 8. Open items (non-normative)

- **D6 adoption (Kim — B0).** The one gate on everything above; the header clause governs.
- **The sibling amendment's application timing.** Drafted verbatim in SPEC-R2; applied to
  `a2ui-live-agent.spec.md`'s header only at D6 adoption — deliberately NOT applied now, so an
  accepted contract never describes machinery that doesn't bind yet.
- **`connectDomains`/`frameDomains` stay closed (recommended).** Opening either is a one-row config
  change mechanically, but a RULED decision by law (SPEC-R3/R4's amendment clauses) — flagged so the
  first "just let it fetch" request routes to Kim, not a build.
- **The 512 KiB cap, the 8 000-char pack budget, and the 16 KiB action-payload cap are
  evidence-revisable.** All three carry stated rationale; tightening or loosening on real corpus
  data is a SPEC version bump, not silent drift.
- **Auto-height min/max token defaults** (`--ui-sandbox-frame-{min,max}-block-size`) are LLD/build-tier
  numbers; the clamp LAW is SPEC-R7's.

## 9 · Amendment (v0.3, SPEC-R9) — the prompt-loading parenthetical corrected to the shipped mechanics

Grounding: an independent review of the B2 build (commit c9eb8b5, 2026-07-25) verified that the build
seat's `genui-packs.ts` deliberately followed `process.cwd()`-relative `readFileSync` rather than
SPEC-R9's own literal parenthetical (`readFileSync(new URL(…, import.meta.url))`) — and confirmed the
deviation was CORRECT, not a build-seat improvisation to flag: `mini-skills.ts`/`system-prompt.ts`
(this SPEC's own cited "EXISTING ADR-0135 mechanics") already abandoned `import.meta.url`-relative
resolution after TKT-0044 measured it breaking under `npm run dev` — Vite bundles `vite.config.ts` and
its whole transitive import graph (`dev-proxy-plugin.ts` → `produce.ts` → the prompt-loading modules)
into one temp file, so an `import.meta.url`-relative path resolves against that TEMP file's location,
not the real source file's, throwing `ENOENT`. SPEC-R9's parenthetical was imprecise about which
concrete mechanism "the EXISTING ADR-0135 mechanics" names; this amendment corrects the parenthetical
to match the mechanism the phrase's own referent (the already-shipped, already-fixed code) actually
uses — an append-only correction, per the same discipline `shell-archetypes-m5.spec.md`'s SPEC-R15
amendment (§12 of that file) already established for this repo: name the gap, correct it forward,
never rewrite the ratified prose it sits beside.

**SPEC-R9 (corrected clause, supersedes the parenthetical only):** "...loaded via the EXISTING
ADR-0135 mechanics: the shared `frontmatter.ts` parser and `readFileSync` resolved relative to
`process.cwd()` (the repo-root-relative pattern `mini-skills.ts`/`system-prompt.ts` hold today,
NOT `readFileSync(new URL(…, import.meta.url))` — TKT-0044 measured that path breaking under `npm run
dev`'s Vite-bundled import graph) at module load (Node-only, never a browser bundle)." Every other word
of SPEC-R9, and every acceptance criterion under it, is UNCHANGED.

## 10 · Amendment (v0.4, SPEC-R10) — `GenuiSurfaceConfig.exclusive`, the genui-only-consumer signal

Grounding: a live defect report (`gen-ui-live.ts`'s render pane staying empty on a real "make a card
game" prompt, despite genuine agent activity and a genuine agent note in the chat pane) was traced —
statically; no live provider key was available in the build environment to reproduce interactively, but
the mechanism is proven deterministically with a stub provider, no live model
(`packages/agent-ui/a2ui/src/live-agent/genui-exclusive.test.ts`) — to a real prompt-composition gap
SPEC-R10 didn't cover: `genui-teaching.md`'s own "A2UI stays your default... reach for genui only when
the catalog genuinely cannot express the shape" framing is correct ONLY for a COEXISTENCE consumer that
can render both modalities (agent-admin's Surface Options, this SPEC's originally-scoped consumer, PRD
§6). `gen-ui-live.ts` is a GenUI-ONLY consumer (no A2UI catalog renderer at all — its own file banner:
"deliberately NOT an A2UI page") that this SPEC never distinguished from the coexistence case. A model
following the base framing for a catalog-expressible request (e.g. "make a card game" as buttons/text/
score readouts) ships real, VALID A2UI JSONL — which such a consumer's `readGenuiLine`-then-drop loop
(SPEC-R1's own whole-line rejection) silently discards, never rendering, never erroring: a real note
shows in chat, the render pane gets nothing. Independent review verified the fix below: SHIP.

**SPEC-R10 (amended clause, additive — supersedes nothing):** `GenuiSurfaceConfig` (the per-turn signal
SPEC-R10 names) gains one new optional field, `exclusive?: boolean` (`genui-surface-config.ts`), naming a
per-turn CONSUMER FACT rather than a stylistic preference: `true` means this turn's caller has NO A2UI
catalog rendering path at all. When set, `genuiBlock` (`system-prompt.ts`) composes ONE additional
override paragraph — AFTER the base wire/sandbox-reality teaching (a), (b) and BEFORE a picked source's
body (c) — stating plainly that any A2UI JSONL emitted this turn will validate but never be shown to
this caller, and that the ENTIRE response must therefore route through genui (or a note-only reply, if
nothing needs to render). `validateGenuiSurface` (`tools/agent/chat-validation.ts`, shared by both HTTP
transports) validates the field at the trust boundary with the SAME per-field-degrade posture
`sourceBody` already uses: a non-boolean value drops just that field, never the whole `genui` object.
**Degradation law, unchanged in kind:** `exclusive` absent or `false` composes ZERO additional bytes —
byte-identical to the pre-`exclusive` prompt (every existing coexistence caller, e.g. agent-admin, is
unaffected). `gen-ui-live.ts` is the one call site that sets it.
- **AC2** *Given* the prompt composer with `genui.enabled:true, exclusive:true`, *then* the composed
  block additionally carries the override paragraph naming the "no A2UI renderer" fact, positioned after
  the base teaching and before any picked source's body; *given* `exclusive` absent or `false`, *then*
  the composed block is byte-identical to AC1's own enabled-with-no-source case — a standing
  grammar-style test, `npm test` green, no live model
  (`packages/agent-ui/a2ui/src/live-agent/genui-exclusive.test.ts`). Every other word of SPEC-R10, and
  AC1 itself, is UNCHANGED.

## 11 · Amendment (v0.5, GH #316 / ADR-0162) — the agent-ui dogfood mode: docs-like frame assets + derived dogfooding prompt modules

Grounding: Kim's 2026-07-28 GH #316 ruling — agent-ui dogfooding is **a mode that can be enabled**,
and when on it dictates BOTH ends of the pipeline: the GenUI iframe loads a docs-like asset set
("just like our docs pages" — `site/pages/_page.ts`'s cascade: foundation tokens CSS → per-component
CSS → the self-defining `ui-*` controls → the icon pack), and the LLM payload gains dogfooding
knowledge modules teaching the model to prefer fleet components and tokens. Off = today's behavior
byte-identical. The design intake's mechanical findings (recorded in ADR-0162's Context): inline
`<style>`/`<script>` already ride SPEC-R4's ruled `'unsafe-inline'` floor, so the docs-like setup
needs NO CSP or sandbox change; CSS alone cannot reproduce a docs page (light-DOM JS-built anatomy);
a bundle executing inside the boundary adds zero capability the boundary doesn't already grant
untrusted script.

**SPEC-R10 (amended clause, additive — supersedes nothing):** `GenuiSurfaceConfig` gains one new
optional field, **`dogfood?: boolean`** (`genui-surface-config.ts`) — the per-turn "this turn's GenUI
frame carries the agent-ui runtime" fact. When set (and `enabled` is true), `genuiBlock`
(`system-prompt.ts`) composes ONE additional dogfood segment, positioned AFTER the base
wire/sandbox-reality teaching (a)/(b) — and after the `exclusive` override when both are set — and
BEFORE a picked source's body (c). The segment is SPEC-R13's two-part module. `validateGenuiSurface`
(`tools/agent/chat-validation.ts`, both HTTP transports) validates the field with the SAME
per-field-degrade posture `sourceBody`/`exclusive` use: a non-boolean value drops just that field.
**Degradation law, unchanged in kind:** `dogfood` absent or `false` composes ZERO additional bytes —
byte-identical to the pre-`dogfood` prompt for every existing caller. The genui WIRE (SPEC-R1) is
UNTOUCHED: the envelope never carries the flag — the consumer that enabled the mode owns the frame it
mounts and supplies SPEC-R12's assets itself (recorded consequence: a mode-on transcript replayed by
an asset-less consumer renders unstyled fleet markup — degraded fidelity, never a protocol break).
- **AC3** *Given* the prompt composer with `genui.enabled:true, dogfood:true`, *then* the composed
  block additionally carries the dogfood segment (teaching + derived inventory), positioned after the
  base teaching (and after the `exclusive` paragraph when both are set) and before any picked
  source's body; *given* `dogfood` absent or `false`, *then* the composed block is byte-identical to
  the pre-`dogfood` composition case-for-case (including `exclusive`'s own AC2 cases) — a standing
  grammar-style test, `npm test` green, no live model. Every other word of SPEC-R10, and AC1/AC2, is
  UNCHANGED.

**SPEC-R12 — Frame assets: the docs-like pair, inline-only, posture-neutral, lockstep-pinned.** The
dogfood frame asset MUST be a committed, GENERATED pair — (a) the flattened foundation + component
CSS text and (b) ONE self-contained IIFE bundle of the `ui-*` component barrel + the default icon
pack (the `_page.ts` cascade's members [1][2][3][3b]; `router`/`code`/app-chrome excluded by
construction — catalog-invisibility's cousins, and CodeMirror's lazy load cannot ride the closed
CSP) — exported from an opt-in subpath of `@agent-ui/components` (never a default barrel: the
ADR-0040/0049 budgets stand). `ui-sandbox-frame` MUST gain a property-only `assets` prop
(`{ css?: string; js?: string }`; property-only for the same reason `csp` is), and `buildSrcdoc`
MUST inject the pair so the head order is: CSP meta → token `<style>` → asset `<style>` → bootstrap
`<script>` → asset `<script>` → the model document's own head children — assets AFTER the host
prelude (CSP active first, tokens resolvable by asset CSS), BEFORE any model byte. Delivery is
INLINE ONLY: `sandbox`/CSP rows stay EXACTLY SPEC-R3/R4's (a delivery needing `blob:`, a served
origin, or any directive widening is REJECTED by this clause — reopening it is a SPEC amendment + a
Kim ruling, the closed-table law). The SPEC-R2 cap stays measured on the WIRE `html` string only —
host-side asset injection never counts against it. Pinning: the pair is generated from the installed
source tree by a checked-in script; a standing freshness gate rebuilds and compares (the
theme-provider committed-fixture precedent) so a fleet edit that changes built output is RED until
the asset regenerates. The built pair MUST reference no external `url(...)`/import beyond `data:`
(a standing grep gate — the closed-network posture proven, not assumed). *(→ PRD-G3; ADR-0162)*
- **AC1 (upgrade probe — browser gate).** *Given* a mounted `ui-sandbox-frame` with the dogfood
  assets and an `html` whose body is fleet markup (e.g. a `ui-button` + a `ui-card`), *then* inside
  the frame `customElements.get('ui-button')` resolves, the button's `[data-part]` anatomy exists,
  and its computed styles resolve fleet tokens (a `--md-sys-color-*`-derived value, not UA defaults);
  *given* the same markup WITHOUT assets, *then* the elements stay unknown (today's behavior,
  unchanged) — `npm run test:browser` green.
- **AC2 (containment unchanged — browser gate).** *Given* a dogfood-asset frame, *then* the SPEC-R3
  AC1 containment probes (top-nav, parent DOM, storage, form submit, `window.open`) and the SPEC-R4
  AC2 network probe pass IDENTICALLY, and the iframe's `sandbox` attribute still equals
  `allow-scripts` exactly — `npm run test:browser` green.
- **AC3 (freshness + purity).** *Given* the standing gates, *then* the committed pair equals a fresh
  build's output (rebuild-and-compare) and contains no non-`data:` external reference — `npm test`
  green (build-shelling test project), red on any stale or impure asset.

**SPEC-R13 — Dogfood prompt modules: hand prose byte-pinned, derived inventory drift-gated,
set-equal with the frame.** The dogfood segment MUST compose two parts: (a)
`prompts/genui-dogfood-teaching.md` — hand-authored, loaded via the ADR-0135 `process.cwd()`
mechanics, byte-pinned by a NEW field in `prompt-equivalence.baseline.json` (the `genuiPacks`
shape: edit ⇒ deliberate re-capture), budget ≤ 8 000 chars (the SPEC-R9 pack tier); (b) a DERIVED
fleet inventory (`dogfoodInventory()`) composed at call time from the fleet's `{name}.md`
descriptors via the ONE ADR-0004 parser — tag, one-line role, key attributes/enums — drift-gated
against the descriptors (the ADR-0071/`prompt-drift` discipline) and NEVER byte-captured (a fleet
edit updates the composed prompt without re-capturing any baseline), budget ≤ 19 000 chars
(v0.9: revised from ≤ 18 600 on real corpus evidence per §8 — ADR-0225/GH #1478's `ui-playing-card`
control mint grew the descriptor-derived inventory to a measured 18 706;
v0.8: revised from ≤ 18 100 on real corpus evidence per §8 — ADR-0223's Fill-by-Default `inline`
attribute rows across the slice-0..2 flipped controls [measured 18 179] plus ADR-0224/GH #1429's
`ui-service-card` control mint [measured 18 296 pre-slice-2] grew the descriptor-derived inventory;
v0.7 revised from ≤ 16 000 on real corpus evidence per §8 — the 2026-08-19 nine-ADR campaign's six
control mints [ADR-0210/0213/0214/0216/0219/0220] grew the descriptor-derived inventory to a measured
17 958; evidence-revisable per §8, enforced by a standing test). The tags the SPEC-R12 bundle self-defines
and the tags the inventory teaches MUST be SET-EQUAL (one standing test; the derive-from-one-source
law — the prompt can never teach a component the frame doesn't define, or vice versa). Existing
byte-pinned compositions are UNTOUCHED: mode-off composes zero bytes, so the baseline's four
composed prompts hold without re-capture. *(→ ADR-0162; the GH #316 ruling; ADR-0071/0135 —
PRD gap recorded honestly: dogfooding enters at the issue/ADR tier; no PRD goal names it, and no
PRD-G tag is stretched to pretend one does.)*
- **AC1** *Given* the equivalence gate, *then* the teaching body is byte-identical to its captured
  baseline field and ≤ budget; *given* the drift gate, *then* the derived inventory names exactly
  the descriptor-declared tags/attributes (a planted phantom row fails — negative control) and is
  ≤ budget — `npm test` green.
- **AC2** *Given* the set-equality gate, *then* bundle-defined tags ≡ inventory-taught tags (a
  planted extra tag on either side fails) — `npm test` green.

**SPEC-R11 (note, additive):** the Surface Options GenUI row gains a dogfood toggle beside the
pattern-source picker, persisting through the card's existing store discipline and LIVE-APPLY (the
next turn's prompt + frame assets reflect it, no reload); `gen-ui-live` surfaces the same toggle in
its options strip. Persona config is NOT a home for the flag (the ADR-0138 voice/capability
boundary). Every other word of SPEC-R11 is UNCHANGED.

## 12 · Amendment (v0.6, GH #342 + #346 / ADR-0162) — SPEC-R13(b)'s derivation: a parity-proven reader, and family siblings inside "descriptor-derived"

Grounding: two independent review findings against the shipped SPEC-R13(b) build, both routed as
issues rather than patched in prose because both sit on ratified contract text, and both ruled by Kim
on 2026-07-28 as ONE slice — the #346 code change is what makes the #342 wording true.

**GH #342 — "the ONE ADR-0004 parser" is unsatisfiable as written.** `gates.test.ts`'s ADR-0137
clause-8 SDK-FREE/ZERO-DEP leg bars EVERY bare package specifier under `src/agent/` (relative or
`node:*` only, ADR-0107) — including `@agent-ui/components/descriptor`, the parser this clause names.
Confirmed mechanically: planting that import into a non-allowlisted `src/agent/` file reds the gate.
The shipped build therefore carries a LOCAL minimal frontmatter reader inside `dogfood-inventory.ts`,
and the clause silently described something the build cannot legally do. Review also proved the
deviation was not cosmetic: the local reader's first cut disagreed with the real parser on 4 real
attributes across 2 real descriptors (a quoted empty-string enum member, ADR-0083's `landmark` edge
case, left unquoted) — so the anti-drift guarantee the single-parser rule existed to deliver was
genuinely false, exactly as predicted. **Kim's ruling: fork (a) — amend the SPEC to require a
parity-proven reader. ADR-0137's zero-dep fence stays UNCHANGED; no exception is carved.**

**GH #346 — a `tag:`-only derivation structurally cannot see five shipped tags.** ADR-0004's
descriptor format has no machine-readable field for a compound family's sibling elements: `card.md`'s
own frontmatter says the region sub-elements are "documented in the prose body", and `tabs.md` covers
`ui-tab`/`ui-tab-panel` the same way. So `DOGFOOD_TAGS` (64, scanned from the real built bundle) and
the descriptor-derived teaching set (59) were not set-equal on real, current, unmodified data, and
SPEC-R13 AC2's exact set-equality gate could not be built as written — it shipped with an interim,
explicitly-temporary allowlist naming those five. **Kim's ruling: fork (1) — extend the derivation to
scan `.define()` sites. ADR-0004's schema stays UNCHANGED.**

**SPEC-R13(b) (amended clause, supersedes the derivation sentence only):** "...(b) a DERIVED fleet
inventory (`dogfoodInventory()`) composed at call time from the fleet's `{name}.md` descriptors — read
by a reader PROVEN EQUIVALENT to the ADR-0004 parser (`@agent-ui/components/descriptor`) by a standing
parity gate, `packages/agent-ui/a2ui/src/live-agent/dogfood-inventory-parity.test.ts`, which runs both
readers over every committed descriptor and asserts attribute-for-attribute agreement; a local reader is
LAWFUL under this clause if and only if that gate stands and is green, because the ADR-0137/ADR-0107
zero-dep fence bars `src/agent/` from importing the parser directly — and EXTENDED, per GH #346, to
also teach each compound family's SIBLING tags, derived by scanning that family's own folder for
`.define('ui-x'` call sites (the SAME scan `scripts/build-dogfood-assets.mjs`'s `extractTags` uses for
`DOGFOOD_TAGS` — one technique, never a second, disagreeing one), attached to their PARENT descriptor's
entry under its summary and attributes, never as rows of their own (a sibling has no descriptor, hence
no summary and no attributes to teach) — tag, one-line role, key attributes/enums, family siblings —
drift-gated against the descriptors (the ADR-0071/`prompt-drift` discipline) and NEVER byte-captured..."
Every other word of SPEC-R13, including budgets (≤ 8 000 / ≤ 16 000 chars) and the set-equality
requirement itself, is UNCHANGED.

**Two properties this amendment deliberately KEEPS, and one it retires:**

- **Kept — the anti-drift guarantee.** "Descriptor-derived" still means the DATA is the real committed
  `.md` text, never hand-transcribed; only the PARSER is local, and the parity gate is what makes that
  distinction checkable rather than merely asserted. A reader without a standing parity gate does not
  satisfy this clause.
- **Kept — one derivation technique for sibling tags.** The `.define(` scan is the bundle generator's
  own, reused; #346's root cause was two derivations disagreeing, and the set-equality gate is what
  holds the two copies to the same answer over the real tree.
- **Retired — the interim allowlist.** SPEC-R13 AC2's set-equality gate is restored to TRUE three-way
  equality with no named exceptions; `KNOWN_UNDOCUMENTED_FAMILY_TAGS` is deleted.

- **AC2 (restated, no longer caveated).** *Given* the set-equality gate, *then* bundle-defined tags ≡
  inventory-taught tags EXACTLY — no allowlist, no subset-only leg, no named exceptions — and a planted
  extra tag on EITHER side fails (both directions proven by negative control: neutering the sibling scan
  reds with "shipped but not taught: ui-card-content, ui-card-footer, ui-card-header, ui-tab,
  ui-tab-panel"; a planted `.define` in a real control reds with "taught but not shipped") — `npm test`
  green. **The gate's three legs MUST be mechanism-distinct** (GH #351 F3): a static scan of the built
  bundle, the derivation's own source read, and a RUNTIME observation of what the barrel registers
  (`customElements.define` interception). A leg written as a second source scan of the same tree with the
  same technique is a TRANSCRIPTION — it agrees with its original by construction and reduces the gate's
  real width. Proven, not assumed: with comment-stripping disabled, a commented-out `.define('ui-x')`
  planted in a real control passed BOTH source re-scans and was caught only by the bundle leg; under the
  runtime leg it reds directly.
- **AC4 (new — the parity gate is itself a requirement, not an implementation note).** *Given* the
  standing parity gate, *then* the local reader's `attributes[]` equal the real ADR-0004 parser's, file
  for file, over every committed descriptor, and the two readers' frontmatter-fence extraction agrees —
  `npm test` green, red on any divergence. Removing or skipping this gate makes the local reader
  UNLAWFUL under SPEC-R13(b) as amended.
