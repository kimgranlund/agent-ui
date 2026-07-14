# ADR-0135 — The agent harness's config unifies on a hoisted SettingsSchema and its prompt text moves into files: three intertwined pieces, one change

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-14
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-14 |
> | **Proposed by** | design intake (`system-decompose` both planes — [`decompositions/agent-harness-config-and-prompt-files.decomp.json`](../decompositions/agent-harness-config-and-prompt-files.decomp.json), `coverage_check.py` clean at exit 0, `--strict` clean: 17 nodes / 19 actions / 19 hosts / 16 edges), directed by Kim: hoist `SettingsSchema`'s pure types to `@agent-ui/shared`, make A2UI Chat's config a real `SettingsSchema` instance, and break the hardcoded system-prompt / mini-skill text out into files. |
> | **Ratified by** | _(unfilled — this is a `proposed` intake ADR; no self-ratification)_ |
> | **Repairs** | none yet — an intake ADR; a build phase (separately dispatched) realizes it. No SPEC/LLD earned: this is a refactor + one additive config path across existing modules, not a new family. |
> | **Supersedes / Superseded by** | Relates [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) / [ADR-0131](./0131-agent-admin-ui-scope-and-composition.md) (the app-side `SettingsSchema` consumer this hoist serves), [ADR-0090](./0090-a2ui-gen-ui-mode-axis.md) / [ADR-0091](./0091-a2ui-gen-ui-mini-skill-registry.md) / [ADR-0097](./0097-a2ui-feed-embedded-asks.md) / [ADR-0103](./0103-radio-group-owns-layout-form-provider-teaches-wrap.md) / [ADR-0126](./0126-a2ui-message-lifecycle-decision-layer.md) (the prompt behaviors whose text Piece C externalizes), [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (the `providers.json` registry Piece B's model list reuses), and [ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md) (the pure-core / Node-shell split Piece B's schema builder follows). Nothing superseded. |

## Context

Three asks, directed together by Kim, that compose into one directed change — a config layer and the
content its knobs point at:

1. **`SettingsSchema`'s pure types are stuck in `@agent-ui/app`.**
   `app/src/controls/settings/schema.ts` defines BOTH the zero-dependency schema TYPES
   (`SettingsFieldType`, `SettingsFieldValidation`, `SettingsFieldOption`, `SettingsField`,
   `SettingsSection`, `SettingsSchema`) AND a DOM/`@agent-ui/components`-coupled control-registry half
   (`RegisteredControl`/`ControlFactory`/`FIELD_CONTROL_REGISTRY`, which imports `FORM_CONNECT_EVENT`/
   `UIFormElement` and registers real elements). Anything below `app` in the DAG that wants to describe
   a config as a schema can't — the type lives at the top of the dependency graph. `@agent-ui/shared`
   (zero-dep, bottom of the DAG) already anticipates this: `src/index.ts`'s comment says it is
   "consumed by `@agent-ui/components` and (future) `@agent-ui/a2ui`."

2. **A2UI Chat's live-agent config is scattered across loose params + a JSON file.** The `produce()`
   loop's tuning knobs — `mode` (`GenUiMode`), `model` (resolved against `providers.json`), `k`
   (retrieval top-k), `maxRounds`, and the mini-skill cap (today a hardcoded module constant,
   `DEFAULT_MINI_SKILL_CAP`, threaded positionally into `selectMiniSkills`, not a `ProduceOptions`
   field at all) — have no single, described, validatable shape. The app side just grew exactly the
   right vocabulary for this (`defaultAgentConfigSchema` + `initialValuesFor` + the fail-closed
   `sanitizeNumber`/`sanitizeSelect` guards, ADR-0131/0132), but it lives one layer too high for the
   a2ui tooling to reuse.

3. **`system-prompt.ts` and `mini-skills.ts` hardcode large prompt strings inline.**
   `system-prompt.ts` (385 lines) carries ~9 large template-literal constants (`GRAMMAR`,
   `HONESTY_FLOOR`, the four `CLARIFY_*`/`NEGOTIATE_*`, the two `ASK_ARCHETYPES_*`) plus ~60 lines of
   ADR-narrative header comments; `mini-skills.ts` hardcodes a 6-entry `MINI_SKILLS` registry as inline
   object literals. This is prompt CONTENT living as TypeScript source — hard to read, diff, and edit as
   prose.

The `system-decompose` intake ran both planes (outside-in structure × inside-out capability) and
cross-checked them clean; the manifest hosts every capability the three pieces need and every module it
introduces. The pieces are **one directed change**, not three forks: Piece A is the config layer,
Piece B is its first below-`app` consumer, Piece C is the content those config-selected knobs point at.

## Decision

**Adopt all three as one change. Do NOT implement here — a build phase (separately dispatched) realizes
it once this ADR is ratified.**

### Piece A — hoist the pure `SettingsSchema` layer to `@agent-ui/shared`

1. **New module `packages/agent-ui/shared/src/settings-schema.ts`** holds the six pure types verbatim.
   `@agent-ui/shared`'s `.` barrel (`src/index.ts`) re-exports them —
   `export type * from './settings-schema.ts'` — the FIRST TypeScript export from `shared`'s `.`
   surface (today `export {}`). No new `package.json` subpath: `.` already maps to `index.ts`, and one
   type module does not earn a `@agent-ui/shared/settings-schema` subpath yet (a reversible call — a
   subpath is a later split if the barrel grows into a grab-bag).
2. **`app/.../settings/schema.ts` keeps ONLY the DOM/components-coupled registry half.** It imports the
   type from `@agent-ui/shared` for its own use AND **re-exports it**
   (`export type { … } from '@agent-ui/shared'`) so every existing app-side consumer (`settings.ts`,
   `generate.ts`, `validate.ts`, `agent-admin-schema.ts`) keeps its current import path and stays
   byte-unchanged. Minimally invasive: no consumer edit, no registry move.
3. **The guards move too (Fork 2, below).** The pure, DOM-free schema helpers currently in
   `agent-admin-schema.ts` — `findField`, `initialValuesFor`, `sanitizeNumber`, `sanitizeSelect` — join
   the hoisted module, so the fail-closed idiom has exactly ONE implementation shared by app and a2ui.
   `agent-admin-schema.ts` re-imports + re-exports them, keeping `agent-admin.ts` unchanged.

### Piece B — A2UI Chat's config becomes a real `SettingsSchema` instance

4. **New `packages/agent-ui/a2ui/tools/agent/agent-config-schema.ts`** exports
   `liveAgentConfigSchema(providers: ProvidersConfig): SettingsSchema` — a schema BUILDER, not a bare
   constant. Fields: `mode` (select, options from `GEN_UI_MODES`, default `DEFAULT_GEN_UI_MODE`),
   `model` (select, **options projected from the passed `ProvidersConfig`'s implemented providers'
   models** — see Fork 1), `k` (number, default 3, min 1), `maxRounds` (number, default 3, min 1),
   `miniSkillCap` (number, default `DEFAULT_MINI_SKILL_CAP` = 3, min 0). It mirrors
   `defaultAgentConfigSchema`'s shape and spirit (fail-closed, `initialValuesFor`-seedable) but sources
   the model list from the real registry rather than hardcoding it (`agent-admin-schema.ts` hardcodes
   `SUPPORTED_MODELS` precisely because it has NO `providers.json` — the a2ui tooling does).
5. **The type import is `import type` only** — `@agent-ui/shared` sits below `a2ui` in the DAG
   (`shared ← components ← a2ui`), and a type-only import erases at build, so no runtime cross-package
   coupling and no browser-bundle concern (this code is Node-only tooling, never in the static site
   build — SPEC-R3/N2). _Build note: confirm `@agent-ui/a2ui`'s `package.json` lists `@agent-ui/shared`
   so the type resolves; add it if absent._
6. **A resolver `resolveProduceOptions(read, schema): ProduceOptions`** (same file) reads a
   `SettingsStore`-shaped source live at call time and returns the `ProduceOptions` shape `produce()`
   already expects, fail-closed on a bad stored value via the SHARED `sanitizeNumber`/`sanitizeSelect`
   guards (Piece A cl.3) — the exact idiom `agent-admin.ts`'s `#handleSubmit` uses, now with one
   implementation instead of a re-invented second one.
7. **`produce()` stays backward-compatible.** Its signature is unchanged; `ProduceOptions` gains ONE
   additive optional field, `miniSkillCap?: number`, and the `selectMiniSkills` call reads
   `opts.miniSkillCap ?? DEFAULT_MINI_SKILL_CAP` — an absent field reproduces today's behavior
   byte-for-byte (the same zero-regression discipline `mode`/`k` already prove). The schema + resolver
   sit ALONGSIDE `ProduceOptions` as an alternate config-collection path, not a replacement. **Wiring a
   `ui-settings` UI (or the dev proxy) to this schema is OUT OF SCOPE** — a separate, optional follow-up
   Kim named explicitly.

### Piece C — break the prompt text into files under `tools/agent/prompts/`

8. **`GRAMMAR` moves to ONE file, `prompts/grammar.md`, loaded whole.** The slice-based derivation
   (`INTRO_AND_NOTE`/`OUTPUT_RULES` via `GRAMMAR.indexOf(marker)`) applies to the LOADED string,
   unchanged, and `assertMarkersHold()` still runs at module load. GRAMMAR is **never** split into
   pre-sliced fragment files and reconstructed by concatenation — that would reintroduce exactly the
   byte-identity risk ADR-0090 §1 eliminated ("by construction, never by re-transcription"). The
   `'default'`/absent-mode composition returns the loaded GRAMMAR whole, byte-identical as before.
9. **The six standalone consts each become their own file** (`prompts/honesty-floor.md`,
   `clarify-specific.md`, `negotiate-specific.md`, `ask-archetypes-specific.md`, `clarify-blue-sky.md`,
   `ask-archetypes-blue-sky.md`) — no slicing relationship, clean 1:1 extraction.
10. **`NEGOTIATE_BLUE_SKY` keeps its dynamic tail in code.** Its file, `prompts/negotiate-blue-sky.md`,
    holds the static prose through the `Calibration examples (…):` header line; the dynamic bullets —
    computed from `MINI_SKILLS` via `calibrationExampleBullet` — are **appended in code** after load
    (`loaded + '\n' + BLUE_SKY_CALIBRATION_IDS.map(calibrationExampleBullet).join('\n')`). Chosen over a
    mid-file `{{placeholder}}` because the dynamic block is strictly TRAILING today, so an append is the
    minimal mechanism and keeps the `MINI_SKILLS` dependency visible in code. _If a future edit needs
    prose AFTER the examples, switch to a placeholder marker then, not now._
11. **The mini-skill registry becomes six frontmatter files** under `prompts/mini-skills/`
    (`card-game-sheet.md`, `settings-screen.md`, `dashboard-kpi-grid.md`, `login-form.md`,
    `master-detail-split.md`, `form-rhythm.md`), each `---\nid: …\ntriggers: …\n---` frontmatter + a
    markdown body — this repo's own `.claude/skills/*/SKILL.md` shape as a reference, simplified to just
    `id`+`triggers` (both single-line) with `body` as the content below. `mini-skills.ts` loads the
    directory and parses each into a `MiniSkill`; `selectMiniSkills` and the `PER_MODULE_TOKEN_BUDGET`
    test are unchanged.
12. **A minimal frontmatter parser, `prompts/frontmatter.ts`.** No reusable general-purpose parser
    exists in-repo (confirmed — `rescore.ts`'s `readRubricVersion` is a single-line `version:` regex,
    not a parser). The new one splits the leading `---`…`---` block into single-line `key: value` pairs
    and returns `{ data, body }`; no YAML nesting is needed (values are single-line). Node-tooling-local.
13. **Loading mechanism:** `readFileSync(new URL('./prompts/…', import.meta.url), 'utf8')`, synchronous,
    at module load. This resolves relative to the module and is cwd-independent — deliberately DIFFERENT
    from `dev-proxy-plugin.ts`'s `process.cwd()`-based paths, because the proxy is Vite-bundled into a
    temp file (so `import.meta.url` is unreliable there) whereas `system-prompt.ts`/`mini-skills.ts` are
    NOT bundled that way; they run under the proxy and under vitest, where `import.meta.url` resolution
    is correct and portable. No Vite `publicDir` dual-copy workaround is needed — this code never reaches
    a browser bundle.
14. **The ADR-narrative header condenses to a short index** — one line per ADR
    (0071/0088/0089/0090/0091/0097/0103/0126) naming what it added and which file the text now lives in.
    (Kim chose "condense to a short index" over "strip" or "leave as-is".)

### Verification (holds across all three pieces)

15. **An equivalence gate** asserts the default/absent-mode prompt AND every loaded `MINI_SKILLS` body
    is byte-identical to the pre-refactor source — GRAMMAR's byte-identity guarantee, generalized to the
    file-loaded content. **`prompt-drift.test.ts` stays green and unmodified**: neither Piece B nor Piece
    C changes `buildSystemPrompt`'s signature, so its catalog-derived SET-EQUAL assertions (orthogonal to
    all GRAMMAR/CLARIFY prose) are untouched.

