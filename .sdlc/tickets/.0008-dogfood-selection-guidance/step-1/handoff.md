## Task goal
Decide and, if warranted, build selection guidance for the genui dogfood inventory. Tracks GH #1815 item 3 (second part). This is a design question first; use `find-intent` or an architect before any build.

## Step 1: Dogfood inventory rows carry the selection clause
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: GH #1814 (the no-barrels wave, ADR-0233) merged into main. Kim ruled on 2026-10-05 that no build starts before then (handoff `## Rulings`). Check this before any edit. Run `gh issue view 1814 --json state --jq .state` and require `CLOSED`. If the lane is offline, use the committed-tree fallback instead: a `.claude/docs/adr/0233-*` file on `HEAD` (`git ls-tree -r --name-only HEAD -- .claude/docs/adr`), and no `"./components"` export left in `git show HEAD:packages/agent-ui/components/package.json`. The barrel removal is the wave's last slice (`.sdlc/work/no-barrels/handoff.md`, Planning instructions). If the check fails, stop with Status blocked: "no-barrels wave not merged".

Design source: `.sdlc/0008-dogfood-selection-guidance/architect-L1.md` (Approach, Interfaces, Carry forward). The line numbers below come from there or from plan-time reads.

1. `packages/agent-ui/a2ui/src/agent/selection-guidance.ts`
   - Add `export function selectionGuidanceForId(catalogId: string): SelectionGuidance`. Move today's `selectionGuidanceFor` body into it verbatim, with the same rules: the base ids, a derived `<base>--<persona>` split on the first `--`, and any other id mapping to `EMPTY`. `selectionGuidanceFor(catalog)` becomes `return selectionGuidanceForId(catalog.catalogId)`.
     - Evidence: `dogfood-inventory.ts` has no `Catalog` object. The ADR-0137 SDK-FREE leg (`gates.test.ts:87-99`) bars it from importing `defaultCatalog` or the components barrel.
   - Add `export function renderSelectionClauseWith(entry: SelectionEntry | undefined, labelFor: (type: string) => string): string` as the one formatter:
     - `''` for `undefined`;
     - otherwise ` · use: ` plus the intents joined by `; `;
     - then, only when `notFor` is non-empty, ` · not for: ` plus `<labelFor(type)> (<why>)` items joined by `, `.
   - `renderSelectionClause(entry, catalog)` keeps its signature and its `UNRESOLVED` membership check, then returns `renderSelectionClauseWith(entry, (t) => t)`. Its bytes must not move. `prompt-equivalence.test.ts` proves that with no recapture of the four composed keys.
   - Update the header comment to name the second consumer. Both names reach `@agent-ui/a2ui/agent` through `export *` (`src/agent/index.ts:28`), so `index.ts` is not edited.
