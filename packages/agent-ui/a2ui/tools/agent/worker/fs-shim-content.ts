// fs-shim-content.ts — the ONLY file that needs updating when a prompt or mini-skill markdown file is
// added/removed under `src/agent/prompts/`. Statically imports every file `system-prompt.ts`'s
// `loadPrompt` and `mini-skills.ts`'s `loadMiniSkills` read via `node:fs` in the Node/Vite-dev context —
// bundled as plain strings at Worker-build time via Wrangler's Text module rule (wrangler.jsonc). Keys are
// the EXACT paths those two files compute from `process.cwd()` (shimmed to `''` by `process-shim.ts`), so
// `fs-shim.ts`'s `readFileSync`/`readdirSync` can serve them with zero changes to either canonical file.

import grammar from '../../../src/agent/prompts/grammar.md'
import honestyFloor from '../../../src/agent/prompts/honesty-floor.md'
// GH #418 — the re-taught note-line convention `genuiBlock` composes when `a2uiEnabled` is `false`
// (GRAMMAR itself composed zero bytes, so this file's own note-line paragraph doesn't ride along).
import a2uiOffNoteLine from '../../../src/agent/prompts/a2ui-off-note-line.md'
import clarifySpecific from '../../../src/agent/prompts/clarify-specific.md'
import negotiateSpecific from '../../../src/agent/prompts/negotiate-specific.md'
import clarifyBlueSky from '../../../src/agent/prompts/clarify-blue-sky.md'
import negotiateBlueSky from '../../../src/agent/prompts/negotiate-blue-sky.md'
import askArchetypesSpecific from '../../../src/agent/prompts/ask-archetypes-specific.md'
import askArchetypesBlueSky from '../../../src/agent/prompts/ask-archetypes-blue-sky.md'
import genuiTeaching from '../../../src/agent/prompts/genui-teaching.md'
// genui-surface.spec.md SPEC-R13(a) — the dogfood segment's hand-authored teaching half (GH #316/ADR-0162).
import genuiDogfoodTeaching from '../../../src/agent/prompts/genui-dogfood-teaching.md'
// ADR-0178 cl.1/cl.3 (SPEC-R30) — the personaPatch arm's mechanics teaching, composed by
// `authoringBlock` only under the persona's own authoring gate.
import authoringTeaching from '../../../src/agent/prompts/authoring-teaching.md'
// ADR-0182 cl.2/cl.3 (SPEC-R31) — the builder-mission drive-to-completion teaching, composed by
// `missionBlock` only when this turn IS the Builder's own dedicated interview.
import builderMission from '../../../src/agent/prompts/builder-mission.md'

import cardGameSheet from '../../../src/agent/prompts/mini-skills/card-game-sheet.md'
import cardLayout from '../../../src/agent/prompts/mini-skills/card-layout.md'
// GH #1355 — the preset-vs-catalog gap-analysis trio (crud-entry-list / table-toolbar-pagination /
// nested-record-editor).
import crudEntryList from '../../../src/agent/prompts/mini-skills/crud-entry-list.md'
import dashboardKpiGrid from '../../../src/agent/prompts/mini-skills/dashboard-kpi-grid.md'
import formRhythm from '../../../src/agent/prompts/mini-skills/form-rhythm.md'
import gameHud from '../../../src/agent/prompts/mini-skills/game-hud.md'
// GH #1201 (req-a2ui-patterns R3) — the persona-conditional greet-bookend module.
import greetingCard from '../../../src/agent/prompts/mini-skills/greeting-card.md'
import gameTableChrome from '../../../src/agent/prompts/mini-skills/game-table-chrome.md'
import loginForm from '../../../src/agent/prompts/mini-skills/login-form.md'
import masterDetailSplit from '../../../src/agent/prompts/mini-skills/master-detail-split.md'
import nestedRecordEditor from '../../../src/agent/prompts/mini-skills/nested-record-editor.md'
import settingsScreen from '../../../src/agent/prompts/mini-skills/settings-screen.md'
import tableToolbarPagination from '../../../src/agent/prompts/mini-skills/table-toolbar-pagination.md'
// GH #808 S4 (a2ui-container-vocabulary.spec.md SPEC-R8) — the structured-container taught tier.
import structuredContainer from '../../../src/agent/prompts/mini-skills/structured-container.md'
// GH #1377 — the commerce+hospitality genui-pack: six composed idioms (product-presentation ·
// feature-collection · variant-picker · quantity · media-grid · comparison-table).
import productPresentation from '../../../src/agent/prompts/mini-skills/product-presentation.md'
import featureCollection from '../../../src/agent/prompts/mini-skills/feature-collection.md'
import variantPicker from '../../../src/agent/prompts/mini-skills/variant-picker.md'
import quantity from '../../../src/agent/prompts/mini-skills/quantity.md'
import mediaGrid from '../../../src/agent/prompts/mini-skills/media-grid.md'
import comparisonTable from '../../../src/agent/prompts/mini-skills/comparison-table.md'

