---
doc-type: ticket
id: tkt-0089
status: done
date: 2026-07-17
owner:
kind: feature
size: small
---
# TKT-0089 — a Claude Code hook that mechanically checks README/CONTRIBUTING/CHANGELOG on commit/push (+ create the two missing files)

## Summary
Kim's seed (2026-07-17, `/feature` intake): add a hook that "ensures project docs are 100%
accurate and up to date," triggered on commit/push, covering README.md (doesn't exist yet),
CHANGELOG.md, CONTRIBUTING.md (doesn't exist yet).

**Grounded before sizing (two clarifying rounds):**
- **Mechanism, confirmed:** a `.claude/hooks/` Claude Code hook, matching this repo's own existing
  pattern (`adr-status-guard.py`, `css-comment-guard.py`, `bundle-size-reminder.sh` — all
  `PreToolUse`/`PostToolUse` on `Edit|Write`). **Real scope limit, named not hidden:** a Claude Code
  hook fires only on tool calls made *inside a Claude Code session* — a `git commit`/`git push` run
  from a plain terminal, another editor, or CI never triggers it. This is not a repo-wide commit
  gate; it is a Claude-Code-session gate. The matcher itself will be `Bash`, with the script
  inspecting `tool_input.command` for a `git commit`/`git push` pattern (there is no dedicated
  "commit"/"push" hook event — `hook-authoring-standards` confirms the event vocabulary is
  tool-call-shaped, not git-operation-shaped).
- **Check scope, confirmed bounded/deterministic:** no LLM judgment call per commit, no attempt to
  verify prose "accuracy" (impossible to check mechanically) — file-existence, parse-validity,
  link-integrity, and structural-recency checks only.
- **Repo state, verified:** no `README.md`, no `CONTRIBUTING.md` (`ls` confirms — matches Kim's own
  "we need to create one" for README, and CONTRIBUTING doesn't exist either, unstated in the seed).
  `CHANGELOG.md` DOES already exist (80KB) and is **explicitly hand-authored narrative**, not
  commit-derived — its own header states "the sources of truth are `.claude/docs/goals.md`/
  `plan.md`/`adr/`." It already has a **partial structural gate**: `site/lib/sitemap.test.ts:104`
  checks its `## ` entry count against the site's generated changelog index — this ticket's hook
  should build on that existing gate, not duplicate a second changelog-parsing mechanism.
  No git hooks exist (`.git/hooks/` empty besides samples), no husky/lint-staged in `package.json`,
  no `.github/workflows/` — zero existing enforcement of any kind for these three files today.

## Acceptance
- `README.md` is created (root, doesn't exist today) — real content, not a stub: what agent-ui is,
  how to run `npm run check && npm test`/`dev`/`build` (CLAUDE.md's own Commands section is the
  source to draw from, not duplicate verbatim — reference it, don't restate it as a second copy
  that can drift), and a pointer into `.claude/docs/` for anyone going deeper.
- `CONTRIBUTING.md` is created (root, doesn't exist today) — real content: the standing gate
  (`npm run check && npm test` green before any change is done, per CLAUDE.md's own "Always"
  section), the doc-authoring conventions this repo actually uses (`.claude/skills/
  agent-ui-doc-standards/`), and points at the ADR/ticket process rather than re-teaching it.
- A new `.claude/hooks/doc-freshness-guard.py` (or similarly named, per `hook-authoring-standards`'
  naming/structure conventions) registered as a `PreToolUse` hook matching `Bash`, whose script:
  inspects `tool_input.command` for a `git commit`/`git push` invocation (skip everything else,
  fast no-op — matching `adr-status-guard.py`'s own early-return shape) and, when matched, runs the
  bounded checks named below, reporting a clear one-line reason per failure (exit 2 blocks; the
  script never silently passes a check it didn't actually run).
- The bounded, deterministic checks themselves (each genuinely mechanical, no judgment call):
  README.md and CONTRIBUTING.md exist and are non-empty valid markdown; no dangling internal link
  in either file (a relative path or `#anchor` that doesn't resolve); CHANGELOG.md's existing
  structural gate (`sitemap.test.ts`'s entry-count check) stays the single source of truth for that
  file's own freshness — this hook does not duplicate a second, competing changelog check.
- The hook's own reasoning is documented inline (matching `adr-status-guard.py`'s own docstring
  discipline) — a future reader must be able to tell WHY each check exists without re-deriving it.

## Links
- `.claude/hooks/adr-status-guard.py` / `css-comment-guard.py` / `bundle-size-reminder.sh` — the
  exact existing pattern (`PreToolUse`/`PostToolUse` on tool-name matchers, not git-event matchers)
  this new hook follows.
- `forge:hook-authoring-standards` — the event/matcher/exit-code contract this build must follow.
- `site/lib/sitemap.test.ts:104` / `scripts/generate-sitemap.mjs:198-221` — CHANGELOG.md's existing
  partial structural gate this ticket builds on rather than duplicates.
- CLAUDE.md's own "Commands"/"Always" sections — the content README/CONTRIBUTING should reference,
  not fork into a second, driftable copy.

## Scope/Open
- **Version-consistency check named but not required:** `package.json`'s `version` is currently
  pinned at `0.0.0` (pre-release) — a "CHANGELOG gained an entry when the version bumped" check is
  not yet meaningful and shouldn't be built until real versioning starts; named here so a build
  doesn't invent a check against a field that never changes.
- **CHANGELOG-recency heuristic left open:** whether the new hook should ALSO flag "N commits since
  the last `## ` entry, consider adding one" as an advisory (not blocking) nudge is undecided —
  Kim's "bounded, deterministic" answer covers existence/link-integrity cleanly but a
  recency-heuristic edges toward judgment (how many commits is "too many"?); left for build time.
- **Does this need any git-native or CI enforcement too**, given the confirmed mechanism only
  covers commits made through a Claude Code session? Explicitly out of THIS ticket's scope (Kim's
  own answer), named here so the gap is visible rather than silently assumed away.
- **README/CONTRIBUTING content depth** is sized "enough to be real, not a stub" in Acceptance but
  the exact section list isn't prescribed — a small enough decision for whoever builds this to make
  directly, not a fork needing a ratified ADR.

## Findings

**2026-07-17 — shipped.** Real README.md and CONTRIBUTING.md (both previously absent) plus
`.claude/hooks/doc-freshness-guard.py`, registered as a `PreToolUse` hook matching `Bash` in
`.claude/settings.json`, following `adr-status-guard.py`'s exact posture (fast no-op on anything
that isn't a `git commit`/`git push` command, exit 2 + one stderr line per failure on block, never
mixed with JSON).

- **README.md** — what agent-ui is (the pillar + FACE/light-DOM/ARIA-via-ElementInternals summary),
  the 8 workspace packages, `npm install`/`dev`/`build`, the full Commands list, and a pointer into
  `.claude/docs/` — references CLAUDE.md's own Commands section rather than forking a second copy.
- **CONTRIBUTING.md** — the standing `npm run check && npm test` gate, the ticket/ADR/PRD-SPEC-LLD
  doc grammar (pointing at `agent-ui-doc-standards`, not re-teaching it), the component-design
  intake procedure, and a pointer at `process.md`'s drift/bloat rationale.
- **The hook's bounded checks** (deterministic, no judgment call, matching Acceptance exactly):
  README.md/CONTRIBUTING.md exist, are non-empty, and contain at least one markdown heading
  (the "not recognizable as a real doc" floor — catches an accidentally-emptied or non-markdown
  file a bare non-empty check would miss); every internal link in either file resolves — a
  relative-path link against a real file on disk, or a bare `#anchor` against a heading in the SAME
  file (GitHub-style slugification). External links (http/https/mailto/tel) are explicitly out of
  scope — no network call from a hook. CHANGELOG.md is untouched — `sitemap.test.ts`'s existing
  entry-count gate stays its one freshness check, exactly as scoped.
- **Verified manually** (no vitest test exists for the other two Python hooks either — matches the
  repo's own convention, hooks aren't part of the TS/vitest world): fast no-op on a non-Bash tool
  call and on a non-git Bash command; a clean PASS against the real, just-written README/CONTRIBUTING;
  three negative controls (both files missing, an empty file, a synthetic dangling relative-path
  link + dangling anchor) each correctly BLOCK with the specific reason named, and a real matching
  anchor correctly does NOT false-positive.
- **Gate:** `npm run check` clean; full jsdom sweep 353 files / 6442 tests green (one test more than
  the prior sweep, from an existing parameterized gate picking up a new root-level input; no new
  test file added for the hook itself, matching the repo's own no-vitest-coverage convention for
  Python hooks).