2. `packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts`
   - `export function catalogTypeForTag(tag: string): string`. `ui-audio` maps to `AudioPlayer`; any other tag drops the `ui-` prefix and PascalCases the kebab segments. This is the fleet's one rule (`catalog/default/index.test.ts:109-135`). The function is pure.
   - `export function dogfoodSelectionClause(entry: SelectionEntry | undefined): string`. It returns `renderSelectionClauseWith(entry, labelFor)`, where `labelFor` maps a catalog type to the taught tag whose `catalogTypeForTag` equals it, over the full `dogfoodInventoryTags()` set.
     - An unmapped type throws `SelectionGuidanceError` with code `UNRESOLVED` and this message: `SELECTION_GUIDANCE_UNRESOLVED: notFor target "<Type>" has no taught ui-* tag in the dogfood inventory; fix catalogTypeForTag or the sidecar edge, not the dogfood renderer`.
     - Why it is exported: the drift gate's negative control needs a seam to plant an edge, and it is the dogfood twin of `renderSelectionClause` (`selection-guidance.ts:211-224`).
   - `dogfoodInventory(tags?)`: per call, build the guidance once from `selectionGuidanceForId('agent-ui')` (base only; persona sidecars are an owned limit, see the architect's Approach). Build the labeller once too (one fleet scan per call, never one per row).
     - A row whose `catalogTypeForTag(tag)` is a guidance key gets its clause between `(attrs: ...)` and the optional ` (family: ...)`. The existing drift regexes stay valid: the head is anchored at line start and the family clause at line end (`prompt-drift.test.ts:194-203`).
     - Rows with no entry stay byte-identical.
     - With `tags` given, resolve every edge against the full fleet first, so an unresolvable edge still throws. Then drop the `not for` edges whose target tag is outside `tags`, the rule the function already applies to family members (doc law at `:369-372`, filter at `:381-383`). The `use:` half stays.
   - `export const DOGFOOD_GUIDANCE_CHAR_BUDGET = 8_800` (Kim's ruling). Its doc comment says three things:
     - the budget is the sum of the clause lengths `dogfoodInventory()` appends;
     - a `prompt-drift` leg holds it, never runtime truncation;
     - a line `MEASURED <YYYY-MM-DD>: <sum> chars over <n> rows (<edges> notFor edges); budget 8 800 (Kim 2026-10-05; ADR-0232 cl.5 formula)`.
     - Plan-time probe: 8 479 chars over 72 rows, 144 edges.
     - If your measured sum is over 8 800, stop with Status blocked for Kim. Never raise the constant.
   - Set `DOGFOOD_INVENTORY_CHAR_BUDGET` to the measured `dogfoodInventory().length`, rounded up to the next 100, plus 300 (plan time: 27 820, giving 28 200). Add a dated `MEASURED <YYYY-MM-DD>:` comment line naming the mover (the selection clause, T-0008) and the SPEC-R13(b) v0.11 amendment from step 2.
   - Update the header and the `dogfoodInventory` doc comment: the new row format; the sidecar as a second source, so a default-sidecar edit also moves this never-byte-captured output; `Option`/`MenuItem` edges throw.
   - Imports stay relative (`./selection-guidance.ts`), and `NODE_ALLOWED` is unchanged.
3. Tests
   - `src/agent/selection-guidance.unit.test.ts`: `selectionGuidanceForId` equals `selectionGuidanceFor` for `agent-ui`, `a2ui-basic`, `agent-ui--croupier` and an unknown id. `renderSelectionClauseWith` with a custom labeller gives the exact clause, and `undefined` gives `''`.
   - `src/live-agent/prompt-drift.test.ts`, a new dogfood describe:
     - (a) every row whose mapped type has an `agent-ui` entry ends with its expected clause, followed only by an optional family clause. The test builds the expected clause independently: `renderSelectionClauseWith` with a type-to-tag map built from `dogfoodInventoryTags()` and `catalogTypeForTag`.
     - (b) the clause-less rows equal exactly the rows whose mapped type has no entry, derived at run time and never hand-listed. Both sets are non-empty.
     - (c) the summed clause length is above 0 and at most `DOGFOOD_GUIDANCE_CHAR_BUDGET`.
     - (d) a `NEGATIVE CONTROL` leg: `dogfoodSelectionClause` on a planted entry whose edge targets `Option` throws code `UNRESOLVED`. `Option` is a default type with no `ui-` tag (`factories.ts:530`).
     - (e) retitle `:239` to name `DOGFOOD_INVENTORY_CHAR_BUDGET` instead of "16 000".
     - The existing round-trip, family and button legs stay as they are.
   - `src/live-agent/dogfood-inventory-parity.test.ts`, a new describe:
     - for every `defaultFactories` entry (`catalog/default/factories.ts:1436`, relative import) whose `tag` starts with `ui-`, `catalogTypeForTag(f.tag) === typeId`. Plan-time parse: all 78 `ui-` factories agree.
     - a `NEGATIVE CONTROL` leg: the same comparison over a planted factory row with a mismatching tag reports a disagreement.
   - `src/live-agent/dogfood-inventory.test.ts`:
     - The row-shape leg at `:15-22` anchors `\(attrs: .+\)$`, so it reds on the six use-only rows (ui-choice-card, ui-radio, ui-segment, ui-split-pane, ui-swiper-item, ui-timeline-item; plan-time probe). Replace it with the regex below.
     - Retitle `:45` and repair the `:78` comment to name `DOGFOOD_INVENTORY_CHAR_BUDGET` instead of "16 000".

```
/^- ui-[a-z0-9-]+ \u2014 .+ \(attrs: .+\)( · use: .+)?( \(family: [^)]*\))?$/
```

4. `src/agent/prompts/genui-dogfood-teaching.md`: in the "Reading the inventory below" paragraph, say that a line may carry `· use: <jobs>`, then `· not for: <ui-tag> (<why>), ...` (pick between confusable siblings), before the optional `(family: ...)`.
   - Add no new em dash; the existing `— <one-line role>` token mirrors the rendered row and stays.
   - The file stays at or under 8 000 chars (SPEC-R13(a)).
   - Then recapture with `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`. Never hand-edit the baseline (root `AGENTS.md`). Only `genuiDogfoodTeaching` may move.

Contract dependents left untouched on purpose:
- `system-prompt.ts`: `genuiBlock` composes `dogfoodInventory()` as is, and `catalogInventory` calls `renderSelectionClause` with an unchanged signature.
- `dogfood-tag-set-equality.test.ts`: it reads `dogfoodInventoryTags()`, not the prose.
- `genui-surface-prompt.test.ts` and `a2ui-surface-toggle.test.ts`: they compose through `dogfoodInventory()` and run in the focused guard.
- `gates.test.ts`: the new import is relative, and the root-barrel static leg already bars every agent export.
- `tools/agent/worker/fs-shim*.ts`: `default/selection.json` is already in `FILES` (architect Carry forward).
- The test-local `pascal` copies in `catalog/default/index.test.ts`, `descriptor-agreement.test.ts` and `family-coherence.test.ts`: the new export is gated against `WidgetFactory.tag` instead.

Focused checks: the criteria below.
### Acceptance criteria
- `node --experimental-strip-types --no-warnings --input-type=module -e "import { selectionGuidanceFor, selectionGuidanceForId, renderSelectionClauseWith } from './packages/agent-ui/a2ui/src/agent/selection-guidance.ts'; const same = JSON.stringify(selectionGuidanceForId('agent-ui--croupier')) === JSON.stringify(selectionGuidanceFor({ catalogId: 'agent-ui--croupier', components: {} })); const out = renderSelectionClauseWith({ intents: ['a', 'b'], notFor: [{ type: 'Text', why: 'w' }] }, (t) => 'ui-' + t.toLowerCase()); const ok = [same, out === ' · use: a; b · not for: ui-text (w)', renderSelectionClauseWith(undefined, (t) => t) === '']; if (ok.includes(false)) { console.error(ok, out); process.exit(1) }"`
- `node --experimental-strip-types --no-warnings --input-type=module -e "import { dogfoodInventory, catalogTypeForTag } from './packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts'; import { readFileSync } from 'node:fs'; const types = JSON.parse(readFileSync('packages/agent-ui/a2ui/src/catalog/default/selection.json', 'utf8')).types; const rows = dogfoodInventory().split('\n'); const bad = rows.filter((r) => Object.hasOwn(types, catalogTypeForTag(/^- (ui-[a-z0-9-]+) /.exec(r)[1])) !== r.includes(' · use: ')); const fam = rows.filter((r) => r.includes('(family: ') && !/ \(family: [^)]*\)$/.test(r)); const used = rows.filter((r) => r.includes(' · use: ')).length; const fails = [used === 0, bad.length > 0, fam.length > 0]; if (fails.includes(true)) { console.error(bad.concat(fam).join('\n')); process.exit(1) }"`
- `node --experimental-strip-types --no-warnings --input-type=module -e "import { dogfoodInventory, dogfoodInventoryTags, dogfoodSelectionClause } from './packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts'; const taught = new Set(dogfoodInventoryTags()); const rows = dogfoodInventory().split('\n').filter((r) => r.includes(' · not for: ')); const heads = rows.flatMap((r) => [...r.split(' · not for: ')[1].replace(/ \(family: [^)]*\)$/, '').matchAll(/(?:^|\), )(\S+) \(/g)].map((m) => m[1])); const solo = dogfoodInventory(['ui-button']); const strays = (solo.match(/\bui-[a-z0-9-]+/g) ?? []).filter((t) => t !== 'ui-button'); let code = ''; try { dogfoodSelectionClause({ intents: ['a'], notFor: [{ type: 'PlantedGhostType', why: 'w' }] }) } catch (e) { code = e.code } const fails = [code !== 'SELECTION_GUIDANCE_UNRESOLVED', rows.length === 0, heads.some((h) => !taught.has(h)), !solo.includes(' · use: '), strays.length > 0]; if (fails.includes(true)) { console.error(rows.length, heads.filter((h) => !taught.has(h)), strays); process.exit(1) }"`
- `f=packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts; grep -qE '^export const DOGFOOD_GUIDANCE_CHAR_BUDGET = 8_800$' "$f" && test "$(grep -cE 'MEASURED [0-9]{4}-[0-9]{2}-[0-9]{2}' "$f")" -ge "$(( $(git show "$SDLC_BASE_SHA:$f" | grep -cE 'MEASURED [0-9]{4}-[0-9]{2}-[0-9]{2}') + 2 ))"`
- (guard) `node --experimental-strip-types --no-warnings --input-type=module -e "import { dogfoodInventory, DOGFOOD_INVENTORY_CHAR_BUDGET as B } from './packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts'; const n = dogfoodInventory().length; if (!(n <= B && B <= Math.ceil(n / 100) * 100 + 300)) { console.error(n, B); process.exit(1) }"`
- `f=packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts; grep -q 'DOGFOOD_GUIDANCE_CHAR_BUDGET' "$f" && grep -q 'catalogTypeForTag' "$f" && grep -q 'dogfoodSelectionClause' "$f" && test "$(grep -c 'NEGATIVE CONTROL' "$f")" -gt "$(git show "$SDLC_BASE_SHA:$f" | grep -c 'NEGATIVE CONTROL')"`
- `f=packages/agent-ui/a2ui/src/live-agent/dogfood-inventory-parity.test.ts; grep -q 'catalogTypeForTag' "$f" && grep -q 'defaultFactories' "$f" && test "$(grep -c 'NEGATIVE CONTROL' "$f")" -gt "$(git show "$SDLC_BASE_SHA:$f" | grep -c 'NEGATIVE CONTROL')"`
- `! grep -n '16 000' packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts`
- `python3 -c "import json, os, subprocess, sys; p = 'packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json'; new = json.load(open(p)); old = json.loads(subprocess.run(['git', 'show', os.environ['SDLC_BASE_SHA'] + ':' + p], capture_output=True, check=True).stdout); t = open('packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md').read().strip(); k = 'genuiDogfoodTeaching'; sys.exit(0 if set(new) == set(old) and all(new[x] == old[x] for x in old if x != k) and new[k] != old[k] and new[k] == t else 1)" && f=packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md && grep -qF '· use:' "$f" && grep -qF '· not for:' "$f"`
- (guard) `f=packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md; test "$(wc -c < "$f")" -le 8000 && for g in "$f" packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts packages/agent-ui/a2ui/src/agent/selection-guidance.ts packages/agent-ui/a2ui/src/agent/selection-guidance.unit.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-inventory-parity.test.ts; do test "$(grep -o '—' "$g" | wc -l)" -le "$(git show "$SDLC_BASE_SHA:$g" | grep -o '—' | wc -l)" || exit 1; done`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-inventory-parity.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-tag-set-equality.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts packages/agent-ui/a2ui/src/agent/selection-guidance.unit.test.ts packages/agent-ui/a2ui/src/agent/gates.test.ts packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts packages/agent-ui/a2ui/src/live-agent/genui-surface-prompt.test.ts packages/agent-ui/a2ui/src/live-agent/a2ui-surface-toggle.test.ts`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxF -e packages/agent-ui/a2ui/src/agent/selection-guidance.ts -e packages/agent-ui/a2ui/src/agent/selection-guidance.unit.test.ts -e packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts -e packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md -e packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json -e packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts -e packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts -e packages/agent-ui/a2ui/src/live-agent/dogfood-inventory-parity.test.ts`
