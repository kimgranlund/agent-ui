# PRD — FEED / Agent-Activity Component Family

> Status: **proposed · v0.1 · Owner: agent-ui** — the scope INTAKE for the feed/agent-activity family
> (`ui-progress` · `ui-avatar` · `ui-attachment` · `ui-toast`), authored 2026-07-08 by the design seat
> (coordinator-dispatched; the coordinator pre-assigned ADR-0112 to this intake — siblings hold 0111 and
> 0113–0114). Ratification: doc-review + Kim's fork answers; nothing here authorizes a build.
> Altitude: this document owns **why + what-should-exist** for the family. The scope/contract-direction
> decision record is [ADR-0112](../adr/0112-feed-family-v1-scope.md); SPEC/LLD are build-wave records,
> not authored at intake (the chart-family M0 precedent).
> **Sibling-vs-extension ruling:** this is a **new sibling PRD** (the chart-family/agent-app-surfaces
> precedent). Neither existing PRD owns it: `agent-app-surfaces.prd.md` owns app *chrome*,
> `chart-family.prd.md` owns quantitative *report* vocabulary, the A2UI expert-system PRD owns
> *generation reliability*, `a2a-section.prd.md` owns the *protocol* layer. This family is fleet
> **activity vocabulary** — what agent work *looks like* while and after it happens — a
> `@agent-ui/components` control family with an a2ui catalog surface (three of four types) and an
> app-surface leg (the fourth).
> Grounding: the artifact-feed demo (agent activity with no progress/identity/file vocabulary) · the
> `document-row-toolbar` seed (`packages/agent-ui/a2ui/src/examples/catalog-coverage.ts:184-235` —
> an attachment card hand-composed from `Icon`+`Text`, with the recorded missing-file-glyph defect at
> `:188-194`) · the A2A TaskState machine (`packages/agent-ui/a2a/src/protocol/task-state.ts` — nine
> states, zero visual vocabulary) and FilePart contract (`packages/agent-ui/a2a/src/protocol/types.ts:55-74`)
> · `CLAUDE.md` (zero-dependency pillar) · [`../references/geometry.md`](../references/geometry.md)
> (five size-classes; `progress` is already enumerated Display-class) ·
> [ADR-0087](../adr/0087-a2ui-whole-fleet-catalog-scope-policy.md) (catalog-or-allowlist gate) ·
> [ADR-0097](../adr/0097-a2ui-feed-embedded-asks.md) + Amendment (the TOTAL feed partition) ·
> [ADR-0102](../adr/0102-css-less-consumer-contract-law.md) (the three-lane contract law).

## 1. Problem

Agents *do things over time* — they work, wait for input, produce files, finish, fail — and the fleet
can show none of it. The vocabulary gap has three recorded faces:

1. **Activity has no visual.** The A2A layer ships a nine-state task lifecycle
   (`submitted → working → input-required → … → completed/failed`), and not one state has a rendering.
   An artifact-feed turn that is `working` looks identical to one that is idle; a long-running agent
   task offers the user a blank stare. There is no progress vocabulary — determinate or indeterminate —
   anywhere in the fleet.
2. **Files have no vocabulary.** A2A `FilePart` is a first-class wire type
   (`{bytes|uri, name?, mimeType?}`), and the fleet renders it by hand-composition: the
   `document-row-toolbar` seed builds its attachment card from a `Card`+`Row`+`Icon`+`Text` assembly —
   and its own comments record that the icon pack has **no file/document glyph at all**, so the glyph
   silently rendered empty (a gallery-caught defect). Every consumer re-invents the same card, wrong.
3. **Completion has no announcement surface.** The fleet has NO transient notification primitive.
   When an async agent task completes while the user looks elsewhere, nothing can say so: the
   app-shell has no notification region, and the only overlay primitives are anchored disclosure
   surfaces (popover/tooltip/menu, ADR-0043) or the focus-trapping modal (ADR-0017) — both wrong for
   a non-interrupting, self-expiring status announcement. Identity is equally mute: a feed rendering
   two agents' turns has no compact identity mark (`ui-icon` is a glyph, not an identity).

**Who has the problem.** (1) *The artifact-feed demo* — the grounded internal instance: agent turns
carry no working/progress state, no agent identity mark, and hand-rolled file cards. (2) *Models
emitting A2UI payloads* — asked to show a task's status or its produced files, a model has no honest
vocabulary beyond prose. (3) *App developers* embedding agent surfaces (app-shell consumers) who need
"the task finished" to reach the user without stealing focus — today they must hand-roll the fleet's
most a11y-sensitive primitive (a live-region overlay) themselves.

**Why these four together.** They are one family because they are the four faces of the same subject —
agent activity: *who* is acting (`ui-avatar`), *how far along* the act is (`ui-progress`), *what it
produced* (`ui-attachment`), and *that it finished* (`ui-toast`). Each is independently justified by a
recorded gap above; the family framing exists so the catalog, the feed partition, and the exemplars are
dispositioned coherently in one wave rather than four drifting ones.

