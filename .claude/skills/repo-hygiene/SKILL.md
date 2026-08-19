---
name: repo-hygiene
description: >-
  The judgment layer for keeping THIS repo's context substrate true — distilled from the 2026-07-12
  clean-repo campaign: how to read status-vs-reality (the tree-wins convention makes shipped-but-
  proposed NORMAL), when a suspicion needs consumer evidence before verdicting, what historical records
  may never be rewritten, how relocations are verified (sweep-gates beat replacement lists), the
  accepted-divergence pattern for upstream-tool disagreements, and the campaign's own two failure
  modes (command-composition, not judgment). Use when auditing/moving/retiring any .claude doc, skill,
  hook, or script; judging whether something is rot or convention; or planning any doc relocation.
  NOT for the grammar rules themselves (doc-standards) or the deterministic checks
  (site/lib/docs-grammar.test.ts · adr.test.ts · scripts/harness_wiring_check.py — cite, never restate).
disable-model-invocation: false
user-invocable: false
---

# Repo hygiene — the judgment layer

Distilled from `.claude/docs/reports/repo-alignment-2026-07-12/` (the FINDINGS index +
calibration log). The deterministic slice lives in the gates named above; this file carries only what no gate
can hold.

## Reading drift vs convention

- **Status lag is often the design** (`doc-standards` §2 owns the mechanism). Before
  verdicting "rot," ask WHICH convention governs — the campaign nearly misread 22 healthy specs. Real rot looks like: an accepted doc whose SUBJECT vanished, an
  unfilled placeholder beside a flipped status, a live doc citing a frozen record as present-tense
  authority.
- **A keep-verdict needs consumer evidence; so does a kill.** Three Phase-0 suspicions collapsed
  under evidence (preloads resolved; the "stale" agent was already repaired; the "vestigial" lock
  was the LIVE session's). Path-grep for actual readers/writers — a mention is not a referrer.
- **Placement ≠ liveness.** Move a doc to the right home without prejudging its class; judge the
  class where it lands (the 7 component LLDs rode the relocation, their reference-vs-active call
  stayed a separate verdict).

## Relocations

- **The sweep is the gate; the replacement list is just the attempt.** The Phase-1 move repaired
  21 referrers from a curated list — and the post-move dangling-link sweep still caught a missed
  relative form AND four pieces of PRE-EXISTING rot. Always end a relocation with the resolving
  sweep (now standing: docs-grammar S3), never with the list.
- Repair link DISPLAY TEXT (backticked path literals) separately from targets; convert moved
  files' relative links by resolve-then-re-relativize, not string surgery.
- What counts as a historical record and the archive law are `doc-standards` §6's
  (gate: docs-grammar S5) — the judgment call this skill adds: in an ACCEPTED record, repairing a
  live pointer (a path kept resolving) is mechanical and allowed; changing what the record CLAIMS
  is a content edit and is not.

## Upstream tools that disagree with the house

- **The accepted-divergence pattern** (harness_wiring_check.py): when a plugin's check contradicts
  repo law (forge's D9 role registry vs this repo's sanctioned `composer`), don't fork the tool
  and don't eat a red gate — allowlist EXACTLY that finding with the rationale inline, keep
  everything else failing loudly, and queue the upstream ask. Same shape as the corpus
  DISPOSITION_ALLOWLIST and the catalog EXCLUSION_ALLOWLIST: every exception named, cited, and
  narrow.
- **Declared-or-absent**: never assume operator-local or plugin tooling exists — probe, then
  degrade with a visible SKIP, never a FATAL (scribe's doc_lint simply doesn't speak this repo's
  dialect; that's a boundary, not a bug to "fix" docs against).

## The campaign's own failure modes (command-composition and merge mechanics, zero judgment errors)

- **Gate commands `&&`-chain into the commit** — a `;` shipped a red typecheck.
- **git add aborts the WHOLE command on one bad pathspec**, and `2>/dev/null` turns that into a
  silent half-commit — verify `git diff --cached --stat` before every multi-path commit; never
  reference just-dissolved dirs in an add.
- **A new gate biting on its first run is the system working** (S1 caught tkt-0003's missing
  `kind` within minutes of existing) — write the gate before trusting the sweep that motivated it.
- **Hand-union of both-sides-append JSON conflicts fuses adjacent objects** (2026-08-09, the S5
  rebase over S4): keeping both sides of a conflict hunk inside `site-manifest.json` merged two
  entries into ONE object via duplicate keys — still valid JSON, so `json.load` passed; only the
  sitemap byte-identity gate (`site/lib/sitemap.test.ts`) caught the vanished entry. After ANY
  conflict in the registration surfaces (`site-manifest.json` · sitemaps · `llms.txt`), run
  `node scripts/generate-sitemap.mjs` and `node scripts/generate-llms-full.mjs`, then let the
  drift gates judge — parseability proves nothing.
- **Derived-artifact conflicts regenerate, never hand-merge** (2026-08-17, applied twice: PR #1091's
  rebase and PR #1148's): a rebase conflict inside a DERIVED file — `site/lib/__fixtures__/
  theme-provider-built.css` (writer: fresh `npx vite build`, join sorted `assets/*.css` with `\n`,
  per its own test banner) or `a2ui/src/live-agent/prompt-equivalence.baseline.json` (writer:
  `RECAPTURE_BASELINE=1` on `recapture-baseline.test.ts`) — is resolved by taking EITHER side, then
  regenerating from the rebased tree via that gate's own sanctioned writer and letting the
  freshness gate judge. The same law as the registration-surfaces bullet above, generalized: a
  conflict in generated content is a prompt to re-generate, never to merge hunks.

## Merge-desk laws (2026-08-18)

- **Generated/derived files in conflict: take MAIN's side, then RE-RUN THE OPERATION.** The
  regenerate-never-hand-merge bullets above, sharpened by side and widened to operation-carrying
  state files: `adr-queue.json` → main's version + re-run `adr_queue.py`'s clear;
  `theme-provider-built.css` → the vite fixture rebuild; dogfood assets / llms-full → their regen
  scripts. Never default to `--theirs` on generated output — a careless `--theirs` resurrected
  3 already-cleared queue rows (2026-08-18).
- **After ANY conflict resolution, grep the file for live markers** —
  `grep -c '<<<<<<<\|>>>>>>>' <file>`, explicitly: gates are marker-blind (`llms.test.ts` passed
  green with live conflict markers inside `llms.txt`, 2026-08-18).
- **Merging and branch-deletion are ONE atomic op**: `gh pr merge --squash --delete-branch` — the
  deletion no-ops if the merge fails — and NEVER a manual `git push origin --delete` in the same
  block; any separate cleanup waits for `gh pr view --json state` = `MERGED`. Strike 2: PR #1306
  was CLOSED by deleting its head branch after a silently-failed conflict merge (2026-08-18;
  recovered via `headRefOid` → PR #1308).

## When an external wave lands mid-campaign

Kim's live token rework appeared in the working tree mid-Phase-5: never stage it, stage your own
work explicitly around it, and note whose wave owns the reconciliation. A campaign shares the
tree; it does not own it.
