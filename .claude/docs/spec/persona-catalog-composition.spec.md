# SPEC — Persona Catalog Composition (M-D)

> Status: accepted · v0.2 · 2026-08-06 · Layer: SPEC (execution contract)
> **v0.2 (2026-08-06):** Kim's acceptance-round rulings fold in (§5, citing
> [PR #482#issuecomment-5199254913](https://github.com/kimgranlund/agent-ui/pull/482#issuecomment-5199254913)
> as their provisional record) — OF1 (reject-loud collision policy), OF1b (`<base>--<persona>`
> derived-id naming), OF2 (the mini-skill `catalogId`-scoping fix, absorbed as SPEC-R6), and SPEC-N5
> (widened to compose over BOTH shipped bases, not the default alone). The affected clauses
> (SPEC-R1's new `targetCatalogs` field, SPEC-R2/R3/R4, §2's definitions, SPEC-N5) are edited IN
> PLACE, not appended — they fill in previously-placeholder text (a pending fork's AC, a
> since-superseded scoping line) rather than add net-new, non-conflicting clauses, so §5 is fully
> restructured from "Open forks" to "Acceptance-round rulings" rather than growing an amendment
> log. Status stays `proposed`; only Kim's own acceptance flip on PR #482 ratifies (§9).
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
> Altitude: owns the **compose-time contract + the six Repairs-cell build surfaces** (item 6, the
> mini-skill `catalogId` fix, absorbed per OF2's ruling — §5). No PRD is owed — ADR-0172's own
> Context section IS the why/what record (GH #421's own acceptance criteria, quoted there); no LLD
> is owed by this document either — this SPEC turns ADR-0172's rulings plus its own now-settled
> forks (§5) into a testable contract; the implementation-level component/interface decomposition
> is separate future build-dispatch work, unblocked once Kim's own acceptance flip lands (§9), not
> gated on any further ruling. Requirement IDs file-scoped (`SPEC-R#`/`SPEC-N#`); every id traces
> to an ADR-0172 clause + a Repairs-cell item (§8, the clause map).

---

## 1 · Purpose

Turn ADR-0172's three frozen rulings — plus Kim's 2026-08-06 acceptance-round rulings on the four
forks ADR-0172 and this SPEC's own first-draft authoring left open (§5, citing PR #482's relay
comment) — into a testable, buildable contract for M-D's first slice: the compose-time mechanism
by which a persona's package-authored local pattern set overlays ONE OR MORE of the two
currently-registered base catalogs (`agent-ui`, `a2ui-basic` — SPEC-N5, widened) into one derived
`Catalog` per targeted base, registered and selected through ADR-0169's existing mechanics
unchanged. Nothing is left open for a future revision to fill in: the collision policy
(reject-loud, OF1), the derived-id naming convention (`<base>--<persona>`, OF1b), the mini-skill
`catalogId`-scoping fix (absorbed as SPEC-R6, OF2), and the base-catalog scope (widened, not
default-only, SPEC-N5) are all encoded directly in §2/§3/§4 below.

## 2 · Definitions

- **Local pattern set / local fragment** — a persona-scoped, package-authored, catalog-schema
  content unit: typed `components`/`functions` maps mirroring `catalog.json`/`factories.ts`/
  `functions.ts` (ADR-0169 cl.1's `a2ui-basic` shape), never a whole standalone `Catalog` (it
  carries no `catalogId`/`protocolVersion` of its own — those come from whichever base(s) it
  composes onto, `targetCatalogs`, SPEC-R1). Authored at build time, by a developer, the same way
  `a2ui-basic` was added (ADR-0172 cl.1) — never admin-authored, never runtime-minted.
- **Base catalog** — a catalog already registered through today's mechanism (`registry.ts:36-46`'s
  `Registry.register`) — `agent-ui` (default) or `a2ui-basic`, the exhaustive set a compose-time
  overlay may target this wave (SPEC-N5, widened §5). A hypothetical future third base is not yet a
  legal `base`.
- **Compose-time overlay / `composeCatalog`** — the pure function `composeCatalog(base: Catalog,
  local: CatalogFragment): Catalog` (ADR-0172 cl.2) that merges `local`'s `components`/`functions`
  maps over `base`'s, producing a new `Catalog` document with its own derived `catalogId` (OF1b's
  `<base>--<persona>` convention, §5; `base.protocolVersion`/`surfaceProperties` carried through
  unchanged — neither is named as overlay-composable by ADR-0172, and no Repairs-cell item asks
  for it). ONE derivation per (fragment, targeted base) pairing (SPEC-R1's `targetCatalogs`,
  SPEC-R2) — a fragment targeting both bases composes twice, independently, never producing one
  merged three-way document.
