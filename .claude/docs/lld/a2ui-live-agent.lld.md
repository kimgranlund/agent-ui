# LLD — A2UI Live-Agent Example (skeleton)

> Status: accepted + REALIZED · v0.4 · 2026-07-04 (ratified) · realized 2026-07-05 · ADR-0088 (note/trace/routing channel) folded 2026-07-07 · ADR-0089 (two GRAMMAR-half ASK behaviors) folded 2026-07-07 · ADR-0090 (the Gen-UI `mode` axis + Structural named as the recorded-transport pattern) folded 2026-07-07 · ADR-0091 (the mini-skill registry — a THIRD `buildSystemPrompt` segment, hand-curated + selected once per turn beside `retrieve()`) folded 2026-07-07 · ADR-0097 (feed-embedded interactive asks) folded 2026-07-07 · ADR-0137 (the producer toolkit exported as `@agent-ui/a2ui/agent`; the portable core relocated `tools/agent/` → `src/agent/`, the dev-proxy/key/registry shell stays behind — §0/§2 repaired) folded 2026-07-16 · Layer: LLD (implementation plan)
> Implements: [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) (SPEC-R1..R15, SPEC-N1..N5), targeting A2UI **v1.0**.
> Realizes concretely: [`./a2ui-streaming-pipeline.lld.md`](./a2ui-streaming-pipeline.lld.md) **LLD-C2** (the `produce()` generation driver — the "blocked by the live-agent wave" note resolves here) — the loop CONTRACT stays [`./a2ui-harness-wiring.lld.md`](./a2ui-harness-wiring.lld.md) §6.
> Decisions: **ADR-0069** (demo shape + the `AgentTransport` seam + the `VITE_` build-key-safety invariant) · **ADR-0070** (runtime loop scope) · **ADR-0071** (derived prompt) · **ADR-0072** (session model) · **ADR-0073** (the model-provider seam) · **ADR-0088** (the note meta-line + `TurnTrace` + `wantResponse`-routed click→turn — accepted, ratified 2026-07-07) · **ADR-0089** (two hand-authored GRAMMAR-half ASK behaviors riding ADR-0088's note-only turn — clarify-when-underdetermined + catalog-boundary negotiated approximation; NO new wire surface — built + reviewed GO 2026-07-07, ratification marker pending) · **ADR-0090** (a per-turn `GenUiMode` — `default`/`specific`/`blue-sky` — that SCALES ADR-0089's clarify/negotiate grammar directive↔exploratory, a mode-INVARIANT honesty floor, and Structural named as the already-shipped recorded transport; NO new wire/transport/protocol surface — built 2026-07-07, ratification marker pending) · **ADR-0091** (the mini-skill registry — a small, hand-curated `MiniSkill[]` registry of catalog-composition idioms, selected once per turn beside `retrieve()` by a cheap TF-IDF/cosine intent-match reusing `retrieve()`'s tokenizer/cosine primitives (extracted to `src/corpus/text-similarity.ts`), composed into `buildSystemPrompt` as a THIRD, `fewShot`-structural-twin segment that degrades to `''` on no match, capped so the prompt grows by at most `cap × budget` regardless of registry size; NO new wire/transport/protocol surface — built 2026-07-07, an independent post-ship review caught + the build fixed a real double-injection defect (§4 below), ratification marker pending) · **ADR-0097** (feed-embedded interactive asks — the ADR-0089 ASK gains a structured, feed-embedded surface form: an additive `ask` field on the ADR-0088 meta envelope, a page-level per-ask `createRenderer()`-host lifecycle (`pending → frozen(answered|bypassed)`), and a gate-encoded feed sub-catalog partition (`FEED_SURFACE_TYPES`/`FEED_EXCLUDED`, the ADR-0087 lesson reapplied to a policy subset); NO renderer/package/transport-signature change — built 2026-07-07, ratification marker pending). ADR-0069–0088 accepted.
> Reuses without redesign: the renderer host (`renderer/renderer.ts` — `createRenderer`), the shared `heal`+`validateA2ui`, `retrieve()`, the default catalog, the seed shelf. No fork (SPEC-N3 parity).
> Altitude: adds the **how** — the module map, the deterministic-backbone contract, the round-trip state machine; cites `SPEC-R*`. All C1–C14 bodies are now REALIZED (§1 State column; decomp `a2ui-live-agent.decomp.json`, nodes l7–l19; LLD-C13/C14 are post-decomp additions, ADR-0091/ADR-0097, no decomp node yet — ADR-0097's own build decomp is `feed-embedded-asks.decomp.json`). The tree is the ground truth — `git log -- packages/agent-ui/a2ui/tools/agent/ site/pages/a2ui-live.*` + the co-located `pkg/src/live-agent/*.test.ts`; when this doc disagrees, the tree wins.

---

## 0. Placement law (the one that keeps SPEC-N1 true)

**ADR-0137 (TKT-0072, folded 2026-07-16) split this law in two.** The genuinely portable PRODUCER core is
now a real package export — `@agent-ui/a2ui/agent` → `src/agent/` — so it enters the real typecheck/test
include; only the key-holding/dev-proxy/provider-registry SHELL stays site/tools-scoped. The package's
public surface is now `.` / `./examples` / `./corpus` / `./agent`. Everything live/keyed/networked still
lives OUTSIDE the renderer-facing surfaces; the split mirrors ADR-0062's pure-core/Node-shell discipline,
with the producer toolkit added as a FOURTH subpath (the ADR-0119 opt-in-pack law):

- **`site/`** — the page + the browser-side UI (the switcher) + the browser transports (they run in the
  browser; no key, no `fs`). Covered by `check:site` (site tsconfig `include: site/**`); NOT by vitest.
  It imports the pack's BROWSER-SAFE seam modules (`src/agent/{agent-transport,session,meta-line,
  feed-catalog,recorded-transport,gen-ui-mode}.ts`) via `site/lib/agent-runtime.ts` — never the whole
  `@agent-ui/a2ui/agent` barrel, which is NODE-FIRST (it `export *`s the two `fs`-loading modules; the
  barrel is the SERVER-SIDE consumer's entry, ADR-0137 clause 4).
- **`packages/agent-ui/a2ui/src/agent/`** — the EXPORTED producer toolkit (`@agent-ui/a2ui/agent`,
  ADR-0137): the loop driver (`produce.ts`), the derived prompt (`system-prompt.ts` + `prompts/`), the
  transport/session seam (`agent-transport.ts`/`session.ts`), the meta-line envelope (`meta-line.ts`),
  the `GenUiMode` axis (`gen-ui-mode.ts`), the mini-skill registry (`mini-skills.ts`), the feed sub-catalog
  (`feed-catalog.ts`), the recorded backbone + transcript TYPES (`recorded-transport.ts`), and the
  hand-rolled Anthropic adapter (`providers/anthropic.ts`). NOW in the real `tsc`+vitest include
  (`packages/agent-ui/*/src`), typechecked DIRECTLY. Zero third-party deps, plain `fetch`, no LLM SDK;
  NODE-FIRST — `node:fs` appears in EXACTLY `system-prompt.ts`/`mini-skills.ts` (the ADR-0135 prompt
  loading), nowhere else. The root `.` barrel does NOT re-export it (identity gate — a renderer-only
  consumer bundles zero producer bytes).
- **`packages/agent-ui/a2ui/tools/agent/`** — the site/tools-scoped SHELL that stays behind (ADR-0137
  clause 3): the dev-proxy plugin (`dev-proxy-plugin.ts` — Vite middleware, `vite`+`node:http`, the local
  key-holder), the provider registry + switcher config (`providers.json`/`providers-config.ts`/
  `providers/{index,openai,gemini}.ts`), the ADR-0135 site-config builder (`agent-config-schema.ts`), and
  the DEMO fixtures (`transcript.ts`/`structural-transcript.ts`). Node-type-stripped `.ts`, zero
  third-party deps, plain `fetch`. **NOT in any tsconfig `include`, so typechecked ONLY transitively (when
  a src test imports them) and run via `node --experimental-strip-types` — see §2's discovery table.**
- **`packages/agent-ui/a2ui/src/live-agent/`** — the STANDING TESTS (round-trip · prompt-drift ·
  stub-provider loop · providers.json shape · build-key-safety source-grep · the ADR-0137 `src/agent/`
  gates in `src/agent/gates.test.ts`). This IS the vitest+tsc include
  (`packages/agent-ui/*/src/**/*.test.ts`), so these run in `npm test` and typecheck in `npm run check`;
  for the shell modules they reach out into `../../tools/agent` (the site-canon reach-out — a src TEST
  importing a tools module, which also transitively typechecks it); for the moved core they import
  `../agent/*` directly.
- **`@agent-ui/a2ui`** (`src/` runtime + `.`/`./examples`/`./corpus` barrels) — the renderer-facing
  surfaces are untouched (byte-identical `.` barrel). Consumed via its public surfaces only.

**Keys + the `VITE_` footgun (ADR-0069, SPEC-N2).** A gitignored repo-root `.env` (untracked) provides
per-provider server-side keys (`ANTHROPIC_API_KEY`, …). The proxy resolves each via Vite's
`loadEnv(mode, <repoRoot>, '')` merged over `process.env` (envKey per provider from `providers.json`) —
**not** bare `process.env`, because Vite does NOT load `.env` into `process.env` (non-`VITE_` vars are
kept out of both `process.env` and `import.meta.env`), so a `.env`-only key would otherwise read as
unset (the "no live API key found" degrade); a shell-exported key still wins via the merge. `loadEnv`
runs in Node under `apply: 'serve'` ONLY and the value never leaves the proxy. The `.env` also carries
`VITE_` variants for the deferred client-direct arm.
Vite inlines `VITE_*` at `build` time, so **every live-overlay module is reached only via a dev-only
dynamic `import()` guarded by `import.meta.env.DEV`** — `vite build` tree-shakes it (and any `VITE_`
reference) out. The proxy's non-prefixed keys are never inlined. The build-key-safety gate (LLD-C8c)
proves `dist/` is key-free. This generalizes to N providers UNCHANGED.

The `AgentTransport` interface (SPEC-R1) is the seam both sides meet at — it lives in the harness
(`tools/agent/agent-transport.ts`) and the site imports it (or a thin `site/lib` re-export shim if the
site tsconfig needs it in-tree); it is pure zero-dep TS either way.

## 1. Component map (traceability)

All harness paths are under `packages/agent-ui/a2ui/` (abbreviated `pkg/` below); site paths under `site/`.
**ADR-0137 relocation (2026-07-16):** the moved-core rows below (LLD-C1/C2/C3/C4/C5/C13/C14 + the Anthropic
adapter of LLD-C10) now live under `pkg/src/agent/`, not `pkg/tools/agent/` — the authoritative post-move
file map is §0/§2; the `pkg/tools/agent/` paths in the cells below are the PRE-move locations (the tree +
§2 win where they disagree). The shell rows (LLD-C6 dev-proxy · LLD-C11 registry · the openai/gemini stubs
+ dispatch of LLD-C10 · the DEMO transcripts of LLD-C2) stay under `pkg/tools/agent/`.

| ID | Component | Implements | File (scope) | State |
|---|---|---|---|---|
| **LLD-C1** | `AgentTransport` interface + `Turn`/`Session`/`TurnInput` (incl. `{provider,model}`) types (the seam) | SPEC-R1 | `pkg/tools/agent/agent-transport.ts` (site imports it / a `site/lib` re-export shim) | ✅ built (ADR-0088: signature BYTE-IDENTICAL — the meta-line rides inside the existing `AsyncIterable<string>`, no interface change) |
| **LLD-C2** | `RecordedTransport` + the committed transcript (the backbone) — PLUS the Structural Gen UI doc/second worked example (ADR-0090 §3) | SPEC-R2 | `pkg/tools/agent/recorded-transport.ts` + `transcript.ts` (reuses a shelf seed) + `structural-transcript.ts` (ADR-0090, NEW) | ✅ built (ADR-0088 slice 6: turn-1/turn-2 each carry a `note`; `recorded-transport.ts` streams it as a leading meta-line, §3. ADR-0090 §3: `structural-transcript.ts` is a SECOND committed `RecordedTranscript` — a dashboard-of-stats surface then a follow-up refresh surface, composed ONLY of real catalog types — naming Structural Gen UI as "pre-generated, pre-validated JSONL replayed through `AgentTransport`/`createRenderer`, zero live model" as a first-class pattern; gated by `structural-transcript.test.ts`, the SAME `validateA2ui`/`examples.test.ts`+`round-trip.test.ts` shape, no parallel check. ZERO runtime-code change — `createRecordedTransport(transcript)`'s existing optional param, unchanged. **ADR-0097 §1 (folded 2026-07-07):** `RecordedTurn` gains an OPTIONAL `ask?: AskDeclaration` field (`transcript.ts`); `createRecordedTransport`'s `formatTurnMetaLine` composes `{note, ask}` on the SAME meta-line shape `produce()` emits, so the two transports stay wire-identical for an ask turn too. The SHIPPED `recordedTranscript` carries NO `ask` turn (ADR-0089's scripted-turn fork stands, untouched) — the mechanism is proven by a LOCAL fixture transcript in `round-trip.test.ts`, never the shipped one) |
| **LLD-C3** | `produce()` runtime loop driver (streaming LLD-C2 realized) | SPEC-R4, R5, R7, R12, R13 | `pkg/tools/agent/produce.ts` (+ the meta-line envelope/guard, `pkg/tools/agent/meta-line.ts`, co-located near `session.ts` per ADR-0088's build-sequencing note) | ✅ built (opts.model authoritative — SPEC-R12 trust boundary; ADR-0088 §1/§2: peels a leading meta-line before heal/validate, assembles + yields `TurnTrace`, §5. ADR-0090 §1/§4: `ProduceOptions.mode?: GenUiMode` (`produce.ts:62`) threads to `buildSystemPrompt(deps.catalog, exemplars, opts.mode, miniSkills)` — `produce.ts:170` (shifted from the original `:162`/`:53-55` by ADR-0091's own new lines landing above both) — the same per-turn-tuning-knob path `model` already proves; absent ⇒ `buildSystemPrompt` receives `undefined` ⇒ its default/zero-regression composition, proven by `produce-loop.test.ts`. **ADR-0091 §2 (folded 2026-07-07, SPEC-R13):** `selectMiniSkills(query.intent, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP)` runs ONCE per turn, at `produce.ts:169`, right beside `deps.retrieve(query)` at `:168` — the SAME pre-loop position `retrieve()` already occupies, because `system` is built ONCE outside the round loop (`produce.ts:191-233`) and never rebuilt per round; its result feeds `buildSystemPrompt`'s 4th parameter at `produce.ts:170`. The registry (`MINI_SKILLS`) is a static committed module, not an injected `ProduceDeps` surface — unlike `retrieve`, it has no store/snapshot to inject. **ADR-0097 §1/§3 (folded 2026-07-07, SPEC-R14/R15):** `peelMetaLine` also returns `ask?: AskDeclaration`; AFTER the shared `validateA2ui` passes, `feedScopeFailures(ask, output)` checks the ask-routed surface's component types against `FEED_SURFACE_TYPE_SET` (`feed-catalog.ts`) — a violation feeds back a produce-layer-only `'FEED_SCOPE'` `RoundFailure` (never joining the protocol's closed `ErrorCode` union) and retries; `askIntegrityHolds(ask, output, session)` then checks a `createSurface` for `ask.surfaceId` exists in THIS round's output AND that id is not already known to the session (`sessionKnownSurfaceIds`, scanned from prior `assistant` turns) — failing either DROPS `ask` from the outgoing meta-line silently (never a retry, never a halt); `formatMetaLine` composes `{note, ask, trace}`, omitting `ask` when `undefined` (byte-identical to the pre-ADR-0097 `{note, trace}` shape). Proven by `produce-loop.test.ts`'s two NEW describe blocks) |
| **LLD-C4** | `buildSystemPrompt()` — catalog-derived + few-shot; NOW mode-composed (ADR-0090 §1) + mini-skill-composed (ADR-0091 §3) | SPEC-R6, R13 | `pkg/tools/agent/system-prompt.ts` + `pkg/tools/agent/gen-ui-mode.ts` (ADR-0090, NEW) + `pkg/tools/agent/mini-skills.ts` (ADR-0091, NEW — LLD-C13) | ✅ built (ADR-0088 §1: the hand-authored grammar half instructs the note meta-line; ADR-0089: it also instructs the two ASK behaviors — "Ask instead of guess when the turn is underdetermined" + "Be honest at the catalog wall" negotiated approximation; catalog-derived half untouched, drift gate unaffected — `system-prompt-grammar.test.ts`. ADR-0090 §1: `buildSystemPrompt(catalog, exemplars, mode?: GenUiMode)` (originally `system-prompt.ts:199`, now `:260-275` post-ADR-0091 — see below) composes an invariant spine (`INTRO_AND_NOTE`/`OUTPUT_RULES`, sliced from the literal `GRAMMAR`) + a mode-INVARIANT `HONESTY_FLOOR` (§2) + a mode-SCALED block via `grammarFor()` (originally `system-prompt.ts:153-161`, now `:179-187`): `'specific'` composes `CLARIFY_SPECIFIC`+`NEGOTIATE_SPECIFIC` (directive, dialed DOWN — decline-and-redirect at the wall); `'blue-sky'` composes `CLARIFY_BLUE_SKY`+`NEGOTIATE_BLUE_SKY` (exploratory, dialed UP — the two-direction top-down/bottom-up composition discipline + 3 inline ★ calibration examples); an ABSENT `mode` or `'default'` returns the literal `GRAMMAR` UNCHANGED — byte-identical to the pre-mode ADR-0089 grammar, held BY CONSTRUCTION (that branch never touches the sliced pieces). `GenUiMode = 'default'\|'specific'\|'blue-sky'` (`gen-ui-mode.ts`, the `GEN_UI_MODES` runtime const every other module derives from — never a re-spelled copy). Structural is deliberately NOT a member (Decision §3 — a transport choice, not a grammar disposition). Proven by `system-prompt-grammar.test.ts`'s mode-axis `describe` block: default byte-identity, per-mode prose, the honesty floor in EVERY mode, and zero mode-prose leak into the derived `## Available components` inventory. **ADR-0091 §3 (folded 2026-07-07):** `buildSystemPrompt` gains a 4th, OPTIONAL `miniSkills?: readonly MiniSkill[]` parameter (`system-prompt.ts:260-275`); `miniSkillsBlock(selected)` (`:220-224`) is a structural twin of `fewShot` — returns `''` for an empty selection, else the selected `body`s under a `## Composition idioms` header — appended AFTER `fewShot` and composed IDENTICALLY regardless of `mode`. **The real double-injection defect an independent review caught, and the fix (ADR-0091 §4, `system-prompt.ts:39-49,145-171,226-239`):** the three ★ `NEGOTIATE_BLUE_SKY` calibration examples used to be hardcoded verbatim there AND separately in the registry, so a `'blue-sky'`-mode turn whose intent matched one of the three got the identical paragraph injected TWICE. Fixed two ways — `calibrationExampleBullet(id)` (`:152-156`) now composes `NEGOTIATE_BLUE_SKY`'s bullets FROM `MINI_SKILLS[id].body` (the registry is the single source), and `miniSkillsFor(mode, selected)` (`:236-239`) filters those same three ids OUT of a `'blue-sky'`-mode selection before `miniSkillsBlock` composes it — `'specific'`/`'default'`/absent mode carry none of this prose inline anywhere, so the registry selection still injects them normally there. **ADR-0097 §4 (folded 2026-07-07, SPEC-R14):** the literal `GRAMMAR` constant grows by TWO mode-invariant-positioned blocks — an ask-mechanics paragraph inserted right after the note-line instruction (so `INTRO_AND_NOTE`'s slice picks it up automatically, present identically in every mode) interpolating `` `${FEED_SURFACE_TYPES.join(', ')}` `` (`feed-catalog.ts`) at module-load time (drift impossible by construction), and a terse "balanced" archetype line inserted after the catalog-wall paragraph (inside GRAMMAR's mode-only middle zone — captured by neither `INTRO_AND_NOTE` nor `OUTPUT_RULES`, so it is `'default'`-ONLY). Two NEW consts, `ASK_ARCHETYPES_SPECIFIC`/`ASK_ARCHETYPES_BLUE_SKY`, join `grammarFor`'s `'specific'`/`'blue-sky'` composition arrays — each carrying its OWN disposition prose (asks stay rare / prefer structured asks) plus the same five archetype recipes taught compactly. Proven by `system-prompt-grammar.test.ts`'s NEW ask-mechanics/derived-list/archetype describe blocks; `prompt-drift.test.ts` unaffected (the additions stay in the hand-authored half)) |
| **LLD-C14** | The feed sub-catalog artifact (`FEED_SURFACE_TYPES`/`FEED_EXCLUDED`/`isFeedSurfaceType`) + the partition gate (ADR-0097 §3, NEW) | SPEC-R15 | `pkg/tools/agent/feed-catalog.ts` | ✅ built (pure, zero-dep, zero imports — not even the catalog itself; `FEED_SURFACE_TYPES` (23) ⊕ `FEED_EXCLUDED` (11, each with a recorded reason) — verified a TOTAL PARTITION of `catalog/default/catalog.json`'s 34 component types by `src/live-agent/feed-catalog.test.ts` (lives here, not co-located, per the `produce-loop.test.ts`/`src/live-agent` globbing precedent): union-equals-catalog exactly and disjointly, composite-family closure (RadioGroup/Radio, SegmentedControl/Segment, Card/its 3 sub-types, Select+ComboBox/Option, Tabs/Tab+TabPanel, Menu/MenuItem), and a NEGATIVE CONTROL proving an undispositioned planted type would fail the SAME union check the gate runs — the ADR-0087 lesson, reapplied. THREE independent consumers derive from this one artifact: `system-prompt.ts`'s ask-mechanics block (LLD-C4), `produce.ts`'s FEED_SCOPE gate (LLD-C3), and the page's fail-closed check (LLD-C9) — never a re-spelled copy) | The mini-skill registry (`MiniSkill`, `MINI_SKILLS`, `PER_MODULE_TOKEN_BUDGET`, `DEFAULT_MINI_SKILL_CAP`) + `selectMiniSkills` (ADR-0091 §1/§2, NEW) | SPEC-R13 | `pkg/tools/agent/mini-skills.ts` (+ the extracted shared math, `pkg/src/corpus/text-similarity.ts` — `tokenize`/`termCounts`/`topKByCosine`, lifted OUT of `pkg/src/corpus/retrieve.ts` so there is exactly ONE implementation; `retrieve()` re-imports it, behavior unchanged) | ✅ built (`MINI_SKILLS` seeds ADR-0090's five calibration examples at general maturity — `card-game-sheet`/`settings-screen`/`dashboard-kpi-grid`/`login-form`/`master-detail-split` (`mini-skills.ts:52-96`); `selectMiniSkills(intent, registry, cap)` (`:108-110`) calls `topKByCosine(registry, m => m.triggers, intent, cap, (a,b) => a.id<b.id?-1:a.id>b.id?1:0, /* floor */ 0)` — the SAME `text-similarity.ts` math `retrieve()` uses, but with `floor: 0` (unlike `retrieve()`'s default `-Infinity`) so a per-turn prompt injection never pads with a genuinely unrelated, zero-score module. `text-similarity.ts` lives under `pkg/src/corpus/` (its own home, inside that dir's root-barrel purity-gate exemption) and is consumed cross-tree by `tools/agent/mini-skills.ts` the same way `produce.ts` already imports other `src/corpus/*` modules directly. Gated by `pkg/src/corpus/text-similarity.test.ts` (the `topKByCosine`/`floor`-parameter unit, plus `retrieve.test.ts` proving the extraction left `retrieve()` behavior-unchanged) and `pkg/src/live-agent/mini-skills.test.ts` (the registry's per-module token-budget + `selectMiniSkills`'s degrade-to-empty/top-cap unit — lives under `src/live-agent/`, not co-located with its `tools/agent/` subject, because the vitest `packages` project only globs `src/**/*.test.ts`, the SAME reason `produce-loop.test.ts`/`system-prompt-grammar.test.ts` exercise their `tools/agent/*.ts` subjects from there) |
| **LLD-C5** | `nextTurn()` session reducer + the turn-history model | SPEC-R8 | `pkg/tools/agent/session.ts` | ✅ built (ADR-0088 §3: `shouldRunTurn` — the `wantResponse`-routing predicate lives here, re-exported by `site/lib/agent-runtime.ts`, §4) |
| **LLD-C6** | The dev-server Vite proxy plugin (key-holder + PAIR-allowlist validation + degrade-on-unimplemented; hosts C3+retrieval+C10) | SPEC-R9, R11, R12, N2, N5 | `pkg/tools/agent/dev-proxy-plugin.ts` (wired into the site dev config, dev-only) | ✅ built (passes the validated model + registry endpoint. ADR-0090 §4: the POST body also carries `mode`; `validateMode(mode)` — `dev-proxy-plugin.ts:53-54` — is a plain CLOSED-3-member membership check against `GEN_UI_MODES` (`gen-ui-mode.ts`, the single source of truth, not a local copy) — an unrecognized/absent value returns `undefined`, defaulting the DISPOSITION only, never a 400 (unlike `{provider,model}`'s registry-lookup `resolvePair`); the validated value is passed as `produce`'s authoritative `opts.mode` — `dev-proxy-plugin.ts:164`. Proven directly by `validate-mode.test.ts`) |
| **LLD-C7** | `LiveProxyTransport` (browser → proxy; dev-only-guarded) | SPEC-R9 | `site/lib/live-proxy-transport.ts` | ✅ built (ADR-0090 §4: the POST body adds `mode` — `sel.mode` from the SAME `SelectionRef` `{provider,model}` already rides, `live-proxy-transport.ts:49` — the switcher (LLD-C12) is the only producer of a live `mode` value; the proxy (LLD-C6) is the only validator) |
| **LLD-C8** | The secret-free standing gates (round-trip · prompt-drift · grammar-additions · build-key-safety · config-shape · SSE-parse fixture · mode-membership · the Structural worked example · the mini-skill registry budget/cap + selection) | SPEC-R2, R6, R3, R11, N2, R13 | `pkg/src/live-agent/*.test.ts` (the vitest+tsc include; §3/§6) | ✅ built (13 files / 95 tests — incl. ADR-0089's `system-prompt-grammar.test.ts` (extended, ADR-0090 §1/§2/§4) + ADR-0090's `validate-mode.test.ts` (LLD-C6) and `structural-transcript.test.ts` (LLD-C2) + **ADR-0091's NEW `mini-skills.test.ts`** (LLD-C13; lives here rather than co-located with `tools/agent/mini-skills.ts` for the same globbing reason `produce-loop.test.ts` does): the registry's per-module token-budget/unique-id/no-embedded-JSONL assertions, `selectMiniSkills`'s degrade-to-`[]` (zero-vocabulary, `cap<=0`, empty registry), top-cap ranking, never-pads-with-a-zero-score-module, and determinism. **The double-injection regression (ADR-0091 §4) is covered where it actually surfaces** — a dedicated
`describe('ADR-0091 §4 fix — no double-injection of the ★ calibration examples in blue-sky mode', …)`
block in `system-prompt-grammar.test.ts` (`:300-368`, the file's tail) defines an `occurrences(haystack, needle)`
helper (`haystack.split(needle).length - 1`) and, per ★ id, asserts a `UNIQUE_SUBSTRING` from that
mini-skill's `body` appears **exactly ONCE** in a composed `'blue-sky'`-mode prompt selecting it (the
regression: pre-fix this counted 2 — once from `NEGOTIATE_BLUE_SKY`'s hardcoded copy, once from
`miniSkillsBlock`), while the SAME id in `'specific'`/`'default'`/absent mode still injects normally
(also exactly once, but via `## Composition idioms` there, since nothing is pre-inlined in those modes);
`login-form`/`master-detail-split` (never duplicated) inject once in EVERY mode; and the pre-existing
empty/absent-selection byte-identity guarantee is re-proven across all 4 modes post-fix. This is a
**discovered-reality item** — the defect was found by an independent post-ship review's live probe
counting real occurrences, not hypothesized in advance, and the fix + this regression proof landed
together (ADR-0091 §4). The SAME math's `floor`-parameter behavior (unexercised by `retrieve()`, which never passes one) is unit-tested directly in `pkg/src/corpus/text-similarity.test.ts` — that file is corpus-store LLD territory (`text-similarity.ts`'s home), cited here only as the cross-tree gate `selectMiniSkills` depends on) |
| **LLD-C9** | The site page + switcher mount + dual-TOC wiring (the visible proof; live overlay dev-only-guarded) | SPEC-R10, R12, N4 | `site/a2ui-live.html` + `site/pages/a2ui-live.ts` (+`.css`) + `site/main.ts` | ✅ built (WAI-ARIA tabs, in-flight indicator; ADR-0088: `runTurn` peels the leading meta-line via `readMetaLine` before `host.ingest`, renders `note ?? summarize(turnLines)`, holds `traces: TurnTrace[]` + `notesByTurnIndex` and injects a digest on the next intent turn, and `handleClientMessage` routes on `shouldRunTurn` — §4). ADR-0089: a note-only clarify/boundary ASK renders through this SAME path with NO page change — `note ?? summarize` shows the question verbatim (`a2ui-live.ts:240`) and the `note === undefined` guard on the "no further turns" branch (`a2ui-live.ts:232`) lets a note-only ASK through; no new wire field. **ADR-0097 §2 (folded 2026-07-07, SPEC-R14):** `runTurn` peels `ask` alongside `note`/`trace`; a line whose `surfaceIdOf` (`site/lib/ask-registry.ts`, NEW) equals `ask.surfaceId` buffers into `askLines` instead of the canvas `turnLines`; a line targeting an ALREADY-FROZEN id (`askRegistry.isFrozen`) is dropped, never ingested anywhere. Once the stream ends: `freezePriorPendingAsk(answeringSurfaceId)` freezes whichever ask was pending BEFORE this turn (`'answered'` iff its surfaceId matches this turn's OWN action surfaceId, else `'bypassed'`) — called ONLY once the turn has genuinely COMPLETED (never inside the `catch` block), so a `ProduceHalt`/transport error leaves the prior pending ask untouched (SPEC-R8 AC5); THIS turn's own `ask` (if any) is then resolved — a collision check against `knownSurfaceIds` (every surfaceId this session has EVER created, canvas or ask) plus a fail-closed `componentTypesOf(askLines).every(isFeedSurfaceType)` check (defense-in-depth alongside `produce()`'s own FEED_SCOPE gate) — passing BOTH mounts a fresh `AskRegistry.create()` host into a NEW `.msg[data-ask]` bubble (`addAskBubble`); failing either drops the WHOLE ask (never a partial render), though its lines still join `allLines`/the JSON tab ("shown ≡ produced") and the session record (`appendAssistantTurn` carries `[...turnLines, ...askLines]` regardless of render outcome). `AskRegistry` (NEW, `site/lib/ask-registry.ts`) owns the per-ask `pending → frozen(answered\|bypassed)` state: `freeze()` sets `bubble.inert = true` + `bubble.dataset.state` (idempotent — a second freeze is a no-op) and the page appends a visible annotation (`annotateAskFrozen`); Reset calls `askRegistry.disposeAll()` + clears `knownSurfaceIds` alongside the existing canvas dispose. `AskRegistry`/`surfaceIdOf`/`componentTypesOf` own NO page markup (bubble/mountEl are caller-supplied) — proven directly, in a real engine, by `site/lib/ask-registry.browser.test.ts` (real `inert`/tab-order/click-suppression) + `ask-registry.test.ts` (jsdom, the pure helpers + DOM-mutation contract); the shipped recorded transcript carries no scripted ask (ADR-0089's fork, untouched), so the full page-level render/freeze/answer proof rides the registry directly rather than a seeded turn — see SPEC §6 Open items) |
| **LLD-C10** | The `AgentProvider` seam + one adapter PER provider (Anthropic now; openai/gemini next), each with a PURE SSE-parse (fixture-tested) | SPEC-R11, N5 | `pkg/tools/agent/providers/{anthropic,openai,gemini}.ts` + `providers/index.ts` (dispatch + degrade) | ✅ built (anthropic real; openai/gemini stubs, `implemented:false`) |
| **LLD-C11** | The provider config registry (`providers.json` incl. `implemented`) + pure validation/lookup helpers — SoT for the menu AND the PAIR-allowlist | SPEC-R11, R12 | `pkg/tools/agent/providers.json` + `providers-config.ts` | ✅ built |
| **LLD-C12** | The in-chat provider→model switcher (config-rendered, unbuilt disabled, `localStorage`, dev-only, sends `{provider,model,mode}`) | SPEC-R12 | `site/lib/provider-switcher.ts` (mounted by the page) | ✅ built (ADR-0090 §4: a THIRD `ui-select` — the same dogfooded provider/model pattern — offers the Gen-UI `mode` axis (`GEN_UI_MODES` — `provider-switcher.ts:159-166`), persisted to `localStorage` and exposed on the SAME `SelectionRef` (`get(): {provider,model,mode}` — `provider-switcher.ts:59`) `live-proxy-transport.ts` reads per turn; option labels are demo-facing (`MODE_LABELS`), the value list itself derives from `GEN_UI_MODES`, never a re-spelled copy) |
| — | **`BrowserDirectTransport`** (client-direct, provisioned) | SPEC-R9 (deferred) | `site/lib/browser-direct-transport.ts` | DEFERRED — CORS host-verified viable-but-dangerous; same seam; dev-only-guarded; uses C10 in-browser |

## 2. File / module map (which lands where)

```
site/
  a2ui-live.html                       # the MPA entry (Vite auto-discovers it; no vite.config edit)
  pages/a2ui-live.{ts,css}             # LLD-C9 — consumes AgentTransport ONLY; createRenderer + mount + the switcher; ADR-0097 §2: wires AskRegistry
  lib/agent-runtime.ts                 # LLD-C1's site/lib shim — re-exports the harness seam + ADR-0088's shouldRunTurn/readMetaLine/TurnTrace so the page never reaches deep-relative into tools/agent; ADR-0097 §1/§3: +AskDeclaration, +isFeedSurfaceType
  lib/ask-registry.ts                  # ADR-0097 §2 (NEW) — AskRegistry (pending→frozen(answered|bypassed)) + surfaceIdOf/componentTypesOf; owns NO page markup
  lib/live-proxy-transport.ts          # LLD-C7 — browser → proxy; yields A2UI JSONL (dev-only-guarded import); ADR-0090 §4: body adds `mode` from the SAME SelectionRef
  lib/provider-switcher.ts             # LLD-C12 — dropdowns rendered from providers.json; localStorage; ADR-0090 §4: +1 `ui-select` for GenUiMode (GEN_UI_MODES)
  lib/browser-direct-transport.ts      # DEFERRED — client-direct (VITE_ key + a C10 adapter in-browser); dev-only-guarded
  main.ts                              # +1 dual-TOC entry for a2ui-live
packages/agent-ui/a2ui/src/agent/      # ADR-0137 (TKT-0072) — the EXPORTED producer toolkit `@agent-ui/a2ui/agent`; in the real tsc+vitest include; zero-dep, NODE-FIRST (node:fs only in the two prompt loaders)
  index.ts                             # ADR-0137 clause 1 — the pack barrel (export * of the 10 modules below); NOT re-exported by the root `.` barrel (identity gate)
  agent-transport.ts                   # LLD-C1 — the seam (pure, browser-safe); imports ../renderer only
  meta-line.ts                         # ADR-0088 §1/§2 — readMetaLine/isMetaLine + TurnTrace/A2uiMetaEnvelope (pure, zero imports); ADR-0097 §1: +AskDeclaration, +ask? on A2uiMetaEnvelope
  gen-ui-mode.ts                       # ADR-0090 §1/§4 — GEN_UI_MODES/GenUiMode/DEFAULT_GEN_UI_MODE; pure, zero-dep, single source of truth for the 3-member set
  mini-skills.ts                       # ADR-0091 §1/§2 (LLD-C13) — MiniSkill/MINI_SKILLS/PER_MODULE_TOKEN_BUDGET/DEFAULT_MINI_SKILL_CAP/selectMiniSkills; node:fs loads prompts/mini-skills/*.md (ADR-0135); imports ../corpus/text-similarity.ts + ./prompts/frontmatter.ts
  feed-catalog.ts                      # ADR-0097 §3 (LLD-C14) — FEED_SURFACE_TYPES/FEED_EXCLUDED/isFeedSurfaceType; pure, zero imports (not even catalog.json)
  recorded-transport.ts                # LLD-C2 — replays a transcript (implements AgentTransport); ADR-0137 clause 2 OWNS the RecordedTranscript/RecordedTurn TYPES (extracted out of the demo transcript.ts) + createRecordedTransport(transcript) — transcript param now REQUIRED (the demo-coupling default removed); streams a turn's `note`(+`ask`, ADR-0097 §1) as a leading meta-line
  produce.ts                           # LLD-C3 — the bounded loop; injected AgentProvider; shared heal+validate; peels/emits the meta-line (ADR-0088); ADR-0090 §1/§4: ProduceOptions.mode?: GenUiMode; ADR-0091 §2: selectMiniSkills() once per turn beside retrieve(); ADR-0097 §1/§3: peels `ask`, gates FEED_SCOPE + ask-integrity AFTER validateA2ui, composes `{note,ask,trace}`; ADR-0138: ProduceOptions.personaSystem threads to buildSystemPrompt
  system-prompt.ts                     # LLD-C4 — buildSystemPrompt(catalog, exemplars, mode?, miniSkills?, personaSystem?), catalog-derived; node:fs loads prompts/*.md (ADR-0135, PROMPTS_DIR now `src/agent/prompts`); grammar/mode/mini-skill/feed-ask/persona composition (ADR-0088/0089/0090/0091/0097/0138)
  session.ts                           # LLD-C5 — nextTurn() reducer + turn-history + shouldRunTurn() wantResponse-routing predicate (ADR-0088 §3)
  prompts/                             # ADR-0135 — the hand-authored grammar + mini-skill .md files + frontmatter.ts, loaded by system-prompt.ts/mini-skills.ts at module load (moved with them, ADR-0137)
  providers/anthropic.ts               # LLD-C10 — the Anthropic adapter (plain fetch; SPEC-N5 SSE parse); ADR-0137 clause 2 / F4: the one adapter exported (its pure parse fixture-tested)
  gates.test.ts                        # ADR-0137 clause 8 — the standing subpath gates: identity · SDK-free/zero-dep · node-fence
packages/agent-ui/a2ui/tools/agent/    # the site/tools-scoped SHELL that STAYS behind (ADR-0137 clause 3) — Node-scoped, zero-dep, type-stripped, NOT in any tsconfig include
  transcript.ts                        # LLD-C2 data (DEMO fixture) — turns; turn-1 payload = a committed shelf seed; re-imports RecordedTranscript from ../../src/agent/recorded-transport.ts (ADR-0137)
  structural-transcript.ts             # ADR-0090 §3 (DEMO fixture) — LLD-C2's SECOND worked example (Structural Gen UI); ONLY real catalog types, zero live model
  providers.json                       # LLD-C11 data — the registry (env-var NAMES + endpoints/model-ids, NO secrets)
  providers-config.ts                  # LLD-C11 — typed loader + validation helpers (menu + allowlist SoT)
  providers/index.ts                   # LLD-C10 — provider-id → AgentProvider dispatch (imports the exported ../../src/agent/providers/anthropic.ts)
  providers/openai.ts · gemini.ts      # LLD-C10 — the IMMEDIATE NEXT SLICES (host-verify each before building)
  agent-config-schema.ts               # ADR-0135 Piece-B — the site-config builder (imports the exported ../../src/agent/{produce,mini-skills,gen-ui-mode})
  dev-proxy-plugin.ts                  # LLD-C6 — Vite configureServer middleware (dev-only, `vite`+`node:http` — the key-holder fence); allowlist + loadEnv('.env')[envKey] over process.env; C10→C3; ADR-0090 §4: validateMode(); ADR-0138: reads capped body.personaSystem
packages/agent-ui/a2ui/src/live-agent/ # the STANDING TESTS (the vitest+tsc include) — reach out into ../../tools/agent for the shell, ../agent for the exported core
  round-trip.test.ts · prompt-drift.test.ts · produce-loop.test.ts · providers-config.test.ts · build-key-safety.test.ts
  meta-line.test.ts                    # ADR-0088 §1 — the guard's discriminator, in isolation from produce(); ADR-0097 §1: +the ask field's shallow-validation legs
  feed-catalog.test.ts                 # ADR-0097 §3 (NEW, LLD-C14) — the partition gate: union-equals-catalog, disjointness, composite closure, negative control
  validate-mode.test.ts                # ADR-0090 §4 (NEW) — validateMode()'s membership-guard unit, in isolation from the proxy wiring
  structural-transcript.test.ts        # ADR-0090 §3 (NEW) — the Structural worked example's validity gate (validateA2ui, per turn) + a real-host render + a createRecordedTransport replay; the examples.test.ts/round-trip.test.ts shape, no parallel check
  mini-skills.test.ts                  # ADR-0091 §1/§2 (NEW, LLD-C13) — the registry's per-module token-budget/id-shape/no-embedded-JSONL assertions + selectMiniSkills' degrade-to-[]/top-cap/never-pads/determinism unit; lives here (not co-located with tools/agent/mini-skills.ts) — the vitest `packages` project only globs `src/**/*.test.ts`, the same reason produce-loop.test.ts/system-prompt-grammar.test.ts exercise their tools/agent/*.ts subjects from here
packages/agent-ui/a2ui/src/corpus/     # OWNED BY the corpus-store LLD (a2ui-corpus-store.lld.md), cited here only as the cross-tree dependency selectMiniSkills/mini-skills.ts rides
  text-similarity.ts                   # ADR-0091 §2 (NEW) — tokenize/termCounts/topKByCosine, EXTRACTED out of retrieve.ts (behavior-unchanged) so there is exactly ONE implementation; retrieve() and selectMiniSkills() are its two callers
  text-similarity.test.ts              # ADR-0091 §2 (NEW) — topKByCosine's degrade-to-empty + the `floor` parameter (unexercised by retrieve(), which never passes one); retrieve.test.ts independently proves the extraction left retrieve() behavior-unchanged
packages/agent-ui/a2ui/{src,exports}   # UNCHANGED — public surface stays .`/`./examples`/`./corpus` (SPEC-N1)
```

**Discovery table (B2 — the honest typecheck/test path per module; `check` = `tsc && check:site`):**

| Module(s) | `npm run check` (tsc) | `npm test` (vitest) | Notes |
|---|---|---|---|
| `pkg/src/live-agent/*.test.ts` (the gates) | ✅ direct (in root `include`) | ✅ direct (in vitest `include`) | the standing gates; import the tools modules → transitively typecheck them |
| `session.ts`·`produce.ts`·`system-prompt.ts`·`providers-config.ts`·`providers/index.ts`·`recorded-transport.ts`·`transcript.ts`·`structural-transcript.ts`·`gen-ui-mode.ts`·`mini-skills.ts` | ✅ **transitive** (imported by a src test) | ✅ **transitive** (exercised by a src test) | NOT in `include`; covered because a `src/live-agent` test imports them (the pure logic) — `gen-ui-mode.ts` via `system-prompt-grammar.test.ts`/`validate-mode.test.ts`; `structural-transcript.ts` via its own `structural-transcript.test.ts`; `mini-skills.ts` via its own `mini-skills.test.ts` AND `system-prompt-grammar.test.ts` (the §4 double-injection regression) |
| `dev-proxy-plugin.ts`'s `validateMode()` (the mode membership guard) | ✅ **transitive** (imported directly by `validate-mode.test.ts`) | ✅ **transitive** (exercised directly) | split out as a plain, pure, exported function (ADR-0090 §4) so it is gate-covered independent of the rest of the (type-stripped, MANUAL) proxy wiring below |
| `providers/anthropic.ts` — the PURE SSE-chunk→fragment parse | ✅ **transitive** (the fixture test imports it) | ✅ **transitive** (the SSE-parse fixture test) | the parse is split OUT as a pure fn (LLD-C10, §5) so it IS gate-covered |
| `providers/anthropic.ts` — the `fetch`/network arm | ⚠️ transitive typecheck via dispatch import | ✋ **no standing test** — MANUAL live acceptance | type-stripped execution; a real key + `vite dev` |
| `dev-proxy-plugin.ts` (server wiring) | ✋ type-stripped/executed by Vite (not in `include`, not imported by a src test) | ✋ **no standing test** — MANUAL live acceptance | its PURE allowlist/env-routing/degrade logic IS split into `providers-config.ts` and unit-tested (SPEC-R12 AC1 / R11 AC4) |
| `providers.json` | n/a (data) | ✅ via `providers-config.test.ts` (shape) | committed; no secrets |
| `site/pages/a2ui-live.ts`·`site/lib/*.ts` | ✅ `check:site` (site `include`) | ✋ vitest is packages-only — site tests don't run | proof rides the `src/live-agent` gates + MANUAL browser/live acceptance |

So §7's "green per slice" means: the pure logic is `check`+`test`-green via the `src/live-agent` gates
that import it; the live HTTP arms + the dev-proxy + the site page are `check:site`-typechecked where
applicable and otherwise MANUAL live/browser acceptance — NEVER a standing CI gate (they need a key).

**Placement note (LLD-C1):** the seam lives in the harness (`tools/agent/agent-transport.ts`); the page
imports it directly, or via a one-line `site/lib/agent-transport.ts` re-export if the site tsconfig
needs the type in-tree. Pure zero-dep TS either way; settle the shim at build.

**Dev-config wiring (LLD-C6):** the proxy plugin is added to the site's dev config (the root
`vite.config.ts`'s `plugins`, or a `site/`-scoped extension), NEVER to the package's exports. It only
attaches under `vite dev`; `vite build` emits a static site with no proxy (SPEC-R3/N2). Keep it a
dev-only conditional so `build` output is untouched.

**`providers.json` data-access — DECISION, TWO readers over ONE file (NM2/NM3):**
- **The switcher (LLD-C12, browser/Vite).** `providers.json` lives at
  `pkg/tools/agent/providers.json` — outside `site/` and outside package exports. The switcher reads it
  via a **direct build-time relative JSON import** (`import providers from
  '.../tools/agent/providers.json'`) — Vite bundles JSON natively (unlike Node's ESM loader), the file
  has NO secrets so it is safe to bundle, and the switcher is dev-only anyway (so it and the JSON leave
  the production bundle with the overlay). If the site tsconfig needs the type in-tree, add a one-line
  `site/lib/providers-config.ts` re-export shim (mirroring the `agent-transport` shim). This is settled,
  not "settle at build."
- **The proxy + the config-shape test (LLD-C11, Node).** `providers-config.ts` exposes PURE
  validation/lookup/degrade helpers over an ALREADY-PARSED `ProvidersConfig` object; the Node reader
  (proxy + the vitest shape test) obtains that object via **`readFileSync` + `JSON.parse`** — the SAME
  treatment `catalog.json` gets (Node's native ESM loader rejects an attribute-less JSON import,
  `ERR_IMPORT_ATTRIBUTE_MISSING`, under `--experimental-strip-types`; §5). Pure-core takes the object;
  the Node shell does the read (ADR-0062).

**The `VITE_` build-key-safety mechanism (LLD-C9/C10, SPEC-N2):** the page imports the live-overlay
transport (LLD-C7 or the deferred browser-direct) ONLY through `if (import.meta.env.DEV) { const { …} =
await import('…') }`. Vite statically evaluates `import.meta.env.DEV` to `false` under `vite build`, so
the dynamic branch is dead-code-eliminated and every `import.meta.env.VITE_*` reference inside those
modules leaves the production bundle. The proxy path never touches `VITE_` at all (its key is
`process.env`-side). LLD-C8c gates it.

## 3. Deterministic-backbone contract (LLD-C2 + LLD-C8 gate) — SPEC-R2

**The transcript shape** (data, no live logic):

```ts
interface RecordedTranscript {
  intent: string;                       // the "prompt" the recorded agent received
  turns: RecordedTurn[];                // in order
}
interface RecordedTurn {
  // turn N: the A2UI stream the agent emitted (JSONL lines), and the interaction that follows it.
  lines: string[];                      // A2UI JSONL — turn-1 reuses a committed shelf seed (validity ⇐ examples.test.ts)
  note?: string;                        // ADR-0088 §1 (slice 6) — the agent's own rationale for THIS turn's payload
  expectClientMessage?: A2uiClientMessage;  // the client message a scripted interaction produces (asserted)
}
```

**The `note` channel on the backbone (ADR-0088 §1, slice 6).** `lines` stays protocol-only — `note`
never mixes into it, so every direct-ingest consumer of `recordedTranscript` (the round-trip gate above)
is unaffected. `createRecordedTransport` (`recorded-transport.ts`) is the ONE place that turns `note`
into wire behavior: when a turn carries one, `turn()` `yield`s `{"a2uiMeta":{"note":"…"}}` (no `trace` —
the backbone has no `retrieve()`/heal history to report) BEFORE that turn's `lines`, mirroring exactly
the shape `produce()` emits for a live turn (§5) — the "two transports' stream shapes stay identical"
invariant (SPEC-R5/N4). The shipped transcript's two turns each carry a note describing what that turn's
payload actually does (the canvas Button seed; the confirmation Text), so the offline/keyless demo shows
real prose instead of `summarize()`'s kind-tally fallback. Proven end-to-end (not just source-present) by
`round-trip.test.ts`'s second `it`: it drives `createRecordedTransport()` itself, collects each turn's raw
line stream, and asserts `readMetaLine` recovers the exact authored `note` ahead of the untouched `lines`.

**The round-trip gate (LLD-C8a)** — a standing packages-tree test (in the vitest include) drives the
transcript through the REAL host, deterministically, with no network/key:

1. `const host = createRenderer(); host.onClientMessage(collect); host.mount(el)`.
2. Feed turn-1 `lines` via `host.ingest` → assert the surface renders (`el.childElementCount > 0`),
   `host.finalize()` clean.
3. Simulate the scripted interaction → assert the collected client message deep-equals turn-1's
   `expectClientMessage`.
4. `nextTurn(session, clientMessage)` (LLD-C5) → assert the framed user turn matches the transcript's
   turn-2 input.
5. Feed turn-2 `lines` → assert the surface UPDATES (the "agent continues" — same `surfaceId` patch or
   a new surface).

This is the visible page's proof, exactly as `renderer.test.ts` + `examples.test.ts` are `a2ui-stream`'s
(the page invents no parallel check — SPEC-R10).

**The build-key-safety gate (LLD-C8c, SPEC-N2 — closing the `VITE_` footgun):**
- *source-level (standing):* a grep/test asserting every `import.meta.env.VITE_*` occurrence sits
  inside a module reached only via a dev-only (`import.meta.env.DEV`) dynamic import — never in the
  page's static import graph. Cheap, deterministic, secret-free.
- *build-level (manual, the `npm run size` precedent):* `vite build` then grep `dist/` for the key
  patterns → zero hits. Run when touching the overlay wiring; not in CI (no build in the standard
  gates).

**Gate-wiring — SETTLED (§0/§2):** the round-trip test (and every standing gate) lives at
`pkg/src/live-agent/round-trip.test.ts` (the vitest+tsc include) and reaches out into `../../tools/agent`
to drive `recorded-transport.ts` + `session.ts` through `createRenderer()` — the "site-canon reach-out"
precedent ([[site-tests-excluded-from-vitest]]; tests already import `../examples`). The ONE remaining
contingency is mechanical, not a design fork: **verify at build that the import-layering trip-wire
permits a src *TEST* → `tools/` import** (it targets `src/**` NON-test imports, so it should). IF — and
only if — it objects, the sanctioned fallback is to commit the transcript as a `src/`-side fixture and
keep the reducer in `tools/`, importing only the reducer. Do NOT weaken the tripwire. Either way the
payloads reuse shelf seeds, so validity is free.

**Structural Gen UI is this same backbone — a doc + a SECOND worked example (ADR-0090 §3, LLD-C2,
folded 2026-07-07).** Verified against the tree: `createRecordedTransport` already takes `transcript:
RecordedTranscript = recordedTranscript` as an OPTIONAL parameter (`recorded-transport.ts:25`) — so
"Structural" needed zero runtime-code change, only a second `RecordedTranscript` naming the pattern
explicitly. `tools/agent/structural-transcript.ts` is that second transcript: a "dashboard-summary"
surface (a `Grid` of three `Card`s, each a `Column` of a caption label + an h2 value) followed by a
"dashboard-actions" surface (a `Row` holding one `Button`) — composed ENTIRELY from real default-catalog
component types (verified against `catalog/default/catalog.json`), with no click-round-trip fixture of
its own (that proof stays `transcript.ts`'s/`round-trip.test.ts`'s job). Its header comment states the
pattern explicitly: "load a pre-generated, pre-validated JSONL transcript, render it through the existing
`AgentTransport`/`createRenderer` seam, with zero live model, zero API key, zero network call." Gated by
the SAME precedent, no parallel check invented — `src/live-agent/structural-transcript.test.ts`: (a)
`validateA2ui` verdicts 0-failure on each turn's messages (the `examples.test.ts` shape, SPEC-N3/N6
parity), (b) a real `createRenderer()` host renders both turns' surfaces with an empty error channel (the
`examples.test.ts` render-smoke shape), and (c) `createRecordedTransport(structuralDashboardTranscript)`
is driven directly and each turn's `note` meta-line is recovered ahead of byte-identical `lines` (the
`round-trip.test.ts` second-`it` shape). `npm test` green, zero live model, zero key, zero network.

## 4. Round-trip state machine (LLD-C5) — SPEC-R8

```
idle
  └─(submit intent)──────────▶ generating(turn N)        # produce(): retrieve → generate → heal+validate → self-correct (≤3)
       └─(validated payload)──▶ streaming(turn N)         # validate-then-stream: paced JSONL → host.ingest → progressive paint
            └─(finalize)──────▶ awaiting-interaction      # host.finalize() clean; the human can act
                 └─(onClientMessage: action|functionResponse|error)
                      └─ shouldRunTurn(msg)? ──────────────────────────────────┐   # ADR-0088 §3 routing gate
                           │ false (action.wantResponse===false)               │
                           └─▶ SILENT APPLY: no chat entry, no nextTurn call ──┘   # the surface's own reactive data model is unaffected either way
                           │ true (wantResponse===true or ABSENT — back-compat default; functionResponse/error always route true)
                           └─ nextTurn(session, msg) ─────────▶ generating(turn N+1)   # the reducer frames the user turn
       ...                                                # bounded by a demo max-turns cap → halt
  └─(produce halts at maxRounds)─▶ error(report)          # no invalid surface emitted (SPEC-R5)
```

- **`nextTurn` framing (ADR-0072):** `action` → "user triggered `<name>`" + `context` + `dataModel`
  (when carried); `functionResponse` → the awaited `value` for the issued `callFunction`; `error` →
  the validation failure, fed back for CROSS-turn recovery (distinct from `produce()`'s intra-turn
  self-correct loop).
- **`shouldRunTurn` routing (ADR-0088 §3, LLD-C5, `session.ts`):** a NEW gate ahead of `nextTurn`, not a
  replacement for it — `nextTurn` still always frames a turn when called. `handleClientMessage`
  (`a2ui-live.ts`, LLD-C9) calls `shouldRunTurn` FIRST and only calls `runTurn`/`nextTurn` when it
  answers `true`. Only the `action` arm can answer `false` (`action.wantResponse === false` — an
  explicit per-action opt-out the agent authored, ADR-0011); `wantResponse === true` or **absent**
  answers `true` (the back-compat default — the shipped seed's Button and every existing corpus action
  button set no `wantResponse` and must keep turning); `functionResponse`/`error` always answer `true`
  (inherently agent-directed). The renderer's own, unrelated use of `wantResponse` (registering an
  `actionResponse` RPC slot, `action.ts`) is untouched — this predicate only READS the flag, page-side.
- **Statelessness (SPEC-R8):** the browser holds `Session`; each live turn POSTs the turn history to
  the proxy, which reconstructs the Messages-API call. No server session store.
- **Surface continuity:** turn N+1 emits to the same `surfaceId` (host patches in place) or a new one
  (host replaces) — no renderer change (`renderer.ts` already handles both).
- **The note/trace channel rides ORTHOGONAL to this state machine (ADR-0088 §1/§2):** whichever path a
  turn takes, its emitted stream may lead with a meta-line; `a2ui-live.ts`'s `runTurn` peels it before
  any state above sees the remaining lines (§5's `produce()` peels it before validation on the live
  side; `recorded-transport.ts` prepends it on the backbone side, §3). The trace, if carried, is pushed
  to a browser-held `traces: TurnTrace[]` (parallel to `Session.turns`, never inside it) and its `note`
  is retained in a `turnIndex`-keyed map so the NEXT intent turn's prompt can inject a grounded digest —
  an explain-turn is an ordinary `intent` turn, no new `TurnInput` kind.

**The feed-ask arc rides the SAME state machine, one layer up (ADR-0097 §2, LLD-C9/C14):**

```
awaiting-interaction (an ask surface rendered, pending)
     ├─(a DIFFERENT turn dispatches — canvas action / typed prose / a different ask entirely)
     │       └─ freezePriorPendingAsk(answeringSurfaceId) ──▶ frozen('bypassed')   # NOT this turn's own surfaceId
     └─(THIS ask's own commit Button dispatches — action.surfaceId === ask.surfaceId)
             └─ freezePriorPendingAsk(answeringSurfaceId) ──▶ frozen('answered')   # runs ONLY once the turn COMPLETES

frozen(answered|bypassed)
     ├─ inert + data-state + a visible annotation; NEVER disposed (history stays visible)
     ├─(a line later targets this surfaceId)───▶ dropped + counted, ingested nowhere (closed by construction)
     └─(Reset)──────────────────────────────────▶ disposed (askRegistry.disposeAll(), alongside the canvas host)
```

`freezePriorPendingAsk` fires ONCE per turn that genuinely COMPLETES (after `host.finalize()`, before this
turn's OWN new ask — if any — is created) — NEVER inside the `catch` block, so a `ProduceHalt`/transport
error leaves whatever was pending BEFORE that turn untouched (SPEC-R8 AC5's "a failed turn changes
nothing"). At most ONE ask is ever pending: the grammar caps a turn to AT MOST one ask (SPEC-R14), and
every OTHER turn that completes freezes whatever was pending first. A `wantResponse: false` silent apply
never reaches `runTurn` at all (the state machine's existing gate above), so it freezes nothing — the SAME
invariant the canvas side already holds.

## 5. The runtime loop (LLD-C3) — SPEC-R4/R5/R7, streaming LLD-C2 realized

```ts
// queryOf(input): the RetrieveQuery for a turn — { intent: input.text ?? framedClientMessage,
//   k, catalogId: 'agent-ui', protocolVersion: 'v1.0' } (turn-1 uses the intent; later turns the
//   framed client message as the search text). Pure; the retrieval scope is the judged shard.
async function* produce(input, deps, opts) {                 // deps.provider: AgentProvider (stub|real)
  const exemplars = deps.retrieve(queryOf(input));           // SPEC-R7 — top-k over the judged shard
  const system = buildSystemPrompt(deps.catalog, exemplars); // SPEC-R6 — catalog-derived (grammar half also
                                                              //   instructs the leading note meta-line, ADR-0088 §1)
  let failures = undefined;
  for (let r = 0; r < opts.maxRounds; r++) {                 // maxRounds = 3
    let raw = '';
    for await (const frag of deps.provider.stream({ model: input.model, system,
                 messages: messagesFor(input, failures), signal: opts.signal })) raw += frag;  // accumulate fragments
    const { note, rest } = peelMetaLine(raw);                // ADR-0088 §1 — peeled BEFORE heal/validate; a note
                                                              //   line would otherwise fail the healer and waste a round
    const messages = splitLines(rest).map(heal);             // shared healer (no fork) — over the REMAINING text only
    if (note !== undefined && messages.length === 0) {       // ADR-0088 Consequences — a note-only turn is a
      yield formatMetaLine(note, traceFor(r + 1, 0, failures)); //   CLEAN success, never a halt (empty ≠ invalid)
      return;
    }
    const verdict = validateA2ui(assemble(messages), deps.catalog);   // shared validator (SPEC-N3)
    if (verdict.failures.length === 0) {
      if (note !== undefined) yield formatMetaLine(note, traceFor(r + 1, healedCount, failures)); // meta-line FIRST
      yield* validatedLines(messages); return;               // R5 validate-then-stream
    }
    failures = verdict.failures;                             // R4 self-correct: feed failures back
  }
  throw new ProduceHalt(failures);                           // bounded; emit nothing invalid; host reports
}
```

**Provider-agnostic (LLD-C10, ADR-0073):** `deps.provider` is the injection point — the proxy (LLD-C6)
supplies the adapter matched to the request's `provider` (via `providers/index.ts`), the `src/live-agent`
loop test supplies a stub `AgentProvider` (first-invalid-then-valid fragments) so the loop mechanics are
gate-covered with NO live model (SPEC-R4 AC1). Each adapter is ITS provider's single upstream boundary
(SPEC-N5). `providers/anthropic.ts` calls `POST /v1/messages` with plain `fetch` (`x-api-key` +
`anthropic-version: 2023-06-01`; body `stream:true`); its SSE handling is split in two:

```ts
// PURE (fixture-tested — LLD-C8/SPEC-R11 AC3): SSE chunk text → the accumulated model text fragments.
function* parseAnthropicSSE(chunk: string): Iterable<string> { /* yield delta.text on
  content_block_delta where delta.type==="text_delta"; ignore ping/thinking/tool; surface event:error */ }
