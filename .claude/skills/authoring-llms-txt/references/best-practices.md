# Best Practices — References & llms.txt (the Knowledge Family)

How to author the referential documents an agent reads to ground itself. These are retrieved, never obeyed. Assumes `00-foundations.md`. Scored by `rubric-reference.md` and `rubric-llms-txt.md`.

## References (knowledge docs)

A reference is ground truth the agent consults — a skill's `references/` file, an `@`-imported doc, a Project Knowledge file. Its defining property: it is a derived view of, or the canonical source for, some fact, and it does not instruct behavior.

**Write for retrieval, not for reading.** Headed, scannable structure retrieves far more accurately than dense prose. Use clear specific headings, short declarative statements, one topic per document, and consistent terminology across the set.

**Be canonical or be derived — never a hand-maintained duplicate.** Two copies of a fact diverge; the only question is when. If a reference restates something owned elsewhere, either make it the single source or generate it from the source. Duplication is the precondition for drift.

**Mark freshness where it matters.** Date or version anything that changes (API surfaces, pricing, version-pinned mechanics). A stale reference presenting as current is the silent failure mode.

**Scope to one domain and point to siblings.** A reference that sprawls becomes unscannable and unmaintainable. Cover one thing well; link out for the rest.

### Reference do / don't

Do: head every section; keep statements short and declarative; date volatile content; keep one topic per file; use the same terms everywhere.

Don't: write a reference as instructions; duplicate facts owned elsewhere; let a file accumulate unrelated topics; mix in behavioral directives (those belong in skills/CLAUDE.md).

### Reference best-in-class (shape)

```markdown
# ICD-10 Coding Rules  ·  source: CMS FY2026 code set  ·  updated 2026-06
## Specificity
Code to the highest available specificity. Unspecified codes (….9) only when
no more specific code exists.
## Laterality
Bilateral conditions require the bilateral code where one exists; otherwise two
unilateral codes.
## HCC-relevant conditions
[table: condition → code → HCC category]
See also: `billing-rules.md` for bundling and modifier logic.
```

## llms.txt

`llms.txt` is the agent-facing map of a documentation corpus — a curated index that tells agents where the authoritative content lives. It is the knowledge artifact whose entire job is discovery. Agentic IDE tools fetch `/llms.txt` and `/llms-full.txt` routinely and pull only the linked pages they need.

**Follow the standard shape.** A root-level markdown file: an H1 with the project name, a blockquote one- to two-sentence summary, then H2 sections (Documentation, Examples, API, …) each listing links with a one-line description per page. `/llms.txt` is the curated index; `/llms-full.txt` is the full corpus concatenated for tools that want everything.

**It is a table of contents, not content delivery.** Keep the index lean; the linked pages carry the depth. Curate to authoritative content and exclude chrome, ads, and low-value pages. Accurate one-line descriptions matter more than coverage — they are what the agent routes on.

**Place and announce it.** Serve at `/llms.txt` (optionally `/.well-known/llms.txt` and discovery headers) so tools find it without prior knowledge.

### llms.txt do / don't

Do: use the H1 + blockquote + H2-with-links shape; write one accurate sentence per link; split the heavy corpus into `llms-full.txt`; version per release if the surface changes; ensure links resolve to markdown-accessible pages.

Don't: dump full content into `llms.txt` (that is what `llms-full.txt` is for); list pages without descriptions (a list of concepts with no links does not let an agent navigate); include marketing chrome; let links rot.

### llms.txt best-in-class (shape)

```markdown
# Adia Web Components
> A protocol-agnostic native Web Components library for generative UI.

## Documentation
- [Getting started](/docs/start.md): install, first component, theming basics
- [Token system](/docs/tokens.md): OKLCH primitives, semantic layers, light-dark()
- [Component catalog](/docs/catalog.md): every element, its API, and slots

## API
- [OpenAPI spec](/openapi.json): machine-readable component contracts
```

## The unifying point

Both families are *ground truth the agent reads*, and both live or die on the same disciplines: single canonical source, derived views rather than duplicates, retrieval-grade structure, and freshness markers. A reference grounds a single skill; an llms.txt grounds an entire corpus for any agent that arrives. Treat both as derived views of one source, and drift becomes structurally hard.
