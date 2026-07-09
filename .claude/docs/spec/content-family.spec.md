# SPEC — Content Family (`ui-code` + the `ui-text` hyperlink capability + `ui-disclosure` + catalog surface)

> Status: proposed · v0.1 · 2026-07-08 · Layer: SPEC (execution contract)
> Refines: [`../prd/content-family.prd.md`](../prd/content-family.prd.md) — **PRD-G1, PRD-G2, PRD-G3, PRD-G4, PRD-G5** — under the ratified scope + contract directions of [ADR-0113](../adr/0113-content-family-v1-scope.md) (accepted; forks F1–F4 as recommended) and [ADR-0114](../adr/0114-text-hyperlink-href.md) (accepted; forks F1–F3 as recommended). Every clause of both ADRs is binding here; this SPEC adds the behavior contract, it re-litigates nothing.
> Refined by: [`../lld/content-family.lld.md`](../lld/content-family.lld.md). Build plan: [`../decompositions/content-family-build.decomp.json`](../decompositions/content-family-build.decomp.json) (coverage-clean, plan mode).
> Altitude: owns **what the two new controls and the widened `ui-text` do and how they behave at every boundary** + the family's catalog contract — including the fleet's **first security-sensitive component contract** (the href scheme gate, ADR-0114). Implementation (gate function internals, CSS mechanics, file layout) is the LLD's. Filed in the charter home (`.claude/docs/spec/`, the chart-family regime); the catalog surface (§5.2 of [`../specs/specs/a2ui-catalog.spec.md`](../specs/specs/a2ui-catalog.spec.md)) stays a first-class same-wave deliverable, cross-referenced.
> Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Contract the v1 content family ADR-0113 admits: `ui-code` (block-level verbatim code display — zero
machinery), the hyperlink capability on `ui-text` (`as` gains `"a"` + a gated `href`, ADR-0114), and
`ui-disclosure` (a native-`<details>`-wrapped summary/body fold), all hand-rolled under the zero-dep
pillar, entering the default catalog (`Code`, `Disclosure`, `Text.href`) in the same wave they ship, the
feed partition paid at the same moment. The fence stands: everything in PRD §3's ruled-out list (syntax
highlighting, copy-to-clipboard, inline chips, soft-wrap/line-number/max-height knobs, `target`/`download`
knobs, non-allowlisted schemes, exclusive accordion, fold animation, rich summary slots, the site
`code-block.ts` swap) is out of this SPEC's normative reach; SPEC-R3 and SPEC-R16 restate the two fences
that carry named escape hatches.

## 2. Definitions

- **Write path** — one of the four routes a value reaches a `ui-text` prop: **(P1) attribute** (parser/`setAttribute`), **(P2) property** (JS accessor), **(P3) factory** (the catalog `applyProp` static-prop apply), **(P4) bound** (a `{path}` binding's render-time update via the renderer's bound-prop effect). All four converge on the same prop→stamp path (ADR-0078 cl.4) — the mechanical fact the one-gate contract stands on.
- **The gate** — the component-enforced scheme allowlist of ADR-0114 cl.2: parse, verdict, apply-or-deny. It validates; it never rewrites.
- **Allowed scheme** — the resolved scheme is `https:` · `http:` · `mailto:` (ADR-0114 fork F1 as recommended). Relative URLs resolve against `document.baseURI` and therefore normalize to http/https.
- **Denied value** — any `href` whose resolved scheme is not allowed, or that cannot be parsed as a URL against `document.baseURI`. `javascript:`, `data:`, `blob:`, `file:`, `vbscript:`, and unknown/custom schemes are always denied.
- **No destination** — `href` whose value is empty or whitespace-only after `String.prototype.trim`. Deliberately distinct from a denied value: it is the prop's default state, not a violation. (Load-bearing: `new URL('', document.baseURI)` resolves to the page itself — without this rule the default `href` would mint a self-link.)
- **The stamp** — the one real element `ui-text` wraps its light-DOM children in while `as ≠ none` (ADR-0078 cl.4). For `as="a"` the stamp is a real `<a>`.
- **The details part / body part** — the component-owned `<details>` element inside `ui-disclosure` and the container inside it that holds the adopted light-DOM children (the "children = body" invariant).
- **Actual transition** — `ui-disclosure`'s open state really changing (closed→open or open→closed), by user click, data/model write, or find-in-page auto-expand — the ADR-0101 vocabulary.

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 `ui-code`

