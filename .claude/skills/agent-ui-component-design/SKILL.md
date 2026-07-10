---
name: agent-ui-component-design
description: >-
  The design INTAKE for a new or novel ui-* agent-ui component — everything before code:
  classify (base class × size-class/tier × catalog posture), run the precedent sweep, fill
  the standard fork sheet (tag, anatomy, props/events, geometry row, token roles, a11y, form
  participation, site surfaces), take the novelty leg when no precedent fits, decide what the
  change earns (ADR only for a contract-changing fork — proposed, never self-ratified), and
  produce the decomposition + test plan that gate the build. Use for "design a new ui-*
  control", "plan the intake for component X", "does this need an ADR", "no existing
  geometry row fits this". NOT for building to an already-frozen design
  (agent-ui-component-create) or for law lookups alone (agent-ui-component-standards).
user-invocable: true
disable-model-invocation: false
---

# Component design — the intake procedure

Turns "we want a component that does X" into a frozen, reviewable design a builder can
implement without re-deriving anything. The output is a design record set under
`.claude/docs/`; **no code is written here**. Generator ≠ critic throughout: the design is
independently doc-reviewed before any build dispatches.

Load the map skills as you go: [[agent-ui-component-standards]] (law),
[[agent-ui-component-patterns]] (prior art), [[agent-ui-component-packaging]] (shape),
[[agent-ui-component-testing]] (the bar the test plan must meet).

## Procedure

1. **Extract intent** (intent-extract where installed; its discipline inline otherwise).
   Root goal vs literal ask; ONE batched clarifying round max. Name the component's *job* in
   one sentence — everything downstream keys off it. **Combined intakes are a valid shape**
   (two tickets whose components may be one family — the timeline/status-stream precedent):
   resolve the one-family-vs-two fork FIRST with mechanics (count the divergent axes; a
   boolean that must flip role/data-contract/scroll/completion at once is two controls), then
   produce ONE record set; both tickets' Findings get the entry.

