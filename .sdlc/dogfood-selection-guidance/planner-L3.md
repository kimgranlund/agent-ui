<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Build Kim's ruled FULL selection clause into the genui dogfood inventory: every catalog-mapped row gets `use:` and `not for:` with `ui-*` tag targets, the drift and parity tests cover it, and the ADR-0232 amendment (proposed), the SPEC-R13(b) v0.11 amendment, the LLD REV and the stale records are written.

## Step 1: Dogfood inventory rows carry the selection clause
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: GH #1814 (the no-barrels wave, ADR-0233) merged into main. Kim ruled on 2026-10-05 that no build starts before then (handoff `## Rulings`). Check this before any edit. Run `gh issue view 1814 --json state --jq .state` and require `CLOSED`. If the lane is offline, use the committed-tree fallback instead: a `.claude/docs/adr/0233-*` file on `HEAD` (`git ls-tree -r --name-only HEAD -- .claude/docs/adr`), and no `"./components"` export left in `git show HEAD:packages/agent-ui/components/package.json`. The barrel removal is the wave's last slice (`.sdlc/no-barrels/handoff.md`, Planning instructions). If the check fails, stop with Status blocked: "no-barrels wave not merged".

Design source: `.sdlc/dogfood-selection-guidance/architect-L1.md` (Approach, Interfaces, Carry forward). The line numbers below come from there or from plan-time reads.

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

## Step 2: Decision records, scrub list, and gates green
level: L3
guard timeout: 120
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: step 1. The records cite its measured constants: read `DOGFOOD_GUIDANCE_CHAR_BUDGET`, `DOGFOOD_INVENTORY_CHAR_BUDGET` and the `MEASURED` lines from `dogfood-inventory.ts`. This step is separate from step 1 only because the combined criteria exceed the 12-per-step cap.

Write numbers with a plain space as the thousands separator (`28 200`), as the SPEC does today. No new prose carries an em dash. Use a colon where the existing headings use a dash.

1. ADR-0232 (`.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md`): append one section at end of file and edit no existing byte. Accepted ADRs are append-only (`.claude/skills/doc-standards/references/adr-log-mechanics.md` §1b), and the Status cell stays `accepted`.
   - The header is exactly `## Amendment (<YYYY-MM-DD>, **proposed** — Kim ratifies) — the genui dogfood inventory carries the selection clause`.
     - Its two em dashes are the marker `scripts/adr_ratify.py:105-106` (`AMENDMENT_HEADER_RE`) parses, so Kim can ratify it with `ratify ADR-0232 amendment`.
     - The body has no em dash.
     - The body has no `**Repairs**`-labelled list, because `adr_ratify.py:74-79` files issues from one. Name the repaired records in plain prose.
   - The body:
     - retires the Consequences bullet, quoting "carries no guidance";
     - names the consumer `dogfoodInventory()`, which reads the `agent-ui` sidecar and labels `notFor` targets as `ui-*` tags via `catalogTypeForTag` (pascal plus the one `ui-audio` to `AudioPlayer` rename, gated against `WidgetFactory.tag`);
     - extends cl.2's loader API with `selectionGuidanceForId` and `renderSelectionClauseWith`;
     - states `DOGFOOD_GUIDANCE_CHAR_BUDGET` 8 800 and the measured sum;
     - lists the owned limits: base guidance only, family-sibling entries not rendered, and a `notFor` edge to `Option`/`MenuItem` throws;
     - records Kim's 2026-10-05 FULL-clause ruling, with use-only (2 691 chars, architect) as the named fallback;
     - points at SPEC-R13 v0.11 and the LLD-C3 REV.
2. `.claude/docs/spec/genui-surface.spec.md` v0.11:
   - the Status line becomes `> Status: proposed · v0.11 · <YYYY-MM-DD> · Layer: SPEC (execution contract)`;
   - a `> **v0.11 amendment (...):**` note line goes above the v0.10 note;
   - a new section `## 13 · Amendment (v0.11, T-0008 / ADR-0232 amendment): SPEC-R13(b)'s line gains the selection clause` goes at the end of the file. It states:
     - the line format: `· use:`, then `· not for:` with `ui-*` targets, before the optional family clause;
     - the inventory budget at step 1's `DOGFOOD_INVENTORY_CHAR_BUDGET`;
     - the clause sum at most `DOGFOOD_GUIDANCE_CHAR_BUDGET` 8 800;
     - a new AC5: clause on every catalog-mapped row; clause-less rows equal the non-mapped set; sum within budget; an unresolvable edge throws (negative control); the `catalogTypeForTag` to `WidgetFactory.tag` parity leg.
3. `.claude/docs/lld/genui-dogfood.lld.md` v0.4:
   - the Status line becomes `> Status: proposed · v0.4 · <YYYY-MM-DD> · Layer: LLD (implementation plan)`, with a `> **v0.4 (...):**` note;
   - in §4 LLD-C3, add a dated `> **REV <YYYY-MM-DD> (T-0008, ADR-0232 amendment):**` block naming `catalogTypeForTag`, `dogfoodSelectionClause`, `selectionGuidanceForId`, `renderSelectionClauseWith`, `DOGFOOD_GUIDANCE_CHAR_BUDGET`, the row format and the parity leg;
   - the §1 LLD-C3 files cell gains `a2ui/src/agent/selection-guidance.ts`.