**SPEC-R1 — Component contract (the zero-machinery leaf).** `ui-code` MUST be a Display-class,
non-interactive, non-form-associated leaf (`UIElement`; no events, no keyboard contract) with exactly one
prop: `language` (`string`, default `''`, reflected). **Content model: host-as-content** (ADR-0113 fork
F2): the light-DOM text IS the code; there is no `code` prop on the element, no `html``` template
(`render()` stays the inherited void), **no stamp, and no MutationObserver** — nothing to heal, because a
`textContent` write (the catalog's bound-content lane) replaces plain text with plain text. The absence of
machinery is normative, not incidental. *(→ PRD-G1; ADR-0113 cl.2)*
- **AC1** *Given* `<ui-code>npm run check</ui-code>`, *when* connected, *then* the text renders verbatim and `el.language === ''`.
- **AC2** *Given* `code.ts`, *then* a grep finds **no** `MutationObserver` and no stamp/adoption code in the file (the ADR-0106 grep-able-absence precedent, applied to the zero-machinery ruling).
- **AC3** *Given* the descriptor (`code.md`), *then* `tier: display`, `extends: UIElement`, `events: []`, and the `attributes[]` block mirrors `static props` (the descriptor↔props trip-wire).

**SPEC-R2 — Verbatim, self-scrolling rendering.** The component MUST render its text with whitespace
preserved (`white-space: pre` — newlines and indentation live in the text nodes, so copy-paste fidelity is
free), in the `--ui-mono` typeface at body-class metrics (the `--md-sys-typescale-body-*` row; exact
tokens are the LLD's), on a component-owned surface with the fleet `--ui-radius-base` corner, and MUST own
its horizontal overflow: `overflow-x: auto` **on the component** — the ADR-0102 Lane A law: a bare
`<ui-code>` in any container (including a narrow flex column and a feed bubble) never wraps mid-token and
never blows out its container, with zero consumer CSS. Long content scrolls **inside the component's own
box**. *(→ PRD-G1, PRD-G4; ADR-0113 cl.2; ADR-0102)*
- **AC1** *Given* a 120-column single-line snippet inside an unstyled 240px-wide container, *when* painted (browser, both engines), *then* the host box stays ≤ its container's inline size, `scrollWidth > clientWidth` on the scroll box, and no text wraps (whole-shape law: the host box paints, non-collapsed).
- **AC2** *Given* a multi-line snippet with leading indentation, *then* rendered line breaks and indentation are exactly the source's (computed `white-space` is `pre`), and the computed `font-family` resolves the `--ui-mono` stack.
- **AC3** *Given* the same content selected and copied (browser leg), *then* the clipboard text equals the source text including newlines.
- **AC4** *Given* the parser nicety (ADR-0113 Consequences): `<ui-code>\ncode</ui-code>`, *then* the leading newline renders (unlike native `<pre>`); the descriptor documents the authoring guidance — no machinery strips it.

**SPEC-R3 — Bindable content lane + the plain-text guarantee.** The catalog `Code.code` property MUST map
to `textContent` (the `Text.text` lane — one content model, ADR-0113 fork F2). Under every bound or
factory write the component guarantees **plain text**: content lands via `textContent` assignment only,
is never parsed as HTML, and never executes — a code sample is data (the `site/lib/code-block.ts` safety
contract, promoted). The **light-DOM freedom escape hatch** (ADR-0113 cl.2, named): an app author MAY
inject pre-highlighted element children directly; the component leaves them untouched, and a subsequent
bound `code` write clobbers them to a single text node — guaranteed plain text wins, by design. *(→
PRD-G1; ADR-0113 cl.2)*
- **AC1** *Given* a bound `code` value of `"<img src=x onerror=alert(1)>"`, *when* applied through the factory or a data-model update, *then* the literal string renders as text, no element is created, and no script executes (jsdom: `el.children.length === 0`; the text node holds the exact string).
- **AC2** *Given* author-injected `<span class="tok">` children, *then* they render untouched until a bound `code` write replaces all children with one text node.

**SPEC-R4 — `language` is inert metadata.** `language` MUST be a reflected, free-string prop with **zero
rendering effect** at v1 — no enum (nothing for the ADR-0098 static-enum lane to gate), no highlighter
dispatch, no class toggling. It exists so model-emitted markdown-fence habits round-trip losslessly and as
the forward hook the site helper's `data-lang` proved. *(→ PRD-G1; ADR-0113 cl.2)*
- **AC1** *Given* `language="typescript"` vs no `language`, *then* the rendered boxes are byte-identical in computed style and DOM shape (attribute aside).
- **AC2** *Given* `el.language = 'json'`, *then* the attribute reflects; *given* the attribute removed, *then* the prop reads `''`.

**SPEC-R5 — A11y + keyboard-scroll posture.** The host MUST carry `role=code` via `ElementInternals`
(never host attributes — fleet law; the HTML-AAM mapping of native `<code>`, applied to the custom
element). The text is real, selectable light-DOM text (`user-select: text`) and is fully present in the
accessibility tree regardless of visual scroll position. Keyboard access to the scrolled overflow rides
the platform's focusable-scroller behavior where it exists; the component MUST NOT mint a `tabindex` or
any measurement machinery for it at v1 (the zero-machinery ruling) — the residual (engines without
focusable scrollers leave horizontal scrolling to selection/AT navigation) is **named and accepted**, and
a `tabindex` affordance is a foreseen extension on evidence, not a rider. *(→ PRD-G4; ADR-0113 cl.2)*
- **AC1** *Given* a connected `ui-code`, *then* `internals.role === 'code'` and no host `role`/`aria-*` attribute exists.
- **AC2** *Given* an overflowing `ui-code` (Chromium browser leg), *then* sequential Tab reaches the scroll container (the platform focusable-scroller) and ArrowRight scrolls it; *given* WebKit, *then* the structural probe asserts the content is complete in the DOM/AX tree and the residual stands as documented (the instrument-bridge precedent — the WebKit re-test trigger is that engine shipping focusable scrollers).

**SPEC-R6 — The fences (normative), with escape hatches.** `ui-code` MUST NOT ship: a syntax highlighter
or tokenizer of any provenance (runtime code — the ADR-0107 "dependency in costume" rejection, verbatim);
a copy-to-clipboard affordance (interactivity changes the size class — Display stays passive); soft-wrap,
line-number, or max-height knobs. Escape hatches, named: **(a)** light-DOM freedom (SPEC-R3 AC2); **(b)**
a future opt-in adapter package outside the zero-dep core — its own intake; **(c)** copy = app-layer
composition (`Row > [Code, Button]`); **(d)** long-code folding = composition (`Disclosure > Code`). *(→
PRD-G1; ADR-0113 cl.1/2)*
- **AC1** *Given* the shipped package, *then* no highlighting/copy code or dependency exists (`npm ls` unchanged; grep for clipboard APIs in `controls/code/` finds nothing).

### 3.2 The hyperlink capability (`ui-text` `as="a"` + `href`) — the security-sensitive contract

**SPEC-R7 — Axis extension.** `ui-text`'s `as` enum MUST gain `'a'`; a NEW reflected `href` string prop
(default `''`) MUST exist. With `as="a"` and an allowed `href`, the stamp is a real `<a>` — native link
role, keyboard operability, focus, copy-paste, AT announcement, all platform-supplied (ADR-0078 cl.4; the
reset/heal machinery is reused, not re-decided). The axes stay honest: `href` with `as ≠ "a"` is **inert**
(documented, not an error); the stamp-transparency invariant extends to the anchor — stamping `as="a"`
produces **zero geometry delta** vs the unstamped host. *(→ PRD-G2; ADR-0114 cl.1)*
- **AC1** *Given* `<ui-text as="a" href="https://example.com">source</ui-text>` (browser, both engines), *then* one `<a>` child wraps the text, is keyboard-focusable, and the host's rendered box equals the `as="none"` box (the cl.4 invariant leg).
- **AC2** *Given* `href="https://example.com"` with `as="p"`, *then* the stamped `<p>` carries no `href`/`rel`/`target` and nothing is navigable.
- **AC3** *Given* `el.href = 'https://example.com'`, *then* the attribute reflects; the `@ts-expect-error` leg pins the string type; `text-descriptor.test.ts` mirrors the new attribute row.

**SPEC-R8 — The one gate: fail-closed scheme allowlist, identical across all four write paths.** Every
`href` value MUST pass the component's scheme gate before the stamp ever carries it. Verdict procedure
(normative): trim → empty ⇒ *no destination*; else parse `new URL(value, document.baseURI)` — a parse
failure ⇒ **denied**; else the resolved scheme must be `https:` · `http:` · `mailto:` — anything else ⇒
**denied**. Parsing with the URL parser is itself normative: it applies the same control-character/
whitespace normalizations navigation would (so `"java\nscript:…"` and `" JAVASCRIPT:…"` are denied as
their normalized selves — a string-prefix check is non-conformant). On **allow**, the stamp's `href`
attribute receives the author's value **byte-identical** (the gate never rewrites — no `#` coercion, no
resolved-URL substitution; ADR-0114 Alternatives). On **deny** or *no destination*, the stamped `<a>`
carries **no `href` attribute** (and no `rel`/`target` — no orphan policy attributes); the text stays
visible. Content is never destroyed; capability is denied. The gate runs on the prop→stamp path, so P1–P4
converge on it **identically**, including every re-stamp the heal machinery performs (a bound-`text`
`textContent` clobber re-stamps with the gated `href` intact — the gate cannot be stripped by content
writes). The gate is NEVER waived because the validator exists (SPEC-R12) — last line means last line.
*(→ PRD-G2, PRD-G4; ADR-0114 cl.2)*

Negative controls — the denial matrix. For **each** write path:
- **AC1 (P1 attribute)** *Given* `<ui-text as="a" href="javascript:alert(1)">x</ui-text>` parsed from markup, *then* the stamped `<a>` has no `href` attribute, `stamp.matches(':any-link') === false`, no `rel`/`target` present, and the text `x` renders.
- **AC2 (P2 property)** *Given* `el.href = 'javascript:alert(1)'` on a connected `as="a"` instance, *then* the same four assertions hold.
- **AC3 (P3 factory)** *Given* `textFactory.applyProp(el, 'href', 'javascript:alert(1)')`, *then* the same four assertions hold (the last line holds even for values the first line would have caught).
- **AC4 (P4 bound)** *Given* a rendered surface with `Text.href` bound `{path: "/link"}` and a data-model update writing `javascript:alert(1)`, *then* after the bound-prop effect runs, the same four assertions hold.
- **AC5 (the identical-outcome pin)** the four paths' outcomes are asserted by ONE shared helper so any divergence between paths is a test failure by construction.
- **AC6 (scheme matrix, via P2)** *Given* each of `data:text/html,<script>alert(1)</script>` · `blob:https://example.com/x` · `file:///etc/passwd` · `vbscript:x` · `foo:bar` · `" javascript:alert(1)"` (leading space) · `"JAVASCRIPT:alert(1)"` · `"java\nscript:alert(1)"` · `"http://["` (unparseable), *then* every one is denied (no `href` attribute). *Given* each of `https://example.com` · `http://intranet.local/x` · `mailto:a@b.example` · `docs/page` (relative) · `//example.com/x` (protocol-relative), *then* every one lands byte-identical with `rel`+`target` present.
- **AC7 (no destination ≠ denied)** *Given* `href=""` (the default) and `href="   "`, *then* no `href` attribute is stamped — and this is the same rendered state as denial, reached without a violation (the self-link trap is pinned: the empty value never resolves to the page URL).
- **AC8 (clobber survival)** *Given* an allowed link, *when* `host.textContent` is written (the bound-text path), *then* the fresh stamp carries the gated `href` + `rel` + `target` intact (browser leg, both engines).
- **AC9 (path liveness — the standing negative-control pair)** AC1–AC4's denial legs are paired with AC6's allowed twins **through the same paths**, proving the write path is live and the denial is the gate's doing, not a dead path. The build-wave one-time mutation check (gate bypassed ⇒ AC1 fails) is booked in the LLD test plan — it proves the last line is load-bearing independent of the validator (ADR-0114 Acceptance b), but does not ship as a standing test.

**SPEC-R9 — The host attribute is inert (proven, not asserted).** The HOST's reflected `href` attribute
MUST be harmless by construction: a custom element is not in the `:any-link` grammar and is not a
navigable anchor, so the raw (even denied) value reflected on `<ui-text>` can never navigate. Only the
gated stamp `<a>` ever carries a live `href`. *(→ PRD-G2; ADR-0114 cl.2)*
- **AC1** *Given* `<ui-text as="a" href="javascript:alert(1)">x</ui-text>`, *then* `host.getAttribute('href')` returns the raw string (reflection is honest) AND `host.matches(':any-link') === false` (mechanical, engine-enforced — asserted in jsdom and both browser engines).
- **AC2** *Given* a real click on the host (browser leg), *then* no navigation occurs (`location.href` unchanged) and no dialog/script effect is observable.

**SPEC-R10 — Denied state degrades to plain text for AT.** A denied link MUST NOT be exposed to assistive
technology as a link at all — never an announced-broken link. The mechanism is attribute-absence: per
HTML-AAM, an `<a>` without `href` maps to `generic` — plain text. *(→ PRD-G2, PRD-G4; ADR-0114 cl.2)*
- **AC1** *Given* a denied href (any AC path from SPEC-R8), *then* the stamp carries no `href`, no `role`, no `aria-*`, and no `tabindex` — the structural facts that produce the `generic` mapping.
- **AC2** *Given* the tab order (browser leg, both engines): a focusable before and after the denied link, *then* Tab traverses directly between them — the denied stamp is never a tab stop; *given* the allowed twin, *then* it IS a tab stop between them.

**SPEC-R11 — Fixed `rel`/`target` policy.** Whenever (and only when) a gated `href` is applied, the stamp
MUST carry `rel="noopener noreferrer"` and `target="_blank"` — component-set constants, not props; the
catalog exposes neither (ADR-0114 fork F3). A `target` prop is the named foreseen extension. *(→ PRD-G2;
ADR-0114 cl.4)*
- **AC1** *Given* any allowed href via any write path, *then* both attributes are present with exactly those values; *given* deny/no-destination, *then* neither is present.
- **AC2** *Given* a click on an allowed link (browser leg), *then* the opened context has no `window.opener` handle (Chromium leg; WebKit structural probe on the attributes — the instrument bridge).

**SPEC-R12 — Defense in depth: the validator first line.** A **static** `Text.href` literal whose value
parses as an absolute URL with a disallowed scheme MUST fail `validateA2ui` with `CATALOG` at
`<id>.href`, entering the existing validate-then-stream self-correct loop. Static **relative** literals
pass the first line (they resolve only at render, where the component gate rules). **Bound** hrefs are
invisible to the static line by design and fall entirely to SPEC-R8 (the ADR-0076/0098 lane split). The
scheme SET is single-sourced: the validator imports the same allowlist constant the component gate uses —
one policy, two independent enforcement mechanisms. *(→ PRD-G2; ADR-0114 cl.3)*
- **AC1** *Given* a payload with static `"href": "javascript:alert(1)"`, *then* `validateA2ui` reports `CATALOG` at `<id>.href` and a produce-loop leg shows the self-correction round-trip.
- **AC2** *Given* static `"href": "docs/page"`, *then* 0 `CATALOG` errors; *given* the rendered surface, *then* the link resolves and navigates per SPEC-R8 (allowed).
- **AC3 (the defense-in-depth pair)** *Given* `"href": {"path": "/link"}` with `javascript:alert(1)` in the data model, *then* the static validator passes AND the rendered stamp is non-navigable — two separate tests proving the two lines separately.

**SPEC-R13 — Link treatment.** The link stamp MUST be distinguished by **underline always** plus a
dedicated ink role — never hue alone (ADR-0057 applied to navigation affordance); hover and
`:focus-visible` states MUST exist (focus rides the fleet focus treatment); `:visited` MAY share the link
ink at v1 (no visited role minted — stated, not hidden). Under `forced-colors: active` the link renders in
the `LinkText` system ink and remains underlined. Exact tokens are the LLD's. *(→ PRD-G2, PRD-G4;
ADR-0114 cl.6)*
- **AC1** *Given* an allowed link (browser leg, both engines), *then* computed `text-decoration-line` contains `underline` and the computed color equals the link ink token's resolution ≠ the surrounding prose ink.
- **AC2** *Given* forced-colors emulation, *then* the link paints in a system ink with underline intact (computed-style assertion — the ADR-0102 sanctioned visual proof).

