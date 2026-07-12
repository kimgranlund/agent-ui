# ADR-0119 — Code+prose family v1 scope: a new `@agent-ui/code` sibling package — pure core seams + hand-rolled `./highlight` and `./markdown` packs, diff at M2, default catalog untouched

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-10
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-10 |
> | **Proposed by** | planner (design seat — the design-system-surfaces intake, [TKT-0007](../tickets/tkt-0007-design-system-surfaces.md); Kim pre-answered the packaging fork at intake, Q4 2026-07-10: pack adapter on the icons model, `@agent-ui/code` → core + `./highlight` + `./markdown`) |
> | **Ratified by** | Kim, 2026-07-10 — the ratification fork passes (F1–F4 all as recommended; the naming sliver closed: keep `@agent-ui/code`) + his explicit "ratify all three" |
> | **Repairs** | NEW [`../prd/code-prose-family.prd.md`](../prd/code-prose-family.prd.md) (authored in this same change — the owning doc) · realizes [ADR-0113](./0113-content-family-v1-scope.md) cl.2's named escape hatch (b) — that ADR's fence is unchanged; this is the intake it foresaw |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0113](./0113-content-family-v1-scope.md) (the fence + `language` inert + host-as-content, all preserved) · [ADR-0065](./0065-icon-adapter-swappable-pack-architecture.md)/[ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) (the pure-core + subpath architecture; note the inert-data vs runtime-code distinction below) · [ADR-0107](./0107-chart-family-v1-scope.md) (the "runtime dependency in costume" law this satisfies rather than dodges) · [ADR-0114](./0114-text-hyperlink-href.md) (the link policy markdown links obey) · [ADR-0115](./0115-spa-router-v1-scope.md) (the sibling-branch DAG precedent) |

## Context

The content family shipped `ui-code` deliberately verbatim: *"a tokenizer is runtime code"* — and
ADR-0113 cl.2 fenced highlighting while naming two escape hatches, the second being *"a future opt-in
adapter package outside the zero-dep core — its own intake."* Kim's design-system-surfaces seed
(TKT-0007, *"code viewers"*) plus the fleet's markdown blindness (agent prose renders as literal
`**bold**` — grep-verified: no markdown rendering exists in the repo) make this that intake. At the
intake fork round Kim chose the shape directly: **the swappable pack adapter, like `@agent-ui/icons`**
— `@agent-ui/code` (new) → core + `./highlight` + `./markdown`.

One law shapes everything: ADR-0107's rejection of vendored *runtime code* as "a runtime dependency
in costume." The icons precedent does NOT license vendoring a highlighter — Phosphor vendoring works
because icon packs are **inert data**; a tokenizer, a markdown grammar, and a diff algorithm are
**code**. What the icons architecture DOES license is the *packaging geometry*: a zero-dep core seam,
opt-in subpaths carrying the mass, tree-shake gates proving non-adopters pay nothing. So the packs
must be **hand-rolled and deliberately small**, or accept consumer-supplied engines through the seam —
never third-party adoption in costume.

A second law bounds reachability: the DAG (`shared ← components ← a2ui ← app`; `router` a sibling
branch, catalog-invisible by construction). The default catalog is zero-dep; `a2ui` must never import
this package. Markdown IS agent-native content — but its catalog reachability belongs to the
**consumer tier** of the two-tier catalog model, not the default.

## Decision

**We will admit a code+prose family as a new `@agent-ui/code` sibling package — a pure, zero-dep core
(the highlighter registry + the renderer seams) with hand-rolled `./highlight` and `./markdown`
subpath packs, a unified line-based diff view at M2, the `@agent-ui/components` core byte-identical
for non-adopters, and the default catalog untouched.** Realized in eight clauses; SPEC/LLD own
mechanisms at build (PRD-G1…G4 trace).

