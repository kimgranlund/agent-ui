## Task goal
Give every agent-emittable catalog type machine-readable selection guidance (`intents` and `notFor`, with confusable pairs) that the catalog-derived prompt inventory shows to the model and that evals and validators can read, then update every skill, command, agent and doc that describes the catalog, descriptors, or prompt inventory so none goes stale.

## Step 3: ADR-0232, contract docs, skills, agents, and gates green
level: L3
### Do
**ADR.** NEW `.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md`, from `0000-template.md`. The number is free: no file, branch, worktree or log entry claims it.
- H1: `# ADR-0232 <em dash> <title>`. That em dash is mandatory because `ADR_H1_RE` in `scripts/generate-sitemap.mjs` and `site/lib/adr.ts` throws without it. It is the only em dash in the file.
- Status: bare `proposed`. Ratified by: pending Kim's ratification, never self-ratified.
- Proposed by: the sdlc-lite run `catalog-notfor-intents`, GH #1796, design ratified for build by Kim 2026-10-05 per the handoff.
- Repairs: SPEC-R6 (`a2ui-live-agent.spec.md`), LLD-C4, `a2ui-catalog.spec.md` §5.2 intro, rubric `a2ui-catalog.md` D7, and the code files.
- Supersedes cell:
  - Amends ADR-0071. Do not edit ADR-0071's body: accepted ADRs are append-only per `doc-standards` `references/status-dialects.md` §2.
  - Extends ADR-0087 (include-or-recorded coverage).
  - Relates ADR-0097 (`feed-catalog.ts` policy beside the agent), ADR-0135 (Node-only prompt assets and fs-shim), ADR-0169 and ADR-0172 (per-catalog and derived catalogs), ADR-0173 (descriptor untouched), ADR-0091 §4 and ADR-0197 cl.5 (app marginal budget, zero headroom).
- Context: the maison comparison, and zero hits for `notFor`/`intents` in the repo.
- Decision:
  - the sidecar schema and caps
  - the loader API
  - the clause format
  - the coverage law (bijection, reciprocity, the persona edge rule)
  - the budget, with the measured number and ceiling taken from the `SELECTION_GUIDANCE_CHAR_BUDGET` doc comment
  - the token cost, as len(recaptured `default`) minus len(base `default`) chars, with its percentage of the base default prompt
- Consequences: the four-key recapture; the Worker registration; the dogfood inventory carries no guidance; in-page tooling cannot read the sidecar; reciprocity may force weak reverse `why`s, which D7 rejects.
- Alternatives considered: copy the list from architect-L1.md Rejected alternatives. The descriptor home must carry both reasons: no descriptor exists for a2ui-basic or persona types, and ADR-0173 cl.5 keeps catalog content hand-curated.
- Then run `node scripts/generate-sitemap.mjs` (the ADR-title carve-out, `.claude/docs/process.md` §1).

**SPEC and LLD.**
- `.claude/docs/spec/a2ui-live-agent.spec.md`: version v0.17 to v0.18, with a dated changelog line in the header's own pattern. SPEC-R6 gains a paragraph and a new AC7: for a catalog with a sidecar, each inventory line carries its clause after `(props: ...)`; a catalog with no sidecar composes the pre-ADR-0232 line; the default delta is at most `SELECTION_GUIDANCE_CHAR_BUDGET`. AC1 to AC6 exist today.
- `.claude/docs/lld/a2ui-live-agent.lld.md`: the LLD-C4 row gains one sentence naming `selection-guidance.ts` and the clause. The header line gains an "ADR-0232 (proposed) folded <date>" note. The module tree entry gains a `selection-guidance.ts` line.

**Rubric.** `.claude/docs/rubrics/a2ui-catalog.md`:
- Header v0.2 to v0.3 with a dated note. The row's artifact list gains the `selection.json` entry.
- A new row `| D7 | Selection guidance | [review] | ...`, written without em dashes, with these anchors:
  - 1: a type without an entry, so `catalog/selection-guidance.test.ts` is red; or an intent restating the type; or a `why` copying a mini-skill sentence.
  - 3: the gate is green, intents name the job in user words, and each `why` names the discriminating axis.
  - 5: as 3, and every edge is a real confusable pair from spec §5.2 or `choosing.ts`, with no filler reverse `why`.
- Gate to promote: the [review] list becomes (D4, D5, D6, D7), and "all six dimensions" becomes seven.
- Replace every `D1–D6` (en dash) with `D1–D7` in this file, in `.claude/skills/a2ui-review-standards/SKILL.md` and in `.claude/docs/spec/a2ui-expert-harness.spec.md`. These three are the only a2ui-catalog references (git grep).

**Skills.** Edit body text, not frontmatter descriptions. Cite symbols and clause ids, never `file.ts:NNN` line anchors (`claude_wiring_check.py` advisory). Each file must mention `selection.json`:
- `component-catalog`: the machine source for by-job routing among emittable types, via `selectionGuidanceFor` on `@agent-ui/a2ui/agent`.
- `a2ui-payload-authoring`: pick a type by its `use:` intents and honor `not for:`; add a checklist item.
- `a2ui-prompt-authoring`: the sidecars are byte-pinned surface (edit means recapture). Register each in `fs-shim-content.ts` `FILES`, gated by `fs-shim.test.ts`.
- `a2ui-multi-catalog`: per-catalog and persona sidecars, the derived union, the persona edge rule.
- `a2ui-build`: canonical sources gain the loader and the gate.
- `a2ui-catalog-rendering-review/references/catalog-pipeline.md`: Layer 1 says a row lands with its entry; the Gate matrix gains a row "type in catalog.json with no selection.json entry, or vice versa", pointing to `catalog/selection-guidance.test.ts`.
- `component-design`: under Catalog posture, an emittable row lands with its selection entry.

