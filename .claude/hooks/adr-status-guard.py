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


def status_rows(text: str) -> "list[str]":
    """EVERY Status-row match, lowercased — never first-match-wins. GH #745: a decoy
    `> | **Status** | proposed |` line planted above the real row made `search()` read the decoy
    while the real row flipped to accepted underneath — the guard's whole job, defeated by one
    pasted line. The count IS the signal (adr_ratify.py carries the same != 1 fail-closed rule)."""
    return [m.strip().lower() for m in STATUS_RE.findall(text)]


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest":
        return selftest()
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    return decide(data)


def decide(data: dict) -> int:
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    file_path = tool_input.get("file_path", "") or ""

    if tool_name not in ("Edit", "Write"):
        return 0
    if not file_path.endswith(".md"):
        return 0
    if not ADR_PATH_RE.search(file_path):
        return 0
    if os.path.basename(file_path) in ("README.md", "0000-template.md"):
        return 0  # the log index + the template (placeholder Status cell, 0 matching rows) — neither is a ratifiable record

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

    old_rows = status_rows(old_content)
    new_rows = status_rows(new_content)

    # GH #745 — fail-closed on any row-count anomaly BEFORE comparing values (the decoy defense):
    # the resulting file must carry EXACTLY one Status row (a pasted quote of a Status table, a decoy
    # above the real row, or a deleted row all land here), and a file already anomalous on disk (> 1)
    # is never adjudicated by picking one. The one legal 0-row OLD case is a brand-new ADR file.
    if len(new_rows) != 1:
        print(
            f"BLOCKED — ADR self-flip guard (GH #745): this edit leaves {file_path} with "
            f"{len(new_rows)} `| **Status** | <word> |` rows (need exactly 1). A decoy/duplicated/"
            "deleted Status row is indistinguishable from the bypass this guard exists to stop — "
            "fail-closed. Restructure the edit so exactly one Status row remains (quote foreign "
            "Status tables in a way the row regex cannot match, e.g. as a fenced code block).",
            file=sys.stderr,
        )
        return 2
    if len(old_rows) > 1:
        print(
            f"BLOCKED — ADR self-flip guard (GH #745): {file_path} ALREADY carries {len(old_rows)} "
            "Status rows on disk — the real row cannot be determined, so no edit is adjudicable. "
            "Repair the file to exactly one Status row first (Kim's call if the repair touches the "
            "status value).",
            file=sys.stderr,
        )
        return 2

    old_status = old_rows[0] if old_rows else None
    new_status = new_rows[0]

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


def selftest() -> int:
    """`--selftest` (GH #755, hook-writing-rules' mandate): embedded fixtures through the REAL
    decision logic — a real branch with fixture I/O, never an argv-ignoring exit 0 (the audit's own
    first probe produced 3 false PASSes exactly that way). Exit 0 = all rows pass, 1 = any row fails."""
    import subprocess
    import tempfile

    adr_dir_suffix = ".claude/docs/adr"

    def fixture_file(tmp: str, name: str, body: str) -> str:
        d = os.path.join(tmp, adr_dir_suffix)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)
        return path

    PROPOSED = "# ADR-9999 — fixture\n\n> | **Status** | proposed |\n> | **Date** | 2026-08-12 |\n\nBody.\n"
    ACCEPTED = PROPOSED.replace("proposed", "accepted")
    TWO_ROWS = PROPOSED + "\n> | **Status** | proposed |\n"

    with tempfile.TemporaryDirectory() as tmp:
        p_proposed = fixture_file(tmp, "9999-fixture.md", PROPOSED)
        p_accepted = fixture_file(tmp, "9998-fixture.md", ACCEPTED)
        p_two_rows = fixture_file(tmp, "9997-fixture.md", TWO_ROWS)
        p_readme = fixture_file(tmp, "README.md", PROPOSED)
        p_new = os.path.join(tmp, adr_dir_suffix, "9996-fixture.md")  # never written — the new-file case

        edit = lambda path, old, new: {"tool_name": "Edit", "tool_input": {"file_path": path, "old_string": old, "new_string": new}}
        write = lambda path, content: {"tool_name": "Write", "tool_input": {"file_path": path, "content": content}}

        rows: "list[tuple[str, dict, int]]" = [
            ("plain proposed->accepted flip BLOCKS", edit(p_proposed, "| **Status** | proposed |", "| **Status** | accepted |"), 2),
            # THE GH #745 TRAP — a decoy proposed row planted above the real row, real row flipped:
            ("decoy Status row above a real flip BLOCKS (GH #745)", edit(
                p_proposed,
                "> | **Status** | proposed |",
                "> | **Status** | proposed |\n> | **Status** | accepted |",
            ), 2),
            ("Write of a NEW file born accepted BLOCKS", write(p_new, ACCEPTED), 2),
            ("deleting the only Status row BLOCKS (count 0 != 1)", edit(p_proposed, "> | **Status** | proposed |\n", ""), 2),
            ("a file ALREADY carrying two rows on disk BLOCKS any edit", edit(p_two_rows, "Body.", "Body!"), 2),
            # negative controls — the hook must stay quiet on all of these:
            ("negative: body edit on a proposed ADR ALLOWS", edit(p_proposed, "Body.", "Body, revised."), 0),
            ("negative: body edit on an accepted ADR ALLOWS", edit(p_accepted, "Body.", "Body, revised."), 0),
            ("negative: accepted->superseded (not TO accepted) ALLOWS", edit(p_accepted, "| **Status** | accepted |", "| **Status** | superseded |"), 0),
            ("negative: a non-ADR .md path ALLOWS", edit(os.path.join(tmp, "notes.md"), "a", "b"), 0),
            ("negative: the ADR README index ALLOWS", edit(p_readme, "Body.", "Body!"), 0),
            ("negative: Write of a NEW file born proposed ALLOWS", write(p_new, PROPOSED), 0),
            ("malformed: missing keys is a quiet 0", {}, 0),
        ]

        failures = 0
        for label, payload, expected in rows:
            got = decide(payload)
            ok = got == expected
            failures += 0 if ok else 1
            print(f"  {'PASS' if ok else 'FAIL'}  expected {expected} got {got}  {label}", file=sys.stderr)

    # malformed: EMPTY STDIN through the real entrypoint (the audit's false-PASS probe shape) — must
    # exit 0 without touching argv-less branches.
    empty = subprocess.run([sys.executable, os.path.abspath(__file__)], input=b"", capture_output=True)
    ok = empty.returncode == 0
    failures += 0 if ok else 1
    print(f"  {'PASS' if ok else 'FAIL'}  expected 0 got {empty.returncode}  malformed: empty stdin via the real entrypoint", file=sys.stderr)

    print(("adr-status-guard --selftest: ALL PASS" if failures == 0 else f"adr-status-guard --selftest: {failures} FAILED"), file=sys.stderr)
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
