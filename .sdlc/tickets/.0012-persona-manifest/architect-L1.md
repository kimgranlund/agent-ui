<!-- role=architect level=L1 model=fable effort=high -->
## Approach

The issue's "drift" is not a present disagreement. Today `localPatterns: 'croupier'` equals `CROUPIER_PERSONA_ID` equals `selection.json.personaId`, and the sidecar's type set equals the fragment's (selection-guidance leg 5 already holds that). #1794 touched only `site/pages/agent-admin-presets.ts` and `agent-admin.ts`; the croupier catalog folder was last touched by #1800. The real defect is structural: the four members of a persona (agent config, its `seedVersion`, the catalog fragment, the selection sidecar) share no pin, so a change to any one never forces a look at the others, and no existing gate moves on a persona fragment or sidecar edit (the prompt-equivalence baseline has no persona key). The design therefore gates "was every change acknowledged in one place", not "do the members agree right now".

The DAG decides the home. Two members live in `site/` and two in `a2ui`; `a2ui` cannot import `site` or `app`, while site tests already import a2ui's catalog exports under jsdom. So the manifest is consumer-owned: one `site/lib/persona-manifest/<id>.manifest.json` per `AGENT_PRESETS` entry (14) plus one for `fixture-demo` (`preset: null`, SPEC-N6 mechanism-only), a small module (`persona-manifest.ts`: the `PersonaManifest` type, the loader, a canonical sorted-key sha256 digest), one drift gate test, and one armed writer test in the `RECAPTURE_BASELINE=1` shape. The gate runs in the standing `vitest` site project (`npm test`), so no new gate command. Putting the manifest in the published a2ui persona folder was rejected: it would carry a consumer's `seedVersion` into the package and collide with the existing `PersonaCatalogManifest` (the Node-safe fragment triple), which stays untouched.

