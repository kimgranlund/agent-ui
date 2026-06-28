# Content types — strategy + standards (T1–T9)

> The per-type content strategy and standards for the nine docs-site page types. The companion
> "must-contain + score-on" lives in `rubric.md`; the cross-cutting voice/do-don't in
> `best-practices.md`. Each type names its **canonical source** (what it derives from) and its **drift
> gate** (the deterministic check that backs it). Anchors cite the realized pages under `site/`.
> 2026-06-28.

## T1 — landing / overview

**What it is.** The site's front door: a one-paragraph framing of the library, a **live hero specimen**
(real `ui-*` controls, not an image), and a card grid routing to every other page (`site/main.ts`).

**Strategy.** The hero is the headline artefact — it must be the *real* control, dogfooding the library
on its own landing. One card per destination, each a link + a one-line honest blurb of what that page
shows. Mount through `mountPage` so the landing carries the same nav/chrome as every page; the card set
mirrors the nav link set (one table of contents, two renderings).

**Standards.** No framework; light DOM. Hero specimens are real controls with real attributes. Blurbs
describe what the page *renders*, not aspirations. Every card target is a real page.

**Drift gate.** Every nav/card href resolves to a real page (a not-yet-built target is a runtime 404, not
a build error — wire it only when the page lands). The hero mounts the real control (it appears in the
DOM). Soft: the framing paragraph's accuracy → reviewer judgment.

## T2 — permutation matrix

**What it is.** The full **size × variant × state** grid of one control, built **programmatically** from
the enum arrays, not hand-written (`permutations.ts` — 3 sizes × 3 variants × 4 columns = 36 live
controls).

**Strategy.** Completeness must be *provable from structure*: loop over the enum arrays so the cell count
is `|sizes| × |variants| × |cols|` by construction — adding a variant adds its column for free. Include
the optional-slot permutations (bare label AND `+ icon`) and the structural anatomy axis (forward
`[icon|label|caret]` and reversed `[caret|label|icon]` — position ⊥ role, ADR-0012). Include the
`[scale]`/`[density]` subtree-geometry demo where the family has one (ADR-0007).

**Standards.** The axis arrays are the *exact* enum values from the descriptor/`static props` — never a
parallel hand-list. The page owns only its scaffold layout (`permutations.css`); all geometry/colour/ARIA
come from the real control. Slot/role names are canonical (caught by site-canon).

**Drift gate.** `site-canon.test.ts` (no dead slot/role name). The programmatic construction makes
completeness self-evident; prefer deriving the axis arrays from the parsed enum so they cannot drift.

## T3 — states showcase

**What it is.** The live control staged in **each interaction state** (hover · `:focus-visible` ·
`:active` · keyboard activation · disabled), each **honestly labelled** as the control's own state, with a
live activation log (`states.ts`).

**Strategy.** The page **never restyles the control** — every state's appearance lives in the control's
own `{name}.css` (ADR-0008/0009/0010). The page only stages, labels, and observes. Each section explains
what the control does and *why* (e.g. `:focus-visible` matches keyboard focus, not pointer click), so a
human can reproduce it. A real `click` sink proves both pointer AND keyboard activation (tag the source
by `event.detail`: trait clicks arrive `detail:0`, pointer clicks `detail≥1`).

**Standards.** Zero state styling in the page CSS (the page sets no `:hover`/`:focus`/`:active` on the
control). Labels describe the *observed* behaviour, including the negative (a disabled control produces no
log line). The control owns tab participation (the `tabbable` trait) — the page adds no `tabindex`.

**Drift gate.** The page declares no control state styling (a structural lint can assert the page CSS
touches no control selector). The live log is real (a wired `click` listener), proving the demo isn't
faked. Soft: label accuracy → reviewer judgment.

## T4 — component API doc (descriptor-derived — canonical)

**What it is.** The reference page for one control: the **attribute table** + **enum-driven live
specimens**, both **derived from `{name}.md`** through the canonical parser, plus the prose body under the
fence (`button-doc.ts`). The exemplar of the whole skill.

**Strategy.** Build the table **row-by-row from `parseDescriptor(...).attributes`** (name · type ·
default · reflect), widening the type with its enum members when `attr.values` is present. Build the
variant/size specimens by iterating those same parsed members. Render the markdown body beneath the table
(headings demoted one level to nest under the page `<h1>`). The **only** hand-authored content is what has
no parse to derive from (a markup *shape* like an anatomy diagram) — label it as hand-authored.

**Standards.** The page is the **second consumer** of the same parser the contract trip-wire uses
(`site/lib/frontmatter.ts` → `@agent-ui/components/descriptor`) — never a re-implemented frontmatter
dialect. No hand-typed attribute row. Text-only rendering (`textContent`, never `innerHTML`) for the
body.

