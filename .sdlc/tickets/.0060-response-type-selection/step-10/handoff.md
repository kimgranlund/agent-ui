## Task goal
A chat turn picks its response type deliberately: plain text, an A2UI surface, or text then a surface, with text streaming first so the chat feels fast. Decided inside the turn by the model through a `render_surface` tool (text is the default), not by a router model call in front of it.

## Step 10: Loose ends: tighten the user-override lexicon
level: L2
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Fix the override lexicon false positives the step 2 verifier found (task handoff `## Notes`, LOOSE END). In `packages/agent-ui/a2ui/src/agent/response-type.ts`: drop bare `render` and `in words` from the phrase lists; make `show me`, `build a` and `make me a` count as surface overrides only when a surface noun follows within the next four words (surface nouns: form, card, table, chart, dashboard, panel, survey, calculator, checklist, widget, page, screen, list, plans, tabs, wizard); keep `as a card`, `as a table`, `as a chart`, and every text phrase except `in words`. Keep the whole-word boundary and the text-wins-a-tie rule. Update `response-type.test.ts` for the changed phrases and add a `describe("lexicon false positives", ...)` holding the seven phrases and the must-still-match phrases, and SPEC RTS-R6 (`.claude/docs/spec/response-type-selection.spec.md`) so the lexicon list and its ACs match the code (bump its status line to v0.3). Do not touch any other file. Run `npx tsc -p tsconfig.json` before reporting.

Validation scope: `response-type.test.ts`, the a2ui `layering.test.ts`, `produce-response-type.test.ts`, the agent-eval tests, doc_lint on the SPEC.
### Acceptance criteria
- (red) `node --experimental-strip-types --input-type=module -e "import { detectUserOverride as d } from './packages/agent-ui/a2ui/src/agent/response-type.ts'; const i = (text) => ({ kind: 'intent', text, session: { turns: [] } }); const none = ['show me the capital of Finland', 'Can you render my resume summary?', 'what is a Render farm', 'How do I build a house', 'Please make me a sandwich recipe', 'the render() function', 'tell me a story in words of one syllable']; const bad = none.filter((t) => d(i(t)) !== undefined); const ok = bad.length === 0 && d(i('show me the plans as a table')) === 'surface' && d(i('Make me a short satisfaction survey')) === 'surface' && d(i('Build a settings panel')) === 'surface' && d(i('show me a pricing table')) === 'surface' && d(i('Just tell me the price')) === 'text' && d(i('text only please')) === 'text'; if (!ok) console.error(bad); process.exit(ok ? 0 : 1)"`
- (red) `out=$(npx vitest run --project packages packages/agent-ui/a2ui/src/agent/response-type.test.ts -t "lexicon false positives" 2>&1) && printf "%s\n" "$out" | grep -qE "Tests +[1-9][0-9]* passed"`
- (red) `python3 -c "import sys; s=open('packages/agent-ui/a2ui/src/agent/response-type.ts').read(); sys.exit(0 if \"'render'\" not in s and \"'in words'\" not in s else 1)"`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/agent/response-type.test.ts packages/agent-ui/a2ui/src/layering.test.ts packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts`
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent-eval/`
- (guard) `python3 /Users/kimgranlund/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py .claude/docs/spec/response-type-selection.spec.md`
- (guard) `for f in $(git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc" ":(exclude).worktrees"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc" ":(exclude).worktrees"); do case "$f" in packages/agent-ui/a2ui/src/agent/response-type.ts|packages/agent-ui/a2ui/src/agent/response-type.test.ts|.claude/docs/spec/response-type-selection.spec.md) ;; *) echo "out of scope: $f"; exit 1;; esac; done`
