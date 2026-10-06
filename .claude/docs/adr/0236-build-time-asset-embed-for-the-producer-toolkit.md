# ADR-0236 — Build-time asset embed for the producer toolkit

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-06
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-06 |
> | **Proposed by** | the sdlc-lite run `asset-embed` (architect L1, planner L3), GH #1808, epic GH #1817 |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-06, ratified by Kim in the sdlc-lite session (AskUserQuestion) |
> | **Repairs** | SPEC-N1 (`../spec/a2ui-live-agent.spec.md`) · LLD-C4 and the §2 module tree (`../lld/a2ui-live-agent.lld.md`) · genui-surface SPEC-R9 and SPEC-R13(b) (`../spec/genui-surface.spec.md`) · genui-dogfood LLD-C3 (`../lld/genui-dogfood.lld.md`) · code: `packages/agent-ui/a2ui/src/agent/{system-prompt,mini-skills,selection-guidance,dogfood-inventory,gates.test}.ts`, `src/agent/prompts/genui-packs.ts`, `packages/agent-ui/a2ui/tools/agent/worker/` (`fs-shim.ts`, `fs-shim-content.ts`, `fs-shim.test.ts`, `process-shim.ts`, `module-types.d.ts`, `index.ts`, `wrangler.jsonc`), `scripts/publish/publish-packages.mjs`, `package.json` `check:scripts` |
> | **Supersedes / Superseded by** | **Supersedes in part [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md)** cl.4 (node-first, `node:fs` admitted in named modules) · **Amends [ADR-0232](./0232-catalog-selection-guidance-sidecar.md)** "Worker registration" · relates [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the prompt-file mechanism this re-carries) · relates [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (trust boundary, unchanged) · relates [ADR-0233](./0233-per-control-entries-and-generated-control-registry.md) (the generator and `--check` shape this copies) |

## Context

The `./agent` producer toolkit reads its prompt `.md` files, the catalog `selection.json` sidecars and,
for `dogfood: true`, the fleet's control descriptors from repo-relative paths off `process.cwd()`. Five
modules admit `node:fs` for this (`system-prompt.ts`, `mini-skills.ts`, `prompts/genui-packs.ts`,
`selection-guidance.ts`, `dogfood-inventory.ts`; the `NODE_ALLOWED` set in `src/agent/gates.test.ts`),
already past ADR-0137 cl.4's "exactly two". That one mechanic forces three workarounds:

- The dev proxy must avoid `import.meta.url` (the vite-temp relocation trap, TKT-0044).
- The Cloudflare Worker has no filesystem, so `wrangler.jsonc` aliases `node:fs` to `fs-shim.ts`, fed
  by the hand-listed `fs-shim-content.ts` (`FILES`/`DIRS`), kept honest by `fs-shim.test.ts`, plus a
  `process-shim.ts`. Every new prompt or sidecar is a manual registration (ADR-0232 "Worker
  registration").
- `scripts/publish/publish-packages.mjs` drops a2ui `./agent` from the published exports through
  `EXCLUDE_EXPORTS_FROM_PUBLISH`, because a consumer install has no repo tree to read.

A code read also found a live gap: `dogfood: true` from `site/pages/gen-ui-live.ts` reaches the deployed
Worker (`worker/index.ts` forwards `genuiSurface`), and `dogfoodInventory()` then walks
`packages/agent-ui/components/src/controls`, a key `fs-shim-content.ts` never listed. GH #811 fixed
the build-time arm only; the runtime arm was unfiled.

The carrier is forced, not chosen. Vite `?raw` passes through tsc verbatim, `import.meta.glob` is
Vite-only, and the Worker bundles with esbuild. The one form tsc emit, esbuild and the vite-temp bundle
all accept is a committed, generated TypeScript module holding each asset as a string constant.

## Decision

We will embed the toolkit's assets at build time and read them from generated modules everywhere.

1. **One generator, discovery by rule.** `scripts/generate-agent-assets.mjs` discovers, never from a
   list: every `*.md` under `src/agent/prompts/**`, every `selection.json` under `src/catalog/**`
   (persona fragments and `fixture-demo` included), and every `controls/*/` descriptor with its
   `.define('ui-…')` call site. It exports a write-free `discoverAgentAssets()` and a pure
   `generateAgentAssetsModules()`, resolves from `process.cwd()`, and runs as
   `node scripts/generate-agent-assets.mjs [--check]` (the ADR-0233 `generate-controls.mjs` shape).
2. **Two generated, committed modules** under `packages/agent-ui/a2ui/src/agent/`:
   `assets.gen.ts` (`AGENT_ASSETS`, keyed by src-relative POSIX path, each value `JSON.stringify`'d with
   no normalization, so the loaders' `.trim()` keeps `prompt-equivalence.baseline.json` byte-identical)
   and `dogfood-fleet.gen.ts` (`DOGFOOD_FLEET`, derived rows `{tag, summary, attrs, siblings}`; the raw
   descriptors are about 1.1 MB and are never embedded). Both are never hand-edited.
3. **One reader.** `asset-source.ts` exports `readAsset(key)` and `listAssets(dirKey)` and fails loud on
   an unknown key with the regenerate command. The pure descriptor parsers move to
   `dogfood-descriptor.ts`. The five loaders drop `readFileSync`/`readdirSync`/`statSync`,
   `process.cwd()` and `declare const process`.
4. **Freshness gates.** `src/agent/agent-assets-freshness.test.ts` regenerates in memory and
   byte-compares both modules; `check:scripts` runs `generate-agent-assets.mjs --check`.
5. **NODE-FENCE to zero.** `gates.test.ts` `NODE_ALLOWED` becomes empty: no module in the `./agent`
   graph imports `node:*`.
6. **Worker `fs-shim` retirement.** `fs-shim.ts`, `fs-shim-content.ts`, `fs-shim.test.ts`,
   `process-shim.ts`, the `wrangler.jsonc` `alias` block, the `**/*.md` Text rule and the `*.md` module
   declaration are deleted; the `*.jsonl` rule stays for the corpus shard.
7. **Publish.** `EXCLUDE_EXPORTS_FROM_PUBLISH` loses a2ui `./agent`, its only entry, and `./agent`
   ships; a pre-publish scratch-install smoke proves a plain-Node `import('@agent-ui-kit/a2ui/agent')`.

**Kim's fork ruling (2026-10-05): the dogfood fleet snapshot is a2ui-owned derived rows.** A descriptor
edit in `components` reds the a2ui freshness gate until the generator runs, the same cadence
`*.props.gen.ts` already imposes. Two arms were rejected:

- Generate the same rows inside `components` and import them into a2ui: keeps regeneration in the
  package that changed, but puts teaching-shaped prompt data in the framework package.
- Leave dogfood out of scope: keeps the shim, the alias and the process shim alive for one module, and
  ships `./agent` with a call-time `node:fs` throw behind `dogfood: true`.

The owning records repaired: SPEC-N1 in `a2ui-live-agent.spec.md` (no longer node-first), LLD-C4 and
its module tree in `a2ui-live-agent.lld.md`, SPEC-R9 and SPEC-R13(b) in `genui-surface.spec.md`, and
LLD-C3 in `genui-dogfood.lld.md`. ADR-0137 and ADR-0232 carry append-only amendment notes.

## Consequences

- The dogfood Worker gap closes: `DOGFOOD_FLEET` is in the bundle, so `dogfood: true` composes in the
  deployed Worker.
- A new prompt `.md` or a new `selection.json` needs no manual registration; it needs a regeneration,
  which the freshness gate and `check:scripts` enforce.
- Cross-package churn: a descriptor edit that changes a tag, a first sentence or an attribute reds
  a2ui's freshness gate until `node scripts/generate-agent-assets.mjs` runs. If that friction proves
  unacceptable, the components-owned arm is the fallback.
- `dogfood-tag-set-equality.test.ts` now compares two committed artifacts (`DOGFOOD_FLEET` and
  components' `DOGFOOD_TAGS`); both freshness gates must stay in `npm test` for it to mean "the real
  fleet".
- About 97 KB of committed generated text joins the repo and the Worker bundle; the root `.` barrel
  re-exports nothing from `src/agent/`, so `npm run size` is unaffected.
- A transitive `.json` or `@agent-ui/*` value import deeper in the `./agent` closure would break plain
  Node on the published package; only the scratch-install smoke proves the full closure.
- The ADR-0073 trust boundary is untouched: keys and `produce()` stay where they are.

## Alternatives considered

- **`readFileSync(new URL(…, import.meta.url))` plus copying `.md` into `dist/`**: rejected because it
  breaks under the vite-temp bundle (TKT-0044), still needs the Worker shim, and the dogfood walk reads
  another package's source tree a2ui's `dist/` never carries.
- **Vite `?raw` or `import.meta.glob`**: rejected because tsc passes `?raw` through verbatim and glob is
  Vite-only; neither reaches esbuild or plain Node.
- **ADR-0137 cl.4's prompt-source injection seam**: rejected as the fix because it leaves the hand list
  and the shim for the Worker and the docs site; it can still be added later on top of `asset-source.ts`.
- **Generate `fs-shim-content.ts` instead**: rejected because it keeps `node:fs`, the alias, the process
  shim and the npm exclusion; it automates a list the embed makes unnecessary.
- **Embed raw descriptors**: rejected at 1.1 MB in git, the Worker bundle and the tarball for a 19.6 KB
  rendered output.
- **One generated file for everything**: rejected because prompts and the fleet change on different
  cadences with different owners; two files keep diffs legible.