// IMPURE (MANUAL live acceptance): the fetch + ReadableStream reader that feeds parseAnthropicSSE.
async function* stream(req) { /* fetch(endpoint, …); for await (chunk) yield* parseAnthropicSSE(chunk) */ }
```

The pure `parseAnthropicSSE` is fed a CAPTURED SSE-response fixture in a `src/live-agent` unit test
(deterministic, no network — the code most likely to break on an upstream change is gated); the `fetch`
arm is MANUAL live acceptance. Completion = `message_stop`; `event: error` is surfaced (the
host-verified 2026-07-04 contract). **Default model:** `claude-sonnet-5` (the registry's `defaultModel`)
— Execute tier; `claude-opus-4-8` opt-in, `claude-fable-5` for latency; the model id rides
`{provider,model}` from the switcher (SPEC-R12). Keys are passed IN (the `loadEnv`-resolved value
server-side / `import.meta.env.VITE_*` for the deferred client-direct arm), never module-scoped. **Defensive
dispatch (LLD-C6):** `providers/index.ts` maps a provider id → adapter; an allowlisted-but-`implemented:
false` provider (or a missing module) returns the distinguishable "provider not yet available" signal →
the proxy degrades to backbone-only (like the no-key path), NEVER an unhandled crash (SPEC-R11 AC4).
**OpenAI + Gemini adapters are the immediate NEXT slices** (config rows present, `implemented: false`;
host-verify each streaming contract before building — ADR-0073).

**Registry load (LLD-C11):** `providers-config.ts` exposes PURE validation/lookup/degrade helpers over
an already-parsed `ProvidersConfig`; the Node reader (proxy + the vitest shape test) supplies it via
`readFileSync` + `JSON.parse` — the SAME treatment `catalog.json` gets below; the browser switcher reads
the file via a Vite JSON import (§2 data-access decision).

**buildSystemPrompt (LLD-C4):** three parts — grammar (from the `a2ui-compose` references, DRY) +
catalog inventory DERIVED from `catalog.json` at run time + the few-shot exemplars. The drift gate
(LLD-C8b) asserts the derived catalog inventory == `Object.keys(catalog.components)` and each row's
props (a planted row absent fails) — the catalog half is mechanically gated; the grammar half is a
manual-review discipline (ADR-0071, not equal-strength). The hand-authored grammar half now carries,
beyond ADR-0088's note-line instruction, ADR-0089's two ASK behaviors — an "Ask instead of guess when the
turn is underdetermined" paragraph (clarify only when guessing would waste the turn; Kim's "make it better"
⇒ clarify vs "build me a form" ⇒ build calibration) and a "Be honest at the catalog wall" paragraph (name
the limit, propose an approximation built EXCLUSIVELY from existing catalog components, ask "want me to?",
and only on yes build it using ONLY catalog types + disclose it is an approximation). Both are prose in the
GRAMMAR string ONLY: the drift gate confirms the derived `## Available components` section carries none of
it, and `system-prompt-grammar.test.ts` additionally asserts neither ever licenses an uncatalogued type
(the pre-existing "NEVER invent a component or a prop" rule survives byte-for-byte).

