<!-- sdlc-lite:managed:start v1 sha256:3116f8ba8c15 -->
# Documents

Pick one home from the table, then read one file. Placement effect unproven; see the docs-schema design.

| Home | Holds | Never holds |
|---|---|---|
| `specs/` | What the system is and must do; edited in place | Proposals, dated evidence, steps |
| `planning/` | Proposals, roadmaps, plans under review (`status:`) | What exists today |
| `decisions/` | One numbered decision per file, immutable once accepted | Narrative design |
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

1. Picture, diagram source or data file: `assets/`.
2. Evidence of something that happened on a date: `reports/`.
3. One choice with its reasons: `decisions/`.
4. A proposal, roadmap or plan under review: `planning/`.
5. An outcome to steer toward, with an owner and a status: `goals/`.
6. A measure with a command that runs it, a unit and a target: `kpi/`.
7. Steps a person follows: `guides/`.
8. A table, listing or glossary you look things up in: `references/`.
9. What the system is or must do: `specs/`.
10. Retired or superseded: `archive/`.
11. None of the above, or unsure: `other/`.

## Adding a document

1. Pick the home above; [the layout](layout.md) lists any extra homes.
2. Name it lowercase kebab-case; reports lead with `YYYY-MM-DD-`.
3. Run the onboard setup again to refresh the links below.
4. Put dated evidence in its own file under `reports/`. Do not add it to an entry file.
5. Find the document's type in `specs/doc-standards/README.md`, when this repository has it, and follow the card its row names.

## Contents

<!-- sdlc-lite:managed:end -->

`.claude/docs/` keeps its own scheme (plan, goals, roadmap, process, `references/`, `adr/`, `prd/`, `spec/`, `lld/`, `archive/`); the homes above do not apply there. Its grammar is the `doc-standards` skill.
