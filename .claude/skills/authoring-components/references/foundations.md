# Foundations — authoring a ui-* component

> The load-bearing mental models component-authoring assumes. Canonical depth lives in the cited docs;
> this names the concepts so the procedure's judgements have ground to stand on. Distilled 2026-06-26
> from `docs/plan.md`, `docs/process.md`, `docs/references/geometry.md`, `docs/references/tokens.md`.

## The layered architecture

`reactive` ← `dom` ← `traits` ← `controls`. Imports point **inward only**; cross-package, only
`components` → `@agent-ui/shared`. A component is the top layer, built on the bases — it never reaches
into kernel internals. (`CLAUDE.md`, `docs/process.md`)

## FACE — form-associated custom elements

Form controls participate in a real form via `ElementInternals` (`setFormValue`, `setValidity`, `role`,
`aria*`), **not** a native `<input>`. ARIA is internals-only — never a host `role`/`aria-*` attribute.
Light DOM by default. No native form elements. (`docs/plan.md` §5)

## Props are typed signals

A declared prop **is** a kernel signal behind a prototype accessor: read inside an effect → it tracks;
write → it invalidates. The stringly attribute surface crosses to typed values at exactly two functions
under directional locks. Types flow from the schema via `ReactiveProps<typeof props>` + class/interface
declaration-merge — **no decorators** (`erasableSyntaxOnly` bans them). (`docs/plan.md` §5)

## Traits vs controllers

Cross-cutting behaviour composes by calling the trait directly from the control's `connected()` (there is no
`host.use()`): a **trait** is a stateless `(host, opts) => cleanup` applied *to* the host (e.g.
`tabbable(this, …)`); a **controller** is a stateful object the host reads *from* (owns signals, exposes an
API). Both ride the connection scope and die on disconnect. (`docs/plan.md` §7)

## The two design axes

A component is judged on two crossing planes, scored **separately**: **COMPOSE** (whole→part: layer ·
anatomy · API · composition · coherence) and **REALIZE** (part→whole: geometry · element · semantics ·
interaction · fidelity). A clean API can't hide an inert build; the axes are never averaged.
(`docs/process.md`; the component rubric)

## Geometry & tokens

Sizing follows the centering law and the five size-classes; color follows the role system. These are
canonical elsewhere — never restate them: `docs/references/geometry.md`, `docs/references/tokens.md`.

## The two diseases

**Drift** (representation diverging from reality) and **bloat** (brittle-feature accretion). The
authoring procedure is anti-drift *by construction*; the trip-wires + rubric are the loud contracts that
catch what construction misses. (`docs/process.md`)
