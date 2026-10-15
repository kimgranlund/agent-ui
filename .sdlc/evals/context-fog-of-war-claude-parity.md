# context-fog-of-war: what Claude Code compatibility and parity need

For: the context-fog-of-war author (Codex host).
From: a Claude Code session (agent-ui repo), 2026-10-15.
Status: requirements and observed formats. Nothing here has been built.

## Why this report exists

We invoked `/context-fog-of-war` from Claude Code to analyze a session's context routing. The skill loaded and its instructions were readable. The run stopped at hydration because every adapter path is Codex-only:

- `discover.py` looks for `$CODEX_HOME/sessions` and a first `session_meta` record.
- `fog.py hydrate` parses Codex `exec_command` / `shell_command` calls, Codex text envelopes and `apply_patch` results.
- The SKILL.md workflow names `CODEX_THREAD_ID` for the current session.

A Claude Code transcript has none of these. To get parity, the skill needs a second host adapter that produces the same v2 `session.json`, with the shell (`assets/shell.html`) unchanged.

Everything below was observed in real transcripts from Claude Code versions 2.1.289 to 2.1.295 on macOS. Field names can change between versions, so the adapter should tolerate missing fields and report them as coverage gaps rather than fail.

## 1. Where the traces live (discovery)

| Item | Claude Code | Codex equivalent |
|---|---|---|
| Session root | `~/.claude/projects/<project-slug>/` | `~/.codex/sessions` |
| Project slug | the session cwd with every `/` replaced by `-`, e.g. `/Users/k/Projects/x` becomes `-Users-k-Projects-x` | `session_meta.cwd` |
| One session | `<project-slug>/<sessionId>.jsonl` (sessionId is a UUID, also the file stem) | one session file |
| Sub-agents | `<project-slug>/<sessionId>/subagents/agent-<agentId>.jsonl` plus `agent-<agentId>.meta.json` | none |
| Spilled tool output | `<project-slug>/<sessionId>/tool-results/<id>.txt` (a result's `persistedOutputPath` points here) | none |

Discovery changes:

- Add `--host claude|codex` (or auto-detect by root). For `--repo /p`, compute the slug and list `*.jsonl` directly under it.
- There is no `session_meta`. Identity comes from `sessionId`, which nearly every record carries. Cwd comes from `cwd` on `user`, `assistant`, `attachment` and `system` records. The first line is often a metadata record such as `last-prompt` or `mode`, not a message.
- Latest session: use the newest `timestamp` on a `user` or `assistant` record. Do not rely on file mtime, because metadata appends move it.
- Current session: Claude Code does not export a thread-id env var that we could confirm. The invoking session knows its own transcript path, so accept `--trace PATH` or `--session-id UUID` and treat "this session" as that file.
- Worktrees: a session can move between checkouts mid-run. `relocated` and `worktree-state` records mark the move, and `cwd` on later records changes. `--trace-root` mapping should be applied per record cwd, not once per session.

## 2. Record model

A Claude Code transcript is JSONL. Every line has a `type`. Message records form a tree through `uuid` and `parentUuid`. That tree is a recorded link and can feed `recorded` edges directly.

| `type` | What it is | Map to |
|---|---|---|
| `user` | A user message, a tool result, or an injected meta message | message, result, or context (see flags) |
| `assistant` | One model output block per record, sharing `message.id` / `requestId` across a turn | message, call |
| `attachment` | Context the harness injected into the turn | context evidence (section 4) |
| `system` | Harness events: `compact_boundary`, `turn_duration`, `stop_hook_summary`, `local_command`, `away_summary`, `informational` | compaction, unknown |
| everything else | Session metadata: `mode`, `permission-mode`, `agent-setting`, `cost-state`, `custom-title`, `agent-name`, `pr-link`, `file-history-snapshot`, `file-history-delta`, `queue-operation`, `relocated`, `worktree-state`, and others | ignore, or session header fields; keep as inspectable unknowns |

Flags on `user` records:

- `isMeta: true` means harness-injected text the user did not type. Typical cases are a loaded skill body, a reminder, or a command echo.
- `isCompactSummary: true` means the summary that replaces history after compaction.
- `isVisibleInTranscriptOnly` means it was shown to the user but not sent to the model.
- `isSidechain: true` means a sub-agent branch.
- `sourceToolUseID` ties an injected message to the tool call that caused it, which makes it a `recorded` link.

`message.content` blocks:

| Block | Where | Notes |
|---|---|---|
| `text` | user, assistant | Plain prose. |
| `thinking` | assistant | Redacted or signed reasoning. Omit the bytes, keep a coverage note. The SKILL.md rule already covers this. |
| `tool_use` | assistant | `id`, `name`, `input`. This is the call. |
| `server_tool_use`, `advisor_tool_result` | assistant | Server-side tools such as web search and the advisor. Treat as call and result with no file exposure. |
| `tool_result` | user | `tool_use_id`, `content` (string or blocks), `is_error`. This is the result, paired by `tool_use_id` (recorded). |
| `image` | user | Omit the bytes and note the omission. |

Each tool result also carries a top-level `toolUseResult` object with structured data. That object is the reliable source for exposure (section 3). Prefer it over parsing `content` text.

## 3. Tool to exposure mapping

Claude Code exposes files through first-class tools, so the cleanest evidence comes from the tool name and its structured result, not from shell parsing.

| Tool (`name`) | Input | Structured result (`toolUseResult`) | Exposure |
|---|---|---|---|
| `Read` | `file_path`, `offset?`, `limit?` | `type: "text"`, `file: {filePath, content, numLines, startLine, totalLines}` | `read`. Full when `startLine == 1` and `numLines == totalLines`; otherwise partial with that exact range. Images and PDFs come back as other `type`s. |
| `Edit` | `file_path`, `old_string`, `new_string`, `replace_all?` | `filePath`, `oldString`, `newString`, `structuredPatch`, `originalFile`, `userModified` | `edited`. Never implies a read, per the skill's rule. |
| `Write` | `file_path`, `content` | `type: "create"\|"update"`, `filePath`, `content`, `structuredPatch` | `edited` (create or update). |
| `Grep` | `pattern`, `path?`, `glob?`, `output_mode?` | file list or match lines | Matched paths are `candidates`. Content-mode match lines are partial returns of those lines. |
| `Glob` | `pattern`, `path?` | file list | `candidates` only. |
| `Bash` | `command`, `description`, `run_in_background?` | `stdout`, `stderr`, `interrupted`, `isImage`, `noOutputExpected`, `returnCodeInterpretation?`, `persistedOutputPath?`, `backgroundTaskId?` | Reuse the existing conservative `cat`/`sed -n`/`head`/`rg` parsing. Exit status: the structured result has no exit-code field. A failed command sets `tool_result.is_error: true`, and its content text starts with `Exit code N`. Treat `is_error: false` as exit 0, and anything else as failed or unknown. `persistedOutputPath` means the output was truncated in context, so mark it partial. |
| `Skill` | `skill`, `args?` | `commandName`, `allowedTools`, `success` | The skill body arrives in the next `user` record (`isMeta`), whose text starts `Base directory for this skill: <dir>`. Record a full `read` of `<dir>/SKILL.md` at that record, linked to the call by order or `sourceToolUseID`. |
| `Agent` (sub-agent) | `subagent_type`, `name`, `description`, `prompt`, `model`, `run_in_background` | `agentId`, `status`, `resolvedModel`, `outputFile?` | Spawns a child session. The child transcript is `subagents/agent-<agentId>.jsonl`, and its `.meta.json` holds `agentType`, `customAgentType`, `model`, `permissionMode` and `spawnDepth`. See section 5. |
| `SendMessage` | `to`, `message` | `success`, `routing`, `resumedAgentId?` | A message to a child or peer session. A `recorded` link to that agent. |
| `TaskStop`, `TaskOutput`, `Monitor` | task id | status | Lifecycle only, no exposure. |
| `ToolSearch` | `query` | `matches` (tool names) | Loads deferred tool schemas into context. `candidates` or context, with no file exposure. |
| `AskUserQuestion` | `questions` | `questions`, `answers`, `annotations` | A user decision. Good `decisions` evidence. |
| `mcp__<server>__<tool>` | per server | per server | Unknown by default. Add per-server adapters later. |
| `Artifact`, `ArtifactData`, `WebFetch`, `WebSearch` | URLs | per tool | External sources, which are path-less sources keyed by URL. |

Batches: Claude Code issues parallel calls as several `tool_use` blocks across consecutive `assistant` records, with their `tool_result` blocks in later `user` records. Pairing is always by `tool_use_id`, so the Codex `Promise.all` wrapper decoding is not needed here. If a batch member's result says it was cancelled or skipped because a sibling failed, attribute that failure to the call and never to its file. We did not observe this case in our transcripts, so verify its exact text before relying on it.

## 4. Context assembly (where Claude Code beats Codex)

The skill's `contextRecords` today requires an explicit assembly record. Claude Code writes several, as `attachment` records. Each has `attachment.type`:

| `attachment.type` | Content | Use |
|---|---|---|
| `nested_memory` | `path`, `displayPath`, `content` of an auto-loaded `CLAUDE.md` / `AGENTS.md` | `read` plus `contextRecords: included`. Observed for nested entry files loaded on directory entry. |
| `instructions` | `files` loaded as project instructions | `contextRecords: included` |
| `skill_listing` | `names`, `content`, `skillCount`, `isInitial` | The skill catalog, which is the available-options set for `candidates`. |
| `invoked_skills`, `skill_mention` | skill names | Candidate mentions. |
| `agent_listing_delta`, `deferred_tools_delta`, `deferred_tools_record`, `mcp_instructions_delta` | Added and removed agent types, tool names and MCP instruction blocks | Changes to the tool and agent catalog over time. Removals are explicit `removed` records. |
| `file` | `filename`, `displayPath`, `content` | A file the user attached or referenced. `read` plus included. |
| `edited_text_file` | `filename`, `snippet` | A file changed outside the session and re-shown. |
| `compact_file_reference` | `filename`, `displayPath` | A file referenced in a compaction summary. The path is retained, the content is not. |
| `prompt_snapshot` | `systemPrompt`, `contextRendering`, `reminderFold`, `echoWireToolInputs` | The closest thing to an exact assembly record: the system prompt as sent. Hydrate as a context event. Redact before sharing. |
| `hook_success` | `hookEvent`, `hookName`, `command`, `stdout`, `stderr`, `exitCode` | Hook output. A hook's `additionalContext` is injected text and should count as context. |
| `thinking_drop`, `thinking_stripped` | Which thinking blocks were dropped from what was re-sent | Explicit removal evidence (`removed`) for reasoning context. |
| `environment`, `date`, `model`, `output_style`, `session_context`, `total_tokens_reminder`, `silent_turn_reminder`, `goal_status`, `task_status`, `queued_command` | Harness reminders and state | Context events with no file. Keep them inspectable, collapsed by default. |

Compaction:

- `system` with `subtype: "compact_boundary"` carries `compactMetadata`, which includes:
  - `trigger` (auto or manual), `preTokens`, `postTokens` and `cumulativeDroppedTokens`;
  - `preservedMessages: {anchorUuid, uuids, allUuids}`, which lists exactly which message uuids survived;
  - `preCompactDiscoveredTools`.
- That makes retention explicit. Every message uuid not in `preservedMessages.allUuids` and before the boundary is `removed` at that event, and the listed ones stay `included`. Codex cannot provide this, so Claude parity here can exceed Codex.
- The next `user` record with `isCompactSummary: true` is the retained summary text.

## 5. Sub-agents (no Codex equivalent)

A Claude Code session fans out to sub-agents, and each one has its own transcript. To keep the atlas honest:

- Hydrate each `subagents/agent-*.jsonl` as a child session, linked to the parent `Agent` tool call by `agentId` (from the call's `toolUseResult`). That link is recorded.
- The child's first `user` record is the prompt the parent sent, so its context starts from that prompt and not the parent's history. Mark the parent's exposures as not inherited.
- A child's final assistant text returns to the parent, either as the `Agent` tool result or later as a `<task-notification>` / teammate message in a parent `user` record. Link those back.
- `SendMessage` to a named agent resumes that child. Later records append to the same child file.
- Option: one report per session with collapsible child sessions, or one report per transcript plus a cross-link. The first matches how people ask questions ("what did the verifier read?").

## 6. Skill packaging for Claude Code

The skill already loads in Claude Code: frontmatter works, and the harness passes `Base directory for this skill: <dir>`, so absolute script paths resolve. To make the instructions host-neutral:

- Replace "Codex", `CODEX_HOME` and `CODEX_THREAD_ID` in SKILL.md with a host section, or branch on the detected root.
- Keep a single `fog.py hydrate`, and select the adapter by `--host` or by sniffing the first records (the presence of `parentUuid` and `sessionId` means Claude).
- `library.py` already resolves per-OS paths and needs no change.
- Python 3.9 and stdlib only still holds. No Claude-specific dependency is needed.

## 7. Acceptance for parity

1. `discover.py --host claude --repo /p` lists sessions for `/p` from `~/.claude/projects/<slug>/` without reading message bodies, and picks the latest by record timestamp.
2. `fog.py hydrate --host claude --trace <session>.jsonl` produces a v2 `session.json` that passes `fog.py validate`, with:
   - every `tool_use` paired to its `tool_result` by id;
   - Read, Edit and Write exposures with exact ranges;
   - Skill bodies as reads;
   - `nested_memory`, `instructions` and `file` attachments as `contextRecords: included`;
   - compaction with retention computed from `preservedMessages`;
   - thinking and images omitted, each with a coverage note.
3. Sub-agent transcripts hydrate as linked child sessions.
4. The shell renders the result with no Claude-specific code.
5. Fixtures: a small redacted Claude transcript in the skill's tests covers each table row above, including:
   - a failed Bash call (`is_error` with `Exit code 2`);
   - a parallel batch with one failed member;
   - a compaction boundary;
   - one sub-agent.

## 8. Privacy notes

Claude transcripts hold more than Codex ones:

- full system prompts (`prompt_snapshot`);
- hook stdout;
- pasted images;
- thinking signatures;
- organization ids (`credential_org`);
- account ids in artifact ledgers.

The adapter should drop `credential_org`, `cost-state`, artifact ledgers and thinking bytes by default, and offer `--include-system-prompt` as an opt-in.

## 9. A second, separate adapter (optional)

agent-ui also writes its own producer traces (`.agent-traces/YYYY-MM-DD.jsonl`, one line per model turn). Each line records:

- the agent, model and catalog;
- the referenced content block;
- few-shot `exemplarIds`;
- prompt chars, retries and failure codes;
- token usage.

These trace the product's context routing, not the coding session's, so this adapter is out of scope for Claude parity and listed only so the two are not confused.

Update, 2026-10-15: agent-ui shipped this adapter (T-0239, PR #2004). Each trace line now carries a `routing` block: catalog, persona, domains, mini-skills and prompt sections, exemplars, referenced resources (index-only or full), the stable and volatile system sections, and the cache boundary. Entry content and keys are never logged. `python3 scripts/agent-traces-to-fog.py <trace.jsonl> --out <session.json>` writes a v2 session: one event per turn, with its exposures as sources and `contextRecords` for included sources. Older lines without `routing` fall back to `exemplarIds`, `promptChars` and the framed user text. On the round 2 traces it produced 281 events, 66 sources and 91 findings. `fog.py validate` and `fog.py render` both accept the output. A keyless `selftest` guards the mapping. It is a worked example of a non-Codex adapter that only emits the documented schema, with no shell changes.
