# A2UI — the current frontier

> The living state-of-the-build note for `@agent-ui/a2ui`. **The ground truth is always
> `git log -- packages/agent-ui/a2ui/` + the realized modules and their co-located probes** — this
> file only orients; when it disagrees with the tree, the tree wins and this file gets repaired.
> Build seat: the **`a2ui-builder`** agent (`.claude/agents/a2ui-builder.md`) — one unit per
> dispatch, spec-faithful, escalates protocol-silence to the host. · updated 2026-07-08

## Realized (verified against the tree, 3543 jsdom + 1178 browser tests green repo-wide)

- **A1 runtime foundation** — the shared validation spine (`renderer/validate.ts` +
  `corpus/validate.ts`, SPEC-N6 parity) + `surface.ts`/`parser.ts` (streamed payload parse) +
  `tree.ts`/`renderer.ts`/`widget.ts`/`types.ts`.
- **The full binding arc** — `binding.ts` (per-path waking via Object.is + structural sharing) ·
  `interpolate.ts` (ADR-0027 `${…}`) · `fn-expr.ts` (ADR-0028) · `functions.ts` + `@index`
  (ADR-0026) · `checks.ts` (ADR-0029 → `setCustomValidity`) · `input.ts` (LLD-C8 two-way) ·
  `list.ts` (LLD-C6 positional reconcile, ADR-0024) · `action.ts`/`dispatch.ts` (ADR-0011) ·
  `call-function.ts` (ADR-0034, `callableFrom` most-restrictive-wins) · the two-code wire-error
  boundary (ADR-0031).
- **Catalog** — `catalog/` (catalog + conformance + naming + registry + `default/`), bound
  directly to `ui-*` factories (SPEC-R8); the G9 container types + the canvas demo shipped.
- **The components dependency (PRD Assumption A-2 ≈ G7) is SATISFIED** — G7 completed 2026-07-01
  (`ui-field` + `ui-form-provider` + the keyboard-proven end-to-end form; goals §G7 DONE).
- **The corpus STORE** — **DONE 2026-07-03** (ADRs 0060–0064, `a2ui-corpus-store.lld.md` v0.5,
  decomp `a2ui-corpus-store` v5). The full admission pipeline is realized: `record.ts` (schema +
  SPEC-R2/AC3 single-surface rule) · `canonical.ts` (async crypto.subtle hash, order/whitespace/
  ID-spelling invariant) · `heal.ts` (ADR-0061's closed, form-only repair list — the fleet's ONE
  shared healer, ready for the future streaming codec) · `dedup.ts` (exact + MinHash θ=0.9
  inclusive) · `store.ts` (byte-stable JSONL, quarantine exclusion) · `admit.ts` (validate → heal
  → dedupe → record, the §8 error table as its test matrix, an injected-judge seam that fails
  closed on the eval facet until the harness exists) · `retrieve.ts` (TF-IDF top-k, hard
  exemplar-only eligibility) · `export.ts` (fine-tune JSONL + catalog-examples, the latter built
  against a **host-verified** upstream shape — google/A2UI's `dataset_schema.json` +
  `schema/manager.py`/`catalog.py`, cited verbatim in the test fixture). Exposed at the
  `"./corpus"` subpath (`src/corpus/index.ts`); root barrel proven corpus-byte-free tree-wide.
  The 11-seed shelf (ADR-0055) is imported and committed (`corpus/exemplar/v1_0/agent-ui.jsonl`),
  guarded by a standing check-time gate (`corpus-data.test.ts`) — this also closes the
  `danger`-tone item below's sibling ask, the package-side corpus probe. Independent review: GO,
  zero blocker/major; two LATENT minors booked below.
