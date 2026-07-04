---
name: docs-author
description: >-
  Author or maintain a page of the agent-ui docs SITE (`site/`) to the standard shape. Use when adding
  or updating any `/site` page — a landing, the permutation matrix, the states showcase, a component API
  doc, the live A2UI demo, a conceptual guide, a family overview, a playground, or a recipe — or auditing
  the site for drift ("document ui-text-field", "add an API page", "is this doc going to drift", "write
  the theming guide"). Pick the content type, derive the page from its canonical source (the {name}.md
  descriptor, the real renderer, the props enum, the token roles) instead of hand-maintaining it, wire
  the deterministic drift-gate that backs it, and score it against the type's rubric.
---

# Authoring docs

The one procedure for authoring a page of the agent-ui docs **site** (`site/`), so a growing component
fleet doesn't grow a hand-maintained doc set that rots out of sync with it. Like
[[component-author]], it is **anti-drift by construction**: the right page derives from a canonical
source and is backed by a deterministic check, so it cannot silently diverge from the thing it
documents. This skill is the *method*; the per-type depth and the rubrics live in `references/`.

## When to use / when not

- **Use** when adding or changing any `/site` page, documenting a new component, or auditing the site
  for drift. Triggers: "document this control", "add an API page", "write the getting-started guide",
  "will this doc drift".
- **Skip** for the *referential* docs under `.claude/docs/` (plan / goals / process / `references/`) — those are
  authored with [[reference-author]], not this. This skill owns the **published site**, not the
  repo's internal knowledge docs.
- **Generator, not critic.** You author *to* the rubric; a **separate** reviewer (the
  `docs-writer` agent, or the host gate) scores the page against it — build it to clear the gate,
  then hand off.

## The cardinal discipline — every fact derives from its owner

A docs page restates nothing it can **derive**. Every fact on a page has a single owner elsewhere in the
repo; the page is its *second consumer*, not a hand-transcribed copy (the copy is the precondition for
drift — `.claude/docs/process.md`'s drift disease). The four owners a site page derives from:

- **The descriptor** — `{name}.md` frontmatter is the attributes-as-API record. The API table and the
  enum-driven specimens are built from the canonical parser's `attributes[]` (ADR-0004, one parser / two
  consumers — `site/lib/frontmatter.ts` → `parseDescriptor`). Never hand-type an attribute row.
- **The real renderer / control** — a demo runs the *actual* `createRenderer` / mounts the *actual*
  `ui-*` control through its public surface, exactly as the transport or an app would. The page IS the
  integration proof, made visible (the `a2ui-canvas` precedent), not a screenshot or a mock.
- **The props enum** — variant/size specimen rows iterate the parsed enum members, so adding a variant
  to the descriptor adds its specimen for free.
- **The token roles** — page chrome consumes the `--md-sys-color-{family}-{role}` roles; a page **never restyles a
  `ui-*` control** (states/appearance belong to the control's own `{name}.css` — the "honest labels"
  discipline below).

What genuinely *can't* be derived (a structural anatomy shape, hand-authored prose under the fence) is
labelled as hand-authored and kept minimal.

## Method

1. **Classify the content type** — which of the nine in the taxonomy index below. The type selects its
   reference (content strategy + standards) and its rubric (what it must contain + score on).
2. **Locate the canonical source** the page derives from (descriptor · real renderer · enum · roles).
   If a type *has* a derivable source and you'd be hand-typing it instead, stop — that is the top defect.
3. **Author to the type's reference** — `references/content-types.md §<type>`. Derive where derivable;
   run the demo through the real renderer where it's live; honest labels where it shows state; keep
   hand-authored content minimal and flagged.
4. **Wire the drift gate** — the deterministic check that backs the page (the structurable disciplines
   below). Where a fact is structurable, a green check is its guarantee; where it's soft (prose
   staleness), note it for the reviewer's judgment. A page with no backing check, where one was
   possible, is not done.
5. **Score** against `references/rubric.md` (cross-cutting dims + the per-type addendum). Build until
   every gate dimension clears; then hand off to the reviewer (generator ≠ critic, above).
6. **Validate** (loop below) — run `npm run check && npm test`; fix; re-run until clean.

## The content-type taxonomy index

Nine page types. Each row: what it is · the canonical source it derives from · its drift gate. The
content strategy + standards for each is `references/content-types.md`; the per-type "must contain +
score on" is `references/rubric.md`.

| # | Content type | What it is | Derives from | Drift gate |
|---|---|---|---|---|
| T1 | **landing / overview** | the hero + the card grid that routes to every page (`site/main.ts`) | the live control (hero specimens) + the nav link set | every nav/card target resolves; the hero mounts the real control |
| T2 | **permutation matrix** | the full size × variant × state grid, built **programmatically** from the enum arrays (`permutations.ts`) | the props enum (loop bounds = \|sizes\|×\|variants\|×\|cols\|) | completeness provable from structure; no dead slot/role name (site-canon) |
| T3 | **states showcase** | the live control staged in each interaction state, **honestly labelled** (`states.ts`) | the control's own `{name}.css` (styling lives there, not the page) | the page sets no state styling; a real activation log proves pointer + keyboard |
| T4 | **component API doc** | the attribute table + enum-driven specimens, **descriptor-derived** (`button-doc.ts`) | `{name}.md` via the canonical parser (ADR-0004) | the contract trip-wire: frontmatter `attributes[]` ≡ `finalize(Class)` |
| T5 | **live A2UI demo** | a literal payload fed through the **real** renderer → a live control → the round-trip message (`a2ui-canvas.ts`) | `createRenderer` public surface (no internals) | the renderer integration test; the page is its visible proof |
| T6 | **conceptual guide** | getting-started / theming / architecture prose — the *why* and *how* | the canonical `.claude/docs/` it summarizes (cite by ID rather than restating) | soft (prose staleness → reviewer judgment); code samples must type-check |
| T7 | **per-family overview** | one page per component family — its members, shape, status | the catalog / the family's shipped descriptors | every shipped member listed; no member missing its page (enumeration) |
| T8 | **interactive playground** | live controls bound to inputs that drive their real attributes/props | the real control + its parsed enum (the input set) | every input maps to a real attribute; mounts the real control |
| T9 | **recipe / pattern** | a small, copyable, working composition answering a task ("a form row") | the real controls it composes | the recipe code runs (mounts live); samples type-check |