1. **Package + DAG** *(PRD-G4; fork F1 — Kim's intake answer)*: NEW `packages/agent-ui/code/` →
   `@agent-ui/code`, depending only on `@agent-ui/components` + `@agent-ui/shared` — a **sibling
   branch off `components`** (the ADR-0115 router precedent): `a2ui`/`app` never import it; nothing
   imports upward. The layering trip-wire extends by one node. *Naming caveat (F1): the package name
   `code` will also export the markdown/diff surfaces — recorded honestly as scope-vs-name tension;
   Kim may prefer `@agent-ui/prose` or `@agent-ui/marks` at ratification; the geometry is unchanged
   either way and his intake answer named `code`.*
2. **The core seams, zero-dep** *(PRD-G2/G4)*: the core exports (a) a **highlighter registry** —
   `registerHighlighter(fn)` where `fn: (code, language) => Token[]` (a typed, engine-agnostic token
   stream; exact type is SPEC business) — consumed by `ui-code` rendering *through light-DOM
   children* (the ADR-0113 escape hatch (a) made systematic: bound writes still clobber to plain
   text; the highlight pass re-derives — no core behavior change, no new content lane); and (b) the
   **markdown/diff element definitions' shared plumbing**. With nothing registered, `ui-code` is
   **byte-identical** to today — an identity gate asserts it.
3. **`./highlight` — hand-rolled grammars for the agent-common set** *(PRD-G2; fork F2)*: v1
   languages: **ts/js · json · html · css · python · shell · markdown fences** — chosen by what
   agents emit, not by parser ambition. Line-oriented, small, dependency-free tokenizers (comment ·
   string · keyword · number · punctuation tiers — coarse on purpose; fidelity beyond scanning aid is
   out). Consumers wanting engine-grade fidelity register their own adapter through the clause-2 seam
   (Shiki/highlight.js stay in *their* bundle, never this repo's). Token classes map to
   `--md-sys-color-*`-derived `--ui-code-token-*` roles — theme-honest in light/dark and
   forced-colors (tokens degrade to plain ink, never invisible).
4. **`./markdown` — the agent-common subset, sanitized by construction** *(PRD-G1; forks F2/F4)*: a
   `ui-markdown` element (defined in the pack — F4) rendering **headings · paragraphs · lists
   (ordered/unordered, nested) · emphasis/strong · inline code · fenced code → `ui-code` (with
   `language` forwarded — the packs compose) · links → the `ui-text` `as="a"`+`href` capability
   under the ADR-0114 policy (a dedicated `ui-link` element was REJECTED by ADR-0114/ADR-0113 —
   ui-text IS the vehicle) · blockquotes · GFM tables (recommended IN — agent-real, and `ui-table`
   exists to receive them)**.
   **No raw-HTML lane exists**: HTML in input renders as inert text — sanitization by *absence of the
   lane*, not by filter (an injection corpus is an acceptance gate, not a hope). Content model:
   `markdown` string prop (bindable — the `Text.text` clobber lane shape), rendered into real fleet
   DOM.
5. **The diff view, M2** *(PRD-G3; fork F3)*: `ui-diff` — **unified, line-based**, input =
   **pre-computed hunks first** (`hunks: { kind: 'add'|'del'|'ctx'; text: string }[]`-shaped — agents
   and tools already have the diff; recomputing it is optional), with a two-text
   compute lane (a small LCS over lines) as sugar. Per-row semantics announced to AT (list semantics,
   "added/removed" per row); color is redundant with a structural signifier (the fleet's
   non-color-signifier posture) — `+`/`−` gutters are real text.
6. **Display-class throughout** *(PRD-G4)*: no control heights, no `[scale]`/`[size]` rows;
   `--ui-{markdown,diff}-*` + `--ui-code-token-*` tokens in standard `:where()` blocks; every element
   owns its overflow (the ADR-0102 law — a wide diff scrolls inside itself).
7. **Catalog disposition: default catalog UNTOUCHED** *(PRD-G4)*: no default rows — the default
   catalog is zero-dep and `a2ui` cannot import this package (clause 1). `Markdown`/`Diff`
   reachability for agent emission is a documented **consumer catalog extension** — the two-tier
   "stricter overrides" model is established in [ADR-0034](./0034-a2ui-server-initiated-function-invocation.md)
   (project catalogs shadow/tighten the default; `registry.ts`); the extension recipe ships as docs
   at M2. The SPEC-N2 fleet gate governs
   `@agent-ui/components` descriptors — these elements live outside that package, so no allowlist
   entry is owed (verify at build: the gate's scope is package-bound, not repo-bound).
8. **Gates that make the opt-in honest** *(PRD-G2/G4)*: the `ui-code` **identity gate** (no
   registration ⇒ byte-identical rendering); the **tree-shake gate** (a consumer importing only
   `@agent-ui/code` core carries no pack bytes — the icons `zero-runtime-Phosphor` gate pattern,
   static-import caveat and all); the **injection corpus** (clause 4) as a standing test; per-pack
   `measure-size.mjs` line-items with their own budgets set at M1 kickoff against a measured
   baseline (the ADR-0080 discipline).

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — package home + name.** *Kim's intake answer:* the pack-adapter architecture at
  `@agent-ui/code` — **recorded as decided** on geometry. The one open sliver is the *name* (clause 1
  caveat): `code` will export prose surfaces too. *Recommend: keep `@agent-ui/code`* (his named
  choice; "code" reads as the developer-content domain, and renaming buys nothing structural).
  **ANSWERED by Kim, 2026-07-10 (ratification fork pass): keep `@agent-ui/code`** — the naming sliver closes; geometry stood decided since intake.

- **F2 — the v1 subset sizes.** *Recommend: the clause-3 language set and the clause-4 markdown
  subset, GFM tables IN.* Live alternatives: languages-minimal (ts/json/shell only — cheaper, but
  python/html/css are agent-daily and each grammar is small); tables OUT (defensible — tables are the
  subset's biggest grammar — but agent reports emit them constantly and `ui-table` exists; excluding
  them re-creates the literal-syntax problem this family exists to end).
  **ANSWERED by Kim, 2026-07-10 (ratification fork pass): as recommended** — the clause-3 language set + the clause-4 markdown subset, GFM tables IN.

- **F3 — the diff input contract.** *Recommend: pre-computed hunks primary, two-text compute as
  sugar* (clause 5). The alternative — two-text-only — is a cleaner API but forces every consumer
  through this repo's diff algorithm; agents/tools usually *have* the hunks, and honoring them keeps
  the algorithm small and non-load-bearing.
  **ANSWERED by Kim, 2026-07-10 (ratification fork pass): as recommended** — pre-computed hunks primary, two-text line-LCS as sugar.

- **F4 — where `ui-markdown` is defined.** *Recommend: in the `./markdown` pack* (clause 4): the
  element IS the grammar — a core-defined shell with no parser would render nothing and fake the
  zero-dep story. The alternative (core element + registered renderer, mirroring the highlighter
  seam) doubles the seam machinery for no consumer.

  **ANSWERED by Kim, 2026-07-10 (ratification fork pass): as recommended** — defined in the `./markdown` pack; the element IS the grammar.

## Consequences

- **The zero-dep pillar gains its precedent-setting boundary case**: runtime code CAN ship — outside
  the core, hand-rolled, opt-in, identity-and-tree-shake gated. Every future "just vendor it" ask
  gets measured against this ADR's inert-data vs runtime-code line.
- **The repo now owns grammars** — small ones, but owned: tokenizer edge-cases, markdown ambiguities,
  diff correctness all hand-gated forever (the ADR-0107 "no library to blame" consequence, accepted
  deliberately for a bounded subset).
- **The markdown subset fence will be pushed hardest** — "just support footnotes/HTML/math" is
  predictable. The PRD §3 fence + clause 4's by-absence sanitization are the line: raw HTML never
  enters; subset growth is a per-need intake.
- **Agent reachability is deliberately two-step** (clause 7) — a consumer must extend their catalog
  to let agents emit `Markdown`. If real usage shows every consumer doing it, promoting a
  first-party extension module (still consumer-tier) is the foreseen follow-up — the default catalog
  stays zero-dep regardless.
- **Stale → re-verify at the build wave:** ADR-0113's cl.2 wording (its "escape hatches, named" row
  gains an answered-by pointer at ratification — coordinator housekeeping, per the serialize rule) ·
  CLAUDE.md Layout/DAG rows + the layering trip-wires · `measure-size.mjs` · the site's content-family
  doc pages (ui-code's "language is inert" prose gains a "unless the highlight pack is registered"
  clause).

## Acceptance

This is an **intake** ADR — realized in stages:

- **Intake (this change):** the sibling PRD exists; this record passes the ADR gates and is indexed;
  F1's intake answer is recorded with its naming caveat; F2–F4 carry firm recommendations; doc-review
  dispatched on both records. No code changes.
- **M1 (separately dispatched):** the package + core seams land with the layering trip-wire extended
  green; `./highlight` (clause-3 set) + `./markdown` (clause-4 subset) ship with descriptors + fleet
  DoD; the identity gate, tree-shake gate, and injection corpus are standing tests, all green;
  CLAUDE.md DAG rows updated in the same change.
- **M2:** `ui-diff` ships (clause 5) with per-row semantics probes; the consumer catalog-extension
  recipe documented; size budgets hold.

## Alternatives considered

- **Vendor highlight.js / marked / diff (the "Phosphor model").** Rejected: those are runtime code —
  "a dependency in costume" (ADR-0107, verbatim); the icons precedent licenses the *geometry*, not
  the vendoring, because icon packs are inert data and these are not.
- **Hand-roll INSIDE `@agent-ui/components`.** Rejected: the core's zero-dep identity is
  load-bearing (ADR-0113 held this line deliberately); grammar mass in the leaf package taxes every
  consumer, adopter or not.
- **Peer-dependency adapters only (no first-party packs).** Rejected as the default: it makes the
  capability theoretical — every consumer re-solves highlighting, and agent markdown stays literal in
  this repo's own site/feed. The seam still accepts consumer engines (clause 2/3); the small
  first-party packs make the common case real.
- **Extend the A2UI default catalog with `Markdown`.** Rejected: the default catalog is zero-dep and
  `a2ui` cannot import this package without breaking the DAG; consumer-tier extension is the honest
  path (clause 7).
- **A `sanitize`-then-`innerHTML` markdown pipeline.** Rejected: sanitizers are the arms race this
  family avoids by construction — no raw-HTML lane exists, so there is nothing to sanitize (clause
  4). Structural rendering into fleet elements is also what makes fenced code compose with
  `./highlight` for free.
- **Do nothing — keep printing literal markdown.** Rejected: the grounded instances (site, feed,
  every conversation surface) already pay the dishonesty daily, and the ADR-0113 fence explicitly
  promised this intake rather than permanence.
