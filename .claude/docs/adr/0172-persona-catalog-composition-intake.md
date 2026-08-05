# ADR-0172 — M-D design intake: a persona's local A2UI patterns are catalog-schema content, composed at derive-time over its selected base catalog — never prompt-only, never N duplicated catalogs; "shared system patterns" is a new catalog-level tier still to carve out, distinct from mini-skills' prompt-layer idioms

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-05
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-05 |
> | **Proposed by** | planner (design seat — the GH [#472](https://github.com/kimgranlund/agent-ui/issues/472) intake, minted by Kim's [2026-08-05 GH #421 reopen ruling](https://github.com/kimgranlund/agent-ui/issues/421#issuecomment) quoted in Context; supersedes the same-day earlier "PARKED IDEA" triage comment on #421, per Kim's own instruction) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-05, via the [`ratify ADR-0172` utterance](https://github.com/kimgranlund/agent-ui/pull/479#issuecomment-5196855272) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | **On ratification:** `roadmap.md` §4 — the GH #421 "Later, deferred" line (`roadmap.md:221-224`) moves to the milestone list under M-D, restated to the three frozen answers below, not the open-questions framing it carries today. **On ratification+build (M-D's own future SPEC/LLD, not authored here — this ADR is the "decided at design intake" record GH #421's own Acceptance criterion 4 names):** a new `packages/agent-ui/a2ui/src/catalog/<persona-scoped-shape>/` package-home convention (cl.1) · `renderer/renderer.ts`'s constructor-time registration set (cl.2 — gains a derive-then-register step, additive to ADR-0169 cl.2's two static registrations) · `agent-admin-schema.ts`'s `A2UI_CATALOG_OPTIONS`/`sanitizeCatalog` (cl.2 — grows to cover derived per-persona ids) · `.claude/skills/a2ui-multi-catalog/SKILL.md` (cl.2 — gains a "composed/derived catalog" pattern beside its four registered-catalog patterns, since a derived catalog is a fifth shape the skill doesn't cover today) · `agent-admin-persona-file.ts`'s `PERSONA_STATE_KEYS` (cl.1 — gains the persona's local-pattern-set selection key, symmetrical to `A2UI_CATALOG_KEY`, never the pattern definitions themselves) · `mini-skills.ts`/`selectMiniSkills` (cl.3 — named follow-up, not this wave: the catalogId-scoping gap cl.3 surfaces). |
> | **Supersedes / Superseded by** | **Relates** [ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) (the two-catalog registry/threading/selection mechanics this design must compose with, never fork — cl.2 rules the exact relationship) · [ADR-0170](./0170-catalog-library-kind-single-select.md) (the persona-scoped catalog membership/selection seam — `ENTRY_KINDS.catalog` + `A2UI_CATALOG_KEY` — cl.1/cl.2 build on this directly) · [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (its rejection of a second catalog id as a subset/policy VIEW of the default catalog stands and is distinguished, not contradicted, in cl.2's Non-collision note) · [ADR-0091](./0091-a2ui-gen-ui-mini-skill-registry.md) (the mini-skill registry cl.3 rules is NOT the "shared system patterns" tier, despite doing adjacent work) · [ADR-0103](./0103-radio-group-owns-layout-form-provider-teaches-wrap.md) (the `form-rhythm` mini-skill cl.3 cites as a specimen) · [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) (the generic `Entry` shape's Fork-3 "deliberately generic, no kind-specific schema" boundary — why the local-pattern layer cannot ride a free-text `Entry.content` field, cl.1) · genui-surface SPEC-R9/R10/R11 (the pattern-source precedent cl.1/cl.3 both distinguish from: prose-only, never catalog-validated) · **Resolves** GH [#472](https://github.com/kimgranlund/agent-ui/issues/472) (the design-intake box) — GH [#421](https://github.com/kimgranlund/agent-ui/issues/421) stays open, tracking the M-D build this ADR unblocks. |

## Context

**The design problem** (GH #421's own summary, verbatim): *"Catalog = shared primitives + shared
system patterns + persona-local patterns."* Today every persona speaks the one default catalog; a
persona's domain patterns (a booking flow's calendar+confirm idiom, a card-table's hand/score
layout) either live as prompt prose or don't exist as reusable catalog shapes at all. GH #421's own
Acceptance criteria (quoted, load-bearing for this ADR's cl.1/cl.2 rulings):

- *"A catalog-composition seam exists: a persona's effective catalog is derived as
  shared-primitives + shared-system + its local pattern set (a persona with no local set composes
  to today's default, byte-compatible)."*
- *"Validation and the composed system prompt's catalog teaching both follow the persona's
  effective catalog, not the global default."*
- *"The composition rule is recorded in the docs the change earns... decided at design intake, not
  pre-committed here."* — this ADR is that record.

**Kim's ruling that mints this intake** (GH #421, 2026-08-05T19:36:54Z, verbatim): *"REOPENED
knowingly at the 2026-08-05 intake wave's decision round (reports/roadmap-wave-2026-08-05/
synthesis-decision.md Q1/Q2): this issue's design intake mints NOW and M-D leads the next arc
(M-D → M-E → M-F). The intake freezes the three architectural questions the wave named: (1) where
a persona's local-pattern layer lives, (2) its relationship to the two-catalog catalogId model
(ADR-0169), (3) whether 'system patterns' is an existing layer or needs carving out."* This
supersedes an earlier same-day "PARKED IDEA, Later-tier" triage comment on #421 (also quoted, for
the record: *"per-persona bespoke catalogs... is a real architecture direction but has no ruled
intake; it would re-enter through a design intake like the ADR-0169 second-catalog arc did"*) — the
reopen is the live instruction, per Kim's own explicit "supersedes" framing.

**The wave's own hedge, and why Kim's ruling overrides it.** `synthesis-decision.md` Q2 (fetched
2026-08-05 from `origin/docs-intake-wave-2026-08-05`, not yet on `main`) frames M-D's design intake
as needing a Kim-only read and explicitly declines to choose: *"This synthesis does not choose;
choosing M-D would be Kim reopening his own ruling, not this wave overriding it."* Kim's #421
comment above is exactly that Kim-only read — it names the wave's synthesis by section number,
names M-D's own sequencing (M-D → M-E → M-F, diverging from the wave's own recommended M-E-first
order), and freezes the same three questions Q2 names. Nothing in this ADR treats the wave's
recommendation as binding; Kim's comment is the authority.

**Corroboration (three independent inventories, same wave, `origin/docs-intake-wave-2026-08-05`):**
`inv-1-agent-admin.md` §3 item 1 names GH #421 *"the one visible feature-shaped opportunity actually
sitting on agent-admin's own backlog"*; `inv-2-a2ui.md` §3 item 4 notes *"now that catalog selection
is a proven, threaded seam end-to-end, this is architecturally closer than it was at the 07-28
snapshot — the prerequisite it names is done"*; `inv-3-genui.md` §4 item 2 cites GH #421 as *"the
A2UI-side analogue of GenUI's per-agent pattern sources (PRD-G2/SPEC-R11)"* — the precedent cl.1/
cl.3 both examine and distinguish from below.

**Facts verified in-tree, standing on the actual mechanisms (not the abstract shape):**

- **The registry is single-document, single-key, per-`catalogId`.** `catalog/catalog.ts:14-20` — a
  `Catalog` is one flat `{catalogId, protocolVersion, components, functions, surfaceProperties?}`
  document. `catalog/registry.ts:36-46` — `Registry.register(catalog, factories, functions?)` runs
  every input through `loadCatalog` (the one shape gate) and stores it keyed by `catalogId`; a
  duplicate `catalogId` is last-wins (registry.ts's own documented "intentional-override path") —
  there is no merge-two-documents-into-one primitive anywhere in this layer today.
- **Registration is renderer-construction-time, unconditional, and covers the whole fleet.**
  ADR-0169 cl.2 (`0169:133-154`): both the default and `a2ui-basic` catalogs pre-register in the
  `Renderer` constructor; "registering only in the admin-surface bootstrap is REJECTED — interop is
  a property of the PACKAGE, not a demo of one page." Any new catalog shape this ADR rules on must
  either fit that same shape (pre-registered, package-shipped) or explicitly diverge from it with a
  reason.
- **Persona-scoped catalog SELECTION already exists and already threads to export.** ADR-0170 built
  a persona-scoped catalog roster: `ENTRY_KINDS.catalog` (`entries.ts:37-44`) records MEMBERSHIP
  (which registered catalogs a persona's picker offers), while the single ON selection lives at
  `A2UI_CATALOG_KEY` (`agent-admin-schema.ts:206`), derived at render time, never stored per-entry.
  Both already ride the persona-file envelope: `agent-admin-persona-file.ts:52-71`'s
  `PERSONA_STATE_KEYS` enumerates `A2UI_CATALOG_KEY` and every `ENTRY_LIST_KEYS` entry (which
  includes the `catalog` kind's store key) — a persona's catalog SELECTION already exports/imports
  byte-identically today. What does NOT exist is a mechanism for a persona to select or compose
  something OTHER than one of the fleet's pre-registered, code-shipped catalogs.
- **Catalog-shaped content is never end-user- or admin-authored at runtime.** ADR-0170 cl.8
  (referenced at `agent-admin-schema.ts:213-214`) deliberately suppresses the custom-add form on the
  `catalog` entry kind — *"the CREATE/authoring affordance still lands separately, when a source
  registry that can mint a new catalog exists"* — a standing park, not reopened here. Every
  registered catalog today (`default/`, `a2ui-basic/`) is a package-level, build-time TypeScript +
  JSON artifact (ADR-0169 cl.1, `0169:114-131`): `catalog.json` + `factories.ts` + `functions.ts`,
  never a browser-mintable object.
- **The generic `Entry` primitive is deliberately unstructured, by design.** `entries.ts:14-16`
  (citing ADR-0132 Fork 3): *"Custom-entry depth is DELIBERATELY generic... label + description +
  free-text content, uniform across every kind... an explicitly deferred, separately-scoped future
  extension — not built here."* `entryListError` (`agent-admin-persona-file.ts:155-168`) validates
  only that generic shape (id/kind/label/description/content/order/enabled/builtin) — it cannot
  express or validate a `PropDef`/component-declaration shape.
- **The one prior "admin-authored per-persona pattern content" precedent is deliberately
  prose-only, never catalog-validated.** genui-surface SPEC-R9 (`genui-surface.spec.md:346-364`):
  pattern-source packs are markdown prose bodies, and AC1 explicitly gates that *"no body embeds an
  A2UI message marker... never a worked example."* SPEC-R10 (`:365-380`) composes the picked
  source's body as free TEACHING TEXT into the prompt — it is never run through `validateA2ui`
  against any catalog schema. GH #421's own Acceptance criterion 3 (*"Validation... follow[s] the
  persona's effective catalog"*) is a requirement the GenUI pattern-source shape does not, and by
  its own design cannot, satisfy.
- **A prompt-layer "catalog-composition idiom" mechanism already exists — and it already teaches
  the exact GH #421 casino example, hard-coded to one catalog's vocabulary, with zero
  catalog-scoping.** `mini-skills.ts` (ADR-0091) is a registry of prose idiom modules; its own
  code comment (`system-prompt.ts:320-323`) names them explicitly: *"mini-skills are
  catalog-composition idioms — `prompts/mini-skills/*.md` name concrete A2UI component types — so
  they are A2UI catalog teaching too."* `prompts/mini-skills/card-game-sheet.md` (verbatim body):
  *"A card-game component sheet. Parts: hand, discard/deck pile, score readout, action bar. Map:
  hand = Row(gap) of Cards · pile = a Card with a Text count · score = a Grid of Text (name→value) ·
  action bar = a Row of Buttons."* — this is GH #421's own "card-table's hand/score layout" example,
  already shipped, already hardcoding `agent-ui` default-catalog component names (`Row`, `Card`,
  `Text`, `Grid`, `Button`). `selectMiniSkills` (`mini-skills.ts:103-105`) and its one call site
  (`produce.ts:764`) carry NO `catalogId` parameter anywhere — unlike `retrieve()`
  (`corpus/retrieve.ts:27-32`, `RetrieveQuery.catalogId` is a hard filter), a mini-skill selected on
  a Basic-catalog turn today would inject wrong-dialect teaching (Basic has no `Card`/`Grid` types,
  cl.9b of ADR-0169) with no guard at all. This is a real, pre-existing, load-bearing gap — recorded
  in cl.3, not fixed by this ADR.

## Decision

### 1 · Q1 — Where the persona's local-pattern layer lives

**Ruling: the local-pattern layer's authoring home is package-level, catalog-schema content —
mirroring the `a2ui-basic` package shape (ADR-0169 cl.1: `catalog.json` + `factories.ts` +
`functions.ts`), scoped per persona/preset rather than per upstream catalog — never the persona
file's runtime store, and never a GenUI-style admin-authored `Entry`.** The persona's runtime
STATE carries only which effective catalog it is bound to (a SELECTION, riding the exact seam
ADR-0170 already built and `agent-admin-persona-file.ts` already exports/imports — cl.2 makes this
precise), never the pattern DEFINITIONS themselves.

**Why not the persona-file envelope as new freeform data (rejected).** GH #421's own Acceptance
criterion 3 requires validation against the persona's effective catalog. Catalog-schema content is
typed `ComponentDef`/`PropDef` shape (`catalog.ts:14-27`) — a `Record<string, ComponentDef>`
keyed by component name, each declaring properties, children shape, and value-mark contracts. The
`Entry` primitive `agent-admin-persona-file.ts`'s envelope carries is, by ADR-0132 Fork 3's own
explicit ruling, *deliberately generic* (label + description + free-text content) — there is no
mechanism today for an `Entry.content` string to be validated as a catalog fragment, and widening
`Entry` into a schema-typed kind is the exact "separately-scoped future extension" ADR-0132 already
declined to build. Riding the envelope as-is would mean either (a) the local pattern stays
free-text prose (failing AC3, the same disqualifier the GenUI precedent hits below), or (b) a
non-trivial widening of the generic-entry primitive this ADR would have to invent from nothing —
out of scope for a design intake whose job is to freeze the architecture, not build it.

**Why not the GenUI pattern-source shape (rejected).** The nearest existing "admin-picks-a-content-
pack-per-persona" mechanism is genui-surface SPEC-R9/R10/R11 — GH #421 itself cites it as precedent.
But that mechanism is deliberately prose-only and never catalog-validated (SPEC-R9 AC1 gates against
a pack body ever looking like a worked A2UI payload; SPEC-R10 composes it as free teaching text,
never through `validateA2ui`). Reusing that shape verbatim for A2UI local patterns would satisfy
none of AC3 — it would produce exactly the mini-skill gap already found in cl.3 (unvalidated,
catalog-vocabulary-hardcoded prose), not a real catalog-schema tier.

**Why not a bespoke, freely admin-authored catalog module at runtime (rejected, not reopened).**
This is the shape GH #421's own "an admin-authored entry kind... a package-level per-persona catalog
module?" open question gestures at on the authoring-UI side. It is already a standing, explicit park:
ADR-0170 cl.8 suppresses catalog-creation UI specifically because "a source registry that can mint a
new catalog" doesn't exist, and ADR-0169's own Non-goals (`0169:570-571`) name the "create/pick-from-
library affordances stay parked per Kim's 2026-07-19 ruling." This ADR does not reopen that park —
the local-pattern layer's AUTHORING remains build-time/code-authored (a developer adds a persona
catalog package the same way `a2ui-basic` was added), while the persona's SELECTION of which
pattern set to compose with is the runtime-facing, already-built seam (cl.2).

### 2 · Q2 — Relationship to ADR-0169's two-catalog `catalogId` registry/threading

**Ruling: (b) — a compose-time overlay.** A persona's effective catalog is DERIVED —
`composeCatalog(base: Catalog, local: CatalogFragment): Catalog`, a pure merge of `components`/
`functions` maps (base ∪ local, collision policy per the open fork below) — and the DERIVED result
is what reaches `Registry.register()`, riding ADR-0169 cl.2/cl.3's existing registration and
server-side selection mechanics completely unchanged. This is a genuinely new composition STEP
ADR-0169 does not have (registration today always takes an already-whole, hand-authored `Catalog`
document — `catalog.ts:14-20`, `registry.ts:39-46` show no merge primitive exists), but the
mechanics it feeds INTO — one `Catalog` object per `register()` call, keyed and selected by
`catalogId`, threaded through `selectCatalog`/`deps.catalog` exactly as ADR-0169 cl.3/cl.4 already
do — are entirely reused, not forked.

**Argued against the ticket's own three named options, from ADR-0169's actual mechanisms:**

- **(a) N registered catalogs (rejected as the SOLE mechanism).** Mirroring ADR-0169's exact
  pattern — a THIRD (Nth) catalog per persona, each a flat, independently-authored
  `catalog.json` — reuses cl.2's registration seam with zero further edits, and its
  registry/scaling cost is real but survivable: registration is a fixed, package-shipped set (like
  `a2ui-basic`), not a per-request/per-session allocation, so "N personas = N catalogs pre-registered
  at renderer construction" is mechanically fine (every `createRenderer()` host already carries the
  full registered set unconditionally, per cl.2's own reasoning that interop is a package property).
  What it fails is GH #421's OWN acceptance criterion 1: "a persona with no local set composes to
  today's default, byte-compatible" describes a DERIVATION with an identity case, not "pick catalog
  N of N" — and N independently-authored flat documents have no structural "shared primitives" layer
  at all; every persona catalog would have to re-declare the ~40 shared component types by copy,
  directly contradicting the ticket's own `shared + shared + local` formula (there would be no
  "shared," only N copies). (a)'s registration mechanics are still the RIGHT output stage — which is
  why (b) reuses them — but (a) alone cannot express the compositional relationship GH #421 asks for.
- **(b) Compose-time overlay — RECOMMENDED**, as above. Registration/selection/threading (cl.2/cl.3/
  cl.4 of ADR-0169) stay untouched; the new surface is strictly upstream of `register()`. The
  "composes to today's default, byte-compatible" acceptance criterion falls out for free: an empty
  local fragment merged into the base produces the base's `components`/`functions` maps unchanged by
  object identity of content (not necessarily object identity of the `Catalog` value itself, but
  `loadCatalog` re-validates either way, so no observable behavior differs). This IS the honest
  novel-architecture answer to Q2, and is named as such, not hidden inside a reused-mechanics
  framing.
- **(c) Prompt-layer-only (rejected).** Never touching the registry/wire `catalogId` at all —
  patterns exist only as system-prompt teaching — is mechanically the SAME shape mini-skills already
  occupy (cl.3) and the GenUI pattern-source packs occupy (cl.1's rejection above): real, cheap, and
  already fails AC3 ("validation... follow[s] the persona's effective catalog") by construction,
  since prompt-only content is never run through `validateA2ui`. Rejected for the same reason cl.1
  rejects it as the local-pattern layer's home.

**A genuinely open question this ADR does not settle** (see Open forks): the collision policy when
a persona's local fragment redefines a component name already present in the base layer, and the
naming convention for a derived catalog's `catalogId`. Both are real LLD-level decisions with
producer-honesty implications (`grammar.md`'s "honesty at the catalog wall" line, and ADR-0011/
ADR-0034's Postel-tolerance rulings, were both explicit Kim calls on adjacent questions) — named
here, not invented.

**Non-collision with ADR-0097, restated precisely for this case.** ADR-0097 rejected a second
catalog id that was really a filtered SUBSET view of the SAME default catalog (`0169:98-110`
restates that rejection and distinguishes `a2ui-basic` as a genuinely distinct component set). A
compose-time overlay is neither: it is an ADDITIVE union of a shared base with persona-local
extensions, never a filter/subset of an existing document, and its OUTPUT is registered as a
genuinely distinct `Catalog` document under its own `catalogId` (cl.13's short-id law extends
naturally: `<base-id>--<persona-id>` or equivalent, an LLD-level naming call). ADR-0097's rejection
does not apply; a future reader should read this note, not flag a contradiction.

### 3 · Q3 — Is "system patterns" an existing layer, or does it need carving out?

**Ruling: it needs carving out as a new, named, catalog-level tier. No existing mechanism occupies
that role today**, though one prompt-layer mechanism (mini-skills, ADR-0091) does adjacent work and
should be named, cited, and left alone — not conflated with the new tier.

**Candidates checked, by reading source:**

- **Mini-skills (ADR-0091) — real, load-bearing, but the wrong LAYER.** As Context documents in
  detail: `system-prompt.ts:320-323`'s own comment calls mini-skills "catalog-composition idioms,"
  and `card-game-sheet.md` already teaches almost verbatim the GH #421 casino example. This is
  strong, genuine functional overlap. But GH #421's formula — `catalog = shared primitives + shared
  system + local patterns` — names parts of a CATALOG (schema-validatable component/pattern
  content), and mini-skills operate one layer up: unvalidated PROSE, selected by intent-match with
  no `catalogId` scoping at all (`mini-skills.ts:103-105`, `produce.ts:764` — contrast
  `retrieve.ts:27-32`'s hard `catalogId` filter). A mechanism that would inject `Row`/`Card`/`Grid`
  teaching on a Basic-catalog turn today, with zero guard, cannot be handed the "shared system
  patterns" role GH #421's AC3 needs (validated, catalog-following content) without first closing
  that gap — and closing it is a different, narrower fix (give `selectMiniSkills` a `catalogId`
  filter) than carving out a schema-level tier. **Recorded as a related, pre-existing, non-blocking
  finding — not fixed by this ADR** (see Non-goals).
- **The prompt grammar's idiom blocks (`prompts/grammar.md`) — does not exist as a named tier.**
  Read in full (91 lines): the file is flat wire-grammar teaching (note-line convention, message
  types, feed-ask archetypes) with no named, reusable, composable "idiom block" structure at all —
  it teaches HOW to speak the protocol, not WHAT domain patterns to build. Not a candidate.
- **Corpus retrieval / `fewShot` (LLD-C9) — catalog-scoped, but exemplar-shaped, not
  pattern-shaped.** `retrieve.ts` is real, per-`catalogId` retrieval of WORKED A2UI examples
  (`CorpusRecord`, `facet:"exemplar"`) — the closest thing to "validated, catalog-following content"
  in the whole system, and structurally the right SHAPE for a "shared system patterns" tier to
  eventually resemble. But it retrieves concrete, one-off worked examples for few-shot conditioning,
  not a named, addressable PATTERN a producer or the catalog-composition step (cl.2) can point to and
  compose by id. Adjacent, not the tier itself.
- **GenUI pattern-source packs (SPEC-R9/R11) — the precedent GH #421 itself cites, and cl.1 already
  distinguishes: prose-only, never catalog-validated.** Same disqualifier as mini-skills, for the
  same reason.

**None of the four is the tier GH #421 names.** The new tier — "shared system patterns" as
catalog-schema content every persona composes over, distinct from both the fleet's raw primitives
and any one persona's local extensions — has no home today and needs to be built when M-D actually
lands (an LLD-level design, out of scope for this intake). Mini-skill bodies (like
`card-game-sheet.md`) are named here as plausible SEED CONTENT for that future tier's authoring —
the idiom knowledge already exists in prose form and could inform the schema-level shapes — but the
mini-skill FILE/mechanism itself is not repurposed or renamed by this ruling.

## Non-goals (recorded, not silent)

- **No `composeCatalog` implementation, collision policy, or derived-`catalogId` naming
  convention.** cl.2 rules the ARCHITECTURE (compose-time overlay); the merge function itself, its
  collision semantics, and the exact id-naming scheme are M-D's own future LLD, and one item (the
  collision policy) is named as a genuine open fork below.
- **No "shared system patterns" tier is built.** cl.3 rules that one is needed; building it —
  deciding its own schema shape, authoring surface, and how personas compose it alongside their
  local pattern set — is M-D's own future design/build work, not this intake.
- **No fix to the mini-skill `catalogId`-scoping gap** cl.3 surfaces (`selectMiniSkills`/
  `produce.ts:764` carry no catalog filter, unlike `retrieve.ts`). Real, pre-existing, and not
  introduced by this ADR — worth its own follow-up (a small, separately-scoped ADR-0091 amendment
  or GitHub issue), not bundled into M-D's build.
- **No reopening of ADR-0170 cl.8's suppressed catalog-authoring UI.** The local-pattern layer stays
  build-time/code-authored (cl.1); a runtime admin-authoring surface for minting NEW catalog content
  remains parked exactly where Kim's 2026-07-19 ruling left it.
- **No change to ADR-0169's registration, selection, or threading mechanics.** Cl.2's compose-time
  overlay is strictly upstream of `register()`; `selectCatalog`, the fail-closed degrade, the
  produce-time authority stamp, and the picker/runner threading are all reused byte-identically.
- **No shipped presets change.** `agent-admin-presets.ts`'s two demonstrating personas (concierge/
  croupier, per GH #421's Acceptance criterion 2) are M-D's own build scope, not this intake's.

## Consequences

- GH #421 gains a ratified architecture to build against: local patterns are catalog-schema
  content, authored at the package layer (cl.1), composed at derive-time over a persona's selected
  base catalog (cl.2), against a "shared system patterns" tier that does not exist yet and is M-D's
  first real carving-out job (cl.3).
- `roadmap.md` §4's GH #421 line (currently framed as three open questions) is stale the moment this
  ADR is proposed and must be restated to the frozen answers on ratification (Repairs cell).
- M-D's own SPEC/LLD inherits three settled forks instead of three open ones, but inherits two new
  named-but-unsettled items of its own: the compose-time collision policy and the derived-catalogId
  naming convention (Open forks below) — this intake narrows the design space, it does not finish it.
- The mini-skill `catalogId`-scoping gap (cl.3) is now a recorded, citable defect independent of
  M-D's fate — worth routing to its own follow-up regardless of when M-D itself ships.
- `.claude/skills/a2ui-multi-catalog` currently documents four registered-catalog patterns (register
  beside default, machine-schema-is-ground-truth, widen-at-the-seams, per-catalog functions +
  threading) — none of them cover a DERIVED/composed catalog, which is a fifth shape this ADR
  introduces conceptually (even though it isn't built yet). The skill needs a forward-pointer note at
  minimum on ratification; a full pattern write-up waits for M-D's actual build (Repairs cell).

## Open forks

- **OF1 — Compose-time collision policy.** When a persona's local pattern fragment redeclares a
  component name already present in the shared base (e.g. a persona-local `Card` variant with
  different props), should the merge (a) let local silently override base, (b) reject the fragment
  at compose time (loud, name-collision error), or (c) require local names to be structurally
  disjoint from base (a namespacing convention)? No in-tree precedent settles this at the
  component-DEFINITION level — the registry's own "duplicate `catalogId` ⇒ last-wins" rule
  (`registry.ts`) operates at the CATALOG level, never the component-name level, so it does not
  transfer. A related but distinct precedent DOES exist one axis over: `a2ui-catalog.spec.md:49`
  (SPEC-R5) and ADR-0034's 2026-06-30 Amendment (`0034:92-102`) already rule a cross-catalog
  collision policy for FUNCTION-name collisions — "most-restrictive-wins... `clientOnly` is a HARD
  FLOOR... independent of registration order" — when the same function name is declared in more
  than one active catalog, the tightest `callableFrom` governs, a sibling may only tighten a
  security gate, never loosen it. That rule is a runtime PERMISSION-FLOOR dispatch decision (which
  catalog's declared authority wins when a server invokes a shared function name), not a compose-time
  CONTENT-authority decision (which catalog's `ComponentDef`/`PropDef` bytes win when two documents
  are merged into one before any request exists) — the two axes do not obviously transfer, and
  applying "most-restrictive-wins" to component shape has no clear reading (a component definition
  has no permissiveness ordering the way a security enum does). Named and distinguished here rather
  than asserted absent; still genuinely open. This has real producer-honesty implications
  (`grammar.md`'s "Be honest at the catalog wall" line, and ADR-0011/ADR-0034's Postel-tolerance
  rulings, were both explicit Kim calls on adjacent honesty-vs-silent-substitution questions) —
  genuinely Kim's to decide, not derivable from the cited sources. Flagged for M-D's SPEC.
- **OF2 — Whether the mini-skill `catalogId`-scoping gap (cl.3) gets absorbed into M-D's own build,
  or filed and shipped as its own independent, smaller fix.** Both are reasonable; it is a
  sequencing/scope call about what M-D's first slice owns, not something the mechanisms alone
  settle. Flagged for M-D's SPEC or a standalone GitHub issue, Kim's call on which.

## Alternatives considered

- **Do nothing / leave GH #421 parked** — rejected outright by Kim's own 2026-08-05 reopen ruling
  quoted in Context; not a live alternative once that ruling landed.
- **Answer all three questions by building the full compose/carve-out mechanism now, in this ADR** —
  rejected: a design-intake ADR's job (per GH #421 AC4 and Kim's ruling's own framing, "the intake
  freezes the three architectural questions") is to freeze the ARCHITECTURE, not pre-build the
  SPEC/LLD; doing the latter here would be manufacturing process ahead of the build team's own
  design pass, and would risk over-committing to unverified mechanics (the collision policy, OF1,
  is a specimen of exactly the kind of decision that needs its own scoped design pass, not a
  guess buried in an intake ADR).