## The drift discipline — back a page with a check where structurable

Every component has its pages; the API table matches the descriptor; no dead slot/role names. These are
**deterministic** and already enforced — extend them, don't reinvent them:

- **Descriptor-derived API** — `descriptor/component-descriptor-driftwire.test.ts` asserts the
  frontmatter `attributes[]` equals the live `finalize(Class)` table; `…-sourcewire.test.ts` asserts the
  descriptor's `customStates`/`slots` match the control source. A T4 page consuming the same parser
  inherits this for free.
- **No dead names** — `descriptor/site-canon.test.ts` scans all of `site/` and fails on any `slot=`/
  `data-role=` name absent from the canonical vocab (sourced from the descriptors + control CSS through
  the *same* parser). This caught the `slot="icon"` left behind after the `icon`→`leading` rename.
  Comments are stripped first — a historical note in a `//` comment is not a live usage.
- **Coverage** — every shipped descriptor should have its page (T4) and family listing (T7): an
  enumeration check (walk the descriptors, assert each maps to a page) extends the site-canon pattern.
- **Soft staleness** — prose drift (T6 guides going stale against `.claude/docs/`) isn't mechanically
  checkable; route it to the reviewer's judgment and cite upstream by ID so a human can re-verify.

The rule: **where a fact is structurable, a green check is its guarantee; where it isn't, name the
upstream source so a reviewer can re-derive it.** A page is not done until its structurable facts are
gated.

## Honest labels (the voice discipline, in brief)

The site's voice is **precise and honest** — it never claims more than it renders. The states showcase
labels each state as the *control's* (not the page's); the A2UI canvas shows the real message round-trip,
errors included. Depth in `references/best-practices.md`. The failure to avoid: a demo that fakes the
behaviour it advertises (a mocked renderer, a screenshot, a hand-drawn state) — honesty is structural,
achieved by running the real thing, not by careful wording.

## Validation loop (finalize only when clean)

Draft → check → fix → re-check:

1. `npm run check` (tsc) and `npm test` (Vitest) both green — including the site drift gates
   (`site-canon`, the descriptor trip-wires) and any new enumeration check you wired.
2. The page derives every derivable fact (no hand-typed attribute row, no mocked demo); hand-authored
   content is minimal and flagged.
3. The page's drift gate exists and is green (or, where soft, the upstream source is cited by ID).

If any fails, fix the **page** (not the check) and re-run. A rename is a deliberate contract change the
trip-wires won't flag as drift — run the migration (rename across `site/` until `site-canon` is green)
before treating it as done.

## Definition of done (per page)

- [ ] Right content type; authored to its reference; scored-ready against its rubric.
- [ ] Every derivable fact is derived (descriptor / real renderer / enum / roles) — zero hand-maintained
      copies; styling stays in each control's own `{name}.css`.
- [ ] Live demos run the real renderer/control through its public surface (honest, not mocked).
- [ ] The structurable drift gate is wired and green (`site-canon`, the contract trip-wire, the
      coverage enumeration); soft staleness cites its upstream by ID.
- [ ] `npm run check && npm test` green.

## Worked example

`button-doc.ts` (T4) is the realized reference. It is **derived from `button.md`**: `loadButtonDoc()`
splits the fence and runs the *canonical* `parseDescriptor` (the second consumer of the same parser the
contract trip-wire uses), the API table is one row per `attributes[]` entry, and the variant/size
specimens iterate the parsed enum — so neither the table nor the specimens can drift from the descriptor
ADR-0004 enforces. The one hand-authored section (the position × role anatomy *shapes*, ADR-0012) is
labelled as such, because a markup shape is not an attribute and has no parse to derive from. Read it
end-to-end at `site/pages/button-doc.ts` + `site/lib/frontmatter.ts`, with the gates at
`packages/agent-ui/components/src/descriptor/{component-descriptor-driftwire,site-canon}.test.ts`.

## References & tools

| Path | Use when |
|---|---|
| `references/foundations.md` | The site architecture + the four derive-from sources the method leans on |
| `references/content-types.md` | The per-type content strategy + standards (the "reference" half, T1–T9) |
| `references/best-practices.md` | The cross-cutting content strategy — voice/tone, the anti-patterns, honest labels |
| `references/rubric.md` | Score a page (cross-cutting dims + the per-type "must contain" addendum) |
| `site/lib/frontmatter.ts` · `site/pages/button-doc.ts` | The descriptor-derived API-doc reference (T4) |
| `…/descriptor/site-canon.test.ts` | The dead slot/role-name drift gate to extend |
