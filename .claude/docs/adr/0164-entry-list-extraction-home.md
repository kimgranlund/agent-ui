# ADR-0164 — The entry-list machinery re-homes as a shared `@agent-ui/app` control folder; the settings generator is already extracted, so its remaining gap closes at the pattern tier

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-28 |
> | **Proposed by** | design intake (M-A intake 2 — the "extraction home" fork for the entry-list + settings-generator proto-patterns, [roadmap §3](../roadmap.md); the gap inventoried by [inv-6](../reports/roadmap-wave-2026-07-28/inv-6-saas.md) §4/§5 and [inv-1](../reports/roadmap-wave-2026-07-28/inv-1-agent-admin.md) §5) |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-29, via the [`ratify ADR-0164` utterance](https://github.com/kimgranlund/agent-ui/issues/316#issuecomment-5113168358) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | none owed backward — an intake ADR resolving a home, not a defect. **On ratification+build** (the ADR-0162/0163 Repairs-row shape): `app/src/controls/entry-list/**` (new — `entry-list.ts` moved verbatim · `entry-data.ts`, the generic core split out of `entries.ts` · `entry-data.test.ts`, the core half of `entries.test.ts` moved with it · new `entry-list.css` · a standalone mount smoke test) · `app/src/controls/agent-admin/{agent-admin.ts, agent-admin.css, entries.ts, entries.test.ts, genui-pack-library.test.ts}` (imports re-pointed; `entries.ts` keeps its name, loses its generic half; `entries.test.ts` keeps the domain-half assertions; the entry-list style block moves out and its tokens repoint) · `app/package.json` (+`./entry-list`, `./entry-list.css`, `./entry-data`) · `app/src/index.ts` (re-pointed, names byte-identical) · the AC19 sheet-set one-line append · two `agent-ui-composition-patterns` rows (cl.5) |
> | **Supersedes / Superseded by** | **Amends [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md)** — its generic ordered-entry-list primitive (`n1`/`n1b`/`n1c`) keeps its whole shipped contract but moves out of the agent-admin folder to a shared home; its "lives with agent-admin" placement was construction scaffolding, never a ruled clause. Relates [ADR-0139](./0139-codemirror-editor-first-runtime-dependency.md) (the `@agent-ui/code/editor` dependency that pins the tier), [ADR-0158](./0158-disclosure-summary-slot.md) (the fold/summary-switch idiom the pattern rows document), [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (the catalog-or-allowlist gate applied in cl.6), [ADR-0120](./0120-app-surfaces-m4-panes-settings.md) (the settings surface whose generator half this ADR finds already extracted) |

## Context

The M-A "SaaS Data Workbench" arc (roadmap §3) needs admin-pattern primitives — workspaces,
settings, configurations, tools, services, resources — and `ui-agent-admin` already hand-rolls the
two mechanisms those patterns would reuse. Both were flagged by the 2026-07-28 inventory wave as
real proto-patterns left domain-local (inv-6 §2b/§4; inv-1 §5 — links in the Proposed-by cell
above). The roadmap's M-A entry names their **extraction home** as one of the
two design forks gating the M-A PRD ("agent-admin's entry-list/settings mechanisms are
agent-admin-local files… not exported as reusable primitives," inv-6 §4). What the tree actually
holds:

1. **The ordered-entry-list machinery** (ADR-0132) — two agent-admin-local files:
   - `app/src/controls/agent-admin/entries.ts` — a MIXED module: a generic data core (`Entry`,
     `NewEntryInput`, `EntryLibraryPack`, `ValidateNewEntryResult`, `validateNewEntry` +
     slug-dedup, `entriesStoreKey`, `readEntries`) interleaved with agent-admin's domain layer (`ENTRY_KINDS`,
     `DEFAULT_PROMPT_SECTIONS`, `composeSystemPrompt`, `composeLiveSystemPrompt`,
     `pickedPatternSource`, `initialEntryValues`).
   - `app/src/controls/agent-admin/entry-list.ts` — already fully generic (`kind` is a plain
     string; the module "owns no store access of its own — the caller wires persistence"): the
     list→edit→save loop with its hardened, review-finding-bearing behaviors — commit-on-`change`
     (never `input`), fail-closed add rejection that preserves typed input, mid-edit focus+value
     preservation across sibling-driven re-renders (`selectToEnd` caret restoration), the
     library-pack menu with in-place rebuild (`updateLibraries`). Six instantiations proven
     (five ADR-0132 kinds + `pattern-source`, genui-surface SPEC-R11).
   - The root `@agent-ui/app` barrel ALREADY exports the data core + domain composers
     (`index.ts:39-40`) — site pages consume them today — but `mountEntryList` itself has no
     public surface, and its CSS lives inside `agent-admin.css`'s `@scope (ui-agent-admin)`
     styles block on `--ui-agent-admin-*` tokens: a consumer outside `ui-agent-admin` gets
     working but UNSTYLED entry sections. The style scoping, not the TypeScript, is the real
     un-extracted remainder.
2. **The settings generator** — already extracted: `ui-settings` + `schema.ts`/`store.ts`/
   `generate.ts`/`memory-store.ts` live in their own `app/src/controls/settings/` folder with
   public subpaths (`./settings`, `./settings-schema`, `./settings-store`,
   `./settings-memory-store`) and barrel exports. What remains agent-admin-local is only the
   **composition idiom**: the heading-row fold column (`settingsItem`, a thin helper over the
   `foldItem` `ui-disclosure` wrapper, GH #225) with the master switch riding the fold summary declaratively
   (`slot="summary"`, ADR-0158), and the live-apply store discipline (commit → `store.set` →
   `subscribe` notification → fresh read at consume time, no push channel).

Tier mechanics that decide the fork:

- `entry-list.ts` imports `@agent-ui/code/editor` (`ui-code-editor`, ADR-0139's ruled CodeMirror
  exception). The package DAG is `shared ← components ← a2ui ← app` with `code` a SIBLING branch
  off `components` — so the machinery **cannot** live in `@agent-ui/components` (components →
  code is an upward import, banned by the layering trip-wires) and only `app` may import `code`
  (ADR-0139). The dependency pins the tier to `app` or a new package.
- A new package buys nothing: every plausible consumer (agent-admin today; M-A's workbench
  settings/config surfaces tomorrow) already imports `@agent-ui/app` for shells/settings — a new
  workspace member adds DAG rows, layering tests, and packaging surface for zero added reach.
- A documented recipe alone is too little: the machinery carries real state/behavior (the focus
  preservation, the fail-closed add loop) that consumers must IMPORT, not re-type — ~350 lines of
  review-hardened code is exactly what copy-paste would fork.
- The settings side is the inverse: its code is already shared; what consumers lack is the
  documented idiom. Minting a wrapper control around five lines of `ui-disclosure` composition
  would violate the default-no discipline.

## Decision

**Split verdict: the entry-list machinery moves to its own shared control folder inside
`@agent-ui/app` with public subpaths; the settings-generator gap closes as composition-pattern
rows, zero new code.** Clauses:

1. **The home** — `app/src/controls/entry-list/`, a sibling of `settings/` (whose schema/store/
   memory-store subpath trio is the precedent for exporting non-element app-tier mechanisms;
   `entry-list/` becomes the first element-free `controls/` folder). New `package.json` subpaths
   `./entry-list` (→ `entry-list.ts`), `./entry-list.css`, and `./entry-data` (→ `entry-data.ts`,
   the generic data core); the root barrel keeps every currently-exported name byte-identical (re-pointed, not
   renamed) so existing consumers (`site/pages/agent-admin-{presets,libraries,app.test}.ts`)
   change nothing. NOT a new package (DAG + packaging cost, no added reach); NOT
   `@agent-ui/components` (the `code/editor` import makes that structurally illegal); NOT a
   `ui-*` custom element — the shipped `mountEntryList` mount-function contract is proven across
   six instantiations and stays AS-IS (frozen interface, cl.3).
2. **The `entries.ts` split** — the generic data core moves to `entry-list/entry-data.ts` (a
   name that states its own job, so the two modules stay distinguishable at a glance in an
   import list): `Entry`,
   `NewEntryInput`, `EntryLibraryPack`, `ValidateNewEntryResult`, `validateNewEntry` (+ its
   private `slugify`), `entriesStoreKey`, `readEntries`. The agent-admin DOMAIN layer stays put —
   `agent-admin/entries.ts` keeps its name, loses its generic half, imports the core: `ENTRY_KINDS`,
   `DEFAULT_PROMPT_SECTIONS`, `DEFAULT_SYSTEM_PROMPT_FALLBACK`, `composeSystemPrompt`,
   `composeLiveSystemPrompt`, `LiveCapabilityGroup`, `pickedPatternSource`, `initialEntryValues`.
   The split line is mechanical: anything naming a kind constant, a seeded default, or the
   system-prompt projection is domain; anything parameterized by bare `kind: string` is core.
3. **The frozen interface** — the shipped contract verbatim, no redesign:
   `mountEntryList(kind: string, addLabel: string, handlers: EntryListHandlers, options?: EntryListOptions): EntryListSection`
   with `EntryListHandlers { onToggle; onContentChange; onDelete; onAdd(input): boolean }`,
   `EntryListSection { host; render(entries); updateLibraries(libraries) }`, plus `showAddError`.
   The generic contract IS "an items array + per-action callbacks + a caller-owned store": the
   caller wires persistence (the ADR-0132 seam), the module owns rendering + the fail-closed add
   loop. Kind-specific field schemas remain ADR-0132 Fork 3's explicitly deferred extension.
4. **The CSS re-scope** — the one genuinely new construction: the entry-list style block
   (`[data-part='entry-section'|'entry-list'|'entry'|…]`, today inside `agent-admin.css`'s
   `@scope (ui-agent-admin)`) moves to `entry-list/entry-list.css` under
   `@scope ([data-part='entry-section'])` with its own `--ui-entry-list-*` token family
   (defaults mirroring today's `--ui-agent-admin-{entry-radius,row-gap,list-gap,card-pad,spacer-min-size}`
   values); `agent-admin.css` deletes the moved block and REPOINTS its own tokens onto the new
   family at the `ui-agent-admin` root ("repoint the token, not the host property" — the
   TKT-0062 law), keeping agent-admin byte-equivalent visually. One named cascade risk the
   equivalence must survive: the scope-root change alters `@scope` proximity ranking against the
   composed controls' own scoped blocks (the exact mechanism `agent-admin.css`'s TKT-0050/0060
   comments record losing to before) — the existing visual/computed-style suites gate it. The
   new sheet joins the AC19 spacing-drift gate's sheet set (a one-line reviewed append, per that
   gate's own design).
5. **The settings-generator remainder = pattern tier** — two new rows in
   `agent-ui-composition-patterns` (documented recipes, no new code): (a) *"a schema-driven
   settings/config page"* — `ui-settings` + `SettingsSchema` + a `SettingsStore`, the fold-column
   variant via `ui-disclosure` + `slot="summary"` master switches (owner: ADR-0120/ADR-0158 ·
   exemplar: `agent-admin.ts`'s `settingsItem`); (b) *"a resource-list manager"* — `./entry-list`
   + the live-apply store discipline: commit on `change` (never `input`) → `store.set` →
   `subscribe` re-render (focus-preserving) → fresh store read at consume time, no push channel
   (owner: ADR-0132 + this ADR · exemplar: `agent-admin.ts`'s `#makeSection`). The live-apply
   seam is a DATA-FLOW idiom between a store and its consumers — it has no element lifecycle, so
   it is neither a trait (`(host, opts) => cleanup` needs a host) nor a controller; it stays a
   documented idiom whose halves are already independently tested (`store.test.ts`,
   `entries.test.ts`, the agent-admin browser preservation probes).
6. **Catalog posture** — app-owner chrome, catalog-invisible: `mountEntryList` is not a custom
   element, takes function handlers, and lazy-loads CodeMirror — none of it expressible as an
   A2UI adjacency-list payload, and the DAG already makes it structurally unreachable
   (`a2ui` never imports `app`). No catalog row, no exclusion-allowlist entry needed — the
   ADR-0087 gate keys off a new `ui-*` descriptor, and this exports no element.
7. **agent-admin becomes a consumer** — the dogfooding proof: `agent-admin.ts` (+ its tests)
   imports the moved modules from the new folder; no behavioral change, no second copy. The
   migration cost is import-path edits, the cl.2 split, and the cl.4 CSS repoint — bounded by
   the existing gates (`entries.test.ts`, the agent-admin jsdom + browser suites,
   `genui-pack-library.test.ts`, the site suites) staying green unchanged.

## Forks considered

| Fork | Options | Ruling |
|---|---|---|
| Tier | pattern recipe only · new `ui-*` element in `components` · shared folder in `app` · new package | **Shared folder in `app`** (cl.1) — the `code/editor` import bans `components`; behavior-bearing code bans recipe-only; no consumer exists outside `app`-importing surfaces, banning a package |
| Live-apply seam | trait · controller · documented idiom | **Documented idiom** (cl.5) — no host lifecycle to attach a trait/controller to; already testable in halves |
| Generic contract | redesign (items + editor-factory + commit callback) · freeze the shipped interface | **Freeze** (cl.3) — six shipped instantiations are the evidence; a redesign re-opens ADR-0132 Fork 3 with no consumer demanding it |
| agent-admin | keeps its own copy · consumes the extraction | **Consumes** (cl.7) — a kept copy is the exact copy-paste fork this ADR exists to prevent |
| Catalog | catalog row · exclusion allowlist · nothing | **Nothing** (cl.6) — no element is exported; the gate has no subject |

## Consequences

- `@agent-ui/app` grows a public API surface that must now hold stable for consumers beyond
  agent-admin: `./entry-list`, `./entry-list.css`, `./entry-data` (plus the root-barrel names,
  already public, now backed by the shared folder). No SPEC/LLD accompanies this — a
  single-package move + split with one new sheet, no new component, no multi-component contract;
  the Repairs row carries the file-touch list.
- Two token families coexist where one lived: `--ui-entry-list-*` (the mechanism's own) and
  `--ui-agent-admin-*` (repointed onto it at the `ui-agent-admin` root) — the standing
  consumer-repoints-the-token pattern, at the cost of one indirection hop when reading
  agent-admin's sheet.
- `ui-agent-admin` is demoted to the extraction's first consumer — the dogfooding proof; no
  second copy of the machinery may appear (a divergence there reopens this ADR, not a local fix).
- ADR-0132's contract survives untouched — including Fork 3's deferred kind-specific field
  schemas, which any future extension owes its own intake; the extraction deliberately adds no
  new capability.
- The composition-pattern rows (cl.5) become the extraction's documentation surface — a consumer
  who copy-pastes the fold/live-apply idioms instead of following the rows is deviating from a
  documented fleet pattern, not making a local choice.

## Acceptance

- agent-admin renders byte-equivalent (the existing jsdom/browser/visual suites pass unchanged —
  they gate the cl.4 cascade risk).
- One NEW standalone mount smoke test in `entry-list/` (stub handlers + `createMemoryStore`)
  proves a styled, working entry section with zero agent-admin involvement.
- Every pre-existing `@agent-ui/app` import site (the three site pages + tests) compiles
  unchanged; `entries.test.ts` splits along the cl.2 line with no assertion lost — the core
  half lands as `entry-list/entry-data.test.ts`, the domain half stays in
  `agent-admin/entries.test.ts`.
- Gates: `npm run check && npm test` + the browser shards, judged by exit codes.