**The Gen-UI `mode` axis (ADR-0090 §1/§2/§4, folded 2026-07-07) — `buildSystemPrompt` gains a third,
OPTIONAL `mode?: GenUiMode` parameter that SCALES the two ADR-0089 GRAMMAR-half behaviors.** `GenUiMode =
'default' | 'specific' | 'blue-sky'` (`gen-ui-mode.ts` — the `GEN_UI_MODES` runtime `as const` array is the
single source of truth every consumer derives from, never a re-spelled copy). `grammarFor(mode)`
(`system-prompt.ts:179-187`, originally `:153-161` — shifted down by ADR-0091's new
`calibrationExampleBullet`/`BLUE_SKY_CALIBRATION_IDS` lines landing above it) composes: an INVARIANT spine (`INTRO_AND_NOTE` + `OUTPUT_RULES`, SLICED — not
retyped — out of the literal `GRAMMAR` string) + a mode-INVARIANT `HONESTY_FLOOR` (§2 — "never invent…
never silently substitute… under any circumstance, including while approximating"; identical in every
mode, never scaled) + a mode-SCALED block: `'specific'` composes `CLARIFY_SPECIFIC`+`NEGOTIATE_SPECIFIC`
(directive — prefer a direct catalog mapping; at the wall, decline-and-redirect to what IS offered, never
propose composing a novel approximation); `'blue-sky'` composes `CLARIFY_BLUE_SKY`+`NEGOTIATE_BLUE_SKY`
(exploratory — a lower clarify threshold, several welcome rounds, elaborate approximations narrated via the
note channel, PLUS a top-down/bottom-up/reconcile composition discipline and 3 inline ★ calibration
examples — card-game sheet, settings screen, dashboard). An ABSENT `mode`, and `'default'`, return the
literal `GRAMMAR` constant UNCHANGED — the exact pre-mode ADR-0089 grammar, byte-identical BY CONSTRUCTION
(that branch never touches `INTRO_AND_NOTE`/`HONESTY_FLOOR`/the scaled variants at all), proven by
`system-prompt-grammar.test.ts`'s `mode axis` `describe` block. `mode` conditions ONLY the GRAMMAR half —
the catalog-derived inventory, `prompt-drift.test.ts`, and the render-time SPEC-R9 security allowlist are
completely untouched; Structural (Decision §3) is deliberately NOT a `GenUiMode` member — it is the
recorded-transport pattern (LLD-C2 above), a transport choice `buildSystemPrompt` never sees. `produce.ts`
threads `opts.mode` straight through (`produce.ts:170` — shifted from the original `:162` by ADR-0091's
own `selectMiniSkills` line landing just above it, LLD-C3); `dev-proxy-plugin.ts` validates it by
enum membership before it ever reaches `produce()` (`validateMode`, LLD-C6); `provider-switcher.ts` is the
demo's mode selector (LLD-C12); none of the three touches the meta-line envelope, the reducer, or the
transports — ZERO new wire/transport/protocol surface (Consequences).

