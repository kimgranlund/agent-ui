## Task goal
Decide and, if warranted, build selection guidance for the genui dogfood inventory. Tracks GH #1815 item 3 (second part). This is a design question first; use `find-intent` or an architect before any build.

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