- **The expert harness** — **DONE 2026-07-04** (ADRs 0067–0068, `a2ui-expert-harness.spec.md` v0.2,
  `a2ui-harness-wiring.lld.md` v0.2.1, decomp `a2ui-expert-harness` v2). The v0.1 design (4 skills,
  3 maker agents, gate scripts, a Node loop driver) right-sized onto the realized corpus store:
  TWO skills (`a2ui-compose` — merged patterns+composition+the SPEC-R6 loop; `a2ui-corpus-curate` —
  a thin pointer over the shipped pipeline) · ONE maker/critic agent pair (`a2ui-composer` graded
  by `a2ui-payload.md`; `a2ui-reviewer`, the critic that also authors ADR-0068 verdicts files) ·
  THREE rubrics (`a2ui-payload.md`, `a2ui-catalog.md`, `a2ui-corpus.md` — the last IS the runtime
  tier-2 quality standard, not just a doc) · the `validate-payload.ts` CLI (the loop's deterministic
  gate) · `scripts/harness_wiring_check.py` (the governance proof, manual gate). **The ADR-0060
  judge seam is ACTIVATED**: `src/corpus/judge.ts` (a pure verdicts-file adapter) + `store.ts`'s
  `includeQuarantined` + the amended standing gate (quarantined lines now legal in the shard,
  tier-1/hash skipped for them) + `tools/corpus/rescore.ts` (back-scoring) + `import-seeds.ts`'s
  `--verdicts`/`--replace` (the judged quarantine exit — now GUARDED to require `--verdicts`,
  closing a real gap an independent review caught: `--replace` alone silently skipped judging).
  All 11 phase-1 shard records adversarially graded and back-scored to `qualityScore: 4` (byte-
  stable shard diff — only that field changed); `E_QUALITY` proven end-to-end via a real
  plant/revert cycle. A reference artifact (a newsletter-signup payload) cleared the full
  compose→validate→critique loop in round 1, all 7 payload-rubric dims ≥4 — candidate for a future
  `src/examples/` shelf addition or a committed test fixture (not admitted this wave). Two
  independent whole-wave reviews: GO both times, one real MAJOR fixed (the `--replace` guard
  above), two minors booked as follow-ups below. Corpus LLD-C12 SPLIT: the judge half is now done;
  the Inspect-AI scoring/lift half stays deferred with corpus LLD-C8 (the first eval record).

- **The A2UI-close + A2A wave — DONE 2026-07-07** (merged to `main`, ADRs 0087–0106). The a2ui-relevant
  slices: **ADR-0099** (`path:"/"` root alias honored at all three apply-sites — `renderer.ts` ·
  `corpus/canonical.ts` · `corpus/admit.ts`; `setPointer` stays RFC-6901-pure) · **ADR-0102** (the
  CSS-less-consumer law: no rendered-correctness concern may live only in page-author CSS — three lanes:
  component-owned default / catalog prop / taught idiom, with a chooser; ADR-0103..0106 are its first
  applications) · the **`form-rhythm` mini-skill** (ADR-0103's Lane C recommendation, the ADR-0091
  registry's 6th module, 2026-07-08) · the six-ADR gallery-defect wave (0101–0106: overlay
  always-announce + the mouse-open prop-flip pattern, radio-group layout, calendar fluid tracks, Text
  `truncate`). **The A2A section** shipped as its own sibling package `@agent-ui/a2a` (wire types +
  validation pinned v0.3.0, the isolation-proven tic-tac-toe arena + a real recorded flagship match,
  the concept/demo corpus + `site/a2a-concepts` · `a2a-tic-tac-toe` · `a2a-artifact-feed` pages) —
  and the **B6 bridge** (`tools/pipeline/transports/a2a.ts`: one A2UI envelope per
  `application/a2ui+json` DataPart, `a2uiClientCapabilities` on every client message) is the
  pipeline-tail's FIRST realized transport (see Open 1).

## Open (the real next intakes, in likely order)

