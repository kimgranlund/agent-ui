# ADR-0137 — the A2UI producer toolkit becomes exportable: a `./agent` subpath on `@agent-ui/a2ui` — the portable core moves out of `tools/agent/` into `src/agent/`, the dev-proxy/key shell stays site-internal, SPEC-N1 amended at build

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-16
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-16 |
> | **Proposed by** | design seat ([TKT-0072](../tickets/tkt-0072-exportable-a2ui-agent-producer-toolkit.md) intake — Kim's direction, 2026-07-16: export the producer toolkit on the exact [ADR-0119](./0119-code-prose-family-v1-scope.md) pack precedent: pure zero-dep core + opt-in hand-rolled runtime pack) |
> | **Ratified by** | Kim, 2026-07-16 ("Ratify as recommended" — F1-F4 all as recommended; awaiting Kim's own hand-flip of this Status cell to `accepted`, per this repo's `adr-status-guard.py`, which blocks any agent-performed flip unconditionally) |
> | **Repairs** | on ratification+build: [TKT-0072](../tickets/tkt-0072-exportable-a2ui-agent-producer-toolkit.md) (the owning ticket) · [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) **SPEC-N1** (a v0.5 versioned amendment — the surface list gains `./agent`, the "site/tools-scoped only" fence narrows to the key/proxy/registry shell; gated on ratification, the SPEC's own v0.2–v0.4 changelog mechanism) · [`a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md) §0 placement law + §2 file map (repaired at build) · `packages/agent-ui/a2ui/package.json` (gains `"./agent"` at build time, gated on ratification — the [ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md) wording precedent) |
> | **Supersedes / Superseded by** | (none) — Extends [ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md) (a FOURTH subpath following its pure-core/Node-shell discipline, with one ruled Node-first deviation, clause 4) · Relates [ADR-0069](./0069-a2ui-live-agent-demo-shape.md) (the demo's layered shape + security posture UNCHANGED — only SPEC-N1's derived placement fence narrows) · [ADR-0119](./0119-code-prose-family-v1-scope.md) (the opt-in-pack law + identity/tree-shake gates followed) · [ADR-0107](./0107-chart-family-v1-scope.md) (no "runtime dependency in costume" — everything exported is hand-rolled, zero-dep) · [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the prompt-file loading mechanism carried as-is) · [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (the `AgentProvider` seam fork F4 exports) · [ADR-0129](./0129-app-surfaces-m2-composition-and-transport-boundary.md) F1 (transport-agnostic `ui-conversation` — the render-side seam this export finally feeds; not reopened) |

## Context

TKT-0072's grep-verified gap: the RENDER side of "agent emits real A2UI in chat" shipped
(`ui-surface-host` in `ui-conversation`, SPEC-R7 of app-surfaces-m2), but the PRODUCER side — the
machinery that reliably drives a model to emit real A2UI wire messages instead of describing a UI in
markdown box-art — is fenced site-internal. `buildSystemPrompt` (the drift-gated, catalog-grounded
prompt), `produce()` (the bounded generate→heal+validate→self-correct driver), the
`AgentTransport`/`Session` seam types, the `GenUiMode` axis, the mini-skill registry, and the
feed-catalog partition are all "accepted + REALIZED" per the live-agent LLD, yet live under
`packages/agent-ui/a2ui/tools/agent/` — outside the `exports` map (`.`/`./examples`/`./corpus` only)
and outside every tsconfig `include` (typechecked only transitively). This is deliberate: **SPEC-N1**
ratifies "the live infra is site/tools-scoped only" to protect the zero-dep guarantee (ADR-0062/0069).
The predictable cost: a consumer app has NO first-party way to replicate this repo's own
"emit A2UI, not prose" behavior — the ticket's screenshots are that failure mode, live.

The tension is the SAME one ADR-0119 already resolved for `@agent-ui/code`: runtime code wants to
ship, and the zero-dep pillar forbids it in the core. Its law: runtime code CAN ship — **outside the
core, hand-rolled, opt-in, identity-and-tree-shake gated** — never a vendored dependency in costume
(ADR-0107). The producer toolkit already satisfies the hard half by construction: every module is
hand-rolled, zero third-party deps, plain `fetch`, no LLM SDK (the standing SPEC-R3 grep proves it
daily). What's missing is only the packaging geometry and the SPEC amendment.

Two facts sharpen the cut, verified against the tree 2026-07-16 (not taken from the ticket on faith):

1. **Not everything under `tools/agent/` is portable.** `dev-proxy-plugin.ts` imports `vite`,
   `node:http`, and `node:fs` — it is this repo's local-dev key-holder, explicitly NOT a production
   pattern (ADR-0069). `providers.json`/`providers-config.ts`/`providers/index.ts` serve the site's
   dev-only switcher + the proxy's pair-allowlist. `agent-config-schema.ts` is the ADR-0135 Piece-B
   site-config builder. These stay behind.
2. **The prompt content is now file-loaded (ADR-0135, accepted 2026-07-14, built).**
   `system-prompt.ts` and `mini-skills.ts` `readFileSync` their `prompts/*.md` at module load
   (`import.meta.url`-relative, cwd-independent) — so the toolkit's highest-value module is
   Node-BOUND today, unlike `./corpus`'s zero-Node-builtins core. The export shape must rule on this
   honestly (clause 4 / fork F3) rather than pretend the pack is platform-neutral.

## Decision

**We will export the producer toolkit as a `./agent` subpath on `@agent-ui/a2ui` — the ADR-0062
fourth-subpath shape carrying the ADR-0119 opt-in-pack law: the portable core moves from
`tools/agent/` into `src/agent/` (entering the real typecheck/test include), the dev-proxy/key/
registry shell stays site-internal, the root barrel stays byte-identical, and SPEC-N1 is amended —
not silently bypassed — at build, gated on ratification.** Eight clauses.

1. **Shape: a subpath, not a sibling package** *(fork F1)*. NEW export `"./agent"` →
   `./src/agent/index.ts` on `@agent-ui/a2ui`. The DAG is UNTOUCHED — no new package, no new branch,
   no layering-trip-wire extension. Rationale: unlike `router`/`code` (generic families that must stay
   catalog-invisible to `a2ui`), this toolkit IS a2ui-domain machinery — it composes the shared
   `heal`+`validateA2ui`, the catalog types, `retrieve()`'s query/record types, and
   `src/corpus/text-similarity.ts` as in-package relative imports. A sibling package would force those
   internals onto a public surface (or duplicate them) purely to re-import them. The ROOT barrel does
   NOT re-export agent — a renderer-only consumer bundles zero agent bytes (the `./examples`/`./corpus`
   precedent, ADR-0055 clause 3 / ADR-0062 clause 4).
2. **The portable core: what moves to `src/agent/`** *(fork F2)*. The genuinely portable modules,
   import-audited one by one: `agent-transport.ts` (the seam — `AgentTransport`, `TurnInput`/`Turn`/
   `Session`, `AgentProvider`, `Effort`) · `session.ts` (`nextTurn`/`frameClientMessage`/
   `shouldRunTurn`) · `meta-line.ts` (`readMetaLine`, `A2uiMetaEnvelope`/`AskDeclaration`/`TurnTrace`)
   · `gen-ui-mode.ts` · `feed-catalog.ts` · `produce.ts` (`produce`/`ProduceDeps`/`ProduceOptions`/
   `ProduceHalt`) · `system-prompt.ts` + `prompts/` (the `.md` content + `frontmatter.ts`) ·
   `mini-skills.ts` · `recorded-transport.ts` + the `RecordedTranscript`/`RecordedTurn` types
   (extracted from `transcript.ts`) · `providers/anthropic.ts` incl. its pure `parseAnthropicSSE`
   (fork F4). One deliberate API break inside the repo: **`createRecordedTransport(transcript)` makes
   its transcript parameter REQUIRED** — the current default-param coupling to the demo transcript
   would otherwise drag demo bytes into every consumer graph; the site page/tests pass theirs
   explicitly. Moving into `src/` upgrades every one of these from transitive-only typecheck (the
   LLD §2 discovery table's honest caveat) to DIRECT `tsc` + vitest coverage — the standing
   `src/live-agent/*.test.ts` gates keep running unchanged against shortened import paths.
3. **The site-internal shell: what stays in `tools/agent/`, never exported.** `dev-proxy-plugin.ts`
   (Vite middleware key-holder — a local-dev convenience, not a production pattern; a consumer's own
   server-side key boundary is TKT-0072's named non-goal) · `providers.json` + `providers-config.ts` +
   `providers/{index,openai,gemini}.ts` (the site switcher/proxy registry + unimplemented stubs — the
   consumer-facing provider-config contract is TKT-0072's named open scope, deferred to its own
   intake) · `agent-config-schema.ts` (the ADR-0135 site-config builder) · `transcript.ts` +
   `structural-transcript.ts` (demo fixtures; they keep importing the shelf seeds in-package and are
   passed explicitly per clause 2).
4. **The pack is NODE-FIRST, declared honestly** *(fork F3)*. Unlike `./corpus`'s "zero Node builtins"
   law, `./agent` admits `node:fs` in EXACTLY TWO modules — `system-prompt.ts`/`mini-skills.ts`'s
   prompt-file loading (the ADR-0135 cl.13 mechanism, carried byte-for-byte; its equivalence gate and
   `prompt-drift.test.ts` must stay green across the move). Everything else in the exported graph
   stays platform-neutral (plain `fetch` is a global; zero `node:*` elsewhere). This is not a
   compromise but the security posture restated: the producer runs where the key lives — server-side
   (ADR-0069: "a browser cannot hold a secret"); a browser-side producer is the deferred BYOK arm,
   not this intake. The foreseen follow-up if an fs-less runtime (edge/workers) materializes: an
   additive prompt-source injection seam — the exported signatures already permit it without a break.
5. **Conditioning honesty: the judged shard stays non-importable.** `ProduceDeps.retrieve` remains
   injected; ADR-0062 clause 3 (data is not importable; only tools read the data dir) is UNCHANGED. A
   consumer either loads its own corpus through `./corpus`'s `createStore` + its own IO (the recipe is
   documented at build), or runs exemplar-less — `fewShot` degrades to `''` by standing contract. The
   mini-skill registry (the instruction-shaped conditioning) ships IN the pack, so the
   catalog-idiom knowledge arrives even with zero exemplars.
6. **SPEC-N1 amended by version, ADR-0069 untouched.** At build, gated on ratification,
   `a2ui-live-agent.spec.md` takes a **v0.5 changelog amendment** (its own established v0.2–v0.4
   mechanism): the package surface list becomes `.`/`./examples`/`./corpus`/`./agent`, and "the live
   infra is site/tools-scoped only" narrows to "the key-holding, dev-proxy, and provider-registry
   infra stays site/tools-scoped; the producer toolkit is exported at `./agent` per ADR-0137 — the
   zero-dep invariant (no LLM SDK, plain `fetch`, `@agent-ui/components`+`@agent-ui/shared` as the
   only deps) unchanged." The LLD §0 placement law and §2 file map are repaired in the same change.
   ADR-0069 itself is append-only-accepted and needs NO amendment: its decision — the layered demo,
   the `AgentTransport` seam, the key-never-in-a-browser posture — is untouched; only the SPEC
   constraint derived from it narrows.
7. **The consumer example closes the ticket's loop.** A minimal, documented SERVER-SIDE handler
   example ships at build (docs + a small runnable Node script — NOT a second dev-proxy): its own env
   holds its own key, an `AgentProvider` (the exported Anthropic adapter or a bring-your-own-fetch
   impl) feeds `produce()`, and the validated JSONL stream feeds `ui-conversation`/`ui-surface-host`
   `ingestLine()` — the exact loop TKT-0072's screenshots show broken.
8. **Gates that make the opt-in honest** *(the ADR-0119 clause-8 pattern)*: the **identity gate** —
   the root `.` barrel is byte-unchanged and importing only `@agent-ui/a2ui` carries zero agent bytes
   (the grep/bundle proof shape); the **SDK-free/zero-dep gate** — no module under `src/agent/`
   imports a third-party package, and the standing no-`@anthropic-ai/sdk` grep (SPEC-R3 AC1) keeps
   passing; the **Node-fence trip-wire** — `node:*` under `src/agent/` appears ONLY in the two
   clause-4 modules, and `vite`/`node:http` NEVER (the dev-proxy fence — a greppable invariant, the
   ADR-0062 candidate-trip-wire shape); the **prompt byte-identity gates** — ADR-0135's equivalence
   gate + `prompt-drift.test.ts` + the full `src/live-agent` suite green across the move;
   `npm run check && npm test` green with no key present.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — package shape: subpath vs sibling package.** *Recommend: the `@agent-ui/a2ui/agent` subpath*
  (clause 1). The toolkit is a2ui-domain machinery composing a2ui internals (`heal`/`validateA2ui`/
  catalog/corpus text-similarity) — a subpath keeps those as in-package relative imports and leaves
  the DAG untouched. The alternative — a sibling `@agent-ui/agent-toolkit` (the `@agent-ui/code`
  geometry) — buys catalog-invisibility this layer doesn't need (it is not catalog-adjacent; it EMITS
  against the catalog) at the cost of forcing internals onto a public surface or duplicating them.
- **F2 — the core/shell cut.** *Recommend: the clause-2 move list + the clause-3 stay list, including
  the `createRecordedTransport` required-param break.* The live alternative — a narrower types+`produce`
  export leaving `buildSystemPrompt`/mini-skills internal — guts the ticket's acceptance (a): the
  drift-gated prompt IS the "reliably emit A2UI, not prose" capability the screenshots show missing.
- **F3 — Node-first pack vs platform-neutral restructure now.** *Recommend: Node-first — carry
  ADR-0135's fs prompt-loading as-is* (clause 4). The alternative — restructuring `buildSystemPrompt`
  to take injected prompt text now — would re-open a build that shipped and was independently
  reviewed two days ago, to serve an edge-runtime consumer that does not yet exist; the injection
  seam stays an additive, non-breaking follow-up.
- **F4 — the provider surface.** *Recommend: export the `AgentProvider` seam types AND the hand-rolled
  Anthropic adapter (with its fixture-gated pure SSE parse); keep `providers.json`/the registry/the
  switcher site-internal.* The seam-only alternative (bring-your-own-fetch exclusively) is cleaner but
  makes the common case theoretical — the ADR-0119 "peer-dependency adapters only" rejection, re-run:
  the small first-party adapter makes the capability real, and it is already hand-rolled, SDK-free,
  and fixture-tested. The consumer provider-CONFIG contract stays deferred (clause 3) either way.

## Consequences

- **The export map gains its first runtime-LOOP surface.** `.`/`./examples`/`./corpus` export types,
  seeds, and pure stores; `./agent` exports a driver that calls a model. The ADR-0107/0119 line holds
  — hand-rolled, zero-dep, opt-in, gated — but every future "just add an SDK convenience wrapper" ask
  now has a surface to aim at; the SDK-free grep gate is the standing answer.
- **"Exported" means a versioned entry point on the workspace package — NOT npm publication.** The
  package stays `private: true` (ADR-0062); publishing is its own future intake with its own
  obligations (semver, .d.ts strategy for the `.ts`-extension import style, README).
- **Typecheck honesty improves**: ten modules move from "typechecked only transitively when a test
  imports them" into the real `tsc` include — the LLD §2 discovery table's caveat shrinks to the
  dev-proxy + provider stubs that stay behind.
- **Repo-internal churn is mechanical**: the site's `agent-runtime.ts` shim, `a2ui-live.ts`,
  `agent-admin`'s dev overlay (ADR-0136), and the `src/live-agent` tests re-point imports
  (`tools/agent/*` → `src/agent/*` or `@agent-ui/a2ui/agent` where cross-package); the two demo
  transcripts gain explicit pass-in call sites. No behavior change anywhere — the byte-identity and
  round-trip gates prove it.
- **The a2a arena and any future in-repo agent surface** get the same first-party path a consumer
  gets — one producer implementation, no more site-internal reach-arounds.
- **Stale → re-verify at the build wave:** SPEC-N1 v0.5 + LLD §0/§2 (clause 6) · CLAUDE.md's a2ui
  Layout row (mention the `./agent` surface) · the vitest-alias caveat from ADR-0055 (a cross-package
  TEST importing `@agent-ui/a2ui/agent` needs its alias row) · the site-canon reach-out notes citing
  `tools/agent` paths · TKT-0072 flipped per its acceptance.

## Acceptance

This is an **intake** ADR — realized in stages:

- **Intake (this change):** this record passes the ADR gates and is indexed; F1–F4 carry firm
  recommendations; TKT-0072 Findings updated. No code changes.
- **Build (separately dispatched, post-ratification):** the `src/agent/` move + barrel + the
  `"./agent"` exports entry; the clause-8 gates standing and green (identity · SDK-free · Node-fence ·
  prompt byte-identity); SPEC v0.5 + LLD §0/§2 repaired in the same change; the clause-7 server-side
  example + the clause-5 corpus recipe documented; `npm run check && npm test` green with no key;
  independently reviewed (generator ≠ critic).

## Alternatives considered

- **A sibling `@agent-ui/agent-toolkit` package.** Rejected (F1): forces a2ui internals public or
  duplicates them; adds a DAG node for zero isolation benefit — the toolkit is not a generic family,
  it is a2ui's own producer half.
- **Point the exports map into `tools/agent/` in place (no move).** Rejected: `tools/` is the
  Node-shell directory boundary ADR-0062 made greppable and trip-wireable ("the core computes, the
  shell does IO"); exporting through it erases that boundary, and the modules would stay outside the
  typecheck include — a public surface that `tsc` only checks transitively is not an honest contract.
- **Re-export the toolkit from the root barrel (no subpath).** Rejected: producer/loop/prompt code in
  every renderer consumer's bundle — the exact failure the `./examples` subpath pattern was built to
  prevent (ADR-0055).
- **Vendor an LLM SDK to make the pack "friendlier".** Rejected: "a runtime dependency in costume"
  (ADR-0107, verbatim); plain-`fetch` adapters behind the `AgentProvider` seam are the ratified law
  (ADR-0069/0073), and the standing grep gate enforces it.
- **Platform-neutralize the prompt loading first, export second.** Rejected as sequencing (F3): it
  re-opens the just-shipped ADR-0135 build for a hypothetical consumer; the injection seam is additive
  later.
- **Do nothing — keep the toolkit site-internal.** Rejected: TKT-0072's screenshots are the standing
  cost — every consumer re-solves "make the model emit real A2UI" from scratch and predictably ships
  markdown box-art instead; the render side already shipped and waits on exactly this half.
