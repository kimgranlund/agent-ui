<!-- role=verifier level=L1 model=opus effort=medium -->
## Verdict
pass

## Criteria
- C1 (`test -f .../AGENTS.md`; `cmp -s docs/CLAUDE.md .../CLAUDE.md`): pass. Evidence: I ran every criterion with `bash -c` on the built tree and C1 exited 0. It went red (exit 1) in a base worktree at `$SDLC_BASE_SHA`, and also when I appended one line to the copied `a2ui/CLAUDE.md`. `od -c docs/CLAUDE.md` shows the 3-line managed block wrapping `@AGENTS.md`.
- C2 (no more than 40 lines, no em dash): pass. Evidence: exit 0. The files have 38 and 35 lines; I diffed both against the handoff blocks after `sed 's/^    //'` and they are identical. Exit 1 at base, and exit 1 after I appended an em dash to `components/AGENTS.md`.
- C3 (code-span paths resolve, ADRs exist): pass. Evidence: exit 0. Exit 1 at base, exit 1 with a planted `` `src/nope/x.ts` ``, and exit 1 with a planted `ADR-9999`.
- C4 (recapture command present): pass. Evidence: exit 0. Exit 2 at base (missing file).
- C5 (a2ui headings and the token list): pass. Evidence: exit 0. Exit 1 at base.
- C6 (a2ui skills exist and are backticked): pass. Evidence: exit 0. Exit 1 at base, and exit 1 after I removed the backticks from `` `a2ui-build` ``.
- C7 (no selection or sidecar text): pass. Evidence: exit 0. Exit 1 after I appended `sidecar`.
- C8 (components headings, layer line and tokens): pass. Evidence: exit 0. Exit 1 at base, and exit 1 after I replaced `props-gen-driftwire.test.ts` with `generate-props.test.ts`.
- C9 (components skills): pass. Evidence: exit 0. Exit 1 at base.
- C10 (guard: only the 4 allowed paths changed): pass. Evidence: exit 0 on the built tree. In the base worktree with a stray `packages/agent-ui/AGENTS.md` it exited 1, and it went back to exit 0 once I removed that file.
- C11 (guard: `onboard.py check` prints `current AGENTS.md`): pass. Evidence: exit 0, and the output contains the line `current AGENTS.md`. It also prints a size note, "CLAUDE.md: 107 lines, over the 60-line target". That note is about the root CLAUDE.md, which the diff does not touch (`git status` shows only the four new files plus `.sdlc/`).
- C12 (guard: `npm run check`): pass. Evidence: `npm run check` exited 0 in 28.6 s, ending with "selftest: all green".

## Out of scope changes
None. `git status --short` lists only the four new files plus `.sdlc/`, which is the run record and excluded by C10.

## For the next attempt
None.