## Forks ruled (recommended; none self-ratified)

1. **The `model` field's option source (Piece B).** RECOMMEND: derive the options from the parsed
   `providers.json` (`ProvidersConfig`) via a schema-builder function — `providers.json` is the single
   source of truth for models (SPEC-R11/R12), and `validateProvidersConfig`/`resolvePair` already own
   its validation; the schema only PROJECTS the implemented providers' models into
   `SettingsFieldOption[]`. Rejected: a hardcoded `SUPPORTED_MODELS`-style constant in the schema — that
   is the "two parallel model-list mechanisms" the brief warns against, and drifts from the registry the
   proxy actually allowlists against.
2. **Where the fail-closed guards live (Piece B resolver).** RECOMMEND: **hoist** `sanitizeNumber`/
   `sanitizeSelect`/`findField`/`initialValuesFor` into the shared module (Piece A cl.3) so both app and
   a2ui consume one implementation. This is the truest reading of "don't invent a second validation
   idiom": `a2ui` **cannot** import `@agent-ui/app` (app is downstream in the DAG), so the only ways to
   honor that constraint are hoist-and-share or reimplement-locally. The guards are pure and zero-dep —
   they belong in `shared` exactly like the types. This **expands Piece A's hoist surface** beyond the
   brief's "only the pure types" wording (it also touches `agent-admin-schema.ts`), which is why it is a
   ruled fork, not a silent choice. FALLBACK (if the hoist is unwanted): reimplement the same-shaped
   guards locally in `agent-config-schema.ts` — accepted small duplication, Piece A stays exactly as
   briefed.
