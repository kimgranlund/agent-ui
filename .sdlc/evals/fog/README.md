# fog

context-fog-of-war records (T-0248): one `<round>.json` per round folder ingested as a session bundle with `../fog-manifest.json` (rounds from T-0259) or `../fog-manifest-v1.json` (the three earlier rounds), holding its published report id, mapping hash and counts. `run-capped.ts --describe` shows it in the round README. The evals index is `../README.md`.

`contract-audit/` (T-0312): the committed mapping `audit.py scan` (skill context-fog-of-war) reads in each round's analysis, advisory and never a gate (Kim 2026-10-16, P6). Regenerate with `python3 .sdlc/evals/fog/contract-audit/make_mapping.py` when a guidance surface moves; run `audit.py scan --root . --mapping .sdlc/evals/fog/contract-audit/mapping.json --out <file outside the tree>`.