### 3.3 `ui-disclosure`

**SPEC-R14 — Component contract.** `ui-disclosure` MUST be a Pattern-class, non-form-associated control
(`UIElement`) wrapping a component-owned native `<details>`/`<summary>` (ADR-0113 fork F3; the ADR-0017
native-structural-element precedent — the no-native-form-elements law does not bind: `<details>`
participates in no form). Props: `open` (`boolean`, default `false`, reflected) and `summary` (`string`,
default `''`, reflected — the fold's one-line label; a rich `slot=summary` child is the fenced foreseen
extension). Events: the family `toggle` (SPEC-R15). *(→ PRD-G3; ADR-0113 cl.4)*
- **AC1** *Given* `<ui-disclosure summary="Details">…body…</ui-disclosure>`, *when* connected, *then* a `<details>` part exists containing a `<summary>` whose text is `Details` and a body part holding the light-DOM children.
- **AC2** *Given* the descriptor (`disclosure.md`), *then* `tier: pattern`, the `attributes[]` block mirrors `static props`, and `events` names `toggle`.

**SPEC-R15 — `open` is two-way under the always-announce law.** `open` MUST be prop-as-source-of-truth
(the ADR-0101 law + its Erratum's prop-first discipline): every **actual transition** — user click on the
summary, data/model write, find-in-page auto-expand, a future `name` auto-close — settles the prop AND the
reflected attribute, then fires exactly one host `toggle`. No transition ⇒ no event (re-asserting the
current value is a no-op — the loop-breaker). The catalog row consumes its ONE ADR-0019 seam slot as
`value: { prop: 'open', event: 'toggle' }` (the Modal/Menu precedent; correctly spent — no other
Disclosure prop carries a user-mutated round-trip). *(→ PRD-G3; ADR-0113 cl.4/5; ADR-0101; ADR-0019)*
- **AC1** *Given* a user click on the summary (browser leg, both engines), *then* `el.open === true`, the attribute is present, and exactly one `toggle` fired with `el.open` already settled at listener time.
- **AC2** *Given* a data-model write (`el.open = true` / the bound path), *then* the details part opens and exactly one `toggle` fires; *given* `el.open = true` re-asserted, *then* nothing fires.
- **AC3** *Given* the A2UI round-trip probe: a surface with the `open` bind, user-click the summary, *then* `surface.data` reads the new value with no agent traffic and the panel state survives a subsequent unrelated data-model write (the ADR-0101 re-assert probe).
- **AC4** *Given* find-in-page matching folded text (Chromium leg), *then* the content reveals, `el.open` settles `true`, and `toggle` fires (WebKit: structural probe per the instrument-bridge precedent, re-test trigger named in the test).

**SPEC-R16 — The anatomy invariant: children = body.** The host's light-DOM children MUST converge into
the body part: children present at connect are adopted; parser-streamed children arriving after connect
and factory/renderer child writes landing on the host are adopted within a microtask (a childList
observer — the ADR-0078 cl.4 heal lineage, the ui-select options-move precedent); a destructive host
write that detaches the details part rebuilds it fresh. Invariant: the host has exactly one element child
(the details part); the summary's text is component-owned (written from the `summary` prop via
`textContent` — never markup). The summary prop updates in place without perturbing `open`. *(→ PRD-G3;
ADR-0113 cl.4)*
- **AC1** *Given* children appended to the host after connect (the streaming shape), *then* after a microtask they live in the body part, order preserved, node identity preserved (never cloned — ADR-0022).
- **AC2** *Given* `el.summary = 'More'` while open, *then* the summary text updates, `open` is unchanged, and no `toggle` fires.
- **AC3** *Given* a `host.textContent` write, *then* the part is rebuilt and the new text lands in the body part (the detached-part branch converges; ≤2 observer passes, never a loop).

