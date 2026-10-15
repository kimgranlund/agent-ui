<!-- role=verifier level=L1 model=sonnet effort=medium -->
## Verdict
pass

## Criteria
- ADR-0233 file exists exactly once: pass. Evidence: the `ls | wc -l` check returned 1.
- Status `accepted` and Ratified-by row: pass. Evidence: both greps matched the header table in `0233-per-control-entries-and-generated-control-registry.md`.
- ADR-0233 names 0003, 0040, 0080, 0173 and 0197: pass. Evidence: the loop exited 0.
- Repairs row names the listed records: pass. Evidence: the loop over the nine strings exited 0.
- Exactly one U+2014 in ADR-0233: pass. Evidence: `grep -c` gives 1 and `grep -o | wc -l` gives 1, so the only one is the H1 separator. U+2013 count is 0.
- `:where(ui-row)` present: pass. Evidence: grep matched.
- `"name": "ADR-0233"` in `site/public/adr-index.json`: pass. Evidence: grep matched. The diff adds 7 lines to that file.
- Header cell names ADR-0233 and the last `##` heading is the Amendment, in 0003, 0040 and 0080: pass. Evidence: the loop exited 0.
- (guard) Only the Supersedes row is removed or changed in the three older ADRs: pass. Evidence: the `git diff -U0` removals filter was empty. The removed lines are the three Supersedes rows, and ADR-0040's cell text is kept with the note appended after ` · `.
- (guard) U+2014 and `**proposed**` counts in the three older ADRs do not exceed the base counts: pass. Evidence: the loop exited 0. ADR-0003 has 21 U+2014 both at base and now.
- (guard) `npx vitest run site/lib/adr.test.ts site/lib/sitemap.test.ts site/lib/docs-grammar.test.ts`: pass. Evidence: 3 files and 199 tests passed. I did not run it at the base commit, because the guard is green on the built tree.
- (guard) No changed or untracked files outside the allowed set: pass. Evidence: the negated pipeline exited 0. The changes are the ADR-0233 file, the three amended ADRs and `site/public/adr-index.json`.

I ran the criteria by hand, not through the harness. `$SDLC_BASE_SHA` was unset, so I used `afa231ae`, which is also HEAD. I did not run the red-side checks. The guards and the new ADR-0233 checks only gate the built tree.

I read the ADR-0233 outline: 8 numbered decision clauses, plus Context, Consequences and Alternatives sections.

## Out of scope changes
None. `site/public/sitemap.json` and `site/sitemap.json` are unchanged, which is allowed.

## For the next attempt
None