Two pin kinds, because `seedVersion` is a migration switch, not a content version: `presetStore` drops the user's persisted store when the preset's `seedVersion` exceeds the stored marker. The manifest therefore pins `seedVersion` (must equal the preset's) and separately pins a content digest per member: `seedDigest` over `personaFromPreset(preset)` (deterministic; `presetSeed` has no timestamps or random ids), `fragment.digest` over the parsed `catalog.json`, `selection.digest` over the parsed `selection.json`. A digest mismatch means "visit the manifest and run the writer"; whether to bump `seedVersion` stays the existing human law in the field's comment. The writer rewrites digests and derived facts (`fragment.types`, `targetCatalogs`) only, never identity, `seedVersion`, or a `why`.

The gate's legs: bijection `AGENT_PRESETS` ids to manifests with a preset; identity chain (`manifest.personaId` = `preset.localPatterns` = fragment `manifest.ts` personaId = `selection.json.personaId` = folder name); `seedVersion` pin; three digests; `fragment.types` = `Object.keys(catalog.json.components)`; `SHIPPED_PERSONA_CATALOGS` ids = `SHIPPED_PERSONA_CATALOG_MANIFESTS` ids = manifests with a fragment (today ungated); a `localPatterns` that names no shipped fragment reds (today it silently reads as "none"). Each leg has a planted-defect negative control. The five fragmentless presets declare `fragment: null` with a `noFragment.why`, making the no-fragment decision explicit and reviewed. On that decision: every idiom type those five teach (Stat, SwiperItem, Tab, Avatar, Swatch, Ramp, RadioGroup, Disclosure) is already in `default/catalog.json`, so none earns a fragment under ADR-0172's promotion rule (a type is promoted only when it closes an idiom prose cannot validate; croupier's `index.ts` header is the worked ruling). Recommend no new fragments in this ticket; any later candidate is its own ADR-0172 intake.

Records: one proposed ADR (amends ADR-0172 cl.1 and ADR-0232 cl.4, never self-ratified), a new SPEC-R7 in `persona-catalog-composition.spec.md`, pointer sentences in `a2ui/AGENTS.md`, rubric `a2ui-catalog.md` D7 and the `agent-model.md` glossary ("persona manifest" vs "fragment manifest"), and the two field comments in `agent-admin-presets.ts`. The #1814 overlap is docs only: `a2ui/AGENTS.md` and the persona-composition SPEC are in #1814's plan, so those two leaves rebase after #1814 (and `a2ui/AGENTS.md` after T-0005 per the rollout table); no code file here is in #1814's scope.

## Interfaces

- New `site/lib/persona-manifest/persona-manifest.ts`: `interface PersonaManifest { personaId: string; preset: string | null; seedVersion: number | null; seedDigest: string | null; fragment: { types: string[]; targetCatalogs: string[]; digest: string } | null; selection: { digest: string } | null; noFragment?: { why: string } }`; `readPersonaManifests(): PersonaManifest[]`; `canonicalDigest(value: unknown): string` (sorted-key JSON, `sha256:` prefix, `node:crypto`); `seedDigest(preset: AgentPreset): string` over `personaFromPreset(preset)`; path constants resolved from `process.cwd()` (TKT-0044 rule) for `packages/agent-ui/a2ui/src/catalog/personas/<id>/{catalog,selection}.json`.
- New `site/lib/persona-manifest/<id>.manifest.json` x15: croupier, quant, concierge, restaurant, travel, curator, stylist, quizmaster, mentalist, negotiator, lexicographer, admiral, alchemist, dungeon-master, fixture-demo. `preset: null` only for fixture-demo; `fragment: null` + `noFragment.why` for quant, restaurant, travel, curator, stylist and the seven game/showcase presets without a fragment.
- New `site/lib/persona-manifest/persona-manifest.test.ts` (the gate; runs in the `site` vitest project, `vitest.config.ts:43`) and `persona-manifest.write.test.ts` (armed by `PERSONA_MANIFEST_WRITE=1`, skipped otherwise, writes digests and derived facts only).
- Changed `site/pages/agent-admin-presets.ts`: comment-only repair on `localPatterns` (`:119-124`, "Not validated against SHIPPED_PERSONA_CATALOGS here" becomes a pointer to the gate) and `seedVersion` (`:93-96`, names the manifest pin). No runtime change.
- New `.claude/docs/adr/<next>-persona-manifest-drift-gate.md`, status proposed (number verified at build; 0233 is claimed by #1814 and not yet on disk).
- Changed `.claude/docs/spec/persona-catalog-composition.spec.md` (SPEC-R7 + dated version bump), `packages/agent-ui/a2ui/AGENTS.md`, `.claude/docs/rubrics/a2ui-catalog.md` D7, `.claude/docs/references/agent-model.md` glossary.
- Untouched: `PersonaCatalogManifest` (`compose.ts:240`), `manifest.ts` per persona, `selection-guidance.ts` `PERSONA_IDS`, `fs-shim-content.ts`, any a2ui runtime code.

## Constraints and assumptions

- The issue's Croupier drift is a missing pin, not a present mismatch: verified by `git log` (`5b8308d7` touched presets + agent-admin only; croupier catalog dir last touched by `00b63d05`) and by reading `presets.ts:148`, `croupier/manifest.ts:13`, `croupier/selection.json:2`.
- `a2ui` may not import `site`/`app`; `site` may import a2ui: verified by CLAUDE.md DAG and `agent-admin-local-patterns.test.ts:15` importing `SHIPPED_PERSONA_CATALOGS` from `@agent-ui/a2ui`.
- Both persona lists are reachable from the a2ui root: verified `a2ui/src/index.ts:4` re-exports `catalog/index.ts`, which exports both at `:40` and `:45`.
- Site tests run in `npm test` with `process.cwd()` at repo root: verified `vitest.config.ts:43` (`site/**/*.test.ts`) and the `readFileSync(process.cwd()...)` precedent at `site/pages/a2a-tic-tac-toe.live.test.ts:14`.
- `seedVersion` is a migration switch that wipes the persisted store on bump: verified `agent-admin-presets.ts:791-797`.
- `presetSeed`/`personaFromPreset` are deterministic (no `Date.now`, `Math.random`, `randomUUID`, `modifiedAt`, `createdAt`): verified by grep over `agent-admin-presets.ts:678-757`.
- No baseline covers a persona sidecar or fragment edit: verified by `node -e` listing `prompt-equivalence.baseline.json` keys (default, defaultExplicit, specific, blueSky, miniSkills, genuiPacks, genuiDogfoodTeaching).
- The five fragmentless personas' idioms use default-catalog types only: verified by `node -e` membership check against `default/catalog.json` (Swatch, Ramp, Stat, SwiperItem, Tab, Avatar, RadioGroup, Disclosure all true).
- `BUILDER_PRESET` (`agent-admin-presets.ts:922`) is out of the bijection: not in `AGENT_PRESETS`, no `localPatterns`; the gate iterates `AGENT_PRESETS`: verified by reading `:922-1040`.
- No test holds `SHIPPED_PERSONA_CATALOGS` ids equal to `SHIPPED_PERSONA_CATALOG_MANIFESTS` ids: verified by `grep -rn SHIPPED_PERSONA_CATALOG_MANIFESTS packages/agent-ui/a2ui/src --include='*.test.ts'` (only `selection-guidance.test.ts`).
- #1814 overlap is docs only (`a2ui/AGENTS.md`, persona-composition SPEC): verified by grep over `.sdlc/work/no-barrels/planner-L3-4.md:135,172,202,235` and its guard regex.
- Next ADR number is 0234: unverified (0233 not yet on disk; verify at build).
- A canonical-JSON digest is formatting-insensitive for the JSON members: unverified (the module's unit test proves it).

## Rejected alternatives

- Manifest inside `packages/agent-ui/a2ui/src/catalog/personas/<id>/`: the package would ship a consumer's `seedVersion`, and the name collides with `PersonaCatalogManifest` (`compose.ts:240`).
- Extending `PersonaCatalogManifest` with `seedVersion`/`preset`: same ownership inversion; the Worker-safe triple stays what it is.
- Version-only pin (no digests): a sidecar or fragment edit would red nothing, which is exactly today's gap; kept as the fallback arm of fork 1.
- Forcing a `seedVersion` bump on any digest change: wipes user edits for a sidecar wording change; the bump stays a human decision.
- Generating the manifest from its sources on every test run: a generated file follows drift instead of catching it; only the armed writer writes.
- Folding into the #1807 registry or #1808 asset discovery: #1812 is a hand-authored per-persona pin a registry may later consume; it pins neither `factories.ts` nor controls (#1814's `PersonaCatalogPackage.controls` owns that).
- Shipping fragments for Quant, Curator, Stylist, Maitre d', Travel Agent: every idiom they teach already names default-catalog types; ADR-0172's promotion rule is not met.
- Byte digests of the JSON files: a reformat would red the gate; digest the parsed canonical document instead.

## Risks

- Library-pack coupling: `resources: seedFrom(GAMES_RULES)` (croupier) and the pack-seeded hospitality skills mean one text edit in `agent-admin-libraries.ts` moves several presets' digests at once. Correct, but surprising; the fix is run the writer, then decide per preset whether `seedVersion` bumps.
- If Kim prefers version-only pins, the gate stops biting on sidecar and fragment edits, and ADR-0232's "every sidecar edit is a deliberate prompt change" stays unenforced for personas.
- If `personaFromPreset` later gains a nondeterministic field, the gate flaps; the module's determinism unit test is the tripwire.
- If #1807's registry later wants the manifest inside the package, the site-side home moves; the schema is the stable part, the path is not.
- Doc leaves (`a2ui/AGENTS.md`, SPEC) conflict with #1814 and T-0005 if built before they merge; plan them last.

## Carry forward

- Manifest: `.sdlc/0012-persona-manifest/decompose/manifest-v1.json` (technical-architecture · plan), coverage_check clean, exit 0; report at `decompose/report.md`; handoff.md untouched.
- Quadrant: load-bearing; 11 nodes, 20 actions, 29 hosts, 4 edges.
- Only two presets carry `localPatterns`: `site/pages/agent-admin-presets.ts:148` (croupier) and `:272` (concierge); grep `localPatterns:` over that file.
- Croupier `seedVersion: 6` at `presets.ts:144`; concierge `seedVersion: 7` at `:260`.
- `presetStore` migration drops the store when `persisted < wanted`: `presets.ts:793-796`.
- `personaFromPreset` is the digest input: `presets.ts:741-750`; `presetSeed` body `:678-740`, no nondeterminism.
- The 14 roster ids, in order: croupier, quant, concierge, restaurant, travel, curator, stylist, quizmaster, mentalist, negotiator, lexicographer, admiral, alchemist, dungeon-master (grep `^    id: '` over `presets.ts:140-677`); builder is separate at `:922`.
- Shipped fragments: `a2ui/src/catalog/personas/{fixture-demo,concierge,croupier}/manifest.ts`; lists at `personas/manifests.ts:16` and `personas/index.ts:14`.
- Loader hard-codes `PERSONA_IDS` at `a2ui/src/agent/selection-guidance.ts:178`; held equal to manifests by `catalog/selection-guidance.test.ts` leg 5.
- Worker mirror of sidecars: `a2ui/tools/agent/worker/fs-shim-content.ts:117-121`, gated by `fs-shim.test.ts:116`.
- `sanitizeLocalPatterns` fail-closed read: `app/src/controls/agent-admin/agent-admin-schema.ts:364`.
- Armed-writer precedent: `a2ui/src/live-agent/recapture-baseline.test.ts:27` (`RECAPTURE_BASELINE=1`).
- Baseline keys hold no persona entry: `node -e` over `prompt-equivalence.baseline.json`.
- Site test project glob `site/**/*.test.ts`: `vitest.config.ts:43`; non-page modules live under `site/lib/`.
- ADR-0172 promotion rule home: `.claude/docs/adr/0172-persona-catalog-composition-intake.md` Decision §1; worked ruling `catalog/personas/croupier/index.ts:1-5`.
