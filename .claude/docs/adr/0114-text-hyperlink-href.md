# ADR-0114 — `ui-text` gains the hyperlink capability: `as` gains `"a"` + a reflected `href` prop; a component-enforced scheme allowlist (fail-closed), unconditional `rel="noopener noreferrer"` + fixed `target="_blank"`, catalog `Text.href` bindable behind the component gate

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | system-planner (design seat — the content-family intake's hyperlink member, admitted by ADR-0113 clause 3 and ruled to earn its own record: it extends ADR-0078's `as` axis AND opens the catalog's first navigation-security surface; coordinator-reserved number 0114) |
> | **Ratified by** | Kim (host) · 2026-07-09 — ratified by explicit instruction ("proceed", confirming the flip after the ratification-scope note); the self-flip guard hook was deliberately deregistered by Kim's own edit to `settings.json` to permit this and the sibling family flips. Forks F1–F3 stand as recommended |
> | **Repairs** | on ratification+build: `controls/text/text.ts` (the `as` enum gains `'a'`; NEW `href` prop; the stamp effect applies the gated href + `rel`/`target`) · `controls/text/text.css` (the stamp reset's `:is()` gains `a`; the link treatment leg) · `controls/text/text.md` (attribute rows + the link-usage + sole-signifier guidance) · `catalog.json` `Text` row gains `href` (string, bindable) + `factories.ts` `textFactory` (the `href → as='a' + href` fan-out arm, the ADR-0078 cl.5 table's lineage) · the validator first-line leg (`conformance.ts` or the produce layer — mechanism is SPEC/LLD business) + `conformance.test.ts` · `factories.test.ts` / `prompt-drift.test.ts` / catalog `index.test.ts` rows · `a2ui-catalog.spec.md` §5.2 `Text` row · **on accept: the reciprocal `Extended by ADR-0114` back-link on ADR-0078** (the back-links-land-at-accept convention) |
> | **Supersedes / Superseded by** | Extends **ADR-0078** (the `as` axis gains a value; the stamp doctrine carries the semantics — and, for the first time, an axis value arrives with a PAIRED prop, `href`; cl.4's reset/heal mechanics are reused, not re-decided) · relates **ADR-0113** (the family scope record that admits this member) · **ADR-0106/0109** (the fourth/fifth-axis precedents whose catalog/descriptor repair pattern this clones — and departs from: their props were non-bindable presentation intent; `href` is content, clause 5) · **ADR-0102** (Lane B — a per-instance intent prop over a safe default; the chooser is walked in Context) · **ADR-0098/0076** (the two validation lanes clause 3's first line rides) · **ADR-0034** (the `callableFrom` clientOnly-default posture — the catalog's existing security design language clause 2 extends to navigation) · ADR-0057 (the non-color-signifier rule clause 6 applies to link styling) |

## Context

No `href` exists anywhere in the default catalog (grep-verified 2026-07-08) and `ui-text`'s `as` enum stops
at `blockquote` — an agent asked for "the source" structurally cannot emit a link; the capability gap is
recorded in the content-family PRD (PRD-G2). The ADR-0102 chooser: (i) the catalog grammar cannot express
navigation by ANY composition → Lane A/B; (ii) the concern is per-instance content (a destination) → a
prop; (iii) the no-uptake rendering (no link) is today's behavior, so the *prop* is pure capability — but
its **default policies** (scheme, `rel`, `target`) must be safe, because the emitter is a model.

That last fact is the heart of the record. Catalog-emitted hrefs are **model-generated strings**: prompt
injection, retrieved content, or plain confabulation can land `javascript:alert(1)`, `data:text/html,…`,
or a `file:` path in a payload that is otherwise schema-valid. The catalog already has a security design
language for exactly this class: capabilities are **allowlisted, off by default, and gate-encoded** —
SPEC-R9 renders only catalog-declared types; `callableFrom` defaults every function to `clientOnly`
(ADR-0034, whose amendment made collisions resolve *most-restrictive-wins*). Navigation joins that
posture, not an exception to it.

Two mechanics bound the enforcement point. **(1) The static validator cannot see every href**: a *bound*
href resolves from the data model at render time — ADR-0098's own scope note sends bindable values to the
render-time gate (ADR-0076's lane). **(2) Every write path converges on the component**: attribute,
property, factory apply, and bound updates all land on the same prop→stamp path (the ADR-0078 cl.4
effect + heal machinery). So the component is the one point that sees ALL values — the last line — and
the validator is the first line that catches static garbage before anything streams (validate-then-stream,
self-correct loop). Defense in depth, both lines, neither alone.

## Decision

**`ui-text` gains the hyperlink capability with safety enforced at the component.** Six clauses; SPEC/LLD
own mechanisms at build (PRD-G2 trace).

1. **`as` gains `"a"`; a NEW reflected `href` string prop.** The stamp becomes a real `<a>` — native link
   role, keyboard, focus, copy-paste, AT announcement, all free (the ADR-0078 cl.4 stamp doctrine; the
   reset/heal machinery is reused — the stamp's `href`/`rel`/`target` are re-applied from props on every
   restamp, so the A2UI `textContent` clobber can never strip the gate). The axes stay honest: `as="a"`
   is the semantics, `href` the destination; `href` without `as="a"` is inert (documented, not error).
2. **A component-enforced scheme allowlist, fail-closed** *(fork F1)*: the value is parsed as
   `new URL(href, document.baseURI)` (so relative URLs resolve against the page — they normalize to
   http/https); the resolved scheme must be **`https:` · `http:` · `mailto:`**. Anything else —
   `javascript:`, `data:`, `blob:`, `file:`, `vbscript:`, custom schemes, unparseable values — and the
   stamped `<a>` **never receives an `href` attribute** (an anchor without `href` is a valid, focusable-no,
   non-navigable placeholder — and for assistive tech it is NOT exposed as a link at all: the denied
   state degrades to plain text, never an announced-broken link): the text stays visible, the
   navigation is impossible. Content is never destroyed; capability is denied. The gate runs on the
   component's own prop→stamp path, so it covers attribute, property, factory, and **bound** writes
   identically — the last line, at value time. The HOST's reflected `href` attribute is harmless by
   construction: a custom element is not a navigable anchor, so an unsanitized value reflected on
   `<ui-text>` is inert — only the gated stamp `<a>` ever carries a live `href`.
3. **Defense in depth — the validator is the first line, the component the last.** A validator-side leg
   lands the same wave: a static `Text.href` literal with a disallowed scheme fails `validateA2ui`
   (`CATALOG` at `<id>.href`) and enters the existing self-correct loop — the model is told before
   anything streams (mechanism — conformance rule vs produce-layer check — is SPEC/LLD business). Bound
   hrefs, which the static line cannot see, fall to clause 2 plus the render-time lane (the ADR-0076
   pattern). The component gate is **never** waived on the grounds that validation exists — that is the
   entire meaning of last line.
4. **Fixed `rel` + `target` policy at v1** *(fork F3)*: the stamp always carries
   `rel="noopener noreferrer"`, and `target="_blank"` — both component-set constants, not props, and the
   catalog exposes neither. Rationale from the primary consumer: a link inside a live agent surface that
   navigates the *current* tab destroys the session — a destructive no-uptake failure, so the safe default
   is new-tab (the ADR-0102 chooser's own logic); `noopener` severs the opener handle, `noreferrer`
   stops referrer leakage to model-chosen destinations. A `target` prop (`_self` for app-internal
   routing) is the **named foreseen extension**, minted when a real consumer needs it.
5. **Catalog reachability: the `Text` row gains `href` (string, `bindable: true`)** *(fork F2)*, and
   `textFactory` fans `href` → `as='a'` + `href` (the ADR-0078 cl.5 fan-out lineage — the wire vocabulary
   never learns the `as` axis; a model says `{"component":"Text","text":"source","href":"https://…"}`).
   Bindable is a deliberate departure from the `truncate`/`emphasis` non-bindable rulings: those are
   presentation *intent*; a destination is *content* — a report linking to its per-row source from the
   data model is a first-order Gen-UI need (the same class as `text` itself, which is bindable). The
   widened injection surface this admits is exactly what clause 2 exists to hold: every bound value
   passes the same component gate. The ADR-0071 derived inventory advertises `href`; the §5.2 Notes carry
   the usage line (*sources and references — https; never bare navigation-as-action: actions are
   Buttons*).
6. **Link treatment: underline always + a link ink role.** Hue alone must not distinguish link from
   prose (the ADR-0057 non-color-signifier rule applied to navigation affordance); the stamp reset's
   `:is()` list gains `a`, with the link leg (underline + ink + visited/hover/focus states) declared
   after it — exact role/tokens are build business under the existing `--md-sys-color-*` families.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — the scheme set.** *Recommend: `https:` + `http:` + `mailto:`* (clause 2). Alternatives:
  https-only (purest, but breaks local/dev hosts and intranet deployments for marginal gain — http is
  transport-weak, not script-injection; note a `target="_blank"` TOP-LEVEL navigation is not
  mixed-content-blocked — that gate governs subresources — so an https-hosted surface CAN open an http
  destination, and the residual risk is exactly eavesdropping-on-the-destination, which transport-weak
  names); adding `tel:` (no evidence; one-line widening later, gate-visible).
- **F2 — `href` bindability.** *Recommend: bindable* (clause 5) — destination-as-content is the real
  Gen-UI need, and the component gate is total over bound values. Alternative: non-bindable at v1
  (cloning the truncate/emphasis ruling — smaller static surface, but it misclassifies content as
  presentation and flipping bindability later is additive anyway).
- **F3 — the `target`/`rel` policy.** *Recommend: fixed `_blank` + unconditional `rel="noopener
  noreferrer"`, no props* (clause 4). Alternative: mint a `target ∈ _blank|_self` prop now
  (component-only, catalog-invisible) — cheap, but no consumer needs `_self` today and un-minting
  vocabulary is harder than minting it.

## Acceptance

- jsdom: `href` reflects both ways; `@ts-expect-error` leg; `as` enum accepts `'a'`; a disallowed-scheme
  `href` (`javascript:`, `data:`, unparseable) leaves the stamp with **no `href` attribute** while the
  text renders; the stamp carries `rel="noopener noreferrer"` + `target="_blank"` whenever `href` is set
  and allowed; `text-descriptor.test.ts` mirrors the new rows.
- Cross-engine browser legs: `as="a" href="https://…"` stamps a real `<a>` computing the link treatment
  (underline present; zero geometry delta vs the unstamped host — the cl.4 invariant leg); a
  `textContent` clobber (the bound-text path) re-stamps with the gated `href` intact; **negative
  controls**: (a) a `javascript:` href never yields a navigable link in either engine; (b) with the
  component gate removed, leg (a) FAILS — proves the last line is load-bearing, independent of the
  validator.
- Catalog legs: `factories.test.ts` asserts the `href → as='a'+href` fan-out; a static disallowed-scheme
  literal fails `validateA2ui` with `CATALOG` at the prop path and self-corrects in a produce-loop leg;
  a **bound** disallowed href passes the static validator and is still rendered non-navigable (the
  defense-in-depth leg — the pair proves both lines, separately); `prompt-drift.test.ts` green with the
  widened `Text` row.
- `npm run check && npm test` + `npm run test:browser` green.

## Consequences

- **The catalog can now point at the world** — and the trust boundary is stated, not implied: the scheme
  gate holds the *mechanism* line (no script-scheme execution, ever). It deliberately does NOT judge
  *destinations*: a model can emit a perfectly-schemed link to a wrong or hostile URL. That residue is
  live-model quality — the ADR-0070 stance — observable in the corpus/judge lane, and no scheme gate can
  own it; stating otherwise would be false safety.
- **Feed asks can now carry links** (`Text` is already `FEED_SURFACE_TYPES`-IN): accepted consciously —
  a link does not commit an ask, and `_blank` preserves the session; the ask archetypes gain a
  "source" idiom for free.
- **`mailto:` opens the platform mail handler** — accepted as the cost of the most-asked non-web scheme.
- **Every link opens a new tab at v1** — page authors embedding agent surfaces inherit `_blank` until
  the foreseen `target` extension; named, bounded, reversible by one prop later.
- **The gate is per-value, not per-render** — parsing a URL on href writes is negligible but nonzero;
  ui-text stays observer-free for this feature (the stamp effect it already owns carries the work).
- **Stale → re-verify at the build wave:** `text.md` rows · catalog SPEC §5.2 `Text` row · derived
  prompt/inventory · the exemplar seed (ADR-0113 clause 5 composes a source link) · ADR-0078's
  `Extended by` back-link (at accept).

## Alternatives considered

- **A new `ui-link`/`Link` component.** Rejected: a link is text wearing semantics — precisely the `as`
  axis's charter (ADR-0078); a second text-like leaf would fork the typography matrix, the content
  model, truncate/emphasis composition, and the catalog's `Text` teaching for the sake of one attribute.
- **Enforce only in the validator (no component gate).** Rejected: the static line cannot see bound
  values (ADR-0098's own scope note), and the component is the only point every write path crosses. A
  validator-only design is a fence with a gate standing open at render time.
- **A scheme blocklist (`javascript:` et al.) instead of an allowlist.** Rejected: blocklists rot —
  every future scheme is allowed by default, inverting the catalog's posture (`callableFrom` defaults
  closed; SPEC-R9 is an allowlist). The allowlist is one line to widen, gate-visible.
- **Sanitize-and-rewrite (coerce a bad href to `#` or strip to text).** Rejected in favor of
  attribute-absence: rewriting fabricates a value the author never set (an `href="#"` navigates to top);
  a link-without-href is the platform's own placeholder shape — honest, inert, styleable.
- **`target` decided by the embedder (a prop now, no fixed policy).** Rejected for v1 (fork F3): the
  primary consumer class cannot set props the catalog doesn't expose, so the default IS the policy; the
  safe default is new-tab, and the prop remains the additive extension.
- **Auto-imply `as="a"` from `href` at the component (not just the factory).** Rejected: entangles the
  axes ADR-0078 paid to keep orthogonal — the component keeps one honest rule (`href` acts only through
  the `a` stamp); the *wire* convenience lives in the factory fan-out, where translation already lives
  (cl.5 precedent).
- **Per-catalog configurable scheme sets.** Rejected for v1: one fleet policy, one gate, one test; a
  project-catalog override is a real future need but arrives as its own record with its own
  most-restrictive-wins reconciliation (the ADR-0034 amendment's lesson).
