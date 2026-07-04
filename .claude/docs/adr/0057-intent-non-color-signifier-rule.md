# ADR-0057 — intent never travels by color alone: the fleet non-color-signifier rule

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-03 — Kim-directed item 5 of the color-verify audit, ratified by the orchestrator on Kim's "proceed" + the green wave gate [check · jsdom 2079 · browser 558/558 both engines]. The recommended C8 rubric line LANDED at ratification per the Consequences; the conformance table's danger-ink rows refreshed to the item-1 repointed role before the flip.)* |
> | **Date** | 2026-07-02 |
> | **Proposed by** | planner (design seat — item 5 of the 2026-07-02 color-verify audit; Kim-directed: "mandate a non-color signifier wherever intent is communicated — the rule lands in the docs, not the ramps") |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-03, on Kim's confirmation + the green wave gate |
> | **Repairs** | `references/component-authoring-best-practices.md` (the Do/Don't judgment layer — the rule's normative home, edited in this change) · `rubrics/component.md` C8 (a one-line reviewer look-for — **recommended**, exact text in Consequences; applied on ratification, not in this pass) |
> | **Supersedes / Superseded by** | None. Relates ADR-0014 cl.(4) (the first conforming instance — the text-field's non-colour validity cue) · ADR-0048 (the calendar's three-state shape split) · ADR-0008 (the role-ladder design whose L-matching makes hue the only intent separator) |

## Context

The 2026-07-02 color-verify audit measured the intent-family anchors (`--md-sys-color-danger` / `-warning` /
`-success` / `-info`, alongside `--md-sys-color-primary` / `-secondary`): they are deliberately **L-matched** — the
same OKLCH lightness by ladder design, so every intent renders with uniform perceived weight. That is
legitimate ladder engineering, and it has a structural consequence: **at the token level, intent is
carried by hue alone.** Hue is exactly the channel color-vision deficiency removes. Under deuteranopia
simulation the audit found danger↔success at **ΔE_OK ≈ 0.013–0.015** — indistinguishable — and
success↔secondary at **0.017–0.021**, confusable even for unimpaired vision.

The ramps are **not** the defect, and no token edit can be the fix: un-matching L to separate the intents
would destroy the uniform-weight ladder, no hue assignment keeps six intents distinguishable across
deuteranopia + protanopia + tritanopia at matched lightness, and any color-only scheme still fails
achromatopsia outright. The guarantee therefore cannot live in the token layer — it must be a
**component-layer law**.

No such law exists in the repo today. WCAG SC 1.4.1 appears only as per-control instances — ADR-0014
cl.(4) gave `ui-text-field` its non-colour validity message; `field.css:122` cites 1.4.1 for the error
node — so every shipped surface conforms by *local* design, not by *rule*. The next intent-bearing
component (a `family` attribute on button — `tokens.md`'s open fleet decision — or a badge/alert/toast
family, none of which exist yet) has nothing binding it. This ADR writes the missing rule down where the
component-builder reads and the component-reviewer grades.

## Decision