4. `.claude/docs/lld/a2ui-live-agent.lld.md`: edit only the `selection-guidance.ts` module-tree line (about `:130`). Add `selectionGuidanceForId`/`renderSelectionClauseWith`, and say it also feeds `dogfoodInventory`'s per-row clause. This is the same realization-fact repair ADR-0232 made to this line.
5. `.claude/skills/a2ui-prompt-authoring/SKILL.md`, sidecar bullet (about `:54-60`): an edit to `catalog/default/selection.json` also moves the drift-gated (never byte-captured) dogfood inventory, which `DOGFOOD_GUIDANCE_CHAR_BUDGET` in `prompt-drift.test.ts` holds (re-author tersely, never raise it to green). A `notFor` edge to a type with no `ui-*` tag throws there.
6. `.claude/skills/a2ui-build/SKILL.md`, Selection guidance bullet (about `:34-37`): add `selectionGuidanceForId` and `renderSelectionClauseWith` to the API list, and name the second consumer, `dogfoodInventory()`.
7. Scrub-list files left untouched on purpose, because each describes catalog-side guidance that stays true:
   - skills `a2ui-multi-catalog`, `component-catalog`, `a2ui-payload-authoring`;
   - `.claude/agents/a2ui-build-agent.md` and `.claude/agents/a2ui-payload-authoring-agent.md`;
   - `.claude/docs/references/agent-model.md`;
   - `.claude/docs/spec/a2ui-catalog.spec.md`;
   - `packages/agent-ui/a2ui/AGENTS.md`.
   - Evidence: the architect's scrub grep hit only ADR-0232:89 (`.sdlc/dogfood-selection-guidance/architect-L1.md` Carry forward), and ADR-0162 holds no row-format text.
