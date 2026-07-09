# PRD — Content Component Family (code · hyperlink · disclosure)

> Status: **proposed · v0.1 (scope intake) · Owner: agent-ui** — authored 2026-07-08 by the design seat; this is an INTAKE, not a build authorization. Ratification = doc-review + Kim's fork answers on [ADR-0113](../adr/0113-content-family-v1-scope.md) / [ADR-0114](../adr/0114-text-hyperlink-href.md).
> Altitude: this document owns **why + what-should-exist** for the content family. The scope/contract-direction record is [ADR-0113](../adr/0113-content-family-v1-scope.md); the hyperlink capability (ui-text `as="a"` + `href` — the catalog's first navigation-security surface) has its own record, [ADR-0114](../adr/0114-text-hyperlink-href.md). SPEC/LLD land at the build wave, not here. Intake decomp: [`../decompositions/content-family-intake.decomp.json`](../decompositions/content-family-intake.decomp.json) (coverage-clean, PLAN mode).
> **Sibling-vs-extension ruling:** a **new sibling PRD** (the chart-family precedent, filed under `.claude/docs/prd/`) — not an extension. Neither existing PRD owns it: `agent-app-surfaces.prd.md` owns app *chrome*, the A2UI expert-system PRD owns *generation reliability*; content primitives are fleet **content vocabulary** (`@agent-ui/components` controls with an a2ui catalog surface) — exactly the class the chart PRD established.
> Grounding: `site/lib/code-block.ts` (the site's own centralized hand-rolled `<pre><code>` helper + its ≥6 page consumers — the a2ui-live canvas JSON panes, doc-page fenced examples; the dogfood evidence) · `catalog.json` (grep 2026-07-08: **no `href` appears anywhere** — a hyperlink is structurally unemittable; no `Code`, no fold/disclosure type) · the precursor fleet's `disclosure` control, never ported (dispatch-grounded) · [ADR-0078](../adr/0078-ui-text-three-axis-variant-size-as.md) (the ui-text axis charter the hyperlink extends) · [ADR-0102](../adr/0102-css-less-consumer-contract-law.md) (the CSS-less-consumer law + chooser) · [ADR-0087](../adr/0087-a2ui-whole-fleet-catalog-scope-policy.md) / SPEC-N2 (whole-fleet coverage gate) · [ADR-0097](../adr/0097-a2ui-feed-embedded-asks.md) + Amendment (the TOTAL feed partition — dispositions owed) · [`../references/geometry.md`](../references/geometry.md) (five size-classes; "accordion" already sits in the Pattern row) · `dimensions.css` `--ui-mono` (the mono typeface constant already minted "for code blocks, inline-code chips").

## 1. Problem

Agents talk **about** code, sources, and long detail constantly — and the fleet cannot show any of the three honestly:

1. **Code renders as prose.** An agent emitting a command, a config fragment, or a JSON payload has only `Text` — proportional type, collapsed whitespace, wrapping mid-token. The need is so real the docs site built its own private answer (`site/lib/code-block.ts`: mono + `white-space: pre` + `overflow-x: auto` + textContent-only safety, consumed by ≥6 pages) — a correct pattern trapped at the site layer, invisible to the fleet and unreachable from the catalog.
2. **A hyperlink is unemittable.** No catalog prop anywhere carries an `href`; `ui-text`'s `as` axis stamps `h1…h6/p/span/blockquote` but not `a`. "Here is the source" — the most basic report affordance — cannot be expressed by any composition. And because catalog-emitted hrefs are **model-generated**, closing the gap opens the catalog's first navigation-security surface, which must be designed, not patched (ADR-0114).
3. **Long reports don't fold.** A multi-section agent report is all-or-nothing: every detail at full height. The precursor fleet had a `disclosure`; it was never ported, and no fleet or catalog vocabulary expresses "summary now, detail on demand."

**Who has the problem.** (1) *Models emitting A2UI payloads* — asked for "the command to run and where it's documented," a model can emit neither the command (as code) nor the link. (2) *The docs site* — the grounded internal instance, already paying for its own code-block. (3) *App developers* embedding agent output, who would otherwise import a highlighter/link-sanitizer stack the zero-dependency pillar forbids.

**Why these three are one family.** All three are **passive content vocabulary** (display/structure, not form controls), all three are forced by the same consumer class (the CSS-less A2UI model, ADR-0102), and they compose: a report folds a Disclosure around a Code block with a source link. They intake together so the catalog grows once, coherently.

## 2. Goals & success metrics

Stable IDs; priority tiers (must/should/could); metrics carry baseline + target + timeframe. Milestones in §4. Downstream SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must | An agent can emit code: a `ui-code` control + a catalog `Code` type render verbatim, mono, scroll-contained code |
| **PRD-G2** | must | An agent can emit a hyperlink: `ui-text` gains `as="a"` + `href`, scheme-gated at the component (ADR-0114) |
| **PRD-G3** | must | Long content folds: a `ui-disclosure` control + a catalog `Disclosure` type with two-way `open` |
| **PRD-G4** | must (cross-cutting) | The family holds every fleet pillar — zero-dep, geometry-law placement, token theming, AT semantics, cross-engine proof, and the href security gates |
| **PRD-G5** | should | The report idiom upgrades: an exemplar + §5.2 guidance teach models when code/link/fold beat plain Text; corpus/prompt surfaces re-validate |

**PRD-G1 — code (flagship).** Verbatim rendering: whitespace preserved, `--ui-mono` family, horizontal overflow scrolled *inside the component* (the ADR-0102 law — no page CSS may be required for a non-broken rendering); `language` carried as inert metadata (no highlighter — the zero-dep fence, ADR-0113).
- *Metric*: a catalog `Code` type, validator-clean over a realistic payload, rendering a multi-line snippet un-wrapped and scrollable in a narrow container.
- *Baseline*: **0** (`catalog.json` declares no code type; the site helper is the recorded workaround evidence).
- *Target*: **1** type declared + factory-bound + exercised by a validator-clean exemplar payload. *Timeframe*: **M1**.

**PRD-G2 — hyperlink.** The stamp becomes a real `<a>` (native link semantics free — the ADR-0078 cl.4 doctrine); the component enforces a scheme allowlist (fail-closed: a disallowed scheme renders text, never navigation) with `rel="noopener noreferrer"`; the validator carries the first-line leg (defense in depth, ADR-0114).
- *Metric*: a catalog-emitted `Text` with `href` renders a working link; a `javascript:`/`data:` href renders **no** navigable link (the negative control), both engines.
- *Baseline*: **0** hrefs expressible (grep-verified). *Target*: `href` on the `Text` row + both legs green. *Timeframe*: **M1**.

**PRD-G3 — disclosure.** Summary-line + on-demand body; `open` is a reflected prop under the always-announce law (ADR-0101) and a two-way catalog mark (`value:{prop:'open',event:'toggle'}` — the overlay-family precedent).
- *Metric*: a catalog `Disclosure` type, validator-clean; toggling by user click and by data-model write both settle prop, attribute, and announcement.
- *Baseline*: **0** (no fold vocabulary in fleet or catalog). *Target*: **1** type declared + factory-bound + two-way proven. *Timeframe*: **M1**.

**PRD-G4 — fleet pillars (cross-cutting).** Ordinary `ui-*` citizens: zero-dep, `geometry.md` class placement (Display for code; Pattern for disclosure — its table already names "accordion"), token theming, AT semantics (native `<details>/<summary>` and `<a>` where ruled), cross-engine browser legs, and the href scheme gates.
- *Metric*: the fleet DoD — `npm run check && npm test`, browser legs (Chromium + WebKit), descriptor trip-wires, manual `npm run size` — plus the href negative-control legs.
- *Baseline*: n/a. *Target*: **all gates green at M1**. *Timeframe*: **M1**.

**PRD-G5 — teaching + dogfood.** A report exemplar (Card + Text + Code + a source link + a Disclosure-folded detail section) joins the examples shelf with §5.2 usage-guidance prose (the ADR-0087 Fork-A style); corpus + derived prompt re-validate over the widened catalog. The **site's `code-block.ts` replacement is a booked follow-up consumer** — named here as the adoption path, deliberately NOT this wave's scope.
- *Metric*: ≥1 exemplar seed in `allSeeds` containing all three capabilities, validator-clean; §5.2 Notes carry the code/link/fold guidance.
- *Baseline*: **0**. *Target*: **≥1** + guidance prose landed. *Timeframe*: **M2**.

## 3. Scope

**In scope (v1):**
- `ui-code` — block-level, verbatim, mono, self-scrolling code display; `language` as inert metadata.
- The hyperlink capability on `ui-text` — `as` gains `"a"`, a reflected `href` prop, the component-enforced scheme allowlist + `rel`/`target` policy (ADR-0114).
- `ui-disclosure` — a native-`<details>`-wrapped summary/body fold with reflected `open` and a `summary` prop.
- Same-wave default-catalog rows (`Code`, `Disclosure`, `Text.href`) + feed-partition dispositions (forced: SPEC-N2 whole-fleet gate; the ADR-0097 partition is TOTAL) + the report exemplar & §5.2 guidance (PRD-G5).

**Out of scope (v1) — the fence, each with its reason (ADR-0113 owns the rulings):**
- **Syntax highlighting** — a tokenizer is runtime code; under the zero-dep pillar a hand-rolled or vendored highlighter is the chart-library rejection verbatim (ADR-0107 Alternatives: "a runtime dependency in costume"). `language` ships inert; the escape hatches are named in ADR-0113. Any highlighter is a **new intake**.
- **Copy-to-clipboard affordance on `ui-code`** — interactivity changes the size class (Display stays passive); a copy button is app-layer composition or a future intake.
- **Inline code chips / soft-wrap mode / line numbers / max-height clamp** — foreseen extensions with no forcing evidence; long-code folding is already served by composition (`Disclosure > Code`).
- **`target`/`download`/`ping` knobs on the link; non-http(s)/mailto schemes** — the v1 policy is fixed-safe (ADR-0114); widening any of it is a security conversation, never a rider.
- **Exclusive-accordion grouping (`name`), fold animation, rich summary slot** — foreseen `ui-disclosure` extensions; mint when evidence arrives.
- **The site's `pre`/`code` replacement** — the booked follow-up consumer wave (PRD-G5), not this scope.
- **Any third-party library** — the standing pillar.

## 4. Milestones

| Milestone | Delivers | Gate |
|---|---|---|
| **M0 (this intake)** | This PRD + ADR-0113 + ADR-0114 (scope + contract directions + Kim forks) — docs only | doc-review + Kim's fork answers; harness gates green |
| **M1** | The two controls + the ui-text href capability + descriptors + same-wave catalog rows + feed dispositions + security/a11y/browser probes (PRD-G1..G4) | fleet DoD + SPEC-N2 fleet-derived gate green, **no allowlist residue**; href negative controls pass both engines |
| **M2** | Report exemplar + §5.2 guidance + corpus/prompt re-validation (PRD-G5) | examples/corpus gates green; exemplar renders in the gallery |
| **Follow-up** | The site swaps `code-block.ts` consumers to `ui-code` (the dogfood close) | site tests green; booked separately |

## 5. Open decisions

The genuine forks live in the ADRs, each with a firm recommendation awaiting Kim: [ADR-0113](../adr/0113-content-family-v1-scope.md) — **F1** the v1 member set · **F2** ui-code's content model · **F3** the disclosure vehicle · **F4** the feed dispositions; [ADR-0114](../adr/0114-text-hyperlink-href.md) — **F1** the scheme allowlist · **F2** href bindability · **F3** the target/rel policy. No open decisions remain at PRD altitude.
