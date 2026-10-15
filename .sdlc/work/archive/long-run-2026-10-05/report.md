# Long-run report, agent-ui, final state (2026-10-06)

## Merged to main (user-approved), CI green, Deploy docs site green on the tip
- #1820 evals, #1821 retry tests, #1822 budget/trace (ADR-0234 accepted), #1823 Croupier padding half, #1824 no barrels (ADR-0233), #1825 dogfood guidance (ADR-0232 amendment ratified), #1826 admin e2e flows, #1828 Worker deploy hotfix, #1829 persona manifest (ADR-0235 accepted).
- Closed on rulings: #1813 (records stay untracked), #1793 (drop ops rulings), #1814, #1816; T-0003, T-0005, T-0006, T-0009 closed.

## Open draft PRs, each with a passed independent verifier (check by `gh pr view`)
- #1830 T-0007 sidecar why rewrite: CI green, mergeable.
- #1831 T-0013 capability registry (ADR-0237 proposed): CI green, mergeable.
- #1832 T-0017 Croupier hand consistency (ADR-0238 proposed): CI green, mergeable.
- #1833 T-0016 general-purpose agent activity strip (ADR-0159 amendment proposed): CI green, mergeable.
- #1834 T-0014 asset embed (ADR-0236 proposed, deploy-critical): first CI run pending at report time.
- #1835 T-0011 A2UI test kit: first CI run pending at report time.

## Needs you
- Merge order I recommend: #1830, #1831, #1833, #1832, #1835, then #1834 last (deploy-critical); I rebase between merges. Merges deploy to ui.nonoun.io.
- Ratify or leave proposed: ADR-0236, ADR-0237, ADR-0238, ADR-0159 amendment.
- Record the Haiku and Sonnet Croupier fixtures to finish the faces half of #1795; T-0004 stays blocked on it.
- After #1831 merges, prune ADR 236/237 from `KNOWN_GAPS` in `site/lib/docs-grammar.test.ts` as they land.

## Evidence
- Gates by exit code before each publish: `npm run check` and full `npm test` exit 0 on #1822 (rebased), #1824, #1826 fix, #1829, #1831 (13,474), #1832 (13,445), #1833 (13,435), #1834 (13,408 plus Worker tests), #1835 (14,037).
- `main` deploy: last Deploy docs site run succeeded after #1829; the #1824 deploy failure (Worker error 10021) was fixed by #1828.
- Root-cause and cost report: `.sdlc/root-cause-2026-10-06.md`.

## Not started or parked
- T-0004 faces half (needs fixtures). Follow-up tickets filed locally: sub-tag-aliases (T-0015), devtools-meta-replay (T-0018).