## 2. Goals & success metrics

Stable IDs; priority tiers (must/should/could); metrics carry baseline + target + timeframe.
Milestones M0–M2 in §4. Downstream SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must | Agent activity becomes visible: progress, identity, and file vocabulary exist in the fleet and (where catalogued) the default catalog |
| **PRD-G2** | must (cross-cutting) | The family holds every fleet pillar — zero-dep, geometry law, token theming, internals-ARIA, forced-colors, cross-engine whole-shape proof |
| **PRD-G3** | must | The fleet gains its first transient notification surface (`ui-toast` + region) with a non-interrupting a11y contract |
| **PRD-G4** | should | The activity surfaces upgrade: an agent-activity exemplar teaches models the idiom; the hand-composed attachment card retires |

**PRD-G1 — Agent activity becomes visible (flagship).** The three display types land as ordinary
`ui-*` controls with data props a model can emit as plain JSON, and enter the default catalog
same-wave (`Progress`, `Avatar`, `Attachment`).
- *Metric*: activity component types in the default catalog, each validator-clean over a realistic payload.
- *Baseline*: **0** (the catalog's 36 types contain no progress/identity/file type; the
  `document-row-toolbar` hand-composition is the recorded evidence).
- *Target*: **≥ 3** (`Progress`, `Avatar`, `Attachment`) declared, factory-bound, exercised by a
  validator-clean exemplar payload, and each carrying an ADR-0097 partition disposition.
- *Timeframe*: **M1** (the first build wave — not authorized by this intake).

**PRD-G2 — Every fleet pillar holds (cross-cutting).** All four controls are ordinary citizens:
hand-rolled zero-dep rendering, geometry-law sizing per class, token theming, ARIA via
`ElementInternals` (never host attributes), forced-colors survival (the bar-chart WHCM lesson), and
whole-shape browser proof in both engines.
- *Metric*: the fleet DoD gates over the new controls — `npm run check && npm test`, the browser legs
  (Chromium + WebKit), descriptor trip-wires, `npm run size` (manual, ADR-0040 §3) — plus an a11y probe
  per type asserting the announced role/name via internals, and a forced-colors leg for `ui-progress`.
- *Baseline*: n/a (no controls exist).
- *Target*: **all gates green at M1**, including a whole-shape assertion per control (a bare control in
  a realistic container paints visible and non-collapsed — the slider-dot lesson applies verbatim to a
  bar-shaped `ui-progress`).
- *Timeframe*: **M1**.

