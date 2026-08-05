# SPEC — Persona Catalog Composition (M-D)

> Status: proposed · v0.1 · 2026-08-05 · Layer: SPEC (execution contract)
> Refines: [ADR-0172](../adr/0172-persona-catalog-composition-intake.md) — under the ratified
> scope + contract directions of cl.1 (Q1 — local-pattern layer home), cl.2 (Q2 — relationship to
> the two-catalog registry), cl.3 (Q3 — the "shared system patterns" carve-out is named, not
> built). Every ruling of ADR-0172 is binding here; this SPEC turns its Repairs cell into testable
> clauses, it re-litigates nothing. Resolves GH [#421](https://github.com/kimgranlund/agent-ui/issues/421)'s
> design-intake follow-on; filed under GH [#480](https://github.com/kimgranlund/agent-ui/issues/480).
> Composes on: [ADR-0169](../adr/0169-a2ui-basic-catalog-upstream-interop.md) (registration/
> selection/threading mechanics, reused byte-identically — SPEC-N4) and
> [ADR-0170](../adr/0170-catalog-library-kind-single-select.md) (the `ENTRY_KINDS.catalog` +
> `A2UI_CATALOG_KEY` selection seam this design rides). Cites, does not build:
> [ADR-0091](../adr/0091-a2ui-gen-ui-mini-skill-registry.md) (mini-skills — the adjacent prose
> layer cl.3 distinguishes) and [ADR-0132](../adr/0132-agent-admin-instructions-capabilities-architecture.md)
> (the generic `Entry` primitive — why the local-pattern layer never rides it, cl.1).
> Altitude: owns the **compose-time contract + the five Repairs-cell build surfaces**. No PRD is
> owed — ADR-0172's own Context section IS the why/what record (GH #421's own acceptance criteria,
> quoted there); no LLD is owed by this document either — two genuine open forks (§5) make an LLD
> premature until Kim rules them, so the "L" work these clauses would otherwise hand off waits on
> that ruling (see §7 sequencing). Requirement IDs file-scoped (`SPEC-R#`/`SPEC-N#`); every id
> traces to an ADR-0172 clause + a Repairs-cell item (§8, the clause map).

---

## 1 · Purpose

Turn ADR-0172's three frozen rulings into a testable, buildable contract for M-D's first slice:
the compose-time mechanism by which a persona's package-authored local pattern set overlays a
registered base catalog into one derived `Catalog`, registered and selected through ADR-0169's
existing mechanics unchanged. This SPEC does not choose the two things ADR-0172 explicitly left
open — the collision policy and the derived-id naming convention (§5) — it fixes everything else
so the build has a floor to stand on regardless of how those two resolve.

## 2 · Definitions

- **Local pattern set / local fragment** — a persona-scoped, package-authored, catalog-schema
  content unit: typed `components`/`functions` maps mirroring `catalog.json`/`factories.ts`/
  `functions.ts` (ADR-0169 cl.1's `a2ui-basic` shape), never a whole standalone `Catalog` (it
  carries no `catalogId`/`protocolVersion` of its own — those come from the base it composes
  onto). Authored at build time, by a developer, the same way `a2ui-basic` was added (ADR-0172
  cl.1) — never admin-authored, never runtime-minted.
- **Base catalog** — a catalog already registered through today's mechanism (`agent-ui` or
  `a2ui-basic`, `registry.ts:36-46`'s `Registry.register`).
- **Compose-time overlay / `composeCatalog`** — the pure function `composeCatalog(base: Catalog,
  local: CatalogFragment): Catalog` (ADR-0172 cl.2) that merges `local`'s `components`/`functions`
  maps over `base`'s, producing a new `Catalog` document with its own derived `catalogId`
  (`base.protocolVersion`/`surfaceProperties` carried through unchanged — neither is named as
  overlay-composable by ADR-0172, and no Repairs-cell item asks for it).
- **Derived catalog** — the `composeCatalog` output, once registered, is a normal `Catalog`
  document under its own `catalogId` — indistinguishable, downstream of `register()`, from any
  other registered catalog (ADR-0172 cl.2's "no third wire-visible id beyond what compose-time
  derivation implies").
- **Effective catalog** — the catalog a given persona's turn actually renders/validates/teaches
  against: either a base catalog directly (no local set selected — the identity case, GH #421 AC1)
  or a derived catalog (a local set selected).

## 3 · Requirements (SPEC-R)

Every acceptance line is a checkable predicate; gates are judged by exit codes (repo-standing
law), never by reading output.

**SPEC-R1 — The local-pattern package home** *(ADR-0172 cl.1 · Repairs item 1)*.
A persona-scoped local pattern set MUST live as a sibling package folder under
`packages/agent-ui/a2ui/src/catalog/personas/<persona-id>/`, mirroring `a2ui-basic/`'s internal
shape (ADR-0169 cl.1, `catalog/a2ui-basic/index.ts:1-27`): a `catalog.json`-shaped fragment
document (see SPEC-R1 AC2 for exactly what it omits vs. a full `Catalog`), `factories.ts`
(widget bindings for any component the fragment adds), an optional `functions.ts`
(ADR-0169 cl.8's per-catalog function-impl override table, reused unchanged — SPEC-N4), and an
`index.ts` exporting the loaded fragment + its factory table. `<persona-id>` is a stable kebab
identifier (matching the persona/preset it scopes to, e.g. `concierge`), never a free-text label.
The fragment document is NEVER stored in the persona-file runtime envelope or as an `Entry`
(ADR-0172 cl.1's rejection of both — the persona's runtime state carries only a SELECTION,
SPEC-R5).
- **AC1** *Given* a new persona-scoped local pattern set, *when* added, *then* it lands entirely
  under its own `catalog/personas/<persona-id>/` folder with zero edits to `catalog/default/` or
  `catalog/a2ui-basic/` (the two-tier zero-edit law, SPEC-R6's AC1 in the catalog SPEC, reused
  for a third tier).
- **AC2** *Given* a fragment's `components`/`functions` declarations, *when* loaded, *then* they
  pass the SAME structural + UAX-31 naming gates `loadCatalog`'s internal `validateComponent`/
  `validatePropDef`/`validateFunctions` already run on a whole catalog (`catalog.ts:210-330`) —
  a malformed or `@`-prefixed fragment name fails load exactly as a malformed whole-catalog
  document does today. (Whether this reuses `loadCatalog` against a synthesized `catalogId`/
  `protocolVersion` pair or introduces a sibling `loadCatalogFragment` is an implementation
  choice, not fixed by this SPEC — either satisfies this AC.)
- **AC3** *Given* a fragment's component whose name collides with `catalog/default/` or any other
  already-registered base's component name, *when* the fragment is loaded IN ISOLATION (before
  composition), *then* loading itself never fails on that basis — collision is a compose-time
  concern (SPEC-R2), not a load-time one; the fragment's `factories.ts` MUST still supply a
  factory for every component it declares (mirroring `registry.ts:51-58`'s `FACTORY_MISSING`
  gate, applied to the fragment's own declared set before composition).

**SPEC-R2 — The compose-time overlay + constructor-time derive-then-register step**
*(ADR-0172 cl.2 · Repairs item 2)*. `Renderer`'s constructor (`renderer.ts:148-160`) MUST gain a
derive-then-register step, additive to its existing two static registrations (`agent-ui` default
+ `a2ui-basic`/`a2ui-basic` canonical alias, three actual `register()` calls today): for every
shipped `catalog/personas/<persona-id>/` package (SPEC-R1), `composeCatalog(base, local)` runs
against the **default (`agent-ui`) catalog as `base`**, and the result registers via
`this.#registry.register(...)` under its derived `catalogId` (§5 OF1's naming call) — unconditional
and package-shipped, the same "interop is a property of the package, not a demo of one page"
posture ADR-0169 cl.2 already established for `a2ui-basic`, reused here rather than re-argued.
Composing a persona's local set over `a2ui-basic` instead of the default is explicitly OUT of
this wave's scope (SPEC-N5) — a base-catalog choice per local set is a real future widening, not
built here.
- **AC1 (identity case, GH #421 AC1)** *Given* a local fragment with empty `components: {}` and
  `functions: {}`, *when* composed over `base`, *then* the derived `Catalog`'s `components` and
  `functions` maps are content-equal to `base`'s (re-validated through `loadCatalog`, so no
  observable behavior differs — ADR-0172 cl.2's own reasoning, restated as a test).
- **AC2 (non-colliding union)** *Given* a local fragment whose component/function names are
  wholly disjoint from `base`'s, *when* composed, *then* the derived catalog's `components` map
  is exactly `{...base.components, ...local.components}` and `functions` likewise — every
  base-only type/function resolves unchanged, every local-only type/function resolves newly, and
  the derived catalog registers with zero `CATALOG_FACTORY_MISSING` (the combined factory table
  from `base`'s + the fragment's `factories.ts` covers every declared type — registry.ts:51-58's
  existing gate, unmodified).
- **AC3 (collision case — placeholder, pending OF1)** *Given* a local fragment whose fragment
  declares a component name already present in `base`, the collision-resolution BEHAVIOR is not
  fixed by this SPEC (§5 OF1) — this clause only fixes that AC1/AC2 hold unconditionally
  regardless of which OF1 answer ships, and that whichever answer is chosen is deterministic and
  covered by its own test once ruled.
- **AC4** *Given* the derived catalog once registered, *when* `deps.catalog` (produce.ts:88) is
  set to it for a turn, *then* `buildSystemPrompt`'s `catalogInventory`/`catalogIdTeaching`
  (`system-prompt.ts:177-195,329-344`) and the shared validator (catalog SPEC-R7) both operate on
  it with NO code change of their own — they already consume a `Catalog` value, not a hardcoded
  id (system-prompt.ts:330's `catalog: Catalog` parameter) — satisfying GH #421 AC2/AC3
  ("validation and the composed system prompt's catalog teaching both follow the persona's
  effective catalog") as a consequence of SPEC-R2/R3's threading, not as a separate build item.
- **AC5** *Given* `protocolVersion`/`surfaceProperties` on `base`, *when* composed, *then* the
  derived catalog carries them through unchanged (a local fragment never overrides either — not
  named as composable by ADR-0172, and no Repairs-cell item requests it).

**SPEC-R3 — Selection recognizes derived ids without regressing the base picker**
*(ADR-0172 cl.2 · Repairs item 3)*. `A2UI_CATALOG_OPTIONS`/`sanitizeCatalog`
(`agent-admin-schema.ts:206-241`) MUST widen so that whatever string ends up carrying the
EFFECTIVE catalogId at threading time (the id forwarded on the POST body per the a2ui-multi-catalog
skill's §4, "the client runner forwards the picker's sanitized id") is recognized as valid when it
names a registered derived catalog — never silently sanitized back to `DEFAULT_A2UI_CATALOG_ID`
the way an unrecognized id is today (`sanitizeCatalog`'s existing fail-closed default,
`agent-admin-schema.ts:239-241`). The exact string form of a derived id is §5 OF1's naming call;
this clause fixes only that RECOGNITION must exist once a form is chosen, and that a persona
whose local-pattern-set selection (SPEC-R5) names a real, registered local set is never
regressed by this pre-existing 2-entry allowlist.
- **AC1** *Given* a derived catalog registered under id `D` (SPEC-R2), *when* `D` is the effective
  catalogId a persona's turn resolves to, *then* `sanitizeCatalog(D) === D` (not the default) —
  the allowlist-widening this clause requires, expressed as a single assertion.
- **AC2** *Given* a persona with NO local-pattern-set selection, *when* its effective catalogId is
  resolved, *then* `sanitizeCatalog` behaves BYTE-IDENTICALLY to today for the two existing
  options (`agent-ui`/`a2ui-basic`) — this clause is additive, not a rewrite of the existing
  2-entry allowlist's behavior for those two ids.

**SPEC-R4 — The multi-catalog skill gains a fifth pattern** *(ADR-0172 cl.2 · Repairs item 4)*.
`.claude/skills/a2ui-multi-catalog/SKILL.md` MUST gain a "5 · Composed/derived catalogs" section
beside its four registered-catalog patterns (§1–§4 today), distinguishing compose-time overlay
from "register a catalog beside the default" (§1) by citing this SPEC + ADR-0172 cl.2, and — once
§5's forks are ruled — stating the shipped collision policy and derived-id convention as the
skill's own worked pattern (the same "cite the ADR/SPEC, don't restate the table" discipline the
skill already follows for `a2ui-basic`).
- **AC1** *Given* the skill file post-build, *when* read, *then* it names `composeCatalog`, cites
  this SPEC's SPEC-R2, and its Routing boundary paragraph (currently silent on composed catalogs)
  is extended to route a "compose a persona's local patterns" ask here rather than to §1's
  register-beside-default pattern (they are mechanically different: §1 has no merge primitive,
  ADR-0172 cl.2's own Context finding).
- **AC2** the file continues to pass `site/lib/docs-grammar.test.ts`'s S9 exemplar-path sweep and
  the dangling-relative-link check (SPEC-N4 in agent-ui-doc-standards' own gate table).

**SPEC-R5 — The persona's local-pattern-set SELECTION, never its definitions, is exportable state**
*(ADR-0172 cl.1 · Repairs item 5)*. `agent-admin-schema.ts` MUST gain a new persisted key —
`A2UI_LOCAL_PATTERNS_KEY = 'a2uiLocalPatterns'` (illustrative name; the exact literal is a build
detail, not re-litigated here) — recording which `catalog/personas/<persona-id>/` local set (or
none) a persona composes on top of its base catalog (SPEC-R2's `local` input selector),
symmetrical in STORAGE SHAPE to `A2UI_CATALOG_KEY` (a single persisted string, fail-closed
sanitized the same way `sanitizeCatalog` is). `agent-admin-persona-file.ts`'s `PERSONA_STATE_KEYS`
(`agent-admin-persona-file.ts:52-71`) MUST include this new key alongside `A2UI_CATALOG_KEY` —
the persona-file envelope carries the SELECTION only; the pattern DEFINITIONS never travel through
export/import (they are package-shipped code, SPEC-R1).
- **AC1** *Given* a persona with a non-default local-pattern-set selection, *when* exported via
  `readPersonaState` and re-imported into a fresh persona, *then* the new persona's selection
  round-trips byte-identically (the same `agent-admin-persona-file.test.ts` round-trip discipline
  every other `PERSONA_STATE_KEYS` member already passes), and the exported JSON contains no
  `components`/`functions`/`ComponentDef` bytes anywhere — a grep-level assertion that the
  envelope stayed selection-only.
- **AC2** *Given* a persona with no local-pattern-set selection (the default/unset state), *when*
  its effective catalog resolves, *then* it resolves to the base catalog alone — SPEC-R2 AC1's
  identity case, reachable end-to-end from persona state.

## 4 · Non-functional requirements (SPEC-N)

| ID | Requirement |
|---|---|
| **SPEC-N1** | **No fix to the mini-skill `catalogId`-scoping gap.** `selectMiniSkills`/`produce.ts:762-764` carry no `catalogId` filter today (unlike `corpus/retrieve.ts:41,55`'s hard `meta.catalogId` filter, confirmed live) — ADR-0172 cl.3 surfaces this as real and pre-existing; this SPEC does not fix it. Whether it is absorbed into M-D's build or filed standalone is §5 OF2, unresolved here. |
| **SPEC-N2** | **No "shared system patterns" tier is built.** ADR-0172 cl.3 rules one is needed (a new, named, catalog-level tier distinct from both the default catalog and any one persona's local set); designing and building it is explicitly M-D's OWN future design/build work, not this SPEC's — this SPEC's five clauses build the PERSONA-local overlay mechanism only, not the shared-system layer that would compose beneath it. |
| **SPEC-N3** | **No reopening of ADR-0170 cl.8's suppressed catalog-authoring UI.** `EntryListOptions`'s `customAdd:false`/`contentField:false` for `ENTRY_KINDS.catalog` (`0170:112-116`) stays exactly where it is — local pattern sets are package/code-authored (SPEC-R1), never admin-authored through the entry-list UI. |
| **SPEC-N4** | **No change to ADR-0169's registration, selection, or threading mechanics.** `Registry.register`/`get`/`supportedCatalogIds`/`submitGateSelector` (`registry.ts:36-91`), `selectCatalog`'s fail-closed degrade, and the produce-time authority stamp (`stampCreateSurfaceCatalogId`, `produce.ts:306`) are all reused byte-identically; SPEC-R2's derive-then-register step is strictly upstream of `register()`, never a fork of it. |
| **SPEC-N5** | **Composition targets the default catalog only, this wave.** SPEC-R2 composes every shipped local set against `agent-ui` (the default) as `base`. Composing a local set over `a2ui-basic` (or any future third base) is a real, distinct future widening — no Repairs-cell item asks for it, and building it now would pre-empt whatever base-selection UI shape a multi-base compose would need. |
| **SPEC-N6** | **No shipped persona content.** This SPEC builds the MECHANISM only. `agent-admin-presets.ts`'s two demonstrating personas (concierge/croupier, GH #421 AC2) — and any real local-pattern-set content for them — are a LATER M-D slice (ADR-0172's own Non-goals bullet: "M-D's own build scope, not this intake's" — extended here to mean not this SPEC's first slice either, §7). |
| **SPEC-N7** | **Fleet DoD holds.** `npm run check && npm test` exit 0, and the per-package `layering.test.ts` trip-wires stay green (`a2ui` imports nothing new outward; `app`'s `agent-admin-schema.ts`/`agent-admin-persona-file.ts` growth stays additive, zero renamed exports). |

## 5 · Open forks — Kim's decision, not this SPEC's

ADR-0172 named two genuine forks it deliberately did not settle. Both are surfaced here as this
SPEC's own explicit decision points; neither is picked below — each blocks exactly the clause(s)
noted, and an LLD for this mechanism is premature until both are ruled (§7).

### OF1 — Compose-time collision policy + derived-id naming

**Blocks:** SPEC-R2 AC3 (the collision arm), SPEC-R3 (the exact derived-id string form it must
recognize), SPEC-R4 AC1 (the skill's worked pattern needs the shipped answer to state it).

**The question, restated from ADR-0172's Open forks section (verbatim substance, not re-argued):**
when a persona's local fragment redeclares a component name already present in the base catalog
(e.g. a persona-local `Card` variant with different props), should `composeCatalog` —

- **(a) let local silently override base** — simplest, matches `Registry.register`'s own
  "duplicate `catalogId` ⇒ last-wins" spirit (`registry.ts:60-64`), but that precedent operates at
  the CATALOG level (a whole document replacing another), never the component-NAME level inside
  one merge — it does not obviously transfer, and a silent override risks the exact "honesty at
  the catalog wall" failure mode `grammar.md` and ADR-0011/ADR-0034's Postel-tolerance rulings
  were built to avoid (an agent trained on base `Card`'s shape silently gets a different one).
- **(b) reject the fragment at compose time** (loud, name-collision error) — the safest default
  for a security/correctness posture, but blocks a legitimate "the persona's Card really is a
  themed variant" authoring intent outright, forcing every override into a differently-named
  type instead (defeats part of why an author would want to shadow a base name at all).
- **(c) require local names to be structurally disjoint from base** (a namespacing convention,
  e.g. every local type prefixed/suffixed) — sidesteps the ambiguity by construction, at the cost
  of a naming-convention tax on every fragment author and a less "this Card variant IS a Card"
  reading for the agent consuming the catalog inventory (`catalogInventory`, `system-prompt.ts:177`).

A related but DISTINCT precedent exists one axis over and does **not** transfer cleanly: the
catalog SPEC's own SPEC-R5 / ADR-0034's 2026-06-30 Amendment already rule a collision policy for
FUNCTION-name collisions across catalogs — "most-restrictive-wins... `clientOnly` is a HARD
FLOOR... independent of registration order" (verified live: `catalog.ts:317-320`'s
`callableFrom` default-to-`clientOnly` + registry.ts's per-catalog `functions` override,
`registry.ts:65-67`). That is a runtime PERMISSION-FLOOR dispatch decision (which catalog's
declared authority wins when a server invokes a shared function name); OF1 is a compose-time
CONTENT-authority decision (which catalog's `ComponentDef`/`PropDef` BYTES win when two documents
merge into one, before any request exists). A `ComponentDef` has no permissiveness ordering the
way a `callableFrom` enum does, so "most-restrictive-wins" has no obvious reading here — named and
distinguished, not asserted absent.

Separately, and only once (a)/(b)/(c) above is picked: the derived `catalogId`'s naming
convention (e.g. `<base-id>--<persona-id>`, ADR-0172 cl.2's own suggested-not-ruled form) is an
LLD-level string-format call this SPEC does not fix either — SPEC-R2/R3 are written to hold for
ANY chosen form.

**Status: awaiting Kim's decision.** No recommendation is made here — this is a producer-honesty
call (silent substitution vs. loud rejection vs. a naming tax), the same category of call
ADR-0011/ADR-0034 required Kim to make directly on adjacent questions.

### OF2 — Whether the mini-skill `catalogId`-scoping gap rides this build

**Blocks:** whether SPEC-N1 stays a pure non-goal or a SPEC-R clause is added in a later revision
of this document.

ADR-0172 cl.3 surfaces (does not fix) a real, pre-existing gap: `selectMiniSkills`
(`mini-skills.ts:103`) and its one call site (`produce.ts:764`) carry no `catalogId` parameter,
unlike `retrieve()`'s hard `meta.catalogId` filter (`corpus/retrieve.ts:41,55`, confirmed live) —
a mini-skill selected on an `a2ui-basic` (or a future derived-catalog) turn today would inject
wrong-dialect teaching (e.g. `card-game-sheet.md`'s hard-coded `Row`/`Card`/`Grid` names) with no
guard. Two reasonable paths, neither chosen here:

- **Absorb into M-D's build** — this SPEC (or a revision of it) grows a `SPEC-R` clause giving
  `selectMiniSkills` a `catalogId` filter mirroring `retrieve.ts`'s, closing the gap in the same
  wave that makes derived catalogs common (a derived-catalog turn is exactly the case most likely
  to surface the defect in practice, so shipping the two together has a coherence argument).
- **File standalone** — a small, separately-scoped GitHub issue (or an ADR-0091 amendment) fixes
  it independently of M-D's own schedule, keeping this SPEC's surface area to the five Repairs-cell
  items alone (the narrower, easier-to-review build).

**Status: awaiting Kim's decision** — a sequencing call, not a mechanics question; both paths use
the identical fix once chosen.

## 6 · Non-goals (recorded, not silent)

- **No fix to the mini-skill `catalogId`-scoping gap** — pending OF2 (§5); SPEC-N1.
- **No "shared system patterns" tier** — ADR-0172 cl.3's own scoping; SPEC-N2.
- **No reopening of ADR-0170 cl.8's suppressed catalog-authoring UI** — SPEC-N3; local pattern
  sets stay build-time/code-authored, never a runtime admin-authoring surface.
- **No change to ADR-0169's registration, selection, or threading mechanics** — SPEC-N4; the
  compose-time overlay is strictly upstream of `register()`.
- **No composition over `a2ui-basic` (or any base besides the default) this wave** — SPEC-N5.
- **No shipped persona content** (concierge/croupier or any other local-pattern-set's real
  component definitions) — SPEC-N6; this SPEC builds the mechanism, not the demonstrating personas.
- **No `composeCatalog` collision policy or derived-`catalogId` naming convention picked here** —
  both are §5 OF1, Kim's call, not derivable from the cited mechanisms.

## 7 · Build sequencing for M-D's first slice

1. **OF1 and OF2 rule first.** SPEC-R2 AC3, SPEC-R3's exact recognition target, and SPEC-R4 AC1's
   worked pattern all depend on OF1's answer; SPEC-N1's fate depends on OF2. Dispatching build
   against this SPEC before both are ruled means building SPEC-R1/R5 (which do not depend on
   either fork) while SPEC-R2/R3/R4 stay blocked — a legitimate partial start, not a full slice.
2. **SPEC-R1 (package home) and SPEC-R5 (selection key) are fork-independent** — they may build
   in parallel with OF1/OF2's resolution: the package SHAPE (SPEC-R1) and the persona-state
   SELECTION plumbing (SPEC-R5) exist regardless of what collision policy or naming scheme later
   fills SPEC-R2/R3 in. A minimal fixture local-pattern-set (empty `components`/`functions`, or a
   single non-colliding demo type) is sufficient to prove SPEC-R1's shape and SPEC-R5's round-trip
   without waiting on OF1.
3. **SPEC-R2 (compose + register) lands once OF1 rules** — the identity case (AC1) and the
   non-colliding union case (AC2) are buildable and testable immediately once a fixture exists;
   the collision arm (AC3) fills in with whichever of (a)/(b)/(c) Kim picks.
4. **SPEC-R3 (selection recognizes derived ids) follows SPEC-R2** — it needs a real registered
   derived catalog to assert non-regression against.
5. **SPEC-R4 (the skill's fifth pattern) lands last in this slice** — it documents the shipped
   answer, so it necessarily follows OF1's resolution and SPEC-R2's landing.
6. **SPEC-N6's later slice** (shipping concierge/croupier's real local-pattern-set content) is
   explicitly NOT this slice — it is the first real CONSUMER of SPEC-R1–R5's mechanism, and earns
   its own build dispatch (and, if its own genuinely ambiguous requirements surface, its own SPEC
   revision or ticket) once the mechanism ships.
7. **This SPEC itself may need a revision, not a rewrite, once OF1/OF2 rule** — §5's two forks
   resolve into filled-in AC3/SPEC-N1 clauses; nothing else in §3/§4 is expected to change shape.

## 8 · Clause map (SPEC id → ADR-0172 ruling → Repairs-cell item)

| SPEC id | ADR-0172 ruling | Repairs-cell item | Notes |
|---|---|---|---|
| SPEC-R1 | cl.1 (Q1 — package-level home) | 1 — new `catalog/<persona-scoped-shape>/` convention | Fork-independent (§7 step 2) |
| SPEC-R2 | cl.2 (Q2 — compose-time overlay) | 2 — renderer constructor derive-then-register | AC3 blocked on OF1 |
| SPEC-R3 | cl.2 (Q2) | 3 — `A2UI_CATALOG_OPTIONS`/`sanitizeCatalog` widen | Recognition target blocked on OF1's naming half |
| SPEC-R4 | cl.2 (Q2) | 4 — `a2ui-multi-catalog` SKILL.md fifth pattern | Worked-pattern content blocked on OF1 |
| SPEC-R5 | cl.1 (Q1 — selection, never definitions) | 5 — `PERSONA_STATE_KEYS` gains the local-set key | Fork-independent (§7 step 2) |
| SPEC-N1 | cl.3 (Q3 — mini-skill gap named, not fixed) | 6 — explicitly NOT this wave | OF2 decides its future, not its presence here |
| SPEC-N2 | cl.3 (Q3 — tier needs carving out, not built here) | — | ADR-0172's own scoping |
| SPEC-N3 | — (ADR-0170 cl.8, standing park) | — | Non-collision restated |
| SPEC-N4 | cl.2 (reuses ADR-0169 mechanics unchanged) | — | |
| SPEC-N5 | cl.2 (this SPEC's own scoping, found during authoring — not an ADR-0172 clause) | — | Flagged for Kim; see the campaign Findings comment |
| SPEC-N6 | ADR-0172 Non-goals ("M-D's own build scope, not this intake's") | — | Extended here to this SPEC's first slice too |
| SPEC-N7 | — (repo-standing fleet DoD) | — | |

## 9 · Acceptance for this document

This SPEC ships `proposed`; Kim rules OF1 and OF2 (§5) and confirms SPEC-N5's scoping call before
build dispatch — none of the three self-ratify. Document gates: `site/lib/docs-grammar.test.ts`
(status-keyword presence + the dangling-relative-link sweep) exits 0 inside `npm run check`'s
`check:site` step; every relative link in this document resolves (§8's ADR/SPEC citations,
manually re-verified against the live tree while authoring — the agent-ui-doc-standards
"re-derive at source" discipline).
