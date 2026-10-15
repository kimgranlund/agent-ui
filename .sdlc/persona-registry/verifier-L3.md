<!-- role=verifier level=L3 model=fable effort=xhigh -->
## Verdict
pass

## Criteria
Pre-build commit used for red runs: `ecd7d594` (`HEAD~1`; `$SDLC_BASE_SHA` equals the built commit `76dc8c82`). No `builder-*.md` exists (solo lane), so there were no builder claims to accept. All mutations ran in a throwaway worktree at HEAD under `$SDLC_TMP_WORKTREES` and were restored; the real tree ended at `76dc8c82` with empty `git status --short`.

- AC1 Pure subpath: pass. Evidence:
  - `npx vitest run --project packages packages/agent-ui/a2ui/src/registry` exit 0 (3 files, 51 tests).
  - `npx vitest run --project packages .../agent/gates.test.ts .../layering.test.ts .../corpus/index.test.ts` exit 0 (25 tests).
  - `jq '.exports["./registry"]'` gives `./src/registry/index.ts` (null at base).
  - Red seen: re-exporting from `src/index.ts`, a `node:fs` import in `select.ts`, and a `../agent/` import in `compose.ts` each gave exit 1 on the matching opt-in leg. At base the folder run exits 1 (no test files).
  - Transitive check: `types.ts` and `corpus/text-similarity.ts` have no imports.
- AC2 Composition and views: pass. Evidence:
  - `compose.test.ts` (14 tests) and the persona legs of `registry-wiring.test.ts` are green.
  - Direct run over `site/capability-registry.json`: base 80 types, `agent-ui--croupier` 81 (superset, extra `['PlayingCard']`), `personaOnlyTypes` `["PlayingCard"]`, PlayingCard and Button both carry intents, `agent-ui--nobody` types equal base, `nobody--croupier` has 0 types.
  - Red seen: dropping `fixture-demo` from the loader list gave exit 1 on the persona legs.
- AC3 Ranking: pass. Evidence:
  - `select.test.ts` (5 tests) green.
  - Direct run: `selectCapabilities('show one playing card', croupierView, 3)` returns `['PlayingCard','Swatch','ChoiceCard']`, all in the view; base view returns no PlayingCard; zero-score intent returns 0 rows; cap 0 returns 0, cap 1 returns 1.
  - Red seen: `cap + 1` in `select.ts` gave exit 1 on the cap test.
- AC4 Tag rule scope: pass. Evidence:
  - Tag parity legs green, including their negative control.
  - Projection: persona tags are `BookingConfirmation` null, `BookingForm` null, `PlayingCard` `ui-playing-card`, `FixtureBanner` null; `a2ui-basic` types with a tag: 0.
  - Red seen: removing the `AudioPlayer` rename gave exit 1 on the default-type leg; swapping persona `controlTag` for `ruleTag` gave exit 1 on the concierge and fixture-demo legs.
- AC5 Wiring gates: pass. Evidence:
  - `registry-wiring.test.ts` green; `npx vitest run --project packages .../catalog/default/index.test.ts` exit 0 (154 tests).
  - Red seen, each exit 1 on the named leg: a mini-skill `catalogId: ghost` (scope); a `- ui-icon` entry under `uses:` in `button.md` (fleet join); a second `EXCLUSION_ALLOWLIST = new Map` in `index.test.ts` (single source); one allowlist entry removed (coverage gate); the persona list mutation above (loader list and derived ids).
  - The allowlist moved verbatim: 10 keys identical and the Map body hash matches the pre-build one (`7f86eeb359797fc6`).
  - Dismissed: `git grep` finds a second `const EXCLUSION_ALLOWLIST` at `packages/agent-ui/components/src/controls/naming-gates.test.ts:482`. Read lines 462-482 and 537-538: it is an empty, tag-keyed jsdom-construction skip list, and the commit does not touch `components`. Not a second catalog-exclusion map.
- AC6 Loader and projection: pass. Evidence:
  - `node --experimental-strip-types .../tools/registry/generate.ts --dry` exit 0, printing "2 catalog, 82 control, 4 corpus-shard, 18 function, 3 genui-pack, 20 mini-skill, 94 type; personas: 3 (7 rows)", under plain Node with no `document` or `window`.
  - `npm run generate:registry` twice in the throwaway: both exit 0, `git status --short` empty, output byte-equal to the committed file.
  - `cmp` of the two copies exit 0 (same sha256 `39980bd4…`). `jq` prints `94` (80 `agent-ui`, 14 `a2ui-basic`); `.personas` keys are concierge, croupier, fixture-demo. The full key set holds no time or date key.
  - Red at base: the generator is missing (exit 1) and `jq` exits 2.
