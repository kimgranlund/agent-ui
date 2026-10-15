<!-- role=architect level=L1 model=fable effort=high -->
## Approach
Five widgets, not twelve, decided by the measured K6 room and the mechanics of catalog placement. Three shared, data-driven `ui-*` controls join the default catalog (ProductCard, BoardGrid, GameHud); two persona composites live in persona fragments as factory composites over existing controls (CardTable in `personas/croupier`, QuestionCard in a new `personas/quizmaster`). Seven candidates are cut: Itinerary, CharacterSheet and CommitmentLedger are one ChildList template away; ExhibitCard folds into ProductCard (icon, no price); SwatchPalette is a Swatch template; MediaGallery and AvailabilityPicker are deferred for lack of a repeated per-turn composition. A Shopkeeper preset is justified as ProductCard's live consumer (config only). Kim's Hotelier room gallery maps to the Hotel Concierge: a Grid or Swiper of ProductCards in offer mode plus the existing Grid+Image template.

Placement is forced by three verified mechanics, not taste: the default turn sits at 44,392 of 46,430 chars (K6 bound 42,209 x 1.1); the three default rows cost 835 chars (row plus selection clause) landing at 45,227, while all twelve would be 47,125, over the bound. A preset selects exactly one fragment (`resolveEffectiveCatalogId`), so a shared opt-in widgets fragment could never sit beside the Croupier's or Concierge's own fragment. A derived catalog retrieves zero mini-skills and exemplars today, so W0 (derived ids inherit the base's idioms by splitting on the first `--`) is the prerequisite that makes fragments a cheap home; the ADR-0234 budget matrix already assumes it.

Full design, widget contracts, per-preset coverage matrix, ADR route (ADR-0243) and eight sequenced build children with file lists: /Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-pwd/.sdlc/preset-widgets-design/design.md (200 lines). Measurements: /Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-pwd/.sdlc/preset-widgets-design/measure/probe.ts and probe.out.txt.

## Interfaces
- Three new controls: `packages/agent-ui/components/src/controls/{board-grid,product-card,game-hud}/` (ADR-0233 per-control entries, descriptors, `registry.gen.ts` regenerated), each with a default-catalog row in `packages/agent-ui/a2ui/src/catalog/default/catalog.json`, a factory in `default/factories.ts`, a `selection.json` entry and example seeds under `packages/agent-ui/a2ui/src/examples/`.
- BoardGrid row: `rows`, `cols`, bindable `cells` array of `{row, col, mark, intent, disabled}`, `label`, `actionName`, with an `{action, context}` prop on the Suggestions precedent (`default/factories.ts:1404`).
- ProductCard row: `title`, `subtitle`, `image`, `imageAlt`, `icon`, `price`, `priceNote`, `rating`, `badge`, `badgeIntent`, `actionLabel`, `action`; children model `child`.
- GameHud row: `title`, `status`, `statusIntent`, `stats` array of `{label, value, delta, intent}`, `progress` object.
- Croupier fragment gains `CardTable` (`personas/croupier/catalog.json`, composite factory in `factories.ts`, a CardTable arm in `checks.ts`, sidecar entry, manifest rewritten by the writer test).
- New fragment folder `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/` with `QuestionCard` (two-way `value` mark), plus a record in `catalog/records.ts`, `personas/{index,manifests}.ts`, `registry-wiring.test.ts`, `site/lib/agent-manifest/quizmaster.manifest.json`, and `localPatterns: 'quizmaster'` with a `seedVersion` bump in `site/pages/agent-admin-presets.ts`.
- W0: `selectMiniSkills` (`packages/agent-ui/a2ui/src/agent/mini-skills.ts:111`) and `corpus/retrieve.ts:63` scope on the base id of a `<base>--<persona>` catalog; `persona-catalog-composition.spec.md` SPEC-R6 and `packages/agent-ui/a2ui/AGENTS.md` repaired.
- New ADR-0243 (next free after 0242) carrying the admission test, the placement rule, the derived-inheritance amendment, the K6 room rule, the Shopkeeper preset and the three component-design fork sheets.
- Shopkeeper preset: an `AGENT_PRESETS` entry, a `COMMERCE_SKILLS` pack in `site/pages/agent-admin-libraries.ts`, `site/lib/agent-manifest/shopkeeper.manifest.json`.

## Constraints and assumptions
- The default turn is 44,392 chars of a 46,430 K6 bound and the three default rows add 835: verified by `measure/probe.ts` output (`measure/probe.out.txt`), matching the handoff's 44,392 figure.
- One fragment per preset, no stacking: verified by `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts:399-402` (`resolveEffectiveCatalogId` derives one `<base>--<personaId>`).
- Derived catalogs retrieve no mini-skills or exemplars: verified by `packages/agent-ui/a2ui/src/agent/produce.ts:1061` (exact `catalogId` scope), `src/corpus/retrieve.ts:63`, and the Croupier fixture trace (`personas/croupier/__fixtures__/sonnet-blackjack-turn1.jsonl`, sections grammar/components/functions only, `exemplarIds: []`).
- Inheriting base mini-skills needs no budget re-base: verified by `src/live-agent/prompt-budget.test.ts:60-63,88-92` (the derived matrix already composes the base's worst mini-skills).
- OF2 forbids nothing about base inheritance: verified by `.claude/docs/spec/persona-catalog-composition.spec.md` section 5 OF2 (a sequencing ruling that mirrors `retrieve.ts`).
- A default row must be a real control with a descriptor: verified by `packages/agent-ui/a2ui/src/catalog/default/descriptor-agreement.test.ts` header and `default/index.test.ts` `EXCLUSION_ALLOWLIST` (ADR-0087, ADR-0225 precedent).
- A composite factory over existing controls is a sanctioned fragment shape: verified by `personas/concierge/factories.ts` (BookingForm composes `ui-form-provider`, `ui-select`, `ui-checkbox`, `ui-calendar`).
- The Croupier hand check inspects PlayingCard components, so CardTable needs a check arm: verified by `personas/croupier/checks.ts:24-95`.
- Only Button and Suggestions carry an `action` prop: verified by `default/catalog.json` (python scan) and `default/factories.ts:1404`.
- Evidence for every non-Croupier row is the idiom text, not a recorded surface: verified by the fixture inventory (only `personas/croupier/__fixtures__/` and `scripts/e2e-admin/fixtures/chat-surface-render.json`, a Quant button).
- T-0064's persona-seed format: unverified (`.sdlc/catalog-previews-all/` holds handoff and skips only, no plan).
- The agent-manifest test accepts a new folder named after the preset: unverified (`site/lib/agent-manifest/agent-manifest.test.ts` pins `localPatterns` to shipped folders; no evident extra rule).

## Rejected alternatives
- A shared opt-in `widgets` fragment for Tier 1: a preset selects one fragment, so Croupier and Concierge could never add it, and a derived catalog drops base idioms until W0.
- Fragment stacking (`agent-ui--croupier+widgets`): changes `derivedCatalogId`, the records bijection, the manifests and `resolveEffectiveCatalogId` for a problem three default rows solve inside budget.
- All twelve hypothesis widgets on the default catalog: 47,125 chars, over the K6 bound.
- MediaGallery and AvailabilityPicker now: Grid+Image and Swiper templates, RadioGroup and ChoiceGroup with disabled options already cover them; no preset repeats them per turn.
- Real `ui-*` controls for CardTable and QuestionCard: one preset each; a composite factory costs no descriptor, fleet gate or site page; promote on a second consumer (the PlayingCard route).
- Itinerary, CharacterSheet, CommitmentLedger, ExhibitCard, SwatchPalette as types: each is a ChildList template or a mode of another widget; the savings do not clear the admission test.

## Risks
- GameHud's structural gain is the smallest of the three (a Row template of Stat already works); its case is breadth (7 presets) and a data contract for checks. R1 decides its kill switch after the K6 re-measure.
- W0 changes what every derived turn is taught; the Croupier recorded fixtures and the ADR-0238 check must be replayed (`recorded-replay.test.ts`) before P1.
- The single-file registries (`catalog.json`, `selection.json`, the baseline, `agent-admin-presets.ts`, `agent-admin-libraries.ts`) make the children sequenced, not disjoint; concurrent rows children would conflict.
- If T-0064 lands a persona-seed format P1 and P2 do not match, their seeds move; if it never lands, the persona types have no preview gate.
- The idiom-text evidence could overstate the live composition for presets with no fixture; a persona eval run after R1 is the check.
- Each default row moves the byte-pinned baseline and the sidecar assets; a recapture done to get green rather than deliberately would hide a regression.

## Carry forward
- K6 today 44,392 chars (text 43,749 + tool 643), bound 46,430; three default rows +835 -> 45,227: `.sdlc/preset-widgets-design/measure/probe.out.txt`
- Per-row costs (row + clause): ProductCard 387, BoardGrid 202, GameHud 246, CardTable 352, QuestionCard 235; derived-id line 143: same file
- Fragment selection is one persona id per preset: `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts:399-402`
- Mini-skills scoped to the exact catalog id: `packages/agent-ui/a2ui/src/agent/produce.ts:1061`, `src/agent/mini-skills.ts:111`; exemplars: `src/corpus/retrieve.ts:63`
- Derived budget matrix already includes base mini-skills: `packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts:60-63,88-92`
- Croupier fixture turn 1 is 27 components (5 Row, 3 Card, 5 Text, 3 PlayingCard, 3 Button, 2 Badge): `packages/agent-ui/a2ui/src/catalog/personas/croupier/__fixtures__/haiku-4-5-blackjack-turn1.jsonl` (regex count of `"component":"X"`)
- Hand check inspects PlayingCard components and templates: `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:24-95`
- Action-bearing default rows are Button and Suggestions only: `packages/agent-ui/a2ui/src/catalog/default/catalog.json` (scan of `properties.action`), `default/factories.ts:1404`
- Children models allowed: `child | children | ChildList`: `packages/agent-ui/a2ui/src/catalog/catalog.ts:265`
- GH #144 cell-count failure note: `site/pages/agent-admin-presets.ts:604-607`
- Game and hospitality pack idiom texts: `site/pages/agent-admin-libraries.ts` (`GAMES_SKILLS`, `HOSPITALITY_SKILLS`, `GAMES_PLAYBOOKS`, `HOSPITALITY_PLAYBOOKS`)
- New persona folder checklist: `packages/agent-ui/a2ui/AGENTS.md` Catalogs section (records.ts, registry-wiring.test.ts, agent manifest writer)
- Next ADR number is 0243: `.claude/docs/adr/` ends at `0242-render-surface-terminal-tool-response-type.md`
- T-0064 has no plan yet: `/Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/catalog-previews-all/` (handoff.md, skips.md)