**The mini-skill registry (ADR-0091 §1/§2/§3, folded 2026-07-07, LLD-C13) — a THIRD, orthogonal segment
`buildSystemPrompt` composes, additive to the `mode` axis above.** `tools/agent/mini-skills.ts` (NEW)
exports a static `MINI_SKILLS: MiniSkill[]` registry (5 entries, `{id, triggers, body}` — ADR-0090's five
calibration examples at general maturity) and `selectMiniSkills(intent, registry, cap)`
(`mini-skills.ts:108-110`), a TF-IDF/cosine top-`cap` ranking over each entry's `triggers`, reusing
`topKByCosine` — the SAME math `retrieve()` uses, EXTRACTED to `src/corpus/text-similarity.ts`
(`retrieve.ts` re-imports it, behavior unchanged; `retrieve.test.ts` proves it) — with `floor: 0` (never
padding a per-turn selection with a genuinely unrelated, zero-score module, unlike `retrieve()`'s default
`-Infinity`). `produce()` calls it ONCE per turn, at the SAME pre-loop position `retrieve()` already
occupies (`produce.ts:169`, right beside `deps.retrieve(query)` at `:168`), and feeds the result into
`buildSystemPrompt`'s new 4th, OPTIONAL `miniSkills?: readonly MiniSkill[]` parameter (`produce.ts:170`;
`system-prompt.ts:260-275`). `miniSkillsBlock(selected)` (`system-prompt.ts:220-224`) is a structural twin
of `fewShot`: `''` on an empty/absent selection (reproducing the pre-ADR-0091 prompt byte-for-byte) or the
selected `body`s under a `## Composition idioms (matched to your request)` header otherwise — appended
AFTER `fewShot`, composed IDENTICALLY in every `mode`, and never touching the catalog-derived inventory or
its drift gate. **The real discovered-reality defect (ADR-0091 §4):** the three ★ `NEGOTIATE_BLUE_SKY`
calibration paragraphs (`card-game-sheet`/`settings-screen`/`dashboard-kpi-grid`) were originally
hardcoded VERBATIM a second time inside `system-prompt.ts`, so a `'blue-sky'`-mode turn whose intent ALSO
matched one of those three ids got the identical paragraph injected TWICE — caught by an independent
post-ship review's live probe (counting real paragraph occurrences in one composed prompt), not
hypothesized in advance. Fixed by single-sourcing: `calibrationExampleBullet(id)` (`:152-156`) now composes
`NEGOTIATE_BLUE_SKY`'s bullets FROM `MINI_SKILLS[id].body` (the registry is the one source of that prose),
and `miniSkillsFor(mode, selected)` (`:236-239`) filters those same three ids OUT of a `'blue-sky'`-mode
selection before `miniSkillsBlock` composes it — `'specific'`/`'default'`/absent mode carry none of this
prose inline anywhere, so the registry selection still injects them normally there;
`login-form`/`master-detail-split` were never duplicated and are unaffected by either the bug or the fix.
The regression is proven directly (§7, LLD-C8). Per-module budget (`PER_MODULE_TOKEN_BUDGET = 200`) and
per-turn cap (`DEFAULT_MINI_SKILL_CAP = 3`) are indicative starting values (ADR-0091 §3), gated by
`mini-skills.test.ts`; the demo switcher matched-idiom readout (a re-verify item, like ADR-0090's selector
exposure) is UNBUILT — no `provider-switcher.ts` change landed with this fold.