We adopt the fleet rule — normative home:
[`references/component-authoring-best-practices.md`](../references/component-authoring-best-practices.md)
(one Do bullet + one Don't bullet, edited in this change; that doc now holds the fact, this ADR the why):

**No agent-ui surface may communicate intent by color alone.** Wherever an intent-family role
(`--md-sys-color-danger/-warning/-success/-info` — or any color role used to carry *meaning*: validity, status,
kind, selection) styles a state or variant, a **visible non-color signifier must co-carry the same
meaning on the same surface**: text that names the state, a glyph/shape (a tick, a ring-vs-fill split,
a dash pattern), or position. The programmatic ARIA state (`aria-invalid`, `aria-checked`,
`aria-selected`) is required *alongside* but is never *sufficient* — SC 1.4.1 is a visual-perception
criterion, and AT output does not reach a sighted CVD user.

Stated as the checkable contract a reviewer (or probe author) applies: **for every CSS rule keyed on an
intent role or an intent-bearing state selector, name the co-carried non-color signifier; if the only
difference between two states or variants of a surface is color values, the surface fails.**

Normative anchor: **WCAG 2.2 SC 1.4.1 (Use of Color), Level A.**

## Consequences

- **The audit trail — the shipped fleet conforms; zero control fixes in this pass.** The conformance
  survey (each row cites the live source):

  | Surface | Intent/state color | Co-carried non-color signifier | Verdict |
  |---|---|---|---|
  | `ui-text-field` user-invalid | danger border `text-field.css:50–51` · message ink `:70` (now `--md-sys-color-danger-on-surface-variant` — the audit's item-1 repoint; the border channel stays `--md-sys-color-danger`) | the **visible validity-message text** (ADR-0014 cl.4) + `aria-invalid`/`:state(user-invalid)` (`text-field.ts:458–491`) | conforms |
  | `ui-field` error region | `--ui-field-error-ink: var(--md-sys-color-danger-on-surface-variant)` (`field.css:47` — item-1 repoint) | the error node **is text** — "the text IS the cue" (`field.css:122`); under association it is the ONE announced error (ADR-0051) | conforms |
  | `ui-calendar` selected / today | `--md-sys-color-primary-selected` fill · today-ring color (`calendar.css:46`) | **shape split**: selected = *fill* vs today = *inset ring* (`calendar.css:232–242`) + `aria-selected`; WHCM keeps all three states distinct (focus=Highlight-outside · selected=Highlight-fill · today=ButtonText-inset, `calendar.css:261–288`) | conforms |
  | `ui-checkbox` / `ui-radio` / `ui-switch` checked | primary fill vs neutral | checkbox: the clip-path **tick glyph** (`checkbox.css:114–122`) · radio: the **dot** (inset box-shadow, `radio.css:12–13`) · switch: the **thumb position** slide (`switch.css:12–14`) — all + `aria-checked` via internals | conforms |
  | site demo pages (`a2ui-{form,canvas,stream,list}.css`) | `--md-sys-color-danger`/`--md-sys-color-success` ink keyed on `[data-kind]`/`[data-phase]` | the colored node is a **text label that itself names the kind** ("blocked"/"sent"/"error"/"done"); the stream fault block adds a **dashed** border (`a2ui-stream.css:141`) | conforms (color = redundant emphasis) |
  | `ui-button` | — | single-family primary; `solid/soft/ghost` are *emphasis*, not intent — no intent-by-color surface exists today | n/a — **in scope the day a `family`/intent attribute lands** |
  | `--md-sys-color-warning` / `--md-sys-color-info` | zero component consumers today | — | n/a — in scope at first consumer |

- **Enforcement = one rubric line, no new machinery.** Per `process.md`'s placement rules this check is
  *judgment grounded in a referential artifact* (rule 2), not a true/false script (rule 1) — "has a
  co-carried signifier" is not string-matchable. Recommended edit to `rubrics/component.md` **C8
  (Styling & tokens)**, applied on ratification: extend *What it checks* with "**no intent by color
  alone** — any rule keyed on an intent role has a co-carried visible non-color signifier
  (best-practices / ADR-0057)", and the 5-anchor with "…and each intent-keyed rule names its non-color
  co-signifier". The `component-reviewer` already grades C8; no new dimension, probe, or descriptor
  field.
- **No `process.md` edit.** The gate doctrine already routes judgment through the rubric + reviewer;
  the rule itself is a component-standard fact, so its home is the doc every control build reads.
  Naming it in `process.md` would duplicate the fact away from its owner.
- **The cost is real and accepted:** every future intent-bearing component budgets a visible signifier
  from birth — a color-only status dot, a hue-only badge, a border-only warning are all **unshippable
  by rule**, even where a designer judges them cleaner. Reviews gain a non-mechanical check (judgment
  cost per intent-bearing control).
- **Follow-ups:** none among shipped controls. Named forward triggers where the rule first bites: the
  button `family` attribute (tokens.md's open fleet decision), any badge/alert/toast/tag family, and
  the first `--md-sys-color-warning`/`--md-sys-color-info` component consumer.
- **Stale → re-verify:** `references/component-authoring-best-practices.md` (edited here) ·
  `rubrics/component.md` C8 (on ratification).

## Acceptance

- `component-authoring-best-practices.md` carries the rule as a Do bullet (+ the Don't-side trap line)
  citing SC 1.4.1 and this ADR — in the same change as this record.
- `adr_check.py` exit 0; index row present.
- On ratification: the C8 rubric line lands; the next intent-bearing control's `component-reviewer`
  run cites the rule (observable at that review).
- Every conformance-table row above resolves to the cited `file:line`.

## Alternatives considered

- **Fix the ramps — un-match L or rotate hues for CVD separation** — rejected: destroys the deliberate
  uniform-weight ladder (the L-matching *is* the design); no hue assignment separates six intents under
  all three dichromacies at matched lightness; still fails achromatopsia; and Kim ruled the fix lands
  in the docs, not the ramps.
- **A CVD-safe alternate palette (theme/user-preference switch)** — rejected: no platform media query
  exposes CVD, so it is opt-in — the default rendering stays broken for the users it targets; and it
  doubles the token maintenance surface for a guarantee the component layer gives universally.
- **A mechanical trip-wire (grep intent-role usage, demand a sibling glyph/text node)** — rejected as
  over-machinery: co-carrying is semantic (position, shape, text *meaning*) — a grep false-positives
  on redundant-emphasis text and false-negatives on a color-only dot with a decoy node. `process.md`
  rule 1 reserves scripts for true/false facts; this is rule-2 judgment.
- **Owning doc = `process.md`** — rejected: process owns the loop/gate *architecture*, not component
  standards; a norm applied at authoring time belongs in the judgment doc the builder loads
  (best-practices), with the reviewer's copy in the rubric.
- **Owning doc = `interaction-states.md`** — rejected: that standard owns hover/active/focus/disabled —
  *interaction* states. Intent (validity/status/kind) is orthogonal; a rule about danger-vs-success
  does not belong in the hover/focus contract.
