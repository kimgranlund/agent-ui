# Best practices — authoring the agent-ui docs site

> The cross-cutting how-to depth behind the `docs-author` method: the voice, the do/don't, and the
> worked patterns that recur across page types. Per-type strategy is `content-types.md`; the models are
> `foundations.md`. 2026-06-28.

## Voice & tone — precise and honest

- **Show, don't assert.** The site documents by *rendering the real control*. Prefer a live specimen over
  a sentence describing it; prefer a real round-trip log over a claim that it round-trips. Prose exists to
  frame what's shown, not to substitute for it.
- **Honest labels.** Label what is actually true. The states showcase tags each state as the *control's*
  ("authored by the control itself in button.css — this page only stages"), names the negative ("a
  disabled button produces no log line"), and explains the mechanism ("`:focus-visible` matches keyboard
  focus, not a pointer click"). The A2UI canvas logs *every* message including errors. Honesty is
  structural — achieved by running the real thing — not a matter of careful wording.
- **Plain, declarative, scannable.** Short sentences; headings that say what the section shows; no
  marketing adjectives the render can't back. A reader should be able to reproduce any claim by
  manipulating the live page.
- **Cite, don't restate.** When prose touches a canonical fact (a token role, an ADR, a SPEC requirement),
  name the owner (`docs/references/tokens.md`, ADR-0012, `SPEC-R#`) and link — never paraphrase it into a
  second copy that can drift.

## Do

- **Derive every derivable fact.** Attribute rows from `parseDescriptor(...).attributes`; specimen sets
  from the parsed enum members; the displayed payload from the same typed object you feed the renderer.
  The pattern: one source, two consumers (`site/lib/frontmatter.ts` is the model).
- **Run the real renderer/control through its public surface.** `createRenderer().mount/ingest/finalize`,
  a real `customElements`-defined `ui-*`, the real `click` event. The page becomes the integration proof,
  not a description of one.
- **Import `_page.ts` first, always.** It performs the load-bearing foundation cascade (ADR-0003) and
  stamps the shared chrome. A page that imports a control before the shell breaks the token cascade order.
- **Own only the page scaffold.** Page CSS styles layout chrome (`permutations.css`, `states.css`) and
  consumes `--md-sys-color-{family}-{role}` roles. Geometry, colour, ARIA, and interaction states are the control's.
- **Build matrices programmatically.** Loop the enum arrays so completeness is provable from structure
  (`|sizes| × |variants| × |cols|`), and the matrix grows with the descriptor.
- **Flag the genuinely hand-authored.** When a fact has no parse to derive from (a markup *shape*, a
  narrative), say so in a comment and keep it minimal — so the next author knows it isn't drift-gated.

## Don't

- **Don't hand-maintain a derivable fact.** A hand-typed attribute table is the top defect — it drifts the
  moment the descriptor changes, and the contract trip-wire won't catch a *site* copy. Consume the parser.
- **Don't mock or screenshot a demo.** A faked renderer, a static image, a hand-drawn state lies about the
  library. If you can't run it live, the page isn't ready.
- **Don't restyle a `ui-*` control from a page.** Page CSS that sets `:hover`/`:focus`/colour on a control
  forks the source of truth for appearance and breaks the honest-labels contract.
- **Don't reach into renderer/control internals.** Use the public surface only; an internals-coupled demo
  stops being a faithful integration proof.
- **Don't restate `docs/`.** Conceptual guides summarize and link the canonical docs; they don't fork
  them. Restated prose is drift waiting to happen.
- **Don't ship a structurable page without its gate.** If a fact could be checked (a dead name, a missing
  page, an API mismatch) and isn't, the drift it prevents is only a matter of time.

## Recurring patterns

- **The parser adapter (T4/T8).** `loadButtonDoc()` = `splitFrontmatter` → `parseDescriptor`. Reuse it;
  don't write a second frontmatter reader. Generalize to `load{Name}Doc()` per control, or a single
  `loadDoc(name)` as the fleet grows.
- **The enum-driven specimen (T2/T4/T8).** `attr.values.map(v => control({ [attr.name]: v }))` — the
  rendered set *is* the declared set.
- **The honest activation log (T3/T5).** A real `click`/message sink, appended live, source-tagged. It is
  simultaneously the demo and the proof the demo isn't faked.
- **The coverage walk (T7).** Reuse the `site-canon` walk: enumerate the descriptors, assert each maps to
  a page/listing. A new control failing the walk is the signal its docs are missing.

## Wiring the drift gate — the decision

For each fact on the page, ask: *is it structurable?*

- **Structurable → gate it.** A name (→ `site-canon`), an API row (→ the descriptor trip-wire via the
  shared parser), a missing page (→ a coverage enumeration), a demo that must run (→ a render/type-check
  assertion). A green check is the page's guarantee.
- **Soft (prose, ergonomics, "is this idiomatic") → cite + route to review.** Name the upstream owner by
  ID so a reviewer can re-derive, and leave the judgment to the `docs-writer` reviewer. Don't
  manufacture a brittle check for something that needs taste.

The split is the whole discipline: mechanize what's mechanical, and make the rest *re-derivable* by a
human rather than asserted.

## Migration — a rename is intent, not drift

A slot/role/prop **rename** is a deliberate contract change the trip-wires read as a *new* canonical name.
After a rename, every `site/` usage of the old name is now a dead name — `site-canon` fails until you
migrate the call sites. That failure is the feature (it caught the `slot="icon"` left after the
`icon`→`leading` rename). Run the rename across `site/` until the guard is green; a historical note in a
`//` comment is fine (the guard strips comments).
