---
doc-type: ticket
id: tkt-0005
status: done
date: 2026-07-09
owner:
kind: feature
size: big
---
# TKT-0005 — a knowledge-skill + forge-skill suite for planning and creating new/novel components

## Summary
Kim's ask (2026-07-09): "plan out a full comprehensive set of knowledge-skills and then
forge-skills for planning and creating new and novel agent-ui components." The knowledge itself
already exists — the nine-doc canonical corpus in `.claude/docs/references/` (anatomy · geometry
law + sizing spec · tokens · interaction-states · packaging · foundations · best-practices ·
dimensional-standard[superseded]) — and the build/review seats exist as agents (`component-builder`,
`ui:component-reviewer`, `example-builder`). What does NOT exist is the **skill layer**: no
repo-local skill makes the corpus routable (today only `component-builder`'s own prompt cites it),
and no skill encodes the **design-intake procedure** for a new or novel component — that procedure
currently re-derives itself in host orchestration every time (TKT-0003's theme-provider intake is
the live example). This ticket is the plan of record for that suite.

## Planned roster (the "plan out" deliverable)

**Knowledge-skills** — thin, routable, cite-don't-copy (the house anti-drift law: the corpus in
`references/` stays the single owner; a skill that restates it is the drift it exists to prevent):

- **K1 `component-standards`** — the normative law layer for design-time questions: anatomy
  (position slots × content roles), the geometry law (§1 eight-row ramp, the (scale × size) →
  §1-row lookup, stepping), interaction states (hover/active/focus/disabled + focus-ring),
  color-token roles, the control-class frame laws (entry-control min-inline-size floor etc.).
  Routes to `anatomy.md` · `geometry.md` (+ `geometry-sizing-spec.md` for rationale) ·
  `interaction-states.md` · `tokens.md` · the foundations/best-practices pair.
- **K2 `component-packaging`** — build-time shape: per-component folder, single `{name}.css`
  (`@scope`, `--ui-{name}-*`), barrels/exports, the `{name}.md` descriptor, size budgets.
  Routes to `component-packaging.md` + the plan §5 API surface.
- **K3 `component-testing`** — the per-control definition-of-done as a routable bar: jsdom +
  cross-engine browser probes, the whole-shape lesson (test-the-whole-shape), the built-output
  regression class (TKT-0002 `light-dark()` — proofs must be `.browser.test.ts` against real
  builds), descriptor/contract trip-wires, the gates (`check` + `test` + manual `size`).
- **K4 `component-patterns`** — the "which prior art applies" map for novel work: the traits seam,
  overlay dismissal (ADR-0045), container box-model (ADR-0046), value-codec (ADR-0044/0047),
  provider/context (ADR-0050), form labelling (ADR-0051), pure-core + subpath packs (ADR-0065/0066)
  — each entry one routing sentence + the owning ADR link, never the content.

**Forge-skills** — the procedures:

- **F1 `component-design`** — the design intake for a NEW component, the piece with no home today:
  intent extraction → control-class + tier classification → the standard fork sheet (geometry-row
  assignment, anatomy slots/roles, props + event vocabulary — names ∈ the fleet's event set,
  token roles, a11y/`ElementInternals` model, catalog exposure or exclusion) → ADR only when a
  fork is contract-changing (the ADR-default-no ruling; never self-ratified) → decomposition +
  per-control test plan. Carries the **novelty leg**: what to do when NO precedent row/class fits
  (derive from the geometry spec's mechanics, propose the new row/class as an ADR fork — the
  ADR-0048 ui-calendar precedent).
- **F2 `component-create`** — the ordered build procedure, extracted from `component-builder`'s
  prompt into a skill BOTH the agent (via `skills:` preload) and the host share, ending at the
  K3 bar + the mandatory `ui:component-reviewer` pass (generator ≠ critic). The agent keeps the
  seat; the skill owns the procedure — one owner, two consumers.

**Wiring** — `component-builder` gains `skills:` preloads for K1–K3/F2 (its prompt's canonical-
sources list shrinks to the seat contract); front-matter on every new skill accurate per the
operating contract (descriptions drive routing); the generic `ui:component-forge` plugin skill
stays the method spine (Compose × Realize) that F1/F2 cite, not duplicate.

