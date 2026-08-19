---
name: a2ui-prompt-authoring
description: >-
  Author or edit the A2UI producer's PROMPT STACK — grammar.md, the mode files, the
  prompts/mini-skills/*.md registry, AND the rest of the byte-pinned prompt surface under
  packages/agent-ui/a2ui/src/agent/prompts/ (genui-packs/, genui-dogfood-teaching.md,
  honesty-floor.md, builder-mission.md — all ride the SAME golden baseline/gates) — without breaking
  those gates. Use when adding/editing a mini-skill idiom module or a genui pack, changing
  grammar/mode/teaching prose, engineering trigger vocabularies, or when a red prompt-equivalence
  gate needs the deliberate-change recapture flow. Carries the token budget, the TF-IDF trigger-set
  mechanics, the restart-vite rule, and the teaching-lane triage for recurring model misbehavior.
  NOT for composing payloads (a2ui-payload-authoring), producer/renderer CODE (a2ui-build-agent), the composed
  persona/admin prompts (component-owned, agent-admin), or corpus exemplars (a2ui-corpus-curation).
user-invocable: true
disable-model-invocation: false
---

# Author the A2UI producer prompt stack

The producer's system prompt is COMPOSED, not written: `buildSystemPrompt` (src/agent/system-prompt.ts)
assembles catalog law + exemplars + mode prose (ADR-0090) + intent-selected mini-skills (ADR-0091) + an
optional persona tail (ADR-0138) from prompt FILES under `src/agent/prompts/` (ADR-0135 — grammar.md, the
mode files, `mini-skills/*.md`). This skill is the editing discipline for those files; distilled from the
TKT-0077/0080/0081 game-loop arc, where every lesson below was measured live.

## The byte-pinning law (read before any edit)

`src/live-agent/prompt-equivalence.baseline.json` is a GOLDEN reference: the four composed prompts
(default/defaultExplicit/specific/blueSky) and every mini-skill's id/triggers/body, byte-identical.
Its own rule: regenerate ONLY on a DELIBERATE text change — never to green a red gate you don't
understand. After any deliberate edit, re-capture with the CHECKED-IN writer (GH #748 — the old
copy-pasted scratch snippet in this file froze at 5 of the baseline's keys and destroyed the golden
reference when run; the writer now lives next to the gate it feeds, so the captured shape can never
drift from the asserted shape):

```sh
RECAPTURE_BASELINE=1 npx vitest run --project packages \
  packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts
```

The full baseline shape is owned by `prompt-equivalence.test.ts`'s `Baseline` interface — never
carry a copy of its key set anywhere (this file's own past mistake). A mini-skill-only edit changes
only the `miniSkills` section; a pack edit only `genuiPacks`; a grammar/mode edit changes the
composed prompts too. Diff the baseline after recapture — an unexpected delta means you touched more
than you meant to, and an armed run on an UNCHANGED tree is a byte-identical no-op (the self-check).

## Mini-skill modules (`prompts/mini-skills/*.md`)

- **Shape:** `---\nid: <kebab>\ntriggers: <space-separated intent vocabulary>\ncatalogId: <catalog id>\n---\n<body>`
  — single-line frontmatter values, body trimmed on load (whitespace edges never matter). ALL THREE
  frontmatter fields are required: the loader THROWS on a missing `catalogId` (`mini-skills.ts`'s
  SPEC-R6 hard filter — a module is retrievable only for its own catalog; GH #748 caught this field
  missing from the shape spec entirely).
- **Budget:** body ≤ ~200 tokens (`chars / 4`, gated by `mini-skills.test.ts`). Trim prose, never
  frontmatter. The count pin in that test moves when you add/remove modules.
- **Catalog-grounded ONLY:** every component/prop the body names must exist in
  `catalog/default/catalog.json` at its WIRE name (Stat's wire prop is `value`, not the DOM `figure`).
  Verify — there is no Divider, for example; teaching one causes validate-loop churn.
- **No A2UI JSONL in a body** (gated) — teach anatomy/mapping/walls in prose.
- **The ★ calibration trio** (`card-game-sheet` / `settings-screen` / `dashboard-kpi-grid`) is composed
  into `NEGOTIATE_BLUE_SKY`'s calibration bullets BY ID (`system-prompt.ts`) — never rename or remove
  these without touching that composition.

## Component clauses bound BOTH axes (routing + content shape)

Every component clause in grammar/pack prose bounds WHEN to use the component AND what its content
may look like — length, casing, quantity limits. A clause that routes without shaping invites
well-routed garbage: GH #1279 — Badge was bounded on when-persistent-status but not on label
length, so models emitted sentence-length pill headlines; fixed by bounding the label in the
clause itself (PR #1280).

## Trigger engineering (selection is TF-IDF cosine, cap 3/turn)

`selectMiniSkills` ranks `triggers` against the USER's turn text (`topKByCosine`, zero-score never pads).
Mechanics that follow:
- A **shared trigger core** makes a SET ride together on terse intents — the game trio shares
  `deal blackjack poker game`, so bare "deal me in" selects exactly those three (pinned by a test).
- **Distinct per-area nouns** keep modules separable on specific intents ("show the score" favors the
  HUD module despite the shared core — shared terms get low IDF, distinct terms dominate).
- Selection sees ONLY the user text — persona/capability prose never influences it.

## Runtime + verification

- The registry and prompt files load at MODULE LOAD inside the dev proxy's import graph — **restart the
  vite dev server after any prompt edit**; HMR does not reload them. Paths resolve from `process.cwd()`
  (never `import.meta.url` — the vite-temp bundling trap, noted in mini-skills.ts).
- Verify a teaching change LIVE, not just by gates: one real produce turn through the page or a curl to
  `/__a2ui/agent`, checking the RENDERED result (the TKT-0080 class validates cleanly and still renders
  wrong).

## Triage: recurring model misbehavior (before you prompt-nudge)

The arc's ordering, cheapest-correct-first:
1. **Is the rule taught at all?** TKT-0080: models authored `{"path":"/glyph"}` in templates because the
   grammar taught templates in one line and never the relative-path rule. A recurring mistake with no
   teaching is a grammar gap, not model noise.
2. **Do the gates contradict each other?** TKT-0081: the session-blind per-round validator REQUIRED
   `root` while the renderer FORBADE resending it — the model's "misbehavior" was its only legal-looking
   escape. Read the enforcing code's actual rules before adding teaching or a second enforcer; a
   structural trap needs a code fix (there: session-seeded validation), not prose.
3. **Only then sharpen prose** — and prefer teaching the MECHANISM over adding a guard sentence
   (TKT-0077's guard sentence aimed at a wrong hypothesis and changed nothing).

## Worked precedents

TKT-0077 (the game trio + budget/trigger mechanics) · TKT-0080 (the relative-binding teaching gap,
wire-captured) · TKT-0081 (the contradictory-gates deadlock) — all with full Findings in
`.claude/docs/tickets/`.
