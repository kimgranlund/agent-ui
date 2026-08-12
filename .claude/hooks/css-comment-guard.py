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
`*/` outside a comment AND outside a string literal is never valid CSS — GH #753 corrected the
original claim: `content: "*/"` is legal, so string literals are scanned as their own context)
and Claude is expected to fix it immediately.

GH #753: the original regex-strip pass flagged a literal `*/` inside a legal CSS string
(`content: "*/";`) — and a regex CANNOT fix that both ways, because comments are not recognized
inside strings AND strings are not recognized inside comments (a `/*` inside a string must not
open a comment). The scan below is a faithful three-context mini-scanner instead: outside /
in-comment / in-string, with the escape rule (`\\"`) and CSS's own bad-string rule (an unescaped
newline terminates a string), so an unclosed quote never swallows the rest of the file.
"""
import json
import os
import sys


def stray_close_line(text: str) -> "int | None":
    """Line number of the first `*/` that is genuinely OUTSIDE both a comment and a string —
    or None. The one detection decision, extracted so --selftest exercises the real scanner."""
    i, line, n = 0, 1, len(text)
    state: "str | None" = None  # None (plain CSS) | 'comment' | "'" | '"'
    while i < n:
        c = text[i]
        if c == "\n":
            line += 1
            if state in ("'", '"'):
                state = None  # CSS bad-string rule: an unescaped newline ends the string
            i += 1
            continue
        if state is None:
            if text.startswith("/*", i):
                state = "comment"
                i += 2
                continue
            if text.startswith("*/", i):
                return line
            if c in ("'", '"'):
                state = c
            i += 1
        elif state == "comment":
            if text.startswith("*/", i):
                state = None
                i += 2
                continue
            i += 1
        else:  # inside a string literal — comments are NOT recognized here
            if c == "\\":
                i += 2  # escape consumes the next char (incl. an escaped quote or newline)
                continue
            if c == state:
                state = None
            i += 1
    return None


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest":
        return selftest()
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    return decide(data)


def decide(data: dict) -> int:
    file_path = (data.get("tool_input", {}) or {}).get("file_path", "") or ""
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

    line = stray_close_line(text)
    if line is None:
        return 0

    print(
        f"agent-ui css-comment-guard: stray '*/' with no matching '/*' before it, "
        f"{file_path}:{line} — an earlier '*/' likely closed a /* ... */ comment early "
        f"(the known --c-*/ramp footgun), silently dropping the CSS that follows it. "
        f"Fix the comment before continuing.",
        file=sys.stderr,
    )
    return 2


def selftest() -> int:
    """`--selftest` (GH #755): fixtures through the REAL scanner + the real decide() path against
    sandbox files. Exit 0 = all rows pass, 1 = any row fails."""
    import subprocess
    import tempfile

    failures = 0

    def row(ok: bool, expected: object, got: object, label: str) -> None:
        nonlocal failures
        failures += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  expected {expected!r} got {got!r}  {label}", file=sys.stderr)

    scanner_rows: "list[tuple[str, object, str]]" = [
        ("/* fine */ .a { color: red; }", None, "balanced comment"),
        (".a { color: red; }\n*/\n", 2, "stray */ on its own line (line reported)"),
        ("/* early */ still comment text */", 1, "early-closed comment leaves a floating */"),
        ('.a::before { content: "*/"; }', None, "THE GH #753 TRAP: */ inside a double-quoted string"),
        (".a::before { content: '*/'; }", None, "*/ inside a single-quoted string"),
        ('.a::before { content: "a\\" */"; }', None, "escaped quote inside the string, */ still inside"),
        ('/* a " quote in a comment */ .a { color: red; }', None, "a quote inside a comment never opens a string"),
        ('.a { content: "/*"; } */', 1, "a /* inside a string never OPENS a comment — the trailing */ is stray"),
        ('.a { content: "unterminated\n*/\n', 2, "bad-string rule: newline ends the string, next-line */ is stray"),
    ]
    for css, expected, label in scanner_rows:
        got = stray_close_line(css)
        row(got == expected, expected, got, f"scanner: {label}")

    with tempfile.TemporaryDirectory() as tmp:
        good = os.path.join(tmp, "good.css")
        with open(good, "w", encoding="utf-8") as f:
            f.write('.a::before { content: "*/"; } /* balanced */\n')
        bad = os.path.join(tmp, "bad.css")
        with open(bad, "w", encoding="utf-8") as f:
            f.write(".a { color: red; }\n*/\n")

        got = decide({"tool_input": {"file_path": good}})
        row(got == 0, 0, got, "decide: legal string-literal file exits 0 (the reproduced false positive)")
        got = decide({"tool_input": {"file_path": bad}})
        row(got == 2, 2, got, "decide: stray-close file exits 2")
        got = decide({"tool_input": {"file_path": os.path.join(tmp, "notes.md")}})
        row(got == 0, 0, got, "negative: non-.css path is a quiet 0")
        got = decide({"tool_input": {"file_path": os.path.join(tmp, "missing.css")}})
        row(got == 0, 0, got, "negative: unreadable file is a quiet 0")
        got = decide({})
        row(got == 0, 0, got, "malformed: missing keys is a quiet 0")

    empty = subprocess.run([sys.executable, os.path.abspath(__file__)], input=b"", capture_output=True)
    row(empty.returncode == 0, 0, empty.returncode, "malformed: empty stdin via the real entrypoint")

    print(("css-comment-guard --selftest: ALL PASS" if failures == 0 else f"css-comment-guard --selftest: {failures} FAILED"), file=sys.stderr)
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
