# ADR-0197 — the `@agent-ui/app` `.` barrel drops its static agent-admin arm: subpath-only static access plus a memoized `loadAgentAdmin()` lazy accessor; the app size budget returns to 102 KB and is never raised again

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-17
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-17 |
> | **Proposed by** | design seat (GH #1092 due-process design leg; measured hunt plan GH #1080 Findings, 2026-08-17) |
> | **Ratified by** | *(pending — Kim)* |
> | **Repairs** | on ratification+build: `packages/agent-ui/app/src/index.ts` (the barrel edit) · `packages/agent-ui/app/package.json` (two new subpaths, clause 2) · `scripts/measure-size.mjs` (`APP_MARGINAL_BUDGET` 103 → 102 KB + ledger note, clause 5) · every site/app consumer importing an agent-admin symbol from the `.` barrel (repoint to subpaths, clause 3) · GH #1092 (the owning issue) |
> | **Supersedes / Superseded by** | *(none)* — extends the lazy-split line of [ADR-0139](./0139-codemirror-editor-first-runtime-dependency.md) cl.8 (identity/lazy gates) · GH #354 (dogfood-lazy) · GH #468 pass 1 (markdown-lazy); relates [ADR-0131](./0131-agent-admin-ui-scope-and-composition.md) / [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) (the surface being split) |

## Context

`npm run size` went red on main@2b65338b (app marginal 104714 B gz vs the 104448 B / 102 KB
checkpoint) — the sixth crossing of the family-growth drift class. GH #1080's decision record
executed a LAST 102 → 103 KB re-base ("LAST re-base of the class by its own ruling",
`scripts/measure-size.mjs` ledger note, 2026-08-17) and minted GH #1092: execute the diet, never
raise the budget again.

The measured cause (GH #1080 Findings, Rolldown `modules` attribution of the app entry chunk):
the agent-admin arm — `agent-admin.ts` (145 956 rendered) + `agent-admin-schema.ts` (34 967) +
`entries.ts` (31 302) + `persona-patch.ts` (16 281) + `entry-list.ts` (22 350) + entry-form
(12 633) — ≈ 263 KB rendered, ~22 % of the 1.19 MB entry graph, est. 20–25 KB gz. Every consumer
of the `.` barrel pays it whether or not an admin surface ever mounts, because
`export { UIAgentAdminElement } from './controls/agent-admin/agent-admin.ts'` is a STATIC barrel
export — the same shape GH #354 found for the dogfood pair one layer down.

The two prior diets (dogfood-lazy, markdown-lazy) could stay inside `agent-admin.ts` because the
heavy module was an internal input. This one cannot: the heavy module IS a public export. A class
value cannot be re-exported statically without landing its module in the entry chunk — splitting
the arm therefore CHANGES THE `.` BARREL'S EXPORT SET, a public-contract change, which is why this
lands as an ADR and not silently inside a build (the ADR-0139 intake discipline).

## Decision

**The `@agent-ui/app` `.` barrel stops exporting the agent-admin arm statically. Static access
moves to the (mostly pre-existing) `./agent-admin*` subpaths; the barrel gains one lazy accessor,
`loadAgentAdmin()`, a memoized dynamic import that defines `<ui-agent-admin>` and resolves the
arm's module surface. The app marginal budget returns to 102 KB and, per GH #1080's ruling, is
never re-based upward again.** Five clauses; the build plan is
[`../decompositions/app-size-diet-round-2.decomp.md`](../decompositions/app-size-diet-round-2.decomp.md).

1. **What leaves the `.` barrel.** Every export whose module rides the agent-admin arm:
   `UIAgentAdminElement`; `defaultAgentConfigSchema` / `agentConfigSchema` / `runStubAgentTurn` /
   `A2UI_CATALOG_OPTIONS` / `AgentConfigSnapshot` (agent-admin-schema.ts); `ENTRY_KINDS` /
   `DEFAULT_PROMPT_SECTIONS` / `DEFAULT_SYSTEM_PROMPT_FALLBACK` / `composeSystemPrompt` /
   `initialEntryValues` (entries.ts); `lintPromptSections` / `lintSectionContent` /
   `MODALITY_VOCABULARY` + types (prompt-lint.ts); `validateNewEntry` / `renameEntry` /
   `describeEntry` / `entriesStoreKey` + `Entry`/`EntryLibraryPack`/`NewEntryInput`
   (entry-list/entry-data.ts). Everything else on the barrel (shells, master-detail, settings,
   nav-rail, surface-host, conversation) is untouched.

2. **Where they land.** The existing subpaths already cover most of it: `./agent-admin`,
   `./agent-admin-schema`, `./agent-admin-persona-patch`, `./entry-data`, `./entry-list`. Two new
   subpaths complete the set: **`./agent-admin-entries`** (`entries.ts`) and
   **`./agent-admin-prompt-lint`** (`prompt-lint.ts`). Names follow the established
   `./agent-admin-*` grammar; no module moves on disk.

3. **The lazy accessor.** The barrel exports
   `loadAgentAdmin(): Promise<typeof import('./controls/agent-admin/agent-admin.ts')>` — a
   memoized dynamic `import()` on the dogfood-lazy shape (`agent-admin.ts:403`): one in-flight
   promise, importing it defines the tag (fleet self-define idiom), no timeout ceiling needed
   (same-origin chunk, the markdown-lazy precedent's failure/timeout tests carry the contract).
   Barrel consumers that only *mount* the surface switch to
   `await loadAgentAdmin(); html\`<ui-agent-admin>…\`` ; consumers needing static types/values
   (the site's preset/library/schema pages) repoint to the clause-2 subpaths — a mechanical,
   compile-checked migration (`tsc` finds every site).

4. **The gates.** (a) *Bundle shape*: `agent-admin-lazy.bundle.test.ts` on the
   markdown-lazy.bundle pattern verbatim — real Rolldown bundle of the `.` barrel, `moduleIds`
   assertion that NO entry chunk carries `controls/agent-admin/agent-admin.ts` (nor entries.ts /
   agent-admin-schema.ts / prompt-lint.ts), plus the negative control (a synthetic entry that DOES
   statically import `./agent-admin` lands it in ITS entry chunk). (b) *Runtime parity*: the
   markdown-lazy quartet shape — `loadAgentAdmin()` defines the tag and a mounted surface behaves
   identically to a static-subpath mount (jsdom + one browser leg); memoization (two calls, one
   fetch); rejection surfaces as a caught error, not an unhandled rejection. (c) *Size*:
   `npm run size` exit 0 with the clause-5 budget.

5. **The budget law.** `APP_MARGINAL_BUDGET` returns 103 → 102 KB (104448 B gz) in the same change
   that lands the split, with ≥ 2 KB measured headroom under it (expected landing ≈ 80–85 KB gz
   per GH #1080's estimate). The ledger note records this as the diet the 2026-08-17 "LAST
   re-base" entry promised. Downward re-bases remain ordinary; **upward re-bases of this row are
   closed as a class** — future growth must pay with a diet or a ruled feature-weight ADR, never
   a drift bump.

### Forks for Kim (recommendation is the default absent an objection)

- **F1 — accessor vs. subpath-only.** *Recommend: both* (clauses 2+3). Subpath-only (no
  `loadAgentAdmin()`) is smaller but pushes every lazy consumer to hand-roll the memoized import;
  accessor-only (no static story) breaks type-level consumers. The pair mirrors how
  `@agent-ui/code` serves `./markdown` statically AND is consumed lazily by agent-admin.
- **F2 — is this semver-breaking?** *Recommend: yes, say so.* The barrel's export set shrinks; the
  repo is pre-publish (no external consumers; all in-repo consumers migrate in the same change),
  so the cost is one coordinated PR — but the ADR records it as a breaking barrel change, not a
  patch.

## Consequences

- Consumers of `@agent-ui/app` that never open agent-admin stop paying ~20–25 KB gz — the single
  biggest marginal reduction available (22 % of the entry graph).
- The `.` barrel's meaning sharpens: it carries the composition SHELLS; the admin app-surface is
  an opt-in arm, the same posture `./editor` has on `@agent-ui/code` (ADR-0139).
- The site's agent-admin pages gain one awaited chunk on first mount — imperceptible on the
  same-origin dev/build pipeline, and the pattern is already live twice inside the surface itself
  (dogfood, markdown).
- Candidates 2 and 3 of GH #1092 (double-catalog audit; the `INEFFECTIVE_DYNAMIC_IMPORT` pair in
  `@agent-ui/components`) stay OUT of this ADR — they are contingent follow-ons ruled in the
  decomposition, and candidate 3 touches the components barrel, which would need its own record
  if its export set changes.

## Acceptance

- **Intake (this change):** this record passes the ADR gates (`site/lib/adr.test.ts`,
  `docs-grammar.test.ts`) and ships `proposed` with the decomposition. No code changes.
- **Build wave (gated on ratification):** clauses 1–5 land per the decomposition's S1/S4 slices;
  bundle-shape + runtime-parity quartet green; `npm run check && npm test` and `npm run size`
  exit 0 with the 102 KB budget restored and ≥ 2 KB headroom; GH #1092 Findings updated with the
  measured landing figure.

## Alternatives considered

- **Keep the static export, split only internals further.** Rejected: the arm's mass IS the
  exported module graph; dogfood- and markdown-lazy already harvested the internal inputs. No
  internal split reaches 20 KB while `agent-admin.ts` stays a static export.
- **A lazy-defining stub element on the barrel** (a placeholder `ui-agent-admin` that imports the
  real class on connect). Rejected: two definitions for one tag (upgrade races, `instanceof`
  breaks, FACE internals cannot be handed over), and the stub still needs the schema/entries
  values somewhere static — complexity without removing the contract change.
- **Raise the budget again.** Closed by GH #1080's own ruling and the measure-size.mjs 2026-08-17
  ledger note ("LAST re-base of the class"); not an alternative, a prohibition.
- **Reopen #468.** Rejected in GH #1080's Findings — its 79 KB baseline is five checkpoints stale.