**SPEC-R17 — A11y is the platform's.** The summary MUST carry native button semantics with the
expanded/collapsed announcement the platform supplies — the component sets **no** internals role and no
host ARIA (the details part is the semantic element, the ADR-0017 cl.5 lineage). Keyboard: Enter/Space on
the summary toggles — platform behavior, asserted not re-implemented. *(→ PRD-G3, PRD-G4; ADR-0113 cl.4)*
- **AC1** *Given* a connected `ui-disclosure`, *then* no host `role`/`aria-*` attribute and no internals role are set; the summary element reports the platform's expanded state (browser leg: `aria-expanded`-equivalent state via the AX-facing probe both engines expose on `<summary>`).
- **AC2** *Given* focus on the summary, *when* Enter then Space are pressed (browser leg), *then* each produces one actual transition and one `toggle`.

**SPEC-R18 — Styling constraints.** The native marker MUST be replaced by the fleet chevron affordance:
`::marker`/`::-webkit-details-marker` hidden, a component-drawn chevron glyph sized `= font` (the
geometry.md inline-affordance taxonomy) whose **orientation** indicates state ([open] rotates it); **no
fold animation** at v1 (`::details-content` interpolation is too fresh cross-engine — ADR-0113 cl.4) and
no transition on the chevron (cross-engine + reduced-motion honesty). Summary row geometry: Pattern class
— the summary row takes the control height; the body rides the `--ui-space` ladder (density-responsive).
Forced colors: summary text, chevron, and body text all paint in system inks; the chevron is not
hue-carried. *(→ PRD-G3, PRD-G4; ADR-0113 cl.4; geometry.md Pattern row)*
- **AC1** *Given* both engines (browser leg), *then* no native marker paints (computed `list-style-type`/vendor marker hidden) and the chevron glyph is present, `= font` sized, rotated under `[open]`.
- **AC2** *Given* `[density]` on an ancestor, *then* body padding/rhythm changes and the summary row height + chevron size do not.
- **AC3** *Given* forced-colors emulation, *then* summary, chevron, and body paint in system inks (computed-style assertion).

