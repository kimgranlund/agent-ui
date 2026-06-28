# Rubric — docs-site page (the skill's output)

> Scores one `/site` page for whether it derives from a canonical source, runs the real thing, is backed
> by a deterministic drift gate, and reads honestly. Built with `authoring-rubrics`. The author builds to
> this; a **separate** reviewer (the `docs-site-steward` agent, or the host gate) scores it. Scale 1–5;
> `[gate]` = mechanically checkable (a named check/build green is the evidence), `[review]` = judgement on
> `file:line` + the committed gate results. The reference page the anchors cite is `button-doc.ts` (T4).
> 2026-06-28.

## Cross-cutting dimensions (every page)

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| D1 | Type fit & completeness | [review] | The page is the right content type (T1–T9) and contains everything its per-type addendum requires | 1: wrong type, or missing a defining element (an API doc with no table) · 3: right type, the required elements present · 5: + the type's distinctive value is fully realized (the matrix is complete-by-construction, the canvas shows the full round-trip incl. errors) |
| D2 | Derivation discipline | [gate] | Every **derivable** fact is derived from its canonical source — attribute rows from `parseDescriptor`, specimens from the parsed enum, the shown payload from the fed object; zero hand-typed copies | 1: a hand-typed attribute table / a parallel enum list · 3: the page consumes the canonical parser/source for every derivable fact; hand-authored content is flagged · 5: + the only hand-authored content is genuinely underivable (a markup shape) and labelled as such |
| D3 | Drift gate wired | [gate] | The page's **structurable** facts are backed by a green deterministic check (`site-canon`, the descriptor trip-wire, a coverage enumeration); soft facts cite their upstream by ID | 1: a structurable fact (a name, an API row, a missing page) with no backing check · 3: every structurable fact is gated and green; soft facts cite an owner · 5: + a new enumeration/lint was added where coverage demanded one (e.g. every descriptor → a page) |
| D4 | Liveness & honesty | [gate] | Live demos run the **real** renderer/control through its **public** surface (no mock, no screenshot, no internals); state/round-trip is shown truthfully | 1: a mocked renderer, a static image, a hand-drawn state · 3: the demo mounts the real control / runs `createRenderer` via its public API · 5: + it is the visible twin of the integration test (real round-trip, errors shown, repeatable, leak-free) |
| D5 | Scaffold-only | [gate] | The page owns only layout chrome and **never restyles a `ui-*` control**; it imports `_page.ts` first (the foundation cascade); slot/role names are canonical | 1: page CSS sets `:hover`/colour on a control, or `_page.ts` isn't first · 3: page CSS is scaffold-only (consumes `--c-*` roles); `_page.ts` first; `site-canon` green · 5: + appearance/states are demonstrably the control's, the page adds no `tabindex`/ARIA the control owns |
| D6 | Voice & retrievability | [review] | Precise, honest, scannable prose that *shows* over asserts and **cites** canonical docs by ID rather than restating them | 1: marketing claims the render can't back, or restated `docs/` prose · 3: plain declarative, honest labels, cites owners · 5: + every claim is reproducible by manipulating the live page; zero restated canon |
| D7 | Build green | [gate] | `npm run check` (tsc) and `npm test` (Vitest) pass, including the site drift gates and any new check the page wired | 1: type errors or a failing/absent gate · 3: both green incl. `site-canon` + the descriptor trip-wires · 5: + the page's own new gate is green and anti-vacuous (a negative control fails) |

## Per-type addendum — what D1 completeness means, and the load-bearing gate

What "complete" means per type, and which gate dimension is load-bearing for it (kept as prose, not a
table, so only the dimension table above is scored mechanically):

- **T1 landing** — must contain a live hero (real control) + a card grid mirroring the nav, every target
  resolving. *Load-bearing:* liveness (the hero is real).
- **T2 permutation matrix** — the full enum cross built programmatically, plus the anatomy and
  `[scale]`/`[density]` axes. *Load-bearing:* derivation (enum-driven) + the drift gate (site-canon).
- **T3 states showcase** — each interaction state honestly labelled as the *control's*, plus a real
  activation log. *Load-bearing:* scaffold-only (no restyle) + liveness (the log is real).
- **T4 API doc** — the descriptor-derived attribute table + enum specimens + body; hand-authored shapes
  flagged. *Load-bearing:* derivation (the parser) + the drift gate (the contract trip-wire).
- **T5 live A2UI demo** — a literal payload → the real `createRenderer` → a live control → the round-trip
  log (errors included). *Load-bearing:* liveness (the public surface, no internals).
- **T6 conceptual guide** — the *why/how*, citing `docs/` by ID, with type-checking code samples.
  *Load-bearing:* voice (cite-not-restate) + build (the samples compile).
- **T7 family overview** — every shipped member listed + linked, reserved names marked reserved.
  *Load-bearing:* the drift gate (a coverage enumeration).
- **T8 playground** — inputs derived from the parsed enum, each driving a real attribute on a real
  control. *Load-bearing:* derivation (enum-driven) + liveness (the real control).
- **T9 recipe** — a real, live, minimal composition where the shown source == the running source.
  *Load-bearing:* liveness (it runs) + build (it type-checks).

## Gate to promote (the page is shippable)

- **Every `[gate]` dimension (D2, D3, D4, D5, D7) is PASS** — a mechanically-checkable fact that fails is
  not negotiable (a hand-maintained table, an ungated structurable fact, a mocked demo, a restyled
  control, a red build each block the page regardless of prose quality).
- **Both `[review]` dimensions (D1, D6) score ≥ 4.**
- **No compensation** — excellent prose (D6=5) cannot offset a hand-maintained table (D2 fail); the
  derivation and liveness gates are the spine of the page, not negotiable against polish.

**Top failure to look for first:** a **hand-maintained derivable fact** (D2) — an attribute table or
specimen set typed by hand instead of parsed. It reads perfectly the day it ships and drifts the moment
the descriptor changes, and no in-package trip-wire catches a *site* copy. Second: a **mocked or
screenshotted demo** (D4) that advertises behaviour the page doesn't actually run.
