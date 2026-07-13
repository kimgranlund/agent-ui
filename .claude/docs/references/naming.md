# Naming — the per-namespace grammar (the master plan)

> Status: authored 2026-07-12 (TKT-0025) from the sized inventory
> (`../reports/naming-inventory-2026-07-12.md` — the evidence base; counts live THERE, rules live
> HERE). Siblings: `geometry.md` (the size/scale law) · `anatomy.md` (position slots × content
> roles) · `tokens.md` (color roles). The doc-ID namespace is `agent-ui-doc-standards`' (§3).
> Migration policy for every rule here: **fix-on-touch, never big-bang** — the Recorded
> Exceptions (§12) hold the standing deviations; gates are strict for NEW names from day one.

## 0 · The five principles (extracted from what the fleet already does)

1. **One name, one meaning, everywhere.** A word means the same thing in every namespace it
   appears (`size` IS the [sm,md,lg] widget enum — ADR-0032/0041; a pane's seed had to become
   `initial`). Reserved-word lists per namespace are the mechanism (§3).
2. **Closed vocabularies with an ADR-gated admission path.** Events, states, roles, tiers,
   region landmarks: closed sets an agent can be *taught*. A new member needs the current wave's
   proposed ADR, never a drive-by addition.
3. **The prefix is the ownership boundary.** `--ui-swiper-*` belongs to the swiper folder;
   consuming across a family is sanctioned, *declaring* across it is a gate failure
   (ADR-0081/0124). Names encode who may write them.
4. **Names are machine-readable API.** Every public name lives in a descriptor/manifest a gate
   derives from (the palette, the catalog, the docs, the drift gates all read them) — an
   undeclared name is invisible; an untruthful one is a red gate.
5. **Grep-ability beats brevity.** `ui-master-detail-pane`, never `ui-md-pane`; names are search
   keys (the `^ui-` palette-anchor ruling exists because of this).

## 1 · Element tags — `ui-{name}` · `ui-{family}-{part}`

- Kebab, `ui-` prefixed, everywhere agents can reach. The name is the FOLDER name; the class is
  `UI{PascalName}Element`; alignment is gate-locked (family-coherence C-group).