1. **The streaming pipeline tail** — RECONCILED at v0.2 (2026-07-02): every CONSUMER-side streaming
   behavior is realized in the renderer (parse/fault-isolation/arrival-order/render-on-root); the
   pipeline's OWN scope (codec · driver · transports · MCP — LLD-C1..C7) stays deliberately unscoped
   until a producer need arrives — EXCEPT the first transport, the A2UI-over-A2A bridge
   (`tools/pipeline/transports/a2a.ts`, 2026-07-07 — see the wave bullet above). Healing belongs to the corpus store's
   ONE shared healer (`corpus/heal.ts`, ADR-0061 — now realized, text-first signature designed for
   per-line codec reuse). The programmatic generate→verify loop driver (harness SPEC-R6, procedural
   only today) is this wave's named trigger too — the first real programmatic generator. The
   STREAMING EXAMPLE shipped (`site/a2ui-stream` — root-early vs root-last on the shared seed, the
   live first-paint metric, mid-stream fault isolation).
2. ~~G7-unblocked integration work~~ — **DONE 2026-07-02** (ADR-0053/0054, decomp
   `a2ui-form-catalog-examples`): six catalog rows (Field · FormProvider · Checkbox · Switch ·
   Select · Option) + the 12-type TextField reach + the submit-gated action; the examples suite is
   now FOUR pages (canvas · dynamic list · **generative form** · **patterns**), all wired into the
   dual TOC. Follow-ups it minted: a `danger` Button tone (the P2 confirmation pattern exposed the
   gap — components backlog; still open) · ~~a check-time demo-payload validity gate~~ — **DONE**,
   see the corpus store's `corpus-data.test.ts` above · defer `<ui-calendar>` element creation to
   first-open (ADR-0048's lazy spirit; the eager element is guarded but still built — still open).
3. ~~The live-agent example~~ — **DONE 2026-07-05** (ADRs 0069–0073, `a2ui-live-agent.spec.md` +
   `.lld.md` + decomp, all accepted). The ladder's last rung is visible: the `site/a2ui-live` demo
   chat app — layout `[ chat | a2ui-canvas ]`, the canvas a TABS pane (Canvas translate-centered ·
   JSON · HTML, each a `<pre><code>`). A real LLM emits A2UI over the wire — prompt → streamed
   payload → rendered REAL surface → the human interacts → client messages return → the agent
   continues (multi-turn, stateless proxy; session state client-side). Built behind the
   **`AgentTransport` seam** (SPEC-R1): the DEFAULT is a deterministic RECORDED backbone (offline,
   CI-covered, ships in the static build) + a **dev-only** live overlay (Vite-proxy, `import.meta.env.DEV`-
   guarded dynamic import ⇒ tree-shaken from `vite build` — proven: `dist/` carries no overlay
   module, proxy path, key name, or endpoint). The runtime is the bounded **retrieve→generate→
   validate→self-correct** loop (`produce.ts`, maxRounds 3, VALIDATE-THEN-STREAM — nothing invalid
   ever paints), reusing the SHARED validator + `corpus/heal.ts` + `retrieve()` over the JUDGED
   11-record shard (no fork). Provider seam is **config-driven** (`providers.json` — Anthropic
   implemented via plain `fetch`/SSE, OpenAI/Gemini registry stubs `implemented:false`); the proxy
   is the **trust boundary** — it holds the key server-side + validates the `{provider,model}` PAIR
   (`resolvePair`) and passes the VALIDATED model AUTHORITATIVELY (a crafted `input.model` cannot
   escape the allowlist — SPEC-R12, gate-covered). 8 standing test files / 23 tests, zero-dep. Two
   independent reviews (layout + harness, generator≠critic): GO after one MAJOR (the model-authority
   bypass, now fixed + gated) and six minors, all applied. Also shipped along the way earlier: ADR-0056
   (the region-less card humane default + container pedagogy) · validator/dispatch envelope parity ·
   `type=date`'s calendar built on first-open.

## Corpus-store follow-ups (from the 2026-07-03 wave, all latent/safe-direction — none blocking)

- `admit.ts`'s `computeScopes` lacks the absolute-path short-circuit `renderer/binding.ts`'s
  `scopedPointer` has — a nested dynamic-list with an absolute INNER template path would be
  mis-scoped and false-rejected E_POINTER. No seed reaches this; fix is a one-line mirror of the
  `startsWith('/')` branch.
- `admit.ts`'s `findUnresolvedPointers` scans disconnected components that `canonical.ts` drops —
  an orphan component with an unresolvable relative binding is rejected though the renderer never
  mounts it. Safe-direction (over-strict), latent.
- The purity-grep tests in `index.test.ts` key on `from\s+['"]`, blind to dynamic `import()` —
  harmless today (zero exist under `src/corpus/`), a future-violation blind spot only.
- `corpus-data.test.ts`'s standing gate re-validates schema/tier-1/hash but not admission's
  pointer-RESOLUTION stage — a hand-edited shard line could pass the gate while failing `admit()`.
- `catalog/default/index.ts`'s bare `import catalogDoc from './catalog.json'` fails under Node's
  native ESM loader (`ERR_IMPORT_ATTRIBUTE_MISSING`, ESM wants an explicit `type:'json'` import
  attribute Node won't infer) — worked around Node-shell-side in `tools/corpus/import-seeds.ts`;
  a `with {type:'json'}` fix upstream is components/catalog territory, not a2ui's.
- No `@agent-ui/a2ui` line-item exists in `scripts/measure-size.mjs` — acceptable by construction
  today (no consumer bundle carries corpus bytes; the package is in-repo-only); mint one at the
  first external consumer of `@agent-ui/a2ui`, per ADR-0040 §3's manual-size discipline.

## Expert-harness follow-ups (from the 2026-07-04 wave, both minor/latent — none blocking)

- `scripts/harness_wiring_check.py`'s self-grade regex (`_REFLEX_SCORE`) has real blind spots —
  verb-immediately-before-reflexive-pronoun constructions are caught, but possessive/reordered
  phrasing ("trusts itself to grade", "is the sole judge of its own output") slips through. Not
  currently exploited (both shipped maker files read clean), but the mechanism itself is fragile
  for any future maker file — a stronger detector is a candidate hardening item, not a fix owed now.
- `a2ui-compose`'s routing description over-triggers on at least one adversarial phrase its own
  routing corpus never tested ("the payload validator in the a2ui package needs a new check for
  this catalog type" — genuinely `a2ui-builder` territory, scores above threshold). Low severity
  per the tool's own tripwire-not-certification policy; worth widening the negative corpus if the
  routing seat is touched again.

## Live-agent follow-ups (from the 2026-07-05 wave, all minor/latent — none blocking)

- OpenAI + Gemini are registry rows (`implemented:false`) with stub adapter modules — the seam is
  wired (switcher disables them, proxy degrades, dispatch table omits them) but no real adapter
  exists; landing one is "add the module + one `IMPLEMENTED` entry" (mirrors `anthropic.ts`).
- The live path is PROVEN end-to-end (2026-07-05): one real Anthropic turn streamed a valid
  `createSurface`+`Button` back through the proxy. The key is resolved server-side via Vite's
  `loadEnv` merged over `process.env` (the dev-proxy fix — a bare `process.env[envKey]` read missed
  the `.env`-only key, the "no live API key found" degrade). Real-model acceptance stays MANUAL by
  design (needs a key + network; SPEC-R3) — the loop MECHANICS are stub-gated; no STANDING test drives
  a live model, and the `dist/` key-leak grep is likewise manual (the `npm run size` precedent).
- `.env` hygiene: the repo-root `.env` carries redundant `VITE_ANTHROPIC_API_KEY` / `VITE_OPENAI_API_KEY`
  / `VITE_GEMINI_API_KEY` copies (for the DEFERRED browser-direct arm). They are inert today — Vite's
  `envDir` is `root: 'site'` and there is no `site/.env`, so the repo-root `.env` is never loaded into
  `import.meta.env`, AND the build-key-safety gate proves no code reads `import.meta.env.VITE_*`. But
  they are a latent footgun if `envDir` ever moves to the repo root; recommend deleting the three
  `VITE_*` lines until the browser-direct arm is actually built (user owns `.env` — not edited here).
- The dev-proxy rejects an over-`MAX_BODY` request via the generic 500 catch, not a 413; it also
  doesn't `req.destroy()` on the cap, so an oversize body keeps buffering until the socket ends.
  Dev-only, localhost-bounded — cosmetic/hardening, not a correctness gap.

## Post-ship canvas/agent refinements (2026-07-04, gate-green; ADRs 0075/0076 ACCEPTED 2026-07-04)

Driven by live-agent output against the real canvas — all shipped, all gates green:

- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) added to the Anthropic registry row (selectable
  in the switcher; proven with a real turn). Data-only — the ADR-0073 registry is the SoT.
- **Dev-proxy re-reads `providers.json` PER REQUEST** (catalog + shard stay loaded once) so a registry
  edit needs no dev-server restart — the switcher (HMR-reloaded) and the PAIR-allowlist can't drift
  (the Haiku-4.5 `400 unknown-model` symptom). Recorded as an ADR-0069 realization note.
- **`ui-column` refinements ([ADR-0075](../adr/0075-ui-column-canvas-root-stretch-no-center.md), accepted):**
  a column-local `stretch` boolean prop (`width: stretch`, fill cascade) the canvas sets on a ROOT column
  so the surface fills the artboard (a root column shrink-collapses under `align-items:center` +
  `container-type:inline-size`); AND `align="center"` PROHIBITED on `ui-column` (enum narrowed +
  `Column.align` drops center; Row keeps it). The canvas gained a definite-width artboard too.
- **The renderer honors catalog-declared `enum`s ([ADR-0076](../adr/0076-renderer-honors-catalog-declared-enums.md), accepted):**
  the widget resolver skips a LITERAL value the PropDef enum doesn't list — the mechanism that makes the
  `Column.align` narrowing (and every catalog enum) effective in the DOM (the factory's property-set path
  bypassed the component's own coercion; the wire validator checks type, not enum membership). Pure
  cleanup — such values were already CSS-inert. Validator-level enum enforcement + self-correct is the
  named future extension (broader blast radius; deferred until the corpus is known-clean).
- A reference live-agent payload (the compose loop's round-1 clear) is not yet committed as an
  `src/examples/` fixture — candidate shelf addition, same as the harness wave's newsletter payload.

## Docs-site Generative-UI playground (2026-07-04, gate-green; ADR-0077 ACCEPTED 2026-07-04)

The a2ui-relevant slice of the docs-site wave ([decomp](../decompositions/site-preview-catalog-adr.decomp.md) · [ADR-0077](../adr/0077-docs-site-genui-playground-preview-catalog-adr-index.md)):

- **New live catalog consumer** — `site/a2ui-catalog` renders EVERY `defaultCatalog` component through the real renderer via a site-local `<component-preview mode="a2ui">` element (metadata ← `catalog.json` props; a live-knobs playground per type; the specimen is authoritative for its own state, read-back-before-rebuild). A second mode previews `ui-*` controls off their `{name}.md` descriptor. Derived, not hand-authored; pinned by `site-preview-catalog.test.ts` (hand-authored sample-tree maps ⊆ catalog names).
- **`catalog.json` `Button.variant` tightened → `enum:["solid","soft","ghost"]`** (was an un-enumerated string) — brings the catalog into agreement with the control's own declared enum; **realizes [ADR-0076](../adr/0076-renderer-honors-catalog-declared-enums.md) for Button** (the renderer now skips a non-member variant) + gives a2ui-mode Button a chip switcher. Verified safe: every example uses `solid`/`soft`; corpus unaffected.
- Deferred (a2ui-adjacent): consolidate the `a2ui-live` canvas onto the new shared `site/lib/canvas-surface` module (currently a proven CSS copy).

## How to start a unit

Dispatch `a2ui-builder` with the unit's `SPEC-R#`/`LLD-C#` IDs. For anything needing a NEW
decision: `system-planner` first (decomposition + ADR), per the operating model. Cross-package
needs (a component-side prop/event) escalate to `component-builder` territory via the coordinator.
