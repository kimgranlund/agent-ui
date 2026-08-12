#!/usr/bin/env python3
"""claude_wiring_check.py — deterministic integrity checks over .claude/ wiring (GH #756, GH #757).

Two tiers, deliberately different:

FAIL tier (exit 1) — GH #756, the #134/#135 defect class mechanized:
  Every `.claude/agents/*.md` frontmatter `skills:` preload is cross-referenced against the named
  skill's own frontmatter. A preloaded skill carrying `disable-model-invocation: true` is
  UNREACHABLE by its sole consumer (dmi:true blocks `skills:` delivery — three seats routed blind
  for weeks before the 2026-08-11 audit caught it by hand). A bare preload name that resolves to no
  `.claude/skills/<name>/SKILL.md` fails too. Plugin-namespaced names (`plugin:skill`) and names
  resolving outside this repo are SKIPPED with a note — this script owns repo wiring only.

ADVISORY tier (never fails, v1 per GH #757's own acceptance) — the anchor-rot sweep:
  Flags `file.ext:NNN`-style line-number anchors into mutable files inside
  `.claude/skills/*/SKILL.md` — the audit's dominant finding class (~14 of 27 skills; anchors rot,
  member lists fork, counts decay). Stable anchors (clause ids, § headings, requirement ids,
  symbols, directories) are the cure and are never flagged. Escape hatch: a line carrying an
  explicit `pinned to commit <sha>` (any 7+ hex) annotation passes — a dated snapshot is a
  legitimate citation; an unpinned line number is a rot in waiting.

Home rationale (GH #756's builder-picks call): repo-side `scripts/`, folded into `check:scripts` —
the wiring being checked is this repo's own `.claude/` tree, and the standing gate is where
recurrence gets caught at edit time. The harness plugin's skill_lint checks ONE skill's shape;
this checks the CROSS-file wiring no single-file linter can see.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTS_DIR = os.path.join(ROOT, ".claude", "agents")
SKILLS_DIR = os.path.join(ROOT, ".claude", "skills")

# Matches both inline (`skills: [a, b]`) and block (`skills:\n  - a`) YAML list forms.
INLINE_RE = re.compile(r"^skills:\s*\[([^\]]*)\]", re.MULTILINE)
BLOCK_RE = re.compile(r"^skills:\s*\n((?:\s+-\s+\S+\s*\n)+)", re.MULTILINE)
DMI_TRUE_RE = re.compile(r"^disable-model-invocation:\s*true\s*$", re.MULTILINE)

# GH #757 — a `path.ext:NNN` anchor (`foo.ts:123`, `SKILL.md:8-9`). Extensions scoped to source/doc
# files; a `§`/clause/requirement id never matches this shape.
LINE_ANCHOR_RE = re.compile(r"\b[\w./-]+\.(?:ts|tsx|js|mjs|css|md|py|json|yml|yaml|sh)(?::\d+(?:[-–]\d+)?)+")
PIN_RE = re.compile(r"pinned to commit [0-9a-f]{7,}", re.IGNORECASE)


def frontmatter(text: str) -> str:
    if not text.startswith("---"):
        return ""
    end = text.find("\n---", 3)
    return text[: end + 4] if end != -1 else ""


def preloads_of(agent_text: str) -> "list[str]":
    fm = frontmatter(agent_text)
    names: list[str] = []
    m = INLINE_RE.search(fm)
    if m:
        names.extend(n.strip() for n in m.group(1).split(",") if n.strip())
    m = BLOCK_RE.search(fm)
    if m:
        names.extend(line.strip().lstrip("-").strip() for line in m.group(1).splitlines() if line.strip())
    return names


def check_preloads() -> int:
    failures = 0
    if not os.path.isdir(AGENTS_DIR):
        print("  (no .claude/agents dir — preload check vacuous)", file=sys.stderr)
        return 0
    checked = 0
    for fname in sorted(os.listdir(AGENTS_DIR)):
        if not fname.endswith(".md"):
            continue
        agent = fname[:-3]
        text = open(os.path.join(AGENTS_DIR, fname), encoding="utf-8").read()
        for name in preloads_of(text):
            if ":" in name:
                print(f"  SKIP  {agent} → {name} (plugin-namespaced — not this repo's wiring)", file=sys.stderr)
                continue
            skill_path = os.path.join(SKILLS_DIR, name, "SKILL.md")
            checked += 1
            if not os.path.isfile(skill_path):
                print(f"  FAIL  {agent} preloads '{name}' — no .claude/skills/{name}/SKILL.md exists", file=sys.stderr)
                failures += 1
                continue
            if DMI_TRUE_RE.search(frontmatter(open(skill_path, encoding="utf-8").read())):
                print(
                    f"  FAIL  {agent} preloads '{name}' — that skill carries disable-model-invocation: true, "
                    "which BLOCKS skills: preload delivery (the #134/#135 class, GH #746/#756): the seat runs blind",
                    file=sys.stderr,
                )
                failures += 1
            else:
                print(f"  PASS  {agent} → {name}", file=sys.stderr)
    if checked == 0:
        print("  FAIL  zero repo-resolvable preloads found — refusing to pass a vacuous run", file=sys.stderr)
        return 1
    return failures


def sweep_anchors() -> int:
    flagged = 0
    if not os.path.isdir(SKILLS_DIR):
        return 0
    for skill in sorted(os.listdir(SKILLS_DIR)):
        path = os.path.join(SKILLS_DIR, skill, "SKILL.md")
        if not os.path.isfile(path):
            continue
        for lineno, line in enumerate(open(path, encoding="utf-8").read().splitlines(), 1):
            if LINE_ANCHOR_RE.search(line) and not PIN_RE.search(line):
                print(f"  ADVISORY  {skill}/SKILL.md:{lineno} — line-number anchor into a mutable file (cite a clause id/§/symbol/directory instead, or annotate 'pinned to commit <sha>'): {line.strip()[:100]}", file=sys.stderr)
                flagged += 1
    if flagged:
        print(f"  anchor sweep: {flagged} advisory finding(s) — not a failure at v1 (GH #757); repair with the cite-the-owner rule", file=sys.stderr)
    else:
        print("  anchor sweep: clean", file=sys.stderr)
    return 0  # advisory tier never fails the gate at v1


def main() -> int:
    print("claude_wiring_check — preload reachability (FAIL tier):", file=sys.stderr)
    failures = check_preloads()
    print("claude_wiring_check — line-anchor sweep (ADVISORY tier):", file=sys.stderr)
    sweep_anchors()
    if failures:
        print(f"claude_wiring_check: {failures} FAILED", file=sys.stderr)
        return 1
    print("claude_wiring_check: PASS", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