3. **`NEGOTIATE_BLUE_SKY`'s dynamic middle (Piece C cl.10).** RECOMMEND: trailing append in code
   (static prose in the file, bullets appended after load). Rejected for now: a mid-file `{{placeholder}}`
   substitution — unnecessary machinery while the dynamic block is strictly trailing.

## Consequences

- **`@agent-ui/shared` gains its first TypeScript export** — a small, deliberate widening of the DAG's
  bottom layer, exactly as `src/index.ts` already anticipated. Every future below-`app` config-as-schema
  consumer now has a home for the type.
- **The fail-closed guard idiom collapses to one implementation** (under Fork 2's recommendation),
  removing the app/a2ui duplication a layer boundary would otherwise force.
- **`produce()`'s config surface grows by one optional field** and gains an alternate schema-driven
  collection path, with zero behavior change when the new knobs are absent — the mini-skill cap becomes
  a real, tunable knob for the first time.
- **The prompt text becomes editable as prose** — nine constants + a 6-entry registry move out of TS
  source into readable, diffable `.md` files, with a byte-identity gate holding the `'default'`-mode
  contract ADR-0090 established.
- **A new (small) load-time filesystem dependency** enters `system-prompt.ts`/`mini-skills.ts`. It is
  safe: these modules are Node-only tooling, never bundled to a browser (SPEC-R3/N2), and the reads are
  synchronous at module load — the same lifecycle position `assertMarkersHold()` already occupies.
- **Build-time checks to confirm** (flagged, not blocking): `@agent-ui/a2ui`'s `package.json` lists
  `@agent-ui/shared`; `@agent-ui/app`'s lists it too (it already depends on shared per CLAUDE.md); the
  prompt-file reads resolve under both the dev proxy and vitest.

## Acceptance

This is an **intake** ADR — realized in a separately-dispatched build, same shape as ADR-0131/0132:

- **Intake (this change):** `system-decompose` both planes done (coverage clean, exit 0, `--strict`
  clean); three forks ruled; the decomposition manifest written; no code changes.
- **Build (separate):** Piece A (the shared module + barrel + app re-exports + guard hoist), Piece B
  (the schema builder + resolver + the `miniSkillCap` `ProduceOptions` field), and Piece C (the
  `prompts/` files + the frontmatter parser + the load/slice/compose rewire + the condensed header),
  each to the fleet's per-module DoD; the equivalence gate + `prompt-drift.test.ts` green; independently
  reviewed (generator ≠ critic, the ADR-0131 precedent); `npm run check && npm test` green.

## Alternatives considered

- **Do the three pieces as separate ADRs.** Rejected: they are one directed change — B consumes A, C is
  the content B's knobs select. Splitting them would fragment a single ratifiable decision.
- **Leave `SettingsSchema` in `app` and duplicate the type into a2ui.** Rejected: two definitions of the
  same config vocabulary drift; the type is already zero-dep and `shared` already expects it.
- **Hardcode the a2ui model list** (Fork 1's alternative). Rejected: duplicates `providers.json`, the
  registry the proxy actually enforces — the exact drift that produced the historical Haiku-4.5 menu/proxy
  mismatch.
- **Pre-slice GRAMMAR into fragment files and concatenate** (Piece C alternative). Rejected outright:
  reintroduces the byte-identity-by-re-transcription risk ADR-0090 §1 was built to eliminate.
- **Change `produce()`'s signature to take the schema/store directly.** Rejected: needlessly invasive;
  an additive `ProduceOptions` field + a resolver that returns the existing shape keeps every current
  caller working.
