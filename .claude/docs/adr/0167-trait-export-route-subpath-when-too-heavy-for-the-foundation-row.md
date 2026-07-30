# ADR-0167 — A trait too heavy for the foundation row rides its own declared `./traits/*` subpath

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-30
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-30 |
> | **Proposed by** | planner (design seat — the GH [#377](https://github.com/kimgranlund/agent-ui/issues/377) §1 intake; the record PR [#375](https://github.com/kimgranlund/agent-ui/pull/375)'s component review judged MISSING while judging the shape RIGHT) |
> | **Ratified by** | *(awaiting Kim — ADR-0149: an in-tree Status hand-edit, or a `ratify ADR-0167` GitHub utterance executed by `scripts/adr_ratify.py`)* |
> | **Repairs** | **On ratification:** a dated REV forward pointer on [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md) (its LLD-C6 widening wrote the standing note this amends — the ADR-0156 cl.5 / ADR-0165 pointer shape). **On ratification+build:** `packages/agent-ui/components/src/index.ts` (the standing note gains the third route + this ADR's ID; the shipped `./traits/overlay` bytes are UNCHANGED — PR #375 already built them) |
> | **Supersedes / Superseded by** | **Amends [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md)** — its LLD-C6 note "the rest of `traits/` stays internal until another consumer earns it the same way" keeps its default-internal posture verbatim; only the closed phrase *"the same way"* opens from one route to three. **Relates** [ADR-0155](./0155-shell-responsive-band-ladder-toggle-law-scrollbar-seam.md) cl.3 (its "never a silent deep-import" clause is UPHELD, not amended — see cl.5), the export-surface chain [ADR-0055](./0055-a2ui-example-seeds-package-home.md) → [ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md) → [ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) → [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) → [ADR-0119](./0119-code-prose-family-v1-scope.md)/[ADR-0139](./0139-codemirror-editor-first-runtime-dependency.md)/[ADR-0162](./0162-genui-agent-ui-dogfood-mode.md)/[ADR-0164](./0164-entry-list-extraction-home.md), and [ADR-0023](./0023-components-mount-directive-host-public-seam.md) (the `mount()` public-API-widening precedent both prior trait widenings rode) · **Resolves** GH #377 §1 |

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

2. **The barrel's own standing law was written by two widenings that both went the OTHER way.**
   `components/src/index.ts` carries "the rest of `traits/` stays internal until another consumer
   earns it the same way" — authored by `paneResize` (ADR-0154's LLD-C6) and followed by `scrollFade`
   (ADR-0155's SPEC-R10b/cl.3). "The same way" was, both times, *root barrel + a ratified clause*.
   This widening earned it differently on **both** counts — a subpath, not the barrel; forced by a
   measurement, not chosen — and so reads, against the letter of the note it sits beside, as a
   violation of it. It is not one; nothing said so.

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
   "the same way" from one route to three; it does not repeal default-internal.

2. **"Leaf" is a checkable predicate, not a judgment: the trait module's every import is either
   `import type` or relative-within-its-own-package.** `overlay.ts` satisfies it maximally — it has
   **exactly one import statement in the file**, `import type { UIElement } from '../dom/index.ts'`,
   which is both. Nothing runtime crosses the subpath boundary, so the subpath adds zero transitive
   cost to a consumer who imports it and zero to everyone who does not.

3. **The qualifying test is a measurement on the foundation row, run before the route is chosen —
   never after.** `node scripts/measure-size.mjs`, the
   `@agent-ui/components . (reactive+dom barrel)` row, measured **with the candidate re-exported
   from `src/index.ts`**. Over budget ⇒ (c). Under ⇒ (b). A route argued from a byte count nobody
   ran is not this rule; the whole point of the `traits/overlay` case is that the barrel arm was
   built, measured at 8387, and *then* abandoned.

4. **`traits/overlay` is the realized precedent this rule cites, and its shipped bytes are
   unchanged by this record.** PR #375 built it; this ADR records the rule it instantiated. Nothing
   here asks for a re-build.

5. **A declared subpath is a public surface, so ADR-0155 cl.3's "never a silent deep-import" is
   satisfied, not excepted.** The distinction is the `exports` map: `@agent-ui/components/traits/overlay`
   is an enumerated entry point with the same standing as `./descriptor` or `./controls/menu`;
   `@agent-ui/components/src/traits/overlay.ts` would be the deep import ADR-0155 rules out, and stays
   ruled out. Route (c) is a third *legitimate* answer alongside the barrel and internal — never a
   sanctioned way around the barrel.

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
- **One pointer owed backward.** ADR-0154's LLD-C6 note is amended in its "the same way" phrase only;
  it takes a dated REV forward pointer at ratification (ADR-0156 cl.5 shape) and otherwise stays
  accepted and untouched. ADR-0155 needs no pointer — cl.5 upholds its clause rather than amending it.
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
  Same objection, more strongly, to ADR-0154.
- **A dated REV on `lld/shell-responsive.lld.md`** (SPEC-R10b's build doc). Rejected for the same
  reason plus one worse: an LLD owns *how a build was made*, and this rule governs a package's public
  contract across future waves. Wrong tier, wrong subject, and the doc's own Layer line says so.
- **Amend the two prior widenings' records in place** so "the same way" reads correctly. Rejected on
  the repo's own append-only law for accepted ADRs (`agent-ui-doc-standards` §2): extensions land as
  Amendment sections or as rows in the current wave's own proposed ADR. This *is* that row.
- **State the rule as a byte threshold ("a trait over ~500 B gz takes a subpath").** Rejected: the
  budget, not the trait, is the moving part — a re-base of the foundation row changes the right answer
  without changing any trait. Keying on the measured budget outcome instead of an absolute number
  makes the rule survive its own inputs.
- **Mint a `@agent-ui/traits` package instead.** Rejected: it buys nothing the subpath does not
  already buy (identical zero-cost-when-unimported property, since cl.2's leaf test is what delivers
  that), and costs a new DAG node, a package.json, a build/publish lane, and a layering trip-wire —
  the same accounting that rejected a new package in ADR-0164 cl.(a).