- **Derived catalog** — a `composeCatalog` output, once registered, is a normal `Catalog` document
  under its own `catalogId` — indistinguishable, downstream of `register()`, from any other
  registered catalog (ADR-0172 cl.2's "no third wire-visible id beyond what compose-time
  derivation implies"). A fragment that targets both bases produces TWO derived catalogs, one per
  (base, persona) pairing.
- **Effective catalog** — the catalog a given persona's turn actually renders/validates/teaches
  against: either a base catalog directly (no local set selected — the identity case, GH #421 AC1)
  or a derived catalog (a local set selected AND targeting the persona's currently-selected base —
  SPEC-R5 AC3 governs the fail-closed degrade when those two selections don't line up).

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
`index.ts` exporting the loaded fragment + its factory table + which base(s) it composes onto
(`targetCatalogs: readonly string[]`, SPEC-R2's per-pairing input — naming one or both of the two
currently-registered bases, `agent-ui`/`a2ui-basic`, SPEC-N5; absent defaults to `['agent-ui']`
alone, preserving a single-base fragment's authoring shape unchanged by this widening).
`<persona-id>` is a stable kebab identifier (matching the persona/preset it scopes to, e.g.
`concierge`), never a free-text label. The fragment document is NEVER stored in the persona-file
runtime envelope or as an `Entry` (ADR-0172 cl.1's rejection of both — the persona's runtime state
carries only a SELECTION, SPEC-R5).
- **AC1** *Given* a new persona-scoped local pattern set, *when* added, *then* it lands entirely
  under its own `catalog/personas/<persona-id>/` folder with zero edits to `catalog/default/` or
  `catalog/a2ui-basic/` (the two-tier zero-edit law, catalog SPEC-R6's AC1, reused for a third
  tier).
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
- **AC4** *Given* a fragment's `targetCatalogs` declaration, *when* read, *then* every named id is
  one of the two currently-registered bases (`agent-ui`, `a2ui-basic`) — naming any other id (a
  typo, or a hypothetical future third base) is caught at SPEC-R2's constructor-time
  derive-then-register step (SPEC-R2 AC6), not silently accepted here.

**SPEC-R2 — The compose-time overlay + constructor-time derive-then-register step**
*(ADR-0172 cl.2 · Repairs item 2)*. `Renderer`'s constructor (`renderer.ts:148-160`) MUST gain a
derive-then-register step, additive to its existing three `register()` calls (`agent-ui` default,
the `a2ui-basic` short id, and its canonical-URI inbound alias — SPEC-N4, unmodified): for every
shipped `catalog/personas/<persona-id>/` package (SPEC-R1) and every base catalog id `B` its
`targetCatalogs` names, `composeCatalog(base, local)` runs once with `base` = the ALREADY-registered
entry for `B` (`agent-ui` or `a2ui-basic` — never the canonical-URI alias, which is inbound-only
and never a composition target, ADR-0169 cl.13), and the result registers via
`this.#registry.register(...)` under its own derived `catalogId` per OF1b's `<base>--<persona-id>`
convention (§5) — e.g. `agent-ui--concierge`, `a2ui-basic--croupier` — unconditional and
package-shipped, the same "interop is a property of the package, not a demo of one page" posture
ADR-0169 cl.2 already established for `a2ui-basic`, reused here rather than re-argued. A fragment
whose `targetCatalogs` names BOTH bases produces TWO independently-composed, independently-registered
derived catalogs at construction — the same fragment content merged against each base separately.
Composing over a hypothetical future third base is out of this wave's scope (SPEC-N5, §5) — the
base set this clause composes against is exactly `{agent-ui, a2ui-basic}`, the two bases shipped
today.

**Collision policy (OF1, ruled — §5): reject-loud.** A local fragment whose declared component OR
function name already exists in a targeted base's `components`/`functions` map FAILS that
(fragment, base) pairing's composition with a named, deterministic error at constructor time —
never a silent override, never a namespacing tax. Mirrors `RegistryError`'s existing `code`+
`message` shape (`registry.ts:23-30`): a `CatalogComposeError` (or equivalent — the exact
class/name is a build detail, not fixed here) naming the fragment's persona id, the colliding
base's `catalogId`, and the colliding component/function name. Thrown synchronously inside the
constructor's derive-then-register step — the SAME fail-loud-at-construction posture
`RegistryError`'s own `FACTORY_MISSING` gate already has for a malformed base catalog
(`registry.ts:51-58`): a bad fragment breaks renderer construction, so the defect surfaces at
dev/test time, before ever shipping — not a half-composed, silently-degraded surface in
production.

- **AC1 (identity case, GH #421 AC1)** *Given* a local fragment with empty `components: {}` and
  `functions: {}`, *when* composed against each base its `targetCatalogs` names, *then* EACH
  derived `Catalog`'s `components`/`functions` maps are content-equal to THAT base's
  (re-validated through `loadCatalog`, so no observable behavior differs — ADR-0172 cl.2's own
  reasoning, restated as a test, now generalized over every targeted base rather than the default
  alone).
- **AC2 (non-colliding union)** *Given* a local fragment whose component/function names are
  wholly disjoint from a targeted base's, *when* composed against that base, *then* the derived
  catalog's `components` map is exactly `{...base.components, ...local.components}` and
  `functions` likewise — every base-only type/function resolves unchanged, every local-only
  type/function resolves newly, and the derived catalog registers with zero
  `CATALOG_FACTORY_MISSING` (the combined factory table from `base`'s + the fragment's
  `factories.ts` covers every declared type — registry.ts:51-58's existing gate, unmodified).
  Holds independently per targeted base when a fragment targets more than one.
- **AC3 (collision case, RULED — reject-loud)** *Given* a local fragment whose declared component
  or function name collides with a targeted base's, *when* `composeCatalog` runs for THAT
  (fragment, base) pairing, *then* it throws the named collision error above, deterministically —
  and, when the SAME fragment ALSO targets a second base it does NOT collide with, that second
  pairing's composition and registration proceed unaffected (a collision against one base's
  vocabulary never blocks a different base's pairing for the same fragment).
- **AC4** *Given* the derived catalog once registered, *when* `deps.catalog` (produce.ts:88) is
  set to it for a turn, *then* `buildSystemPrompt`'s `catalogInventory`/`catalogIdTeaching`
  (`system-prompt.ts:177-195,329-344`) and the shared validator (catalog SPEC-R7) both operate on
  it with NO code change of their own — they already consume a `Catalog` value, not a hardcoded
  id (`system-prompt.ts:330`'s `catalog: Catalog` parameter; `catalogIdTeaching`'s own
  `catalog.catalogId !== 'agent-ui'` gate already composes its teaching line for ANY non-default
  id, derived or not) — satisfying GH #421 AC2/AC3 for EITHER base a persona's effective catalog
  derives from, as a consequence of SPEC-R2/R3's threading, not a separate build item.
- **AC5** *Given* `protocolVersion`/`surfaceProperties` on a targeted base, *when* composed,
  *then* the derived catalog carries THAT base's values through unchanged (never a different
  targeted base's, when a fragment targets more than one — each derivation is independent) —
  neither field is named as composable by ADR-0172, and no Repairs-cell item requests it.
- **AC6 (the widening's own edge case)** *Given* a fragment's `targetCatalogs` naming an id that
  is NOT one of the two currently-registered bases (a typo, or a not-yet-shipped third base),
  *when* the constructor's derive-then-register step runs, *then* it fails loud — the SAME
  posture AC3's collision case has — rather than silently skipping that pairing.

**SPEC-R3 — Selection recognizes derived ids across every (base, persona-local-set) pairing,
without regressing the base picker** *(ADR-0172 cl.2 · Repairs item 3)*. `A2UI_CATALOG_OPTIONS`/
`sanitizeCatalog` (`agent-admin-schema.ts:206-241`) MUST widen so that whatever string ends up
carrying the EFFECTIVE catalogId at threading time (the id forwarded on the POST body per the
a2ui-multi-catalog skill's §4, "the client runner forwards the picker's sanitized id") is
recognized as valid when it names ANY registered derived catalog — one produced by SPEC-R2's
derive-then-register step for some shipped persona package composed against SOME base it targets,
REGARDLESS of which of the two bases (`agent-ui` or `a2ui-basic`) that pairing composed over —
never silently sanitized back to `DEFAULT_A2UI_CATALOG_ID` the way an unrecognized id is today
(`sanitizeCatalog`'s existing fail-closed default, `agent-admin-schema.ts:239-241`). A persona
local set that names BOTH bases in its `targetCatalogs` (SPEC-R1) contributes TWO recognized ids,
one per base — this is the widening's own load-bearing requirement (§5): recognition is never
fenced to a single derived-id family. The exact mechanism — a statically-enumerable options list
built from the same persona/`targetCatalogs` metadata SPEC-R2's constructor step reads, vs. a live
registry-backed lookup — is an implementation choice, not fixed by this SPEC, so long as
recognition holds for every base a fragment actually targets.
- **AC1** *Given* a derived catalog registered under id `D` for base `B` and persona `P`
  (SPEC-R2), *when* `D` is the effective catalogId a persona's turn resolves to, *then*
  `sanitizeCatalog(D) === D` (not the default) — holding for `B ∈ {agent-ui, a2ui-basic}` alike.
- **AC2** *Given* a persona with NO local-pattern-set selection, *when* its effective catalogId is
  resolved, *then* `sanitizeCatalog` behaves BYTE-IDENTICALLY to today for the two existing
  options (`agent-ui`/`a2ui-basic`) — this clause is additive, not a rewrite of the existing
  2-entry allowlist's behavior for those two ids.
- **AC3 (the widening's own test)** *Given* a SINGLE persona local set whose `targetCatalogs`
  names BOTH bases, *when* both of its derived catalogs register (SPEC-R2), *then* BOTH derived
  ids pass `sanitizeCatalog` independently — `sanitizeCatalog` is never limited to recognizing one
  derived-id family per persona.

**SPEC-R4 — The multi-catalog skill gains a fifth pattern** *(ADR-0172 cl.2 · Repairs item 4)*.
`.claude/skills/a2ui-multi-catalog/SKILL.md` MUST gain a "5 · Composed/derived catalogs" section
beside its four registered-catalog patterns (§1–§4 today), distinguishing compose-time overlay
from "register a catalog beside the default" (§1) by citing this SPEC + ADR-0172 cl.2, and stating
the ruled collision policy (reject-loud, OF1, §5) and the `<base>--<persona>` derived-id
convention (OF1b, §5) as the skill's own worked pattern — the same "cite the ADR/SPEC, don't
restate the table" discipline the skill already follows for `a2ui-basic`.
- **AC1** *Given* the skill file post-build, *when* read, *then* it names `composeCatalog`, cites
  this SPEC's SPEC-R2, states the reject-loud collision policy and the `<base>--<persona>` naming
  convention, and its worked pattern demonstrates BOTH shipped bases (`agent-ui--<persona>` and
  `a2ui-basic--<persona>`) — not a single derived-id family — reflecting SPEC-R2's per-target-base
  composition (§5's widened scope). Its Routing boundary paragraph (currently silent on composed
  catalogs) is extended to route a "compose a persona's local patterns" ask here rather than to
  §1's register-beside-default pattern (they are mechanically different: §1 has no merge
  primitive, ADR-0172 cl.2's own Context finding).
- **AC2** the file continues to pass `site/lib/docs-grammar.test.ts`'s S9 exemplar-path sweep and
  the dangling-relative-link check (agent-ui-doc-standards SKILL.md §5's structural gate).

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
- **AC3 (the widening's own fail-closed edge case)** *Given* a persona whose local-pattern-set
  selection targets a base OTHER than its currently-selected `A2UI_CATALOG_KEY` base (e.g. the
  selection names a fragment whose `targetCatalogs` is `['agent-ui']` only, while
  `A2UI_CATALOG_KEY` currently reads `'a2ui-basic'`), *when* its effective catalog resolves,
  *then* it degrades to the BASE catalog alone (SPEC-R2 AC1's identity case) — the SAME
  fail-closed posture `selectCatalog`'s existing unknown-id degrade already has (ADR-0169 cl.3),
  never a hard error and never silently resolving to the WRONG derived id.

**SPEC-R6 — `selectMiniSkills` gains a `catalogId` filter, closing the ADR-0172 cl.3 gap**
*(ADR-0172 cl.3 · Repairs item 6 · OF2, ruled 2026-08-06 — absorbed into this build, §5)*.
`MiniSkill` (`mini-skills.ts:55-62`) MUST gain a `catalogId: string` field naming the catalog whose
vocabulary its `body` prose hardcodes (component/function names named in the instruction text —
e.g. `card-game-sheet.md`'s `Row`/`Card`/`Grid`/`Button`); every one of the nine shipped modules
today is `agent-ui`-vocabulary-hardcoded (confirmed live — `mini-skills.test.ts`'s
`expect(MINI_SKILLS).toHaveLength(9)` plus the nine-file `prompts/mini-skills/` directory listing;
ADR-0172 Context names one specimen module, not a count), so each module's
frontmatter gains an explicit `catalogId: agent-ui` line. `selectMiniSkills` (`mini-skills.ts:103-105`)
MUST gain a `catalogId: string` parameter and filter `registry` to `m.catalogId === catalogId`
BEFORE ranking — the exact hard-equality pattern `corpus/retrieve.ts:41,55`'s `meta.catalogId`
filter already uses, reused rather than re-invented. `produce.ts`'s one call site (`:764`) MUST
pass `deps.catalog.catalogId` — the SAME value line `:762`'s `queryOf` already threads into
`retrieve`'s own query, zero new catalog-resolution logic.
- **AC1** *Given* the nine shipped `MINI_SKILLS` entries post-fix, *when* loaded, *then* every
  entry carries `catalogId: 'agent-ui'` and `mini-skills.test.ts`'s existing per-module assertions
  extend to check the field is present and equals `'agent-ui'` for all nine.
- **AC2** *Given* a turn whose `deps.catalog.catalogId` is `'a2ui-basic'` (or any derived id,
  SPEC-R2), *when* `selectMiniSkills` runs, *then* it returns `[]` — the SAME accepted
  zero-content degrade `retrieve.ts`'s own catalogId-scoped filter already has for a Basic turn
  (`produce.ts:292`'s own comment: "a Basic turn retrieves zero exemplars... no `a2ui-basic` shard
  yet"), never wrong-dialect `agent-ui` vocabulary teaching on a non-`agent-ui` turn — the exact
  defect ADR-0172 cl.3 names, closed.
- **AC3** *Given* a turn whose `deps.catalog.catalogId` is `'agent-ui'` (the default, unchanged),
  *when* `selectMiniSkills` runs, *then* its selection is BYTE-IDENTICAL to today's (all nine
  modules eligible, ranked the same way) — this clause is additive scoping, not a ranking-behavior
  change for the one catalog every module already targets.

## 4 · Non-functional requirements (SPEC-N)

| ID | Requirement |
|---|---|
| **SPEC-N1** | **RETIRED (2026-08-06 acceptance round).** Absorbed into SPEC-R6 per OF2's ruling (§5) — the mini-skill `catalogId`-scoping gap is now IN this SPEC's build scope, not a non-goal. Left as a named gap here, not renumbered, per the repo's own S1 precedent (`docs-grammar.test.ts`'s own comment: "the label is a citation, not a position"). |
| **SPEC-N2** | **No "shared system patterns" tier is built.** ADR-0172 cl.3 rules one is needed (a new, named, catalog-level tier distinct from both the default catalog and any one persona's local set); designing and building it is explicitly M-D's OWN future design/build work, not this SPEC's — this SPEC's clauses build the PERSONA-local overlay mechanism only, not the shared-system layer that would compose beneath it. |
| **SPEC-N3** | **No reopening of ADR-0170 cl.8's suppressed catalog-authoring UI.** `EntryListOptions`'s `customAdd:false`/`contentField:false` for `ENTRY_KINDS.catalog` (`0170:112-116`) stays exactly where it is — local pattern sets are package/code-authored (SPEC-R1), never admin-authored through the entry-list UI, including which base(s) a fragment targets (`targetCatalogs`, SPEC-R1's widening) — only the persona's SELECTION of which local set to compose (SPEC-R5) is runtime-facing. |
| **SPEC-N4** | **No change to ADR-0169's registration, selection, or threading mechanics.** `Registry.register`/`get`/`supportedCatalogIds`/`submitGateSelector` (`registry.ts:36-91`), `selectCatalog`'s fail-closed degrade, and the produce-time authority stamp (`stampCreateSurfaceCatalogId`, `produce.ts:306`) are all reused byte-identically; SPEC-R2's derive-then-register step is strictly upstream of `register()`, never a fork of it. |
| **SPEC-N5** | **Composition targets the two currently-registered bases only, widened per the 2026-08-06 acceptance round (§5).** SPEC-R2 composes every shipped local set against every base its `targetCatalogs` (SPEC-R1) names, over `{agent-ui, a2ui-basic}` — no longer the default alone (this document's own first-draft scoping, superseded). A hypothetical future THIRD base is still out of scope — no Repairs-cell item asks for it, and extending to it is a real, distinct future widening, not built here. |
| **SPEC-N6** | **No shipped persona content.** This SPEC builds the MECHANISM only. `agent-admin-presets.ts`'s two demonstrating personas (concierge/croupier, GH #421 AC2) — and any real local-pattern-set content for them — are a LATER M-D slice (ADR-0172's own Non-goals bullet: "M-D's own build scope, not this intake's" — extended here to mean not this SPEC's first slice either, §7). |
| **SPEC-N7** | **Fleet DoD holds.** `npm run check && npm test` exit 0, and the per-package `layering.test.ts` trip-wires stay green (`a2ui` imports nothing new outward; `app`'s `agent-admin-schema.ts`/`agent-admin-persona-file.ts` growth stays additive, zero renamed exports). |

## 5 · Acceptance-round rulings (2026-08-06)

ADR-0172 named two genuine forks it deliberately left unsettled (OF1, OF2); this SPEC's own
first-draft authoring surfaced two more it likewise did not settle — the derived-catalogId naming
half of OF1 (OF1b) and this document's own default-only scoping call (SPEC-N5). Kim ruled all
four in-session on 2026-08-06 via the harness's structured question round (AskUserQuestion;
answers received first-hand by the host session). The verbatim selections are recorded on PR #482
— [comment #5199254913](https://github.com/kimgranlund/agent-ui/pull/482#issuecomment-5199254913)
— explicitly labeled a **HOST RELAY** (agent-posted, not Kim's own utterance). This section cites
that comment as the **provisional record** of the four rulings below; the **durable ratification**
is Kim's own acceptance flip on PR #482 (his own comment + this document's status-line edit, §9) —
if any ruling below is wrong, Kim contests before flipping and this SPEC revises instead (the same
pattern the M-A/ecosystem SPECs' PRD-D4–D6 "rulings-for-confirmation" use,
[`saas-data-workbench.spec.md`](./saas-data-workbench.spec.md) §3).

### OF1 — Compose-time collision policy → ruled: **(b) reject the fragment at compose time (loud, name-collision error)**

**Ruled: (b).** Kim's verbatim selection (the relay comment): *"Reject loud at compose time."*
Encoded in SPEC-R2's collision policy above (§3).

The three candidates, as originally weighed — kept for the record, so a future reader sees WHY (b)
won over (a)/(c), not just that it did:

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

**Why (b):** the loud-reject reading keeps the fleet's "honesty at the catalog wall" posture
(`grammar.md`, ADR-0011/ADR-0034's Postel-tolerance rulings) intact for CONTENT-authority
collisions the same way ADR-0034's Amendment already keeps it intact for PERMISSION-floor
collisions — an agent taught a base `Card`'s shape is never silently handed a different one
(rejecting (a)'s risk), and a persona author who genuinely wants a themed variant gets a clear,
actionable compose-time error naming exactly which name collided, over (c)'s blanket naming tax on
every fragment author regardless of whether they ever collide.

### OF1b — Derived-catalogId naming convention → ruled: **`<base>--<persona>`**

Kim's verbatim selection: *"`<base>--<persona>` (Recommended)."* — e.g. `agent-ui--concierge`,
`a2ui-basic--croupier` (the relay comment's own examples). Encoded in SPEC-R2 above; directly
supports SPEC-N5's widening below — once composition targets more than one base, a naming
convention that NAMES the base disambiguates by construction (an id like `croupier` alone could
not tell a reader or `sanitizeCatalog` which base it derived from; `<base>--<persona>` can).
ADR-0172 cl.2's own Non-collision note had already suggested this exact form
(`<base-id>--<persona-id>`) without ruling it — this ruling adopts the suggestion as the shipped
convention, not a new invention.

### OF2 — mini-skill `catalogId`-scoping gap → ruled: **absorbed into M-D's build**

Kim's verbatim selection: *"Absorb into M-D's build."* Encoded as SPEC-R6 above (§3) — not a
separate GitHub issue or ADR-0091 amendment.

The two paths, as originally weighed:

- **Absorb into M-D's build** — this SPEC grows a `SPEC-R` clause giving `selectMiniSkills` a
  `catalogId` filter mirroring `retrieve.ts`'s, closing the gap in the same wave that makes
  derived catalogs common (a derived-catalog turn is exactly the case most likely to surface the
  defect in practice, so shipping the two together has a coherence argument).
- **File standalone** — a small, separately-scoped GitHub issue (or an ADR-0091 amendment) fixes
  it independently of M-D's own schedule, keeping this SPEC's surface area to the five original
  Repairs-cell items alone (the narrower, easier-to-review build).

Both paths used the identical fix once chosen — the ruling was purely a sequencing call, not a
mechanics one, which is exactly why SPEC-R6 needed no design beyond mirroring `retrieve.ts`'s
existing pattern.

### The base-catalog scope (SPEC-N5) → ruled: **widened — both `agent-ui` and `a2ui-basic`**

Kim's verbatim selection: *"Widen now: both catalogs."* This SPEC's first draft scoped SPEC-R2 to
compose every shipped local set against the default (`agent-ui`) catalog alone, flagging the
`a2ui-basic` case as a distinct future widening (the original SPEC-N5 read: "Composing a local set
over `a2ui-basic`... is a real, distinct future widening... no Repairs-cell item asks for it, and
building it now would pre-empt whatever base-selection UI shape a multi-base compose would need").
Kim's ruling overrides that caution directly: the overlay generalizes over BOTH registered bases
from day one, via each fragment's own `targetCatalogs` declaration (SPEC-R1) — no separate
"base-selection UI" turned out to be needed, since which base(s) a fragment targets is a
BUILD-TIME authoring choice (the same posture SPEC-N3 already holds for the fragment's own
definitions), not a runtime UI surface. This is the widening §3's SPEC-R1/R2/R3/R4 and §2's
definitions above are all re-derived against — SPEC-N5 (§4) is restated to its new, still-real
boundary: no THIRD base, not "no `a2ui-basic`."

## 6 · Non-goals (recorded, not silent)

- **No "shared system patterns" tier** — ADR-0172 cl.3's own scoping; SPEC-N2.
- **No reopening of ADR-0170 cl.8's suppressed catalog-authoring UI** — SPEC-N3; local pattern
  sets stay build-time/code-authored, never a runtime admin-authoring surface, including which
  base(s) a fragment targets.
- **No change to ADR-0169's registration, selection, or threading mechanics** — SPEC-N4; the
  compose-time overlay is strictly upstream of `register()`.
- **No composition over a hypothetical future THIRD base** — SPEC-N5, widened (§5) to cover both
  bases shipped today (`agent-ui`, `a2ui-basic`); a third base is a real, distinct future
  widening, not built here.
- **No shipped persona content** (concierge/croupier or any other local-pattern-set's real
  component definitions) — SPEC-N6; this SPEC builds the mechanism, not the demonstrating personas.

## 7 · Build sequencing for M-D's first slice

1. **OF1/OF1b/OF2/SPEC-N5 are all ruled (§5, the 2026-08-06 acceptance round).** Every SPEC-R
   clause below (R1–R6) is buildable from a complete contract — nothing in this slice waits on a
   further Kim ruling. What remains before build DISPATCH is Kim's own acceptance flip on this
   document (§9), not a fork resolution.
2. **SPEC-R1 (package home + `targetCatalogs`) and SPEC-R5 (selection key) have no build-order
   dependency on SPEC-R2/R3/R4/R6** — the package SHAPE and the persona-state SELECTION plumbing
   may build first. A minimal fixture local-pattern-set (empty `components`/`functions`, or a
   single non-colliding demo type, targeting one or both bases) is sufficient to prove SPEC-R1's
   shape and SPEC-R5's round-trip.
3. **SPEC-R2 builds as one complete unit** — the identity case (AC1), the non-colliding union case
   (AC2), the now-ruled collision case (AC3), and the unregistered-target-base case (AC6) are all
   buildable and testable together once a fixture exists; no AC is deferred.
4. **SPEC-R3 (selection recognizes derived ids) follows SPEC-R2** — it needs real registered
   derived catalogs, across both bases, to assert non-regression and cross-base recognition
   (AC3) against.
5. **SPEC-R6 (the mini-skill `catalogId` filter) has no dependency on SPEC-R1–R5** — it is a pure
   `mini-skills.ts`/`produce.ts` change, buildable in parallel with the rest of this slice.
6. **SPEC-R4 (the skill's fifth pattern) lands last in this slice** — it documents the shipped,
   now-ruled answer (collision policy + naming convention + both-bases worked example), so it
   necessarily follows SPEC-R2's landing.
7. **SPEC-N6's later slice** (shipping concierge/croupier's real local-pattern-set content) is
   explicitly NOT this slice — it is the first real CONSUMER of SPEC-R1–R6's mechanism, and earns
   its own build dispatch (and, if its own genuinely ambiguous requirements surface, its own SPEC
   revision or ticket) once the mechanism ships.
8. **This document's own v0.2 revision (this text) is the fold-in §7's earlier draft anticipated.**
   No further content revision is expected before Kim's acceptance flip (§9) — unless he contests
   one of §5's rulings, in which case this SPEC revises again rather than proceeding on a
   misrecorded ruling.

## 8 · Clause map (SPEC id → ADR-0172 ruling → Repairs-cell item)

| SPEC id | ADR-0172 ruling | Repairs-cell item | Notes |
|---|---|---|---|
| SPEC-R1 | cl.1 (Q1 — package-level home) | 1 — new `catalog/<persona-scoped-shape>/` convention | Gains `targetCatalogs` (§5 widening) |
| SPEC-R2 | cl.2 (Q2 — compose-time overlay) | 2 — renderer constructor derive-then-register | Collision policy + naming ruled (§5); composes per `targetCatalogs`, not default-only (SPEC-N5 widened) |
| SPEC-R3 | cl.2 (Q2) | 3 — `A2UI_CATALOG_OPTIONS`/`sanitizeCatalog` widen | Recognizes ids across both bases (§5 widening) |
| SPEC-R4 | cl.2 (Q2) | 4 — `a2ui-multi-catalog` SKILL.md fifth pattern | Worked pattern demonstrates both bases (§5 widening) |
| SPEC-R5 | cl.1 (Q1 — selection, never definitions) | 5 — `PERSONA_STATE_KEYS` gains the local-set key | Gains AC3, the base-mismatch fail-closed degrade (§5 widening) |
| SPEC-R6 | cl.3 (Q3 — mini-skill `catalogId` gap, named not fixed by the ADR) | 6 — `selectMiniSkills` `catalogId` filter | OF2 ruled: absorbed into this SPEC's build (§5) |
| SPEC-N1 | — | 6 | RETIRED — absorbed into SPEC-R6 (OF2 ruling, §5); label kept, not renumbered (`docs-grammar.test.ts`'s own S1 precedent) |
| SPEC-N2 | cl.3 (Q3 — tier needs carving out, not built here) | — | ADR-0172's own scoping |
| SPEC-N3 | — (ADR-0170 cl.8, standing park) | — | Non-collision restated |
| SPEC-N4 | cl.2 (reuses ADR-0169 mechanics unchanged) | — | |
| SPEC-N5 | cl.2 (this SPEC's own scoping, WIDENED per the 2026-08-06 acceptance round, §5) | — | Bounds only a hypothetical future THIRD base now, not `a2ui-basic` |
| SPEC-N6 | ADR-0172 Non-goals ("M-D's own build scope, not this intake's") | — | Extended here to this SPEC's first slice too |
| SPEC-N7 | — (repo-standing fleet DoD) | — | |

## 9 · Acceptance for this document

This SPEC ships `proposed`. Kim's rulings on OF1/OF1b/OF2/SPEC-N5 (§5) are recorded, citing PR
#482's [relay comment](https://github.com/kimgranlund/agent-ui/pull/482#issuecomment-5199254913)
as their provisional record — the comment is explicitly a HOST RELAY, not Kim's own utterance.
What remains before build dispatch is Kim's own acceptance flip on PR #482 (his own comment +
this document's status-line edit, `proposed` → `accepted`) — the durable ratification, not a
further ruling; this document does not self-ratify. Document gates:
`site/lib/docs-grammar.test.ts` (status-keyword presence + the dangling-relative-link sweep) exits
0 inside `npm run check`'s `check:site` step; every relative link in this document resolves (§8's
ADR/SPEC citations, manually re-verified against the live tree while authoring this revision — the
agent-ui-doc-standards "re-derive at source" discipline).