**Agents.** `.claude/agents/a2ui-build-agent.md`: a catalog row includes its `selection.json` entry. `.claude/agents/a2ui-payload-authoring-agent.md`: type choice reads the inventory clause sourced from `selection.json`.

**Human twins.** `site/pages/choosing.ts` header comment, the `a2ui-catalog.spec.md` §5.2 intro (bump v0.3 to v0.4 with the date), and the `.claude/docs/references/agent-model.md` §3 Glossary entry "selection guidance". Each cites `selection.json` as the Node-only machine twin.

**Checked and unchanged, with reasons from architect-L1.md Interfaces:** `CLAUDE.md`/`AGENTS.md`, `doc-standards`, `component-packaging`, `component-standards` descriptor-generation, the ADR-0173 body, `a2ui-catalog.spec.md` §5.1, `.claude/commands` (absent), and `.claude/ops` (removed in PR #1792).

**Rules for this step.**
- No new em dash in any edited line. The guard counts them per file.
- `doc_lint.py` reports "not a functional document" with exit 0 for every target doc, so it is no gate here.
- No issue comments, push or PR.

**Gates.** Run every gate below and fix any red that steps 1 and 2 introduced. A fix that needs a file outside the scope guard is Status blocked for a scope decision. `npm run size` is already red at base (app marginal 106 987 > 106 559 B gz) and is not a criterion.

Depends on: step 2.
### Acceptance criteria
- `f=.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md; grep -qE '^# ADR-0232 ' "$f" && grep -qxF '> | **Status** | proposed |' "$f" && for k in selection.json SELECTION_GUIDANCE_CHAR_BUDGET ADR-0071 ADR-0097 ADR-0169 ADR-0173 a2ui-basic; do grep -qF "$k" "$f" || exit 1; done`
- `grep -qF '"name": "ADR-0232"' site/public/adr-index.json && npx vitest run --project site site/lib/sitemap.test.ts site/lib/adr.test.ts`
- `for f in .claude/docs/spec/a2ui-live-agent.spec.md .claude/docs/lld/a2ui-live-agent.lld.md .claude/docs/spec/a2ui-catalog.spec.md .claude/docs/references/agent-model.md site/pages/choosing.ts; do grep -qF selection.json "$f" || exit 1; done`
- `grep -qE '^\| D7 \| Selection guidance \| \[review\] \|' .claude/docs/rubrics/a2ui-catalog.md && for f in .claude/docs/rubrics/a2ui-catalog.md .claude/skills/a2ui-review-standards/SKILL.md .claude/docs/spec/a2ui-expert-harness.spec.md; do grep -qF 'D1–D7' "$f" || exit 1; ! grep -qF 'D1–D6' "$f" || exit 1; done`
- `for f in .claude/skills/component-catalog/SKILL.md .claude/skills/a2ui-payload-authoring/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md .claude/skills/a2ui-multi-catalog/SKILL.md .claude/skills/a2ui-build/SKILL.md .claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md .claude/skills/component-design/SKILL.md .claude/agents/a2ui-build-agent.md .claude/agents/a2ui-payload-authoring-agent.md; do grep -qF selection.json "$f" || exit 1; done`
- (guard) `npm run check`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui`
- (guard) `npx vitest run --project tools`
- (guard) `python3 -c "import subprocess as s,os; b=os.environ['SDLC_BASE_SHA']; g=lambda *a: s.run(['git',*a],capture_output=True,text=True).stdout; x=['--','.',':(exclude).sdlc']; c=lambda t: t.count(chr(8212)); ch=[f for f in g('diff','--name-only',b,*x).split() if os.path.isfile(f)]; new=g('ls-files','--others','--exclude-standard',*x).split(); bad=[f for f in ch if c(open(f).read())>c(g('show',b+':'+f))]+[f for f in new if c(open(f).read())>(1 if f.startswith('.claude/docs/adr/') else 0)]; print(len(ch),len(new),bad); assert not bad"`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vE '^(packages/agent-ui/a2ui/(src/(agent/(selection-guidance(\.unit\.test)?|gates\.test|system-prompt|index)\.ts|catalog/selection-guidance\.test\.ts|catalog/(default|a2ui-basic|personas/[a-z-]+)/selection\.json|live-agent/prompt-drift\.test\.ts|live-agent/prompt-equivalence\.baseline\.json)|tools/agent/worker/fs-shim(-content|\.test)?\.ts)|\.claude/docs/adr/0232-catalog-selection-guidance-sidecar\.md|site/(public/)?(adr-index|sitemap)\.json|site/pages/choosing\.ts|\.claude/docs/(spec/(a2ui-live-agent|a2ui-catalog|a2ui-expert-harness)\.spec|lld/a2ui-live-agent\.lld|references/agent-model|rubrics/a2ui-catalog)\.md|\.claude/skills/(component-catalog|a2ui-payload-authoring|a2ui-prompt-authoring|a2ui-multi-catalog|a2ui-build|a2ui-catalog-rendering-review|component-design|a2ui-review-standards)/(SKILL|references/[a-z0-9-]+)\.md|\.claude/agents/a2ui-(build|payload-authoring)-agent\.md)$' )"`