// genui-surface.spec.md SPEC-R9 — the third Node-only readFileSync/readdirSync call site
// (`prompts/genui-packs.ts`), backed the SAME way as the mini-skills registry above.
import dataVizLayouts from '../../../src/agent/prompts/genui-packs/data-viz-layouts.md'
import interactiveWidgets from '../../../src/agent/prompts/genui-packs/interactive-widgets.md'
import animatedExplainers from '../../../src/agent/prompts/genui-packs/animated-explainers.md'

const PROMPTS_PATH = '/packages/agent-ui/a2ui/src/agent/prompts'
const MINI_SKILLS_PATH = `${PROMPTS_PATH}/mini-skills`
const GENUI_PACKS_PATH = `${PROMPTS_PATH}/genui-packs`

export const FILES: Record<string, string> = {
  [`${PROMPTS_PATH}/grammar.md`]: grammar,
  [`${PROMPTS_PATH}/honesty-floor.md`]: honestyFloor,
  [`${PROMPTS_PATH}/a2ui-off-note-line.md`]: a2uiOffNoteLine,
  [`${PROMPTS_PATH}/clarify-specific.md`]: clarifySpecific,
  [`${PROMPTS_PATH}/negotiate-specific.md`]: negotiateSpecific,
  [`${PROMPTS_PATH}/clarify-blue-sky.md`]: clarifyBlueSky,
  [`${PROMPTS_PATH}/negotiate-blue-sky.md`]: negotiateBlueSky,
  [`${PROMPTS_PATH}/ask-archetypes-specific.md`]: askArchetypesSpecific,
  [`${PROMPTS_PATH}/ask-archetypes-blue-sky.md`]: askArchetypesBlueSky,
  [`${PROMPTS_PATH}/genui-teaching.md`]: genuiTeaching,
  [`${PROMPTS_PATH}/genui-dogfood-teaching.md`]: genuiDogfoodTeaching,
  [`${PROMPTS_PATH}/authoring-teaching.md`]: authoringTeaching,
  [`${PROMPTS_PATH}/builder-mission.md`]: builderMission,
  [`${GENUI_PACKS_PATH}/data-viz-layouts.md`]: dataVizLayouts,
  [`${GENUI_PACKS_PATH}/interactive-widgets.md`]: interactiveWidgets,
  [`${GENUI_PACKS_PATH}/animated-explainers.md`]: animatedExplainers,
  [`${MINI_SKILLS_PATH}/card-game-sheet.md`]: cardGameSheet,
  [`${MINI_SKILLS_PATH}/card-layout.md`]: cardLayout,
  [`${MINI_SKILLS_PATH}/crud-entry-list.md`]: crudEntryList,
  [`${MINI_SKILLS_PATH}/dashboard-kpi-grid.md`]: dashboardKpiGrid,
  [`${MINI_SKILLS_PATH}/form-rhythm.md`]: formRhythm,
  [`${MINI_SKILLS_PATH}/game-hud.md`]: gameHud,
  [`${MINI_SKILLS_PATH}/game-table-chrome.md`]: gameTableChrome,
  [`${MINI_SKILLS_PATH}/greeting-card.md`]: greetingCard,
  [`${MINI_SKILLS_PATH}/login-form.md`]: loginForm,
  [`${MINI_SKILLS_PATH}/master-detail-split.md`]: masterDetailSplit,
  [`${MINI_SKILLS_PATH}/nested-record-editor.md`]: nestedRecordEditor,
  [`${MINI_SKILLS_PATH}/settings-screen.md`]: settingsScreen,
  [`${MINI_SKILLS_PATH}/structured-container.md`]: structuredContainer,
  [`${MINI_SKILLS_PATH}/product-presentation.md`]: productPresentation,
  [`${MINI_SKILLS_PATH}/feature-collection.md`]: featureCollection,
  [`${MINI_SKILLS_PATH}/variant-picker.md`]: variantPicker,
  [`${MINI_SKILLS_PATH}/quantity.md`]: quantity,
  [`${MINI_SKILLS_PATH}/media-grid.md`]: mediaGrid,
  [`${MINI_SKILLS_PATH}/comparison-table.md`]: comparisonTable,
  [`${MINI_SKILLS_PATH}/table-toolbar-pagination.md`]: tableToolbarPagination,
}

// mini-skills.ts's `loadMiniSkills` re-`.sort()`s this list itself, so insertion order here is not
// load-bearing — only the file SET must match `src/agent/prompts/mini-skills/*.md` on disk.
export const DIRS: Record<string, string[]> = {
  [MINI_SKILLS_PATH]: [
    'card-game-sheet.md',
    'card-layout.md',
    'crud-entry-list.md',
    'dashboard-kpi-grid.md',
    'form-rhythm.md',
    'game-hud.md',
    'game-table-chrome.md',
    'greeting-card.md',
    'login-form.md',
    'master-detail-split.md',
    'nested-record-editor.md',
    'settings-screen.md',
    'structured-container.md',
    'product-presentation.md',
    'feature-collection.md',
    'variant-picker.md',
    'quantity.md',
    'media-grid.md',
    'comparison-table.md',
    'table-toolbar-pagination.md',
  ],
  // genui-surface.spec.md SPEC-R9 — `genui-packs.ts`'s own readdirSync target.
  [GENUI_PACKS_PATH]: ['animated-explainers.md', 'data-viz-layouts.md', 'interactive-widgets.md'],
}