- **The hyphen is deliberately overloaded** (compound names vs family members are undecidable
  from the tag alone — inventory #1). The resolver is never the tag string: **the descriptor is**
  (`{name}.md` frontmatter names its family root). Do not write code that parses tags into
  families; read the descriptor graph.
- Family-member tags are `ui-{family}-{part}` with the part a single noun where possible; 4-hyphen
  tags are legal when the family root is itself compound (ui-app-shell-region). Never abbreviate.
- **Site-local elements** (`component-preview`, `component-gallery`) are a second, deliberate
  namespace: un-prefixed = "not fleet, not agent-emittable, not descriptor-bound." A site element
  that graduates to the fleet takes the `ui-` name at promotion (theme-provider precedent).

## 2 · Classes — `UI{Name}Element` + the base ladder

`UI{Name}Element` for every tagged element; bases come only from the sanctioned ladder
(`UIElement · UIFormElement · UIContainerElement · UIIndicator/UIRange/UIListbox · UIWidget` —
seven classes; the inventory's "6-base" line undercounts, source is the authority).
Site-local classes follow their own namespace (§1) but SHOULD still extend `UIElement` when they
use fleet machinery (ComponentPreview's raw-HTMLElement shape is a recorded exception, §12).

## 3 · Props & attributes

- camelCase property; a multi-word prop declares its explicit kebab `attribute:` (the 8 existing
  overrides are the template — `ui-nav-rail`'s `collapseContainer`/`collapse-container`, TKT-0035,
  is the newest). Enum props are closed literal unions via `prop.enum` — values kebab/lowercase.
- **Booleans are bare adjectives/participles** (`disabled`, `checked`, `persistent`), never
  `is-`/`has-`. A verb is not a boolean name (see `truncate`, §12).
- **Reserved words** (one meaning fleet-wide): `size` ≡ the widget enum (GATED, A2/A2b) ·
  `value` = the FACE form value · `label` = the accessible name · `name` = the form name ·
  `open` = overlay visibility (prop-as-source-of-truth, ADR-0101) · `selected`/`checked` = the
  committed selection state · `active` = the bindable identity (ADR-0019 family). New controls
  may not repurpose these; a colliding concept renames (the `initial` precedent).
- **The orientation canon is `orientation`** (7:1 dominant; `axis` on ui-split is the
  recorded exception — split-pane consumes it; fix-on-touch). One concept, one prop name — check the reserved/canon list
  before minting any prop whose concept exists elsewhere.
- `variant` is deliberately per-control (visual voice is context-bound); its VALUES still obey
  the closed-enum rule.

## 4 · Events — the closed six + `click`

`change · input · select · open · close · toggle` (+ native `click` for pure activation). The
inventory found ZERO out-of-vocabulary emits repo-wide — keep it that way: a new event name is an
ADR-level decision (principle 2). Commit semantics: `change`/`select` are user commits, NEVER
emitted from programmatic writes (the fleet law the codec/settings waves asserted); `input` is
live; `open`/`close`/`toggle` are overlay/disclosure lifecycle. Detail shapes are per-event,
documented in the descriptor's `events:` block — the descriptor allowlist is gated; the emit-seam
gate is the planned closure (§11).

## 5 · CSS custom properties — the three tiers

- **Control tier** `--ui-{control}-{role}`: declared only by the owning folder; non-primary
  family descriptors may CONSUME the family-root prefix, never declare it (ADR-0124). Private
  intermediaries are `--_{name}` (file-local, never public API). JS-seam inline properties
  (`--value-pct`) are the sanctioned dynamic hook, exempt from the token gate.
- **Foundation tier** — the ~40 global constants (`--ui-space-*`, `--ui-font`, `--ui-motion-*`,
  `--ui-focus-ring-*`, …) share the `--ui-` prefix by history; they are told apart from control
  roles ONLY by the family-coherence shared allowlist. RULE: a new global constant lands in
  `dimensions.css` + that allowlist in the same change; a control never mints a `--ui-{word}-*`
  whose first segment could read as a control name.
- **System tier** `--md-sys-{color,typescale}-*`: generator/spec-owned (tokens.md). The
  typescale's four editorial voices (kicker/lead/overline/quote) extend M3 deliberately —
  documented as extensions, never presented as Material canon.
- The `--ui-*`-vs-`--md-sys-*` two-tier split is PERMANENT (Kim ruled 2026-07-12): this file §5
  owns the boundary; the generator owns `--md-sys-*`. No convergence.

## 6 · Parts, roles, states

- **`data-part`** = control-CREATED anatomy; kebab NOUNS. Reuse a name across controls only for
  the same meaning (`panel` = the floating surface, everywhere). Every rendered part is declared
  in the descriptor's `parts:` (truthful-to-the-DOM — the house rule; the gate is planned, §11).
- **`data-role`** = author/content-model kinds inside a control's light DOM. The LIVE vocabulary
  is the law; anatomy.md's shorter list is historical (§12 repair). A new role joins via the
  descriptor's `contentModel` + this file's registry: icon · caret · marker · detail · text ·
  list · label · numeric · currency · stepper · magnifier · description · timestamp · shortcut ·
  reveal · group-label · calendar · swatch · trailing · clear · before-sentinel · tag (ADR-0130
  cl.7 — anatomy.md's reserved `tag` role realized, `ui-nav-rail-item`'s trailing name|tag row;
  purely additive, no anatomy.md text change needed) (mechanism
  artifact — rename candidates stay fix-on-touch). The registry covers control-emitted roles plus
  named AUTHOR hooks a descriptor advertises (today: `empty` — command-modal's author hook; the gate pins that no data-role="command-modal" exists).
  `ui-conversation`'s per-turn bubble speaker kind adds three: `user` · `agent` · `system`
  (app-surfaces-m2.spec.md SPEC-R4 — the thread's own light-DOM content model; app-tier, not agent-emittable).
- **Custom states** (`internals.states` / `:state()`) are ADJECTIVES/participles, lowercase,
  kebab: ready · user-invalid · checked · dragging · revealed · disabled · collapsed · truncated
  · selected · indeterminate. A verb or noun is not a state name.

## 7 · A2UI catalog types

PascalCase, mechanically `PascalCase(tag)` minus the `ui-` prefix; UAX-31 + the `@` reserve
gate-enforced (naming.test.ts). Non-tag-backed types (Option, MenuItem) exist only where the
control's light-DOM content model absorbs the child. The catalog name NEVER diverges from the
tag's name-words.

## 8 · Packages & subpaths

`@agent-ui/{pkg}`. Subpath grammar is PER-PACKAGE by history (inventory #3): components =
`./controls/{name}`; app/router = bare `./{name}`; code/icons = pack names. RULE for new
packages: bare `./{name}` (the app/router shape — the `controls/` segment was components-era);
existing packages never churn their public export map for naming's sake.

## 9 · Files, folders, traits

- The per-control set: `controls/{name}/{name}.{ts,css,md,test.ts,browser.test.ts}` (+ the probe
  variants). One folder per FAMILY: sub-elements nest in the family folder (card, tabs, swiper,
  split, toast, radio are the canon; timeline-item/segment/segmented-control/slider-multi are
  recorded exceptions — fix-on-touch means a family's NEXT wave may consolidate, never a
  dedicated churn commit).
- Traits: the file is the kebab of the exported camelCase verb-ish factory; prefer
  `{noun}-{verb}`/`{verb}-{noun}` compounds that read as capabilities (value-drag, pane-resize);
  bare adjectives only for predicates (tabbable).

## 10 · The five-question rubric (run at every intake — folded into agent-ui-component-design)

1. **Which namespace(s)** does this name enter? (A new control enters ~7 at once — derive the
   full set from the family name; §13's worked example.)
2. **Does a reserved word collide?** (§3's list + the concept-canon check: does this concept
   already have a fleet name?)
3. **Is it joining a closed set?** (events/states/roles/tiers → the current wave's ADR records
   the admission.)
4. **Does the prefix match ownership?** (Who may declare it; who may only consume it.)
5. **Is it derivable?** (Could a reader reconstruct it from the family name + this file? If it
   needs explaining, rename it now — it will never be cheaper.)

## 11 · Gates (existing → planned)

Existing: tag↔class↔folder + the size enum + descriptor-event allowlist + token invariants
(family-coherence) · catalog UAX-31 (naming.test.ts) · doc IDs (docs-grammar). Planned closures
(the TKT-0025 build slices): the **emit-seam event allowlist** (source-scan: `emit(`/`new
CustomEvent(` ∈ §4), the **custom-state vocabulary** scan (§6's set), the **data-role registry**
scan (§6's set), and the **descriptor↔DOM `parts[]` truthfulness** gate (render-and-compare —
the color-picker L2 hole).

## 12 · Recorded exceptions (fix-on-touch; the gates exempt exactly these)

`axis` on ui-split, split-pane consuming it (canon: orientation) · prop `truncate` vs state `truncated` ·
`emphasis` as a boolean · `data-part="aria-label"` ×3 · ComponentPreview extends HTMLElement ·
the foundation/control `--ui-` overlap (allowlist-managed) · anatomy.md's stale data-role list
(repair owed) · the nested-vs-own-folder sub-element split · `open` declared with zero producers
(keep: the vocabulary slot is real; producers arrive with future overlays) · **the two token dialects — RULED
(Kim, 2026-07-12): permanent two-tier** (`--ui-*` control/foundation vs `--md-sys-*` system; §5
owns the boundary; convergence — ≈2830 sites — rejected). The fork is closed.

## 13 · The worked example — deriving a family's names from ONE decision

Decision: the family is **`swiper`**. Derived, no further choices: folder `controls/swiper/`;
tags `ui-swiper` + `ui-swiper-{item,label,paddles,pagination}`; classes `UISwiper{…}Element`;
tokens `--ui-swiper-*` (root-declared, member-consumed); parts `track`/`live` (nouns, descriptor-
declared); state `ready`; events from §4 only (`select`); catalog `Swiper`/`SwiperItem`/…;
subpath `./controls/swiper`; descriptor `swiper.md` + per-member `.md`s; docs pages
`swiper-{doc,demo}.html`. Every gate above locks each derivation. That is the whole plan: one
decision in, ~30 names out, none of them negotiable.
