<!-- sdlc-lite:managed:start v1 sha256:4dfe65c1c6f2 -->
# Documents

Pick one home from the table, then read one file. Placement effect unproven; see the docs-schema design.

| Home | Holds | Never holds |
|---|---|---|
| `work/` | Ticket and task folders, the generated `ROADMAP.md` and `NOTES.md` | Designs and plans under review -> `planning/` |
| `specs/` | What the system is and must do; edited in place | Proposals, dated evidence, steps |
| `planning/` | Proposals, roadmaps, plans under review (`status:`) | What exists today |
| `decisions/` | One numbered decision per file, immutable once accepted | Narrative design |
| `designs/` | Ratified grill designs, one file per round, write-once; `supersedes:` names the design a re-grill replaces | Edits to a ratified design, single decisions -> `decisions/` |
| `goals/` | One intended outcome per file (`G-NNN`): owner, status, the KPIs that show it is met | Change plans, tickets, result values |
| `kpi/` | One measure per file (`K-NNN`): command, unit, target, the goals it serves | Values over time, thresholds nobody can run |
| `references/` | Lookup tables, listings, glossaries | Procedures, opinions |
| `guides/` | How-to and operating procedures | Lookup tables, design |
| `reports/` | Dated evidence: runs, reviews, audits, releases | Instructions, living specs |
| `assets/` | Non-Markdown files cited by a document | Markdown |
| `archive/` | Superseded or retired documents | Live documents |
| `other/` | Unsorted inbox with `owner:` and `review-by:` | Anything with a clear home |

## Which home

The first line that matches wins.

1. A ticket or task record, or the generated roadmap or notes file: `work/`.
2. Picture, diagram source or data file: `assets/`.
3. Evidence of something that happened on a date: `reports/`.
4. One choice with its reasons: `decisions/`.
5. A proposal, roadmap or plan under review: `planning/`.
6. An outcome to steer toward, with an owner and a status: `goals/`.
7. A measure with a command that runs it, a unit and a target: `kpi/`.
8. Steps a person follows: `guides/`.
9. A table, listing or glossary you look things up in: `references/`.
10. A ratified design from a grill round, kept write-once: `designs/`.
11. What the system is or must do: `specs/`.
12. Retired or superseded: `archive/`.
13. None of the above, or unsure: `other/`.

## Adding a document

1. Pick the home above; [the layout](layout.md) lists any extra homes.
2. Name it lowercase kebab-case; reports lead with `YYYY-MM-DD-`. A home whose `## Kinds` form in [the layout](layout.md) is numbered (such as `NNNN-slug.md`) takes the next number from `docs_check.py next docs/<home>`, or by hand: read the highest existing number and held ref, then run `git update-ref refs/sdlc/doc-ids/<home>/<NNNN> "$(printf 'docs/<home>/<NNNN>\n' | git hash-object -w --stdin)" ""`, which is create-only.
3. When its folder has an `AGENTS.md`, add a link to it there, outside the generated managed block, since a hand edit inside the block fails its stamp. When the folder has none, the onboard setup lists it in the Contents of `docs/AGENTS.md`.
4. Put dated evidence in its own file under `reports/`. Do not add it to an entry file.
5. Find the document's type in `specs/doc-standards/README.md`, when this repository has it, and follow the card its row names.

## Contents

<!-- sdlc-lite:managed:end -->

`.claude/docs/` keeps its own scheme (plan, goals, roadmap, process, `references/`, `adr/`, `prd/`, `spec/`, `lld/`, `archive/`); the homes above do not apply there. Its grammar is the `doc-standards` skill.
