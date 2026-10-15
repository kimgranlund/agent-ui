// Throwaway step-7 comment rewrites: exact [file, from, to] substitutions; each `from` must match once or more.
import { readFileSync, writeFileSync } from 'node:fs'
const C = 'packages/agent-ui/components/src/controls/'
const A = 'packages/agent-ui/app/src/'
const S = [
  ['packages/agent-ui/a2ui/src/live-agent/dogfood-tag-set-equality.test.ts', [
    ['the tags the real barrel REGISTERS AT RUNTIME', 'the tags the real `@agent-ui/components/all` entry REGISTERS AT RUNTIME'],
    ['import the real components barrel, recording', 'import the real `@agent-ui/components/all` entry, recording'],
    ['the REAL components barrel registers when it loads', 'the REAL `@agent-ui/components/all` entry registers when it loads'],
    ['(`beforeAll`): the barrel self-defines on', '(`beforeAll`): the `all` entry self-defines on'],
    ['what the real barrel REGISTERS at runtime', 'what the real `all` entry REGISTERS at runtime'],
    ['the tags the components barrel actually self-defines', 'the tags the `all` entry actually self-defines'],
  ]],
  ['packages/agent-ui/a2ui/src/renderer/card-header-slot.browser.test.ts', [
    ["the `component-styles.css` barrel\n// precedent,", "the `all.css` demo sheet,"],
    ["only self-defines the CUSTOM ELEMENTS (`@agent-ui/components/components`)", "only self-defines the CUSTOM ELEMENTS (`@agent-ui/components/all` here)"],
    ['must import the stylesheet barrels itself', 'must import the stylesheets itself'],
  ]],
  [`${A}agent-admin-lazy.browser.test.ts`, [['(the foundation, the family barrel, every', '(the foundation, `all.css`, every']]],
  [`${A}controls/chat-shell/chat-shell.browser.test.ts`, [['foundation, then\n// component-styles, then', 'foundation, then\n// `all.css`, then']]],
  [`${A}controls/agent-admin/agent-admin.browser.test.ts`, [["`component-styles.css` (the family barrel carries ui-text-field/etc.'s shipped CSS)", "`all.css` (every fleet sheet, so ui-text-field/etc.'s shipped CSS)"]]],
  [`${A}controls/nav-rail/nav-rail.browser.test.ts`, [['then the\n// components barrel (ui-menu', 'then\n// `all.css` (ui-menu']]],
  [`${A}controls/nav-rail/nav-rail.visual.browser.test.ts`, [['then the\n// components barrel, then', 'then\n// `all.css`, then']]],
  [`${A}controls/super-shell/super-shell.visual.browser.test.ts`, [['then the\n// components barrel, then', 'then\n// `all.css`, then']]],
  [`${A}controls/super-shell/super-shell-resize-tabs.browser.test.ts`, [['(tabs.css, via the\n// family barrel)', '(tabs.css, via\n// `all.css`)']]],
  [`${A}controls/super-shell/super-shell-responsive.browser.test.ts`, [['(tabs.css, via\n// the family barrel)', '(tabs.css, via\n// `all.css`)']]],
  [`${A}controls/master-detail/master-detail.browser.test.ts`, [[
    "`component-styles.css` (the family barrel — @agent-ui/components has NO standalone per-control\n// CSS export, only the aggregate barrel; this is what actually carries ui-split/ui-split-pane's shipped CSS\n// to a consumer OUTSIDE the components package, the site `_page.ts` precedent)",
    "`all.css` (every fleet sheet; this is what carries ui-split/ui-split-pane's shipped CSS\n// to a consumer OUTSIDE the components package, the site `_page.ts` precedent)",
  ]]],
  [`${C}button/button-states.browser.test.ts`, [['then the self-defining family barrel.', 'then the self-defining `all` entry.']]],
  [`${C}button/button-geometry.browser.test.ts`, [['then the self-defining family barrel.', 'then the self-defining `all` entry.']]],
  [`${C}button/button.browser.test.ts`, [
    ['then the self-defining family barrel (registers `ui-button`)', 'then the self-defining `all` entry (registers `ui-button`)'],
    ["the barrels' inner `@import", "the sheets' inner `@import"],
  ]],
  [`${C}form-provider/form-e2e.browser.test.ts`, [
    ['component-styles loaded,', '`all.css` loaded,'],
    ['then the self-defining family\n// barrel (registers', 'then the self-defining `all`\n// entry (registers'],
  ]],
  [`${C}field/field.browser.test.ts`, [
    ['all @import through the barrel, s12)', 'all through `all.css`, s12)'],
    ['then the self-defining family barrel.', 'then the self-defining `all` entry.'],
  ]],
  [`${C}form-provider/form-provider.browser.test.ts`, [
    ['all @import through the barrel,', 'all through `all.css`,'],
    ['then the self-defining family barrel.', 'then the self-defining `all` entry.'],
  ]],
  [`${C}radio/radio-group.browser.test.ts`, [['Imports the self-defining family barrel + the foundation/component CSS', 'Imports the self-defining `all` entry + the foundation/component CSS']]],
  [`${C}radio/radio.browser.test.ts`, [['Imports the self-defining family barrel + the foundation/component CSS', 'Imports the self-defining `all` entry + the foundation/component CSS']]],
  [`${C}icon/icon-geometry.browser.test.ts`, [['then the self-defining family barrel (registers BOTH\n// ui-button and ui-icon — icon.ts already joins controls/index.ts).', 'then the self-defining `all` entry (registers BOTH\n// ui-button and ui-icon).']]],
  [`${C}service-card/service-card.browser.test.ts`, [['(via the wired barrel — service-card IS integrated into\n// component-styles.css/controls/index.ts), then the self-defining family barrel.', '(via `all.css`, which carries\n// service-card.css), then the self-defining `all` entry.']]],
  [`${C}switch/switch.browser.test.ts`, [['then the self-defining barrel.', 'then the self-defining `all` entry.']]],
  [`${C}text-field/text-field-states.browser.test.ts`, [['then the self-defining family barrel.', 'then the self-defining `all` entry.']]],
  [`${C}textarea/textarea.browser.test.ts`, [['then the self-defining family barrel.', 'then the self-defining `all` entry.']]],
  [`${C}toggle/toggle.browser.test.ts`, [['then the self-defining family barrel.', 'then the self-defining `all` entry.']]],
  [`${C}text-field/text-field-geometry.browser.test.ts`, [
    ['then the self-defining\n// family barrel (registers ui-text-field)', 'then the self-defining\n// `all` entry (registers ui-text-field)'],
    ['The `@agent-ui/components/components` barrel already registers `<ui-calendar>` (controls/index.ts\n// line 53).', 'The `@agent-ui/components/all` entry already registers `<ui-calendar>`.'],
    ['The barrel pre-registers ui-calendar,', 'The `all` entry pre-registers ui-calendar,'],
    ['since the barrel\n//      pre-registers it', 'since the `all`\n//      entry pre-registers it'],
    ['The `@agent-ui/components/components` barrel already registers `<ui-color-picker>` (controls/index.ts),', 'The `@agent-ui/components/all` entry already registers `<ui-color-picker>`,'],
  ]],
  [`${C}text/text.browser.test.ts`, [
    ['then component-styles (text.css)', 'then `all.css` (text.css)'],
    ['// includes text.css (added to the barrel)', '// includes text.css'],
  ]],
  ['site/lib/component-preview.browser.test.ts', [['imported explicitly (the two barrels)', 'imported explicitly (foundation + `all.css`)']]],
  ['site/pages/a2ui-live.ts', [["`_page.ts`'s `@agent-ui/components/components` import, step [3]", "`_page.ts`'s `@agent-ui/components/all` import, step [3]"]]],
  ['site/pages/form-provider-demo.ts', [['// the barrel re-exports the class (s12)', '// the control entry exports the class (s12)']]],
]
let bad = 0
for (const [f, subs] of S) {
  let src = readFileSync(f, 'utf8')
  for (const [from, to] of subs) {
    if (!src.includes(from)) { console.error(`MISS ${f}: ${JSON.stringify(from).slice(0, 80)}`); bad++; continue }
    src = src.split(from).join(to)
  }
  writeFileSync(f, src)
}
process.exit(bad ? 1 : 0)