**Drift gate.** `component-descriptor-driftwire.test.ts` (frontmatter `attributes[]` ≡ `finalize(Class)`)
+ `…-sourcewire.test.ts` (`customStates`/`slots` ≡ source). Because the page reads the same parse, the
table is gated for free.

## T5 — live A2UI demo

**What it is.** A literal A2UI payload fed through the **real** `@agent-ui/a2ui` renderer → a live,
clickable control → the click round-tripping back out as an A2UI client→server message, with the message
log shown (`a2ui-canvas.ts`). The capstone proof.

**Strategy.** Use the **public host surface** (`createRenderer`, `onClientMessage`, `mount`, `ingest`,
`finalize`) exactly as the server transport would — reach no renderer internals, so the page *is* the
integration proof `renderer.test.ts` asserts, made visible. Show the data flow left→right: payload (the
JSONL, derived from the same typed objects fed in, so displayed input == fed input) → rendered surface →
messages. Make it repeatable (a "re-run" affordance) and leak-free (dispose the prior host first).

**Standards.** Honest end to end: the log shows *every* client message — actions AND parse/schema/catalog
errors — pretty-printed. The payload is typed against the real wire contract (`A2uiServerMessage`) so it
type-checks against the protocol. Dogfood `ui-button` for the page's own affordances.

**Drift gate.** The renderer integration test backs the mechanism; the page is its visible twin. The
payload type-checking against `protocol.ts` is a compile-time gate (`npm run check`).

## T6 — conceptual guide (getting-started / theming / architecture)

**What it is.** Prose pages explaining the *why* and *how* — onboarding, theming via the token roles, the
layered architecture — the narrative the showcase pages don't carry.

**Strategy.** A guide **summarizes and routes**; it does not restate the canonical `docs/` (plan / goals
/ process / `references/`). Cite the owner by ID/path (`PRD-G#`, `SPEC-R#`, `docs/references/tokens.md`)
and link, so the single source stays single. Every code sample is real and **type-checks** (a guide's
samples are the most drift-prone surface — keep them runnable or derive them).

**Standards.** Referential, retrievable: headed, scannable, short declarative statements. No invented
API — only what the code actually exposes. Date/flag anything volatile.

**Drift gate.** Largely **soft** (prose staleness → reviewer judgment) — this is the type with the least
mechanical backing, so the citation discipline carries the weight: name the upstream so a human can
re-derive. Code samples must clear `npm run check`.

## T7 — per-family overview

**What it is.** One page per component family (form controls, containers/layout, …) — its members, their
shared shape, and each member's status, linking to each member's T4 page.

**Strategy.** Derive the member list from the **catalog / the family's shipped descriptors**, not a
hand-list — a new control in the family appears here automatically. State the family's shared contract
(the base class, the size-class, the common anatomy) once, then list members with status (shipped /
reserved / experimental — the catalog already reserves names ahead of their controls).

**Standards.** Every shipped member is listed and links to its API doc; reserved names are marked
reserved, not presented as available. The shared-shape prose cites the family's canonical reference.

**Drift gate.** **Coverage enumeration** — walk the family's descriptors and assert each maps to a listed
member + a page (extends the site-canon walk pattern). No member missing its page.

## T8 — interactive playground

**What it is.** Live controls bound to input affordances that drive their **real** attributes/props, so a
reader explores the control by manipulating it.

**Strategy.** Derive the input set from the **parsed enum** (a `<select>` per enum attribute, a checkbox
per boolean) so the playground's controls track the descriptor. Each input writes the *real* attribute on
a *real* mounted control; show the resulting markup so the reader can copy it.

**Standards.** No mocked state — every input maps to an actual attribute/prop and the displayed control is
the real one. The generated markup snippet matches what the inputs set.

**Drift gate.** The input-set-from-enum derivation + mounting the real control; the
attribute-name↔descriptor mapping is gated by the same parser. Soft: ergonomics → reviewer judgment.

## T9 — recipe / pattern

**What it is.** A small, copyable, **working** composition answering a concrete task ("a labelled form
row", "a button with a confirming dialog") — shown live and as copyable source.

**Strategy.** The recipe is the *real* composition mounted live, with its source shown verbatim
(derive the shown source from the same module where feasible, so the demo and the copy can't diverge).
Keep it minimal — one task, the smallest real composition that solves it.

**Standards.** The recipe **runs** (mounts the real controls); the shown code is the code that runs.
Composes real controls only — no pseudo-API.

**Drift gate.** The recipe mounts live (a render assertion) and its samples type-check (`npm run check`).
Soft: "is this the idiomatic pattern" → reviewer judgment.