8. Run every guard below and fix any red that step 1 introduced. A gate already red at the build-start HEAD comes back as Status `inherited red`.
### Acceptance criteria
- `f=.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md; grep -qE '^## Amendment \([0-9]{4}-[0-9]{2}-[0-9]{2}, \*\*proposed\*\* — Kim ratifies\) — ' "$f" && test "$(grep -c '^## Amendment' "$f")" -eq "$(( $(git show "$SDLC_BASE_SHA:$f" | grep -c '^## Amendment') + 1 ))" && test "$(grep -o '—' "$f" | wc -l)" -eq "$(( $(git show "$SDLC_BASE_SHA:$f" | grep -o '—' | wc -l) + 2 ))"`
- `python3 -c "import sys; s = open('.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md').read(); i = s.find('\n## Amendment ('); body = s[i:] if i >= 0 else ''; names = ['carries no guidance', 'dogfoodInventory', 'catalogTypeForTag', 'selectionGuidanceForId', 'renderSelectionClauseWith', 'DOGFOOD_GUIDANCE_CHAR_BUDGET', 'SPEC-R13']; missing = [n for n in names if n not in body]; print(missing); sys.exit(1 if missing else 0)"`
- (guard) `python3 -c "import os, subprocess, sys; p = '.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md'; b = subprocess.run(['git', 'show', os.environ['SDLC_BASE_SHA'] + ':' + p], capture_output=True, check=True).stdout; sys.exit(0 if open(p, 'rb').read().startswith(b) else 1)"`
- `f=.claude/docs/spec/genui-surface.spec.md; grep -qF '> Status: proposed · v0.11 ·' "$f" && grep -qE '^## 13 · Amendment \(v0\.11' "$f" && python3 -c "import re, sys; c = open('packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts').read(); s = open('.claude/docs/spec/genui-surface.spec.md').read(); sec = s[s.index('## 13 · Amendment'):]; n = int(re.search(r'DOGFOOD_INVENTORY_CHAR_BUDGET = ([0-9_]+)', c).group(1).replace('_', '')); need = [f'{n:,}'.replace(',', ' '), '8 800', 'DOGFOOD_GUIDANCE_CHAR_BUDGET', 'catalogTypeForTag', '· use:', '· not for:']; missing = [x for x in need if x not in sec]; print(missing); sys.exit(1 if missing else 0)"`
- `f=.claude/docs/lld/genui-dogfood.lld.md; grep -qF '> Status: proposed · v0.4 ·' "$f" && grep -q 'catalogTypeForTag' "$f" && grep -q 'DOGFOOD_GUIDANCE_CHAR_BUDGET' "$f" && grep -q 'renderSelectionClauseWith' "$f"`
- `grep -q 'DOGFOOD_GUIDANCE_CHAR_BUDGET' .claude/skills/a2ui-prompt-authoring/SKILL.md && grep -q 'renderSelectionClauseWith' .claude/skills/a2ui-build/SKILL.md && grep -q 'selectionGuidanceForId' .claude/skills/a2ui-build/SKILL.md && grep -E '^ +selection-guidance\.ts +#' .claude/docs/lld/a2ui-live-agent.lld.md | grep -q 'dogfoodInventory'`
- (guard) `for g in .claude/docs/spec/genui-surface.spec.md .claude/docs/lld/genui-dogfood.lld.md .claude/docs/lld/a2ui-live-agent.lld.md .claude/skills/a2ui-prompt-authoring/SKILL.md .claude/skills/a2ui-build/SKILL.md; do test "$(grep -o '—' "$g" | wc -l)" -le "$(git show "$SDLC_BASE_SHA:$g" | grep -o '—' | wc -l)" || exit 1; done`
- (guard) `npm run check`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui`
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent/worker`
- (guard) `npx vitest run --project site site/lib/sitemap.test.ts`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxF -e .claude/docs/adr/0232-catalog-selection-guidance-sidecar.md -e .claude/docs/spec/genui-surface.spec.md -e .claude/docs/lld/genui-dogfood.lld.md -e .claude/docs/lld/a2ui-live-agent.lld.md -e .claude/skills/a2ui-prompt-authoring/SKILL.md -e .claude/skills/a2ui-build/SKILL.md -e packages/agent-ui/a2ui/src/agent/selection-guidance.ts -e packages/agent-ui/a2ui/src/agent/selection-guidance.unit.test.ts -e packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts -e packages/agent-ui/a2ui/src/agent/prompts/genui-dogfood-teaching.md -e packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json -e packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts -e packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts -e packages/agent-ui/a2ui/src/live-agent/dogfood-inventory-parity.test.ts`

## Assumptions
- Full clause, `DOGFOOD_GUIDANCE_CHAR_BUDGET` 8 800, and a SPEC-R13(b) amendment are Kim's decisions: verified by the handoff's `## Rulings`, Kim, 2026-10-05.
- No build starts before the no-barrels wave merges: verified by the handoff's `## Rulings`. `gh issue view 1814` returned OPEN at plan time. `HEAD` has no `adr/0233-*` and still exports `"./components"` (`components/package.json:15`).
- Today the inventory is 19 341 chars, 82 rows and 88 taught tags, and 72 rows map to a sidecar entry: verified by a plan-time probe over `dogfoodInventory()`. The projected clause sum is 8 479, giving an inventory of 27 820 and a budget of 28 200 by the cl.5 formula. The architect's hand-built 8 424 and 27 765 differ by 55 chars, so the builder re-measures.
- `pascal(tag)` plus the `ui-audio` rename equals `WidgetFactory.tag` for all 78 `ui-` default factories, and `Option`/`MenuItem` are `div[role=...]`: verified by a plan-time parse of `factories.ts` and `.sdlc/dogfood-selection-guidance/architect-L1.md`.
- Every one of the 144 `notFor` edges on mapped rows resolves to a taught tag, and C1/C2 pass on a correct render: verified by simulating the target rendering against the probes.
- The `dogfood-inventory.test.ts` row-shape regex goes red on six use-only rows unless updated: verified by a plan-time probe over the sidecar entries with empty `notFor`.
- `selection-guidance.ts` loads in plain Node with `--experimental-strip-types`: verified by a probe (80 default entries).
- The amendment header must carry the two em dashes: verified at `scripts/adr_ratify.py:105-106`. Accepted ADRs are append-only: verified at `.claude/skills/doc-standards/references/adr-log-mechanics.md:40-54`.
- The decompose leaf `adr` accept implies the original bullet disappears. It is replaced by an append-only prefix guard plus "the amendment quotes the retired bullet", because editing accepted text breaks doc-standards §1b.
- `doc_lint` is not a criterion: it lives in the disabled nonoun-plugins cache (#1791) and abstains on this repo's dialect (`timeline-family.spec.md:17`). Structure is checked by greps instead.
- The gates are side-effect free and take about 30 s (`npm run check`), 13 to 18 s (a2ui package tests), and 1 to 2 s (tools worker and sitemap tests): verified by timed runs with `git status` unchanged afterwards.

## Risks
- T-0007 (`.sdlc/sidecar-why-rewrite`) rewrites ten `why` strings and T-0003 touches the baseline. If either lands first and the measured clause sum passes 8 800, step 1 stops blocked for Kim. Serialize them.
- The no-barrels precondition is a Do check, not a criterion, because the builder cannot make it green. If the conductor launches step 1 early, only the builder's first action stops it.
- New coupling: a future default-sidecar edge to `Option` or `MenuItem` reds `prompt-drift`. The error message routes the fix to the mapping or the sidecar.
- Each dogfood turn grows by about 8.5k chars (about 44% of the segment).
- `dogfoodInventory()` already throws on the deployed Worker (no `controls/` DIRS in `fs-shim-content.ts`). This plan neither fixes nor worsens that (GH #1815 item 4).
- `site/.fixture-scratch/assets/a2ui-agent-*.js` is tracked build output that embeds dogfood code. No gate reads it, so it goes stale outside this ticket.