## Acceptance
- Each skill exists repo-local (`.claude/skills/` — the `docs-author`/`a2ui-compose` precedent),
  lint-clean, with accurate front-matter (name/description/trigger) and references that resolve.
- Knowledge-skills contain routing + reading order ONLY — the corpus stays in
  `.claude/docs/references/`; a grep for restated normative content (e.g. §1 ramp integers inside
  a skill body) comes back empty.
- F1 run against a real intake (the next new component) produces the fork sheet + decomposition
  the house process expects, without host re-derivation.
- `component-builder`'s preloads updated in the same change; its prompt no longer duplicates what
  F2/K1–K3 own (service-agents-on-contact).
- Independent review: `forge:skill-auditor` on every new skill; `forge:agent-reviewer` on the
  re-wired `component-builder` (maker never grades its own).

## Links
- `.claude/docs/references/` — the nine-doc corpus (the knowledge these skills route to).
- `.claude/agents/component-builder.md` — the build seat whose prompt currently carries the
  canonical-sources list F2 extracts.
- `ui:component-forge` (nonoun-plugins/ui) — the generic two-axis method; cited, not duplicated.
- `.claude/skills/docs-author/` — the repo-local skill shape precedent (anti-drift, references/).
- TKT-0003 — the live example of a component intake re-derived by hand (what F1 obsoletes).

## Scope / Open
- **Granularity fork — RESOLVED (Kim, 2026-07-09):** four knowledge-skills, per the routing-
  precision argument; Kim additionally ruled the whole suite is **namespaced `agent-ui-*`**
  (`agent-ui-component-{standards,packaging,testing,patterns,design,create}`) and directed the
  full buildout to proceed.
- **Home fork (resolved by default, correctable):** repo-local `.claude/skills/`, NOT the ui
  plugin — the content is agent-ui-specific law; the plugin stays generic.
- **Non-goal:** no new reference corpus — the knowledge exists; this is a routing/procedure layer.
- **Non-goal:** no changes to `ui:component-reviewer` or its rubric (already skill-shaped via
  component-forge).
- **Sequencing:** knowledge-skills first (F1/F2 preload them), then F1, then F2 + the
  component-builder re-wire, then the review pass.

## Findings
### 2026-07-09 — shipped: six skills authored, 7-seat independent audit, all findings closed

- **Built (Kim's rulings applied: `agent-ui-*` namespace, four knowledge-skills, full
  buildout):** `.claude/skills/agent-ui-component-{standards,packaging,testing,patterns}`
  (knowledge — model-only routing over the `references/` corpus, both invocation dials
  explicit per the repo skill-lint hook) + `agent-ui-component-{design,create}` (forge —
  the intake and build procedures, user-invocable). `component-builder` re-wired to preload
  `agent-ui-component-create` as its method (the `a2ui-composer` precedent); its def shrank
  to the seat contract.
- **Audit wave (6× `forge:skill-auditor` + 1× `forge:agent-reviewer`, parallel):** all seven
  verdicts PASS/GO after fixes. Real catches: F1/F2 classified against a PHANTOM base class
  (`UIComponent` — planned in plan §5, realized nowhere) and a nonexistent scaffold dir
  (`components/{name}/` — reserved, unwired); the "Tier" axis was the size-class wearing a
  wrong 3-value enum (the schema's `SIZE_CLASSES` is the seven-value authority, `tier:` IS
  the recording); K2/F2 carried an already-drifted 12-of-14 descriptor field enumeration
  (now cite `FIELD_SHAPE`); K4 routed traits to ADR-0042 (which argues AGAINST traits for
  its problem — row split) and over-claimed proposed ADR-0117 as ratified (now marked);
  citation hygiene fixes throughout. Delta re-audit on the F1 step-3 rewrite: PASS.
- **Collateral repairs the audit surfaced (same wave, keep-context-live):** CLAUDE.md's
  stale "traits registered via `host.use()`" line fixed (source says there is no
  `host.use()`); a literal NUL byte in `component-descriptor.ts`'s `NON_MEMBER` sentinel
  (made grep treat the schema source as binary — silently blinding any routed agent)
  replaced with the backslash-u0000 escape, 150/150 descriptor tests green.
- **Still owed:** F1's shakedown against the next real component intake (the acceptance's
  live-fire criterion — by design it can only run when the next intake arrives).
  ADR-0117's ratification remains with Kim.