### 3.4 Cross-cutting

**SPEC-R19 — Tokens + the CSS-less consumer.** Component-owned token chains — `--ui-code-*` (pad,
surface, radius via the fleet `--ui-radius-base` referent, mono/type metrics) and `--ui-disclosure-*`
(summary row, glyph, body rhythm) — declared in the standard specificity-0 token block (mechanics the
LLD's). Under ADR-0102 Lane A every rendered-correctness concern is a component-owned safe default: bare
instances of both controls in any container paint correct, non-broken renderings with zero consumer CSS;
page CSS survives only as override freedom. Code's frame quantities are density-invariant; disclosure's
body rhythm is density-responsive (the Pattern split). *(→ PRD-G4; ADR-0102; ADR-0113 cl.2/4)*
- **AC1** *Given* the family-coherence token gate, *then* each control's token block declares only its own `--ui-{name}-*` (∪ shared allowlist).
- **AC2** *Given* bare `<ui-code>` and `<ui-disclosure>` in an unstyled flex row (browser leg, both engines), *then* each paints a non-collapsed, correct box (test-the-whole-shape).

**SPEC-R20 — Geometry posture.** `ui-code` is Display-class (no `[size]`/`[scale]` rows, no control
height — the type matrix is the lever); `ui-disclosure` is Pattern-class (summary row = control height,
shell = space scale — geometry.md's table already lists "accordion"). **`geometry.md` requires NO edit**
(verified against the live doc 2026-07-08: the Pattern row names "accordion", the Display row absorbs
text-bearing display). *(→ PRD-G4; ADR-0113 Repairs)*
- **AC1** *Given* the two descriptors' geometry blocks, *then* neither declares a `size` attribute nor consumes `--ui-height-*` outside the disclosure summary row.

### 3.5 Catalog + teaching surface

**SPEC-R21 — Catalog rows, same wave.** The default catalog MUST declare `Code` and `Disclosure`, and
widen `Text` with `href`, in the same wave the descriptors land (SPEC-N2's fleet-derived gate, ADR-0087;
end-of-wave allowlist residue: none). Row contracts (the `a2ui-catalog.spec.md` §5.2 table gains these in
the same change — that table stays the normative coverage home; this SPEC is their derivation):

| A2UI type | `ui-*` widget | Properties |
|---|---|---|
| `Code` | `ui-code` | `code` (string, **bindable**, `mapsTo: textContent` — the `Text.text` lane) · `language` (string, non-bindable, `mapsTo: language`) — display-only: no `value` mark, no children |
| `Disclosure` | `ui-disclosure` | `summary` (string, **bindable**, `mapsTo: summary`) · `open` (boolean, **bindable**, **two-way** `value: {prop: 'open', event: 'toggle'}`) · `children: ChildList` → the body |
| `Text` *(widened)* | `ui-text` | + `href` (string, **bindable**, `format: safe-href` — the factory fans `href` → `as='a'` + `href`; the wire never learns the `as` axis, ADR-0078 cl.5 lineage) |

The `href` fan-out MUST converge order-independently against a sibling `variant`: whatever order
`applyProp` receives `href` and `variant`, a non-empty `href` ends with `as === 'a'` (mechanism the
LLD's). Consequence, stated consciously: a wire `Text` carrying both a heading `variant` and `href`
renders the heading's **visual** triple but anchor semantics — the stamp is one element; a linked real
heading is a foreseen extension, not v1. **(Doc-review F4 precision:** the downgrade fires on any
non-empty `href`, allowed OR denied by the scheme gate — a heading with a `javascript:`-class href
still loses its heading semantics, ending as plain-text-with-heading-visual and NEITHER heading nor
link semantics, since the fan-out reads raw `href` presence, not the gate's verdict.) *(→ PRD-G1/G2/G3/G5;
ADR-0113 cl.5; ADR-0114 cl.5)*
- **AC1** *Given* the fleet-derived coverage gate over the shipped descriptors, *then* `Code` + `Disclosure` are declared AND factory-bound with zero allowlist residue.
- **AC2** *Given* `{"component": "Code", "code": "npm test", "language": "sh"}` and a `Disclosure` payload with bound `open`, *when* validated via `validateA2ui`, *then* 0 `CATALOG` errors; *given* `code` bound `{path}` with a string in the data model, *then* the code re-renders on `updateDataModel`.
- **AC3** *Given* `factories.test.ts`, *then* it asserts the fan-out convergence in BOTH application orders (`href` before `variant` and after).

**SPEC-R22 — Feed-partition dispositions.** The ADR-0097 partition is TOTAL and mechanically owed: `Code`
→ **IN** (`FEED_SURFACE_TYPES` — a confirm ask's subject IS code; light inline content); `Disclosure` →
**OUT** (`FEED_EXCLUDED`, the Tabs "hides half the ask" reasoning verbatim: an ask must be fully visible
and operable inline); `Text.href` rides Text's existing IN membership consciously (a link does not commit
an ask; `_blank` preserves the session — ADR-0114 Consequences). Partition becomes **24 IN / 14 OUT**
over the 38-type catalog. *(→ PRD-G4; ADR-0113 cl.6/fork F4; ADR-0097)*
- **AC1** *Given* `feed-catalog.test.ts`, *then* the partition gate is green over the widened catalog and reverting either disposition turns it red (the gate's negative control still bites).

**SPEC-R23 — Teaching: guidance + exemplar.** The catalog SPEC §5.2 Notes MUST gain the when-to-use
guidance (ADR-0087 Fork-A style): *Text for prose · Code for verbatim/preformatted output (never for
emphasis) · Disclosure for progressive detail (never hide the primary answer or a required control) ·
links for sources and references (https; never bare navigation-as-action — actions are Buttons).* The
examples shelf MUST gain the **report exemplar seed** (Card + Text + Code + a `Text.href` source link + a
Disclosure-folded detail — ADR-0113 cl.5), validator-clean, in `allSeeds`; corpus + derived prompt
re-validate over the widened catalog. *(→ PRD-G5)*
- **AC1** *Given* the exemplar seed, *then* `validateA2ui` reports 0 errors and it renders in the examples surface (browser-verified) with all three capabilities present.
- **AC2** *Given* the corpus/derived-prompt gates, *then* they run green over the widened catalog.

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Zero runtime dependency | No highlighter, no sanitizer library, no vendored runtime code, no new package (ADR-0113 cl.7 — ordinary `controls/{code,disclosure}/` folders); imports point inward only |
| **SPEC-N2** | Cross-engine proof | Browser legs (Chromium + WebKit) mandatory per control; jsdom blind spots named: painted overflow/scroll geometry, find-in-page, the native `<details>` toggle-event task timing, `:visited`/opener behavior — where an engine/tool cannot observe a leg, the instrument-bridge pattern applies (substitute probe + named re-test trigger), never silent omission |
| **SPEC-N3** | Fleet gates stay green | file-set, family-coherence, descriptor↔props trip-wires, site per-tier page sets (`code`→doc; `disclosure`→doc+demo), `npm run check && npm test` at every slice boundary |
| **SPEC-N4** | Size budget honesty | `npm run size` run at the build wave (manual, ADR-0040); the anticipated family-budget re-base recorded as its own note (the ADR-0107 Amendment precedent) — never silently absorbed |
| **SPEC-N5** | Security-test posture | The hyperlink ships with a dedicated negative-control test file (the SPEC-R8 matrix + SPEC-R9/R10/R11 probes); every denial AC is paired with an allowed twin through the same path (path liveness); the validator and component legs are proven **separately** (SPEC-R12 AC3) — a green suite missing any pair is NOT done |

## 5. Open items (non-normative)

- Foreseen extensions, deliberately out of v1 (each re-enters only by its own record): syntax-highlighting adapter package · copy affordance · soft-wrap/line-numbers/max-height · `ui-code` scroll `tabindex` affordance (on engine evidence) · `target` prop (`_self`) · `tel:`/additional schemes (gate-visible one-line widening, its own security conversation) · per-catalog scheme sets (ADR-0114 Alternatives) · exclusive accordion `name` · fold animation · rich summary slot · a linked real heading (stamp composition) · the site `code-block.ts` swap (the booked follow-up consumer wave, PRD-G5).

## 6. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1–R6 | PRD-G1 (code exists and behaves), PRD-G4 (pillars: a11y, overflow law, fences) |
| SPEC-R7–R13 | PRD-G2 (the hyperlink + the security stack), PRD-G4 (AT degrade, WHCM, non-color signifier) |
| SPEC-R14–R18 | PRD-G3 (disclosure + two-way open), PRD-G4 (native semantics, styling constraints) |
| SPEC-R19–R20 | PRD-G4 (tokens, CSS-less consumer, geometry law) |
| SPEC-R21 | PRD-G1/G2/G3 (catalog-reachable), PRD-G5 (rows feed the teaching surface) |
| SPEC-R22 | PRD-G4 (the partition gate paid) |
| SPEC-R23 | PRD-G5 (exemplar + guidance + corpus re-validation) |
| SPEC-N1–N5 | PRD-G4 (zero-dep, cross-engine, gates, size, security posture) |
