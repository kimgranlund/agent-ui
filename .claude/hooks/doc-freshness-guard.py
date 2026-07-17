#!/usr/bin/env python3
"""PreToolUse gate (Bash) — on a `git commit`/`git push` invocation, checks that README.md and
CONTRIBUTING.md exist, are non-empty valid markdown, and carry no dangling internal link. TKT-0089:
Kim's ask was "ensures project docs are 100% accurate and up to date" — narrowed at intake to what
is actually mechanically checkable (existence, parse-validity, link-integrity), never a judgment
call on prose accuracy. CHANGELOG.md's own freshness already has a structural gate
(site/lib/sitemap.test.ts's entry-count check against the generated changelog index) — this hook
does not duplicate a second, competing changelog check.

Real scope limit, named not hidden: this fires only on a `git commit`/`git push` run as a Bash tool
call INSIDE a Claude Code session — a commit from a plain terminal, another editor, or CI never
triggers it. Not a repo-wide commit gate; a Claude-Code-session gate (TKT-0089's own Acceptance).

Mechanics: there is no dedicated "commit"/"push" hook event (the event vocabulary is tool-call
shaped, not git-operation shaped) — the matcher is `Bash`, and this script inspects
`tool_input.command` for a `git commit`/`git push` invocation itself, skipping (fast no-op) every
other command, matching adr-status-guard.py's own early-return shape.

Gate posture: PreToolUse + exit 2 + one stderr line per failing check (never mixed with JSON) — see
adr-status-guard.py for the same posture. The script never silently passes a check it didn't
actually run: an OSError reading a file is itself a reported failure, not a swallowed skip.
"""
import json
import os
import re
import sys

GIT_COMMIT_PUSH_RE = re.compile(r"(?:^|[;&|]\s*)git\s+(?:commit|push)\b")
MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
EXTERNAL_SCHEME_RE = re.compile(r"^(?:https?://|mailto:|tel:)", re.IGNORECASE)
HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.MULTILINE)
SLUG_STRIP_RE = re.compile(r"[^\w\- ]")

CHECKED_FILES = ("README.md", "CONTRIBUTING.md")


def project_dir() -> str:
    return os.environ.get("CLAUDE_PROJECT_DIR", "") or os.getcwd()


def slugify(heading: str) -> str:
    # Approximates GitHub's own heading-anchor algorithm: lowercase, strip non-word/space/hyphen
    # characters, then turn spaces into hyphens. Good enough for OUR own headings' own links to
    # them (never validated against an external renderer's exact behavior).
    s = SLUG_STRIP_RE.sub("", heading.strip().lower())
    return re.sub(r"\s+", "-", s)


def heading_slugs(text: str) -> "set[str]":
    return {slugify(m.group(1)) for m in HEADING_RE.finditer(text)}


def dangling_links(file_path: str, text: str, root: str) -> "list[str]":
    """Every link target in `text` that fails to resolve — a relative path with no file on disk, or
    a bare `#anchor` with no matching heading in THIS file. External links (http(s)/mailto/tel) and
    anchors on a link that ALSO names another file are out of scope — bounded per the ticket's own
    'no second link-graph crawler' framing; the same-file and same-repo cases are the two shapes a
    fresh README/CONTRIBUTING actually produce."""
    bad: list[str] = []
    slugs = heading_slugs(text)
    file_dir = os.path.dirname(file_path)
    for m in MD_LINK_RE.finditer(text):
        target = m.group(1).strip()
        if not target or EXTERNAL_SCHEME_RE.match(target):
            continue
        path_part, _, fragment = target.partition("#")
        if not path_part:
            # A bare #fragment link — must resolve to a heading in THIS file.
            if fragment and slugify(fragment.replace("-", " ")) not in slugs and fragment not in slugs:
                bad.append(f"{target} (no matching heading in {os.path.basename(file_path)})")
            continue
        resolved = os.path.normpath(os.path.join(file_dir, path_part))
        if not os.path.exists(resolved):
            bad.append(f"{target} (no file at {os.path.relpath(resolved, root)})")
    return bad


def check_doc(name: str, root: str) -> "list[str]":
    path = os.path.join(root, name)
    failures: list[str] = []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return [f"{name} is missing"]
    if not text.strip():
        failures.append(f"{name} exists but is empty")
        return failures
    if not HEADING_RE.search(text):
        failures.append(f"{name} has no markdown heading — not recognizable as a real doc")
    for bad_link in dangling_links(path, text, root):
        failures.append(f"{name}: dangling link {bad_link}")
    return failures


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    if data.get("tool_name", "") != "Bash":
        return 0
    command = (data.get("tool_input", {}) or {}).get("command", "") or ""
    if not GIT_COMMIT_PUSH_RE.search(command):
        return 0

    root = project_dir()
    failures: list[str] = []
    for name in CHECKED_FILES:
        failures.extend(check_doc(name, root))

    if failures:
        print("BLOCKED — doc-freshness guard (TKT-0089): README.md/CONTRIBUTING.md failed a bounded check:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        print("Fix the file(s) above, then retry the commit/push.", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
