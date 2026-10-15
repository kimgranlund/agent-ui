#!/usr/bin/env python3
"""Backticked-path existence check for T-0252.

Scans live Markdown under .claude/docs and .claude/skills (plus .claude/agents)
for backticked tokens that look like repo paths and reports each one that
resolves nowhere. Frozen or historical homes are skipped: the ADR log
(`adr/`), the frozen ticket folder (`tickets/`), `archive/`, dated `reports/`
and `research/`, a skill's recorded `evals/baseline/` answers, and any section whose heading names history (History,
Changelog, Amendment, Log, Status history, Evidence, Provenance, Retired).
A whole document is history once its header carries a `> Superseded:` line
(a retired design, T-0252). `> Superseded in part: \`ui-x\`` keeps the scan on
but treats each line naming `x` as history. A line
that declares a file still to be built (`unbuilt`, `planned`, `NEW`, `(new)`,
`to create`, `not yet built`) or already gone (`removed`, `retired`,
`obsolete`, `deferred`, `re-pointed`, `reshaped`, `rejected`, `excised`) says so itself and is skipped.
`goals.md`, `plan.md`, `process.md` and `roadmap.md` are T-0251's scope and
are skipped here.

A token counts as a path when it has a slash and a file extension or a
trailing slash, and carries no glob, placeholder, space or URL scheme. It
resolves when it exists relative to the repo root, the citing file's folder,
`.claude/`, the package root `packages/agent-ui/`, any package folder or its
`src/`, or when a tracked file or folder ends with it (a short cite such as
`dom/form.ts` names a real file), when it is git-ignored (a build or runtime
output), when `pkg/` stands for `packages/agent-ui/a2ui/`, or when
`path_check.allow.txt` lists it with a reason (another repository, a runtime
output, an export key).

Usage: python3 path_check.py [repo-root]   exit 0 = no missing path, 1 = misses.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[3])
SCAN = [".claude/docs", ".claude/skills", ".claude/agents"]
SKIP_DIRS = {"adr", "tickets", "archive", "reports", "research", "baseline"}
SKIP_FILES = {".claude/docs/goals.md", ".claude/docs/plan.md", ".claude/docs/process.md", ".claude/docs/roadmap.md"}
PLANNED = re.compile(
    r"\bNEW\b|(?i:\bunbuilt\b|\bplanned\b|\(new\)|\bto create\b|\bnot yet built\b"
    r"|\bobsolete\b|\bremoved\b|\bdeferred\b|\bretire[ds]?\b|re-pointed|\breshaped\b|\brejected\b|never-written|\bexcised\b|unbuildable)"
)
SUPERSEDED = re.compile(r"^> Superseded:", re.M)
PARTIAL = re.compile(r"^> Superseded in part: `(?:ui-)?([\w-]+)`", re.M)
HISTORY = re.compile(
    r"history|changelog|amendment|\blog\b|evidence|provenance|retired|superseded|session record|run record",
    re.I,
)
TICK = re.compile(r"`([^`\n]+)`")
EXT = re.compile(r"\.(md|mdx|ts|mts|tsx|js|mjs|cjs|json|jsonl|css|html|py|sh|yml|yaml|toml|txt|svg|csv)$")
BAD = re.compile(r"[*?<>{}\[\]$|\s…]|^https?:|^@|^~|^-|\.\.\.|YYYY")

# Paths in other repositories, user-level plugins, runtime outputs and
# package export keys, each listed with its reason in path_check.allow.txt.
EXTERNAL = {
    line.split("#")[0].strip()
    for line in (Path(__file__).parent / "path_check.allow.txt").read_text(encoding="utf-8").splitlines()
    if line.split("#")[0].strip()
} if (Path(__file__).parent / "path_check.allow.txt").exists() else set()

PACKAGES = sorted((ROOT / "packages/agent-ui").glob("*/"))
BASES = [ROOT, ROOT / ".claude", ROOT / "packages/agent-ui", *PACKAGES, *(p / "src" for p in PACKAGES)]
TRACKED = subprocess.run(["git", "-C", str(ROOT), "ls-files"], capture_output=True, text=True, check=True).stdout.split("\n")
SUFFIXES: set[str] = set()
for f in TRACKED:
    parts = f.split("/")
    for i in range(1, len(parts)):
        SUFFIXES.add("/".join(parts[i:]))
        for j in range(i + 1, len(parts)):
            SUFFIXES.add("/".join(parts[i:j]) + "/")


def looks_like_path(tok: str) -> bool:
    tok = tok.split(":")[0].split("#")[0]
    # A leading slash is a URL route (`/items/:id`, `/.well-known/agent.json`).
    if "/" not in tok or tok.startswith("/") or BAD.search(tok):
        return False
    return bool(EXT.search(tok) or tok.endswith("/"))


def resolves(tok: str, here: Path) -> bool:
    tok = tok.split(":")[0].split("#")[0]
    if tok.startswith("./"):
        tok = tok[2:]
    for base in [here, *BASES]:
        if (base / tok).exists():
            return True
    if tok.startswith("pkg/") and (ROOT / "packages/agent-ui/a2ui" / tok[4:]).exists():
        return True
    if tok.lstrip("/") in SUFFIXES or tok in EXTERNAL:
        return True
    # A git-ignored runtime or build output (dist/, .agent-traces/) is a real place.
    if tok.startswith("../"):
        # A relative import specifier from a source file (`../button/button.ts`).
        return tok.lstrip("./") in SUFFIXES
    return subprocess.run(
        ["git", "-C", str(ROOT), "check-ignore", "-q", "--no-index", tok], stderr=subprocess.DEVNULL
    ).returncode == 0


def scan(path: Path) -> list[tuple[int, str]]:
    misses: list[tuple[int, str]] = []
    in_history = False
    history_level = 0
    fence = False
    text = path.read_text(encoding="utf-8")
    if SUPERSEDED.search(text):
        return misses
    partial = PARTIAL.search(text)
    retired = partial.group(1) if partial else None
    for n, line in enumerate(text.splitlines(), 1):
        if line.lstrip().startswith("```"):
            fence = not fence
            continue
        m = re.match(r"^(#{1,6})\s+(.*)", line)
        if m and not fence:
            level = len(m.group(1))
            if in_history and level <= history_level:
                in_history = False
            if not in_history and HISTORY.search(m.group(2)):
                in_history, history_level = True, level
            continue
        if in_history or PLANNED.search(line) or (retired and retired in line):
            continue
        for tok in TICK.findall(line):
            if looks_like_path(tok) and not resolves(tok, path.parent):
                misses.append((n, tok))
    return misses


def main() -> int:
    total = 0
    for rel in SCAN:
        for path in sorted((ROOT / rel).rglob("*.md")):
            parts = set(path.relative_to(ROOT / rel).parts[:-1])
            if parts & SKIP_DIRS or str(path.relative_to(ROOT)) in SKIP_FILES:
                continue
            for n, tok in scan(path):
                print(f"{path.relative_to(ROOT)}:{n}: missing `{tok}`")
                total += 1
    print(f"path_check: {total} missing path(s)")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
