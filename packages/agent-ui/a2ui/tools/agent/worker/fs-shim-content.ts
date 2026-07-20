// fs-shim-content.ts — the ONLY file that needs updating when a prompt or mini-skill markdown file is
// added/removed under `src/agent/prompts/`. Statically imports every file `system-prompt.ts`'s
// `loadPrompt` and `mini-skills.ts`'s `loadMiniSkills` read via `node:fs` in the Node/Vite-dev context —
// bundled as plain strings at Worker-build time via Wrangler's Text module rule (wrangler.jsonc). Keys are
// the EXACT paths those two files compute from `process.cwd()` (shimmed to `''` by `process-shim.ts`), so
// `fs-shim.ts`'s `readFileSync`/`readdirSync` can serve them with zero changes to either canonical file.

import grammar from '../../../src/agent/prompts/grammar.md'
import honestyFloor from '../../../src/agent/prompts/honesty-floor.md'
import clarifySpecific from '../../../src/agent/prompts/clarify-specific.md'
import negotiateSpecific from '../../../src/agent/prompts/negotiate-specific.md'
import clarifyBlueSky from '../../../src/agent/prompts/clarify-blue-sky.md'
import negotiateBlueSky from '../../../src/agent/prompts/negotiate-blue-sky.md'
import askArchetypesSpecific from '../../../src/agent/prompts/ask-archetypes-specific.md'
import askArchetypesBlueSky from '../../../src/agent/prompts/ask-archetypes-blue-sky.md'

import cardGameSheet from '../../../src/agent/prompts/mini-skills/card-game-sheet.md'
import cardLayout from '../../../src/agent/prompts/mini-skills/card-layout.md'
import dashboardKpiGrid from '../../../src/agent/prompts/mini-skills/dashboard-kpi-grid.md'
import formRhythm from '../../../src/agent/prompts/mini-skills/form-rhythm.md'
import gameHud from '../../../src/agent/prompts/mini-skills/game-hud.md'
import gameTableChrome from '../../../src/agent/prompts/mini-skills/game-table-chrome.md'
import loginForm from '../../../src/agent/prompts/mini-skills/login-form.md'
import masterDetailSplit from '../../../src/agent/prompts/mini-skills/master-detail-split.md'
import settingsScreen from '../../../src/agent/prompts/mini-skills/settings-screen.md'

const PROMPTS_PATH = '/packages/agent-ui/a2ui/src/agent/prompts'
const MINI_SKILLS_PATH = `${PROMPTS_PATH}/mini-skills`

export const FILES: Record<string, string> = {
  [`${PROMPTS_PATH}/grammar.md`]: grammar,
  [`${PROMPTS_PATH}/honesty-floor.md`]: honestyFloor,
  [`${PROMPTS_PATH}/clarify-specific.md`]: clarifySpecific,
  [`${PROMPTS_PATH}/negotiate-specific.md`]: negotiateSpecific,
  [`${PROMPTS_PATH}/clarify-blue-sky.md`]: clarifyBlueSky,
  [`${PROMPTS_PATH}/negotiate-blue-sky.md`]: negotiateBlueSky,
  [`${PROMPTS_PATH}/ask-archetypes-specific.md`]: askArchetypesSpecific,
  [`${PROMPTS_PATH}/ask-archetypes-blue-sky.md`]: askArchetypesBlueSky,
  [`${MINI_SKILLS_PATH}/card-game-sheet.md`]: cardGameSheet,
  [`${MINI_SKILLS_PATH}/card-layout.md`]: cardLayout,
  [`${MINI_SKILLS_PATH}/dashboard-kpi-grid.md`]: dashboardKpiGrid,
  [`${MINI_SKILLS_PATH}/form-rhythm.md`]: formRhythm,
  [`${MINI_SKILLS_PATH}/game-hud.md`]: gameHud,
  [`${MINI_SKILLS_PATH}/game-table-chrome.md`]: gameTableChrome,
  [`${MINI_SKILLS_PATH}/login-form.md`]: loginForm,
  [`${MINI_SKILLS_PATH}/master-detail-split.md`]: masterDetailSplit,
  [`${MINI_SKILLS_PATH}/settings-screen.md`]: settingsScreen,
}

// mini-skills.ts's `loadMiniSkills` re-`.sort()`s this list itself, so insertion order here is not
// load-bearing — only the file SET must match `src/agent/prompts/mini-skills/*.md` on disk.
export const DIRS: Record<string, string[]> = {
  [MINI_SKILLS_PATH]: [
    'card-game-sheet.md',
    'card-layout.md',
    'dashboard-kpi-grid.md',
    'form-rhythm.md',
    'game-hud.md',
    'game-table-chrome.md',
    'login-form.md',
    'master-detail-split.md',
    'settings-screen.md',
  ],
}