2. **Dedup + precedent sweep.** Is it a variant/prop of an existing control rather than a new
   one? (Grep `controls/`.) Then: read the nearest **2–3 descriptors** end-to-end AND the
   **SOURCE of every trait/mechanism you plan to reuse** — a trait's real signature (value vs
   accessor, bare call vs anything else) is exactly what a summary gets wrong, and a frozen
   interface built on a summary ships a type error (the toolbar shakedown's two blockers).
   Prose summaries (CLAUDE.md, this skill, the maps) DRIFT from code — verify every API that
   enters a frozen LLD interface against a REAL SHIPPED CONSUMER, never a doc line. Then
   sweep the [[agent-ui-component-patterns]] table — every mechanism the design needs that a
   row already owns is REUSED, not redesigned. Record which rows apply.

3. **Classify — three axes**, each recorded in the vocabulary the descriptor validator
   enforces (`component-descriptor.ts` owns both enums; classify OUTSIDE them and the
   descriptor is rejected):
   - **Base class** — the schema's `BASE_CLASSES` six: `UIElement` (reactive display) ·
     `UIFormElement` (value-bearing form control) · `UIContainerElement` (layout container) ·
     the three `controls/_base/` extends targets `UIIndicatorElement` / `UIRangeElement` /
     `UIListboxElement` (ADR-0042 — check these BEFORE reaching for a raw base; most new
     controls are one of their families). Narrowest that fits; `plan.md` §5 owns the
     forward-looking entries (the orchestrating `UIComponent` tier is planned, not realized —
     needing it is a fork, not a classification).
   - **Size-class, recorded as the descriptor's `tier:` field** — ONE axis, not two: the
     schema's `SIZE_CLASSES` seven (`control · indicator · range · pattern · container ·
     layout · display`). The value picks the sizing lever (`geometry.md` owns each class's
     law: §1 ramp row vs widget ramp vs none) AND drives the standing descriptor/site gates.
   - **Catalog posture**: A2UI-emittable (a catalog row lands with the build) or permanently
     excluded (`EXCLUSION_ALLOWLIST`) — the ADR-0087 catalog-or-allowlist gate is the law;
     ADR-0112 cl.6 is the worked application (is this page/app-owner chrome an agent must
     never emit?).

4. **Fill the fork sheet** — every row gets a decision + a one-line justification; a row that
   needs a NEW mechanism or changes a fleet contract is a **fork** (step 6):
   | Row | Decides |
   |---|---|
   | Tag | `ui-{name}` under the naming law |
   | Anatomy | slots × `data-role` roles; host-as-grid vs rendered cell |
   | Props | typed `prop.enum` unions; which reflect; defaults (`''`-first for inherit-ambient semantics) |
   | Events | ⊂ `change · input · select · open · close · toggle` — a new event name is a fleet-contract fork |
   | Geometry | the (scale × size) → §1-row assignment, or the widget ramp; the control-class frame laws (floors, radius) |
   | Tokens | the `--ui-{name}-*` roles and which `--md-sys-color-{family}-{role}` each consumes; non-color signifier for any intent |
   | A11y | `internals` role/states (never host attributes); keyboard map; focus behavior |
   | Interaction states | hover/active/focus/disabled + `[density]` participation are LAW-owned (`interaction-states.md`) — a row here only when the design DEVIATES from the four-state standard (that deviation is a fork) |
   | Form participation | UIFormElement value/validity semantics; codec need; labelling-seam wiring |
   | Site surfaces | doc + demo pages, gallery/preview specimen, descriptor — and the standing gates they drag (see the testing map) |

5. **The novelty leg** — when NO precedent row/class fits (a genuinely new geometry shape,
   control class, or interaction family): derive from the mechanics in
   `geometry-sizing-spec.md` + the control-class frame laws, and **propose the new
   row/class/mechanism as an explicit ADR fork with a firm recommendation** — the ADR-0048
   date/time-picker intake (a bespoke 2D grid control no ramp row covered) is the worked
   precedent. Never silently invent geometry or a new event; the law grows by ratified
   amendment only.

6. **Decide what the change earns.** Default-no on documents: a TICKET always; SPEC/LLD when
   the work is multi-component or another seat builds it; **ADR only for contract-changing
   forks** — status `proposed` with firm recommendations per fork, and **never self-ratified**
   (only Kim flips a status, by explicit naming). Number = next free per
   `.claude/docs/adr/README.md`; add its README row.

7. **Decompose + test plan.** A decomposition (system-decompose where installed;
   `coverage_check.py --strict` clean) whose leaf accept-criteria cite the
   [[agent-ui-component-testing]] bar — including a built-output leg whenever the design
   depends on production CSS behavior (the TKT-0002 class). The build sequence must be
   dispatchable: one writer per file.

8. **Independent doc review gates the build — non-optional, before freeze.** Hand the record
   set to a fresh-context doc reviewer (`scribe:doc-reviewer` / the house review seat) —
   and PRE-ARM the reviewer: this repo's ADR/SPEC/LLD corpus uses a blockquote-header house
   style gated by its own tests (`adr.test.ts`, coverage_check), NOT scribe frontmatter;
   generic `doc_lint` abstains by design (every reviewer re-discovers this as a MAJOR
   otherwise — spend the review budget on substance). The
   LLD review must include the **frozen-interface-vs-real-code check**: every API the §
   interface names exists with that exact signature in the shipped source (the two recurring
   blocker shapes: an INVENTED API a doc summary suggested, and a value-vs-accessor
   signature mismatch). Findings route back to the designer; delta re-reviews until PASS;
   **the build dispatches only on the PASS**. If the
   builder later hits a wall the frozen design caused, the design REOPENS via escalation —
   a local deviation without escalation is a process breach even when the deviation is right
   (it has happened; the docs must be amended in the same wave).

## Definition of done

- [ ] Job stated; precedent rows recorded; three axes classified.
- [ ] Fork sheet complete — every row decided or explicitly named as an open fork.
- [ ] Contract-changing forks in a `proposed` ADR with firm recommendations (never
      self-ratified); README row added.
- [ ] Decomposition coverage-clean; test plan meets the bar incl. any built-output leg.
- [ ] Independent doc review PASSED; the design is frozen; the build brief names the LLD/spec
      as the contract.

## Worked precedent

The TKT-0003 `ui-theme-provider` intake end-to-end: ADR-0117 + `spec/theme-provider.spec.md`
+ `lld/theme-provider.lld.md` + `decompositions/theme-provider-ship.decomp.json` — including
what review caught pre-build (an unrunnable test design, an unsatisfiable migration gate) and
the honest deviation records the build added. Read it before running your first intake.
