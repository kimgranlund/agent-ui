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
  second copy that can drift. This is a **normative-fact citation** — see below for the line between it
  and a **provenance citation**, which never belongs inline.

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
- **Don't weave provenance into descriptive prose.** A `TKT-####`, or an ADR cited only for "which record
  built this," does not belong in an intro, a section heading, or mid-sentence — it belongs in the
  page-end Changelog table (below). A normative-fact citation (a rule's owner) is a different thing and
  stays inline.

## Provenance vs. normative citations — the page-end Changelog

Every ADR/SPEC/TKT citation on a page is one of two kinds, and only one of them belongs in descriptive
prose. Conflating them is the top citation defect (TKT-0053): a page's intro and section prose read as a
build log instead of a description of the feature.

- **Normative-fact citation (stays inline, unchanged).** Prose states a **rule, mechanism, or contract**
  that is true *right now*, and cites the record that **owns** it — "the shared fleet focus ring
  (ADR-0009)", "the concentric-corner law (ADR-0018)", "per ADR-0012's anatomy rule." This is the existing
  "Cite, don't restate" discipline above: the citation stands in for a fuller rule the page deliberately
  does **not** re-derive, so a reader who needs the complete detail has somewhere real to go.
- **Provenance citation (moves to the page-end Changelog, never inline).** A ticket/ADR/PR cited as **which
  record built or changed this surface** — build history, not an ongoing rule. `"ui-agent-admin (TKT-0039,
  ADR-0131/ADR-0132) is a live-editable agent config…"` is provenance: TKT-0039 and ADR-0131/0132 are this
  page's own scope/intake records, tacked on as a receipt, not cited because the reader needs to go verify
  a rule the page doesn't already fully state.

**The test — delete the parenthetical and ask what's lost:**

1. **Does the reader lose access to a rule's full detail that this page deliberately doesn't restate?**
   Yes → normative, keep it inline (that's the citation doing its job). No — the page already says
   everything the citation would add, or the citation only answers "which ticket paid for this" → it's
   provenance, move it out.
2. **A `TKT-####` citation is always provenance.** A ticket record documents that something was requested
   or built; it is never the owner of an ongoing rule. A `TKT-####` in descriptive prose is a violation by
   construction — always move it to the Changelog, no case-by-case judgment needed.
3. **A heading never carries a citation, normative or not.** A heading is a scanning aid, not a citation
   site. `"1 · One primitive, five instantiations (ADR-0132)"` is wrong even where the underlying content
   would be legitimately citable in body prose — move the citation into the paragraph beneath the heading
   (if it's normative — the reader still needs the pointer) or the Changelog (if it's provenance).
4. **An ADR cited only on the one page whose own build it chronicles — usually paired with that page's own
   TKT, appearing in the page's opening intro before any rule content — is provenance.** An ADR cited
   as the authority behind a reusable mechanism, taxonomy, or family classification (the "Display-class X
   leaf (ADR-0112, feed family v1)" pattern repeated across a whole component family's doc pages, or a
   fleet-wide law like ADR-0003's CSS cascade order, ADR-0007's geometry bands, ADR-0009's focus ring) is
   normative even where only one page currently cites it — the test is what the citation is *for*, not how
   many pages happen to use it today.

### The Changelog section — shape

A page that carries provenance citations ends with one `## Changelog` section (heading level 2, same tier
as any other top-level section — `heading(2, 'Changelog')` from `doc-page.ts`), placed **last**, after the
API reference tables if the page has any (T4's `renderApiTable`/`renderPropertiesTable`/etc.). A page with
no provenance citations to report ships **no** Changelog section — an empty/vacuous section is the same
defect as an empty API table (`doc-page.ts`'s "no empty table" discipline extends here).

The section is one table, columns **Date | Type | ID | Summary**:

| Column | Content |
|---|---|
| **Date** | ISO `YYYY-MM-DD`, the record's **own** date — a ticket's frontmatter `date:`, an ADR's table `Date` field. Never invented or approximated. |
| **Type** | One of `Feature` / `Fix` / `Change` (from a ticket's `kind:` frontmatter — `feature`/`bug`/`chore`, Title-cased) or `Decision` (any ADR). |
| **ID** | `TKT-0039` / `ADR-0131` as a code chip. An `ADR-####` id links to `./adr-index.html#adr-{number}` (the real site surface — `adr-index.ts` already resolves that hash). A `TKT-####` id renders as plain code — there is no published ticket index to link to yet. |
| **Summary** | One clause, present tense, *what changed* — not a restatement of the page's own intro. |

Sorted **newest-first** (the `adr-index.ts` / `changelog.ts` site convention). Entries are **hand-authored**
— provenance isn't parseable from any canonical source (no ADR/TKT index cross-links to the pages it
affects) — so flag the entry array as hand-authored content, same discipline as any other underivable fact
(`content-types.md` T4's anatomy-shape precedent).

Implementation: `renderChangelogTable(entries: readonly ChangelogEntry[]): HTMLElement | undefined` in
`site/lib/doc-page.ts`, reusing the file's existing generic `tableHead`/`tableRow`/`textCell`/`codeCell`
helpers (the `getting-started.ts`/`text-doc.ts` precedent) — not the Form-B `apiRow` row-builders, which
are shaped for attribute/property entries, not a flat provenance log. Returns `undefined` (render nothing)
when `entries` is empty, so a caller can unconditionally `if (table) content.append(table)`.

### Worked example (agent-admin.ts, before → after)

Before (provenance interleaved into the intro and a section heading):

```ts
intro:
  'ui-agent-admin (TKT-0039, ADR-0131/ADR-0132) is a live-editable agent config + instructions with a ' +
  'working chat preview — a three-pane ui-split composing ui-settings (M4), ui-conversation (M2), and a ' +
  'generic ordered-entry-list primitive (ADR-0132) instantiated five times. No new protocol dependency.',
// …
content.append(sectionHeading('1 · One primitive, five instantiations (ADR-0132)'))
```

After (the intro and heading describe the feature; the same facts move to the page-end table):

```ts
intro:
  'ui-agent-admin is a live-editable agent config + instructions with a working chat preview — a ' +
  'three-pane ui-split composing ui-settings, ui-conversation, and a generic ordered-entry-list ' +
  'primitive instantiated five times. No new protocol dependency.',
// …
content.append(sectionHeading('1 · One primitive, five instantiations'))
// … page body …
content.append(renderChangelogTable([
  { date: '2026-07-13', type: 'Feature', id: 'TKT-0039', summary: 'Shipped ui-agent-admin: three-pane composition over ui-settings + ui-conversation, real persistence.' },
  { date: '2026-07-14', type: 'Decision', id: 'ADR-0131', summary: 'Ratified the scope: a generic self-contained config, three panes, no new protocol dependency.' },
  { date: '2026-07-14', type: 'Decision', id: 'ADR-0132', summary: 'Instructions/settings became one shared ordered-entry-list primitive, instantiated five times.' },
]))
```

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
