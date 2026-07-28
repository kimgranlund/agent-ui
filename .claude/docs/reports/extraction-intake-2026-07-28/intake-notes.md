# M-A intake 2 — extraction home: intake notes

Companion record to [ADR-0164](../../adr/0164-entry-list-extraction-home.md) — the fork sheet,
migration-cost analysis, and post-ratification slice briefs behind it. Committed 2026-07-28
alongside the ADR so the builder inherits this reasoning rather than re-deriving it.
Written 2026-07-28 by the design-intake seat. All evidence re-verified against shipped source.

## The one-paragraph answer

The two "proto-patterns" are in very different states. The **settings generator is already
extracted** — `ui-settings` + schema/store/generate/memory-store live in their own
`app/src/controls/settings/` folder with four public subpaths and barrel exports; only the
composition idiom (fold column + `slot="summary"` master switches + the live-apply store
discipline) is agent-admin-local, and that is prose, not code → two `agent-ui-composition-patterns`
rows, zero new components. The **entry-list machinery is genuinely local** and behavior-bearing →
it moves to `app/src/controls/entry-list/` (a `settings/` sibling) with `./entry-list`,
`./entry-list.css`, `./entry-data` subpaths (the generic core file is `entry-data.ts` — reviewer
fix: two sibling `entries.ts` files failed the naming law), the shipped interface frozen
verbatim, and agent-admin
becomes its first consumer. Not `components` (its `@agent-ui/code/editor` import makes that an
upward DAG edge — structurally illegal), not a new package (no consumer exists outside
app-importing surfaces).

## Ground-truth findings that shaped the ruling

1. **`entry-list.ts` is already generic.** `kind` is a plain string; the header comment states
   "this module owns no store access of its own (the caller wires persistence)". Six shipped
   instantiations (five ADR-0132 kinds + `pattern-source`, genui-surface SPEC-R11). The
   genericization fork the brief asked to design is ALREADY DONE in shipped source — the intake's
   job collapsed to a move + split, with the interface frozen as-is (frozen-interface rule:
   every name in the ADR cl.3 verified against `entry-list.ts:27-65,333-345`).
2. **`entries.ts` is mixed** — generic core (`Entry`, `NewEntryInput`, `EntryLibraryPack`,
   `validateNewEntry`, `entriesStoreKey`, `readEntries`) interleaved with agent-admin domain
   (`ENTRY_KINDS`, `DEFAULT_PROMPT_SECTIONS`, `composeSystemPrompt`, `composeLiveSystemPrompt`,
   `pickedPatternSource`, `initialEntryValues`). The split line is mechanical (ADR cl.2).
3. **The barrel already leaks the extraction** — `app/src/index.ts:39-40` exports the data core +
   domain composers from the agent-admin path; three site pages import them from `@agent-ui/app`
   today. So export-name stability is a hard constraint the ADR pins (re-point, never rename).
4. **The REAL un-extracted remainder is CSS, not TypeScript.** Entry-list's whole style block
   lives inside `agent-admin.css`'s `@scope (ui-agent-admin)` on `--ui-agent-admin-*` tokens
   (`agent-admin.css:232-443`). A consumer outside `ui-agent-admin` gets working but unstyled
   sections — this is the finding that makes the extraction a build slice rather than a pure file
   move: new `entry-list.css`, own `--ui-entry-list-*` token family, agent-admin repoints
   (TKT-0062's "repoint the token, not the host property" law), AC19 sheet-set append.
5. **The live-apply seam is a data-flow idiom, not a trait/controller.** It has no element
   lifecycle (`mountEntryList` is not a host; the store is caller-owned), so `(host, opts) =>
   cleanup` is the wrong shape. Its halves are already independently tested (`store.test.ts`,
   `entries.test.ts`, the agent-admin browser focus-preservation probes). It becomes the
   composition-patterns row's stated law: commit on `change` (never `input`) → `store.set` →
   `subscribe` re-render (focus-preserving) → fresh store read at consume time, no push channel.
6. **Catalog posture: structurally unreachable.** Not a custom element, function handlers,
   lazy CodeMirror; `a2ui` never imports `app` (DAG). ADR-0087's gate keys off a new `ui-*`
   descriptor — no subject here. Recorded as ADR cl.6 so the decision is explicit, not silent.

## Migration cost (fork 4 — agent-admin consumes)

Import-path edits in `agent-admin.ts` + tests (`entries.test.ts` splits along the cl.2 line,
`genui-pack-library.test.ts` re-points), the `entries.ts` split (the domain half stays put as
`agent-admin/entries.ts`, keeping its name), the CSS move/repoint, root-barrel re-point. No behavior change;
acceptance = existing agent-admin jsdom/browser/visual suites green unchanged + one NEW standalone
mount smoke test proving consumability (styled parts included) outside `ui-agent-admin`.

## What it earns (default-no applied)

- **ADR: yes** — a package export-surface contract changes (three new public subpaths on
  `@agent-ui/app`) and ADR-0132's primitive re-homes (an Amends edge). Drafted as **ADR-0164**.
  **Collision risk (RESOLVED 2026-07-28):** several intakes ran the same night; the committing
  slice re-verified 0163 as the ceiling and 0164 as free before landing. No renumber was needed.
- **SPEC/LLD: no** — single-package move + split + one new sheet; no new component, no
  multi-component behavior contract. (The ADR's Repairs row carries the file-touch list — the
  ADR-0162/0163 Repairs-row shape; §Acceptance carries the exit criteria.)
- **Decomposition: two dispatchable slices, small enough that a separate .decomp.json would be
  ceremony.** S1 (build) = one app-tier build seat: `app/src/controls/entry-list/*` (new),
  `agent-admin/{agent-admin.ts,entries.ts,entries.test.ts,genui-pack-library.test.ts,agent-admin.css}`,
  `app/package.json`, `app/src/index.ts`, the AC19 append, + the new standalone mount smoke test;
  gates foreground, exit codes. S2 (docs) = one docs seat
  (`.claude/skills/agent-ui-composition-patterns/SKILL.md`, the two rows from ADR cl.5).

## Open for Kim (ratification-time)

1. Ratify/return ADR-0164 (the tier split verdict + the frozen mount-function shape — the one
   arguable alternative is minting a `ui-entry-list` element now; ruled against on default-no,
   six proven instantiations of the function shape, and zero consumer demand for element-ness).
2. Whether the `./entry-data` subpath should also carry `readEntries` in the root barrel (today it
   is unexported; the ADR adds it only on the subpath). Cosmetic either way.
