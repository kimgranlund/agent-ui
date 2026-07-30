# ADR-0167 — A trait too heavy for the foundation row rides its own declared `./traits/*` subpath

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-30
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-30 |
> | **Proposed by** | planner (design seat — the GH [#377](https://github.com/kimgranlund/agent-ui/issues/377) §1 intake; the record PR [#375](https://github.com/kimgranlund/agent-ui/pull/375)'s component review judged MISSING while judging the shape RIGHT) |
> | **Ratified by** | *(awaiting Kim — ADR-0149: an in-tree Status hand-edit, or a `ratify ADR-0167` GitHub utterance executed by `scripts/adr_ratify.py`)* |
> | **Repairs** | **On ratification (courtesy pointer, not a repair of amended text):** a dated REV forward pointer on [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md) — its Consequences left the `paneResize` export CONDITIONAL ("if the LLD's recommended fork lands", `:91-93`), so a reader arriving there deserves the onward link to where the route question was finally answered (the ADR-0156 cl.5 / ADR-0165 pointer shape). **On ratification+build:** `packages/agent-ui/components/src/index.ts` (the standing note at `:7` gains the subpath route + this ADR's ID; the shipped `./traits/overlay` bytes are UNCHANGED — PR #375 already built them) |
> | **Supersedes / Superseded by** | **Amends no ADR** — the amended text is not in one. What this record opens is the standing note at `components/src/index.ts:7` ("the rest of `traits/` stays internal until another consumer earns it the same way"), a **code comment with no document owner**: it cites LLD-C6 (`../lld/agent-admin-shell-rehost.lld.md` §7) as its authority, but that row is an OPEN FORK — its Component cell says the fork "needs a ruling with, or after, ADR-0154" and its Files cell still reads `components/src/index.ts` **OR** super-shell-local, an unresolved either/or (`:22`); the LLD's own build sequence presumes the ruling was still to come ("1. LLD-C6 ruling lands with ADR-0154's ratification → 2. …", `:136`) — and ADR-0154 itself only ever spoke of the export conditionally (`:91-93`). Its default-internal posture stands verbatim; only the closed phrase *"the same way"* opens. That a fleet-reach export law lives in a comment no doc owns is precisely why this record exists. **Relates** [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md) (the wave the note was authored under) · [ADR-0155](./0155-shell-responsive-band-ladder-toggle-law-scrollbar-seam.md) cl.3 (its "never a silent deep-import" characterization is GENERALIZED here — see cl.5) · the export-surface chain [ADR-0055](./0055-a2ui-example-seeds-package-home.md) → [ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md) → [ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) → [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) → [ADR-0119](./0119-code-prose-family-v1-scope.md)/[ADR-0139](./0139-codemirror-editor-first-runtime-dependency.md)/[ADR-0162](./0162-genui-agent-ui-dogfood-mode.md)/[ADR-0164](./0164-entry-list-extraction-home.md), and [ADR-0023](./0023-components-mount-directive-host-public-seam.md) (the `mount()` public-API-widening precedent both prior trait widenings rode) · **Resolves** GH #377 §1 |

## Context

`@agent-ui/components` gained its **first `./traits/*` export subpath** in PR #375 —
`"./traits/overlay": "./src/traits/overlay.ts"` in `components/package.json` — so that
`@agent-ui/app`'s `ui-nav-rail` could reach the non-modal Overlay controller (ADR-0043/0045) for its
`collapse="menu"` arm. A **new export-namespace category**, recorded nowhere in the doc tier.

Three facts make that gap load-bearing rather than cosmetic.

1. **Every prior export widening in this repo is ADR-tier, in a chain that cites itself.** Verified
   in-tree, not asserted: ADR-0062's own header cell reads "Relates ADR-0055 (the `./examples`
   subpath + bundle-hygiene precedent this follows)"; ADR-0066 cl.3 names "the ADR-0055/0062 subpath
   rule"; ADR-0137 cl.4 cites "ADR-0055 clause 3 / ADR-0062 clause 4". A new namespace category that
   joins no link of that chain is unfindable from any of them.

2. **The barrel's standing law is a code comment that no document owns — and the two widenings it
   invokes went the other way with markedly different authority.** `components/src/index.ts:7`
   carries "the rest of `traits/` stays internal until another consumer earns it the same way".
   Tracing "the same way" to its sources:

   - **`paneResize`** — the note cites LLD-C6 (`../lld/agent-admin-shell-rehost.lld.md` §7). That row
     is an **open fork**, not a ruling, and says so three ways: its Component cell reads "The
     drag-mechanism fork (§7 — **needs a ruling with, or after, ADR-0154**)"; its Files cell is an
     unresolved either/or, "`components/src/index.ts` **OR** super-shell-local" (`:22`); and the
     LLD's own build sequence presumes the ruling was still ahead of it — "1. LLD-C6 ruling lands
     with ADR-0154's ratification → 2. …" (`:136`). ADR-0154 in turn speaks of the export only
     **conditionally**, in Consequences: "The fleet gets ONE drag-resize mechanism **if the LLD's
     recommended fork lands** … a public-API widening needing its own gate check; the alternative is
     an independent re-derivation, the LLD's named fork" (`:91-93`). The export shipped; **no
     document records the ruling that shipped it.**
   - **`scrollFade`** — genuinely ratified, and the stronger of the two: ADR-0155 cl.3, realizing
     SPEC-R10b (`../spec/shell-archetypes-m5.spec.md:275`).

   So "the same way" describes *one* ratified precedent and one undocumented one — and the sentence
   asserting the default lives in neither. This widening then earned its place differently again — a
   subpath, not the barrel; forced by a measurement, not chosen — and so reads, against the letter of
   the note it sits beside, as a violation of it. It is not one; nothing said so, because there is no
   document in which anything could have.

3. **The barrel route was measured and rejected, not skipped.** Re-exporting `overlay` from
   `src/index.ts` cost **+945 B gz on the foundation row** (7442 → 8387 against that row's
   `7.5 * KB` = **7680 B gz** budget in `scripts/measure-size.mjs`) — a breach, because `overlay.ts`
   carries the whole measure-and-place positioning controller and this row is the reactive+dom
   foundation **every** consumer pays for, `ui-nav-rail` user or not. The figures are PR #375's
   measurement; the 7680 B budget is verified live in the script.

The residual headroom on that row is therefore **238 B gz** (7680 − 7442). The barrel route is not
merely unattractive for the next heavy trait — it is nearly closed by arithmetic. Leaving that
unrecorded means the next trait widening reverse-engineers a rule from a code comment about one
trait's byte count, which is guessing at a precedent.

## Decision

**We will record the route rule the `traits/overlay` case realized: a trait too heavy for the
foundation row rides its own declared `./traits/*` subpath.** Five clauses.

1. **The route is a decision procedure with four outcomes, keyed on two measurable inputs — the
   trait's consumer set and its measured cost on the foundation row.** Applied in order:

   | # | Condition | Route |
   |---|---|---|
   | a | No consumer outside `@agent-ui/components` | **stays internal** — relative import only; no export of any kind |
   | b | An out-of-package consumer exists, AND the barrel route keeps `@agent-ui/components . (reactive+dom barrel)` inside its `measure-size.mjs` budget | **root barrel**, named export (the `paneResize`/`scrollFade` route, ADR-0023's precedent) |
   | c | (b)'s consumer test passes but the barrel route **breaches** the budget, and the trait is a leaf per cl.2 | **its own `./traits/<name>` subpath** (the `traits/overlay` route, ratified here) |
   | d | The barrel route breaches AND the trait is not a leaf | **neither** — the trait is re-examined, not exported. A heavy non-leaf on a public surface exports its dependency graph with it |

   Row (a) is the **unchanged default** and stays the answer for most of `traits/`. This ADR opens
   "the same way" from one export route to two, inside a four-outcome procedure; it does not repeal
   default-internal.

2. **"Leaf" is the property itself, stated directly: the trait module's RUNTIME import closure adds
   no module the foundation row does not already carry.** `import type` edges are free — they erase
   at compile time and reach nothing at runtime. Stated this way the predicate *is* the guarantee it
   is invoked for; a structural proxy ("every import is type-only **or** relative") would admit a
   relative runtime edge like `import { effect } from '../reactive/index.ts'`, dragging the signals
   kernel into the subpath's graph while still reading as a leaf. `overlay.ts` satisfies the real
   property maximally — **exactly one import statement in the file**, and it is type-only
   (`import type { UIElement } from '../dom/index.ts'`), so its runtime closure is empty. That is
   what makes the subpath cost a taking consumer nothing transitively and everyone else nothing at
   all.

3. **The qualifying test is a measurement on the foundation row, run before the route is chosen —
   never after.** `node scripts/measure-size.mjs`, the
   `@agent-ui/components . (reactive+dom barrel)` row, measured **with the candidate re-exported
   from `src/index.ts`**. Over budget ⇒ (c). Under ⇒ (b). A route argued from a byte count nobody
   ran is not this rule; the whole point of the `traits/overlay` case is that the barrel arm was
   built, measured at 8387, and *then* abandoned.

4. **`traits/overlay` is the realized precedent this rule cites, and its shipped bytes are
   unchanged by this record.** PR #375 built it; this ADR records the rule it instantiated. Nothing
   here asks for a re-build.

5. **"Never a silent deep-import" is generalized from a characterization into a standing principle,
   and route (c) satisfies it by construction.** ADR-0155 cl.3 applied that phrase to one export —
   it characterized the `scrollFade` barrel widening, it did not legislate a route grammar. This
   record promotes the phrase to a rule that binds every route above, and finds the subpath
   compliant on a mechanism stronger than intent: **a declared `exports` map makes
   `@agent-ui/components/src/traits/overlay.ts` unresolvable.** Node and every bundler that honors
   `exports` refuse a specifier the map does not enumerate, so the deep import is *blocked*, not
   discouraged — while `@agent-ui/components/traits/overlay` is an enumerated entry point with the
   same standing as `./descriptor` or `./controls/menu`. Route (c) is therefore a second legitimate
   *export* answer alongside the barrel — never a sanctioned way around it. (`src/index.ts:17-20`
   already reasons this way about the shipped subpath; this clause states the principle it was
   applying, which is the part that was never written down.)

**Deliberately not ruled here:** whether a `./traits/*` subpath owes a `measure-size.mjs` target and a
`controls/tree-shake.test.ts` case. That is GH #377 §3, being built by a sibling seat in the same
wave; this record neither pre-empts its answer nor owns the file. Named so the absence reads as
routing, not omission.

## Consequences

- **The barrel route is nearly closed by arithmetic, and this record makes that explicit rather than
  discovered.** 238 B gz of headroom means most future traits land on (c) or (a). That is the honest
  negative consequence: the rule as written will, in practice, mint subpaths — and every subpath is a
  semver commitment the package carries forever. A future re-base of the 7680 B budget (the
  ADR-0040/0049 discipline) re-opens (b) by exactly as much as it re-bases, with no edit to this ADR.
- **`traits/` acquires a public namespace with exactly one member.** Adding a second is now a rule
  application, not a precedent argument — which is the whole gain. The cost is that
  `components/package.json`'s exports map grows a category that will accrete.
- **One courtesy pointer owed backward — and no ADR amended.** The opened sentence is a code comment
  no document owns, so there is no ADR text to amend and none is edited. ADR-0154 nevertheless takes a
  dated REV forward pointer at ratification (ADR-0156 cl.5 shape): its Consequences leave the
  `paneResize` export conditional on a fork whose ruling was never recorded, so a reader landing there
  should be pointed at where the route question finally got answered. ADR-0155 needs no pointer —
  cl.5 generalizes its phrase rather than altering its clause.
- **This record rules the route forward; it does not retro-authorize the `paneResize` export.** That
  gap — an export shipped against an unruled fork — became visible only while tracing this rule's
  provenance, and closing it would mean minting a ratification after the fact, which is not a design
  seat's to mint. Whether it earns its own closing record is Kim's call, not this record's.
- **`src/index.ts`'s standing note gains this ADR's ID at build.** The note today states the *case*
  (+945 B, this trait); it will state the *rule* and cite where the rule lives. Same one-fact-one-home
  discipline the note already follows.
- **No gate changes and no runtime change.** The rule is applied by a human/agent choosing a route at
  design time, enforced by the existing `measure-size.mjs` budget when the wrong route is taken —
  the budget reds, exactly as it did in PR #375.

## Alternatives considered

- **Write nothing — let `src/index.ts`'s comment be the record.** Rejected: the comment states one
  trait's byte count, not a rule; it names no threshold, no leaf test, and no fourth outcome for a
  heavy non-leaf. It is also invisible from the export-surface ADR chain, where anyone asking "how do
  we widen an export here" will actually look. The review's own verdict — shape RIGHT, record MISSING
  — is precisely this gap.
- **An `## Amendment` section on ADR-0155** (the most recent trait widening). Rejected: ADR-0155 is
  the *shell responsive system* — the `scrollFade` export is one clause of five, serving a shell
  concern. Filing a components-package export law under that title buries a fleet-reach rule where
  nobody searching for it will look, and would grow an accepted ADR sideways off its own subject.
  Same objection to ADR-0154, plus a disqualifying one: it never ratified its trait export at all
  (`:91-93` is conditional), so amending it would attach a route law to a record that never ruled on
  a route.
- **A dated REV on either LLD in play.** Two exist and both were weighed. `lld/shell-responsive.lld.md`
  (the build doc for `shell-archetypes-m5.spec.md`'s SPEC-R10b) is ADR-0155's, and
  `lld/agent-admin-shell-rehost.lld.md` — the one that actually holds LLD-C6, the fork the barrel
  comment cites — is ADR-0154's. Rejected for the same subject mismatch as above plus one worse: an
  LLD owns *how a build was made*, and this rule governs a package's public contract across future
  waves. The second is additionally the wrong instrument for its own gap — LLD-C6's fork was left
  unruled (`:22`), and a REV appended to a stale fork row would record the answer at a tier below the
  question, where the export chain still could not see it.
- **Amend the two prior widenings' records in place** so "the same way" reads correctly. Rejected
  twice over: the repo's append-only law for accepted ADRs (`agent-ui-doc-standards` §2) routes
  extensions to the current wave's own proposed ADR — this *is* that row — and, more simply, neither
  record contains the sentence. It is in `src/index.ts`.
- **State the rule as a byte threshold ("a trait over ~500 B gz takes a subpath").** Rejected: the
  budget, not the trait, is the moving part — a re-base of the foundation row changes the right answer
  without changing any trait. Keying on the measured budget outcome instead of an absolute number
  makes the rule survive its own inputs.
- **Mint a `@agent-ui/traits` package instead.** Rejected: it buys nothing the subpath does not
  already buy — the zero-cost-when-unimported property comes from cl.2's empty runtime closure, not
  from the packaging boundary, so a separate package would inherit exactly the same guarantee and
  exactly the same failure mode if that closure were ever non-empty — and it costs a new DAG node, a
  package.json, a build/publish lane, and a layering trip-wire —
  the same accounting that rejected a new package in ADR-0164 cl.(a).