**Feed-embedded asks (ADR-0097 §1/§3/§4, folded 2026-07-07, LLD-C3/C4/C14) — a fourth composed concern,
additive to `mode` and `miniSkills`.** `tools/agent/feed-catalog.ts` (NEW, LLD-C14) exports
`FEED_SURFACE_TYPES` (23) / `FEED_EXCLUDED` (11, each with a reason) / `isFeedSurfaceType` — a pure,
zero-dep, gate-encoded TOTAL PARTITION of `catalog/default/catalog.json`'s 34 component types (verified by
`feed-catalog.test.ts`, LLD-C14). THREE points derive from this ONE artifact: `system-prompt.ts`'s
GRAMMAR gains an ask-mechanics paragraph (inserted right after the note-line instruction, so
`INTRO_AND_NOTE`'s existing slice picks it up automatically — present identically in EVERY mode) that
interpolates `` `${FEED_SURFACE_TYPES.join(', ')}` `` at module-load time (drift impossible by
construction) plus a `'default'`-only terse "balanced" archetype line (inserted after the catalog-wall
paragraph, inside GRAMMAR's mode-scaled middle zone); `grammarFor`'s `'specific'`/`'blue-sky'` branches
each gain a NEW `ASK_ARCHETYPES_SPECIFIC`/`ASK_ARCHETYPES_BLUE_SKY` const (their OWN disposition prose +
the same five archetype recipes taught compactly). `produce.ts` peels `ask` (`AskDeclaration`) alongside
`note`/`trace` (`meta-line.ts`, ADR-0097 §1); AFTER `validateA2ui` passes, `feedScopeFailures(ask, output)`
checks the ask-routed surface's component types against `FEED_SURFACE_TYPE_SET` — a violation feeds back a
produce-layer-only `'FEED_SCOPE'` `RoundFailure` (a local type structurally compatible with the shared
`Failure`, but NEVER joining the protocol's closed `ErrorCode` union — no protocol change) and retries;
`askIntegrityHolds(ask, output, session)` then requires a `createSurface` for `ask.surfaceId` in THIS
round's output AND that it does not collide with a surface `sessionKnownSurfaceIds` (scanned from prior
`assistant` turns) already knows — failing either drops `ask` from the outgoing meta-line silently (never
a retry, never a halt: the note still stands). The page (`a2ui-live.ts`/`ask-registry.ts`, LLD-C9) repeats
the fail-closed feed-scope check independently (defense-in-depth) before ever rendering an ask
structurally. `AgentTransport.turn`'s signature, the reducer, the render-time SPEC-R9 allowlist, and
`prompt-drift.test.ts`'s catalog-derived section are ALL unchanged — the addition touches only the
GRAMMAR half + one new produce-layer gate + the page's own registry, mirroring exactly how `mode`
(ADR-0090) and `miniSkills` (ADR-0091) each landed before it.

**Catalog load under Node** mirrors the real
`validate-payload.ts` / `import-seeds.ts` mechanism: `loadCatalog` reads `catalog.json` via
`readFileSync` + `JSON.parse` (Node's native ESM loader rejects an attribute-less JSON import —
`ERR_IMPORT_ATTRIBUTE_MISSING` — under `--experimental-strip-types`), NOT an ES-module `import … with
{ type: 'json' }`.

## 6. Error & edge-case handling (SPEC — the L5 section)

| Code / edge | Stage | Handling |
|---|---|---|
| generation never validates | LLD-C3 | `produce()` halts at `maxRounds = 3` and reports — emits NOTHING invalid (SPEC-R5); the page shows a "could not compose a valid surface" error, not a broken render |
| a malformed line mid-stream | LLD-C3/C7 | the renderer's parser fault-isolates it (`PARSE` → stream continues, runtime SPEC-N4); but validate-then-stream (SPEC-R5) means the browser only ever receives already-validated lines, so this is a defense-in-depth fallback, not the normal path |
| no key for the requested provider (the `loadEnv`-resolved `envKey` unset in `.env` AND the shell) | LLD-C6 | the proxy returns a graceful "backbone only" signal; the page falls back to the RecordedTransport — no crash, no CI dependency (SPEC-R9 AC1) |
| an out-of-allowlist `{provider,model}` PAIR from the client | LLD-C6/C11 | the proxy REJECTS it — it validates the PAIR against `providers.json` (the `provider` must be listed AND the `model` must be in that provider's `models`), never trusting an arbitrary client value; only a config-listed provider's `envKey` is ever read (SPEC-R12) |
| an allowlisted-but-unimplemented provider (`implemented: false`, or a missing adapter module) | LLD-C6/C10 | defensive dispatch: `providers/index.ts` returns "provider not yet available" → the proxy degrades to backbone-only (like the no-key path), NEVER an unhandled crash (SPEC-R11 AC4); the switcher also disables such providers so this is only a defense-in-depth guard |
| upstream API/SSE shape changes | LLD-C10 | isolated in the ONE per-provider adapter's PURE parse (`providers/<id>.ts`, SPEC-N5, fixture-tested) — one module to repair; the driver, the transports + the browser are unaffected (they see clean A2UI JSONL); OpenAI/Gemini contracts are host-verify-before-those-slices |
| a `VITE_` key baked into a build | LLD-C9/C10 | closed by construction: every live overlay is dev-only-dynamic-imported (`import.meta.env.DEV`), so `vite build` tree-shakes it + its `VITE_` refs out; the proxy default never uses `VITE_`; LLD-C8c (source-grep + manual build-grep) proves `dist/` is key-free (SPEC-N2) |
| a client error message | LLD-C5 | `nextTurn` frames it as the next user turn (cross-turn recovery) — the agent gets a chance to fix on the next turn, distinct from the intra-turn loop |
| runaway agent (keeps emitting) | LLD-C5 | the demo max-turns cap halts the session; each turn is itself bounded (`maxRounds`) |
| catalog grows, prompt stale | LLD-C4/C8b | the drift test FAILS in `npm test` (a catalog row not surfaced in the derived prompt) — the PRD-G6 coherence gate, mechanical |
| a live call attempted in CI | LLD-C8 | impossible by construction — CI runs only the deterministic backbone + the stub-generator + drift tests; the live path needs `vite dev` + a key (SPEC-R3) |
| the built static site | LLD-C6/C9 | ships the backbone only — no proxy attaches under `vite build`; a grep asserts no key + no live endpoint in `dist/` (SPEC-N2, R10 AC1) |
| a note-only turn (a "why" answer with no UI change — or, ADR-0089, a clarify question / catalog-boundary ask) | LLD-C3 | `produce()` returns cleanly after yielding just the meta-line — a CLEAN success, NOT `ProduceHalt` (empty A2UI ≠ invalid, ADR-0088 Consequences); the page's `turnLines.length === 0` branch checks `note === undefined` too, so it shows the note (the clarifying question / boundary ask) rather than "no further turns" — asserted for both ASK shapes by `system-prompt-grammar.test.ts` |
| a leaked/malformed meta-line reaches the renderer unfiltered (defense-in-depth) | LLD-C9 | fault-isolated by construction: it carries no `version` key, so `dispatch()`'s version gate returns `VERSION_UNSUPPORTED` rather than throwing (ADR-0088 Consequences) — the page's own `readMetaLine` filter in `runTurn` is the primary defense; this is the backstop |
| `action.wantResponse === false` on a click | LLD-C5/C9 | `shouldRunTurn` answers `false` → silent apply: no chat entry, no `nextTurn`/LLM round-trip; the surface's own reactive data model (already updated by the binding layer on input) is unaffected either way (ADR-0088 §3) |
| a crafted/stale/unrecognized `mode` in the proxy request body | LLD-C4/C6 | `validateMode()` (`dev-proxy-plugin.ts`) is a plain CLOSED-3-member membership check against `GEN_UI_MODES` — an unknown value (or none) returns `undefined`, which `buildSystemPrompt` treats as `'default'` (the zero-regression composition); the request itself NEVER fails/400s on a bad `mode` — only the DISPOSITION degrades, never the request (ADR-0090 §4 Consequences); the honesty floor (§2) means even a mis-set mode can never widen the SPEC-R9 allowlist |
| a turn's intent shares no idiom vocabulary with any `MINI_SKILLS` entry (or the registry/cap is empty/non-positive) | LLD-C3/C13 | `selectMiniSkills` degrades to `[]` — never padding with a genuinely unrelated, zero-score module (`floor: 0`, unlike `retrieve()`'s default) — and `miniSkillsBlock` composes `''`, reproducing the pre-ADR-0091 prompt byte-for-byte (SPEC-R6 AC4); a mini-skill-less turn is NOT a failure mode, it is the common case |
| a wrongly-matched mini-skill (off-target idiom selected for the turn) | LLD-C4/C13 | ungated at runtime by design (ADR-0070's stance on per-turn quality, mirrored in ADR-0091 Consequences) — bounded by the per-module budget + per-turn cap, and the honesty floor (§2) still holds: a mini-skill can only suggest composing EXISTING catalog components, never license an uncatalogued type; worst case is mild misdirection, never a validity/security breach (the shared validator still gates every emitted line, `produce.ts:223`) |
| an `ask` declaring a surface no payload line creates, or colliding with a session-known surface (ADR-0097 §1) | LLD-C3 | `produce()`'s `askIntegrityHolds` fails → `ask` is DROPPED from the outgoing meta-line — never a self-correct round, never a halt; the note (and any OTHER, non-ask payload the turn emitted) still ships exactly as if no `ask` had been authored |
| an ask-routed surface hosting an out-of-scope component type (ADR-0097 §3, e.g. `Modal`) | LLD-C3/C14 | `produce()`'s `feedScopeFailures` (AFTER the shared `validateA2ui` passes) feeds back a produce-layer-only `'FEED_SCOPE'` `RoundFailure` naming the surface + the offending type — a SELF-CORRECT round, like any other validator failure, never a stream; the shared validator's own call sites are unchanged (SPEC-N3 parity) |
| a line arrives targeting an ALREADY-FROZEN ask surfaceId (ADR-0097 §2) | LLD-C9 | dropped and counted, ingested nowhere — not the ask host (frozen, `inert`), not the canvas — "an old ask is closed, by construction"; the frozen bubble's rendered history is never mutated by a late/stale line |
| an ask's surfaceId collides with one the PAGE already knows (a canvas surface OR a prior ask, ADR-0097 §2/§3) | LLD-C9 | client-side defense-in-depth alongside `produce()`'s own session-known-surface check: the page's `knownSurfaceIds` guard refuses to create a SECOND `AskRegistry` entry for a known id — the WHOLE ask drops to the note (its lines still join `allLines`/the JSON tab, never rendered) |

## 7. Build sequence (slices = the decomp `a2ui-live-agent.decomp.json` l-nodes; gates per slice)

Parallel-safe after the design root (this intake + ADR ratification). "Green per slice" is scoped per
the §2 discovery table — pure logic goes `check`+`test`-green via the `src/live-agent` gate that
imports it; live/site slices are `check:site`-typechecked where applicable and otherwise MANUAL
acceptance (never a standing CI gate):

1. **l1 SPEC / l2 LLD** *(this intake — done)* + **l3–l6 + l16 ADR-0069/0070/0071/0072/0073 proposed →
   ratified** *(host + Kim; `adr_check.py` 0; dependent slices dispatch only after acceptance)*.
2. **Seam first:** l7 `AgentTransport` *(the interface every transport + the page bind to; typechecked
   via its `src/live-agent` type-only test)*.
3. **Group A (parallel, file-disjoint) after l7 / the ADRs — pure harness logic, gate-covered via the
   `src/live-agent` tests that import it:** l10 `buildSystemPrompt` (needs l5) · l11 `session.ts`
   (needs l6) · l8 `RecordedTransport` + transcript (needs l7) · l18 `providers.json` (incl.
   `implemented`) + `providers-config.ts` pure helpers (needs l16) · l17 the `AgentProvider` seam +
   `providers/anthropic.ts` (with the PURE `parseAnthropicSSE`) + dispatch/degrade (needs l16, l18) · l9
   `produce()` (needs l4, l10, l17-seam) *(tools/harness seat)*.
4. **Group B (parallel) — live/site, MANUAL acceptance, never a CI gate:** l12 the dev-proxy plugin +
   PAIR-allowlist validation + degrade-on-unimplemented (needs l9, l17, l18) · l13 `LiveProxyTransport`
   (needs l7, l12) · l19 the dev-only provider-switcher (renders from l18, disables `implemented: false`,
   `localStorage`) (needs l18) *(tools/site seat; `check:site` where applicable)*.
5. **l14 the standing gates** (needs l8, l10, l11, l17, l18) — round-trip · prompt-drift ·
   providers-config shape (incl. `implemented`) · `parseAnthropicSSE` fixture · dispatch-degrade ·
   build-key-safety source-grep (LLD-C8c); `npm test` green, secret-free; the build-grep is manual.
6. **l15 the site page + switcher mount + TOC** (needs l7, l8, l11, l13, l14, l19) — the visible proof;
   live overlay dev-only-guarded; `check` + `check:site` green; rides l14.
7. **NEXT (named, not this slice):** l17's `providers/openai.ts` + `gemini.ts` adapters — config rows
   present now; build each after host-verifying its streaming contract.

**Discovered-reality notes:** if the src-TEST → `tools/agent` import (§3) trips the import-layering
guard, fall back to committing the transcript/config as `src/`-side fixtures (§3, second option) — do
NOT weaken the tripwire. **Host-verify: all three original flags DISCHARGED (2026-07-04)** — Anthropic
streaming (folded into `providers/anthropic.ts`, §5), client-direct CORS (viable-but-dangerous →
BrowserDirect stays deferred/dev-only), A2A continuity (ADR-0072 cites it). The only remaining
host-verifies are the per-slice OpenAI + Gemini streaming contracts (before step 7).

**ADR-0089 (folded 2026-07-07) — GRAMMAR-only, live-only.** Its two ASK behaviors landed as prose in
`system-prompt.ts`'s hand-authored GRAMMAR half + the new `system-prompt-grammar.test.ts` gate; `produce()`,
the meta-line envelope (`meta-line.ts`), the reducer (`session.ts`), the transports, and `a2ui-live.ts` are
UNCHANGED — a note-only ASK rides ADR-0088's existing note-only turn (peel meta-line → zero A2UI lines →
clean return → `note ?? summarize` render). ADR-0089's one open fork — seeding a scripted clarify/boundary
turn into the recorded transcript so the keyless static build showcases the capability — is **UNBUILT**: v1
is live-only (the ADR's own default, since only a live model can judge "is this vague?"/"does this exceed my
catalog?"), pending Kim's taste call; if chosen it would touch `transcript.ts` + `round-trip.test.ts`. (This
is a DIFFERENT fork than ADR-0090's Structural doc below — that names the ALREADY-shipped recorded
transport as a pattern; it does not seed a scripted clarify/boundary turn into it.)

**ADR-0090 (folded 2026-07-07) — the Gen-UI `mode` axis + Structural named as the recorded-transport
pattern. Eight slices, all built.** (1) `gen-ui-mode.ts` (NEW, tiny, zero-dep): `GEN_UI_MODES`/`GenUiMode`/
`DEFAULT_GEN_UI_MODE`, the single source of truth every consumer derives from. (2) `system-prompt.ts`'s
`grammarFor(mode)` (§5 above) — the bulk of the change: an invariant spine + a mode-invariant honesty
floor + a mode-scaled block; default stays the literal, UNCHANGED `GRAMMAR` constant, byte-identity held
BY CONSTRUCTION and proven by `system-prompt-grammar.test.ts`'s mode-axis block; `prompt-drift.test.ts`
unaffected. (3) `produce.ts`'s `ProduceOptions.mode?: GenUiMode` (`produce.ts:62`, originally `:53-55`)
threads to `buildSystemPrompt` (originally `produce.ts:162`, shifted to `:170` by ADR-0091's
`selectMiniSkills` line landing just above it) — extends `produce-loop.test.ts`. (4) `dev-proxy-plugin.ts`'s
`validateMode()` (`:53-54`) — a closed-3-member membership check, defaulting an unknown value rather than
400ing — passes the validated mode as `produce`'s authoritative `opts.mode` (`:164`); its own
`validate-mode.test.ts` (NEW). (5) `live-proxy-transport.ts` adds `mode` to the POST body
(`sel.mode`, `:49`) from the SAME `SelectionRef` `{provider,model}` already rides. (6)
`provider-switcher.ts` gains a third `ui-select` for `mode` (`:159-166`), persisted, dev-only — the
provider/model precedent; option labels demo-facing, values derived from `GEN_UI_MODES`. (7)
`structural-transcript.ts` (NEW, §3 above) — the Structural Gen UI doc + SECOND worked example, gated by
`structural-transcript.test.ts` (NEW); ZERO runtime-code change (`createRecordedTransport`'s optional
`transcript` param already existed). (8) these SPEC/LLD repairs. `AgentTransport.turn`'s signature, the
meta-line envelope, the reducer, and the render-time SPEC-R9 allowlist are ALL unchanged — the mode axis
touches ONLY the GRAMMAR half + the proven `model`-shaped per-turn-tuning-knob path (Decision §4); the
honesty floor is mode-INVARIANT everywhere (§2, Consequences: "a mode can never breach the catalog
allowlist"). No open fork remains from ADR-0090 itself — the ONE fork the ADR named (Structural as an
enum member vs. documented separately) was RESOLVED by Kim before build (documented separately, per the
planner's recommendation); the exact per-mode wording and demo-selector exposure were build-tuning, not
forks, and are settled by the shipped prose/wiring above.

**ADR-0091 (folded 2026-07-07) — the mini-skill registry, a THIRD `buildSystemPrompt` segment. Six of
seven slices built; one demo-facing item explicitly deferred.** (1) `src/corpus/text-similarity.ts` (NEW):
`tokenize`/`termCounts`/`topKByCosine` EXTRACTED out of `retrieve.ts` (behavior-unchanged, proven by
`retrieve.test.ts`) so there is exactly ONE implementation of the math; `retrieve.ts` re-imports it. (2)
`tools/agent/mini-skills.ts` (NEW, LLD-C13): the `MiniSkill` interface + the seed `MINI_SKILLS` registry
(ADR-0090's five calibration examples at general maturity) + `PER_MODULE_TOKEN_BUDGET`/
`DEFAULT_MINI_SKILL_CAP`, gated by `mini-skills.test.ts` (NEW, `src/live-agent/` — the same
globbing-driven placement as `produce-loop.test.ts`). (3) `selectMiniSkills(intent, registry, cap)`
(`mini-skills.ts:108-110`) — TF-IDF top-`cap` over the registry via `topKByCosine`, `floor: 0`, degrading
to `[]` on zero vocabulary overlap or a non-positive cap/registry; unit-tested. (4) `system-prompt.ts`'s
`buildSystemPrompt` gains a 4th, OPTIONAL `miniSkills?: readonly MiniSkill[]` parameter (`:260-275`) and
`miniSkillsBlock(selected)` (`:220-224`), a `fewShot` structural twin appended AFTER the few-shot block,
`''` on empty/absent — the bulk of the change, asserted byte-identical-on-empty + shape-correct-on-match by
`system-prompt-grammar.test.ts`; `prompt-drift.test.ts` unaffected. (5) `produce.ts` calls
`selectMiniSkills` ONCE per turn beside `retrieve()` (`:169`, right after `:168`), feeding
`buildSystemPrompt` at `:170` — extends no test file (covered transitively by `produce-loop.test.ts` +
`system-prompt-grammar.test.ts`). (6, re-verify, NOT built) the demo switcher matched-idiom readout
(`provider-switcher.ts`) — explicitly deferred, like ADR-0090's own selector-exposure re-verify; no
`provider-switcher.ts` change landed with this fold. (7) these SPEC/LLD repairs (this pass). **The real
discovered-reality item (ADR-0091 §4):** an independent post-ship review's live probe caught the three ★
`NEGOTIATE_BLUE_SKY` calibration paragraphs being injected TWICE into one `'blue-sky'`-mode prompt (hardcoded
verbatim in `system-prompt.ts` AND selectable from the registry, with nothing catching the drift between the
two copies) — fixed by single-sourcing `NEGOTIATE_BLUE_SKY`'s bullets FROM `MINI_SKILLS[id].body`
(`calibrationExampleBullet`, `:152-156`) and filtering those same three ids OUT of a `'blue-sky'`-mode
selection before composition (`miniSkillsFor`, `:236-239`); the regression is proven directly by a dedicated
`describe` block in `system-prompt-grammar.test.ts` (§7 above, LLD-C8) counting real paragraph occurrences.
`AgentTransport.turn`'s signature, the meta-line envelope, the reducer, `retrieve()`'s own exemplar
conditioning (SPEC-R7, unchanged), and the render-time SPEC-R9 allowlist are ALL unchanged — the registry
touches ONLY the GRAMMAR-composition seam + one new pre-loop call site, mirroring exactly how the `mode`
axis (ADR-0090) and the note channel (ADR-0088) each landed. No genuine values-level fork remains from
ADR-0091 (the ADR states this outright, having already corrected two over-forked prior ADRs in the same
session) — the demo-switcher item above is a stated re-verify, not an open decision blocking this fold.

**ADR-0097 (folded 2026-07-07) — feed-embedded interactive asks. Five coupled clauses, all built.** (1)
**Wire** — `meta-line.ts` gains `AskDeclaration`/`ask?` (shallow-validated, malformed-`ask` drops only
itself); `produce.ts` peels/composes it, gates ask-integrity (silent degrade) and FEED_SCOPE (self-correct)
AFTER the shared validator; `RecordedTurn`/`createRecordedTransport` gain the SAME `{note,ask}` meta-line
shape (the shipped transcript carries no `ask` turn — ADR-0089's scripted-turn fork, untouched; proven by a
LOCAL fixture in `round-trip.test.ts`). (2) **Lifecycle** — `site/lib/ask-registry.ts` (NEW): `AskRegistry`
(`pending → frozen(answered|bypassed)`, `inert`+`data-state`, never disposed until Reset) +
`surfaceIdOf`/`componentTypesOf`, owning NO page markup; `a2ui-live.ts` wires it in — one host per ask, one
`.msg[data-ask]` bubble, `freezePriorPendingAsk` called once a turn genuinely completes (never on a thrown
turn). (3) **Feed sub-catalog** — `tools/agent/feed-catalog.ts` (NEW, LLD-C14): `FEED_SURFACE_TYPES`(23)/
`FEED_EXCLUDED`(11); `feed-catalog.test.ts` (NEW) is the partition gate (union-exact, disjoint, composite
closure, negative control) — the ADR-0087 lesson, reapplied to a policy subset; SPEC-R9's full allowlist is
untouched. (4) **Prompt** — GRAMMAR gains an invariant mechanics block (auto-captured by `INTRO_AND_NOTE`,
so present in every mode) interpolating the derived feed-allowed list, plus a `'default'`-only balanced
archetype line; `'specific'`/`'blue-sky'` each gain their OWN `ASK_ARCHETYPES_*` const. (5) **Mode +
degrade** — no mode ever widens the feed set or the SPEC-R9 allowlist; every failure path (a broken `ask`
declaration, an out-of-scope payload, an unrecognized field on an old consumer) degrades to the ADR-0088
prose note, never a protocol break. `AgentTransport.turn`'s signature, the reducer, the renderer's public
seams, and `prompt-drift.test.ts`'s catalog-derived section are ALL unchanged — the whole build lands in
`tools/agent/` + `site/lib/`/`site/pages/` + tests, the ADR-0088/0090/0091 placement law holds. **One named
deviation (not a fork):** the shipped recorded transcript is deliberately NOT seeded with a scripted ask
turn (ADR-0089's own open fork, inherited — untouched, still Kim's call), so the full page-level
render/freeze/answer/fail-closed lifecycle is proven directly against `AskRegistry` in a REAL engine
(`ask-registry.browser.test.ts`) rather than through a real turn driven by the shipped backbone — re-verify
if/when that fork is ever taken (SPEC §6 Open items).
