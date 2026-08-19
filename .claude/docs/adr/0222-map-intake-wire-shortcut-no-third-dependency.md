# ADR-0222 — Map intake resolves at the WIRE-SHORTCUT gate: no third runtime-dependency exception; v1 map turns are static imagery through the shipped `Image` row (`ui-image`), interactive map engines deferred behind a future ADR gated on real demand (GH #1376)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-19 |
> | **Proposed by** | planning-leader seat (design intake GH [#1376](https://github.com/kimgranlund/agent-ui/issues/1376) — the A2UI Map intake, parked on the third-dependency-exception question; mobilized 2026-08-19 — this record runs the ruled runtime-dependency-exception test against the full candidate space and recommends the wire-shortcut arm) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-19, via the [`ratify ADR-0222` utterance](https://github.com/kimgranlund/agent-ui/issues/1376#issuecomment-5346418428) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification (no build wave — that is the point of the recommended arm): GH [#1376](https://github.com/kimgranlund/agent-ui/issues/1376) un-parks and closes with this ruling (the "full component-design + catalog intake (likely size:big)" branch does NOT fire at v1) · `site/lib/docs-grammar.test.ts` S8 `KNOWN_GAPS` (221 enters the Set in this SAME change — the already-RELEASED number becomes a mechanical gap the moment this file lands at 0222; the Set's own comment declared it permanent before this record existed) · `.claude/skills/component-patterns/references/patterns-table.md` (the dependency-exception row gains its first DECLINED worked instance — the test resolving at gate (iii) instead of reaching adoption) · an OPTIONAL size:small teaching follow-up (one corpus seed + prompt-inventory teaching for the map-turn composition, clause 2) filed only if/when corpus demand appears — deliberately NOT booked as an on-ratification repair |
> | **Supersedes / Superseded by** | None. Relates [ADR-0139](./0139-codemirror-editor-first-runtime-dependency.md) + [ADR-0202](./0202-pdfjs-second-runtime-dependency-exception.md) (the two worked ADOPTION instances of the four-gate test this record is the first DECLINE of) · [ADR-0107](./0107-chart-family-v1-scope.md) (the "runtime dependency in costume" law + the hand-rolled display-class floor, clause 4's escalation rung) · [ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) (inert-data vendoring — inapplicable, stated in Context) · [ADR-0069](./0069-a2ui-live-agent-demo-shape.md) / [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (the plain-fetch/wire-shortcut precedent this decision RIDES, and the key-never-in-browser trust boundary clause 3 applies) · [ADR-0119](./0119-code-prose-family-v1-scope.md) (the deliberately-small hand-rolled law) · [`../spec/a2ui-runtime.spec.md`](../spec/a2ui-runtime.spec.md) SPEC-N5 (the zero-runtime-dependency invariant this record leaves untouched) · [`../../skills/component-patterns/references/patterns-table.md`](../../skills/component-patterns/references/patterns-table.md) (the four-gate test's canonical row) · [`../../skills/component-design/references/mint-vs-compose.md`](../../skills/component-design/references/mint-vs-compose.md) (why no `Map` catalog row is minted, clause 2) |

## Context

**The parked intake (GH #1376, verbatim gist).** Maps are heavily used in chat-embedded agent
surfaces — OpenAI's Apps SDK components page carries a whole fullscreen-map class — but a map
engine breaks the zero-dependency pillar (`CLAUDE.md` line 5; SPEC-N5 in
[`a2ui-runtime.spec.md`](../spec/a2ui-runtime.spec.md)). The intake was filed and immediately
parked because the REAL question is not "which map widget" but "is a THIRD ruled
runtime-dependency exception earned" — and that question has a standing, twice-proven test whose
final gate belongs to Kim alone. This record runs that test in the open and puts the ruling in
front of him.

**The candidate space, enumerated.** Four arms, all real:

- **(a) A full map engine** — Leaflet (~42 KB gz + CSS, DOM/tile-based) or MapLibre GL
  (~230 KB gz, WebGL vector runtime), lazy-loaded behind an opt-in subpath on the ADR-0139/0202
  shape. The heavyweight arm.
- **(b) Static map imagery via a tile/embed URL on the existing `ui-image`** — zero new
  dependencies, zero new components; the agent composes a static-map URL into the shipped `Image`
  catalog row's `src`. The wire-shortcut arm.
- **(c) A hand-rolled minimal SVG/canvas static-map primitive** — Web-Mercator lon/lat→tile math
  is genuinely small; a display-class `ui-map-static` composing tile URLs plus SVG markers would
  be zero-dep. The ADR-0107 smallest-floor arm.
- **(d) Defer entirely** — WONTFIX-for-now, the intake stays parked.

**The four-gate test, run** (the ruled runtime-dependency-exception test — ADR-0139 established
it, ADR-0202 reused it verbatim, and it now lives as a patterns-table row; gates in order):

1. **Category** — display of static content (hand-rolled-small is real: ADR-0107 charts, ADR-0119
   highlight/markdown) or an interactive/interpretive runtime (hand-rolled-small is not real:
   ADR-0139's editor engine, ADR-0202's PDF interpreter)? **The map ask SPLITS under this gate,
   and that split is the whole finding.** An interactive slippy-map engine (tile pyramid,
   projection, gesture/inertia pan-zoom, vector styling, WebGL) is squarely the interpretive-
   runtime category — hand-rolling one is not real, exactly as it wasn't for CodeMirror. But the
   capability agents actually need in a chat turn at v1 — *show this location / these markers /
   this route as part of my answer* — is display-class: a static map image with a caption. The
   interactive arm is category-eligible for an exception; the display arm never needed one.
2. **Inert-data** (ADR-0066's icon-pack license) — fails for any map engine: Leaflet/MapLibre are
   executable runtime code, not compiled data tables; vendoring either would be "a runtime
   dependency in costume" (ADR-0107). The tiles themselves ARE data, but an unbounded,
   server-resident set — not vendorable at build time in any form.
3. **Wire-shortcut** (ADR-0069/0073's plain-fetch answer) — **PASSES, and is decisive: this is
   the first intake in the test's history where it does.** CodeMirror and pdf.js earned their
   exceptions precisely because "there is no network call to make instead — the capability IS the
   local parse" (ADR-0202's own wording). A map is the exact opposite: the rendering already
   lives server-side behind a URL. Static-map/tile imagery is addressable by plain URL; the
   browser's own `<img>` element speaks that wire natively; and the fleet already ships the
   loading posture — `ui-image` (`packages/agent-ui/components/src/controls/image/image.ts`), the
   URL-sourced content-image primitive with zero-CLS aspect boxing, native `loading`/`decoding`/
   `fetchpriority` hints, required `alt`, and a caption/scrim contract. A capability with a live
   wire shortcut does not exhaust the prior alternatives, so no exception is earned and the
   adoption arms never reach gate (iv).
4. **Kim's call alone** — reached here as a DECLINE rather than an adoption, and put to him
   anyway, deliberately: #1376 was parked on Kim's appetite for a third exception, so the
   un-parking ruling must be his even when the recommendation is "no". Ratifying this record
   rules that the third exception is NOT taken at v1 and fixes the escalation path a future
   intake must climb (clause 4).

**Demand evidence, stated honestly.** Zero map demand exists in the corpus today (#1376's own
evidence line). The OpenAI fullscreen-map guidance describes an app-class embed — a full
interactive surface owning gestures and viewport — which is beyond what any catalog widget row
would be asked to carry; the catalog-shaped residue of that pattern (a map image inside a card
with actions) is expressible today.

## Decision

**We will NOT adopt a third runtime dependency for maps. The four-gate test resolves at gate
(iii): the display capability has a live wire shortcut — agent-composed static-map imagery
through the shipped `Image` catalog row / `ui-image` — so no engine enters any `package.json`,
no new catalog type is minted, and the interactive-map question is deferred behind a future ADR
gated on demonstrated demand.** Five clauses.

1. **No third exception.** Neither `leaflet` nor `maplibre-gl` (nor any map engine) enters any
   `package.json`, on any subpath, lazy or otherwise. SPEC-N5 and the `CLAUDE.md` pillar sentence
   stay byte-untouched — a decline changes no wording (contrast ADR-0139/0202, each of which
   amended the pillar). The two-exception state (CodeMirror, pdf.js) remains the complete list.
2. **v1 map expression = the shipped `Image` row, no new catalog type.** An agent renders a map
   turn TODAY as `Image` (`src` = a static-map URL it composes, `alt` = the required location
   description, `fit`/`aspect`/`usageHint` as shipped — `catalog.json`'s existing row), typically
   inside a `Card` with caption text and actions. No `Map` catalog row is minted: a `Map` type
   whose renderer is `ui-image` plus a URL template is an `Image` alias — the mint-vs-compose
   TYPE arm (semantics+behavior must be inexpressible) fails on its face, and the URL-composing
   half a "real" row would need requires a provider pin this record refuses to ship (clause 3).
   If corpus demand appears, ONE teaching change (a corpus seed + prompt-inventory pattern for
   the map-turn composition) is a size:small follow-up — teaching, not minting.
3. **The trust/egress story — the load-bearing distinction between the arms.** A runtime
   map engine fetching tiles is a NEW egress class for this repo: programmatic, continuous,
   library-initiated third-party fetches (tens to hundreds of tile requests per pan/zoom
   gesture), streaming viewport coordinates to a tile host from repo-shipped code. Nothing in
   the fleet ships default egress today — ADR-0073's trust boundary keeps all provider egress
   behind the dev-proxy and keys out of the browser, and ADR-0202 restated the same sentence
   ("nothing about extraction may introduce a third-party network fetch"). Static imagery
   through `ui-image` inherits the EXISTING posture instead: one declarative, browser-native
   `<img>` fetch of an agent-authored URL — the same egress class as every `Image.src` the
   catalog already renders, with `ui-image`'s shipped lazy-loading hints and no JS fetch path.
   Two hard sub-rules: **(a)** the repo ships NO static-map URL template, provider pin, or
   default endpoint — provider choice and its usage terms stay wholly on the producer side (the
   agent/deployment composing the URL), exactly like any other remote asset URL today; **(b)** a
   KEYED static-map URL (Google/Mapbox static APIs embed the key in the query string) placed in
   repo code or docs-site examples would put a credential in client-visible markup — the
   ADR-0073 key-never-in-browser law makes any repo-shipped keyed template a non-starter,
   permanently.
4. **The deferral fence and its escalation ladder.** Interactive maps stay open behind a FUTURE
   ADR that must cite real demand evidence (corpus demand, a named consumer surface). The
   compliant escalation order when demand arrives: **first** arm (c) — a hand-rolled,
   display-class static-map primitive (`Web-Mercator` lon/lat→tile arithmetic is small and
   bounded; ADR-0107's smallest-floor discipline) IF first-class markers/framing earn a
   primitive beyond what `Image` composition gives; **only past that**, a fresh four-gate run
   for an engine — which would then legitimately clear gate (i) on the interactive category,
   exactly as CodeMirror did, and still land on Kim at gate (iv). Each future breach costs its
   own ADR (ADR-0139 fork F4's reasoning, unchanged).
5. **Size budget: zero.** This record adds no package bytes, no lazy chunk, no
   `scripts/measure-size.mjs` line-item, no `layering.test.ts` edge. For the record, the
   declined arm's price at intake-time published-dist figures: Leaflet on the order of ~42 KB
   gzipped plus its CSS (raster/DOM), MapLibre GL on the order of ~230 KB gzipped (vector/WebGL)
   — either would have been the third and LARGEST exception, taken for a capability with zero
   corpus demand and a live wire shortcut.

## Non-goals

- **Adopting any map engine now** — the declined arm; re-opening it is clause 4's future ADR,
  never a build-time judgment call.
- **A `Map` catalog type/row at v1** — clause 2's mint-vs-compose finding; no semantic alias rows.
- **A repo-shipped tile/static-map URL template, provider pin, geocoding, or routing** — clause
  3(a); the repo stays provider-silent.
- **The fullscreen interactive map app-embed class** (OpenAI's fullscreen guidance) — an
  app-surface question, not a catalog-widget question; out of scope for any arm here.
- **Offline/vendored tiles** — gate (ii)'s unbounded-set finding; not vendorable in any form.
- **Any change to SPEC-N5 or the `CLAUDE.md` pillar wording** — declines edit nothing.

## Consequences

- **GH #1376 un-parks and closes with this ruling.** The parked "full component-design + catalog
  intake (likely size:big)" branch does not fire; the intake's real question (the exception) is
  answered, and the residual capability (map turns) is expressible today at zero build cost.
- **Agents can render map turns immediately** via `Image`-in-`Card` composition — no build wave,
  no gate additions. The optional teaching seed (clause 2) is demand-gated, size:small, and
  separately filed if ever.
- **The four-gate test gains its first DECLINE instance**, proving the test prunes as well as
  admits — the patterns-table row cites it on ratification (Repairs).
- **Numbering housekeeping lands with this file:** 0222 makes the already-RELEASED 221 a
  mechanical gap, so `docs-grammar.test.ts` S8's `KNOWN_GAPS` gains 221 in the same change (its
  comment declared 215/218/221 permanent before this record existed).
- **Stale → re-verify at ratification:** nothing beyond the Repairs cell — no pillar sentence,
  no `package.json`, no measure-size baseline moves.

## Acceptance

This is an **intake ruling** ADR — one stage, no build wave:

- **Intake (this change):** this record passes the ADR gates (`site/lib/adr.test.ts` grammar,
  `site/lib/docs-grammar.test.ts` link sweep + S8 with the 221 allowlist edit) and
  `npm run check:scripts` stays green. **No code changes beyond the one-token `KNOWN_GAPS` edit;
  no `package.json` edit; no new file under `packages/`.**
- **On ratification:** `adr_ratify.py` flips Status + Ratified-by; the Repairs-cell items are
  booked per the GH #544 tracking-issue law (close #1376 with the ruling; patterns-table
  worked-instance cite).

## Alternatives considered

- **(a) A full map engine as the third lazy-loaded exception (Leaflet or MapLibre GL on the
  ADR-0139/0202 subpath shape).** Rejected: fails gate (iii) — a wire shortcut exists, so the
  prior alternatives are NOT exhausted and the exception is unearned regardless of how cleanly
  the clause-8 gate set could confine it. Aggravating facts: zero corpus demand (#1376's own
  evidence), a brand-new programmatic-egress class from library code (clause 3), and the largest
  chunk of any exception to date (clause 5). The interactive capability this arm uniquely buys
  has no consumer today.
- **(c) A hand-rolled static-map primitive now (`ui-map-static`: tile-grid composition + SVG
  markers, zero-dep).** Compliant with the pillar (display-class, ADR-0107's floor) but rejected
  NOW: zero demand means the build buys nothing `Image` composition doesn't already give, and a
  first-class primitive would bake a tile-provider ENDPOINT into repo code — default egress plus
  a usage-policy entanglement (public tile servers meter and restrict library-default traffic)
  that clause 3(a) refuses. Named instead as the FIRST rung of clause 4's escalation ladder.
- **(d) Defer entirely with no ruling (leave #1376 parked / WONTFIX silently).** Rejected: the
  intake was parked precisely FOR a ruling; silent deferral leaves the fork unresolved and the
  next map-shaped ask re-litigating from scratch. This record IS the deferral, done in the open,
  with the escalation path priced.
- **A `Map` catalog row mapping to `ui-image` (lat/lon/zoom props + a URL-composing catalog
  function).** Rejected: the URL composition forces a provider choice the repo refuses to pin
  (clause 3(a)); without it the row is an `Image` alias with no new renderer behavior — failing
  the mint-vs-compose TYPE arm that governs every minting (ADR-0220's own bar).