**PRD-G3 — A transient notification surface exists.** `ui-toast` + its region land as the fleet's
first timed, self-expiring, never-focus-stealing overlay, usable by the app-shell and any page; it is
deliberately **not** agent-emittable (the catalog disposition is ADR-0112's, with reasons).
- *Metric*: a toast announced from page code reaches assistive tech (role=status), never moves focus,
  auto-dismisses on its timer, and pauses that timer under hover/focus.
- *Baseline*: **0** (no transient surface exists; grep for toast/notification in the fleet is empty).
- *Target*: the four predicates above each hold as an automated test (jsdom + browser legs), and an
  actionable toast (one that carries an action) does **not** auto-dismiss (the timing-adjustable rule).
- *Timeframe*: **M1**.

**PRD-G4 — The activity surfaces upgrade.** An **agent-activity exemplar seed** (a task-status card:
`Avatar` identity + `Progress` state + `Attachment` output, composing `Card`/`Text`) joins the examples
shelf with §5.2 usage-guidance prose (the ADR-0087 Fork-A precedent); the `document-row-toolbar` seed's
hand-composed attachment assembly upgrades to the real type; corpus + derived prompt re-validate over
the widened catalog.
- *Metric*: exemplar seeds containing the new types, validator-clean and rendered in the examples surfaces.
- *Baseline*: **0** (no seed can contain them; the closest idiom is the hand-composed document row).
- *Target*: **≥ 1** agent-activity exemplar in `allSeeds`, validator-clean; the document-row attachment
  assembly replaced; §5.2 Notes guidance landed; corpus + derived prompt re-validated.
- *Timeframe*: **M2**.

## 3. Scope

**In scope (v1):**
- `ui-progress` — a **bar** progress indicator: determinate (`value`/`max`) + indeterminate; announced
  to assistive tech in every state; legible under forced colors. (Geometry + ARIA mechanics: ADR-0112.)
- `ui-avatar` — a compact identity mark: image with **initials fallback** (and glyph fallback);
  decorative by default beside a visible name; **no per-identity hue coding** (the CVD/AA law).
- `ui-attachment` — a compact file card: name (+truncation) · a type-derived glyph · optional
  formatted size · optional link whose **navigation-security semantics are owned by the sibling
  content-family record (ADR-0114)** — referenced, never designed here.
- `ui-toast` + `ui-toast-region` — a **non-interrupting announced status surface**: transient by
  default, never steals focus, never expires an offered action (WCAG 2.2.1), pause on hover/focus.
  (The top-layer/role mechanics are ADR-0112's contract direction.)
- Same-wave ADR-0087 dispositions: catalog rows for `Progress`/`Avatar`/`Attachment` + reasoned
  allowlist entries for the toast pair; ADR-0097 partition dispositions for every new catalog type;
  the agent-activity exemplar + §5.2 guidance (PRD-G4).

**Out of scope (v1) — the fence, each with its reason:**
- **Progress ring/circular variant** — a second mark geometry (SVG arc math, its own WHCM story) with
  no forcing consumer; the bar serves the feed/app cases. A ring is a **foreseen extension** on the
  same contract (`shape` axis), fenced exactly as charts fenced axes — a new intake, never a rider.
- **Progress buffer/segments/steps** — multi-range semantics (streaming buffers, wizard steps) drag a
  second value model; the wizard case is `ui-tabs`/pattern territory.
- **Avatar groups / facepiles, presence badges, per-identity hue coding** — grouping is layout
  (`ui-row` composes it); presence is a status system this family doesn't own; hue-identity fails the
  fleet's non-color-signifier posture (ADR-0057) and makes contrast unverifiable (an unbounded
  hash-color × scheme AA matrix).
- **Attachment previews/thumbnails, upload affordances (progress-in-card, cancel), multi-file lists** —
  preview is a renderer per mime family (scope explosion); upload is an *input* posture (this type is
  display); lists compose via `ui-list` (the ADR-0087 List guidance).
- **Link-security design (URI scheme allowlists, `rel`/`target` policy, download semantics)** — owned
  by the content family's ADR-0114; this family only *names the dependency* (§ADR-0112 cl.4).
- **Toast queueing/dedup/rate caps, action arrays, swipe gestures, a global static `show()` API,
  cross-tab/system notifications** — v1 is one region, stacked toasts, one optional action; a queue
  discipline is a foreseen extension with its own a11y argument; a static singleton inverts the
  app-shell's per-instance isolation law (ADR-0082).
- **Any TaskState coupling in code** — `@agent-ui/components` imports nothing upward (the layering
  trip-wire); the TaskState→progress pairing is catalog §5.2 *guidance*, never an import or a prop enum
  pinned to A2A.


### Constraints & assumptions (consolidated; dated 2026-07-08)

- **Constraints:** zero runtime dependencies (CLAUDE.md pillar) · imports point inward only — no
  `@agent-ui/a2a` import from components (the TaskState pairing is guidance, never coupling) · the
  ADR-0087 whole-fleet gate (every shipped type is catalogued or reason-allowlisted, same wave) · the
  ADR-0097 TOTAL feed partition (every new type owes a disposition) · ADR-0057 (no color-only
  signifier) · the 26 KB family ceiling re-bases by recorded amendment, never silently.
- **Assumptions:** the icons vendor wave (file/person glyphs — the 11-name MVP has neither) lands
  before or within M1 (ordering constraint, owner: icons/ADR-0066) · ADR-0114 ratifies before or with
  the attachment `href` leg (ordering constraint; the metadata card lands regardless) · the app-shell's
  default toast region is that package's own record, not assumed here.

## 4. Milestones

| Milestone | Delivers | Gate |
|---|---|---|
| **M0 (this intake)** | This PRD + ADR-0112 (scope + contract directions + Kim forks) + the coverage-clean intake decomp — docs only | doc-review + Kim's fork answers; harness gates green (`harness_checks.py prd` · `adr_check.py` · `coverage_check.py --strict`) |
| **M1** | The four controls + descriptors + same-wave ADR-0087 dispositions (3 rows + 2 allowlist entries) + ADR-0097 partition rows + a11y/WHCM/browser/geometry probes (PRD-G1/G2/G3) | fleet DoD + fleet-derived catalog gate green with the two reasoned allowlist entries as the only residue; partition gate green |
| **M2** | Agent-activity exemplar + document-row upgrade + §5.2 guidance + corpus/prompt re-validation (PRD-G4) | examples/corpus gates green; exemplar renders in the gallery |

**M1 prerequisites (named, with owners):** the `@agent-ui/icons` vendor addition (file-category +
person glyphs — the 11-name MVP has none; icons-package owner, ADR-0066 mechanics) · the ADR-0114
link-security ruling for `ui-attachment`'s `href` leg (content-family sibling; `ui-attachment` ships
its metadata surface regardless — the `href` leg is the only gated part).

## 5. Open decisions

The genuine forks are owned by [ADR-0112](../adr/0112-feed-family-v1-scope.md) §Forks, each with a firm
recommendation awaiting Kim: **F1** toast surface architecture · **F2** toast ownership + catalog
reachability · **F3** avatar sizing lever · **F4** attachment posture. The contract *directions*
(value models, a11y defaults, WHCM, dispositions, packaging) are recorded there; mechanisms are SPEC/LLD
business at M1. No other decisions are open at PRD altitude.
