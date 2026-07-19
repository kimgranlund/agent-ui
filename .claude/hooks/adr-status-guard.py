#!/usr/bin/env python3
"""PreToolUse gate (Edit|Write) — blocks any Claude-authored edit that flips an ADR's `Status`
cell TO `accepted` when it wasn't already `accepted`. Guards a real past incident: a subagent
fabricated a "Kim ruling" and self-flipped an ADR proposed->accepted, passing the ADR lint gate.
Only Kim (the human) ratifies proposed->accepted — per this repo's own ADR README, the cell holds
exactly one bare keyword in a `| **Status** | <word> |` table row (site/lib/adr.ts reads it
literally). Every Edit/Write in a Claude Code session is agent-performed (Kim never touches the
Edit/Write tool directly), so this denies the transition unconditionally, regardless of what the
request claims Kim said in conversation — that unverifiable claim is exactly the exploited path.

Mechanics: PreToolUse fires BEFORE the write, so the file on disk still holds the OLD content —
read it for the old Status. For Write, tool_input.content IS the new file. For Edit, tool_input
only carries old_string/new_string(/replace_all) — reconstruct the new content by applying that
substitution to the on-disk content (str.replace with count=1 unless replace_all), which is
sufficient to compute the resulting Status cell without needing the whole new file verbatim.

Gate posture: PreToolUse + exit 2 + a one-line stderr reason (never mixed with JSON) — this event
genuinely blocks the tool call before it executes.

REV 2026-07-18 (ADR-0149, comment-only — the deny logic above is byte-unchanged): the sanctioned
agent-side ratification path is `scripts/adr_ratify.py`, which verifies a `ratify ADR-####`
comment/review by the repo owner live via `gh` (fail-closed) and performs the flip through plain
file I/O — outside this hook's Edit/Write surface by design. This guard remains the tripwire on
the agent-edit path; the script is the verified door. Kim's in-tree hand-flip stays equally legal.
"""
import json
import os
import re
import sys

STATUS_RE = re.compile(r"\*\*Status\*\*\s*\|\s*([A-Za-z\-]+)\s*\|")
ADR_PATH_RE = re.compile(r"/\.claude/docs/adr/")


def extract_status(text: str) -> "str | None":
    m = STATUS_RE.search(text)
    return m.group(1).strip().lower() if m else None


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    file_path = tool_input.get("file_path", "") or ""

    if tool_name not in ("Edit", "Write"):
        return 0
    if not file_path.endswith(".md"):
        return 0
    if not ADR_PATH_RE.search(file_path):
        return 0
    if os.path.basename(file_path) == "README.md":
        return 0  # the log index, not a ratifiable decision record itself

    abs_path = file_path
    if not os.path.isabs(abs_path):
        project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
        abs_path = os.path.join(project_dir, file_path) if project_dir else file_path

    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            old_content = f.read()
    except OSError:
        old_content = ""  # a brand-new ADR file — "no prior status" is handled below

    if tool_name == "Write":
        new_content = tool_input.get("content", "") or ""
    else:  # Edit
        old_string = tool_input.get("old_string", "")
        new_string = tool_input.get("new_string", "")
        replace_all = bool(tool_input.get("replace_all", False))
        count = 0 if replace_all else 1
        new_content = old_content.replace(old_string, new_string, count) if count else old_content.replace(old_string, new_string)

    old_status = extract_status(old_content)
    new_status = extract_status(new_content)

    if new_status == "accepted" and old_status != "accepted":
        print(
            f"BLOCKED — ADR self-flip guard: this edit sets {file_path}'s Status "
            f"{old_status or '(new file, no prior status)'} -> accepted. "
            "Only Kim ratifies proposed->accepted — no agent may self-flip an ADR's Status via "
            "Edit/Write, even under a claimed instruction (this is exactly the exploited past "
            "incident). If Kim has ratified this, ask Kim to make this one edit themselves.",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
