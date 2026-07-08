#!/usr/bin/env python3
"""PostToolUse lint-feedback hook (Edit|Write) — catches a stray `*/` that closes a CSS `/* ... */`
comment EARLY (the known --c-*/ramp footgun: a real closing `*/` mid-comment silently truncates
the comment and drops the CSS after it — invisible to jsdom text-probes, only caught by a real
browser smoke, per this repo's own css-comment-star-slash-pitfall incident).

Reads the file back off disk (PostToolUse fires after the write, so the full resulting file is
available — Edit's tool_input only carries the changed fragment, not the whole file, so this
can't run as a pre-write check). Strips real /* ... */ spans (non-greedy, matching how a real CSS
parser scans to the FIRST `*/`); any `*/` left over after stripping is a floating close with no
open before it — exactly what an early-closed comment leaves behind.

Exit 2's stderr is fed to Claude on PostToolUse (the lint-feedback channel) — the write already
landed, so this reports rather than blocks; harmless because the guard is deterministic (a bare
`*/` outside a comment is never valid CSS) and Claude is expected to fix it immediately.
"""
import json
import os
import re
import sys


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    file_path = data.get("tool_input", {}).get("file_path", "") or ""
    if not file_path.endswith(".css"):
        return 0

    if not os.path.isabs(file_path):
        project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
        file_path = os.path.join(project_dir, file_path) if project_dir else file_path

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return 0

    def strip_comment(m: "re.Match[str]") -> str:
        return "\n" * m.group(0).count("\n")  # preserve line numbers for the report below

    stripped = re.sub(r"/\*.*?\*/", strip_comment, text, flags=re.DOTALL)
    idx = stripped.find("*/")
    if idx == -1:
        return 0

    line = stripped.count("\n", 0, idx) + 1
    print(
        f"agent-ui css-comment-guard: stray '*/' with no matching '/*' before it, "
        f"{file_path}:{line} — an earlier '*/' likely closed a /* ... */ comment early "
        f"(the known --c-*/ramp footgun), silently dropping the CSS that follows it. "
        f"Fix the comment before continuing.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
