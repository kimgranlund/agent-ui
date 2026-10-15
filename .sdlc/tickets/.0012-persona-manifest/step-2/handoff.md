## Task goal
A persona's agent config (site/pages/agent-admin-presets.ts, with its own seedVersion), its catalog fragment (catalog/personas/<id>/manifest.ts) and its selection.json live in different places and can drift; for example the Croupier prompt changed (seedVersion 6) independently of its sidecar and manifest. Add one manifest per persona that names all four and a gate that checks they agree. Also deci

## Step 2: Proposed ADR, SPEC-R7, record repairs, gates green
level: L3
guard timeout: 300
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: step 1, because every record cites its paths and the doc gates resolve them. The two L3 steps stay separate because merging them would pass the 12-criterion cap (10 plus 11). This is the final gates step.

- ADR header. New file `.claude/docs/adr/<NNNN>-agent-manifest-drift-gate.md`:
  - NNNN is the highest number on disk plus one, taken at build time (0233 belongs to #1814).
  - Copy the `0000-template.md` header.
  - Status `proposed`; it is never ratified here. Date is the build date.
  - Proposed by: the sdlc-lite run `persona-manifest` (GH #1812, epic GH #1817); digest pins ruled by Kim on 2026-10-05 per the run handoff. Ratified by: left for Kim.
  - The H1 keeps the single U+2014 separator that `site/lib/adr.ts:33` parses. No other em dash anywhere in the file.
  - Relationship row: amends ADR-0172 cl.1 (a fragment folder gains a site-side pin) and ADR-0232 cl.4 (a fragment sidecar edit also moves an agent manifest digest). The accepted ADR bodies stay untouched, following the ADR-0232 "Amends ADR-0071" precedent.
  - Repairs row: SPEC-R7, `packages/agent-ui/a2ui/AGENTS.md`, rubric `a2ui-catalog` D7, `agent-model.md` §3 and §A, the three skills below, and step 1's code paths.
- ADR body:
  - Context: the issue's Croupier drift is a missing pin, not a present mismatch (architect-L1.md Constraints, from `git log`). GH #1812 says "per-persona manifest"; it is named agent manifest here per `agent-model.md` §3. GH #1812 also asks whether the five fragmentless presets need fragments; say that the promotion bar it turns on is GH #497's, restated only in the proposed note `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:21-25`, and that neither ADR-0172 nor the SPEC states it.
  - Decision clause 1: the home `site/lib/agent-manifest/` and the `AgentManifest` schema.
  - Decision clause 2: the pins are the effective `seedVersion` plus canonical sha256 digests of the seed, the fragment and the sidecar. Digests, not version-only (Kim, 2026-10-05).
  - Decision clause 3: the twelve gate legs, run by `npm test`.
  - Decision clause 4: the armed writer and its exact invocation, `AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`. It rewrites digests and derived facts only; a `seedVersion` bump stays a human decision.
  - Decision clause 5: no new fragment for the twelve fragmentless presets. Every idiom type they teach is already a validated default-catalog row, so each idiom stays prose under the GH #497 bar as restated in `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:21-25`. State that the note is `proposed` (v0.1), so this clause is the ruling Kim ratifies with the ADR, not an application of ratified law. Each preset records it in its `noFragment.why`; any later candidate is its own ADR-0172 intake (ADR-0172 rules how a fragment composes, not which idiom earns one).
  - Decision clause 6: `fixture-demo` is declared through `noPreset.why`.
  - Rejected alternatives and Consequences come from architect-L1.md (Rejected alternatives, Risks). Include the library-pack coupling: one text edit in `site/pages/agent-admin-libraries.ts` moves several seed digests at once. Its "Shipping fragments for Quant, ..." row (`:48`) cites ADR-0172 for the bar; cite the decomposition note instead.
  - Cite `site/lib/agent-manifest/agent-manifest.test.ts`.
- SPEC: in `.claude/docs/spec/persona-catalog-composition.spec.md`:
  - Add `**SPEC-R7: ...**` after SPEC-R6, marked as realizing the proposed ADR.
  - Write its ACs in the SPEC's own when/then style: an unacknowledged fragment or sidecar edit reds the gate; a `localPatterns` that names no shipped fragment reds; the four id lists agree; the writer touches digests and derived facts only.
  - Bump the header version one minor step from whatever it is at build time (#1814 step 5 also edits this SPEC), set the date, and add a dated note to the header blockquote that names SPEC-R7.
  - Keep the status keyword, which docs-grammar S2 reads. Existing headings use an em dash; the new heading uses a colon.
- `packages/agent-ui/a2ui/AGENTS.md`, `## Catalogs`, one new bullet. It says:
  - Each fragment folder under `src/catalog/personas/` is pinned by its agent manifest in `site/lib/agent-manifest/` (ADR-NNNN, proposed).
  - An edit to a fragment's `catalog.json` or `selection.json` reds `site/lib/agent-manifest/agent-manifest.test.ts` until the writer runs from the repo root (`AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`).
  - A new fragment folder needs a hand-written manifest first.
- `.claude/docs/rubrics/a2ui-catalog.md`: add one sentence to the D7 row naming `site/lib/agent-manifest/` as the pin that a fragment sidecar edit also moves. Bump the header version with a dated note saying D7 now names the agent-manifest pin and no dimension or anchor moved (the v0.2 precedent, `:3-4`).
- `.claude/docs/references/agent-model.md`:
  - Add a §3 Glossary entry `**agent manifest**`: the file in `site/lib/agent-manifest/`, what it pins, its gate and its writer. It tells the agent manifest apart from the fragment manifest `PersonaCatalogManifest` (`catalog/personas/<id>/manifest.ts`, the Node-safe `personaId`/`fragment`/`targetCatalogs` triple, GH #516).
  - Add a §A row: `AgentManifest`, `site/lib/agent-manifest/agent-manifest.ts`, ADR-NNNN.
- Citation form for the promotion bar, in the ADR, SPEC-R7 and the glossary entry: the backticked path `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:21-25` with the word proposed, never a markdown link (a backticked path is not a link, so `docs-grammar.test.ts` S3 never resolves it; its `stripCode` at `:88-95` blanks code spans). SPEC-R7 and the glossary entry mention the no-fragment ruling only through the ADR or that path, never through ADR-0172.
- Skills the new gate makes stale:
  - `.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md`: a §2 gate-table row (a change to a fragment's `catalog.json` or `selection.json`, or to a preset seed, reds `site/lib/agent-manifest/agent-manifest.test.ts`), and a §3 regeneration-table row with the `AGENT_MANIFEST_WRITE=1` invocation.
  - `.claude/skills/a2ui-multi-catalog/SKILL.md` pattern 5: a new fragment also gets an agent manifest in `site/lib/agent-manifest/`.
  - `.claude/skills/a2ui-prompt-authoring/SKILL.md` sidecar bullet (`:54-60`): a fragment sidecar edit also runs the `AGENT_MANIFEST_WRITE=1` writer.
- Run `node scripts/generate-sitemap.mjs`. It rewrites `site/public/adr-index.json`, `site/public/sitemap.json`, `site/sitemap.json` and `site/public/changelog-index.json` (`scripts/generate-sitemap.mjs:340-350`; `.claude/docs/process.md` 2026-08-30 carve-out).
- New text in every edited record carries no em dash, and no tracked file's em-dash count may grow over base. The rubric header (`:3-4`) and the multi-catalog pattern 5 line already hold some, so editing those lines is fine.
- If a main sync moved a preset, fragment or sidecar after step 1, `agent-manifest.test.ts` reds. The fix is the armed writer, plus a hand edit of the manifest `seedVersion` when the preset bumped it.
- Run every gate below and fix any red that step 1 introduced; the most likely one is a `check:site` type error in `agent-manifest.ts`. A gate already red at the build-start base comes back as Status `inherited red`.
- `doc_lint.py` is not a gate here. It lives only in the disabled nonoun-plugins docs plugin and reports ADRs as not functional documents (`.sdlc/work/no-barrels/planner-L3-4.md` step 1).
- Contract dependents of the edited records:
  - The `site` project guard runs `site/lib/adr.test.ts` (every real ADR parses; the Status cell is one canonical keyword), `site/lib/sitemap.test.ts` (G1 index freshness) and `site/lib/docs-grammar.test.ts` (S2 status keyword, S3 relative links, S9 skill-table paths).
  - The `npm run check` guard runs `scripts/adr_ratify_test.py`, `claude_wiring_check.py` and `harness_wiring_check.py --rubric-modes`.
### Acceptance criteria
- `n=$(ls .claude/docs/adr | grep -cE '^[0-9]{4}-agent-manifest-drift-gate\.md$') && test "$n" -eq 1 && f=$(ls .claude/docs/adr/[0-9][0-9][0-9][0-9]-agent-manifest-drift-gate.md) && grep -qE '^> \| \*\*Status\*\* \| proposed \|$' "$f" && ! tail -n +2 "$f" | grep -q $'\xe2\x80\x94' && grep -qF 'site/lib/agent-manifest/agent-manifest.test.ts' "$f" && grep -qF 'AGENT_MANIFEST_WRITE=1' "$f" && grep -qF 'ADR-0172' "$f" && grep -qF 'ADR-0232' "$f" && grep -qF 'md-content-concierge-croupier-promotion.decomp.md' "$f"`
- `f=$(ls .claude/docs/adr | grep -E '^[0-9]{4}-agent-manifest-drift-gate\.md$') && n=${f%%-*} && test -n "$n" && grep -qF "\"name\": \"ADR-$n\"" site/public/adr-index.json`
- `s=.claude/docs/spec/persona-catalog-composition.spec.md && grep -qF '**SPEC-R7' "$s" && grep -qF 'site/lib/agent-manifest/' "$s" && sed -n '1,/^## /p' "$s" | grep '^>' | grep -qF 'SPEC-R7'`
- `grep -qF 'site/lib/agent-manifest/' packages/agent-ui/a2ui/AGENTS.md && grep -qF 'AGENT_MANIFEST_WRITE=1' packages/agent-ui/a2ui/AGENTS.md`
- `r=.claude/docs/rubrics/a2ui-catalog.md && grep -E '^\| D7 \|' "$r" | grep -qF 'site/lib/agent-manifest/' && sed -n '1,/^## /p' "$r" | grep '^>' | grep -qF 'agent-manifest'`
- `a=.claude/docs/references/agent-model.md && g=$(sed -n '/^## 3 · Glossary/,/^## 4 /p' "$a") && printf '%s\n' "$g" | grep -qF '**agent manifest**' && printf '%s\n' "$g" | grep -qF 'PersonaCatalogManifest' && printf '%s\n' "$g" | grep -qF 'site/lib/agent-manifest/' && sed -n '/^## A · Type/,$p' "$a" | grep -qF 'site/lib/agent-manifest/agent-manifest.ts'`
- `p=.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md && grep -qF 'site/lib/agent-manifest/agent-manifest.test.ts' "$p" && grep -qF 'AGENT_MANIFEST_WRITE=1' "$p" && grep -qF 'site/lib/agent-manifest/' .claude/skills/a2ui-multi-catalog/SKILL.md && grep -qF 'AGENT_MANIFEST_WRITE=1' .claude/skills/a2ui-prompt-authoring/SKILL.md`
- (guard) `for f in .claude/docs/spec/persona-catalog-composition.spec.md packages/agent-ui/a2ui/AGENTS.md .claude/docs/rubrics/a2ui-catalog.md .claude/docs/references/agent-model.md .claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md .claude/skills/a2ui-multi-catalog/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md site/pages/agent-admin-presets.ts; do test "$(grep -o $'\xe2\x80\x94' "$f" | wc -l)" -le "$(git show "$SDLC_BASE_SHA:$f" | grep -o $'\xe2\x80\x94' | wc -l)" || exit 1; done`
- (guard) `npm run check`
- (guard) `npx vitest run --project site`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxE 'site/lib/agent-manifest/[a-z0-9.-]+\.(json|ts)|site/pages/agent-admin-presets\.ts|\.claude/docs/adr/[0-9]{4}-agent-manifest-drift-gate\.md|\.claude/docs/spec/persona-catalog-composition\.spec\.md|\.claude/docs/rubrics/a2ui-catalog\.md|\.claude/docs/references/agent-model\.md|packages/agent-ui/a2ui/AGENTS\.md|\.claude/skills/(a2ui-catalog-rendering-review/references/catalog-pipeline|a2ui-multi-catalog/SKILL|a2ui-prompt-authoring/SKILL)\.md|site/public/(adr-index|sitemap|changelog-index)\.json|site/sitemap\.json' | { ! grep -q .; }`
