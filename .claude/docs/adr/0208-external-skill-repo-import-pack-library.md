# ADR-0208 — External Claude-skill repos as opt-in pack-library sources: a dev-time import CLI snapshots `skills/*/SKILL.md` into a provenance-stamped skill-pack file, the admin pack library ingests it into the user's StorageAdapter store, and per-agent opt-in rides the existing entries pipeline unchanged (GH #1340)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-18
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Proposed by** | planner seat (design leg of GH [#1340](https://github.com/kimgranlund/agent-ui/issues/1340), size:big due-process), inside Kim's four settled rulings (the 2026-08-18 rulings comment on #1340): agent-ui producer/admin surface · import-time snapshot, no runtime egress · pack-library-tier entries (ADR-0170's `EntryLibraryPack`) · per-agent opt-in in the persona store. Sibling intake #1341 closed as duplicate; its dedup findings (first-party pack mechanism shipped via #47/#143/#850/#1030 — the delta is the external-source ingestion seam) fold here |
> | **Ratified by** | — |
> | **Repairs** | on ratification+build (not authored here): GH #1340 Findings (the build write-back) · `packages/agent-ui/app/src/controls/agent-admin/agent-admin.md`'s `libraries` prop description (gains one sentence: packs may also arrive from the imported-shelf store, same commit path) · `site/pages/agent-admin-libraries.ts` header comment ("the page owns which packs exist" widens to "…plus whatever the imported shelf holds") · `.gitignore` needs NO change — the standing `*.local` rule already covers the CLI's output dir (verified via `git check-ignore`, 2026-08-18) |
> | **Supersedes / Superseded by** | **Extends** [ADR-0170](./0170-catalog-library-kind-single-select.md) (the pack-library tier gains a second pack SOURCE — imported snapshots beside page-authored packs; every clause of the pack/commit mechanics stands unchanged) · **Extends** [ADR-0193](./0193-shared-storage-adapter-seam.md) (the imported shelf is a new StorageAdapter consumer, `skill-packs:*`) · **Relates** [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (the trust boundary this design leaves byte-intact: the browser gains zero egress paths) · [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) Fork 3 (entries are prose, nothing machine-callable — load-bearing for D5's never-executes claim) · [ADR-0091](./0091-a2ui-gen-ui-mini-skill-registry.md)/[ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the mini-skill tier this record deliberately does NOT import into — Alternatives A1) · [ADR-0202](./0202-pdfjs-second-runtime-dependency-exception.md) (the local-file ingestion precedent D3's file-picker seam reuses, minus any dependency) · GH #564/#783 (`rejectOnCollision` — the pack-grain foreign-key law D4 rides) |

## Context

The agent-admin capability system has a shipped, first-party pack mechanism: `EntryLibraryPack`
(`packages/agent-ui/app/src/controls/entry-list/entry-data.ts:120`) is pure data — a named
collection of `NewEntryInput`s for one kind — offered by the entry list's add-from-library menu and
committed through the SAME `validateNewEntry` path as a hand-authored entry (GH #47/#48; ADR-0170
made catalogs a pack-fed kind too). Which packs exist is page-owned
(`site/pages/agent-admin-libraries.ts` — three packs even derive LIVE from in-repo registries via
Vite raw-globs), handed to `ui-agent-admin` through its reactive `libraries` prop
(`agent-admin.ts`, GH #143's per-kind rebuild seam). Opt-in is already per-agent by
construction: an add writes into the active persona's own store
(`createMemoryStore({ persistKey: 'agent-admin-app.<id>' })`, `agent-admin-presets.ts`), under
`entries:skill` etc., and composition follows the standing laws — index-line ambient (GH #891/
SPEC-R14), full text only on express invocation (`resolveTurnReferences`, entries.ts).

What no shipped seam covers (GH #1340's delta): an EXTERNAL Claude-format skills repo — the
`skills/<name>/SKILL.md` layout, e.g. github.com/mattpocock/skills — as a pack SOURCE. Kim's four
rulings on #1340 close the intake's forks and are taken as fixed constraints here: the surface is
agent-ui's producer/admin (not the Claude Code estate); the trust model is an import-time snapshot
with no runtime egress; the format target is the pack-library tier (never the mini-skill tier);
opt-in is per-agent in the persona store. Licensing/attribution was explicitly deferred to this
document (D7).

Three facts shape the remaining design space:

1. **A Node CLI cannot reach the user's store.** The persona/StorageAdapter stores are browser
   storage (localStorage + IndexedDB, ADR-0193). An import therefore needs two legs — a dev-time
   CLI leg that snapshots the repo into a file, and an app-side leg that ingests that file into the
   store — with a format contract between them (D1).
2. **Third-party prose entering prompt assembly is an injection surface.** The corpus already
   models the defense class: `a2ui-payload.md` P8 (GH #474) exists because mechanically-green
   content can still be semantically hostile, so the method is enumerate-classify-diff-REPORT and
   the verdict is a review, never a script's silent pass (D5). And the corpus already models the
   provenance discipline: `CorpusRecord.meta.provenance { source, origin }` with a non-empty
   origin (record.ts:36,152–162) — imported packs carry the same class of stamp, extended with a
   pinned commit sha (D1).
3. **The repo and bundle must gain zero bytes.** The first-party pattern (packs authored in
   `site/pages/agent-admin-libraries.ts`) is exactly the wrong home for third-party text: it would
   commit and serve someone else's content (size budget + redistribution). Imported packs must
   live user-local only (D3, D6).

## Decision

Seven clauses. `EntryLibraryPack`/`validateNewEntry`'s commit mechanics, the `libraries` prop's
reactive seam, the persona-store persist-key scheme, and every composition law (index-line ambient,
invocation framing, availability, master switches) stand byte-unchanged — this record adds a
source, never a second pipeline.

### D1 — the vendoring format: `agent-ui-skillpack@1`, an `EntryLibraryPack` plus provenance

One snapshot file per imported repo, JSON:

```jsonc
{
  "format": "agent-ui-skillpack@1",          // versioned marker — ingestion fail-closes on anything else
  "pack": {                                   // EntryLibraryPack-shaped (entry-data.ts), kind: skill
    "id": "github-com-mattpocock-skills",     // deterministic slug of host/owner/repo — the idempotency key
    "label": "mattpocock/skills",
    "description": "Imported from https://github.com/mattpocock/skills @ a1b2c3d",
    "rejectOnCollision": true,                // D4 — imported ids key an external registry
    "entries": [                              // NewEntryInput[], one per skills/<dir>/SKILL.md
      { "id": "<dir>",                        // the folder name — an EXPLICIT stable id (LLD-C7's
                                              // NewEntryInput.id law: survives label edits, never slugged)
        "label": "<frontmatter name, else <dir>>",
        "description": "<frontmatter description, else ''>",
        "content": "<SKILL.md body, frontmatter fence stripped, otherwise VERBATIM>" }
    ]
  },
  "provenance": {                             // the corpus meta.provenance discipline, extended
    "sourceUrl": "https://github.com/mattpocock/skills",
    "commitSha": "<full sha at import>",      // pinned — never a branch name
    "importedAt": "2026-08-18T...Z",
    "skillCount": 12,
    "droppedFrontmatterKeys": ["allowed-tools", "model"],  // harness vocabulary this product has no
                                              // semantics for — dropped, but COUNTED so review sees
                                              // what was ignored (never silently)
    "skipped": ["in-progress/foo"],           // malformed/fence-less SKILL.md dirs — skipped, listed
    "scan": { "flagged": [ { "entryId": "…", "line": 12, "reason": "override-directive" } ] }  // D5
  },
  "license": { "fileName": "LICENSE", "text": "<verbatim>" }  // or null when the repo carries none (D7)
}
```

Mapping rules: frontmatter parsing is the same minimal single-line `key: value` split the page
already uses for the mini-skill glob (`agent-admin-libraries.ts`'s `splitFrontmatter`, CRLF-tolerant);
a file without the leading `---` fence is skipped-and-listed, never thrown. Only `name` and
`description` are read; the body is content, verbatim — no truncation, no rewriting (the SPEC-N3
no-silent-cut law: a runaway body is visible at review, not trimmed behind the user's back). Every
other frontmatter key is Claude-harness vocabulary (tools, hooks, model, context) outside this
product's semantics — dropped and counted (D8 fences the full plugin format out).

### D2 — the import CLI: `scripts/import-skill-pack.mjs`, dev-time, zero-dep, selftest-gated

`node scripts/import-skill-pack.mjs <repo-url> [--ref <sha|tag>] [--out <dir>]`. Zero npm
dependencies (the repo law): it shells out to the developer's own `git` (`clone --depth 1`, then
`git rev-parse HEAD` for the pinned sha) into a temp dir, walks `skills/*/SKILL.md`, applies D1,
and writes `<out>/<pack-id>.skillpack.json`. Default `--out` is `skill-imports.local/` at the repo
root — covered by the standing `*.local` gitignore rule already (verified via `git check-ignore`),
so the snapshot can never be committed by accident and no `.gitignore` edit ships.

The egress happens HERE, on the developer's machine, at import time, through their own git — the
app itself gains no fetch path, so ADR-0073's trust boundary (the dev proxy as the only sanctioned
egress mount) is untouched by construction, and the `document-ingest-no-egress.test.ts` posture
extends to this feature with its own negative assertion (D5, S2's gate).

Idempotent re-import: the pack id derives deterministically from the source URL, so re-running the
CLI against the same repo overwrites the same snapshot file wholesale — fresh sha, fresh
`importedAt`, fresh scan. There is no merge; the snapshot IS the source state at the pinned sha.

The CLI carries a `selftest` arm (an inline fixture tree exercising the mapping, the skip path, the
dropped-keys count, and the scan) wired into `check:scripts` beside `reap-branches.mjs selftest`
and `e2e-devtools.mjs selftest` — the standing pattern for script gates, judged by exit code.

### D3 — app-side ingestion: a file-picker import into the shared StorageAdapter store

The pack library gains an "Import pack…" affordance that reads a `*.skillpack.json` via the user's
own file picker — the ADR-0202 document-ingest seam's trust shape (bytes arrive only by the user's
explicit local-file choice; zero egress; works in ANY deployment, not just `vite dev` — the
rejected dev-server-mount alternative is A4). Ingestion validates fail-closed: wrong/absent
`format` marker, a non-`EntryLibraryPack`-shaped `pack`, or an empty `provenance.sourceUrl`/
`commitSha` refuses visibly with a named reason (the `validateNewEntry` refusal law at pack grain).

The accepted snapshot persists WHOLE (pack + provenance + license) through the ADR-0193
`StorageAdapter` seam under `skill-packs:<packId>`, IndexedDB tier — arbitrary-size third-party
bodies are exactly what the IDB tier exists for (the `resource-idb-store.ts` precedent). The shelf
is APP-level, deliberately not per-persona: one imported shelf, every persona browses it; what IS
per-persona is the opt-in (D4). Removing a pack deletes its `skill-packs:` record only — entries a
persona already opted into are copies (the standing law: a library add IS a custom add with the
typing done, entry-data.ts) and are untouched.

### D4 — per-agent opt-in: the existing entries pipeline, `rejectOnCollision`, review-gated refresh

Imported packs project into the skill kind's pack list beside the first-party packs, through the
SAME reactive `libraries` seam (`agent-admin.ts`'s `libraries` prop/GH #143 — a store change reassigns the prop;
no new list/toggle/author code, the ADR-0132 cl.1 law). An add commits through `validateNewEntry`
into the ACTIVE persona's own `entries:skill` store — per-agent opt-in is therefore the existing
mechanism, not a new one. Nothing from a merely-imported pack ever reaches prompt assembly: only
an explicitly added (and enabled) entry composes, and S3 pins that with a negative assertion.

Imported packs set `rejectOnCollision: true` (D1): their entry ids key an external registry (the
source repo's folder names), so a colliding id is a genuine duplicate to refuse, never a name clash
to suffix — precisely the GH #564/#783 flag's stated vehicle, and the picker already disables such
rows pre-commit (`entry-list.ts`'s predicted-id disable).

Refresh semantics follow from D2 + D3 + this flag, and are the trust property, stated explicitly:
**re-import replaces the SHELF; it never rewrites a persona's opted-in copy.** What the user
reviewed and enabled stays byte-identical until they remove the old entry and re-add the refreshed
one — the collision-disabled picker row is the visible "your copy is older than the shelf" state.
No background mutation of prompt-reaching text, ever.

Composition is deliberately inherited, not redesigned: an opted-in imported skill behaves
byte-identically to a hand-authored one — enabled+in-context contributes ONE index line
(GH #891/SPEC-R14), full text rides only the user's own invocation/auto-attach framing
(`resolveTurnReferences`), availability modes and master switches apply unchanged. That is how
"full text rides the prompt when the pack is enabled" (ruling 3) is realized under the standing
laws.

### D5 — the trust boundary: untrusted prose, named surface, layered mitigations

The injection surface, named: imported third-party prose enters (a) `composeLiveSystemPrompt`'s
index lines (label + description, every ambient turn) and (b) `resolveTurnReferences`' framing
block (full content, on invocation) — both feeding a live model turn. Mitigations, layered:

1. **Snapshot-only, no runtime egress.** The app never fetches skill content (D2/D3); ADR-0073's
   boundary stands; a `document-ingest-no-egress.test.ts`-shaped negative test guards the new
   ingestion path (S2).
2. **Review-before-enable.** The pack library exposes each imported entry's FULL content, the
   provenance stamp, and the scan report BEFORE any add; entering prompt assembly requires the
   explicit per-agent add (D4). Nothing is default-on; nothing is auto-added (the standing
   never-an-automatic-add pack law, entry-data.ts).
3. **The content never executes.** A skill entry is prose by construction — ADR-0132 Fork 3: no
   parameter schema, nothing machine-callable, no API `tools` declaration derives from it. No tool
   grant rides it: the `integrations` wire is tool-kind-only (`resolveTurnReferences`' split), and
   an imported pack is skill-kind. No import path evals, interprets, or installs anything — hooks/
   agents/MCP in a source repo are not even parsed (D8).
4. **The import-time directive scan — a review aid, never a silent filter.** The CLI scans bodies
   for override-shaped lines ("ignore previous/above instructions", role-reassignment framings,
   credential-solicitation and exfil-URL patterns) and stamps findings into `provenance.scan`. The
   precedent is the corpus P8 dimension (a2ui-payload.md, GH #474's deceptive-composition
   defense): every mechanical check can be green while the content is semantically hostile, so the
   scan's METHOD is fixed (enumerate, classify, report point-by-point) and the VERDICT belongs to
   the human at the review-before-enable step. Flagged entries render with their flags in the pack
   library; the scan strips nothing.

### D6 — size and served bytes: zero, by construction

Imported packs live in exactly two places: the gitignored `skill-imports.local/` snapshot and the
user's browser store (`skill-packs:` IDB records + per-persona opted-in entry copies). No repo
file, no `site/pages` import, no package import, no bundle chunk — the size budget
(`scripts/measure-size.mjs`) and every served-bytes property are unaffected by construction, and
S2's bundle assertion pins that the app-side ingestion code adds no eager weight to the
`agent-admin` lazy split (ADR-0197's boundary). Oversized bodies are a store/review concern, not a
served-bytes one: they surface visibly at review (D5.2) and route through the IDB tier (D3), never
through truncation.

### D7 — licensing and attribution (the deferred ruling, resolved here)

The CLI records the source repo's root license file (`LICENSE`, `LICENSE.md`, `LICENSE.txt` —
first match) verbatim into the snapshot (`license.fileName` + `license.text`); absent one,
`license: null` and the pack library states "no license file found" rather than guessing. The
imported pack's library row displays attribution: source URL, short commit sha, import date, and
the license file name — the provenance stamp made visible, not just stored.

Redistribution is OUT of scope: the snapshot and the store are user-local; nothing re-exports
imported text into the repo, the bundle, a published package, or any shared artifact. This record
takes no position on downstream use beyond displaying what the source itself declared — the user
imports into their own store under the source's own terms, shown to them.

### D8 — non-goals (fenced, not deferred-by-vagueness)

- **The full Claude plugin format** — hooks, agents, commands, MCP servers, manifests: not parsed,
  not represented, not a future arm of this seam. Skills-only, the `skills/*/SKILL.md` shape.
- **Runtime fetch** in any form — no lazy remote bodies, no update polling, no CORS surface.
- **A marketplace/registry/update-checker** — the shelf lists what the user imported, nothing else.
- **The Claude Code estate** (how nonoun-plugins adopts third-party skill repos) — a different
  product; re-homed to that repo if ever wanted (the #1340 intake's own reading (b), ruled out).
- **A mini-skill-tier transform** — rejected on the merits, Alternatives A1, and ruled (packs).
- **Auto-refresh / background sync** — D4's review-gated refresh is the only refresh.

## Realization slices (sized, gates named)

| # | Slice | Size | Gate (exit codes, foreground) |
|---|---|---|---|
| S1 | D1 format + D2 CLI (`scripts/import-skill-pack.mjs` + `selftest` arm, wired into `check:scripts`) | small | `npm run check:scripts` · `npm run check` |
| S2 | D3 ingestion + store (`skill-packs:` StorageAdapter records, format fail-closed validation, provenance/license/scan display, remove) + the no-egress negative test + the lazy-split bundle assertion (its precedent/home: `packages/agent-ui/app/src/controls/agent-admin/agent-admin-lazy.bundle.test.ts` — the ADR-0197 Rolldown `moduleIds` trip-wire with its negative control; the assertion is bundle-level, never a weaker runtime-only check) | medium | `npm run check` · `npm test` (jsdom: validation negatives, store round-trip, egress trip-wire, bundle) |
| S3 | D4 opt-in wiring (imported packs into the `libraries` seam, `rejectOnCollision` behavior, refresh/collision-disable) + the default-off negative assertion in prompt assembly | small | `npm run check` · `npm test` (the `genui-pack-library.test.ts` jsdom precedent; a browser shard only if the picker flow proves jsdom-unreachable) |

S1 is independently shippable (the snapshot format is the contract); S2 depends on S1's format;
S3 depends on S2's store. Each slice lands with its gate green before the next starts.

## Alternatives considered

- **A1 — import into the mini-skill tier** (transform SKILL.md into `MiniSkill` records). Rejected,
  and ruled out by Kim (ruling 3). The mini-skill registry (ADR-0091/0135, `mini-skills.ts`) is an
  in-repo, Node-`fs`-loaded, producer-side registry with a hard `PER_MODULE_TOKEN_BUDGET = 200`
  per module and a per-entry `catalogId` hard-filter — arbitrary-size third-party prose fits
  neither the budget nor the catalog-vocabulary contract, and the registry never was the admin's
  opt-in surface. The pack tier is: browsable, review-gated, per-agent, generic prose.
- **A2 — runtime fetch source adapter** (register a repo URL, fetch at browse/turn time). Rejected:
  runtime egress (against ruling 2, ADR-0073, and the document-ingest no-egress posture), CORS and
  rate-limit coupling, and — decisively — content that can drift AFTER review, which defeats
  review-before-enable outright.
- **A3 — commit imported packs into `site/pages/agent-admin-libraries.ts`** (the first-party
  pattern). Rejected: repo + bundle bytes for third-party text (D6), and it IS redistribution —
  exactly what D7 keeps out of scope.
- **A4 — a dev-server mount serving `skill-imports.local/`** (the `/__a2ui/agent` pattern) instead
  of D3's file picker. Rejected as the primary path: it reaches only `vite dev` sessions and adds
  Vite coupling for no trust gain; the file picker works in any deployment with the identical
  zero-egress property. A convenience mount may be revisited later without touching this contract.
- **A5 — suffix-dedup imported ids** (the default collision behavior). Rejected: a refreshed
  re-add would mint a `<id>-2` phantom beside the stale copy — the exact defect class GH #564
  named; `rejectOnCollision` makes staleness visible instead (D4).

## Consequences and risks

- Two-leg import (CLI → file → picker) costs one manual hop versus a one-click fetch; that hop IS
  the trust boundary (the human holds the file they are about to ingest), accepted deliberately.
- The directive scan is heuristic and WILL miss adversarial prose; it is designed as a review aid
  under P8's own reasoning, and the load-bearing defense remains D5.2 + D5.3 (review-before-enable
  + prose-never-executes). A scan miss therefore degrades to today's hand-authored-entry trust
  level, never below it.
- Stale opted-in copies are possible by design (D4's no-background-mutation law); the
  collision-disabled picker row is the mitigation, and a richer "shelf is newer" affordance is a
  future UI slice, not a contract change.
