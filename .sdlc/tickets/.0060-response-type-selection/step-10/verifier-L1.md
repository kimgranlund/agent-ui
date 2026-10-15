<!-- role=verifier level=L1 model=sonnet effort=medium -->
## Verdict
pass

## Criteria
- (red) node detectUserOverride script: pass. Evidence: exit 0 on the built tree; red-checkpoint.jsonl records the pre-edit control (attempt 097411a5, exit 1, result red).
- (red) vitest `-t "lexicon false positives"` with passed-count grep: pass. Evidence: exit 0; pre-edit control recorded red. process-deviations.md names only the older attempt b230669e, whose controls were reset; the current attempt's audit status is ok with all 3 controls red.
- (red) python check that `'render'` and `'in words'` are gone: pass. Evidence: exit 0; pre-edit control recorded red.
- (guard) vitest response-type, layering, produce-response-type: pass. Evidence: 3 files, 90 tests passed.
- (guard) vitest tools project agent-eval: pass. Evidence: 4 files, 29 tests passed.
- (guard) doc_lint on the SPEC: pass. Evidence: exit 0.
- (guard) scope loop against base sha: pass. Evidence: exit 0, no out-of-scope file.

## Probes (my own phrasings, built tree)
Force surface:
- "build a list of reasons": false positive ("list" is a noun).
- "make me a table of contents": false positive.
- "show me the list of files in my home folder": false positive.
- "show me how a table join works": false positive.
- "show me the screen resolution settings in macOS": false positive.
- "show me what a card game looks like": false positive.
- "build a wizard character": false positive.
- "show me one two three table": noun at word 4, matches (boundary behaves as specified).
- True positives: "render the page as a card", "show me a chart of sales", "make me a quick form", "make me a dashboard".

No override:
- "show me how to bake bread", "build a case for hiring", "show me a good example of recursion", "build a website", "build a bridge between the two ideas", "make me a cup of tea, a page of notes is fine", "show me one two three four table" (noun at word 5).
- False negatives: "show me a diagram" and "Build me a form" are not caught ("diagram" is not a noun; "build me a" is not a phrase).
- "show me a pricing tables" is not caught (whole-word boundary).
- "just tell me, show me a table" gives text (text wins a tie).

Residual shape: the noun gate cuts the bare-verb cases ("show me the capital", "make me a sandwich"), but surface nouns that double as ordinary words (list, page, table, card, screen, wizard, tabs, plans) still produce false positives when they fall within four words. False negatives are phrases outside the lexicon (diagram, "build me a").

Fixture check: response-type-cases.json has 43 cases. Only surface-survey and surface-settings-panel (the two surface-expecting prompts) trigger a surface override. All 41 others return undefined, the same as the criteria require.

## Out of scope changes
None. The diff against the base sha touches only the three allowed files (response-type.ts, response-type.test.ts, the SPEC), committed as c484c5cc.

## For the next attempt
None.