- AC7 Drift gate: pass. Evidence:
  - Clean tree: `npx vitest run --project tools packages/agent-ui/a2ui/tools/registry` exit 0 (5 tests).
  - One trailing byte in `site/public/capability-registry.json`: exit 1, "stale or missing: site/public/capability-registry.json. Regenerate with `npm run generate:registry`".
  - Top-level `description:` edited in `attachment/attachment.md`: exit 1, same message naming both copies. Reverted, exit 0 again.
  - A nested `attributes[]` description edit in `button.md` stays green. The projection does not index attribute descriptions (48 of 82 control rows carry the top-level one), so nothing is stale there.
- AC8 Preset leg: pass. Evidence: `npx vitest run --project site site/lib/capability-registry.test.ts` exit 0 (10 tests). Red seen: changing the shipped preset to `localPatterns: 'nobody'` gave exit 1 on the two preset legs.
- AC9 Page: pass. Evidence:
  - `npx vitest run --project site site/pages/capability-registry.test.ts` exit 0 (4 tests); the sitemap, llms and docs-grammar run exit 0 (172 tests).
  - The diff shows the html, the page module, the manifest row (section A2UI), the `_page.ts` nav link, the `llms.txt` entry and both sitemap copies.
  - Red seen: removing the `change` listener gave exit 1 on the croupier re-render test; removing the manifest row gave exit 1 on the sitemap byte gate.
  - Dependents: `npm run build` in the throwaway exit 0 and emits `dist/capability-registry.html`. The nav bijection test in `site-nav.browser.test.ts` (`-t "one <a> per entry"`) exit 0 in both engines.
  - That file's section-labels test is red at HEAD and red at `ecd7d594` with the same assertion ("expected [ 'Feed & status', …(23) ] to include 'Components'"). It predates this change and is not a criterion here.
- AC10 No prompt change: pass. Evidence:
  - `git diff HEAD~1 HEAD -- packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent .claude/docs/spec` is 0 bytes, so the baseline is unrecaptured.
  - `prompt-equivalence.test.ts` exit 0 (5 tests).
  - `git grep retrievalScopeFor` hits only the ADR-0237 line saying it is not shipped; it is not exported from the registry index.
  - Direct run: base `retrievable` 23, `agent-ui--croupier` 0. Red seen: widening the filter to `baseId` gave exit 1 on the SPEC-R6 legs.
- AC11 Records: pass. Evidence:
  - ADR-0237 header read: Status `proposed`, Ratified by `pending Kim`, relates 0071, 0087, 0172, 0173 cl.5, 0232, 0233, 0234.
  - 0235 and 0236 are in `KNOWN_GAPS` (`docs-grammar.test.ts` diff) and exist as ADR files in the `wave-manifest` and `wave-embed` worktrees.
  - The glossary entry is at `agent-model.md:155`, inside section 3 (lines 108-166).
  - `grep -c "capability registry"` prints 1 for each of the three files (0 each at base). `generate:registry` appears once in `AGENTS.md` and in both skills.
  - `doc_lint.py` exit 0, but it prints "not a functional document": this ADR has no `doc-type` frontmatter, so the lint only bites on the file existing (exit 1 at base). The content claims rest on the reads above and the green `docs-grammar.test.ts`.
- AC12 Standing gates: pass. Evidence: `npm run check` exit 0. `npm test` exit 0 with 654 files passed, 1 skipped, and 13457 tests passed, 6 skipped. The handoff's 653 and 13453 are build-time notes; the criterion is the exit code.

## Out of scope changes
None. All 35 files map to a criterion.
- `vitest.config.ts`: the tools include and the `./registry` alias that AC7 to AC9 need.
- `corpus/index.test.ts`: the four-line exemption for `src/registry`, a test AC1 names.
- `docs-grammar.test.ts`: only the `KNOWN_GAPS` additions for AC11.
- `site/public/adr-index.json`: the regenerated ADR index.
- Em dash constraint: the only em dashes in added lines are the ADR H1 (required by `ADR_H1_RE`, `scripts/generate-sitemap.mjs:260`) and the moved allowlist text (30 such lines removed from `index.test.ts`, 28 added in `exclusions.ts`). The commit message has none.

## For the next attempt
None
